# Troubleshooting & FAQ (https://irc-hslu.github.io/orbbecstreamer/docs/troubleshooting-faq)



## Setting up [#setting-up]

Every build and run error, with its cause and fix, lives with the step it
belongs to:

* [Requirements](/docs/server/requirements#troubleshooting): driver, CUDA and USB issues, including a GPU older than compute capability 8.9.
* [Install](/docs/server/install#troubleshooting): packages, TensorRT, the Orbbec SDK and the RVM engine.
* [Build and test](/docs/server/build#troubleshooting): CMake configure, compiler mismatches and CTest.
* [Configuration](/docs/server/configuration#troubleshooting): every live config validation error.
* [Run the server](/docs/server/running#troubleshooting): start-up and runtime failures.
* [Run the dev build](/docs/client/dev-build#troubleshooting): the client's dev server and build.

## FAQ [#faq]

**Can I see my own camera in the browser today?** Not yet. WebTransport
serving is not implemented (see [Serve to browsers](/docs/server/serving)),
so a browser cannot connect to a real server. Run
[First stream](/docs/getting-started/first-stream) on the server instead;
optionally preview a hand-built recording in the client (see
[Play back .hevc recordings](/docs/client/playback)).

**Do I need the RVM segmentation model to get a first stream?** No.
`mask.backend: "fill_all"` treats the whole frame as foreground and needs no
model or engine file. Building the RVM engine is a separate, optional step;
see [Install](/docs/server/install#rvm-segmentation-engine-optional).

**Is a missing `camera-pose.json` a problem?** No. The server starts in
“needs setup” and keeps capturing, processing and encoding normally. See
[Startup states](/docs/server/camera-calibration#startup-states).

**Why can't I calibrate on the server and commit from the client?** The
server and client cannot connect to each other yet. See
[Calibration](/docs/guides/calibration) for what each side can do on its
own.

**Where do I ask about protocol or wire-format questions?**
`protocol/wire-format.md` is the normative contract; cross-team changes go
through `protocol/changes/` (see the repository root `CLAUDE.md`).
