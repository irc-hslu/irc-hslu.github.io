# Operator Console (https://irc-hslu.github.io/orbbecstreamer/docs/operator)















The **Operator Console** is a status page for one OrbbecStreamer server. It
shows the server's cameras, readiness, streaming and calibration state.
Up to v0.1.0-poc.5 it is **read-only**. From poc.6 it changes one thing:
the [depth range](#calibrate-the-depth-range) calibration. From poc.7 it
also shows a [live preview](#watch-the-live-preview) of the cameras.
From v0.1.0-poc.9 it also changes the
[colour and depth sensor settings and the stream profile](#change-sensor-settings-and-the-stream-profile),
for a session that has the [operator role](#the-operator-role), and from
v0.1.0-poc.11 it [calibrates the camera poses](#calibrate-the-camera-poses).
Everything else is done in the
client's [setup workspace](/docs/client/setup-workspace) or with the
server's [camera calibration](/docs/server/camera-calibration).

The console first shipped in v0.1.0-poc.1. Since v0.1.0-poc.3 it finds the
server by itself.

## Open the console [#open-the-console]

You need the installed release package, with the `orbbec-streamer` and
`orbbec-streamer-web` services running and at least one camera connected.
Up to poc.9, the server's WebTransport gateway only starts once a camera is
active. From poc.9, it starts with the service and the cameras stay
closed until a client opens them (see [Cameras closed](#cameras-closed)).

1. On the server PC, check both services:

   ```bash
   systemctl status orbbec-streamer orbbec-streamer-web
   ```

2. In Chrome or Edge **on the same PC**, open [http://127.0.0.1:8080/operator](http://127.0.0.1:8080/operator)
   (`http://localhost:8080/operator` works too).

Other computers on the network can't open the console yet: both services
listen on this machine only.

## The operator role [#the-operator-role]

From v0.1.0-poc.9, the server gives each console session one of two
roles. The role is decided once, when the session opens.

| Role     | What the console can do                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator | Everything the console offers: change sensor settings and the stream profile, calibrate the depth range, and take over the setup lock from another session. |
| Viewer   | Watch status and the preview, take the setup lock, and calibrate the depth range. The sensor and profile screens are read-only.                             |

A session is an operator only when all of these hold:

* the console is open on the server PC, so the connection comes from this
  machine (loopback);
* the page's address is one of the server's console origins. The package
  lists `http://127.0.0.1:8080` and `http://localhost:8080` under
  `serving.console_origins` in `/etc/orbbec-streamer/live.yaml`, so
  `/operator` on either address qualifies;
* the console asked for the role (it always does).

Otherwise the console opens as a viewer. A banner reads **Opened as
viewer**, with **Dismiss**, and the top bar shows the chip **Viewer:
sensors and profiles read-only**. The banner says why:

| Banner text (start)                                                                                             | Cause                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operator access is granted only to a browser on the server machine. This page was opened from another computer. | The page's address isn't a loopback address.                                                                                                                                                                |
| The server did not grant operator access to this page. It grants it only to its own console address             | The page is on the server PC but its address isn't a console origin, or it was opened through a proxy, a tunnel or another port. Open `http://127.0.0.1:8080/operator` or `http://localhost:8080/operator`. |
| This server is older than the console (protocol 1.0; the console needs 1.1 for operator access).                | Update the server, then reload the page.                                                                                                                                                                    |
| Operator access was not granted after reconnecting.                                                             | A session that was an operator came back as a viewer. Open the console again on the server PC.                                                                                                              |

<Callout type="warn">
  **Port forwarding defeats the role check.** The server decides on the
  connection's source address and the page's origin. A proxy on the server
  PC, an `ssh -L` tunnel or any other port forward also looks like a
  loopback connection. If you forward ports to the server PC, don't rely
  on the operator role to keep remote users out.
</Callout>

An operator can also **Take over** the setup lock when another session
holds it. See [Take over the setup lock](#take-over-the-setup-lock).

If `serving.console_origins` is missing or empty in `live.yaml`, no session
gets the operator role and the server logs `serving.console_origins is
empty: no session can be granted the operator role`. The terminal console
never gets the role; see [Terminal console](/docs/operator/terminal-console).

## Expected result [#expected-result]

The console asks the page's own server where the gateway is and which
certificate to trust, then connects. You don't enter an address or a
certificate. While it connects, the page reads **Connecting to the server**.

Once connected, the top bar shows these chips:

| Chip                                                                                                                                             | Meaning                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Read-only · v… · protocol …**, from poc.6 **Depth range only · v… · protocol …**, or from poc.9 **Settings and depth range · v… · protocol …** | What this console may change. Hover it for the reason, and for whether this session is an operator or a viewer session. |
| **Viewer: sensors and profiles read-only** (from poc.9)                                                                                          | This session has no operator role. See [The operator role](#the-operator-role).                                         |
| **Connected**                                                                                                                                    | The session to the server is open.                                                                                      |
| **Setup lock: free**                                                                                                                             | Nobody is changing the server's setup right now.                                                                        |
| **Ready** or **Needs setup**                                                                                                                     | Whether the server has the calibration it needs.                                                                        |
| **Streaming**, **Streaming: starting**, **Streaming: stopped** or **Paused for setup**                                                           | The server's capture and encode state.                                                                                  |

The browser tab title also names the worst state, for example
`Needs setup — OrbbecStreamer`.

## What each panel shows [#what-each-panel-shows]

The left navigation has these panels and a checklist. From poc.9 it also
lists **Colour sensor**, **Depth sensor** and **Stream profile**; see
[Change sensor settings and the stream profile](#change-sensor-settings-and-the-stream-profile).

* **Overview** lists Cameras, Sync, Streaming, Calibration, Placement,
  Network, License and Setup tasks, the worst first. If the server needs
  setup, a banner says where to do it.
* **Cameras & sync** lists every camera with its connection (Connected or
  Disconnected) and health (OK, Degraded or Error). Open a row for its depth
  intrinsics. **Refresh** asks the server for its current state again.
* **Network**, for the [operator role](#the-operator-role) only, shows
  the network estimates for every connected session, from v0.1.1. See [Network sensing](/docs/guides/network).
* **License** shows the server ID, with **Copy server id**.
* **Setup checklist** walks through six steps (License, Cameras, Sensors,
  Profiles, Calibration, Live) and shows how far the server is. It opens by
  itself while the server needs setup. **Next step**, **Back** and
  **Close checklist** only move between steps. From poc.9 it has
  [five steps](#the-setup-checklist) and no License step.

**Theme** in the top bar switches between Dark (the default), Light and
System.

## Calibrate the depth range [#calibrate-the-depth-range]

From poc.6, the **Depth range** screen (under **Calibration** in the left
navigation, or **Open depth range** on the setup checklist) runs the
depth-range calibration: the server samples the depth it sees and fits the
mapping from depth to video codes to it. See
[Calibration](/docs/guides/calibration) for what it does and what the
server needs first.

1. Select **Take setup lock**. The line then reads `You hold the setup
   lock.` If another session holds it, the screen names it and you can
   only watch.

2. Select **Start depth-range calibration**, and have one person walk
   through the whole capture volume, near and far, until the run is
   solved. With the package's settings that takes about a minute
   (`setup.maximum_duration_seconds: 60`). From poc.7 the screen says so:
   "The run length is set on the server (up to a minute by default)". In
   poc.6 it says about 20 s.
   The screen shows **Elapsed**, **Valid samples**, **Observed range**,
   **Reconstruction error** and a histogram of the depth codes.

3. When the run is solved, the card reads **Result ready** with **Not in
   force until committed**. Check **Valid samples** and **Reconstruction
   error**, then select **Commit result**.

   <img alt="The Depth range screen with a solved run: Result ready, solved; awaiting commit, Not in force until committed, the observed range and reconstruction error, the Commit result button, and the depth-code histogram" src="__img0" />

   *Captured against the client's mock server, so the server name and figures are made up.*

4. After **Waiting for the server to confirm**, the card reads
   **Committed · revision N** and **Previous revision: M**. The new range
   applies to every client.

5. Select **Leave setup**.

**Cancel run** stops a run, and nothing is changed. Nothing is ever
committed without your click. Losing the lock or the connection ends the
run, and nothing is changed either:

| Message                                                             | Meaning                                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Setup lock lost. The run ended and nothing was changed.**         | Your lease ended, for example because the console couldn't renew it. Take the lock again and start again. |
| **Connection lost. The run ended and nothing was changed.**         | The session to the server closed.                                                                         |
| **No foreground depth arriving. Is someone in the capture volume?** | The run sees no person. Step into view of every camera.                                                   |
| **Server did not confirm. Refresh, or run again.**                  | The commit wasn't confirmed in time. Select **Refresh** to see whether it came into force.                |
| **This will fail the same way again. Run the calibration again.**   | The server refused the commit for a reason a retry won't fix. Select **Run again**.                       |
| **Commit again, or cancel.**                                        | The server couldn't save the result. Try the commit again.                                                |

## Calibrate the camera poses [#calibrate-the-camera-poses]

From v0.1.0-poc.11, the **Camera pose** screen (under **Calibration** in
the left navigation, at `/operator/calibration/pose`) calibrates the
camera poses: you move a printed ChArUco board through the cameras' views,
and the server computes where each camera is. The setup checklist's
**Calibration** step shows the same screen while the pose isn't valid.
With one camera, you don't need it: the server writes that camera's
identity pose at its first start.

The screen needs the [operator role](#the-operator-role). With it, you can
calibrate a missing pose although the package sets
`calibration.autocalibrate: false`. Up to poc.10, calibrate a missing pose
on the server instead; see
[Camera pose calibration](/docs/server/camera-calibration).

Before you start, print the board the screen describes, for example
`ChArUco board: 7 × 5 squares, 80 mm squares, 60 mm markers, dictionary
DICT_5X5_100.`, and fix it to something rigid and flat. See
[Camera pose calibration](/docs/server/camera-calibration) for how to
print it. You need one person to move the board.

1. Select **Take setup lock**.

2. Read the board line and `The run times out after 2:00.` On a rig that
   is already **Ready**, the screen warns: `Recalibrating pauses streaming
   for every viewer until you commit or cancel. The current poses stay in
   force until then.`

   <img alt="The Camera pose screen before a run: the board description and diagram, the time limit, the pause warning and Start camera-pose calibration" src="__img1" />

3. Select **Start camera-pose calibration**. While the run lasts, the
   colour, depth and stream-profile controls are refused.

4. Move the board as the screen asks: hold it flat and still at each spot,
   cover every highlighted region of every camera, and show it to two
   cameras at once where they overlap. Under the live image, each camera's
   tile shows the board's corners, a grid of regions (dashed while a region
   still needs views), **Last view** (**Accepted**, or **Not accepted:**
   and the reason), **Accepted views** and **Error**. On the right:
   **Accepted views** for the rig, **Time left**, the stages
   **Collecting**, **Solving** and **Result**, and **Camera links**, which
   shows which cameras saw the board together. Below them, one instruction
   tells you what to do next, for example `Show the board to Camera 2.` or
   `Hold the board where Camera 2 and a neighbouring camera both see it.`

   <img alt="The Camera pose screen during a run: a tile per camera with its coverage grid, the accepted views, time left, the Collecting stage, the camera links and the next instruction" src="__img2" />

5. There is no button to end collecting. When enough views are in, the
   stage moves to **Solving**, and the server tries a solve after each new
   accepted view: keep showing the board at new spots. When a solve
   succeeds, the screen shows **Proposed camera pose** with **Not in force
   until committed** and the last error per camera.

   <img alt="The Camera pose screen with a proposed pose: Not in force until committed, the last view error per camera, Commit camera pose and Discard proposal" src="__img3" />

   *Captured against the client's mock server, so the cameras and figures are made up.*

6. Select **Commit camera pose**. The screen reads **Camera pose committed
   (revision N)** and `The new poses are in force.` The server's state
   changes from **Needs setup** to **Ready**.

7. Select **Leave setup**.

A view counts only if its error is at most the limit the screen shows
(`A view counts only if its error is at most 1.00 px` by default). That
limit applies to each view, not to the final pose. Spread the views over
every region and both distances: views from one spot can give a low error
and still a wrong pose elsewhere.

Nothing is committed without your click. **Cancel run** ends a run; with
10 or more views it asks `Cancel and discard <N> collected views? Nothing
is committed.` first. **Discard proposal** throws a proposed pose away. In
both cases the previous pose stays in force.

| Message                                                                                        | Meaning                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Not accepted:** `Show the whole board.` and similar                                          | The last view didn't count. The instruction says what to change: show the whole board, hold it flat and still, turn it a little so it is not face-on, show it to two cameras at once, or move to a new spot. |
| **The run timed out**                                                                          | No solution within the time limit. Select **Start again** and cover the regions the message names.                                                                                                           |
| **Calibration failed** with `Not enough views from <cameras>: start again and cover its view.` | The solve failed for those cameras. Select **Start again**.                                                                                                                                                  |
| **The run ended** with `The setup lock is no longer yours.`                                    | Your lease ended or another session took the lock over. Nothing was committed.                                                                                                                               |
| `Capture stopped. Start capture, then start again.`                                            | The cameras closed during the run. Nothing was committed.                                                                                                                                                    |
| `This server needs an operator to start camera-pose calibration. …`                            | The session doesn't have the operator role, and `calibration.autocalibrate` is `false`. Open the console on the server PC, or calibrate on the server.                                                       |
| `This server does not report board guidance. …`                                                | A server older than poc.11. Move the board through every camera's view; only the counts are shown.                                                                                                           |
| `Live images before setup completes are sent to operator sessions only. …`                     | The run belongs to a viewer session. Place the board by the counts and the coverage grid.                                                                                                                    |

## Take over the setup lock [#take-over-the-setup-lock]

From poc.9, an operator session can take the setup lock from another
session. Only one session holds the lock, and it blocks everyone else's
changes.

While another session holds the lock, the sensor, stream profile and
Depth range screens show a banner such as `Ada holds the setup lock.
Settings are read-only until they leave setup or the lock expires`.
Select **Take over** in the banner (on the Depth range screen, next to
the lock line). A dialog titled **Take over the setup lock?** says:

* `<name> holds the setup lock. Taking it over ends their lease now, as if it had expired.`
* if a calibration run is going, that the run is abandoned and nothing is
  committed;
* `Your new lease lasts at most 30 minutes.`

Select **Take over** to confirm or **Cancel**. A viewer session has no
**Take over** button; its banner reads `Only the operator console on the
server machine can take the lock over. Ask <name> to leave setup, or wait
until it expires.`

## Change sensor settings and the stream profile [#change-sensor-settings-and-the-stream-profile]

<Callout type="warn">
  **Known issue in v0.1.2 and v0.1.3:** with person segmentation on (the default), only
  the 640×576 depth profiles are available. Other sizes need
  `mask.backend: fill_all`, which turns segmentation off.
</Callout>

From poc.9, the left navigation lists three more screens. They are for
[operator sessions](#the-operator-role); a viewer sees `Colour settings are
visible to operators only. Open the console on the server machine.` (and
the same for depth), or `Profiles are visible to operators only. Open the
console on the server machine.`

| Screen             | Address             | What you can change                                                                                     |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Colour sensor**  | `/operator/colour`  | Exposure, gain, white balance, brightness and power line frequency, each as far as the camera offers it |
| **Depth sensor**   | `/operator/depth`   | Noise removal, exposure and gain, each as far as the camera offers it                                   |
| **Stream profile** | `/operator/profile` | Which stream profile the server runs: depth mode, colour size and frame rate                            |

Open a screen from the left navigation, or enter its address on the
server PC. Changes need two things: the operator role and the setup lock.
The screens say what is missing: `Take the setup lock to change
settings.` Select **Take setup lock**, and **Leave setup** when you are
done. If another session holds the lock, see
[Take over the setup lock](#take-over-the-setup-lock).

**Colour sensor** and **Depth sensor**

* The tabs **All cameras** and one per camera choose which cameras a
  change reaches. A dot on a tab means the cameras' values differ.
* Switches and lists apply when you change them. Sliders apply when you
  let go of them. **Applied:** shows the value the camera really took; it
  can differ from what you asked for.
* **Restore defaults** resets the screen's settings.
* The server keeps the settings for each camera and restores them after a
  restart: `Settings are kept by the server for each camera and restored
  after a restart.`
* Some settings restart capture of the whole rig for a few seconds. A
  confirmation says `Applying this restarts capture of the whole rig for
  a few seconds.` While it restarts, the screen reads `Restarting
  capture. Settings are locked until the cameras are streaming again.`
* Settings are locked while a calibration runs: `Settings are locked while
  a calibration runs (it uses the current values). Commit or cancel the
  run first.`
* A line `Not shown: …` lists the camera's settings this console doesn't
  offer. They keep their current values.
* The Depth sensor screen shows `Alignment: colour aligned to depth
  (fixed: the protocol requires equal colour and depth tiles, §6).` The
  depth mode is set on **Stream profile**.

**Stream profile**

1. Choose a profile in **Stream profiles**. Each row shows its frame rate
   and sizes. A profile the cameras can't run is listed with the reason.
2. Select **Apply profile**. A dialog titled `Apply <profile>?` says
   `Streams pause for a few seconds (encoder restart).` and may list more
   consequences.
3. Select **Apply and restart streams**, or **Keep current profile**.

The card at the top shows the active profile and, while the server
switches, the switching state. If a switch takes over 30 seconds the
screen says so: `Switching for over 30 s. Check the Cameras panel; the
card follows the profile the server reports.` A profile that fails
leaves the previous one active.

While the server's cameras are closed (see
[Cameras closed](#cameras-closed)), these screens show the cameras'
state instead of controls.

## Watch the live preview [#watch-the-live-preview]

From poc.7, **Preview** in the left navigation (`/operator/preview`) shows
the server's live video. It only watches: it changes nothing on the
server. It opens its own video connection, so the console's status and
controls work without it.

* **Cloud**, **Colour tiles** and **Depth tiles** switch the view.
* The camera chips next to the view buttons hide or show a camera. A hidden camera,
  or a preview you leave, keeps its stream for 15 seconds, then closes it;
  coming back within 15 seconds reuses it. Hiding the browser tab ends
  that wait at once. While the tab is hidden the preview pauses and reads
  **Paused while this tab is hidden**. From poc.8, when you come back to the
  preview, or it reconnects, with cameras still hidden, it opens only the
  shown cameras' streams. It remembers hidden cameras until you reload the page.
* The table below the view shows each camera's stream statistics, once a
  second.

<img alt="Live preview in Colour tiles view: two camera tiles, and a table with frame sets per second, decode latency, dropped frame sets and the decoder for each camera" src="__img4" />

<img alt="Live preview in Cloud view: the two cameras' points drawn in 3D, with Pause drawing, Frame all and Reset view" src="__img5" />

*Captured from the operator team's test harness: the pictures are a synthetic
test pattern, not a camera, and the version badge reads `v0.0.0-dev`.*

The preview needs a server that is streaming. Otherwise it reads, for
example, **No preview while streaming is off**.

From v0.1.0-poc.10, an operator session also gets a preview while the server
needs setup, before the camera poses are committed. It reads **Uncalibrated
preview · foreground only · each camera is drawn in its own frame, so clouds
do not line up yet**. Until the first-run segmentation engine is ready it
adds **Whole scene may be shown until the foreground engine is ready.**
Viewer sessions, and the client, keep waiting for the committed pose; up to
poc.9 the console then reads **No preview yet. This server is not set up.** A tile that has no picture yet reads
**Waiting for first frame**. The preview needs WebGPU and an HEVC decoder,
as the client does; how much CPU decoding takes depends on the PC (see
[Check your browser](/docs/client/browser-requirements)). From v0.1.3, if
WebGPU runs only in software or fails at its first frame, the preview draws
with WebGL2, without blending, and shows an amber notice with a **What to
do** link. It shows one too if the GPU stops while you watch and doesn't
recover. See
[When WebGPU can't draw](/docs/client/browser-requirements#when-webgpu-cant-draw).

## The setup checklist [#the-setup-checklist]

From poc.9, the **Setup checklist** has five steps. Each shows the
state of one part of the setup:

| Step            | What it checks                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| **Cameras**     | Every camera is connected on a good link and captures in sync.                 |
| **Sensors**     | Review the colour and depth sensor settings. The defaults are already applied. |
| **Profiles**    | Review the stream profile: depth mode, colour size and frame rate.             |
| **Calibration** | Camera poses, so the clouds line up. The depth range is optional.              |
| **Live**        | Streams are available.                                                         |

The License step is hidden in this release. Apart from the camera-pose
screen in the **Calibration** step (from poc.11), the checklist only moves
between steps; it doesn't set anything itself. Change settings on the
screens above. Up to poc.10, calibrate camera poses on the server; see
[Camera pose calibration](/docs/server/camera-calibration).

## Cameras closed [#cameras-closed]

From poc.9, the server can run with its cameras closed: after it starts,
they stay closed until a client asks the server to open them. From
v0.1.0-poc.10 the install starts the server this way (see
[Install the release package](/docs/getting-started/install-package#wait-for-the-first-start)).

From v0.1.0-poc.10, the console opens and closes the cameras itself. Up to
poc.9, use **Start cameras** on the server's card in the
[client](/docs/client/server-card).

* **Start cameras** is on **Overview**, **Cameras & sync** and the
  checklist's **Cameras** step while the cameras are closed or failed to
  open. Any session may select it, viewer or operator, without the setup
  lock, unless another session holds the lock. It reads **Starting
  cameras…** until the cameras are open, up to a minute.
* **Stop cameras** is on **Overview** while the cameras run. It needs the
  [operator role](#the-operator-role) and the setup lock; without the lock
  the console offers **Take the setup lock**. It asks **Stop the cameras?**
  first, because streaming and any running calibration stop for every
  session.

While the cameras are closed, the console connects and shows status, but
the Cameras panel has no rows and reads one of these:

| Text                                                                                         | Meaning                                                   |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Cameras are closed. Start the cameras to see them here.`                                    | The cameras are off. Select **Start cameras**.            |
| `Opening cameras. They appear here when the server has them open.`                           | The server is opening them. This can take up to a minute. |
| `Camera start failed: <reason>. Check the cameras and cables, then start the cameras again.` | The open failed. The server doesn't retry by itself.      |

The sensor and stream profile screens show the same text, and a
calibration can't start until the cameras run.

## What this release doesn't show [#what-this-release-doesnt-show]

Some rows read **Not reported** or **Not measured**: the server can't send
that information yet. Each row names the protocol change it waits for.

| Not shown yet                               | Waits for            |
| ------------------------------------------- | -------------------- |
| Camera model, serial, firmware and USB link | Protocol change 0027 |
| License state and activation                | Protocol change 0031 |
| Placement editing                           | Later phases         |

From v0.1.0-poc.10, the server sends hardware sync status (protocol change
0029\), setup task progress such as the first-run engine build (0032), and
the preview while it needs setup (0030), so the console shows them. A
server older than poc.10 shows them as **Not reported**.

Opening the address of a panel that isn't built yet, such as
`/operator/colour`, shows **Not built yet** and the phase it
arrives in.

## Connect by address instead [#connect-by-address-instead]

When the page's server doesn't offer discovery, the console shows **This
server does not offer discovery. Enter its address.** and the **Connect to
a server** form:

1. In **Server address**, enter the gateway's address, for example
   `https://127.0.0.1:4443/orbbec`.
2. In **Certificate hash (SHA-256)**, paste the certificate's SHA-256 hash.
   Hex, colon-separated hex and Base64 are accepted. From `openssl x509
   -fingerprint -sha256`, paste only the part after `=`. With the package,
   run `sudo orbbec-tls status`: it prints JSON with several hashes. Use the
   `sha256Hex` of the `webtransport` entry whose `role` is `current` (64 hex
   characters). The `ca.sha256` value is the local CA's fingerprint and
   doesn't work here.
3. Select **Connect**.

The console remembers this server in the browser. To switch, select
**Change server** in the top bar. To go back to discovery, select **Find
the server automatically** on the form.

A typed hash doesn't follow certificate rotation (about every 6 days with
the package). After a rotation, enter the new hash, or use discovery.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                   | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page doesn't load at all                                                              | The web service isn't running. Run `sudo systemctl status orbbec-streamer-web` and `journalctl -u orbbec-streamer-web`.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Connecting to the server** for more than 10 seconds                                     | The gateway isn't up. Up to poc.9 that is usually because no camera is active yet: connect a camera. Check `journalctl -u orbbec-streamer -f`. The console keeps retrying by itself.                                                                                                                                                                                                                                                                                                                                 |
| **Can't reach the OrbbecStreamer server**                                                 | The first connection failed. Most likely the server isn't started: from poc.4 on, the install doesn't start it. On the server PC, run `sudo systemctl start orbbec-streamer` (or start it from the [terminal console](/docs/operator/terminal-console)) and connect a camera. The console only shows these commands, with **Copy**; it never starts anything. It retries by itself and connects once the server is up; **Retry now** tries at once. If the server is running, check `journalctl -u orbbec-streamer`. |
| **Connection lost** with **Retrying in … s**                                              | The server restarted or went away. Wait; the console reconnects by itself. Values shown meanwhile are from the time on the **Values as of** chip.                                                                                                                                                                                                                                                                                                                                                                    |
| **Connection lost** and **It is not retried automatically**                               | The address or certificate hash is wrong. Fix it with **Change server**, then select **Retry now**.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **This console does not match the server**                                                | The page is from another version than the server. Select **Reload**.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **The server closed the session**                                                         | A bug in the console or the server. Select **Copy details**, then **Reload**, and report the copied text if it repeats.                                                                                                                                                                                                                                                                                                                                                                                              |
| **No cameras reported**                                                                   | The server sees no camera. Check the USB 3 cable and `journalctl -u orbbec-streamer`, then select **Refresh**.                                                                                                                                                                                                                                                                                                                                                                                                       |
| The console opens as **Opened as viewer** on the server PC                                | The page's address isn't a console origin, or `serving.console_origins` is missing from a `live.yaml` you kept from an older version. See [The operator role](#the-operator-role) and [Upgrade](/docs/getting-started/install-package#upgrade).                                                                                                                                                                                                                                                                      |
| Sensor and profile screens read `Cameras are closed. Start the cameras to see them here.` | The cameras are closed (from poc.9). Select **Start cameras** on **Overview** (from poc.10), or on the server's card in the [client](/docs/client/server-card).                                                                                                                                                                                                                                                                                                                                                      |
| It doesn't work from another computer                                                     | Expected: the console opens on the server PC only. Other computers can view the cameras; see [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan).                                                                                                                                                                                                                                                                                                                           |
