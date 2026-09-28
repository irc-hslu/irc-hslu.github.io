# Browser requirements (https://irc-hslu.github.io/orbbecstreamer/docs/client/browser-requirements)



## What it is [#what-it-is]

The client uses three browser features. It still runs when one is missing,
but with less functionality. Following the protocol's compatibility rule
(§16), a browser that cannot decode or render remains a valid **control and
setup client**. It can connect and show server state, but it draws no point
clouds.

| Feature                                            | Used for                        | Without it                                                      |
| -------------------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| WebTransport                                       | The connection to a live server | Adding a server by URL fails to connect. Recordings still play. |
| WebCodecs `VideoDecoder` with HEVC Main (8-bit)    | Colour streams                  | Control and setup only: no point clouds                         |
| WebCodecs `VideoDecoder` with HEVC Main10 (10-bit) | Depth streams                   | Control and setup only: no point clouds                         |
| WebGPU, or WebGL2 as fallback                      | Drawing the point clouds        | `rendering-incompatible`; control and setup only                |

All of these need a **secure context**: `https://`, or `http://localhost`.
The dev server listens on `http://localhost:5173`, which counts as secure.

## How to check your browser [#how-to-check-your-browser]

1. Start the dev build (see [Run the dev build](/docs/client/dev-build)).
2. Open [http://localhost:5173/](http://localhost:5173/).
3. Read the top of the side panel:
   * `renderer: webgpu` or `renderer: webgl2` names the backend that was
     created.
   * `decoders: WebCodecs` means the WebCodecs decoder exists. It does not
     yet mean that HEVC is supported.
4. Add a server or open a recording. HEVC support is probed when the
   connection opens. A compatibility line on the server card means a
   channel cannot be decoded (see
   [Read the server card](/docs/client/server-card)).

## Expected result [#expected-result]

On a fully capable browser, the panel shows `renderer: webgpu` (or
`webgl2`) and `decoders: WebCodecs`. Server cards show no compatibility line.

With something missing, the panel shows one of these, verbatim:

* **No WebGPU and no WebGL2:**
  `renderer: rendering-incompatible. Rendering incompatible: neither WebGPU nor WebGL2 is available. This browser can still connect as a control and setup client (§16); no point clouds are drawn.`
  * The decoders line then reads: `Decoding is off: nothing could be drawn without a rendering backend (§16). client.hello still reports this browser's HEVC support.`
  * The client still tells each server which HEVC profiles this browser
    can decode, but it creates no decoder.
* **No WebCodecs:** `decoders: WebCodecs VideoDecoder is unavailable: control and setup only (§16).`
* **HEVC not supported for a channel:** the server card shows a line such as
  `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`

## Known results [#known-results]

These were observed on the project's test machine. Other browsers have not
been tested yet.

* **Headless Chromium 153 (snap) on Linux, over SSH, 2026-09-23:**
  * WebCodecs works; H.264, VP9 and AV1 decode in software.
  * No hardware video decoding is available.
  * HEVC is reported unsupported for both colour and depth, in every
    hardware-acceleration mode, even with the VA-API flags.
  * The client therefore connects and stays control-only. This is why the
    wiring and latency check pages use a synthetic decoder. The decode
    check uses real WebCodecs, and so reports the missing support.
* **Real HEVC decoding in a browser has not been verified yet.**
  * The next test is desktop Chrome or Edge with GPU video decode, or
    Safari.
  * It is tracked in `client/docs/development/ROADMAP.md` under
    "Phase 2 — media and rendering" ("Check with real decoded HEVC frames in
    a browser").
* **Rendering in headless Chromium with SwiftShader:**
  * WebGL2 works.
  * WebGPU works with `--enable-unsafe-webgpu`.
  * WebGPU failed with a lost device on 2026-09-24, while about 20 stray
    headless Chromium instances were running on the same machine. After
    they were closed, the wiring check passed on WebGPU (see the roadmap
    item "Wiring check on WebGPU"). Headless WebGPU on SwiftShader is
    sensitive to machine load.

## Troubleshooting [#troubleshooting]

* **`rendering-incompatible` on a desktop browser:** hardware acceleration
  may be off. Turn on "Use graphics acceleration when available" in
  the browser settings, then check `chrome://gpu` (Chrome or Edge) for
  WebGL2 and WebGPU status.
* **Every server card says the browser lacks HEVC decoding:** the browser has no
  HEVC decoder for this platform. Try another browser or machine with GPU
  video decoding. The client still works for control and setup.
* **Nothing works when opened from another machine by IP address:**
  plain `http://` is only a secure context on `localhost`. The page must
  be served over HTTPS with a certificate that machine trusts; the
  repository has no HTTPS dev configuration yet.
* **`renderer notes` in the panel:** expand them. They say why WebGPU was
  skipped, for example `WebGPU not supported`.
