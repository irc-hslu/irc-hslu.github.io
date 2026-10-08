# Depth quantization calibrator (https://irc-hslu.github.io/orbbecstreamer/docs/server/depth-quantization-calibrator)



The depth quantization calibrator records live depth for up to 60 seconds and
fits the table that turns depth in millimetres into the 10-bit codes the
depth stream carries. A fitted table spends more codes on the depths your
scene uses, so depth is more precise where the people are.

This calibration is optional. Without it, the server spreads the codes
evenly over the depth range, which is a valid setting.

## Background [#background]

The depth stream is encoded as HEVC Main10, a video format with 10 bits per
pixel. So every depth pixel has to fit in one 10-bit code (0 to 1023). A
**depth quantization profile** is the lookup table (LUT) that maps
millimetres to codes and back. The server always uses one of two kinds:

* **Linear** (the default): the 1021 valid codes are spread evenly over
  `encoding.depth.minimum_depth_mm` to `maximum_depth_mm`. For the default
  500–5000 mm range, one code step is about 4.4 mm.
* **Adaptive quantile**: codes are packed more densely at the depths your
  scene actually uses, so the error is smaller where people are.

The calibrator writes an adaptive profile as a JSON file. The live server
loads that file at startup.

## Run the calibrator [#run-the-calibrator]

The calibrator opens the cameras, so it needs the same hardware as a live
run.

1. From the `server/` folder, build it:

   ```bash
   cmake --build --preset debug --target orbbec_streamer_depth_quantization_calibrator
   ```

2. Stop any other process that uses the cameras, such as a running
   `orbbec_streamer --live`.

3. Make sure the cameras in `config/dev/live.yaml` are connected. Set up the
   scene like a real session: people standing where they will stand during
   a call. Only foreground pixels (the pixels the mask marks as people) are
   counted.

4. From the `server/` folder, run it. Relative paths in the config are
   resolved against the working directory, so run it from there:

   ```bash
   ./build/dev-debug/orbbec_streamer_depth_quantization_calibrator --config config/dev/live.yaml
   ```

   If a profile with a matching depth range already exists, the calibrator
   reuses it and exits without opening the cameras. To replace it, add
   `--force`:

   ```bash
   ./build/dev-debug/orbbec_streamer_depth_quantization_calibrator --config config/dev/live.yaml --force
   ```

5. Move around the capture area while it runs. To stop early, press Ctrl+C;
   the profile is still fitted from the samples collected so far.

6. Restart the live server. It reads the profile only at startup.

## Expected result [#expected-result]

When a compatible profile already exists (no cameras are opened):

```text
[info] using existing depth quantization profile: path='config/dev/depth-quantization.json' kind=adaptive_quantile range=500..5000 mm valid_samples=... calibration_mae_mm=... maximum_gap_mm=...
```

A new calibration logs the selected cameras, then a start line and a result
line like these (numbers depend on your scene):

```text
[info] calibration camera: config_id=cam0 serial=CL8K0000000A physical_index=0 name='...'
[info] depth calibration started: total_duration_s=60 warmup_s=5 collection_s=55 range=500..5000 mm mask_threshold=32 output='config/dev/depth-quantization.json'
[info] depth calibration complete: path='config/dev/depth-quantization.json' selected=adaptive_quantile calibration_mae_mm(linear/selected)=.../... maximum_gap_mm=... valid_samples=... invalid=... below=... above=... frames=... rejected(upload/processing)=.../... upload_slot_drops=... quantiles_mm(p01/p05/p50/p95/p99)=.../.../.../.../...
```

How to read the result line:

* `calibration_mae_mm(linear/selected)` is the mean absolute error of the
  linear profile and of the saved profile, both on your data.
* `maximum_gap_mm` is the largest step between neighbouring codes: the
  worst-case depth resolution anywhere in the range.
* `rejected(upload/processing)` counts captured batches that a full queue
  dropped (the oldest one goes). `upload_slot_drops` counts batches dropped
  because every GPU upload buffer was in use. Both only mean fewer samples;
  the profile is still built from the rest.

When you restart the live server, it logs one of these lines:

```text
[info] loaded depth quantization profile: path='config/dev/depth-quantization.json' kind=adaptive_quantile range_mm=[500,5000] calibrated_samples=...
[info] depth quantization profile not found at 'config/dev/depth-quantization.json'; using linear 10-bit mapping over [500,5000] mm
```

### What the live server does with it [#what-the-live-server-does-with-it]

The server's setup state reports the depth-quantization calibration as
`valid` when the file was loaded, as `missing` ("using the linear default
profile") when there is no file, and as `stale` when a file exists but could
not be used. Either way the server is ready: only the camera pose is required
(see [Camera pose calibration](./camera-calibration)).

A file that cannot be used never stops the live server. This covers an
unknown `schema_version`, a file that does not parse, a table that fails the
checks below, and a range that differs from `minimum_depth_mm` and
`maximum_depth_mm`. The server logs one error that names the file and the
reason, falls back to the linear profile for the configured range, and reports
the calibration as `stale` with the same text. Recalibrate from the browser or
with this tool to replace the file. The tool itself stays strict: it refuses a
mismatched existing file unless you pass `--force`.

The profile and its table are part of the setup metadata that clients
receive. With `serving.enabled: true`, the control stream delivers it to
browsers (see [Serve to browsers](./serving)).

## Calibrate from the browser [#calibrate-from-the-browser]

A client that holds the setup lock can run the same calibration against the
running server, with no restart and no second process. The client sends
`client.calibration.start` with `kind: "depth-quantization"`. This is the path
the Operator Console's depth range screen uses.

1. **Take the setup lock.** Only the lock owner can start, cancel or commit.
2. **Start.** Have one person walk through the whole capture volume, near and
   far. The run uses the live pipeline: the same masked, filtered depth that
   the encoder sees, so the profile matches what is streamed.
3. **Watch the progress.** Only the lock owner receives
   `server.calibration.progress`, at most twice a second: `elapsedMs`,
   `validSampleCount`, `observedRangeMm`, `depthHistogram` (1024 bins, one per
   code of the profile in force) and `reconstructionErrorMm`. A field the
   server has not measured yet is `null`. The first `setup.warmup_seconds`
   collect nothing. The run ends by itself after `setup.maximum_duration_seconds`.
4. **Solved, awaiting commit.** The calibration stays `running` and its
   `message` reads `solved; awaiting commit`. No `server.calibration.result` is
   sent yet, and nothing is changed or saved.
5. **Commit.** The server writes the profile to
   `encoding.depth.quantization_profile_path` (atomically), raises the depth
   quantization revision and the calibration revision, and publishes in this
   order: `server.calibration.state` (`valid`), `server.calibration.result`
   with `accepted: true` and the new revision, then
   `server.metadata.revision-changed` and the new stream descriptors that
   carry the new profile.

Cancel, releasing the lock, a disconnect and an expired lease all abandon the
run: the calibration returns to the state it had before, nothing is written,
and no result is sent. A run that fails (for example, no depth was seen)
ends with `accepted: false` and a message; the profile in force is kept.

If the encoder ever refuses a committed profile (it checks what the server checked before saving, so this should not happen), the server keeps running, logs one error and reports the depth-quantization calibration as `stale` with the reason.

The commit takes effect on the live stream. The encoder switches to the new
table at the next frame set and starts that frame set with a keyframe, so a
viewer never decodes new codes with the old table. Handing the new streams
to viewers (wire-format §18 stream rotation) is not implemented yet, and no
session receives media until CR 0009, so today only the encoder and the
setup metadata change.

The server refuses to start a run with `calibration-unavailable` and a message
that says what to do when any of these hold:

| Reason                                                                                         | Fix                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mask.backend: rvm` and the mask engine is still being prepared or failed                      | Wait until the mask status is `ready` (see [Configuration](./configuration)), or fix the engine. Masks pass every pixel while the engine is not ready, which would put the background into the profile. `mask.backend: fill_all` is allowed: it counts all depth on purpose. |
| `mask.backend: none` or `processing.depth_filter_backend: none`                                | The run reads the mask and the filtered depth. Set `mask.backend` to `rvm` or `fill_all`, and the depth filter to anything but `none`, then restart. The server logs this once at startup, and a start gets the same text.                                                   |
| No capture is active                                                                           | The cameras are not delivering frames. Start the cameras first.                                                                                                                                                                                                              |
| The server was not started with `streams.alignment: color_to_depth`, or the GPU is unavailable | The client-facing setup plane is off. See the server log.                                                                                                                                                                                                                    |

The depth range is fixed by `encoding.depth.minimum_depth_mm` and
`maximum_depth_mm`. The profile keeps it, so a committed profile never
mismatches the configuration at the next start.

Collecting costs the stream nothing: the frame path only passes references to
the masks and depths of the current batch to a separate thread, drops a sample
rather than wait, and takes no GPU call. A run that is not collecting costs
nothing.

## Options [#options]

| Option            | Default                                    | Meaning                                                                                                                   |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `--config PATH`   | `config/dev/live.yaml`                     | Live YAML config. The file must exist.                                                                                    |
| `--output PATH`   | `encoding.depth.quantization_profile_path` | Where to write the profile JSON. Parent folders are created.                                                              |
| `--duration-s N`  | `setup.maximum_duration_seconds`           | Total run time in seconds, **including** warm-up. Must be 1–60 and larger than `setup.warmup_seconds`.                    |
| `--uniform-mix X` | `encoding.depth.adaptive_uniform_mix`      | Weight of the even spread in the fit, 0–1. See [How the adaptive profile is fitted](#how-the-adaptive-profile-is-fitted). |
| `--force`         | off                                        | Recalibrate even if a compatible profile exists.                                                                          |
| `-h`, `--help`    |                                            | Print the options and exit.                                                                                               |

`--duration-s` and `--uniform-mix` are only checked when a calibration
actually runs. They are ignored when an existing profile is reused.

### Config keys it reads [#config-keys-it-reads]

| Key                                                | Dev value                            | Use                                              |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `encoding.depth.minimum_depth_mm`                  | `500`                                | Lower end of the valid range.                    |
| `encoding.depth.maximum_depth_mm`                  | `5000`                               | Upper end of the valid range.                    |
| `encoding.depth.quantization_profile_path`         | `config/dev/depth-quantization.json` | Output file, and the file the live server loads. |
| `encoding.depth.adaptive_uniform_mix`              | `0.30`                               | Default for `--uniform-mix`.                     |
| `setup.maximum_duration_seconds`                   | `60`                                 | Default for `--duration-s` (1–60).               |
| `setup.warmup_seconds`                             | `5`                                  | Discarded start of the run.                      |
| `processing.bilateral_mask_threshold`              | `32`                                 | Minimum mask value (0–255) for a pixel to count. |
| `cameras`, `sync`, `streams`, `mask`, `processing` |                                      | Same meaning as for the live server.             |

## Code layout [#code-layout]

Every profile uses the same code meanings. Clients decode depth only through
the table that the server sends them.

| Code        | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| `0`         | Invalid, or outside the foreground mask               |
| `1`         | Closer than `minimum_depth_mm`                        |
| `2`..`1022` | Valid depth: `depth_mm = reconstruction_lut_mm[code]` |
| `1023`      | Farther than `maximum_depth_mm`                       |

## How the adaptive profile is fitted [#how-the-adaptive-profile-is-fitted]

The calibrator runs the same camera sync, GPU upload, foreground mask and
depth filter as the live server, but no encoder, preview or debug recording.
If `mask.backend` is `none`, it uses `fill_all` (every pixel is foreground).
If `processing.depth_filter_backend` is `none`, it uses depth unfiltered.

1. For the first `setup.warmup_seconds` nothing is collected.
2. For the rest of the run, the calibrator counts every depth pixel whose
   mask value is at least `processing.bilateral_mask_threshold` and whose
   depth is inside the configured range. It counts invalid, too-close and
   too-far pixels separately and does not use them for the fit.
3. It mixes this histogram with an even spread over the range. With
   `--uniform-mix 0.5`, about half the codes still cover the whole range
   evenly and the other half follow your scene. `0` means fully data-driven
   and `1` means linear.
4. It places the code values at the quantiles of that mixture. When the
   range has at least 1021 distinct millimetre values (500–5000 mm has
   4501\), every valid code gets its own depth value, so no code is wasted.
5. It computes the expected mean absolute error of the adaptive profile and
   of the linear profile on the same histogram, and **saves the one with the
   lower error**. So the result can be `linear` even after a successful run.

### The profile file [#the-profile-file]

The output is JSON with snake_case keys. It is a server-internal file; the
form clients receive is defined in `protocol/wire-format.md`. Abbreviated:

```text
{
  "schema_version": 1,
  "kind": "adaptive_quantile",            // or "linear"
  "minimum_depth_mm": 500,
  "maximum_depth_mm": 5000,
  "adaptive_uniform_mix": 0.3,
  "reserved_codes": { "invalid": 0, "below_minimum": 1, "first_valid": 2,
                      "last_valid": 1022, "above_maximum": 1023 },
  "calibration": { "valid_samples": ..., "invalid_samples": ...,
                   "below_minimum_samples": ..., "above_maximum_samples": ...,
                   "duration_seconds": ..., "p01_mm": ..., "p05_mm": ...,
                   "p50_mm": ..., "p95_mm": ..., "p99_mm": ...,
                   "linear_expected_mae_mm": ..., "selected_expected_mae_mm": ...,
                   "maximum_reconstruction_gap_mm": ... },
  "reconstruction_lut_mm": [0, 500, 500, ..., 5000, 5000]   // 1024 entries
}
```

On load, the server checks the schema version, that entries 0, 1, 2, 1022
and 1023 are `0, min, min, max, max`, and that the table never decreases.
It then builds the 65,536-entry depth-to-code table once and uploads it to
the GPU, so encoding stays one lookup per pixel.

## Troubleshooting [#troubleshooting]

| Message or symptom                                                                                                                     | Cause and fix                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--config: File does not exist: config/dev/live.yaml`                                                                                  | You are not in the `server/` folder. Change to it, or pass an absolute `--config` path.                                                                                                                                                                                                                                                 |
| `Existing depth profile range does not match live config; use --force to recalibrate`                                                  | You changed `minimum_depth_mm` or `maximum_depth_mm`. Run again with `--force`.                                                                                                                                                                                                                                                         |
| Live server logs `depth quantization profile <path> ... covers 500..5000 mm but the configuration says ...` or `... is unusable (...)` | The live server does not stop: it uses the linear profile for the configured range and reports the depth-quantization calibration as `stale`. Recalibrate from the browser or with `--force`, or delete the file.                                                                                                                       |
| A browser start is refused with `calibration-unavailable`                                                                              | The message names the cause; see [Calibrate from the browser](#calibrate-from-the-browser).                                                                                                                                                                                                                                             |
| A browser run fails with `no masked depth between ... was seen`                                                                        | Nobody was in view, or the mask found no one. Have a person walk through the volume and check the mask status.                                                                                                                                                                                                                          |
| `Required camera is unavailable: cam0` or `No configured cameras are available for depth calibration`                                  | Check USB and power, the `serial_number` values in `cameras`, and that no other process holds the cameras. Raise `run.camera_wait_timeout_ms` if the cameras take long to appear.                                                                                                                                                       |
| `Depth calibration collected no valid masked in-range samples`                                                                         | Nothing in the foreground mask was inside the range. Put a person in view, check the depth range, lower `processing.bilateral_mask_threshold`, or make the run longer than the warm-up.                                                                                                                                                 |
| `Calibration duration must be in [1, 60] seconds` or `Calibration duration must exceed setup.warmup_seconds`                           | Fix `--duration-s` or the `setup` section.                                                                                                                                                                                                                                                                                              |
| `Adaptive uniform mix must be in [0, 1]`                                                                                               | Fix `--uniform-mix` or `encoding.depth.adaptive_uniform_mix`.                                                                                                                                                                                                                                                                           |
| Error while loading or building the RVM engine                                                                                         | `mask.backend: rvm` needs the ONNX at `mask.rvm_onnx_path` (the tool builds a missing engine before it starts, 3 to 4 minutes the first time) or the `mask.rvm_engine_path` override. Fix the path, or calibrate with `mask.backend: fill_all` (then background pixels are counted too).                                                |
| `selected=linear` after a run                                                                                                          | The adaptive table was not better on your data, for example with a nearly even depth spread or `--uniform-mix 1`. Nothing to fix.                                                                                                                                                                                                       |
| `config/dev/depth-quantization.json` appears in `git status`                                                                           | `server/.gitignore` ignores `config/*/depth-quantization.json`, so the file shows up only if someone committed it. It is specific to one room and camera setup. To stop tracking it, run `git rm --cached config/dev/depth-quantization.json`. To commit a new version on purpose, run `git add -f config/dev/depth-quantization.json`. |
