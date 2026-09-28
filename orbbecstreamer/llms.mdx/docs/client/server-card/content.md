# Read the server card (https://irc-hslu.github.io/orbbecstreamer/docs/client/server-card)





## What it is [#what-it-is]

Every server you add, and every recording you open, gets a **server card**
in the side panel under **Servers**. The card shows that server's state as
this client sees it, and has the actions for it: open the setup workspace,
take or release the setup lock, refresh the state, reconnect, and remove.

The card refreshes on every state change, and every 0.5 s for the lease
countdown, the RTT and the frame counters.

<img alt="A server card for a connected mock server: status streaming, server id and source, the lock, calibration per kind, layout, per-session counts, round-trip time and budget, the shared-updates checkbox and the Set up, Acquire lock, Release lock, Refresh, Reconnect and Remove actions. Captured in a browser without HEVC decoding, so the card shows the setup-and-control-only note and no frames" src="__img0" />

## How to use it [#how-to-use-it]

### Header [#header]

* **Status label:** one word derived from the server's state. See
  [Status labels](#status-labels).
* **Title:** the server's name, or the URL until the server has answered.
* **Notes under the header**, shown only when they apply:
  * `waiting for the camera-pose calibration; the server accepts it without other setup`:
    the status is `needs-setup`, and the server is waiting for its
    camera-pose calibration, which it will accept without other setup.
  * `resynchronising: waiting for a full snapshot`: the client saw an
    unexpected update and is fetching the server's full state.
  * `reconnect scheduled`: the session was lost and the client will try
    again by itself.
* **Id line:** `serverId: …` (or `serverId: not known yet`), then the
  source:
  * `webtransport https://capture-01.local:4433/orbbec` for a server;
  * `recording file://<serverId>` for a recording.
* **Compatibility line**, shown only when something is missing:
  * `Setup and control only: this browser lacks HEVC Main10 depth decoding.`
    (or colour decoding, or a WebGPU or WebGL2 backend): this browser
    cannot decode or render the server's streams. The card and its lock
    still work. See
    [Browser requirements](/docs/client/browser-requirements).
  * `Protocol version mismatch; cannot connect.`: the server speaks
    another major protocol version. The client closes the session and
    does not retry.
* **Conflict**, shown when another card already shows the same server id:
  `conflict: server capture-01 is already rendered by entry-1; this entry is disconnected`.
* **Last close:** why the last session ended, for example
  `last close: transport error: …`.
* **Source issues:** a list of problems when a recording cannot be opened.
  See [Play back .hevc recordings](/docs/client/playback).

### Fields [#fields]

The lock, calibration and layout fields show `not known (not connected)`
while there is no live session.

| Field              | What it shows                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **lock**           | `unlocked`; `held by this client, expires in 12 s`; or `held by Client A (client-…), last announced expiry in 9 s` (the other client's name and id).                                                                                        |
| **calibration**    | One row per kind: `camera-pose`, `depth-quantization` and `network`, each with its state (`missing`, `valid`, `stale`, `running` or `failed`), its revision, and the server's message if any. For example `camera-pose: valid, revision 3`. |
| **layout**         | The stream layout (`concatenated` or `per-camera`) and the bundle count, then one row per bundle: its camera count, its availability, and its render status.                                                                                |
| **counts**         | `this session: decoded pairs N · uploaded N · dropped N · streams N`.                                                                                                                                                                       |
| **network**        | The minimum round-trip time from clock sync (`min RTT 0.42 ms`), and the server's network budget.                                                                                                                                           |
| **shared updates** | The **Receive shared updates** checkbox, and a stale-metadata notice when one applies.                                                                                                                                                      |

**Lock expiry.** The server sends the expiry in its own clock. The card
converts it into a countdown with the clock offset measured by clock
sync. Until clock sync has a result, it shows the raw server time
instead, for example
`expires at server time 16.000 s (clock offset not known yet)`. When the
countdown reaches zero before the server has announced the change, it
shows `expiry time reached, waiting for the server`. While this client
holds the lock, it renews it every 5 s, so the countdown restarts from
15 s.

**Another client's lock** shows the expiry the server **last announced**,
for example `last announced expiry in 9 s`. The holder also renews every
5 s, but this client learns the new expiry only if the server announces
the lock state again after each renewal. That re-announcement is the
client's proposal in change request 0008, not yet part of the protocol
contract. When the announced time has passed, the card shows
`expiry passed as last announced; the server may have renewed it`: the
lock may still be held, and the lock line changes only when the server
announces it.

**Calibration rows** are highlighted when a kind has `failed`, or when
`camera-pose` or `depth-quantization` is not `valid` (and not
`running`): the server cannot stream until those two are valid. The
`network` kind is per client and never blocks streaming.

**Bundle rows**, for example
`bundle-cam0: 1 camera, available; ready, drawing`:

* Availability: `available` or `unavailable`, then `, paused` if the
  server paused the bundle, then the server's reason, if any. Before the
  server has announced it: `availability not announced`.
* Render status:
  * `ready, drawing`
  * `ready, no frame yet`
  * `rendering incompatible (…): …`
  * `metadata invalid (…): …`
  * `upload error: …`
  * `no render status yet`

The row is highlighted when the bundle is unavailable or paused, or its
render status is a problem.

**Counts** belong to the current session, from its handshake on:

* "decoded pairs" counts matched colour and depth frames.
* "uploaded" counts pairs sent to the GPU.
* "dropped" counts pairs decoded but not drawn.
* "streams" counts the media streams open now.

Decoded pairs equal uploaded plus dropped, give or take the pairs still
on their way to the GPU. After a disconnect the card keeps the last
session's counts. A reconnect starts them from zero, and they stay at 0
until the new session's first frames arrive. The bundle row shows
`ready, no frame yet` until then.

**Network budget:** `no budget yet` until the server sends one. After
that it reads, for example,
`active 40.0 Mbit/s, server maximum 100.0 Mbit/s, safe for this client 35.0 Mbit/s, network compatible`:

* "active" is the budget the server currently applies;
* "server maximum" is the server's own limit;
* "safe for this client" is 70 % of the throughput measured for this
  client;
* `not network compatible (below the useful budget)`, highlighted, means
  this client is too slow to be counted in the budget.

**Shared updates.** Calibration results and placement changes are
*shared updates*: the server sends them to every client that asked for
them.

* The checkbox **Receive shared updates (calibration results, placement)**
  is on by default.
* Turning it off stops them at once. Turning it on takes effect when the
  server accepts.
* While disconnected, the choice is stored and sent when the client next
  connects.
* With it off, the server still tells this client that something changed.
  The card then shows
  `Metadata is stale: a shared update was withheld.` and a
  **Refresh stale metadata** button, which fetches the server's full state.
* When the change also restarts the server's streams, as a placement
  change or a committed calibration does, the client fetches the full
  state by itself, so the card does not stay stale.

### Actions [#actions]

Every action is a button. When an action is not possible, its button
stays focusable and the reason is written under it. The result of the
last action appears in a line at the bottom of the card; screen readers
announce it.

| Action           | What it does                                                                                                                                                                                                                                                                                              | Not possible when (reason shown)                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Set up**       | Opens the [setup workspace](/docs/client/setup-workspace) for this server in place of the server list, and takes its setup lock.                                                                                                                                                                          | `not connected`; `no connection`; `the source is invalid`; `the setup workspace is open for this server`; `the setup workspace is open for <name>; leave it first` |
| **Acquire lock** | Asks the server for its setup lock. The lock line changes once the server announces the new owner.                                                                                                                                                                                                        | `not connected`; `this client already holds the lock`; `the lock is held by <name>`                                                                                |
| **Release lock** | Gives the lock back.                                                                                                                                                                                                                                                                                      | `not connected`; `this client does not hold the lock`                                                                                                              |
| **Refresh**      | Fetches the server's full state (a snapshot).                                                                                                                                                                                                                                                             | `not connected`; `a snapshot is already being requested`                                                                                                           |
| **Reconnect**    | Starts a new session at once, without waiting for the automatic retry. After a conflict it tries again: if another card still shows the same server, it fails with the conflict (`Reconnect failed: closed locally: server <id> is already connected through <entry>`) and the card stays `disconnected`. | `already connecting`; `already connected`                                                                                                                          |
| **Remove**       | Disconnects and removes the card and the server's point clouds. Always possible.                                                                                                                                                                                                                          |                                                                                                                                                                    |

A browser that cannot decode HEVC can still take the lock. The lock is a
setup tool, not a viewing one.

For a recording whose files were rejected, every action except
**Remove**, and the **Receive shared updates** checkbox, is unavailable,
with the reason `the source is invalid`.

Every control's accessible name includes the card's title, for example
"Acquire lock, Rig A", so screen readers can tell cards apart. When two
cards have the same title (as in a conflict), the name adds the server
id and the entry id.

Results in the bottom line:

* `Acquire lock: accepted; waiting for the server's lock state`
* `Release lock: released`
* `Refresh: snapshot received`
* `Shared updates off: accepted by the server`, or
  `Shared updates off: stored; sent with the next hello` while
  disconnected
* `Reconnect: connected (session 2)`
* `<action> rejected (<code>): <message>`: the server refused it. The code
  and message are the server's own; the protocol does not fix them. For
  example, from the mock server:
  `Acquire lock rejected (lock-held): setup lock held by Client A`.
* `<action> server error <code>: <message>`: the server answered with an
  error; again the code is the server's own.
* `<action> failed (<reason>): <message>`, for example `failed (timeout)`
  when the server did not answer in time
* `Reconnect failed: <why the session ended>`

### Status labels [#status-labels]

| Label              | Meaning                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connecting`       | Opening the session or waiting for the server's hello                                                                                                |
| `disconnected`     | No session, for example after a conflict or a close by the server. After a server close the client retries, so the label cycles back to `connecting` |
| `error`            | The last session failed (a reconnect is scheduled unless it was a version mismatch), or the source was invalid                                       |
| `needs-setup`      | Connected; the server needs setup before it can stream                                                                                               |
| `locked-by-me`     | Connected; this client holds the server's setup lock                                                                                                 |
| `locked-by-other`  | Connected; another client holds the setup lock                                                                                                       |
| `paused-for-setup` | Connected; streaming is paused for setup                                                                                                             |
| `ready`            | Connected and ready, not streaming                                                                                                                   |
| `streaming`        | Connected and streaming                                                                                                                              |

The lock comes before readiness and streaming: a server that is
streaming while another client holds its lock shows `locked-by-other`.

## Expected result [#expected-result]

* A new card appears at once with `connecting`, then the server's name,
  its id and a live status (`ready`, `streaming` or `needs-setup`).

* The lock line reads `unlocked`, the calibration rows list three kinds,
  and the layout lists the server's bundles.

* **Acquire lock** turns the label into `locked-by-me`, and the lock line
  counts down from 15 s, restarting every 5 s. Other clients show
  `locked-by-other` and the name of this client.

* **Release lock** returns every client to `unlocked`.

* **Set up** replaces the server list with the setup workspace for this
  server and takes the lock; leaving the workspace brings the cards back.
  See [Setup workspace](/docs/client/setup-workspace).

**Acquire lock** on the card only holds the lock. To run calibrations, use
**Set up**; it adopts a lock this client already holds.

## Troubleshooting [#troubleshooting]

* **Acquire lock is refused:**
  * `the lock is held by <name>` under the button, or
    `Acquire lock rejected (<code>): <message>` (from the mock server:
    `Acquire lock rejected (lock-held): …`): another client holds it. Ask
    that operator to release it. A lock whose holder disappeared expires
    15 s after its last renewal.
  * `not connected`: the session is not up. Wait for it, or use
    **Reconnect**.
* **The lock is gone after a reconnect:** expected. A lock never survives
  a reconnect. Acquire it again.
* **`Release lock failed (no-lease)`:** this client does not hold the lock
  any more, for example because it expired. Nothing needs releasing.
* **`Metadata is stale: a shared update was withheld.`:** shared updates
  are off, and another client changed something. Select
  **Refresh stale metadata**, or turn shared updates back on and then
  refresh.
* **`Refresh server error <code>: <message>`:** the server could not
  answer the refresh (from the mock server: `Refresh server error busy: …`).
  Try again.
* **The lock shows `expires at server time …`:** clock sync has not
  finished. It needs a few round trips after connecting; the countdown
  appears by itself.
* **`budget: no budget yet`:** the server has not sent a network budget
  to this client.
* **The card stays `error` with `reconnect scheduled`:** the client
  retries after 1 s, doubling the wait up to 30 s. Select **Reconnect** to
  try at once. If it keeps failing, read the **last close** line and see
  [Add a server](/docs/client/add-a-server).
* **Counts at 0 and `ready, no frame yet` right after a reconnect:**
  expected for a moment. The new session starts its counts from zero and
  waits for its first frames. If they stay at 0, check that the server is
  streaming and that no compatibility line is shown.
* **`Reconnect failed: …`:** the new session could not be opened. The
  text after the colon is the reason, as in the **last close** line.
  `closed locally: server <id> is already connected through <entry>`
  means another card still shows that server: remove one of the two.
* **To replay a recording:** **Reconnect** is unavailable while the card
  is connected. Select **Remove**, then open the recording again.
