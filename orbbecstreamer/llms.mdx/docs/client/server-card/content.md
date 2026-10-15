# Read a server card (https://irc-hslu.github.io/orbbecstreamer/docs/client/server-card)









Every server and recording gets a card under **Servers**. A server whose cameras are closed still gets one: it shows **Cameras closed** until you start them. It shows that server’s state as your client sees it, and refreshes every half second.

<img alt="A server card for the Dev mock server: the Ready chip, the server ID and address, a Setup and control only chip, the Pose, Depth and Network calibration chips, the Lock, RTT, Pairs and Dropped strip, Set up and five icon buttons, and the folded Details" src="__img0" />

## Read the card from top to bottom [#read-the-card-from-top-to-bottom]

1. **Title and status chip**: the server’s name and one word for its state. See [Status chips](#status-chips).
2. **Server ID and address**: `webtransport https://…`, `recording file://…` or `mock mock://…`.
3. **Notice chips**, only when they apply. Hover over a chip, or press **Tab** to reach it, for its full sentence:
   * **Setup and control only**: this browser can’t decode or draw this server’s video. Setup and the lock still work. See [Check your browser](/docs/client/browser-requirements).
   * **N bundle(s) off · too many cameras** or **· decoder failed**: the client stopped receiving bundles it can’t show, to save network and decoding. A bundle that becomes drawable again comes back by itself; one whose decoder failed comes back after **Reconnect**.
   * **reconnect scheduled**, **resynchronising**, or **waiting for the camera-pose calibration**: the connection is retrying, the client is fetching the server’s full state, or the server needs a camera-pose calibration.
   * the server’s own setup task, such as **Building the foreground model engine: 42%**, **starting**, or **Opening cameras failed** with the reason: shown while the server prepares to stream.
   * While the cameras are closed or failed: **N of M cameras found** (the cameras the server is set up for that it can see right now), and for **Camera start failed** the server’s own reason, for example `Orbbec property 1038 error`.
4. **Boxes**, only when they apply: `conflict: …` when another card already shows this server, and `last close: …` with why the last connection ended.
5. **Calibration chips**: **Pose**, **Depth** and **Network**, each with its state (`missing`, `valid`, `stale`, `running` or `failed`) and revision, for example **Pose valid · r1**. Amber or red means the server can’t stream until it’s fixed; **Network** never stops streaming.
6. **Strip**:
   * **Lock**: **Free**, **Yours · 12 s**, another client’s name, or **Unknown** while disconnected
   * **RTT**: the shortest round trip to the server
   * **Pairs**: colour and depth frames decoded this connection
   * **Dropped**: pairs decoded but not drawn. Records the client discarded before decoding them are not counted here; they show in Details.
7. **Buttons**: see [What each button does](#what-each-button-does).
8. **Details**: folded. See [Details](#details).

## What each button does [#what-each-button-does]

The icon buttons show their name as a tip, on hover and on keyboard focus; **Escape** hides it. An unavailable button stays visible, and its tip says why:

<img alt="The tip over the release-lock icon: Release lock, This client does not hold the lock" src="__img1" />

| Button                       | What it does                                                                                                                                                                                                                                                 | Unavailable when                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Start cameras**            | Asks the server to open its cameras. Shown only while the chip reads **Cameras closed** or **Camera start failed**; after a failure it tries again. The card shows **Opening cameras**, then **Ready** or **Streaming**. The server can take up to a minute. | Not connected; a recording; another client holds the lock (`the lock is held by <name>`)                  |
| **Set up**                   | Opens the setup view and takes the lock. See [Set up a server](/docs/client/setup-workspace).                                                                                                                                                                | Not connected; a recording (`a recording has no setup or lock`); setup is open for this or another server |
| Lock (**Acquire lock**)      | Takes the setup lock only                                                                                                                                                                                                                                    | Not connected; you hold it; another client holds it; a recording                                          |
| Open lock (**Release lock**) | Gives the lock back                                                                                                                                                                                                                                          | Not connected; you don’t hold it; a recording                                                             |
| Circular arrow (**Refresh**) | Fetches the server’s full state                                                                                                                                                                                                                              | Not connected; a refresh is running                                                                       |
| Plug (**Reconnect**)         | Connects again at once                                                                                                                                                                                                                                       | Connecting or connected                                                                                   |
| Bin (**Remove**)             | Disconnects and removes the card and its point clouds                                                                                                                                                                                                        | Never                                                                                                     |

The result of your last action appears under the buttons, for example `Acquire lock: accepted; waiting for the server's lock state`, `Refresh: snapshot received`, or `<action> rejected (<code>): <message>` when the server refused.

When **Shared** updates are off and another client changes something, a box reads `Metadata is stale: a shared update was withheld.` Select its **Refresh**.

## Details [#details]

Select **Details** to unfold the full status:

<img alt="The card with Details open: Source mock mock://…; Lock unlocked; Calibration camera-pose valid revision 1, depth-quantization valid revision 1, network missing revision 0; Layout per-camera with bundle-cam0; Counts; Network min RTT and budget; Shared with the Receive updates switch" src="__img2" />

| Row             | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**      | The full address, for example `webtransport https://…` or `mock mock://…`. The card’s title and the line under it are cut when they are long.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Lock**        | `unlocked`, `held by this client, expires in 12 s`, or `held by <name> (…), last announced expiry in 9 s`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Calibration** | Each calibration’s state, revision and the server’s message                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Layout**      | `per-camera` or `concatenated`, then one row per bundle, for example `bundle-cam0: 1 camera, available; ready, drawing`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Counts**      | `decoded`, `uploaded`, `dropped` and `streams` for this connection. Bundles the client stopped receiving don’t count as streams. When the client discarded records before decoding (before the decoder was ready, while waiting for a keyframe, with a full decode queue, or for an undecodable channel), `· N records discarded before decode` follows. It is absent at zero. Records the stream layer dropped while waiting for a keyframe, or read and dropped after you stopped receiving a bundle or after the server changed its metadata, aren’t in this count. |
| **Network**     | `min RTT`, and the server’s budget, for example `active 40.0 Mbit/s, server maximum 100.0 Mbit/s, safe for this client 35.0 Mbit/s, network compatible`                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Shared**      | The **Receive updates** switch: on, the server sends you other clients’ calibration results and placement changes. Default on. While disconnected, the client sends your choice when it reconnects.                                                                                                                                                                                                                                                                                                                                                                    |

A bundle row ends with its drawing status:

* `ready, drawing`: frames are on screen
* `ready, no frame yet`: waiting for the first frame
* `rendering incompatible (…)`: the 3D view can’t draw this bundle
* `metadata invalid (…)`: the server’s description of the bundle doesn’t add up
* `upload error: …`: the graphics card rejected a frame

The lock’s expiry is in the server’s clock. Until the client has measured the clock difference, the row reads `expires at server time 16.000 s (clock offset not known yet)`. For another client’s lock, `expiry passed as last announced; the server may have renewed it` means the server hasn’t re-announced it yet.

## Status chips [#status-chips]

| Chip                    | Meaning                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connecting**          | Opening the connection, or waiting for the first answer                                                                                        |
| **Offline**             | No connection, for example after a conflict                                                                                                    |
| **Error**               | The last connection failed, or the recording’s files were refused. A server is retried unless the protocol versions differ; a recording never. |
| **Cameras closed**      | The server is running but its cameras are off, until a client asks it to open them. Select **Start cameras**.                                  |
| **Opening cameras**     | The server is starting its cameras                                                                                                             |
| **Closing cameras**     | The server is shutting its cameras down; its video stops                                                                                       |
| **Camera start failed** | The cameras did not open. The card shows the server’s reason. Select **Start cameras** to try again; the server never retries by itself.       |
| **Needs setup**         | The server needs setup before it can stream                                                                                                    |
| **Locked by you**       | You hold the setup lock                                                                                                                        |
| **Locked by other**     | Another client holds the setup lock                                                                                                            |
| **Paused for setup**    | The server paused streaming for setup                                                                                                          |
| **Ready**               | Connected, not streaming                                                                                                                       |
| **Streaming**           | Connected and streaming                                                                                                                        |

## Fix card problems [#fix-card-problems]

* **The card says `Cameras closed` and shows no video**: select **Start cameras**. If the button is off and says the lock is held, ask the holder to release it. The server refuses to start a calibration while its cameras are off, so start them before you set up.
* **`Camera start failed`**: read the reason on the card, check the cable and power of the camera it names, then select **Start cameras** again.
* **A server older than this client shows no `Cameras closed` chip**: its cameras are always open. **Start cameras** is off with `this server does not report its cameras`.
* **Acquire lock is refused**: its tip names the holder. Ask them to release it, or wait: a lock runs out 15 seconds after its last renewal.
* **The lock is gone after a reconnect**: a lock never survives a reconnect. Acquire it again.
* **`Metadata is stale`**: select **Refresh** in the box.
* **`last close: …`**: see [Add a server](/docs/client/add-a-server#fix-connection-problems).
* **Pairs stays at 0**: a **Setup and control only** chip means your browser can’t decode the video. Otherwise, open **Details** and read the bundle rows.
* **You want to replay a recording**: select **Remove**, then open it again.
