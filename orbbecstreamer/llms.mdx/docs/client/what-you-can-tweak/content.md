# What you can tweak (https://irc-hslu.github.io/orbbecstreamer/docs/client/what-you-can-tweak)









This page lists every control you can change in the client. Each table covers one area of the screen; [Tour of the client](/docs/client/tour) shows where the areas are. Unless a row says otherwise, a change applies at once and stays in this browser tab only: nothing here is saved across a reload.

When a button is unavailable, the client writes the reason under it. Those reasons are listed on the page for each area.

## View section [#view-section]

The **View** section, under the header, sets how the 3D view draws overlapping cameras. Blending needs WebGPU. With WebGL2, the checkbox is unavailable, **Blend tuning** isn’t shown, and the line under the checkbox reads `Blending needs WebGPU; with WebGL2 the nearest point is drawn.`

<img alt="The View section with Blend overlapping cameras ticked, the status line Blending overlapping cameras., and Blend tuning open with its eight fields at their defaults and the Reset tuning button" src="__img0" />

| Control                       | What it changes                                                                                      | Range and default | When to change it                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| **Blend overlapping cameras** | Where cameras overlap: on, their colours mix smoothly; off, the dot nearest to you wins.             | On by default     | Turn it off when the view is slow: blending draws every point twice. |
| **Reset tuning**              | Sets the eight tuning fields back to their defaults. It doesn’t touch **Blend overlapping cameras**. |                   | After experimenting.                                                 |

### Blend tuning [#blend-tuning]

Open **Blend tuning** to see eight fields. Type a value, then press **Enter** or leave the field. A value outside the range is set to the nearest allowed value; text that isn’t a number is replaced by the value in force. The fields are unavailable while blending is off.

| Field                         | What it changes                                                                                                                                | Range          | Default | When to change it                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| **View-angle sharpness**      | How strongly the camera whose view is closest to yours wins. At 0, the viewing direction doesn’t matter.                                       | 0 to 64        | 4       | Raise it when overlaps look smeared or doubled.                                                                      |
| **Depth tolerance (m)**       | Surfaces closer together in depth than this blend instead of hiding each other.                                                                | 0 or more      | 0.01    | Lower it when a surface shows through one in front of it. Raise it when the overlap stays speckled with blending on. |
| **Depth tolerance per metre** | Extra tolerance per metre of distance from you, because depth gets noisier with distance.                                                      | 0 or more      | 0.01    | Raise it for scenes far from the cameras.                                                                            |
| **Edge fade width (px)**      | Over how many depth pixels a camera fades out towards the edges of what it sees, such as a silhouette or the image border. Whole numbers only. | 1 to 16        | 8       | Raise it when seams show along object edges.                                                                         |
| **Edge step (per m)**         | How big a depth jump between neighbouring pixels counts as an edge, times the distance: 2.5 cm at 1 m by default.                              | 0.0001 or more | 0.025   | Raise it when sloped surfaces fade as if they were edges.                                                            |
| **Full-weight distance (m)**  | Points up to this distance from their camera count fully. Farther points count less, with the square of the distance.                          | 0.001 or more  | 1       | Raise it when your cameras sit farther than 1 m from the subject.                                                    |
| **Grazing-angle floor**       | The lowest weight of a surface seen at a grazing angle.                                                                                        | 0 to 1         | 0.1     | Raise it when surfaces seen edge-on drop out of the blend.                                                           |
| **Splat falloff**             | How much less each dot counts towards its rim. At 0, the whole dot counts the same.                                                            | 0 to 64        | 2       | Raise it for smoother mixing between neighbouring dots.                                                              |

[Move around the 3D view](/docs/client/viewer#blend-overlapping-cameras) shows the effect of blending.

## Connection forms [#connection-forms]

These forms add servers and recordings. Each adds a card under **Servers**.

| Control                                                                               | What it does                                             | Values                                                                                               | When to use it                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **WebTransport URL** and **Connect to server**                                        | Connects to a capture server.                            | A URL that starts with `https://` and has no `#`, for example `https://capture-01.local:4433/orbbec` | For a real server. See [Add a server](/docs/client/add-a-server).        |
| **Colour .hevc**, **Depth .hevc (Main10)**, **Manifest .json** and **Play recording** | Plays a recording.                                       | Raw HEVC files and a manifest. See [File requirements](/docs/client/playback#file-requirements).     | To test without a server. See [Play a recording](/docs/client/playback). |
| **Add mock server**                                                                   | Adds a simulated server. Only in the development server. |                                                                                                      | To try cards and setup without hardware.                                 |

## Server card [#server-card]

Each card holds one checkbox and up to seven buttons. [Read a server card](/docs/client/server-card#what-each-button-does) lists when each button is unavailable.

<img alt="A server card for the Dev mock server, with the Receive shared updates checkbox ticked and the Set up, Acquire lock, Release lock, Refresh, Reconnect and Remove buttons" src="__img1" />

| Control                                                     | What it does                                                                                                                                                                   | Default | When to use it                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------- |
| **Receive shared updates (calibration results, placement)** | On: the server sends this client every calibration result and placement change. Off: the card shows `Metadata is stale: a shared update was withheld.` when something changed. | On      | Turn it off if you don’t need other clients’ setup results as they happen. |
| **Refresh stale metadata**                                  | Fetches the server’s full state. Shown only while the stale line is shown.                                                                                                     |         | When the stale line appears.                                               |
| **Set up**                                                  | Opens the setup view and takes the setup lock.                                                                                                                                 |         | To calibrate or place the server.                                          |
| **Acquire lock**                                            | Takes the setup lock without opening the setup view.                                                                                                                           |         | To keep others from changing the server.                                   |
| **Release lock**                                            | Gives the lock back.                                                                                                                                                           |         | When you’re done holding it.                                               |
| **Refresh**                                                 | Fetches the server’s full state.                                                                                                                                               |         | When the card looks out of date.                                           |
| **Reconnect**                                               | Connects again at once, instead of waiting for the automatic retry.                                                                                                            |         | When the card shows `reconnect scheduled`.                                 |
| **Remove**                                                  | Disconnects and removes the card and its point clouds.                                                                                                                         |         | To stop using a server, or to replay a recording.                          |

## Setup view [#setup-view]

The setup view holds the setup lock while it’s open. [Set up a server](/docs/client/setup-workspace) and [Calibrate depth](/docs/client/calibration) explain each control.

| Control                          | What it does                                                                                    | When to use it                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Leave setup (release lock)**   | Cancels a running calibration, releases the lock and closes the setup view. It commits nothing. | When you’re done. Commit first what you want to keep.                          |
| **Enter setup again**            | Asks for the lock again after the session ended.                                                | After you were forced out.                                                     |
| **Back to servers**              | Closes the setup view after the session ended.                                                  | After the session ended.                                                       |
| **Start depth quantization**     | Starts a depth calibration run on the server.                                                   | To measure a new depth mapping.                                                |
| **Cancel depth quantization**    | Stops the run. Nothing is committed.                                                            | When the scene isn’t ready.                                                    |
| **Commit depth quantization**    | Puts the result in force for every client.                                                      | After `Result ready`. A result you don’t commit is thrown away when you leave. |
| **scale**: **log** or **linear** | The histogram’s vertical scale. Default **log**, which keeps small counts visible.              | Choose **linear** to compare the big peaks.                                    |

The **Camera pose** and **Network** sections have no controls yet.

## Placement [#placement]

The **Placement** section is at the bottom of the setup view. It edits a draft that only your 3D view shows until you commit it. See [Place a server in the scene](/docs/client/placement-editing).

<img alt="The Placement section with a draft: the server placement at revision 1, the draft changed to x 0.500, z 1.000 and yaw 30.0, Move in 3D ticked with translate selected, and the Commit placement and Discard draft buttons" src="__img2" />

| Control                                                | What it changes                                                                                                              | Range and default                                                                       | When to change it                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| **Edit placement**                                     | Starts a draft equal to the server’s placement.                                                                              |                                                                                         | To move the server.                   |
| **x (m)**, **y (m)**, **z (m)**                        | The server’s position relative to its anchor. +X is right, +Y up, +Z forward.                                                | −1000 to 1000 m. Shown to 1 mm.                                                         | To set an exact position.             |
| **yaw (°)**, **pitch (°)**, **roll (°)**               | The server’s rotation, applied roll first, then pitch, then yaw.                                                             | −360 to 360° typed. Shown to 0.1°, with pitch −90 to 90° and yaw and roll −180 to 180°. | To set an exact rotation.             |
| **−** and **+**, or **Arrow Down** and **Arrow Up**    | Step a field by 0.01 m or 1°. With **Shift**, the arrow keys step ten times that.                                            |                                                                                         | To nudge a value.                     |
| **Move in 3D (drag the handle on the server’s cloud)** | Shows a handle in the 3D view that moves the draft as you drag it.                                                           | Off                                                                                     | To place the server by eye.           |
| **handle**: **translate** or **rotate**                | Arrows that move along an axis, or rings that turn about one.                                                                | **translate**                                                                           | Choose **rotate** to turn the server. |
| **Commit placement (expected revision N)**             | Sends the draft. Every client then draws the server there.                                                                   |                                                                                         | When the draft is right.              |
| **Discard draft**                                      | Drops the draft. Nothing is sent.                                                                                            |                                                                                         | To start over.                        |
| **Rebase on server placement (revision M)**            | Keeps your draft’s pose, but bases it on a newer server placement. Shown only when someone else committed after you started. |                                                                                         | Before you commit a stale draft.      |

## World anchors [#world-anchors]

The **World anchors** section, under the server cards, moves where this browser draws an anchor, and every server placed relative to it. It needs no lock and never reaches a server. See [Move an anchor in your view](/docs/client/world-anchors).

| Control                                                                   | What it changes                                                         | Range and default                                       | When to change it                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| **x (m)**, **y (m)**, **z (m)**, **yaw (°)**, **pitch (°)**, **roll (°)** | The anchor’s pose in your 3D view. They work like the placement fields. | Same as placement. Default: the scene origin, all zero. | To line servers up in your own view. |
| **Reset to identity**                                                     | Puts the anchor back at the scene origin.                               |                                                         | To undo your changes.                |

## 3D view [#3d-view]

The 3D view has camera controls but no settings. [Move around the 3D view](/docs/client/viewer#move-the-camera) lists them:

* **Orbit**: drag with the left button, or the arrow keys
* **Pan**: drag with the right button, or **Ctrl** with the arrow keys
* **Zoom**: the mouse wheel, or **Alt+Up** and **Alt+Down**

## What you can’t change in the client [#what-you-cant-change-in-the-client]

These have fixed values, or are set elsewhere:

* **Point size and shape**: square dots 2 device pixels wide. The renderer supports other sizes, round dots and a debug view as developer options. See [Developer options](/docs/client/developer/developer-options#point-settings).
* **Playback speed, looping and seeking**: a recording plays at its manifest’s `frameRate`, and loops when `loop` is `true`. To play it again, select **Remove** on its card and open it again. See [Manifest fields](/docs/client/playback#manifest-fields).
* **Reconnect delays and timeouts**: developer options without a control. See [Developer options](/docs/client/developer/developer-options#connection-timing).
* **Colour-only, depth-only and mask views**: not planned yet
