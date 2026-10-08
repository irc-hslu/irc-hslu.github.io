# Add a server (https://irc-hslu.github.io/orbbecstreamer/docs/client/add-a-server)







Each server you add gets its own card in the side panel, and all servers draw their point clouds in the same 3D view.

## Connect on the server PC [#connect-on-the-server-pc]

The packaged server serves this client itself. The server must be running: after installing, start it with `sudo systemctl start orbbec-streamer`. On the server PC, open `http://127.0.0.1:8080` (or `http://localhost:8080`) in Chrome or Edge. The client asks that page where the server is and which certificate to trust, and adds the server by itself the first time the page loads and no server is listed. A card appears under **Servers**. Select **Remove** to take it away; it doesn’t come back until you reload the page, and then only if **Servers** is empty.

The server’s WebTransport gateway starts once a camera is active. If the card shows **Error** at first, start a camera on the server; the client keeps trying. The server only accepts the pages `http://127.0.0.1:8080` and `http://localhost:8080`, so a client opened from another address, such as the development server on port 5173, is refused.

## Connect by typing an address [#connect-by-typing-an-address]

Use this when the client runs somewhere else, for example from a development server. The client connects over WebTransport, a browser connection type for fast, two-way streaming. You need the server’s WebTransport address. The packaged server’s is `https://127.0.0.1:4443/orbbec`; a server on another machine uses its own host name, for example `https://capture-01.local:4443/orbbec`.

1. Start the client and open it. See [Run the client](/docs/client/dev-build).
2. Under **Servers**, type the server’s address into the URL field, which shows `https://host:4443/orbbec` when empty. Replace the host name, port and path with your server’s.
3. Open **Certificate hash (SHA-256), optional** and paste the server’s certificate hash. Skip this only when your browser already trusts the certificate.
4. Select **Connect**.

<img alt="The top of Servers: the URL field with the placeholder https://host:4443/orbbec and Connect, the folded Certificate hash field, the folded Open recording, and Add mock server" src="__img0" />

The form checks the address and the hash before it connects. The address must start with `https://` and must not contain a `#`. The hash is 64 hex digits (capitals, small letters or pairs separated by `:`) or 43 to 44 base64 characters; anything else shows an error under the field and nothing is added.

The packaged server’s certificate is self-signed and lasts 13 days, so browsers don’t trust it by themselves. The hash tells the browser to trust exactly that certificate. On the server PC, run `sudo orbbec-tls status` and copy `sha256Hex` of the `webtransport` entry whose role is `current`. After the certificate is renewed, the old hash no longer works: add the server again with the new one, or use the page of the server PC, which refetches it before every attempt.

If you type the address the page’s own server offers (same host, port and path as **Use this server**) and leave the hash empty, the client uses **Use this server** for you, with the hashes fetched again before every attempt.

## Use the server that served this page [#use-the-server-that-served-this-page]

When the server that served the client offers transport discovery, **Servers** also shows **Use this server**. The client checks this when the page loads. The page must come from an `https://` address, or from `http://127.0.0.1` or `http://localhost` on the server PC. Select **Use this server** to connect without typing an address.

Before every connection attempt, the client asks the page’s own address where the server is and which certificate to trust. A rotated certificate is picked up on the next reconnect. The card shows the address in use, for example `webtransport https://127.0.0.1:4443/orbbec via discovery`.

If the page’s server stops offering discovery before the first connection, the card shows `This page’s server offers no transport discovery: add the server by its URL`, and the client doesn’t retry. Once a connection has worked, the client keeps retrying through brief outages.

## Add the mock server instead [#add-the-mock-server-instead]

The development server has a simulated capture server, the mock server. It behaves like a real server, so you can try every screen without hardware.

1. Start the client with `npm run dev`. See [Run the client](/docs/client/dev-build).
2. Under **Servers**, select **Add mock server**.

The line under the button says `Added a mock server (snapshot only, no media).`: the mock server sends status but no video. Where your checkout has a local copy of the team’s sample recordings, it says `Added a mock server (reference recording).` and also streams that video. See [Sample recordings](/docs/client/developer/test-the-client#sample-recordings). Either way, you can try every card and setup screen. The built copy of the client (`npm run build`) has no mock server.

## What you should see [#what-you-should-see]

A new card appears under **Servers** at once, with the status chip **Connecting**. After a moment, it shows the server’s name, its ID and **Ready** or **Streaming**. The client then asks the server for all its video streams.

If no point cloud appears, your browser may not be able to decode the video. See [Check your browser](/docs/client/browser-requirements).

<img alt="Servers with one card for the Dev mock server: Ready, its server ID and mock address, and a Setup and control only chip because the capture browser can’t decode HEVC" src="__img1" />

[Read a server card](/docs/client/server-card) explains every part of the card.

If the connection drops, the client reconnects by itself and keeps trying. The wait starts at 1 second and doubles with each failed try, up to 30 seconds; each wait is cut by a random 0 to 50 %, so clients don’t all retry at once. The wait starts over at 1 second only after a connection has stayed up for 10 seconds. The client doesn’t retry after you select **Remove**, after a protocol version mismatch, after a conflict, or, in Chrome and Edge, when the site’s security policy blocks the server.

## Fix connection problems [#fix-connection-problems]

A card whose server has never answered shows `N failed attempts; next retry in X s.` under the error. After two failed attempts it adds one hint naming the usual causes, with a link to this section:

* **The certificate isn’t trusted.** Add its hash under **Certificate hash (SHA-256), optional**, or open the client from the server PC’s page and select **Use this server**.
* **This page’s address isn’t allowed by the server.** Open `http://127.0.0.1:8080` on the server PC. See [Serve to browsers](/docs/server/serving).
* **The server isn’t running yet.** Its gateway starts once a camera is active.

A card added by **Use this server** (or by the automatic connect) takes the certificate and allowed address from the server itself, so those two aren’t the cause. After two failed attempts it shows **Server or camera not running** instead: start the server on the server PC with `sudo systemctl start orbbec-streamer`, and make sure a camera is active, because the gateway starts only once a camera is active. The package no longer starts the server when it installs. The card connects by itself once both are running.

The browser doesn’t tell the client which of these it is, so the card can’t say. The hint goes away once the server has answered once; later drops show the plain message below.

These messages appear on the server card:

* **Error status and `last close: transport error: …`**: the client couldn’t open the connection.
  * Check that the server is running and that you can reach its host and port over UDP. WebTransport runs over UDP, not TCP. The packaged server’s gateway starts once a camera is active.
  * Check that your browser trusts the server’s certificate: add its hash, or use **Use this server**.
  * Check that the server allows this page’s address. The packaged server accepts `http://127.0.0.1:8080` and `http://localhost:8080` only. See [Serve to browsers](/docs/server/serving).
  * A browser without WebTransport fails this way on every try. See [Check your browser](/docs/client/browser-requirements).
* **`last close: transport error: blocked by this page's Content Security Policy …`**: the site that serves the client doesn’t allow connections to this server’s address (its Content Security Policy `connect-src` doesn’t list it). The browser refuses before it sends anything. In Chrome and Edge the client recognises this and doesn’t retry; other browsers word the refusal differently, so there the card shows a plain `transport error` and the client keeps retrying with backoff. Check the address on the card first. If it’s right, ask whoever deploys the client to add the server’s `https://host:port` to `connect-src`. The policy only changes when the page loads, so reload the page and add the server again. **Reconnect** tries once more, but meets the same policy until you reload.
* **`connect timeout`**: the server didn’t finish connecting within 10 seconds. It may be unreachable, or it may not answer. Check the server’s logs.
* **`Protocol version mismatch; cannot connect.`**: the server uses another major version of the protocol. Update the client or the server. The client doesn’t retry.
* **`last close: protocol error invalid-transform: …`**, or `invalid-quantization-profile`, `invalid-bundle-descriptor` or `invalid-message`: the server sent data that breaks the protocol, for example a placement that isn’t rigid. The client closes the connection and retries. Check the server’s calibration and placement, and report the text after the code.
* **`last close: internal error: media channel …`** or **`media stream …`**: the client hit a bug while it read that server’s video. It closes only this connection, reconnects and starts again from a fresh snapshot; other servers keep streaming. If it repeats, report the full text.
* **`conflict: server … is already rendered by …`**: two cards reach the same server, for example once by IP address and once by host name. Select **Remove** on one of them.
* **Streaming, but Pairs stays at 0**: a **Setup and control only** chip means your browser can’t decode the video. See [Check your browser](/docs/client/browser-requirements). Otherwise, open **Details** and look at the bundle rows under **Layout**.

These messages appear under the URL field:

| Message                                                          | Fix                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `enter a server URL, e.g. https://host:4443/orbbec`              | Type an address, for example `https://127.0.0.1:4443/orbbec`.                                 |
| `not a URL: …`                                                   | Type a full address, including `https://`.                                                    |
| `WebTransport needs an https: URL, got …`                        | Start the address with `https://`.                                                            |
| `WebTransport URLs cannot have a fragment (#…)`                  | Remove the `#` and everything after it.                                                       |
| `certificate hash: not a SHA-256 hash: expected 64 hex digits …` | Paste the whole hash: 64 hex digits, or 43 to 44 base64 characters. Or leave the field empty. |
