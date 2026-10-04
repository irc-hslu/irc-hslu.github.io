# Cards check (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/cards-check)



The cards check (`client/dev/cards-check.html`, code in `client/src/dev/cardsCheck.tsx` and `client/src/dev/cardsScenario.ts`) is a dev-only page for the [server cards](/docs/client/server-card). It is never part of the production build.

It runs two clients, **Client A** and **Client B**, against one [mock server](/docs/client/developer/mock-server), and shows each client’s server cards in its own column. The cards are the app’s own cards. The scripted card actions (lock, refresh, shared updates, reconnect) go through the same model function as the card buttons. The calibration and placement steps (4 and 5) call client A’s connection directly; the setup workspace has its own page, the [setup check](/docs/client/developer/setup-check). Nothing is drawn in 3D: each client has a GPU-free renderer.

The mock serves the sample recordings when `client/reference/hevc-web/` exists, decoded by the dev pages’ synthetic decoder. These recordings aren’t published; without them the mock is snapshot-only, with no media.

## Run the check [#run-the-check]

Start the dev server in `client/`:

```bash
npm run dev
```

Open this URL:

```text
http://localhost:5173/dev/cards-check.html?autorun=1
```

URL parameters:

| Parameter   | Effect                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| `autorun=1` | Run the scripted scenario on load. Without it, press **Run scenario**. |
| `media=0`   | Use a snapshot-only mock even when the recordings exist.               |

The scenario, in order:

1. Both clients connect.
2. A acquires the lock. B shows `held by Client A (…)`, and B’s **Acquire lock** is unavailable with the reason `the lock is held by Client A`.
3. B sends an acquire anyway, through the model function the button calls (the unavailable button itself sends nothing). The mock server refuses it, and the page log (not B’s card) shows `Client B: Acquire lock rejected (lock-held): setup lock held by Client A`. `lock-held` is the mock server’s code; a real server may use another.
4. B turns shared updates off, and A commits a placement. B still gets the new placement, because the change restarts the streams and B fetches the full state by itself.
5. A runs a depth-quantization calibration. B shows it `running`. The result is withheld from B, so B’s card shows stale metadata until B refreshes. After A commits, B shows the calibration `valid` at a new revision.
6. A releases the lock. B acquires it (A shows `held by Client B (…)`), then releases it.
7. The mock drops B’s session. B’s card shows `error` and `reconnect scheduled`, and B’s **Reconnect** restores the session. With the sample recordings, the step also waits until B’s new session uploads frames and its bundle shows `ready, drawing`.

Buttons for trying things by hand:

* **Drop A’s session** and **Drop B’s session**: the mock server loses that client’s session.
* **Expire the lease**: the mock server expires the current lock.
* **Pause for setup** and **Stop streaming**: server-side streaming changes.

The card buttons work as in the app.

## What you should see [#what-you-should-see]

* The page ends with `body[data-state]` set to `done`, the log line `verdict: 7 steps passed`, and both columns showing a live card.
* `window.__cardsCheckReport` holds the report: `state`, `media`, `steps[]` (`name`, `ok`, `detail`), `log`, `errors` and `verdict`. The same JSON is in the collapsed “report JSON” panel.
* Recorded runs, 2026-09-28, headless Chromium 153 on Linux, with the sample recordings:
  * first run: `done`, 7 of 7 steps;
  * two reruns after the per-session counts fix: `done`, 7 of 7 steps, no errors. The last step reported B at `decoded 1, uploaded 1, dropped 0 this session`. A screenshot a moment later showed both columns `ready, drawing`, with decoded pairs equal to uploaded on each card (A 35 / 35, B 12 / 12).

Counts on this page work like this. Both clients are wired the same way: a GPU-free renderer that accepts every upload and draws nothing. The counts are per session, so after B’s Reconnect they start again from zero, while A’s keep growing. A card that shows **Pairs** 0 and `ready, no frame yet` under **Details** right after the reconnect has not received its new session’s first frames yet.

The same scenario runs in Node on a simulated clock as part of `npm test` (`client/src/tests/serverCards.test.ts`).

## Fix check problems [#fix-check-problems]

* **`failed` with `timed out waiting for: …`**: the step named in `verdict` did not reach the expected card state within 8 s. The text after it shows both cards’ status and lock line at that moment.
* **`failed` with `watchdog: not done after 60 s`**: the run hung. Reload the page, and check the browser console.
* **`media` is `snapshot only, no media` although you want frames**: the sample recordings in `client/reference/hevc-web/` are missing or incomplete; `fallbackReason` in the report says which. These recordings aren’t published, so most readers get a snapshot-only mock. The scenario doesn’t need media; the counts stay at 0. See [Sample recordings](/docs/client/developer/test-the-client#sample-recordings).
