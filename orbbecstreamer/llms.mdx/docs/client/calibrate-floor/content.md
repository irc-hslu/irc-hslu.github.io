# Calibrate the floor (https://irc-hslu.github.io/orbbecstreamer/docs/client/calibrate-floor)



The floor step measures where the floor is, in the server’s own frame, from the running cameras. It is there only when the server offers it; a server that doesn’t offer it shows no **Floor** section and no floor chip. Measuring needs the operator role and the setup lock, like the other setup steps. A viewer sees the status only.

The team has not yet tried this on the real rig; it has been checked only against a simulated server. How the server measures the floor, and what to expect from the numbers, is in the server docs: [Measure the floor](/docs/server/camera-calibration#measure-the-floor).

The measured floor is a plane. Nothing moves when you commit it. To bring the cloud level, use **Level to floor** (see below), which opens a placement draft that you commit in **Placement**.

## Measure the floor [#measure-the-floor]

1. Open the setup view: select **Set up** on the card. The session chip must read **Active**.
2. The server’s camera pose must be **valid**. Otherwise **Calibrate floor** is off, with the tip `Needs a valid camera pose first.` The cameras must also be running.
3. In **Floor**, select **Calibrate floor**. The state chip reads **running**.
4. While it runs, a line shows the best candidate so far: its residual in mm, its inlier share, and how many frames it used, in the form `candidate … mm, … % inliers (… of … frames)`. Nothing is in force yet.
5. When the run is solved, **Commit** appears next to **Cancel**. Select **Commit** to keep the floor, or **Cancel** to throw the run away.

After **Commit**, the chip reads for example **valid · r2**, and the numbers below it are those of the committed floor:

| Number           | Meaning                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **residual**     | How far the points on the floor are from the plane, in mm. Above 10 mm it is marked `above the 10 mm target`.                |
| **inlier share** | The share of sampled points that lie on the plane.                                                                           |
| **gravity gate** | The angle between the plane and the server’s gravity reference, in degrees. `no gravity reference` when the server has none. |
| **tilt**         | The angle between the floor and level in the scene, with the server’s placement applied.                                     |
| **height**       | The floor’s height above the scene’s ground, with the placement applied, in mm.                                              |

The server card shows a **Floor** chip next to **Pose** and **Depth**, for example **Floor valid · r2** or **Floor stale**.

## When it fails [#when-it-fails]

A failed run shows the stage and the server’s text, for example `Stage: no plane.` or `Stage: too few inliers.` The stage is one of `not enough depth`, `no plane`, `normal outside gravity gate` and `too few inliers`. The text after it is the server’s own. Select **Calibrate floor** to try again; the previous committed floor stays in force.

## When the cameras are recalibrated [#when-the-cameras-are-recalibrated]

A new camera pose makes the floor **stale**: the old plane no longer matches the cameras. The section says `The cameras were recalibrated; measure the floor again.` The old numbers stay on screen. Select **Calibrate floor**.

## Level to floor [#level-to-floor]

**Level to floor** opens a placement draft that makes the measured floor level and puts it at the scene’s ground, keeping the server’s yaw. It is a draft:

* Nothing is sent. Review it in **Placement**, then select **Commit** there. See [Place a server in the scene](/docs/client/placement-editing).
* After you commit a floor, the client opens this draft by itself: `A level placement draft is open; review and commit it in Placement.`
* If you have unsaved placement edits, they are kept and the client says so. Select **Level to floor** to replace them.
* If the measured floor points down or sideways in the current placement, there is no draft: `The measured floor points down in this placement; level it by hand.` **Level to floor** is off with the same reason.

## Correct the floor by hand [#correct-the-floor-by-hand]

If the level draft is close but not right, nudge it in the Floor section, under **Correct by hand**:

* **Pitch** ±0.5°. Plus lifts the far side of the cloud (away from you along +Z).
* **Roll** ±0.5°. Plus lifts the +X side.
* **Height** ±1 cm. Plus lifts the whole cloud.

**Tilt** and **Height** next to the buttons show the measured floor under the draft, live. Nudge until both read 0.

These buttons edit the placement draft (they open one if none is open). They never commit: `Adjusts the placement draft; commit it in Placement.` The rotation turns about the floor point, not the scene origin, so the cloud does not swing. Yaw is never changed. The buttons are off without a measured floor, for a viewer, and while the draft is being committed; each says why.

## Use a keyboard or screen reader [#use-a-keyboard-or-screen-reader]

**Calibrate floor**, **Commit**, **Cancel**, **Level to floor** and the **Pitch**, **Roll** and **Height** nudges are buttons in the tab order. Unavailable ones stay reachable and name their reason. When **Commit** or **Cancel** go away, focus moves to **Calibrate floor**. Screen readers announce, without moving focus, that the floor was measured and waits for **Commit**, a failure with its stage, that the floor is stale, and the result of the level draft.

See also [Show the floor](/docs/client/what-you-can-tweak#view-section) in the 3D view.
