# Calibration quality API (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/calibration-quality)



The client keeps the quality of a server's calibration beside the calibration state and exports it for the Operator Console from one React-free module, `client/src/app/calibrationQualityApi.ts`. It follows change 0045 (wire format §11 and §13, feature `calibration-quality`). Everything is diagnostic: the figures never change how media is read.

## Turn it on [#turn-it-on]

Offer the feature on the runtime that should have it:

```ts
startAppRuntime(container, { role: 'operator', features: [CALIBRATION_QUALITY_FEATURE] });
```

The main page offers it already. The server grants it only for protocol minor 2 or later. Check the result with `isCalibrationQualityNegotiated(connection.state)`. Without it every selector returns `[]` or `null`, a quality field that arrives anyway is dropped, and `fetchCalibrationReport` fails with `unsupported-by-server` without sending anything.

## Read the state [#read-the-state]

Read from `connection.state` and again on `connection.onStateChange`.

| Selector                             | Returns                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calibrationAdvisories(state, kind)` | The advisory codes of the committed record of `kind`, most important first. They change only with a commit or a server restart, never during a run.                          |
| `committedPoseQuality(state)`        | The committed camera-pose figures (`PoseQuality`, no per-view list), or `null` when none is known. `quality-unknown` in the advisories says why.                             |
| `runPoseQuality(state)`              | During a camera-pose run, the last solve attempt (passed or failed) with its per-view list, or `null` before the first attempt. Cleared when the run ends.                   |
| `lastPoseResultQuality(state)`       | `{accepted, revision, quality}` of the last camera-pose result, or `null`. A failed result may carry the last attempt's figures or `null`. Cleared when the next run starts. |
| `cameraQualityOf(quality, cameraId)` | The figures of one camera, or `null`.                                                                                                                                        |
| `pairQualityOf(quality, a, b)`       | The figures of a camera pair, in either order, or `null`.                                                                                                                    |

Pixel figures are in pixels of the camera's observation image (`imageSize` and `observationImage` of the camera figures).

## Show advisories [#show-advisories]

`describeAdvisories(codes)` returns `{code, title, nextStep, known}` for each code, in the server's order. The text covers every code of the contract table. A code the client does not know is shown as is, with an empty `nextStep` and `known: false`.

## Read a report [#read-a-report]

```ts
const fetched = await fetchCalibrationReport(connection, 'camera-pose');
if (fetched.ok) show(fetched.reply.report); // null: nothing committed, or no report for that revision
```

* Reports exist for `camera-pose`, `depth-quantization` and `floor`. `floor` also needs the `floor` feature.
* The call needs the `operator` role and no lease. A viewer gets `{ok: false, reason: 'rejected', code: 'role-required'}`. A spent command budget gets `code: 'rate-limited'`. Neither ends the session.
* The report is the one of exactly `reply.revision`. During a run it is the pre-run report.
* `onCalibrationReport(connection, listener)` is the raw subscription to every reply of this connection.

## Try it against the mock [#try-it-against-the-mock]

See [mock server](/docs/client/developer/mock-server). `?mockQuality=1` gives clean figures and reports, `?mockQuality=advisory` gives advisories, and `?mockQuality=legacy` gives records without reports.
