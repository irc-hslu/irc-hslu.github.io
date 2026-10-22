# From a fresh install to a fused point cloud (https://irc-hslu.github.io/orbbecstreamer/docs/guides/fresh-start-to-fused-cloud)















{/* SKELETON for the core release (operator/design/release-core.md, M7).
    Not for publication until every step is filled and has been followed
    literally on a fresh rig install. Each TODO names the milestone that
    fills it. Quote strings from source at the release tag. */}

This guide takes one rig from a fresh install to a live, fused point cloud
in the browser and in the Operator Console preview. Follow the steps in
order; each one ends with what you should see.

## Before you start [#before-you-start]

{/* TODO M7: supported rig (PC, GPU, driver, cameras, sync cables, ChArUco
    board), from the release's hardware list. */}

<Steps>
  <Step>
    ## Install the package [#install-the-package]

    Follow [Install the release package](/docs/getting-started/install-package):
    check the machine, add NVIDIA's apt repository, install the `.deb`, run
    `orbbec-streamer-preflight`. The install starts the server with the
    cameras closed.

    You should see a last line starting `preflight: OK` at the end of the machine check. The first
    start builds the segmentation engine for your GPU, about 3 minutes, once.
    The cameras stay closed until you open them in the next steps.
    Until then the server's card reads **Cameras closed** and the Operator
    Console's Cameras panel reads `Cameras are closed. Start the cameras to see
    them here.` See [Cameras closed](/docs/operator#cameras-closed).
  </Step>

  <Step>
    ## Open the Operator Console [#open-the-operator-console]

    In Chrome or Edge on the server PC, open `http://127.0.0.1:8080/operator`
    (`http://localhost:8080/operator` works too). See
    [Operator Console](/docs/operator).

    You should see the page connect without asking for an address or a
    certificate, then the top bar chips **Connected** and **Setup lock: free**,
    and **Ready** or **Needs setup**. On the server PC the session has the
    [operator role](/docs/operator#the-operator-role), so the first chip reads
    **Settings and depth range · v… · protocol …**. If instead a banner reads
    **Opened as viewer**, the sensor and profile screens are read-only; the
    banner names the cause.

        <img alt="Operator Console Overview: Connected, Setup lock: free, Ready and Streaming, one camera connected with sync OK, and a hint that the depth range is not calibrated" src="__img0" />

    *Captured on 2026-10-17 from v0.1.2 installed from the package, with its default `live.yaml` (one Femto Bolt, sync off); the room was dark.*
  </Step>

  <Step>
    ## Check the cameras and their sync [#check-the-cameras-and-their-sync]

    Open the cameras first. In the Operator Console, select **Start cameras**
    on **Overview** or **Cameras & sync**; it reads **Starting cameras…** for up
    to a minute. See [Cameras closed](/docs/operator#cameras-closed). (The
    server's card in the client at `http://127.0.0.1:8080` has the same button;
    see [Server card](/docs/client/server-card).) If it reports that the
    cameras did not start, read the reason, check the camera's cable and power,
    and select **Start cameras** again.

    The default config runs one camera. For a rig, add each camera's serial
    number, mark exactly one as primary, connect the sync cables and set
    `sync.enabled: true`. The comments at the top of
    `/etc/orbbec-streamer/live.yaml` show how; your edits survive upgrades. See
    [More than one camera](/docs/getting-started/install-package#more-than-one-camera).

    In the Operator Console, open **Cameras & sync**. You should see one row
    for every camera, each **Connected** with health **OK**. In the
    **Setup checklist**, the **Cameras** step checks that every camera is
    connected on a good link and captures in sync. See
    [What each panel shows](/docs/operator#what-each-panel-shows).

        <img alt="Cameras & sync with one Femto Bolt: Connected, health OK, USB 3, sync role Standalone" src="__img1" />

    *Captured on 2026-10-17 from v0.1.2 installed from the package, with its default `live.yaml` (one Femto Bolt, sync off); the room was dark. The serial number is blurred.*

    In the first minute after **Start cameras**, a camera's health can read
    **Degraded**: the camera drops a few frame sets at each start while it
    syncs its clock. That is normal; it turns **OK** by itself.

    {/* TODO M4: hardware-sync status row and its healthy values (the console
        shows it as Not reported until protocol change 0029); what to do when a
        camera is out of sync. */}
  </Step>

  <Step>
    ## Apply sensor and profile settings [#apply-sensor-and-profile-settings]

    The defaults are already applied, so this step is a review. In the
    Operator Console, select **Take setup lock** on a settings screen, then
    look at **Colour sensor**, **Depth sensor** and **Stream profile** in the
    left navigation. Change only what your scene needs, and select **Leave
    setup** when you are done. See
    [Change sensor settings and the stream profile](/docs/operator#change-sensor-settings-and-the-stream-profile).

    * On **Colour sensor** and **Depth sensor**, the **All cameras** tab reaches
      every camera. Sliders apply when you let go of them; **Applied:** shows
      the value the camera really took.
    * On **Stream profile**, choose a row in **Stream profiles**, select
      **Apply profile**, then **Apply and restart streams**. Streams pause for a
      few seconds.

    With person segmentation on (the default), v0.1.2 to v0.1.4 offer only the 640×576
    depth profiles; see the
    [known issue](/docs/operator#change-sensor-settings-and-the-stream-profile).

    You should see the **Sensors** and **Profiles** steps of the **Setup
    checklist** (see [The setup checklist](/docs/operator#the-setup-checklist))
    without errors, and `Settings are kept by the server for each camera and
    restored after a restart.` on the sensor screens.

        <img alt="Colour sensor, read-only until you take the setup lock: Auto exposure on, Exposure 200, Gain 0, Auto white balance on" src="__img2" />

        <img alt="Stream profile: the current profile, 640x576 depth, 1280x720 colour, 15 fps, above the profiles you can switch to" src="__img3" />

    *Captured on 2026-10-17 from v0.1.2 installed from the package, with its default `live.yaml` (one Femto Bolt, sync off); the room was dark.*

    {/* TODO M4: first-run wizard, expected time about 5 minutes; screenshots of
        the sensor and profile screens. */}
  </Step>

  <Step>
    ## Calibrate the depth range [#calibrate-the-depth-range]

    This step is optional. Without it the server uses a linear depth range.
    Follow [Calibrate the depth range](/docs/operator#calibrate-the-depth-range):
    on **Depth calibration plot** (**Depth range** up to v0.1.3), select **Take setup lock**, then **Start depth-range
    calibration**, and have one person walk through the whole capture volume,
    near and far. The cameras must be running and the segmentation engine
    ready; see [Calibration](/docs/guides/calibration#before-a-depth-run-from-a-browser).

    You should see **Elapsed**, **Valid samples**, **Observed range** and
    **Reconstruction error** update for about a minute, then **Result ready**
    with **Not in force until committed**. Check **Valid samples** and
    **Reconstruction error**, select **Commit result**, and wait for
    **Committed · revision N**. Select **Leave setup**.

    {/* TODO M2: confirm on the rig with a live scene; real screenshot. */}
  </Step>

  <Step>
    ## Calibrate the camera poses [#calibrate-the-camera-poses]

    With one camera, skip this step: the server writes the camera's identity
    pose at its first start. You should see **Pose valid · r1** on the server's
    card.

    With several cameras, the server needs a camera-pose calibration before it
    sends video. Print the ChArUco board that the **Camera pose** screen
    describes: from v0.1.4 the screen draws it, and **Download board (SVG,
    print at 100 %)** saves it at its real size (see also
    [Camera pose calibration](/docs/server/camera-calibration)). The default
    from v0.1.4 is 4 × 6 squares of 105 mm; see
    [Calibration board](/docs/getting-started/install-package#calibration-board).
    Fix it to something rigid and flat. One person moves the
    board.

    In the Operator Console, open **Camera pose** under **Calibration**, select
    **Take setup lock**, then **Start camera-pose calibration**. From v0.1.6,
    start only after the cameras have streamed for about 40 minutes: their
    depth drifts while they warm up, and the server flags a pose solved
    earlier (`solved-before-warm-up`). From v0.1.6
    each camera's tile shows its live image with the detected board drawn on
    it and `Board seen (N corners)`; hold the board still for a moment at each
    spot so the server keeps the view, then move or tilt it to a new one. Move the board
    as the screen's instruction says, until every highlighted region of every
    camera is covered and **Camera links** joins all cameras. When the screen
    shows **Proposed camera pose**, select **Commit camera pose**, then
    **Leave setup**. See
    [Calibrate the camera poses](/docs/operator#calibrate-the-camera-poses).

    You should see **Camera pose committed (revision N)** and `The new poses
    are in force.`, and the top bar change from **Needs setup** to **Ready**.
    The **Calibration** step of the **Setup checklist** shows the same screen;
    see [The setup checklist](/docs/operator#the-setup-checklist). The team
    has tested this calibration with synthetic cameras only, not yet on
    hardware.

        <img alt="Camera pose calibration with one camera: Camera pose: valid · revision 1, the ChArUco board description and Start camera-pose calibration" src="__img4" />

    *Captured on 2026-10-17 from v0.1.2 installed from the package, with its default `live.yaml` (one Femto Bolt, sync off); the room was dark. The pose shown is the identity pose the server writes for one camera; no board calibration was run.*

    {/* TODO M2: real screenshots from the rig run (B3), two cameras with a board. */}
  </Step>

  <Step>
    ## Start streaming and watch the preview [#start-streaming-and-watch-the-preview]

    If the cameras are still closed, select **Start cameras** on the Operator
    Console's **Overview**. Then open **Preview** in
    the Operator Console's left navigation (`/operator/preview`) and choose
    **Cloud**. See [Watch the live preview](/docs/operator#watch-the-live-preview).
    For the client itself, see [First stream](/docs/getting-started/first-stream).

    You should see the server's card read **Streaming**, and in the
    **Preview** the cameras' points drawn in 3D, with **Pause drawing**,
    **Frame all** and **Reset view**. **Colour tiles** and **Depth tiles** show
    each camera's pictures, and the table below shows frame sets per second,
    decode latency and dropped frame sets. While a tile has no picture it reads
    **Waiting for first frame**. The preview needs WebGPU and an HEVC decoder;
    see [Check your browser](/docs/client/browser-requirements). If WebGPU
    can't draw, the preview uses WebGL2 and shows a notice
    with a **What to do** link; see
    [When WebGPU can't draw](/docs/client/browser-requirements#when-webgpu-cant-draw).

    {/* TODO M1: real (not test-pattern) preview screenshots; what a correct
        fused cloud looks like. */}
  </Step>

  <Step>
    ## Connect a viewer [#connect-a-viewer]

    On the server PC, open `http://127.0.0.1:8080` and connect to the server;
    see [First stream](/docs/getting-started/first-stream).

    To view from another computer on the same LAN, turn on LAN viewers as in
    [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan):
    the page server's drop-in, `lan_viewers: true` in `live.yaml`, the
    firewall ports, and the installation's certificate authority trusted once
    on each viewer. Then open `https://<server-hostname>.local:8443` on the
    viewer. A LAN viewer never gets the operator role: it can open the
    Operator Console at `/operator` only as a viewer. From v0.1.6 a viewer
    can't take the setup lock or calibrate the depth range; up to v0.1.5 it
    could.

    You should see the same point cloud on the viewer as in the console's
    **Preview**.

    {/* TODO M6: confirm from a second machine on the rig run; real screenshot. */}
  </Step>

  <Step>
    ## Measure the floor (optional) [#measure-the-floor-optional]

    From v0.1.6 the server can measure the floor from the running cameras, so
    that the scene stands level in the viewer. It needs a valid camera pose and
    the operator role. In the Operator Console, open **Floor** under
    **Calibration**, select **Take setup lock**, then **Measure floor**. When
    the screen reads `Solved. Not in force until committed.`, select **Commit
    floor**. Then select **Level to floor**: it opens a placement draft, which
    you commit with **Commit placement (expected revision N)**. Nothing is
    levelled without that commit. See
    [Measure the floor](/docs/operator#measure-the-floor). The floor
    measurement was tested in simulation, not yet on hardware.

    You should see `Floor: measured · revision N` and, in the client with
    **Show floor** on in the view settings, the floor grid under the scene.
  </Step>

  <Step>
    ## Check the network [#check-the-network]

    From v0.1.1, open **Network** in the Operator Console's left navigation
    (`/operator/network`). See
    [The Operator Console's Network panel](/docs/guides/network#the-operator-consoles-network-panel).

    You should see one row for each connected session, your own marked
    **You**, with round-trip time, the rates in both directions and loss from
    the server to each viewer. A `≥` before a rate means the real value is at
    least that high; see [Read the estimates](/docs/guides/network#read-the-estimates).

        <img alt="The Network panel with two loopback sessions, the console (Operator, You) and one viewer, with rates, round-trip time and loss" src="__img5" />

    *Captured on 2026-10-17 from v0.1.2 installed from the package, with its default `live.yaml` (one Femto Bolt, sync off); the room was dark. The viewer tab received no video, so **Media, Mbit/s** reads `— not measured`.*

    {/* TODO M6: the rig's healthy values, loopback and LAN viewer; screenshot. */}
  </Step>

  <Step>
    ## Add a second server and place it [#add-a-second-server-and-place-it]

    {/* TODO M5 (in core, last; owner 2026-10-12): multi-server fusion and placement; see
        [Placement](/docs/guides/placement). */}
  </Step>
</Steps>

## Expected result [#expected-result]

{/* TODO M7: the definition of done as the reader sees it: 10 minutes with
    0 dropped frame sets, restart and upgrade keep the setup. */}

## Troubleshooting [#troubleshooting]

{/* TODO M7: failures met during the rig walkthrough. */}
