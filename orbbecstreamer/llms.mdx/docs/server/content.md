# Server (https://irc-hslu.github.io/orbbecstreamer/docs/server)



The server is one C++20/CUDA program, `orbbec_streamer`. It runs on a Linux machine with an NVIDIA GPU and one or more Orbbec RGB-D cameras. It captures colour and depth, processes the frames on the GPU and encodes them with NVENC, the NVIDIA hardware video encoder. Browsers connect over WebTransport. Today they get the control plane only; media streaming waits for a contract decision (see [Serve to browsers](/docs/server/serving)).

For each synchronised set of frames, the server:

1. captures colour and depth from all cameras at the same instant; with hardware sync, one camera triggers the others over a sync cable
2. aligns colour to depth in the Orbbec SDK, so each colour pixel matches the depth pixel at the same position
3. keeps 1 of every N batches when the capture rate is a multiple of the stream rate (for example capture at 30 fps, stream at 15)
4. computes a foreground mask and filters depth on the GPU
5. encodes colour as 8-bit HEVC Main and depth as 10-bit HEVC Main10 (HEVC is the H.265 video codec)

## Status [#status]

| Part                                                                               | State                                                                                                |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Multi-camera capture, hardware sync, timestamp offset tracking                     | Works (tested with 2 × Femto Bolt)                                                                   |
| Capture at 15 or 30 fps, stream at 15 or 30 fps                                    | Works; the dev config captures at 30 and streams at 15                                               |
| Colour-to-depth alignment (Orbbec SDK, CPU)                                        | Works                                                                                                |
| GPU segmentation and depth filtering                                               | Works; the RVM backend needs a TensorRT engine                                                       |
| NVENC colour and depth encoding, both [stream layouts](/docs/server/stream-layout) | Works                                                                                                |
| [Depth quantization calibrator](/docs/server/depth-quantization-calibrator)        | Works                                                                                                |
| [Camera pose calibration](/docs/server/camera-calibration)                         | Works on synthetic input; not yet validated with a printed board                                     |
| Debug recording and [terminal telemetry](/docs/server/telemetry)                   | Works                                                                                                |
| WebTransport gateway, session control, core-to-gateway IPC                         | Works behind `serving.enabled` (off by default); tested with native clients on loopback              |
| Media streaming to browsers                                                        | Not yet: the fan-out is wired, but no session receives media until change request CR 0009 is decided |

RVM (Robust Video Matting) is a neural network that separates people from the background. TensorRT is the NVIDIA runtime that runs it from a prebuilt engine file.

## Where to start [#where-to-start]

Follow these pages in order the first time:

1. [Requirements](/docs/server/requirements): check the GPU, Ubuntu 26.04 and the cameras on USB 3.
2. [Install](/docs/server/install): install the system packages, CUDA, TensorRT, the Orbbec SDK and vcpkg.
3. [Build and test](/docs/server/build): compile the server and run its tests.
4. [Configuration](/docs/server/configuration): write a config for your cameras and choose a [stream layout](/docs/server/stream-layout).
5. [Run the server](/docs/server/running), then [read the telemetry](/docs/server/telemetry).

## How it works [#how-it-works]

These pages explain the design. You don't need them to build and run the server.

* [Architecture](/docs/server/how-it-works/architecture): the pipeline, its threads and queues
* [Capture and sync](/docs/server/how-it-works/capture-and-sync), [GPU processing](/docs/server/how-it-works/gpu-processing) and [Encoding](/docs/server/how-it-works/encoding): each stage in detail
* [Latency](/docs/server/how-it-works/latency): where the time goes
* [Setup state](/docs/server/how-it-works/setup-state): phases, revisions and the setup lease

The wire contract between server and browser is `protocol/wire-format.md` in the repository. These pages describe how the server implements it and never replace it.
