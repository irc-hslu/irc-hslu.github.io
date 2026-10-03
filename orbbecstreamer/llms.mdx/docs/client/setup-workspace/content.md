# Set up a server (https://irc-hslu.github.io/orbbecstreamer/docs/client/setup-workspace)





The setup view is where you change one server’s setup: its depth calibration and its placement. You open it from the server’s card, one server at a time. It takes the server’s setup lock, so no other client can change the server while you work.

The setup view never commits anything by itself. A calibration result or a placement change reaches the server only when you select its **Commit** button.

## Open the setup view [#open-the-setup-view]

1. Connect the server. See [Add a server](/docs/client/add-a-server).
2. Wait until its card shows a live status, such as `ready` or `streaming`.
3. On the card, select **Set up**.

The setup view replaces everything in the side panel below the header: the forms, the server cards and the World anchors section. It asks the server for the setup lock at once. The 3D view stays usable.

## What you should see [#what-you-should-see]

<img alt="The setup view for the Dev mock server: the locked-by-me label, the Leave setup (release lock) button, the session line saying this client holds the setup lock, the lock countdown, the Camera pose section with its red TODO placeholder, the Depth quantization section with its three buttons, and the Network section, which is not available yet" src="__img0" />

From the top, the setup view shows:

* **Title**: `Set up: <server name>`, with the status label. It reads `locked-by-me` while you hold the lock.
* **Buttons**: **Leave setup (release lock)** while you’re in setup. After the session ends: **Back to servers**, and **Enter setup again** if the server is still connected.
* **session**: `acquiring the setup lock…`, then `active: this client holds the setup lock`. When you leave: `leaving: cancelling runs and releasing the lock…`, then `ended`.
* **lock**: for example `held by this client, expires in 14 s`. The client renews the lock every 5 seconds, so the countdown starts again from 15 seconds.
* **Camera pose**: the section’s state, then a red `TODO`. Camera-pose calibration isn’t available in the client yet.
* **Depth quantization**: run and commit a depth calibration. See [Calibrate depth](/docs/client/calibration).
* **Network**: network calibration isn’t available yet.
* **Placement**: move the server in the scene. See [Place a server in the scene](/docs/client/placement-editing).

Other clients show the server as `locked-by-other`, with your client’s name. While the setup view is open, the 3D view keeps drawing every server. It doesn’t move the camera to the server you’re setting up.

When a button is unavailable, the reason is written under it. While a request waits for the server’s answer, its button shows `in progress`.

## Use a keyboard or screen reader [#use-a-keyboard-or-screen-reader]

When the setup view opens, keyboard focus moves to its title. Unavailable buttons stay reachable with the keyboard, so you can hear their reason.

Screen readers announce these without moving focus:

* **Results and exits**, at once: for example a calibration result that waits for **Commit**, or why the session ended.
* **Start, Cancel and Commit outcomes**, at once, named by their section: for example `Depth quantization: Commit: accepted; the new revision comes into force with the server update.` Nothing is announced for a section while one of its requests waits for the server’s answer.
* **Progress of a running calibration**, at most every 5 seconds: for example `Depth quantization running: <time>, <count> valid samples.`

When a message no longer applies, for example progress after the run ended, it is cleared and not read again.

## Leave the setup view [#leave-the-setup-view]

Select **Leave setup (release lock)**. The client cancels any calibration that’s still running, then releases the lock. The setup view closes at once and the server cards come back, with no message on screen. Screen readers announce `Left setup: the setup lock was released. Setup workspace closed.` Every client then shows the server `unlocked`.

The client commits nothing on the way out:

* A calibration result you didn’t commit is thrown away, without a message on screen. The server card’s calibration row keeps the old revision. Screen readers also hear `Nothing was committed. The client discarded the uncommitted depth quantization result.`
* A placement draft stays in this browser tab until you return, discard it, or remove the server. It isn’t drawn while the setup view is closed.

## When the session ends without you [#when-the-session-ends-without-you]

A box explains why the session ended. When you were forced out, it adds `Nothing was committed.`

| Message                                                               | What happened                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Could not enter setup. The setup lock is held by <name>.`            | Another client holds the lock.                                           |
| `Could not enter setup. Could not acquire the setup lock: <message>.` | The server refused the lock for another reason.                          |
| `Could not enter setup. Not connected to the server.`                 | The server wasn’t connected when you opened setup.                       |
| `Forced out of setup. The setup lease expired.`                       | Your lock ran out, for example because renewals didn’t reach the server. |
| `Forced out of setup. The setup lease was lost: <message>.`           | The server refused a renewal.                                            |
| `Forced out of setup. The server ended the setup lease.`              | The server freed the lock without a release from you.                    |
| `Forced out of setup. The setup lock is held by <name>.`              | Another client took the lock.                                            |
| `Forced out of setup. The connection closed: <reason>.`               | The connection to the server ended. A lock never survives a reconnect.   |

If a calibration result was waiting for **Commit**, the box also says `The client discarded the uncommitted depth quantization result.`

Select **Enter setup again** to ask for the lock again, or **Back to servers** to close the setup view.

## Fix setup problems [#fix-setup-problems]

These are the common setup problems and their fixes:

* **`Could not enter setup. The setup lock is held by <name>.`**: someone else is setting up this server. Ask them to leave setup, or wait: a lock whose holder disappeared runs out 15 seconds after its last renewal. Then select **Enter setup again**.
* **Forced out in the middle of a calibration run**: the client committed nothing. Check the card’s **network** and **last close** lines, then select **Enter setup again**. If the depth section still shows `running`, the run went on without you; otherwise start it again.
* **`Forced out of setup. The connection closed: …`**: select **Back to servers**, wait until the card is live again, then select **Set up** again. The client reconnects by itself.
* **A calibration result never came into force**: a result needs **Commit**. The client throws it away when you leave or lose the lock. Run the calibration again and commit it before you leave.
* **`Could not release the setup lock (<reason>): <message>. The session stays active; try Leave again.`**: select **Leave setup (release lock)** again. If the connection is gone, the lock runs out on the server 15 seconds after its last renewal.
* **Set up says `the setup workspace is open for <name>; leave it first`**: only one setup view can be open at a time. Leave the other one first.
* **Set up is unavailable with `not connected`**: wait until the card shows a live status.
* **You can’t set up a recording**: recordings refuse the setup lock. Edit the recording’s files instead. See [Play a recording](/docs/client/playback).
