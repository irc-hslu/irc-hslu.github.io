# Configuration (https://irc-hslu.github.io/orbbecstreamer/docs/server/configuration)



The live pipeline reads one YAML file that lists the cameras, capture
profiles, synchronisation, GPU processing, encoding, calibration and debug
recording. The development config is `server/config/dev/live.yaml`. The
parser is `server/src/config/LiveConfig.cpp`; this page follows it.

## The config directory [#the-config-directory]

```text
server/config/
  dev/
    live.yaml                   the development config (two synced cameras)
    depth-quantization.json     written by the depth calibrator; optional
    camera-pose.json            written by camera-pose calibration; optional
```

Only `live.yaml` is checked in. The two JSON files are created on the
machine that owns the cameras. When they are missing the server still starts:
it uses a linear depth mapping and reports that setup (camera-pose
calibration) is needed.

Every relative path in the config (`rvm_engine_path`,
`quantization_profile_path`, `camera_pose_path`, `debug_recording.directory`)
is resolved against the working directory. Run the server from `server/`.

## Point the server at a config [#point-the-server-at-a-config]

The option depends on the command:

| Command                       | Config option                                                     | Default                              |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Live pipeline                 | `--live <file>`                                                   | none; required                       |
| Local camera-pose calibration | `--live <file> --calibrate-camera-pose`                           | none; required                       |
| Print the ChArUco board       | `--print-charuco-board <png> [--live <file>]`                     | built-in board if `--live` is absent |
| Synchronised-capture test     | `--orbbec-live-sync-test [--config <file>]`                       | `config/dev/live.yaml`               |
| Depth quantization calibrator | `orbbec_streamer_depth_quantization_calibrator [--config <file>]` | `config/dev/live.yaml`               |

`--config` of `orbbec_streamer` is read only by `--orbbec-live-sync-test`. To
run the live pipeline use `--live`. `config/dev/live.yaml` describes the
development rig (its camera serials, hardware sync, the RVM mask and full debug
recording), so copy and adapt it first; see
[Adapt the config to your rig](./running#adapt-the-config-to-your-rig).

From the `server/` folder:

```bash
./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
```

Use `build/dev-relwithdebinfo/` instead of `build/dev-debug/` for the
optimised build.

## Check a config without cameras [#check-a-config-without-cameras]

The loader rejects an unknown key, a bad value or an inconsistent combination
before any camera is opened. There are two checks.

**Parse and validate the file.** Printing the calibration board loads the
config through the same loader and does not touch cameras. From the
`server/` folder:

```bash
./build/dev-debug/orbbec_streamer --print-charuco-board /tmp/board.png --live config/dev/live.yaml
```

Expected result: exit code 0 and a line such as

```text
[info] wrote ChArUco board /tmp/board.png: 7x5 squares of 80.0 mm (DICT_5X5_100), printed board 560 x 400 mm; ...
```

This check does not validate `mask.backend` or
`processing.depth_filter_backend`; those names are checked when the live
pipeline starts.

**Full start-up check.** Copy the config, prefix every serial number so no
camera matches, disable the preview and shorten the camera wait. The server
then validates everything, logs the effective settings and stops because no
camera matches. From the `server/` folder:

```bash
sed -e 's/serial_number: "/serial_number: "NO-SUCH-/' \
    -e 's/camera_wait_timeout_ms: .*/camera_wait_timeout_ms: 1000/' \
    -e 's/preview: true/preview: false/' \
    config/dev/live.yaml > /tmp/live-check.yaml
./build/dev-debug/orbbec_streamer --live /tmp/live-check.yaml
```

Expected result: the `live config`, `live streams`, `live mask`,
`live processing` and `live encoding` log lines, then

```text
[error] orbbec-streamer failed: No configured cameras are active; live mode cannot continue
```

Any other `orbbec-streamer failed:` message is a config error; see
[Troubleshooting](#troubleshooting). This only works when every camera has a
`serial_number`; a camera without one matches any connected device. The check
stops before the RVM engine file is opened, so a missing engine shows up only
in a real run.

## File format [#file-format]

The loader is a small line parser, not a full YAML implementation:

* A line is `key: value`, a section header `key:` or a list item `- ...`.
  Indentation is ignored; a key belongs to the last section header above it.
* Unknown sections and unknown keys are errors, so typos are caught.
* `#` starts a comment, except inside double quotes. Strings may be
  quoted with `"` or `'` or left bare.
* Booleans: `true`, `false`, `yes`, `no`, `1`, `0`.
* List items are allowed only under `cameras` and
  `debug_recording.camera_ids`. The only inline array is `mask.bbox_xywh`.
* Omitted keys take the defaults in the tables below. The defaults are the
  code defaults, which sometimes differ from `config/dev/live.yaml`.

## Minimal example [#minimal-example]

One camera, no segmentation model (every pixel counts as foreground),
encoding on, no preview window:

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
    fps: 15
    format: "depth_u16"
  color:
    width: 1280
    height: 720
    fps: 15
    format: "rgb8"

mask:
  backend: "fill_all"

encoding:
  enabled: true
  session_mode: "per_camera"
```

`fill_all` and `none` give the same depth here (colour aligned to depth, so
both have the depth resolution): without a mask the bilateral filter treats
every pixel as foreground. `fill_all` also produces a mask image
(all 255) for the preview and the encoder; `none` skips that work.

Without `serial_number` the server takes the first Orbbec camera it finds.
This file passes both checks above (add a `serial_number` for the start-up
check).

## Option reference [#option-reference]

### `run` [#run]

| Key                      | Type    | Default | Description                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_wait_timeout_ms` | integer | `5000`  | How long start-up waits for all configured cameras to appear. After the timeout the server continues with the cameras it found.                                                                                                                                                                                                    |
| `preview`                | bool    | `true`  | Opens a local OpenCV preview window. It runs on its own thread and shows the newest frame it can keep up with, so it never blocks the capture, processing or encoding threads. It holds one colour frame's GPU buffer while it draws. Disabled automatically, with a warning, when neither `DISPLAY` nor `WAYLAND_DISPLAY` is set. |

### `setup` [#setup]

Used by the depth quantization calibrator.

| Key                        | Type    | Default | Description                                                                                                |
| -------------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `maximum_duration_seconds` | integer | `60`    | Total calibration duration including warm-up. Must be 1 to 60.                                             |
| `warmup_seconds`           | integer | `5`     | Frames discarded before the depth histogram is collected. Must be smaller than `maximum_duration_seconds`. |

### `cameras` [#cameras]

A list. At least one camera is required.

```yaml
cameras:
  - id: "cam0"
    serial_number: "CL8K0000000A"
    role: "primary"
```

| Key             | Type                     | Default     | Description                                                                                                                                                                                      |
| --------------- | ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | string                   | none        | Your name for the camera. It is used in logs, debug recordings, `setup.json` and as the client-facing camera id instead of the SDK's device id. Must be non-empty and unique.                    |
| `vendor`        | string                   | `orbbec`    | Only `orbbec` is supported.                                                                                                                                                                      |
| `serial_number` | string                   | empty       | Selects the device with this serial number. Empty takes the next unused device. Must be unique when set.                                                                                         |
| `required`      | bool                     | `true`      | In the live server it is only logged when the camera is missing and does not stop start-up. The depth quantization calibrator enforces it: it stops with `Required camera is unavailable: <id>`. |
| `role`          | `primary` or `secondary` | `secondary` | Hardware-sync role.                                                                                                                                                                              |

Cameras that are missing after `camera_wait_timeout_ms` are logged as
`neglecting missing camera` and left out. Start-up fails only when no
camera is found.

### `sync` [#sync]

Hardware (trigger cable) synchronisation of several cameras.

| Key                                     | Type         | Default | Description                                                                                                                                     |
| --------------------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                               | bool         | `false` | Turns on hardware sync. Requires exactly one camera with `role: primary`. With sync off, at most one camera may be primary.                     |
| `secondary_depth_delay_step_us`         | integer (µs) | `150`   | Depth exposure delay step for secondaries, to avoid IR interference. The first active secondary gets one step, the second two steps, and so on. |
| `color_delay_us`                        | integer (µs) | `0`     | Colour trigger delay, applied to every camera.                                                                                                  |
| `trigger_to_image_delay_us`             | integer (µs) | `0`     | Trigger-to-image delay, applied to every camera.                                                                                                |
| `trigger_out_enable`                    | bool         | `true`  | Enables the trigger output.                                                                                                                     |
| `trigger_out_delay_us`                  | integer (µs) | `0`     | Trigger output delay.                                                                                                                           |
| `frames_per_trigger`                    | integer      | `1`     | Frames per trigger. Must be greater than 0.                                                                                                     |
| `timestamp_tolerance_us`                | integer (µs) | `2000`  | Maximum timestamp spread for frames to be grouped into one multi-camera batch.                                                                  |
| `maximum_pending_frame_sets_per_camera` | integer      | `4`     | Bound on frames waiting for a partner per camera. Must be greater than 0.                                                                       |

### `streams` [#streams]

The capture profile, the same for every camera.

| Key                           | Type                                                          | Default          | Description                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alignment`                   | `color_to_depth`, `depth_to_color`, `disabled` (alias `none`) | `color_to_depth` | Orbbec SDK alignment. Client-facing setup, the RVM mask and camera-pose calibration require `color_to_depth`. The `bilateral_cuda` depth filter and `encoding.enabled` reject `disabled`. |
| `depth.width`, `depth.height` | integer                                                       | none             | Depth resolution. Both must be non-zero.                                                                                                                                                  |
| `depth.fps`, `color.fps`      | `15` or `30`                                                  | none             | The **capture rate**: how fast the cameras run. Colour and depth must be equal. See [Capture rate and stream rate](#capture-rate-and-stream-rate).                                        |
| `depth.format`                | `depth_u16` (alias `y16`)                                     | none             | Depth pixel format.                                                                                                                                                                       |
| `color.width`, `color.height` | integer                                                       | none             | Colour resolution. Both must be non-zero.                                                                                                                                                 |
| `color.format`                | `rgb8`, `bgr8`, `gray8` (alias `y8`)                          | none             | Colour pixel format. Encoding expects `rgb8`.                                                                                                                                             |

With `color_to_depth`, colour is resampled into the depth image, so every
encoded tile has the depth size (640 × 576 in the dev config).

#### Capture rate and stream rate [#capture-rate-and-stream-rate]

The cameras' own delay grows with their frame interval: at 15 fps a frame
reaches the server about 135 ms after capture, at 30 fps about 67 ms. So
the server can capture faster than it streams. With a capture rate of 30
(`streams.*.fps: 30`) and a stream rate of 15 (`encoding.stream_fps: 15`),
it keeps every second batch right after batching, before any GPU work. The
stream keeps its rate and bitrate, and end-to-end latency drops by about
75 ms (measured on two Femto Bolts: capture to encoded frame 147 → 73 ms at
p50).

* Both rates are `15` or `30` and default to `15`. The stream rate cannot
  exceed the capture rate.
* Capturing at 30 doubles the USB traffic (about 53 MiB/s per camera) and
  the colour decoding on the CPU.
* When a camera skips a frame, the server passes on the next captured batch
  instead, so the stream keeps its frame count.
* The dev config captures at 30 and streams at 15.

### `mask` [#mask]

Foreground segmentation. Depth outside the mask is sent as "invalid".

| Key                    | Type                                  | Default                                                                | Description                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`              | see below                             | `sam3`                                                                 | Mask generator.                                                                                                                                                                                             |
| `prompt_type`          | `text`, `bbox` (alias `bounding_box`) | `text`                                                                 | Prompt kind for a promptable segmenter. Parsed, but no current backend uses it.                                                                                                                             |
| `text_prompt`          | string                                | `person`                                                               | Must be non-empty when `prompt_type: text`.                                                                                                                                                                 |
| `bbox_xywh`            | `[x, y, w, h]` integers               | `[0, 0, 0, 0]`                                                         | Box prompt. Exactly four integers.                                                                                                                                                                          |
| `rvm_engine_path`      | path                                  | `models/rvm/generated/rvm_mobilenetv3_b2_640x576_ds0.5_float16.engine` | TensorRT engine for `rvm`. Must be non-empty when `backend: rvm`.                                                                                                                                           |
| `rvm_downsample_ratio` | float                                 | `0.5`                                                                  | RVM downsample ratio, in (0, 1]. Width and height times the ratio must be whole numbers. It must match the ratio the engine was built with (the `ds` value in the engine file name, set by `setup_rvm.py`). |

`backend` values:

| Value                     | Status                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rvm`                     | Robust Video Matting (a person-segmentation model) on TensorRT, the NVIDIA inference runtime. The working segmenter. Requires `streams.alignment: color_to_depth`. |
| `none`                    | No mask is generated; the bilateral filter then treats every pixel as foreground.                                                                                  |
| `fill_all`                | Mask of all foreground (test backend).                                                                                                                             |
| `rgb_luma_threshold`      | Luma threshold at 128 on colour (test backend).                                                                                                                    |
| `sam3`                    | Placeholder: fills the mask with foreground. It is the code default, so set `backend` explicitly.                                                                  |
| `tensorrt`, `onnxruntime` | Accepted by the parser, but fail with `Selected foreground mask backend is not implemented`.                                                                       |

The RVM engine is built for a fixed batch size (`b2` in the file name is two
cameras) and a fixed geometry (`640x576`). It must match the number of active
cameras and the depth size.

### `processing` [#processing]

Depth filtering on the GPU.

| Key                               | Type                                      | Default             | Description                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `depth_filter_backend`            | `bilateral_cuda`, `identity_copy`, `none` | `bilateral_cuda`    | Depth filter. `identity_copy` copies depth unchanged.                                                                                                                                  |
| `bilateral_spatial_sigma_ratio`   | float                                     | `0.0034722` (2/576) | Spatial sigma as a fraction of the smaller image side (the height at 640×576). Must be positive.                                                                                       |
| `bilateral_radius_ratio`          | float                                     | `0.0034722` (2/576) | Kernel radius as a fraction of the smaller image side. Must be non-negative.                                                                                                           |
| `bilateral_color_sigma`           | float                                     | `60.0`              | Colour-difference sigma. Must be non-negative.                                                                                                                                         |
| `bilateral_maximum_radius_pixels` | integer                                   | `16`                | Largest allowed radius in pixels. A resolved radius above it stops the server at start-up (it is not clamped). Must be positive.                                                       |
| `bilateral_mask_threshold`        | integer                                   | `128`               | 0 to 255. Mask value a pixel needs to count as foreground in the depth calibrator's histogram. The live bilateral filter currently uses a fixed threshold of 128 and ignores this key. |

The four `bilateral_*` range checks apply only when
`depth_filter_backend: bilateral_cuda`.

### `encoding` [#encoding]

Video encoding with NVENC, the NVIDIA hardware video encoder, as HEVC
(H.265). See [Stream layout](./stream-layout) for what
`session_mode` produces.

| Key                               | Type                                                                                    | Default                              | Description                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`                         | bool                                                                                    | `false`                              | Turns on encoding. Required for GPU-output recording and, later, for serving.                                                                                                                                                        |
| `session_mode`                    | `concatenated_batch` (aliases `concatenated`, `joint`), `per_camera` (alias `separate`) | `per_camera`                         | Stream layout. On the wire these are `concatenated` and `per-camera`.                                                                                                                                                                |
| `gpu_ordinal`                     | integer                                                                                 | `0`                                  | CUDA device used by NVENC.                                                                                                                                                                                                           |
| `queue_capacity`                  | integer                                                                                 | `2`                                  | Input queue of the encoder, in batches. When it is full the oldest queued batch is dropped, so the encoder always works on recent frames. Each extra slot can add one frame period of latency after a stall. Must be greater than 0. |
| `stream_fps`                      | `15` or `30`                                                                            | `15`                                 | The **stream rate**: frames per second that are processed, encoded and recorded. At most the capture rate. See [Capture rate and stream rate](#capture-rate-and-stream-rate). Applies with encoding off too.                         |
| `gop_length`                      | integer (frames)                                                                        | `60`                                 | Distance between IDR frames (keyframes a decoder can start from), also called the GOP length. `0` means an infinite GOP (only the first frame and on-demand keyframes are IDR). At a stream rate of 15 fps, 60 frames is 4 s.        |
| `color.bitrate_bps`               | integer (bit/s)                                                                         | `12000000`                           | Colour bitrate per camera. Must be greater than 0.                                                                                                                                                                                   |
| `depth.bitrate_bps`               | integer (bit/s)                                                                         | `8000000`                            | Depth bitrate per camera. Must be greater than 0.                                                                                                                                                                                    |
| `depth.minimum_depth_mm`          | integer (mm)                                                                            | `500`                                | Start of the quantized depth range. Must satisfy `0 < minimum < maximum <= 65535`.                                                                                                                                                   |
| `depth.maximum_depth_mm`          | integer (mm)                                                                            | `5000`                               | End of the quantized depth range.                                                                                                                                                                                                    |
| `depth.quantization_profile_path` | path                                                                                    | `config/dev/depth-quantization.json` | Calibrated depth quantization profile. Must be non-empty.                                                                                                                                                                            |
| `depth.adaptive_uniform_mix`      | float                                                                                   | `0.50`                               | 0 to 1. Share of a uniform distribution mixed into the measured depth histogram when the calibrator builds a profile.                                                                                                                |

Bitrates are per camera: in `concatenated_batch` mode the encoder runs at the
bitrate times the number of cameras. Rate control is constant bitrate (CBR)
with a one-frame buffer, no B-frames (frames that reference later frames)
and no look-ahead.

**Depth quantization profile.** At start-up the server looks for
`quantization_profile_path`:

* If the file exists, it is loaded. Its range must equal
  `minimum_depth_mm`/`maximum_depth_mm`, or start-up fails.
* If it does not exist, the server logs
  `depth quantization profile not found ...; using linear 10-bit mapping`
  and uses a linear mapping over the range.

Create or refresh the profile with the calibrator. It needs the cameras.
From the `server/` folder:

```bash
./build/dev-debug/orbbec_streamer_depth_quantization_calibrator --config config/dev/live.yaml
```

It exits at once if a compatible profile already exists; add `--force` to
recompute. `--output`, `--duration-s` and `--uniform-mix` override
`quantization_profile_path`, `setup.maximum_duration_seconds` and
`adaptive_uniform_mix`.

### `calibration` [#calibration]

Camera-pose calibration measures the position and orientation of each
camera. It uses a printed ChArUco board: a chessboard with an ArUco marker
in each white square.

| Key                     | Type      | Default                       | Description                                                                                                                    |
| ----------------------- | --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `camera_pose_path`      | path      | `config/dev/camera-pose.json` | Persisted camera poses. A missing file is not an error: the server starts in "needs setup".                                    |
| `autocalibrate`         | bool      | `false`                       | When the calibration is missing or stale: `true` waits for a setup client to start calibration; `false` requires manual setup. |
| `board.squares_x`       | integer   | `7`                           | Squares along x. At least 2.                                                                                                   |
| `board.squares_y`       | integer   | `5`                           | Squares along y. At least 2.                                                                                                   |
| `board.square_length_m` | float (m) | `0.08`                        | Printed square size. Measure the printout.                                                                                     |
| `board.marker_length_m` | float (m) | `0.06`                        | Printed marker size. Must be smaller than `square_length_m`.                                                                   |
| `board.dictionary`      | string    | `DICT_5X5_100`                | OpenCV ArUco dictionary. Checked when the board is built.                                                                      |

Starting calibration from a browser needs the network session, which is not
yet available, so `autocalibrate: true` has no client to wait for today. Run
calibration locally instead. From the `server/` folder:

```bash
./build/dev-debug/orbbec_streamer --live config/dev/live.yaml --calibrate-camera-pose
```

The setup lock (lease) that protects calibration from concurrent clients is
fixed at 15 s in the server and is not configurable.

### `preview` [#preview]

| Key               | Type    | Default  | Description                                |
| ----------------- | ------- | -------- | ------------------------------------------ |
| `point_cloud`     | bool    | `true`   | Parsed but not used by the current server. |
| `max_points`      | integer | `300000` | Parsed but not used by the current server. |
| `colorize_points` | bool    | `true`   | Parsed but not used by the current server. |

The preview window itself is switched with `run.preview`.

### `debug_recording` [#debug_recording]

Local recordings for debugging. Off by default.

| Key                          | Type                 | Default             | Description                                                                                                                                 |
| ---------------------------- | -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `record_gpu_inputs`          | bool                 | `false`             | Records the camera frames entering GPU processing, losslessly (FFV1 in `.mkv`).                                                             |
| `record_gpu_outputs`         | bool                 | `false`             | Records the encoded HEVC output. Requires `encoding.enabled: true`.                                                                         |
| `locally_decode_gpu_outputs` | bool                 | `false`             | Decodes the HEVC output locally and writes Matroska (`.mkv`) videos instead of raw `.hevc` bitstreams. Requires `record_gpu_outputs: true`. |
| `prefer_hardware_decoder`    | bool                 | `true`              | Uses the GPU decoder for local decoding when possible.                                                                                      |
| `directory`                  | path                 | `debug/live`        | Output directory. Must be non-empty when recording.                                                                                         |
| `camera_ids`                 | list of camera `id`s | empty (all cameras) | Cameras to record. Each must be a configured `id`, listed once.                                                                             |

The server always writes `setup.json` into `directory` after the cameras
start, even with recording off. It is a local debug file, not part of the
client protocol.

### Telemetry [#telemetry]

There is no telemetry section. The server logs rates, drops and
stage-by-stage latency on a fixed schedule.

## Environment variables [#environment-variables]

The server code, CMake files and scripts read only the variables below. The
scripts in `server/scripts/` read no environment variables; they find `git`,
`nvcc`, `nvidia-smi` and `trtexec` on `PATH`.

### Build time [#build-time]

| Variable                           | Read by                        | Purpose                                                                                                                                    | Example                                                     |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `CC`, `CXX`                        | CMake, set by the presets      | C and C++ compilers. The presets set them to GCC 15, so you do not set them yourself.                                                      | `CXX=/usr/bin/g++-15`                                       |
| `CUDAHOSTCXX`                      | CMake, set by the presets      | Host compiler for `nvcc`. It must be the same GCC version as `CXX`, or configure stops.                                                    | `CUDAHOSTCXX=/usr/bin/g++-15`                               |
| `CUDA_HOME`                        | CUDA tools, set by the presets | CUDA toolkit root                                                                                                                          | `CUDA_HOME=/usr/local/cuda`                                 |
| `PATH`                             | CMake, set by the presets      | The presets prepend `/usr/local/cuda/bin` to your `PATH`                                                                                   | `PATH=/usr/local/cuda/bin:$PATH`                            |
| `LD_LIBRARY_PATH`                  | CMake, set by the presets      | The presets prepend `/usr/local/cuda/lib64`. For a TensorRT tar install, add its `lib` folder yourself.                                    | `LD_LIBRARY_PATH=/opt/TensorRT-11.1.0/lib:$LD_LIBRARY_PATH` |
| `TensorRT_ROOT` or `TENSORRT_ROOT` | `cmake/FindTensorRT.cmake`     | Where to look for TensorRT headers, `libnvinfer` and `trtexec` when they are not in the system paths. Not needed with the Debian packages. | `TensorRT_ROOT=/opt/TensorRT-11.1.0`                        |

These CMake cache variables are passed with `-D` and are not environment
variables, but people often need them:

| Variable                                | Default          | Purpose                                                                                                                                   |
| --------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CMAKE_CUDA_ARCHITECTURES`              | `89`             | GPU compute capability to compile for. The presets set it on every configure, so override it in a `CMakeUserPresets.json`, not with `-D`. |
| `OrbbecSDK_DIR`                         | `/usr/local/lib` | Folder that contains `OrbbecSDKConfig.cmake`                                                                                              |
| `TensorRT_ROOT`                         | not set          | Same as the environment variable above                                                                                                    |
| `ORBBEC_STREAMER_PROTOCOL_CONTRACT_DIR` | `../protocol`    | Protocol contract, schema and vectors for the conformance test                                                                            |

### Run time [#run-time]

| Variable                      | Read by                 | Purpose                                                                                                                                                                                                                        | Example                                 |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `ORBBEC_STREAMER_STATUS_MODE` | `--live` status display | `dashboard` forces the full-screen status dashboard. `log` writes each status update to the log instead. When not set, the dashboard is used if stdout is a terminal, `TERM` is set and not `dumb`, and `NO_COLOR` is not set. | `ORBBEC_STREAMER_STATUS_MODE=log`       |
| `TERM`                        | `--live` status display | Unset or `dumb` turns the dashboard off                                                                                                                                                                                        | `TERM=xterm-256color`                   |
| `NO_COLOR`                    | `--live` status display | Any value turns the dashboard off                                                                                                                                                                                              | `NO_COLOR=1`                            |
| `DISPLAY`, `WAYLAND_DISPLAY`  | `--live` preview window | If neither is set, the server turns the preview window off and logs a warning                                                                                                                                                  | `DISPLAY=:0`                            |
| `LD_LIBRARY_PATH`             | dynamic loader          | Must include the TensorRT `lib` folder for a tar install, and `/usr/local/cuda/lib64` if CUDA is not in the loader's default paths                                                                                             | `LD_LIBRARY_PATH=/usr/local/cuda/lib64` |

Example: run the live pipeline with plain log output, for instance when you
redirect it to a file. From the `server/` folder:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
```

## Troubleshooting [#troubleshooting]

| Message                                                                                                                                                                                       | Fix                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to open live config: <path>`                                                                                                                                                          | The path is wrong or relative to another directory. Run from `server/` or pass an absolute path.                                                        |
| `Unsupported <section> key: <key>`                                                                                                                                                            | Typo or a key in the wrong section. Compare with the tables above.                                                                                      |
| `Encoding key appeared outside color/depth subsection: <key>`                                                                                                                                 | Unknown key under `encoding`, often a misspelt `gop_length`, `queue_capacity` or `gpu_ordinal`.                                                         |
| `Stream key appeared outside depth/color subsection`                                                                                                                                          | A `width`/`height`/`fps`/`format` line is not under `depth:` or `color:`.                                                                               |
| `Unsupported config section: <key>`                                                                                                                                                           | A header with no value that is not a known section.                                                                                                     |
| `Invalid integer value: <raw>` / `Invalid float value: <raw>`                                                                                                                                 | A number field has trailing text, for example `30fps`.                                                                                                  |
| `Invalid empty integer value` / `Invalid empty float value`                                                                                                                                   | A number field has no value.                                                                                                                            |
| `Invalid boolean value: <raw>`                                                                                                                                                                | Use `true`/`false`, `yes`/`no` or `1`/`0`.                                                                                                              |
| `stoul` or `stof`                                                                                                                                                                             | A number field starts with a non-digit, for example `fps: thirty`.                                                                                      |
| `live config must contain at least one camera`                                                                                                                                                | Add a `cameras` list item.                                                                                                                              |
| `sync.enabled=true requires exactly one primary camera`                                                                                                                                       | Set `role: primary` on exactly one camera.                                                                                                              |
| `Encoding currently requires matching color and depth FPS`                                                                                                                                    | Make `streams.color.fps` equal to `streams.depth.fps`.                                                                                                  |
| `processing.depth_filter_backend=bilateral_cuda requires streams.alignment color_to_depth or depth_to_color` / `encoding.enabled requires streams.alignment color_to_depth or depth_to_color` | Both need colour and depth at one size. Set `streams.alignment: color_to_depth`.                                                                        |
| `Bilateral depth filter: colour <w>x<h> does not match depth <w>x<h> (camera <id>)`                                                                                                           | The aligned colour (or mask) size differs from depth at run time. Use `streams.alignment: color_to_depth`.                                              |
| `Current RVM integration requires streams.alignment=color_to_depth`                                                                                                                           | Set `streams.alignment: color_to_depth`, or choose another mask backend.                                                                                |
| `Unsupported live mask backend: <name>` / `Unsupported live depth filter backend: <name>`                                                                                                     | Use a value from the `mask` or `processing` tables.                                                                                                     |
| `Cannot open TensorRT engine: <path>`                                                                                                                                                         | The RVM engine has not been built, or `rvm_engine_path` is relative to another directory.                                                               |
| `Depth quantization profile range does not match live config`                                                                                                                                 | The profile was made for another depth range. Recalibrate with `--force`, or delete the file to use the linear mapping.                                 |
| `No configured cameras are active; live mode cannot continue`                                                                                                                                 | No serial number matched a connected camera. Check the cables and `serial_number`; list devices with `./build/dev-debug/orbbec_streamer --orbbec-test`. |
| `GPU-output recording requires encoding.enabled=true`                                                                                                                                         | Enable encoding or set `record_gpu_outputs: false`.                                                                                                     |
| `Debug recording references unknown camera id: <id>`                                                                                                                                          | `debug_recording.camera_ids` must use the camera `id`s, not serial numbers.                                                                             |
