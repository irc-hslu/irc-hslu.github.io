# Read the telemetry (https://irc-hslu.github.io/orbbecstreamer/docs/server/telemetry)



While `--live` runs, the server prints its health to the terminal: rates, drops and per-stage latency. A **batch** is one synchronised frame set from every camera; it moves through capture, upload, GPU processing and encoding.

| Output                                                                 | When                                                       | Content                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Rate tables `LIVE PIPELINE`, `CAMERA INGRESS`, `DEBUG RECORDING RATES` | Every second, from about 6 s after `live pipeline started` | Rates per stage, drop counters, bandwidth |
| `pipeline latency, last 5 s`                                           | Every 5 s                                                  | Per-stage latency percentiles             |
| `SESSION SUMMARY`, `pipeline latency, whole session`, totals           | Once, at shutdown                                          | Totals and whole-run latency              |

There is no telemetry config section and no metrics endpoint. Per-client network metrics exist in the media fan-out library but are not wired; see [Serve to browsers](./serving).

## Check a run in four steps [#check-a-run-in-four-steps]

1. Wait about 6 s after `live pipeline started` for the first rate table.
2. In `LIVE PIPELINE`: `capture` at the capture rate (`streams.*.fps`), `upload` and `process` at the stream rate (`encoding.stream_fps`), `encode` at cameras × stream rate.
3. Every `dropped` counter stays at `0`.
4. After a minute, compare the latency report with [What good looks like](#what-good-looks-like).

## Choose the display mode [#choose-the-display-mode]

On an interactive terminal the rate tables are redrawn in place at the top of a separate screen, which also overwrites the latency reports. To keep every report, use log mode, from `server/`:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-relwithdebinfo/orbbec_streamer --live config/dev/live.yaml 2>&1 | tee live.log
```

| `ORBBEC_STREAMER_STATUS_MODE` | Behaviour                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| unset                         | In place if stdout is a terminal, `TERM` is set and not `dumb`, and `NO_COLOR` is unset; otherwise log mode |
| `log`                         | Every table is a log line. Use it for measurements.                                                         |
| `dashboard`                   | Always in place                                                                                             |

The in-place display closes before the session summary, so the summary stays on screen.

## Rate tables [#rate-tables]

Example from two Femto Bolts at 15 fps capture and stream, `concatenated_batch`, the preview open and GPU-output recording with local decoding on (serials replaced):

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
```

Rates are counts in the last interval (about 1 s) divided by its length, so single readings jump between 14 and 16 at 15 fps. At capture 30 / stream 15, `capture` and `CAMERA INGRESS` show about 30 and every other row about 15.

### `LIVE PIPELINE` [#live-pipeline]

| Row       | `fps`                                                                       | `dropped` (running total, exact)                                                                  | `MiB/s`                |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------- |
| `capture` | Batches formed by the batcher, at the capture rate                          | -                                                                                                 | -                      |
| `upload`  | Batches copied to the GPU, at the stream rate                               | Evicted from the full upload queue (2), plus batches dropped because every upload slot was in use | -                      |
| `process` | Batches through GPU processing                                              | Evicted from the full processing queue (2)                                                        | -                      |
| `encode`  | Camera views encoded: cameras × batch rate, in both layouts                 | Evicted from the full encode queue (`encoding.queue_capacity`)                                    | Encoded colour + depth |
| `preview` | Preview frames shown (only with an open window). Below `capture` is normal. | -                                                                                                 | -                      |

Batches skipped to reach the stream rate are not drops; they are counted in the shutdown line `stream rate: ... passed on`.

The queues are short and latest-wins: a full queue drops its **oldest** batch, so after a stall the pipeline continues with the newest frames. Each stage then warns at most once per second, with the drops since its last warning:

```text
[warning] upload queue full: dropped the oldest captured batch (14 more since the last warning)
```

The other two are `processing queue full: dropped the oldest uploaded GPU batch` and `encode queue full: dropped the oldest processed GPU batch`.

At start-up the server logs the queue sizes and the GPU upload slots reserved for them (`config/dev/live.yaml`: two cameras, GPU-input recording and preview on):

```text
[info] live queues: capacity=2 per GPU stage (drop oldest), encode=2, upload slots=41
```

If the slots still run out, the batch is dropped and counted, and the server logs `upload slots exhausted: dropped N captured batch(es) in the last second ...` about once per second. It keeps running.

### `CAMERA INGRESS` [#camera-ingress]

One row per camera, counted where the SDK hands frames to the server, before batching: `frame_sets/s` (colour + depth pairs), `frames/s` (2 per frame set) and raw `MiB/s`. `camera` is the runtime id `orbbec:<serial>`.

### `DEBUG RECORDING RATES` [#debug-recording-rates]

Shown only with recording on. Recording never slows the pipeline; it drops instead.

| Field                    | Meaning                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `queues(in/out)`         | Batches waiting for the recorder: GPU inputs / encoded outputs                                               |
| `drops(in/out)`          | Batches the recorder dropped because it fell behind                                                          |
| `worker`                 | `ok`, or `failed` after an error (logged as `<name> debug worker disabled: <reason>`)                        |
| `in_*`, `out_*`, `dec_*` | Per second: frames written to `gpu-input-*.mkv`, access units received for recording, frames decoded locally |
| `decoder`                | Colour/depth decoder, for example `ffmpeg-cuda`, or `disabled`                                               |

The `multicam` row is the concatenated output in `concatenated_batch` mode.

## Latency report [#latency-report]

Every 5 s the server prints per-stage percentiles. A real window from two cameras at 15 fps, `concatenated_batch`, `fill_all`, no preview:

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

How to read it:

* Each line gives the sample count `n`, then p50, p99, p99.9 and max in milliseconds. p50 is the typical value, p99 the one to compare against targets. Metrics without samples are left out.
* Percentiles are histogram bucket bounds with about 3 % resolution, which is why values repeat; `max` is exact. With about 75 batches per window at 15 fps, p99 and above are close to the single worst sample; use the whole-session report for tails.
* Times are on the server's steady clock. `capture*` metrics start from the SDK's global timestamp mapped to the host clock and may carry a constant offset; differences between runs are still valid.
* Per-camera metrics have one sample per camera per batch.

### Metrics [#metrics]

| Metric                                                       | From → to                                                | Contains                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `capture->sdk`                                               | capture → SDK delivered the frame set                    | Per camera. Sensor, USB, SDK decode and frame sync.                            |
| `capture->host_rx`, `capture->depth_rx`, `capture->color_rx` | capture → host received the later frame / depth / colour | Per camera. Colour arrives after depth.                                        |
| `sdk_internal`                                               | host received → SDK delivered                            | Per camera. SDK colour conversion, frame sync, queues.                         |
| `align`                                                      | SDK delivered → aligned frame set built                  | Per camera. Colour-to-depth alignment on the CPU.                              |
| `arrival_skew`                                               | first camera aligned → last camera aligned               | 2+ cameras. How far apart the cameras arrive.                                  |
| `batch_wait`                                                 | first camera aligned → batch emitted                     | Wait for the slowest camera.                                                   |
| `upload_queue`, `upload_submit`                              | batch emitted → taken → copies enqueued                  | Upload queue, then the CPU copy into pinned memory.                            |
| `processing_queue`, `processing`                             | upload submitted → taken → done                          | GPU processing, including waiting for the upload.                              |
| `side_path`                                                  | processing done → encode enqueued                        | Hand-off to the encoder, plus picking preview buffers (no copy). Microseconds. |
| `encode_queue`                                               | encode enqueued → encoder took it                        | Encode queue.                                                                  |
| `encode_color`, `encode_bundle`                              | encoder took it → colour / depth access unit out         | Colour and depth are encoded in parallel, so the two are close.                |
| `handoff`                                                    | depth out → bundle handed to its consumer                | Bundle assembly. The consumer is the debug recorder today.                     |
| `sdk->handoff`                                               | last camera's SDK delivery → hand-off                    | **The part the server code controls.**                                         |
| `capture->handoff`                                           | latest capture timestamp → hand-off                      | End to end inside the server, including the cameras.                           |

In `per_camera` mode batch metrics are counted once per camera, `arrival_skew` is not recorded, and a later camera's `encode_bundle` and `handoff` include the cameras encoded before it.

## Session summary [#session-summary]

At shutdown the server prints totals, then the whole-session latency report:

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
```

| Field                                                            | Meaning                                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `captured`                                                       | Batches formed, at the capture rate                                                                                                    |
| `uploaded`, `processed`                                          | Batches through each stage. At capture = stream rate, equal to `captured` when nothing dropped; at capture 30 / stream 15, about half. |
| `encoded_views`, `encoded_bundles`, `encoded_AUs`, `encoded_MiB` | Camera views encoded, colour + depth pairs handed off, access units (2 per bundle), bytes                                              |
| `PIPELINE DROPS`                                                 | Final `dropped` totals                                                                                                                 |
| `CAMERA TOTALS`                                                  | Per camera: SDK frame sets and frames, raw MiB, average fps, recorder counts                                                           |
| `DEBUG RECORDING DROPS`, `ENCODED OUTPUT TOTALS`                 | Only with recording on                                                                                                                 |

With recording off, `CAMERA TOTALS` has a known formatting defect: the `camera` column shows the runtime id and runs into `runtime_id`, as above. The numbers are correct.

The last lines before `pipeline stopped cleanly` are totals (format shown with capture 30 / stream 15; the numbers are illustrative):

```text
[info] stream rate: 1029 of 2058 batches passed on (15 fps of 30 fps)
[info] frame batcher: 2058 batches, 0 stale and 0 duplicate/regressive frame sets dropped; max skew 0.57 ms, max tracked camera offset 0.22 ms
[info] frame batcher: 0 offset re-acquisitions (0 ambiguous), 0 frame-index mismatches refused, 0 frame-index re-learns, 0 timeline re-anchors
[info] camera orbbec:<serial>: dropped before batching: 0 invalid timestamp, 0 align failed, 0 backwards timestamp, 0 timestamp jump; 0 timestamp re-anchors
[info] keyframes: 0 requested, 0 forced (on-demand; periodic IDRs not counted)
```

* `stream rate` appears only when the capture rate is higher than the stream rate.
* `stale` frame sets had no partner from every camera within the tolerance; a growing count is a sync problem. `max skew` is the largest timestamp spread inside a batch; `max tracked camera offset` is the largest offset the batcher learned (see [Offset tracking](./how-it-works/capture-and-sync#offset-tracking)).
* The second `frame batcher` line and the per-camera lines count rare events; all should stay 0 in a healthy run:

| Counter                                 | Meaning                                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offset re-acquisitions`                | 8 frame sets in a row matched nothing, so a camera's tracked offset was set again from its measured error (for example after an SDK clock refit).     |
| `ambiguous`                             | The error was too large to re-acquire safely (a neighbouring frame could match). No batch forms and the server stops with `no batch for N ms`.        |
| `frame-index mismatches refused`        | Device frame counters disagree and the timestamps cannot vouch for the pairing: frames from different trigger slots. Never sent on; stops the server. |
| `frame-index re-learns`                 | The counter difference changed while the timestamps still paired correctly (a lost trigger, a wrap). Learned first after 30 identical batches.        |
| `timeline re-anchors`                   | Every camera's clock stepped back together; later capture timestamps are corrected so they keep going forward.                                        |
| `invalid timestamp`, `align failed`     | Frame sets without a valid capture timestamp, or whose alignment returned nothing.                                                                    |
| `backwards timestamp`, `timestamp jump` | Frame sets not later than the camera's previous one, or more than 15 frame intervals after it.                                                        |
| `timestamp re-anchors`                  | A camera's timestamps stepped and 3 frame sets in a row agreed, so the new timeline was accepted.                                                     |

* `keyframes` counts on-demand requests and the IDRs they forced. Nothing requests keyframes until serving exists, so both stay 0.

## What good looks like [#what-good-looks-like]

Reference baseline of 2026-09-26 (`server/docs/architecture/latency-review/baseline-2026-09-26.md`): two hardware-synced Femto Bolts, RTX 4090, `dev-relwithdebinfo`, depth 640×576 and colour 1280×720 at 15 fps capture and stream, `rgb8`, `concatenated_batch`, `fill_all`, no preview.

| Metric                                       | p50          | p99          |
| -------------------------------------------- | ------------ | ------------ |
| `capture->depth_rx`                          | 94.4 ms      | 98.6 ms      |
| `capture->color_rx`                          | 134.2 ms     | 146.8 ms     |
| `sdk_internal`                               | 8.7–10.5 ms  | 12.8–14.9 ms |
| `align`                                      | 2.5–4.1 ms   | 6.3–7.6 ms   |
| `arrival_skew` = `batch_wait`                | 2.8–4.3 ms   | 15–16 ms     |
| `upload_queue` + `upload_submit`             | 0.6–0.8 ms   | 1.7–2.0 ms   |
| `processing` (`fill_all` + bilateral filter) | 0.25–0.48 ms | 1.0–1.2 ms   |
| `encode_bundle`                              | 1.9–2.4 ms   | 3.5–4.2 ms   |
| `sdk->handoff`                               | 5.4–7.7 ms   | 11.5–12.3 ms |
| `capture->handoff`                           | 155–159 ms   | 168–172 ms   |

At capture 30 / stream 15 (the dev config; same rig, 3-minute runs) the camera side halves: `capture->color_rx` about 67 ms and `capture->handoff` 73.4 ms p50 / 83.9 ms p99, with `arrival_skew` p99 at 7.5 ms.

Also healthy: every row at its expected rate, all `dropped` counters at 0, both cameras at the same `frame_sets/s`, and no stale frame sets after start-up. Debug recording does not change these numbers. RVM adds to `processing` and was not part of the baseline.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                  | Likely cause                                                                                | What to do                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upload` `dropped` rising, high `upload_submit`                                          | CPU overload or slow pinned copies                                                          | Reduce host load; use the `dev-relwithdebinfo` build.                                                                                                                                          |
| `process` `dropped` rising, `processing` p99 near the frame interval (66.7 ms at 15 fps) | GPU processing too slow, usually RVM or a large bilateral radius                            | Check the RVM engine matches cameras and resolution; lower `processing.bilateral_maximum_radius_pixels`; try `mask.backend: fill_all`.                                                         |
| `encode` `dropped` rising, `encode_queue` growing                                        | NVENC can't keep up, or another process uses it                                             | Check `nvidia-smi --query-gpu=encoder.stats.sessionCount,utilization.encoder --format=csv`; stop other encoders; lower resolution or stream rate. A larger `queue_capacity` only adds latency. |
| `upload slots exhausted` warnings                                                        | A stage or recorder holds batches longer than the slot budget allows                        | Report it with the log; it points at a bug. The server keeps running.                                                                                                                          |
| `encode_color` or `encode_bundle` max at 30–35 ms, p99 normal                            | Isolated slow encodes, also in the baseline                                                 | Nothing, unless p99 rises.                                                                                                                                                                     |
| `capture` below the capture rate while each camera's `frame_sets/s` is correct           | Batches don't form: timestamps further apart than `sync.timestamp_tolerance_us`             | Check the sync cable and roles; run `--orbbec-live-sync-test`; power-cycle the cameras.                                                                                                        |
| One camera's `frame_sets/s` lower than the other's                                       | USB bandwidth, a bad cable, or no trigger                                                   | Move it to another USB controller; check the sync cable.                                                                                                                                       |
| `arrival_skew` / `batch_wait` p99 well above 16 ms                                       | CPU load delays a camera's capture thread (alignment runs on the CPU)                       | Reduce host load. Near one frame interval means the cameras are out of sync.                                                                                                                   |
| `sdk->handoff` p99 far above 12 ms, no single large stage; `side_path` above 1 ms        | CPU contention                                                                              | Check host load (`uptime`).                                                                                                                                                                    |
| `drops(in/out)` rising or `worker=failed`                                                | The recorder (disk, FFV1, local decode) can't keep up or failed; the pipeline is unaffected | Record fewer cameras, turn off `locally_decode_gpu_outputs`, or use a faster disk.                                                                                                             |
| Rate tables but no latency reports                                                       | The in-place display overwrote them                                                         | Set `ORBBEC_STREAMER_STATUS_MODE=log`.                                                                                                                                                         |
| No rate tables in the first seconds                                                      | Rates are hidden for 5 s after start                                                        | Wait.                                                                                                                                                                                          |
