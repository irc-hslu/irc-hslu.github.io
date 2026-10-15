# Introduction (https://irc-hslu.github.io/orbbecstreamer/docs)



OrbbecStreamer captures colour and depth from Orbbec cameras, processes and
HEVC-encodes them on an NVIDIA GPU, and streams them over WebTransport to a
browser client.

From v0.1.0-poc.7 a browser on the server PC shows live video: the server
sends colour and depth to each browser that subscribes (see
[Serve to browsers](/docs/server/serving)), and the client draws point clouds
from them, as it does from [recordings](/docs/client/playback). With one
camera, a fresh install streams with no setup step. A first stream means
installing the [release package](/docs/getting-started/install-package),
starting the server and opening the client on the server PC: see
[First stream](/docs/getting-started/first-stream).

## Choose your side [#choose-your-side]

<Cards>
  <Card title="Server" href="/docs/server" description="Capture, process and encode on Linux with an NVIDIA GPU and Orbbec cameras." />

  <Card title="Client" href="/docs/client" description="View point clouds in the browser, and set up each server: calibration and placement." />
</Cards>

## Across both [#across-both]

<Cards>
  <Card title="Getting started" href="/docs/getting-started/install-package" description="Install the release package, or build from source, and reach a first stream." />

  <Card title="Guides" href="/docs/guides/calibration" description="Calibration and placement, across the server and the client." />

  <Card title="Operator Console" href="/docs/operator" description="Read a server's status in the browser, or start, stop and calibrate it from a terminal, on the server PC." />

  <Card title="Troubleshooting & FAQ" href="/docs/troubleshooting-faq" description="Where every error and its fix lives." />
</Cards>
