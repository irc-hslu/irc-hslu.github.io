# Setup workspace (https://irc-hslu.github.io/orbbecstreamer/docs/client/setup-workspace)





## What it is [#what-it-is]

The setup workspace is a focused view for **one server at a time**. You
open it from that server's card with **Set up**. It then replaces the side
panel's content; the 3D view stays usable.

Opening it takes the server's setup lock. While you hold the lock, the
workspace lets you run and commit the server's calibrations. See
[Calibration](/docs/client/calibration) for the calibration sections.

The workspace never commits anything by itself. A calibration result comes
into force only when you select **Commit**. When you leave, or the lock or
the connection is lost, the client discards its own copy of an
uncommitted result. What the server does with it is not defined by the
protocol contract yet (change request 0012 is open); the mock server
drops it.

The workspace also has a **Placement** section, where you edit the
server's placement as a local draft and commit it; see
[Placement editing](/docs/client/placement-editing). A placement draft is
kept in memory when you leave the workspace (a reload loses it), and is
only sent when you select **Commit placement**.

## How to use it [#how-to-use-it]

### Open it [#open-it]

1. Connect a server (see [Add a server](/docs/client/add-a-server)) and
   wait until its card shows a live status such as `ready` or
   `streaming`.
2. On the card, select **Set up**.

The workspace opens and asks the server for the setup lock at once.

**Set up** is unavailable, with the reason under the button, when:

* `not connected`: the card has no live session;
* `the source is invalid`: a recording whose files were rejected;
* `no connection`: the entry has no connection object at all;
* `the setup workspace is open for this server`, or
  `the setup workspace is open for <name>; leave it first`: a workspace is
  already open. Only one can be open at a time.

**Set up** is available while another client holds the lock. Opening the
workspace then shows the refusal; see [Troubleshooting](#troubleshooting).

### What it shows [#what-it-shows]

<img alt="The setup workspace open for a mock server: the Leave setup button, the session and lock lines with the lease countdown, the camera pose section with its red TODO placeholder, and the depth quantization and network sections" src="__img0" />

From the top:

* **Status label and title:** `Set up: <server name>`, with the card's
  status label (`locked-by-me` while you hold the lock).
* **Controls:**
  * **Leave setup (release lock)** while the session is active or
    acquiring the lock;
  * **Back to servers** once the session has ended;
  * **Enter setup again** once the session has ended and the server is
    still connected.
* **session:** where the session is:
  * `acquiring the setup lock…`
  * `active: this client holds the setup lock`
  * `leaving: cancelling runs and releasing the lock…`
  * `ended`
* **lock:** `held by this client, expires in 14 s`, as on the server card.
  The client renews the lock every 5 s, so the countdown restarts from
  15 s. Until clock sync has a result it shows the server time instead,
  for example `expires at server time 16.000 s (clock offset not known yet)`.
  While asking for the lock: `requested, not held yet`. After the session
  ended: `not held by this client`.
* A **hint** when the server waits for its camera-pose calibration:
  `The server waits for a camera-pose calibration, which it accepts without other setup.`
* An **exit box** when the session has ended (see below).
* Three **calibration sections**: Camera pose, Depth quantization and
  Network. See [Calibration](/docs/client/calibration).
* The **Placement** section: the server's placement (anchor, revision,
  translation, yaw / pitch / roll) and the draft editor. See
  [Placement editing](/docs/client/placement-editing).

Every button stays focusable when it is unavailable, and its reason is
written under it; while its request is waiting for an answer it shows
`in progress`. Accessible names include the server name, for example
"Leave setup (release lock), Rig A".

Keyboard focus and screen readers:

* Opening the workspace moves focus to its heading.
* **Enter setup again** moves focus to the heading too, since the button
  disappears while the lock is requested.
* When the workspace closes (**Back to servers**, or a clean leave), focus
  returns to that server's **Set up** button, and the side panel
  announces how the session ended, followed by
  `Setup workspace closed.`
* Results and exits are announced as they happen. A progress summary is
  announced at most every 5 s, and the latest one at the end of each
  5 s window. The same result after a new action is announced again.

### Leave it [#leave-it]

Select **Leave setup (release lock)**. The client first cancels any
calibration that is still running, then releases the lock. When the
release succeeds, the workspace closes and the server cards come back.

Nothing is committed on the way out. The client discards its copy of a
calibration result you did not commit. A placement draft is kept, but no
longer drawn in the 3D view, until you open the workspace again, discard
it, or remove the server.

If the release fails, the workspace stays open with
`Could not release the setup lock (<reason>): <message>. The session stays active; try Leave again.`

### When the session ends without you [#when-the-session-ends-without-you]

The exit box explains why. For a forced exit it always adds
`Nothing was committed.`

| Exit box                                                              | Meaning                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Could not enter setup. The setup lock is held by <name>.`            | Another client holds the lock.                                                     |
| `Could not enter setup. Could not acquire the setup lock: <message>.` | The server refused the lock for another reason.                                    |
| `Could not enter setup. Not connected to the server.`                 | The session was not live when you opened the workspace.                            |
| `Forced out of setup. The setup lease expired.`                       | This client's lock ran out, for example because renewals did not reach the server. |
| `Forced out of setup. The setup lease was lost: <message>.`           | The server rejected a renewal.                                                     |
| `Forced out of setup. The server ended the setup lease.`              | The server announced the lock free without a release from you.                     |
| `Forced out of setup. The setup lock is held by <name>.`              | Another client took over the lock.                                                 |
| `Forced out of setup. The connection closed: <reason>.`               | The session to the server ended. A lock never survives a reconnect.                |

When a result was waiting for **Commit**, the box also says
`The client discarded the uncommitted depth quantization result.`

Select **Enter setup again** to ask for the lock again, or
**Back to servers** to close the workspace.

## Expected result [#expected-result]

* **Set up** opens the workspace. Within a moment the session line reads
  `active: this client holds the setup lock`, the lock line counts down
  from 15 s, and the status label is `locked-by-me`. Other clients show
  `locked-by-other` with this client's name.
* **Leave setup (release lock)** closes the workspace, and every client
  shows the server `unlocked` again.
* While the workspace is open, the server cards and the World anchors
  section are hidden; the 3D view keeps drawing every server, and draws
  this server at your placement draft while you have one.

The workspace does not move the 3D camera to the server's point cloud yet.

## Troubleshooting [#troubleshooting]

* **`Could not enter setup. The setup lock is held by <name>.`:** another
  operator is setting up this server. Ask them to leave setup, or wait:
  a lock whose holder disappeared expires 15 s after its last renewal.
  Then select **Enter setup again**.
* **`Forced out of setup. The setup lease expired.` in the middle of a
  run:** the lock ran out. The client committed nothing. What the server
  does with a run whose lock ends is not defined by the protocol contract
  yet (change request 0012 is open); the mock server cancels it. Check
  the connection (the card's network line and last close), then select
  **Enter setup again**. If the state line still shows `running`, the run
  continued on the server; otherwise start it again.
* **`Forced out of setup. The connection closed: …`:** the session ended.
  Select **Back to servers**, wait until the card is live again (the
  client reconnects by itself), then select **Set up** again.
* **A result was never committed:** a result comes into force only with
  **Commit**. When you leave or lose the lock, the client discards its
  copy. Run the calibration again and commit it before leaving.
* **`Could not release the setup lock …`:** the server did not accept the
  release. Select **Leave setup (release lock)** again. If the connection
  is gone, the lock ends on the server 15 s after its last renewal.
* **Set up says `the setup workspace is open for <name>; leave it first`:**
  only one workspace can be open. Leave that one first.
