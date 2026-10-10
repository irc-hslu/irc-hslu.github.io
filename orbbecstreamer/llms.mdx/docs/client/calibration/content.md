# Calibrate depth (https://irc-hslu.github.io/orbbecstreamer/docs/client/calibration)







The server sends depth as a video in which each pixel is one of 1024 codes, and the client turns each code back into a distance. A depth-quantization calibration measures the depths your cameras see and produces a new code-to-distance mapping, called a **result**. The result comes into force only when you commit it, and then every client uses it.

Each calibration section in the setup view has a state chip, for example **valid · r3**: the state (`missing`, `valid`, `stale`, `running` or `failed`) and the revision in force. Hover over it for the server’s message. Only depth quantization works in the client today. Against a real server you can start, follow and cancel a depth-quantization run, but not commit it yet: the client and server still follow two different proposals for when a calibration result is sent (change requests 0012 and 0023), and the fix waits on that decision. Against the mock server, committing works.

## Depth quantization [#depth-quantization]

Open the setup view first: select **Set up** on the card. The session chip must read **Active**.

1. Select **Start**. The state chip turns **running**.

2. Watch the progress, shown only on the client that holds the lock:

   * **elapsed**, **valid samples**, **observed range** and **reconstruction error** (how far distances rebuilt from the codes are off)
   * **Depth codes**: how many pixels had each code from 2 to 1022. **Log**, the default, keeps small counts visible; **Linear** compares the peaks. The chips under it count the special codes: invalid (`0`), below minimum (`<min`) and above maximum (`>max`).

   <img alt="Depth quantization during a run: the running chip, Cancel available, the four numbers and the Depth codes histogram" src="__img0" />

3. Wait for `Result ready: revision 2, not in force until committed.` The state chip still shows the old revision.

   <img alt="Depth quantization after a run: Commit highlighted, the Result ready box, elapsed (last run) 5.5 s, and the final histogram on the log scale" src="__img1" />

4. Select **Commit**. A moment later the chip shows the new revision, on every client.

To stop a run, select **Cancel**. Nothing is committed. The reasons an unavailable button shows as its tip:

| Reason                                              | Meaning                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `the setup session is not active`                   | You don’t hold the lock                          |
| `the depth-quantization calibration is running`     | **Start** and **Commit** wait until the run ends |
| `the depth-quantization calibration is not running` | Nothing to cancel                                |
| `no accepted depth-quantization result to commit`   | Run the calibration first                        |

## Camera pose [#camera-pose]

The section shows its state chip and a red `TODO`. Camera-pose calibration isn’t in the client yet; the server can run it from its own console. See [Camera calibration](/docs/server/camera-calibration).

## Network [#network]

The section shows its state chip and **Not available yet**.

## Fix calibration problems [#fix-calibration-problems]

* **The result never came into force**: a result needs **Commit**. If you left setup or lost the lock first, the client threw the result away. After **Leave**, the setup view closes with no message, and the card’s **Depth** chip keeps the old revision. After a forced exit, the box in the setup view says `The client discarded the uncommitted depth quantization result.` Run the calibration again and commit it.
* **You were forced out in the middle of a run**: the client committed nothing. When you’re back in setup, check the state chip: if it still shows **running**, the run went on without you. See [Set up a server](/docs/client/setup-workspace).
* **`Start rejected (<code>): <message>`**, or the same for Cancel or Commit: the server refused the request. The code and message come from the server.
* **`Commit failed (timeout): …`**: the server didn’t answer in time. The state chip tells you whether the new revision is in force. If it isn’t, and the result still shows, select **Commit** again.
* **The state shows `failed`**: the run failed, and there is nothing to commit. Start a new run.
* **`The last run produced no result to commit: <message>. Revision 3 stays in force.`**: the run was cancelled or failed. Start a new run.
* **`histogram: not reported by the server`**: the server sent no histogram. The numbers above it still apply.
* **`histogram: depth histogram has N bins, expected 1024`**: the server sent a histogram of the wrong size, so the client doesn’t draw it.
* **Commit accepted, but the state chip still shows the old revision**: the new revision comes into force with the server’s next update. If it doesn’t follow, check the card for a **resynchronising** chip or a lost connection.
