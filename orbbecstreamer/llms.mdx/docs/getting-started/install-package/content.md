# Install the release package (https://irc-hslu.github.io/orbbecstreamer/docs/getting-started/install-package)



The release package installs the server, the browser client and the
[Operator Console](/docs/operator) on one Ubuntu PC, as systemd services.
Nothing is built from source. To build from source instead, see
[Build the server from source](/docs/getting-started/install-server).

<Callout type="warn">
  v0.1.0 was the first complete release: install, start the cameras,
  calibrate and view in a browser. v0.1.1 adds network sensing; v0.1.2 fills in the media rate on the Network page and fixes from the live run; v0.1.3 adds a hardware check, the WebGL2 fallback notice and console discovery, and fixes mirrored camera poses; v0.1.4 changes the default calibration board and draws it on the **Camera pose** screen, with a download to print, and blends overlapping cameras with WebGL2 where it works well. It is a non-commercial proof of concept
  (GPL-3.0 segmenter, no licence check), for evaluation only. Live video (from
  v0.1.0-poc.7): browsers on the server PC get status, setup and
  the cameras' colour and depth (see
  [Serve to browsers](/docs/server/serving)). The team has checked the depth
  picture on a live scene once, on a development build in a dark room; it
  has not yet checked the colour picture or depth calibration on a live,
  lit scene on real hardware. Browsers on other computers in the LAN can view the cameras if
  you turn that on; the team has not yet tried it from a second machine. See
  [Remote viewers on the LAN](#remote-viewers-on-the-lan). The team has not
  yet installed it on a clean machine with a GPU and cameras.
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
    * **One or more Orbbec cameras** on USB 3. Two or more also need sync
      cables between them; see [More than one camera](#more-than-one-camera).

    <Callout type="info" title="Recommended hardware (provisional; measured on stand-ins)">
      The team tested the server on an RTX 4090. For 2 cameras it expects the
      server PC to need at least an RTX 3060-class GPU, 8 CPU cores and 16 GB of
      RAM; the team has not tested that minimum yet. From v0.1.3 the machine
      check warns when the PC is below it (see [Check the machine](#check-the-machine)).

      A computer that views the cameras needs a CPU with 4 cores and 8 threads
      at 3.0 GHz or faster, 8 GB of RAM, a GPU that supports WebGL2, a current
      Chrome or Edge, and wired 1 Gbit/s Ethernet. See
      [Minimum viewer hardware](/docs/client/browser-requirements#minimum-viewer-hardware)
      for how it was measured.
    </Callout>

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

    Download `orbbec-streamer_0.1.4-1_amd64.deb` from the
    [v0.1.4 release](https://github.com/irc-hslu/orbbecstreamer/releases/tag/v0.1.4),
    together with `SHA256SUMS`, or from the release link you were given. In
    the download folder, check the file, then install it:

    ```bash
    sha256sum --check --ignore-missing SHA256SUMS
    sudo apt install ./orbbec-streamer_0.1.4-1_amd64.deb
    ```

    `sha256sum` must print `orbbec-streamer_0.1.4-1_amd64.deb: OK`. The
    release lists its SHA-256 as `b587914516bea45d6270b72c76df6ca01ea3860022ed9d8a3a52175e51cb7859`.

    The release also carries the source of the segmentation model and a relink
    kit for the client's video decoder, which the decoder's LGPL licence
    requires. You don't need either to install.

    The release page is in a private repository, so only people with access to
    it can download from there. There is no public download yet.

    The package version inside the file is `0.1.4-1`. It sorts above every
    poc package, so upgrading from a poc works as usual. The install:

    * creates the system user `orbbec-streamer`, the empty group
      `orbbec-operators` (see [Terminal console](/docs/operator/terminal-console#start-and-stop-without-sudo)), the state folder
      `/var/lib/orbbec-streamer` and the TLS certificates in
      `/etc/orbbec-streamer/tls`;
    * installs the udev rules for the cameras;
    * runs the machine check (below), which only reports and never stops the
      install;
    * starts `orbbec-streamer-web` and the certificate renewal timer
      `orbbec-tls-renew.timer`;
    * from v0.1.0-poc.10, enables and starts the server service
      `orbbec-streamer` with the cameras closed. You open them from the client
      or the Operator Console with **Start cameras**. It prints:

    ```text
    orbbec-streamer: installed and started; cameras closed until an app opens them: http://127.0.0.1:8080 (Start cameras), http://127.0.0.1:8080/operator or orbbec-console
    orbbec-streamer: the first start builds the segmentation engine for this GPU (minutes); follow it with: journalctl -fu orbbec-streamer
    ```

    To stop the server and keep it off at boot:

    ```bash
    sudo systemctl disable --now orbbec-streamer
    ```

    Up to poc.9, the install doesn't start or enable `orbbec-streamer`, and
    prints `installed; cameras stay off until you run: sudo systemctl start
    orbbec-streamer`; you start it in step 5.
  </Step>

  <Step>
    ## Check the machine [#check-the-machine]

    ```bash
    orbbec-streamer-preflight
    ```

    **Expected result** on a ready machine, ending with `preflight: OK` (shortened: v0.1.4 also prints the `floor-*` lines below, `tensorrt-cuda-match` and one `udev-access:` line per camera):

    ```text
    PASS  nvidia-driver                driver 580.178.04 (minimum 580)
    PASS  gpu-compute-capability       NVIDIA GeForce RTX 4090 sm_89 (minimum sm_75)
    PASS  driver-libraries             libcuda.so.1, libnvidia-ml.so.1 (NVML) and libnvidia-encode.so.1 (NVENC) present
    PASS  cuda-runtime                 libcudart.so.13 at /usr/local/cuda/targets/x86_64-linux/lib/libcudart.so.13 (cuda-cudart-13-4 13.4.92-1)
    PASS  tensorrt                     libnvinfer.so.11 and libnvonnxparser.so.11 present (libnvinfer11 11.3.0.99-1+cuda13.4)
    PASS  usb3:2-6                     Orbbec Femto Bolt 3D Camera (066b) negotiated 5000 Mbit/s
    PASS  udev-rules                   /usr/lib/udev/rules.d/99-orbbec-streamer.rules installed
    PASS  service-account              system user 'orbbec-streamer' exists
    preflight: OK (0 FAIL, 0 WARN)
    ```

    Every `FAIL` or `WARN` line is followed by a `fix:` line that says what to
    do. `--json` prints the same results as JSON.

    From v0.1.3 three more lines compare the PC with the recommended hardware
    above: `floor-gpu`, `floor-cpu` and `floor-ram`. Below it they print `WARN`,
    never `FAIL`, so the install goes ahead; the server may still run with
    fewer cameras. `floor-gpu` rates only GeForce GPUs (RTX 30-series xx60 or
    newer, with at least 8 GB of memory); for other GPUs it passes with `not
    classified`.
  </Step>

  <Step>
    ## Wait for the first start [#wait-for-the-first-start]

    Connect the cameras. From v0.1.0-poc.10 the install has already started the
    server. Up to poc.9, start it yourself, and enable it if it should also
    start at boot:

    ```bash
    sudo systemctl start orbbec-streamer
    sudo systemctl enable orbbec-streamer
    ```

    Up to poc.8, the server then starts capturing. From v0.1.0-poc.9, it
    starts with the cameras closed (idle) and waits until a client asks it to
    open them; you do that in the next step. **The first start
    builds the segmentation engine for your GPU**, whether the cameras are open
    or not: about 3 minutes, once. Until
    it's ready, frames pass through without background removal. Follow it with:

    ```bash
    journalctl -u orbbec-streamer -f
    ```

    The engine is cached in `/var/lib/orbbec-streamer/engines` and rebuilt only
    when the GPU, TensorRT, the model or the number of cameras changes.

    In v0.1.0-poc.7 the server may stop once, about 4 minutes after its first
    start, when the engine build finishes; systemd restarts it within seconds.
    poc.8 fixes this.

    With one camera, the server writes the camera's identity pose at its first
    start, so it needs no calibration (from poc.7). Several cameras need a
    camera-pose calibration first; see [More than one camera](#more-than-one-camera).
  </Step>

  <Step>
    ## Open the client [#open-the-client]

    In Chrome or Edge **on the server PC**, open [http://127.0.0.1:8080](http://127.0.0.1:8080). The
    page finds the server and its certificate by itself, so you don't enter an
    address or trust a certificate. The certificate rotates about every 6 days
    with no action from you.

    From v0.1.0-poc.9, the server's card reads **Cameras closed** until you
    select **Start cameras**. From v0.1.0-poc.10, the Operator Console has the
    same button (see [Operator Console](/docs/operator#cameras-closed)). The server then opens the cameras, which can take
    up to a minute, and stays open until the service stops. See
    [Server card](/docs/client/server-card). To open the cameras at every
    start instead, set `start_capture_on_launch: true` under `serving:` in
    `/etc/orbbec-streamer/live.yaml` and restart the service.

    From poc.7 the page shows the cameras' point cloud once the server is
    streaming. On a Linux PC with an NVIDIA GPU the client decodes the video with
    its built-in decoder, on the CPU; how much CPU
    it needs depends on the PC (see
    [Check your browser](/docs/client/browser-requirements)).

    The Operator Console is at [http://127.0.0.1:8080/operator](http://127.0.0.1:8080/operator). See
    [Operator Console](/docs/operator).
  </Step>
</Steps>

## More than one camera [#more-than-one-camera]

The package's `/etc/orbbec-streamer/live.yaml` is set up for one camera.
Two or more cameras must be hardware-synchronised:

1. Connect the sync cables between the cameras.

2. In `/etc/orbbec-streamer/live.yaml`, give every camera an entry with its
   `serial_number` (printed on the camera). Exactly one has
   `role: "primary"`; the others have `role: "secondary"`:

   ```yaml
   cameras:
     - id: "cam0"
       vendor: "orbbec"
       serial_number: "<serial of the primary camera>"
       required: true
       role: "primary"
     - id: "cam1"
       vendor: "orbbec"
       serial_number: "<serial of the second camera>"
       required: true
       role: "secondary"
   ```

3. Turn sync on, with the values tested on two Femto Bolts:

   ```yaml
   sync:
     enabled: true
     secondary_depth_delay_step_us: 160
     trigger_out_enable: true
     timestamp_tolerance_us: 5000
   ```

4. Run `sudo systemctl restart orbbec-streamer`.

5. Calibrate the camera poses with a printed ChArUco board: the one in
   `calibration.board` of your `live.yaml`, or the default 4 × 6 board
   (see [Calibration board](#calibration-board)). From
   v0.1.0-poc.11, do it in the Operator Console; see
   [Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses).
   Up to poc.10, do it on the server; see
   [Camera pose calibration](/docs/server/camera-calibration). Until then the
   server stays in “needs setup” and sends no video. The team has tested
   this calibration with synthetic cameras only, not yet on hardware. One
   camera needs no calibration (from poc.7).

See [Configuration](/docs/server/configuration#sync) for every sync key.
Without sync, the server refuses to start with several cameras:
`sync.enabled=false allows only one camera …`. (v0.1.0-poc.4 started and
then stopped after about 10 seconds with `no batch for 10005 ms: the
cameras' frame sets no longer match …`.)

## Files and services [#files-and-services]

| Path                                           | What it is                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/etc/orbbec-streamer/live.yaml`               | The server's config. On upgrade, `apt` asks whether to keep your edited version; see [Upgrade](#upgrade). See [Configuration](/docs/server/configuration).                                                                                                                                    |
| `/etc/orbbec-streamer/tls/`, `tls.conf`        | Certificates and their settings                                                                                                                                                                                                                                                               |
| `/var/lib/orbbec-streamer/`                    | Engine cache and calibration; from poc.6 also `crash/`, where the WebTransport gateway writes a crash file if it crashes; `orbbec-streamer-report` collects the newest three. It needs `serving.crash_directory` in `live.yaml`, which a kept, edited `live.yaml` from an older version lacks |
| `/usr/lib/orbbec-streamer/bin/orbbec_streamer` | The server, also `orbbec-streamer` on the `PATH`                                                                                                                                                                                                                                              |
| `/usr/bin/orbbec-console`                      | The [terminal console](/docs/operator/terminal-console) (preview)                                                                                                                                                                                                                             |
| `/usr/share/orbbec-streamer/client/`           | The browser client and, in `operator/`, the Operator Console                                                                                                                                                                                                                                  |
| `/usr/share/doc/orbbec-streamer/`              | Licences and notices                                                                                                                                                                                                                                                                          |

| Service                  | Does                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `orbbec-streamer`        | Capture, GPU processing, encoding and the WebTransport gateway on `127.0.0.1:4443` |
| `orbbec-streamer-web`    | Serves the client on `http://127.0.0.1:8080`, on this PC only                      |
| `orbbec-tls-renew.timer` | Renews the certificates. From poc.6 the server reloads them without a restart.     |

Check them with `systemctl status orbbec-streamer orbbec-streamer-web`.

## Upgrade [#upgrade]

Install the newer package the same way:

```bash
sudo apt install ./orbbec-streamer_<version>_amd64.deb
```

Replace `<version>` with the new file's version, for example `0.1.4-1`.
Upgrading from a poc package works the same way. The packaged `live.yaml`
changed in v0.1.1 (a commented-out `network_probes` line), so if you edited
yours, the upgrade to v0.1.1 or later asks whether to keep it: keep your
version. It is unchanged in v0.1.2, v0.1.3 and v0.1.4, so an upgrade from v0.1.1 or later doesn't ask.
From v0.1.3 camera poses are no longer mirrored in Y. A camera-pose
calibration committed on v0.1.2 stays valid and now shows correctly, but a
placement chosen while the scene looked mirrored may need placing again.
From v0.1.4 the default calibration board changes; see
[Calibration board](#calibration-board). The first upgrade from
poc.9 or earlier to v0.1.0-poc.10 or later enables and starts the server,
with the cameras closed. Later upgrades restart the server only if it was
running, and never change whether it starts at boot. Exception: if a
`live.yaml` you kept sets `serving.start_capture_on_launch: true` (cameras
open at every start), the upgrade keeps the previous state and prints
`left stopped: /etc/orbbec-streamer/live.yaml sets start_capture_on_launch:
true, so starting would open the cameras`.
Upgrading from poc.3 or earlier restarts it if it is enabled, which those
versions did on install. The certificates, the engine cache and your
calibration are kept.

<Callout type="warn">
  **`serving.console_origins` (from v0.1.0-poc.9).** The package's
  `live.yaml` lists the Operator Console's addresses under
  `serving.console_origins`. A server gives the
  [operator role](/docs/operator#the-operator-role) only to a page on one of
  them. If you keep an edited `live.yaml` from an older version, it has no
  such key. The server then starts as before, logs `serving.console_origins
    is empty: no session can be granted the operator role`, and every console
  session is a viewer: it can't change sensor settings or the stream
  profile or take over the setup lock. To get the role, add to the
  `serving:` section (each entry must also be in `allowed_origins`):

  ```yaml
  console_origins:
    - "http://127.0.0.1:8080"
    - "http://localhost:8080"
  ```

  **Downgrading** to a version before poc.9 with a kept `live.yaml`: delete
  the `console_origins` block first. The older server refuses to start with
  the unknown key. Downgrading from v0.1.0-poc.10 to poc.9 or earlier: also
  delete the `lan_viewers` line under `serving:` and restart; otherwise the
  older server refuses to start with `Unsupported serving key: lan_viewers`.
  Downgrading from v0.1.4 to v0.1.3, from v0.1.3 to v0.1.2, or from v0.1.2 to v0.1.1, needs no change, but
  without a `calibration.board` block, v0.1.3 and earlier expect the old 7 × 5 board. Downgrading from
  v0.1.1 or later to v0.1.0 or earlier with `network_probes` set:
  delete that line too (see [Active probes](/docs/guides/network#active-probes)).
</Callout>

From poc.4, placement commits are saved in
`/var/lib/orbbec-streamer/calibration/placement.json`. The upgrade moves a
poc.3 placement file there once, if you take the package's `live.yaml`. If
you keep an edited poc.3 `live.yaml`, the server keeps using
`/var/lib/orbbec-streamer/config/dev/placement.json`. To switch, add
`placement_path: /var/lib/orbbec-streamer/calibration/placement.json` under
`calibration:` and move the file while the service is stopped. If you edited `live.yaml` or
`tls.conf` and the new package changes that file too, `apt` asks which
version to keep.

<Callout type="warn">
  **Upgrading from poc.1 or poc.2 with an edited `live.yaml`:** keeping your
  version keeps the old `mask.rvm_engine_path`. The server then loads only
  that engine file and never builds one. If the file is missing, was built
  for another GPU or TensorRT, or the rig has two cameras, the server keeps
  running without background removal: the log has one error line with the
  cause and the fix, and the 5-second stats show `mask: failed`. Take the package's version and re-apply your edits, or fix the
  `mask:` section as in [Troubleshooting](#troubleshooting).
</Callout>

### Calibration board [#calibration-board]

From v0.1.4 the default camera-pose board is a ChArUco board of 4 × 6
squares of 105 mm, with 79 mm markers, dictionary `DICT_4X4_50`. Up to
v0.1.3 it was 7 × 5 squares of 80 mm, with 60 mm markers, dictionary
`DICT_5X5_100`. The package's `live.yaml` names no board, so the server
uses the default. The **Camera pose** screen shows the board the server
expects; print that one.

To keep using a board printed for v0.1.3 or earlier, add it to the
`calibration:` section of `/etc/orbbec-streamer/live.yaml` and run
`sudo systemctl restart orbbec-streamer`:

```yaml
calibration:
  board:
    squares_x: 7
    squares_y: 5
    square_length_m: 0.08
    marker_length_m: 0.06
    dictionary: "DICT_5X5_100"
```

A camera-pose calibration you already committed stays valid either way;
the board matters only for the next run. See
[Camera pose calibration](/docs/server/camera-calibration#configuration)
for the keys.

## Remote viewers on the LAN [#remote-viewers-on-the-lan]

From v0.1.0-poc.10, browsers on other computers in the same LAN can view
the cameras. It is off by default: the page and the server listen on the
server PC only. The team has not yet tried it from a second machine. The
Operator Console stays on the server PC; a LAN viewer never gets the
[operator role](/docs/operator#the-operator-role).

The steps are in `/usr/share/orbbec-streamer/lan/LAN-VIEWERS.md` on the
server PC. In short:

1. Copy the page server's drop-in, so it also serves the page over HTTPS
   on port 8443. The page server then listens on all network addresses on
   port 8443, and its IP address allow-list is lifted:

   ```bash
   sudo mkdir -p /etc/systemd/system/orbbec-streamer-web.service.d
   sudo cp /usr/share/orbbec-streamer/lan/orbbec-streamer-web-lan.conf /etc/systemd/system/orbbec-streamer-web.service.d/lan.conf
   sudo systemctl daemon-reload && sudo systemctl restart orbbec-streamer-web
   ```

2. In `/etc/orbbec-streamer/live.yaml`, under `serving:`, set
   `listen_address: "0.0.0.0:4443"`, `lan_viewers: true` and
   `lan_page_port: 8443`, then run `sudo systemctl restart orbbec-streamer`.

3. If the firewall is on: `sudo ufw allow 8443/tcp` and
   `sudo ufw allow 4443/udp`.

4. On each viewer computer, trust the installation's certificate
   authority once. Download it on the server PC from
   `http://127.0.0.1:8080/.well-known/orbbec/ca.crt` (or copy
   `/etc/orbbec-streamer/tls/public/orbbec-ca.crt`). Check that
   `openssl x509 -in orbbec-ca.crt -noout -fingerprint -sha256` prints the
   same fingerprint on both computers, then import it as a trusted root in
   the viewer's system or browser.

5. On the viewer, open `https://<server-hostname>.local:8443` or
   `https://<server-LAN-IP>:8443`. The name or address must be one the
   server's certificate covers;
   `sudo /usr/lib/orbbec-streamer/tls/orbbec-tls status` lists them.

To turn it off, remove the drop-in, set `lan_viewers: false` and
`listen_address` back to `127.0.0.1:4443`, and restart both services.

## Uninstall [#uninstall]

* `sudo apt remove orbbec-streamer` removes the programs and services and
  keeps your config, certificates and `/var/lib/orbbec-streamer`.
* `sudo apt purge orbbec-streamer` also deletes `/etc/orbbec-streamer` and
  `/var/lib/orbbec-streamer`, including the engine cache and calibration,
  and the local certificate authority with its private key. A later install
  makes a new one, so every LAN viewer must trust it again; `remove` keeps
  it.

Both keep the `orbbec-streamer` user and group. The NVIDIA packages stay
installed; `sudo apt autoremove` offers to remove them.

## Collect a support report [#collect-a-support-report]

From poc.4, `orbbec-streamer-report` bundles the diagnostics into one
archive that you read and send yourself. It uploads nothing and changes
nothing:

```bash
sudo orbbec-streamer-report
```

**Expected result:** `orbbec-streamer-report-<UTC timestamp>.tar.gz` in the
current folder, readable by you. `--since "2 days ago"` widens the log
window (the default is the last 24 hours), `--out <file>` names the archive,
and `--print` lists what it would collect without collecting it.

The archive holds the package and system versions, the machine check, the
services' status and logs, `live.yaml`, `tls.conf`, the public certificate
data and, from poc.6, the newest gateway crash files. It never holds keys,
the contents of `/etc/orbbec-streamer/tls`, calibration or placement
files, or engines. Host names, IP and MAC addresses, e-mail addresses, your
user name and configured camera serial numbers are masked, but the masking
is pattern based: read the files before you send them. `MANIFEST.txt` lists
every file and what was masked.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                                                                   | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preflight` shows `FAIL  nvidia-driver` or `FAIL  driver-libraries`                                                                                       | No NVIDIA driver 580 or newer. Install it (for example `sudo apt install nvidia-open`), reboot, and run `orbbec-streamer-preflight` again.                                                                                                                                                                                                                                                                                                                                                                                 |
| `preflight` shows `FAIL  cuda-runtime` or `FAIL  tensorrt`                                                                                                | NVIDIA's apt repository is missing. Add it (step 2), then run the `sudo apt install` command in the `fix:` line.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `WARN  orbbec-cameras`                                                                                                                                    | No camera is connected. Connect it to a USB 3 port.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| The log repeats `No configured cameras are active`                                                                                                        | No camera was found when the cameras were opened (at service start only if `start_capture_on_launch: true`). The service retries with a growing delay and stops after 10 starts in 30 minutes. Connect the camera, then run `sudo systemctl reset-failed orbbec-streamer && sudo systemctl start orbbec-streamer`.                                                                                                                                                                                                         |
| After an upgrade, the stats show `mask: failed` and the log shows an engine error, such as `Cannot open TensorRT engine: …`                               | You kept an edited `live.yaml` from poc.1 or poc.2, which names a fixed engine file. In the `mask:` section of `/etc/orbbec-streamer/live.yaml`, delete `rvm_engine_path` and set `rvm_onnx_path: "/usr/share/orbbec-streamer/models/rvm/rvm_mobilenetv3_b{batch}_640x576_ds0.5_float16.onnx"` and `rvm_engine_cache_dir: "/var/lib/orbbec-streamer/engines"`. Then run `sudo systemctl restart orbbec-streamer`; the first start builds the engine (3 to 4 minutes).                                                      |
| The log shows `error while loading shared libraries: libcuda.so.1`                                                                                        | The NVIDIA driver is missing. Install it and reboot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| The Femto Bolt doesn't start; the log shows depth engine error 204                                                                                        | The service can't use the GPU's render node. Check that `id orbbec-streamer` lists `render`; if not, run `sudo adduser orbbec-streamer render`, then `sudo systemctl restart orbbec-streamer`. Only if that doesn't help: run `sudo systemctl edit orbbec-streamer`, add the two lines `[Service]` and `DevicePolicy=auto`, save and restart. This turns off the service's device allow-list, so remove it again once the cause is found.                                                                                  |
| The page at `http://127.0.0.1:8080` loads, but nothing connects                                                                                           | The server isn't running. From poc.10 the install starts it, unless a kept `live.yaml` sets `start_capture_on_launch: true`; up to poc.9 it doesn't. Run `sudo systemctl start orbbec-streamer`. Otherwise, up to poc.9 the gateway starts only once a camera is active, and the first start may still be building the engine. From poc.9 the gateway starts with the service; if the page connects but shows **Cameras closed**, select **Start cameras** on the server's card. Check `journalctl -u orbbec-streamer -f`. |
| The server stops once, about 4 minutes after the first start, and starts again within seconds                                                             | Known issue in poc.7, fixed in poc.8: the stop comes when the segmentation engine build finishes. systemd restarts the server; no action needed.                                                                                                                                                                                                                                                                                                                                                                           |
| Several cameras: the page shows the server needs setup and no point cloud                                                                                 | The camera poses aren't calibrated. See [Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses) (from poc.11) or [Camera pose calibration](/docs/server/camera-calibration).                                                                                                                                                                                                                                                                                                                               |
| Several cameras: the server stops after about 10 s with `no batch for 10005 ms …`, or refuses to start with `sync.enabled=false allows only one camera …` | Sync is off. See [More than one camera](#more-than-one-camera).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| The page doesn't load                                                                                                                                     | Check `systemctl status orbbec-streamer-web` and `journalctl -u orbbec-streamer-web`.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Another computer can't open the page                                                                                                                      | LAN viewers are off by default. See [Remote viewers on the LAN](#remote-viewers-on-the-lan).                                                                                                                                                                                                                                                                                                                                                                                                                               |
