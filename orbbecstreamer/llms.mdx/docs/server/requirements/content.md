# Requirements (https://irc-hslu.github.io/orbbecstreamer/docs/server/requirements)



The server runs on one Linux machine with an NVIDIA GPU and one or more Orbbec
cameras connected over USB. This page lists what that machine needs and gives a
command to check each item. The next page is [Install](./install).

## What you need [#what-you-need]

Only one configuration has been tested. Other versions may work, but nobody
has tried them.

| Component     | Tested version                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS            | Ubuntu 26.04.1 LTS (x86_64)                                                                                                                       |
| GPU           | NVIDIA GeForce RTX 4090 (compute capability 8.9)                                                                                                  |
| NVIDIA driver | 580.178.04                                                                                                                                        |
| CUDA toolkit  | 13.3 (`nvcc` V13.3.73), at `/usr/local/cuda`                                                                                                      |
| TensorRT      | 11.1.0.106 (`+cuda13.3` Debian packages)                                                                                                          |
| NVENC headers | `ffnvcodec` 12.1 (package `libffmpeg-nvenc-dev`)                                                                                                  |
| Orbbec SDK    | 2.8.7                                                                                                                                             |
| Cameras       | 2 × Orbbec Femto Bolt, firmware 1.1.2, hardware-synchronised                                                                                      |
| Compiler      | GCC 15.2 (`/usr/bin/gcc-15`, `/usr/bin/g++-15`)                                                                                                   |
| CMake / Ninja | CMake 4.1.2 and 4.2.3, Ninja 1.13.2                                                                                                               |
| Python        | 3.12 or newer, only to build the RVM engine                                                                                                       |
| Go            | Optional: 1.26 or newer runs `gateway_go_tests` (skipped without Go); the [WebTransport spike](./serving#try-the-webtransport-spike) needs 1.27.1 |

The first four checks below are about hardware and the OS, so run them before
you install anything. The software rows (CUDA, TensorRT, the Orbbec SDK, GCC)
come from [Install](./install); check them with step 5 afterwards.

## Check your machine [#check-your-machine]

### 1. Check the operating system [#1-check-the-operating-system]

```bash
lsb_release -d
```

You need Ubuntu 26.04. It is the only tested OS. The CMake presets
hard-code `/usr/bin/gcc-15`, `/usr/bin/g++-15` and `/usr/local/cuda`, which
the packages in [Install](./install) create.

### 2. Check the GPU and driver [#2-check-the-gpu-and-driver]

```bash
nvidia-smi --query-gpu=name,driver_version,compute_cap --format=csv,noheader
```

Compare the output with these rules:

* **GPU generation.** The compute capability (the last number, which
  identifies the GPU generation) must be 7.5 (Turing) or higher. CUDA 13 does
  not support older GPUs. Use a GeForce, RTX or Quadro card. Compute GPUs
  without NVENC, such as the A100 and H100, do not work.
* **Driver.** The driver version must be 580 or newer, because CUDA 13.x needs
  driver branch 580. If `nvidia-smi` is missing, install a driver in
  [Install](./install#cuda-toolkit-and-driver).
* **Compute capability below 8.9.** The CMake presets compile the GPU code for
  compute capability 8.9 (RTX 40 series). They also include PTX (portable GPU
  code that the driver compiles at startup), so newer GPUs work unchanged. On
  a GPU below 8.9, such as an RTX 30 series card (8.6), the GPU code fails to
  run. You can still use it: follow
  [Build for a different GPU](./build#build-for-a-different-gpu) when you build.

The server also needs these NVENC features. You check them in step 6, after
the build:

* HEVC codec with the Main and Main10 profiles
* NV12 (8-bit) and YUV420 10-bit input surfaces
* 10-bit encoding
* the P1 preset (NVENC's fastest preset)

### 3. Check the cameras and their USB connection [#3-check-the-cameras-and-their-usb-connection]

With the cameras plugged in and powered, run:

```bash
lsusb | grep 2bc5
lsusb -t
```

`2bc5` is Orbbec's USB vendor ID. The first command must print one line per
camera. In the `lsusb -t` tree, each camera's interfaces must show `5000M`
(USB 3, 5 Gbit/s), not `480M` (USB 2).

About the cameras:

* **Model.** The only tested camera is the Orbbec Femto Bolt. The code talks to
  the Orbbec SDK, not to one camera model, but all cameras in one rig must be
  the same model.
* **Sync wiring.** With more than one camera, one camera is the `primary` and
  sends a hardware trigger to the others, the `secondary` cameras. You set the
  roles and delays later in the config file (`cameras[].role` and the `sync`
  block, see [Configuration](./configuration)). These pages do not describe
  the sync cabling. Wire the cameras as described in Orbbec's multi-camera
  synchronisation guide for your camera model.

### 4. Check the free disk space [#4-check-the-free-disk-space]

```bash
df -h ~
```

The build needs about 10 GB: one build directory with its vcpkg dependencies
takes about 5 GB, and the vcpkg binary cache in `~/.cache/vcpkg` takes about
another 4.5 GB. The CUDA toolkit and TensorRT packages need space on top of
that.

A display is optional. The live preview window opens only when `DISPLAY` or
`WAYLAND_DISPLAY` is set. Without a display, the server still runs and logs
that the preview is off.

### 5. Check the installed software [#5-check-the-installed-software]

Run this after you finish [Install](./install). On a fresh machine, these
commands fail until then.

```bash
/usr/local/cuda/bin/nvcc --version | tail -1
dpkg -l tensorrt-dev libnvinfer-bin orbbecsdk libffmpeg-nvenc-dev | grep ^ii
g++-15 --version | head -1
```

What each item is for:

* **CUDA toolkit** at `/usr/local/cuda`, with `nvcc` at
  `/usr/local/cuda/bin/nvcc`. It compiles the GPU code.
* **TensorRT** (`tensorrt-dev`) is required to build the server. Every server
  program links it, and CMake stops with an error if it cannot find the
  TensorRT headers and `libnvinfer`.
* **`trtexec`** (`libnvinfer-bin`) is optional. The server builds its RVM
  engine itself; only `scripts/setup_rvm.py` without `--skip-engine-build`
  uses `trtexec`, to prebuild the engines for the two RVM smoke tests.
* **Orbbec SDK** (`orbbecsdk`) talks to the cameras.
* **`ffnvcodec`** (`libffmpeg-nvenc-dev`) provides the NVENC API headers.
* **GCC 15** compiles the C++ code and is the host compiler for CUDA.

### 6. Check NVENC (after the build) [#6-check-nvenc-after-the-build]

After you [build the server](./build), run this from the `server/` folder:

```bash
./build/dev-debug/orbbec_streamer --nvenc-test
```

It checks every NVENC feature listed in step 2 and names any that are missing.

## Expected result [#expected-result]

On the reference machine, steps 1, 2, 3 and 5 print:

```text
Description:	Ubuntu 26.04.1 LTS
NVIDIA GeForce RTX 4090, 580.178.04, 8.9
Bus 002 Device 002: ID 2bc5:066b Orbbec 3D Technology International, Inc Orbbec Femto Bolt 3D Camera
Bus 002 Device 003: ID 2bc5:066b Orbbec 3D Technology International, Inc Orbbec Femto Bolt 3D Camera
Build cuda_13.3.r13.3/compiler.38244171_0
ii  libffmpeg-nvenc-dev  12.1.14.0-1build1        …
ii  libnvinfer-bin       11.1.0.106-1+cuda13.3    …
ii  orbbecsdk            2.8.7                    …
ii  tensorrt-dev         11.1.0.106-1+cuda13.3    …
g++-15 (Ubuntu 15.2.0-16ubuntu1) 15.2.0
```

Step 6 ends with `NVENC capability test passed` (full output in
[Build and test](./build#expected-result)).

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                     | Cause and fix                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nvidia-smi: command not found`, or it cannot talk to the driver                                            | No NVIDIA driver is loaded. Install one as described in [Install](./install#cuda-toolkit-and-driver), then reboot. |
| Compute capability is below 7.5                                                                             | CUDA 13 does not support this GPU. Use a newer GPU.                                                                |
| `--nvenc-test` fails with `NVENC does not support the required color/depth encoding pipeline. Missing: ...` | This GPU's NVENC cannot encode the 10-bit depth stream. Use a GPU that has these features.                         |
| `lsusb` shows no `2bc5` device                                                                              | Check the cable and the port, and use a USB 3 port. Some USB-C cables carry only USB 2 or only power.              |
| `lsusb -t` shows the camera at `480M`                                                                       | The camera is running at USB 2 speed. Move it to a USB 3 port or use a USB 3 cable.                                |
