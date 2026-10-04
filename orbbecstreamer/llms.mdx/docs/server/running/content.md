# Run the server (https://irc-hslu.github.io/orbbecstreamer/docs/server/running)





`orbbec_streamer` is one program with several modes. `--live` runs the full
pipeline: it captures from the configured Orbbec cameras, processes the
frames on the GPU, encodes them as HEVC (H.265 video) with NVENC (the NVIDIA
hardware video encoder), and prints telemetry to the terminal. The other
flags check the hardware and the SDKs.

The live pipeline does not serve browsers yet. It encodes every frame and
passes the result to the debug recorder. See [Serve to browsers](./serving)
for the status of the WebTransport server.

## Before you start [#before-you-start]

You need:

* **A built server.** The program is
  `server/build/dev-debug/orbbec_streamer` (debug build) or
  `server/build/dev-relwithdebinfo/orbbec_streamer` (optimised build). Use
  the optimised build to measure latency.
* **The `server/` folder as working directory.** The config file and the
  paths inside it (`models/...`, `config/dev/...`, `debug/live`) are
  relative to the working directory. Every command on this page runs from
  `server/`.
* **A config for your cameras.** The shipped config describes the
  development rig. Adapt it as described below. All options are in
  [Configuration](./configuration).

### Adapt the config to your rig [#adapt-the-config-to-your-rig]

`config/dev/live.yaml` describes the development rig, not yours. As shipped,
it:

* opens two cameras by the development rig's serial numbers, one as
  `primary` and one as `secondary` (the serial numbers on these pages are
  placeholders)
* turns on hardware sync (a trigger cable between the cameras) for those two
  cameras with `sync.enabled: true`
* uses `mask.backend: rvm`: person segmentation with the RVM (Robust Video
  Matting) model, whose engine file is not built by default
* records the GPU inputs and outputs to `debug/live`, including a local
  decode of the outputs. These files keep growing while the server runs.

Make your own copy and edit it:

1. Copy the config into `config/local/`. Git ignores that folder, so your
   rig's settings stay out of commits. From the `server/` folder:

   ```bash
   mkdir -p config/local
   cp config/dev/live.yaml config/local/live.yaml
   ```

2. Find your cameras' serial numbers. Connect the cameras, then run this
   from the `server/` folder and note the `serial` of each device:

   ```bash
   ./build/dev-debug/orbbec_streamer --orbbec-test
   ```

3. In `cameras`, add one entry per camera with its `serial_number`.
   * With hardware sync, give exactly one camera `role: primary` and the
     others `role: secondary`.
   * Without a sync cable, or with one camera, set `sync.enabled: false`.

4. Choose the mask backend. Pick one:
   * Build the RVM engine
     ([Install](./install#rvm-segmentation-engine-optional)). Then point
     `mask.rvm_engine_path` at the engine whose batch size equals your
     number of cameras.
   * Set `mask.backend: fill_all` to run without segmentation.

5. Decide on debug recording.
   * To write only `setup.json`, set
     `debug_recording.record_gpu_inputs: false` and
     `debug_recording.record_gpu_outputs: false`.
   * To record, make sure `debug_recording.camera_ids` lists your camera
     `id`s and the disk has room.

The commands on this page use `config/dev/live.yaml`. Replace it with
`config/local/live.yaml` (or your own path) when you run them.

## Check the hardware [#check-the-hardware]

Run these checks before the first live run on a new machine. Each one prints
its result and exits.

1. Check CUDA and NVENC. From the `server/` folder:

   ```bash
   ./build/dev-debug/orbbec_streamer --cuda-test
   ./build/dev-debug/orbbec_streamer --nvenc-test
   ```

   Expected output on the development machine (RTX 4090, driver 580):

   ```text
   [2026-09-28 01:23:51.919] [info] orbbec-streamer starting
   [2026-09-28 01:23:51.919] [info] metadata: {"app":"orbbec-streamer","cuda_enabled":true,"nvenc_enabled":true,"version":"0.1.0"}
   CUDA devices: 1
   Device 0: NVIDIA GeForce RTX 4090
   Compute capability: 8.9
   CUDA smoke test OK
   ```

   ```text
   [2026-09-28 01:23:52.606] [info] NVENC GPU: ordinal=0 name='NVIDIA GeForce RTX 4090'
   [2026-09-28 01:23:52.606] [info] NVENC API: compiled=12.1 driver_max=13.0
   [2026-09-28 01:23:52.606] [info] NVENC HEVC: codec=true main=true main10=true nv12=true yuv420_10bit=true encode_10bit=true preset_p1=true
   [2026-09-28 01:23:52.606] [info] NVENC maximum HEVC resolution: 8192x8192
   [2026-09-28 01:23:52.606] [info] NVENC capability test passed
   ```

   `main10=true` and `encode_10bit=true` are required, because depth is
   encoded as 10-bit HEVC.

2. Connect the cameras, then check the Orbbec SDK and synchronised capture.
   From the `server/` folder:

   ```bash
   ./build/dev-debug/orbbec_streamer --orbbec-test
   ./build/dev-debug/orbbec_streamer --orbbec-live-sync-test --config config/dev/live.yaml
   ```

   * `--orbbec-test` lists every Orbbec device (id, name, model, serial,
     firmware). It ends with `Orbbec provider smoke test OK`.
   * `--orbbec-live-sync-test` opens the cameras exactly as `--live` would.
     It waits for a warm-up, counts synchronised batches (one frame set from
     every camera), and ends with one of these:
     * `PASS: production live configuration is synchronizing all cameras`
       and exit code 0
     * `FAIL: <reason>` and exit code 1

## Start the live pipeline [#start-the-live-pipeline]

1. From the `server/` folder, start the server with your config:

   ```bash
   ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
   ```

2. Watch the start-up log. Compare it with the
   [expected result](#expected-result) below.

3. After about 6 s the rate tables appear. Every stage should run at the
   configured frame rate with `0` drops. See
   [Read the telemetry](./telemetry).

On an interactive terminal the rate tables are redrawn in place on a
separate screen. To keep a log file with every table as a plain log line,
start the server like this instead:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-relwithdebinfo/orbbec_streamer --live config/dev/live.yaml 2>&1 | tee live.log
```

`ORBBEC_STREAMER_STATUS_MODE=dashboard` forces the in-place display. See
[Environment variables](./configuration#environment-variables).

## Expected result [#expected-result]

This is a healthy start with two synchronised cameras. It is abridged from a
real run, with recording paths shortened, `mask.backend: fill_all` and no
display:

```text
[info] orbbec-streamer starting
[info] depth quantization profile not found at 'config/dev/depth-quantization.json'; using linear 10-bit mapping over [500,5000] mm
[info] live config: cameras=2 wait_timeout_ms=5000 preview=true
[info] live streams: depth=640x576@15 depth_u16 color=1280x720@15 rgb8
[info] live encoding: enabled=true mode=concatenated_batch gpu=0 queue=2 gop=60 depth_quantization=linear ...
[info] waiting up to 5000 ms for configured Orbbec cameras
[info] active camera: config_id=cam0 serial=CL8K0000000A name='Orbbec Femto Bolt' firmware='1.1.2'
[info] active camera: config_id=cam1 serial=CL8K0000000B name='Orbbec Femto Bolt' firmware='1.1.2'
[info] live selected 2 active camera(s), neglected 0 camera(s)
[info] live queues: capacity=2 per GPU stage (drop oldest), encode=2, upload slots=41
Configured Orbbec sync: camera=orbbec:CL8K0000000A mode=4 depth_delay_us=0 ... global_timestamp=enabled
Configured Orbbec sync: camera=orbbec:CL8K0000000B mode=8 depth_delay_us=160 ... global_timestamp=enabled
Enabled Orbbec device clock synchronization after stream startup: interval_ms=0 (0: once)
[info] wrote live setup metadata: debug/live/setup.json
[info] setup at startup: phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: ...) streaming=stopped metadata_revision=1
[info] live pipeline started: cameras=2 streams=2 alignment_mode=1 mask_backend=fill_all ...
[warning] no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview window
[info] pipeline latency, last 5 s (steady clock):
...
```

Check these lines:

* `live selected N active camera(s), neglected 0 camera(s)`: the server
  found every configured camera.
* One `Configured Orbbec sync` line per camera: `mode=4` is the primary,
  `mode=8` a secondary.
* `live pipeline started`: capture, GPU processing and encoding are running.
* After about 6 s, the first rate table shows every stage at the configured
  frame rate and `0` drops.

Other lines you may see:

* **`initialized TensorRT`**: printed before the pipeline starts when
  `mask.backend: rvm` is set.
* **A preview window**: opens when the first processed frame arrives, if
  `run.preview: true` and a display is available. Press `q` or `Esc` in it
  to stop the server. The preview runs on its own thread and shows the
  newest frame it can keep up with, so it never slows capture, processing or
  encoding. It shows the first camera in three panels: the colour image
  aligned to depth, the filtered depth as a colour map, and the foreground
  mask (all white with `mask.backend: fill_all`). Colour is black wherever
  the camera measured no depth.

  <img alt="Live preview window: aligned colour, filtered depth and mask panels of the first camera" src="__img0" />
* **`no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview
  window`**: printed instead of opening the preview on a machine without a
  display. The preview stays off for the rest of the run.
* **`setup at startup: ... needs-setup`**: no camera-pose calibration is
  saved yet. The pipeline still runs.

## Debug recording output [#debug-recording-output]

With `debug_recording.record_gpu_inputs` or `record_gpu_outputs` set, the
server writes files to `debug_recording.directory` (default `debug/live`,
relative to the working directory). When recording starts, it prints a
`DEBUG RECORDING` table with every path.

```text
debug/live/
  setup.json                        always written, even with recording off
  cam0/gpu-input-color.mkv          record_gpu_inputs: colour entering the GPU (FFV1)
  cam0/gpu-input-depth.mkv          record_gpu_inputs: depth entering the GPU (FFV1, 16-bit)
  cam1/...
  multicam/                         encoded output in concatenated_batch mode
    gpu-output-layout.json          tile layout and depth packing
    gpu-output-color.hevc           record_gpu_outputs, no local decode: raw HEVC (Annex B)
    gpu-output-depth.hevc
    gpu-output-color.mkv            locally_decode_gpu_outputs: decoded colour (FFV1)
    gpu-output-depth.mkv            decoded 10-bit depth codes (FFV1)
    gpu-output-depth-inferno.mkv    depth as a colour map, 500-3000 mm
```

FFV1 is a lossless video codec, so the `.mkv` inputs hold the exact frames.
Annex B is the plain HEVC byte-stream format.

* In `per_camera` mode the encoded output goes to each camera's folder
  (`cam0/gpu-output-*`) instead of `multicam/`.
* Folder names are the camera `id`s from the config.
* `debug_recording.camera_ids` limits which cameras are recorded.
* The server closes the recordings when it stops. Stop it with a signal, as
  described below, not with `kill -9`.

## Stop the server [#stop-the-server]

1. Press `Ctrl+C` in the server's terminal. From another terminal you can
   send `SIGTERM` instead:

   ```bash
   pkill -TERM -f 'orbbec_streamer --live'
   ```

2. Wait a few seconds. The server checks for a stop request once per second.
   It then stops capture, upload, processing and encoding in that order,
   closes the recordings, and prints the session summary and the batcher and
   keyframe totals.

Expected result: the last line is

```text
[info] live stop requested; pipeline stopped cleanly
```

If a worker thread or a camera fails, the server stops the same way, then
logs `orbbec-streamer failed: <reason>` and exits with code 1, even when the
failure comes in the last second before a requested stop.

`Ctrl+C` while the server is still waiting for its cameras ends it at once
with `live stop requested while waiting for cameras; nothing started`.

## Troubleshooting [#troubleshooting]

The Orbbec SDK writes its own log to `Log/OrbbecSDK.log.txt` in the working
directory. Look there first for camera errors.

| Symptom                                                                                                                                            | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orbbec-streamer failed: Request failed, device response with unknown error! propertyId: 1038` right after the first `Configured Orbbec sync` line | A camera rejected the multi-camera sync settings and is stuck in a bad sync state. This also happens after the server was killed (`kill -9`) while the cameras were streaming. Power-cycle every camera: disconnect power and USB, wait a few seconds, reconnect. Restarting the server does not help.                                                                                                                                                                                                            |
| `Orbbec synchronization role readback mismatch for camera <id>`                                                                                    | The camera did not accept its primary or secondary role. Check the sync cable and `cameras[].role`, then power-cycle the cameras.                                                                                                                                                                                                                                                                                                                                                                                 |
| `neglecting missing camera: config_id=... serial='...'`                                                                                            | The server did not find a configured camera within `run.camera_wait_timeout_ms`. Check the USB connection, and check the serial with `--orbbec-test`. The server continues with the cameras it found, even for cameras with `required: true`.                                                                                                                                                                                                                                                                     |
| `No configured cameras are active; live mode cannot continue`                                                                                      | The server found no configured camera. Do the same checks as above.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `orbbec-streamer failed: camera capture stopped: [<id>: Orbbec capture error: ...]` while running                                                  | A camera failed or was unplugged. The server stops instead of running with some cameras missing. Check the camera's USB and power, then restart.                                                                                                                                                                                                                                                                                                                                                                  |
| `orbbec-streamer failed: camera capture stopped: [<id>: no frame set for N ms]`                                                                    | That camera delivered nothing for more than 5 s without reporting an error, for example after a firmware hang or a USB fault. The server stops instead of waiting for it forever. Check the camera's USB and power, then restart; if it keeps happening, power-cycle the camera.                                                                                                                                                                                                                                  |
| `frame batcher dropped N frame set(s) without a match from every camera`                                                                           | About one drop per camera every 20–30 s is normal. Each Femto Bolt's colour sensor runs about 0.25 % slower than its depth sensor, so every few hundred frames the camera has no colour frame for one depth frame. The SDK drops that depth frame, and the other cameras' frame sets for that moment have no partner. Drops more often than that, or in bursts, mean the cameras deliver out of sync: check the sync cable and roles. Raise `sync.timestamp_tolerance_us` only if you expect the time difference. |
| `orbbec-streamer failed: processing (bilateral filter at depth WxH): Resolved bilateral radius exceeds maximum_radius_pixels` at start-up          | Lower `processing.bilateral_radius_ratio` or raise `bilateral_maximum_radius_pixels`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Orbbec global timestamps are required ... not supported by camera`                                                                                | The camera firmware does not support global timestamps. Update the camera firmware.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `--cuda-test` prints `CUDA error: ...`                                                                                                             | No usable CUDA device or driver. Check `nvidia-smi`. `--cuda-test` still exits with code 0 in this case, so read its output.                                                                                                                                                                                                                                                                                                                                                                                      |
| `orbbec-streamer failed: cudaMalloc failed: ...` or another `... failed: <CUDA error>`                                                             | CUDA failed during the run. Check the driver and free GPU memory with `nvidia-smi`.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `NvEncOpenEncodeSessionEx failed with NVENC status 10`                                                                                             | No NVENC session is available. Status 10 is `NV_ENC_ERR_OUT_OF_MEMORY`, which the driver also returns when its session limit is reached. The server opens 2 sessions in `concatenated_batch` mode and 2 per camera in `per_camera` mode. Stop other encoders (another `orbbec_streamer`, OBS, ffmpeg) and check `nvidia-smi --query-gpu=encoder.stats.sessionCount --format=csv`. Consumer GeForce drivers limit concurrent sessions.                                                                             |
| `orbbec-streamer failed: Cannot open TensorRT engine: models/rvm/generated/...`                                                                    | `mask.backend: rvm` is set, but the engine file does not exist. Build it with `scripts/setup_rvm.py`, or set `mask.backend: fill_all` to run without segmentation. This error comes after the cameras are opened.                                                                                                                                                                                                                                                                                                 |
| `--calibrate-camera-pose requires streams.alignment: color_to_depth`                                                                               | Set `streams.alignment: color_to_depth` in the config.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `setup state not built: client-facing setup requires streams.alignment=color_to_depth`                                                             | Warning only. Capture and encoding run, but the server builds no setup state for clients.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `the preview window did not close within 2 s (is the display server answering?); exiting without waiting for it`                                   | The display server stopped answering, so the preview window could not close. The server has already stopped the cameras and every stage and written its summary; it then exits without the window. Check that `DISPLAY` points to a running display server, or set `run.preview: false`.                                                                                                                                                                                                                          |
| `no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview window`                                                                    | Warning only, on a machine without a display. Set `run.preview: false` to silence it.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `upload queue full: dropped the oldest captured batch`, `processing queue full: ...` or `encode queue full: ...`                                   | A stage fell behind. Its short queue dropped the oldest batch so that the newest frames go on. See [Read the telemetry](./telemetry#troubleshooting).                                                                                                                                                                                                                                                                                                                                                             |
| `Failed to open live config: <path>`                                                                                                               | The path is wrong. Run from `server/` or pass an absolute path.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Command-line reference [#command-line-reference]

| Flag                      | Argument    | What it does                                                                                                                                                                                                                                         |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--live`                  | config file | Runs the live pipeline until stopped.                                                                                                                                                                                                                |
| `--calibrate-camera-pose` | none        | With `--live`: runs a camera-pose calibration from the local console and saves it. Needs `streams.alignment: color_to_depth`.                                                                                                                        |
| `--print-charuco-board`   | PNG path    | Writes the calibration board (a ChArUco board: a chessboard with markers) as a 300 dpi PNG and exits. Uses the board from `--live <config>` if given, else the defaults. Cannot be combined with `--calibrate-camera-pose`.                          |
| `--cuda-test`             | none        | Prints the first CUDA device and runs a trivial kernel. It does not check whether the kernel launched, so it prints `CUDA smoke test OK` even when the build does not match your GPU. Run `ctest --test-dir build/dev-debug -L unit` to detect that. |
| `--nvenc-test`            | none        | Opens an NVENC session and prints the HEVC capabilities.                                                                                                                                                                                             |
| `--compression-test`      | none        | Placeholder: prints `Compression smoke test OK` and tests nothing.                                                                                                                                                                                   |
| `--websocket-test`        | none        | Placeholder: prints `WebSocket smoke test OK` and opens no socket.                                                                                                                                                                                   |
| `--orbbec-test`           | none        | Lists the connected Orbbec devices. Needs cameras.                                                                                                                                                                                                   |
| `--orbbec-capture-test`   | none        | Captures a few batches from all connected cameras through GPU upload (10 s timeout) and prints frame rates. Needs cameras.                                                                                                                           |
| `--orbbec-live-sync-test` | none        | Checks synchronised capture with a live config. Needs cameras.                                                                                                                                                                                       |
| `--config`                | config file | Config for `--orbbec-live-sync-test` only. Default `config/dev/live.yaml`.                                                                                                                                                                           |
| `--warmup-s`              | seconds     | Warm-up before measuring, for `--orbbec-live-sync-test`. Default `5`.                                                                                                                                                                                |
| `--duration-s`            | seconds     | Measurement time, for `--orbbec-live-sync-test`. Default `10`.                                                                                                                                                                                       |
| `--minimum-rate-ratio`    | ratio       | Pass threshold: measured batch rate divided by the configured depth frame rate. Default `0.9`.                                                                                                                                                       |
| `-h`, `--help`            | none        | Prints the flags.                                                                                                                                                                                                                                    |

`--config` does not select the config for `--live`. `--live` takes the file
itself.

Exit codes:

* `0`: success
* `1`: a run-time error, logged as `orbbec-streamer failed: <reason>`
* `2`: an invalid flag combination
* a CLI11 error code for a command-line parse error, for example `109` for an
  unknown flag
