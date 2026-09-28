# Latency measurement (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/latency)



## What it is [#what-it-is]

The client has three tools for measuring its own latency:

* **The per-stage latency probe** (`client/src/connections/latencyProbe.ts`).
  It times each frame through the client, from the last network byte to the
  animation frame after the draw, and reports p50/p90/p99/max per stage.
  It is off unless a pipeline asks for it. When off, no clock is read on the
  media path.
* **The latency check page** (`client/dev/latency-check.html`). It runs the
  probe in a real browser over two recordings and shows the stage table.
* **The end-to-end benchmark** (`npm run bench:e2e`). It runs the client
  media path in Node with the browser parts simulated, and can compare two
  commits.

The main app does not turn the probe on. Only the latency check page and
your own code do.

### Stages [#stages]

All values are in milliseconds.

| Stage              | Channel       | From → to                                                                                                  |
| ------------------ | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `network`          | colour, depth | capture (server clock, converted with the clock-sync offset) → last byte of the record read by the client  |
| `transport`        | colour, depth | last byte read → record handed to its decoder (framing, router, keyframe gate)                             |
| `queue`            | colour, depth | record handed to the decoder → `decode()` returned                                                         |
| `decode`           | colour, depth | `decode()` returned → decoded frame output                                                                 |
| `pairWait`         | colour, depth | frame decoded → colour/depth pair emitted (waiting for the other channel)                                  |
| `depthRead`        | pair          | pair emitted → depth codes read into the upload buffer                                                     |
| `upload`           | pair          | depth codes read → depth and colour uploads issued                                                         |
| `draw`             | pair          | uploads issued → next render-loop tick that drew                                                           |
| `present`          | pair          | that draw → the next render-loop tick; an upper bound for the hand-off to the compositor, not the scan-out |
| `clientTotal`      | pair          | last byte of the later channel → `present`                                                                 |
| `captureToPresent` | pair          | capture → `present`                                                                                        |

A stage is left out of the report until it has a sample. For example,
`network` has no samples until the clock-sync offset is known. The window is
the last 512 samples per stage and channel.

## Run the latency check page [#run-the-latency-check-page]

You need `client/reference/hevc-web/` with `gpu-output-color.hevc`,
`gpu-output-depth.hevc` and, optionally, `public/hevcsetup.json`.

This folder is not in the repository, and neither is `hevc-web.zip`; ask
the client team for the archive. Put `hevc-web.zip` in `client/`, then run
this in `client/`:

```bash
mkdir -p reference/hevc-web
unzip hevc-web.zip -d reference/hevc-web
```

Start the dev server in `client/`:

```bash
npm run dev
```

Open this URL in Chrome:

```text
http://localhost:5173/dev/latency-check.html?autorun=1&engine=webgl2
```

URL parameters:

| Parameter                          | Effect                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `autorun=1`                        | Start on load. Without it, press **Start**.                                             |
| `engine=webgl2` or `engine=webgpu` | Force a rendering engine. Without it, WebGPU is tried first and WebGL2 is the fallback. |
| `seconds=N`                        | Measuring time after the first upload, default 8, maximum 60.                           |

What the page does:

* It plays both recordings through the real connection, decoding, pairing,
  feed and renderer code. It uses a **synthetic decoder** that ignores the
  HEVC bytes and emits generated frames.
* It waits for both servers to upload a pair (at most 30 s), then discards
  1 s of start-up samples, then measures for `seconds`.

### Cross-origin isolation [#cross-origin-isolation]

The dev server sends `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. This makes the page
cross-origin isolated, so `performance.now()` keeps a 5 µs resolution in
Chrome instead of 100 µs. Many client stages take only tens of µs, so they
need the fine timer. `vite preview` and the production build do not send
these headers.

## Expected result [#expected-result]

When the run ends, `document.body.dataset.state` is `done` or `failed`. The
HUD shows:

* a status line: state, engine, `crossOriginIsolated`, measured timer
  resolution;
* one stage table per server, with `n`, p50, p90, p99 and max in ms.

The full report is under **report JSON** at the bottom right, and in
`window.__latencyCheckReport`. It contains:

* `crossOriginIsolated` and `timerResolutionMs`;
* `entries[].latency.stages[]`, where each stage has `stage`, `channel`,
  `count`, `p50`, `p90`, `p99` and `max`;
* `errors`, `notes` and `verdict`.

`done` means every server uploaded pairs, there were no errors, and every
server has `present` samples. The recorded run is in
`client/docs/development/latency-audit.md` §9.2: headless Chromium, WebGL2
on SwiftShader, `seconds=8`, timer resolution 0.005 ms. Its p50 values:

| Stage       | p50              |
| ----------- | ---------------- |
| `transport` | 0.015 ms         |
| `queue`     | 0.005 ms or less |
| `depthRead` | 0.10 ms          |
| `upload`    | 3.17 ms          |
| `draw`      | 30.5 ms          |
| `present`   | 67.7 ms          |

### Which stages mean something on this page [#which-stages-mean-something-on-this-page]

| Stage                             | Meaningful here?                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `transport`, `queue`, `depthRead` | Yes. Production code.                                                                                               |
| `upload`                          | Yes, for the engine in use. On SwiftShader it is software rendering.                                                |
| `decode`                          | No. It times the synthetic decoder, not WebCodecs.                                                                  |
| `pairWait`                        | Partly. The synthetic decoder outputs colour about 15 ms before depth, so colour `pairWait` shows that skew.        |
| `network`, `captureToPresent`     | No. Recordings have no network, and the capture time comes from the recording's clock.                              |
| `draw`, `present`, `clientTotal`  | Only on a real GPU. On SwiftShader the points are rasterised on the CPU, so render-loop ticks are tens of ms apart. |

To measure real decode, network and display time, use a real server and a
real browser decoder. The probe measures the same stages there.

### Use the probe in your own code [#use-the-probe-in-your-own-code]

Set `latencyProbe: true` in the `ConnectionManager` options. The manager
passes it to every `ServerPipeline`. Then read the report:

```ts
// `options`: your usual ConnectionManager options.
const manager = new ConnectionManager({ ...options, latencyProbe: true });
const id = manager.add(source);
// Later, for example once per second:
const report = manager.pipeline(id)?.latencyReport(); // null when the probe is off
manager.pipeline(id)?.resetLatency(); // clear the windows
```

`latencyReport()` sorts the sample windows, so call it for diagnostics, not
per frame.

## Run the end-to-end benchmark [#run-the-end-to-end-benchmark]

This runs the client media path in Node. The path is: byte source,
transport, router, keyframe gate, decoder, pairing, feed, then a recording
upload target. The browser parts are simulated:

* `EncodedVideoChunk` copies its data unless given a transfer list;
* decode takes 0 ms;
* `VideoFrame.copyTo` is a memcpy;
* on stream rotation and reconnect, the support probe takes 1 ms and a new
  decoder's first output takes 10 ms.

The numbers are therefore client overhead in Node, not browser timings.

In `client/`:

```bash
npm run bench:e2e
```

To use BYOB reads on the media streams:

```bash
npm run bench:e2e -- --byob
```

It takes about 20 s and prints three blocks:

* `steady 640x576`;
* `steady 1920x576`;
* a rotation line.

Each steady block shows:

* per-stage µs p50 / p99;
* `client-added total` (last byte of the pair → uploads issued);
* JS-visible copies per frame set;
* `exact-code failures`, which must be 0.

Results on the current code, 2026-09-28:

| Line                    | 640×576      | 1920×576     |
| ----------------------- | ------------ | ------------ |
| client-added total, p50 | about 0.5 ms | about 0.8 ms |
| copies per frame set    | 19.3 KiB     | 61.5 KiB     |

* With `--byob`, copies are 0.0 KiB.
* The rotation line shows a first upload about 1.2 ms after a new stream,
  and about 12 ms after a reconnect. It shows 2 `isConfigSupported` calls.
* Absolute times depend on the machine.

### Compare against another commit [#compare-against-another-commit]

From the repository root, replacing `43ad3cd` with the commit to compare:

```bash
git worktree add --detach ../bench-before 43ad3cd
ln -s "$PWD/client/node_modules" ../bench-before/client/node_modules
(cd client && npm run bench:e2e -- --root ../../bench-before/client)
git worktree remove ../bench-before
```

The output labels each block with the other tree's path. Against `43ad3cd`,
on the same machine as the results above:

|                         | 640×576      | 1920×576     |
| ----------------------- | ------------ | ------------ |
| client-added total, p50 | about 3.1 ms | about 9.1 ms |

The rotation line showed about 20 ms and 24 `isConfigSupported` calls.

The other tree must have the same module layout
(`src/connections/transport.ts`, `src/media/decoding/decodingSink.ts`,
`src/rendering/renderFeed.ts`, and so on). See `client/scripts/bench/README.md`.

## Troubleshooting [#troubleshooting]

**`crossOriginIsolated` is false, or `timerResolutionMs` is 0.1.**

* The page was not served by the Vite dev server with its headers.
* Open it through `npm run dev` at `http://localhost:5173`.
* Check the headers:

  ```bash
  curl -sI http://localhost:5173/dev/latency-check.html | grep -i cross-origin
  ```

  Both `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` must
  appear. Sub-millisecond stages are unreliable without them.

**`failed` with "no pair uploaded by every server within the timeout" after 30 s.**

* The recordings are probably missing from `client/reference/hevc-web/`.
* The dev server answers a missing file with its HTML index page (HTTP 200),
  so the page does not fail at the download. It fails 30 s later because
  nothing can be played.
* Extract the reference files as shown above.

**`failed` with "rendering-incompatible: WebGPU required but unavailable".**

* `engine=webgpu` was forced in a browser without a WebGPU adapter, for
  example headless Chromium without a GPU.
* Use `engine=webgl2`, or run in a headed Chrome on a machine with a
  supported GPU.

**`failed` with "VideoFrame (WebCodecs) unavailable (secure context required)".**

* The page was opened over plain HTTP from another machine.
* Use `localhost`, or serve with HTTPS.

**`draw` and `present` are tens of milliseconds.**

* The render loop ticks that slowly because the renderer is software
  (SwiftShader, typical in headless Chromium).
* These two stages are only meaningful on a real GPU.

**`--root` fails with "Cannot find module".**

* The other tree has no `node_modules`. Create the symlink shown in the
  procedure.
* Or the other tree's module layout is too old for the harness.

## Other dev check pages [#other-dev-check-pages]

All are served by `npm run dev` in `client/`. Each sets
`document.body.dataset.state` to `done` or `failed` and publishes its report
on `window`.

**Decode check**

* URL: `http://localhost:5173/dev/decode-check.html?autorun=samples`
* What it checks:
  * that real WebCodecs HEVC decoding works in this browser;
  * which decoder configuration is picked;
  * the formats and layouts of the frames;
  * the depth codes read back from Main10 output.
* Parameters:
  * `autorun=samples` (or `autorun=bundled`) starts with the reference
    recordings;
  * `color=<url>` and `depth=<url>` replace the recording URLs;
  * without `autorun`, you can pick files.
* Report: `window.__decodeCheckReport`.
* Needs a browser that can decode HEVC. Headless Chromium without it ends
  `failed` with "no HEVC configuration is supported".

**Render check**

* URL: `http://localhost:5173/dev/render-check.html?autorun=1&engine=webgl2`
* What it checks: the renderer and feed, using a synthetic two-camera bundle
  (generated depth codes and colour, no HEVC, no reference files needed).
* Parameters:
  * `frames=N` (default 90);
  * `debug=1` draws below-range codes blue and above-range codes red;
  * `engine=webgl2` or `engine=webgpu`;
  * `readback=1` paints the read-back frame into an overlay after the run.
* Report: `window.__renderCheckReport`.

**Wiring check**

* URL: `http://localhost:5173/dev/wiring-check.html?autorun=1&engine=webgl2`
* What it checks: the full composition, with two recordings side by side
  through the connection manager, pipelines and one shared renderer, using
  the synthetic decoder. `done` needs both servers connected, pairs uploaded,
  and drawn points in both halves of the read-back.
* Parameters: `engine=webgl2` or `engine=webgpu`, and `readback=1`.
* Needs the reference recordings.
* Report: `window.__wiringCheckReport`.
