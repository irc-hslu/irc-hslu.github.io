# Latency (https://irc-hslu.github.io/orbbecstreamer/docs/server/how-it-works/latency)



The server treats latency as part of correctness: it must not add avoidable
delay on top of an uncertain network. This page explains where the time goes
today, which targets apply, and what is still planned. "p50" is the median
and "p99" the value that 99 % of frames stay below. All figures are from
the measured baseline of 2026-09-26
(`server/docs/architecture/latency-review/baseline-2026-09-26.md`) unless
marked as a target. The plan behind them is
`server/docs/architecture/latency-review-2026-09-26.md`.

Baseline conditions: two hardware-synced Femto Bolts, RTX 4090,
`dev-relwithdebinfo` build, depth 640 × 576 and colour 1280 × 720 at 15 fps,
colour requested as `rgb8`, `concatenated_batch`, `mask.backend: fill_all`
(no RVM), no preview.

## Where the time goes [#where-the-time-goes]

```text
capture ─ 94 ms ─► depth at host ─ 40 ms ─► colour at host ─ ~10 ms ─► SDK delivers ─ 6–8 ms ─► hand-off
          └──────────────── camera, USB, SDK: ≈ 140–150 ms ──────────────────┘     └ server code ┘
```

| Part                                                         | p50            | p99              | Who controls it                                     |
| ------------------------------------------------------------ | -------------- | ---------------- | --------------------------------------------------- |
| Capture → depth received by host                             | 94 ms          | 99 ms            | Camera, USB                                         |
| Capture → colour received by host                            | 134 ms         | 147 ms           | Camera, USB; colour arrives about 40 ms after depth |
| Host received → SDK delivers (`rgb8` conversion, frame sync) | 9–11 ms        | 13–15 ms         | Orbbec SDK                                          |
| **SDK delivers → bundle handed off** (`sdk->handoff`)        | **5.4–7.7 ms** | **11.5–12.3 ms** | Server code                                         |
| **Capture → hand-off** (`capture->handoff`)                  | **155–159 ms** | **168–172 ms**   | End to end inside the server host                   |

Inside the server's part:

| Stage                                            | p50          | p99        |
| ------------------------------------------------ | ------------ | ---------- |
| Colour-to-depth alignment (CPU)                  | 2.5–4.1 ms   | 6.3–7.6 ms |
| Waiting for the slower camera (`batch_wait`)     | 2.8–4.3 ms   | 15–16 ms   |
| Upload to the GPU                                | 0.6–0.8 ms   | 1.7–2.0 ms |
| GPU processing (mask + bilateral filter, no RVM) | 0.25–0.48 ms | 1.0–1.2 ms |
| NVENC, colour and depth out                      | 1.9–2.4 ms   | 3.5–4.2 ms |

How to read this: about 140 ms of the 155 ms happen before the SDK hands
the frames to the server. The server code adds about 6–8 ms typically and about 12 ms at
p99. Capture timestamps come from the camera clock mapped to the host clock,
so absolute capture-relative numbers may carry a constant offset;
differences and everything after the SDK are exact.

Not in the baseline: RVM segmentation (adds to GPU processing), the preview
window, and the network (serving is not implemented yet; see
[Serve to browsers](../serving)).

## Targets [#targets]

Proposed p99 budgets from the latency review. They are targets, not
guarantees.

| Segment                                         | Target                                 | Status                                                   |
| ----------------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| SDK delivers → access unit handed off           | ≤ 12 ms p99 (≤ 8 ms p50), RVM included | Met at 11.5–12.3 ms without RVM; RVM not yet measured    |
| Access unit ready → bytes handed to QUIC        | ≤ 0.5 ms p99 (≤ 0.2 ms p50)            | Needs serving; the WebTransport spike measured \< 0.5 ms |
| Drop or join → first aligned keyframe delivered | ≤ 2 frame intervals                    | Encoder side ready (on-demand keyframes); needs serving  |
| Sensor → SDK delivery                           | Measure first, then set                | Camera-side; see the frame-rate lever below              |

## What the server does to avoid adding latency [#what-the-server-does-to-avoid-adding-latency]

* **Short latest-wins queues.** The upload, processing and encode queues hold
  2 batches each (encode: `encoding.queue_capacity`, default 2). A full queue
  drops its oldest batch, so after a stall the pipeline continues with the
  newest frames instead of working through a backlog. In a test with the
  encoder slowed to twice the frame period, batch → hand-off stayed at
  46 ms p50 / 67 ms p90, against 248 / 267 ms with the earlier deep queues.
* **Bounded GPU memory.** The number of upload slots is computed from
  everything that can hold a batch. If they still run out, the batch is
  dropped and counted; the server never stops for it.
* **Side paths on their own threads.** The preview window runs on its own
  thread and only takes a frame when it is idle; a 150 ms preview left the
  processing → encode hand-off at 8 µs p50. Debug recorders never block;
  they drop and count instead.
* **Rate-limited logging.** Drop warnings are logged at most once per second
  per stage, with the number suppressed; the counters stay exact.
* **Low-delay encoding.** No B-frames, no look-ahead, zero reorder delay, a
  one-frame VBV; see [Encoding](./encoding#low-delay-settings).
* **On-demand keyframes.** The encoder can force an aligned keyframe for one
  bundle (at most every 250 ms), so a client that joins or loses data does
  not wait for the next periodic IDR (up to 4 s at the default GOP). The
  network caller comes with serving.

A slow consumer never blocks capture, GPU processing or NVENC.

## The biggest lever: frame rate [#the-biggest-lever-frame-rate]

The dev config captures at 15 fps. Measured on the cameras alone, 30 fps cuts
the camera-side latency by about 65 ms (colour arrival 133 → 68 ms with raw
MJPG, 141 → 77 ms with YUYV; depth 93–96 → 60–64 ms). That is about ten times
the whole server pipeline, and it also halves the cost of any one-frame wait
(67 ms → 33 ms).

Switching to 30 fps is a pending product decision. It needs:

* a check that RVM and NVENC fit in 33 ms per frame,
* a new check of the sync settings, including the depth delays that keep
  the cameras' infrared light from interfering,
* a review of the bitrate and GOP length.

The wire contract does not need to change: the frame rate is already in the
stream descriptor. The rate is set with
`streams.depth.fps` and `streams.color.fps` (see
[Configuration](../configuration#streams)).

## Measure it yourself [#measure-it-yourself]

Use the optimised build and log mode, so the latency reports are not
overwritten:

```bash
cd server
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-relwithdebinfo/orbbec_streamer --live config/dev/live.yaml 2>&1 | tee live.log
```

The server prints stage-by-stage percentiles every 5 s and for the whole
session at shutdown. Compare `sdk->handoff` (the server's own part) and
`capture->handoff` (end to end on the server host) against the tables above.
Every metric is explained in
[Read the telemetry](../telemetry#latency-report), with reference values in
[What good looks like](../telemetry#what-good-looks-like).

Keep a quiet machine: CPU contention shows up as a higher `sdk->handoff` p99
and `batch_wait`, because alignment runs on the CPU per camera.

## Done and planned [#done-and-planned]

Done:

* Stage timing in the telemetry, and a hardware baseline.
* On-demand aligned keyframes in the encoder. The network caller comes with
  serving.
* Preview, debug recording and drop logging moved off the hot threads.
* Latest-wins queues of 2, and running out of upload slots handled as a
  counted drop.
* Pooled GPU output buffers: no `cudaMalloc` or `cudaFree` while running.
* NVENC inputs registered once, and colour and depth submitted before
  either is collected. Both access units come out in 0.73 ms p50 and 1.0 ms
  p99 in an isolated test, down from 3.5 ms and 7.1 ms.

Planned:

| What                                                                                    | Status                                                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Capture at 30 fps                                                                       | Pending product decision; see [the frame-rate lever](#the-biggest-lever-frame-rate) |
| Smaller Orbbec SDK frame queues                                                         | Pending; needs cameras to measure                                                   |
| Event-based hand-off between stages, RVM writing masks directly, CUDA stream priorities | Pending                                                                             |
| Publishing each access unit on its own, as soon as it is ready                          | Comes with serving                                                                  |
| Serving: a per-client backlog bounded by age, then drop and send a keyframe             | Comes with serving                                                                  |
| Colour path off the CPU (raw colour format, GPU conversion and alignment)               | Pending; worth 8–10 ms plus the CPU alignment                                       |
| Delay-based rate control (lower the bitrate when the network queues up)                 | Pending                                                                             |
| OS and deployment tuning (thread pinning, CPU governor, priorities)                     | Pending                                                                             |

The full plan is in `server/docs/development/ROADMAP.md` (Performance).

## Related pages [#related-pages]

* [Read the telemetry](../telemetry): the latency report and healthy values
* [Encoding](./encoding): encoder settings and keyframes
* [Stream layout](../stream-layout): per-camera vs concatenated
* [Serve to browsers](../serving): the network part, not yet available
