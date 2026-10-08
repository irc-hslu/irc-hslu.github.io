# Configuration (https://irc-hslu.github.io/orbbecstreamer/docs/server/configuration)



The live pipeline reads one YAML file: cameras, capture profile, sync, GPU processing, encoding, calibration and debug recording. The development config is `server/config/dev/live.yaml`; the parser is `server/src/config/LiveConfig.cpp`, and this page follows it.

## Files and paths [#files-and-paths]

```text
server/config/dev/
  live.yaml                   development config (two synced cameras); checked in
  depth-quantization.json     written by the depth calibrator; optional
  camera-pose.json            written by camera-pose calibration; optional
  placement.json              written by a client placement commit; optional
```

When the JSON files are missing the server still starts: it uses a linear depth mapping and reports that camera-pose calibration is needed. Git ignores these files and the folder `config/local/`.

Every relative path (`rvm_onnx_path`, `rvm_engine_cache_dir`, `rvm_engine_path`, `quantization_profile_path`, `camera_pose_path`, `placement_path`, `debug_recording.directory`, `serving.dev_certificate_hash_path`) resolves against the working directory, so run the server from `server/`. The exception is `serving.gateway_executable`, which resolves against the config file's directory.

## Point the server at a config [#point-the-server-at-a-config]

| Command                       | Config option                                                     | Default                |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------- |
| Live pipeline                 | `--live <file>`                                                   | required               |
| Local camera-pose calibration | `--live <file> --calibrate-camera-pose`                           | required               |
| Print the ChArUco board       | `--print-charuco-board <png> [--live <file>]`                     | built-in board         |
| Synchronised-capture test     | `--orbbec-live-sync-test [--config <file>]`                       | `config/dev/live.yaml` |
| Depth quantization calibrator | `orbbec_streamer_depth_quantization_calibrator [--config <file>]` | `config/dev/live.yaml` |

`--config` of `orbbec_streamer` is read only by `--orbbec-live-sync-test`. `config/dev/live.yaml` describes the development rig (its serials, hardware sync, the RVM mask and full debug recording), so copy and adapt it first; see [Adapt the config to your rig](./running#adapt-the-config-to-your-rig).

## Check a config without cameras [#check-a-config-without-cameras]

The loader rejects unknown keys, bad values and inconsistent combinations before any camera opens. Two checks, both from `server/`:

**Parse and validate.** Printing the board loads the config through the same loader and opens no camera:

```bash
./build/dev-debug/orbbec_streamer --print-charuco-board /tmp/board.png --live config/dev/live.yaml
```

Expected: exit code 0 and `[info] wrote ChArUco board /tmp/board.png: 7x5 squares of 80.0 mm ...`. This check skips `mask.backend` and `processing.depth_filter_backend`, which are validated when the live pipeline starts.

**Full start-up check.** Make every serial unmatchable, so the server validates everything, logs the effective settings and stops:

```bash
sed -e 's/serial_number: "/serial_number: "NO-SUCH-/' \
    -e 's/camera_wait_timeout_ms: .*/camera_wait_timeout_ms: 1000/' \
    -e 's/preview: true/preview: false/' \
    config/dev/live.yaml > /tmp/live-check.yaml
./build/dev-debug/orbbec_streamer --live /tmp/live-check.yaml
```

Expected: the `live config`, `live streams`, `live mask`, `live processing` and `live encoding` lines, then `[error] orbbec-streamer failed: No configured cameras are active; live mode cannot continue`. Any other `orbbec-streamer failed:` message is a config error; see [Troubleshooting](#troubleshooting). This works only when every camera has a `serial_number` (a camera without one matches any device), and it stops before the RVM engine file is opened.

## File format [#file-format]

The loader is a line parser, not full YAML:

* A line is `key: value`, a section header `key:` or a list item `- ...`. Indentation is ignored; a key belongs to the last section header above it.
* Unknown sections and keys are errors.
* `#` starts a comment, except inside double quotes. Strings may be bare or quoted with `"` or `'`.
* Booleans: `true`, `false`, `yes`, `no`, `1`, `0`.
* Integers are unsigned 32-bit; a sign or trailing text is an error. Floats must be finite.
* List items are allowed only under `cameras`, `debug_recording.camera_ids` and `serving.allowed_origins`. The only inline array is `mask.bbox_xywh`.
* Omitted keys take the code defaults below, which sometimes differ from `config/dev/live.yaml`.

## Minimal example [#minimal-example]

One camera, no segmentation model, encoding on, no preview window:

```yaml
run:
  preview: false

cameras:
  - id: "cam0"
    role: "primary"

streams:
  alignment: "color_to_depth"
  depth:
    width: 640
    height: 576
    fps: 30
    format: "depth_u16"
  color:
    width: 1280
    height: 720
    fps: 30
    format: "rgb8"

mask:
  backend: "fill_all"

encoding:
  enabled: true
  session_mode: "per_camera"
  stream_fps: 15
```

Without `serial_number` the server takes the first Orbbec camera it finds. This file passes both checks above (add a `serial_number` for the start-up check).

## Key reference [#key-reference]

### `run` [#run]

| Key                      | Type    | Default | Description                                                                                                                                                 |
| ------------------------ | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_wait_timeout_ms` | integer | `5000`  | How long start-up waits for the configured cameras. Afterwards the server continues with the cameras it found.                                              |
| `preview`                | bool    | `true`  | Local OpenCV preview window on its own thread; it never blocks the pipeline. Turned off with a warning when neither `DISPLAY` nor `WAYLAND_DISPLAY` is set. |

### `setup` [#setup]

Used by the depth quantization calibrator only.

| Key                          | Type    | Default | Description                                                                                                                                                      |
| ---------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maximum_duration_seconds`   | integer | `60`    | Calibration run time including warm-up, 1 to 60.                                                                                                                 |
| `warmup_seconds`             | integer | `5`     | Discarded start of the run. Smaller than `maximum_duration_seconds`.                                                                                             |
| `max_lease_lifetime_seconds` | integer | `1800`  | Longest a setup lease lasts after it is acquired, heartbeats or not; then it ends and the holder waits 15 s before acquiring again. Above 15 (the lease expiry). |

### `cameras` [#cameras]

A list with at least one camera:

```yaml
cameras:
  - id: "cam0"
    serial_number: "CL8K0000000A"
    role: "primary"
```

| Key             | Type                   | Default     | Description                                                                                                                                     |
| --------------- | ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string                 | none        | Your name for the camera, used in logs, recordings, `setup.json` and as the client-facing camera id. Non-empty and unique.                      |
| `vendor`        | string                 | `orbbec`    | Only `orbbec` is supported.                                                                                                                     |
| `serial_number` | string                 | empty       | Selects the device. Empty takes the next unused device. Unique when set.                                                                        |
| `required`      | bool                   | `true`      | The live server only logs it; a missing camera never stops start-up. The depth calibrator enforces it (`Required camera is unavailable: <id>`). |
| `role`          | `primary`, `secondary` | `secondary` | Hardware-sync role.                                                                                                                             |

Cameras missing after `camera_wait_timeout_ms` are logged as `neglecting missing camera` and left out. Start-up fails only when no camera is found.

### `sync` [#sync]

Hardware synchronisation over the trigger cable. Details in [Capture and synchronisation](./how-it-works/capture-and-sync#hardware-sync-and-delays).

| Key                                     | Type         | Default | Description                                                                                                                                |
| --------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`                               | bool         | `false` | Hardware sync. Requires exactly one `role: primary`; without sync at most one camera may be primary.                                       |
| `secondary_depth_delay_step_us`         | integer (µs) | `150`   | Depth exposure delay step: the *n*th secondary gets *n* steps.                                                                             |
| `color_delay_us`                        | integer (µs) | `0`     | Colour trigger delay, every camera.                                                                                                        |
| `trigger_to_image_delay_us`             | integer (µs) | `0`     | Trigger-to-image delay, every camera.                                                                                                      |
| `trigger_out_enable`                    | bool         | `true`  | Trigger output.                                                                                                                            |
| `trigger_out_delay_us`                  | integer (µs) | `0`     | Trigger output delay.                                                                                                                      |
| `frames_per_trigger`                    | integer      | `1`     | Greater than 0.                                                                                                                            |
| `timestamp_tolerance_us`                | integer (µs) | `5000`  | Largest timestamp difference for frame sets to form one batch. Greater than 0 and less than half the frame interval (16 666 µs at 30 fps). |
| `maximum_pending_frame_sets_per_camera` | integer      | `4`     | Frame sets waiting for a partner, per camera. Greater than 0.                                                                              |

Every delay, and the largest secondary's total depth delay, must fit the SDK's signed 32-bit microseconds.

### `streams` [#streams]

The capture profile, the same for every camera.

| Key                           | Type                                                          | Default          | Description                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alignment`                   | `color_to_depth`, `depth_to_color`, `disabled` (alias `none`) | `color_to_depth` | SDK alignment. Client-facing setup, RVM and camera-pose calibration need `color_to_depth`; the `bilateral_cuda` filter and `encoding.enabled` reject `disabled`. |
| `depth.width`, `depth.height` | integer                                                       | none             | Depth resolution, non-zero.                                                                                                                                      |
| `depth.format`                | `depth_u16` (alias `y16`)                                     | none             | Depth pixel format.                                                                                                                                              |
| `color.width`, `color.height` | integer                                                       | none             | Colour resolution, non-zero.                                                                                                                                     |
| `color.format`                | `rgb8`, `bgr8`, `gray8` (alias `y8`)                          | none             | Colour pixel format. Encoding, RVM and the bilateral filter need `rgb8`.                                                                                         |
| `depth.fps`, `color.fps`      | `15` or `30`                                                  | none             | The **capture rate**. Colour and depth must be equal.                                                                                                            |

With `color_to_depth`, colour is resampled into the depth image, so every encoded tile has the depth size (640 × 576 in the dev config).

#### Capture rate and stream rate [#capture-rate-and-stream-rate]

The cameras' own delay grows with their frame interval: colour reaches the host about 134 ms after capture at 15 fps and about 67 ms at 30 fps. So the server can capture faster than it streams:

* `streams.*.fps` is the capture rate; `encoding.stream_fps` is the stream rate. Both are `15` or `30`, and the stream rate cannot exceed the capture rate.
* With capture 30 and stream 15, the server keeps every second batch right after batching, before any GPU work. It counts capture slots, so a slot a camera skipped is filled by the next batch and the stream keeps its frame count.
* Measured on two Femto Bolts, capture 30 / stream 15 against 15 / 15: capture-to-hand-off 146.8 → 73.4 ms at p50, at the same stream rate and bitrate.
* Capturing at 30 doubles the USB traffic and the SDK's colour conversion on the CPU.
* The dev config captures at 30 and streams at 15.

### `mask` [#mask]

Foreground segmentation. Depth outside the mask is encoded as invalid.

| Key                    | Type                                  | Default                                                                    | Description                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`              | see below                             | `sam3`                                                                     | Mask generator. Set it explicitly.                                                                                                                                                                                                       |
| `prompt_type`          | `text`, `bbox` (alias `bounding_box`) | `text`                                                                     | Parsed; no current backend uses it.                                                                                                                                                                                                      |
| `text_prompt`          | string                                | `person`                                                                   | Non-empty when `prompt_type: text`.                                                                                                                                                                                                      |
| `bbox_xywh`            | `[x, y, w, h]`                        | `[0, 0, 0, 0]`                                                             | Exactly four integers. Unused.                                                                                                                                                                                                           |
| `rvm_onnx_path`        | path                                  | `models/rvm/generated/rvm_mobilenetv3_b{batch}_640x576_ds0.5_float16.onnx` | Fixed-shape FP16 ONNX model for `rvm`. `{batch}` becomes the number of active cameras; it is the only placeholder. The server builds the TensorRT engine from this file on first use.                                                    |
| `rvm_engine_cache_dir` | path                                  | `/var/lib/orbbec-streamer/engines`                                         | Where built engines are kept. The server's user must be able to write it; it is created if missing. `config/dev/live.yaml` uses `models/rvm/engines`.                                                                                    |
| `rvm_engine_path`      | path                                  | empty                                                                      | Development override: a prebuilt engine, loaded as is. When set, `rvm_onnx_path` and `rvm_engine_cache_dir` are ignored, nothing is checked against the GPU or the TensorRT version, and nothing is built. Leave it empty in production. |
| `rvm_downsample_ratio` | float                                 | `0.5`                                                                      | In (0, 1]. Must match the `ds` value in the ONNX file name.                                                                                                                                                                              |

| `backend`                 | What it does                                                                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rvm`                     | Robust Video Matting on TensorRT, the working segmenter. Needs `streams.alignment: color_to_depth` and an ONNX model (or override engine) whose batch size equals the number of active cameras and whose size (`640x576`) equals the depth size. See [The RVM engine cache](#the-rvm-engine-cache). |
| `fill_all`                | Every pixel is foreground. Use it to run without segmentation.                                                                                                                                                                                                                                      |
| `none`                    | No mask; the bilateral filter then treats every pixel as foreground. Same depth as `fill_all`, without the mask image.                                                                                                                                                                              |
| `rgb_luma_threshold`      | Foreground where colour luma is above 128. Test backend.                                                                                                                                                                                                                                            |
| `sam3`                    | Placeholder that behaves like `fill_all`.                                                                                                                                                                                                                                                           |
| `tensorrt`, `onnxruntime` | Accepted by the parser, then fail at the first batch with `Selected foreground mask backend is not implemented`.                                                                                                                                                                                    |

#### The RVM engine cache [#the-rvm-engine-cache]

A TensorRT engine works only with the GPU model, the TensorRT version and the
batch size it was built for, so none ships with the server. With
`backend: rvm` and no `rvm_engine_path`, the server builds the engine from the
ONNX file the first time it needs it and keeps it in `rvm_engine_cache_dir`:

```text
<cache_dir>/sm89-trt11.1.0-<first 12 hex of the ONNX SHA-256>-b2.engine
<cache_dir>/sm89-trt11.1.0-<first 12 hex of the ONNX SHA-256>-b2.json
```

* **First start.** The build takes 3 to 4 minutes per batch size on an RTX
  4090 (measured: 181 s for batch 2, 220 s for batch 1). The
  server starts and serves while it builds. Until the engine is ready the mask
  stage passes every pixel as foreground, as with `fill_all`, and the log
  prints `RVM engine` progress lines (phase and percentage). When the build
  ends the mask stage switches to RVM without a restart and logs
  `segmentation ready after <s> s: RVM masks active (<n> batches used
  pass-through masks while warming up)`, once.
* **Later starts.** The engine is found in the cache and loaded; nothing
  is built. A TensorRT timing cache in the same directory makes a rebuild
  much faster than the first build (8 s measured for batch 1, with the same
  GPU and TensorRT version).
* **Rebuild triggers.** The JSON manifest next to the engine records the GPU
  name and compute capability, the driver version, the TensorRT version, the
  ONNX SHA-256, the batch size, the size and the downsample ratio. A change in
  any of them, a missing or unreadable manifest, or an empty engine rebuilds
  it. An engine that exists but fails to load is deleted and rebuilt once.
* **Safe to interrupt.** Files are written to a temporary name and renamed, so
  a stopped build leaves no partial engine. A lock file stops two processes
  from building the same engine at once; the second waits and then uses the
  result.
* **Pass-through fallback.** If the engine cannot be created or loaded, the
  live server does not stop: masks pass every pixel (all foreground, as with
  `fill_all`) for the rest of the run, the mask state is `failed`, and the log
  has one `[error] segmentation unavailable` (startup) or `segmentation: the
  TensorRT engine could not be built or loaded` (background build) line with the
  path, the reason and the fix. This covers configuration errors too (missing ONNX,
  unwritable cache directory), so the server still starts and serves. The
  error line names the likely fix, and the next start tries again. A build
  whose engine does not load is retried once within a run, never more.
* **Mask state.** The `LIVE PIPELINE` table every 5 s and the final summary
  print `mask: building|ready|failed, pass-through batches <n>`, plus the error
  text when failed. Nothing is added to the client protocol; clients see
  all-foreground masks as depth that is not cut out.
* **Other tools.** `orbbec_streamer_depth_quantization_calibrator` builds a
  missing engine before it starts and fails with the error if it is missing or
  does not load, because a calibration from pass-through masks would be wrong.
  `--calibrate-camera-pose` runs in the live app and uses no masks, so it keeps
  running with pass-through masks.

To export the ONNX files for development, run
[`scripts/setup_rvm.py --skip-engine-build`](./install#rvm-segmentation-engine-optional).

### `processing` [#processing]

Depth filtering on the GPU; see [GPU processing](./how-it-works/gpu-processing#bilateral-depth-filter).

| Key                               | Type                                      | Default             | Description                                                                           |
| --------------------------------- | ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `depth_filter_backend`            | `bilateral_cuda`, `identity_copy`, `none` | `bilateral_cuda`    | Depth filter.                                                                         |
| `bilateral_spatial_sigma_ratio`   | float                                     | `0.0034722` (2/576) | Spatial sigma as a fraction of the smaller image side. Positive.                      |
| `bilateral_radius_ratio`          | float                                     | `0.0034722` (2/576) | Window radius as a fraction of the smaller image side. Non-negative.                  |
| `bilateral_color_sigma`           | float                                     | `60.0`              | Colour-difference sigma. Non-negative.                                                |
| `bilateral_maximum_radius_pixels` | integer                                   | `16`                | Largest allowed resolved radius; a larger one stops start-up (no clamping). Positive. |
| `bilateral_mask_threshold`        | integer                                   | `128`               | 0 to 255. Read only by the depth calibrator; the live filter uses a fixed 128.        |

The four range checks on `bilateral_*` apply only with `bilateral_cuda`.

### `encoding` [#encoding]

NVENC HEVC encoding. See [Stream layout](./stream-layout) and [Encoding](./how-it-works/encoding).

| Key                                                | Type                                                                                    | Default                              | Description                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                                          | bool                                                                                    | `false`                              | Turns encoding on. Required for GPU-output recording and for serving.                                                             |
| `session_mode`                                     | `concatenated_batch` (aliases `concatenated`, `joint`), `per_camera` (alias `separate`) | `per_camera`                         | Stream layout. Wire names: `concatenated`, `per-camera`.                                                                          |
| `gpu_ordinal`                                      | integer                                                                                 | `0`                                  | CUDA device for NVENC.                                                                                                            |
| `queue_capacity`                                   | integer                                                                                 | `2`                                  | Encode queue in batches; a full queue drops its oldest batch. Greater than 0.                                                     |
| `stream_fps`                                       | `15` or `30`                                                                            | `15`                                 | The **stream rate**: batches per second processed, encoded and recorded. At most the capture rate. Applies with encoding off too. |
| `gop_length`                                       | integer (frames)                                                                        | `60`                                 | IDR period. `0` = only the first frame and on-demand keyframes are IDR. 60 frames is 4 s at 15 fps.                               |
| `color.bitrate_bps`                                | integer (bit/s)                                                                         | `12000000`                           | Colour bitrate per camera. Greater than 0.                                                                                        |
| `depth.bitrate_bps`                                | integer (bit/s)                                                                         | `8000000`                            | Depth bitrate per camera. Greater than 0.                                                                                         |
| `depth.minimum_depth_mm`, `depth.maximum_depth_mm` | integer (mm)                                                                            | `500`, `5000`                        | Quantized depth range, `0 < minimum < maximum <= 65535`.                                                                          |
| `depth.quantization_profile_path`                  | path                                                                                    | `config/dev/depth-quantization.json` | Calibrated profile. Non-empty.                                                                                                    |
| `depth.adaptive_uniform_mix`                       | float                                                                                   | `0.50`                               | 0 to 1. Uniform share mixed into the histogram by the calibrator.                                                                 |

Bitrates are per camera; in `concatenated_batch` the encoder runs at bitrate × cameras. With encoding on, the loader also checks that some HEVC Main-tier level up to 6.2 admits the surface size, stream rate and total bitrate.

**Depth quantization profile.** At start-up the server loads `quantization_profile_path` if the file exists; its range must equal `minimum_depth_mm`/`maximum_depth_mm`. If the file doesn't exist, the server logs `depth quantization profile not found ...; using linear 10-bit mapping`. If the file exists but cannot be used (unknown schema version, parse error, invalid table or another range), the server does not stop: it logs one error that names the file and the reason, uses the linear mapping for the configured range, and reports the depth-quantization calibration as `stale`. Create or replace the profile with the [depth quantization calibrator](./depth-quantization-calibrator), or from a browser that holds the setup lock (see [Calibrate from the browser](./depth-quantization-calibrator#calibrate-from-the-browser)); a browser commit writes this same file.

### `calibration` [#calibration]

Camera-pose calibration with a printed ChArUco board; see [Camera pose calibration](./camera-calibration).

| Key                                  | Type      | Default                       | Description                                                                                                                                                                                                                                                                           |
| ------------------------------------ | --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_pose_path`                   | path      | `config/dev/camera-pose.json` | Saved poses. A missing file means "needs setup", not an error.                                                                                                                                                                                                                        |
| `placement_path`                     | path      | `config/dev/placement.json`   | Persisted placement (where the server frame sits in the client anchor), saved on every placement commit before clients see it. A missing file means the default placement. Empty (`""`): placement is kept in memory only and resets at restart. Must differ from `camera_pose_path`. |
| `autocalibrate`                      | bool      | `false`                       | With a missing or stale pose: `true` lets a client holding the setup lease start calibration; `false` needs an operator. Clients can only act on it when [`serving.enabled`](#serving) is `true`; the server forces it to `false` when no calibration engine is available.            |
| `board.squares_x`, `board.squares_y` | integer   | `7`, `5`                      | Squares across and down, at least 2.                                                                                                                                                                                                                                                  |
| `board.square_length_m`              | float (m) | `0.08`                        | Printed square size. Measure the print.                                                                                                                                                                                                                                               |
| `board.marker_length_m`              | float (m) | `0.06`                        | Printed marker size, smaller than the square.                                                                                                                                                                                                                                         |
| `board.dictionary`                   | string    | `DICT_5X5_100`                | OpenCV ArUco dictionary, checked when the board is built.                                                                                                                                                                                                                             |

The setup lease is fixed at 15 s (wire-format §11) and not configurable.

### `preview` [#preview]

`point_cloud` (`true`), `max_points` (`300000`) and `colorize_points` (`true`) are parsed but unused. The preview window is switched with `run.preview`.

### `debug_recording` [#debug_recording]

Local recordings for debugging, off by default. Output layout in [Debug recording output](./running#debug-recording-output).

| Key                          | Type          | Default      | Description                                                                                 |
| ---------------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `record_gpu_inputs`          | bool          | `false`      | Frames entering GPU processing, lossless FFV1 in `.mkv`.                                    |
| `record_gpu_outputs`         | bool          | `false`      | Encoded HEVC output. Requires `encoding.enabled: true`.                                     |
| `locally_decode_gpu_outputs` | bool          | `false`      | Decode the output and write `.mkv` instead of `.hevc`. Requires `record_gpu_outputs: true`. |
| `prefer_hardware_decoder`    | bool          | `true`       | Use the GPU decoder when possible.                                                          |
| `directory`                  | path          | `debug/live` | Output directory. Non-empty when recording.                                                 |
| `camera_ids`                 | list of `id`s | all cameras  | Cameras to record; each a configured `id`, listed once.                                     |

`setup.json` is written into `directory` at every start, even with recording off. There is no telemetry section; see [Read the telemetry](./telemetry).

### `serving` [#serving]

Browser serving through the WebTransport gateway, off by default. See [Serve to browsers](./serving).

| Key                          | Type                           | Default                          | Description                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                    | bool                           | `false`                          | Start the gateway. Requires `encoding.enabled: true` and `streams.alignment: color_to_depth`.                                                                                                                                                                                                            |
| `gateway_executable`         | path                           | none                             | The `orbbec-gateway` binary. Required when enabled. A relative path is resolved against the **config file's directory**, unlike the other paths.                                                                                                                                                         |
| `listen_address`             | `host:port`                    | `127.0.0.1:4443`                 | UDP address of the HTTP/3 listener. `0.0.0.0` accepts every interface.                                                                                                                                                                                                                                   |
| `path`                       | string                         | `/orbbec`                        | WebTransport endpoint path. Starts with `/`.                                                                                                                                                                                                                                                             |
| `allowed_origins`            | list of `scheme://host[:port]` | none                             | Browser origins allowed to connect. At least one when enabled, unless `allow_missing_origin`.                                                                                                                                                                                                            |
| `allow_missing_origin`       | bool                           | `false`                          | Accept requests without an `Origin` header (native tools, never needed by browsers).                                                                                                                                                                                                                     |
| `max_sessions`               | integer                        | `16`                             | Sessions open at once, 1 to 1024. A full server answers HTTP 503.                                                                                                                                                                                                                                        |
| `certificate`, `private_key` | path                           | empty                            | A CA-issued certificate and its key (mode 600). Both or neither. Empty: a self-signed development certificate.                                                                                                                                                                                           |
| `dev_certificate_hash_path`  | path                           | `debug/live/gateway-cert.sha256` | Where the development certificate's SHA-256 (hex) is written on every renewal.                                                                                                                                                                                                                           |
| `host_names`                 | list of names or IP addresses  | none                             | Names and addresses browsers use to reach this server, besides `localhost`, `127.0.0.1`, `::1` and the names in the certificate. A request whose `Host` (`:authority`) is not one of them, or names another port, is refused with HTTP 421 (protection against DNS rebinding). No scheme, port or path.  |
| `tls_directory`              | path                           | empty                            | The packaged TLS directory that `orbbec-tls` maintains, for example `/etc/orbbec-streamer/tls`. Replaces `certificate` and `private_key` (set one or the other). The server may start before the files exist and reloads them on `SIGHUP`; see [Packaged certificates](./serving#packaged-certificates). |

```yaml
serving:
  enabled: true
  gateway_executable: "../../build/dev-relwithdebinfo/orbbec-gateway"
  listen_address: "0.0.0.0:4443"
  allowed_origins:
    - "http://localhost:5173"
```

## Environment variables [#environment-variables]

Nothing else is read from the environment. The scripts in `server/scripts/` find `git`, `nvcc`, `nvidia-smi` and `trtexec` on `PATH`.

### Build time [#build-time]

| Variable                               | Read by                    | Purpose                                                                                                                                  |
| -------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `CC`, `CXX`, `CUDAHOSTCXX`             | CMake                      | Set by the presets to GCC 15. The C++ and CUDA host compilers must be the same toolchain.                                                |
| `CUDA_HOME`, `PATH`, `LD_LIBRARY_PATH` | CUDA tools, CMake          | The presets set `CUDA_HOME=/usr/local/cuda` and prepend its `bin` and `lib64`. Add the TensorRT `lib` folder yourself for a tar install. |
| `TensorRT_ROOT` or `TENSORRT_ROOT`     | `cmake/FindTensorRT.cmake` | TensorRT location when not in system paths, for example `/opt/TensorRT-11.1.0`.                                                          |

CMake cache variables, passed with `-D`:

| Variable                                               | Default          | Purpose                                                                                                                                        |
| ------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMAKE_CUDA_ARCHITECTURES`                             | `89`             | GPU code target. The presets re-apply it, so override it in a user preset; see [Build for a different GPU](./build#build-for-a-different-gpu). |
| `OrbbecSDK_DIR`                                        | `/usr/local/lib` | Folder with `OrbbecSDKConfig.cmake`.                                                                                                           |
| `ORBBEC_STREAMER_PROTOCOL_CONTRACT_DIR`                | `../protocol`    | Contract, schema and vectors for the conformance and fuzz tests.                                                                               |
| `ORBBEC_STREAMER_SANITIZE`, `ORBBEC_STREAMER_COVERAGE` | off              | Set by the `dev-asan`, `dev-tsan` and `dev-coverage` presets.                                                                                  |

### Run time [#run-time]

| Variable                      | Read by                 | Purpose                                                                                                                                                                                      |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORBBEC_STREAMER_STATUS_MODE` | `--live` status display | `log` writes every status table as a log line; `dashboard` forces the in-place display. Unset: in-place only if stdout is a terminal, `TERM` is set and not `dumb`, and `NO_COLOR` is unset. |
| `TERM`, `NO_COLOR`            | `--live` status display | See above.                                                                                                                                                                                   |
| `DISPLAY`, `WAYLAND_DISPLAY`  | `--live` preview        | Neither set: the preview is turned off with a warning.                                                                                                                                       |
| `LD_LIBRARY_PATH`             | dynamic loader          | Must include the TensorRT `lib` folder for a tar install, and `/usr/local/cuda/lib64` if CUDA is not in the default paths.                                                                   |

For example, plain log output for a log file, from `server/`:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
```

## Troubleshooting [#troubleshooting]

| Message                                                                                                                                                                                      | Fix                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to open live config: <path>`                                                                                                                                                         | Wrong path or wrong working directory. Run from `server/` or pass an absolute path.                                                                                                                                                                                                                                     |
| `Unsupported <section> key: <key>`                                                                                                                                                           | Typo, or a key in the wrong section.                                                                                                                                                                                                                                                                                    |
| `Encoding key appeared outside color/depth subsection: <key>`                                                                                                                                | Unknown key under `encoding`, often a misspelt `gop_length`, `queue_capacity` or `stream_fps`.                                                                                                                                                                                                                          |
| `Stream key appeared outside depth/color subsection`                                                                                                                                         | A `width`, `height`, `fps` or `format` line is not under `depth:` or `color:`.                                                                                                                                                                                                                                          |
| `Unsupported config section: <key>`                                                                                                                                                          | A header without value that is not a known section.                                                                                                                                                                                                                                                                     |
| `Invalid integer value: <raw>`, `Invalid float value (a finite number is required): <raw>`                                                                                                   | A number with trailing text (`30fps`), a sign on an integer, or a word (`thirty`).                                                                                                                                                                                                                                      |
| `Integer value out of range (0 to 4294967295): <raw>`                                                                                                                                        | The number does not fit 32 bits.                                                                                                                                                                                                                                                                                        |
| `Invalid empty integer value`, `Invalid empty float value`                                                                                                                                   | A number key without value.                                                                                                                                                                                                                                                                                             |
| `Invalid boolean value: <raw>`                                                                                                                                                               | Use `true`/`false`, `yes`/`no` or `1`/`0`.                                                                                                                                                                                                                                                                              |
| `live config must contain at least one camera`                                                                                                                                               | Add a `cameras` list item.                                                                                                                                                                                                                                                                                              |
| `sync.enabled=true requires exactly one primary camera`                                                                                                                                      | Set `role: primary` on exactly one camera.                                                                                                                                                                                                                                                                              |
| `streams.depth.fps and streams.color.fps (the capture rate) must be 15 or 30, got ...`                                                                                                       | Use 15 or 30.                                                                                                                                                                                                                                                                                                           |
| `streams.color.fps and streams.depth.fps must match`                                                                                                                                         | Make them equal.                                                                                                                                                                                                                                                                                                        |
| `encoding.stream_fps must be 15 or 30, got ...` or `... must not exceed the capture rate ...`                                                                                                | Set `stream_fps` to 15 or 30, at most `streams.depth.fps`.                                                                                                                                                                                                                                                              |
| `Encoding: no HEVC level up to 6.2 admits ...`                                                                                                                                               | Lower `bitrate_bps`, the resolution or the stream rate, or use `per_camera`.                                                                                                                                                                                                                                            |
| `processing.depth_filter_backend=bilateral_cuda requires streams.alignment color_to_depth or depth_to_color`, `encoding.enabled requires streams.alignment color_to_depth or depth_to_color` | Both need colour and depth at one size. Set `streams.alignment: color_to_depth`.                                                                                                                                                                                                                                        |
| `Bilateral depth filter: colour <w>x<h> does not match depth <w>x<h> (camera <id>)`                                                                                                          | The aligned colour or mask size differs from depth at run time. Use `streams.alignment: color_to_depth`.                                                                                                                                                                                                                |
| `Current RVM integration requires streams.alignment=color_to_depth`                                                                                                                          | Set that alignment or choose another mask backend.                                                                                                                                                                                                                                                                      |
| `Unsupported live mask backend: <name>`, `Unsupported live depth filter backend: <name>`                                                                                                     | Use a value from the `mask` or `processing` tables.                                                                                                                                                                                                                                                                     |
| `RVM mask backend requires mask.rvm_onnx_path and mask.rvm_engine_cache_dir (or the development override mask.rvm_engine_path)`                                                              | Set both keys, or `rvm_engine_path`.                                                                                                                                                                                                                                                                                    |
| `mask.rvm_onnx_path supports only the {batch} placeholder: <path>`                                                                                                                           | Remove other braces from the path.                                                                                                                                                                                                                                                                                      |
| `ONNX model not found: <path> ...`                                                                                                                                                           | Install the packaged model or export it with `scripts/setup_rvm.py --skip-engine-build`, then point `mask.rvm_onnx_path` at it. The server keeps running with all-foreground masks; look for this `[error]` line and `mask: failed` in the stats.                                                                       |
| `cannot create the TensorRT engine cache directory <dir>` or `cannot write the TensorRT engine cache directory <dir>`                                                                        | Set `mask.rvm_engine_cache_dir` to a directory the server's user can write. The server keeps running with all-foreground masks; look for this `[error]` line and `mask: failed` in the stats.                                                                                                                           |
| `ONNX model <path> input '<name>' ...` or `... has <n> inputs`                                                                                                                               | The ONNX file does not match the configured batch size, size or `rvm_downsample_ratio`. Export the matching model. The server keeps running with all-foreground masks; look for this `[error]` line and `mask: failed` in the stats.                                                                                    |
| `segmentation: the TensorRT engine could not be built or loaded: ...`                                                                                                                        | The background build failed. The server keeps running with all-foreground masks and the mask state `failed`. The message names the TensorRT step. Check free GPU memory with `nvidia-smi`, fix the cause, restart.                                                                                                      |
| `segmentation unavailable: the RVM segmenter (mask.rvm_engine_path <path>) could not be created: Cannot open TensorRT engine: <path>`                                                        | Only with the `rvm_engine_path` override: the file is missing, incompatible, or built for another batch size. The server runs with all-foreground masks. Remove `rvm_engine_path` and set `rvm_onnx_path` and `rvm_engine_cache_dir`, or set `mask.backend: fill_all`. The calibrator tools still stop with this error. |
| `depth quantization profile <path> covers ... mm but the configuration says ... mm; using the linear profile ...` or `... is unusable (...)`                                                 | Not fatal: the server runs on the linear mapping and reports the calibration as `stale`. Recalibrate (the calibrator needs `--force`), or delete the file.                                                                                                                                                              |
| `No configured cameras are active; live mode cannot continue`                                                                                                                                | No serial matched. Check cables and `serial_number`; list devices with `./build/dev-debug/orbbec_streamer --orbbec-test`.                                                                                                                                                                                               |
| `serving.enabled needs serving.gateway_executable` / `... needs encoding.enabled` / `... needs serving.allowed_origins`                                                                      | Set the missing key.                                                                                                                                                                                                                                                                                                    |
| `serving.max_sessions must be 1..1024`, `serving.path must start with '/'`, `serving.listen_address must be host:port`                                                                       | Fix the value.                                                                                                                                                                                                                                                                                                          |
| `serving.certificate and serving.private_key go together`                                                                                                                                    | Set both, or neither for a development certificate.                                                                                                                                                                                                                                                                     |
| `GPU-output recording requires encoding.enabled=true`                                                                                                                                        | Enable encoding or set `record_gpu_outputs: false`.                                                                                                                                                                                                                                                                     |
| `Debug recording references unknown camera id: <id>`                                                                                                                                         | `debug_recording.camera_ids` takes camera `id`s, not serials.                                                                                                                                                                                                                                                           |
