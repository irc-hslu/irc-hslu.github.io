# Auto-calibrate without a board (https://irc-hslu.github.io/orbbecstreamer/docs/client/auto-calibrate)



**Auto-calibrate (no board)** refines the camera poses by comparing what the cameras see of the same room. It needs no calibration board. It is there only when the server offers it; a server that doesn’t offer it shows no such section. It needs the operator role and the setup lock, like the other setup steps. A viewer sees the status only.

The team has not yet tried this on the real rig; it has been checked only against a simulated server.

It works like the other setup runs: a run produces a result that is not in force until you select **Commit**. **Cancel**, leaving the setup view, losing the lock or a stopped capture all discard the run and keep the poses that were already committed. Nothing starts or commits by itself, not even when the server suspects a camera has moved.

## When to use it [#when-to-use-it]

* The server card shows **Drift suspected** and the board isn’t at hand. See [The drift chip](/docs/client/server-card#the-drift-chip).
* The seams between cameras have crept apart a little since the last board calibration.

It refines poses that are already valid; it does not replace the first calibration. If a camera was knocked far out of place, or the run says **A camera moved too far for a refinement**, recalibrate the camera pose with the board.

## Refine the poses [#refine-the-poses]

1. Open the setup view: select **Set up** on the card. The session chip must read **Active**.
2. Keep the room clear and still. People walking through the shared view make the run reject its windows.
3. In **Auto-calibrate (no board)**, select **Auto-calibrate**. The state chip reads **running**.
4. While it runs, the section shows how many windows were accepted and rejected, with the last reason for a rejection; a line per pair of cameras (the first few, then **+N more**); and, once the server has tried a solve, the candidate it reached. Nothing is in force yet.
5. When the run is solved, the chip reads **solved, awaiting commit** and **Commit** appears next to **Cancel**. Select **Commit** to keep the result, or **Cancel** to throw it away.

After **Commit**, the chip reads for example **valid · r4**, and two lines under it describe the committed refinement: how closely the surfaces agree and how closely neighbouring cameras agree, and how many cameras were refined and by how much the held-out fit improved. Amber boxes under them list advisories, each with **Next:** and what to do about it.

Poses that came from a refinement have no board quality report; the camera-pose step says so in an advisory.

## When it doesn’t start [#when-it-doesnt-start]

A refused start shows an amber box with what is wrong and **Next:** what to do:

| Message                                                              | What to do                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **There is no valid camera pose to refine.**                         | Calibrate the camera pose with the board first.                                           |
| **Needs person segmentation (RVM).**                                 | Enable person segmentation on the server.                                                 |
| **Cameras still warming up (default about 40 minutes after start).** | Wait until they are warm, then try again.                                                 |
| **No two cameras see the same area.**                                | Check the camera placement, or recalibrate with the board.                                |
| `needs the setup lock`                                               | Take the setup lock. **Auto-calibrate** names this as its reason while you don’t hold it. |

## When it fails [#when-it-fails]

A failed run shows the stage, what to do next, and the server’s own text as it came, for example **Stage: degenerate.** The stages are `not static`, `no overlap`, `degenerate`, `too few inliers`, `not converged`, `step limit`, `no improvement` and `inconsistent`. The previous committed poses stay in force. Select **Auto-calibrate** to try again, with the room clear.

## Show the report [#show-the-report]

**Show report** asks the server for the report of the committed refinement and shows a short summary: the revision and when it was committed, the windows, the quality lines, the largest correction to any camera, and any advisories and notes. If the current poses did not come from an auto-calibration (the last calibration used the board), it says **No report yet.** A report goes away when the poses change. The report needs the operator role.

## Use a keyboard or screen reader [#use-a-keyboard-or-screen-reader]

**Auto-calibrate**, **Commit**, **Cancel** and **Show report** are buttons in the tab order. Unavailable ones stay reachable and name their reason. When **Commit** or **Cancel** go away, focus moves to **Auto-calibrate**. Screen readers announce, without moving focus, that the result waits for **Commit**, a refusal or a failure with what to do, and when the report has loaded.

See also [Calibrate the floor](/docs/client/calibrate-floor) and the [setup view](/docs/client/setup-workspace).
