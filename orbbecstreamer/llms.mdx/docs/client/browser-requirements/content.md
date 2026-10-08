# Check your browser (https://irc-hslu.github.io/orbbecstreamer/docs/client/browser-requirements)





The client needs three browser features to show point clouds. Without one of them, the client still connects to servers, shows their status and sets them up, but draws no point clouds.

| Feature                                                                  | What the client uses it for                                          | Without it                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WebTransport                                                             | Connecting to a live server                                          | Adding a server fails to connect. Recordings still play.                                      |
| WebCodecs video decoding with HEVC Main (8-bit) and HEVC Main10 (10-bit) | Decoding the colour and depth video                                  | No point clouds. Setup and control still work.                                                |
| WebGPU, or WebGL2 as a fallback                                          | Drawing the point clouds. Blending overlapping cameras needs WebGPU. | Without either: no point clouds; setup and control still work. With WebGL2 only: no blending. |

HEVC is the video format the servers send. The browser only turns these features on for secure pages: pages served over `https://`, or from `http://localhost`. The development server at `http://localhost:5173` counts as secure.

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

Nobody has confirmed HEVC decoding in any browser yet. Two browsers have been tested, and both report no HEVC decoding:

* Headless Chromium 153 on Linux.
* Desktop Google Chrome 155 on Ubuntu 26.04 with an NVIDIA RTX 4090 (2026-10-08). WebGPU and WebGL2 work, and H.264, VP9 and AV1 decode, but HEVC colour and Main10 depth do not. Chrome on Linux decodes HEVC through VA-API, and by default there is no VA-API driver for NVIDIA.

With Chrome's default settings on a Linux PC with an NVIDIA GPU, Chrome shows the cards and the setup workspace but no point cloud (**Setup and control only**). Use a Windows or macOS viewer instead. HEVC decoding is expected there, but the team hasn't tested it, nor whether the depth frames can be read. With the nvidia-vaapi-driver package and Chrome started with `--enable-features=VaapiOnNvidiaGPUs`, Chrome 155 decodes HEVC in hardware, but the depth frames can't be read (the decoded 10-bit frames are opaque to the page), so the point cloud still doesn't appear. Tested 2026-10-08 on Ubuntu 26.04, RTX 4090, driver 580. Ubuntu's Chromium snap can't use the driver at all. The next test is Chrome or Edge on Windows, or Safari on macOS. The detailed results are on [Test the client](/docs/client/developer/test-the-client#browsers-tested-so-far).

## Fix browser problems [#fix-browser-problems]

These are the common browser problems and their fixes:

* **No 3D view on a desktop browser**: hardware acceleration may be off. Turn on **Use graphics acceleration when available** in the browser settings. In Chrome or Edge, open `chrome://gpu` to check the WebGL2 and WebGPU status.
* **Every server card says the browser lacks HEVC decoding**: this browser has no HEVC decoder on this machine. Try another browser, or a machine with GPU video decoding. You can still use the client to set up servers.
* **Nothing works when you open the client from another computer**: plain `http://` pages are only secure on `localhost`. Open the client on the machine that runs it.
