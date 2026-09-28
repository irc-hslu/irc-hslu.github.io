# Getting started notes (https://irc-hslu.github.io/orbbecstreamer/docs/client/getting-started-notes)



## What it is [#what-it-is]

These are notes for the docs team, not a tutorial. Each fact below was
checked against `client/package.json`, `client/vite.config.ts`,
`client/index.html` and the client source on 2026-09-28. The user-facing
pages are [Run the dev build](/docs/client/dev-build),
[Browser requirements](/docs/client/browser-requirements) and
[Add a server](/docs/client/add-a-server).

## Requirements [#requirements]

**Node.js:**

* `client/package.json` has no `engines` field, and the repository has no
  `.nvmrc`.
* The client was built and tested with Node 24.18.0.
* `@types/node` is `^22`.

**npm:**

* There is a `client/package-lock.json`, so install with `npm ci`.

**Browser:**

* No particular browser is verified yet. The browser needs the
  following:
  * **WebTransport** for live servers.
  * **WebCodecs** with HEVC Main (colour) and HEVC Main10 (depth) for
    point clouds.
  * **WebGPU or WebGL2** for drawing.
* Without decoding or rendering, the client still connects as a control
  and setup client.
* Real HEVC decoding has not been verified in any browser yet. Details are
  in [Browser requirements](/docs/client/browser-requirements).

## Install and run [#install-and-run]

```bash
# working directory: the repository root
cd client
npm ci
npm run dev
```

Then open [http://localhost:5173/](http://localhost:5173/).

Other commands, all run in `client/`:

* `npm run build`: the production build into `client/dist/`.
* `npm run preview`: serves that build at [http://localhost:4173/](http://localhost:4173/).
* `npm test`: the unit tests.

## Environment variables [#environment-variables]

**None.** The client reads no environment variables: there is no
`import.meta.env` or `process.env` use in `client/src/`. There are no
`.env` files, and all configuration is in `client/vite.config.ts`.

## Ports [#ports]

| Port | What            | Notes                                                                                                                                                                                                                                                  |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5173 | Vite dev server | Fixed (`strictPort`): it fails with "Port 5173 is already in use" instead of picking another port. Sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (for full-resolution timers in the latency check). |
| 4173 | `vite preview`  | Vite's default preview port, without those two headers                                                                                                                                                                                                 |

The client should make no outgoing connection at startup (not verified with a network trace). It connects only to
servers the user adds.

## Reaching a server [#reaching-a-server]

* **The URL:** the user types it into the panel's "Add server" form. It
  must be an absolute `https:` URL with no fragment.
* **Certificates:**
  * The client opens WebTransport with no options, so it does **not**
    support `serverCertificateHashes`.
  * The server's TLS certificate must be trusted by the browser.
  * How the server obtains or publishes its certificate is for the server
    documentation.
* **Secure context:** the page itself must be one. `http://localhost:5173`
  qualifies. Opening the dev server from another machine by IP address
  over plain HTTP does not, and the repository has no HTTPS dev
  configuration yet.
* **No server needed to try the client:** the "Open recording" form plays
  `.hevc` recordings as if they were servers. See
  [Play back .hevc recordings](/docs/client/playback).

## Not yet available [#not-yet-available]

Do not describe these as working:

* The **camera-pose calibration screen** (a placeholder until the
  protocol contract defines it) and **network calibration** (change
  request 0018). The setup workspace, depth-quantization calibration,
  placement editing and client-local world anchors exist; see
  [Setup workspace](/docs/client/setup-workspace),
  [Calibration](/docs/client/calibration) and
  [Placement editing](/docs/client/placement-editing).
* **WebXR** (Phase 2).

See `client/docs/development/ROADMAP.md`.
