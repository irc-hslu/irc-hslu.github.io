# Build and test (https://irc-hslu.github.io/orbbecstreamer/docs/server/build)



The server builds with CMake presets, Ninja and vcpkg. A small `Makefile` wraps
the common commands. This page covers configuring, building, building for a
different GPU and running the tests. Finish [Install](./install) first. All
commands run in `server/`.

## Presets [#presets]

`CMakePresets.json` defines two configure presets and one build preset for
each:

| Configure preset     | Build preset     | Build type     | Build directory            | Use                            |
| -------------------- | ---------------- | -------------- | -------------------------- | ------------------------------ |
| `dev-debug`          | `debug`          | Debug          | `build/dev-debug`          | Everyday development and tests |
| `dev-relwithdebinfo` | `relwithdebinfo` | RelWithDebInfo | `build/dev-relwithdebinfo` | Latency measurements           |

Both presets:

* use the vcpkg toolchain in `external/vcpkg`
* use `/usr/bin/gcc-15` and `/usr/bin/g++-15`, also as the CUDA host compiler
* use `nvcc` from `/usr/local/cuda`
* compile CUDA code for compute capability 8.9 (plus `compute_89` PTX for newer GPUs)
* find the Orbbec SDK in `/usr/local/lib`
* write `compile_commands.json` for editors and clangd

## Configure and build [#configure-and-build]

```bash
cmake --preset dev-debug
cmake --build --preset debug
```

The first configure builds every vcpkg dependency from source, including
OpenCV with GTK. This can take a long time. Later configures reuse the vcpkg
binary cache in `~/.cache/vcpkg` and take seconds.

For the latency build, use the other pair:

```bash
cmake --preset dev-relwithdebinfo
cmake --build --preset relwithdebinfo
```

The build produces these programs in the build directory:

| Program                                         | What it is                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `orbbec_streamer`                               | The server, with its built-in smoke tests                                                                |
| `orbbec_streamer_depth_quantization_calibrator` | The depth quantization calibrator (see [Depth quantization calibrator](./depth-quantization-calibrator)) |
| `orbbec_streamer_rvm_engine_smoke_test`         | Loads an RVM TensorRT engine and runs one frame through it                                               |
| `orbbec_streamer_*_tests`, `*_test`             | Test programs that `ctest` runs                                                                          |

## Build for a different GPU [#build-for-a-different-gpu]

The presets compile CUDA code for compute capability 8.9 (RTX 40 series). The
binaries also carry `compute_89` PTX, which newer GPUs (compute capability
above 8.9) compile at startup, so those work without changes. On a GPU below
compute capability 8.9, for example an RTX 30 series card (8.6), the CUDA
kernels fail to launch and you must build for your architecture.

Find your GPU's compute capability:

```bash
nvidia-smi --query-gpu=compute_cap --format=csv,noheader
```

Passing `-DCMAKE_CUDA_ARCHITECTURES=86` on the command line does not last:
`CMakePresets.json` sets `CMAKE_CUDA_ARCHITECTURES` to `89`, every
`cmake --preset dev-debug` applies that value again, and every `make` target
runs `cmake --preset` first. Instead, create a user preset. Save this as
`server/CMakeUserPresets.json`, with `86` replaced by your compute capability
without the dot:

```json
{
  "version": 6,
  "configurePresets": [
    {
      "name": "local-debug",
      "inherits": "dev-debug",
      "binaryDir": "${sourceDir}/build/local-debug",
      "cacheVariables": {
        "CMAKE_CUDA_ARCHITECTURES": "86"
      }
    }
  ],
  "buildPresets": [
    {
      "name": "local-debug",
      "configurePreset": "local-debug"
    }
  ]
}
```

CMake reads `CMakeUserPresets.json` next to `CMakePresets.json`
automatically. `server/.gitignore` ignores it, because it describes your
machine only. Configure and build with the user preset:

```bash
cmake --preset local-debug
cmake --build --preset local-debug
```

The build goes to `build/local-debug`. Use that folder wherever these pages
say `build/dev-debug`, and pass the preset to `make`, for example
`make check-unit PRESET=local-debug BUILD_PRESET=local-debug
BUILD_DIR=build/local-debug`.

The `unit` tests launch CUDA kernels, so `ctest --test-dir build/local-debug
-L unit` (or the `check_unit` target) shows whether the architecture is right.
`orbbec_streamer --cuda-test` does not: it prints `CUDA smoke test OK` even
when its kernel failed to launch.

## Makefile shortcuts [#makefile-shortcuts]

The `Makefile` runs the same presets. `PRESET`, `BUILD_PRESET` and `BUILD_DIR`
default to `dev-debug`, `debug` and `build/dev-debug`, and you can override
them, for example `make build PRESET=dev-relwithdebinfo
BUILD_PRESET=relwithdebinfo BUILD_DIR=build/dev-relwithdebinfo`.

| Target                                                                                       | Runs                                                   |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `make configure`                                                                             | `cmake --preset dev-debug`                             |
| `make build`                                                                                 | Configure, then build everything                       |
| `make check` (also `make test`)                                                              | Every test, including hardware and RVM tests           |
| `make check-unit` (also `make test-unit`)                                                    | The `unit` tests                                       |
| `make check-smoke` (also `make test-smoke`)                                                  | The `smoke` tests                                      |
| `make check-hardware` (also `make test-hardware`)                                            | The `hardware` tests                                   |
| `make test-cuda`, `test-compression`, `test-websocket`, `test-orbbec`, `test-orbbec-capture` | Build, then run `orbbec_streamer` with that smoke flag |
| `make check-env`                                                                             | Print compiler, CMake, Ninja, CUDA and driver versions |
| `make clean`                                                                                 | Delete `build/` and `cmake-build-*`                    |

`make clean` deletes every build directory, so the next configure rebuilds from
the vcpkg binary cache.

## Run the tests [#run-the-tests]

Tests are registered with CTest and grouped by label. Each `check*` target
runs one group. The targets do not build every test program they run (for
example, `check_unit` does not build three of its tests), so build everything
first:

```bash
cmake --build --preset debug
cmake --build --preset debug --target check_unit
```

| Target                   | CTest selection                              | Needs                                                                                                     |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `check_unit`             | label `unit` (31 tests)                      | A CUDA GPU with NVENC (`smoke_nvenc_hevc_encoder` has the `unit` label)                                   |
| `check_integration`      | label `integration` (7 tests)                | A CUDA GPU with NVENC. Build everything first: this target builds only some of the test programs it runs. |
| `check_cuda`             | label `cuda`                                 | A CUDA GPU with NVENC, and the RVM engines                                                                |
| `check_smoke`            | label `smoke`                                | Cameras and the RVM engines                                                                               |
| `check_hardware`         | label `hardware` (4 tests)                   | The cameras in `config/dev/live.yaml`, and a GPU with NVENC                                               |
| `check_orbbec_live_sync` | the test `orbbec_live_sync_integration_test` | The cameras in `config/dev/live.yaml`, wired for hardware sync                                            |
| `check`                  | all 44 tests                                 | Everything above                                                                                          |

You can also run CTest directly and pick labels yourself. This runs every test
that needs neither cameras nor the RVM engine:

```bash
ctest --test-dir build/dev-debug --output-on-failure -LE "hardware|rvm"
```

Other useful labels are `protocol`, `conformance`, `calibration`, `setup`,
`nvenc`, `gpu` and `telemetry`. List all tests with
`ctest --test-dir build/dev-debug -N`.

### Tests with special needs [#tests-with-special-needs]

* **Hardware tests** (label `hardware`) need Orbbec cameras. The
  `orbbec_live_sync_integration_test` opens the cameras by the serial numbers
  in `config/dev/live.yaml`. Edit that file to match your cameras (see
  [Configuration](./configuration)). `nvenc_hevc_round_trip_integration_test`
  also has this label but needs only a GPU with NVENC. It decodes with the GPU when it can and falls back to FFmpeg software decoding.
* **RVM smoke tests** (`smoke_rvm_engine_b1` and `smoke_rvm_engine_b2`, label
  `rvm`) need the engines in `models/rvm/generated/` (see
  [Install](./install#rvm-segmentation-engine-optional)). Without them, CTest
  reports the two tests as `Not Run` and the run counts as failed. This does
  not mean the code is broken.
* **Protocol conformance** (`protocol_conformance_tests`) reads the contract
  and test vectors from `../protocol`. If the contract lives elsewhere, set the
  CMake cache variable when you configure, with `<path>` replaced by the
  folder that contains `wire-format.md`, `schema/` and `vectors/`:
  `cmake --preset dev-debug -DORBBEC_STREAMER_PROTOCOL_CONTRACT_DIR=<path>`.

## Smoke tests by hand [#smoke-tests-by-hand]

`orbbec_streamer` has built-in smoke tests. Each flag runs one check and exits:

```bash
./build/dev-debug/orbbec_streamer --cuda-test
./build/dev-debug/orbbec_streamer --nvenc-test
./build/dev-debug/orbbec_streamer --compression-test
./build/dev-debug/orbbec_streamer --websocket-test
./build/dev-debug/orbbec_streamer --orbbec-test
./build/dev-debug/orbbec_streamer --orbbec-capture-test
```

| Flag                    | Checks                                                                                                                                                                | Needs cameras |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `--cuda-test`           | CUDA devices are visible                                                                                                                                              | No            |
| `--nvenc-test`          | The GPU's NVENC has every HEVC feature the server needs                                                                                                               | No            |
| `--compression-test`    | Nothing yet. It is a placeholder that prints `Compression smoke test OK`.                                                                                             | No            |
| `--websocket-test`      | Nothing yet. It is a placeholder that prints `WebSocket smoke test OK`. The server does not serve browsers yet: the planned transport is WebTransport, not WebSocket. | No            |
| `--orbbec-test`         | The Orbbec SDK finds the cameras                                                                                                                                      | Yes           |
| `--orbbec-capture-test` | Frame sets arrive from the cameras and pass through CUDA upload, GPU statistics and the packetizer                                                                    | Yes           |

Run `./build/dev-debug/orbbec_streamer --help` for all options.

## CLion [#clion]

CLion reads `CMakePresets.json`. In **Settings → Build, Execution, Deployment →
CMake**, enable the `dev-debug` profile and turn off the default `Debug`
profile. The default profile builds in `cmake-build-debug` without the vcpkg
toolchain and the compiler settings of the presets. Set the program arguments of the
`orbbec_streamer` run configuration to one of the smoke flags, or to
`--live config/dev/live.yaml`, and set its working directory to `server/`.

## Expected result [#expected-result]

Configure ends with:

```text
-- C++ compiler: /usr/bin/g++-15 (GNU 15.2.0)
-- CUDA host compiler: /usr/bin/g++-15 (GNU 15.2.0)
-- Configuring done
-- Generating done
-- Build files have been written to: .../server/build/dev-debug
```

`check_unit` ends with:

```text
100% tests passed, 0 tests failed out of 31
```

The CTest command without cameras or the RVM engine ends with:

```text
100% tests passed, 0 tests failed out of 38
```

`--cuda-test` and `--nvenc-test` print, on the reference machine:

```text
CUDA devices: 1
Device 0: NVIDIA GeForce RTX 4090
Compute capability: 8.9
CUDA smoke test OK
```

```text
[info] NVENC GPU: ordinal=0 name='NVIDIA GeForce RTX 4090'
[info] NVENC HEVC: codec=true main=true main10=true nv12=true yuv420_10bit=true encode_10bit=true preset_p1=true
[info] NVENC capability test passed
```

`--orbbec-test` with two Femto Bolts prints one block per camera and ends with:

```text
Orbbec provider smoke test OK
```

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                                          | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C++ and CUDA host compilers must use the same major toolchain`                                                                  | CMake cached different compilers for C++ and CUDA, usually from a configure outside the presets. Run `cmake --preset dev-debug --fresh` to discard the CMake cache. The presets set `CC`, `CXX` and `CUDAHOSTCXX` for you.                                                                                                                                                                                                                    |
| `CMAKE_CXX_COMPILER ... /usr/bin/g++-15 is not a full path to an existing compiler`                                              | Install `g++-15` (see [Install](./install#system-packages)).                                                                                                                                                                                                                                                                                                                                                                                  |
| `No CMAKE_CUDA_COMPILER could be found` or `/usr/local/cuda/bin/nvcc` missing                                                    | The CUDA toolkit is not installed at `/usr/local/cuda`. See [Install](./install#cuda-toolkit-and-driver).                                                                                                                                                                                                                                                                                                                                     |
| vcpkg fails while building `at-spi2-core`, `gtk3` or another OpenCV dependency                                                   | A system build tool or X11 header is missing. Install the packages in [Install](./install#system-packages) and configure again. The vcpkg log path is in the error message.                                                                                                                                                                                                                                                                   |
| A CUDA test fails with `no kernel image is available for execution on the device`                                                | The GPU is older than compute capability 8.9, which the presets build for. See [Build for a different GPU](#build-for-a-different-gpu).                                                                                                                                                                                                                                                                                                       |
| `smoke_rvm_engine_b1` and `smoke_rvm_engine_b2` are `Not Run`                                                                    | The RVM engines are not built. Build them, or exclude them with `-LE rvm`.                                                                                                                                                                                                                                                                                                                                                                    |
| `protocol_conformance_tests` fails after you update from `main`                                                                  | The protocol contract changed and the server does not conform yet. This is expected: it is how the server team learns of a contract change.                                                                                                                                                                                                                                                                                                   |
| `orbbec_live_sync_integration_test` fails with `Request failed, device response with unknown error! propertyId: 1038`            | A camera rejected the multi-device sync settings (property 1038 is `OB_STRUCT_MULTI_DEVICE_SYNC_CONFIG`). Possible causes are a missing or loose sync cable, wrong `primary` and `secondary` roles in the config, or a camera left in a bad state by an earlier run. Check the cabling and the roles, then power-cycle the cameras. This fix is not yet confirmed. The Orbbec SDK log is in `Log/OrbbecSDK.log.txt` in the working directory. |
| An NVENC test fails with `NvEncOpenEncodeSessionEx failed with NVENC status 21`                                                  | Too many NVENC sessions at once: GeForce drivers limit concurrent encoder sessions and report status 21 (`NV_ENC_ERR_INCOMPATIBLE_CLIENT_KEY`). `ctest` runs the NVENC tests one at a time (they share the `nvenc` resource lock), so this appears only when another program is encoding at the same time, such as a running server, OBS or a second `ctest`. Stop it and rerun.                                                              |
| `--orbbec-capture-test` prints `Orbbec SDK error: ...` but exits with code 0, and CTest reports `smoke_orbbec_capture` as passed | The capture smoke test catches SDK errors and does not fail on them. Read its output: it passed only if the last line ends in `smoke test OK`.                                                                                                                                                                                                                                                                                                |
| A hardware test cannot find a camera                                                                                             | Check that the serial numbers in `config/dev/live.yaml` match `--orbbec-test`, and that no other program, such as `OrbbecViewer` or a running server, has the cameras open.                                                                                                                                                                                                                                                                   |
