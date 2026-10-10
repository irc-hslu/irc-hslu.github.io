# Check your browser (https://irc-hslu.github.io/orbbecstreamer/docs/client/browser-requirements)





The client needs three browser features to show point clouds. Without one of them, the client still connects to servers, shows their status and sets them up, but draws no point clouds.

| Feature                                                                                           | What the client uses it for                                          | Without it                                                                                    |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WebTransport                                                                                      | Connecting to a live server                                          | Adding a server fails to connect. Recordings still play.                                      |
| WebCodecs video decoding with HEVC Main (8-bit) and HEVC Main10 (10-bit), or the built-in decoder | Decoding the colour and depth video                                  | No point clouds. Setup and control still work.                                                |
| WebGPU, or WebGL2 as a fallback                                                                   | Drawing the point clouds. Blending overlapping cameras needs WebGPU. | Without either: no point clouds; setup and control still work. With WebGL2 only: no blending. |

HEVC is the video format the servers send. At startup the client also checks that your browser decodes it exactly, by decoding two tiny built-in streams and comparing the pixels with a known-good result. A channel that passes is decoded by the browser. A channel that fails is decoded by the client's own WebAssembly HEVC decoder, which runs in one background worker per stream; the client downloads it (about 1.1 MB, 0.37 MB compressed) only when a channel needs it. If that decoder can't load, the channel isn't decoded: the server's card says **Setup and control only** and names the missing HEVC decoding, and its point cloud isn't shown. The browser only turns these features on for secure pages: pages served over `https://`, or from `http://localhost`. The development server at `http://localhost:5173` counts as secure.

## Check what your browser supports [#check-what-your-browser-supports]

1. Start the client and open [http://localhost:5173/](http://localhost:5173/). See [Run the client](/docs/client/dev-build).
2. Read the chips in the header. Hover over a chip for its full sentence; a red or amber chip is also reached with **Tab**:
   * **WebGPU** or **WebGL2**: the 3D backend the client started
   * **WebCodecs**: the browser has WebCodecs. It doesn’t yet say whether it decodes HEVC.
3. If an **i** button follows the chips, select it for the renderer notes, for example `WebGPU not supported`.
4. Add a server or play a recording. If the browser can’t decode that server’s video, its card shows a **Setup and control only** chip.

<img alt="The header: OrbbecStreamer, v1.0, the theme button, and the green WebGPU and WebCodecs chips" src="__img0" />

With WebGL2, the **View** section reads `Blending needs WebGPU; with WebGL2 the nearest point is drawn.` When something is missing:

* **No WebGPU and no WebGL2**: a red **No 3D view** chip. Its tip reads `renderer: rendering-incompatible. Rendering incompatible: neither WebGPU nor WebGL2 is available. …`, and the decoder chip turns amber: `Decoding is off`.
* **No WebCodecs**: an amber decoder chip; its tip reads `decoders: WebCodecs VideoDecoder is unavailable: control and setup only.`
* **No HEVC decoding**: the card’s **Setup and control only** chip; its tip reads, for example, `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`

## Browsers tested so far [#browsers-tested-so-far]

Two browsers have been tested. Both report no HEVC decoding of their own, so both use the built-in decoder:

* Headless Chromium 153 on Linux.
* Desktop Google Chrome 155 on Ubuntu 26.04 with an NVIDIA RTX 4090 (2026-10-08). WebGPU and WebGL2 work, and H.264 and VP9 decode, but HEVC colour and Main10 depth do not. Chrome on Linux decodes HEVC through VA-API, and by default there is no VA-API driver for NVIDIA.

With Chrome's default settings on a Linux PC with an NVIDIA GPU, Chrome now shows the point cloud: the client decodes both channels with the built-in decoder. Measured on 2026-10-10 (Google Chrome 155, headless, on a shared PC, an `http://localhost` page, a real 640×576 colour and depth capture played from a recording at 15 frames per second): the built-in decoder is bit-exact against FFmpeg's decode for colour and depth (every 10th frame compared: 45 of each, on that capture and on a 1920×576 NVENC pair), the channels read `wasm / probe-inexact`, and every camera played at 15 frames per second with no dropped frame sets. The cost is CPU, and it depends on the video bitrate and on the CPU frequency setting. With 4 cameras at 15 frames per second (concatenated layout, Chrome 155, a PC with a load average of 14 to 25): clips at the lowest bitrate (about 0.7 Mbit/s colour and almost nothing for depth, per camera) used 0.13 cores in the decoder workers and 0.17 cores for the whole browser when the CPU governor was on `performance`, and 0.37 and 0.45 cores on `powersave`; mid-rate clips (4 and 1 Mbit/s) about 0.30 cores hot and 0.34 to 0.39 cold; the highest-rate real recordings (about 6 and 2 Mbit/s) about 0.36 cores hot and 0.41 to 0.45 cold, with no late and no dropped frame sets (colour p95 22 ms, depth p95 12 ms per frame). The per-camera layout costs 20 to 30 percent more decoder CPU. With the `powersave` governor a 15 fps stream arrives in bursts that run 2 to 4 times slower. A very high-rate clip (about 33 Mbit/s, 1920×576) costs far more: about 1.1 cores for one pair. A computer with fewer cores, or many cameras, may not keep up; the client then drops frames and shows the drops (`decoderOutputDropped` in `droppedFrameSets`). Hardware decoding is expected on Windows and macOS, but the team has not tested it, nor whether the depth frames can be read. With the nvidia-vaapi-driver package and Chrome started with `--enable-features=VaapiOnNvidiaGPUs`, Chrome 155 decodes HEVC in hardware, but the depth frames can't be read (the decoded 10-bit frames are opaque to the page), so the point cloud still doesn't appear. Tested 2026-10-08 on Ubuntu 26.04, RTX 4090, driver 580. Ubuntu's Chromium snap can't use the driver at all. The next test is Chrome or Edge on Windows, or Safari on macOS. The detailed results are on [Test the client](/docs/client/developer/test-the-client#browsers-tested-so-far).

## Fix browser problems [#fix-browser-problems]

These are the common browser problems and their fixes:

* **No 3D view on a desktop browser**: hardware acceleration may be off. Turn on **Use graphics acceleration when available** in the browser settings. In Chrome or Edge, open `chrome://gpu` to check the WebGL2 and WebGPU status.
* **Every server card says the browser lacks HEVC decoding**: this browser can't decode HEVC exactly, and the built-in decoder didn't load. Open the browser's console: a `[decode path]` warning reads `Depth/colour cannot be decoded in this browser: the built-in decoder failed to load (<reason>)`. The reason is `HTTP 404` when the decoder file is missing from the server, `…failed its integrity check…` when the file was changed, or `blocked by the page's content security policy` when the page's policy lacks `'wasm-unsafe-eval'` in `script-src`. Fix the cause and reload the page; the client doesn't try again until then. You can still use the client to set up servers.
* **Your server sets a content security policy**: the built-in decoder needs `script-src 'self' 'wasm-unsafe-eval'` and `worker-src 'self'`. It needs no other change, no cross-origin isolation headers and no `SharedArrayBuffer`.
* **Nothing works when you open the client from another computer**: plain `http://` pages are only secure on `localhost`. Open the client on the machine that runs it.
