# Operator Console (https://irc-hslu.github.io/orbbecstreamer/docs/operator)



The **Operator Console** is a status page for one OrbbecStreamer server. In
this release it is **read-only**: it shows the server's cameras, readiness,
streaming and calibration state, and changes nothing. Setup is done in the
client's [setup workspace](/docs/client/setup-workspace) or with the
server's [camera calibration](/docs/server/camera-calibration).

The console first shipped in v0.1.0-poc.1. Since v0.1.0-poc.3 it finds the
server by itself.

## Open the console [#open-the-console]

You need the installed release package, with the `orbbec-streamer` and
`orbbec-streamer-web` services running and at least one camera connected.
The server's WebTransport gateway only starts once a camera is active.

1. On the server PC, check both services:

   ```bash
   systemctl status orbbec-streamer orbbec-streamer-web
   ```

2. In Chrome or Edge **on the same PC**, open [http://127.0.0.1:8080/operator](http://127.0.0.1:8080/operator)
   (`http://localhost:8080/operator` works too).

Other computers on the network can't open the console yet: both services
listen on this machine only.

## Expected result [#expected-result]

The console asks the page's own server where the gateway is and which
certificate to trust, then connects. You don't enter an address or a
certificate. While it connects, the page reads **Connecting to the server**.

Once connected, the top bar shows these chips:

| Chip                                                                                   | Meaning                                                  |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Read-only · v… · protocol …**                                                        | This console only shows status. Hover it for the reason. |
| **Connected**                                                                          | The session to the server is open.                       |
| **Setup lock: free**                                                                   | Nobody is changing the server's setup right now.         |
| **Ready** or **Needs setup**                                                           | Whether the server has the calibration it needs.         |
| **Streaming**, **Streaming: starting**, **Streaming: stopped** or **Paused for setup** | The server's capture and encode state.                   |

The browser tab title also names the worst state, for example
`Needs setup — OrbbecStreamer`.

## What each panel shows [#what-each-panel-shows]

The left navigation has three panels and a checklist.

* **Overview** lists Cameras, Sync, Streaming, Calibration, Placement,
  Network, License and Setup tasks, the worst first. If the server needs
  setup, a banner says where to do it.
* **Cameras & sync** lists every camera with its connection (Connected or
  Disconnected) and health (OK, Degraded or Error). Open a row for its depth
  intrinsics. **Refresh** asks the server for its current state again.
* **License** shows the server ID, with **Copy server id**.
* **Setup checklist** walks through six steps (License, Cameras, Sensors,
  Profiles, Calibration, Live) and shows how far the server is. It opens by
  itself while the server needs setup. **Next step**, **Back** and
  **Close checklist** only move between steps.

**Theme** in the top bar switches between Dark (the default), Light and
System.

## What this release doesn't show [#what-this-release-doesnt-show]

Some rows read **Not reported** or **Not measured**: the server can't send
that information yet. Each row names the protocol change it waits for.

| Not shown yet                                                       | Waits for            |
| ------------------------------------------------------------------- | -------------------- |
| Live images. The console receives no video by design.               | A later release      |
| Camera model, serial, firmware and USB link                         | Protocol change 0027 |
| Hardware sync status                                                | Protocol change 0029 |
| License state and activation                                        | Protocol change 0031 |
| Setup task progress, such as the first-run engine build             | Protocol change 0032 |
| Network quality                                                     | Protocol change 0018 |
| Sensor settings, stream profiles, calibration and placement editing | Later phases         |

Opening the address of a panel that isn't built yet, such as
`/operator/colour`, shows **Not built yet** and the phase it
arrives in.

## Connect by address instead [#connect-by-address-instead]

When the page's server doesn't offer discovery, the console shows **This
server does not offer discovery. Enter its address.** and the **Connect to
a server** form:

1. In **Server address**, enter the gateway's address, for example
   `https://127.0.0.1:4443/orbbec`.
2. In **Certificate hash (SHA-256)**, paste the certificate's SHA-256 hash.
   Hex, colon-separated hex and Base64 are accepted. From `openssl x509
   -fingerprint -sha256`, paste only the part after `=`. With the package,
   `sudo orbbec-tls status` prints the hash.
3. Select **Connect**.

The console remembers this server in the browser. To switch, select
**Change server** in the top bar. To go back to discovery, select **Find
the server automatically** on the form.

A typed hash doesn't follow certificate rotation (about every 6 days with
the package). After a rotation, enter the new hash, or use discovery.

## Troubleshooting [#troubleshooting]

| Symptom                                                     | Cause and fix                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page doesn't load at all                                | The web service isn't running. Run `sudo systemctl status orbbec-streamer-web` and `journalctl -u orbbec-streamer-web`.                                             |
| **Connecting to the server** for more than 10 seconds       | The gateway isn't up, usually because no camera is active yet. Connect a camera and check `journalctl -u orbbec-streamer -f`. The console keeps retrying by itself. |
| **Connection lost** with **Retrying in … s**                | The server restarted or went away. Wait; the console reconnects by itself. Values shown meanwhile are from the time on the **Values as of** chip.                   |
| **Connection lost** and **It is not retried automatically** | The address or certificate hash is wrong. Fix it with **Change server**, then select **Retry now**.                                                                 |
| **This console does not match the server**                  | The page is from another version than the server. Select **Reload**.                                                                                                |
| **The server closed the session**                           | A bug in the console or the server. Select **Copy details**, then **Reload**, and report the copied text if it repeats.                                             |
| **No cameras reported**                                     | The server sees no camera. Check the USB 3 cable and `journalctl -u orbbec-streamer`, then select **Refresh**.                                                      |
| It doesn't work from another computer                       | Expected in this release: open the console on the server PC.                                                                                                        |
