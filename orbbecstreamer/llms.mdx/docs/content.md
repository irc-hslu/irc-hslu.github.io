# Introduction (https://irc-hslu.github.io/orbbecstreamer/docs)



OrbbecStreamer captures colour and depth from Orbbec cameras, processes and
HEVC-encodes them on an NVIDIA GPU, and will stream them over WebTransport to
a browser client.

Today a browser can connect to a server for status and setup, but the server
doesn't send video to browsers yet (see
[Serve to browsers](/docs/server/serving)). A working first stream today
means running the server against your own camera and watching it capture,
process and encode in real time: see [First stream](/docs/getting-started/first-stream).

## Choose your side [#choose-your-side]

<Cards>
  <Card title="Server" href="/docs/server" description="Capture, process and encode on Linux with an NVIDIA GPU and Orbbec cameras." />

  <Card title="Client" href="/docs/client" description="View point clouds in the browser, and set up each server: calibration and placement." />
</Cards>

## Across both [#across-both]

<Cards>
  <Card title="Getting started" href="/docs/getting-started/install-package" description="Install the release package, or build from source, and reach a first stream." />

  <Card title="Guides" href="/docs/guides/calibration" description="Calibration and placement, across the server and the client." />

  <Card title="Operator Console" href="/docs/operator" description="Read a server's status in the browser on the server PC." />

  <Card title="Troubleshooting & FAQ" href="/docs/troubleshooting-faq" description="Where every error and its fix lives." />
</Cards>
