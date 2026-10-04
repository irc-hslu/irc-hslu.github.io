# Read the telemetry (https://irc-hslu.github.io/orbbecstreamer/docs/server/telemetry)



While `--live` runs, the server prints its own health to the terminal:
frame rates, dropped frames and how long each stage takes. This page shows
each kind of output, explains every column, and lists the values of a
healthy run.

In this page, a **batch** is one synchronised frame set from every camera.
The pipeline moves batches through its stages: capture, upload to the GPU,
GPU processing, and encoding.

The server prints three kinds of telemetry:

| Output                                                                   | When                                                           | Content                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------- |
| Rate tables (`LIVE PIPELINE`, `CAMERA INGRESS`, `DEBUG RECORDING RATES`) | Every second, starting about 6 s after `live pipeline started` | Frames per second per stage, drop counters, bandwidth |
| `pipeline latency, last 5 s`                                             | Every 5 s                                                      | Stage-by-stage latency percentiles of the last 5 s    |
| `SESSION SUMMARY` and `pipeline latency, whole session`                  | Once, at shutdown                                              | Totals and whole-session latency                      |

There is no config section for telemetry and no metrics endpoint yet.
Network metrics (per-client queues, drops, stalls) will come with the
WebTransport server; see [Serve to browsers](./serving).

## Check a run in four steps [#check-a-run-in-four-steps]

1. Wait about 6 s after `live pipeline started` for the first rate table.
2. In `LIVE PIPELINE`, check that `capture`, `upload` and `process` run at
   the configured frame rate, and `encode` at cameras × frame rate.
3. Check that every `dropped` counter stays at `0`.
4. After a minute, compare the latest latency report with
   [What good looks like](#what-good-looks-like).

If a number is off, go to [Troubleshooting](#troubleshooting).

## Choose the display mode [#choose-the-display-mode]

On an interactive terminal the rate tables are redrawn in place on a
separate screen, which also overwrites the latency reports within a second.
To keep every report, use log mode. From the `server/` folder:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-relwithdebinfo/orbbec_streamer --live config/dev/live.yaml 2>&1 | tee live.log
```

| `ORBBEC_STREAMER_STATUS_MODE` | Behaviour                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| unset                         | In-place display if stdout is a terminal, `TERM` is set and not `dumb`, and `NO_COLOR` is unset; otherwise log mode. |
| `log`                         | Every table is an ordinary log line. Use this for measurements and log files.                                        |
| `dashboard`                   | Always redraw in place.                                                                                              |

The in-place display keeps the rate tables at the top of the screen and
redraws them every second. Log lines, such as warnings, still appear below
the tables. A real screen with two cameras at 15 fps, the preview open and
GPU-output recording on (serial numbers replaced):

```text
LIVE PIPELINE
stage              fps     dropped       MiB/s
capture           14.0           -           -
upload            14.0           0           -
process           14.0           0           -
encode            28.0           0        0.40
preview           14.0           -           -

CAMERA INGRESS
camera                        frame_sets/s    frames/s       MiB/s
orbbec:CL8K0000000A                    15.0        30.0        26.4
orbbec:CL8K0000000B                    14.0        28.0        24.6


DEBUG RECORDING RATES  queues(in/out)=0/0 drops(in/out)=0/0 worker=ok
camera          in_color    in_depth   out_color   out_depth   dec_color   dec_depth  decoder
cam0                 0.0         0.0         0.0         0.0         0.0         0.0  disabled/disabled
cam1                 0.0         0.0         0.0         0.0         0.0         0.0  disabled/disabled
multicam             0.0         0.0        14.0        14.0        14.0        14.0  ffmpeg-cuda/ffmpeg-cuda

[2026-10-03 18:19:33.501] [info] live preview: frame=390 color=640x576 mask_nonzero=368640/368640 depth_min=45 depth_max=13479
```

The in-place display is closed before the session summary is printed, so the
summary stays on screen.

## Rate tables [#rate-tables]

The rate tables show how many frames each stage handles per second and how
many it dropped. Example from a run with two Femto Bolt cameras at 15 fps,
`session_mode: concatenated_batch` and debug recording on:

```text
LIVE PIPELINE
stage              fps     dropped       MiB/s
capture           16.0           -           -
upload            16.0           0           -
process           16.0           0           -
encode            30.0           0        1.98

CAMERA INGRESS
camera                        frame_sets/s    frames/s       MiB/s
orbbec:CL8K0000000A                    16.0        32.0        28.1
orbbec:CL8K0000000B                    15.0        30.0        26.4

DEBUG RECORDING RATES  queues(in/out)=0/0 drops(in/out)=0/0 worker=ok
camera          in_color    in_depth   out_color   out_depth   dec_color   dec_depth  decoder
cam0                15.0        15.0         0.0         0.0         0.0         0.0  disabled/disabled
cam1                15.0        15.0         0.0         0.0         0.0         0.0  disabled/disabled
multicam             0.0         0.0        15.0        15.0        15.0        15.0  ffmpeg-cuda/ffmpeg-cuda
```

Rates are counts in the last interval (about 1 s) divided by its length, so
single readings jump between 14 and 16 at 15 fps.

### `LIVE PIPELINE` [#live-pipeline]

| Row       | `fps`                                                                                                                                                                                                                      | `dropped`                                                                                                                                         | `MiB/s`                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `capture` | Synchronised batches (one frame set from every camera) per second.                                                                                                                                                         | -                                                                                                                                                 | -                                        |
| `upload`  | Batches copied to the GPU per second.                                                                                                                                                                                      | Total batches dropped since start: evicted from the full upload queue (2 batches), plus batches dropped because every GPU upload slot was in use. | -                                        |
| `process` | Batches through GPU processing (mask, depth filter) per second.                                                                                                                                                            | Total evicted from the full processing queue (2 batches).                                                                                         | -                                        |
| `encode`  | Encoded camera views (one camera's colour and depth image) per second. With N cameras this is N × the batch rate, in both encoding modes.                                                                                  | Total evicted from the full encode queue (`encoding.queue_capacity`, default 2).                                                                  | Encoded colour + depth bitstream, MiB/s. |
| `preview` | Preview frames shown per second (only with an open preview window). The preview runs on its own thread and shows the newest batch whenever it is free, so a rate below `capture` is normal and does not slow the pipeline. | -                                                                                                                                                 | -                                        |

`dropped` is a running total, not a rate, and it is exact. The queues are
short and "latest wins": a full queue drops its **oldest** batch and keeps the
new one, so after a stall the pipeline carries on with the newest frames
instead of working through a backlog. The stage then logs a warning, at most
one per second per stage, with the number of drops since its previous warning:

```text
[warning] upload queue full: dropped the oldest captured batch (14 more since the last warning)
```

The other two warnings are `processing queue full: dropped the oldest uploaded
GPU batch` and `encode queue full: dropped the oldest processed GPU batch`. The
first warning of a run reports `0 more`.

At start-up the server logs the queue sizes and how many GPU upload slots it
reserved for them (here `config/dev/live.yaml`: two cameras, debug GPU-input
recording and the preview on):

```text
[info] live queues: capacity=2 per GPU stage (drop oldest), encode=2, upload slots=41
```

Each captured frame needs one upload slot until the encoder is done with its
batch; the count covers every batch the queues and stages can hold at once.
If they still run out, the batch is dropped and counted, and about once per
second the server logs `upload slots exhausted: dropped N captured batch(es)
in the last second ...`. The server keeps running.

### `CAMERA INGRESS` [#camera-ingress]

One row per camera, counted where the Orbbec SDK hands frames to the server,
before cross-camera batching.

| Column         | Meaning                                           |
| -------------- | ------------------------------------------------- |
| `camera`       | Runtime camera id, `orbbec:<serial>`.             |
| `frame_sets/s` | Colour + depth pairs per second from this camera. |
| `frames/s`     | Individual frames per second (2 per frame set).   |
| `MiB/s`        | Raw frame bytes per second received from the SDK. |

### `DEBUG RECORDING RATES` [#debug-recording-rates]

Shown only when debug recording is on.

| Field                    | Meaning                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `queues(in/out)`         | Batches waiting for the recorder: GPU inputs / encoded outputs.                                                  |
| `drops(in/out)`          | Total batches the recorder dropped because it fell behind. Recording never slows the pipeline; it drops instead. |
| `worker`                 | `ok`, or `failed` after a recorder error (logged as `<name> debug worker disabled: <reason>`).                   |
| `in_color`, `in_depth`   | Frames per second written to `gpu-input-*.mkv`.                                                                  |
| `out_color`, `out_depth` | Encoded access units (one compressed video frame each) per second received for recording.                        |
| `dec_color`, `dec_depth` | Frames per second decoded locally (with `locally_decode_gpu_outputs`).                                           |
| `decoder`                | Colour/depth decoder backend, for example `ffmpeg-cuda`, or `disabled`.                                          |

The `multicam` row is the concatenated encoder output in
`concatenated_batch` mode.

## Latency report [#latency-report]

The latency report shows how long each stage of the pipeline takes. The
server prints it every 5 s. Example (a real window: two cameras at 15 fps, `concatenated_batch`,
`mask.backend: fill_all`, no preview):

```text
[2026-09-26 13:02:26.824] [info] pipeline latency, last 5 s (steady clock):
  capture->sdk      n=148    p50  146.801  p99  154.658  p99.9  154.658  max  154.658 ms
  capture->host_rx  n=148    p50  134.218  p99  144.526  p99.9  144.526  max  144.526 ms
  capture->depth_rx n=148    p50   94.372  p99   96.469  p99.9   96.919  max   96.919 ms
  capture->color_rx n=148    p50  134.218  p99  144.526  p99.9  144.526  max  144.526 ms
  sdk_internal      n=148    p50   10.748  p99   12.146  p99.9   12.146  max   12.146 ms
  align             n=148    p50    4.129  p99    5.636  p99.9    5.636  max    5.983 ms
  arrival_skew      n=74     p50    7.340  p99   12.059  p99.9   12.059  max   12.284 ms
  batch_wait        n=74     p50    7.340  p99   12.290  p99.9   12.290  max   12.290 ms
  upload_queue      n=74     p50    0.040  p99    0.143  p99.9    0.143  max    0.161 ms
  upload_submit     n=74     p50    0.672  p99    0.983  p99.9    0.983  max    1.671 ms
  processing_queue  n=74     p50    0.072  p99    0.143  p99.9    0.143  max    0.149 ms
  processing        n=74     p50    0.270  p99    0.705  p99.9    0.705  max    0.915 ms
  side_path         n=74     p50    0.003  p99    0.007  p99.9    0.007  max    0.008 ms
  encode_queue      n=74     p50    0.193  p99    0.573  p99.9    0.573  max    0.578 ms
  encode_color      n=74     p50    1.442  p99    2.064  p99.9    2.064  max    2.112 ms
  encode_bundle     n=74     p50    2.359  p99    3.636  p99.9    3.636  max    3.636 ms
  handoff           n=74     p50    0.004  p99    0.008  p99.9    0.008  max    0.008 ms
  sdk->handoff      n=74     p50    7.340  p99   10.486  p99.9   10.486  max   11.140 ms
  capture->handoff  n=74     p50  159.384  p99  165.152  p99.9  165.152  max  165.152 ms
```

Each line is one metric: the number of samples `n`, then the 50th, 99th and
99.9th percentile and the maximum, in milliseconds. Metrics without samples
are left out.

* A percentile is the value below which that share of samples falls.
  **p50** is the typical value. **p99** is exceeded by 1 in 100 samples;
  this is the number to compare against targets. **p99.9** and **max** show
  rare stalls. With about 75 batches per 5 s window at 15 fps, p99, p99.9
  and max are close to the single worst sample; use the whole-session report for tails.
* Percentiles are histogram bucket upper bounds with about 3 % resolution.
  That is why the same values (for example `146.801`) repeat. `max` is exact.
* All times are measured on the steady clock of the server. Metrics starting
  with `capture` use the camera's global timestamp, which the SDK maps to the
  host clock; they can include a constant offset. Differences between runs
  are still valid, and everything downstream of the SDK is exact.
* Per-camera metrics count one sample per camera per batch, so their `n` is
  twice the batch count with two cameras.
* The report window starts when the pipeline starts, so the first report
  includes start-up effects.

### Metrics [#metrics]

In the order they are printed. *Per camera* metrics come from each camera's
frame set; the others from the batch.

| Metric              | From → to                                                                             | What it contains                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capture->sdk`      | capture timestamp → SDK delivered the frame set                                       | Per camera. Sensor, USB, SDK decode and frame sync.                                                                                                                                                                                     |
| `capture->host_rx`  | capture → host received the later of colour/depth                                     | Per camera.                                                                                                                                                                                                                             |
| `capture->depth_rx` | capture → host received the depth frame                                               | Per camera.                                                                                                                                                                                                                             |
| `capture->color_rx` | capture → host received the colour frame                                              | Per camera. Colour arrives after depth; see below.                                                                                                                                                                                      |
| `sdk_internal`      | host received → SDK delivered                                                         | Per camera. SDK colour conversion, frame sync, SDK queues.                                                                                                                                                                              |
| `align`             | SDK delivered → aligned frame set built                                               | Per camera. Colour-to-depth alignment on the CPU.                                                                                                                                                                                       |
| `arrival_skew`      | first camera aligned → last camera aligned                                            | Batch, only with 2+ cameras. How far apart the cameras are.                                                                                                                                                                             |
| `batch_wait`        | first camera aligned → batch emitted                                                  | Batch. Time the batcher waited for the slowest camera.                                                                                                                                                                                  |
| `upload_queue`      | batch emitted → upload stage took it                                                  | Time in the upload queue.                                                                                                                                                                                                               |
| `upload_submit`     | upload taken → staging and host-to-GPU copies enqueued                                | CPU copy into pinned memory.                                                                                                                                                                                                            |
| `processing_queue`  | upload submitted → processing stage took it                                           | Time in the processing queue.                                                                                                                                                                                                           |
| `processing`        | processing taken → done                                                               | GPU processing, including waiting for the upload to finish.                                                                                                                                                                             |
| `side_path`         | processing done → encode enqueued                                                     | The hand-off to the encoder. With the preview on, it includes picking the preview's three images (GPU buffer handles, no image copy); the preview itself runs on its own thread. A few microseconds.                                    |
| `encode_queue`      | encode enqueued → encoder took it                                                     | Time in the encode queue.                                                                                                                                                                                                               |
| `encode_color`      | encoder took it → colour access unit out of NVENC (the NVIDIA hardware video encoder) | Colour encode. Colour and depth are encoded in parallel, so this also covers converting and submitting depth and is close to `encode_bundle`.                                                                                           |
| `encode_bundle`     | encoder took it → depth access unit out                                               | Colour and depth encode (both access units out).                                                                                                                                                                                        |
| `handoff`           | depth out → bundle handed to its consumer                                             | Bundle assembly. A bundle is a colour and a depth access unit encoded together: one per batch in `concatenated_batch` mode, one per camera and batch in `per_camera` mode. The consumer is the debug recorder today, the network later. |
| `sdk->handoff`      | last camera's SDK delivery → hand-off                                                 | **The part the server code controls.**                                                                                                                                                                                                  |
| `capture->handoff`  | latest capture timestamp → hand-off                                                   | End to end inside the server, including the camera.                                                                                                                                                                                     |

In `per_camera` mode each camera's bundle carries the batch stamps, so batch
metrics are counted once per camera, `arrival_skew` is not recorded, and a
later camera's `encode_bundle` and `handoff` include the encodes of the
cameras before it. `concatenated_batch` mode has none of these caveats.

## Session summary [#session-summary]

When the server stops, it prints totals for the whole run. Example after
`Ctrl+C`:

```text
SESSION SUMMARY
duration_s        captured          uploaded          processed         encoded_views     encoded_bundles   encoded_AUs       encoded_MiB
41.5              584               584               584               1168              584               1168              61.43

PIPELINE DROPS
upload            processing        encoding
0                 0                 0

CAMERA TOTALS
camera        runtime_id                          sets      frames         MiB     avg_fps    in_color    in_depth   out_color   out_depth   dec_color   dec_depth
orbbec:CL8K0000000Aorbbec:CL8K0000000A                   585        1170     1028.32        15.0           0           0           0           0           0           0
orbbec:CL8K0000000Borbbec:CL8K0000000B                   595        1190     1045.90        15.0           0           0           0           0           0           0

[info] pipeline latency, whole session (steady clock):
  capture->sdk      n=1168   p50  146.801  p99  155.189  p99.9  163.578  max  164.659 ms
  ...
```

| Field                               | Meaning                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `captured`, `uploaded`, `processed` | Batches through each stage. Equal numbers mean no drops.                                                                           |
| `encoded_views`                     | Camera views encoded (cameras × bundles in `concatenated_batch` mode).                                                             |
| `encoded_bundles`                   | Colour + depth pairs handed off.                                                                                                   |
| `encoded_AUs`                       | Access units: 2 per bundle.                                                                                                        |
| `encoded_MiB`                       | Total encoded bytes.                                                                                                               |
| `PIPELINE DROPS`                    | The final `dropped` totals of the rate table.                                                                                      |
| `DEBUG RECORDING DROPS`             | Shown with recording on: dropped GPU-input batches, dropped output bundles, worker state.                                          |
| `CAMERA TOTALS`                     | Per camera: frame sets and frames from the SDK, raw MiB, average fps, and the recorder's per-camera counts (0 with recording off). |
| `ENCODED OUTPUT TOTALS`             | Shown with recording on in `concatenated_batch` mode: access units of the `multicam` stream.                                       |

With recording off, the `CAMERA TOTALS` table has a known formatting defect:
the `camera` column shows the runtime id instead of the config id, and it runs
into the `runtime_id` column with no space, as in the example above. The
numbers in the other columns are correct.

The whole-session latency report follows, in the same format as the 5 s
report. Use it for tail latencies. The last two lines before `pipeline stopped
cleanly` are totals:

```text
[info] frame batcher: 1029 batches, 0 stale and 0 duplicate/regressive frame sets dropped; max skew 0.57 ms, max tracked camera offset 0.22 ms
[info] keyframes: 0 requested, 0 forced (on-demand; periodic IDRs not counted)
```

`stale` frame sets had no partner from every camera within the timestamp
tolerance (a sync problem when it grows). `max skew` is the largest
timestamp spread inside a batch, and `max tracked camera offset` the largest
offset the batcher learned between hardware-synced cameras (see
[Offset tracking](./how-it-works/capture-and-sync#offset-tracking)).
`keyframes` counts on-demand
keyframe requests and the IDRs (keyframes that a decoder can start from)
they forced. Nothing requests keyframes until the server serves browsers, so
both stay 0.

## What good looks like [#what-good-looks-like]

These values come from a reference measurement of 2026-09-26
(`server/docs/architecture/latency-review/baseline-2026-09-26.md`). Two
hardware-synced Femto Bolts, RTX 4090, `dev-relwithdebinfo` build, depth
640×576 and colour 1280×720 at 15 fps, colour requested as `rgb8`,
`concatenated_batch`, `mask.backend: fill_all` (no RVM), no preview.

| Metric                                          | p50          | p99          |
| ----------------------------------------------- | ------------ | ------------ |
| `capture->depth_rx`                             | 94.4 ms      | 98.6 ms      |
| `capture->color_rx`                             | 134.2 ms     | 146.8 ms     |
| `sdk_internal`                                  | 8.7–10.5 ms  | 12.8–14.9 ms |
| `align`                                         | 2.5–4.1 ms   | 6.3–7.6 ms   |
| `arrival_skew` = `batch_wait`                   | 2.8–4.3 ms   | 15–16 ms     |
| `upload_queue` + `upload_submit`                | 0.6–0.8 ms   | 1.7–2.0 ms   |
| `processing` (fill_all mask + bilateral filter) | 0.25–0.48 ms | 1.0–1.2 ms   |
| `side_path` (no preview)                        | \< 0.01 ms   | \< 0.01 ms   |
| `encode_bundle` (both access units out)         | 1.9–2.4 ms   | 3.5–4.2 ms   |
| `sdk->handoff`                                  | 5.4–7.7 ms   | 11.5–12.3 ms |
| `capture->handoff`                              | 155–159 ms   | 168–172 ms   |

Also healthy: every `LIVE PIPELINE` row at the configured fps (`encode` at
cameras × fps), all `dropped` counters at 0, both cameras at the same
`frame_sets/s`, and equal `captured`, `uploaded` and `processed` totals in the
summary. With debug recording on the numbers are the same and nothing drops.

How to read it: the server code adds about 6–8 ms at p50 and about 12 ms at
p99 (`sdk->handoff`). About 140 ms of the 155 ms happen before the SDK
delivers the frames: colour arrives about 40 ms after depth, and the SDK's
`rgb8` conversion takes about 10 ms. At 30 fps the camera side is about
65 ms shorter. RVM segmentation, when enabled, adds to `processing`; it was
not part of this baseline.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                  | Likely cause                                                                                                                          | What to do                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upload` `dropped` rising                                                                | Capture outpaces the upload thread: CPU overload or slow pinned-memory copies. `upload_submit` is high.                               | Check host load; close other heavy processes; use the `dev-relwithdebinfo` build.                                                                                                               |
| `process` `dropped` rising, `processing` p99 near the frame interval (66.7 ms at 15 fps) | GPU processing too slow, usually RVM or a large bilateral radius.                                                                     | Check the RVM engine matches the camera count and resolution; lower `processing.bilateral_maximum_radius_pixels`; try `mask.backend: fill_all` to confirm.                                      |
| `encode` `dropped` rising, `encode_queue` growing                                        | NVENC cannot keep up, or another process uses the encoder.                                                                            | Check `nvidia-smi --query-gpu=encoder.stats.sessionCount,utilization.encoder --format=csv`; stop other encoders; lower resolution or fps. A larger `encoding.queue_capacity` only adds latency. |
| `upload slots exhausted` warnings                                                        | A stage or a debug recorder holds GPU batches longer than the queues allow for.                                                       | Report it with the log: the slot count is sized for the configured queues, so this points at a bug. The server keeps running and counts the drops.                                              |
| `encode_color` or `encode_bundle` max around 30–35 ms, p99 normal                        | Isolated slow encodes; the baseline runs show them too.                                                                               | Nothing, unless p99 rises too.                                                                                                                                                                  |
| `capture` fps below the configured rate while each camera's `frame_sets/s` is correct    | Batches do not form: camera timestamps are further apart than `sync.timestamp_tolerance_us`.                                          | Check the sync cable and roles; run `--orbbec-live-sync-test` (it reports skew); power-cycle the cameras.                                                                                       |
| One camera's `frame_sets/s` lower than the other's                                       | USB bandwidth, a bad cable, or the camera is not triggered.                                                                           | Move the camera to another USB controller; check the sync cable.                                                                                                                                |
| `arrival_skew` / `batch_wait` p99 well above \~16 ms                                     | The two cameras' capture threads are delivering at different times, often because of CPU load (alignment runs on the CPU per camera). | Reduce host load. A value near one frame interval means the cameras are out of sync; see the row above.                                                                                         |
| `sdk->handoff` p99 far above \~12 ms, with no single large stage                         | CPU contention: queues and threads wait for the scheduler.                                                                            | Check host load (`uptime`); compare with a quiet machine.                                                                                                                                       |
| `side_path` above 1 ms                                                                   | The processing thread is being descheduled (CPU contention). A slow preview window cannot cause this: it runs on its own thread.      | Check host load (`uptime`).                                                                                                                                                                     |
| `drops(in/out)` rising in `DEBUG RECORDING RATES`, or `worker=failed`                    | The recorder (disk, FFV1 encode or local decode) cannot keep up, or failed. The pipeline is unaffected.                               | Record fewer cameras (`debug_recording.camera_ids`), turn off `locally_decode_gpu_outputs`, or write to a faster disk.                                                                          |
| Rate tables appear but no latency reports                                                | The in-place display overwrote them.                                                                                                  | Set `ORBBEC_STREAMER_STATUS_MODE=log`.                                                                                                                                                          |
| No rate tables for the first seconds                                                     | Normal: rates are hidden for 5 s after start so start-up does not distort them.                                                       | Wait.                                                                                                                                                                                           |
