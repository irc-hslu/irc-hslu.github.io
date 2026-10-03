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
2. Read the lines at the top of the side panel:
   * `renderer: webgpu` or `renderer: webgl2` names the 3D backend the client started.
   * `decoders: WebCodecs` means the browser has WebCodecs. It doesn’t yet say whether it can decode HEVC.
3. If a **renderer notes** line appears under them, select it to see why the client picked its backend, for example `WebGPU not supported`.
4. Add a server or play a recording. The client checks HEVC support when the connection opens. If the browser can’t decode the server’s video, the server card shows a line that starts with `Setup and control only`.

## What you should see [#what-you-should-see]

On a browser that can do everything, the panel shows `renderer: webgpu` or `renderer: webgl2`, then `decoders: WebCodecs`, and server cards show no `Setup and control only` line.

<img alt="The top of the side panel: OrbbecStreamer client, protocol v1.0, renderer webgpu and decoders WebCodecs" src="__img0" />

With WebGL2, a **renderer notes** line follows, for example with `WebGPU not supported` and `desynchronized (low-latency) canvas granted`, and the **View** section reads `Blending needs WebGPU; with WebGL2 the nearest point is drawn.`

When something is missing, you see one of these messages:

* **No WebGPU and no WebGL2**: the panel shows `renderer: rendering-incompatible. Rendering incompatible: neither WebGPU nor WebGL2 is available. This browser can still connect as a control and setup client; no point clouds are drawn.` The next line starts with `decoders: Decoding is off: nothing could be drawn without a rendering backend.`
* **No WebCodecs**: the panel shows `decoders: WebCodecs VideoDecoder is unavailable: control and setup only.`
* **No HEVC decoding**: the server card shows, for example, `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`

## Browsers tested so far [#browsers-tested-so-far]

Nobody has confirmed HEVC decoding in any browser yet. The only browser the team has tested is headless Chromium 153 on Linux, and it reports no HEVC decoding. The next test is desktop Chrome or Edge with GPU video decoding, or Safari. The detailed results are on [Test the client](/docs/client/developer/test-the-client#browsers-tested-so-far).

## Fix browser problems [#fix-browser-problems]

These are the common browser problems and their fixes:

* **`rendering-incompatible` on a desktop browser**: hardware acceleration may be off. Turn on **Use graphics acceleration when available** in the browser settings. In Chrome or Edge, open `chrome://gpu` to check the WebGL2 and WebGPU status.
* **Every server card says the browser lacks HEVC decoding**: this browser has no HEVC decoder on this machine. Try another browser, or a machine with GPU video decoding. You can still use the client to set up servers.
* **Nothing works when you open the client from another computer**: plain `http://` pages are only secure on `localhost`. Open the client on the machine that runs it.
