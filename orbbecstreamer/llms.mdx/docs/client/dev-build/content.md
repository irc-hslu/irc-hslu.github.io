# Run the dev build (https://irc-hslu.github.io/orbbecstreamer/docs/client/dev-build)



## What it is [#what-it-is]

The client is a Vite + React + TypeScript app in `client/`. You run it from
the Vite dev server. The production build is a static folder (`client/dist/`)
with one page, `index.html`.

## How to do it [#how-to-do-it]

You need Node.js with npm. The repository pins no Node version. The client
was built and tested with Node 24.

Install the dependencies (exact versions from `package-lock.json`):

```bash
# working directory: the repository root
cd client
npm ci
```

Start the dev server:

```bash
# working directory: client/
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

Other scripts in `client/package.json` (also `test:watch`, `protocol:export` and `bench:e2e`; see [Latency measurement](/docs/client/developer/latency) for the last one):

| Command (in `client/`) | What it does                                                             |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run typecheck`    | TypeScript check, no output files                                        |
| `npm test`             | All unit tests (Vitest, Node)                                            |
| `npm run build`        | Type check, then production build into `client/dist/`                    |
| `npm run preview`      | Serve `client/dist/` at [http://localhost:4173/](http://localhost:4173/) |

## Expected result [#expected-result]

* **Dev server:** Vite prints `Local: http://localhost:5173/`.
* **In the browser:** a dark 3D view beside a side panel on the
  right.
* **The panel:**
  * a header: `OrbbecStreamer client`, the protocol version, the
    `renderer:` and `decoders:` lines;
  * the "Add server" and "Open recording" forms;
  * in the dev server only, a "Dev: mock server" section with an
    **Add mock server** button (see
    [Mock server](/docs/client/developer/mock-server));
  * "Servers (0)".
* **Build:** writes `client/dist/index.html` and `client/dist/assets/` (the
  main bundle, Babylon.js chunks that load on demand, and source maps).

## Dev check pages [#dev-check-pages]

The dev server also serves check pages from `client/dev/`. They are
**never** part of the production build. Each runs a real part of the
client in the browser and writes a report.

| Page                                                                                             | What it checks                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [http://localhost:5173/dev/decode-check.html](http://localhost:5173/dev/decode-check.html)       | WebCodecs HEVC support and real decoding of a recording                                                                                |
| [http://localhost:5173/dev/render-check.html](http://localhost:5173/dev/render-check.html)       | The renderer, with a synthetic two-camera scene                                                                                        |
| [http://localhost:5173/dev/wiring-check.html](http://localhost:5173/dev/wiring-check.html)       | The full client stack with two recordings side by side and a synthetic decoder                                                         |
| [http://localhost:5173/dev/latency-check.html](http://localhost:5173/dev/latency-check.html)     | Per-stage latency; see [Latency](/docs/client/developer/latency)                                                                       |
| [http://localhost:5173/dev/cards-check.html](http://localhost:5173/dev/cards-check.html)         | Server cards: two clients of one mock server; see [Cards check](/docs/client/developer/cards-check)                                    |
| [http://localhost:5173/dev/setup-check.html](http://localhost:5173/dev/setup-check.html)         | The setup workspace through a scripted calibration; see [Setup check](/docs/client/developer/setup-check)                              |
| [http://localhost:5173/dev/placement-check.html](http://localhost:5173/dev/placement-check.html) | Placement editing and world anchors with two clients of one mock server; see [Placement check](/docs/client/developer/placement-check) |

To run a page without clicking:

* **Query parameters:**
  * `?autorun=1` for the render, wiring, latency, cards, setup and
    placement checks;
  * `?autorun=samples` for the decode check;
  * `?engine=webgl2` or `?engine=webgpu` forces a backend where the page
    supports it.
* **Reading the result:** each page sets `body[data-state]` to `done` or
  `failed` and exposes its report on `window`, for example
  `window.__wiringCheckReport`.

The wiring check's read-back overlay:

* `?readback=1` draws the read-back frame into an overlay. This is for
  headless screenshots that miss a WebGPU canvas.
* The report JSON sits in a collapsed "report JSON" panel at the bottom
  right.

The decode, wiring and latency checks fetch sample recordings from
`client/reference/hevc-web/`. That folder is a local, untracked copy of a
colleague's reference client and is **not in the repository**. Without
it:

* the decode check fails at once, reporting a missing file;
* the wiring and latency checks fail only after about 30 s with "no pair
  uploaded". The dev server answers a missing `.hevc` path with its HTML
  page, not a 404.

The decode check also accepts files you pick yourself. The render check
needs no files.

For testing without hardware, see also the
[Mock server](/docs/client/developer/mock-server).

## Troubleshooting [#troubleshooting]

* **`Error: Port 5173 is already in use`:** the dev server uses a fixed
  port (`strictPort`).
  * Stop the other dev server.
  * Or start this one on another port and open that port instead:

    ```bash
    # working directory: client/
    npm run dev -- --port 5174
    ```
* **`npm: command not found`:**
  * On some machines Node is installed without npm, for example through
    pnpm. Install npm with your Node distribution.
  * Once `node_modules/` exists, the same tools run directly from
    `client/`:

    ```bash
    # working directory: client/
    ./node_modules/.bin/vite                 # npm run dev
    ./node_modules/.bin/tsc --noEmit         # npm run typecheck
    ./node_modules/.bin/vitest run           # npm test
    ./node_modules/.bin/vite build           # npm run build (after tsc)
    ./node_modules/.bin/vite preview         # npm run preview
    ```
* **The panel says `renderer: rendering-incompatible`:** see
  [Browser requirements](/docs/client/browser-requirements).
* **Opened from another machine and nothing connects:** the dev server
  listens on `localhost` only, and plain HTTP is a secure context only on
  `localhost`.
  * `--host` exposes the server on the network, but the page then runs
    over plain HTTP, and WebTransport, WebCodecs and WebGPU are
    unavailable.
  * Serving over HTTPS needs a `server.https` certificate in
    `client/vite.config.ts`. The repository does not configure one yet.
* **The decode check reports a missing file, or the wiring or latency
  check fails after about 30 s with no pair uploaded:** the reference
  recordings in `client/reference/hevc-web/` are missing. See above.
