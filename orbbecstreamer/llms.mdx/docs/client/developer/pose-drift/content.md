# Pose drift and refinement API (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/pose-drift)



The client keeps the drift monitor's verdict and the board-free pose refinement of a server beside the calibration state and exports them for the Operator Console from one React-free module, `client/src/app/poseDriftApi.ts`. It follows change 0047 (wire format §11 and §13, features `pose-drift` and `pose-refine`). The drift is an observation: nothing here starts a run or commits by itself.

## Turn it on [#turn-it-on]

The two features are independent. `pose-drift` is read-only; `pose-refine` adds a run, a report kind and four refusal codes. Offer them on the runtime that has a view for what they send:

```ts
startAppRuntime(container, { role: 'operator', features: ['calibration-quality', POSE_DRIFT_FEATURE, POSE_REFINE_FEATURE] });
```

The main page offers both: the server card shows the drift chip and the setup view has the Auto-calibrate (no board) section. They are built and tested against the mock only. Check the result with `isPoseDriftNegotiated(state)` and `isPoseRefineNegotiated(state)`. Without a feature its selectors return `null` or `[]`, an item or field that arrives anyway is dropped with a warning, and a request of kind `pose-refine` fails with `unsupported-by-server` without sending anything (the server would end the session).

## Read the verdict [#read-the-verdict]

Read from `connection.state` and again on `connection.onStateChange`.

| Selector              | Returns                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `driftSummary(state)` | `{state: 'ok' \| 'suspected' \| 'unmonitored', status, title, reason, nextStep, suspectedCameraIds, pairs}` in plain text, or `null` without `pose-drift`.                                        |
| `poseDrift(state)`    | The wire `poseDrift` of the camera-pose item. It holds between estimate cycles (the last evidence) and is frozen during a run.                                                                    |
| `driftReport(state)`  | The latest `server.calibration.drift` (operator sessions only, coalescable, the latest wins), or `null`. Dropped when a newer commit or an `inactive` or `unmonitored` verdict makes it obsolete. |

`driftSummary` maps the six wire statuses: `monitoring` is `ok`, `suspected` is `suspected`, and `inactive`, `unmonitored`, `warming-up` and `not-monitorable` are `unmonitored` with their own title. A suspected verdict is a warning, never an error and never modal. Its next step is **Recalibrate camera pose**, and where `pose-refine` works also **Auto-calibrate**; neither starts by itself.

For the pair detail: `describeDriftFigure(pair.drift)` gives "7.8 mm ± 0.6, 0.12° ± 0.02" (a saturated one "> 50 mm / 3°"), `describeFigure(pair.offsetFromCommitted)` the baseline offset, `describeUnobservedDirection(direction)` a sentence for each direction the room cannot check (never "0 mm"), and `describeDriftReason(code)` the plain words for a pair reason (`no-overlap`, `too-few-points`, `too-few-normal-directions`, `too-few-inliers`, `not-converged`, `degenerate`, `dynamic-scene`, `sync-degraded`, `camera-disconnected`, `budget-exceeded`, and the window reason `not-static`). An unknown code is shown as it is. `thresholds.provisional` is true until the server's bias floor is measured; say so.

## Run the refinement [#run-the-refinement]

`new PoseRefineRun(control, clock)` takes the `SetupControl` of `pipelineSetupControl` and gives `view()`, `onChange(listener)`, `start()`, `cancel()`, `commit()` and `dispose()`. It needs the setup lock the workspace holds and the `operator` role (change 0048); the view says why an action is blocked.

* **Start** is refused before sending when the pose is not valid (`needs-pose`) or the monitor says there is no person segmentation (`needs-segmentation`). The server's own refusals are mapped by `describePoseRefineRefusal(failure, action)` to a text and a next step: `pose-refine-needs-pose` ("Calibrate with the board first"; on a commit "The camera poses changed while the refinement ran. Cancel and refine again."), `pose-refine-needs-segmentation`, `pose-refine-warming-up`, `pose-refine-no-overlap`, and also `rig-restarting`, `role-required`, `invalid-lease`, `capture-not-running`, `calibration-running` and `rate-limited`. Any other code is shown with the server's message.
* **Progress** (`view().progress`, or `poseRefineProgress(state)`): accepted and required windows, the rejected count with the last reason, the pairs that constrain the solve, the `phase` (`collecting`, `solving`) and `lastSolveFailure`. `candidate` is the last solve attempt, `null` while collecting. After the run is solved the last message stays so the operator can review the candidate.
* **Commit** is enabled only at `awaitingCommit` and is always the operator's own action. A commit raises the camera-pose revision, so the verdict is `warming-up`, a committed floor becomes `stale`, and the camera-pose advisories are `pose-refined` and `quality-unknown` with no `poseQuality` (read them with `cameraPoseAdvisories(state)`; `describePoseRefineAdvisories(codes, kind)` words them).
* **Cancel, lease loss, takeover, capture stop and session close** commit nothing: the server restores the item and sends no result, and the view drops the progress.
* **A failed run** keeps the server's message as is (`view().message`, `lastResult.failure.message`). `parsePoseRefineFailure(message)` reads the recommended stage (`not-static`, `no-overlap`, `degenerate`, `too-few-inliers`, `not-converged`, `step-limit`, `no-improvement`, `inconsistent`) and gives a next step; a `step-limit` points to **Recalibrate camera pose** with the board.

`poseRefineItem(state)` is the status item (`missing`, `valid`, `running`, `failed`, `stale`), `committedRefineQuality(state)` the quality of the refine the current pose came from, and `poseRefineResult(state)` the last result.

## Read the report [#read-the-report]

```ts
const fetched = await fetchCalibrationReport(connection, 'pose-refine');
if (fetched.ok) show(fetched.reply.report); // null: the current pose did not come from a refine
```

The call needs `calibration-quality` and `pose-refine`, and the `operator` role without a lease. `reply.report` is the `pose-refine-report-v1` of the committed refine. The camera-pose report of a pose that came from a refine is `null`.

## Try it against the mock [#try-it-against-the-mock]

See [mock server](/docs/client/developer/mock-server). `?mockDrift=suspected&mockRefine=1&mockQuality=1` gives a suspected verdict, the scripted run and its report on three cameras.
