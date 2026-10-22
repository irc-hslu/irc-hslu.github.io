# Calibration (https://irc-hslu.github.io/orbbecstreamer/docs/guides/calibration)



There are four calibration kinds. Each one is a server-side state; a client
can show it and, for some kinds, run it over a browser session. From
v0.1.0-poc.7 the session also carries live video (see
[Serve to browsers](/docs/server/serving)); up to poc.6 it carries status and
setup commands only. The team has not yet checked depth calibration on a
live scene on real hardware.

From v0.1.6 the camera-pose run keeps views by itself while the board is
held still, sorts them by distance, tilt and image region, and detects the
board in each camera's own colour image; the Operator Console shows each
camera's live image with the detected board. See
[Run a calibration](/docs/server/camera-calibration#run-a-calibration) and
[Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses).
These changes were tested in simulation, not yet on hardware.

From v0.1.6 the server solves all camera poses together (a joint rig
adjustment) and checks the result against targets: 0.5 px reprojection
error and 10 mm between the cameras of each pair. In simulation, the joint
solution came within 0.12° and 2.7 to 3.7 mm of the truth. The programme's
goal is 0.1° and 2 mm; this is not met yet and has to be validated on the
rig. Every figure is simulated.

The Operator Console shows the figures and advisories in a **Quality**
section on its calibration screens, and fetches the full report with
**Calibration report**; see
[Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses).
The client's setup workspace lists the advisories too. After a run,
`journalctl -u orbbec-streamer` also has one line for the run and one per
camera and per pair, and each commit writes
`/var/lib/orbbec-streamer/calibration/camera-pose.report.json`. Short
codes called advisories flag a calibration you shouldn't trust as it is,
for example `solved-before-warm-up` when a camera had streamed for less
than 40 minutes: let the cameras warm up before you calibrate. See
[Quality figures in the log](/docs/server/camera-calibration#quality-figures-in-the-log) and
[Advisories](/docs/server/camera-calibration#advisories).

| Kind               | On the server                                                                                                                                                                                                                                                                                                                                                                                | From a browser, against a real server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera pose        | One camera needs none: from v0.1.0-poc.7 the server writes its identity pose at start. Several cameras: works from the local console with a ChArUco board, tested with synthetic cameras and not yet validated on hardware. See [Camera pose calibration](/docs/server/camera-calibration).                                                                                                  | The server accepts a camera-pose run from a client that holds the setup lock. With `autocalibrate: false` (the packaged default) that only re-runs a pose that is already valid, unless the session has the operator role. From v0.1.0-poc.11, the Operator Console has the operator role on the server PC and calibrates a missing pose; see [Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses). Up to poc.10, a missing pose must be calibrated on the server.                                                                                                                                                                                                                                                                                                                                           |
| Depth quantization | Works from a CLI tool. See [Depth quantization calibrator](/docs/server/depth-quantization-calibrator).                                                                                                                                                                                                                                                                                      | The server runs it for a client that holds the setup lock (since v0.1.0-poc.4): it samples live, masked depth, and a solved run waits for a commit, which swaps the new profile in without a restart. From v0.1.0-poc.6, the client can also commit the run against a real server: it follows the server's "solved; awaiting commit" behaviour. This was tested against the mock server; a check on real hardware is pending. With poc.5, the client can start, watch and cancel a run but not commit it, so use the calibrator or `orbbec-console calibrate depth --commit` (see [Terminal console](/docs/operator/terminal-console#calibrate-from-a-script)). The full flow works against the client's [mock server](/docs/client/developer/mock-server). See [Calibrate depth](/docs/client/calibration#depth-quantization). |
| Floor              | From v0.1.6 the server measures the floor plane from the running cameras; it needs a valid camera pose. In simulation (five rigs pitched 20° to 40° down, with a table, a person and 3 mm depth noise) the worst case was 0.0053° for the floor's normal and 0.25 mm for its offset; not yet tested on hardware. See [Measure the floor](/docs/server/camera-calibration#measure-the-floor). | From v0.1.6, a session with the operator role and the setup lock measures and commits it: in the Operator Console, see [Measure the floor](/docs/operator#measure-the-floor); in the client's setup workspace, see [Calibrate the floor](/docs/client/calibrate-floor). **Level to floor** turns the result into a placement draft that you commit yourself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Network            | Not available. A stream is reserved in the wire format, but no calibration procedure exists yet.                                                                                                                                                                                                                                                                                             | Not available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Before a depth run from a browser [#before-a-depth-run-from-a-browser]

The server refuses to start a depth run, with `calibration-unavailable`
and a reason, when:

* no capture is active (no camera is delivering frames);
* `mask.backend` or `processing.depth_filter_backend` is `none`;
* the person-mask engine is still being built on the first start, or has
  failed. Masks then pass every pixel, so the profile would include the
  background. Wait until the mask engine is ready, or set
  `mask.backend: fill_all` to calibrate on all depth.

From poc.6, a run needs at least four frames' worth of valid depth in one
camera's depth image; below that it keeps collecting, and fails at the
deadline with `too few valid depth samples …`. Point the cameras at the
scene, or widen the configured range (`encoding.depth.minimum_depth_mm`
and `maximum_depth_mm` in `live.yaml`). With poc.4 and poc.5 there is no
minimum, so check **valid samples** before you commit. Only one calibration run of any kind runs at a time. Cancelling, releasing
the lock or disconnecting abandons the run and keeps the profile in force.

The [Operator Console](/docs/operator) shows each kind's state under
**Calibration** on its Overview. From poc.6, its **Depth range calibration** screen (**Depth
calibration plot** in the navigation from v0.1.4) also runs and commits a depth-quantization calibration: see
[Calibrate the depth range](/docs/operator#calibrate-the-depth-range). The
[terminal console](/docs/operator/terminal-console#calibrate-from-a-script)
does the same from a script with `orbbec-console calibrate depth --commit`.

## Run calibration today [#run-calibration-today]

Run camera pose and depth quantization on the server:

1. With several cameras, calibrate the camera pose. From v0.1.0-poc.11, use
   the Operator Console; see
   [Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses).
   Up to poc.10, use the server console with `--calibrate-camera-pose`; see
   [Camera pose calibration](/docs/server/camera-calibration). With one
   camera, poc.7 and later skip this step.
2. Optionally, build a depth quantization profile with the calibrator. See
   [Depth quantization calibrator](/docs/server/depth-quantization-calibrator).
   Without one, the server uses a linear depth range.
3. Start the server. A browser connected to it sees the committed result:
   the server card's **Pose** and **Depth** chips, or the console's
   Overview.
4. Optionally, from v0.1.6, measure the floor and level the placement to
   it; see [Measure the floor](/docs/operator#measure-the-floor). The
   client's server card then shows a **Floor** chip, for example
   `Floor valid · r2`.

[First stream](/docs/getting-started/first-stream) has a config already set
up for your cameras.
