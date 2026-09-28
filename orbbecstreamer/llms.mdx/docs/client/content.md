# Client (https://irc-hslu.github.io/orbbecstreamer/docs/client)



## What it is [#what-it-is]

The OrbbecStreamer client is a browser application. It does three things:

* It connects to one or more capture servers over WebTransport.
* It decodes their HEVC colour and depth streams with WebCodecs.
* It rebuilds metric point clouds on the GPU and draws every server's
  clouds in one shared Babylon.js scene, using WebGPU or falling back to
  WebGL2.

The client lives in `client/` in the repository and runs from a Vite
development server. See [Run the dev build](/docs/client/dev-build).

## Status [#status]

The client works today as a thin application shell. Its **side panel** can:

* add a server by WebTransport URL;
* open a recording (colour `.hevc`, depth `.hevc` and a manifest) and play
  it as if it were a server;
* show a **server card** for every connection: its status, setup lock,
  calibration state, stream layout, frame counts, RTT and network budget,
  and the shared-update toggle;
* take and release a server's setup lock, refresh its state, reconnect
  it, and remove it;
* open the **setup workspace** for one server at a time, and run, cancel
  and commit its depth-quantization calibration there. The camera-pose
  screen is a placeholder, and network calibration is not available yet.
* edit a server's **placement** in the setup workspace, with numbers or a
  3D handle, as a local draft that is sent only with **Commit placement**;
* position **world anchors** in this browser's 3D scene (client-local,
  never sent to a server).

All connected servers are drawn in **one 3D view beside the side panel (stacked below it on narrow windows)**, which you
orbit with the mouse.

The layers underneath are built and tested:

* protocol;
* connection handling, including reconnect and snapshot resync;
* decoding;
* rendering.

Coming soon:

* **Camera-pose calibration screen**, once the protocol contract defines
  it, and **network calibration** (change request 0018).
* **WebXR:** viewing the scene in a headset.

These are tracked in `client/docs/development/ROADMAP.md` under
"Phase 1D — UI" and "Phase 2 — media and rendering".

Decoding real HEVC in a browser has not been verified yet. The machine
used so far has no HEVC decoder. See
[Browser requirements](/docs/client/browser-requirements).

## Pages [#pages]

| Page                                                        | What it covers                                                                                           | Status                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [Browser requirements](/docs/client/browser-requirements)   | What the browser needs, and what happens without it                                                      | Available                           |
| [Run the dev build](/docs/client/dev-build)                 | Install, start the dev server, build and preview                                                         | Available                           |
| [Add a server](/docs/client/add-a-server)                   | Connect by WebTransport URL                                                                              | Available                           |
| [Read the server card](/docs/client/server-card)            | Every field and action of a server card, and troubleshooting                                             | Available                           |
| [Play back .hevc recordings](/docs/client/playback)         | Open `.hevc` files and a manifest instead of a live server                                               | Available                           |
| [The 3D viewer](/docs/client/viewer)                        | The 3D view and client-local world anchors                                                               | Available                           |
| [Setup workspace](/docs/client/setup-workspace)             | Focused workspace for one server: lock, exits, leaving                                                   | Available                           |
| [Calibration](/docs/client/calibration)                     | Run, cancel and commit depth quantization; camera pose and network status                                | Available (depth quantization only) |
| [Placement editing](/docs/client/placement-editing)         | Edit a server's placement as a local draft, with numbers or a 3D handle, and commit it                   | Available                           |
| [Mock server](/docs/client/developer/mock-server)           | In-process server for tests and dev pages                                                                | Developer                           |
| [Cards check](/docs/client/developer/cards-check)           | Dev page: two clients of one mock server, scripted card scenario                                         | Developer                           |
| [Setup check](/docs/client/developer/setup-check)           | Dev page: the setup workspace through a scripted calibration against one mock server                     | Developer                           |
| [Placement check](/docs/client/developer/placement-check)   | Dev page: placement drafts, commits, a stale draft and world anchors with two clients of one mock server | Developer                           |
| [Latency](/docs/client/developer/latency)                   | Measuring the client's latency stages                                                                    | Developer                           |
| [Getting started notes](/docs/client/getting-started-notes) | Facts for the Getting Started guide                                                                      | Docs team                           |
