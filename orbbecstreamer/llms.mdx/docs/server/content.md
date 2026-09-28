# Server (https://irc-hslu.github.io/orbbecstreamer/docs/server)



The server captures colour and depth from one or more hardware-synchronised
Orbbec cameras, aligns colour to depth in the Orbbec SDK, segments and filters
the frames on the GPU, and encodes colour (HEVC Main) and depth (HEVC Main10)
with NVENC.
Browsers will receive the streams over WebTransport; that serving path is not
available yet (see [Serve to browsers](/docs/server/serving)).

## Status [#status]

| Part                                                                               | State                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Multi-camera capture and hardware sync                                             | Works (tested with 2 × Femto Bolt)                               |
| Colour-to-depth alignment (Orbbec SDK, CPU)                                        | Works                                                            |
| GPU segmentation and depth filtering                                               | Works; the RVM segmentation backend needs a TensorRT engine      |
| NVENC colour and depth encoding, both [stream layouts](/docs/server/stream-layout) | Works                                                            |
| [Depth quantization calibrator](/docs/server/depth-quantization-calibrator)        | Works                                                            |
| [Camera pose calibration](/docs/server/camera-calibration)                         | Works on synthetic input; not yet validated with a printed board |
| Local debug recording, [terminal telemetry](/docs/server/telemetry)                | Works                                                            |
| WebTransport serving to browsers                                                   | Not available yet                                                |

## Where to start [#where-to-start]

1. Check the [requirements](/docs/server/requirements): Ubuntu 26.04, an NVIDIA GPU with
   NVENC (tested on an RTX 4090), CUDA 13, TensorRT, the Orbbec SDK 2.8.7, and
   Orbbec cameras.
2. [Install](/docs/server/install) the system packages, SDKs and vcpkg.
3. [Build](/docs/server/build) with the CMake presets and run the tests.
4. Write a [configuration](/docs/server/configuration) for your cameras and choose a
   [stream layout](/docs/server/stream-layout).
5. [Run the server](/docs/server/running) and [read the telemetry](/docs/server/telemetry).

## How it works [#how-it-works]

* [Architecture](/docs/server/architecture): the pipeline, its threads and queues.
* [Capture and sync](/docs/server/capture-and-sync), [GPU processing](/docs/server/gpu-processing)
  and [encoding](/docs/server/encoding): each stage in more detail.
* [Latency](/docs/server/latency): where the time goes and what the server does about it.
* [Setup state](/docs/server/setup-state): phases, revisions and the setup lease.

The wire contract between server and browser is `protocol/wire-format.md` in
the repository.
