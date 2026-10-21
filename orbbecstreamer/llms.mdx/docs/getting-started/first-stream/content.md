# First stream (https://irc-hslu.github.io/orbbecstreamer/docs/getting-started/first-stream)



<Callout type="warn">
  Live video in the browser needs v0.1.0-poc.7 or later. With poc.6 and
  earlier, a browser gets the server's status and setup but no video; use
  the server's telemetry and debug recordings (below) to see your capture.
  Up to v0.1.4 the team has checked the depth picture on a live scene once,
  on a development build in a dark room. It has not yet checked the colour
  picture or depth calibration on a live, lit scene on real hardware.
</Callout>

## Connect a browser to the release package [#connect-a-browser-to-the-release-package]

With the [release package](/docs/getting-started/install-package) installed
and at least one Orbbec camera connected:

1. Make sure the server runs. From v0.1.0-poc.10 the install starts it,
   with the cameras closed. Up to poc.9, start it yourself:

   ```bash
   sudo systemctl start orbbec-streamer
   ```

   Up to poc.8, the gateway starts only once a camera is active.

2. In Chrome or Edge **on the server PC**, open
   [http://127.0.0.1:8080](http://127.0.0.1:8080) (or
   `http://localhost:8080`). By default the gateway accepts only these two
   page addresses; for other computers, see
   [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan).

3. The client finds the server by itself and adds it; you type nothing. A
   server card appears under **Servers**.

4. From v0.1.0-poc.9 the card reads **Cameras closed**: select **Start
   cameras**. Opening the cameras can take up to a minute.

**Expected result:** the card connects and shows the server's state and
calibration chips. From poc.7, with one camera, the point cloud appears: the
server writes the camera's identity pose at its first start, so there is no
setup step. Several cameras need a camera-pose calibration with a ChArUco
board first, which the team has not yet validated on hardware (from
v0.1.0-poc.11 in the Operator Console, see
[Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses); up to
poc.10 see [Camera pose calibration](/docs/server/camera-calibration)); until then the
card shows the server needs setup and no point cloud. How much CPU the
decoder needs depends on the PC; see
[Check your browser](/docs/client/browser-requirements). If the card shows **Server
or camera not running**, start the server as in step 1 and connect a
camera; the card then connects by itself. For other problems, and for
typing the address and certificate hash by hand, see
[Add a server](/docs/client/add-a-server).

The [Operator Console](/docs/operator) at
`http://127.0.0.1:8080/operator` connects the same way. From poc.7 its
**Preview** screen shows the same live video.

## Run a source build on your own cameras [#run-a-source-build-on-your-own-cameras]

This needs a [server built from source](/docs/getting-started/install-server)
and at least one attached Orbbec camera.

<Steps>
  <Step>
    ## Adapt the config to your rig [#adapt-the-config-to-your-rig]

    `config/dev/live.yaml` describes the development rig, not yours. Copy it and
    edit the camera serial numbers, sync settings and mask backend for your own
    cameras. Full steps:
    [Adapt the config to your rig](/docs/server/running#adapt-the-config-to-your-rig).

    The short version, from `server/`:

    ```bash
    mkdir -p config/local
    cp config/dev/live.yaml config/local/live.yaml
    ./build/dev-debug/orbbec_streamer --orbbec-test   # read each camera's serial
    ```

    Then edit `config/local/live.yaml`: set each camera's `serial_number`, and
    either build the RVM engine or set `mask.backend: fill_all` to run without
    segmentation.
  </Step>

  <Step>
    ## Run it [#run-it]

    ```bash
    cd server
    ./build/dev-debug/orbbec_streamer --live config/local/live.yaml
    ```
  </Step>

  <Step>
    ## Watch it work [#watch-it-work]

    The terminal redraws a rate table roughly every 5 seconds. After the
    warm-up, every stage should reach your configured frame rate with 0 drops.
    See [Read the telemetry](/docs/server/telemetry) for what each line means,
    and [Run the server](/docs/server/running#expected-result) for a full
    worked log.

    Stop it with `Ctrl+C` when you're done; it shuts down cleanly.
  </Step>

  <Step>
    ## Watch your own capture [#watch-your-own-capture]

    With `debug_recording.record_gpu_outputs: true` and
    `locally_decode_gpu_outputs: true` in the config, open
    `debug/live/<camera>/gpu-output-depth-inferno.mkv` in any video player to
    see your own depth stream, colourised. See
    [Run the server](/docs/server/running#debug-recording-output) for the full
    file list.
  </Step>

  <Step>
    ## Optional: preview it in the client [#optional-preview-it-in-the-client]

    The browser client can also play back the server's debug recording, without
    a server. The server writes `manifest.json` at the top of `debug/live/` (from
    v0.1.0-poc.6), and from v0.1.0-poc.7 the client opens that folder. In the
    client, unfold **Open recording** under **Servers**, choose that folder (the one that holds `manifest.json`, not single files) under
    **Recording folder (with manifest.json)**, or use **Browse for the folder…**,
    then select **Play recording**. With an older server there is no manifest:
    you write one by hand alongside the raw `.hevc` files. See
    [Play a recording](/docs/client/playback) for the steps and the manifest
    format. Desktop Chrome plays a recording, also on a Linux PC with an NVIDIA
    GPU, where the client uses its built-in WebAssembly decoder; see
    [Check your browser](/docs/client/browser-requirements).
  </Step>
</Steps>

## Troubleshooting [#troubleshooting]

Every start-up failure and its fix are in
[Run the server](/docs/server/running#troubleshooting) and
[Configuration](/docs/server/configuration#troubleshooting). For calibrating
depth quantization or camera pose next, see
[Calibration](/docs/guides/calibration).
