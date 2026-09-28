# GPU processing (https://irc-hslu.github.io/orbbecstreamer/docs/server/gpu-processing)



After a multi-camera batch is formed, the server copies it to the GPU and
runs two steps on every camera's frames: a **foreground mask** (which pixels
belong to the person) and a **depth filter** (edge-preserving smoothing that
also removes the background from depth). The result goes to the encoder.
The code is in `server/src/gpu/`, `server/src/processing/` and
`server/src/segmentation/`.

Colour-to-depth alignment is not part of this stage. It happens earlier, in
the Orbbec SDK on the CPU; see
[Capture and synchronisation](./capture-and-sync#colour-to-depth-alignment).

## Upload [#upload]

The upload thread takes each batch from the upload queue and, for every
frame:

1. takes an **upload slot**: a pinned host buffer plus a GPU buffer of the
   frame's size;
2. copies the frame from the SDK's memory into the pinned buffer (CPU);
3. starts an asynchronous host-to-GPU copy on the upload CUDA stream and
   records a CUDA event that marks the copy as done.

The upload thread does not wait for the copy. A slot is reused only when no
stage holds its frame any more and its copy has finished. Slots are created
on demand up to a limit that the server computes from the queue sizes (41
with `config/dev/live.yaml`); with those sizes, at most about 45 MB of
pinned host memory and the same on the GPU. When every slot is in use, the
new batch is dropped and counted; see
[Read the telemetry](./telemetry#rate-tables).

Measured (baseline of 2026-09-26, two cameras): upload queue + submit
0.6–0.8 ms p50, 1.7–2.0 ms p99.

## The processing stage [#the-processing-stage]

The processing thread waits for the batch's upload events, runs the mask
and the depth filter on its own CUDA stream for all cameras, waits for that
stream to finish, and hands the batch to the encoder. The encoder then works
on a batch whose GPU data is complete.

For each camera the processed batch contains:

| Item            | Size and format                                       | Present when                                    |
| --------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Aligned colour  | Depth size, RGB8 (the uploaded frame, unchanged)      | Always                                          |
| Raw depth       | Depth size, 16-bit mm (the uploaded frame, unchanged) | Always                                          |
| Foreground mask | Depth size, 8-bit, 0 = background, 255 = foreground   | `mask.backend` is not `none`                    |
| Filtered depth  | Depth size, 16-bit mm, 0 = invalid                    | `processing.depth_filter_backend` is not `none` |

The encoder uses the filtered depth when there is one, otherwise the raw
depth. It encodes depth pixels whose mask value is 0 as "invalid" (code 0;
see [Stream layout](./stream-layout#encoded-bitstreams)). Colour is never
masked.

## Foreground mask backends [#foreground-mask-backends]

Set with `mask.backend` ([Configuration](./configuration#mask)):

| Backend                   | What it does                                                                                                                                                                     | Status                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `rvm`                     | Robust Video Matting (MobileNetV3) on TensorRT, FP16. One inference for all cameras of a batch. Outputs a soft alpha matte (0–255). Keeps a recurrent state from frame to frame. | The working segmenter. Needs a TensorRT engine ([Install](./install#rvm-segmentation-engine-optional)).          |
| `fill_all`                | Every pixel is foreground (255).                                                                                                                                                 | Test backend; use it to run without segmentation.                                                                |
| `rgb_luma_threshold`      | Foreground where the colour's luma is above 128 (fixed).                                                                                                                         | Test backend.                                                                                                    |
| `none`                    | No mask is produced.                                                                                                                                                             | Works only with `depth_filter_backend: identity_copy` or `none`; see [Limits](#limits).                          |
| `sam3`                    | Placeholder: every pixel is foreground, like `fill_all`.                                                                                                                         | Not a segmenter. It is the code default, so set `backend` explicitly.                                            |
| `tensorrt`, `onnxruntime` | -                                                                                                                                                                                | Accepted by the config, then fail at the first batch with `Selected foreground mask backend is not implemented`. |

`mask.prompt_type`, `mask.text_prompt` and `mask.bbox_xywh` are passed to
the segmenter, but no current backend uses them.

### The RVM engine [#the-rvm-engine]

The engine is built by `scripts/setup_rvm.py` for a fixed batch size,
image size and downsample ratio, all in its file name, for example
`rvm_mobilenetv3_b2_640x576_ds0.5_float16.engine`: batch 2, 640 × 576,
ratio 0.5. At start-up the server checks the engine's tensors against:

* the number of **active** cameras (the batch size),
* the depth size (colour is aligned to it),
* `mask.rvm_downsample_ratio`.

A mismatch stops the server before the pipeline starts, after the cameras
are opened. If a configured camera is missing, the active count drops and
the batch-2 engine no longer fits.

RVM's recurrent state carries over from one batch to the next. It is not
reset when batches are dropped, so the matte can take a few frames to
settle after a stall.

## Bilateral depth filter [#bilateral-depth-filter]

`processing.depth_filter_backend: bilateral_cuda` (the default) runs a
colour-guided bilateral filter on each camera's depth
([Configuration](./configuration#processing)). For each depth pixel:

* If its mask value is below 128, the output is 0 (invalid). This is where
  the background is removed. The threshold is fixed;
  `processing.bilateral_mask_threshold` does not change it.
* Otherwise the output is a weighted mean of the non-zero depth values in a
  square window around it, using only foreground neighbours. The weight
  falls off with pixel distance (spatial sigma) and with the RGB colour
  difference to the centre pixel (colour sigma), so depth edges that follow
  colour edges stay sharp.
* A foreground pixel with no depth gets a value from its neighbours when any
  of them has one, so small holes are filled. With no valid neighbour it
  stays 0.

| Key                               | Default | Effect                                                                                           |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `bilateral_radius_ratio`          | 2/576   | Window radius = ratio × the smaller image side, rounded. 2 pixels (a 5 × 5 window) at 640 × 576. |
| `bilateral_spatial_sigma_ratio`   | 2/576   | Spatial sigma = ratio × the smaller image side. 2 pixels at 640 × 576.                           |
| `bilateral_color_sigma`           | 60      | Colour sigma in RGB units (0–255). `0` turns the colour term off (pure spatial filter).          |
| `bilateral_maximum_radius_pixels` | 16      | Upper limit for the resolved radius. A larger radius is an error, not clamped.                   |

The other depth filter backends are `identity_copy` (copies depth
unchanged) and `none` (no filtered depth; the encoder uses raw depth). With
either one, the background is removed only where the mask is exactly 0: a
soft RVM matte keeps depth for every pixel above 0.

## Measured cost [#measured-cost]

From the baseline of 2026-09-26
(`server/docs/architecture/latency-review/baseline-2026-09-26.md`: two
Femto Bolts, 640 × 576 at 15 fps, RTX 4090, `dev-relwithdebinfo` build):

| Stage                                                        | p50          | p99        |
| ------------------------------------------------------------ | ------------ | ---------- |
| Upload (queue + staging + copy enqueued)                     | 0.6–0.8 ms   | 1.7–2.0 ms |
| Processing, `fill_all` mask + bilateral filter, both cameras | 0.25–0.48 ms | 1.0–1.2 ms |

RVM was not part of the baseline (no engine on the measuring host), so its
cost is not measured yet. It adds to `processing` in the
[latency report](./telemetry#latency-report); at 15 fps the stage has
66.7 ms per batch before it starts to drop.

## Limits [#limits]

* **`mask.backend: none`** produces no mask; `bilateral_cuda` then treats
  every pixel as foreground, which gives the same depth as `fill_all` when
  colour is aligned to depth (`streams.alignment: color_to_depth`).
* **Colour must be `rgb8`** for `rvm`, `rgb_luma_threshold` and
  `bilateral_cuda`. With another colour format the simple masks are skipped
  and RVM and the bilateral filter stop the server.
* **The radius limit is checked at the first batch**, not when the config is
  loaded: `Resolved bilateral radius exceeds maximum_radius_pixels`.
* **The RVM engine is fixed** in batch size, image size and downsample
  ratio. Changing the number of cameras or the depth profile needs another
  engine.
* **Output buffers are pooled.** Masks and filtered depths come from a pool
  sized for everything in flight, so a running pipeline makes no GPU
  allocations or frees (a `cudaFree` waits for all GPU work: 50 ms during a
  50 ms kernel, against 0 µs for returning a buffer to the pool). The pool
  grows during the first batches and then stays constant.
* **One GPU.** Upload, processing and RVM use the default CUDA device;
  `encoding.gpu_ordinal` selects the device only for NVENC. Keep it at `0`
  on a multi-GPU machine unless you have checked the setup.

## Troubleshooting [#troubleshooting]

| Message or symptom                                                                                                                                                             | Fix                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `orbbec-streamer failed: Resolved bilateral radius exceeds maximum_radius_pixels`                                                                                              | Lower `bilateral_radius_ratio` or raise `bilateral_maximum_radius_pixels`.                                                |
| `orbbec-streamer failed: Unexpected static TensorRT shape for ...`                                                                                                             | The engine does not match the active cameras or the depth size. Build the matching engine and set `mask.rvm_engine_path`. |
| `RVM requires exactly one usable RGB8 color frame per synchronized camera`, `Bilateral RGB input pointer is null` or `NVENC frame set is missing RGB8 color or DepthU16 input` | Set `streams.color.format: rgb8`.                                                                                         |
| `Selected foreground mask backend is not implemented`                                                                                                                          | `tensorrt` or `onnxruntime`. Use `rvm` or `fill_all`.                                                                     |
| `process` drops rising in the telemetry                                                                                                                                        | See [Read the telemetry](./telemetry#troubleshooting).                                                                    |

## Related pages [#related-pages]

* [How the server works](./architecture)
* [Capture and synchronisation](./capture-and-sync)
* [Configuration: `mask` and `processing`](./configuration#mask)
* [Encoding](./encoding)
* [Stream layout](./stream-layout)
* [Latency](./latency)
* [Depth quantization calibrator](./depth-quantization-calibrator)
