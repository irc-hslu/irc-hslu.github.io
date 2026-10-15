# Calibration (https://irc-hslu.github.io/orbbecstreamer/docs/guides/calibration)



There are three calibration kinds. Each one is a server-side state; a client
can show it and, for some kinds, run it over a browser session. From
v0.1.0-poc.7 the session also carries live video (see
[Serve to browsers](/docs/server/serving)); up to poc.6 it carries status and
setup commands only. The team has not yet checked depth calibration on a
live scene on real hardware.

| Kind               | On the server                                                                                                                                                                                                                                                                               | From a browser, against a real server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera pose        | One camera needs none: from v0.1.0-poc.7 the server writes its identity pose at start. Several cameras: works from the local console with a ChArUco board, tested with synthetic cameras and not yet validated on hardware. See [Camera pose calibration](/docs/server/camera-calibration). | The server accepts a camera-pose run from a client that holds the setup lock. With `autocalibrate: false` (the packaged default) that only re-runs a pose that is already valid; a missing pose must be calibrated on the server. The client has no camera-pose controls yet: its section shows a placeholder. See [Calibrate depth](/docs/client/calibration#camera-pose).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Depth quantization | Works from a CLI tool. See [Depth quantization calibrator](/docs/server/depth-quantization-calibrator).                                                                                                                                                                                     | The server runs it for a client that holds the setup lock (since v0.1.0-poc.4): it samples live, masked depth, and a solved run waits for a commit, which swaps the new profile in without a restart. From v0.1.0-poc.6, the client can also commit the run against a real server: it follows the server's "solved; awaiting commit" behaviour. This was tested against the mock server; a check on real hardware is pending. With poc.5, the client can start, watch and cancel a run but not commit it, so use the calibrator or `orbbec-console calibrate depth --commit` (see [Terminal console](/docs/operator/terminal-console#calibrate-from-a-script)). The full flow works against the client's [mock server](/docs/client/developer/mock-server). See [Calibrate depth](/docs/client/calibration#depth-quantization). |
| Network            | Not available. A stream is reserved in the wire format, but no calibration procedure exists yet.                                                                                                                                                                                            | Not available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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
**Calibration** on its Overview. From poc.6, its **Depth range** screen
also runs and commits a depth-quantization calibration: see
[Calibrate the depth range](/docs/operator#calibrate-the-depth-range). The
[terminal console](/docs/operator/terminal-console#calibrate-from-a-script)
does the same from a script with `orbbec-console calibrate depth --commit`.

## Run calibration today [#run-calibration-today]

Run camera pose and depth quantization on the server:

1. With several cameras, calibrate the camera pose from the server console
   with `--calibrate-camera-pose`. See
   [Camera pose calibration](/docs/server/camera-calibration). With one
   camera, poc.7 and later skip this step.
2. Optionally, build a depth quantization profile with the calibrator. See
   [Depth quantization calibrator](/docs/server/depth-quantization-calibrator).
   Without one, the server uses a linear depth range.
3. Start the server. A browser connected to it sees the committed result:
   the server card's **Pose** and **Depth** chips, or the console's
   Overview.

[First stream](/docs/getting-started/first-stream) has a config already set
up for your cameras.
