# Setup progress, sync telemetry and calibration data (https://irc-hslu.github.io/orbbecstreamer/docs/server/how-it-works/progress-and-sync)



Protocol 1.1 sessions get four kinds of information that explain what the server is doing and how healthy the capture is. This page says where each one comes from and which thresholds the server applies. The wire forms are in `protocol/wire-format.md` (§10, §11, §13).

| Message or field                                                                              | Who gets it                                       | Change |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| `server.setup.progress`, `streaming = starting`                                               | Every protocol 1.1 session                        | 0032   |
| `server.sync.telemetry`                                                                       | Sessions with the `operator` role                 | 0029   |
| Camera-pose data in `server.calibration.progress`, run parameters in the `camera-pose` status | The lock owner (progress), every session (status) | 0033   |
| `preview` on channel descriptors                                                              | Every protocol 1.1 session, read only             | 0030   |

A protocol 1.0 session receives none of these.

## Setup progress [#setup-progress]

`server.setup.progress` is always the complete task list, in execution order. The server sends it again whenever a task changes state, whenever the capture state changes, and after every `server.hello` and `server.snapshot` (operator sessions get it just before `server.operator.replay-complete`). It is coalescable: a session that has not drained its control stream gets only the latest list. The list starts fresh after a server restart and is not part of the snapshot.

| `taskId`        | Meaning                                                                                       | State                                                                                                                                                          | `blocks`                                                                            |
| --------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `engine-build`  | The foreground-model (TensorRT) engine for `mask.backend: rvm`. Listed only for that backend. | `pending` until a build starts, `running` while it builds, `done` when the segmenter is ready, `failed` with the build's error                                 | `calibration:depth-quantization`                                                    |
| `camera-open`   | The cameras                                                                                   | Mirrors `capture`: `pending` while `idle` or `closing`, `running` while `opening`, `done` while `running`, `failed` with `capture.message` after a failed open | `preview`, `calibration:camera-pose`, `calibration:depth-quantization`, `streaming` |
| `encoder-start` | The HEVC encoders                                                                             | The same as `camera-open`                                                                                                                                      | `streaming`                                                                         |

* **Build progress.** While the engine builds, `progress` is the share of completed steps of the current top-level TensorRT phase, `detail` names it (`Building engine: step 25 of 100`) and `etaMs` is the elapsed time scaled by the remaining share once 2 % is done. Progress changes are sent at most 4 times per second.
* **Masks while the engine builds.** Masks pass every pixel and the cameras may open, so a build blocks only the depth-quantization calibration, not `streaming`.
* **No retries.** The server retries no task. `client.capture.start` is the retry for `camera-open` and `encoder-start`, and a failed engine build is tried again at the next capture open.
* **`failed` tasks** carry `error {code, message, hint}`: `message` is what failed (the device's own text, cut at 512 characters), `hint` what to do next.

### The `starting` phase [#the-starting-phase]

`streaming` reads `starting` from the moment media is wanted (the cameras run and the server is ready, or a stream-profile switch or a property restarts the rig) until the encoders have produced access units. It then becomes `streaming`. The capture thread looks every 100 ms while the phase is `starting`. A recalibration of a valid pose pauses media (`paused-for-setup`) and resumes straight to `streaming`. While `starting`, `server.stream.availability` reads `available: false, reason: "starting"`.

## Sync telemetry [#sync-telemetry]

`server.sync.telemetry` goes to operator sessions once per second while the cameras run: one window of capture-side sync health, with the camera list in snapshot order. It is coalescable and replayed (the latest window) after a hello or snapshot. It is not sent while capture is not `running`. Nothing is added to the snapshot.

| Field                                  | How the server fills it                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frameSets.completed`                  | Complete sets handed to the media path in the window                                                                                                                                                                                  |
| `frameSets.decimated`                  | Complete sets skipped on purpose because `encoding.stream_fps` is below the capture rate                                                                                                                                              |
| `frameSets.dropped.batcher`            | Slots for which no set formed: the largest per-camera batcher discard count in the window                                                                                                                                             |
| `frameSets.dropped.pipeline`           | Complete sets a full upload, processing or encode queue discarded                                                                                                                                                                     |
| `frameSets.spreadUsP50`, `spreadUsMax` | Max minus min of the per-camera capture timestamps of the completed sets (nearest-rank median and maximum, 0 for no sets)                                                                                                             |
| `toleranceUs`                          | `sync.timestamp_tolerance_us`, the matching tolerance applied after the batcher's per-camera offset correction                                                                                                                        |
| `cameras[].timestampOffsetUs`          | The camera's median timestamp minus the set's reference timestamp. The reference is the latest camera of the set, so it is 0 or negative. `null` with no completed set                                                                |
| `cameras[].offsetJitterUs`             | The p95 of the absolute deviation from that median; `null` with the offset                                                                                                                                                            |
| `cameras[].framesReceived`             | Frame sets the rig accepted from the camera                                                                                                                                                                                           |
| `cameras[].framesDropped.capture`      | Gaps in the camera's own frame counter (jumps of more than 10 are counter discontinuities and are not counted), plus sets rejected on receipt (no valid timestamp, a failed alignment, a timestamp that went backwards or jumped)     |
| `cameras[].framesDropped.batcher`      | Sets of this camera the batcher discarded: late, unmatched, over the pending limit, duplicate. This includes sets left without a partner because another camera skipped the slot; the verdict does not hold those against this camera |
| `cameras[].syncRole`                   | The hardware role the server set: `standalone` when `sync.enabled` is `false`, else `primary` or `secondary` from the camera's `role`. Read only                                                                                      |
| `cameras[].syncSignal`                 | Always `null`: the SDK does not report the sync input                                                                                                                                                                                 |

### The verdict [#the-verdict]

`status` is the server's verdict; the numbers beside it are raw, and a client never recomputes it.

| `status`   | When                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lost`     | The camera delivered no frame set in the window (no frame for about a second or more)                                                                                                                |
| `degraded` | The camera's own drops (capture plus batcher) are more than 1 % of the sets expected over the last 30 windows, or 3 or more fall in the last 10 windows, or the offset jitter is above `toleranceUs` |
| `ok`       | Otherwise                                                                                                                                                                                            |

A Femto Bolt colour sensor runs about 0.25 % slower than its depth sensor, so at 15 fps each camera drops about one slot every 20 to 30 seconds (see [Running the pipeline](../running)). When a camera skips a slot, the batcher also discards the other cameras' sets for that slot. The verdict counts that slot once, on the camera that skipped it (a gap in its own frame counter); the other cameras' discarded sets show in `framesDropped.batcher` but are not held against them, up to the slots the other cameras actually skipped. A camera whose own timestamps leave the tolerance has discards with no skipped slot behind them, and those count in full. The normal rate is 0 or 1 own drops in ten windows and stays `ok`. A burst of 3 in ten seconds, or a sustained rate above 1 %, is `degraded`. The 1 % rule starts once 30 windows exist, so the first 30 seconds are judged by the burst rule alone. A rig with every camera `standalone` (`sync.enabled: false`) is a valid configuration, not a fault.

## Camera-pose data [#camera-pose-data]

`server.calibration.progress` for `kind: camera-pose` goes to the lock owner only, at most 10 times per second, the first when the run starts. It is coalescable: a slow client gets the latest state, never a queue.

* **Corners.** `perCamera[].boardCornersPx` are the detected ChArUco corners in pixels of the camera's tile. The calibration runs on the colour image aligned into the depth image (`streams.alignment: color_to_depth`, the only alignment the server serves), so detector pixels are tile pixels, unscaled and uncropped, with the pixel centre at the integer coordinate (wire-format §9). At most 256 points; `null` when the board is not visible.
* **Counts.** `acceptedObservations` per camera counts the accepted frame sets that include it.
* **Last observation.** `lastObservation {result, reason}` is `null` before the first board. Reasons: `too-few-corners`, `reprojection-error-too-high`, `pose-ambiguous` (the board's pose has a mirror solution that fits almost as well), `not-co-observed` (fewer than two cameras saw the board in this set) and `too-close-to-previous` (the board did not move 2 cm or 3° since the last accepted set).
* **Coverage.** A grid over the tile with 4 columns and rows by the tile's aspect ratio (4 for a square tile). Each cell counts the accepted observations whose board centroid fell in it, up to 255. A cell is covered at `targetPerCell` (2).
* **Run level.** `phase` is `collecting` until `acceptedObservations` reaches `requiredObservations`, then `solving`: the server tries a solve after each further accepted observation and ends collection itself with the first that succeeds. `lastSolveFailure` says why the last solve did not (naming the cameras). `sharedObservations` lists each camera pair with its accepted-set count and `translationRmsM`, the RMS spread of the pair's relative-pose samples (`null` below 5 samples). The pair statistics are refreshed at most once per second.

The `camera-pose` entry of every `calibration` status (snapshot and `server.calibration.state`) carries `board`, `timeoutMs` (the run limit, 120 000 ms) and `maxReprojectionErrorPx` (2.0, the per-view acceptance threshold), so an operator can print the board and see the limit before a start. A run not solved within `timeoutMs` fails and commits nothing; cancel, lease expiry or takeover, and a capture stop discard the observations.

## Preview media [#preview-media]

The wire (change 0030) lets an operator see the cameras before a pose is committed by serving media flagged `preview: true`. This server does not offer preview media yet. It keeps holding media until the camera pose is committed (wire-format §10), and its channel descriptors leave `preview` out, which a client reads as `false`. A client that sends `"preview-media"` in `client.hello.features` is not treated differently.

## Troubleshooting [#troubleshooting]

| Symptom                                    | Cause and fix                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-build` stays `running` for minutes | First run on this GPU: TensorRT builds the engine once and caches it in `mask.rvm_engine_cache_dir`. The task shows the progress                |
| `engine-build` is `failed`                 | Read `error.message` and the server log (`RVM engine:` lines); fix the GPU or ONNX path and start capture again                                 |
| `camera-open` is `failed`                  | `error.message` is the device's text. Check the USB cables and power, then send `client.capture.start`                                          |
| `streaming` stays `starting`               | The cameras run but no access unit came out: look at `encoder-start` and the `live pipeline` rates in the log                                   |
| A camera is `degraded` right after start   | The first seconds after start settle the SDK's clock fit; if it stays, check the sync cable, the primary role and `sync.timestamp_tolerance_us` |
| `timestampOffsetUs` is large and negative  | The camera's clock fit is off or its trigger is late; compare `spreadUsMax` with `toleranceUs`                                                  |

## Related [#related]

* [Setup state and revisions](./setup-state) for readiness and the streaming phases.
* [Sensor properties and stream profiles](./operator-configuration) for the other operator messages.
* [Camera pose calibration](../camera-calibration) for the board and the procedure.
* [Capture and synchronisation](./capture-and-sync) for the batcher and the sync roles.
* [Serve to browsers](../serving) for roles and the control plane.
