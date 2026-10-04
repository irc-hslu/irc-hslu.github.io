# Serve to browsers (https://irc-hslu.github.io/orbbecstreamer/docs/server/serving)



Browsers will connect over WebTransport, a browser API for low-latency streams over HTTP/3 and QUIC, always encrypted with TLS. The session shape (one control stream, one stream per media channel) is fixed by `protocol/wire-format.md` §1; this page does not restate the contract.

## Status [#status]

**Not available.** The server opens no listening socket today. `--live` captures, processes and encodes, and hands each encoded bundle to the latency telemetry and the debug recorder only.

The building blocks exist as libraries with tests, but nothing in `LiveApp` uses them yet:

| Part                                                                    | Code                                                                  | State                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Transport choice                                                        | `server/docs/architecture/adr/0002-webtransport-server.md`            | Accepted: a Go gateway on `webtransport-go` in front of the C++ server                                                        |
| Session and control plane                                               | `server/src/session/SessionHub` (`orbbec_streamer_session`)           | Implemented and tested, not connected to a listener; see [Session control](#session-control)                                  |
| Media fan-out                                                           | `server/src/network/MediaFanout` (`orbbec_streamer_network`)          | Implemented and tested, not wired; see [Media fan-out](#media-fan-out)                                                        |
| Core-to-gateway IPC v1                                                  | C++ `server/src/network/GatewayIpc`, Go `server/gateway/internal/ipc` | Codecs on both sides, shared golden vectors, contract and fuzz tests; no gateway process yet; see [Gateway IPC](#gateway-ipc) |
| `MediaTransport` over the IPC, the gateway process, the HTTP/3 listener |                                                                       | Not implemented                                                                                                               |
| WebTransport spike                                                      | `server/spike/webtransport`                                           | Throwaway experiment with synthetic media; shows Chromium works with the chosen stack                                         |
| `--websocket-test`                                                      |                                                                       | Placeholder that prints `WebSocket smoke test OK`. WebSocket is not the production transport.                                 |

What you can do today: check that your browser opens a WebTransport session with the [spike](#try-the-webtransport-spike), and prepare [TLS certificates](#tls-certificates).

### Session control [#session-control]

`SessionHub` is transport-agnostic: a transport opens sessions, feeds control-stream bytes in, and drains a bounded outbox per connection. It implements the control messages of wire-format §13 against the [setup state](./how-it-works/setup-state):

* One independent session per connection. Connection ids are never reused.
* Nothing is sent before `server.hello`. A session that sends no `client.hello` within 10 s is closed with `hello-timeout`.
* Client strings are bounded at parse time (CR 0019, wire-format §3): identifiers and names at most 128 characters, `preferredBundleIds` at most 64 items. Longer values are `invalid-message` and never stored.
* A malformed message closes only the session that sent it, with a sanitised `server.error`.
* Each outbox holds at most 1024 frames or 8 MiB. A session that stops reading its control stream is closed; it never blocks the others.

### Media fan-out [#media-fan-out]

`MediaFanout` delivers one bundle's frame sets to N sessions through the non-blocking `MediaTransport` interface (`server/src/network/MediaTransport.hpp`) that the gateway will implement:

| Policy                        | Value                                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue per session and channel | 2 frame sets (`MediaFanoutConfig::queue_capacity`)                                                                                                                                                                                  |
| Records in flight per stream  | 1 (`credit_window`); the next record goes out when the transport reports the previous one written                                                                                                                                   |
| Copies                        | One immutable payload per access unit, shared by every session                                                                                                                                                                      |
| On overflow                   | Drops are keyframe-aware: after any drop on either channel, the session receives nothing until a frame set that is a keyframe with codec configuration on both channels (wire-format §4, change 0006A), and a keyframe is requested |
| New session                   | Starts gated and requests a keyframe                                                                                                                                                                                                |
| Slow session                  | `publish()` never waits for a session; it runs on the encode thread                                                                                                                                                                 |

The keyframe request is a callback. Binding it to the encoder's `NvencEncodeStage::request_keyframe` is part of the wiring that is still missing.

### Gateway IPC [#gateway-ipc]

The C++ core and the gateway will talk over one `SOCK_SEQPACKET` Unix socket. Encoded records travel through a shared-memory ring, passed once as a memfd. The byte layout is in `server/docs/architecture/gateway-ipc.md`. Hardening that already applies:

* The core seals the memfd (no shrink, grow or later writes) before sending it. The receiver checks size and seals, then maps it read-only; anything else is `bad-memfd`.
* Open sessions, open streams, partial control frames and remembered session ids are bounded (`IpcLimits`, Go `Limits`).
* No message is larger than 32 872 bytes; a larger datagram is rejected as `oversized`.

Tests: `gateway_ipc_contract_tests`, `gateway_ipc_fuzz_tests` and `gateway_go_tests` (`go test -race`, skipped when Go is missing); see [Build and test](./build#test-targets-and-labels).

## Try the WebTransport spike [#try-the-webtransport-spike]

The spike is a small Go WebTransport server that sends synthetic colour and depth records shaped like the wire format, plus a test page. It uses neither cameras nor the C++ server. It needs Go 1.27.1 or newer on your `PATH` (check with `go version`).

1. From the repository root, start the spike with 60 seconds of media:

   ```bash
   cd server/spike/webtransport
   go run ./day1 -duration 60s
   ```

   The first run downloads the modules pinned in `go.sum`. The spike creates a new 13-day certificate at every start.

2. Open `http://localhost:8080/` in Chrome or Chromium on the same machine. The page connects to `https://127.0.0.1:4433/session` with the pinned certificate hash. To run the page headless instead:

   ```bash
   chromium --headless=new --user-data-dir="$HOME/snap/chromium/common/wt-spike" --enable-quic --origin-to-force-quic-on=127.0.0.1:4433 http://localhost:8080/
   ```

   Headless Chromium does not exit on its own; stop it with Ctrl+C after the spike prints its verdict. The `--user-data-dir` suits the snap package; for other builds any new empty directory works.

| Flag of `./day1`               | Default           | Meaning                                                                      |
| ------------------------------ | ----------------- | ---------------------------------------------------------------------------- |
| `-duration`                    | `60s`             | How long media is sent                                                       |
| `-rate`                        | `60`              | Bundles per second                                                           |
| `-color-bytes`, `-depth-bytes` | `150000`, `60000` | Size of each synthetic access unit                                           |
| `-gop`                         | `60`              | Keyframe interval in frames                                                  |
| `-pace`                        | `1`               | Split each access unit into this many writes over 80 % of the frame interval |
| `-wt`                          | `127.0.0.1:4433`  | WebTransport address (UDP)                                                   |
| `-http`                        | `localhost:8080`  | Test page address (plain HTTP)                                               |
| `-report`                      | none              | Also write the page's report JSON to this file                               |

### Expected result [#expected-result]

A 5-second run with headless Chromium 153:

```text
2026/09/28 01:25:23 client.hello from spike-page
2026/09/28 01:25:28 page report:
...
color: sent 300 received 300 gaps 0
depth: sent 300 received 300 gaps 0
control RTT p50 2.80 ms, p99 9.10 ms
DAY 1 FAIL
```

WebTransport works when `client.hello` arrives and every record arrives with 0 gaps. The final verdict also requires a control round trip below 5 ms at p99, which unpaced 60 Hz media usually misses in Chromium; add `-pace 8` for the passing configuration. Full results are in `server/spike/webtransport/README.md`.

## TLS certificates [#tls-certificates]

WebTransport always uses TLS, so the browser must trust the certificate. There are two ways.

### Development: a pinned certificate hash [#development-a-pinned-certificate-hash]

The page passes the certificate's SHA-256 hash in the `serverCertificateHashes` option and the browser skips the certificate authority (CA) check. Browsers accept this only for an X.509 v3 certificate with an ECDSA P-256 key (RSA is rejected) that is valid for less than 14 days in total. Safari is assumed not to support `serverCertificateHashes`; use a CA-issued certificate there.

1. Create the key and certificate. If the browser runs on another machine, replace `localhost` and `127.0.0.1` with the server's host name and IP address:

   ```bash
   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
     -keyout dev-key.pem -out dev-cert.pem -days 13 \
     -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
   ```

2. Check it:

   ```bash
   openssl x509 -in dev-cert.pem -noout -text | grep -E 'Version|Not Before|Not After|NIST CURVE'
   ```

   Expect `Version: 3 (0x2)`, `NIST CURVE: P-256` and a validity of 13 days.

3. Hash the DER bytes, not the PEM file:

   ```bash
   openssl x509 -in dev-cert.pem -outform der | openssl dgst -sha256
   ```

   The 32 bytes are the `value` of a `{ algorithm: 'sha-256', value }` entry. For Base64, add `-binary | base64` to the `openssl dgst` command.

4. Make a new certificate before this one expires. The hash changes every time.

### Production: a CA-issued certificate [#production-a-ca-issued-certificate]

Use a certificate from a public CA (for example Let's Encrypt) or from a CA the client machines trust, issued for the host name the browsers use. The browser then connects without a hash, and the 14-day and ECDSA rules don't apply. How the gateway loads it will be documented when the gateway exists.

## Planned model [#planned-model]

This is the accepted design (ADR 0002). It is not built, so details may change.

* The C++ server starts and supervises the Go gateway. The gateway owns the UDP port, TLS and the WebTransport sessions, and creates and renews its own development certificate (13 days), as the spike does.
* The C++ server keeps every media decision (queues, drops, keyframe recovery, revisions) in `MediaFanout`. The gateway only moves bytes.
* A slow browser slows only its own session; it never blocks capture, GPU processing or encoding.
* The UDP port and certificate settings will live in a gateway section of the server config. That section does not exist yet.

## Troubleshooting [#troubleshooting]

| Symptom                                                          | Cause and fix                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The page never connects; no `client.hello` in the spike's log    | The browser didn't use QUIC to `127.0.0.1:4433`. Use Chrome or Chromium on the same machine, and check with `ss -ulpn` that nothing else uses UDP port 4433. |
| Browser error about the certificate or `serverCertificateHashes` | The certificate is not ECDSA P-256 or is valid for 14 days or more. Recreate it with the command above; restart the spike to get a new one.                  |
| The hash is rejected although the certificate is fine            | The hash was computed over the PEM file. Hash the DER bytes.                                                                                                 |
| `go: command not found`                                          | Install Go 1.27.1 or newer and add its `bin` folder to `PATH`.                                                                                               |
| Safari does not connect with a hash                              | Expected: Safari needs a CA-issued certificate.                                                                                                              |
