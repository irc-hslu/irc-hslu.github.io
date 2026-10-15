# Sensor properties and stream profiles (https://irc-hslu.github.io/orbbecstreamer/docs/server/how-it-works/operator-configuration)



An operator session (the Operator Console; see the role rules in
[Serving](../serving)) can change two things on the running rig:

* **sensor properties** of each camera, such as colour exposure or depth noise
  removal (change 0027),
* the **stream profile**, the rig-wide combination of depth mode, colour
  size and frame rate (change 0028).

Both are operator writes: the session needs the `operator` role and the setup
lease (`client.lock.acquire`), and the cameras must be open. Viewers never see
the messages. The code is in `server/src/camera/` (`SensorService`,
`StreamProfiles`, `orbbec/OrbbecSensorControl`), `server/src/control/`
(`OperatorState`, `SetupController`) and `server/src/session/`
(`SessionHub`, `RigConfigWorker`); the capture executor in `LiveApp.cpp`
runs the work.

## Order of checks [#order-of-checks]

Every operator write is checked in the same order, and refused with a
`server.ack{accepted: false, code}`:

| Order | Check                                           | Code                  |
| ----- | ----------------------------------------------- | --------------------- |
| 1     | The session has the `operator` role             | `role-required`       |
| 2     | The request carries the session's setup lease   | `invalid-lease`       |
| 3     | The cameras are open                            | `capture-not-running` |
| 4     | No camera-pose or depth-quantization run exists | `calibration-running` |
| 5     | The request's own rules (below)                 | per request           |

Each request gets exactly one `server.ack`. Anything the request causes is
sent before it.

## Sensor properties [#sensor-properties]

On the Femto Bolt the server offers this fixed list. The ranges are the
device's own, read when the cameras open; a property the device does not
support is left out. Nothing here is a laser or a depth gain: the Femto Bolt
has neither.

| Sensor  | Property id                      | Type | Range on the rig        | Enabled when                  |
| ------- | -------------------------------- | ---- | ----------------------- | ----------------------------- |
| `color` | `auto-exposure`                  | bool |                         |                               |
| `color` | `exposure`                       | int  | 1 to 300                | `auto-exposure` is false      |
| `color` | `gain`                           | int  | 0 to 80                 | `auto-exposure` is false      |
| `color` | `auto-white-balance`             | bool |                         |                               |
| `color` | `white-balance`                  | int  | 2000 to 11000, step 100 | `auto-white-balance` is false |
| `color` | `brightness`                     | int  | 1 to 20                 |                               |
| `color` | `power-line-frequency`           | enum | 0 Off, 1 50 Hz, 2 60 Hz |                               |
| `depth` | `noise-removal`                  | bool |                         |                               |
| `depth` | `noise-removal-max-diff`         | int  | 1 to 10000              | `noise-removal` is true       |
| `depth` | `noise-removal-max-speckle-size` | int  | 1 to 1000               | `noise-removal` is true       |
| `depth` | `exposure`                       | int  | 20 to 125               | read-only status              |

Wire ids are fixed by the server. The Orbbec SDK's property numbers change
between SDK versions, so they never leave `OrbbecSensorControl`. Resolution,
frame rate and format are not properties; they belong to the stream profile.

### What a `client.sensor.config.set` does [#what-a-clientsensorconfigset-does]

1. Rules 1 to 4 above, then the camera must be connected
   (`sensor-camera-unavailable`).
2. The server reads the sensor from the device, then checks **every** change
   before it applies any: the property exists (`sensor-unknown-property`), is
   writable (`sensor-read-only`), has the right type, is inside its range and
   on its step grid (`sensor-out-of-range`), and is enabled
   (`sensor-property-disabled`). The first failure refuses the whole request.
3. `enabled when` is evaluated in order, with the request's earlier changes
   applied. `[{auto-exposure: false}, {exposure: 120}]` is valid while
   auto-exposure is on; the reverse order is not.
4. The changes are written in order. The server then reads **every** property
   of the sensor back and sends `server.sensor.config` with the values the
   device holds. A device that clamps or rounds shows the applied value,
   never the request.
5. The ack follows. `accepted: true` means "applied as far as the device
   allows"; a clamp is not a refusal. A device error part-way is
   `sensor-apply-failed`, and the config message shows what was applied.
6. A request that changes no value gets only the ack.

The server also reads the properties once a second. A value that changed by
itself (auto exposure and auto white balance drift, the read-only depth
exposure) is sent in `server.sensor.config` with `replyTo: null`.

`server.sensor.config` is coalescable: a session that has not written the
previous copy yet gets only the latest one, stamped with the revision at the
moment it is written. The copy with `replyTo` is never dropped.

### Where the values are kept [#where-the-values-are-kept]

The values an operator set are stored per device serial in
`run.sensor_config_path` (default `config/dev/sensors.json`) and written to
the device again every time the cameras open, before streaming starts. A
property is skipped if it is not enabled at that point, and a stored value the
device no longer accepts is dropped with a warning. A missing or unreadable
file starts empty.

### Properties that need a restart [#properties-that-need-a-restart]

A property marked `requiresRestart` is stored, not written. The server
restarts the whole rig (hardware sync, frame-set batching and the
concatenated encoder are rig-wide) and the value is applied as the cameras
start again. The ack is sent when the restart has been accepted; the final
`server.sensor.config` with `replyTo` completes it. Meanwhile every sensor
write gets `sensor-busy`. If the restart fails, the stored value is taken
back, the rig starts again as it was, and the server sends
`server.error{code: sensor-apply-failed, fatal: false}`. No property of the
Femto Bolt list needs a restart, so this path is covered by unit tests with a
fake device only.

## Stream profiles [#stream-profiles]

A **profile** is one depth plus colour combination of the capture streams for
the whole rig. `server.stream.profiles` lists the ones the connected cameras
can run, which one is active, and whether a switch is under way.

How the list is built (`StreamProfiles.cpp`):

* Only modes **every** connected camera offers.
* Depth: `y16` modes of the device (Femto Bolt: 320x288, 512x512, 640x576 and
  1024x1024; the 1024x1024 mode runs at 15 or 5 fps only, so only the 15 fps
  one is listed). Colour: `rgb8`, the 16:9 sizes from 1280x720 to 3840x2160.
* Capture rates 15 and 30 fps; the stream rate (`frameRate`) is 15 or 30 and
  at most the capture rate. A 30 fps capture streamed at 15 fps is the
  `...-30-s15` profile.
* The id is `d<depth>-c<colour>-<capture fps>` and `-s<stream fps>` when the
  stream rate is lower, for example `d640x576-c1280x720-30-s15`. It is
  stable while the combination exists.
* The tile size is the **depth** stream's, and so are the intrinsics: the
  server aligns colour into the depth image plane (`color_to_depth`) and
  offers profiles under no other alignment.
* The running combination is always listed and compatible.

A profile is listed with `compatible: false` and a reason when:

| Reason                                                   | When                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `<camera> is on a USB 2 link; this profile needs USB 3.` | Depth and colour need more than about 30 MB/s on a USB 2 link     |
| `no foreground model for the depth size WxH`             | `mask.backend: rvm` and no model exists for that size (see below) |
| `the depth filter cannot run at WxH`                     | The bilateral filter rejects the geometry                         |

`requiresEngineBuild` is true when the RVM engine for that depth size is not
in the engine cache: the first use builds it, which takes minutes, and masks
pass every pixel until it is ready. `invalidatesCalibration` lists what a
switch to the profile makes stale: `camera-pose` when the persisted pose was
made for another depth size, `depth-quantization` when a calibrated profile
is in use and the depth mode changes.

### The foreground model and other depth sizes [#the-foreground-model-and-other-depth-sizes]

The default `mask.rvm_onnx_path` names one fixed-shape model
(`..._640x576_...`), so with `mask.backend: rvm` only that depth size is
compatible. To offer another size, export a model for it and put `{width}` and
`{height}` in the path; a profile is then compatible when the file for its size
exists. With `fill_all` or another backend every size the depth filter accepts
is compatible.

### What a `client.stream.profile.set` does [#what-a-clientstreamprofileset-does]

1. Rules 1 to 4 above. Then `profile-switch-in-progress` while a switch is
   pending (a no-op request included), `sensor-busy` during a sensor restart,
   `profile-unknown`, and `profile-incompatible` with the reason in the
   message. Setting the active profile is an accepted no-op.
2. The server sends `server.stream.profiles` with `switchState: switching`
   and `pendingProfileId`, to every operator, then the ack. The request is
   now **accepted**: it completes or reverts whatever happens to the lease or
   the session.
3. The bundles pause (`server.stream.availability{paused: true}`),
   `server.streaming` goes to `starting`, and the capture executor stops the
   pipeline, writes the profile into the stream configuration and opens the
   cameras again. This takes several seconds (about 7 s on the two-camera
   rig).
4. One commit replaces `cameras` and `bundles` and reassesses calibration. The
   server sends `server.metadata.revision-changed` with `changedSections`
   `cameras` and/or `bundles` (plus `calibration` when a calibration became
   stale) and `invalidatesActiveStreams: true`, then the new
   `server.stream.descriptor` per channel. Media streams finish and new ones
   open with keyframes and codec configuration.
5. `server.stream.profiles` with `switchState: idle`, the new
   `activeProfileId` and `replyTo` in the originator's copy is the
   completion.

If the new depth size makes the camera-pose calibration stale, readiness
returns to `needs-setup` and streaming ends `stopped`. The cameras keep the
poses they had; poses change only through a calibration commit. A calibration
cannot start while the rig restarts (`rig-restarting`).

If the cameras refuse the profile, the server reverts: `switchState:
reverting`, the same sequence back to the previous profile, a
`server.error{code: profile-apply-failed, fatal: false}` and the completion
with the previous profile active. If the previous profile cannot be opened
either, capture ends in `failed` (`server.capture.state`), the switch ends
with the previous profile as active and `idle`, and `client.capture.start` is
the retry.

### Where the choice is kept [#where-the-choice-is-kept]

The sizes and rates of the active profile are stored in
`run.stream_profile_path` (default `config/dev/stream-profile.json`) after a
switch and replace `streams.*` and `encoding.stream_fps` at the next start
(`stream profile ... restored from ...` in the log). Delete the file to return
to the configuration. A file that cannot be used is ignored with a warning.
Formats always come from the configuration.

## While the cameras are closed [#while-the-cameras-are-closed]

With the cameras closed there are no cameras in the snapshot, so no
capabilities or sensor configuration are sent, and both requests are refused
`capture-not-running`. The profile list is the one of the last open, or empty
before the first open; `activeProfileId` is then the profile the cameras will
start with.

## Related [#related]

* [Setup state and revisions](./setup-state) for the commits, revisions and
  readiness the switch goes through.
* [Capture and synchronisation](./capture-and-sync) for the camera open and
  close that a restart reuses.
* [Configuration](../configuration#run) for `run.sensor_config_path` and
  `run.stream_profile_path`.
