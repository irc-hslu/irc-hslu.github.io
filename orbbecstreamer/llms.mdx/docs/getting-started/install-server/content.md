# Build the server from source (https://irc-hslu.github.io/orbbecstreamer/docs/getting-started/install-server)



This is the minimal path for developers. To run OrbbecStreamer without
building it, use [Install the release package](/docs/getting-started/install-package)
instead. The [Server](/docs/server) section has the full
detail for every step, including every package, every troubleshooting
message, and how to build for a GPU other than the tested one.

<Steps>
  <Step>
    ## Check your machine [#check-your-machine]

    The tested machine is Ubuntu 26.04 with an NVIDIA RTX 4090 (compute
    capability 8.9), CUDA 13, TensorRT 11 and Orbbec cameras on USB 3. See
    [Requirements](/docs/server/requirements) for the full list and a check
    command for each item, including what to do on an older GPU.
  </Step>

  <Step>
    ## Clone the repository [#clone-the-repository]

    ```bash
    git clone --recurse-submodules git@github.com:irc-hslu/orbbecstreamer.git
    cd orbbecstreamer/server
    ```

    Without a GitHub SSH key, see [Install](/docs/server/install#get-the-source)
    for the HTTPS form.
  </Step>

  <Step>
    ## Install the system packages and SDKs [#install-the-system-packages-and-sdks]

    Follow [Install](/docs/server/install) start to finish: system packages,
    CUDA, TensorRT, the Orbbec SDK and vcpkg. The RVM segmentation engine near
    the end is optional; skip it for now.
  </Step>

  <Step>
    ## Configure and build [#configure-and-build]

    ```bash
    cmake --preset dev-debug
    cmake --build --preset debug
    ```

    The first configure builds every vcpkg dependency from source and can take
    a long time. The presets set the compiler, CUDA and library-path variables
    for you; see
    [Environment variables](/docs/server/configuration#environment-variables)
    for the full list. See [Build and test](/docs/server/build) for the Makefile
    shortcuts, the CTest labels, CLion setup, and how to build for a GPU below
    compute capability 8.9.
  </Step>

  <Step>
    ## Verify [#verify]

    ```bash
    ./build/dev-debug/orbbec_streamer --cuda-test
    ./build/dev-debug/orbbec_streamer --nvenc-test
    ```

    **Expected result:** `--cuda-test` reports your GPU and ends
    `CUDA smoke test OK`; `--nvenc-test` reports `main10=true` and ends
    `NVENC capability test passed`. See
    [Build and test](/docs/server/build#expected-result) for the full output on
    the reference machine, and its
    [Troubleshooting](/docs/server/build#troubleshooting) table for every
    failure message.
  </Step>
</Steps>

Next: [First stream](/docs/getting-started/first-stream). Want the browser
client too? See [Run the client](/docs/client/dev-build).
