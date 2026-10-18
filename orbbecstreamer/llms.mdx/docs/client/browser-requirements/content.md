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

* **WebGPU that can't draw**: the client uses WebGL2 and says why in an amber notice. See [When WebGPU can't draw](#when-webgpu-cant-draw).
* **No WebGPU and no WebGL2**: a red **No 3D view** chip. Its tip reads `renderer: rendering-incompatible. Rendering incompatible: neither WebGPU nor WebGL2 is available. …`, and the decoder chip turns amber: `Decoding is off`.
* **No WebCodecs**: an amber decoder chip; its tip reads `decoders: WebCodecs VideoDecoder is unavailable: control and setup only.`
* **No HEVC decoding**: the card’s **Setup and control only** chip; its tip reads, for example, `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`

## When WebGPU can't draw [#when-webgpu-cant-draw]

Some browsers offer WebGPU that runs only in software, or that stops as soon as it draws its first frame. One example is Chrome on Linux with an NVIDIA GPU, started without the Vulkan flags. At startup the client checks this: it draws one frame with WebGPU and makes sure the GPU survives it. If WebGPU fails that check, the client uses WebGL2, and an amber notice under the header chips says which case it was:

* **WebGPU runs only in software in this browser, so the 3D view uses WebGL2 (no blending).**
* **WebGPU did not work in this browser, so the 3D view uses WebGL2 (no blending).**

Each notice ends with a **What to do** link to this section. The **i** button after the chips lists the details, for example `the WebGPU device was lost at its first frame (Device was destroyed.)`. A hardware GPU whose first frame fails gets one more try after half a second before the client switches to WebGL2.

If the GPU stops while you're watching and doesn't recover within 5 seconds, the same place shows **The GPU stopped responding and did not recover, so nothing is drawn. Reload the page to start the 3D view again.** After the reload the client runs its startup check again.

To get WebGPU and blending back:

1. In Chrome or Edge, open `chrome://gpu` and check the **WebGPU** line.
2. On Linux with an NVIDIA GPU, start Chrome with `--use-angle=vulkan --enable-features=Vulkan`. WebGPU then runs on the GPU.
3. Reload the client. The header chip says **WebGPU** and the notice is gone.

In 0.1.2 and earlier, the client stayed on WebGPU in this case: no point cloud appeared, **Dropped** counted every pair, and the **View** section kept saying `Preparing blending… plain points meanwhile.`

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

## Minimum viewer hardware [#minimum-viewer-hardware]

This minimum is provisional; measured on stand-ins, not on real low-end PCs:

* A CPU with 4 cores and 8 threads at 3.0 GHz or faster
* 8 GB of RAM
* A GPU that supports WebGL2
* A current version of Chrome or Edge
* A wired 1 Gbit/s Ethernet connection

The stand-ins ran on one PC (Intel i9-14900KF, RTX 4090), with Chrome for Testing 155 limited to 4 of its CPU threads. Each camera sent a 640×576 colour stream and a 640×576 depth stream at 15 frames per second, decoded by the client's built-in decoder. Every camera played the same content: either a recording of one real camera (colour 2.67 Mbit/s, depth 0.11 Mbit/s) or a synthetic test pattern (colour 2.61 Mbit/s, depth 2.92 Mbit/s). These are not live cameras: a lit, busy live scene costs more to decode. An unrelated job used the GPU (about 80 %) and about 5 CPU cores during every run, so the numbers are pessimistic. Measured on 2026-10-18 between 03:22 and 03:59 UTC, 2 runs each:

| Stand-in for                                            | CPU threads | Cameras | Decoder p95, slower channel (ms) | Dropped | Decoder CPU (cores) | Whole browser (cores) |
| ------------------------------------------------------- | ----------- | ------- | -------------------------------- | ------- | ------------------- | --------------------- |
| 4 cores / 8 threads (2 fast cores with hyper-threading) | 4           | 4       | 3.6                              | 0       | 0.25                | 0.43                  |
| 4 cores / 8 threads, synthetic test pattern             | 4           | 4       | 5.5                              | 0       | 0.40                | 0.57                  |
| 4 cores / 8 threads                                     | 4           | 8       | 5.0                              | 0       | 0.58                | 0.84                  |
| 4 cores / 8 threads, synthetic test pattern             | 4           | 8       | 6.4                              | 0       | 0.84                | 1.10                  |
| Slow CPU (4 efficiency cores, up to 4.4 GHz)            | 4           | 8       | 5.4                              | 0       | 0.67                | 1.06                  |
| Slow main thread (4 threads, main thread slowed 4×)     | 4           | 4       | 4.4                              | 0       | 0.28                | 1.21                  |
| WebGL2 instead of WebGPU, same GPU                      | 4           | 8       | 5.7                              | 0       | 0.59                | 1.00                  |

Every configuration kept 15 frames per second on every camera, with no dropped frame sets. The WebGL2 row runs on the same RTX 4090: it tests the WebGL2 code path, not a weak GPU, which can't be emulated. The client tells servers it can run up to 16 decoders at once (8 cameras). That is the most the measurements tested, not a measured CPU limit, and it was measured on stand-in cores on a PC with an RTX 4090 under unrelated background load. It still reports pictures up to 4096×4096. With the built-in decoder, a picture larger than 3840×2160 in area is refused as soon as the server announces it, before any video arrives, and the card says **Setup and control only** with the reason (see [Fix browser problems](#fix-browser-problems)). A limit of 5120×1152 has been derived from the measured decode cost, but it was not measured directly; it will be checked with real multi-camera pictures before it changes. The full results are in `client/scripts/qa/perf/results/2026-10-18-viewer-floor/`.

## Fix browser problems [#fix-browser-problems]

These are the common browser problems and their fixes:

* **No 3D view on a desktop browser**: hardware acceleration may be off. Turn on **Use graphics acceleration when available** in the browser settings. In Chrome or Edge, open `chrome://gpu` to check the WebGL2 and WebGPU status.
* **Points don't blend and a notice says WebGPU did not work**: see [When WebGPU can't draw](#when-webgpu-cant-draw).
* **A camera's video stops decoding in the browser**: if the browser's own decoder fails on one stream, or keeps giving depth frames without 10-bit values, the client moves that stream to the built-in decoder. The stream keeps going from its next keyframe. Other cameras keep the browser's decoder, and the next stream of the same camera tries the browser's decoder again. Only when streams from two different cameras or servers fail does the client use the built-in decoder for that channel for the rest of the page's life. The console shows `[decode path]` warnings such as `Decode path: one depth stream switched to the built-in decoder (WebCodecs decoder failed; …)`. If the built-in decoder can't load either, the card shows **1 bundle off · decoder failed**.
* **Every server card says the browser lacks HEVC decoding**: this browser can't decode HEVC exactly, and the built-in decoder didn't load. Open the browser's console: a `[decode path]` warning reads `Depth/colour cannot be decoded in this browser: the built-in decoder failed to load (<reason>)`. The reason is `HTTP 404` when the decoder file is missing from the server, `…failed its integrity check…` when the file was changed, or `blocked by the page's content security policy` when the page's policy lacks `'wasm-unsafe-eval'` in `script-src`. Fix the cause and reload the page; the client doesn't try again until then. You can still use the client to set up servers.
* **A card says "Setup and control only: the picture 9000×576 is larger than the built-in decoder takes (max 8192 on a side, 3840×2160 area)"**: the built-in decoder takes pictures up to 8192 pixels on a side and 3840×2160 pixels in area (an 8-camera concatenated picture of 640×576 tiles is 5120×576 and fits). The card names the size the server announced; when the browser's own decoder was asked instead, it says "was refused by this browser's decoder (it may be too large)". The console also shows a `warn` line naming the bundle and channel. In the concatenated layout a server sends exactly one bundle, so 8 cameras mean one 5120-wide picture; a recording manifest with two bundles in the concatenated layout is refused with `Concatenated layout must expose exactly one bundle`.
* **Your server sets a content security policy**: the built-in decoder needs `script-src 'self' 'wasm-unsafe-eval'` and `worker-src 'self'`. It needs no other change, no cross-origin isolation headers and no `SharedArrayBuffer`.
* **Nothing works when you open the client from another computer**: plain `http://` pages are only secure on `localhost`. Open the client on the machine that runs it. A packaged install can also serve viewers on the LAN over HTTPS, on port 8443. See [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan).
