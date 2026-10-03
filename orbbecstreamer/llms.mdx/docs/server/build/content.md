# Build and test (https://irc-hslu.github.io/orbbecstreamer/docs/server/build)



This page compiles the server and runs its tests. The build uses CMake presets
(named build settings stored in `CMakePresets.json`), the Ninja build tool and
vcpkg. Finish [Install](./install) first. Run every command on this page from
the `server/` folder.

If your GPU's compute capability is below 8.9 (see
[Requirements](./requirements)), do
[Build for a different GPU](#build-for-a-different-gpu) instead of the first
two steps below.

## Configure and build [#configure-and-build]

1. Configure the debug build:

   ```bash
   cmake --preset dev-debug
   ```

   The first configure builds every vcpkg dependency from source, including
   OpenCV with GTK. This can take a long time. Later configures reuse the
   vcpkg binary cache in `~/.cache/vcpkg` and take seconds.

2. Build everything:

   ```bash
   cmake --build --preset debug
   ```

3. Check that the program can use the GPU and its video encoder:

   ```bash
   ./build/dev-debug/orbbec_streamer --cuda-test
   ./build/dev-debug/orbbec_streamer --nvenc-test
   ```

The build writes these programs to `build/dev-debug/`:

| Program                                         | What it is                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `orbbec_streamer`                               | The server, with its built-in smoke tests (short checks that exit after one test)                        |
| `orbbec_streamer_depth_quantization_calibrator` | The depth quantization calibrator (see [Depth quantization calibrator](./depth-quantization-calibrator)) |
| `orbbec_streamer_rvm_engine_smoke_test`         | Loads an RVM TensorRT engine and runs one frame through it                                               |
| `orbbec_streamer_*_tests`, `*_test`             | Test programs that `ctest` runs                                                                          |

For latency measurements, use the optimised build with debug symbols instead.
It builds to `build/dev-relwithdebinfo/`:

```bash
cmake --preset dev-relwithdebinfo
cmake --build --preset relwithdebinfo
```

## Run the tests [#run-the-tests]

The tests are registered with CTest, CMake's test runner, and grouped by label
(`unit`, `integration`, `hardware` and others). The unit tests need a GPU but
no cameras.

1. Build everything first, if you have not already. The `check_*` targets do
   not build every test program they run:

   ```bash
   cmake --build --preset debug
   ```

2. Run the unit tests:

   ```bash
   cmake --build --preset debug --target check_unit
   ```

3. Run every test that needs neither cameras nor the RVM engine:

   ```bash
   ctest --test-dir build/dev-debug --output-on-failure -LE "hardware|rvm"
   ```

   `-LE` excludes the tests whose label matches. To run the tests that need
   cameras, see [Test targets and labels](#test-targets-and-labels).

## Expected result [#expected-result]

Configure ends with:

```text
-- C++ compiler: /usr/bin/g++-15 (GNU 15.2.0)
-- CUDA host compiler: /usr/bin/g++-15 (GNU 15.2.0)
-- Configuring done
-- Generating done
-- Build files have been written to: .../server/build/dev-debug
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

`check_unit` ends with:

```text
100% tests passed, 0 tests failed out of 33
```

The CTest command without cameras or the RVM engine ends with:

```text
100% tests passed, 0 tests failed out of 44
```

## Build for a different GPU [#build-for-a-different-gpu]

This task is optional. You need it only when your GPU's compute capability is
below 8.9, for example an RTX 30 series card (8.6).

The presets compile the GPU code for compute capability 8.9 (RTX 40 series).
The programs also contain `compute_89` PTX (portable GPU code that the driver
compiles at startup), so newer GPUs work without changes. On an older GPU the
CUDA kernels (the functions that run on the GPU) fail to launch.

You cannot fix this with `-DCMAKE_CUDA_ARCHITECTURES=86` on the command line.
`CMakePresets.json` sets `CMAKE_CUDA_ARCHITECTURES` to `89`, every
`cmake --preset dev-debug` applies that value again, and every `make` target
runs `cmake --preset` first. Use a user preset instead:

1. Find your GPU's compute capability:

   ```bash
   nvidia-smi --query-gpu=compute_cap --format=csv,noheader
   ```

2. Save this as `server/CMakeUserPresets.json`. Replace `86` with your compute
   capability without the dot (for example `8.6` becomes `86`):

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
   automatically. Git ignores it, because it describes your machine only.

3. Configure and build with the user preset:

   ```bash
   cmake --preset local-debug
   cmake --build --preset local-debug
   ```

4. Check the result with the unit tests. They launch CUDA kernels, so they
   fail if the architecture is wrong:

   ```bash
   ctest --test-dir build/local-debug --output-on-failure -L unit
   ```

   Do not rely on `orbbec_streamer --cuda-test` for this check. It prints
   `CUDA smoke test OK` even when its kernel failed to launch.

The build goes to `build/local-debug`. Use that folder wherever these pages
say `build/dev-debug`. Pass the preset to `make` as well, for example
`make check-unit PRESET=local-debug BUILD_PRESET=local-debug
BUILD_DIR=build/local-debug`.

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

## Makefile shortcuts [#makefile-shortcuts]

A small `Makefile` runs the same presets. `PRESET`, `BUILD_PRESET` and
`BUILD_DIR` default to `dev-debug`, `debug` and `build/dev-debug`. You can
override them, for example `make build PRESET=dev-relwithdebinfo
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

`make clean` deletes every build directory, so the next configure rebuilds
from the vcpkg binary cache.

## Test targets and labels [#test-targets-and-labels]

Each `check_*` build target runs one group of tests. Run it with
`cmake --build --preset debug --target <target>`, with `<target>` replaced by
a name from this table.

| Target                   | CTest selection                              | Needs                                                                                                     |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `check_unit`             | label `unit` (33 tests)                      | A CUDA GPU with NVENC (`smoke_nvenc_hevc_encoder` has the `unit` label)                                   |
| `check_integration`      | label `integration` (11 tests)               | A CUDA GPU with NVENC. Build everything first: this target builds only some of the test programs it runs. |
| `check_cuda`             | label `cuda`                                 | A CUDA GPU with NVENC, and the RVM engines                                                                |
| `check_smoke`            | label `smoke`                                | Cameras and the RVM engines                                                                               |
| `check_hardware`         | label `hardware` (4 tests)                   | The cameras in `config/dev/live.yaml`, and a GPU with NVENC                                               |
| `check_orbbec_live_sync` | the test `orbbec_live_sync_integration_test` | The cameras in `config/dev/live.yaml`, wired for hardware sync                                            |
| `check`                  | all 50 tests                                 | Everything above                                                                                          |

You can also run CTest directly and pick labels yourself: `-L <label>` runs
one label and `-LE <label>` excludes one. Other useful labels are `protocol`,
`conformance`, `calibration`, `setup`, `nvenc`, `gpu` and `telemetry`. List
all tests with `ctest --test-dir build/dev-debug -N`.

### Tests with special needs [#tests-with-special-needs]

* **Hardware tests** (label `hardware`) need Orbbec cameras. The
  `orbbec_live_sync_integration_test` opens the cameras by the serial numbers
  in `config/dev/live.yaml`. Edit that file to match your cameras (see
  [Configuration](./configuration)). `nvenc_hevc_round_trip_integration_test`
  also has this label but needs only a GPU with NVENC. It decodes with the GPU
  when it can and falls back to FFmpeg software decoding.
* **RVM smoke tests** (`smoke_rvm_engine_b1` and `smoke_rvm_engine_b2`, label
  `rvm`) need the engines in `models/rvm/generated/` (see
  [Install](./install#rvm-segmentation-engine-optional)). Without them, CTest
  reports the two tests as `Not Run` and the run counts as failed. This does
  not mean the code is broken.
* **Protocol conformance** (`protocol_conformance_tests`) checks the server
  against the wire contract and its test vectors in `../protocol`. If the
  contract lives elsewhere, set the CMake cache variable when you configure.
  Replace `<path>` with the folder that contains `wire-format.md`, `schema/`
  and `vectors/`:
  `cmake --preset dev-debug -DORBBEC_STREAMER_PROTOCOL_CONTRACT_DIR=<path>`.

## Smoke tests by hand [#smoke-tests-by-hand]

`orbbec_streamer` has built-in smoke tests. Each flag runs one check and
exits:

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

`--orbbec-test` with two Femto Bolts prints one block per camera and ends
with:

```text
Orbbec provider smoke test OK
```

Run `./build/dev-debug/orbbec_streamer --help` for all options.

## CLion [#clion]

CLion reads `CMakePresets.json`. In **Settings → Build, Execution, Deployment →
CMake**, enable the `dev-debug` profile and turn off the default `Debug`
profile. The default profile builds in `cmake-build-debug` without the vcpkg
toolchain and the compiler settings of the presets. Set the program arguments
of the `orbbec_streamer` run configuration to one of the smoke flags, or to
`--live config/dev/live.yaml`, and set its working directory to `server/`.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                                          | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C++ and CUDA host compilers must use the same major toolchain`                                                                  | CMake cached different compilers for C++ and CUDA, usually from a configure outside the presets. Run `cmake --preset dev-debug --fresh` to discard the CMake cache. The presets set `CC`, `CXX` and `CUDAHOSTCXX` for you.                                                                                                                                                                                                                    |
| `CMAKE_CXX_COMPILER ... /usr/bin/g++-15 is not a full path to an existing compiler`                                              | Install `g++-15` (see [Install](./install#system-packages)).                                                                                                                                                                                                                                                                                                                                                                                  |
| `No CMAKE_CUDA_COMPILER could be found` or `/usr/local/cuda/bin/nvcc` missing                                                    | The CUDA toolkit is not installed at `/usr/local/cuda`. See [Install](./install#cuda-toolkit-and-driver).                                                                                                                                                                                                                                                                                                                                     |
| vcpkg fails while building `at-spi2-core`, `gtk3` or another OpenCV dependency                                                   | A system build tool or X11 header is missing. Install the packages in [Install](./install#system-packages) and configure again. The vcpkg log path is in the error message.                                                                                                                                                                                                                                                                   |
| A CUDA test fails with `no kernel image is available for execution on the device`                                                | The GPU is older than compute capability 8.9, which the presets build for. See [Build for a different GPU](#build-for-a-different-gpu).                                                                                                                                                                                                                                                                                                       |
| `smoke_rvm_engine_b1` and `smoke_rvm_engine_b2` are `Not Run`                                                                    | The RVM engines are not built. Build them, or exclude them with `-LE rvm`.                                                                                                                                                                                                                                                                                                                                                                    |
| `protocol_conformance_tests` fails after you update from `main`                                                                  | The wire contract in `protocol/` changed and the server does not match it yet. This is expected: a failing conformance test is how the server team learns of a contract change.                                                                                                                                                                                                                                                               |
| `orbbec_live_sync_integration_test` fails with `Request failed, device response with unknown error! propertyId: 1038`            | A camera rejected the multi-device sync settings (property 1038 is `OB_STRUCT_MULTI_DEVICE_SYNC_CONFIG`). Possible causes are a missing or loose sync cable, wrong `primary` and `secondary` roles in the config, or a camera left in a bad state by an earlier run. Check the cabling and the roles, then power-cycle the cameras. This fix is not yet confirmed. The Orbbec SDK log is in `Log/OrbbecSDK.log.txt` in the working directory. |
| An NVENC test fails with `NvEncOpenEncodeSessionEx failed with NVENC status 21`                                                  | Too many NVENC sessions at once: GeForce drivers limit concurrent encoder sessions and report status 21 (`NV_ENC_ERR_INCOMPATIBLE_CLIENT_KEY`). `ctest` runs the NVENC tests one at a time (they share the `nvenc` resource lock), so this appears only when another program is encoding at the same time, such as a running server, OBS or a second `ctest`. Stop it and rerun.                                                              |
| `--orbbec-capture-test` prints `Orbbec SDK error: ...` but exits with code 0, and CTest reports `smoke_orbbec_capture` as passed | The capture smoke test catches SDK errors and does not fail on them. Read its output: it passed only if the last line ends in `smoke test OK`.                                                                                                                                                                                                                                                                                                |
| A hardware test cannot find a camera                                                                                             | Check that the serial numbers in `config/dev/live.yaml` match `--orbbec-test`, and that no other program, such as `OrbbecViewer` or a running server, has the cameras open.                                                                                                                                                                                                                                                                   |
