# Install the release package (https://irc-hslu.github.io/orbbecstreamer/docs/getting-started/install-package)



The release package installs the server, the browser client and the
[Operator Console](/docs/operator) on one Ubuntu PC, as systemd services.
Nothing is built from source. To build from source instead, see
[Build the server from source](/docs/getting-started/install-server).

<Callout type="warn">
  v0.1.0-poc.3 is a non-commercial proof of concept. Browsers on the server
  PC get status and setup, but no video yet (see
  [Serve to browsers](/docs/server/serving#status)). Other computers on the
  network can't connect yet.
</Callout>

<Steps>
  <Step>
    ## Check your machine [#check-your-machine]

    * **Ubuntu 26.04.** The package is built against its C library and FFmpeg 8;
      other releases aren't supported yet.
    * **An NVIDIA GPU** with compute capability 7.5 or newer.
    * **The NVIDIA driver 580 or newer, installed by you**, for example
      `sudo apt install nvidia-open` from NVIDIA's apt repository, then a reboot.
      The package neither contains nor installs a driver.
    * **One or more Orbbec cameras** on USB 3.

    Check the driver:

    ```bash
    nvidia-smi --query-gpu=name,driver_version,compute_cap --format=csv
    ```

    **Expected result:** your GPU, a driver version of 580 or higher, and a
    compute capability of 7.5 or higher.
  </Step>

  <Step>
    ## Add NVIDIA's apt repository [#add-nvidias-apt-repository]

    The package pulls the CUDA runtime and TensorRT (about 2 GB) from NVIDIA's
    repository:

    ```bash
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2604/x86_64/cuda-keyring_1.1-1_all.deb
    sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt update
    ```
  </Step>

  <Step>
    ## Install the package [#install-the-package]

    Download `orbbec-streamer_0.1.0.poc3-1_amd64.deb` from the
    [v0.1.0-poc.3 release](https://github.com/irc-hslu/orbbecstreamer/releases/tag/v0.1.0-poc.3),
    or from the release link you were given, then, in the download folder:

    ```bash
    sudo apt install ./orbbec-streamer_0.1.0.poc3-1_amd64.deb
    ```

    The release page is in a private repository, so only people with access to
    it can download from there. There is no public download yet.

    The package version inside the file is `0.1.0~poc3-1`. The install:

    * creates the system user `orbbec-streamer`, the state folder
      `/var/lib/orbbec-streamer` and the TLS certificates in
      `/etc/orbbec-streamer/tls`;
    * installs the udev rules for the cameras;
    * runs the machine check (below), which only reports and never stops the
      install;
    * enables and starts `orbbec-streamer`, `orbbec-streamer-web` and the
      certificate renewal timer `orbbec-tls-renew.timer`.
  </Step>

  <Step>
    ## Check the machine [#check-the-machine]

    ```bash
    orbbec-streamer-preflight
    ```

    **Expected result** on a ready machine, ending with `preflight: OK`:

    ```text
    PASS  nvidia-driver                driver 580.178.04 (minimum 580)
    PASS  gpu-compute-capability       NVIDIA GeForce RTX 4090 sm_89 (minimum sm_75)
    PASS  driver-libraries             libcuda.so.1 and libnvidia-encode.so.1 (NVENC) present
    PASS  cuda-runtime                 libcudart.so.13 at /usr/local/cuda/targets/x86_64-linux/lib/libcudart.so.13 (cuda-cudart-13-4 13.4.92-1)
    PASS  tensorrt                     libnvinfer.so.11 and libnvonnxparser.so.11 present (libnvinfer11 11.3.0.99-1+cuda13.4)
    PASS  usb3:2-6                     Orbbec Femto Bolt 3D Camera (066b) negotiated 5000 Mbit/s
    PASS  udev-rules                   /usr/lib/udev/rules.d/99-orbbec-streamer.rules installed
    PASS  service-account              system user 'orbbec-streamer' exists
    preflight: OK (0 FAIL, 0 WARN)
    ```

    Every `FAIL` or `WARN` line is followed by a `fix:` line that says what to
    do. `--json` prints the same results as JSON.
  </Step>

  <Step>
    ## Connect the cameras and wait for the first start [#connect-the-cameras-and-wait-for-the-first-start]

    With the cameras connected, the server starts capturing. **The first start
    builds the segmentation engine for your GPU**: about 3 minutes, once. Until
    it's ready, frames pass through without background removal. Follow it with:

    ```bash
    journalctl -u orbbec-streamer -f
    ```

    The engine is cached in `/var/lib/orbbec-streamer/engines` and rebuilt only
    when the GPU, TensorRT, the model or the number of cameras changes.
  </Step>

  <Step>
    ## Open the client [#open-the-client]

    In Chrome or Edge **on the server PC**, open [http://127.0.0.1:8080](http://127.0.0.1:8080). The
    page finds the server and its certificate by itself, so you don't enter an
    address or trust a certificate. The certificate rotates about every 6 days
    with no action from you.

    The read-only Operator Console is at [http://127.0.0.1:8080/operator](http://127.0.0.1:8080/operator). See
    [Operator Console](/docs/operator).
  </Step>
</Steps>

## Files and services [#files-and-services]

| Path                                           | What it is                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/etc/orbbec-streamer/live.yaml`               | The server's config. On upgrade, `apt` asks whether to keep your edited version; see [Upgrade](#upgrade). See [Configuration](/docs/server/configuration). |
| `/etc/orbbec-streamer/tls/`, `tls.conf`        | Certificates and their settings                                                                                                                            |
| `/var/lib/orbbec-streamer/`                    | Engine cache and calibration                                                                                                                               |
| `/usr/lib/orbbec-streamer/bin/orbbec_streamer` | The server, also `orbbec-streamer` on the `PATH`                                                                                                           |
| `/usr/share/orbbec-streamer/client/`           | The browser client and, in `operator/`, the Operator Console                                                                                               |
| `/usr/share/doc/orbbec-streamer/`              | Licences and notices                                                                                                                                       |

| Service                  | Does                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `orbbec-streamer`        | Capture, GPU processing, encoding and the WebTransport gateway on `127.0.0.1:4443` |
| `orbbec-streamer-web`    | Serves the client on `http://127.0.0.1:8080`, on this PC only                      |
| `orbbec-tls-renew.timer` | Renews the certificates                                                            |

Check them with `systemctl status orbbec-streamer orbbec-streamer-web`.

## Upgrade [#upgrade]

Install the newer package the same way:

```bash
sudo apt install ./orbbec-streamer_<version>_amd64.deb
```

Replace `<version>` with the new file's version. The service restarts. The
certificates and the engine cache are kept. If you edited `live.yaml` or
`tls.conf` and the new package changes that file too, `apt` asks which
version to keep.

<Callout type="warn">
  **Upgrading from poc.1 or poc.2 with an edited `live.yaml`:** keeping your
  version keeps the old `mask.rvm_engine_path`. The server then loads only
  that engine file and never builds one, so it fails at start if the file is
  missing, was built for another GPU or TensorRT, or the rig has two
  cameras. Take the package's version and re-apply your edits, or fix the
  `mask:` section as in [Troubleshooting](#troubleshooting).
</Callout>

## Uninstall [#uninstall]

* `sudo apt remove orbbec-streamer` removes the programs and services and
  keeps your config, certificates and `/var/lib/orbbec-streamer`.
* `sudo apt purge orbbec-streamer` also deletes `/etc/orbbec-streamer` and
  `/var/lib/orbbec-streamer`, including the engine cache and calibration.

Both keep the `orbbec-streamer` user and group. The NVIDIA packages stay
installed; `sudo apt autoremove` offers to remove them.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                                               | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preflight` shows `FAIL  nvidia-driver` or `FAIL  driver-libraries`                                                                   | No NVIDIA driver 580 or newer. Install it (for example `sudo apt install nvidia-open`), reboot, and run `orbbec-streamer-preflight` again.                                                                                                                                                                                                                                                                                                                            |
| `preflight` shows `FAIL  cuda-runtime` or `FAIL  tensorrt`                                                                            | NVIDIA's apt repository is missing. Add it (step 2), then run the `sudo apt install` command in the `fix:` line.                                                                                                                                                                                                                                                                                                                                                      |
| `WARN  orbbec-cameras`                                                                                                                | No camera is connected. Connect it to a USB 3 port.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| The log repeats `No configured cameras are active`                                                                                    | No camera was found at start. The service retries with a growing delay and stops after 10 starts in 30 minutes. Connect the camera, then run `sudo systemctl reset-failed orbbec-streamer && sudo systemctl start orbbec-streamer`.                                                                                                                                                                                                                                   |
| After an upgrade, the log shows `Cannot open TensorRT engine: …` or an engine deserialisation error, and the service keeps restarting | You kept an edited `live.yaml` from poc.1 or poc.2, which names a fixed engine file. In the `mask:` section of `/etc/orbbec-streamer/live.yaml`, delete `rvm_engine_path` and set `rvm_onnx_path: "/usr/share/orbbec-streamer/models/rvm/rvm_mobilenetv3_b{batch}_640x576_ds0.5_float16.onnx"` and `rvm_engine_cache_dir: "/var/lib/orbbec-streamer/engines"`. Then run `sudo systemctl restart orbbec-streamer`; the first start builds the engine (3 to 4 minutes). |
| The log shows `error while loading shared libraries: libcuda.so.1`                                                                    | The NVIDIA driver is missing. Install it and reboot.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The Femto Bolt doesn't start; the log shows depth engine error 204                                                                    | The service sandbox may block it. Run `sudo systemctl edit orbbec-streamer`, add the two lines `[Service]` and `DevicePolicy=auto`, save, then run `sudo systemctl restart orbbec-streamer`.                                                                                                                                                                                                                                                                          |
| The page at `http://127.0.0.1:8080` loads, but nothing connects                                                                       | The gateway starts only once a camera is active, and the first start may still be building the engine. Check `journalctl -u orbbec-streamer -f`.                                                                                                                                                                                                                                                                                                                      |
| The page doesn't load                                                                                                                 | Check `systemctl status orbbec-streamer-web` and `journalctl -u orbbec-streamer-web`.                                                                                                                                                                                                                                                                                                                                                                                 |
| Another computer can't open the page                                                                                                  | Expected in this release: open it on the server PC.                                                                                                                                                                                                                                                                                                                                                                                                                   |
