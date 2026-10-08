# Camera pose calibration (https://irc-hslu.github.io/orbbecstreamer/docs/server/camera-calibration)





Camera pose calibration measures where each camera sits relative to the
others, so clients can merge all views into one 3D scene. You show a printed
board to the cameras, and the server saves one pose per camera to a file.

The server needs a valid camera pose before it offers media to clients. The
local pipeline (capture, GPU processing, encoding, debug recording) runs
with or without one.

## Before you start [#before-you-start]

You need:

* the server built (see [Build the server](./build)),
* the cameras connected, with no other process using them,
* `streams.alignment: color_to_depth` in the live config (the dev default),
* a printer for the board, and a flat, rigid backing to mount it on.

What is available today:

| Feature                                                                  | Status                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Print the board (`--print-charuco-board`)                                | Available                                                                                                                                                                                                                                                                                                                     |
| Calibrate from the server console (`--calibrate-camera-pose`)            | Available. Tested with synthetic cameras; not yet validated with a printed board on hardware.                                                                                                                                                                                                                                 |
| Load and check the saved calibration at startup                          | Available                                                                                                                                                                                                                                                                                                                     |
| Save the result safely, with a revision number                           | Available                                                                                                                                                                                                                                                                                                                     |
| Start, follow and commit a camera-pose calibration from a browser client | Available over the control stream when `serving.enabled: true` (see [Serve to browsers](./serving) and the [`serving` keys](./configuration#serving)). Camera-pose only: other calibration kinds are rejected with `calibration-kind-unsupported`. The browser gets no video yet, because media waits for CR 0009 (proposed). |
| `calibration.autocalibrate: true`                                        | With serving enabled and a missing or stale pose, a client that holds the setup lease may start a calibration. With `false`, only the local operator console can start one. It is forced to `false` when no calibration engine is available.                                                                                  |

## Print the board [#print-the-board]

The board is a **ChArUco board**: a chessboard whose white squares hold
ArUco markers (small black-and-white codes). The markers let the server
identify every corner, even when the board is only partly in view.

1. From the `server/` folder, write the board as a PNG, using the board
   settings from your config:

   ```bash
   ./build/dev-debug/orbbec_streamer --print-charuco-board board.png --live config/dev/live.yaml
   ```

   This command does not open the cameras. Without `--live`, it uses the
   built-in defaults, which are the same 7 × 5 board with 80 mm squares.
   The default board looks like this:

   <img alt="Default ChArUco calibration board: 7 × 5 squares with ArUco markers" src="__img0" />

2. Read the physical size from the log:

   ```text
   [info] wrote ChArUco board board.png: 7x5 squares of 80.0 mm (DICT_5X5_100), printed board 560 x 400 mm; print at 100 % scale and check a square with a ruler
   ```

3. Print the board at that size. The image is drawn at 300 dpi with one
   white square of margin on every side. The default image is therefore
   720 × 560 mm (8504 × 6614 pixels):

   * The whole image needs A1 paper (841 × 594 mm).
   * A2 (594 × 420 mm) fits only the 560 × 400 mm board, so crop the margin
     or print edge to edge.
   * The PNG carries no DPI information. Set the print size yourself so that
     the board, without the margin, measures the size in the log.

4. For a smaller printer, shrink the squares in the config and go back to
   step 1. For example, `square_length_m: 0.04` and `marker_length_m: 0.03`
   give a 280 × 200 mm board (360 × 280 mm with margin), which fits A3
   landscape. Hold a smaller board closer to the cameras: it is harder to
   detect at the 640 × 576 depth resolution.

5. Measure one printed square with a ruler. Put the measured size into
   `calibration.board.square_length_m`, and scale `marker_length_m` by the
   same factor. A wrong size does not stop detection, but every distance
   between cameras comes out scaled by the error.

6. Mount the print on something flat and rigid. A bent board makes the
   cameras disagree.

## Run a calibration [#run-a-calibration]

1. Stop any other process that uses the cameras, such as a running
   `orbbec_streamer --live`.

2. From the `server/` folder, start the live pipeline with the calibration
   flag:

   ```bash
   ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml --calibrate-camera-pose
   ```

   The server takes the **setup lock** (only one client, or the console, can
   change the setup at a time) and starts a calibration run. This works with
   `autocalibrate: false`, and it also replaces an existing valid pose.

3. Walk the board through the capture area:

   * Keep the board in view of at least two cameras at the same moment.
   * Move or tilt it between views. A view counts only if the board moved at
     least 2 cm or turned at least 3° since the last accepted view.
   * Tilt it rather than holding it face-on to a camera. The server rejects
     views where the board's pose is ambiguous.
   * Every camera needs at least 5 consistent views shared with a camera
     that is already placed. A camera that never sees the board together
     with the reference camera is placed through other cameras.

   The run needs 20 accepted views and gives up after 120 seconds.

4. Wait for the `committed` line in the log (see
   [Expected result](#expected-result)). The server then saves the poses,
   raises the revision by one and releases the setup lock. The live pipeline
   keeps running.

5. Stop the server with Ctrl+C. If you press Ctrl+C before the result is
   saved, the previous calibration file stays untouched.

## Expected result [#expected-result]

While the run is going, a progress line appears every 5 seconds:

```text
[info] local camera-pose calibration running: show the 7x5 ChArUco board (0.08 m squares, DICT_5X5_100) so that at least two cameras see it at once, and move it between views
[info] camera-pose calibration run 1: 3/20 observations after 0 s; cam0=24 corners cam1=24 corners
```

`cam1=no board` means that camera does not see the board in the current
frame.

A successful run ends like this (numbers from a synthetic test rig):

```text
[info] camera-pose calibration run 1 solved
[info] camera-pose calibration committed: revision 1
[info]   cam0 serverFromDepthCamera translation = (0.0000, 0.0000, 0.0000) m
[info]   cam1 serverFromDepthCamera translation = (0.5989, 0.0020, -0.0020) m
[info] setup update (session command): phase=STREAMING readiness=ready camera_pose_calibration=valid (revision 1) streaming=streaming metadata_revision=17
```

Check the translations against the real rig. They are the positions of each
camera's depth sensor, in metres, relative to the reference camera.

### What the result means [#what-the-result-means]

Each camera gets one rigid 4 × 4 transform, `serverFromDepthCamera`: the
pose of that camera's **depth sensor** in the server's coordinate frame. The
server frame is the depth frame of the reference camera (the first camera in
the config), so the reference camera's pose is the identity.

The server finds the board in each camera's colour image. That image is
already aligned to the depth image (this is what
`streams.alignment: color_to_depth` does), so the server solves the board
pose with the depth camera's intrinsics. The result is the depth-sensor pose
directly, with no colour-to-depth correction.

### The saved file [#the-saved-file]

The result goes to `calibration.camera_pose_path`. The matrix is
column-major, in metres, so the last column (entries 12–14) is the
translation:

```json
{
  "schema_version": 1,
  "revision": 1,
  "cameras": [
    {
      "camera_id": "cam0",
      "serial_number": "CL8K0000000A",
      "depth_width": 640,
      "depth_height": 576,
      "server_from_depth_camera": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    }
  ]
}
```

The server writes a temporary file, flushes it to disk and renames it over
the old one, so a crash leaves either the old or the new calibration. It
only writes a result that covers every active camera with a valid rigid
pose. Do not edit the file by hand: the loader is strict, and an unknown key
or a non-rigid matrix makes the whole calibration stale.

## Configuration [#configuration]

All keys are in the `calibration` section of the live config
(`config/dev/live.yaml`). `streams.alignment` must be `color_to_depth`.

| Key                     | Default                       | Meaning                                                                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `camera_pose_path`      | `config/dev/camera-pose.json` | Saved calibration. Relative to the working directory. A missing file is not an error.                                                                                                                                                                                                            |
| `placement_path`        | `config/dev/placement.json`   | Saved placement from client placement commits. Relative to the working directory. A missing file means the default placement.                                                                                                                                                                    |
| `autocalibrate`         | `false`                       | When the pose is missing or stale: `true` lets a client with the setup lock start calibration on its own; `false` needs an operator. `true` is ignored (reported as `false`) when calibration cannot run, for example with an invalid `board.dictionary`. See [Startup states](#startup-states). |
| `board.squares_x`       | `7`                           | Squares across. At least 2.                                                                                                                                                                                                                                                                      |
| `board.squares_y`       | `5`                           | Squares down. At least 2.                                                                                                                                                                                                                                                                        |
| `board.square_length_m` | `0.08`                        | Printed square size in metres.                                                                                                                                                                                                                                                                   |
| `board.marker_length_m` | `0.06`                        | Printed marker size in metres; smaller than the square.                                                                                                                                                                                                                                          |
| `board.dictionary`      | `DICT_5X5_100`                | OpenCV ArUco dictionary name.                                                                                                                                                                                                                                                                    |

## Startup states [#startup-states]

At every start, after the cameras are open, the server loads
`calibration.camera_pose_path`, checks it against the running cameras and
logs one line:

```text
[info] setup at startup: phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: no camera-pose calibration at config/dev/camera-pose.json) streaming=stopped metadata_revision=1
```

| Calibration state | When                                                                                                                                                                          | Phase in the log                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `valid`           | The file covers every active camera with the same serial number and depth resolution.                                                                                         | `READY` (or `STREAMING` once media is requested)                       |
| `missing`         | No file.                                                                                                                                                                      | `NEEDS_SETUP`, or `WAITING_FOR_CALIBRATION` with `autocalibrate: true` |
| `stale`           | The file is unreadable or invalid, or a camera is not in it, has a different serial number (hardware swapped) or a different depth resolution. The reason is in the log line. | Same as `missing`                                                      |
| `running`         | A calibration run is in progress.                                                                                                                                             | `CALIBRATING`                                                          |
| `failed`          | The last run failed and there was no valid calibration before.                                                                                                                | Same as `missing`                                                      |

A missing or stale calibration never stops the server: it starts and waits
for setup. Removing a camera from the config does not invalidate the others,
because entries for cameras that are not running are ignored.

`WAITING_FOR_CALIBRATION` and `CALIBRATING` are log names only; clients never
see them. A client sees `readiness=needs-setup` with `autocalibrate=true`
instead of the first, and a camera-pose calibration in state `running` for
the second. [Setup state](./how-it-works/setup-state#phases-and-readiness)
has the full mapping.

### What `autocalibrate` changes [#what-autocalibrate-changes]

* `false` (dev default): with a missing or stale pose, a client may not start
  a calibration. An operator runs `--calibrate-camera-pose` on the server.
* `true`: a client that holds the setup lock may start the calibration
  itself, and the server holds back normal media until the result is
  committed. No client can connect yet, so today the only visible difference
  is `WAITING_FOR_CALIBRATION` instead of `NEEDS_SETUP` in the log.

In both modes a valid pose may be recalibrated. Only one client (or the
console) can hold the setup lock at a time, and other clients keep their
normal control connection.

### Recalibrating a valid setup [#recalibrating-a-valid-setup]

While a new run is in progress, the committed poses stay in use and the
server stays ready (media is paused for setup). If the run fails, the old
poses stay valid and the state carries the message
`last calibration attempt failed: ...`. A cancelled or interrupted run leaves
the previous calibration and its revision unchanged.

## Troubleshooting [#troubleshooting]

| Message or symptom                                                                                                                                           | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--calibrate-camera-pose requires --live <config.yaml>`                                                                                                      | Add `--live config/dev/live.yaml`.                                                                                                                                                                                                                                                                                                                                                                                |
| `--print-charuco-board only writes the board; run --calibrate-camera-pose separately`                                                                        | Run the two commands one after the other.                                                                                                                                                                                                                                                                                                                                                                         |
| `calibration.board needs squares_x, squares_y >= 2, 0 < marker_length_m < square_length_m (metres) and a dictionary name`                                    | Fix the `calibration.board` values.                                                                                                                                                                                                                                                                                                                                                                               |
| `--calibrate-camera-pose requires streams.alignment: color_to_depth`                                                                                         | Set `streams.alignment: color_to_depth`. Other alignments give no depth-camera pose.                                                                                                                                                                                                                                                                                                                              |
| `setup state not built: client-facing setup requires streams.alignment=color_to_depth`                                                                       | Same cause, on a normal `--live` run: no calibration state is built.                                                                                                                                                                                                                                                                                                                                              |
| Progress shows `camX=no board`                                                                                                                               | The board is too small or too far away, there is glare, the light is too low, or `board.dictionary` or the square counts do not match the print. Move closer, avoid reflections and check the config.                                                                                                                                                                                                             |
| Corners detected but observations do not increase                                                                                                            | A view is rejected when fewer than 8 corners are found, when the fitted pose is more than 2 px off on average (RMS reprojection error), or when the pose is ambiguous (small, distant or face-on board). Hold the board closer and tilted, keep it still for a moment to avoid motion blur, and make sure it is flat. Views also need two cameras at once and at least 2 cm or 3° of movement since the last one. |
| `camera-pose calibration timed out after 120000 ms: accepted N of 20 observations`                                                                           | Not enough usable views in two minutes. Start the command again and keep the board in two cameras' views while you move it.                                                                                                                                                                                                                                                                                       |
| `... cameras cam1 did not see the board together with a calibrated camera in at least 5 consistent observations; inconsistent pairs: cam0-cam1 (... mm RMS)` | The shared views of that camera pair disagree by more than 15 mm RMS. Common causes: a bent board, a board moving during capture, or cameras that are not in hardware sync. Check `sync` in the config and hold the board still in each position.                                                                                                                                                                 |
| A failed run in console mode                                                                                                                                 | The server logs `camera-pose calibration run 1 failed: ...` and keeps running without a new calibration. Stop it with Ctrl+C and start the command again.                                                                                                                                                                                                                                                         |
| `camera_pose_calibration=stale (... serial changed from A to B)`                                                                                             | A camera was swapped. Recalibrate.                                                                                                                                                                                                                                                                                                                                                                                |
| `camera_pose_calibration=stale (... depth geometry changed from 640x576 to ...)`                                                                             | The `streams.depth` resolution changed. Recalibrate, or restore the resolution.                                                                                                                                                                                                                                                                                                                                   |
| `camera_pose_calibration=stale (camera cam2 is not calibrated)`                                                                                              | A camera was added, or a camera `id` was renamed. Recalibrate.                                                                                                                                                                                                                                                                                                                                                    |
| Distances between cameras are off by a constant factor                                                                                                       | `board.square_length_m` does not match the printed square. Measure it and recalibrate.                                                                                                                                                                                                                                                                                                                            |
| `config/dev/camera-pose.json` appears in `git status`                                                                                                        | `server/.gitignore` ignores `config/*/camera-pose.json`, so the file shows up only if someone committed it. It belongs to one physical rig. To stop tracking it, run `git rm --cached config/dev/camera-pose.json`. To commit a new version on purpose, run `git add -f config/dev/camera-pose.json`.                                                                                                             |

The depth-to-code table is calibrated separately; see
[Depth quantization calibrator](./depth-quantization-calibrator).
