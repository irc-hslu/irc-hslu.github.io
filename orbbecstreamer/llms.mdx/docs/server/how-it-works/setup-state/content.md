# Setup state (https://irc-hslu.github.io/orbbecstreamer/docs/server/how-it-works/setup-state)



The server keeps one authoritative setup state: whether the rig is
calibrated, whether media may flow, who holds the setup lock, and the
revisions clients need to interpret the media. A client gets the full
state in a **snapshot** when it connects (with `serving.enabled: true`), then
follows the updates. You also see the state in the server log. The wire form is defined in the wire
contract, `protocol/wire-format.md`.

The state machine (`server/src/control/SetupController`) and the session layer
that carries it to clients (`server/src/session/SessionHub`) are implemented
and tested. With `serving.enabled: true`, the Go gateway feeds the session layer
with every browser's control stream; see [What works today](#what-works-today)
and [Serve to browsers](../serving).

## Phases and readiness [#phases-and-readiness]

Internally the server names one phase for logs. On the wire the same state
is split into independent fields, and the internal names never appear there.

| Internal phase (log)      | When                                                                       | On the wire                                          |
| ------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `NEEDS_SETUP`             | Camera pose missing, stale or failed; `autocalibrate: false`               | `readiness=needs-setup`, `autocalibrate=false`       |
| `WAITING_FOR_CALIBRATION` | Camera pose missing, stale or failed; `autocalibrate: true`                | `readiness=needs-setup`, `autocalibrate=true`        |
| `CALIBRATING`             | A lease holder runs a camera-pose calibration                              | Lock owned, `camera-pose` calibration `running`      |
| `READY`                   | Camera pose valid, media not requested, or requested but not yet delivered | `readiness=ready`, `streaming=stopped` or `starting` |
| `STREAMING`               | Camera pose valid, media requested and delivered, no calibration running   | `readiness=ready`, `streaming=streaming`             |
| `PAUSED_FOR_SETUP`        | Ready, but media held for a setup operation                                | `readiness=ready`, `streaming=paused-for-setup`      |

Rules behind the table:

* **Readiness depends only on the camera pose.** The linear depth
  quantization profile works without calibration, and network calibration
  is advisory.
* **A recalibration keeps the server ready.** While a new run replaces a
  valid pose, the committed poses stay in use, readiness stays `ready` and
  media is paused for setup. The log shows `CALIBRATING`.
* **Media flows only when ready.** Streaming is `streaming` only when media is
  requested, the pose is valid and no calibration is running. `--live`
  requests media at start, so a valid pose shows `STREAMING` in the log. No
  bytes leave the server until serving exists.
* **`starting` first.** After every start (the cameras open, the pose becomes
  valid, a stream-profile switch restarts the rig) `streaming` reads
  `starting` until the encoders have produced access units, then `streaming`
  (protocol 1.1, wire-format §10; see
  [Setup progress](./progress-and-sync#the-starting-phase)).
* An `error` phase is not modelled yet.

```text
startup ─► load + check camera-pose.json
             ├─ valid ─────────────► READY / STREAMING
             ├─ missing or stale, one camera ► write identity pose, revision + 1 ─► READY / STREAMING
             └─ missing or stale ──► NEEDS_SETUP             (autocalibrate: false)
                                     WAITING_FOR_CALIBRATION (autocalibrate: true)
lease holder starts calibration ───► CALIBRATING
   commit ──► valid, revision + 1 ─► READY / STREAMING
   cancel, release, disconnect, lease expiry ─► previous state
   failure ─► failed (a recalibration keeps the old valid pose)
```

A single-camera rig needs no calibration: the first camera is the reference,
so at startup the server writes the identity pose for it (revision stored + 1,
or 1) and starts ready. If the write fails it logs a warning and stays in
`NEEDS_SETUP`. Several cameras always need a calibration.

What makes a saved pose valid or stale, and the procedure to calibrate, are
on [Camera pose calibration](../camera-calibration#startup-states).

### Cameras open and closed [#cameras-open-and-closed]

The setup state exists before any camera is open. Its `capture` dimension is
`idle`, `opening`, `running`, `closing` or `failed` (wire-format §10). While
it is not `running` the state lists no cameras and no bundles, `streaming` is
`stopped`, and the calibration is checked against the configured cameras that
device enumeration finds, so the readiness shows what it will be once they
open. A client opens the cameras with `client.capture.start` and closes them
with `client.capture.stop`; the server starts them itself only with
`serving.start_capture_on_launch: true` (see
[Cameras closed and capture start](../serving#cameras-closed-and-capture-start)).
The opening commit lists the cameras with their intrinsics and the pose
from `camera-pose.json`, and the single-camera identity pose is written then if
it is needed. A stop keeps everything on disk.

### In the log [#in-the-log]

At start, with the cameras closed or open:

```text
[info] setup at startup: capture=idle phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: no camera-pose calibration at config/dev/camera-pose.json) streaming=stopped metadata_revision=1
```

After that, a `setup update` line appears whenever the phase, the camera-pose
calibration, the streaming state or the lock owner changes. Lease heartbeats
are not logged, and lock changes alone are logged at most once every 5 s
(`setup: N setup-lock changes not logged` counts the rest).

## Revisions [#revisions]

A revision is a counter that goes up when something changes. Every change a
client needs to interpret media carries one. Revisions never decrease, and
content that affects interpretation changes only with a newer revision.

| Revision                            | Starts at                                                                                                | Changes when                                                                                                                                       | Persisted                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `calibrationRevision` (camera pose) | The revision in `camera-pose.json`; `0` without a file. For a damaged file, the revision it still shows. | A calibration is committed: previous + 1, also when the previous pose was stale                                                                    | Yes, in `camera-pose.json`                                            |
| `depthQuantizationRevision`         | `1`                                                                                                      | Never while running. Changing the profile needs a restart.                                                                                         | No                                                                    |
| `placementRevision`                 | The revision in `placement.json`; `0` without a file                                                     | A client commits a new placement (`client.placement.commit`): + 1. Stream descriptors and headers do not carry it, and nothing rotates (CR 0040 C) | Yes, in `calibration.placement_path`, saved before any client sees it |

A damaged `camera-pose.json` or `placement.json` is not used, but its
revision is still read where possible, so the next commit gets a higher one:
clients never see one revision with two different contents. A damaged
placement file starts the server at the default placement (`server-origin`,
identity) with that revision + 1, and logs
`placement not restored, using the default at revision N: ...`.
\| `metadataRevision` | `1` at every start | Once per authoritative update message (lock, calibration state, readiness, streaming, descriptors, …) | No |

Stream descriptors carry the metadata revision at which something they depend
on last changed, not the current one. A lock or streaming change therefore
never restarts the media streams; a new calibration, placement or
quantization does. Because `metadataRevision` restarts at 1, a client that
reconnects after a server restart takes the full snapshot, as it does after
any reconnect.

## Setup lease [#setup-lease]

Setup operations (calibration, placement) need the setup lock. There is one
per server. The lock is a **lease**: it expires unless the holder renews it
with regular heartbeats, so a client that disappears cannot keep it.

| Property         | Value                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Holders          | One connection at a time, and only a session with the `operator` role (a viewer is refused `role-required`, see [Roles](../serving#roles-and-lock-takeover)); others are rejected with `lock-held`                                                                                                                                                                                |
| Expiry           | 15 s after acquiring or the last heartbeat (fixed, not configurable)                                                                                                                                                                                                                                                                                                              |
| Maximum lifetime | 30 min after acquiring (`setup.max_lease_lifetime_seconds`), however often the holder heartbeats. `expiresAtUs` stops advancing at that point, so every client sees the real end; then the lease ends as on expiry. The same connection must wait 15 s before acquiring again (refused with `rate-limited`); other clients may acquire at once. Applies to the console lease too. |
| Heartbeat        | Every 5 s from the holder. A heartbeat moves the expiry (which every client sees) only if it gains at least 1 s, also on the last step before the maximum lifetime. When it moves, every client gets `server.lock.state` with the new `expiresAtUs`, and then the holder gets the ack. Any other heartbeat gets only the ack.                                                     |
| Rate limit       | Per session, lock acquire, calibration start and commit, and placement commands: 10 at once, then 2 per second. Over the limit the command is refused with `rate-limited` and changes nothing. Lock release, calibration cancel and heartbeats are not counted, so a client can always give the lock back. A reconnect starts with a fresh budget.                                |
| Lease id         | 128 random bits, sent only to the holding connection; never valid after a reconnect                                                                                                                                                                                                                                                                                               |
| Ends on          | Release, disconnect, expiry, maximum lifetime. Ending the lease cancels a running calibration.                                                                                                                                                                                                                                                                                    |

The lock state is broadcast to every client. Clients without the lock keep
their normal control connection and see every state change.

A client using protocol 1.1 or later gets `replyTo` on
`server.calibration.result` and `server.placement.updated`. In the copy sent to
the client whose commit caused the message, it is that request's `requestId`.
Every other copy has `replyTo: null`. A protocol 1.0 client gets neither
field. The calibration status items (in the snapshot and in
`server.calibration.state`) carry `awaitingCommit` for protocol 1.1 clients.
It is `true` only while a solved run waits for `client.calibration.commit`.
`--live --calibrate-camera-pose` takes the lease as the local console,
heartbeats it every 5 s and releases it when the run ends.

## `autocalibrate` [#autocalibrate]

`calibration.autocalibrate` is read at start and fixed for the run.

| Value             | With a missing or stale pose                                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `false` (default) | A session with the `operator` role that holds the lease may still start a camera-pose calibration; a viewer cannot hold the lease and gets `invalid-lease` (change 0048). An operator can also calibrate on the server with `--calibrate-camera-pose`. Phase `NEEDS_SETUP`. |
| `true`            | A client holding the lease may start the calibration itself; normal media is held until it is committed. Phase `WAITING_FOR_CALIBRATION`.                                                                                                                                   |

`true` takes effect only when the calibration engine can run: colour aligned
to depth (`streams.alignment: color_to_depth`) and a valid board
(`calibration.board`). Otherwise the server logs
`camera-pose calibration unavailable (autocalibrate off, calibration start rejected): ...`,
reports `autocalibrate: false`, and refuses every calibration start with
`calibration-unavailable`.

In both modes a valid pose may be recalibrated by the lease holder. Until
clients can connect, `true` only changes the phase name in the log; keep it
`false`. See [Configuration](../configuration#calibration).

## `setup.json` [#setupjson]

At every start, after the cameras are running, the server writes
`<debug_recording.directory>/setup.json` (default `debug/live/setup.json`),
even with recording off. It is a local debug file for tools and recordings,
not part of the client protocol, and it is replaced on each start: written
to a uniquely named temporary file next to it, flushed to disk and renamed
over the old file, so a reader never sees a half-written file.

| Section          | Contents                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version` | `1`                                                                                                                                                                                     |
| `cameras`        | Per camera: config `id`, `runtime_id` (`orbbec:<serial>`), `serial_number`, `physical_index`, and depth intrinsics (`width`, `height`, `fx`, `fy`, `cx`, `cy`)                          |
| `streams.color`  | `hevc`, NV12, source and encoded size, fps                                                                                                                                              |
| `streams.depth`  | `hevc_main10`, P010, source and encoded size, fps, and the depth packing: `quantized_p010_v1`, profile kind, depth range, the special codes and the 1024-entry reconstruction LUT in mm |
| `encoding`       | `session_mode` and `camera_order`                                                                                                                                                       |

It does not contain camera poses, revisions or the setup phase. Poses are in
`calibration.camera_pose_path`; the phase is in the log.

## What works today [#what-works-today]

| Part                                                                                | Status                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup state, readiness and revisions, built at start                                | Available (needs `streams.alignment: color_to_depth`)                                                                                                                                                                                                                                                                             |
| Loading and checking the saved camera pose                                          | Available                                                                                                                                                                                                                                                                                                                         |
| Local calibration with the console lease (`--calibrate-camera-pose`)                | Available                                                                                                                                                                                                                                                                                                                         |
| `setup.json`                                                                        | Available                                                                                                                                                                                                                                                                                                                         |
| Snapshot and updates per client, lease commands, calibration and placement commands | Available over the control stream when `serving.enabled: true`. Camera-pose calibration only. Media follows the setup state: held while not ready, not streaming or paused for setup; a commit that changes the descriptors rotates the media streams at the next keyframe (wire-format §18, see [Serve to browsers](../serving)) |
| `autocalibrate: true` in practice                                                   | Available with serving enabled: a client holding the lease may start a calibration                                                                                                                                                                                                                                                |
| Placement persistence                                                               | Implemented: a committed placement is saved before clients see it and restored at start                                                                                                                                                                                                                                           |

Without `streams.alignment: color_to_depth` the server logs
`setup state not built: client-facing setup requires streams.alignment=color_to_depth`
and runs the pipeline without a setup state.

## Related pages [#related-pages]

* [Setup progress, sync telemetry and calibration data](./progress-and-sync): the tasks behind `starting`, the sync window and the camera-pose run data
* [Camera pose calibration](../camera-calibration): calibrate, validity rules, troubleshooting
* [Configuration](../configuration#calibration): `camera_pose_path`, `autocalibrate`
* [Stream layout](../stream-layout): the bundles and descriptors the state describes
* [Serve to browsers](../serving): control plane status and setup
