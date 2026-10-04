# Serve to browsers (https://irc-hslu.github.io/orbbecstreamer/docs/server/serving)



Browsers will connect to the server over WebTransport: a browser API for
low-latency streams over HTTP/3 and QUIC, always encrypted with TLS. Each
browser gets its own session with one control stream plus one stream each
for colour and depth. The wire format is defined in
`protocol/wire-format.md`.

## Status [#status]

**Not yet available.** The server does not accept browser connections today.
`--live` captures, processes and encodes, but hands the encoded bundles only
to the debug recorder. There is no listening socket and no port to open.

What exists:

| Part                                                 | Status                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport choice                                     | Decided: a small Go gateway built on `webtransport-go`, in front of the C++ server. Not built yet. The design record is `server/docs/architecture/adr/0002-webtransport-server.md`.                                                                                         |
| Session and control logic (`src/session/SessionHub`) | Implemented and unit-tested, not connected to a network listener.                                                                                                                                                                                                           |
| Link between the C++ server and the gateway (IPC v1) | The message format is defined and implemented on both sides, in C++ (`server/src/network/GatewayIpc`) and Go (`server/gateway/internal/ipc`), and tested against shared test vectors. Nothing uses it yet. The byte layout is in `server/docs/architecture/gateway-ipc.md`. |
| HTTPS, HTTP/3 and WebTransport listener              | Not implemented.                                                                                                                                                                                                                                                            |
| WebTransport spike (`server/spike/webtransport`)     | A throwaway experiment with synthetic media. It shows that Chromium works with the chosen stack. It is not a server for real cameras.                                                                                                                                       |
| `--websocket-test`                                   | A placeholder that prints `WebSocket smoke test OK`. WebSocket is not, and will not be, the production transport.                                                                                                                                                           |

What you can do today: check that your browser can open a WebTransport
session, with the spike below, and prepare certificates
([TLS certificates](#tls-certificates)).

## Try the WebTransport spike [#try-the-webtransport-spike]

The spike is a small WebTransport server that sends synthetic colour and
depth frames shaped like the wire format, plus a test page. It does not use
cameras or the C++ server.

It needs Go 1.27.1 or newer with `go` on your `PATH`. Install it from
[go.dev/dl](https://go.dev/dl/) and check with `go version`.

1. From the repository root, start the spike with 60 seconds of media:

   ```bash
   cd server/spike/webtransport
   go run ./day1 -duration 60s
   ```

   The first run downloads the Go modules pinned in `go.sum`. The spike makes
   its own short-lived certificate at every start.

2. Open `http://localhost:8080/` in Chrome or Chromium on the same machine.
   The page connects to `https://127.0.0.1:4433/session` with the pinned
   certificate hash.

   Or run the page headless:

   ```bash
   chromium --headless=new --user-data-dir="$HOME/snap/chromium/common/wt-spike" --enable-quic --origin-to-force-quic-on=127.0.0.1:4433 http://localhost:8080/
   ```

   Headless Chromium does not exit on its own. Stop it with Ctrl+C after the
   spike has printed its verdict. The `--user-data-dir` above suits the snap
   package of Chromium; for other builds, any new empty directory works.

Useful flags of `./day1`:

| Flag                            | Default            | Meaning                                                                               |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `-duration`                     | `60s`              | How long media is sent.                                                               |
| `-rate`                         | `60`               | Bundles per second.                                                                   |
| `-color-bytes` / `-depth-bytes` | `150000` / `60000` | Size of each synthetic access unit (one encoded frame).                               |
| `-gop`                          | `60`               | Keyframe interval in frames.                                                          |
| `-pace`                         | `1`                | Split each access unit into this many writes, spread over 80 % of the frame interval. |
| `-wt`                           | `127.0.0.1:4433`   | WebTransport address (UDP).                                                           |
| `-http`                         | `localhost:8080`   | Address of the test page (plain HTTP).                                                |
| `-report`                       | none               | Also write the page's report JSON to this file.                                       |

### Expected result [#expected-result]

A 5-second run with headless Chromium 153 on the development machine:

```text
2026/09/28 01:25:20 certificate sha-256 a018cdb0c32c5fcfdc769df27025c1432a6f8ecaaebf7ae08db838596c8104f2 (ECDSA P-256, valid 13 days)
2026/09/28 01:25:21 open http://localhost:8080/ (WebTransport on 127.0.0.1:4433)
2026/09/28 01:25:23 client.hello from spike-page
2026/09/28 01:25:28 page report:
...
color: sent 300 received 300 gaps 0
depth: sent 300 received 300 gaps 0
one-way (offset from min-RTT sample): uplink p50 0.70 p99 1.90 ms, downlink p50 1.93 p99 8.23 ms
control RTT p50 2.80 ms, p99 9.10 ms
DAY 1 FAIL
```

WebTransport works when `client.hello` arrives and every record sent is
received with 0 gaps.

The final `DAY 1 PASS` or `DAY 1 FAIL` also requires a control round trip
below 5 ms at p99. Unpaced 60 Hz media usually misses that in Chromium, so
`FAIL` here does not mean WebTransport is broken. Add `-pace 8` to reproduce
the passing configuration. The full results are in
`server/spike/webtransport/README.md`.

## TLS certificates [#tls-certificates]

WebTransport always uses TLS, so the browser must trust the server's
certificate. There are two ways.

### Development: a pinned certificate hash [#development-a-pinned-certificate-hash]

The web page can pass the SHA-256 hash of the certificate in the
`serverCertificateHashes` option. The browser then skips the usual check
against a certificate authority (CA). Browsers accept this only when the
certificate:

* is an X.509 version 3 certificate,
* uses an ECDSA P-256 key (RSA is rejected),
* is valid for less than 14 days in total.

The planned gateway will make and renew such a certificate itself (valid 13
days), as the spike already does. To make one by hand:

1. Create the key and certificate:

   ```bash
   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
     -keyout dev-key.pem -out dev-cert.pem -days 13 \
     -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
   ```

   If the browser runs on another machine, replace `localhost` and
   `127.0.0.1` with the server's host name and IP address.

2. Check the result:

   ```bash
   openssl x509 -in dev-cert.pem -noout -text | grep -E 'Version|Not Before|Not After|NIST CURVE'
   ```

   ```text
           Version: 3 (0x2)
               Not Before: Sep 27 23:27:17 2026 GMT
               Not After : Oct 10 23:27:17 2026 GMT
                   NIST CURVE: P-256
   ```

3. Compute the SHA-256 hash of the certificate's DER bytes (not of the PEM
   file):

   ```bash
   openssl x509 -in dev-cert.pem -outform der | openssl dgst -sha256
   ```

   ```text
   SHA2-256(stdin)= 60de4994bf1f6287ca11519c17426ab1b3da32dc8c3eadcee61ce4b61e7f9338
   ```

   The browser takes these 32 bytes as the `value` of a
   `{ algorithm: 'sha-256', value }` entry in `serverCertificateHashes`. If
   the client wants the same hash as Base64:

   ```bash
   openssl x509 -in dev-cert.pem -outform der | openssl dgst -sha256 -binary | base64
   ```

4. Make a new certificate before the old one expires. The hash changes
   every time.

Safari is assumed not to support `serverCertificateHashes`. Use a CA-issued
certificate for Safari.

### Production: a CA-issued certificate [#production-a-ca-issued-certificate]

For real deployments, use a certificate from a public CA (for example Let's
Encrypt) or from a CA that the client machines trust. Issue it for the host
name the browsers use. The browser then connects without a hash, and the
14-day and ECDSA limits do not apply. How the gateway loads it will be
documented when the gateway exists.

## The planned model [#the-planned-model]

This is the chosen design. It is not built yet, so details may still change.

* The C++ server starts and supervises a small Go gateway process. The
  gateway owns the UDP port, TLS and the WebTransport sessions.
* The C++ server keeps all media decisions: a bounded queue per client,
  dropping data for slow clients, keyframe recovery and revisions. The
  gateway only moves bytes.
* Encoded frames reach the gateway through shared memory, without a copy
  per client.
* A slow browser can only slow its own session. It never blocks capture,
  GPU processing or encoding.
* A session stays open through short network drops of a few seconds. A
  longer silence ends it, and the client reconnects with a new session.
* The UDP port and the certificate settings will live in a gateway section
  of the server config. That section does not exist yet.

## Troubleshooting [#troubleshooting]

| Symptom                                                          | Cause and fix                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page never connects; no `client.hello` in the spike's log    | The browser did not use QUIC to `127.0.0.1:4433`. Use Chrome or Chromium on the same machine as the spike, and check with `ss -ulpn` that nothing else uses UDP port 4433.                      |
| Browser error about the certificate or `serverCertificateHashes` | The certificate breaks a browser rule: not ECDSA P-256, or valid for 14 days or more. Recreate it with the command above. For the spike, restart it: it makes a new certificate at every start. |
| The hash is rejected although the certificate is fine            | The hash was computed over the PEM file. Hash the DER bytes as shown above.                                                                                                                     |
| `go: command not found`                                          | Go is not installed or not on `PATH`. Install Go 1.27.1 or newer and add its `bin` folder to `PATH`.                                                                                            |
| Safari does not connect with a hash                              | Expected: Safari needs a CA-issued certificate.                                                                                                                                                 |
