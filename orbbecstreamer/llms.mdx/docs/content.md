# Introduction (https://irc-hslu.github.io/orbbecstreamer/docs)



OrbbecStreamer captures colour and depth from Orbbec cameras, processes and
HEVC-encodes them on an NVIDIA GPU, and will stream them over WebTransport to
a browser client.

The server and client each work well on their own today, but they cannot yet
talk to each other: WebTransport serving is not implemented (see
[Serve to browsers](/docs/server/serving)). A working first stream today
means running the server against your own camera and watching it capture,
process and encode in real time: see [First stream](/docs/getting-started/first-stream)
below.

<Cards>
  <Card title="Getting Started" href="/docs/getting-started/install-server" description="Install the server, and reach a first stream." />

  <Card title="Guides" href="/docs/guides/calibration" description="Calibration and placement, across the server and the client." />

  <Card title="Server" href="/docs/server" description="Install, configure and run the capture and streaming server." />

  <Card title="Client" href="/docs/client" description="Connect to a server, play back recordings and view point clouds." />
</Cards>
