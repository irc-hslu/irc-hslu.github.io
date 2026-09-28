# Setup state (https://irc-hslu.github.io/orbbecstreamer/docs/server/setup-state)



The server keeps one authoritative setup state: whether the rig is
calibrated, whether media may flow, who holds the setup lock, and the
revisions clients need to interpret the media. Clients will read it from the
snapshot and follow its updates; today you see it in the server log. The wire
form is defined in `protocol/wire-format.md` §10–§12 and §18.

The state machine (`src/control/SetupController`) is implemented and tested.
The network layer that carries it to clients is not available yet; see
[What works today](#what-works-today).

## Phases and readiness [#phases-and-readiness]

Internally the server names one phase for logs. On the wire the same state
is split into independent fields, and the internal names never appear there.

| Internal phase (log)      | When                                                         | On the wire (§10)                               |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `NEEDS_SETUP`             | Camera pose missing, stale or failed; `autocalibrate: false` | `readiness=needs-setup`, `autocalibrate=false`  |
| `WAITING_FOR_CALIBRATION` | Camera pose missing, stale or failed; `autocalibrate: true`  | `readiness=needs-setup`, `autocalibrate=true`   |
| `CALIBRATING`             | A lease holder runs a camera-pose calibration                | Lock owned, `camera-pose` calibration `running` |
| `READY`                   | Camera pose valid, media not requested                       | `readiness=ready`, `streaming=stopped`          |
| `STREAMING`               | Camera pose valid, media requested, no calibration running   | `readiness=ready`, `streaming=streaming`        |
| `PAUSED_FOR_SETUP`        | Ready, but media held for a setup operation                  | `readiness=ready`, `streaming=paused-for-setup` |

Rules behind the table:

* **Readiness depends only on the camera pose.** A linear depth quantization
  profile is usable without calibration, and network calibration is
  advisory.
* **A recalibration keeps the server ready.** While a new run replaces a
  valid pose, the committed poses stay in use, readiness stays `ready` and
  media is paused for setup. The log shows `CALIBRATING`.
* **Media flows only when ready.** Streaming is `streaming` only when media is
  requested, the pose is valid and no calibration is running. `--live`
  requests media at start, so a valid pose shows `STREAMING` in the log. No
  bytes leave the server until serving exists.
* An `error` phase is not modelled yet.

```text
startup ─► load + check camera-pose.json
             ├─ valid ─────────────► READY / STREAMING
             └─ missing or stale ──► NEEDS_SETUP             (autocalibrate: false)
                                     WAITING_FOR_CALIBRATION (autocalibrate: true)
lease holder starts calibration ───► CALIBRATING
   commit ──► valid, revision + 1 ─► READY / STREAMING
   cancel, release, disconnect, lease expiry ─► previous state
   failure ─► failed (a recalibration keeps the old valid pose)
```

What makes a saved pose valid or stale, and the procedure to calibrate, are
on [Camera pose calibration](./camera-calibration#startup-states).

### In the log [#in-the-log]

At start, after the cameras are open:

```text
[info] setup at startup: phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: no camera-pose calibration at config/dev/camera-pose.json) streaming=stopped metadata_revision=1
```

After that, a `setup update` line appears whenever the phase, the camera-pose
calibration, the streaming state or the lock owner changes. Lease heartbeats
are not logged.

## Revisions [#revisions]

Every change a client needs to interpret media carries a revision. Revisions
never decrease, and content that affects interpretation changes only with a
newer revision.

| Revision                            | Starts at                                              | Changes when                                                                                          | Persisted                                             |
| ----------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `calibrationRevision` (camera pose) | The revision in `camera-pose.json`; `0` without a file | A calibration is committed: previous + 1, also when the previous pose was stale                       | Yes, in `camera-pose.json`                            |
| `depthQuantizationRevision`         | `1`                                                    | Never while running. Changing the profile needs a restart.                                            | No                                                    |
| `placementRevision`                 | `0`                                                    | A client commits a new placement (`client.placement.commit`): + 1                                     | No: placement is kept in memory and resets at restart |
| `metadataRevision`                  | `1` at every start                                     | Once per authoritative update message (lock, calibration state, readiness, streaming, descriptors, …) | No                                                    |

Stream descriptors carry the metadata revision at which something they depend
on last changed, not the current one. A lock or streaming change therefore
never rotates media streams; a new calibration, placement or quantization
does (§18). Because `metadataRevision` restarts at 1, a client that
reconnects after a server restart takes the full snapshot, as it does after
any reconnect (§17).

## Setup lease [#setup-lease]

Setup operations (calibration, placement) need the setup lock. There is one
per server.

| Property  | Value                                                                               |
| --------- | ----------------------------------------------------------------------------------- |
| Holders   | One connection at a time; others are rejected with `lock-held`                      |
| Expiry    | 15 s after acquiring or the last heartbeat (fixed, not configurable)                |
| Heartbeat | Every 5 s from the holder                                                           |
| Lease id  | 128 random bits, sent only to the holding connection; never valid after a reconnect |
| Ends on   | Release, disconnect, expiry. Ending the lease cancels a running calibration.        |

The lock state is broadcast to every client. Clients without the lock keep
their normal control connection and see every state change.
`--live --calibrate-camera-pose` takes the lease as the local console,
heartbeats it every 5 s and releases it when the run ends.

## `autocalibrate` [#autocalibrate]

`calibration.autocalibrate` is read at start and fixed for the run.

| Value             | With a missing or stale pose                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `false` (default) | A client may not start a calibration (`calibration-requires-operator`); an operator calibrates on the server with `--calibrate-camera-pose`. Phase `NEEDS_SETUP`. |
| `true`            | A client holding the lease may start the calibration itself; normal media is held until it is committed. Phase `WAITING_FOR_CALIBRATION`.                         |

In both modes a valid pose may be recalibrated by the lease holder. Until
clients can connect, `true` only changes the phase name in the log; keep it
`false`. See [Configuration](./configuration#calibration).

## `setup.json` [#setupjson]

At every start, after the cameras are running, the server writes
`<debug_recording.directory>/setup.json` (default `debug/live/setup.json`),
even with recording off. It is a local debug file for tools and recordings,
not part of the client protocol, and it is overwritten on each start.

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

| Part                                                                           | Status                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Setup state, readiness and revisions, built at start                           | Available (needs `streams.alignment: color_to_depth`)   |
| Loading and checking the saved camera pose                                     | Available                                               |
| Local calibration with the console lease (`--calibrate-camera-pose`)           | Available                                               |
| `setup.json`                                                                   | Available                                               |
| Snapshot and updates sent to clients                                           | Needs the network layer (not yet available)             |
| Lease acquire, heartbeat and release by clients                                | Needs the network layer                                 |
| Calibration started, cancelled or committed by a client; `autocalibrate: true` | Needs the network layer                                 |
| Placement commits                                                              | Needs the network layer; placement is not persisted yet |

Without `streams.alignment: color_to_depth` the server logs
`setup state not built: client-facing setup requires streams.alignment=color_to_depth`
and runs the pipeline without a setup state.

## Related pages [#related-pages]

* [Camera pose calibration](./camera-calibration): calibrate, validity rules, troubleshooting
* [Configuration](./configuration#calibration): `camera_pose_path`, `autocalibrate`
* [Stream layout](./stream-layout): the bundles and descriptors the state describes
* [Serve to browsers](./serving): status of the network layer
