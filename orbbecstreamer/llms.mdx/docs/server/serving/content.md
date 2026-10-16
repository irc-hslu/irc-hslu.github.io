# Serve to browsers (https://irc-hslu.github.io/orbbecstreamer/docs/server/serving)



Browsers will connect over WebTransport, a browser API for low-latency streams over HTTP/3 and QUIC, always encrypted with TLS. The session shape (one control stream, one stream per media channel) is fixed by `protocol/wire-format.md` §1; this page does not restate the contract.

## Status [#status]

**Off by default.** With `serving.enabled: true` (see [Configuration](./configuration#serving)), `--live` starts the Go WebTransport gateway, supervises it and serves every browser session: the control stream (`client.hello`, snapshots, pings, the setup lease and calibration commands) and, since CR 0009 is accepted, the media streams of the bundles the session subscribed to.

**Media flows on subscribe.** A session receives nothing until it subscribes to a bundle, by naming it in `preferredBundleIds` of `client.hello` or by sending `client.subscribe`. The server then opens that bundle's colour and depth streams at the first keyframe it can give the session (it asks the encoder for one when the session joins). `client.unsubscribe` finishes both streams: an `endOfStream` record (flags `0x04`, no payload), then FIN. Subscribing again opens new streams.

**A slow client costs the others few keyframes.** When a session falls behind and needs a keyframe to recover, the server asks the encoder for one, at most once per 2 s across all sessions. A session that needs it again soon doubles its own wait (up to 60 s) and meanwhile recovers at the next regular keyframe or when its wait is over and it asks again, so one client that never reads cannot make every viewer decode an extra keyframe every two seconds. A session that then stays out of trouble for 30 s starts from 2 s again. A new subscriber still gets its keyframe at once. Recovery needs regular keyframes as a fallback, so `serving.enabled` is refused with `encoding.gop_length: 0`.

**Telemetry.** Every 10 s the server logs, per bundle with subscribers: `sessions`, `queued_max` and `queued_total` (frame sets waiting in the per-session queues), `rotation_pause`, `stale_generation` and `no_generation` (records dropped because of a revision change), `forced_keyframes`, `suppressed` and `rotated`. All counters are cumulative.

**How media streams end.** The same line ends with `closes{eos_fin=.. fin_only=.. stop_sending=.. reset=.. write_error=.. session_closed=..}`, cumulative counters of how each colour or depth stream ended. `eos_fin` is an `endOfStream` record followed by FIN (an unsubscribe, or the old stream of a revision rotation). `fin_only` is FIN alone, when no record was accepted on the stream (CR 0040 A). `stop_sending` is the browser cancelling one stream; the session lives on and the channel reopens at the next keyframe. `write_error` and `session_closed` are streams that died with their session, with no `endOfStream` record: the first when the gateway ended the session after a stream I/O failure (every stream of that session counts, not only the one that failed), the second for any other session end (client left, idle timeout, core close, gateway loss, shutdown). `reset` is reserved for a stream the server itself aborts and stays 0 today. Each close also logs one debug line (visible with debug logging only, so a reconnect storm cannot flood the log), `serving: media <bundle>: stream closed session=<id>:<epoch> channel=<color|depth> stream=<id> reason=<reason>`, once per stream and never per frame. After an unsubscribe a rig check should see `eos_fin` grow by 2 (one per channel) when both channels had a record accepted; a channel with none counts `fin_only` instead. After a browser cancel `stop_sending` grows by 1.

**Pause.** While a bundle is unavailable (the server is not ready or not streaming) or paused for setup (a camera-pose run), the streams stay open and the server sends no records. When the bundle is available again the server asks for one keyframe, and every subscribed session resumes with a keyframe and codec configuration on both channels.

**Revision changes rotate the streams (wire-format §18).** A commit that changes the stream descriptors (a new camera-pose calibration or depth quantization revision, or a different camera set or layout) gives each bundle a new stream header. Placement commits do not: placement is not interpretation-affecting (CR 0040 C), so the descriptors and headers carry no `placementRevision`, and a placement commit rotates nothing and forces no keyframe. For a rotation, every subscribed session sees this, per channel:

1. On the control stream: `server.metadata.revision-changed` with `invalidatesActiveStreams: true`, then one `server.stream.descriptor` per channel.
2. The server only opens a new stream after that session's control stream was handed the descriptor of the new revision. A session that reads its control stream slowly waits; its media queue stays bounded and drops as usual.
3. On the media streams: the old stream ends with an `endOfStream` record (repeating its last record) and FIN, and a new stream starts with the new `media.channel.header`, a keyframe and codec configuration. Both channels of a bundle rotate at the same frame set.

The new stream starts at a recovery point. A depth-quantization commit gets one from the encoder, which starts the first frame set with the new table as a keyframe. A pose commit keeps the table, so the server asks the encoder for one keyframe per commit, so every pose commit forces an IDR for every bundle. Until that keyframe, records of the new revision are dropped for the session (counter `dropped_rotation_pause`); frame sets the encoder had already produced with the old table still go out on the old stream first, and no old-stream record has a frame-set number at or above the first of the new stream. Two commits before one keyframe rotate once, to the newest header. A session that stalls through two revisions while older streams still hold unwritten records is closed instead of piling up streams. A session that subscribes during a rotation starts on the new header.

**The real endpoint** is `https://<listen_address><path>` (`serving.listen_address`, `serving.path`). The development config listens on `0.0.0.0:4443`, so the endpoint is `https://<host>:4443/orbbec`; the packaged config listens on `127.0.0.1:4443`, so it is `https://127.0.0.1:4443/orbbec`. The `127.0.0.1:4433/session` address further down belongs to the throwaway spike only.

| Part                      | Code                                                                                      | State                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Transport choice          | `server/docs/architecture/adr/0002-webtransport-server.md`                                | Accepted: a Go gateway on `webtransport-go` (v0.13.0, quic-go v0.63.0) in front of the C++ server                              |
| Gateway process           | `server/gateway/cmd/orbbec-gateway` (CMake target `orbbec_streamer_wt_gateway`)           | Built when Go is found. Spawned and supervised by the server: restarted with backoff, never left down for good                 |
| HTTP/3 listener           | in the gateway                                                                            | Implemented: WebTransport at `https://<host>:<port>/orbbec`, TLS 1.3, origin allow-list, session caps; see [Gateway](#gateway) |
| Core-to-gateway IPC v4    | C++ `server/src/network/GatewayIpc`, `GatewayTransport`; Go `server/gateway/internal/ipc` | In use                                                                                                                         |
| Session and control plane | `server/src/session/SessionHub`, `server/src/serving/GatewayServing`                      | Connected to the gateway; see [Session control](#session-control)                                                              |
| Media fan-out             | `server/src/network/MediaFanout`, `server/src/serving/GatewayServing`                     | Sessions join on subscribe and leave on unsubscribe; hold while unavailable or paused; see [Media fan-out](#media-fan-out)     |
| How a browser connects    | CR 0024 (proposed, PR #114)                                                               | The server's behaviour today is listed there; it is not yet part of the contract                                               |
| WebTransport spike        | `server/spike/webtransport`                                                               | Throwaway experiment with synthetic media                                                                                      |
| `--websocket-test`        |                                                                                           | Placeholder that prints `WebSocket smoke test OK`. WebSocket is not the production transport.                                  |

### Gateway [#gateway]

* **Endpoint.** `https://<listen_address>/orbbec` (`serving.path`). The client opens the control stream: the first bidirectional stream it opens. The server resets any further client stream. These are the server's current choices, listed in CR 0024 (proposed, PR #114).
* **Admission.** The origin is checked first: a request from an origin that is not in `serving.allowed_origins` is refused with HTTP 403 and takes no admission slot. A request without an `Origin` header is accepted only with `serving.allow_missing_origin` and from a loopback address (native tools on this PC). Then at most `serving.max_sessions` sessions, and at most `serving.max_sessions_per_ip` per source IP address (default 4). Above either cap, and while shutting down, the request is answered with HTTP 503 before the session exists. See [Why a connection is refused](#why-a-connection-is-refused).
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

### Cameras closed and capture start [#cameras-closed-and-capture-start]

Protocol 1.1 (wire-format §10, §11, §16, §18; change 0039) lets the server run with the cameras closed. The gateway, the session control plane and the setup state (calibration, placement, depth quantization) do not need an open rig; only the capture pipeline does. The `capture` dimension is `idle`, `opening`, `running`, `closing` or `failed`.

* **At launch.** With `serving.start_capture_on_launch: false` (the default) the server starts `idle`. With `true`, or without serving, or with `--calibrate-camera-pose`, it starts `opening` as if a client had asked. The first-run engine build for `mask.backend: rvm` starts at launch in either case; it needs the GPU, not the cameras.
* **What a client sees while the cameras are not running.** The snapshot has `capture {state, message, devices}` and no cameras, bundles or availability; `streaming` is `stopped` with reason `capture-not-running`. `devices` lists the configured cameras as enumeration finds them (no device is opened) and is refreshed about every 5 s while idle or failed. `preferredBundleIds` in `client.hello` are ignored like unknown ids, and `client.subscribe` is refused `unknown-bundle`.
* **`client.capture.start`.** Any session may send it, with no lease and no role, unless another session holds the setup lock (refused `lock-held`). It is answered when the open ends: `accepted` once the cameras run, or `capture-start-failed` (with the same text as `capture.message`) after `server.capture.state{failed}`, or `capture-stopped` if a stop aborted the open. A client allows 60 s and does not send a second start while one is pending. A start within 2 s of a failed open is refused `rate-limited`. The server never reopens by itself from `failed`; a start is the retry.
* **`client.capture.stop`.** Needs the `operator` role (`role-required`) and the setup lease (`invalid-lease`), in that order. It stops media for every session: a running calibration is abandoned without a result, every open media stream ends with an `endOfStream` record and FIN, `server.capture.state{closing}` and a `revision-changed` that empties cameras and bundles follow, and the reply comes after `server.capture.state{idle}`. The close completes even when the lease holder leaves meanwhile. A start that arrives while the cameras close reopens them once the close is done.
* **The open.** One commit announces the cameras and bundles (`server.capture.state{running}`, `server.metadata.revision-changed`, one `server.stream.descriptor` per channel), reassesses the camera-pose calibration against the opened rig, and then answers the pending starts. The persisted pose and placement survive a stop; one active camera gets the identity pose again, as at any start. After a reopen every stream starts with a header, codec configuration and a keyframe, and `frameSetNumber` keeps increasing across the close.
* **Failure.** A failed open, or a running rig that cannot continue (a camera stopped or went silent), leaves the server up in `failed` with the device's text in `capture.message`. No camera is open then.
* **Protocol 1.0 clients.** They never receive `capture` or `server.capture.state`. While the cameras are closed their `client.hello` is answered with a fatal `server.error` `capture-not-running`, and the server never starts the cameras because of it. When the cameras close, each such session is closed with the same error before the `revision-changed`.

### Progress, sync and calibration data [#progress-sync-and-calibration-data]

Protocol 1.1 sessions also get `server.setup.progress` (the engine build, the cameras and the encoders, and the `starting` phase of `streaming`), operator sessions get `server.sync.telemetry` once per second, and the lock owner of a camera-pose run gets the corners, coverage and pair counts in `server.calibration.progress`. All of them are coalesced per session, so a slow client gets the latest state and never delays an acknowledgement. The tasks, the fields and the thresholds are on [Setup progress, sync telemetry and calibration data](./how-it-works/progress-and-sync). Preview media (change 0030) is not offered yet: media stays held until the camera pose is committed.

### Roles and lock takeover [#roles-and-lock-takeover]

Protocol 1.1 (wire-format §11, §13) adds two session roles, `viewer` and `operator`. The server announces `min(its minor, the client's minor)` in `server.hello`. The server speaks 1.2 since the network reports below. A client that announces minor 0 gets no minor-1 field or message, and its `role`, `authToken` and `takeover` fields are ignored.

* **Descriptors.** Every channel descriptor a session receives announces the minor of that session's `server.hello` (§16): 1.0 for a minor-0 session, 1.1 for a minor-1 session, 1.2 for a minor-2 session. This covers the descriptors in `server.hello` and `server.snapshot`, `server.stream.descriptor`, and the `media.channel.header` that opens each media stream. The server keeps one serialisation of each header per minor, so choosing one costs nothing per frame.
* **Grant.** The role is decided once, when `client.hello` arrives, and never changes. A session is an `operator` only if all of these hold: the hello announces minor 1 or later and asks for `role: "operator"` (exactly, case-sensitive); the QUIC peer address was loopback; and the `Origin` the gateway checked equals, byte for byte, one entry of [`serving.console_origins`](./configuration#serving). Anything else is a `viewer`, which is also what an empty `console_origins` gives. `authToken` is reserved: it is validated, then discarded, and grants nothing. The server writes one `info` line per session at the hello, `role: session <id> minor <m> requested <operator|viewer|other|none> peer_loopback <bool> origin <origin|none> -> <viewer|operator>`; it never logs `authToken` or a requested role other than `operator` or `viewer`.
* **Port forwarding.** Anything that forwards remote traffic to a loopback address, such as an SSH tunnel or a reverse proxy on the same PC, makes the peer look like loopback. Do not forward ports to the server unless you want the forwarded users to be able to ask for `operator`; the `Origin` check still applies to them.
* **Takeover.** An operator may send `client.lock.acquire` with `takeover: true`. If another session holds the setup lock, that lease ends as if it had expired (a running camera-pose calibration is abandoned without a result) and the operator gets a fresh lease in the same change. The evicted session is told through the ordinary `server.lock.state` and gets no error of its own, and it is not held off from acquiring again. A viewer's takeover is refused with `role-required`. Checks run in this order: hello, role, command rate budget, hold-off after a lease reached its maximum lifetime (`rate-limited`), lease. On a free lock or the sender's own lock, `takeover` behaves like a plain acquire.
* **Operator replay.** After every `server.hello` and `server.snapshot` sent to an operator, the server sends `server.operator.replay-complete {metadataRevision}`. It carries the current revision and never raises it. Viewers never receive it.
* **What the role unlocks.** A lock takeover needs the operator role. An operator that holds the lease may also start camera-pose calibration when the pose is not valid (missing, stale or failed) and `autocalibrate` is off; a viewer is refused with `calibration-requires-operator`. Placement commits and the other calibration commands need only the lease, as before.

### Network reports (protocol 1.2) [#network-reports-protocol-12]

Protocol 1.2 (change 0018) adds passive network sensing. It only measures and reports. It changes no bitrate, budget, encoder setting or scheduling, and it sends no probe traffic.

* **Negotiation.** `server.hello` of a session that announces minor 2 carries `features`, a list of at most 16 strings that may be empty. It lists `network-sensing` only if the client's hello listed it, the announced minor is 2 or later, and the server has it on. A client that lists `network-probe` or `network-probe-c2s` without `network-sensing` gets neither, and the server implements no probe yet. A session at minor 0 or 1 sees nothing new: no `features`, no report, and a `client.network.report` from it is ignored.
* **`server.network.report`.** One per gateway sample, so about once a second and at most four a second, only to sessions that negotiated the feature. It is mandatory and coalesced like the setup progress: a slow client gets the latest report and the report never delays an acknowledgement. The sequence starts at 0 and rises by 1 for each report written. `intervalMs` is the time since the previous report, 0 for the first. `trigger` is `change` when the gateway forwarded the sample early on a change condition, otherwise `periodic`. The gateway tests the condition every 250 ms against the last report it forwarded, and a condition must hold on two evaluations in a row. The rate rule uses the delivery rate over the last 3 seconds and fires at a change of 25 % or more. The round-trip time (25 % and at least 2 ms) and the loss band also count, and so does an estimate that appears or vanishes (the loss ratio exists only while bytes are sent). A change of `confidence` alone does not send a report.
* **What the numbers are.** The round-trip times come from the QUIC connection that carries the session (`scope: "connection"`); the server does not assume one session per connection. `scope` is an open string: a reader that meets a value it does not know ignores the connection-scope estimates (they read as `null`) and keeps the rest; the message is not invalid. `approxDeliveryRateBps` is bytes sent minus bytes newly declared lost, per second. It counts retransmitted and control bytes and treats unacknowledged bytes as delivered, so it is an approximation and a lower bound, and so is `receivedRateBps`, the client-to-server rate from the received-byte counter. `lossPpm` is the lost share of the bytes sent in the interval and is `null` when nothing was sent. The congestion window, bytes in flight and ECN marks, the media rate, the train rate and the per-bundle rates are `null`. The probe block always reads `disabled`.
* **Window and confidence.** Each estimate is the newest sample's value over a window of the last 5 seconds. `samples` is how many of them carry that quantity and `windowMs` the time they span. `confidence` follows the precision rule: `high` for 5 or more samples with IQR / median at most 0.25, `medium` for 3 or more at most 0.5, otherwise `low`. The core receives the samples at 1 Hz, not at the gateway's 4 Hz, so a window holds at most six samples and `high` is reached on the fifth steady one. It describes precision only, never bias.
* **Staleness.** `statsAgeMs` is how old the sample was when the core received it and never exceeds 2000. A sample older than that is not reported, and it is not added to the window.
* **`client.network.report`.** A notification: no `requestId` and no reply. A malformed one (unknown field, a value above its bound, an unknown closed value, a fifth hold reason) is `invalid-message` and ends that session. Valid ones are ignored, with one log line a minute for all of them, when the session did not negotiate the feature, when more than 4 a second arrive (burst 4), when `sequence` does not rise, when `intervalMs` is above 60000, or when a counter other than the loss counters goes down. The server keeps the latest accepted report per session (`SessionHub::latest_client_network_report`) for the congestion scheduler of change 0017. `holdProbes` takes effect on arrival. The command rate limits of the setup commands do not apply.
* **Counters.** `SessionHub::network_sensing_counters` has per-session counts of built reports, stale samples and the client reports accepted, rate-limited and ignored.

The tests are `network_sensing_unit_tests` (confidence, window, clamps, token bucket, wire bounds), `session_hub_unit_tests` (gate, cadence, field mapping, staleness, rejected reports) and `gateway_serving_tests` (a gateway sample becomes a report on the right session).

### Media fan-out [#media-fan-out]

`MediaFanout` delivers one bundle's frame sets to N sessions through the non-blocking `MediaTransport` interface (`server/src/network/MediaTransport.hpp`), implemented over the gateway IPC by `GatewayTransport`:

| Policy                          | Value                                                                                                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue per session and channel   | 2 frame sets (`MediaFanoutConfig::queue_capacity`)                                                                                                                                                                                  |
| Records in flight per stream    | 1 (`credit_window`); the next record goes out when the transport reports the previous one written                                                                                                                                   |
| Copies                          | One immutable payload per access unit, shared by every session                                                                                                                                                                      |
| On overflow                     | Drops are keyframe-aware: after any drop on either channel, the session receives nothing until a frame set that is a keyframe with codec configuration on both channels (wire-format §4, change 0006A), and a keyframe is requested |
| New session                     | Joins when it subscribes to the bundle; starts gated and requests a keyframe                                                                                                                                                        |
| Unsubscribe                     | Queued records are dropped; each open stream gets an `endOfStream` record and FIN even when the session has no credit left. An unsubscribe followed at once by a subscribe opens new streams.                                       |
| Pause or unavailable            | Every session is gated, no record is sent, the streams stay open; the release asks the encoder for one keyframe for the bundle                                                                                                      |
| Stream cancelled by the browser | A browser that cancels one media stream (`STOP_SENDING`) loses only that stream: the server stops writing to it, gates the session on both channels, and reopens the cancelled channel on a new stream at the next keyframe         |
| Slow session                    | `publish()` never waits for a session; it runs on the encode thread                                                                                                                                                                 |
| Keyframe requests               | Go to `NvencEncodeStage::request_keyframe` for that bundle; at most one forced keyframe per browser session every 2 s, after that it asks again once the wait is over, and recovers at the next regular one meanwhile               |
| Shared memory                   | Each encoded access unit is copied once into shared memory for the gateway, and each session may hold only its share, so stalled clients cannot starve the others                                                                   |

### Gateway IPC [#gateway-ipc]

The C++ core and the gateway talk over one `SOCK_SEQPACKET` Unix socket. Encoded records travel through a shared-memory ring, passed once as a memfd. The byte layout is in `server/docs/architecture/gateway-ipc.md`. Hardening that already applies:

* The core seals the memfd (no shrink, grow or later writes) before sending it. The receiver checks size and seals, then maps it read-only; anything else is `bad-memfd`.
* Open sessions, open streams, partial control frames and remembered session ids are bounded (`IpcLimits`, Go `Limits`).
* No message is larger than 32 888 bytes; a larger datagram is rejected as `oversized`.

#### Network statistics from the gateway [#network-statistics-from-the-gateway]

Version 4 of the IPC adds one gateway-to-core message, `ConnStats`: a sample of one session's QUIC connection statistics. It feeds the network reports and the congestion scheduling that come later (CR 0018 and CR 0017). It is not a browser message and changes nothing on the wire to the client.

* **Cadence.** The gateway samples each session at 4 Hz and forwards one when the session opens, then once per second, and earlier when the delivery rate, the round-trip time or the loss band changes on two samples in a row (never above 4 Hz). An early sample is flagged, so the report built from it says `change`. A sample carries the smoothed, latest and minimum round-trip time and its deviation (microseconds), the cumulative bytes and packets sent, received and lost, and two derived values for the last interval: an approximate delivery rate and a loss ratio (absent when nothing was sent in the interval). Both are approximations. The sent count includes retransmissions and the lost count can go down, so negative changes are counted as 0. Neither is goodput.
* **Absent for now.** The congestion window, bytes in flight and ECN marks are not sent: quic-go does not expose them without a tracer, and the cost of a tracer is not measured yet.
* **No effect on media.** The send never waits: if the IPC socket is full the sample is dropped, not queued, and the next one is newer. Stats never wait behind media credit, so the age of the latest sample stays under 2 s (a test checks it under media load).
* **Age.** The gateway stamps each sample with its monotonic clock, the same clock the server reads, so the server knows the exact age of the latest sample of every session. Beyond 2 s a sample counts as stale.
* **Counters.** `GatewayTransportStats` has `conn_stats_received` and `sessions_with_fresh_stats`; the gateway counts `ConnStatsSent`, `ConnStatsChanges` and `ConnStatsDropped`. Nothing is logged per sample.

Tests: `gateway_ipc_contract_tests`, `gateway_ipc_fuzz_tests`, `gateway_transport_tests`, `gateway_process_tests`, `gateway_serving_tests`, `gateway_go_tests` (`go test -race`) and `gateway_loopback_integration_tests` (the server, the real gateway and native WebTransport clients on 127.0.0.1). The Go tests are skipped when Go is missing; see [Build and test](./build#test-targets-and-labels).

## Turn on serving [#turn-on-serving]

1. Build the gateway. It needs Go 1.27.1 or newer, either on `PATH` or in `~/.local/go/bin`. From `server/`:

   ```bash
   cmake --build --preset relwithdebinfo --target orbbec_streamer_wt_gateway
   ```

   This writes `build/dev-relwithdebinfo/orbbec-gateway`.

2. In your config, set `serving.enabled: true` and list the origin your page is served from under `serving.allowed_origins`. See the [`serving` keys](./configuration#serving).

3. Start the server as usual. Expect `serving: WebTransport gateway ... media streams open on client.subscribe once the cameras are running` in the log, and `capture idle: the cameras open on client.capture.start` unless `serving.start_capture_on_launch` is `true`, and a line from the gateway with the development certificate hash. The hash is also written to `serving.dev_certificate_hash_path`.

4. Point the page at `https://<host>:4443/orbbec`, passing the hash in `serverCertificateHashes`.

## Why a connection is refused [#why-a-connection-is-refused]

| What the client sees                                             | Cause                                                                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QUIC connection closed with code `0x10b` (`H3_REQUEST_REJECTED`) | More QUIC connections at once than the gateway allows (twice `serving.max_sessions` plus 16, sessions and handshakes together)                                                  |
| HTTP 421                                                         | The request's `Host` (`:authority`) is not `localhost`, `127.0.0.1`, `::1`, a name in the certificate or an entry of `serving.host_names`, or names another port                |
| HTTP 403                                                         | The `Origin` is not in `serving.allowed_origins`, or there is no `Origin` header and the request does not come from a loopback address or `serving.allow_missing_origin` is off |
| HTTP 503, with `Retry-After: 1`                                  | `serving.max_sessions` or the per-address cap (`serving.max_sessions_per_ip`, default 4) is reached, or the gateway is stopping. Retry after at least one second                |
| HTTP 400                                                         | The WebTransport upgrade failed for another reason                                                                                                                              |
| No answer; the QUIC handshake times out                          | No gateway is listening: `serving.enabled` is `false`, the core is not up, or a firewall blocks the UDP port                                                                    |

Browsers do not expose the status to JavaScript. `WebTransport.ready` rejects with a generic "Opening handshake failed" error whatever the cause. The gateway logs upgrade failures, at most once every 10 seconds, so look in the server log.

### Why an open session is closed [#why-an-open-session-is-closed]

The server ends a session with a WebTransport close code (the application error code of `WebTransport.closed`). The reason text is for logs only.

| Code | Name              | Cause                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | normal            | Server shutdown, or the client ended the session                                                                                                                                                                                                                                                                       |
| 1    | protocol-error    | The client sent invalid input: bad JSON, an unknown or out-of-order message, a version mismatch, a control frame left incomplete too long, more unfinished control data than the server budget allows, or more control messages than the server can queue. A fatal `server.error` precedes it, except for the last two |
| 2    | internal-error    | A server fault                                                                                                                                                                                                                                                                                                         |
| 3    | handshake-timeout | No `client.hello` within 10 seconds of opening the session. A fatal `server.error` with code `hello-timeout` precedes it                                                                                                                                                                                               |
| 4    | slow-consumer     | The client fell too far behind on the control stream, or its media streams backlogged across revision changes. Control messages are never dropped, so the session ends and a reconnect resynchronises                                                                                                                  |
| 5    | transport-error   | Writing or reading a stream failed                                                                                                                                                                                                                                                                                     |

Codes 0, 2, 4 and 5 are worth a reconnect with backoff. Code 1 means an incompatible or faulty client, so don't retry blindly.

## Serving the client [#serving-the-client]

The gateway can serve the built browser client itself, so no separate web server is needed. It replaces the packaged Python stopgap `orbbec-streamer-web`. Set `serving.client_directory` and at least one page listener:

| Setting                            | Listener                                                                                       | For                                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serving.page_listen_address`      | HTTPS (HTTP/2 and HTTP/1.1), certificate `https` from the TLS directory or your CA certificate | Browsers on the LAN. Use the same port number as `listen_address`: TCP and UDP don't collide. Refused when the config has only a development certificate.         |
| `serving.page_http_listen_address` | Plain HTTP, loopback only                                                                      | The browser on the server PC (`http://127.0.0.1:<port>`), which pins the 13-day certificate by hash. The gateway refuses to start if the address is not loopback. |

Both listeners serve the same site, behind the same `Host` check as WebTransport (HTTP 421 for another name; the HTTP listener accepts loopback names only). Until the certificates are ready the HTTPS handshake fails, as for WebTransport, and discovery answers 503.

What the site does:

* `GET` and `HEAD` only (405 otherwise, with `Allow: GET, HEAD`). Files get a correct MIME type (`text/javascript`, `text/css`, `application/wasm`, `font/woff2`).
* It never lists a directory, serves a dotfile, follows `..`, or follows a symlink that leaves the client directory (404). Files are opened through the kernel-checked `os.Root`, so a symlink must be relative and stay inside the folder; an absolute symlink is refused even if it points back inside.
* A navigation to a path that is not a file (the request accepts HTML, and the last segment has no file extension) gets `index.html`, so client-side routes work. A missing `.js` or an `Accept: application/json` request is a plain 404.
* `/operator` and `/operator/<route>` get `operator/index.html` when the method is `GET` or `HEAD`, `Accept` is absent, empty or contains `text/html` or `*/*`, and the last path segment has no file extension. This is the rule of the client's `operatorRoute.ts`.
* With `serving.tls_directory`, the `public/` folder of that directory (the CA export files) is served at `/.well-known/orbbec/`, under the same rules.

### Connection cap [#connection-cap]

Each TCP page listener holds at most 64 connections open at once (`--page-max-conns` on the gateway). Over the cap the gateway doesn't accept more: new connections wait in the operating system's accept backlog, and none is dropped. Header, read and idle timeouts (10 s, 30 s, 60 s) bound how long a silent connection keeps a slot. This limit is separate from `serving.max_sessions`, which counts WebTransport sessions.

### Headers [#headers]

Every response, including 404, 405 and 421, carries:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:;
  connect-src 'self' <origins>; img-src 'self' data: blob:; style-src 'self'; font-src 'self';
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

`'wasm-unsafe-eval'` lets the client compile its WebAssembly HEVC decoder; there is no `'unsafe-eval'` and no `'unsafe-inline'`. There is no `Access-Control-Allow-Origin`. `<origins>` is `https://<name>:<WebTransport port>` for every name the `Host` check accepts (loopback names, the page certificate's names, `serving.host_names`), except IPv6 literals such as `::1`, which CSP host sources cannot express, plus `serving.connect_sources`. The list is rebuilt when the certificates reload, never a blanket `https:`.

### Transport discovery [#transport-discovery]

`GET` or `HEAD /.well-known/orbbec/transport` returns the WebTransport URL and the certificate hashes to pin (wire format Appendix A):

```json
{"url":"https://127.0.0.1:4443/orbbec","hashes":[{"algorithm":"sha-256","value":"<64 hex>","notAfter":"2026-10-18T12:00:00Z"},{"algorithm":"sha-256","value":"<64 hex>","notAfter":"2026-10-24T12:00:00Z"}]}
```

* A request on the loopback listener, or with a loopback `Host`, gets `127.0.0.1` (never `localhost`: the listener is IPv4 UDP) and the hashes of `wt-current`, then `wt-next`.
* Any other request gets `https://<its own Host>:<port><path>` and an empty `hashes` list, because the browser verifies the CA leaf. With a CA certificate (`serving.certificate`) the list is always empty.
* `Cache-Control: no-store`. Other methods get 405.
* Certificates not loaded yet: 503 with `Retry-After`. Never 404, which means "this origin has no discovery".

### Refusals [#refusals]

| Status              | Cause                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 421                 | `Host` is not an accepted name or names another port                                                                         |
| 405                 | Method other than `GET` or `HEAD`                                                                                            |
| 400                 | The request target is not an origin-form path (`//x`, an absolute URL)                                                       |
| 404                 | No such file, a dotfile, a path outside the client directory, a directory without `index.html`, or a missing asset           |
| 503                 | Discovery before the certificates are loaded                                                                                 |
| TLS handshake fails | HTTPS before the certificates are loaded, or `serving.page_listen_address` with a development certificate (refused at start) |

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
* `SIGHUP` reloads the certificates. Send it to the server (`systemctl reload orbbec-streamer`, or `kill -HUP <pid>`): the server forwards it to the gateway, logs `SIGHUP forwarded to the gateway` once, and keeps running. A gateway that is still starting would be killed by an early SIGHUP, so the server waits: it logs that the reload is deferred and sends one SIGHUP (however many arrived) right after the gateway's handshake. Without a running gateway it logs that it ignored the signal. The server never exits on `SIGHUP`, so a certificate renewal doesn't need a restart. The certificates, the Host check and the `connect-src` list all follow the reload. Open sessions keep the certificate they started with. If a certificate fails to load, the previous one stays in use and the error is logged.

### LAN viewers [#lan-viewers]

By default the gateway offers the `https` leaf to any non-loopback connection. Set `serving.lan_viewers: true` (needs `tls_directory`) to serve remote browsers on the LAN deliberately, on the same UDP port as the loopback viewer:

* The gateway picks the certificate per handshake. A loopback address or the name `localhost` gets `wt-current`, unchanged. Otherwise, if the server name or the address the client connected to is one of the `https` leaf's names or addresses, it gets that leaf. A browser that trusts the local CA (`public/orbbec-ca.crt`) connects without `serverCertificateHashes`. Anything else fails the handshake.
* The browser origins `https://<name>[:port]` of the leaf's names and addresses are accepted in addition to `allowed_origins`. Loopback names and wildcards are left out. The port is `lan_page_port`, else the port of `page_listen_address`, else 443 (no port in the origin).
* These origins never get the operator role: only `console_origins` do, and they stay loopback-only.
* `SIGHUP` re-resolves the `https` link and swaps the certificate and the derived origins together. Open sessions are not dropped.
* With the `https` link missing, LAN handshakes fail until it appears; loopback is unaffected.

The gateway makes its own development certificate when no CA certificate is set: ECDSA P-256, valid for 13 days, renewed one day before it expires. Each new hash is written to `serving.dev_certificate_hash_path`. You don't need the `openssl` steps above for the gateway.

## Design [#design]

This is the accepted design (ADR 0002 §13–§15).

* The C++ server starts and supervises the Go gateway. The gateway owns the UDP port, TLS and the WebTransport sessions, and makes and renews its own development certificate.
* The C++ server keeps every media decision (queues, drops, keyframe recovery, revisions) in `MediaFanout`. The gateway only moves bytes.
* A slow browser slows only its own session. It never blocks capture, GPU processing or encoding. Control input is handed to the setup state on its own thread, so a slow setup commit never holds up media.

## Crash file [#crash-file]

With `serving.crash_directory` set, the gateway creates that folder (mode 0750) and opens `gateway-<UTC time>.txt` (mode 0640) in it. If the gateway dies from a Go panic or fatal runtime error, the file holds the traceback of all goroutines with function names; a release build keeps them. The file is text and holds no memory contents, so no TLS keys. The gateway deletes its file on every normal exit (the core's `Shutdown`, the core closing the link, or a start-up error), because an empty file is not a crash; a stop by SIGTERM or SIGINT also removes it. At start it also removes empty leftovers (a process that was killed) and keeps the newest four older files, so with the current one at most five `gateway-*.txt` files remain. The gateway writes no core file or minidump. `orbbec-streamer-report` collects these files.

## Troubleshooting [#troubleshooting]

| Symptom                                                          | Cause and fix                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page never connects; no `client.hello` in the spike's log    | The browser didn't use QUIC to `127.0.0.1:4433`. Use Chrome or Chromium on the same machine, and check with `ss -ulpn` that nothing else uses UDP port 4433.                                                        |
| Browser error about the certificate or `serverCertificateHashes` | The certificate is not ECDSA P-256 or is valid for 14 days or more. Recreate it with the command above; restart the spike to get a new one.                                                                         |
| The hash is rejected although the certificate is fine            | The hash was computed over the PEM file. Hash the DER bytes.                                                                                                                                                        |
| `go: command not found`                                          | Install Go 1.27.1 or newer and add its `bin` folder to `PATH`.                                                                                                                                                      |
| Safari does not connect with a hash                              | Expected: Safari needs a CA-issued certificate.                                                                                                                                                                     |
| `serving.enabled needs ...` at start-up                          | See the [`serving` keys](./configuration#serving).                                                                                                                                                                  |
| `serving: the WebTransport gateway could not be started`         | `serving.gateway_executable` is wrong (a relative path is resolved against the config file) or not built. The server keeps capturing and retries.                                                                   |
| The browser gets HTTP 403                                        | The page's origin is not in `serving.allowed_origins`. Add it exactly as `scheme://host[:port]`.                                                                                                                    |
| The browser gets HTTP 503                                        | The server is full (`max_sessions`, or `max_sessions_per_ip` sessions from your address, default 4), or shutting down. Raise `max_sessions_per_ip` when several tabs and tools share one address, such as loopback. |
