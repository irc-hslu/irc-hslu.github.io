# Network sensing (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/network-sensing)



Network sensing is the client side of [change request 0018](https://github.com/irc-hslu/orbbecstreamer/blob/main/protocol/changes/0018-network-calibration-stream.md) (protocol 1.2, feature `network-sensing`). It only measures and reports. It changes no bitrate, budget or encoder setting.

This page covers what is built: passive sensing (slice C2) and the probe streams (slice C3). The card and panel that show the numbers, and the adaptation that uses them, are not built.

## What happens in a session [#what-happens-in-a-session]

1. The client lists `network-sensing` in `client.hello.features` and announces protocol 1.2. With probes on (the default with sensing in a runtime that carries media; the control-only runtime, `media: 'none'`, such as the Operator Console, keeps sensing and lists no probe feature unless `networkProbes: true` is passed) it also lists `network-probe` and `network-probe-c2s`. It never lists a probe feature without `network-sensing`, and drops one a caller passes on its own.
2. The server answers with `server.hello.features`. Sensing is on for the session only if **both** lists name it and the session counts as minor 2 or higher (the lower of the two announced minors).
3. Until then nothing is sent, and the server's `server.network.report` and `server.network.sessions` are ignored without being parsed. A malformed one is therefore not an error before the feature is negotiated.
4. Once on, the client sends a `client.network.report` once a second and parses the server's reports. A malformed report then fails that one connection with `invalid-message`. No other connection is affected.
5. When the session ends, the sensor stops, its timer is cancelled and the numbers are discarded. A reconnect negotiates again from the hello and starts at sequence 0.

A server older than minor 2, or one that does not list a feature, sees only extra feature strings and nothing else. A probe feature listed without `network-sensing`, by either side, counts as absent. Each probe direction is on only when sensing is negotiated and both sides listed that direction's feature.

Which runtimes offer it: the viewer app does. The Operator Console's control runtime passes `networkSensing: true` itself. `networkSensing: true | false` and `networkProbes: true | false` in the runtime options override this; `networkProbes` has no effect without sensing and defaults to off for a control-only runtime.

## What the client measures [#what-the-client-measures]

| Report field                                                                  | Source                                                                             | Notes                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s2c.arrivalRateBps`                                                          | Bytes returned by every read on the session (control, media, headers)              | A 5 s window. Always `lowerBound: true`: the server only sends what the encoder produces. One addition per read on the hot path.                                                                                                |
| `rtt.pingMinUs`                                                               | Minimum of the [clock sync](/docs/client/developer/latency) pings in the last 30 s | One ping every 10 s, so at most three samples: confidence is `low` or `medium` by construction.                                                                                                                                 |
| `rtt.smoothedUs`, `minUs`, `variationUs`                                      | `WebTransport.getStats()`, if the browser has it                                   | Stock Chrome 155 has no `getStats`. Behind `--enable-experimental-web-platform-features` it returns only these three RTT values, in milliseconds. The client converts them to whole microseconds.                               |
| `s2c.burstRateBps`                                                            | Dispersion of s→c probe trains and of large media records (below)                  | Median of the valid samples of the last 10 s. `basis` is `passive` (media samples only), `active` (probe samples only) or `mixed` (both); always `lowerBound: true`. `null` until a record or a train passes the validity test. |
| `s2c.bytesReceived`, `c2s.bytesSent`, `c2s.bytesLost` and the packet counters | `getStats()`, if the browser fills them                                            | Chrome 155 does not. They are `null`.                                                                                                                                                                                           |

Everything the browser cannot measure is `null`, never estimated:

* **Loss** in either direction. Only the server's sender sees s→c loss, and Chrome returns no c→s loss counters.
* **The client's own send rate** (`estimatedSendRateBps`). The browser's `estimatedSendRate` has no stated unit, so it is not used.
* **Queue delay** (`queueDelayP50Us`, `queueDelayP95Us`). It needs the 60 s baseline, which is not built.
* Anything while the page is hidden or media is suspended. Reads stall then, so the report says `suspended: true`, withholds the rate (`null`) and asks the server to hold probes (`holdProbes: true`, with `holdReasons` such as `hidden` or `suspended`).

**Burst rate from media records.** Every media record with a payload of at least 65536 bytes gives one dispersion sample, except a keyframe that is the first record of its stream. The rule is the probe trains' rule below: `8 x (B - b1) / (t_last - t1)` over the reads of the payload (the record header's bytes do not count), kept only with at least 4 reads, a first read of at most 25 % of `B` and no gap above 8 ms. The meter runs only in a session that negotiated `network-sensing`: one per media stream, one clock read per read (the arrival clock when there is one), no allocation per read or per record. Samples that arrive while the page is held are dropped by the sensor, as probe samples are.

`stats` says how much of `getStats` was usable: `unavailable` (no method, a failed call, or nothing usable), `partial` (some fields) or `available` (all nine the report can fill). No estimate and no decision depends on `getStats` being there.

## Probe streams (slice C3) [#probe-streams-slice-c3]

A probe train is one short unidirectional stream: a `network.probe.header`, exactly `trainBytes` bytes, then FIN. A browser can only time bytes it reads, which is why probes are streams.

**s→c (the server opens them; feature `network-probe`).** The first frame of every incoming unidirectional stream is its type tag: `media.channel.header` makes a media channel, `network.probe.header` a probe train, and any other well-formed type, or a probe header when the feature is off, cancels that one stream and logs a warning. A malformed header is fatal for the connection (`invalid-message`, or the framing code); the cross-field rules (direction must be `s2c`, `trainBytes` 16384..65536) are part of it. The payload is advisory: a short train, a reset, more bytes than declared, or a train unfinished 2 s after its header loses that one sample and nothing else. Reads use one reused 64 KiB buffer per session (BYOB) and keep only running aggregates: no buffer and no array grows per read (the browser's BYOB read hands back one small view object and a promise each time). One train is read at a time: its slot is free as soon as the last payload byte arrived, and the wait for the FIN goes on in the background, so the back-to-back trains of an episode are accepted; a train that starts while another is still being read is cancelled. The rate is `8 x (B - b1) / (t_last - t1)` and counts only if the train took at least 4 reads, the first read carried at most 25 % of it, and no gap between reads exceeded 8 ms. It is a lower bound, not capacity.

**c→s (the client opens them; feature `network-probe-c2s`).** One 32 KiB train of zeros, written in one go, at most one open stream, none in the first 30 s after `server.hello` (the state stays `passive`, so the first train goes at 30 s at the earliest), at least 30 s between trains (from the end of the previous one; a refused, failed or aborted train spaces the next like a good one), aborted if it is not done in 2 s. The 2 s covers opening the stream: a hung open returns the sender to `cooldown` at the deadline, and a stream that opens late is aborted unwritten. The gateway enforces the same caps before it reads. The client sends one only when the server's report has no `c2s.trainRateBps`, or the value is stale. The report has no timestamp for the value, so this is approximate: a value counts as fresh for 120 s after the client first saw it or saw it change (value, samples or window). The transport refuses to open the stream unless the feature was negotiated.

The state of the c→s probe is in the report (`c2s.probe`): `passive`, `probing`, `cooldown` or `held`, with `holdReasons`, `bytesLast60s`, `activeMsLast60s` and `lastProbeId`. It is `held` when an exclusion applies, and `passive` again after every exclusion has been clear for 5 s:

| Hold reason           | Condition on the client                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calibration`         | any calibration is running                                                                                                                                       |
| `capture-start`       | capture is not running, the first 10 s after it started running, or a setup task is running                                                                      |
| `rotation`            | streams ahead of their descriptor, a snapshot pending, a profile switch, or 10 s after a metadata revision change (the client has no per-stream keyframe signal) |
| `media-queue`         | media headers pending or the stream acceptor saturated                                                                                                           |
| `session-start`       | the first 5 s                                                                                                                                                    |
| `hidden`, `suspended` | the page is hidden or media is suspended; the same reasons are sent as `holdReasons` with `holdProbes: true` so the server holds its s→c probes                  |

`server-busy`, `cwnd-small` and `peer-hold` describe the server's own s→c episodes and never occur for the client's c→s probe.

**Stream credit.** Chrome advertises about 100 incoming unidirectional streams. When the worst case (4 per bundle, 2 for probes) can exceed 90, the client sets `anticipatedConcurrentIncomingUnidirectionalStreams` (rounded up to 16, at most 1000). It uses the bundle count it was told (`expectedBundles`; the pipeline passes the size of `initialBundleIds` when a subset is set) or saw in the last session, so the first connect of a very large rig without a subset keeps the default. Whether stock Chrome 155 honours the option is not established.

## What an estimate carries [#what-an-estimate-carries]

Every rate and delay is an object, or `null`:

```json
{ "value": 47100000, "basis": "passive", "source": "app", "windowMs": 3000,
  "samples": 3, "confidence": "medium", "lowerBound": true }
```

* `basis` is `passive` for everything in this slice.
* `windowMs` is the span the value covers. The arrival rate uses the last 5 s; the `getStats` RTT values use the latest poll within 5 s; the ping minimum uses 30 s.
* `samples` counts the one-second sub-samples behind the value.
* `confidence` measures **precision** only: `high` needs 5 or more samples with a spread (IQR / median) of at most 0.25, `medium` needs 3 and at most 0.5, otherwise `low`. The 5 s window of the arrival rate can reach `high`.
* `lowerBound: true` means the real capacity is at least this. A reader treats a value as capacity only when `lowerBound` is `false` and `confidence` is `medium` or `high`. The arrival rate is never capacity.

## When a report is sent [#when-a-report-is-sent]

The sensor evaluates every 250 ms.

* **Periodic**: one report per second. The first one is sent one second after the session starts.
* **Change**: an extra report with `trigger: "change"` when a condition holds in **two consecutive** evaluations, compared with the last report sent:

  * the arrival rate, **measured over the latest 3 s** (the report itself carries the 5 s value), moved by 25 % or more and by at least 64 kbit/s. The floor keeps an idle session (about 1 KB/s of control traffic, a few reads per window) from sending change reports for noise;
  * `rtt.smoothedUs` moved by at least the larger of 25 % and 2000 µs;
  * `suspended`, `holdProbes` or the probe state changed;
  * an estimate appeared or vanished.

  A change of `confidence` or `lowerBound` alone does not trigger a report.
* **At most 4 reports in any rolling second**, periodic ones included. A report of either kind restarts the periodic timer.

`client.network.report` is a notification: it has no `requestId` and the server does not answer it.

## What the server sends [#what-the-server-sends]

`server.network.report` carries the server's own view: QUIC round trips, an approximate s→c delivery rate, loss in parts per million, the media rate, and cumulative counters. It is mandatory and coalescable. `server.network.sessions` lists every session on the server and is for operator sessions only. A viewer that receives one drops it with a warning.

The client keeps only the newest report. A report whose `sequence` does not increase over the held one is ignored with a warning, and the held values stay. An unknown field is ignored with a warning (protocol 1.1 tolerant reader). Unknown `trigger`, `source`, hold-reason, `scope` and `peerScope` strings are accepted. A report whose `scope` is not `connection` has its QUIC-derived estimates treated as `null`; the session goes on. From decision A6 every enum the server sends is an open string (1..32): `role` and probe `state` (shown as "unknown" by a reader), `basis`, `confidence` and `trigger`, `source`, `scope`, `peerScope`, hold reasons. An unknown `confidence` counts as `low` (it fails safe for the capacity rule); an unknown `basis`, `role` or probe `state` is kept as a string and shown as "unknown" (a state counts as not probing). An unknown `scope` still nulls the QUIC-derived estimates. `server.hello.role` and the probe stream header `direction` stay closed. Nothing the server sends fails the connection for an unknown enum value. What the client sends stays strict, except that the wire bound of `client.network.report.intervalMs` is any safe integer; the client itself never sends 0 after the first report or more than 60000. A server report with `intervalMs` 0 that is not the first of the session is ignored with a warning.

## Where the numbers are [#where-the-numbers-are]

For each server, `connection.state.network` (`ServerRuntimeState.network`) holds:

| Field                | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `sensing`            | The feature is on for this session.                                  |
| `server`             | The latest accepted `server.network.report`, or `null`.              |
| `serverReceivedAtUs` | Client monotonic time when it arrived.                               |
| `client`             | The latest `client.network.report` this client sent, or `null`.      |
| `sessions`           | The latest `server.network.sessions` (operator sessions), or `null`. |

These values change about once a second. They are updated **without** notifying the state listeners, so cards and the renderer do not wake once a second. A reader that wants live numbers listens for the connection event `network-estimates` (`source`: `negotiated`, `server`, `client` or `sessions`) and then reads `state.network`. Nothing in the viewer shows the numbers. The Operator Console's network panel reads them through the exports below.

## For the Operator Console (slice O1) [#for-the-operator-console-slice-o1]

Pure functions of `ServerRuntimeState` (exported from `src/state`); re-read them on the `network-estimates` event.

| Export                                                                                                      | Returns                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `networkSessionsOf(state)`                                                                                  | The latest `server.network.sessions`, every `Est` field kept (`value`, `basis`, `source`, `windowMs`, `samples`, `confidence`, `lowerBound`). `null` unless the connection is up, `network-sensing` is negotiated (minor 2 and the feature on both sides), the session is `operator`, and a message has arrived. |
| `networkSessionsReceivedAtUs`, `networkSessionsAgeUs(state, nowUs)`, `isNetworkSessionsStale(state, nowUs)` | When it arrived, its age, and whether nothing came for more than twice the 1 s cadence. The list stays in the export while stale.                                                                                                                                                                                |
| `ownNetworkViewOf(state)`                                                                                   | This console's latest `client.network.report` in the row shape (`self: true`, `sessionRef: null`). Client-measured fields only: `rtt`, `s2c.burstRateBps`, `s2c.queueDelayP95Us`, `s2c.arrivalRateBps`, `probe.c2s`; the rest is `null`. `report` holds the whole report.                                        |

Rules: unknown open strings (`peerScope`, `source`, hold reasons) pass through; a row with an unknown `scope` has its QUIC-derived estimates (`rtt`, `approxDeliveryRateBps`, `lossPpm`, `receivedRateBps`) set to `null`; a repeated `sessionRef` or a second `self` row is dropped with a warning. The field is `samples`, as in the change request. The list is cleared on disconnect and on every reconnect (the role is decided per session); the event then has `source: 'cleared'`. Silence raises no event: when the server stops sending, nothing in the client fires, so the console must re-read `isNetworkSessionsStale(state, nowUs)` on its own timer (once a second is enough). The Operator Console must pass `networkSensing: true` to its connection to negotiate the feature.

## Test it [#test-it]

The tests are in `client/src/tests/`: `networkMessages.test.ts` (schemas, bounds, gate in the reader, state), `networkSensing.test.ts` (windows, confidence, cadence, hysteresis, the 4 per second cap, `getStats`), `networkSensingConnection.test.ts` (the gate, reports, cleanup, the mock server) and `networkSensingTransport.test.ts` (byte counting). Run them with:

```bash
cd client
./node_modules/.bin/vitest run src/tests/networkSensing
```

The [mock server](/docs/client/developer/mock-server) implements the server side of the feature with the option `networkSensing: true`. It lists the feature for a client that offered it, records each report (`session.networkReports`) and sends reports only when a test asks (`sendNetworkReport`, `sendNetworkSessions`). It never invents estimates unless you ask for scripted sessions (next).

The stream-header vectors 1 to 4 and 24 to 31 are `STREAM_HEADER_VECTORS` in the same file, checked in `networkProbeVectors.test.ts` (header parser and the real transport); the new expectation `ignore-stream` means the stream is cancelled and the session goes on. Other tests: `probeReceiver.test.ts`, `probeSender.test.ts`, `networkProbeConnection.test.ts` (the feature matrix, reconnect cleanup), `networkProbeSensor.test.ts`, `networkProbeAdapter.test.ts`, `streamCredit.test.ts`.

The conformance vectors for the messages (23 control frames: 20 of the change request and 3 from the A6 review, including the tolerant-reader case that only a session reader can run) are defined in `client/src/tests/networkVectors.ts` and checked by `networkVectors.test.ts`. They are exported to `protocol/vectors` with `npm run protocol:export` (protocol 1.2, PR #343).

## Evidence for the cost gate (CR 0018 J) [#evidence-for-the-cost-gate-cr-0018-j]

The client side of the acceptance evidence needs a live server with `serving.network_probes` on, so it has not been run for this slice. What is in place:

* `ServerConnection.networkProbeStats`: per session, s→c trains (count, samples, bytes, discards by reason, and the last 32 trains with reads, first-read bytes, widest gap, span and rate) and c→s episodes (count, completed, failed, bytes).
* `ServerConnection.mediaBurstStats`: per session, the media burst meters' totals: records timed (`measured`), samples kept, opening keyframes skipped (`firstKeyframe`) and discards by reason (`tooFewReads`, `firstReadTooLarge`, `gapTooWide`, `noSpan`). `null` without sensing.
* On the dev server, `?networkSensing=0|1`, `?networkProbes=0|1` and `?latencyProbe=1` switch the offer for one page load (same build, off versus on), and `window.__orbbec.network(entryId)` and `window.__orbbec.latency(entryId)` return the probe accounting and the media burst totals (`mediaBurst`) with the latest reports, and the per-stage latency report.
* `npm run bench:e2e -- --byob --sensing` adds the sensor's per-read counter to the Node media-path benchmark. Three runs each on this machine: p50 of the first upload after a stream rotation 0.4 to 0.9 ms with and without it, the same range as `main` (0.4 to 0.5 ms), so within noise.

Still to run live: capture to present p50/p99 with probes forced by a 4 s GOP (limits 0.5 ms and 2 ms), probe bytes and time from the server's `bytesLast60s` and `activeMsLast60s` (limits 5 % and 3 s per minute), the perf harness with sensing on, and the `tc tbf` accuracy runs.

## Troubleshooting [#troubleshooting]

**The client sends no reports.** Check `connection.networkSensingActive`. The server must list `network-sensing` in `server.hello.features`; a server below protocol 1.2 never does.

**`stats` is always `unavailable`.** Stock Chrome 155 has no `getStats`. To try the RTT fields, start Chrome with `--enable-experimental-web-platform-features`.

**No probe trains arrive.** The server sends them only with `serving.network_probes` on (default off), media flowing, and `network-probe` in `server.hello.features`. Check `connection.networkProbeStats`.

**`arrivalRateBps` is `null`.** The page is hidden or media is suspended, or the session is younger than one second.

## Mock options for the network panel [#mock-options-for-the-network-panel]

`networkSessions` (needs `networkSensing: true`; default off, so no message and no timer) makes the mock send `server.network.sessions` to operator sessions that negotiated the feature: once in the replay before `server.operator.replay-complete`, then every `intervalUs` (default 1 s, coalesced to at most 1 per second).

```ts
createMockServer({ scheduler, snapshot, roleGrant: 'operator', networkSensing: true,
  networkSessions: { sessions: 3, variant: 'unknown-enums' } });
```

* `sessions`: 0 to 64. Row 0 is the recipient (`self`), then operators, then viewers. In `normal`, every fifth row has `sensing: false`.
* `variant`: `normal` (the three confidence levels cycle), `null-estimates`, `lower-bound`, `confidence-low` / `-medium` / `-high`, `unknown-enums` (unknown `scope`, `peerScope`, `source`, hold reason), `stale-reports` (`clientReportAgeMs` far above 2 s).
* Live: `mock.setNetworkSessions(script | null)`, `mock.silenceNetworkSessions(durationUs)` (the list goes stale), `mock.networkSessionsMessage(session)`.
* Not negotiated: leave `networkSensing` off (minor 1, or minor 2 with `serverMinor: 2`), or connect without offering the feature. Viewers get nothing.
