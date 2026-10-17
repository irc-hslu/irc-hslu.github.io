# Mock server (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/mock-server)



The mock server (`client/src/media/playback/mockServer.ts`) simulates one OrbbecStreamer capture server inside the client, on the same byte-level seam a WebTransport session uses. Real `ServerConnection`s connect to it, so the following run exactly as against a real server, with no network and no hardware:

* the handshake and snapshots;
* the setup lock, calibration and placement commits;
* shared-update filtering;
* media streams.

How it behaves:

* **Sessions**: one `MockServer` holds one server state. Every client that opens it gets its own session, and a reconnect opens a new session.
* **Time**: it comes only from the scheduler you pass in. With a `ManualScheduler`, every run is deterministic.
* **Media**: it comes from a recording (`.hevc` colour and depth files plus a manifest), the same format as recording playback. Without a recording the server has no media.
* **Open contract questions**: where the protocol contract is still open, the mock follows the client’s pending change requests (0007, 0008, 0009, 0012, 0014), listed at the top of `mockServer.ts` and on [Contract gaps and interim behaviour](/docs/client/developer/interim-behaviour). A real server may behave differently until those are decided.

## Use the mock server [#use-the-mock-server]

In a test:

```ts
const scheduler = new ManualScheduler(0n);
const created = createMockServer({ scheduler, snapshot: snapshotFixture() });
if (!created.ok) throw new Error(created.issues.join('; '));
const mock = created.value;
const connection = new ServerConnection({
  url: mock.url,
  opener: mock.opener(), // one opener per client
  scheduler,
  // clientId, displayName, platform, decoderProbe, ...
});
await connection.connect();
```

With media, create it from a recording:

```ts
const created = createMockServerFromRecording(manifest, bytesByKey, scheduler);
```

In a dev page or in composition code, add it as a source:

```ts
manager.add({ kind: 'mock', server: mock });
```

Create the mock on the same scheduler as the connection manager. Each connection manager that uses the same mock is another client of the same server. Two entries in one manager reach the same server id, and the second one reports a conflict.

Useful controls:

* **Scenario**: `setStreaming`, `setBundleAvailability`, and calibration scripts passed in `createMockServer({ calibration })`: duration, progress interval, accepted or failed, new camera poses or a new depth profile, and a depth-code histogram per progress message (`depthHistogram`; `syntheticDepthHistogram` in `src/dev/devMock.ts` is a ready-made one). The shell’s “Add mock server” scripts a 6 s depth-quantization run with that histogram.
* **Camera-pose data** (change 0033): a camera-pose run sends `server.calibration.progress` at run start, then at most 10 times a second, with `phase`, `lastSolveFailure`, `sharedObservations` and per camera the corners, accepted count, last observation and an 8 x 6 coverage grid; the camera-pose calibration entry carries `board`, `timeoutMs` and `maxReprojectionErrorPx` (`createMockServer({ cameraPose: { statusFields: false } })` omits them; `timeoutMs` sets the limit). Script it with `calibration['camera-pose'].pose`: `blindCameras` (never see the board), `isolatedCameras` (rejected `not-co-observed`, in no pair), `rejectReasons` (per camera, any kebab-case reason), `solveFailure` (keeps the run in `solving` with that `lastSolveFailure`), `neverSolves`, `minPairCountForRms`. A run that never solves ends at `timeoutMs`: result `accepted: false`, state `failed` (a valid pose stays `valid` with the message). A one-camera snapshot has no shared pairs. Cancel, lease loss, takeover and capture stop restore the pre-run record and stop progress; sensor and profile writes are refused `calibration-running` while a run exists.
* **Refused connects** (§1a, change 0024): `createMockServer({ connectRefusal })` or `mock.refuseConnects(refusal | null)`. `{ kind: 'status', status: 421 | 404 | 403 | 503 | 400 }` and `{ kind: 'quic-busy' }` reject the opener at once with a browser-like `WebTransportError` that carries no status, as Chromium does; `{ kind: 'no-answer' }` never answers, so the client's connect deadline fires. `mock.refusedConnects` lists the answers given. Close codes after the hello: `closeSession(session, code, reason)`.
* **Near-range depth**: `nearRangeQuantizationProfile()` (`src/media/playback/nearRangeProfile.ts`, 200 to 5000 mm, from a live server profile) as the snapshot's `quantization`. In the dev app, `?mockDepth=near` makes **Add mock server** serve it (snapshot only, no media).
* **Faults**: `dropSession`, `closeSession`, `delaySession`, `stallSession` / `resumeSession`, `sendMalformed`, `skipRevisions`, `sendStaleRevision`, `refuseSnapshots`, `expireLease`, `holdLocalConsoleLease`, `session.dropFromNetwork()`.
* **Inspection**: `sessions()`, `sessionOf(clientId)`, `lockHolder()`, `snapshot()`, `metadataRevision`, `getRequestLog()`, `session.requestCounts`, `session.role`, `session.mediaStats(bundleId)`.

## Fake protocol 1.1: roles, takeover, lease cap, rate limits [#fake-protocol-11-roles-takeover-lease-cap-rate-limits]

The mock follows wire-format §11 and §16 of protocol 1.1. Pass these to `createMockServer`:

| Option                   | Default      | Effect                                                                                                                                                                                                                            |
| ------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roleGrant`              | `'viewer'`   | `'operator'`: a session whose hello asks for `operator` gets it. `'by-hello'`: it gets it only when its peer is loopback and its origin equals `consoleOrigin`. A session that doesn't ask, or announces 1.0, is always a viewer. |
| `consoleOrigins`         | none         | The list of origins `'by-hello'` compares with, for example `['https://localhost:8443']`: the server's configured console origins. Any listed origin is granted.                                                                  |
| `consoleOrigin`          | none         | One origin; the single-value form of `consoleOrigins`. Both together are combined.                                                                                                                                                |
| `serverMinor`            | `1`          | `0` runs a 1.0 server: no `role` in the hello, `takeover` ignored.                                                                                                                                                                |
| `strictMinor0Hello`      | `false`      | Rejects a hello with any field a 1.0 hello doesn't have, as a 1.0 server does: `server.error{fatal: true, code: 'invalid-message'}`, then close code 1. Use it with `serverMinor: 0` to test the client's one retry.              |
| `rateLimit`              | 10, then 2/s | One budget per session for acquire, placement commit and calibration start and commit. Over it, the ack is `rate-limited` and nothing changes. `false` turns it off.                                                              |
| `leaseMaxLifetimeUs`     | 30 min       | The lease cap. At the cap the lease ends as on expiry, and only that session gets `rate-limited` for 15 s.                                                                                                                        |
| `helloDeadlineUs`        | off          | Closes a session without a hello: `hello-timeout`, then close code 3.                                                                                                                                                             |
| `legacyLeaseInvalidCode` | `false`      | Answers a wrong lease with the old `lease-invalid` instead of `invalid-lease`.                                                                                                                                                    |

## Fake capture idle mode (protocol 1.1) [#fake-capture-idle-mode-protocol-11]

A real server keeps its cameras closed until a client asks it to open them (wire-format §10, §11, §18; change 0039). The mock fakes that with the `capture` option:

```ts
createMockServer({
  snapshot,                       // the rig's content while the cameras are open
  capture: { initial: 'idle', openDurationUs: 2_000_000n, closeDurationUs: 500_000n },
  scheduler,
});
```

| Option                    | Default                         | Effect                                                                                                                                                                       |
| ------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capture.initial`         | `'running'`                     | `'idle'`: the server starts with its cameras closed. The snapshot has `capture.state: 'idle'`, empty `cameras`, `bundles` and `bundleAvailability`, and streaming `stopped`. |
| `capture.openDurationUs`  | 2 s                             | How long `opening` lasts before `running` (or `failed`).                                                                                                                     |
| `capture.closeDurationUs` | 500 ms                          | How long `closing` lasts before `idle`.                                                                                                                                      |
| `capture.devices`         | one connected device per camera | `capture.devices` while the cameras are closed. `null`: the server cannot enumerate.                                                                                         |
| `capture.openFailure`     | none                            | Every open fails with this text.                                                                                                                                             |

Controls: `captureState()`, `setCaptureOpenFailure(message | null)`, `setCaptureDevices(devices)` (hot-plug) and `failCapture(message)` (a running rig fails).

What the mock does, message for message as §18 says:

* **Start** (`client.capture.start`, no lease, no role): refused `lock-held` while another session holds the lock. Running: acknowledged at once. Idle or failed: `opening`, then after the open one atomic commit: `server.capture.state{running}`, `server.metadata.revision-changed` for `cameras` and `bundles`, a `server.stream.descriptor` per channel, `server.streaming`, and only then each pending start's ack. A failed open sends `server.capture.state{failed}` and then `capture-start-failed` with the same text. A start during `closing` is queued and reopens after `idle`.
* **Stop** (`client.capture.stop`): needs the `operator` role (`role-required`), then the lease (`invalid-lease`). It finishes every media stream, abandons a calibration run without a result, publishes `closing`, the revision notice (invalidating streams) and `streaming{stopped, capture-not-running}`, then `idle`, and acknowledges. A stop while opening aborts the open and answers pending starts `capture-stopped`.
* **Calibration start** while the cameras are not running is refused `capture-not-running`, before its other rules.
* **1.0 sessions**: never get `capture` or `server.capture.state`. While the cameras are not running, their hello is answered with a fatal `server.error{capture-not-running}`; when the cameras close, they are closed with the same error before the revision notice.

On the client, `connection.startCapture()` and `connection.stopCapture()` (also on the pipeline) wait up to 60 s for the deferred ack. `startCapture()` while one is pending fails `already-pending` without sending, and both fail `unsupported-by-server` below protocol 1.1. `state.capture` is `null` for a server that does not report it (1.0), and the card label follows it before the lock and readiness.

## Fake the operator state (protocol 1.1) [#fake-the-operator-state-protocol-11]

Changes 0027 to 0033 add operator-only messages (sensors, stream profiles, sync telemetry), the task list every session gets, and preview media. The mock fakes them with the `operatorState` option. Every part is off unless you name it, so an operator session still gets only `server.operator.replay-complete` by default.

```ts
createMockServer({
  snapshot,
  roleGrant: 'operator',
  operatorState: { sensors: true, profiles: true, telemetry: true, setupProgress: true, preview: true },
  scheduler,
});
```

| Option          | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sensors`       | A Femto Bolt registry per camera: colour auto-exposure, exposure 1..300 (inert while auto-exposure is on), gain, white balance, brightness, power line as an enum, a `requiresRestart` property (`backlight-compensation`); depth noise removal with two dependents and a read-only exposure 20..125. `{ deviceClamp, restartDurationUs }`: a clamp the device applies inside the advertised range, and how long a restart takes (default 3 s). |
| `profiles`      | Four profiles: two compatible at 30 and 15 fps, one that needs an engine build and invalidates calibration, one incompatible. `{ list, active, switchDurationUs }` replaces them (default 2 s per switch or revert).                                                                                                                                                                                                                            |
| `telemetry`     | One `server.sync.telemetry` window per second while capture runs. `{ intervalUs, toleranceUs, captureFps, decimated }`.                                                                                                                                                                                                                                                                                                                         |
| `setupProgress` | `engine-build`, `camera-open` and `encoder-start` to every minor-1 session. The last two mirror `capture`.                                                                                                                                                                                                                                                                                                                                      |
| `preview`       | Descriptors carry `preview: true` while `needs-setup` (or a camera-pose run started while ready). Media and `available: true` go to operator sessions whose hello has `"preview-media"`; everyone else gets `available: false, reason: 'needs-setup'`.                                                                                                                                                                                          |
| `coalesceGate`  | Default true: a coalescable message is held while 64 KiB or more is unsent (§12 item 5).                                                                                                                                                                                                                                                                                                                                                        |

What the mock does:

* **Delivery.** Operator-only messages go to `operator` sessions only. The replay after every hello and snapshot is in the §12 order with `replyTo: null`: per camera its capabilities and one config per sensor, the profiles, the latest telemetry, the task list, then the marker. A session that is not an operator gets only the task list, with no marker. While `capture` is not running there are no cameras, so no capabilities, config or telemetry.
* **Sensor writes.** Role, then lease, then capture, then `calibration-running`, `sensor-busy`, the camera, and the whole request is validated before anything is applied (known, writable, type, range, step grid, `enabledWhen` in order). The originator's `server.sensor.config` copy carries `replyTo` and comes before the ack; a request that changes nothing gets only the ack. A `requiresRestart` property is acknowledged at the start, sends `streaming: starting`, and is `sensor-busy` for every camera until it ends.
* **Profile switches.** Role, lease, capture, `calibration-running`, `profile-switch-in-progress`, `profile-unknown`, `profile-incompatible`. A real switch sends `switching`, the ack, the pause, `streaming: starting`, then after `switchDurationUs` one commit: the revision notice (invalidating streams), descriptors, and `idle` with `replyTo` for the originator. A profile with `invalidatesCalibration` makes those calibrations `stale`, so the server returns to `needs-setup`.
* **Coalescing.** Config, profiles, telemetry and task-list messages keep at most one unsent copy per key per session, latest wins, stamped when written. Config is sent at most once a second per camera and sensor, progress at most four times a second; a copy with `replyTo`, and any change of a task's state, is never held back. A stalled session shows it: `session.queuedCoalescableKeys`.

Controls:

* `narrowSensorRange(cameraId, sensor, propertyId, { min, max })`: the capabilities are sent again.
* `failNextSensorApply('ack' | 'after-ack' | null)`: the device fails the second change (the ack is `sensor-apply-failed`), or fails a restart after its ack (`server.error{replyTo: null}`).
* `setCameraConnected(cameraId, connected)`: one `cameras` revision change and new capabilities.
* `failNextProfileSwitch('revert' | 'revert-fails' | null)`: the device refuses the profile and the mock reverts (`reverting`, then `idle` on the old profile, then `server.error{profile-apply-failed}`), or the revert fails too and capture ends `failed`.
* `setTelemetryFault({ kind: 'degraded' | 'lost' | 'no-signal' | 'signal-unreportable', cameraId } | null)`, `silenceTelemetry(durationUs)`, `telemetryWindow()`.
* `setSetupTask(taskId, patch)`, `restartSetupProgress()`, `setupTasks()`: script `engine-build` (progress, `failed` with an `error`, `done` back to `running`) or simulate a server restart.

Busy codes (operator ruling 2026-10-12, going into wire-format): a `profile.set` while a switch is pending, even for the pending or active profile, is `profile-switch-in-progress`; a `profile.set` during a sensor restart, and a sensor write during a profile switch, are `sensor-busy`. Entering or leaving preview is its own revision notice even when it coincides with a calibration commit.

Open a session with transport facts for the grant rule with `mock.opener({ loopback: true, origin: 'https://localhost:8443' })`. The default peer is not loopback and has no origin.

A takeover (`client.lock.acquire{takeover: true}` from an operator session) ends the current lease as on expiry. It abandons a running calibration without any `server.calibration.result`, restores the calibration state, and broadcasts one `server.lock.state` with the new owner. `mock.holdLocalConsoleLease()` does the same for the server's own console (owner `local-console`, name `local operator console`), whose lease needs no heartbeat. `releaseLocalConsoleLease()` ends it.

Operator sessions get `server.operator.replay-complete` after every hello and snapshot. A heartbeat that would move the expiry by less than 1 s is acknowledged and broadcasts nothing.

For allow-list tests, create the mock with `requestLog: true`: `mock.getRequestLog()` then returns every client frame with its session id and arrival time (the last 4096 frames, at most 8 MiB of JSON), with a string `authToken` shown as `<redacted>`. Without it the log stays empty. `session.dropFromNetwork()` loses a session abruptly.

The HTTP answers of §1a (403, 421, 503 and so on) are not simulated: the mock has no CONNECT request.

## Test messages that are not in the protocol yet [#test-messages-that-are-not-in-the-protocol-yet]

Two test seams let operator console tests (`client/src/operator/mock/`) add messages from change requests that are not in the protocol yet, without editing client files. Both skip the schema, so use them only in tests.

**Client messages in**: pass `onUnhandledClientMessage(message, context)` to `createMockServer`.

* It receives the decoded JSON object of a client message whose `type` is not a protocol client message type, after that session’s hello. Only the type name decides this.
* Answer with `context.reply(json)`, which sends to that session only. A `server.ack` or `server.error` reply must match the protocol schema, and its `replyTo` must be the incoming message’s `requestId`; other protocol message types are refused. Check a lease with `context.holdsLease(message.leaseId)`. `context.session` and `context.server` are also there.
* Return `false` to decline. The session then closes as malformed input, as it does without the hook.
* A message of a known type that fails its schema never reaches the hook: it closes the session as malformed input.
* A hook that throws closes that session.
* The hook may call `context.reply` and `mock.broadcast` while it runs; frames keep their order.

**Server messages out**: `mock.broadcast(json, filter?)` sends one control frame to every session past its hello, or only to the sessions `filter` selects.

* It returns `{ ok: true, sessions }`, or `{ ok: false, issue }` and sends nothing when the message has no string `type`, cannot be serialised as JSON (for example a `bigint`), exceeds the 1 MiB frame limit, or the filter throws.
* To select sessions by fields the client schema drops, read `session.helloJson`, a frozen copy of that session’s raw `client.hello` (null before the hello). For example, `(s) => s.helloJson?.role === 'operator'`.
* It refuses message types the protocol already defines (use the mock’s own controls, or `sendMalformed` for faults); it is only for types not in the protocol yet.
* It does not apply shared-update filtering and does not advance the metadata revision. For a message that carries `metadataRevision`, stamp it with `mock.advanceMetadataRevision()`.
* A normal client that receives a type it does not know fails that session with `unknown-message-type` and reconnects. So `broadcast` does not refuse operator message types; instead, operator tests always pass a filter that selects only operator sessions, and check that viewer sessions receive no operator messages.

To start the mock in setup with autocalibration, pass a snapshot with `readiness: 'needs-setup'`, `autocalibrate: true` and camera-pose `missing`. Media is held until camera-pose is committed, and the mock never starts a calibration by itself.

## What you should see [#what-you-should-see]

* A client connects and receives a snapshot. With a recording, it receives paired colour and depth frames after it subscribes.
* The setup lock is exclusive. It stays held while its owner heartbeats every 5 s, and it expires 15 s after the last heartbeat.
* A calibration commit or placement commit reaches every client as a revision notice. Clients that opted in to shared updates, and the client that made the change, also receive the placement or calibration result itself. A placement commit restarts the media streams, which resume with a keyframe.
* Each fault drives the client’s recovery path: a resync, a reconnect, or `resync-failed` followed by a reconnect.

In the browser, with the dev server running (`npm run dev` in `client/`):

* **The app**: in the side panel of [http://localhost:5173/](http://localhost:5173/), **Add mock server** under **Servers** adds a mock as a new server card, with the source `mock mock://dev-mock-…`.
  * It is snapshot-only (`snapshot only, no media`). Only where a local copy of the unpublished sample recordings exists in `client/reference/hevc-web/` does it serve them (`reference recording`); see [Sample recordings](/docs/client/developer/test-the-client#sample-recordings).
  * The section exists only in the dev server. A production build (`npm run build`) contains no mock code.
* **Two clients of one mock**: the [cards check](/docs/client/developer/cards-check), [setup check](/docs/client/developer/setup-check) and [placement check](/docs/client/developer/placement-check) pages.

## Fix mock server problems [#fix-mock-server-problems]

* **`createMockServer` returns `ok: false`**: read `issues`. It needs a snapshot or a recording, the snapshot must be valid, and the snapshot’s lock must be free.
* **Nothing happens in a test**: a `ManualScheduler` only moves when you call `advanceBy` or `advanceTo`, and replies need a few microtask turns to settle.
* **No media**: check all of the following.
  * The mock needs a recording.
  * The client must subscribe, or list the bundle in `preferredBundleIds`.
  * The server must be `streaming`, with the bundle available.
  * If the snapshot has `autocalibrate` set, media is held until camera-pose is committed.
* **`skipRevisions` does not make the client resync**: a forward revision gap is not treated as an error until change request 0007 is decided. Use `sendStaleRevision` to exercise the resync path.

## Network sessions (CR 0018 H) [#network-sessions-cr-0018-h]

The `networkSensing` and `networkSessions` options script `server.network.sessions` for operator sessions: 0, 1, 3 or 64 rows and variants for null estimates, lower bounds, each confidence, unknown enums and stale client reports. Both are off by default. See [Network sensing](/docs/client/developer/network-sensing) for the options and examples.
