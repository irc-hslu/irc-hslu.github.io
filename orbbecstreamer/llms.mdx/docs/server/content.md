# Server (https://irc-hslu.github.io/orbbecstreamer/docs/server)



The server is a C++/CUDA program. It runs on one Linux machine with an NVIDIA
GPU and one or more Orbbec RGB-D cameras. It captures colour and depth, prepares
the frames on the GPU and encodes them as video. Browsers will receive that
video over WebTransport, but that serving path is not available yet (see
[Serve to browsers](/docs/server/serving)).

For each set of frames, the server:

1. captures colour and depth from all cameras at the same instant: with
   hardware sync, one camera triggers the others over a sync cable
2. aligns colour to depth in the Orbbec SDK, so each colour pixel matches the
   depth pixel at the same position
3. optionally separates people from the background (segmentation), and
   filters the depth, both on the GPU
4. encodes colour as 8-bit HEVC Main and depth as 10-bit HEVC Main10 with
   NVENC, the hardware video encoder on NVIDIA GPUs (HEVC is the H.265 video
   codec)

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

RVM (Robust Video Matting) is a neural network that separates people from the
background. TensorRT is NVIDIA's library that runs it on the GPU from a
prebuilt engine file.

## Where to start [#where-to-start]

The first time, follow these pages in order:

1. [Requirements](/docs/server/requirements): check that your machine has a
   supported NVIDIA GPU, Ubuntu 26.04 and Orbbec cameras on USB 3.
2. [Install](/docs/server/install): install the system packages, CUDA,
   TensorRT, the Orbbec SDK and vcpkg.
3. [Build and test](/docs/server/build): compile the server and run its tests.
4. [Configuration](/docs/server/configuration): write a config file for your
   cameras, and choose a [stream layout](/docs/server/stream-layout).
5. [Run the server](/docs/server/running), then
   [read the telemetry](/docs/server/telemetry) it prints.

## How it works [#how-it-works]

These pages explain the design. You do not need them to build and run the
server.

* [Architecture](/docs/server/how-it-works/architecture): the pipeline, its threads and queues.
* [Capture and sync](/docs/server/how-it-works/capture-and-sync), [GPU processing](/docs/server/how-it-works/gpu-processing)
  and [encoding](/docs/server/how-it-works/encoding): each stage in more detail.
* [Latency](/docs/server/how-it-works/latency): where the time goes and what the server does about it.
* [Setup state](/docs/server/how-it-works/setup-state): phases, revisions and the setup lease.

The wire contract between server and browser is `protocol/wire-format.md` in
the repository.
