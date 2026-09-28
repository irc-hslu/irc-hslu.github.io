# First stream (https://irc-hslu.github.io/orbbecstreamer/docs/getting-started/first-stream)



<Callout type="warn">
  Browsers cannot get a live stream from a real server yet: WebTransport
  serving is not implemented (see [Serve to browsers](/docs/server/serving)).
  A working first stream today runs entirely on the server, verified by its
  own telemetry and debug recordings.
</Callout>

This needs a [built server](/docs/getting-started/install-server) and at
least one attached Orbbec camera.

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
    See [Play back .hevc recordings](/docs/client/playback) for the file
    requirements and the manifest format. Real HEVC decoding has not been
    verified in a desktop browser yet either; see
    [Browser requirements](/docs/client/browser-requirements).
  </Step>
</Steps>

## Troubleshooting [#troubleshooting]

Every start-up failure and its fix are in
[Run the server](/docs/server/running#troubleshooting) and
[Configuration](/docs/server/configuration#troubleshooting). For calibrating
depth quantization or camera pose next, see
[Calibration](/docs/guides/calibration).
