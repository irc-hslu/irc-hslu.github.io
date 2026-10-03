# Add a server (https://irc-hslu.github.io/orbbecstreamer/docs/client/add-a-server)







Each server you add gets its own card in the side panel, and all servers draw their point clouds in the same 3D view.

The capture server doesn’t accept browser connections yet. See [Serve to browsers](/docs/server/serving). Until it does, use the mock server below to try the client, or [play a recording](/docs/client/playback).

## Connect to a capture server [#connect-to-a-capture-server]

The client connects over WebTransport, a browser connection type for fast, two-way streaming. You need the server’s WebTransport address, for example `https://capture-01.local:4433/orbbec`.

1. Start the client and open it. See [Run the client](/docs/client/dev-build).
2. In **Add server**, type the server’s address into **WebTransport URL**. Replace the host name, port and path in the example with your server’s.
3. Select **Connect to server**.

<img alt="The Add server form: the WebTransport URL field with the placeholder https://host:4433/orbbec, and the Connect to server button" src="__img0" />

The form checks the address before it connects. The address must start with `https://` and must not contain a `#`.

Your browser must also trust the server’s security certificate. The client can’t accept a certificate your browser doesn’t already trust.

## Add the mock server instead [#add-the-mock-server-instead]

The development server has a simulated capture server, the mock server. It behaves like a real server, so you can try every screen without hardware.

1. Start the client with `npm run dev`. See [Run the client](/docs/client/dev-build).
2. In **Dev: mock server**, select **Add mock server**.

The line under the button says `Added a mock server (snapshot only, no media).`: the mock server sends status but no video. Where your checkout has a local copy of the team’s sample recordings, it says `Added a mock server (reference recording).` and also streams that video. See [Sample recordings](/docs/client/developer/test-the-client#sample-recordings). Either way, you can try every card and setup screen. The built copy of the client (`npm run build`) has no mock server.

## What you should see [#what-you-should-see]

A new card appears under **Servers** at once, with the status `connecting`. After a moment, the card shows the server’s name, its ID and a live status such as `ready` or `streaming`. The client then asks the server for all its video streams.

No point cloud appears yet: HEVC decoding hasn’t worked in any browser tested so far, and a real server can’t be connected yet. See [Check your browser](/docs/client/browser-requirements).

<img alt="The Servers list with one card for the Dev mock server: status streaming, its server ID and mock address, and a Setup and control only line because the capture browser can’t decode HEVC" src="__img1" />

[Read a server card](/docs/client/server-card) explains every line of the card.

If the connection drops, the client reconnects by itself and keeps trying. The wait starts at 1 second and doubles with each failed try, up to 30 seconds; each wait is cut by a random 0 to 50 %, so clients don’t all retry at once. The wait starts over at 1 second only after a connection has stayed up for 10 seconds. The client doesn’t retry after you select **Remove**, after a protocol version mismatch, or after a conflict.

## Fix connection problems [#fix-connection-problems]

These messages appear on the server card:

* **Status `error` and `last close: transport error: …`**: the client couldn’t open the connection.
  * Check that the server is running and that you can reach its host and port over UDP. WebTransport runs over UDP, not TCP.
  * Check that your browser trusts the server’s certificate.
  * A browser without WebTransport fails this way on every try. See [Check your browser](/docs/client/browser-requirements).
* **`connect timeout`**: the server didn’t finish connecting within 10 seconds. It may be unreachable, or it may not answer. Check the server’s logs.
* **`Protocol version mismatch; cannot connect.`**: the server uses another major version of the protocol. Update the client or the server. The client doesn’t retry.
* **`last close: protocol error invalid-transform: …`**, or `invalid-quantization-profile`, `invalid-bundle-descriptor` or `invalid-message`: the server sent data that breaks the protocol, for example a placement that isn’t rigid. The client closes the connection and retries. Check the server’s calibration and placement, and report the text after the code.
* **`conflict: server … is already rendered by …`**: two cards reach the same server, for example once by IP address and once by host name. Select **Remove** on one of them.
* **Status `streaming`, but the counts stay at `uploaded 0`**: a `Setup and control only` line means your browser can’t decode the video. See [Check your browser](/docs/client/browser-requirements). Otherwise, look at the bundle lines in the card’s **layout** for an error.

These messages appear under the **Add server** form:

| Message                                             | Fix                                        |
| --------------------------------------------------- | ------------------------------------------ |
| `enter a server URL, e.g. https://host:4433/orbbec` | Type an address.                           |
| `not a URL: …`                                      | Type a full address, including `https://`. |
| `WebTransport needs an https: URL, got …`           | Start the address with `https://`.         |
| `WebTransport URLs cannot have a fragment (#…)`     | Remove the `#` and everything after it.    |
