# How the server works (https://irc-hslu.github.io/orbbecstreamer/docs/server/architecture)



`orbbec_streamer --live` runs one pipeline: it captures synchronised colour
and depth from every camera, groups them into multi-camera batches, copies
them to the GPU, masks and filters them, encodes colour and depth with
NVENC and hands each encoded bundle to its consumer. This page shows how
the parts fit together. The details are on
[Capture and synchronisation](./capture-and-sync),
[GPU processing](./gpu-processing) and [Stream layout](./stream-layout).
The code is in `server/src/app/live/LiveApp.cpp`.

## The pipeline [#the-pipeline]

```text
camera 0 --> SDK --> capture thread 0 --+
camera 1 --> SDK --> capture thread 1 --+
                                        v
                                  frame batcher ---------> calibration tap (only during a run)
                                        |
                          upload queue (2, latest wins)
                                        v
                                  upload thread ---------> debug GPU-input recorder (optional)
                                        |
                        processing queue (2, latest wins)
                                        v
                                processing thread -------> preview thread (optional)
                                        |
            encode queue (encoding.queue_capacity, latest wins)
                                        v
                              encode thread (NVENC)
                                        |
                                        v
     hand-off --> latency telemetry, debug output recorder, network serving (planned)
```

The batcher has no thread of its own: it runs on the capture thread whose
frame set completes a batch, and that thread also pushes the batch into the
upload queue.

1. **Capture.** Each camera has one capture thread. It takes a colour +
   depth frame set from the Orbbec SDK, aligns colour to depth (in the SDK,
   on the CPU) and passes the frame set to the batcher.
2. **Batching.** The frame batcher waits until every camera has a frame set
   whose capture timestamps lie within `sync.timestamp_tolerance_us`, then
   emits one batch. The batch always holds one frame set per camera, in
   config order.
3. **Upload.** The upload thread copies each frame into pinned host memory
   and starts an asynchronous copy to the GPU.
4. **GPU processing.** The processing thread computes the foreground mask
   and filters depth, then hands the batch to the encoder.
5. **Encoding.** The encode thread converts colour to NV12 and depth to
   10-bit codes, encodes both with NVENC and builds an encoded bundle: one
   per batch in `concatenated_batch` mode, one per camera in `per_camera`
   mode ([Stream layout](./stream-layout)).
6. **Hand-off.** The bundle is recorded for the latency telemetry and passed
   to the debug recorder when output recording is on. This is where the
   network server will take it.

## Threads and ownership [#threads-and-ownership]

| Thread                                          | Owns                                                                                | Never waits for                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Capture, one per camera                         | The camera's SDK pipeline, CPU alignment, the frame batcher (shared, behind a lock) | Upload: it only pushes into the upload queue           |
| Upload                                          | Pinned staging buffers and the upload CUDA stream                                   | Processing                                             |
| Processing                                      | The processing CUDA stream, the RVM TensorRT engine, masks and filtered depth       | Encoding, preview, debug recording                     |
| Encode                                          | The NVENC sessions (2, or 2 per camera) and their CUDA stream                       | Its consumers                                          |
| Preview (with `run.preview`)                    | The OpenCV window                                                                   | Nothing upstream waits for it                          |
| Debug recorder, two workers (with recording on) | FFV1 writers, local HEVC decoders, disk                                             | Nothing upstream waits for it                          |
| Camera-pose calibration worker                  | ChArUco detection and the pose solver                                               | Capture hands it references only while a run is active |
| Main                                            | Start-up, stop, the 1 s telemetry loop, setup-lease expiry                          | -                                                      |

An error in the upload, processing, encode or preview thread (for example a
CUDA or NVENC failure) stops the whole server: the main loop sees it within
a second, stops capture and every stage, and exits with
`orbbec-streamer failed: <reason>`. See
[Run the server](./running#stop-the-server). A debug-recorder error only
disables the recorder (`worker=failed` in the telemetry). A camera error
ends that camera's capture thread, and the main loop then stops the server
with `camera capture stopped: ...`; see
[Capture and synchronisation](./capture-and-sync#limits-and-guarantees).

## Bounded queues [#bounded-queues]

Every hand-off between threads goes through a short queue with a fixed
capacity. None of them can grow:

| Queue                 | Capacity                                     | When full                     |
| --------------------- | -------------------------------------------- | ----------------------------- |
| Upload                | 2 batches (fixed)                            | Drops the oldest queued batch |
| Processing            | 2 batches (fixed)                            | Drops the oldest queued batch |
| Encode                | `encoding.queue_capacity` (default 2)        | Drops the oldest queued batch |
| Preview               | 1 batch, taken only when the preview is idle | Not offered                   |
| Debug GPU inputs      | 1 batch                                      | Drops the new batch           |
| Debug encoded outputs | 8 bundles                                    | Drops the new bundle          |

"Latest wins": after a stall the next stage continues with the newest
frames, not a backlog. Each queued batch keeps its GPU upload slots until
the encoder is done with it, so the number of slots is computed from these
capacities at start-up (41 with `config/dev/live.yaml`). If they still run
out, the new batch is dropped and counted; the server keeps running. The
drop counters and warnings are explained in
[Read the telemetry](./telemetry#rate-tables).

A slow consumer at the end (preview, disk, and later a network client)
cannot block capture, GPU processing or NVENC.

## Side paths [#side-paths]

| Side path                          | Taps                                                                                          | Cost to the hot path                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Live preview (`run.preview`)       | The processed batch, after the encode enqueue                                                 | Shares GPU buffers (no copy), holds one upload slot. Measured side path: a few microseconds.        |
| Debug recorder (`debug_recording`) | GPU inputs after upload; encoded bundles after hand-off                                       | Non-blocking push; drops when the disk or decoder falls behind                                      |
| Calibration tap                    | Capture batches, only while a camera-pose calibration runs (today: `--calibrate-camera-pose`) | Copies frame references (no pixels) and never waits; see [Camera calibration](./camera-calibration) |
| Setup service                      | Builds the setup state after the cameras start; checks the setup lease once a second          | Not on the frame path                                                                               |

## Clock domains [#clock-domains]

| Where                                                        | Clock                                                                                                                                  | Unit                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Camera                                                       | The camera's device clock                                                                                                              | -                     |
| Capture timestamp (`capture_timestamp_ns` inside the server) | The SDK's global timestamp: the device clock mapped to the host clock. Every camera's clock is re-synchronised to the host every 60 s. | ns (the SDK gives µs) |
| Stage stamps, latency telemetry, lease timers                | `std::chrono::steady_clock`                                                                                                            | ns                    |
| Wire (`protocol/wire-format.md`)                             | Server monotonic time (steady clock)                                                                                                   | µs, u64               |

The frame set's capture timestamp is its depth frame's global timestamp; a
batch's timestamp is the latest one of its cameras. The server converts
capture timestamps to the steady clock with one offset, measured once per
process. A step in the system clock while the server runs (not a gradual
NTP adjustment) therefore shifts converted timestamps until restart. The
conversion to wire microseconds exists and is tested, but nothing sends it
yet.

## What leaves the server [#what-leaves-the-server]

| Output                                                                                    | Status                                                                |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Encoded bundles (colour + depth HEVC access units, camera tiles, depth quantization info) | Produced; handed to the debug recorder only                           |
| `setup.json` in `debug_recording.directory`                                               | Written at every start. A local debug file, not the client protocol   |
| Setup state (cameras, intrinsics, stream descriptors, calibration revision)               | Built in the process for the planned session layer                    |
| WebTransport sessions to browsers                                                         | Not available yet; see [Serve to browsers](./serving)                 |
| On-demand keyframes for joining or recovering clients                                     | The encoder supports them; nothing requests them until serving exists |

## Related pages [#related-pages]

* [Capture and synchronisation](./capture-and-sync)
* [GPU processing](./gpu-processing)
* [Encoding](./encoding)
* [Stream layout](./stream-layout)
* [Latency](./latency)
* [Setup state](./setup-state)
* [Read the telemetry](./telemetry)
* [Configuration](./configuration)
