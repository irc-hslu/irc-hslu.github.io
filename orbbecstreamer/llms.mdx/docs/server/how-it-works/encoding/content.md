# Encoding (https://irc-hslu.github.io/orbbecstreamer/docs/server/how-it-works/encoding)



The server encodes every synchronised frame set on the GPU with NVENC, the
hardware video encoder on NVIDIA GPUs. Colour and depth are two independent
HEVC (H.265) video streams that together form one logical **bundle**.
Encoding is on when `encoding.enabled: true`. The encoded bundles go to the
debug recorder today, and to browsers once serving exists (see
[Serve to browsers](../serving)).

Terms used on this page:

* **Access unit**: one encoded frame of one stream.
* **IDR**: a keyframe that a decoder can start from, without any earlier
  frame.
* **GOP**: the group of frames from one IDR to the next.
* **Parameter sets** (VPS, SPS, PPS): small headers that describe the
  stream; a decoder needs them before the first frame.

## How it works [#how-it-works]

One encoder thread takes processed batches from a short queue. For each
bundle it converts and submits colour, converts and submits depth, and then
collects both access units. So the colour and depth NVENC sessions encode at
the same time (the RTX 4090 has two NVENC engines). Each input surface is
registered with NVENC once, not every frame:

```text
processed batch ──► encode queue (2, latest wins) ──► encoder thread
                                                        │
      colour RGB8 ──► NV12 BT.709 limited ──► NVENC HEVC Main   ──┐
      depth mm ─────► 10-bit LUT codes, P010 ──► NVENC HEVC Main10 ├──► bundle ──► hand-off
                      (masked pixels = code 0)                     ┘
```

| Channel | Input                                                                                                                           | HEVC profile          | Signal                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------- |
| Colour  | RGB8 after colour-to-depth alignment, converted on the GPU to NV12                                                              | Main (8-bit 4:2:0)    | BT.709, limited range, signalled in the VUI |
| Depth   | Filtered depth in mm, converted on the GPU to one 10-bit code per pixel through the depth quantization LUT, stored in P010 luma | Main10 (10-bit 4:2:0) | Full range, no colour description           |

Both channels have the same size: one depth image per camera (640 × 576 with
the dev config), or all cameras side by side in `concatenated_batch` mode. The
code values, the reconstruction LUT and the tile layout are described in
[Stream layout](../stream-layout#encoded-bitstreams); how the LUT is fitted is
in [Depth quantization calibrator](../depth-quantization-calibrator). The
normative bitstream definition is the wire contract,
`protocol/wire-format.md`.

## Low-delay settings [#low-delay-settings]

Every session uses the same settings, set in `src/video/NvencHevcEncoder.cpp`.
None of them is configurable.

| Setting           | Value                                                         | Effect                                                                                    |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Preset / tuning   | P1, ultra-low latency                                         | Fastest preset                                                                            |
| Frame types       | I and P only (`frameIntervalP = 1`)                           | No B-frames, no reordering                                                                |
| Look-ahead        | Off                                                           | The encoder never waits for later frames                                                  |
| Reorder delay     | Zero (`zeroReorderDelay`)                                     | Each input frame produces its access unit at once                                         |
| Rate control      | Constant bitrate (CBR), single pass, no adaptive quantization | Predictable size per frame                                                                |
| Rate buffer (VBV) | One frame of bits (bitrate ÷ fps)                             | Access units stay close to the per-frame budget, so no frame bursts far above the average |
| Mode              | Synchronous: submit, then wait for the bitstream              | One access unit out per frame in                                                          |
| Parameter sets    | VPS/SPS/PPS repeated in-band on every IDR                     | A decoder can start at any keyframe                                                       |

## Bitrate and rate control [#bitrate-and-rate-control]

Bitrates are set per camera in the config:

| Key                          | Default    | Applies to         |
| ---------------------------- | ---------- | ------------------ |
| `encoding.color.bitrate_bps` | 12 000 000 | Colour, per camera |
| `encoding.depth.bitrate_bps` | 8 000 000  | Depth, per camera  |

In `per_camera` mode each camera's encoders run at these rates. In
`concatenated_batch` mode the single colour and depth encoders run at the
rate times the number of cameras (two cameras: 24 and 16 Mbit/s). With the
defaults at 15 fps a colour access unit is about 100 kB per camera and a depth
access unit about 67 kB.

The bitrate is fixed for the whole run. It also sets the HEVC level in the
codec string (see [Stream layout](../stream-layout#trade-offs)). Adapting the
bitrate to a client's network is planned with serving and does not exist
yet.

## GOP and keyframes [#gop-and-keyframes]

**Periodic keyframes.** Every stream starts with an IDR and repeats one every
`encoding.gop_length` frames (default 60, which is 4 s at 15 fps). `0` means
an infinite GOP: only the first frame and on-demand keyframes are IDR.

**Aligned per bundle.** Colour and depth of one bundle are always keyframes
on the same frame set: they share the GOP length and start together, and a
forced keyframe is applied to both. The wire contract requires this. In
`concatenated_batch` the bundle is the whole rig (`multicam`); in
`per_camera` each camera is its own bundle with its own keyframe cadence.

**On-demand keyframes.** The encoder can force an aligned keyframe (IDR on
colour and depth, with parameter sets) on the next frame set of one bundle,
or of every bundle. This is what a client needs after it joins, after the
server drops data for it, or after a revision change restarts the media
streams. Without it the client waits up to a whole GOP.

* Requests are thread-safe and never block the encoder.
* Forced keyframes of one bundle are at least 250 ms apart (fixed).
* Requests that arrive in between are merged into one keyframe.
* A request that arrives too early is deferred to the first frame set after
  the 250 ms, never dropped.
* A periodic IDR serves pending requests, but does not delay the next forced
  one.

Status: the encoder side (`NvencEncodeStage::request_keyframe`) is
implemented and tested. Nothing calls it yet; the network layer will call it
on join, drop and stream restart once serving exists. A message that lets a
client ask for a keyframe is proposed for the wire contract but not yet
accepted.

## Encoder sessions [#encoder-sessions]

| Layout               | NVENC sessions            |
| -------------------- | ------------------------- |
| `concatenated_batch` | 2 (one colour, one depth) |
| `per_camera`         | 2 per camera              |

Consumer GeForce drivers cap the number of concurrent NVENC sessions per
system, and other encoders (another server instance, OBS, ffmpeg) count
against it. With many cameras in `per_camera` mode the server can fail to
open a session; `concatenated_batch` needs only two. Check the current count
with `nvidia-smi --query-gpu=encoder.stats.sessionCount --format=csv`.

In `per_camera` mode the cameras are encoded one after another on the same
thread, and the bundles of a batch are handed off together after the last
camera.

## What you can configure [#what-you-can-configure]

All keys are in the `encoding` section; see
[Configuration](../configuration#encoding) for types and validation.

| Key                                                                                   | Default                                             | What it changes                                                     |
| ------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `enabled`                                                                             | `false`                                             | Turns encoding on                                                   |
| `session_mode`                                                                        | `per_camera`                                        | Stream layout; see [Stream layout](../stream-layout)                |
| `gpu_ordinal`                                                                         | `0`                                                 | CUDA device used by NVENC                                           |
| `queue_capacity`                                                                      | `2`                                                 | Encode queue length in batches; a full queue drops its oldest batch |
| `gop_length`                                                                          | `60`                                                | IDR period in frames; `0` = infinite                                |
| `color.bitrate_bps`                                                                   | `12000000`                                          | Colour bitrate per camera                                           |
| `depth.bitrate_bps`                                                                   | `8000000`                                           | Depth bitrate per camera                                            |
| `depth.minimum_depth_mm`, `depth.maximum_depth_mm`, `depth.quantization_profile_path` | `500`, `5000`, `config/dev/depth-quantization.json` | Depth code range and LUT                                            |

The encoder frame rate is `streams.depth.fps`; colour and depth fps must be
equal. Enlarging `queue_capacity` does not make encoding faster; it only adds
latency after a stall.

## Measured timing [#measured-timing]

From the 2026-09-26 baseline (two Femto Bolts, RTX 4090,
`dev-relwithdebinfo`, 15 fps, `concatenated_batch`, 1280 × 576 surfaces):

| Metric                                                    | p50        | p99        |
| --------------------------------------------------------- | ---------- | ---------- |
| Time in the encode queue (`encode_queue`), one 5 s window | 0.2 ms     | 0.6 ms     |
| Colour access unit out (`encode_color`), one 5 s window   | 1.4 ms     | 2.1 ms     |
| Colour and depth both out (`encode_bundle`), across runs  | 1.9–2.4 ms | 3.5–4.2 ms |

Isolated encodes of 30–35 ms appear in the maximum without raising the p99.
The `LIVE PIPELINE` `encode` row and the `encode_*` latency lines show these
numbers on your machine; see [Read the telemetry](../telemetry#latency-report).
These numbers are from before two encoder changes: input surfaces are now
registered with NVENC once, and colour and depth are encoded in parallel.
Isolated tests at the same 1280 × 576 size with noise input, the worst case
for the encoder:

| Colour + depth access units out                                | p50          | p99        |
| -------------------------------------------------------------- | ------------ | ---------- |
| Before (registered every frame, colour then depth)             | 3.5 ms       | 7.1 ms     |
| Registered once, colour then depth                             | 1.4–1.6 ms   | 1.8–1.9 ms |
| Registered once, both submitted, then both collected (current) | 0.72–0.85 ms | 0.9–1.0 ms |

Since the parallel change, `encode_color` also covers converting and
submitting depth, so it is close to `encode_bundle`. A new hardware baseline will replace the
first table.

## Limits and guarantees [#limits-and-guarantees]

* Every encoded frame set yields exactly two access units, colour and depth,
  with the same frame-set number and capture timestamp.
* Keyframes of a bundle's colour and depth are always aligned.
* Every IDR carries VPS/SPS/PPS.
* The encoder never holds more than `queue_capacity` batches waiting; when it
  falls behind, the oldest waiting batch is dropped and counted in the
  `encode` `dropped` column.
* Frame dimensions must be even (NV12/P010).
* The bitrate, GOP, layout and resolution are fixed until restart.

## Related pages [#related-pages]

* [Stream layout](../stream-layout): layouts, tiling, HEVC levels, bitstream details
* [Depth quantization calibrator](../depth-quantization-calibrator): the 10-bit depth LUT
* [Latency](./latency): where encoding sits in the latency budget
* [Read the telemetry](../telemetry): encode rates, drops and timings
