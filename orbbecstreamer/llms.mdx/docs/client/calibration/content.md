# Calibrate depth (https://irc-hslu.github.io/orbbecstreamer/docs/client/calibration)







The server sends depth as a video in which each pixel is one of 1024 codes, and the client turns each code back into a distance. A depth-quantization calibration measures the depths your cameras see and produces a new code-to-distance mapping, called a **result**. The result comes into force only when you commit it, and then every client uses it.

The setup view has three calibration sections. Only depth quantization works in the client today:

| Section                                   | What you can do                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| [Camera pose](#camera-pose)               | Read its state. Camera-pose calibration isn’t available in the client yet. |
| [Depth quantization](#depth-quantization) | Start, watch, cancel and commit a run.                                     |
| [Network](#network)                       | Read its state. Network calibration isn’t available yet.                   |

Each section starts with its state line, for example `state: valid, revision 3`. It gives the state (`missing`, `valid`, `stale`, `running` or `failed`), the revision in force, and the server’s message if any. The line is highlighted when the state is `failed`, or when camera pose or depth quantization isn’t `valid` and isn’t `running`.

## Depth quantization [#depth-quantization]

Open the setup view for the server first: select **Set up** on its card. See [Set up a server](/docs/client/setup-workspace). The session line must read `active: this client holds the setup lock`.

1. Select **Start depth quantization**. The line under the buttons reads `Start: accepted; the run is starting`, and the state becomes `running`.
2. Watch the progress. It shows only on the client that holds the lock:

   * **elapsed**: the time since the run started, for example `1.0 s`
   * **valid samples**: the number of depth readings measured, for example `4 000`
   * **observed range**: the nearest and farthest depth seen, for example `500 to 5000 mm`
   * **reconstruction error**: how far distances rebuilt from the codes are off, for example `1.50 mm`
   * **histogram**: how many pixels had each depth code. The chart covers the valid codes 2 to 1022. The line under it counts the three special codes: `invalid (0)`, `below minimum (1)` and `above maximum (1023)`.

   Switch the **scale** between `log`, the default, which keeps small counts visible, and `linear`. A number the server didn’t send reads `not reported`.
3. Wait for the result. The section then shows `Result ready: revision 4, not in force until committed.` The state line still shows the old revision.
4. Select **Commit depth quantization**. The line reads `Commit: accepted; the new revision comes into force with the server update`.

To stop a run, select **Cancel depth quantization**. The line reads `Cancel: accepted; the run is cancelled and nothing is committed`, and the revision in force doesn’t change.

## What you should see [#what-you-should-see]

While the run goes on, the numbers and the histogram update with each progress message from the server.

<img alt="The Depth quantization section during a run: the state running, Cancel depth quantization available, and the elapsed time, valid samples, observed range, reconstruction error and depth-code histogram" src="__img0" />

When the run ends, **Commit depth quantization** becomes available. The state line adds the server’s message after a colon, for example `valid, revision 1: result revision 2 awaits commit` from the mock server, and the elapsed time reads `(last run)`, for example `5.5 s (last run)`.

<img alt="The Depth quantization section after a run: the state line says result revision 2 awaits commit, the Result ready line says revision 2 is not in force until committed, and the final histogram with the log scale selected" src="__img1" />

A moment after you commit, the state line reads `valid, revision 4`, followed by the server’s message if it sends one, and every client shows the new revision on its server card.

When a button is unavailable, the reason is written under it:

| Reason                                              | Meaning                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `the setup session is not active`                   | You don’t hold the lock: the setup view is acquiring, leaving or ended.     |
| `the depth-quantization calibration is running`     | Start and Commit wait until the run ends.                                   |
| `the depth-quantization calibration is not running` | There is nothing to cancel.                                                 |
| `no accepted depth-quantization result to commit`   | Run the calibration first. A failed or cancelled run has nothing to commit. |

## Camera pose [#camera-pose]

The Camera pose section shows its state line and a red `TODO`, nothing else. Camera-pose calibration isn’t available in the client yet. The server can run it from its own console; see [Camera calibration](/docs/server/camera-calibration).

## Network [#network]

The Network section shows its state line and a note that network calibration isn’t available yet. There is nothing to run.

## Fix calibration problems [#fix-calibration-problems]

These are the common calibration problems and their fixes:

* **The result never came into force**: a result needs **Commit**. If you left setup or lost the lock first, the client threw the result away. After **Leave setup**, the setup view closes with no message on screen, and the card’s calibration row still shows the old revision. After a forced exit, the box in the setup view says `The client discarded the uncommitted depth quantization result.` Run the calibration again and commit it.
* **You were forced out in the middle of a run**: the client committed nothing. When you’re back in setup, check the state line: if it still shows `running`, the run went on without you. See [Set up a server](/docs/client/setup-workspace).
* **`Start rejected (<code>): <message>`**, or the same for Cancel or Commit: the server refused the request. The code and message come from the server.
* **`Commit failed (timeout): …`**: the server didn’t answer in time. The state line tells you whether the new revision is in force. If it isn’t, and the result still shows, select **Commit depth quantization** again.
* **The state shows `failed`**: the run failed, and there is nothing to commit. Start a new run.
* **`The last run produced no result to commit: <message>. Revision 3 stays in force.`**: the run was cancelled or failed. Start a new run.
* **`histogram: not reported by the server`**: the server sent no histogram. The numbers above it still apply.
* **`histogram: depth histogram has N bins, expected 1024`**: the server sent a histogram of the wrong size, so the client doesn’t draw it.
* **Commit accepted, but the state line still shows the old revision**: the new revision comes into force with the server’s next update. If it doesn’t follow, check the card for `resynchronising` or a lost connection.
