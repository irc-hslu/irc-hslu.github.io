# Run the server (https://irc-hslu.github.io/orbbecstreamer/docs/server/running)





`orbbec_streamer --live <config>` runs the full pipeline: capture from the configured Orbbec cameras, GPU processing, NVENC HEVC encoding and terminal telemetry. The other flags check the hardware and the SDKs. The live pipeline serves browsers only with `serving.enabled: true`: the control plane to every session, and each bundle's media streams to the sessions subscribed to it (see [Serve to browsers](./serving)). Encoded bundles also go to the debug recorder when it is on.

## Before you start [#before-you-start]

* **A built server**: `build/dev-debug/orbbec_streamer`, or `build/dev-relwithdebinfo/orbbec_streamer` for latency measurements. See [Build and test](./build).
* **`server/` as working directory.** The config and the paths inside it are relative to it. Every command on this page runs from `server/`.
* **A config for your cameras**, adapted as below. All keys are in [Configuration](./configuration).

### Adapt the config to your rig [#adapt-the-config-to-your-rig]

As shipped, `config/dev/live.yaml` describes the development rig: two cameras by serial number (one `primary`, one `secondary`), hardware sync on, capture at 30 fps and stream at 15, `mask.backend: rvm` (its engine is not built by default), and GPU input and output recording to `debug/live`, which grows while the server runs.

1. Copy it into `config/local/`, which Git ignores:

   ```bash
   mkdir -p config/local
   cp config/dev/live.yaml config/local/live.yaml
   ```

2. Connect the cameras and note each device's `serial`:

   ```bash
   ./build/dev-debug/orbbec_streamer --orbbec-test
   ```

3. In `cameras`, add one entry per camera with its `serial_number`. With more than one camera, hardware sync is required: connect the sync cables, set `sync.enabled: true` and give exactly one camera `role: primary`. With a single camera set `sync.enabled: false`.

4. Choose the mask: keep `mask.backend: rvm` and point `mask.rvm_onnx_path` at the exported ONNX files ([Install](./install#rvm-segmentation-engine-optional)); the server builds the engine for your camera count on the first start, 3 to 4 minutes, while masks pass through ([details](./configuration#the-rvm-engine-cache)). Or set `mask.backend: fill_all`.

5. Decide on recording: set `debug_recording.record_gpu_inputs` and `record_gpu_outputs` to `false` to write only `setup.json`, or make sure `debug_recording.camera_ids` lists your camera `id`s and the disk has room.

The commands below use `config/dev/live.yaml`; substitute your copy.

## Check the hardware [#check-the-hardware]

Run these once on a new machine. Each prints its result and exits.

1. CUDA and NVENC:

   ```bash
   ./build/dev-debug/orbbec_streamer --cuda-test
   ./build/dev-debug/orbbec_streamer --nvenc-test
   ```

   `--cuda-test` ends with `CUDA smoke test OK`, `--nvenc-test` with `NVENC capability test passed`. `main10=true` and `encode_10bit=true` are required, because depth is 10-bit HEVC. Full output in [Build and test](./build#expected-result).

2. The Orbbec SDK and synchronised capture, with the cameras connected:

   ```bash
   ./build/dev-debug/orbbec_streamer --orbbec-test
   ./build/dev-debug/orbbec_streamer --orbbec-live-sync-test --config config/dev/live.yaml
   ```

   `--orbbec-test` lists every device (id, name, model, serial, firmware) and ends with `Orbbec provider smoke test OK`. `--orbbec-live-sync-test` opens the cameras as `--live` would, counts synchronised batches after a warm-up and ends with `PASS: production live configuration is synchronizing all cameras` (exit 0) or `FAIL: <reason>` (exit 1).

## Start the live pipeline [#start-the-live-pipeline]

1. Start the server:

   ```bash
   ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
   ```

2. Compare the start-up log with the [expected result](#expected-result).

3. After about 6 s the rate tables appear. `capture` runs at the capture rate, `upload` and `process` at the stream rate, `encode` at cameras × stream rate, all with `0` drops. See [Read the telemetry](./telemetry). With `mask.backend: rvm`, a `mask: ready, pass-through batches 0` line follows the table; `building` or `failed` means masks pass every pixel ([details](./configuration#the-rvm-engine-cache)).

On an interactive terminal the tables are redrawn in place. To keep every table in a log file instead:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-relwithdebinfo/orbbec_streamer --live config/dev/live.yaml 2>&1 | tee live.log
```

## Expected result [#expected-result]

A healthy start with two synchronised cameras, capture 30 / stream 15, `mask.backend: fill_all` and no display (abridged):

```text
[info] depth quantization profile not found at 'config/dev/depth-quantization.json'; using linear 10-bit mapping over [500,5000] mm
[info] live config: cameras=2 wait_timeout_ms=5000 preview=true
[info] live streams: depth=640x576@30 depth_u16 color=1280x720@30 rgb8
[info] live encoding: enabled=true mode=concatenated_batch gpu=0 queue=2 gop=60 depth_quantization=linear ...
[info] active camera: config_id=cam0 serial=CL8K0000000A name='Orbbec Femto Bolt' firmware='1.1.2'
[info] active camera: config_id=cam1 serial=CL8K0000000B name='Orbbec Femto Bolt' firmware='1.1.2'
[info] live selected 2 active camera(s), neglected 0 camera(s)
[info] live queues: capacity=2 per GPU stage (drop oldest), encode=2, upload slots=41
[info] frame rate: capture 30 fps, stream 15 fps (1 of every 2 captured batches goes on)
Configured Orbbec sync: camera=orbbec:CL8K0000000A mode=4 depth_delay_us=0 ... global_timestamp=enabled
Configured Orbbec sync: camera=orbbec:CL8K0000000B mode=8 depth_delay_us=160 ... global_timestamp=enabled
Enabled Orbbec device clock synchronization after stream startup: interval_ms=0 (0: once)
[info] wrote live setup metadata: debug/live/setup.json
[info] setup at startup: phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: ...) streaming=stopped metadata_revision=1
[info] live pipeline started: cameras=2 streams=2 alignment_mode=1 mask_backend=fill_all ...
[warning] no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview window
```

What to check:

* `neglected 0 camera(s)`: every configured camera was found.
* One `Configured Orbbec sync` line per camera: `mode=4` is the primary, `mode=8` a secondary.
* `live pipeline started`: capture, processing and encoding run.
* `setup at startup: ... needs-setup`: no camera-pose calibration saved yet; the pipeline runs anyway. See [Camera pose calibration](./camera-calibration).

With `run.preview: true` and a display, a preview window opens at the first processed frame. It shows the first camera: aligned colour, filtered depth as a colour map, and the mask (all white with `fill_all`). Colour is black where the camera measured no depth. Press `q` or `Esc` in it to stop the server. The preview runs on its own thread and never slows the pipeline.

<img alt="Live preview window: aligned colour, filtered depth and mask panels of the first camera" src="__img0" />

## Debug recording output [#debug-recording-output]

With `record_gpu_inputs` or `record_gpu_outputs` on, files go to `debug_recording.directory` (default `debug/live`) and the server prints a `DEBUG RECORDING` table with every path:

```text
debug/live/
  setup.json                        always written, even with recording off
  manifest.json                     record_gpu_outputs (raw .hevc): what the recording holds
  cam0/gpu-input-color.mkv          record_gpu_inputs: colour entering the GPU (FFV1)
  cam0/gpu-input-depth.mkv          record_gpu_inputs: depth entering the GPU (FFV1, 16-bit)
  cam0/gpu-output-layout.json       tile layout and depth packing
  cam0/gpu-output-color.hevc        record_gpu_outputs: raw HEVC (Annex B), per_camera
  cam0/gpu-output-depth.hevc
  multicam/                         the same files, in concatenated_batch mode
    gpu-output-layout.json
    gpu-output-color.hevc
    gpu-output-depth.hevc
    gpu-output-color.mkv            locally_decode_gpu_outputs: decoded colour (FFV1)
    gpu-output-depth.mkv            decoded 10-bit depth codes (FFV1)
    gpu-output-depth-inferno.mkv    depth as a colour map, 500-3000 mm
```

* FFV1 is lossless, so inputs hold the exact frames. Annex B is the plain HEVC byte stream.
* In `per_camera` mode encoded output goes to each camera's folder (`cam0/gpu-output-*`); in `concatenated_batch` mode it goes to `multicam/`.
* Folder names are the camera `id`s. A camera `id` that is not a valid folder name (empty, `.` or `..`, or containing `/` or `\`, or longer than 128 characters or 255 bytes) has no encoded output recorded; the server logs the reason at start. Its `record_gpu_inputs` files, if enabled, are still written, under a folder name with the invalid characters replaced by `_`.
* Recordings run at the stream rate.
* Recordings are closed at shutdown; stop the server with a signal, never `kill -9`.

### The recording manifest [#the-recording-manifest]

`manifest.json` lets a reader play the raw `.hevc` files without the server. It follows protocol change 0038 in the revision agreed on the branch `client/cr-0038-recording-manifest` (status: proposed; the text on `main` is an older draft, so the format can still change). It is written with the raw `.hevc` output only, not with `locally_decode_gpu_outputs`, and only when the client-facing setup exists (`streams.alignment: color_to_depth`). It holds, as of the recording start:

* server identity (`serverId`, `serverName`), `streamLayout` (`per-camera` or `concatenated`) and `frameRate` (the stream rate);
* `startCaptureTimeUs`, the capture time of frame set 0 (the first frame set the recorder was offered) in server monotonic microseconds;
* `cameras` (depth intrinsics and poses), `quantization` (including the 1024-entry LUT), `placement`, `calibrationRevision` and `metadataRevision`, in the same form as the live messages;
* `bundles`: for each bundle the camera ids, tiles, the relative paths of its colour and depth files, and its `segments`;
* `recording`: `state` and `droppedFrameSets`.

**Frame set index.** The recorder numbers the frame sets it is offered 0, 1, 2, and so on, before its queue, one per batch. A frame set the queue drops still uses its number; frame sets that were never streamed (capture-rate decimation) do not. The number is the same in every bundle, so it is how a reader lines the bundles up. It is not derived from timestamps.

**Segments.** Each bundle writes its colour and depth files independently. A file starts at the bundle's first frame set whose colour and depth are both IDR, and a `segment` records `firstFrameSetIndex` and, once closed, `accessUnits`. After a gap in a bundle (a dropped frame set, or a frame set without that bundle) the bundle discards frame sets until its own next IDR and starts a new segment. It does not wait for the other bundles, and the server never forces a keyframe for the recording. The frame sets a bundle discarded are the holes between its segments.

**Lifecycle.** The server writes the manifest when the recording starts, `in-progress`, with every bundle listed and empty `segments`, so a crash still leaves a manifest. It rewrites it each time a bundle starts a segment (the previous segment gets its `accessUnits`, the new one is open), before the new segment's first access unit is appended, so access units after a gap are never counted in the previous segment. At a clean shutdown it writes `complete`, with every segment closed, after flushing the `.hevc` files to disk. Each write goes to a temporary file in the same folder, is flushed and renamed over `manifest.json`, and the folder is flushed too, so a reader never sees half a manifest. A bundle that never reached an IDR has nothing to play: at a clean shutdown the server leaves it out of the final manifest, deletes its empty files and logs it. If no bundle reached an IDR, or the recorder failed, the manifest stays `in-progress`.

Because a recording can only start at an IDR, `debug_recording.record_gpu_outputs` is refused with `encoding.gop_length: 0`. A bundle waits up to one `gop_length` for its next IDR; after two GOPs without one the log warns (at most once per two GOPs and bundle).

A recording that starts before the setup state exists waits for it; those frame sets are not recorded. If the setup state never appears, no `manifest.json` is written and the log says so. A `manifest.json` left by an earlier run is removed when the server starts recording. A camera `id` is also refused when `<id>/gpu-output-color.hevc` is longer than 255 bytes; the other cameras still record.

## Stop the server [#stop-the-server]

1. Press `Ctrl+C`, or from another terminal:

   ```bash
   pkill -TERM -f 'orbbec_streamer --live'
   ```

2. Within a few seconds the server stops capture, upload, processing and encoding in that order, closes the recordings and prints the session summary and totals.

Expected last line: `[info] live stop requested; pipeline stopped cleanly`.

If a worker thread or a camera fails, the cameras stop the same way. Without a setup plane (`streams.alignment` other than `color_to_depth`) the server then logs `orbbec-streamer failed: <reason>` and exits with code 1. With one, it stays up with `capture` set to `failed` and the reason in the log and in `capture.message` (see [Cameras closed and capture start](./serving#cameras-closed-and-capture-start)); it does not retry by itself. A server started with `serving.start_capture_on_launch: false` keeps the cameras closed until a client asks for them, so no camera lines appear in the log before that. `Ctrl+C` while it still waits for cameras ends it at once with `live stop requested while waiting for cameras; nothing started`.

## Troubleshooting [#troubleshooting]

The Orbbec SDK logs to `Log/OrbbecSDK.log.txt` in the working directory; look there first for camera errors.

| Symptom                                                                                                                                                         | Cause and fix                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Request failed, device response with unknown error! propertyId: 1038` after the first `Configured Orbbec sync` line                                            | A camera rejected the multi-device sync settings and is stuck, often after a `kill -9` during streaming. Restarting the server does not help; power-cycle every camera (disconnect power and USB, wait, reconnect).                                                                                                                                    |
| `Orbbec synchronization role readback mismatch for camera <id>`                                                                                                 | The camera didn't accept its role. Check the sync cable and `cameras[].role`, then power-cycle.                                                                                                                                                                                                                                                        |
| `neglecting missing camera: config_id=... serial='...'`                                                                                                         | Not found within `run.camera_wait_timeout_ms`. Check USB and the serial with `--orbbec-test`. The server continues without it, even with `required: true`.                                                                                                                                                                                             |
| `No configured cameras are active; live mode cannot continue`                                                                                                   | No configured camera found. Same checks.                                                                                                                                                                                                                                                                                                               |
| `camera capture stopped: [<id>: Orbbec capture error: ...]`                                                                                                     | A camera failed or was unplugged; the server stops rather than run with cameras missing. Check USB and power, then restart.                                                                                                                                                                                                                            |
| `camera capture stopped: [<id>: no frame set for N ms (dropped before batching: I invalid timestamp, B backwards timestamp, J timestamp jump, A align failed)]` | No usable frame set for more than 5 s without an error. All counts 0: the camera delivered nothing (firmware hang, USB fault); check USB and power, power-cycle if it repeats. A high count: frames arrive but are dropped; `invalid timestamp` means no global timestamps (restart, then power-cycle), `align failed` points at the alignment filter. |
| `camera capture stopped: [no batch for N ms: the cameras' frame sets no longer match within the timestamp tolerance ...]`                                       | Every camera delivers but no batch formed for 5 s (10 s before the first): the timestamps disagree more than the batcher can follow. Check the sync cable and roles, restart; power-cycle if it persists.                                                                                                                                              |
| `camera capture stopped: [frame sets of different trigger slots matched by timestamp ...]`                                                                      | The frame counters disagree and the timestamps are too far apart to tell which frames belong together. The batch was not sent. A lost trigger alone is re-learned and does not stop the server. Check the sync cable and roles, then restart.                                                                                                          |
| `frame batcher dropped N frame set(s) without a match from every camera`                                                                                        | At 15 fps capture, about one drop per camera every 20 to 30 s is normal (the colour sensor skips a frame every 399). At 30 fps, drops after start-up point to sync or timestamps: check the sync cable and roles. See [Capture and synchronisation](./how-it-works/capture-and-sync#frame-batching).                                                   |
| `processing (bilateral filter at depth WxH): Resolved bilateral radius exceeds maximum_radius_pixels`                                                           | Lower `processing.bilateral_radius_ratio` or raise `bilateral_maximum_radius_pixels`.                                                                                                                                                                                                                                                                  |
| `Orbbec global timestamps are required ... not supported by camera`                                                                                             | Update the camera firmware.                                                                                                                                                                                                                                                                                                                            |
| `--cuda-test` prints `CUDA error: ...`                                                                                                                          | No usable CUDA device or driver; check `nvidia-smi`. It still exits 0, so read its output.                                                                                                                                                                                                                                                             |
| `cudaMalloc failed: ...` or another CUDA error                                                                                                                  | Check the driver and free GPU memory with `nvidia-smi`.                                                                                                                                                                                                                                                                                                |
| `NvEncOpenEncodeSessionEx failed with NVENC status 10`                                                                                                          | No NVENC session available (`NV_ENC_ERR_OUT_OF_MEMORY`, also returned at the driver's session limit). The server opens 2 sessions in `concatenated_batch`, 2 per camera in `per_camera`. Stop other encoders and check `nvidia-smi --query-gpu=encoder.stats.sessionCount --format=csv`.                                                               |
| `RVM engine` progress lines, and masks that keep everything                                                                                                     | The engine is building on first start (3 to 4 minutes). The `LIVE PIPELINE` table shows `mask: building, pass-through batches <n>`; wait for `built TensorRT engine` and `segmentation ready`. `mask: failed` means the build or load failed: read the `[error]` line.                                                                                 |
| `ONNX model not found: ...`                                                                                                                                     | `mask.rvm_onnx_path` does not point at an exported model. Export it with `scripts/setup_rvm.py --skip-engine-build` or use `fill_all`. The server keeps running with all-foreground masks; look for this `[error]` line and `mask: failed` in the stats.                                                                                               |
| `segmentation unavailable: ... Cannot open TensorRT engine: ...`                                                                                                | Only with the `mask.rvm_engine_path` override and a missing, incompatible or wrong-batch engine (a `live.yaml` kept from an older install). The server keeps running with all-foreground masks and `mask: failed` in the tables; remove `rvm_engine_path` and set `rvm_onnx_path` and `rvm_engine_cache_dir`, or use `fill_all`, then restart.         |
| `--calibrate-camera-pose requires streams.alignment: color_to_depth`                                                                                            | Set that alignment.                                                                                                                                                                                                                                                                                                                                    |
| `setup state not built: client-facing setup requires streams.alignment=color_to_depth`                                                                          | Warning only: the pipeline runs without a setup state.                                                                                                                                                                                                                                                                                                 |
| `the preview window did not close within 2 s ...; exiting without waiting for it`                                                                               | The display server stopped answering. The server has already stopped everything and written its summary. Check `DISPLAY` or set `run.preview: false`.                                                                                                                                                                                                  |
| `no DISPLAY or WAYLAND_DISPLAY is available; disabling the live preview window`                                                                                 | Warning only. Set `run.preview: false` to silence it.                                                                                                                                                                                                                                                                                                  |
| `upload queue full: ...`, `processing queue full: ...`, `encode queue full: ...`                                                                                | A stage fell behind and its queue dropped the oldest batch. See [Read the telemetry](./telemetry#troubleshooting).                                                                                                                                                                                                                                     |
| `Failed to open live config: <path>`                                                                                                                            | Run from `server/` or pass an absolute path.                                                                                                                                                                                                                                                                                                           |

## Command-line reference [#command-line-reference]

| Flag                                     | Argument    | What it does                                                                                                                                                                                |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--live`                                 | config file | Runs the live pipeline until stopped.                                                                                                                                                       |
| `--calibrate-camera-pose`                | none        | With `--live`: runs a camera-pose calibration from the local console and saves it.                                                                                                          |
| `--print-charuco-board`                  | PNG path    | Writes the calibration board as a 300 dpi PNG and exits. Uses the board from `--live <config>` if given. Not combinable with `--calibrate-camera-pose`.                                     |
| `--cuda-test`                            | none        | Prints the CUDA devices and launches a trivial kernel without checking the launch, so it prints `CUDA smoke test OK` even for a wrong GPU architecture; use `ctest -L unit` to detect that. |
| `--nvenc-test`                           | none        | Checks the NVENC HEVC features the server needs.                                                                                                                                            |
| `--compression-test`, `--websocket-test` | none        | Placeholders that print `... smoke test OK` and test nothing.                                                                                                                               |
| `--orbbec-test`                          | none        | Lists the connected Orbbec devices.                                                                                                                                                         |
| `--orbbec-capture-test`                  | none        | Captures from all connected cameras through GPU upload and prints frame rates.                                                                                                              |
| `--orbbec-live-sync-test`                | none        | Checks synchronised capture with a live config.                                                                                                                                             |
| `--config`                               | config file | Config for `--orbbec-live-sync-test` only. Default `config/dev/live.yaml`.                                                                                                                  |
| `--warmup-s`, `--duration-s`             | seconds     | Warm-up (`5`) and measurement time (`10`) for `--orbbec-live-sync-test`.                                                                                                                    |
| `--minimum-rate-ratio`                   | ratio       | Pass threshold: measured batch rate / configured depth fps. Default `0.9`.                                                                                                                  |
| `-h`, `--help`                           | none        | Prints the flags.                                                                                                                                                                           |

Exit codes: `0` success, `1` run-time error (`orbbec-streamer failed: <reason>`), `2` invalid flag combination, or a CLI11 parse error code (for example `109` for an unknown flag).
