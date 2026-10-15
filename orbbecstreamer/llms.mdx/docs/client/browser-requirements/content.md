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

<img alt="The header: OrbbecStreamer, the protocol version, the theme button, and the green WebGPU and WebCodecs chips" src="__img0" />

With WebGL2, the **View** section reads `Blending needs WebGPU; with WebGL2 the nearest point is drawn.` When something is missing:

* **No WebGPU and no WebGL2**: a red **No 3D view** chip. Its tip reads `renderer: rendering-incompatible. Rendering incompatible: neither WebGPU nor WebGL2 is available. …`, and the decoder chip turns amber: `Decoding is off`.
* **No WebCodecs**: an amber decoder chip; its tip reads `decoders: WebCodecs VideoDecoder is unavailable: control and setup only.`
* **No HEVC decoding**: the card’s **Setup and control only** chip; its tip reads, for example, `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`

## Browsers tested so far [#browsers-tested-so-far]

| Browser                                   | Status     | Decoder in use                                           | Expected limits (unverified rows are expectations, not results)                                 |
| ----------------------------------------- | ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Chrome for Testing 155, Linux, NVIDIA GPU | Verified   | Built-in (WASM HEVC)                                     | None found: WebTransport, WebGPU and WebGL2 work; Chrome has no HEVC decoding of its own here.  |
| Google Chrome or Microsoft Edge, Windows  | Not tested | Expected: the browser's own hardware HEVC, else built-in | Whether the 10-bit depth frames can be read is unknown; if not, the built-in decoder is needed. |
| Google Chrome or Microsoft Edge, macOS    | Not tested | Expected: the browser's own hardware HEVC, else built-in | As on Windows.                                                                                  |
| Firefox                                   | Not tested | Expected: built-in (no HEVC in WebCodecs)                | WebGPU depends on version and platform; WebGL2 fallback means no blending.                      |
| Safari                                    | Not tested | Expected: the browser's own HEVC, else built-in          | WebTransport support depends on the Safari version; without it only recordings play.            |

For a LAN viewer, the page and every server must be on `https:` with a certificate the browser trusts, or the server's certificate hash pinned (see [Add a server](/docs/client/add-a-server)).

Two browsers have been tested. Both report no HEVC decoding of their own, so both use the built-in decoder:

* Headless Chromium 153 on Linux.
* Desktop Google Chrome 155 on Ubuntu 26.04 with an NVIDIA RTX 4090 (2026-10-08). WebGPU and WebGL2 work, and H.264 and VP9 decode, but HEVC colour and Main10 depth do not. Chrome on Linux decodes HEVC through VA-API, and by default there is no VA-API driver for NVIDIA.

With Chrome's default settings on a Linux PC with an NVIDIA GPU, Chrome now shows the point cloud: the client decodes both channels with the built-in decoder. Measured on 2026-10-10 (Google Chrome 155, headless, on a shared PC, an `http://localhost` page, a real 640×576 colour and depth capture played from a recording at 15 frames per second): the built-in decoder is bit-exact against FFmpeg's decode for colour and depth (every 10th frame compared: 45 of each, on that capture and on a 1920×576 NVENC pair), the channels read `wasm / probe-inexact`, and every camera played at 15 frames per second with no dropped frame sets. The cost is CPU. It depends on the video bitrate and, above all, on the clock speed the system picks. Measured on 2026-10-10 and 2026-10-11 (Chrome for Testing 155, headless, an Intel i9-14900KF with the `powersave` governor), with 4 cameras at 15 frames per second at 0.7 Mbit/s colour per camera (the lowest rate seen on the rig), the decoder alone needs 0.16 cores at 5.7 GHz with warm caches. In the running app (load average 0.5 to 2.4) it used 0.53 cores with one concatenated stream and 0.80 cores with one stream per camera, while its CPUs ran at about 2.5 and 1.9 GHz (sampled, approximate): 1.4 to 1.8 times the warm-cache cost, and somewhat more with one stream per camera. So a PC with that setting may need around 0.5 to 0.9 cores for the decoder. These are estimates from a shared PC without capture or encoding running, not the release acceptance test. A computer with fewer or slower cores, or many cameras, may not keep up; the client then drops frames and shows the drops (`decoderOutputDropped` in `droppedFrameSets`). The method and all numbers are in `client/scripts/qa/README.md` (wasm-cpu). The GPU process no longer grows with the number of per-camera streams: measured on 2026-10-11 on the same PC (WebGPU, the same recordings, median of 3 runs, load average 3 to 9), it uses about 0.06 to 0.07 cores for 4 or 8 per-camera streams (it was 0.18 and 0.36 before), and 0.10 to 0.15 for one concatenated stream of 4 or 8 cameras (unchanged). The whole browser at 8 per-camera streams went from 1.38 to 0.83 cores. Hardware decoding is expected on Windows and macOS, but the team has not tested it, nor whether the depth frames can be read. With the nvidia-vaapi-driver package and Chrome started with `--enable-features=VaapiOnNvidiaGPUs`, Chrome 155 decodes HEVC in hardware, but the depth frames can't be read (the decoded 10-bit frames are opaque to the page), so the point cloud still doesn't appear. Tested 2026-10-08 on Ubuntu 26.04, RTX 4090, driver 580. Ubuntu's Chromium snap can't use the driver at all. The next test is Chrome or Edge on Windows, or Safari on macOS. The detailed results are on [Test the client](/docs/client/developer/test-the-client#browsers-tested-so-far).

## Fix browser problems [#fix-browser-problems]

These are the common browser problems and their fixes:

* **No 3D view on a desktop browser**: hardware acceleration may be off. Turn on **Use graphics acceleration when available** in the browser settings. In Chrome or Edge, open `chrome://gpu` to check the WebGL2 and WebGPU status.
* **Every server card says the browser lacks HEVC decoding**: this browser can't decode HEVC exactly, and the built-in decoder didn't load. Open the browser's console: a `[decode path]` warning reads `Depth/colour cannot be decoded in this browser: the built-in decoder failed to load (<reason>)`. The reason is `HTTP 404` when the decoder file is missing from the server, `…failed its integrity check…` when the file was changed, or `blocked by the page's content security policy` when the page's policy lacks `'wasm-unsafe-eval'` in `script-src`. Fix the cause and reload the page; the client doesn't try again until then. You can still use the client to set up servers.
* **A card says "Setup and control only: the picture 9000×576 is larger than the built-in decoder takes (max 8192 on a side, 3840×2160 area)"**: the built-in decoder takes pictures up to 8192 pixels on a side and 3840×2160 pixels in area (an 8-camera concatenated picture of 640×576 tiles is 5120×576 and fits). The card names the size the server announced; when the browser's own decoder was asked instead, it says "was refused by this browser's decoder (it may be too large)". The console also shows a `warn` line naming the bundle and channel. In the concatenated layout a server sends exactly one bundle, so 8 cameras mean one 5120-wide picture; a recording manifest with two bundles in the concatenated layout is refused with `Concatenated layout must expose exactly one bundle`.
* **Your server sets a content security policy**: the built-in decoder needs `script-src 'self' 'wasm-unsafe-eval'` and `worker-src 'self'`. It needs no other change, no cross-origin isolation headers and no `SharedArrayBuffer`.
* **Nothing works when you open the client from another computer**: plain `http://` pages are only secure on `localhost`. Open the client on the machine that runs it.
