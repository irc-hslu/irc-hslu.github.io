# First stream (https://irc-hslu.github.io/orbbecstreamer/docs/getting-started/first-stream)



<Callout type="warn">
  A browser can connect to a real server today and gets its status and
  setup, but no video yet: the server sends colour and depth to browsers
  only once protocol change 0009 is decided (see
  [Serve to browsers](/docs/server/serving#status)). To see your own capture
  today, use the server's telemetry and debug recordings (below).
</Callout>

## Connect a browser to the release package [#connect-a-browser-to-the-release-package]

With the [release package](/docs/getting-started/install-package) installed
and at least one Orbbec camera connected:

1. Make sure the server is running. From poc.4 on, the install doesn't start
   it:

   ```bash
   sudo systemctl start orbbec-streamer
   ```

   The gateway starts only once a camera is active.

2. In Chrome or Edge **on the server PC**, open
   [http://127.0.0.1:8080](http://127.0.0.1:8080) (or
   `http://localhost:8080`). The gateway accepts only these two page
   addresses.

3. The client finds the server by itself and adds it; you type nothing. A
   server card appears under **Servers**.

**Expected result:** the card connects and shows the server's state and
calibration chips. It shows no point cloud yet. If the card shows **Server
or camera not running**, start the server as in step 1 and connect a
camera; the card then connects by itself. For other problems, and for
typing the address and certificate hash by hand, see
[Add a server](/docs/client/add-a-server).

The read-only [Operator Console](/docs/operator) at
`http://127.0.0.1:8080/operator` connects the same way.

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

    The browser client can play back a recorded `.hevc` colour and depth pair
    today, without a server. Bridging your server's debug output into the
    client's recording format is manual: you write a manifest by hand (camera
    intrinsics, depth range and lookup table) alongside the raw `.hevc` files.
    See [Play a recording](/docs/client/playback) for the file
    requirements and the manifest format. Desktop Chrome plays such a recording,
    also on a Linux PC with an NVIDIA GPU, where the client uses its built-in
    WebAssembly decoder; see
    [Check your browser](/docs/client/browser-requirements).
  </Step>
</Steps>

## Troubleshooting [#troubleshooting]

Every start-up failure and its fix are in
[Run the server](/docs/server/running#troubleshooting) and
[Configuration](/docs/server/configuration#troubleshooting). For calibrating
depth quantization or camera pose next, see
[Calibration](/docs/guides/calibration).
