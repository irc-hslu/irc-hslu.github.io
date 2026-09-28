# Depth quantization calibrator (https://irc-hslu.github.io/orbbecstreamer/docs/server/depth-quantization-calibrator)



The depth stream is HEVC Main10, so every depth pixel has to fit in one 10-bit
code. A **depth quantization profile** is the table that maps metric depth
(millimetres) to those codes and back. The server always has one:

* **Linear** (the default): the 1021 valid codes are spread evenly over
  `encoding.depth.minimum_depth_mm`..`maximum_depth_mm`. For the default
  500–5000 mm range one code step is about 4.4 mm.
* **Adaptive quantile**: codes are packed more densely at the depths your
  scene actually uses, so the quantization error is smaller where people are.

`orbbec_streamer_depth_quantization_calibrator` captures live depth for up to
60 seconds, builds a histogram of the masked, filtered foreground depth, and
writes an adaptive profile as JSON. The live server loads that file at
startup. Without the file, the server uses the linear profile, which is a
valid setting: this calibration is optional.

## Code layout [#code-layout]

Every profile uses the same code meanings. Clients decode only through the
table that the server sends (`protocol/wire-format.md` §8).

| Code        | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| `0`         | Invalid, or outside the foreground mask               |
| `1`         | Closer than `minimum_depth_mm`                        |
| `2`..`1022` | Valid depth: `depth_mm = reconstruction_lut_mm[code]` |
| `1023`      | Farther than `maximum_depth_mm`                       |

## How the adaptive profile is fitted [#how-the-adaptive-profile-is-fitted]

1. For the first `setup.warmup_seconds` nothing is collected.
2. For the rest of the run, the calibrator counts every depth pixel whose
   foreground mask value is at least `processing.bilateral_mask_threshold` and
   whose depth is inside the configured range. Invalid, too-close and too-far
   pixels are counted separately and are not used for the fit.
3. The histogram is mixed with a uniform distribution over the range. With
   `--uniform-mix 0.5`, about half the codebook still covers the whole range
   evenly and the other half follows your scene. `0` means fully
   data-driven and `1` means linear.
4. Code values are placed at the quantiles of that mixture. When the range
   has at least 1021 distinct millimetre values (500–5000 mm has 4501), every
   valid code gets its own reconstruction value, so no code is wasted.
5. The calibrator computes the expected mean absolute error of the adaptive
   profile and of the linear profile on the same histogram, and **saves the
   one with the lower error**. The result can therefore be `linear` even after
   a successful run.

The calibrator runs the same camera sync, GPU upload, foreground mask and
depth filter as the live server, but no encoder, preview or debug recording.
If `mask.backend` is `none` it uses `fill_all` (every pixel is foreground); if
`processing.depth_filter_backend` is `none` it passes depth through unfiltered.

## Run the calibrator [#run-the-calibrator]

The calibrator opens the cameras, so it needs the same hardware as a live run.

1. Build it. Work in the `server/` folder of your checkout:

   ```bash
   cd server
   cmake --build --preset debug --target orbbec_streamer_depth_quantization_calibrator
   ```

2. Stop any other process that uses the cameras, such as a running
   `orbbec_streamer --live`.

3. Make sure the cameras in `config/dev/live.yaml` are connected, and that
   the scene looks like a real session: people standing where they will stand
   during a call. Only foreground pixels are counted.

4. Run it from `server/` (relative paths in the config and the default
   `--config` value are resolved against the working directory):

   ```bash
   ./build/dev-debug/orbbec_streamer_depth_quantization_calibrator --config config/dev/live.yaml
   ```

   If a profile with a matching range already exists, the calibrator reuses it
   and exits without opening the cameras. To replace it, add `--force`:

   ```bash
   ./build/dev-debug/orbbec_streamer_depth_quantization_calibrator --config config/dev/live.yaml --force
   ```

5. Move around the capture area while it runs. Press Ctrl+C to stop early;
   the profile is still fitted from the samples collected so far.

6. Restart the live server. It reads the profile only at startup.

### Options [#options]

| Option            | Default                                    | Meaning                                                                                                |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `--config PATH`   | `config/dev/live.yaml`                     | Live YAML config. The file must exist.                                                                 |
| `--output PATH`   | `encoding.depth.quantization_profile_path` | Where to write the profile JSON. Parent folders are created.                                           |
| `--duration-s N`  | `setup.maximum_duration_seconds`           | Total run time in seconds, **including** warm-up. Must be 1–60 and larger than `setup.warmup_seconds`. |
| `--uniform-mix X` | `encoding.depth.adaptive_uniform_mix`      | Weight of the uniform prior, 0–1.                                                                      |
| `--force`         | off                                        | Recalibrate even if a compatible profile exists.                                                       |
| `-h`, `--help`    |                                            | Print the options and exit.                                                                            |

`--duration-s` and `--uniform-mix` are only checked when a calibration
actually runs; they are ignored when an existing profile is reused.

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

## Expected result [#expected-result]

When a compatible profile already exists (no cameras are opened):

```text
[info] using existing depth quantization profile: path='config/dev/depth-quantization.json' kind=adaptive_quantile range=500..5000 mm valid_samples=... calibration_mae_mm=... maximum_gap_mm=...
```

A new calibration logs the selected cameras, then a start line and a result
line of this form (numbers depend on your scene):

```text
[info] calibration camera: config_id=cam0 serial=CL8K0000000A physical_index=0 name='...'
[info] depth calibration started: total_duration_s=60 warmup_s=5 collection_s=55 range=500..5000 mm mask_threshold=32 output='config/dev/depth-quantization.json'
[info] depth calibration complete: path='config/dev/depth-quantization.json' selected=adaptive_quantile calibration_mae_mm(linear/selected)=.../... maximum_gap_mm=... valid_samples=... invalid=... below=... above=... frames=... rejected(upload/processing)=.../... upload_slot_drops=... quantiles_mm(p01/p05/p50/p95/p99)=.../.../.../.../...
```

`calibration_mae_mm(linear/selected)` compares the two profiles on your data.
`maximum_gap_mm` is the largest step between neighbouring codes, so it is the
worst-case resolution anywhere in the range.
`rejected(upload/processing)` counts captured batches that a full queue
dropped (the oldest one goes), and `upload_slot_drops` batches dropped because
every GPU upload slot was in use. Both only mean fewer samples; the profile is
still built from the rest.

### The profile file [#the-profile-file]

The output is snake_case JSON (server-internal; the wire form is camelCase,
see `protocol/wire-format.md` §8). Abbreviated:

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

On load the server checks the schema version, that entries 0, 1, 2, 1022 and
1023 are `0, min, min, max, max`, and that the table never decreases. It then
builds the 65,536-entry depth-to-code table once and uploads it to the GPU, so
encoding stays one lookup per pixel.

### What the live server shows [#what-the-live-server-shows]

At startup, `orbbec_streamer --live config/dev/live.yaml` logs one of:

```text
[info] loaded depth quantization profile: path='config/dev/depth-quantization.json' kind=adaptive_quantile range_mm=[500,5000] calibrated_samples=...
[info] depth quantization profile not found at 'config/dev/depth-quantization.json'; using linear 10-bit mapping over [500,5000] mm
```

The server's setup state reports the depth-quantization calibration as
`valid` when the file was loaded and `missing` ("using the linear default
profile") otherwise. Either way the server is ready: only the camera pose is
required (see [Camera pose calibration](./camera-calibration)). The profile
and its table are part of the setup metadata that clients receive; the
network listener that delivers it to browsers is not implemented yet. Running
a depth-quantization calibration from a client is also not supported yet (the
server rejects that calibration kind).

## Troubleshooting [#troubleshooting]

| Message or symptom                                                                                          | Cause and fix                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--config: File does not exist: config/dev/live.yaml`                                                       | You are not in `server/`. `cd server` or pass an absolute `--config`.                                                                                                                                                                                                                                                                                                         |
| `Existing depth profile range does not match live config; use --force to recalibrate`                       | You changed `minimum_depth_mm` or `maximum_depth_mm`. Run again with `--force`.                                                                                                                                                                                                                                                                                               |
| Live server exits with `Depth quantization profile range does not match live config: <path>`                | Same cause, seen by the live server; it does not fall back to linear. Recalibrate with `--force`, or delete the file to use the linear profile.                                                                                                                                                                                                                               |
| `Required camera is unavailable: cam0` or `No configured cameras are available for depth calibration`       | Check USB and power, the `serial_number` values in `cameras`, and that no other process holds the cameras. Raise `run.camera_wait_timeout_ms` if the cameras enumerate slowly.                                                                                                                                                                                                |
| `Depth calibration collected no valid masked in-range samples`                                              | Nothing in the foreground mask was inside the range. Put a person in view, check the depth range, lower `processing.bilateral_mask_threshold`, or make sure the run lasts longer than the warm-up.                                                                                                                                                                            |
| `Calibration duration must be in [1, 60] seconds` / `Calibration duration must exceed setup.warmup_seconds` | Fix `--duration-s` or the `setup` section.                                                                                                                                                                                                                                                                                                                                    |
| `Adaptive uniform mix must be in [0, 1]`                                                                    | Fix `--uniform-mix` or `encoding.depth.adaptive_uniform_mix`.                                                                                                                                                                                                                                                                                                                 |
| Error while loading the RVM engine                                                                          | `mask.backend: rvm` needs the TensorRT engine at `mask.rvm_engine_path`. Build it, or calibrate with `mask.backend: fill_all` (then background pixels are counted too).                                                                                                                                                                                                       |
| `selected=linear` after a run                                                                               | The adaptive table was not better on your data, for example with a very even depth spread or `--uniform-mix 1`. Nothing to fix.                                                                                                                                                                                                                                               |
| `config/dev/depth-quantization.json` appears in `git status`                                                | `server/.gitignore` ignores `config/*/depth-quantization.json`, so the file shows up only when it is already tracked because someone committed it. The file is specific to one room and camera setup. To stop tracking it, run `git rm --cached config/dev/depth-quantization.json`. To commit a new version on purpose, use `git add -f config/dev/depth-quantization.json`. |
