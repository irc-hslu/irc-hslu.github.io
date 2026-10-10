# Capture and synchronisation (https://irc-hslu.github.io/orbbecstreamer/docs/server/how-it-works/capture-and-sync)



The capture side turns several Orbbec cameras into one stream of
synchronised multi-camera **batches**. A batch holds one frame set (a colour
and a depth frame) per camera, all taken at the same moment. The server
uses:

* the cameras' trigger cable, so they expose at the same time,
* the Orbbec SDK's global timestamps, so their clocks can be compared,
* a frame batcher that matches frame sets across cameras by timestamp.

The code is in `server/src/camera/` (`OrbbecCameraProvider`, `CameraRig`,
`FrameBatcher`).

## Cameras and roles [#cameras-and-roles]

At start-up the server waits up to `run.camera_wait_timeout_ms` for the
cameras listed in `cameras`, matched by `serial_number`. A missing camera is
logged and left out; the server runs with the ones it found (see
[Configuration](../configuration#cameras)). Inside the server a camera is
called `orbbec:<serial>`; logs, recordings and clients use your config `id`
instead.

| `sync.enabled` | Roles used                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `true`         | The camera with `role: primary` drives the trigger; every other camera is a secondary. Exactly one primary is required.                                                              |
| `false`        | One camera only, running free (standalone); `role` has no effect. More than one camera is refused at start-up, because free-running cameras drift apart and no frame set would form. |

The start-up order matters for hardware sync: the server writes the sync
settings to every camera first, starts the secondaries, and starts the
primary last, so every secondary is armed before the first trigger. Frames
are passed on only after every camera is streaming and the clock sync below
is enabled; earlier frames are discarded.

The server does not reassign the primary role. If the primary camera is
missing at start-up, the secondaries get no trigger.

## Hardware sync and delays [#hardware-sync-and-delays]

With `sync.enabled: true` the server programs each camera's multi-device sync
settings and reads the role back. A mismatch stops start-up with
`Orbbec synchronization role readback mismatch for camera <id>`.

| Setting                                      | Applied to                                                                        | Default     | Dev config  |
| -------------------------------------------- | --------------------------------------------------------------------------------- | ----------- | ----------- |
| Depth delay                                  | Secondary *n* (in config order): *n* × `secondary_depth_delay_step_us`; primary 0 | 150 µs step | 160 µs step |
| `color_delay_us`                             | Every camera                                                                      | 0           | 0           |
| `trigger_to_image_delay_us`                  | Every camera                                                                      | 0           | 0           |
| `trigger_out_enable`, `trigger_out_delay_us` | Every camera                                                                      | `true`, 0   | `true`, 0   |
| `frames_per_trigger`                         | Every camera                                                                      | 1           | 1           |

The depth cameras measure distance by timing their own infrared light
(time of flight, ToF). The depth delay staggers their exposures, so one
camera's infrared light does not disturb another camera's measurement. The start-up log shows what each camera
accepted:

```text
Configured Orbbec sync: camera=orbbec:CL8K0000000A mode=4 depth_delay_us=0 ... global_timestamp=enabled
Configured Orbbec sync: camera=orbbec:CL8K0000000B mode=8 depth_delay_us=160 ... global_timestamp=enabled
```

`mode=4` is the primary and `mode=8` a secondary. The keys are in
[Configuration](../configuration#sync).

## Time sync [#time-sync]

Hardware sync makes the cameras expose together; the timestamps make that
visible to the server.

* The server enables the SDK's **global timestamp** on every camera before
  it starts streaming. The SDK maps each camera's device clock to the host
  clock, so timestamps of different cameras are comparable. A camera
  without global-timestamp support stops start-up with
  `Orbbec global timestamps are required ...`.
* After all cameras stream, the server runs the SDK's **device clock
  sync** once for all cameras (`interval_ms=0` in the log). It does not
  repeat it: the global timestamp already follows each clock's drift, and a
  repeated sync steps the device clocks, which pushed the time difference
  between two cameras up to 15 ms for a few seconds after each sync.
  Synced once, two hardware-synced Femto Bolts stayed within 0.11 ms of
  each other over a 10-minute run, once the first minutes had settled.
* Frame sets whose timestamp is 0 (global timestamps not ready yet) are
  dropped.

A frame set's timestamp is its depth frame's global timestamp. See
[How the server works](./architecture#clock-domains) for how it maps to the
steady clock and the wire.

## Colour-to-depth alignment [#colour-to-depth-alignment]

`streams.alignment` selects the SDK's alignment filter, which runs on each
camera's capture thread, on the CPU:

| Value                      | Result                                                                                       | Use                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `color_to_depth` (default) | Colour is resampled into the depth image; both are depth-sized (640 × 576 in the dev config) | Required for client-facing setup, RVM, camera-pose calibration and encoding with the dev profiles |
| `depth_to_color`           | Depth is resampled into the colour image                                                     | Local experiments only; no client-facing setup state is built                                     |
| `disabled` (`none`)        | No alignment                                                                                 | Local experiments only; encoding fails unless colour and depth have the same size                 |

Clients always get colour aligned to the depth camera, and depth-camera
intrinsics (focal length and image centre). Moving alignment and colour
conversion to the GPU is planned.

## Frame batching [#frame-batching]

The batcher turns per-camera frame sets into batches:

1. Each camera has a short list of frame sets waiting for partners, at most
   `sync.maximum_pending_frame_sets_per_camera` (default 4). When it is
   full, the oldest one is dropped.
2. Once every camera has a waiting frame set, the batcher compares the
   oldest one of each camera. If their timestamps lie within
   `sync.timestamp_tolerance_us` (default 5000 µs), they
   become one batch.
3. Otherwise the frame set with the earliest timestamp can never match and
   is dropped; the batcher tries again with the next one.
4. Frame sets that repeat or go back in number are dropped.

### Offset tracking [#offset-tracking]

With hardware sync, the cameras expose within about 0.2 ms of each other,
but their timestamps can disagree by more. The SDK maps each camera's clock
to host time with its own straight-line fit and refits it every few seconds.
Between refits one camera's timestamps can drift away from the others':
measured on two Femto Bolts, by up to 0.3 ms per frame in the first seconds
of a run and about 0.26 ms per second later, reset at each refit. Once that
error passes the tolerance, every frame set of every camera fails to match
until the next refit. One such 4-second gap cost 246 frame sets at 30 fps.

So when every camera is a hardware-sync primary or secondary, the batcher
tracks each camera's offset to the first camera. It learns the offset from
the batches it forms (an average over about 8 batches) and compares
timestamps after subtracting it. A slow drift is followed and costs no
batches. The learned offset is limited to half the frame interval minus the
tolerance (11.7 ms at 30 fps, 28.3 ms at 15 fps with 5000 µs), so the batcher
never pairs a frame set with the camera's previous or next frame. A camera
that misses a slot is still a whole frame interval off, and that frame set
is dropped as before. Batches keep the cameras' own timestamps and spread.
Free-running cameras (`sync.enabled: false`) are not tracked.

If 8 frame sets in a row find no partner (the error outran the limit, or the
SDK refitted its mapping to a new offset), the batcher re-acquires the
offset, but only for the cameras whose offset no longer fits. It estimates
the error from the waiting frame sets. With each camera's frame counter it
gets the error exactly: under hardware sync the counters advance once per
trigger, with a constant difference between cameras (measured on two Femto
Bolts). Without the counters, it follows a gradual drift and takes a sudden
jump only when the new error is within the limit. An error beyond the limit
plus the tolerance is as close to the neighbouring frame as to the right
one, so the batcher does not guess. It forms no batch and the server stops
after 5 s with `no batch for N ms` (10 s before the first batch).

The counters' difference is learned once it held for 30 batches in a row,
because it changes while the cameras settle at start-up. If it changes
later while the timestamps still pair the frames (a secondary lost a
trigger, a counter wrapped), the new difference is learned. If the
timestamps cannot vouch for the pairing either, the batch is never sent on
and the server stops at once.

If every camera's clock steps back together, the server keeps the capture
timestamps it sends going forward: it adds the step to every later
timestamp (`timeline re-anchors` in [the telemetry](../telemetry)).

The session summary shows the largest spread and tracked offset:
`frame batcher: ... max skew 5.18 ms, max tracked camera offset 2.24 ms`.

So a batch always has one frame set from **every** active camera, in config
order. There are no partial batches: if one camera delivers nothing, no
batches are produced. Unmatched frame sets are dropped and reported with a
rate-limited warning (see [Limits and guarantees](#limits-and-guarantees)).
You also see them as `capture` below each camera's `frame_sets/s` in
[the telemetry](../telemetry#rate-tables). `--orbbec-live-sync-test` reports
the measured skew ([Run the server](../running#check-the-hardware)).

The batch's timestamp is the latest of its cameras' timestamps, and the
spread between cameras is kept with it. In the 2026-09-26 baseline the
cameras' frame sets reached the batcher 2.8–4.3 ms apart at p50 and
15–16 ms at p99 (`arrival_skew`); that is the time the batcher waits for the
slower camera.

## Frame-set and batch numbers [#frame-set-and-batch-numbers]

| Number           | Counts                                                                          | Starts at                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Frame-set number | Frame sets received by one camera's capture thread                              | 0 per camera. It also counts frames discarded during start-up, so numbers of different cameras are not aligned. |
| Batch number     | Batches emitted by the batcher, including those the stream-rate filter discards | 0                                                                                                               |

An encoded bundle's frame-set number is the camera's frame-set number in
`per_camera` mode and the batch number in `concatenated_batch` mode. Colour
and depth of one bundle always carry the same number.

## Capture profiles [#capture-profiles]

All cameras use the same `streams` profile
([Configuration](../configuration#streams)). The SDK rejects a profile the
camera does not offer when the camera starts.

|        | Supported by the server                                  | Dev config                   |
| ------ | -------------------------------------------------------- | ---------------------------- |
| Depth  | `depth_u16`, any size the camera offers, at 15 or 30 fps | 640 × 576 at 30 fps          |
| Colour | `rgb8`, `bgr8`, `gray8`, at the depth rate               | 1280 × 720 at 30 fps, `rgb8` |

* Encoding, RVM and the bilateral depth filter need `rgb8` colour.
* Colour and depth `fps` must be equal, and 15 or 30.
* `rgb8` and `bgr8` are converted from the camera's format by the SDK, on
  the CPU.
* The capture rate can be a multiple of the stream rate
  (`encoding.stream_fps`): the dev config captures at 30 and streams at 15.
  See [Capture rate and stream rate](../configuration#capture-rate-and-stream-rate).

## Latency: frame rate and colour timing [#latency-frame-rate-and-colour-timing]

Most of the end-to-end latency is on the camera side, before the SDK
delivers a frame set, and it scales with the capture frame interval. From the
baseline of 2026-09-26
(`server/docs/architecture/latency-review/baseline-2026-09-26.md`; two
Femto Bolts, 15 fps capture, `rgb8`):

| Measured                                              | p50         | p99          |
| ----------------------------------------------------- | ----------- | ------------ |
| Capture → depth received by the host                  | 94.4 ms     | 98.6 ms      |
| Capture → colour received by the host                 | 134.2 ms    | 146.8 ms     |
| SDK colour conversion and frame sync (`sdk_internal`) | 8.7–10.5 ms | 12.8–14.9 ms |
| CPU alignment (`align`)                               | 2.5–4.1 ms  | 6.3–7.6 ms   |

* **Colour arrives after depth.** At 15 fps colour reaches the host about
  40 ms after depth (8–13 ms at 30 fps in the SDK probe). The SDK holds depth until the
  matching colour frame is there, so every frame set waits for colour. This
  happens in the camera and USB path, not in the server.
* **30 fps capture halves it.** On the same two-camera rig, capturing at 30
  and streaming at 15 cut colour arrival from about 134 to 67 ms and
  capture-to-hand-off from 146.8 to 73.4 ms at p50, at the same stream rate
  and bitrate. The dev config uses this. GPU work, RVM included, runs at
  the stream rate, so its per-frame budget does not shrink.
* The capture timestamps come from the SDK's clock mapping, so absolute
  capture-to-host numbers may carry a constant offset. Comparisons between
  runs are valid.

## Limits and guarantees [#limits-and-guarantees]

* **One camera model per rig.** All cameras must report the same model
  name and share one capture profile.
* **Orbbec only.** `vendor` accepts only `orbbec`.
* **No hot-plug.** The camera set is fixed at start-up. A camera that fails
  or is unplugged while running ends its capture thread. Within a second the
  server stops with `orbbec-streamer failed: camera capture stopped: [<camera
  id>: Orbbec capture error: ...]` and exit code 1, instead of running on
  without batches. Fix the camera and restart the server.
* **Unmatched frame sets are reported.** When a frame set finds no partner
  from every camera within `sync.timestamp_tolerance_us`, or a camera's
  pending limit overflows, the batcher drops it. Some drops are expected:
  at 15 fps each Femto Bolt's colour sensor runs about 0.25 % slower than
  its depth sensor, so every 399 frames (about 27 s) a camera has no
  colour frame for one depth frame. The SDK drops that depth frame, and the
  other cameras' frame sets for that moment have no partner. With two
  cameras that is one lost batch about every 13 s. At 30 fps colour and
  depth stay in step and this does not happen. The first second also drops
  a few dozen frame sets while the cameras and their clocks settle. After the first 5 s (start-up
  settling is not reported) the server logs at most every 10 s: `frame batcher
  dropped N frame set(s) without a match from every camera (M in total)`. The
  session summary ends with the totals (`frame batcher: ... stale ...
  dropped`).
* **Bounded memory.** Frame sets waiting for partners are limited per
  camera; nothing on the capture side can grow without bound.
* **No waiting on later stages.** The capture thread only pushes into the
  upload queue, which drops its oldest batch when full.

## Troubleshooting [#troubleshooting]

Sync and start-up failures (`propertyId: 1038`, role readback mismatch,
missing cameras) are in [Run the server](../running#troubleshooting). Low
batch rates, skew and uneven cameras are in
[Read the telemetry](../telemetry#troubleshooting).

## Related pages [#related-pages]

* [How the server works](./architecture)
* [Configuration: `sync` and `streams`](../configuration#sync)
* [Camera calibration](../camera-calibration)
* [Latency](./latency)
* [Read the telemetry](../telemetry)
