# Build and test (https://irc-hslu.github.io/orbbecstreamer/docs/server/build)



The build uses the CMake presets in `server/CMakePresets.json`, the Ninja generator and the pinned vcpkg in `external/vcpkg`. Finish [Install](./install) first, and run every command on this page from `server/`.

If your GPU's compute capability is below 8.9 (see [Requirements](./requirements)), follow [Build for a different GPU](#build-for-a-different-gpu) instead of the first two steps.

## Configure and build [#configure-and-build]

1. Configure the debug build. The first run builds every vcpkg dependency from source, including OpenCV with GTK, and takes a long time; later runs reuse the binary cache in `~/.cache/vcpkg`.

   ```bash
   cmake --preset dev-debug
   ```

2. Build everything:

   ```bash
   cmake --build --preset debug
   ```

3. Check that the program can use the GPU and NVENC:

   ```bash
   ./build/dev-debug/orbbec_streamer --cuda-test
   ./build/dev-debug/orbbec_streamer --nvenc-test
   ```

For latency measurements use the optimised build with debug symbols:

```bash
cmake --preset dev-relwithdebinfo
cmake --build --preset relwithdebinfo
```

The build produces, in `build/<preset>/`:

| Program                                         | What it is                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `orbbec_streamer`                               | The server, with built-in smoke tests                                |
| `orbbec_streamer_depth_quantization_calibrator` | The [depth quantization calibrator](./depth-quantization-calibrator) |
| `orbbec_streamer_rvm_engine_smoke_test`         | Loads an RVM TensorRT engine and runs one frame                      |
| `orbbec_streamer_*_tests`, `*_test`             | Test programs run by CTest                                           |

## Run the tests [#run-the-tests]

Tests are registered with CTest and grouped by label. Unit tests need a GPU but no cameras.

1. Run the unit tests. Every `check_*` target builds all test programs first:

   ```bash
   cmake --build --preset debug --target check_unit
   ```

2. Run every test that needs neither cameras nor the RVM engine:

   ```bash
   ctest --test-dir build/dev-debug --output-on-failure -LE "hardware|rvm"
   ```

## Expected result [#expected-result]

Configure ends with:

```text
-- C++ compiler: /usr/bin/g++-15 (GNU 15.2.0)
-- CUDA host compiler: /usr/bin/g++-15 (GNU 15.2.0)
-- Configuring done
-- Generating done
```

`--cuda-test` and `--nvenc-test` on the reference machine:

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

Both test runs end with `100% tests passed, 0 tests failed out of N`. Without Go, `gateway_go_tests` is listed as `Skipped`; that is not a failure.

## Build for a different GPU [#build-for-a-different-gpu]

The presets compile GPU code for compute capability 8.9 (RTX 40 series) plus `compute_89` PTX, so newer GPUs work unchanged and older ones, such as an RTX 30 series card (8.6), fail to launch kernels. `-DCMAKE_CUDA_ARCHITECTURES=86` on the command line does not help: every `cmake --preset` re-applies `89`. Use a user preset:

1. Find your compute capability:

   ```bash
   nvidia-smi --query-gpu=compute_cap --format=csv,noheader
   ```

2. Save this as `server/CMakeUserPresets.json` (Git ignores it), with your capability without the dot in place of `86`:

   ```json
   {
     "version": 6,
     "configurePresets": [
       {
         "name": "local-debug",
         "inherits": "dev-debug",
         "binaryDir": "${sourceDir}/build/local-debug",
         "cacheVariables": { "CMAKE_CUDA_ARCHITECTURES": "86" }
       }
     ],
     "buildPresets": [
       { "name": "local-debug", "configurePreset": "local-debug" }
     ]
   }
   ```

3. Configure, build and check with the unit tests, which launch CUDA kernels (`--cuda-test` does not detect a wrong architecture):

   ```bash
   cmake --preset local-debug
   cmake --build --preset local-debug
   ctest --test-dir build/local-debug --output-on-failure -L unit
   ```

Use `build/local-debug` wherever these pages say `build/dev-debug`. With `make`, pass `PRESET=local-debug BUILD_PRESET=local-debug BUILD_DIR=build/local-debug`.

## Presets [#presets]

| Configure preset     | Build and test preset         | Build type                                                       | Use                                |
| -------------------- | ----------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `dev-debug`          | `debug` (build only)          | Debug                                                            | Everyday development and tests     |
| `dev-relwithdebinfo` | `relwithdebinfo` (build only) | RelWithDebInfo                                                   | Latency measurements               |
| `dev-asan`           | `asan`                        | RelWithDebInfo + AddressSanitizer and UndefinedBehaviorSanitizer | Memory errors, undefined behaviour |
| `dev-tsan`           | `tsan`                        | RelWithDebInfo + ThreadSanitizer                                 | Data races                         |
| `dev-coverage`       | `coverage`                    | Debug + gcov                                                     | Test coverage                      |

Each builds into `build/<configure preset>`. All presets use the vcpkg toolchain, `/usr/bin/gcc-15` and `/usr/bin/g++-15` (also as CUDA host compiler), `nvcc` from `/usr/local/cuda`, CUDA architecture `89`, the Orbbec SDK in `/usr/local/lib`, and write `compile_commands.json`.

## Makefile shortcuts [#makefile-shortcuts]

`PRESET`, `BUILD_PRESET` and `BUILD_DIR` default to `dev-debug`, `debug` and `build/dev-debug`; every target configures first.

| Target                                                                                          | Runs                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `make configure`, `make build`                                                                  | Configure; configure and build everything              |
| `make check` (`make test`)                                                                      | Every test, including hardware and RVM                 |
| `make check-unit`, `check-smoke`, `check-hardware` (`test-unit`, `test-smoke`, `test-hardware`) | One label                                              |
| `make test-cuda`, `test-compression`, `test-websocket`, `test-orbbec`, `test-orbbec-capture`    | Build, then run `orbbec_streamer` with that smoke flag |
| `make check-env`                                                                                | Compiler, CMake, Ninja, CUDA and driver versions       |
| `make clean`                                                                                    | Delete `build/` and `cmake-build-*`                    |

## Test targets and labels [#test-targets-and-labels]

Run a target with `cmake --build --preset debug --target <target>`. Every `check_*` target builds all test programs and `orbbec_streamer` first.

| Target                   | Selection                           | Needs                                 |
| ------------------------ | ----------------------------------- | ------------------------------------- |
| `check_unit`             | label `unit`                        | A CUDA GPU                            |
| `check_integration`      | label `integration`                 | A GPU with NVENC                      |
| `check_cuda`             | label `cuda`                        | A GPU with NVENC, and the RVM engines |
| `check_smoke`            | label `smoke`                       | Cameras and the RVM engines           |
| `check_hardware`         | label `hardware`                    | The cameras in `config/dev/live.yaml` |
| `check_orbbec_live_sync` | `orbbec_live_sync_integration_test` | The cameras, wired for hardware sync  |
| `check`                  | everything                          | All of the above                      |

Other labels for `ctest -L` / `-LE`: `protocol`, `conformance`, `network`, `fuzz`, `go`, `calibration`, `setup`, `nvenc`, `gpu`, `telemetry`. List all tests with `ctest --test-dir build/dev-debug -N`.

### Sanitizer and coverage builds [#sanitizer-and-coverage-builds]

The sanitizers instrument host C++, not CUDA kernels. Each variant has its own build directory:

```bash
cmake --preset dev-asan
cmake --build --preset asan
ctest --preset asan -j6
```

Use `tsan` and `coverage` the same way. The test presets set the sanitizer options and skip the `hardware` label; `tsan` also skips `nvenc` (the NVENC driver crashes under ThreadSanitizer) and runs OpenCV single-threaded. The encode stage's own threading (queue, keyframe requests, stop, errors) still runs under `tsan`: `nvenc_encode_stage_threading_unit_tests` replaces CUDA and NVENC with a fake encoder and has no `nvenc` label. A sanitizer report fails the test; suppressions for third-party code are in `tests/sanitizers/`. For an HTML coverage report after `ctest --preset coverage`, with [gcovr](https://gcovr.com):

```bash
gcovr -r . --filter src/ build/dev-coverage --html-details build/dev-coverage/coverage.html
```

### Fuzz tests [#fuzz-tests]

Two deterministic mutation fuzzers run in the normal test set (label `fuzz`). Only a protocol error may come out; anything else fails the test, and a failure prints the seed and iteration for replay:

| Test                     | Input                                                                     | Default iterations |
| ------------------------ | ------------------------------------------------------------------------- | ------------------ |
| `protocol_fuzz_tests`    | Control frames and media record headers seeded from `../protocol/vectors` | 20 000             |
| `gateway_ipc_fuzz_tests` | Gateway IPC messages seeded from `tests/network/ipc-vectors`              | 100 000            |

For a longer run, pass the input folder, iterations and a seed, preferably in the `dev-asan` build:

```bash
./build/dev-debug/orbbec_streamer_protocol_fuzz_tests ../protocol 1000000 42
./build/dev-debug/orbbec_streamer_gateway_ipc_fuzz_tests tests/network/ipc-vectors 10000000 42
```

### Tests with special needs [#tests-with-special-needs]

* **Hardware** (label `hardware`): `orbbec_live_sync_integration_test`, `smoke_orbbec_provider` and `smoke_orbbec_capture` open the cameras in `config/dev/live.yaml`; edit the serials to match. `nvenc_hevc_round_trip_integration_test` has the label but needs only a GPU with NVENC.
* **RVM** (`smoke_rvm_engine_b1`, `smoke_rvm_engine_b2`, label `rvm`) need the engines in `models/rvm/generated/` ([Install](./install#rvm-segmentation-engine-optional)). Without them CTest reports `Not Run` and the run fails; the code is not broken.
* **No device**: the CUDA and NVENC tests, `smoke_cuda`, `smoke_orbbec_provider` and `smoke_orbbec_capture` exit with code 77 when there is no CUDA device or no camera, and CTest lists them as `Skipped`, never as `Passed`. A skip is not a pass: run them on a machine with the device before you rely on them. To see the skip path, run with `CUDA_VISIBLE_DEVICES=""`. A failure on present hardware (an SDK error, no frames) fails the test. A new test with a skip path uses `tests/support/Skip.hpp` and needs `SKIP_RETURN_CODE 77` in `CMakeLists.txt`.
* **Go** (`gateway_go_tests`) runs `go test -race` on `server/gateway/` when `go` is on `PATH` or in `~/.local/go/bin`, and is skipped otherwise.
* **Protocol conformance** (`protocol_conformance_tests`) checks the server against `../protocol`. For a contract elsewhere, configure with `-DORBBEC_STREAMER_PROTOCOL_CONTRACT_DIR=/path/to/protocol` (the folder with `wire-format.md`, `schema/` and `vectors/`).

## Smoke tests by hand [#smoke-tests-by-hand]

| Flag                                     | Checks                                                                    | Needs cameras |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------- |
| `--cuda-test`                            | CUDA devices are visible and a kernel runs; exits 77 without a device     | No            |
| `--nvenc-test`                           | NVENC has every HEVC feature the server needs                             | No            |
| `--compression-test`, `--websocket-test` | Nothing: placeholders that print `... smoke test OK`                      | No            |
| `--orbbec-test`                          | The SDK finds the cameras; ends with `Orbbec provider smoke test OK`      | Yes           |
| `--orbbec-capture-test`                  | Frame sets arrive and pass CUDA upload, GPU statistics and the packetizer | Yes           |

Run `./build/dev-debug/orbbec_streamer --help` for all flags; details in [Run the server](./running#command-line-reference).

## CLion [#clion]

CLion reads `CMakePresets.json`. In **Settings → Build, Execution, Deployment → CMake**, enable the `dev-debug` profile and disable the default `Debug` profile, which builds without the vcpkg toolchain and compiler settings. Set the run configuration's working directory to `server/`.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                               | Cause and fix                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `C++ and CUDA host compilers must use the same major toolchain`                                       | Cached compilers from a configure outside the presets. Run `cmake --preset dev-debug --fresh`.                                                                 |
| `CMAKE_CXX_COMPILER ... /usr/bin/g++-15 is not a full path to an existing compiler`                   | Install `g++-15` ([Install](./install#system-packages)).                                                                                                       |
| `No CMAKE_CUDA_COMPILER could be found`, or `/usr/local/cuda/bin/nvcc` missing                        | Install the CUDA toolkit at `/usr/local/cuda` ([Install](./install#cuda-toolkit-and-driver)).                                                                  |
| vcpkg fails building `at-spi2-core`, `gtk3` or another OpenCV dependency                              | A build tool or X11 header is missing. Install the [system packages](./install#system-packages) and configure again; the vcpkg log path is in the error.       |
| `no kernel image is available for execution on the device`                                            | The GPU is below compute capability 8.9. See [Build for a different GPU](#build-for-a-different-gpu).                                                          |
| `smoke_rvm_engine_b1` and `smoke_rvm_engine_b2` are `Not Run`                                         | Build the RVM engines, or exclude them with `-LE rvm`.                                                                                                         |
| `protocol_conformance_tests` fails after updating from `main`                                         | The contract in `protocol/` changed and the server doesn't match it yet. A failing conformance test is how the server team learns of a contract change.        |
| `orbbec_live_sync_integration_test` fails with `propertyId: 1038`                                     | A camera rejected the multi-device sync settings: check the sync cable and roles, then power-cycle the cameras. The SDK log is in `Log/OrbbecSDK.log.txt`.     |
| An NVENC test fails with `NvEncOpenEncodeSessionEx failed with NVENC status 21`                       | Another program holds NVENC sessions (a running server, OBS, a second `ctest`). CTest runs the NVENC tests one at a time, so stop the other encoder and rerun. |
| `--orbbec-capture-test` prints `Orbbec SDK error: ...` but exits 0, and `smoke_orbbec_capture` passes | The test does not fail on SDK errors. It passed only if its last line ends in `smoke test OK`.                                                                 |
| A hardware test cannot find a camera                                                                  | Check the serials in `config/dev/live.yaml` against `--orbbec-test`, and that no other program (`OrbbecViewer`, a running server) holds the cameras.           |
