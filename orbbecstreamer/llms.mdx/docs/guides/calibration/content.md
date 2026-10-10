# Calibration (https://irc-hslu.github.io/orbbecstreamer/docs/guides/calibration)



There are three calibration kinds. Each one is a server-side state; a client
can show it and, for some kinds, run it over a browser session. A browser
session to a real server carries status and setup commands but no video yet
(see [Serve to browsers](/docs/server/serving#status)).

| Kind               | On the server                                                                                           | From a browser, against a real server                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera pose        | Works from the local console. See [Camera pose calibration](/docs/server/camera-calibration).           | The server accepts a camera-pose run from a client that holds the setup lock. With `autocalibrate: false` (the packaged default) that only re-runs a pose that is already valid; a missing pose must be calibrated on the server. The client has no camera-pose controls yet: its section shows a placeholder. See [Calibrate depth](/docs/client/calibration#camera-pose).                                                                                                                                                                                                                                                                                                                                                   |
| Depth quantization | Works from a CLI tool. See [Depth quantization calibrator](/docs/server/depth-quantization-calibrator). | The server runs it for a client that holds the setup lock (since v0.1.0-poc.4): it samples live, masked depth, and a solved run waits for a commit, which swaps the new profile in without a restart. Against a real server, committing a depth-quantization run is not yet possible from the client: the client and server still follow two different proposals for when a calibration result is sent (change requests 0012 and 0023), and the fix waits on that decision. Start, progress and Cancel work. To change the profile today, use the calibrator. The full flow works against the client's [mock server](/docs/client/developer/mock-server). See [Calibrate depth](/docs/client/calibration#depth-quantization). |
| Network            | Not available. A stream is reserved in the wire format, but no calibration procedure exists yet.        | Not available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Before a depth run from a browser [#before-a-depth-run-from-a-browser]

The server refuses to start a depth run, with `calibration-unavailable`
and a reason, when:

* no capture is active (no camera is delivering frames);
* `mask.backend` or `processing.depth_filter_backend` is `none`;
* the person-mask engine is still being built on the first start, or has
  failed. Masks then pass every pixel, so the profile would include the
  background. Wait until the mask engine is ready, or set
  `mask.backend: fill_all` to calibrate on all depth.

Only one calibration run of any kind runs at a time. Cancelling, releasing
the lock or disconnecting abandons the run and keeps the profile in force.

<Callout type="warn">
  **Known issues in v0.1.0-poc.4:**

  * A depth run can be solved from too few valid samples; there is no
    minimum yet. Check **valid samples** and **reconstruction error** before
    you commit.
  * After a server restart, the depth-quantization revision starts again at
    1, although the committed profile loads.

  A fix is in progress.
</Callout>

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
