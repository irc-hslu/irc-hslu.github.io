# Calibration (https://irc-hslu.github.io/orbbecstreamer/docs/client/calibration)







## What it is [#what-it-is]

Each server has three calibration kinds. The
[setup workspace](/docs/client/setup-workspace) shows one section per
kind:

| Kind                   | What you can do today                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Camera pose**        | Read its state. The camera-calibration screen is a placeholder: a red, bold, italic `TODO`, with no controls. |
| **Depth quantization** | Start, watch, cancel and commit a run.                                                                        |
| **Network**            | Nothing: `Not available yet: waits for change request 0018.`                                                  |

A calibration run produces a **result**. The result is **not in force**
until you commit it. The client never commits a result by itself. When
you leave the workspace, or the lock or the connection is lost, the
client discards its own copy of an uncommitted result. What the server
does with that result is not defined by the protocol contract yet
(change request 0012 is open); the mock server drops it.

The client's reading of "result" and "commit" follows the client's
proposal in change request 0012, which the protocol contract has not
decided yet.

## How to use it [#how-to-use-it]

Open the setup workspace for the server first (**Set up** on its card).
Every action needs the session line to read
`active: this client holds the setup lock`.

### Every section [#every-section]

Each section starts with its state line, for example
`state: valid, revision 3`, or
`state: valid, revision 1: result revision 2 awaits commit` (the text
after the colon is the server's message; this one is the mock server's):
the state (`missing`, `valid`, `stale`, `running` or `failed`), the
revision in force, and the server's message if any. The line is highlighted when a
kind has `failed`, or when camera pose or depth quantization is not
`valid` (and not `running`).

### Depth quantization [#depth-quantization]

<img alt="A depth-quantization run in progress: state running, Cancel available, elapsed time, valid samples, observed range, reconstruction error and the depth-code histogram" src="__img0" />

1. Select **Start depth quantization**. The line under the buttons reads
   `Start: accepted; the run is starting`, and the state becomes
   `running`.
2. Watch the progress. The server sends it only to the client that holds
   the lock:

   * **elapsed:** time since the run started, for example `1.0 s`;
   * **valid samples:** for example `4 000`;
   * **observed range:** for example `500 to 5000 mm`;
   * **reconstruction error:** for example `1.50 mm`;
   * **histogram:** how many pixels had each depth code. The chart covers
     the valid codes 2 to 1022. The line under it gives the counts of the
     three special codes: `invalid (0)`, `below minimum (1)` and
     `above maximum (1023)`. Switch the **scale** between `log` (the
     default, which keeps small counts visible) and `linear`.

   A number the server did not send reads `not reported`.
3. Wait for the result. When the run produced one, the section shows
   `Result ready: revision 4, not in force until committed.`, followed by
   the server's message if any. The state line still shows the old
   revision.
4. Select **Commit depth quantization**. The line reads
   `Commit: accepted; the new revision comes into force with the server update`.
   Moments later the state line reads `valid, revision 4`, and every
   client shows the new revision on its server card.

To stop a run, select **Cancel depth quantization**. The line reads
`Cancel: accepted; the run is cancelled and nothing is committed`. The
state line then shows the state the server reports (the mock server
returns to the state from before the run).

When the server reports a result for the cancelled or failed run, the
section also says
`The last run produced no result to commit: <message>. Revision 3 stays in force.`
Whether that line appears after a cancel depends on whether the server
sends that result before it answers the cancel. The protocol contract
does not fix that order yet (change request 0008); the mock server sends
the result first.

A run that fails shows the state `failed`, and **Commit** stays
unavailable.

Only the newest action keeps its line under the buttons.

**When a button is unavailable**, the reason is written under it. While
a request is waiting for the server's answer, its button shows
`in progress`.

| Reason                                              | Meaning                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `the setup session is not active`                   | The workspace does not hold the lock (acquiring, leaving or ended).         |
| `the depth-quantization calibration is running`     | Start and Commit wait until the run ends.                                   |
| `the depth-quantization calibration is not running` | Nothing to cancel.                                                          |
| `no accepted depth-quantization result to commit`   | Run the calibration first; a failed or cancelled run has nothing to commit. |

<img alt="A finished depth-quantization run: &#x22;Result ready: revision 2, not in force until committed.&#x22; with the Commit depth quantization button available and the final histogram" src="__img1" />

### Camera pose [#camera-pose]

The section shows the state line and the red `TODO` placeholder, nothing
else. The camera-calibration screen is a placeholder; there is no way to
start a camera-pose calibration from the client yet. It is tracked in
`client/docs/development/ROADMAP.md`, "Phase 1D — UI", item "Focused
setup workspace; camera-calibration placeholder …".

### Network [#network]

The section shows the state line and
`Not available yet: waits for change request 0018.` Change request 0018
(network calibration stream) is proposed, not yet part of the protocol
contract. It is tracked in `client/docs/development/ROADMAP.md`,
"Phase 1C — connections (remaining)", item "Temporary
network-calibration stream".

## Expected result [#expected-result]

* After **Start**, progress numbers appear within the server's first
  progress interval and update while the run lasts; the histogram
  redraws with each update.
* After the run, `Result ready: revision N, not in force until committed.`
  appears and **Commit depth quantization** becomes available.
* After **Commit**, the state line shows `valid, revision N` on this
  client and on every other client's server card.
* After **Cancel**, the revision in force does not change.
* When you leave or lose the lock, the client commits nothing, and the
  revision in force does not change.

## Troubleshooting [#troubleshooting]

* **The result was not committed:** a result waits for **Commit**. If you
  left the workspace or lost the lock first, the client discarded its
  copy (the exit box says
  `The client discarded the uncommitted depth quantization result.`).
  Start the run again and commit it.
* **Forced out in the middle of a run:** the client commits nothing. What
  the server does with a run whose lock ends is not defined by the
  protocol contract yet (change request 0012 is open); the mock server
  cancels it. Check the state line when you are back in: if it still
  shows `running`, the run continued on the server. See
  [Setup workspace](/docs/client/setup-workspace#troubleshooting).
* **`Start rejected (<code>): <message>`** (or Cancel, Commit): the server
  refused the request. The code and message are the server's own. From
  the mock server, for example: `calibration-running` (another run is
  in progress), `calibration-not-running`, `not-lock-owner`.
* **`Commit failed (timeout): …`:** the server did not answer in time.
  The state line tells you whether the new revision is in force. If not,
  and the result is still shown, select **Commit** again.
* **`histogram: not reported by the server`:** the server sent no
  histogram with its progress. The numbers above still apply.
* **`histogram: depth histogram has N bins, expected 1024`:** the server
  sent a histogram of the wrong size; the client does not draw it.
* **Commit accepted but the state line still shows the old revision:**
  the new revision comes into force with the server's next update. It
  normally follows at once; if it does not, check the card for
  `resynchronising` or a lost connection.
