# Serve to browsers (https://irc-hslu.github.io/orbbecstreamer/docs/server/serving)



Browsers will connect to the server over WebTransport (HTTP/3 over QUIC,
always TLS). Each browser gets one session: a control stream plus one stream
each for colour and depth. The wire format is defined in
`protocol/wire-format.md`.

## Status [#status]

**Not yet available.** The server does not accept browser connections today.
`--live` captures, processes and encodes, but hands the encoded bundles only
to the debug recorder. There is no listening socket and no port to open.

What exists:

| Part                                                 | Status                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport choice                                     | ADR 0002 (`server/docs/architecture/adr/0002-webtransport-server.md`), status *Proposed*: a Go `webtransport-go` gateway in front of the C++ server. |
| Session and control logic (`src/session/SessionHub`) | Implemented and unit-tested, not connected to a network listener.                                                                                    |
| HTTPS/HTTP3/WebTransport listener                    | Not implemented (roadmap P3).                                                                                                                        |
| WebTransport spike (`server/spike/webtransport`)     | A throwaway experiment with synthetic media. It shows that Chromium works with the chosen stack. Not a server for real cameras.                      |
| `--websocket-test`                                   | A placeholder that prints `WebSocket smoke test OK`. WebSocket is not and will not be the production transport.                                      |

## The planned model [#the-planned-model]

This is the design in ADR 0002. Details may change before it ships.

* The C++ server starts and supervises a small Go gateway process. The
  gateway owns the UDP port, TLS and the WebTransport sessions.
* The C++ server keeps all media decisions: per-client bounded queues,
  dropping for slow clients, keyframe recovery, revisions. The gateway only
  moves bytes.
* Encoded frames are passed to the gateway through shared memory, without a
  copy per client.
* A slow browser can only slow its own session. It never blocks capture, GPU
  processing or encoding.
* The UDP port and the certificate settings will live in a gateway section of
  the server config. That section does not exist yet.

## TLS certificates [#tls-certificates]

WebTransport always uses TLS. There are two ways for a browser to trust the
server.

### Development: a pinned certificate hash [#development-a-pinned-certificate-hash]

The browser can skip the CA check if the page passes the certificate's
SHA-256 hash in `serverCertificateHashes`. Browsers accept this only when the
certificate:

* is an X.509v3 certificate,
* uses an ECDSA P-256 key (RSA is rejected),
* is valid for less than 14 days in total.

The planned gateway will generate and rotate such a certificate itself (13
days), as the spike already does. To make one by hand:

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -keyout dev-key.pem -out dev-cert.pem -days 13 \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Replace `localhost` and `127.0.0.1` with the server's host name and IP if
the browser runs on another machine. Check the result:

```bash
openssl x509 -in dev-cert.pem -noout -text | grep -E 'Version|Not Before|Not After|NIST CURVE'
```

```text
        Version: 3 (0x2)
            Not Before: Sep 27 23:27:17 2026 GMT
            Not After : Oct 10 23:27:17 2026 GMT
                NIST CURVE: P-256
```

Compute the SHA-256 hash of the certificate (of its DER bytes, not the PEM
file):

```bash
openssl x509 -in dev-cert.pem -outform der | openssl dgst -sha256
```

```text
SHA2-256(stdin)= 60de4994bf1f6287ca11519c17426ab1b3da32dc8c3eadcee61ce4b61e7f9338
```

The browser takes these 32 bytes as the `value` of a
`{ algorithm: 'sha-256', value }` entry in `serverCertificateHashes`. The
same hash as Base64, if the client wants that form:

```bash
openssl x509 -in dev-cert.pem -outform der | openssl dgst -sha256 -binary | base64
```

Make a new certificate before the old one expires; the hash changes every
time. Safari is assumed not to support `serverCertificateHashes`; use a
CA-issued certificate for Safari.

### Production: a CA-issued certificate [#production-a-ca-issued-certificate]

For real deployments use a certificate from a public CA (for example Let's
Encrypt) or from a CA that the client machines trust, issued for the host
name the browsers use. The browser then connects without a hash, and the
14-day and ECDSA limits do not apply. How the gateway will load it will be
documented when the gateway exists.

## Try the WebTransport spike [#try-the-webtransport-spike]

The spike runs a WebTransport server with synthetic colour and depth frames
shaped like the wire format, plus a test page. Use it to check that a
browser on your machine can open a WebTransport session with a pinned
certificate. It does not use cameras or the C++ server.

It needs Go 1.27.1 or newer (`go.mod` says `go 1.27.1`) with `go` on `PATH`.
Install it from [go.dev/dl](https://go.dev/dl/) and check with `go version`.

1. Build and start the server for 60 s of media:

   ```bash
   cd server/spike/webtransport
   go run ./day1 -duration 60s
   ```

   The first run downloads the Go modules pinned in `go.sum`.

2. Open `http://localhost:8080/` in Chrome or Chromium on the same machine.
   The page opens `https://127.0.0.1:4433/session` with the pinned hash.
   Alternatively run it headless:

   ```bash
   chromium --headless=new --user-data-dir="$HOME/snap/chromium/common/wt-spike" --enable-quic --origin-to-force-quic-on=127.0.0.1:4433 http://localhost:8080/
   ```

   Headless Chromium does not exit on its own; stop it with `Ctrl+C` after
   the server has printed its verdict. The `--user-data-dir` above suits the
   snap package of Chromium; any fresh empty directory works for other
   builds.

Useful flags of `./day1`:

| Flag                            | Default            | Meaning                                                                      |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `-duration`                     | `60s`              | How long media is sent.                                                      |
| `-rate`                         | `60`               | Bundles per second.                                                          |
| `-color-bytes` / `-depth-bytes` | `150000` / `60000` | Size of each synthetic access unit.                                          |
| `-gop`                          | `60`               | Keyframe interval.                                                           |
| `-pace`                         | `1`                | Split each access unit into this many writes spread over the frame interval. |
| `-wt`                           | `127.0.0.1:4433`   | WebTransport address (UDP).                                                  |
| `-http`                         | `localhost:8080`   | Address of the test page (plain HTTP).                                       |
| `-report`                       | none               | Also write the page's report JSON to this file.                              |

### Expected result [#expected-result]

A 5 s run with headless Chromium 153 on the development machine:

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
received with 0 gaps. The final `DAY 1 PASS` / `DAY 1 FAIL` also requires a
control round trip below 5 ms at p99, which unpaced 60 Hz media usually
misses in Chromium; add `-pace 8` to reproduce the passing configuration
from the spike report. The full results are in
`server/spike/webtransport/README.md`.

## Troubleshooting [#troubleshooting]

| Symptom                                                          | Cause and fix                                                                                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page never connects; no `client.hello` in the server log     | The browser did not use QUIC to `127.0.0.1:4433`. Use Chrome/Chromium on the same machine as the server, and check with `ss -ulpn` that nothing else uses UDP port 4433.                     |
| Browser error about the certificate or `serverCertificateHashes` | The certificate breaks a browser rule: not ECDSA P-256, or valid for 14 days or more. Recreate it with the command above. For the spike, restart it: it makes a new certificate every start. |
| The hash is rejected although the certificate is fine            | The hash was computed over the PEM file. Hash the DER bytes as shown above.                                                                                                                  |
| `go: command not found`                                          | Go is not installed or not on `PATH`. Install Go 1.27.1 or newer and add its `bin` folder to `PATH`.                                                                                         |
| Safari does not connect with a hash                              | Expected; Safari needs a CA-issued certificate.                                                                                                                                              |
