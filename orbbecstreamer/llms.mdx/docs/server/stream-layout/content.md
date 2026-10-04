# Stream layout (https://irc-hslu.github.io/orbbecstreamer/docs/server/stream-layout)





The stream layout decides how the server packs several cameras into HEVC
(H.265) video streams. You set it once in the server config with
`encoding.session_mode`. Clients read it from the stream descriptors (the
server's description of each stream) and cannot change it.

| Config value (`encoding.session_mode`) | Wire value     | Result                                                        |
| -------------------------------------- | -------------- | ------------------------------------------------------------- |
| `concatenated_batch`                   | `concatenated` | All cameras tiled into one colour stream and one depth stream |
| `per_camera` (the code default)        | `per-camera`   | One colour stream and one depth stream per camera             |

The parser also accepts `concatenated` and `joint` for `concatenated_batch`,
and `separate` for `per_camera`. The development config
`server/config/dev/live.yaml` uses `concatenated_batch`.

The layout already shapes the encoder output, the debug recordings, `setup.json`
and the stream descriptors in the setup state; serving is not available yet.
What each layout means for a client is defined in `protocol/wire-format.md`
§5.

## What each layout produces [#what-each-layout-produces]

Both layouts encode the same synchronised multi-camera batches, and in both
colour and depth are separate HEVC streams. Colour is aligned into the depth
image, so a colour tile and a depth tile of one camera have the same size
(640 × 576 with the dev config).

### `concatenated_batch` [#concatenated_batch]

* Camera tiles are placed left to right, in camera order, into one colour
  surface and one depth surface of `(N × W) × H`. Two cameras at 640 × 576
  give 1280 × 576.
* Exactly two NVENC sessions (encoder instances on the GPU's hardware video
  encoder), one for colour and one for depth.
* One bundle (a colour and a depth frame that belong together) for the whole
  rig, with bundle id `multicam`. Its descriptors
  list the camera ids and each camera's tile rectangle.
* The encoder bitrate is the configured per-camera bitrate times N.
* All tiles must have the same size, and the camera set and order cannot
  change while the server runs.
* If a camera's processed frame is missing from a batch, the whole batch is
  skipped.

### `per_camera` [#per_camera]

* Each camera has its own colour stream and depth stream of `W × H`.
* Two NVENC sessions per camera, `2 × N` in total.
* One bundle per camera; the bundle id is the camera `id` from the config.
* Each encoder runs at the configured per-camera bitrate.
* A missing frame from one camera skips only that camera's frame.

## Trade-offs [#trade-offs]

|                       | `concatenated_batch`                                             | `per_camera`                                                                                                                 |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Browser decoders      | 2 in total                                                       | 2 per camera                                                                                                                 |
| NVENC sessions        | 2                                                                | 2 × N                                                                                                                        |
| Frame size per stream | Grows with N                                                     | Fixed at one camera                                                                                                          |
| HEVC level            | Higher; grows with N (see below)                                 | Lowest for the camera size                                                                                                   |
| Keyframes             | One IDR covers every camera, so a keyframe costs N tiles of bits | Independent per camera; a client that needs a keyframe for one camera does not force one on the others                       |
| Cross-camera sync     | Built in: one access unit holds every camera of a frame set      | One bundle per camera; each camera counts its own frame sets, so match cameras by capture timestamp, not by frame-set number |
| Missing camera frame  | The whole frame set is skipped                                   | Only that camera is skipped                                                                                                  |

**Decoders.** Browsers limit how many hardware video decoders can run at
once. Concatenated needs two whatever the camera count.

**HEVC level.** The level is the HEVC limit class for picture size, frame
rate and bitrate; a decoder states the highest level it supports. The server
chooses the lowest HEVC level whose picture size, sample rate and Main-tier
bitrate admit the stream, and configures the encoder with exactly that level
and Main tier, so the codec string the browser receives describes the
bitstream (a GPU test compares the two). It uses the whole surface and the
whole bitrate. With the dev profile (640 × 576 tiles streamed at 15 fps, 12 Mbit/s colour
and 8 Mbit/s depth per camera). The level depends on the stream rate
(`encoding.stream_fps`), not the capture rate:

| Cameras | Concatenated colour | Concatenated depth | Per-camera colour | Per-camera depth |
| ------- | ------------------- | ------------------ | ----------------- | ---------------- |
| 1       | 4.0                 | 3.1                | 4.0               | 3.1              |
| 2       | 5.0                 | 4.1                | 4.0               | 3.1              |
| 4       | 5.2                 | 5.1                | 4.0               | 3.1              |

The level is part of the codec string sent to the browser, for example
`hev1.1.6.L150.90` for level 5.0 colour. Check that the browser can decode
the level before adding cameras. At high bitrates the level is set by the
bitrate, not the picture size, so lowering `bitrate_bps` also lowers it.

**Width limit.** A concatenated surface is `N × W` wide. The NVENC HEVC
maximum is reported by the capability test and is 8192 × 8192 on current
GPUs, which allows 12 tiles of 640 pixels. Browser decoders may accept less.

**Keyframes.** A keyframe, or IDR frame, is a frame a decoder can start
from without earlier frames. Every stream starts with an IDR frame and
repeats one every `encoding.gop_length` frames (60 frames is 4 s at a
15 fps stream rate; `0` disables the period). The encoder can also force a keyframe on request, which serving
will use when a client joins or after it drops data for a slow client. Forced
keyframes for one bundle are at least
250 ms apart. Within a bundle, colour and depth are always keyframes on the
same frame set.

**Latency.** Both layouts encode each synchronised batch on one encoder
thread with the same low-latency settings: constant bitrate (CBR), a
one-frame buffer, no B-frames (frames that reference later frames) and no
look-ahead. Concatenated produces one larger frame per batch;
per-camera produces N smaller frames one after another. Measure your rig with
the latency log rather than assuming one is faster.

## Switch the layout [#switch-the-layout]

1. Edit `encoding.session_mode` in your config:

   ```yaml
   encoding:
     enabled: true
     session_mode: "per_camera"   # or "concatenated_batch"
   ```

2. Restart the server. The layout cannot change while it runs. From the
   `server/` folder:

   ```bash
   ./build/dev-debug/orbbec_streamer --live config/dev/live.yaml
   ```

## Expected result [#expected-result]

The start-up log shows the layout and the per-camera bitrates:

```text
[info] live encoding: enabled=true mode=concatenated_batch gpu=0 queue=2 gop=60 depth_quantization=linear depth_range_mm=[500,5000] profile_path='config/dev/depth-quantization.json' color_bitrate_per_camera=12000000 depth_bitrate_per_camera=8000000
```

After the cameras start, `debug/live/setup.json` contains
`"session_mode": "concatenated_batch"` or `"per_camera"`. With
`debug_recording.record_gpu_outputs: true`, encoded output is written to
`debug/live/multicam/` in concatenated mode and to
`debug/live/<camera id>/` in per-camera mode. Each output directory also gets
a `gpu-output-layout.json` that describes the surface and its tiles.

## Encoded bitstreams [#encoded-bitstreams]

This section describes how the server produces the bitstreams the wire
contract specifies. The contract `protocol/wire-format.md` is the normative
definition of the records, the stream descriptors and the depth
quantization.

**Colour**

* HEVC Main, 8-bit 4:2:0, `hev1` sample format; codec string
  `hev1.1.6.L<level>.90`.
* Input is the RGB8 frame after colour-to-depth alignment, converted on the
  GPU to NV12 (8-bit YUV 4:2:0), BT.709 limited range. The colour space is
  signalled in the VUI (video usability information) of the stream.
* Colour is not masked.

**Depth: `QuantizedP010V1`**

P010 is a 10-bit YUV 4:2:0 format that stores each sample in 16 bits.

* HEVC Main10, P010 4:2:0, `hev1`; codec string `hev1.2.4.L<level>.90`.
  Full range, no colour description in the VUI.
* Same tiling and size as colour. There is a single plane of codes; the
  surface height equals the image height.
* Luma holds one 10-bit code per depth pixel, stored as `code << 6` in the
  16-bit P010 sample. Chroma is neutral (`512 << 6`).
* The code is looked up from the active depth quantization profile (linear,
  or calibrated with the depth calibrator; see
  [Configuration](./configuration)). Pixels outside the foreground mask get
  code 0.
* Codes: `0` invalid or masked, `1` below `minimum_depth_mm`, `2..1022`
  valid depth, `1023` above `maximum_depth_mm`. Clients reconstruct
  millimetres only through the transmitted 1024-entry reconstruction LUT.
  The encode LUT never leaves the server.

One decoded depth frame from a two-camera rig in `concatenated_batch` mode
(1280 × 576: the first camera's tile on the left, the second on the right).
Valid codes are converted to millimetres with the reconstruction LUT and
coloured from blue (500 mm) to red (5000 mm). Code `0` is black, code `1`
(closer than 500 mm) is light grey, and code `1023` is mid grey. In this
frame the cameras face a desk: most of the view has no depth, and the desk
surface is closer than the 500 mm minimum.

<img alt="Decoded depth frame, two camera tiles side by side, coloured by distance with special codes in black and grey" src="__img0" />

**Both channels**

* The parameter sets (VPS, SPS and PPS: the headers a decoder needs to
  configure itself) are repeated in the stream on every IDR frame.
* The coded size equals the logical size; any encoder padding is removed
  through the SPS conformance window.

## Troubleshooting [#troubleshooting]

| Problem                                                                    | Fix                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Unsupported encoding session_mode: <value>`                               | Use `concatenated_batch` or `per_camera` (or an alias listed above).                                                                                                                                                        |
| `Concatenated NVENC requires identical camera geometries`                  | All cameras must use the same stream profile. They share `streams`, so check that every camera supports it.                                                                                                                 |
| `Concatenated camera order or geometry changed after NVENC initialization` | A camera dropped out or came back while running. Restart the server.                                                                                                                                                        |
| `Encoding: no HEVC level up to 6.2 admits ...` when the config loads       | The encoder surface or bitrate is too large for any Main-tier level (the server checks this at start-up, before opening cameras). Lower `bitrate_bps`, the resolution or fps, use fewer cameras, or switch to `per_camera`. |
| NVENC fails to open a session with many cameras in `per_camera`            | Consumer GeForce drivers cap concurrent NVENC sessions. Use `concatenated_batch`, which needs two.                                                                                                                          |
| The browser cannot decode the stream                                       | Compare the codec string's level with what the browser supports; lower the bitrate or the camera count, or use `per_camera`.                                                                                                |
