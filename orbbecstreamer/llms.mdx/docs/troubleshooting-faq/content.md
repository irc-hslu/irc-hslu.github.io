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

**Can I see my own camera in the browser?** Yes, from v0.1.0-poc.7, in
Chrome or Edge on the server PC: see
[First stream](/docs/getting-started/first-stream). Up to poc.6 the server
sends no video to browsers; use a recording instead (see
[Play a recording](/docs/client/playback)). The team has not yet checked the
picture content on real hardware, so report anything that looks wrong (see
[Collect a support report](/docs/getting-started/install-package#collect-a-support-report)).

**Why does the video stop when I switch tabs?** When the client's tab has
been hidden for 10 seconds, the client stops receiving and decoding video
and the point clouds leave the view. The connection and the setup lock stay.
The video comes back at the server's next keyframe when you show the tab
again. This never happens while a WebXR session is presenting.

**How much CPU does the decoder need?** It depends on the PC; see
[Check your browser](/docs/client/browser-requirements).

**The server is running but the page shows no video and the card says
Cameras closed.** From v0.1.0-poc.9 the server keeps its cameras closed
after the service starts, until a client asks it to open them. Select
**Start cameras** on the server's card (see
[Server card](/docs/client/server-card)) or, from v0.1.0-poc.10, in the
[Operator Console](/docs/operator#cameras-closed). In poc.9 the terminal
console can't connect while the cameras are closed; see
[Terminal console](/docs/operator/terminal-console#with-the-cameras-closed).

**The Operator Console says "Opened as viewer".** From v0.1.0-poc.9 only a
console opened on the server PC at one of the server's console origins gets
the operator role. See [The operator role](/docs/operator#the-operator-role).
A `live.yaml` kept from an older version lacks `serving.console_origins`; see
[Upgrade](/docs/getting-started/install-package#upgrade).

**The server stopped once a few minutes after the first start.** A known
issue in v0.1.0-poc.7: on a fresh install the server may stop once, about
4 minutes after its first start, when the segmentation engine build
finishes. systemd restarts it within seconds; the browser reconnects by
itself. v0.1.0-poc.8 fixes this.

**The server log reports dropped frames with an invalid timestamp.** When the
server stops, it logs per camera `dropped before batching: N invalid
timestamp, …`. One or two per camera, from the first frames after the camera
starts, are normal.

**Do I need the RVM segmentation model to get a first stream?** No.
`mask.backend: "fill_all"` treats the whole frame as foreground and needs no
model or engine file. Building the RVM engine is a separate, optional step;
see [Install](/docs/server/install#rvm-segmentation-engine-optional).

**Is a missing `camera-pose.json` a problem?** With one camera, no: from
v0.1.0-poc.7 the server writes the identity pose itself at start. With
several cameras the server starts in “needs setup”, keeps capturing,
processing and encoding, and sends no video until you calibrate the camera
poses. See [Startup states](/docs/server/camera-calibration#startup-states).

**What does the server send a browser?** Status and setup: the server's
hello, snapshots, pings, the setup lock and calibration commands (see
[Session control](/docs/server/serving#session-control)). From v0.1.0-poc.7
also the colour and depth video of each camera the browser subscribes to.

**Why does a server card say “Setup and control only”?** The client can't
decode the server's HEVC video in this browser, neither with the browser's
own decoder nor with the client's built-in WebAssembly decoder, so there
are no point clouds to draw. Setup and the lock still work. Chrome on a
Linux PC with an NVIDIA GPU has no exact HEVC decoder of its own, so the
client uses the built-in one there. See
[Check your browser](/docs/client/browser-requirements). The
[Operator Console](/docs/operator)'s own controls never receive video; from
poc.7 its **Preview** screen opens a separate video connection.

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
