# Install (https://irc-hslu.github.io/orbbecstreamer/docs/server/install)



This page sets up an Ubuntu 26.04 machine so it can build the server. It
installs system packages, the CUDA toolkit, TensorRT and the Orbbec SDK,
fetches the vcpkg submodule and, if you want RVM person segmentation, builds
the RVM TensorRT engine. Check [Requirements](./requirements) first. The next
step is [Build](./build).

Commands that change the system need `sudo`. Run the other commands as your
normal user.

## Get the source [#get-the-source]

The server lives in `server/` of the monorepo. CMake also reads the protocol
contract in `../protocol`, so clone the whole repository with its submodules:

```bash
git clone --recurse-submodules git@github.com:irc-hslu/orbbecstreamer.git
cd orbbecstreamer/server
```

Without a GitHub SSH key, clone over HTTPS instead and fetch the submodules as
shown below:

```bash
git clone https://github.com/irc-hslu/orbbecstreamer.git
cd orbbecstreamer/server
```

If you already cloned without submodules, run this in `server/`:

```bash
git submodule update --init --recursive
```

There are two submodules:

| Submodule                            | Purpose                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `server/external/vcpkg`              | Pinned vcpkg that builds the C++ dependencies. Always needed.                                          |
| `server/external/RobustVideoMatting` | RVM model source, needed only to build the RVM engine. The submodule URL uses SSH (`git@github.com:`). |

Without a GitHub SSH key, fetch the submodules over HTTPS instead. The RVM fork
is public:

```bash
git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init --recursive
```

All the following commands run in `server/` unless the step says otherwise.

## System packages [#system-packages]

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

The commands in this section and in [TensorRT](#tensorrt) have not been run
on a fresh machine. On the reference machine, the CUDA toolkit and TensorRT
come from NVIDIA's repository, but the driver is Ubuntu's
`nvidia-driver-580-server` package.

Add NVIDIA's CUDA repository for Ubuntu 26.04:

```bash
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2604/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb && rm cuda-keyring_1.1-1_all.deb
sudo apt update
```

Install the toolkit. `cuda-toolkit-13-3` is the tested version. The plain
`cuda-toolkit` package installs the newest release (13.4 at the time of
writing), which is not tested.

```bash
sudo apt install -y cuda-toolkit-13-3
```

If you have no NVIDIA driver yet, install the tested 580 branch from Ubuntu's
archive and reboot:

```bash
sudo apt install -y nvidia-driver-580-server
sudo reboot
```

Do not use `cuda-drivers` for the tested stack: in NVIDIA's repository it
installs the newest driver, currently 615.71.09, which is not tested. The
repository has no 580 branch; its oldest is 595, and its
`nvidia-driver-pinning-<branch>` packages (for example
`nvidia-driver-pinning-595`) hold `cuda-drivers` on one branch if you do want
a driver from there.

The presets add `/usr/local/cuda/bin` to `PATH` and `/usr/local/cuda/lib64` to
`LD_LIBRARY_PATH` for CMake. To run `nvcc` and the tests from your own shell,
add them to `~/.bashrc` as well:

```bash
echo 'export PATH=/usr/local/cuda/bin${PATH:+:${PATH}}' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}' >> ~/.bashrc
source ~/.bashrc
```

## TensorRT [#tensorrt]

TensorRT comes from the same NVIDIA repository. You need the C++ SDK, not the
Python `pip install tensorrt` package, which has no C++ headers.

```bash
sudo apt install -y tensorrt-dev libnvinfer-bin
```

`libnvinfer-bin` provides `trtexec`, which only the RVM engine build needs.

The tested version is TensorRT `11.1.0.106-1+cuda13.3`. Plain `tensorrt-dev`
installs the newest build, currently `11.3.0.99-1+cuda13.4`, which targets
CUDA 13.4 and is not tested. The repository also has `11.2.1.2-1+cuda13.3`,
which targets the tested CUDA 13.3 but is itself not tested. To stay on the tested stack, see
[Troubleshooting](#troubleshooting).

For a TensorRT tar archive instead of the Debian packages, point CMake at it
before you configure (replace the path with your extracted folder):

```bash
export TensorRT_ROOT=/opt/TensorRT-11.1.0
export LD_LIBRARY_PATH="$TensorRT_ROOT/lib:$LD_LIBRARY_PATH"
```

## Orbbec SDK [#orbbec-sdk]

Install Orbbec SDK 2.8.7 from its GitHub release:

```bash
wget https://github.com/orbbec/OrbbecSDK_v2/releases/download/v2.8.7/OrbbecSDK_v2.8.7_amd64.deb
sudo dpkg -i OrbbecSDK_v2.8.7_amd64.deb && rm OrbbecSDK_v2.8.7_amd64.deb
```

The package installs to `/opt/OrbbecSDK_v2.8.7`. Its install script then:

* copies the libraries and `OrbbecSDKConfig.cmake` to `/usr/local/lib`, where
  the presets look for them (`OrbbecSDK_DIR=/usr/local/lib`)
* copies the headers to `/usr/local/include/libobsensor`
* installs the udev rule `/etc/udev/rules.d/99-obsensor-libusb.rules`, so
  normal users can open the cameras
* installs `OrbbecViewer` to `/usr/local/bin`

Unplug and replug the cameras after the install so the udev rule applies.

## vcpkg [#vcpkg]

vcpkg builds the C++ dependencies listed in `vcpkg.json` (Boost.Asio and
Boost.Beast, CLI11, nlohmann-json, json-schema-validator, OpenCV, spdlog, zstd,
lz4). Bootstrap the pinned copy once:

```bash
./external/vcpkg/bootstrap-vcpkg.sh
```

The dependencies are built during the first `cmake --preset` run, not now.

## Check the environment [#check-the-environment]

```bash
make check-env
```

## RVM segmentation engine (optional) [#rvm-segmentation-engine-optional]

Skip this step unless you want `mask.backend: rvm` in the live config or want
to run the RVM smoke tests. The other mask backends (`none`, `fill_all`,
`rgb_luma_threshold`) need no engine.

`scripts/setup_rvm.py` does the whole job:

1. updates the RVM fork checkout in `external/RobustVideoMatting`, or clones
   it if the folder does not exist
2. downloads the official `rvm_mobilenetv3.pth` checkpoint to `models/rvm/`
3. exports a fixed-shape FP16 ONNX model on the CPU
4. builds one TensorRT engine per batch size with `trtexec`

The script needs PyTorch, torchvision, ONNX and NVIDIA ModelOpt. `pyproject.toml`
and `uv.lock` pin them. Install them with [uv](https://docs.astral.sh/uv/).
uv is not packaged for Ubuntu; install it with its official installer, which
puts it in `~/.local/bin`, then open a new shell:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then install the Python packages and run the script:

```bash
uv sync
uv run python scripts/setup_rvm.py
```

The defaults build batch sizes 1 and 2 at 640 × 576 with downsample ratio 0.5.
This matches the depth resolution in `config/dev/live.yaml`. The engine's
batch size must equal the number of active cameras: batch 1 for one camera,
batch 2 for two. Set `mask.rvm_engine_path` to the matching engine. For other
values, see `uv run python scripts/setup_rvm.py --help`.

Without uv, create a virtual environment and let the script install what is
missing:

```bash
python3 -m venv .venv
. .venv/bin/activate
python scripts/setup_rvm.py --install-python-deps
```

The RVM model and weights are GPL-3.0. Confirm that this licence suits you
before you distribute the engine.

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

After the RVM step, `models/rvm/generated/` contains:

```text
rvm_mobilenetv3_b1_640x576_ds0.5_float16.engine
rvm_mobilenetv3_b2_640x576_ds0.5_float16.engine
```

plus an `.onnx` model and a `.json` manifest for each batch size, and a
timing cache. None of these files are committed. The script ends with
`RVM setup complete.`

A TensorRT engine works only with the GPU model and TensorRT version that
built it. Run `setup_rvm.py` again after you change either one.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                 | Cause and fix                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git@github.com: Permission denied (publickey)` while fetching submodules                               | No GitHub SSH key is set up. Fetch the submodules over HTTPS with the `insteadOf` command in [Get the source](#get-the-source).                                                                                                                                                                                                                                        |
| `setup_rvm.py` fails with `source directory exists but is not a Git checkout`                           | The RVM submodule is not initialised, so `external/RobustVideoMatting` is an empty folder. Initialise the submodules as in [Get the source](#get-the-source).                                                                                                                                                                                                          |
| Configure fails with `Could NOT find TensorRT (missing: TensorRT_INCLUDE_DIR TensorRT_NVINFER_LIBRARY)` | Install `tensorrt-dev`, or set `TensorRT_ROOT` (or `TENSORRT_ROOT`) to a tar install. Then configure again.                                                                                                                                                                                                                                                            |
| Configure fails with `Could not find a package configuration file provided by "OrbbecSDK"`              | The Orbbec SDK is missing or not in `/usr/local/lib`. Reinstall the `.deb`, or pass `-DOrbbecSDK_DIR=<folder that contains OrbbecSDKConfig.cmake>` to `cmake --preset dev-debug`.                                                                                                                                                                                      |
| Configure fails with a pkg-config error that names `ffnvcodec`                                          | Install `libffmpeg-nvenc-dev`.                                                                                                                                                                                                                                                                                                                                         |
| Configure fails on `libavcodec`, `libavformat`, `libavutil` or `libswscale`                             | Install the matching `-dev` package from the list above.                                                                                                                                                                                                                                                                                                               |
| `dpkg -l tensorrt-dev` shows a `+cuda13.4` version                                                      | apt installed the newest TensorRT, which targets CUDA 13.4 and is not tested. To stay on the tested stack, pin every TensorRT package to `11.1.0.106-1+cuda13.3` with `sudo apt install <package>=11.1.0.106-1+cuda13.3` for `tensorrt-dev` and each `libnvinfer*` and `libnvonnxparsers*` package it depends on. This pinning has not been tested on a fresh machine. |
| `setup_rvm.py` fails with `trtexec not found; install libnvinfer-bin or pass --trtexec`                 | Install `libnvinfer-bin`, or pass `--trtexec /path/to/trtexec`.                                                                                                                                                                                                                                                                                                        |
| `setup_rvm.py` fails with `missing Python packages: ...`                                                | Run it with `uv run`, or add `--install-python-deps` inside a virtual environment.                                                                                                                                                                                                                                                                                     |
| `setup_rvm.py` fails with `not an orbbec-streamer repository root`                                      | Run it from `server/`, or pass `--repo-root <path to server/>`.                                                                                                                                                                                                                                                                                                        |
| A camera works as root but not as your user                                                             | The udev rule is missing. Run `sudo /opt/OrbbecSDK_v2.8.7/shared/install_udev_rules.sh`, then replug the camera.                                                                                                                                                                                                                                                       |
