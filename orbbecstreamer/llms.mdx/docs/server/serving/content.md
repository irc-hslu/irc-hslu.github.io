# Serve to browsers (https://irc-hslu.github.io/orbbecstreamer/docs/server/serving)



Browsers will connect over WebTransport, a browser API for low-latency streams over HTTP/3 and QUIC, always encrypted with TLS. The session shape (one control stream, one stream per media channel) is fixed by `protocol/wire-format.md` §1; this page does not restate the contract.

## Status [#status]

**Control plane only, off by default.** With `serving.enabled: true` (see [Configuration](./configuration#serving)), `--live` starts the Go WebTransport gateway, supervises it and serves the control stream of every browser session: `client.hello`, snapshots, pings, the setup lease and calibration commands. **No media is sent yet.** When the server may open a bundle's colour and depth streams for a session is change request CR 0009, which is still proposed, so no session receives media.

**The real endpoint** is `https://<listen_address><path>` (`serving.listen_address`, `serving.path`). The development config listens on `0.0.0.0:4443`, so the endpoint is `https://<host>:4443/orbbec`; the packaged config listens on `127.0.0.1:4443`, so it is `https://127.0.0.1:4443/orbbec`. The `127.0.0.1:4433/session` address further down belongs to the throwaway spike only.

| Part                      | Code                                                                                      | State                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Transport choice          | `server/docs/architecture/adr/0002-webtransport-server.md`                                | Accepted: a Go gateway on `webtransport-go` (v0.13.0, quic-go v0.63.0) in front of the C++ server                              |
| Gateway process           | `server/gateway/cmd/orbbec-gateway` (CMake target `orbbec_streamer_wt_gateway`)           | Built when Go is found. Spawned and supervised by the server: restarted with backoff, never left down for good                 |
| HTTP/3 listener           | in the gateway                                                                            | Implemented: WebTransport at `https://<host>:<port>/orbbec`, TLS 1.3, origin allow-list, session caps; see [Gateway](#gateway) |
| Core-to-gateway IPC v1    | C++ `server/src/network/GatewayIpc`, `GatewayTransport`; Go `server/gateway/internal/ipc` | In use                                                                                                                         |
| Session and control plane | `server/src/session/SessionHub`, `server/src/serving/GatewayServing`                      | Connected to the gateway; see [Session control](#session-control)                                                              |
| Media fan-out             | `server/src/network/MediaFanout`                                                          | Wired, keyframe requests go to the encoder; no session is added until CR 0009                                                  |
| How a browser connects    | CR 0024 (proposed, PR #114)                                                               | The server's behaviour today is listed there; it is not yet part of the contract                                               |
| WebTransport spike        | `server/spike/webtransport`                                                               | Throwaway experiment with synthetic media                                                                                      |
| `--websocket-test`        |                                                                                           | Placeholder that prints `WebSocket smoke test OK`. WebSocket is not the production transport.                                  |

### Gateway [#gateway]

* **Endpoint.** `https://<listen_address>/orbbec` (`serving.path`). The client opens the control stream: the first bidirectional stream it opens. The server resets any further client stream. These are the server's current choices, listed in CR 0024 (proposed, PR #114).
* **Admission.** At most `serving.max_sessions` sessions, and at most 4 per source IP address. Above either cap, and while shutting down, the request is answered with HTTP 503 before the session exists. A request from an origin that is not in `serving.allowed_origins` is refused with HTTP 400. See [Why a connection is refused](#why-a-connection-is-refused).
* **Host check.** The `:authority` of every request must name the listener's port and one of: `localhost`, `127.0.0.1`, `::1`, a name or address in the TLS certificate, or an entry of `serving.host_names`. Anything else gets HTTP 421 before a session exists, which blocks DNS-rebinding attacks. With the development certificate (SANs `localhost`, `127.0.0.1`), a browser that connects by a LAN address needs that address in `serving.host_names`.
* **Limits.** QUIC idle timeout 4 s with a keep-alive every 1 s. HTTP/3 idle connections are closed after 5 s and headers are capped at 16 KiB. Inbound control bytes are rate-limited per session; over the rate the server stops reading, which slows only that client.
* **Exposure.** `config/dev/live.yaml` listens on `0.0.0.0:4443`, so any host that can reach this machine can open a session, limited only by the origin check and the caps. A non-browser client can send any `Origin` header. Use a firewall, or listen on `127.0.0.1`, when the machine is on an untrusted network.
* **Isolation.** The gateway runs as a child process with its own process group, only its IPC socket and standard streams open, and a minimal environment. If it dies, every session ends (wire-format §17) and the server starts a new one.

### Session control [#session-control]

`SessionHub` is transport-agnostic: a transport opens sessions, feeds control-stream bytes in, and drains a bounded outbox per connection. It implements the control messages of wire-format §13 against the [setup state](./how-it-works/setup-state):

* One independent session per connection. Connection ids are never reused.
* Nothing is sent before `server.hello`. A session that sends no `client.hello` within 10 s is closed with `hello-timeout`.
* Client strings are bounded at parse time (CR 0019, wire-format §3): identifiers and names at most 128 characters, `preferredBundleIds` at most 64 items. Longer values are `invalid-message` and never stored.
* A malformed message closes only the session that sent it, with a sanitised `server.error`.
* Each outbox holds at most 1024 frames or 8 MiB. A session that stops reading its control stream is closed; it never blocks the others.

### Media fan-out [#media-fan-out]

`MediaFanout` delivers one bundle's frame sets to N sessions through the non-blocking `MediaTransport` interface (`server/src/network/MediaTransport.hpp`), implemented over the gateway IPC by `GatewayTransport`:

| Policy                        | Value                                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue per session and channel | 2 frame sets (`MediaFanoutConfig::queue_capacity`)                                                                                                                                                                                  |
| Records in flight per stream  | 1 (`credit_window`); the next record goes out when the transport reports the previous one written                                                                                                                                   |
| Copies                        | One immutable payload per access unit, shared by every session                                                                                                                                                                      |
| On overflow                   | Drops are keyframe-aware: after any drop on either channel, the session receives nothing until a frame set that is a keyframe with codec configuration on both channels (wire-format §4, change 0006A), and a keyframe is requested |
| New session                   | Starts gated and requests a keyframe                                                                                                                                                                                                |
| Slow session                  | `publish()` never waits for a session; it runs on the encode thread                                                                                                                                                                 |
| Keyframe requests             | Go to `NvencEncodeStage::request_keyframe` for that bundle; at most one forced keyframe per browser session every 2 s, after that it waits for the next regular one                                                                 |
| Shared memory                 | Each encoded access unit is copied once into shared memory for the gateway, and each session may hold only its share, so stalled clients cannot starve the others                                                                   |

### Gateway IPC [#gateway-ipc]

The C++ core and the gateway talk over one `SOCK_SEQPACKET` Unix socket. Encoded records travel through a shared-memory ring, passed once as a memfd. The byte layout is in `server/docs/architecture/gateway-ipc.md`. Hardening that already applies:

* The core seals the memfd (no shrink, grow or later writes) before sending it. The receiver checks size and seals, then maps it read-only; anything else is `bad-memfd`.
* Open sessions, open streams, partial control frames and remembered session ids are bounded (`IpcLimits`, Go `Limits`).
* No message is larger than 32 872 bytes; a larger datagram is rejected as `oversized`.

Tests: `gateway_ipc_contract_tests`, `gateway_ipc_fuzz_tests`, `gateway_transport_tests`, `gateway_process_tests`, `gateway_serving_tests`, `gateway_go_tests` (`go test -race`) and `gateway_loopback_integration_tests` (the server, the real gateway and native WebTransport clients on 127.0.0.1). The Go tests are skipped when Go is missing; see [Build and test](./build#test-targets-and-labels).

## Turn on serving [#turn-on-serving]

1. Build the gateway. It needs Go 1.27.1 or newer, either on `PATH` or in `~/.local/go/bin`. From `server/`:

   ```bash
   cmake --build --preset relwithdebinfo --target orbbec_streamer_wt_gateway
   ```

   This writes `build/dev-relwithdebinfo/orbbec-gateway`.

2. In your config, set `serving.enabled: true` and list the origin your page is served from under `serving.allowed_origins`. See the [`serving` keys](./configuration#serving).

3. Start the server as usual. Expect `serving: WebTransport gateway ... (control plane only)` in the log, and a line from the gateway with the development certificate hash. The hash is also written to `serving.dev_certificate_hash_path`.

4. Point the page at `https://<host>:4443/orbbec`, passing the hash in `serverCertificateHashes`.

## Why a connection is refused [#why-a-connection-is-refused]

| What the client sees                                             | Cause                                                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QUIC connection closed with code `0x10b` (`H3_REQUEST_REJECTED`) | More QUIC connections at once than the gateway allows (twice `serving.max_sessions` plus 16, sessions and handshakes together)                                   |
| HTTP 421                                                         | The request's `Host` (`:authority`) is not `localhost`, `127.0.0.1`, `::1`, a name in the certificate or an entry of `serving.host_names`, or names another port |
| HTTP 503                                                         | `serving.max_sessions` or the per-address cap (4) is reached, or the gateway is stopping                                                                         |
| HTTP 400                                                         | The `Origin` is not in `serving.allowed_origins`, or the WebTransport upgrade failed for another reason                                                          |
| No answer; the QUIC handshake times out                          | No gateway is listening: `serving.enabled` is `false`, the core is not up, or a firewall blocks the UDP port                                                     |

Browsers do not expose the status to JavaScript. `WebTransport.ready` rejects with a generic "Opening handshake failed" error whatever the cause. The gateway logs upgrade failures, at most once every 10 seconds, so look in the server log.

## Try the WebTransport spike [#try-the-webtransport-spike]

This section is about the throwaway spike in `server/spike/webtransport`, not the real server. It listens on `https://127.0.0.1:4433/session`, not on `serving.listen_address`. For the real endpoint see [Status](#status).

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

Use a certificate from a public CA (for example Let's Encrypt) or from a CA the client machines trust, issued for the host name the browsers use. The browser then connects without a hash, and the 14-day and ECDSA rules don't apply. Set `serving.certificate` and `serving.private_key`. The gateway refuses a key file that group or others can read (`chmod 600`).

### Packaged certificates [#packaged-certificates]

The Debian package's `orbbec-tls` tool keeps the certificates in `/etc/orbbec-streamer/tls/`. Set `serving.tls_directory` to that folder. Each certificate and its key live in their own folder `pairs/<id>/` (`cert.pem`, `key.pem`), and three symlinks select them:

| Symlink      | Certificate                                                                                     | Used for                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `https`      | The leaf of the per-installation local CA (90 days; host name, `.local` name and LAN addresses) | HTTPS pages, and WebTransport to any address that is not loopback                                            |
| `wt-current` | A self-signed ECDSA P-256 certificate valid for 13 days                                         | WebTransport to `127.0.0.1` or `localhost`, pinned with `serverCertificateHashes` by a page on the server PC |
| `wt-next`    | The next 13-day certificate                                                                     | Only its hash is published, before it is switched to                                                         |

* The gateway resolves each symlink once per load and reads `cert.pem` and `key.pem` from the folder it resolved, so a rotation between the two reads cannot pair a certificate with the wrong key. A symlink that points outside the TLS folder, or into `private/`, is refused. The gateway never opens `private/`, where the CA key is kept.
* Keys must not be readable by group or others (`orbbec-tls --key-owner` writes them with mode 600).
* The server starts without the files (`orbbec-tls` postpones setup until the clock is synchronised). Until they appear, the gateway logs `certificates not ready`, refuses TLS handshakes, and looks for the files again every 10 s.
* `SIGHUP` to the gateway reloads the certificates. Open sessions keep the certificate they started with. If a certificate fails to load, the previous one stays in use and the error is logged.

The gateway makes its own development certificate when no CA certificate is set: ECDSA P-256, valid for 13 days, renewed one day before it expires. Each new hash is written to `serving.dev_certificate_hash_path`. You don't need the `openssl` steps above for the gateway.

## Design [#design]

This is the accepted design (ADR 0002 §13–§15).

* The C++ server starts and supervises the Go gateway. The gateway owns the UDP port, TLS and the WebTransport sessions, and makes and renews its own development certificate.
* The C++ server keeps every media decision (queues, drops, keyframe recovery, revisions) in `MediaFanout`. The gateway only moves bytes.
* A slow browser slows only its own session. It never blocks capture, GPU processing or encoding. Control input is handed to the setup state on its own thread, so a slow setup commit never holds up media.

## Troubleshooting [#troubleshooting]

| Symptom                                                          | Cause and fix                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The page never connects; no `client.hello` in the spike's log    | The browser didn't use QUIC to `127.0.0.1:4433`. Use Chrome or Chromium on the same machine, and check with `ss -ulpn` that nothing else uses UDP port 4433. |
| Browser error about the certificate or `serverCertificateHashes` | The certificate is not ECDSA P-256 or is valid for 14 days or more. Recreate it with the command above; restart the spike to get a new one.                  |
| The hash is rejected although the certificate is fine            | The hash was computed over the PEM file. Hash the DER bytes.                                                                                                 |
| `go: command not found`                                          | Install Go 1.27.1 or newer and add its `bin` folder to `PATH`.                                                                                               |
| Safari does not connect with a hash                              | Expected: Safari needs a CA-issued certificate.                                                                                                              |
| `serving.enabled needs ...` at start-up                          | See the [`serving` keys](./configuration#serving).                                                                                                           |
| `serving: the WebTransport gateway could not be started`         | `serving.gateway_executable` is wrong (a relative path is resolved against the config file) or not built. The server keeps capturing and retries.            |
| The browser gets HTTP 503                                        | The server is full (`max_sessions`, or 4 sessions from your address), or shutting down.                                                                      |
