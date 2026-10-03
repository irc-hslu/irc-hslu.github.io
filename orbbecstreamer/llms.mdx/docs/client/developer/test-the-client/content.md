# Test the client (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/test-the-client)



The client has three command-line checks (type check, unit tests and build) and seven dev check pages that run real parts of the client in a browser. This page also records which browsers have been tested and what they could do.

## Run the checks [#run-the-checks]

Run these in the `client` folder, after `npm ci` (see [Run the client](/docs/client/dev-build)):

| Command                   | What it does                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run typecheck`       | TypeScript check, no output files                                                          |
| `npm test`                | All unit tests (Vitest, in Node.js)                                                        |
| `npm run test:watch`      | The unit tests in watch mode                                                               |
| `npm run build`           | Type check, then production build into `client/dist/`                                      |
| `npm run preview`         | Serve `client/dist/` at [http://localhost:4173/](http://localhost:4173/)                   |
| `npm run bench:e2e`       | Media-path benchmark in Node.js; see [Latency measurement](/docs/client/developer/latency) |
| `npm run protocol:export` | Export the protocol schema and test vectors to `../protocol`                               |

Without npm, run the same tools directly in the `client` folder:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

## Open the dev check pages [#open-the-dev-check-pages]

The development server (`npm run dev` in `client`) also serves check pages from `client/dev/`. They’re never part of the production build. Each page runs a real part of the client and writes a report.

| Page                                                                                             | What it checks                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [http://localhost:5173/dev/decode-check.html](http://localhost:5173/dev/decode-check.html)       | WebCodecs HEVC support, and real decoding of a recording                                                            |
| [http://localhost:5173/dev/render-check.html](http://localhost:5173/dev/render-check.html)       | The renderer, with a synthetic two-camera scene                                                                     |
| [http://localhost:5173/dev/wiring-check.html](http://localhost:5173/dev/wiring-check.html)       | The full client with two recordings side by side and a synthetic decoder                                            |
| [http://localhost:5173/dev/latency-check.html](http://localhost:5173/dev/latency-check.html)     | Time spent per stage; see [Latency measurement](/docs/client/developer/latency)                                     |
| [http://localhost:5173/dev/cards-check.html](http://localhost:5173/dev/cards-check.html)         | Server cards with two clients of one mock server; see [Cards check](/docs/client/developer/cards-check)             |
| [http://localhost:5173/dev/setup-check.html](http://localhost:5173/dev/setup-check.html)         | The setup view through a scripted calibration; see [Setup check](/docs/client/developer/setup-check)                |
| [http://localhost:5173/dev/placement-check.html](http://localhost:5173/dev/placement-check.html) | Placement editing and world anchors with two clients; see [Placement check](/docs/client/developer/placement-check) |

To run a page without clicking, add a query parameter:

* `?autorun=1` for the render, wiring, latency, cards, setup and placement checks
* `?autorun=samples` for the decode check
* `?engine=webgl2` or `?engine=webgpu` to force a backend, where the page supports it

Each page sets `body[data-state]` to `done` or `failed` and puts its report on `window`, for example `window.__wiringCheckReport`. The wiring check’s `?readback=1` draws the read-back frame into an overlay, for headless screenshots that miss a WebGPU canvas. Its report JSON sits in a collapsed **report JSON** panel at the bottom right.

Page options beyond `autorun` and `engine`:

* **Decode check**: `autorun=samples` (or `autorun=bundled`) starts with the sample recordings; `color=<url>` and `depth=<url>` replace their URLs; without `autorun`, you can choose files. It needs a browser that can decode HEVC; without it, it ends `failed` with “no HEVC configuration is supported”.
* **Render check**: `frames=N` (default 90); `debug=1` draws below-range codes blue and above-range codes red; `readback=1` paints the read-back frame into an overlay after the run. It uses a synthetic two-camera bundle and needs no files. Point options: `pointSize=N` sets the point size in device pixels (default 2); `sizeMode=world` sizes each point by its depth pixel's footprint as seen from the camera (default `sizeMode=screen`), scaled by `worldScale=F` (default 1.5) and capped by `maxSize=N` (default 16); `shape=round` draws round points (default `shape=square`); `radius=M` puts the camera M metres from its target (default 3). Blend options (WebGPU only; the defaults are those of the **View** section, see [Blend overlapping cameras](/docs/client/viewer#blend-overlapping-cameras)): `blend=0` starts with blending off; `compute=0` keeps the plain WebGPU dots without the blending path; `angularExponent=F`, `depthTolerance=M`, `depthToleranceRatio=F`, `edgeWidth=N`, `edgeStep=F`, `noiseReference=M`, `grazingFloor=F` and `kernelSharpness=F` set the tuning values; `tint=1` tints the left camera red and the right camera blue, so that the blend across their overlap is visible. A **Blend (WebGPU)** checkbox at the top right switches blending while the page runs. The status overlay and the report’s `drawPath` say how points are drawn (`compute-blend`, `compute-nearest`, `babylon-quads` or `babylon-points`). On WebGPU, `done` also needs the blending path ready, unless `compute=0`.
* **Wiring check**: `readback=1`. `done` needs both recordings connected, pairs uploaded, and drawn points in both halves of the read-back.

### Sample recordings [#sample-recordings]

The decode, wiring and latency checks load sample recordings from `client/reference/hevc-web/` (`gpu-output-color.hevc`, `gpu-output-depth.hevc` and, optionally, `public/hevcsetup.json`). These recordings aren’t published and aren’t in the repository, so these checks only run where a local copy exists. The mock server in the app and the cards, setup and placement checks work without them, as snapshot-only.

Without the recordings, the decode check fails at once with a missing file. The wiring and latency checks fail only after about 30 seconds with “no pair uploaded”, because the dev server answers a missing `.hevc` path with its HTML page instead of a 404. The decode check also accepts files you choose.

## Browsers tested so far [#browsers-tested-so-far]

These are the recorded results so far. Other browsers haven’t been tested yet.

* **Headless Chromium 153 on Linux, 2026-09-23**:
  * WebCodecs works; H.264, VP9 and AV1 decode in software.
  * No hardware video decoding is available.
  * HEVC is reported unsupported for colour and depth in every hardware-acceleration mode, even with the VA-API flags.
  * The client connects and stays control-only. That’s why the wiring and latency checks use a synthetic decoder. The decode check uses real WebCodecs, so it reports the missing support.
* **Real HEVC decoding in a browser hasn’t been verified yet.** The next test is desktop Chrome or Edge with GPU video decoding, or Safari. It’s tracked in `client/docs/development/ROADMAP.md` as “Check with real decoded HEVC frames in a browser”, under Phase 2.
* **Rendering in headless Chromium with SwiftShader**: WebGL2 works. WebGPU works with `--enable-unsafe-webgpu`, and the wiring check passed on it on 2026-09-24. Headless WebGPU on SwiftShader can lose its device when the machine is under heavy load; rerun on an idle machine.
* **Blending, 2026-10-03**: the render check passed in headless Chromium 153 on Linux on a real GPU (NVIDIA GeForce RTX 4090 through Vulkan, flags as in [Placement check](/docs/client/developer/placement-check#run-headless-on-a-real-gpu)) with `engine=webgpu`: `compute-blend`, and `compute-nearest` with `blend=0`, both with no WebGPU validation errors; the **Blend (WebGPU)** checkbox switched between them; `engine=webgl2` still drew `babylon-points`.
* **Placement handle drags, 2026-09-28**: real mouse drags in headless Chromium 153 on Linux moved the draft on WebGL2 and WebGPU, with SwiftShader and on a real GPU (NVIDIA GeForce RTX 4090 through Vulkan). Dragging a translate arrow moved x to 0.104 m; dragging a rotate ring turned yaw to about −45°. Nothing was sent to the server. See [Placement check](/docs/client/developer/placement-check#run-headless-on-a-real-gpu).

## How the docs screenshots were taken [#how-the-docs-screenshots-were-taken]

The screenshots on the client pages come from the development server with the mock server only, in headless Chromium 153 with `--use-angle=swiftshader`, at a 1440×1000 window and a device pixel ratio of 2. That browser can’t decode HEVC, so the cards show the `Setup and control only` line and no point cloud. The 3D view screenshot uses the wiring check page’s test data.

## Fix check problems [#fix-check-problems]

These are the common problems with the checks:

* **The decode check reports a missing file, or the wiring or latency check fails after about 30 seconds with no pair uploaded**: the unpublished sample recordings in `client/reference/hevc-web/` are missing. See [Sample recordings](#sample-recordings).
* **`npm: command not found`**: use the `./node_modules/.bin/…` commands above.
* **A check page fails with `rendering-incompatible`**: the browser has no WebGPU or WebGL2. Use `?engine=webgl2` in headless Chromium with `--use-angle=swiftshader`.
