# Install (https://irc-hslu.github.io/orbbecstreamer/docs/server/install)



This page sets up an Ubuntu 26.04 machine so it can build the server. Check
[Requirements](./requirements) first. The next page is [Build](./build).

Do these steps in order:

1. [Get the source](#get-the-source)
2. [Install the system packages](#system-packages)
3. [Install the CUDA toolkit and driver](#cuda-toolkit-and-driver)
4. [Install TensorRT](#tensorrt)
5. [Install the Orbbec SDK](#orbbec-sdk)
6. [Bootstrap vcpkg](#vcpkg)
7. [Check the environment](#check-the-environment)
8. Optional: [build the RVM segmentation engine](#rvm-segmentation-engine-optional)

Commands that change the system start with `sudo`. Run the other commands as
your normal user.

## Get the source [#get-the-source]

The server lives in the `server/` folder of the repository. CMake also reads
the protocol contract in `protocol/` next to it, so clone the whole repository
with its submodules (other Git repositories that it includes).

1. Clone the repository. With a GitHub SSH key:

   ```bash
   git clone --recurse-submodules git@github.com:irc-hslu/orbbecstreamer.git
   cd orbbecstreamer/server
   ```

   Without a GitHub SSH key, clone over HTTPS:

   ```bash
   git clone https://github.com/irc-hslu/orbbecstreamer.git
   cd orbbecstreamer/server
   ```

2. Fetch the submodules. Skip this if you cloned with SSH and
   `--recurse-submodules`. From the `server/` folder, with a GitHub SSH key:

   ```bash
   git submodule update --init --recursive
   ```

   Without an SSH key, use this instead. It fetches the SSH submodule URLs over
   HTTPS; the RVM fork is public:

   ```bash
   git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init --recursive
   ```

The two submodules are:

| Submodule                            | Purpose                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `server/external/vcpkg`              | Pinned vcpkg that builds the C++ dependencies. Always needed.                                          |
| `server/external/RobustVideoMatting` | RVM model source, needed only to build the RVM engine. The submodule URL uses SSH (`git@github.com:`). |

All the following commands run in the `server/` folder unless the step says
otherwise.

## System packages [#system-packages]

Install the compiler, build tools and libraries from Ubuntu's archive:

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

| Packages                            | Why                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `gcc-15`, `g++-15`                  | The presets use `/usr/bin/gcc-15` and `/usr/bin/g++-15` for C++ and as the CUDA host compiler.              |
| `cmake`, `ninja-build`              | The presets use the Ninja generator. They need CMake 3.25 or newer.                                         |
| `curl`, `zip`, `unzip`, `tar`       | Needed to bootstrap vcpkg.                                                                                  |
| `wget`                              | Downloads the NVIDIA repository key and the Orbbec SDK package below.                                       |
| `bison` … `libxext-dev`             | vcpkg builds OpenCV with its GTK dependencies from source. These tools and X11 headers are needed for that. |
| `libffmpeg-nvenc-dev`               | NVENC API headers (`ffnvcodec`).                                                                            |
| `libavcodec-dev` … `libswscale-dev` | FFmpeg libraries for the local HEVC decoder and the debug recorder.                                         |

## CUDA toolkit and driver [#cuda-toolkit-and-driver]

Skip this step if `nvidia-smi` shows driver 580 or newer and
`/usr/local/cuda/bin/nvcc --version` shows CUDA 13.

The commands in this step and in [TensorRT](#tensorrt) have not been run on a
fresh machine. On the reference machine, the CUDA toolkit and TensorRT come
from NVIDIA's repository, but the driver is Ubuntu's `nvidia-driver-580-server`
package.

1. Add NVIDIA's CUDA repository for Ubuntu 26.04:

   ```bash
   wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2604/x86_64/cuda-keyring_1.1-1_all.deb
   sudo dpkg -i cuda-keyring_1.1-1_all.deb && rm cuda-keyring_1.1-1_all.deb
   sudo apt update
   ```

2. Install the tested toolkit version, CUDA 13.3:

   ```bash
   sudo apt install -y cuda-toolkit-13-3
   ```

   Do not install the plain `cuda-toolkit` package. It installs the newest
   release (13.4 at the time of writing), which is not tested.

3. If you have no NVIDIA driver yet, install the tested 580 branch from
   Ubuntu's archive and reboot:

   ```bash
   sudo apt install -y nvidia-driver-580-server
   sudo reboot
   ```

   Do not use `cuda-drivers` for the tested stack. In NVIDIA's repository it
   installs the newest driver, currently 615.71.09, which is not tested. That
   repository has no 580 branch; its oldest is 595. If you do want a driver
   from there, its `nvidia-driver-pinning-<branch>` packages (for example
   `nvidia-driver-pinning-595`) hold `cuda-drivers` on one branch.

4. Add CUDA to your shell. The presets already add `/usr/local/cuda/bin` to
   `PATH` and `/usr/local/cuda/lib64` to `LD_LIBRARY_PATH` for CMake. To run
   `nvcc`, `make check-env` and the tests from your own shell, add them to
   `~/.bashrc` too:

   ```bash
   echo 'export PATH=/usr/local/cuda/bin${PATH:+:${PATH}}' >> ~/.bashrc
   echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}' >> ~/.bashrc
   source ~/.bashrc
   ```

## TensorRT [#tensorrt]

TensorRT is NVIDIA's library for running neural networks on the GPU. The build
needs its C++ SDK, which comes from the same NVIDIA repository. The Python
`pip install tensorrt` package does not work: it has no C++ headers.

```bash
sudo apt install -y tensorrt-dev libnvinfer-bin
```

`libnvinfer-bin` provides `trtexec`, which only `scripts/setup_rvm.py` uses to prebuild development engines. The server itself builds its RVM engine with the TensorRT library and does not need `trtexec`.

The tested version is TensorRT `11.1.0.106-1+cuda13.3`. Plain `tensorrt-dev`
installs the newest build, currently `11.3.0.99-1+cuda13.4`, which targets
CUDA 13.4 and is not tested. The repository also has `11.2.1.2-1+cuda13.3`,
which targets the tested CUDA 13.3 but is itself not tested. To stay on the
tested stack, pin the version as described in
[Troubleshooting](#troubleshooting).

If you use a TensorRT tar archive instead of the Debian packages, point CMake
at it before you configure. Replace `/opt/TensorRT-11.1.0` with the folder you
extracted:

```bash
export TensorRT_ROOT=/opt/TensorRT-11.1.0
export LD_LIBRARY_PATH="$TensorRT_ROOT/lib:$LD_LIBRARY_PATH"
```

## Orbbec SDK [#orbbec-sdk]

The Orbbec SDK is the library the server uses to talk to the cameras.

1. Install Orbbec SDK 2.8.7 from its GitHub release:

   ```bash
   wget https://github.com/orbbec/OrbbecSDK_v2/releases/download/v2.8.7/OrbbecSDK_v2.8.7_amd64.deb
   sudo dpkg -i OrbbecSDK_v2.8.7_amd64.deb && rm OrbbecSDK_v2.8.7_amd64.deb
   ```

2. Unplug and replug the cameras, so the new udev rule (the Linux rule that
   lets normal users open the cameras) applies.

The package installs to `/opt/OrbbecSDK_v2.8.7`. Its install script then:

* copies the libraries and `OrbbecSDKConfig.cmake` to `/usr/local/lib`, where
  the presets look for them (`OrbbecSDK_DIR=/usr/local/lib`)
* copies the headers to `/usr/local/include/libobsensor`
* installs the udev rule `/etc/udev/rules.d/99-obsensor-libusb.rules`
* installs `OrbbecViewer` to `/usr/local/bin`

## vcpkg [#vcpkg]

vcpkg is a C++ package manager. It builds the C++ dependencies listed in
`vcpkg.json`: Boost.Asio and Boost.Beast, CLI11, nlohmann-json,
json-schema-validator, OpenCV, spdlog, zstd and lz4. Bootstrap the pinned copy
once, from the `server/` folder:

```bash
./external/vcpkg/bootstrap-vcpkg.sh
```

This only prepares vcpkg. It builds the dependencies later, during the first
`cmake --preset` run on the [Build](./build) page.

## Check the environment [#check-the-environment]

From the `server/` folder, print the toolchain versions:

```bash
make check-env
```

Compare the output with [Expected result](#expected-result).

## RVM segmentation engine (optional) [#rvm-segmentation-engine-optional]

Skip this step unless you want `mask.backend: rvm` from a source checkout, or
want to run the RVM smoke tests. The other mask backends (`none`, `fill_all`,
`rgb_luma_threshold`) need no model. You can come back to this step after the
build.

The RVM (Robust Video Matting) network separates people from the background.
The server needs its fixed-shape FP16 ONNX model, one file per batch size, and
builds the TensorRT engine from it by itself on first use, in 3 to 4 minutes
per batch size; see [The RVM engine cache](./configuration#the-rvm-engine-cache).
A packaged install ships the ONNX files and needs nothing else. From a source
checkout, `scripts/setup_rvm.py` exports them:

1. updates the RVM fork checkout in `external/RobustVideoMatting`, or clones
   it if the folder does not exist
2. downloads the official `rvm_mobilenetv3.pth` checkpoint to `models/rvm/`
3. exports a fixed-shape FP16 ONNX model on the CPU

Pass `--skip-engine-build` so the script stops after the export. Without that
flag it also prebuilds one TensorRT engine per batch size with `trtexec`; use
those engines for the RVM smoke tests or as the `mask.rvm_engine_path`
development override.

The script needs PyTorch, torchvision, ONNX and NVIDIA ModelOpt.
`pyproject.toml` and `uv.lock` pin their versions.

To run it with [uv](https://docs.astral.sh/uv/), a Python package manager:

1. Install uv with its official installer (uv is not packaged for Ubuntu). It
   goes to `~/.local/bin`:

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Open a new shell, so `~/.local/bin` is on your `PATH`.

3. From the `server/` folder, install the Python packages and run the script:

   ```bash
   uv sync
   uv run python scripts/setup_rvm.py --skip-engine-build
   ```

Without uv, create a virtual environment and let the script install what is
missing. From the `server/` folder:

```bash
python3 -m venv .venv
. .venv/bin/activate
python scripts/setup_rvm.py --install-python-deps --skip-engine-build
```

The defaults export batch sizes 1 and 2 at 640 × 576 with downsample ratio 0.5.
This matches the depth resolution in `config/dev/live.yaml`, whose
`mask.rvm_onnx_path` already points at the exported files. The batch size must
equal the number of active cameras: batch 1 for one camera, batch 2 for two;
the server picks the file with `{batch}` in the path. For other values, see
`uv run python scripts/setup_rvm.py --help`.

The RVM model and weights are GPL-3.0. Confirm that this licence suits you
before you distribute the model or an engine built from it.

## Expected result [#expected-result]

`make check-env` prints your toolchain. On the reference machine:

```text
Compiler:
c++ (Ubuntu 15.2.0-16ubuntu1) 15.2.0

CMake:
cmake version 4.1.2

Ninja:
1.13.2

CUDA:
/usr/local/cuda/bin/nvcc
Build cuda_13.3.r13.3/compiler.38244171_0

NVIDIA driver/GPU:
NVIDIA GeForce RTX 4090, 580.178.04
```

After the Orbbec SDK install, this command lists both files without an error:

```bash
ls /usr/local/lib/OrbbecSDKConfig.cmake /etc/udev/rules.d/99-obsensor-libusb.rules
```

After the optional RVM step, `models/rvm/generated/` contains:

```text
rvm_mobilenetv3_b1_640x576_ds0.5_float16.onnx
rvm_mobilenetv3_b2_640x576_ds0.5_float16.onnx
```

None of these files are committed. Without `--skip-engine-build` the folder
also holds the prebuilt `.engine` files with a `.json` manifest and a timing
cache for each, and the script ends with `RVM setup complete.` The engines the
server builds itself go to `mask.rvm_engine_cache_dir`, not here.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                 | Cause and fix                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git@github.com: Permission denied (publickey)` while fetching submodules                               | No GitHub SSH key is set up. Fetch the submodules over HTTPS with the `insteadOf` command in [Get the source](#get-the-source).                                                                                                                                                                                                                                        |
| `make check-env` stops after `CUDA:` with `make: *** [Makefile:…: check-env] Error 1`                   | `/usr/local/cuda/bin` is not on your `PATH`. Do step 4 of [CUDA toolkit and driver](#cuda-toolkit-and-driver), then open a new shell.                                                                                                                                                                                                                                  |
| `setup_rvm.py` fails with `source directory exists but is not a Git checkout`                           | The RVM submodule is not initialised, so `external/RobustVideoMatting` is an empty folder. Initialise the submodules as in [Get the source](#get-the-source).                                                                                                                                                                                                          |
| Configure fails with `Could NOT find TensorRT (missing: TensorRT_INCLUDE_DIR TensorRT_NVINFER_LIBRARY)` | Install `tensorrt-dev`, or set `TensorRT_ROOT` (or `TENSORRT_ROOT`) to a tar install. Then configure again.                                                                                                                                                                                                                                                            |
| Configure fails with `Could not find a package configuration file provided by "OrbbecSDK"`              | The Orbbec SDK is missing or not in `/usr/local/lib`. Reinstall the `.deb`, or pass `-DOrbbecSDK_DIR=<folder that contains OrbbecSDKConfig.cmake>` to `cmake --preset dev-debug`.                                                                                                                                                                                      |
| Configure fails with a pkg-config error that names `ffnvcodec`                                          | Install `libffmpeg-nvenc-dev`.                                                                                                                                                                                                                                                                                                                                         |
| Configure fails on `libavcodec`, `libavformat`, `libavutil` or `libswscale`                             | Install the matching `-dev` package from [System packages](#system-packages).                                                                                                                                                                                                                                                                                          |
| `dpkg -l tensorrt-dev` shows a `+cuda13.4` version                                                      | apt installed the newest TensorRT, which targets CUDA 13.4 and is not tested. To stay on the tested stack, pin every TensorRT package to `11.1.0.106-1+cuda13.3` with `sudo apt install <package>=11.1.0.106-1+cuda13.3` for `tensorrt-dev` and each `libnvinfer*` and `libnvonnxparsers*` package it depends on. This pinning has not been tested on a fresh machine. |
| `setup_rvm.py` fails with `trtexec not found; install libnvinfer-bin or pass --trtexec`                 | You did not pass `--skip-engine-build`. Pass it (the server builds its own engine), or install `libnvinfer-bin`, or pass `--trtexec /path/to/trtexec`.                                                                                                                                                                                                                 |
| `setup_rvm.py` fails with `missing Python packages: ...`                                                | Run it with `uv run`, or add `--install-python-deps` inside a virtual environment.                                                                                                                                                                                                                                                                                     |
| `setup_rvm.py` fails with `not an orbbec-streamer repository root`                                      | Run it from `server/`, or pass `--repo-root <path to server/>`.                                                                                                                                                                                                                                                                                                        |
| A camera works as root but not as your user                                                             | The udev rule is missing. Run `sudo /opt/OrbbecSDK_v2.8.7/shared/install_udev_rules.sh`, then replug the camera.                                                                                                                                                                                                                                                       |
