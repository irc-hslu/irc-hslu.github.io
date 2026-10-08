# Troubleshooting & FAQ (https://irc-hslu.github.io/orbbecstreamer/docs/troubleshooting-faq)



## Setting up [#setting-up]

Every build and run error, with its cause and fix, lives with the step it
belongs to:

* [Requirements](/docs/server/requirements#troubleshooting): driver, CUDA and USB issues, including a GPU older than compute capability 8.9.
* [Install](/docs/server/install#troubleshooting): packages, TensorRT, the Orbbec SDK and the RVM engine.
* [Build and test](/docs/server/build#troubleshooting): CMake configure, compiler mismatches and CTest.
* [Configuration](/docs/server/configuration#troubleshooting): every live config validation error.
* [Run the server](/docs/server/running#troubleshooting): start-up and runtime failures.
* [Run the client](/docs/client/dev-build#troubleshooting): the client's dev server and build.
* [Operator Console](/docs/operator#troubleshooting): opening the console and connecting it.

## FAQ [#faq]

**Can I see my own camera in the browser today?** Not yet. A browser can
open a session to a real server and receives its status, but the server
sends no video to browsers until protocol change 0009 is decided (see
[Serve to browsers](/docs/server/serving#status)). Run
[First stream](/docs/getting-started/first-stream) on the server instead;
optionally preview a hand-built recording in the client (see
[Play a recording](/docs/client/playback)).

**Do I need the RVM segmentation model to get a first stream?** No.
`mask.backend: "fill_all"` treats the whole frame as foreground and needs no
model or engine file. Building the RVM engine is a separate, optional step;
see [Install](/docs/server/install#rvm-segmentation-engine-optional).

**Is a missing `camera-pose.json` a problem?** No. The server starts in
“needs setup” and keeps capturing, processing and encoding normally. See
[Startup states](/docs/server/camera-calibration#startup-states).

**What does the server send a browser today?** Status and setup: the
server's hello, snapshots, pings, the setup lock and calibration commands
(see [Session control](/docs/server/serving#session-control)). No colour or
depth video yet.

**Why does a server card say “Setup and control only”?** The browser can't
decode the server's HEVC video, so there are no point clouds to draw. Setup
and the lock still work. See
[Check your browser](/docs/client/browser-requirements). The read-only
[Operator Console](/docs/operator) never receives video, by design.

**Why does the page find the server by itself?** On the server PC, the page
asks its own address, `/.well-known/orbbec/transport`, for the gateway's
address and certificate hashes before every connection (transport discovery,
protocol change 0037). That is why a rotated certificate needs no action.
It works on `https://` pages and on `http://127.0.0.1` or `http://localhost`.

**The page says the server offers no discovery.** The page's own server
doesn't answer `/.well-known/orbbec/transport`, for example the client's dev
server. Add the server by its URL instead: see
[Add a server](/docs/client/add-a-server) or, for the console,
[Connect by address instead](/docs/operator#connect-by-address-instead).

**Why can't another computer on the network connect?** In this release the
packaged web page and gateway listen on the server PC only. Open the page
in Chrome or Edge on that PC. If you run your own config and connect by a
LAN address, the gateway answers HTTP 421 unless that address is in the
certificate or in `serving.host_names`, and the page's origin must be in
`serving.allowed_origins` (see [Gateway](/docs/server/serving#gateway)).

**Where do I ask about protocol or wire-format questions?**
`protocol/wire-format.md` is the normative contract; cross-team changes go
through `protocol/changes/` (see the repository root `CLAUDE.md`).
