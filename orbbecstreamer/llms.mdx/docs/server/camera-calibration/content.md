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

| Feature                                                                  | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Print the board (`--print-charuco-board`)                                | Available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Calibrate from the server console (`--calibrate-camera-pose`)            | Available. Tested with synthetic cameras; not yet validated with a printed board on hardware.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Load and check the saved calibration at startup                          | Available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| One camera needs no calibration                                          | Available. With exactly one active camera and a missing or stale pose, the server writes the identity pose (revision stored + 1, or 1) at startup.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Save the result safely, with a revision number                           | Available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Start, follow and commit a camera-pose calibration from a browser client | Available over the control stream when `serving.enabled: true` (see [Serve to browsers](./serving) and the [`serving` keys](./configuration#serving)). `camera-pose` and `depth-quantization` (see [Depth quantization calibrator](./depth-quantization-calibrator#calibrate-from-the-browser)) are supported; `network` is rejected with `calibration-kind-unsupported`. A camera-pose commit changes the stream descriptors, so each subscribed session's media streams rotate to the new header at the next keyframe (wire-format §18, see [Serve to browsers](./serving)). |
| `calibration.autocalibrate: true`                                        | With serving enabled and a missing or stale pose, a client that holds the setup lease may start a calibration. With `false`, only the local operator console or a session with the operator role (see `serving.console_origins`) can start one; a viewer cannot hold the setup lease at all and gets `invalid-lease` (change 0048). It is forced to `false` when no calibration engine is available.                                                                                                                                                                           |

## Print the board [#print-the-board]

The board is a **ChArUco board**: a chessboard whose white squares hold
ArUco markers (small black-and-white codes). The markers let the server
identify every corner, even when the board is only partly in view.

1. From the `server/` folder, write the board as a PNG, using the board
   settings from your config:

   ```bash
   ./build/dev-debug/orbbec_streamer --print-charuco-board board.png --live config/dev/live.yaml
   ```

   This command does not open the cameras. It prints the board in your
   config. Without `--live`, or when the config has no `calibration.board`
   block, it uses the built-in default: 4 × 6 squares of 105 mm with 79 mm
   markers (`DICT_4X4_50`). The examples below use that default, which looks
   like this:

   <img alt="Default ChArUco calibration board: 4 × 6 squares with ArUco markers" src="__img0" />

2. Read the physical size from the log:

   ```text
   [info] wrote ChArUco board board.png: 4x6 squares of 105.0 mm (DICT_4X4_50), printed board 420 x 630 mm; print at 100 % scale and check a square with a ruler
   ```

3. Print the board at that size. The image is drawn at 300 dpi with one
   white square of margin on every side. The default image is therefore
   630 × 840 mm (7441 × 9921 pixels):

   * The whole image needs A0 paper (841 × 1189 mm).
   * A1 (594 × 841 mm) fits only the 420 × 630 mm board, so crop the margin
     or print edge to edge.
   * The PNG carries no DPI information. Set the print size yourself so that
     the board, without the margin, measures the size in the log.

4. For a smaller printer, shrink the squares in the config and go back to
   step 1. For example, `square_length_m: 0.045` and `marker_length_m: 0.034`
   give a 180 × 270 mm board (270 × 360 mm with margin), which fits A3
   portrait. Hold a smaller board closer to the cameras: it is harder to
   detect at the 640 × 576 depth resolution.

5. Measure one printed square with a ruler. Put the measured size into
   `calibration.board.square_length_m`, and scale `marker_length_m` by the
   same factor. A wrong size does not stop detection, but every distance
   between cameras comes out scaled by the error. You can also set the
   measured board from the console; see [The board](#the-board).

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

   * Keep the board in view of at least two cameras at the same moment. A
     view needs only two cameras, not all of them; every camera must end up
     linked to the reference camera through such pairs.
   * Hold the board still for about a third of a second. The server captures
     the view by itself, then waits until you have moved the board by at
     least 2 cm or turned it by 3° before it captures again.
   * Vary the distance, the tilt and the place in the image. The server sorts
     each view into a pose bin per camera (distance, tilt and image region)
     and keeps at most two views per bin, so repeating the same pose does
     not count. Tilt the board 15° to 45° instead of holding it face-on.
   * Every camera needs at least 5 consistent views shared with a camera
     that is already placed. A camera that never sees the board together
     with the reference camera is placed through other cameras.

   The run needs 5 accepted views and gives up after 120 seconds.

   With `calibration.native_colour: true` (the default) the board is detected
   in the camera's own 1280x720 colour image, with the colour lens model, and
   the pose is moved to the depth camera with the extrinsic stored in the
   camera. This is the change that makes the run solve: in the simulated
   sessions below, detecting in the colour image resampled into the depth
   image never gave two consistent cameras, while the native image did with
   the old view rule. The new view rules (pose bins, still capture) add
   diversity and the stall reasons, and they are used only with native colour;
   on the aligned image (no colour calibration, an unsupported lens) the
   server keeps the previous rule. Depth still helps: where a face-on board could be read two
   ways, the depth at the centre of each square decides.

   When no view has been kept for 4 seconds, the server log says why
   (`no view kept for ... ms (poses-not-new): ...`): no camera sees the
   board, only some cameras see it, a camera has not seen it together with
   the others, views are rejected as blurred, too small, partly outside the
   colour image or with holes in the depth, the poses are already covered
   (with the empty pose bins), the board never stays still, or the solve
   disagrees between cameras. Browser consoles do not receive these reasons
   until the wire change that carries them is accepted; they see the nearest
   existing reason instead.

   A browser console follows the same run through
   `server.calibration.progress`: the detected corners in each camera's tile,
   a coverage grid, why the last view was rejected, how often camera pairs saw
   the board together and whether the server is still collecting or already
   solving (see [Camera-pose data](./how-it-works/progress-and-sync#camera-pose-data)).

4. Wait for the `committed` line in the log (see
   [Expected result](#expected-result)). The server then saves the poses,
   raises the revision by one and releases the setup lock. The live pipeline
   keeps running.

5. Stop the server with Ctrl+C. If you press Ctrl+C before the result is
   saved, the previous calibration file stays untouched.

## Simulated acceptance test [#simulated-acceptance-test]

The repository can check the whole chain without a printed board: a test
renders the real board (4 x 6 squares, 105 mm, markers 79 mm,
`DICT_4X4_50`) at known poses into synthetic frames of two Femto Bolt
cameras, with their colour lens and depth-to-colour extrinsic, noise, blur,
tilt, partial occlusion and partial overlap. It runs detection, view
gathering and the joint solve, and compares the result with the poses it
rendered. Every number from it is **simulated**: it says nothing about a lit
rig session with a real board.

```bash
cd server
ctest --test-dir build/dev-debug -L simulated --output-on-failure
# or
cmake --build build/dev-debug --target simulated_calibration
```

The test passes when the rotation is within 0.3°, the translation within
5 mm and the board fit within 0.5 px RMS of the truth. The simulated cameras
have a factory depth-to-colour error of about 1 mm and 0.1° that the server
does not know (the SDK reports the unperturbed values). In the last run the
second camera came out 0.19° to 0.22° and 2.1 to 2.7 mm from the truth over
three different sessions, with 0.07 to 0.12 px per view (all simulated).

## How the poses are solved [#how-the-poses-are-solved]

The server first places every camera through the cameras it saw the board
with, one pair at a time. A pair is fitted from the depth readings: every
4 x 4 grid point on the board that both cameras read is the same physical
point, so one rigid fit over the points of all shared views gives the pair.
(One flat board's colour pose of a single view can move the camera origin by
decimetres; the pooled depth points cannot.) Points more than 2 cm off are
dropped. The pair is used when at least 3 views keep a point, most views are
kept and the point RMS is within `calibration.joint.max_pair_translation_rms_m`;
otherwise the pair falls back to the per-view colour poses. That start is good
but it chains errors from camera to camera. It then runs **one joint adjustment** over all cameras and all kept
views at once, and that result is what is saved.

* **What is adjusted.** The pose of every depth sensor except the reference
  camera (the reference stays the identity, so the server frame is still its
  depth frame) and, for every view, where the board was. A robust loss
  (Huber) keeps a few bad corners from pulling the result, and an observation
  whose error is more than three times the median (and above 0.5 px) is
  dropped; if more than 30 % would be dropped, that attempt fails and the run
  keeps collecting. The search runs on the calibration worker, never on the
  frame path, and gives the same answer for the same input.
* **Poses stay depth-camera poses.** The adjusted pose is the depth sensor's.
  The colour-to-depth extrinsic from the SDK is fixed at its factory value.
  If it is wrong (see `depth-color-disagreement` below), the pose inherits
  the error: the server tells you, it does not guess a new extrinsic.
* **Factory intrinsics are a strong prior.** A camera's colour intrinsics are
  freed only when the residuals show a bias, there are at least 12 inlier
  observations, at least 2 tilt bins and more than half of the 9 image
  regions are filled, and a hold-out check (fit on half the views, test on the
  other half) lowers the error. The refined values are used for this solve
  only. They never reach the alignment, the occlusion test or any streamed
  pixel, they are not saved in `camera-pose.json`, and the next run starts
  from the factory values again. They appear only in the report.
* **A depth term is reported, not applied.** The depth pixels inside the
  board give a second check: how far the measured board plane is from the
  plane the corners imply, with a per-camera offset and scale. The server
  reports that offset and scale. It does **not** correct the depth it
  encodes, because that would change what clients unproject.
* **Gates.** A solve is accepted when the RMS error is at most
  `calibration.joint.max_rms_px`, every pair of cameras with at least 5 shared
  views has a translation consistency of at most
  `calibration.joint.max_pair_translation_rms_m` (the same limit as before),
  no camera's depth residual is above `calibration.joint.max_depth_residual_mm`,
  and the joint cost is not worse than the start. A failed gate fails that
  attempt only; the log names it, for example
  `pair cam0-cam2 translation RMS 18.2 mm > 15.0 mm`.

### Details worth knowing [#details-worth-knowing]

* A refinement smaller than 0.25 % of the focal length and 1 px of the centre
  is not treated as a biased lens: the camera keeps its factory K and does not
  raise `intrinsics-bias-unrefined` (a small extrinsic error leaks into the
  intrinsics at that size).
* Colour K refinement is not attempted for a camera whose depth plane
  disagrees with the corner plane (see `depth-color-disagreement`), because a
  K fitted to that would absorb the extrinsic error.
* Depth readings inside the board that are more than 150 mm from the depth the
  corners predict (a hand in front of the board) are dropped. A depth bias
  larger than that is therefore not measured; the report then carries a note
  naming the camera.
* The pair translation figure for a camera whose colour K was refined is
  computed from single-view poses fitted with the refined K; for the others it
  uses the detector's poses. That keeps a corrected colour bias from failing the
  pair gate.
* `calibration.joint.max_views` can be at most 96.

### Quality figures in the log [#quality-figures-in-the-log]

Every solved run logs its figures, one line for the run and one per camera and
per pair:

```text
[info] camera-pose calibration run 1: solved with joint-v1: 0.086 px RMS over 40 observations (0 rejected), depth residual 1.4 mm
[info]   camera cam1: 0.073 px RMS (observation image: color), 20 observations, intrinsics refined for the solve only, depth correction 0.4 mm x1.0002 (reported, not applied), depth residual 1.4 mm
[info]   pair cam0-cam1: 20 shared views, 0.086 px RMS, translation 4.8 mm, rotation 0.07 deg
```

Pixels are those of the image the board was found in (the rectified native
colour image, or the depth tile). The pair translation compares the relative
pose of two cameras from each single view with the jointly solved one; it is
the figure `max_pair_translation_rms_m` gates. Targets (not gates):
`calibration.joint.target_rms_px` (0.5 px) and
`calibration.joint.target_pair_translation_m` (10 mm).

### The calibration reports [#the-calibration-reports]

At every commit the server writes one small report per kind next to the
calibration files, replacing the previous one, atomically, after the
calibration file it describes. A report that cannot be written is logged and
never fails the commit. It is never larger than 256 KiB (a report that would
be is not written), it is only diagnostics, and nothing reads it back into a
solve.

| File                             | Contents                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera-pose.report.json`        | Per-view, per-camera and per-pair RMS, the depth residual and correction, which cameras had a refined colour K (factory and refined values, the bias statistic), the settings used, the advisories and which cameras are behind each. |
| `depth-quantization.report.json` | The depth histogram (64 bins), the range, the percentiles, the expected errors and 33 points of the reconstruction curve.                                                                                                             |
| `floor.report.json`              | Not written yet (comes with the floor calibration).                                                                                                                                                                                   |

`camera-pose.json` itself is unchanged: schema 1, no intrinsics, readable by
older servers. An older server ignores the report file.

### Advisories [#advisories]

An advisory is a short code about the **committed** calibration. It is worked
out when the calibration is committed or the server starts, never in the
middle of a run.

| Code                                | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solved-before-rectification`       | The pose was measured before images were rectified. Calibrate again.                                                                                                                                                                                                                                                                                                                                                                                          |
| `solved-unrectified`                | At least one camera's lens could not be rectified.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `quality-unknown`                   | The committed calibration has no report (committed before the reports, or the report is missing).                                                                                                                                                                                                                                                                                                                                                             |
| `solved-before-warm-up`             | A camera had streamed for less than `calibration.joint.warm_up_minutes` (40) when the pose was solved (time-of-flight drift settles within 40 to 50 minutes). Let the cameras warm up and calibrate again.                                                                                                                                                                                                                                                    |
| `reprojection-above-target`         | RMS above `target_rms_px`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pair-consistency-above-target`     | A pair above `target_pair_translation_m`.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `intrinsics-bias-unrefined`         | A camera's colour K looks biased but could not be refined (too few views, tilts or regions). Move the board through more of the image, with more tilt.                                                                                                                                                                                                                                                                                                        |
| `alignment-uses-factory-intrinsics` | A refined colour K would move the aligned colour by more than 1 px, but the streamed colour-to-depth alignment keeps the factory K, so colour on depth may be off by that much; check it with the grid test and report the unit.                                                                                                                                                                                                                              |
| `depth-bias-high`                   | A camera's depth offset is above 10 mm or its scale is more than 0.5 % off.                                                                                                                                                                                                                                                                                                                                                                                   |
| `depth-color-disagreement`          | The depth plane and the corner plane differ by more than 1.0° (median): the colour-to-depth extrinsic or the depth intrinsics are suspect, and the pose may be off by about that error (about 1.3° and 18 mm in the simulation for a 1.5° extrinsic error). Check the extrinsic with the grid test before trusting the pose. A camera with this advisory keeps its factory colour K, so it also raises `intrinsics-bias-unrefined` if its lens looked biased. |
| `depth-range-clipped`               | More than 5 % of the depth calibration samples fell outside the committed range.                                                                                                                                                                                                                                                                                                                                                                              |

### Quality figures and advisories for clients [#quality-figures-and-advisories-for-clients]

A client that lists the minor-2 feature `calibration-quality` in its hello gets the
quality figures (`poseQuality` on the camera-pose item and its progress, `quality` on
its result) and the `advisories` list on every calibration item. An operator
session can also ask for the full report with `client.calibration.report.get`
(`camera-pose`, `depth-quantization`); the reply is the report of the committed
revision, or `null` when there is none. A viewer gets `role-required`, and the
request counts against the same rate budget as other setup commands (a refusal
for the role does not). A client that does not list the feature sees none of
this, and the request is `unknown-message-type` for it.

### Simulated accuracy [#simulated-accuracy]

The simulated acceptance test also models what the server cannot know: the
second camera's real colour K differs from the reported one (+0.8 % focal
length, +3 px centre) and the first camera's depth reads 12 mm and 0.4 % too
far. Over three sessions the joint solution was 0.12° and 2.7 to 3.7 mm from
the truth, against 0.24° to 0.40° and 9 to 12 mm for the pair-by-pair start;
the offset of the depth bias was recovered within 1 mm. Every number is
**simulated**. The goal of the calibration programme is 0.1° and 2 mm, which
this does **not** meet yet; it has to be validated on the rig. The test pins
what is achieved (at most 0.2° and 4.5 mm), so a regression fails. The session
is the scripted hand-held one, with the board carried further across the image
than in the first W5 sessions so that the colour K can be checked. With a 1.5°
colour-to-depth extrinsic error the pose is off by about that error (1.3° and
18 mm) and nothing in the solve can remove it; the advisories say so.

## Expected result [#expected-result]

While the run is going, a progress line appears every 5 seconds:

```text
[info] local camera-pose calibration running: show the 4x6 ChArUco board (0.105 m squares, DICT_4X4_50) so that at least two cameras see it at once, and move it between views
[info] camera-pose calibration run 1: 3/20 observations after 0 s; cam0=15 corners cam1=15 corners
```

`cam1=no board` means that camera does not see the board in the current
frame.

A successful run ends like this (numbers from a synthetic test rig):

```text
[info] camera-pose calibration run 1 solved
[info] camera-pose calibration committed: revision 1
[info]   cam0 serverFromDepthCamera translation = (0.0000, 0.0000, 0.0000) m (+Y up)
[info]   cam1 serverFromDepthCamera translation = (0.5989, -0.0020, -0.0020) m (+Y up)
[info] setup update (session command): phase=STREAMING readiness=ready camera_pose_calibration=valid (revision 1) streaming=streaming metadata_revision=17
```

Check the translations against the real rig. They are the positions of each
camera's depth sensor, in metres, relative to the reference camera, in the
frame clients receive: +X right, +Y up, +Z forward. A camera mounted above
the reference camera has a positive y.

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

The solver works in the OpenCV camera frame (+X right, +Y down, +Z
forward), and the server keeps that frame internally and in the saved file.
Clients get every pose in the wire frame (+X right, +Y up, +Z forward; see
wire-format §9). The server converts a pose `M` at the boundary to
`C·M·C`, with `C = diag(1, −1, 1, 1)`: the rotation stays a rotation, the
identity stays the identity, and the y translation changes sign.
`anchorFromServer` (the placement) is written by clients in the wire frame
and is stored and sent back unchanged.

### The saved file [#the-saved-file]

The result goes to `calibration.camera_pose_path`. The matrix is
column-major, in metres, so the last column (entries 12–14) is the
translation. The file is in the OpenCV frame (+Y down), so its y
translation has the opposite sign of the one in the log and on the wire:

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

Next to it the server writes `camera-pose.json.image-model`, a small file
that records whether the pose was measured on rectified images (see
[Rectification](./rectification)). It is a separate file on purpose: older
servers read `camera-pose.json` strictly, so it keeps exactly the keys above.
A pose without a matching sidecar (written before rectification, or by an
older server) still loads and keeps its poses, and the server logs one warning,
`calibrated before rectification - recalibration recommended`. Calibrate again
after upgrading.

The server writes a temporary file, flushes it to disk and renames it over
the old one, so a crash leaves either the old or the new calibration. It
only writes a result that covers every active camera with a valid rigid
pose. Do not edit the file by hand: the loader is strict, and an unknown key
or a non-rigid matrix makes the whole calibration stale.

## Configuration [#configuration]

All keys are in the `calibration` section of the live config
(`config/dev/live.yaml`). `streams.alignment` must be `color_to_depth`.

| Key                                                                               | Default                                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `camera_pose_path`                                                                | `config/dev/camera-pose.json`                       | Saved calibration. Relative to the working directory. A missing file is not an error.                                                                                                                                                                                                                                                                                                                                                            |
| `placement_path`                                                                  | `config/dev/placement.json`                         | Saved placement from client placement commits. Relative to the working directory. A missing file means the default placement.                                                                                                                                                                                                                                                                                                                    |
| `autocalibrate`                                                                   | `false`                                             | When the pose is missing or stale: `true` lets a client with the setup lock start calibration on its own; `false` needs an operator. `true` is ignored (reported as `false`) when calibration cannot run, for example without colour aligned to depth. A board in the config that breaks a rule does not stop calibration: the server uses the default board and shows why (see [The board](#the-board)). See [Startup states](#startup-states). |
| `native_colour`                                                                   | `true`                                              | Detect the board in the native colour image instead of the colour aligned to depth. Needs `streams.alignment: color_to_depth` and a camera that reports its colour calibration; a camera without one is detected on the aligned image. The SDK's colour frame is kept with each batch only while a camera-pose run is active.                                                                                                                    |
| `detector_threads`                                                                | `0`                                                 | Threads that detect the board in the cameras of one batch at the same time. `0` is the smaller of the camera count, half the hardware threads and 8. About three suffice for 8 cameras at 15 Hz. At most 64.                                                                                                                                                                                                                                     |
| `joint.enabled`                                                                   | `true`                                              | Refine the pair-by-pair start with the joint adjustment. `false` keeps the old solver alone (`tree-v1`).                                                                                                                                                                                                                                                                                                                                         |
| `joint.max_rms_px`                                                                | `1.0`                                               | Gate: the RMS reprojection error of the solve.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `joint.max_pair_translation_rms_m`                                                | `0.015`                                             | Gate: translation consistency of every pair with at least 5 shared views.                                                                                                                                                                                                                                                                                                                                                                        |
| `joint.max_depth_residual_mm`                                                     | `20`                                                | Gate: a camera's depth residual.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `joint.target_rms_px`, `joint.target_pair_translation_m`                          | `0.5`, `0.010`                                      | Targets for the advisories.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `joint.sigma_px`, `joint.sigma_depth_mm`, `joint.huber_sigmas`                    | `0.3`, `8`, `3`                                     | Noise assumed for the corners and the depth, and the Huber threshold in sigmas.                                                                                                                                                                                                                                                                                                                                                                  |
| `joint.max_views`                                                                 | `96`                                                | Views entering the joint problem; more are thinned by pose-bin diversity. 4 to 96 (the wire carries at most 128).                                                                                                                                                                                                                                                                                                                                |
| `joint.depth_term`                                                                | `true`                                              | Use the depth pixels in the board (reported, never applied).                                                                                                                                                                                                                                                                                                                                                                                     |
| `joint.refine_intrinsics`                                                         | `true`                                              | Allow the colour K refinement when the checks pass.                                                                                                                                                                                                                                                                                                                                                                                              |
| `joint.intrinsics_prior_focal_fraction`, `joint.intrinsics_prior_centre_fraction` | `0.003`, `0.003`                                    | How strongly the factory K is held (a fraction of the focal length and of the image width).                                                                                                                                                                                                                                                                                                                                                      |
| `joint.warm_up_minutes`                                                           | `40`                                                | Warm-up for the `solved-before-warm-up` advisory.                                                                                                                                                                                                                                                                                                                                                                                                |
| `floor_path`                                                                      | `floor.json` in the directory of `camera_pose_path` | Saved floor from a floor commit. When set, relative to the working directory. A missing file means the floor was never measured. Read once, when the server starts. See [Measure the floor](#measure-the-floor).                                                                                                                                                                                                                                 |
| `floor.enabled`                                                                   | `true`                                              | Offer the floor measurement to clients. `false` removes the `floor` feature and its status item for every session.                                                                                                                                                                                                                                                                                                                               |
| `floor.inlier_threshold_mm`                                                       | `15`                                                | A fused depth point within this distance of the plane counts as part of the floor (up to 1000).                                                                                                                                                                                                                                                                                                                                                  |
| `floor.up_gate_deg`                                                               | `50`                                                | The floor normal must be within this angle of the server frame's up direction. The cameras are pitched down, so the floor is tilted in the server frame by about their pitch. Walls are near 90 degrees and are refused. Below 90.                                                                                                                                                                                                               |
| `floor.min_inlier_share`                                                          | `0.05`                                              | The floor must cover at least this share of the sampled depth points.                                                                                                                                                                                                                                                                                                                                                                            |
| `floor.min_points`, `floor.min_inlier_points`                                     | `10000`, `1500`                                     | Fewer valid sampled points than the first fail with `not-enough-depth`. A plane needs at least the second many points to count at all.                                                                                                                                                                                                                                                                                                           |
| `floor.frame_sets`                                                                | `8`                                                 | Frame sets in the per-pixel median (1 to 64). A run succeeds only over a full window.                                                                                                                                                                                                                                                                                                                                                            |
| `floor.grid_stride`                                                               | `4`                                                 | Every n-th pixel of the rectified depth image is used (1 to 64).                                                                                                                                                                                                                                                                                                                                                                                 |
| `floor.ransac_iterations`, `floor.seed`                                           | `500`, `1`                                          | RANSAC hypotheses per plane and the seed of its random generator. The same frames give the same plane.                                                                                                                                                                                                                                                                                                                                           |
| `floor.timeout_seconds`                                                           | `30`                                                | A run without a plane that passes the gates fails after this long.                                                                                                                                                                                                                                                                                                                                                                               |
| `floor.min_depth_mm`, `floor.max_depth_mm`                                        | `0`, `0`                                            | Depth outside this range is not used. `0` takes `encoding.depth.minimum_depth_mm` and `maximum_depth_mm`.                                                                                                                                                                                                                                                                                                                                        |
| `board_state_path`                                                                | next to `camera_pose_path`, `board.json`            | Where the board set by an operator, and the board revision, are kept. See [The board](#the-board).                                                                                                                                                                                                                                                                                                                                               |
| `board.id`                                                                        | `default`                                           | Name of the board: 1 to 64 characters of `a-z`, `0-9` and `-`. It stays when you edit the board.                                                                                                                                                                                                                                                                                                                                                 |
| `board.squares_x`                                                                 | `4`                                                 | Squares across. 2 to 64.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `board.squares_y`                                                                 | `6`                                                 | Squares down. 2 to 64.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `board.square_length_m`                                                           | `0.105`                                             | Printed square size in metres. At most 2.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `board.marker_length_m`                                                           | `0.079`                                             | Printed marker size in metres; smaller than the square.                                                                                                                                                                                                                                                                                                                                                                                          |
| `board.dictionary`                                                                | `DICT_4X4_50`                                       | OpenCV ArUco dictionary name. The board needs one marker per white square, so the dictionary must have at least that many codes.                                                                                                                                                                                                                                                                                                                 |
| `board.top_left_square`                                                           | `black`                                             | Colour of the top-left square. `white` is OpenCV's older layout of an even-row board and needs an even `squares_y`.                                                                                                                                                                                                                                                                                                                              |
| `board.marker_ids`                                                                | `0..n-1`                                            | A list with exactly one id per marker, for a board printed with other ids, for example `[20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]`.                                                                                                                                                                                                                                                                                                       |
| `board.marker_border_bits`                                                        | `1`                                                 | Width of the black marker border, 1 to 4.                                                                                                                                                                                                                                                                                                                                                                                                        |

A board is valid when all of these hold. The server checks them at start,
at a reload and for a board set from the console, and says which rule failed.

* Both square counts are 2 to 64, and there are at most 1024 inner corners
  (`(squares_x - 1) × (squares_y - 1)`).
* The marker is smaller than the square, and both are at most 2 m.
* The number of markers (the white squares) is at most the number of codes of
  the dictionary, and every id in `marker_ids` is below it.
* `top_left_square: white` needs an even `squares_y`.

### The board [#the-board]

Three places can name the board. The first that exists wins.

1. **A board set from the console.** An operator with the setup lock sets it
   in the console. The server saves it in its state directory (for the
   package, `/var/lib/orbbec-streamer/calibration/board.json`), never in the
   configuration, and keeps it across restarts.
2. **The `calibration.board` section of the config.**
3. **The built-in default**: the 4 × 6 board with 105 mm squares, 79 mm
   markers and `DICT_4X4_50`, black top-left square, ids 0 to 11.

Clearing the console board makes the config board (or the default) active
again.

If the config board breaks a rule **when the server starts**, the server does
not stop: it uses the default board, logs a warning and shows the reason to
the console as a board error. Fix the config and reload. The only board type
is `charuco`; another `board.type` is reported as unsupported. For a dev
config the board file sits next to `camera-pose.json` (`config/dev/board.json`,
ignored by git).

Every change of the active board raises the **board revision** by 1. The
revision is also kept in `board.json`, so it never goes back after a restart.
The console shows the board and its revision, and live detections name the
board they were computed against. A change of the board moves the metadata
revision by 1 and nothing else: the calibration, the placement and the
streams are untouched, and a saved pose stays valid, because it describes the
cameras and not the board.

**While a calibration run is going the board does not change.** A board set
from the console, or a config reload, is saved at once but applied when the
run ends (commit, failure, cancel or lock loss). The run uses the board it
started with; the next run uses the new one. If you set several boards during
a run, the last one is applied.

### Reload the board without a restart [#reload-the-board-without-a-restart]

Edit `calibration.board` in the config, then send the server a hang-up
signal:

```bash
sudo systemctl reload orbbec-streamer
```

The server reads the board again (nothing else in the file is applied). If the
board is valid and no board was set from the console, it becomes active at the
next moment no run is going. If a board set from the console exists, the
config board is stored and shows when you clear the console board.

If the new board breaks a rule, or the file cannot be read, the server keeps
the board that is active now (never the default), logs the full reason, and
shows a short reason to the console as a board error until the next valid
reload. The short reason never contains the path of the config. A reload never fails a run and never stops the server.

### Set the board from the console [#set-the-board-from-the-console]

The console sends `client.calibration.board.set` under the setup lock. It
needs the operator role. The server refuses a board that breaks a rule above
(`board-invalid`), one it cannot detect, such as a dictionary it does not
know (`board-unsupported`), and a board it could not save
(`board-persist-failed`). In every refusal nothing changes. Clients that do
not take part in the `board-set` feature of the protocol keep seeing the board
as before, without the name, revision and artwork fields.

## Startup states [#startup-states]

At every start, after the cameras are open, the server loads
`calibration.camera_pose_path`, checks it against the running cameras and
logs one line:

```text
[info] setup at startup: phase=NEEDS_SETUP readiness=needs-setup camera_pose_calibration=missing (revision 0: no camera-pose calibration at config/dev/camera-pose.json) streaming=stopped metadata_revision=1
```

| Calibration state | When                                                                                                                                                                                                                                                                  | Phase in the log                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `valid`           | The file covers every active camera with the same serial number and depth resolution.                                                                                                                                                                                 | `READY` (or `STREAMING` once media is requested)                       |
| `missing`         | No file. With exactly one active camera the server writes the identity pose first and the state becomes `valid` (see below).                                                                                                                                          | `NEEDS_SETUP`, or `WAITING_FOR_CALIBRATION` with `autocalibrate: true` |
| `stale`           | The file is unreadable or invalid, or a camera is not in it, has a different serial number (hardware swapped) or a different depth resolution. The reason is in the log line. With exactly one active camera the server rewrites the identity pose, as for `missing`. | Same as `missing`                                                      |
| `running`         | A calibration run is in progress.                                                                                                                                                                                                                                     | `CALIBRATING`                                                          |
| `failed`          | The last run failed and there was no valid calibration before.                                                                                                                                                                                                        | Same as `missing`                                                      |

A rig with one camera needs no calibration. The first camera is the
reference, so its pose is the identity by definition. When exactly one camera
is active and the pose is `missing` or `stale`, the server writes a
`camera_pose_path` file for it (camera id, serial number, depth size and the
identity pose) with the same atomic save a commit uses, at revision
stored + 1 (1 without a file), and starts as `valid`. It logs one line:

```text
[info] camera pose: one active camera (cam0, serial CL8K…), using the identity pose (revision 1) written to config/dev/camera-pose.json
```

If the file cannot be written, the server logs a warning and stays in
`NEEDS_SETUP`. A valid file is never touched, and a rig with several cameras
always needs a calibration.

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

## Measure the floor [#measure-the-floor]

The floor measurement finds the floor plane in the scene the cameras share, so
that a client can level the cloud. The result is one plane in the server frame
(the first camera's frame, with Y up), the same frame as the camera poses. It
does not depend on where a client places the server. The server never moves
a placement by itself; a client proposes one from the plane, and an operator
commits it.

The floor is a calibration kind like the others. An operator with the setup
lock starts it, watches the progress, and commits or cancels the result. It
never runs on its own, and it does not pause media: the cameras keep
streaming while it runs. It needs committed camera poses, because the cloud
is fused with them: while `camera-pose` is missing, stale or failed, the start
is refused with `floor-needs-pose`. A server with a single camera has a valid
identity pose and can measure the floor. Only a client that lists the
minor-2 feature `floor` in its hello sees any of this.

### How the plane is found [#how-the-plane-is-found]

1. For each camera the server keeps the last `floor.frame_sets` raw depth
   frames and takes the median of every pixel. This removes the noise of a
   single frame and the pixels that flicker.
2. It takes every `floor.grid_stride`-th pixel of the rectified depth grid and
   drops flying pixels: samples whose depth jumps to a neighbour by more than
   the seam stage's limits (`processing.flying_pixel_*`).
3. It unprojects the samples with the rectified depth model, the same lens
   model and intrinsics as the streamed depth, and moves them into the server
   frame with the committed poses. Unprojecting the raw, distorted depth would
   bend the floor at the image edges.
4. RANSAC finds planes in the fused cloud, one after the other. Each is refined
   by a least-squares fit through all its inliers. A person or a table can have
   more points than the floor, so the server does not take the largest plane.
5. It keeps the planes with the camera centres on one side, turns the normal
   towards the cameras, and refuses the ones that are not within
   `floor.up_gate_deg` of up. Of the planes that remain, **the lowest wins**.

The numbers use OpenCV only and run on a worker thread, a few milliseconds per
fit. Capture, the control plane and media never wait for it.

### What a result contains [#what-a-result-contains]

| Field            | Meaning                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| plane            | A unit normal pointing from the floor towards the cameras, and an offset in metres: every floor point `p` satisfies `n·p + offset = 0`.                                                                                                                |
| `residualMm`     | The RMS distance of the final inliers to the plane, in millimetres. The programme target is 10 mm or less. It mixes depth noise, how flat the floor is, per-camera depth bias and the error of the camera poses, so it is not a pure flatness measure. |
| `inlierShare`    | The final inliers divided by all valid sampled points. It depends on the scene (the floor is often 15 to 40 percent of the view) and is not a quality score.                                                                                           |
| `gravityGateDeg` | Always `null`: the server has no IMU capture, so no gravity reference is used and the up gate is the configured pre-filter.                                                                                                                            |
| `poseRevision`   | The camera-pose revision the plane was measured against.                                                                                                                                                                                               |

The server saves the committed floor to `floor_path` with its own revision,
and a report of the same revision (`client.calibration.report.get` with kind
`floor`, for an operator session that lists `calibration-quality` and `floor`).

### When a run fails [#when-a-run-fails]

A run reports progress at most four times a second, with the best plane so
far (`floorCandidate`) once one passes the gates. It ends when the median is
full and a plane passes, or after `floor.timeout_seconds`. A run that times out
reports the furthest of these stages that it reached, at the start of the
result message:

| Message starts with           | Meaning and fix                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `not-enough-depth`            | Too few valid depth points, or too few frame sets arrived. Check that the cameras see the room and that the depth range covers it.                                                                           |
| `no-plane`                    | No plane has enough points, or every plane passes through or between the cameras. The view needs a large flat surface.                                                                                       |
| `normal-outside-gravity-gate` | Planes were found but none is near horizontal. Only walls are in view, or the cameras are pitched more than `floor.up_gate_deg`. The name says gravity; without an IMU it is the configured angle around up. |
| `too-few-inliers`             | The lowest horizontal plane covers less than `floor.min_inlier_share` of the points. Turn the cameras to show more floor, or clear it.                                                                       |

A cancelled or failed run changes nothing: the previous committed floor, its
revision and its file stay as they were.

### When the floor goes stale [#when-the-floor-goes-stale]

The floor is `stale` when the camera poses it was measured against are no
longer the poses in force: after a camera-pose commit, or when a stream profile
switch or a camera change makes `camera-pose` stale. It keeps its plane and
revision, and clients are told once, right after the camera-pose change. It
becomes valid again if `camera-pose` is valid again at the same revision.
Running a new floor measurement against the new poses makes it valid. A
placement commit never makes the floor stale. A stale or missing floor does
not change readiness: the server is still ready.

The server reads `floor_path` once, when it starts, and keeps the floor in
memory afterwards. Closing and opening the cameras or switching the stream
profile does not read the file again.

### Simulated accuracy [#simulated-accuracy-1]

The simulated acceptance test (`ctest -L simulated`) renders a room with a
floor, a table and a person into the raw depth of two cameras pitched 20 to 40
degrees down, with noise and holes, and compares the result with the exact
plane. The test is `SyntheticFloorAcceptanceTests` (`pitched rigs recover the
floor` and `a noisy scene`), and it prints one `[simulated]` line per scenario.
Over five rigs (pitch 20 to 40 degrees, two with a lens model, 3 mm depth
noise, 2 percent holes, three identical runs) the worst case is a normal 0.0053
degrees and an offset 0.25 mm from the truth, with `residualMm` at most 1.78
and `inlierShare` at least 0.59. With 6 mm noise and 8 percent holes the same
room gives 0.0012 degrees, 0.14 mm and `residualMm` 1.82. The test pins about
twice these figures (0.012 degrees and 0.5 mm; 0.003 degrees and 0.3 mm for
the noisy room), so a regression fails, and keeps a looser check of 0.5
degrees and 5 mm. The table is never taken for the floor, and a scene with no
floor, a wall only, a ceiling only or too little depth fails with the stage
above. Every number is **simulated**; the accuracy of a lit rig session is not
measured yet and has to be validated on the rig.

## Troubleshooting [#troubleshooting]

| Message or symptom                                                                                                                                           | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--calibrate-camera-pose requires --live <config.yaml>`                                                                                                      | Add `--live config/dev/live.yaml`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `--print-charuco-board only writes the board; run --calibrate-camera-pose separately`                                                                        | Run the two commands one after the other.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `calibration.board needs squares_x, squares_y >= 2, 0 < marker_length_m < square_length_m (metres) and a dictionary name`                                    | Fix the `calibration.board` values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--calibrate-camera-pose requires streams.alignment: color_to_depth`                                                                                         | Set `streams.alignment: color_to_depth`. Other alignments give no depth-camera pose.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `setup state not built: client-facing setup requires streams.alignment=color_to_depth`                                                                       | Same cause, on a normal `--live` run: no calibration state is built.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Progress shows `camX=no board`                                                                                                                               | The board is too small or too far away, there is glare, the light is too low, or `board.dictionary` or the square counts do not match the print. Move closer, avoid reflections and check the config.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Corners detected but observations do not increase                                                                                                            | The log line `no view kept for ... ms` names the reason. A view is rejected when fewer than 8 corners are found, when the fitted pose is more than 2 px off on average (RMS reprojection error), when the board is blurred, smaller than 20 px per marker, partly outside the colour image, or has little valid depth, or when the pose is ambiguous. Hold the board closer and tilted, keep it still for a third of a second, and make sure it is flat. Views also need two cameras at once, and each pose bin of a camera takes at most two views: move to a new distance, tilt or part of the image. |
| `camera-pose calibration timed out after 120000 ms: accepted N of 5 observations`                                                                            | Not enough usable views in two minutes. Start the command again and keep the board in two cameras' views while you move it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `... cameras cam1 did not see the board together with a calibrated camera in at least 5 consistent observations; inconsistent pairs: cam0-cam1 (... mm RMS)` | The shared views of that camera pair disagree by more than 15 mm RMS. Common causes: a bent board, a board moving during capture, or cameras that are not in hardware sync. Check `sync` in the config and hold the board still in each position.                                                                                                                                                                                                                                                                                                                                                       |
| A failed run in console mode                                                                                                                                 | The server logs `camera-pose calibration run 1 failed: ...` and keeps running without a new calibration. Stop it with Ctrl+C and start the command again.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `camera_pose_calibration=stale (... serial changed from A to B)`                                                                                             | A camera was swapped. Recalibrate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `camera_pose_calibration=stale (... depth geometry changed from 640x576 to ...)`                                                                             | The `streams.depth` resolution changed. Recalibrate, or restore the resolution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `camera_pose_calibration=stale (camera cam2 is not calibrated)`                                                                                              | A camera was added, or a camera `id` was renamed. Recalibrate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Distances between cameras are off by a constant factor                                                                                                       | `board.square_length_m` does not match the printed square. Measure it and recalibrate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `config/dev/camera-pose.json` appears in `git status`                                                                                                        | `server/.gitignore` ignores `config/*/camera-pose.json`, so the file shows up only if someone committed it. It belongs to one physical rig. To stop tracking it, run `git rm --cached config/dev/camera-pose.json`. To commit a new version on purpose, run `git add -f config/dev/camera-pose.json`.                                                                                                                                                                                                                                                                                                   |

The depth-to-code table is calibrated separately, offline or from a browser
that holds the setup lock; see
[Depth quantization calibrator](./depth-quantization-calibrator). A depth run
and a camera-pose run cannot be active at the same time, and a depth run does
not pause the media stream.
