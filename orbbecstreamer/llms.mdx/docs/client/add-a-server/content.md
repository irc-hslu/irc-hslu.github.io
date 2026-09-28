# Add a server (https://irc-hslu.github.io/orbbecstreamer/docs/client/add-a-server)





## What it is [#what-it-is]

The side panel's "Add server" form opens a WebTransport session to one
capture server. Each server you add gets a server card in the
"Servers" list. You can add several servers, and all their point
clouds are drawn in the same 3D view.

## How to do it [#how-to-do-it]

1. Start the client (see [Run the dev build](/docs/client/dev-build)) and
   open [http://localhost:5173/](http://localhost:5173/).
2. In **Add server**, type the server's WebTransport URL, for example
   `https://capture-01.local:4433/orbbec`. Replace the host, port and path
   with your server's.
3. Click **Connect to server**.

The URL must follow these rules. The form checks them before connecting:

| Rule                               | Message when broken                                 |
| ---------------------------------- | --------------------------------------------------- |
| Not empty                          | `enter a server URL, e.g. https://host:4433/orbbec` |
| A valid absolute URL               | `not a URL: …`                                      |
| Scheme `https:`                    | `WebTransport needs an https: URL, got …`           |
| No fragment, not even an empty `#` | `WebTransport URLs cannot have a fragment (#…)`     |

The browser must trust the server's TLS certificate. The client opens the
session with no extra options: it does not use
`serverCertificateHashes`, so a self-signed certificate is accepted only
if the browser already trusts it.

<img alt="The Add server form in the side panel: a WebTransport URL field and an Add button" src="__img0" />

## Expected result [#expected-result]

A new server card appears under "Servers" at once, with the status
`connecting`. After the handshake, the card shows the server's name and
id. The client then subscribes to every camera bundle the server
announces, and that server's point cloud should appear in the 3D view.
This path is built and tested against simulated servers, but has not yet
been run against a real server or in a browser with HEVC decoding. That
check is tracked in `client/docs/development/ROADMAP.md` (Phase 2,
"Check with real decoded HEVC frames in a browser").

Every line and action of the card is described in
[Read the server card](/docs/client/server-card).

How connections behave:

* **Connect timeout:** a connection attempt that has not completed its
  handshake after 10 s is closed as `connect timeout`.
* **Reconnect:**
  * A lost session is retried automatically after 1 s. The delay doubles
    up to 30 s between attempts, with no attempt limit.
  * It is not retried after Remove, after a protocol version mismatch, or
    after a conflict. The card's **Reconnect** action starts a new
    session at once whenever the card shows `error` or `disconnected`.
    It is unavailable while the card is connecting or connected.

## Troubleshooting [#troubleshooting]

* **`last close: transport error: …` and status `error`:** the session could
  not be opened.
  * Check that the server is running and reachable at that host and port
    over UDP (WebTransport runs on HTTP/3, over QUIC).
  * Check that the browser trusts the server's certificate.
  * In a browser without WebTransport, every attempt fails this way.
* **`connect timeout`:** opening the session and completing the
  handshake took longer than 10 s. The server may be unreachable, or it
  may not answer the hello; check the server's logs.
* **`Protocol version mismatch; cannot connect.`** or
  `last close: protocol error version-mismatch: …`: the server speaks
  another major protocol version. Update the client or the server.
  The client does not retry.
* **Conflict:** two cards point at the same server (for example by IP
  address and by host name). Remove one.
* **Card `streaming` but `uploaded 0`:**
  * A compatibility line means this browser cannot decode HEVC. See
    [Browser requirements](/docs/client/browser-requirements).
  * Otherwise, check the bundle rows of the card's layout for an error.
