# Setup check (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/setup-check)



The setup check (`client/dev/setup-check.html`, code in `client/src/dev/setupCheck.tsx` and `client/src/dev/setupScenario.ts`) is a dev-only page for the [setup view](/docs/client/setup-workspace) and its [calibration](/docs/client/calibration) sections. It is never part of the production build.

It runs two clients of one [mock server](/docs/client/developer/mock-server):

* **Client A** uses the app’s own setup workspace, through the same controller the workspace’s buttons use.
* **Client B** shows the app’s server cards. It holds the lock in one step and shows which revision is in force.

The mock is snapshot-only (no media, nothing drawn in 3D). Its depth-quantization calibration is scripted: progress every 250 ms with a synthetic depth-code histogram, and an accepted result after 1.5 s.

## Run the check [#run-the-check]

Start the dev server in `client/`:

```bash
npm run dev
```

Open this URL:

```text
http://localhost:5173/dev/setup-check.html?autorun=1
```

Without `autorun=1`, press **Run scenario**. **Expire the lease** makes the mock server expire the current lock at any time.

The scenario, in order:

1. Both clients connect, and **Set up** is available on A’s card.
2. A enters setup: A holds the lock with a countdown, B shows it held by A.
3. A starts a depth-quantization run. Progress with a histogram appears, then `Result ready: revision 2, not in force until committed.` B still shows revision 1.
4. A commits. A and B show `valid, revision 2`.
5. A starts another run and cancels it. The revision stays at 2, and the mock holds no result.
6. A starts a third run, and the mock expires the lease in the middle of it. A shows `Forced out of setup. The server ended the setup lease.` and `Nothing was committed.` The revision stays at 2.
7. B acquires the lock, and A enters setup again. A shows `Could not enter setup. The setup lock is held by Client B.` B then releases the lock.
8. A enters setup again and leaves: `Left setup: the setup lock was released.`, and both clients show the lock free.

## What you should see [#what-you-should-see]

* `body[data-state]` ends as `done`, and the log ends with `verdict: 8 steps passed`.
* `window.__setupCheckReport` holds the report: `state`, `steps[]` (`name`, `ok`, `detail`), `log`, `errors` and `verdict`. The same JSON is in the collapsed “report JSON” panel.
* The log shows two `Subscribe to bundle-cam0 failed: not-decode-compatible` warnings at the start. They are expected: the page has no decoders.
* Recorded run, 2026-09-28, headless Chromium 153 on Linux: `done`, 8 of 8 steps, no errors.

The same scenario runs in Node on a simulated clock as part of `npm test` (`client/src/tests/setupWorkspace.test.ts`).

## Fix check problems [#fix-check-problems]

* **`failed` with `timed out waiting for: …`**: the named step did not reach the expected state within 8 s. The text after it shows A’s session line, lock line and depth-quantization state at that moment.
* **`failed` with `watchdog: not done after 60 s`**: the run hung. Reload the page and check the browser console.
* **The run fails after you pressed Expire the lease by hand**: expected; the scenario expects to hold the lock in most steps. Reload and run it without pressing buttons.
