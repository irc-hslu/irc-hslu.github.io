# Getting started notes (server) (https://irc-hslu.github.io/orbbecstreamer/docs/server/getting-started-notes)



This page is input for the site-wide Getting Started page. It condenses
[Requirements](./requirements), [Install](./install) and [Build](./build)
into one list. Those pages have the explanations and troubleshooting.

## Requirements in brief [#requirements-in-brief]

* Ubuntu 26.04 on x86_64. Nothing else is tested.
* An NVIDIA GPU, Turing (compute capability 7.5) or newer, whose NVENC supports
  HEVC Main and Main10 with 10-bit input. Tested: RTX 4090. The presets build
  for compute capability 8.9; newer GPUs run it through PTX. GPUs below 8.9
  need a `CMakeUserPresets.json` that overrides `CMAKE_CUDA_ARCHITECTURES`
  (see [Build](./build#build-for-a-different-gpu)).
* NVIDIA driver 580 or newer. Tested: 580.178.04.
* CUDA toolkit 13 at `/usr/local/cuda`. Tested: 13.3.
* TensorRT 11 C++ SDK. It is always needed to build. The RVM engine is needed
  only for `mask.backend: rvm`. Tested: 11.1.0.106.
* Orbbec SDK 2.8.7.
* Orbbec cameras on USB 3, all the same model. Tested: 2 × Femto Bolt with
  firmware 1.1.2, hardware-synchronised.
* GCC 15 (`/usr/bin/g++-15`), CMake 3.25 or newer, Ninja.
* Python 3.12 or newer with uv, only to build the RVM engine.
* About 10 GB of disk for one build directory and the vcpkg cache.

## Install commands in order [#install-commands-in-order]

Steps 2 to 5 need `sudo`. Skip step 3 if the machine already has driver 580+
and CUDA 13 at `/usr/local/cuda`.

1. Clone the repository with its submodules:

   ```bash
   git clone --recurse-submodules git@github.com:irc-hslu/orbbecstreamer.git
   cd orbbecstreamer/server
   ```

   Without a GitHub SSH key, clone over HTTPS and fetch the submodules the
   same way:

   ```bash
   git clone https://github.com/irc-hslu/orbbecstreamer.git
   cd orbbecstreamer/server
   git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init --recursive
   ```

2. Install the system packages:

   ```bash
   sudo apt update
   sudo apt install -y \
     build-essential gcc-15 g++-15 git cmake ninja-build gdb pkg-config \
     curl wget zip unzip tar \
     bison autoconf autoconf-archive automake libtool libtool-bin m4 \
     libx11-dev libxft-dev libxext-dev \
     libffmpeg-nvenc-dev libavcodec-dev libavformat-dev libavutil-dev libswscale-dev \
     python3 python3-venv
   ```

3. Install CUDA from NVIDIA's repository and the tested 580 driver from
   Ubuntu, then reboot. This sequence has not been run on a fresh machine;
   see [Install](./install#cuda-toolkit-and-driver) for why the driver does
   not come from `cuda-drivers`:

   ```bash
   wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2604/x86_64/cuda-keyring_1.1-1_all.deb
   sudo dpkg -i cuda-keyring_1.1-1_all.deb && rm cuda-keyring_1.1-1_all.deb
   sudo apt update
   sudo apt install -y cuda-toolkit-13-3 nvidia-driver-580-server
   sudo reboot
   ```

4. Install TensorRT from the same repository. Plain `tensorrt-dev` installs
   the newest build (`11.3.0.99-1+cuda13.4`); the tested one is
   `11.1.0.106-1+cuda13.3` (see [Install](./install#tensorrt)):

   ```bash
   sudo apt install -y tensorrt-dev libnvinfer-bin
   ```

5. Install the Orbbec SDK. This also installs the udev rule for the cameras:

   ```bash
   wget https://github.com/orbbec/OrbbecSDK_v2/releases/download/v2.8.7/OrbbecSDK_v2.8.7_amd64.deb
   sudo dpkg -i OrbbecSDK_v2.8.7_amd64.deb && rm OrbbecSDK_v2.8.7_amd64.deb
   ```

6. Put CUDA on your shell's `PATH` (`make check-env` runs `nvcc`), then
   bootstrap vcpkg and check the toolchain (in `server/`):

   ```bash
   echo 'export PATH=/usr/local/cuda/bin${PATH:+:${PATH}}' >> ~/.bashrc
   echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}' >> ~/.bashrc
   source ~/.bashrc
   ./external/vcpkg/bootstrap-vcpkg.sh
   make check-env
   ```

7. Configure, build and run the tests that need no camera (in `server/`). The
   first configure builds the vcpkg dependencies and takes a long time.

   ```bash
   cmake --preset dev-debug
   cmake --build --preset debug
   ctest --test-dir build/dev-debug --output-on-failure -LE "hardware|rvm"
   ```

8. Check the GPU and the cameras (in `server/`):

   ```bash
   ./build/dev-debug/orbbec_streamer --nvenc-test
   ./build/dev-debug/orbbec_streamer --orbbec-test
   ```

9. Optional: install [uv](https://docs.astral.sh/uv/) with its official
   installer (it is not packaged for Ubuntu), open a new shell, then build the
   RVM segmentation engines (in `server/`):

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   ```bash
   uv sync
   uv run python scripts/setup_rvm.py
   ```

Expected results: step 7 ends with `100% tests passed, 0 tests failed out of
38`. Step 8 ends with `NVENC capability test passed` and
`Orbbec provider smoke test OK`.

## What a new user can do today [#what-a-new-user-can-do-today]

* Build the server and run its tests and smoke tests.
* Run the live capture, GPU processing and encoding pipeline locally with
  `./build/dev-debug/orbbec_streamer --live config/local/live.yaml`. Run it
  from `server/`, because the config's paths are relative to the working
  directory. First copy `config/dev/live.yaml` and adapt it: it names the
  development rig's camera serials, enables hardware sync, uses the RVM mask
  and records to `debug/live`. See
  [Adapt the config to your rig](./running#adapt-the-config-to-your-rig) and
  [Configuration](./configuration).
* Calibrate the camera poses and the depth quantization locally (see
  [Camera pose calibration](./camera-calibration) and
  [Depth quantization calibrator](./depth-quantization-calibrator)).

Not yet available: the server does not serve browsers yet. The production
WebTransport listener is not implemented. ADR 0002 proposes a gateway built
on Go `webtransport-go`, and a spike exists in `server/spike/webtransport`.
The `--websocket-test` flag is a placeholder, not a transport.

## Environment variables [#environment-variables]

The server code, CMake files and scripts read only the variables below. The
scripts in `server/scripts/` read no environment variables; they find `git`,
`nvcc`, `nvidia-smi` and `trtexec` on `PATH`.

### Build time [#build-time]

| Variable                           | Read by                        | Purpose                                                                                                                                    | Example                                                     |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `CC`, `CXX`                        | CMake, set by the presets      | C and C++ compilers. The presets set them to GCC 15, so you do not set them yourself.                                                      | `CXX=/usr/bin/g++-15`                                       |
| `CUDAHOSTCXX`                      | CMake, set by the presets      | Host compiler for `nvcc`. It must be the same GCC version as `CXX`, or configure stops.                                                    | `CUDAHOSTCXX=/usr/bin/g++-15`                               |
| `CUDA_HOME`                        | CUDA tools, set by the presets | CUDA toolkit root                                                                                                                          | `CUDA_HOME=/usr/local/cuda`                                 |
| `PATH`                             | CMake, set by the presets      | The presets prepend `/usr/local/cuda/bin` to your `PATH`                                                                                   | `PATH=/usr/local/cuda/bin:$PATH`                            |
| `LD_LIBRARY_PATH`                  | CMake, set by the presets      | The presets prepend `/usr/local/cuda/lib64`. For a TensorRT tar install, add its `lib` folder yourself.                                    | `LD_LIBRARY_PATH=/opt/TensorRT-11.1.0/lib:$LD_LIBRARY_PATH` |
| `TensorRT_ROOT` or `TENSORRT_ROOT` | `cmake/FindTensorRT.cmake`     | Where to look for TensorRT headers, `libnvinfer` and `trtexec` when they are not in the system paths. Not needed with the Debian packages. | `TensorRT_ROOT=/opt/TensorRT-11.1.0`                        |

These CMake cache variables are passed with `-D` and are not environment
variables, but people often need them:

| Variable                                | Default          | Purpose                                                                                                                                   |
| --------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CMAKE_CUDA_ARCHITECTURES`              | `89`             | GPU compute capability to compile for. The presets set it on every configure, so override it in a `CMakeUserPresets.json`, not with `-D`. |
| `OrbbecSDK_DIR`                         | `/usr/local/lib` | Folder that contains `OrbbecSDKConfig.cmake`                                                                                              |
| `TensorRT_ROOT`                         | not set          | Same as the environment variable above                                                                                                    |
| `ORBBEC_STREAMER_PROTOCOL_CONTRACT_DIR` | `../protocol`    | Protocol contract, schema and vectors for the conformance test                                                                            |

### Run time [#run-time]

| Variable                      | Read by                 | Purpose                                                                                                                                                                                                                        | Example                                 |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `ORBBEC_STREAMER_STATUS_MODE` | `--live` status display | `dashboard` forces the full-screen status dashboard. `log` writes each status update to the log instead. When not set, the dashboard is used if stdout is a terminal, `TERM` is set and not `dumb`, and `NO_COLOR` is not set. | `ORBBEC_STREAMER_STATUS_MODE=log`       |
| `TERM`                        | `--live` status display | Unset or `dumb` turns the dashboard off                                                                                                                                                                                        | `TERM=xterm-256color`                   |
| `NO_COLOR`                    | `--live` status display | Any value turns the dashboard off                                                                                                                                                                                              | `NO_COLOR=1`                            |
| `DISPLAY`, `WAYLAND_DISPLAY`  | `--live` preview window | If neither is set, the server turns the preview window off and logs a warning                                                                                                                                                  | `DISPLAY=:0`                            |
| `LD_LIBRARY_PATH`             | dynamic loader          | Must include the TensorRT `lib` folder for a tar install, and `/usr/local/cuda/lib64` if CUDA is not in the loader's default paths                                                                                             | `LD_LIBRARY_PATH=/usr/local/cuda/lib64` |

Example: run the live pipeline with plain log output, for instance when you
redirect it to a file:

```bash
ORBBEC_STREAMER_STATUS_MODE=log ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
```

## Troubleshooting [#troubleshooting]

Each step has its own troubleshooting table:

* clone, packages, CUDA, TensorRT, Orbbec SDK and RVM engine:
  [Install](./install#troubleshooting)
* configure, build and tests: [Build](./build#troubleshooting)
* GPU, driver and USB: [Requirements](./requirements#troubleshooting)
