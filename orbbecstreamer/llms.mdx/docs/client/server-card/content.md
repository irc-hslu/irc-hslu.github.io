# Read a server card (https://irc-hslu.github.io/orbbecstreamer/docs/client/server-card)





Every server you add, and every recording you open, gets a card under **Servers** in the side panel. The card shows that server’s state as your client sees it, and holds the buttons for that server. It refreshes on every change, and every half second for the countdowns and counters.

## Read the card from top to bottom [#read-the-card-from-top-to-bottom]

1. Read the **status label** in the top-left corner, for example `streaming`. It sums up the server’s state in one word. See [Status labels](#status-labels).
2. Read the **title** next to it: the server’s name, or its address until the server answers.
3. Check for an orange line under the title. It means something limits this client, for example a browser that can’t decode the video.
4. Read the fields: **lock**, **calibration**, **layout**, **counts**, **network** and **shared updates**.
5. Use the buttons at the bottom. When a button is unavailable, the reason is written under it.

## What you should see [#what-you-should-see]

<img alt="A server card for the Dev mock server: status streaming, the server ID and mock address, an orange Setup and control only line, the lock unlocked, three calibration rows, the layout with one bundle, the session counts, the round-trip time and budget, the Receive shared updates checkbox, and the Set up, Acquire lock, Refresh and Remove buttons, with Release lock and Reconnect unavailable" src="__img0" />

The browser that took this screenshot can’t decode HEVC, so it shows the `Setup and control only` line and no frames.

## What each line means [#what-each-line-means]

The lines under the title appear only when they apply:

* **`serverId: …`**: the server’s ID, then how the client reaches it: `webtransport https://…` for a server, `recording file://…` for a recording, `mock mock://…` for the mock server.
* **`waiting for the camera-pose calibration; the server accepts it without other setup`**: the server needs a camera-pose calibration before it can stream.
* **`resynchronising: waiting for a full snapshot`**: the client missed an update and is fetching the server’s full state. This clears by itself.
* **`reconnect scheduled`**: the connection was lost and the client will try again by itself.
* **`Setup and control only: this browser lacks …`**: this browser can’t decode or draw this server’s video. The card and the setup lock still work. See [Check your browser](/docs/client/browser-requirements).
* **`Protocol version mismatch; cannot connect.`**: the server uses another major protocol version. The client closes the connection and doesn’t retry.
* **`conflict: server … is already rendered by …; this entry is disconnected`**: another card already shows this server.
* **`last close: …`**: why the last connection ended.

The fields show `not known (not connected)` while there is no connection:

| Field              | What it shows                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **lock**           | Who holds the setup lock: `unlocked`, `held by this client, expires in 12 s`, or `held by Client A (…), last announced expiry in 9 s`.                                             |
| **calibration**    | One row each for `camera-pose`, `depth-quantization` and `network`: its state (`missing`, `valid`, `stale`, `running` or `failed`), its revision, and the server’s message if any. |
| **layout**         | How the server packs its cameras into bundles (`per-camera` or `concatenated`), then one row per bundle.                                                                           |
| **counts**         | For the current connection: `decoded pairs`, `uploaded`, `dropped` and `streams`.                                                                                                  |
| **network**        | The shortest round-trip time to the server, `min RTT`, and the server’s network budget.                                                                                            |
| **shared updates** | The **Receive shared updates** checkbox.                                                                                                                                           |

### Lock countdown [#lock-countdown]

While you hold the lock, the client renews it every 5 seconds, so the countdown starts again from 15 seconds. The server gives the expiry in its own clock. Until the client has measured the clock difference, the line shows the server’s time instead, for example `expires at server time 16.000 s (clock offset not known yet)`. If the countdown reaches zero before the server confirms the change, it shows `expiry time reached, waiting for the server`.

For another client’s lock, the card shows the last expiry the server announced. When that time has passed, the card shows `expiry passed as last announced; the server may have renewed it`. The other client may still hold the lock.

### Calibration rows [#calibration-rows]

A row is highlighted when its state is `failed`, or when `camera-pose` or `depth-quantization` isn’t `valid` and isn’t `running`. The server can’t stream until those two are valid. The `network` row never stops streaming.

### Bundle rows [#bundle-rows]

A bundle row reads, for example, `bundle-cam0: 1 camera, available; ready, drawing`. After the camera count comes the availability: `available` or `unavailable`, `, paused` when the server paused the bundle, and the server’s reason. Before the server announces it, the row says `availability not announced`.

The last part is the drawing status:

* `ready, drawing`: frames are on screen
* `ready, no frame yet`: waiting for the first frame
* `rendering incompatible (…): …`: the 3D view can’t draw this bundle
* `metadata invalid (…): …`: the server’s description of this bundle doesn’t add up
* `upload error: …`: the graphics card rejected a frame
* `no render status yet`: the 3D view hasn’t reported on this bundle yet

The row is highlighted when the bundle is unavailable or paused, or when its drawing status is a problem.

### Counts [#counts]

The counts start at zero with each new connection:

* **decoded pairs**: colour and depth frames the client decoded and matched
* **uploaded**: pairs sent to the graphics card
* **dropped**: pairs decoded but not drawn
* **streams**: video streams open now

Decoded pairs equal uploaded plus dropped, apart from pairs still on their way to the graphics card. After a disconnect, the card keeps the last connection’s counts.

### Network budget [#network-budget]

The budget line reads `no budget yet` until the server sends one. Then it reads, for example, `active 40.0 Mbit/s, server maximum 100.0 Mbit/s, safe for this client 35.0 Mbit/s, network compatible`:

* **active**: the budget the server applies now
* **server maximum**: the server’s own limit
* **safe for this client**: 70 % of the throughput measured for this client
* **`not network compatible (below the useful budget)`**: shown highlighted when this client is too slow to count in the budget

### Shared updates [#shared-updates]

Shared updates are calibration results and placement changes that the server sends to every client that asked for them. The **Receive shared updates (calibration results, placement)** checkbox is on by default:

* Turning it off stops them at once. Turning it on takes effect when the server accepts.
* While disconnected, the client stores your choice and sends it when it next connects.
* With it off, the server still tells your client that something changed. The card then shows `Metadata is stale: a shared update was withheld.` and a **Refresh stale metadata** button, which fetches the server’s full state.
* When the change also restarts the server’s video, as a placement change or a committed calibration does, the client fetches the full state by itself.

## What each button does [#what-each-button-does]

Every button stays in place when it’s unavailable, and the reason is written under it. The result of your last action appears at the bottom of the card, and screen readers announce it.

| Button           | What it does                                                                                                        | Unavailable when                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Set up**       | Opens the setup view for this server and takes its setup lock. See [Set up a server](/docs/client/setup-workspace). | `not connected`; `no connection`; `the source is invalid`; `the setup workspace is open for this server`; `the setup workspace is open for <name>; leave it first` |
| **Acquire lock** | Asks the server for its setup lock. The lock line changes once the server announces the new holder.                 | `not connected`; `this client already holds the lock`; `the lock is held by <name>`                                                                                |
| **Release lock** | Gives the lock back.                                                                                                | `not connected`; `this client does not hold the lock`                                                                                                              |
| **Refresh**      | Fetches the server’s full state.                                                                                    | `not connected`; `a snapshot is already being requested`                                                                                                           |
| **Reconnect**    | Connects again at once, without waiting for the automatic retry.                                                    | `already connecting`; `already connected`                                                                                                                          |
| **Remove**       | Disconnects, and removes the card and the server’s point clouds.                                                    | Always available                                                                                                                                                   |

**Acquire lock** only holds the lock. To calibrate or place the server, use **Set up**, which also takes over a lock you already hold. A browser that can’t decode video can still take the lock.

For a recording whose files were refused, every button except **Remove** is unavailable, with the reason `the source is invalid`.

Results at the bottom of the card look like this:

* `Acquire lock: accepted; waiting for the server's lock state`
* `Release lock: released`
* `Refresh: snapshot received`
* `Shared updates off: accepted by the server`, or `Shared updates off: stored; sent with the next hello` while disconnected
* `Reconnect: connected (session 2)`
* `<action> rejected (<code>): <message>`: the server refused. The code and message come from the server.
* `<action> failed (<reason>): <message>`: for example `failed (timeout)` when the server didn’t answer in time

## Status labels [#status-labels]

The label sums up the server’s state. The lock comes first: a server that streams while another client holds its lock shows `locked-by-other`.

| Label              | Meaning                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connecting`       | Opening the connection, or waiting for the server’s first answer                                                                                                       |
| `disconnected`     | No connection, for example after a conflict. After the server closes the connection, the client retries, so the label goes back to `connecting`.                       |
| `error`            | The last connection failed, or the recording’s files were refused. The client retries a server unless the protocol versions don’t match. It never retries a recording. |
| `needs-setup`      | Connected; the server needs setup before it can stream                                                                                                                 |
| `locked-by-me`     | Connected; this client holds the setup lock                                                                                                                            |
| `locked-by-other`  | Connected; another client holds the setup lock                                                                                                                         |
| `paused-for-setup` | Connected; the server paused streaming for setup                                                                                                                       |
| `ready`            | Connected and ready, not streaming                                                                                                                                     |
| `streaming`        | Connected and streaming                                                                                                                                                |

## Fix card problems [#fix-card-problems]

These are the common card problems and their fixes:

* **Acquire lock is refused**: `the lock is held by <name>` under the button means another client holds it. Ask that person to release it. A lock whose holder disappeared runs out 15 seconds after its last renewal.
* **The lock is gone after a reconnect**: a lock never survives a reconnect. Acquire it again.
* **`Release lock failed (no-lease)`**: your client doesn’t hold the lock any more, for example because it ran out. Nothing needs releasing.
* **`Metadata is stale: a shared update was withheld.`**: shared updates are off, and another client changed something. Select **Refresh stale metadata**.
* **`Refresh server error <code>: <message>`**: the server couldn’t answer. Try again.
* **The lock shows `expires at server time …`**: the client is still measuring the clock difference. The countdown appears by itself after a few round trips.
* **The card stays `error` with `reconnect scheduled`**: select **Reconnect** to try at once. If it keeps failing, read the **last close** line and see [Add a server](/docs/client/add-a-server).
* **Counts at 0 and `ready, no frame yet` right after a reconnect**: the new connection is waiting for its first frames. If the counts stay at 0, check that the server is streaming and that the card shows no `Setup and control only` line.
* **`Reconnect failed: closed locally: server <id> is already connected through <entry>`**: another card still shows that server. Remove one of the two.
* **You want to replay a recording**: **Reconnect** is unavailable while connected. Select **Remove**, then open the recording again.
