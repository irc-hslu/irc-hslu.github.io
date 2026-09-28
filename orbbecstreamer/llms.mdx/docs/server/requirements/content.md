# Requirements (https://irc-hslu.github.io/orbbecstreamer/docs/server/requirements)



The server runs on one Linux machine with an NVIDIA GPU and one or more Orbbec
cameras connected over USB. This page lists what that machine needs and how to
check each item. The next step is [Install](./install).

## Tested reference machine [#tested-reference-machine]

Only one configuration has been tested. Other versions may work but are not
tested.

| Component     | Tested version                                               |
| ------------- | ------------------------------------------------------------ |
| OS            | Ubuntu 26.04.1 LTS (x86_64)                                  |
| GPU           | NVIDIA GeForce RTX 4090 (compute capability 8.9)             |
| NVIDIA driver | 580.178.04                                                   |
| CUDA toolkit  | 13.3 (`nvcc` V13.3.73), at `/usr/local/cuda`                 |
| TensorRT      | 11.1.0.106 (`+cuda13.3` Debian packages)                     |
| NVENC headers | `ffnvcodec` 12.1 (package `libffmpeg-nvenc-dev`)             |
| Orbbec SDK    | 2.8.7                                                        |
| Cameras       | 2 × Orbbec Femto Bolt, firmware 1.1.2, hardware-synchronised |
| Compiler      | GCC 15.2 (`/usr/bin/gcc-15`, `/usr/bin/g++-15`)              |
| CMake / Ninja | CMake 4.1.2 and 4.2.3, Ninja 1.13.2                          |
| Python        | 3.12 or newer, only to build the RVM engine                  |

## GPU [#gpu]

The server encodes colour with NVENC HEVC Main and depth with HEVC Main10, and
runs its image processing in CUDA. The GPU's NVENC must support all of the
features below. `orbbec_streamer --nvenc-test` checks them and names any that
are missing:

* HEVC codec with the Main and Main10 profiles
* NV12 and YUV420 10-bit input surfaces
* 10-bit encoding
* the P1 preset

In practice you need a GeForce, RTX or Quadro GPU from the Turing generation
(compute capability 7.5) or newer: CUDA 13 does not support older GPUs.
Compute GPUs without NVENC, such as the A100 and H100, do not work.

The CMake presets compile CUDA code for compute capability 8.9 (RTX 40
series) and include `compute_89` PTX, which newer GPUs compile at startup. On
a GPU below compute capability 8.9 the CUDA kernels fail to launch. Build for
your GPU with a user preset as described in
[Build](./build#build-for-a-different-gpu).

## NVIDIA driver and CUDA [#nvidia-driver-and-cuda]

* CUDA 13.x needs driver branch 580 or newer.
* The build expects the toolkit at `/usr/local/cuda` (`nvcc` at
  `/usr/local/cuda/bin/nvcc`). NVIDIA's packages create this link.

## TensorRT [#tensorrt]

TensorRT is required to build the server. CMake stops with an error if it
cannot find the TensorRT headers and `libnvinfer`, because every server binary
links it.

The Robust Video Matting (RVM) engine file that TensorRT runs is needed only
when:

* the live config uses `mask.backend: rvm`, or
* you run the two RVM smoke tests.

`trtexec` (package `libnvinfer-bin`) is needed only to build that engine.

## Cameras [#cameras]

* **Model.** The only tested camera is the Orbbec Femto Bolt. The code talks to
  the Orbbec SDK, not to a specific model, but all cameras in one rig must be
  the same model.
* **USB.** Each camera needs a USB 3 (SuperSpeed, 5 Gbit/s) connection. In
  `lsusb -t` the camera interfaces should show `5000M`, not `480M`.
* **Multi-camera sync.** With more than one camera, one camera is the
  `primary` and the others are `secondary`. The primary sends a hardware
  trigger to the secondaries. You set the roles and delays in the live config
  (`cameras[].role` and the `sync` block, see
  [Configuration](./configuration)). This repository does not document the
  sync cabling. Wire the cameras as described in Orbbec's multi-camera
  synchronisation guide for your camera model.

## Operating system and disk [#operating-system-and-disk]

* **OS.** Ubuntu 26.04 is the only tested OS. The presets hard-code
  `/usr/bin/gcc-15`, `/usr/bin/g++-15` and `/usr/local/cuda`.
* **Disk.** One build directory with its vcpkg dependencies takes about 5 GB.
  The vcpkg binary cache in `~/.cache/vcpkg` takes about another 4.5 GB.
* **Display (optional).** The live preview window opens only when `DISPLAY` or
  `WAYLAND_DISPLAY` is set. Without a display, the server still runs and logs
  that the preview is off.

## Check your machine [#check-your-machine]

Run these commands:

```bash
lsb_release -d
nvidia-smi --query-gpu=name,driver_version,compute_cap --format=csv,noheader
/usr/local/cuda/bin/nvcc --version | tail -1
dpkg -l tensorrt-dev libnvinfer-bin orbbecsdk libffmpeg-nvenc-dev | grep ^ii
g++-15 --version | head -1
lsusb | grep 2bc5
```

## Expected result [#expected-result]

On the reference machine the output is:

```text
Description:	Ubuntu 26.04.1 LTS
NVIDIA GeForce RTX 4090, 580.178.04, 8.9
Build cuda_13.3.r13.3/compiler.38244171_0
ii  libffmpeg-nvenc-dev  12.1.14.0-1build1        ...
ii  libnvinfer-bin       11.1.0.106-1+cuda13.3    ...
ii  orbbecsdk            2.8.7                    ...
ii  tensorrt-dev         11.1.0.106-1+cuda13.3    ...
g++-15 (Ubuntu 15.2.0-16ubuntu1) 15.2.0
Bus 002 Device 002: ID 2bc5:066b Orbbec 3D Technology International, Inc Orbbec Femto Bolt 3D Camera
Bus 002 Device 003: ID 2bc5:066b Orbbec 3D Technology International, Inc Orbbec Femto Bolt 3D Camera
```

`2bc5` is Orbbec's USB vendor ID. You should see one line per camera. After you
build the server, `./build/dev-debug/orbbec_streamer --nvenc-test` confirms
the GPU has every NVENC feature it needs (see [Build](./build)).

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                     | Cause and fix                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nvidia-smi: command not found`, or it cannot talk to the driver                                            | No NVIDIA driver is loaded. Install one as described in [Install](./install#cuda-toolkit-and-driver), then reboot. |
| Compute capability is below 7.5                                                                             | CUDA 13 does not support this GPU. Use a newer GPU.                                                                |
| `--nvenc-test` fails with `NVENC does not support the required color/depth encoding pipeline. Missing: ...` | This GPU's NVENC cannot encode the 10-bit depth stream. Use a GPU that has these features.                         |
| `lsusb` shows no `2bc5` device                                                                              | Check the cable and the port, and use a USB 3 port. Some USB-C cables carry only USB 2 or only power.              |
| `lsusb -t` shows the camera at `480M`                                                                       | The camera is running at USB 2 speed. Move it to a USB 3 port or use a USB 3 cable.                                |
