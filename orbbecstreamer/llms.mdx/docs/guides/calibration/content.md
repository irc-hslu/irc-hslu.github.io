# Calibration (https://irc-hslu.github.io/orbbecstreamer/docs/guides/calibration)



There are three calibration kinds. Each one is a server-side state; a client
can show it and, for some kinds, run it over a browser session. A browser
session to a real server carries status and setup commands but no video yet
(see [Serve to browsers](/docs/server/serving#status)).

| Kind               | On the server                                                                                           | From a browser, against a real server                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera pose        | Works from the local console. See [Camera pose calibration](/docs/server/camera-calibration).           | The server accepts a camera-pose run from a client that holds the setup lock. With `autocalibrate: false` (the packaged default) that only re-runs a pose that is already valid; a missing pose must be calibrated on the server. The client has no camera-pose controls yet: its section shows a placeholder. See [Calibrate depth](/docs/client/calibration#camera-pose). |
| Depth quantization | Works from a CLI tool. See [Depth quantization calibrator](/docs/server/depth-quantization-calibrator). | Not yet. The client's workspace can start, watch, cancel and commit a run, but a real server refuses it with `calibration-kind-unsupported`. It works against the client's mock server: see [Calibrate depth](/docs/client/calibration#depth-quantization) and [Mock server](/docs/client/developer/mock-server).                                                           |
| Network            | Not available. A stream is reserved in the wire format, but no calibration procedure exists yet.        | Not available.                                                                                                                                                                                                                                                                                                                                                              |

The read-only [Operator Console](/docs/operator) shows each kind's state
under **Calibration** on its Overview, and changes nothing.

## Run calibration today [#run-calibration-today]

Run camera pose and depth quantization on the server:

1. Calibrate the camera pose from the server console with
   `--calibrate-camera-pose`. See
   [Camera pose calibration](/docs/server/camera-calibration).
2. Optionally, build a depth quantization profile with the calibrator. See
   [Depth quantization calibrator](/docs/server/depth-quantization-calibrator).
   Without one, the server uses a linear depth range.
3. Start the server. A browser connected to it sees the committed result:
   the server card's **Pose** and **Depth** chips, or the console's
   Overview.

[First stream](/docs/getting-started/first-stream) has a config already set
up for your cameras.
