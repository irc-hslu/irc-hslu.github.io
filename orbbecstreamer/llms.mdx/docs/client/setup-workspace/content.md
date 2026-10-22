# Set up a server (https://irc-hslu.github.io/orbbecstreamer/docs/client/setup-workspace)





The setup view changes one server’s setup: its depth calibration and its placement. It holds the server’s setup lock, so no other client can change the server while you work. It never commits anything by itself: a result or a placement change reaches the server only when you select its **Commit** button.

## Who can set up [#who-can-set-up]

Setting up needs the operator role. The server gives it only to a page opened on the server machine, from the console address set in the server’s configuration. Elsewhere the card shows **Viewer** after the server name and address, and **Set up**, **Acquire lock** and placement **Edit** are off with the tip `needs the operator role (open on the server machine)`. Viewing the server is not affected.

## Open the setup view [#open-the-setup-view]

1. Wait until the server’s card shows **Ready** or **Streaming**.
2. On the card, select **Set up**.

The setup view replaces **Servers** and **World anchors**, and asks for the setup lock at once. The header, **View** and the 3D view stay.

The 3D view also jumps once to frame this server’s cloud, keeping your viewing direction. The fit comes from the server’s camera positions (with its placement) and depth range, not from the points. If the server has no geometry yet, the view frames once when its first picture arrives. Any input on the 3D view (a click or drag, scrolling, or a key press), **Leave** or closing the view cancels that wait, and **Enter setup** doesn’t frame again.

<img alt="The setup view for the Dev mock server: SET UP and the name with Leave; the Locked by you, Active and 15 s lock chips; Camera pose with its state and the Operator Console link; Depth quantization with Start, Cancel and Commit; Network, Not available yet" src="__img0" />

* **Title**: **SET UP** and the server’s name, with **Leave**. After the session ends: **Back**, and **Enter setup** if the server is still connected.
* **Chips**: the status (**Locked by you**), the session (**Acquiring…**, **Active**, **Leaving…** or **Ended**) and the lock countdown, which restarts at 15 s with each renewal every 5 s. Hover over a chip for its full sentence.
* **Camera pose**: its state (for example `valid, revision 3`, with the server’s message if it sent one) and the link **Run camera-pose calibration in the Operator Console**, which opens `/operator/calibration/pose` in a new tab. The client does not calibrate poses itself. While a run is going, perhaps one started in the console, the step says **A camera-pose run is in progress in the Operator Console.**, and **Solved: awaiting commit, not in force until committed.** once it has solved. With the viewer role the link stays, and the note under it says camera-pose calibration `needs the operator role (open on the server machine)`; otherwise the note reads **Open it on the server machine.** See [the Operator Console](/docs/operator#calibrate-the-camera-poses) for the calibration itself.
  When the server reports quality, the step also shows up to three lines under the state: **Committed:** the reprojection error in px and the worst pair of neighbouring cameras in mm; **Current run:** the same for the latest solve of a run in progress; and **Last result (accepted)** or **Last result (not accepted)**. On the **Committed:** line, a figure ends with **(above target)** when the server’s own advisories say it is above the server’s target; the other lines are never flagged. The per-camera and per-pair detail is in the Operator Console.
* **Depth quantization**: see [Calibrate depth](/docs/client/calibration).
* **Auto-calibrate (no board)**: under Camera pose, shown only when the server offers it. Refines the poses from the scene itself and never commits by itself. See [Auto-calibrate without a board](/docs/client/auto-calibrate).
* **Floor**: shown only when the server offers it. See [Calibrate the floor](/docs/client/calibrate-floor).
* **Network**: **Not available yet**.
* **Placement**: see [Place a server in the scene](/docs/client/placement-editing).

## What the server tells you and what to do next [#what-the-server-tells-you-and-what-to-do-next]

When the server reports calibration quality, a step can show an amber box under its state with one line per advisory: the advisory in bold with a full stop, then **Next:** and what to do about it on its own line, for example **Reprojection error is above the target.** / **Next:** Hold the board flat and still, cover more of each camera view, then recalibrate. The lines are in the server’s order, most important first. Camera pose, Depth quantization and Floor each show their own. An advisory this client doesn’t know yet appears as the server’s code, with no **Next:** part. A step with no advisories shows no box, and a server that doesn’t report quality never does. The same advisories appear as a chip on the [server card](/docs/client/server-card).

Other clients show **Locked by other**. Unavailable buttons show their reason as a tip; a waiting request shows a spinner.

## Use a keyboard or screen reader [#use-a-keyboard-or-screen-reader]

When the setup view opens, keyboard focus moves to its title. Unavailable buttons stay reachable with the keyboard, so you can hear their reason. A chip with more to say than its label, such as **Not available yet** or **Awaiting camera pose**, is a tab stop too and shows its full sentence. **Escape** hides a tip.

Screen readers announce these without moving focus:

* **Results and exits**, at once: for example a calibration result that waits for **Commit**, or why the session ended.
* **Start, Cancel and Commit outcomes**, at once, named by their section: for example `Depth quantization: Commit: accepted; the new revision comes into force with the server update.` Nothing is announced for a section while one of its requests waits for the server’s answer.
* **Progress of a running calibration**, at most every 5 seconds: for example `Depth quantization running: <time>, <count> valid samples.`

When a message no longer applies, for example progress after the run ended, it is cleared and not read again.

## Leave the setup view [#leave-the-setup-view]

Select **Leave**. The client cancels any calibration that’s still running, then releases the lock. The setup view closes at once and the server cards come back, with no message on screen. Screen readers announce `Left setup: the setup lock was released. Setup workspace closed.` Every client then shows the lock as free.

The client commits nothing on the way out:

* A calibration result you didn’t commit is thrown away, without a message on screen. The server card’s calibration row keeps the old revision. Screen readers also hear `Nothing was committed. The client discarded the uncommitted depth quantization result.`
* A placement draft stays in this browser tab until you return, discard it, or remove the server. It isn’t drawn while the setup view is closed.

## When the session ends without you [#when-the-session-ends-without-you]

A box explains why the session ended. When you were forced out, it adds `Nothing was committed.`

| Message                                                               | What happened                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Could not enter setup. The setup lock is held by <name>.`            | Another client holds the lock.                                                                                                                                                                                      |
| `Could not enter setup. Could not acquire the setup lock: <message>.` | The server refused the lock for another reason.                                                                                                                                                                     |
| `Could not enter setup. Not connected to the server.`                 | The server wasn’t connected when you opened setup.                                                                                                                                                                  |
| `Forced out of setup. The setup lease expired.`                       | Your lock ran out, for example because renewals didn’t reach the server, or the browser discarded or froze the tab. See [When the tab is in the background](/docs/client/viewer#when-the-tab-is-in-the-background). |
| `Forced out of setup. The setup lease was lost: <message>.`           | The server refused a renewal.                                                                                                                                                                                       |
| `Forced out of setup. The server ended the setup lease.`              | The server freed the lock without a release from you.                                                                                                                                                               |
| `Forced out of setup. The setup lock is held by <name>.`              | Another client took the lock.                                                                                                                                                                                       |
| `Forced out of setup. The connection closed: <reason>.`               | The connection to the server ended. A lock never survives a reconnect.                                                                                                                                              |

If a calibration result was waiting for **Commit**, the box also says `The client discarded the uncommitted depth quantization result.`

Select **Enter setup** to ask for the lock again, or **Back** to close the setup view.

## Fix setup problems [#fix-setup-problems]

* **`Could not enter setup. The setup lock is held by <name>.`**: someone else is setting up this server. Ask them to leave setup, or wait: a lock whose holder disappeared runs out 15 seconds after its last renewal. Then select **Enter setup**.
* **Forced out in the middle of a calibration run**: the client committed nothing. Check the card’s `last close` box, then select **Enter setup**. If the depth section still shows **running**, the run went on without you; otherwise start it again.
* **Forced out of setup after the computer slept**: a lock runs out 15 seconds after its last renewal, and a sleeping computer sends none. The client ends setup as soon as it hears from the server again, and it re-measures the clock difference to the server at once, so the lock countdown is right again. Select **Enter setup** again.
* **`Forced out of setup. The connection closed: …`**: select **Back**, wait until the card is live again, then select **Set up** again. The client reconnects by itself.
* **A calibration result never came into force**: a result needs **Commit**. The client throws it away when you leave or lose the lock. Run the calibration again and commit it before you leave.
* **`Could not release the setup lock (<reason>): <message>. The session stays active; try Leave again.`**: select **Leave** again. If the connection is gone, the lock runs out on the server 15 seconds after its last renewal.
* **Set up says `the setup workspace is open for <name>; leave it first`**: only one setup view can be open at a time. Leave the other one first.
* **Set up is unavailable with `not connected`**: wait until the card shows **Ready** or **Streaming**.
* **Set up is unavailable on a recording** (`a recording has no setup or lock`): edit the recording’s files instead. See [Play a recording](/docs/client/playback).
