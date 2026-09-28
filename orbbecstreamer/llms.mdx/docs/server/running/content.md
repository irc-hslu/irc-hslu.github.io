# Run the server (https://irc-hslu.github.io/orbbecstreamer/docs/server/running)



`orbbec_streamer` is one binary with several modes. `--live` runs the full
pipeline: capture from the configured Orbbec cameras, GPU processing, NVENC
HEVC encoding, optional debug recording and terminal telemetry. The other
flags are checks for the hardware and the SDKs.

The live pipeline does not serve browsers yet. It encodes every bundle and
hands it to the debug recorder. See [Serve to browsers](./serving) for the
status of the WebTransport server.

## Before you start [#before-you-start]

* Build the server. The binary is `server/build/dev-debug/orbbec_streamer`
  (debug build) or `server/build/dev-relwithdebinfo/orbbec_streamer`
  (optimised build). Use the optimised build to measure latency.
* Run every command from `server/`. The config file and the paths inside it
  (`models/...`, `config/dev/...`, `debug/live`) are relative to the working
  directory.
* Check the config first; see [Configuration](./configuration).

### Adapt the config to your rig [#adapt-the-config-to-your-rig]

`config/dev/live.yaml` describes the development rig, not yours. As shipped
it:

* opens two cameras by the development rig's serial numbers, one as `primary`
  and one as `secondary` (serial numbers in these pages are placeholders)
* enables hardware sync for those two cameras (`sync.enabled: true`)
* uses `mask.backend: rvm` with the batch-2 RVM engine, which is not built by
  default
* records the GPU inputs and outputs, decodes the outputs locally, and writes
  all of it to `debug/live` (several MKV and HEVC files that keep growing
  while the server runs)

Make your own copy and edit it:

1. Copy the config into `config/local/`, which `server/.gitignore` ignores,
   so your rig's settings stay out of commits:

   ```bash
   cd server
   mkdir -p config/local
   cp config/dev/live.yaml config/local/live.yaml
   ```

2. Find your cameras' serial numbers. With the cameras connected, run
   `./build/dev-debug/orbbec_streamer --orbbec-test` and read the `serial`
   of each device.

3. In `cameras`, set one entry per camera with its `serial_number`. With
   hardware sync, give exactly one camera `role: primary` and the others
   `role: secondary`. Without a sync cable, or with one camera, set
   `sync.enabled: false`.

4. Choose the mask backend. Either build the RVM engine
   ([Install](./install#rvm-segmentation-engine-optional)) and point
   `mask.rvm_engine_path` at the engine whose batch size equals your number
   of cameras, or set `mask.backend: fill_all` to run without segmentation.

5. Decide on debug recording. To write nothing but `setup.json`, set
   `debug_recording.record_gpu_inputs: false` and
   `debug_recording.record_gpu_outputs: false`. Otherwise make sure
   `debug_recording.camera_ids` lists your camera `id`s and the disk has
   room.

The commands on this page use `config/dev/live.yaml`. Replace it with
`config/local/live.yaml` (or your own path) when you run them.

## Check the hardware [#check-the-hardware]

Run these before the first live run on a new machine. Each one prints its
result and exits.

```bash
cd server
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

`main10=true` and `encode_10bit=true` are required: depth is encoded as
10-bit HEVC.

With the cameras connected, check the SDK and synchronised capture:

```bash
./build/dev-debug/orbbec_streamer --orbbec-test
./build/dev-debug/orbbec_streamer --orbbec-live-sync-test --config config/dev/live.yaml
```

`--orbbec-test` lists every Orbbec device (id, name, model, serial,
firmware) and ends with `Orbbec provider smoke test OK`.
`--orbbec-live-sync-test` opens the cameras exactly as `--live` would, waits
for the warm-up, counts synchronised batches, and ends with
`PASS: production live configuration is synchronizing all cameras` (exit
code 0) or `FAIL: <reason>` (exit code 1).

## Command-line reference [#command-line-reference]

| Flag                      | Argument    | What it does                                                                                                                                                                                                                                         |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--live`                  | config file | Runs the live pipeline until stopped.                                                                                                                                                                                                                |
| `--calibrate-camera-pose` | none        | With `--live`: runs a camera-pose calibration from the local console and commits it. Needs `streams.alignment: color_to_depth`.                                                                                                                      |
| `--print-charuco-board`   | PNG path    | Writes the calibration board as a 300 dpi PNG and exits. Uses the board from `--live <config>` if given, else the defaults. Cannot be combined with `--calibrate-camera-pose`.                                                                       |
| `--cuda-test`             | none        | Prints the first CUDA device and runs a trivial kernel. It does not check whether the kernel launched, so it prints `CUDA smoke test OK` even when the build does not match your GPU. Use `ctest --test-dir build/dev-debug -L unit` to detect that. |
| `--nvenc-test`            | none        | Opens an NVENC session and prints the HEVC capabilities.                                                                                                                                                                                             |
| `--compression-test`      | none        | Placeholder: prints `Compression smoke test OK` and tests nothing.                                                                                                                                                                                   |
| `--websocket-test`        | none        | Placeholder: prints `WebSocket smoke test OK` and opens no socket.                                                                                                                                                                                   |
| `--orbbec-test`           | none        | Lists the connected Orbbec devices. Needs cameras.                                                                                                                                                                                                   |
| `--orbbec-capture-test`   | none        | Captures a few batches from all connected cameras through GPU upload (10 s timeout) and prints FPS telemetry. Needs cameras.                                                                                                                         |
| `--orbbec-live-sync-test` | none        | Checks synchronised capture with a live config. Needs cameras.                                                                                                                                                                                       |
| `--config`                | config file | Config for `--orbbec-live-sync-test` only. Default `config/dev/live.yaml`.                                                                                                                                                                           |
| `--warmup-s`              | seconds     | Warm-up before measuring, for `--orbbec-live-sync-test`. Default `5`.                                                                                                                                                                                |
| `--duration-s`            | seconds     | Measurement time, for `--orbbec-live-sync-test`. Default `10`.                                                                                                                                                                                       |
| `--minimum-rate-ratio`    | ratio       | Pass threshold: measured batch rate divided by the configured depth fps. Default `0.9`.                                                                                                                                                              |
| `-h`, `--help`            | none        | Prints the flags.                                                                                                                                                                                                                                    |

`--config` does not select the config for `--live`; `--live` takes the file
itself.

Exit codes: `0` success, `1` a run-time error (logged as
`orbbec-streamer failed: <reason>`), `2` an invalid flag combination, and a
CLI11 error code for a command-line parse error, for example `109` for an
unknown flag.

## Start the live pipeline [#start-the-live-pipeline]

```bash
cd server
./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
```

To keep a log file and the rate tables as plain log lines:

```bash
cd server
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-relwithdebinfo/orbbec_streamer --live config/dev/live.yaml 2>&1 | tee live.log
```

On an interactive terminal the rate tables are redrawn in place on a
separate screen. `ORBBEC_STREAMER_STATUS_MODE=log` prints them as ordinary
log lines instead; `=dashboard` forces the in-place display. See
[Read the telemetry](./telemetry).

## Expected result [#expected-result]

A healthy start with two synchronised cameras (abridged from a real run on
2026-09-26, updated for the current queue settings; recording paths shortened,
`mask.backend: fill_all`, no display):

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
Enabled Orbbec device clock synchronization after stream startup: interval_ms=60000
[info] wrote live setup metadata: debug/live/setup.json
[info] setup at startup: phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: ...) streaming=stopped metadata_revision=1
[info] live pipeline started: cameras=2 streams=2 alignment_mode=1 mask_backend=fill_all ...
[warning] no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview window
[info] pipeline latency, last 5 s (steady clock):
...
```

What to check:

* `live selected N active camera(s), neglected 0 camera(s)`: every configured
  camera was found.
* One `Configured Orbbec sync` line per camera: `mode=4` is the primary,
  `mode=8` a secondary.
* `live pipeline started`: capture, GPU processing and encoding are running.
* After about 6 s, the first rate table shows every stage at the configured
  frame rate and `0` drops.

With `mask.backend: rvm` an extra line starting `initialized TensorRT` appears
before the pipeline starts. With `run.preview: true` and a display, a preview
window opens when the first processed frame arrives; press `q` or `Esc` in it
to stop the server. The preview runs on its own thread and shows the newest
frame it can keep up with, so it never blocks capture, processing or
encoding. Without a
display, the warning `no DISPLAY or WAYLAND_DISPLAY is available; disabling
the live preview window` appears at that point instead, and the preview stays
off for the rest of the run.

`setup at startup: ... needs-setup` only means no camera-pose calibration is
committed yet. The pipeline still runs.

## Debug recording output [#debug-recording-output]

With `debug_recording.record_gpu_inputs` or `record_gpu_outputs` set, files go
to `debug_recording.directory` (default `debug/live`, relative to the working
directory). The server prints a `DEBUG RECORDING` table with every path when
recording starts.

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

In `per_camera` mode the encoded output goes to each camera's folder
(`cam0/gpu-output-*`) instead of `multicam/`. Folder names are the camera
`id`s from the config. `debug_recording.camera_ids` limits which cameras are
recorded. Recordings are closed when the server stops, so stop it with a
signal, not `kill -9`.

## Stop the server [#stop-the-server]

Press `Ctrl+C` in its terminal, or send `SIGTERM`:

```bash
pkill -TERM -f 'orbbec_streamer --live'
```

Both set a stop flag. The main loop checks it once per second, then stops
capture, upload, processing and encoding in that order, finishes the
recordings, and prints the session summary and the batcher and keyframe
totals. The last line is:

```text
[info] live stop requested; pipeline stopped cleanly
```

A worker error stops the server the same way, then logs
`orbbec-streamer failed: <reason>` and exits with code 1.

## Troubleshooting [#troubleshooting]

The Orbbec SDK writes its own log to `Log/OrbbecSDK.log.txt` in the working
directory. Look there first for camera errors.

| Symptom                                                                                                                                            | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orbbec-streamer failed: Request failed, device response with unknown error! propertyId: 1038` right after the first `Configured Orbbec sync` line | A camera rejected the multi-device sync configuration. The cameras are stuck in a bad sync state. Power-cycle every camera: disconnect power and USB, wait a few seconds, reconnect. Restarting the server does not help.                                                                                                                                                                                                           |
| `Orbbec synchronization role readback mismatch for camera <id>`                                                                                    | The camera did not accept its primary/secondary role. Check the sync cable and `cameras[].role`, then power-cycle the cameras.                                                                                                                                                                                                                                                                                                      |
| `neglecting missing camera: config_id=... serial='...'`                                                                                            | A configured camera was not found within `run.camera_wait_timeout_ms`. Check the USB connection and the serial with `--orbbec-test`. The server continues with the cameras it found, even for cameras with `required: true`.                                                                                                                                                                                                        |
| `No configured cameras are active; live mode cannot continue`                                                                                      | No configured camera was found. Same checks as above.                                                                                                                                                                                                                                                                                                                                                                               |
| `orbbec-streamer failed: camera capture stopped: [<id>: Orbbec capture error: ...]` while running                                                  | A camera failed or was unplugged. The server stops instead of running on a partial rig. Check its USB and power, then restart.                                                                                                                                                                                                                                                                                                      |
| `frame batcher dropped N frame set(s) without a match from every camera`                                                                           | Cameras deliver out of sync. Check the sync cable and roles; raise `sync.timestamp_tolerance_us` only if the skew is expected.                                                                                                                                                                                                                                                                                                      |
| `orbbec-streamer failed: processing (bilateral filter at depth WxH): Resolved bilateral radius exceeds maximum_radius_pixels` at start-up          | Lower `processing.bilateral_radius_ratio` or raise `bilateral_maximum_radius_pixels`.                                                                                                                                                                                                                                                                                                                                               |
| `Orbbec global timestamps are required ... not supported by camera`                                                                                | The camera firmware does not support global timestamps. Update the camera firmware.                                                                                                                                                                                                                                                                                                                                                 |
| `--cuda-test` prints `CUDA error: ...`                                                                                                             | No usable CUDA device or driver. Check `nvidia-smi`. `--cuda-test` still exits with code 0 in this case, so read its output.                                                                                                                                                                                                                                                                                                        |
| `orbbec-streamer failed: cudaMalloc failed: ...` or another `... failed: <CUDA error>`                                                             | CUDA failed during the run. Check `nvidia-smi` for the driver and free GPU memory.                                                                                                                                                                                                                                                                                                                                                  |
| `NvEncOpenEncodeSessionEx failed with NVENC status 10`                                                                                             | No NVENC session available (status 10 is `NV_ENC_ERR_OUT_OF_MEMORY`, which the driver also returns when its session limit is reached). The server opens 2 sessions in `concatenated_batch` mode and 2 per camera in `per_camera` mode. Stop other encoders (another `orbbec_streamer`, OBS, ffmpeg) and check `nvidia-smi --query-gpu=encoder.stats.sessionCount --format=csv`. Consumer GeForce drivers limit concurrent sessions. |
| `orbbec-streamer failed: Cannot open TensorRT engine: models/rvm/generated/...`                                                                    | `mask.backend: rvm`, but the engine file does not exist. Build it with `scripts/setup_rvm.py`, or set `mask.backend: fill_all` to run without segmentation. This error comes after the cameras are opened.                                                                                                                                                                                                                          |
| `--calibrate-camera-pose requires streams.alignment: color_to_depth`                                                                               | Set `streams.alignment: color_to_depth` in the config.                                                                                                                                                                                                                                                                                                                                                                              |
| `setup state not built: client-facing setup requires streams.alignment=color_to_depth`                                                             | Warning only. Capture and encoding run, but no client-facing setup state is built.                                                                                                                                                                                                                                                                                                                                                  |
| `no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview window`                                                                    | Warning only, on a headless machine. Set `run.preview: false` to silence it.                                                                                                                                                                                                                                                                                                                                                        |
| `upload queue full: dropped the oldest captured batch`, `processing queue full: ...` or `encode queue full: ...`                                   | A stage fell behind; its short queue dropped the oldest batch so the newest frames go on. See [Read the telemetry](./telemetry#troubleshooting).                                                                                                                                                                                                                                                                                    |
| `Failed to open live config: <path>`                                                                                                               | Wrong path. Run from `server/` or pass an absolute path.                                                                                                                                                                                                                                                                                                                                                                            |
