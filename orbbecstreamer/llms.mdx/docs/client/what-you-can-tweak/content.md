# What you can tweak (https://irc-hslu.github.io/orbbecstreamer/docs/client/what-you-can-tweak)













Every control in the client, one table per area; [Tour of the client](/docs/client/tour) shows where the areas are. Unless a row says otherwise, a change applies at once and lasts until you reload the page.

An unavailable button stays visible. Hover over it, or focus it with the keyboard, to see why:

<img alt="A tip over the server card’s release-lock button: Release lock, This client does not hold the lock" src="__img0" />

## Window and theme [#window-and-theme]

| Control                                                                  | What it changes                                                                               | Default | When to change it             |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------- | ----------------------------- |
| Panel toggle, top right of the 3D view (**Hide panel** / **Show panel**) | Hides the side panel, so the 3D view fills the window                                         | Shown   | To look at the scene alone    |
| Sun or moon button in the header (**Light theme** / **Dark theme**)      | The panel’s theme. This browser remembers it. The 3D view stays dark.                         | Dark    | In a bright room              |
| **i** next to the header chips                                           | Shows the renderer notes, for example why WebGL2 was picked. Only shown when there are notes. |         | When the chip says **WebGL2** |

## View section [#view-section]

<img alt="The View section: the Blend switch on, the status line Blending overlapping cameras., Points open with its five settings and Reset points, and Blend tuning open with its eight fields at their defaults and Reset tuning" src="__img1" />

| Control          | What it changes                                                                                                                                       | Default | When to change it                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| **Blend**        | On: where cameras overlap, their colours mix smoothly. Off: the dot nearest to you wins. Needs WebGPU; with WebGL2 the switch is off and unavailable. | On      | Turn it off when the view is slow: blending draws every point twice. |
| **Reset tuning** | Sets the eight **Blend tuning** fields below back to their defaults. **Blend** stays as it is.                                                        |         | After experimenting                                                  |

### Points [#points]

Open **Points** for how each dot is drawn. These settings work with both WebGPU and WebGL2, and change the view at once. With WebGL2, some graphics cards can't draw dots as large as 64 pixels; there, large dots stay smaller than the value you set. Type a value, then press **Enter** or leave the field; a value out of range is set to the nearest allowed one.

| Control             | What it does                                                                                                                  | Range           | Default | When to change it                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------- | ------- | --------------------------------------------------- |
| **Size mode**       | **Screen**: every dot has the same size on screen. **World**: dots are sized like the scene, so they grow as you move closer. | Screen or World | Screen  | Choose World when gaps open between dots up close   |
| **Point size (px)** | The size of every dot in screen mode. Unavailable in World mode.                                                              | 1 to 64         | 2       | Raise it to fill gaps; lower it for fine detail     |
| **World scale**     | In World mode, how many depth pixels wide each dot is. Above 1, neighbours overlap. Unavailable in Screen mode.               | 0 or more       | 1.5     | Raise it when gaps show on slanted surfaces         |
| **Max size (px)**   | In World mode, the largest a dot may get when you are close. Unavailable in Screen mode.                                      | 1 to 64         | 16      | Lower it when the view gets slow close to a surface |
| **Shape**           | **Square** or **Round** dots                                                                                                  | Square or Round | Square  | Round looks softer; square is the fastest           |
| **Reset points**    | Sets the five settings above back to their defaults                                                                           |                 |         | After experimenting                                 |

Sizes are in screen pixels of the drawn picture. At 200 % display scaling, 2 px is one CSS pixel. The settings stay in this browser tab only and go back to the defaults when you reload the page.

### Blend tuning [#blend-tuning]

Open **Blend tuning** for eight fields; hover over a field for its one-line hint. Type a value, then press **Enter** or leave the field. A value out of range is set to the nearest allowed one. The fields are unavailable while **Blend** is off.

| Field                         | What raising it does                                                                         | Range          | Default | When to change it                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------- | -------------- | ------- | ---------------------------------------------------------------------------------------- |
| **View-angle sharpness**      | Favours the camera whose view is closest to yours. At 0, the view angle doesn’t matter.      | 0 to 64        | 4       | Overlaps look smeared or doubled                                                         |
| **Depth tolerance (m)**       | Blends surfaces farther apart in depth instead of hiding one                                 | 0 or more      | 0.01    | Lower it when a surface shows through one in front; raise it when overlaps stay speckled |
| **Depth tolerance per metre** | Adds tolerance per metre of distance from you                                                | 0 or more      | 0.01    | Scenes far from the cameras                                                              |
| **Edge fade width (px)**      | Fades a camera out over more depth pixels at the edges of what it sees. Whole numbers.       | 1 to 16        | 8       | Seams along object edges                                                                 |
| **Edge step (per m)**         | Needs a bigger depth jump, times the distance, to count as an edge: 2.5 cm at 1 m by default | 0.0001 or more | 0.025   | Sloped surfaces fade as if they were edges                                               |
| **Full-weight distance (m)**  | Points up to this distance from their camera count fully; farther ones count less            | 0.001 or more  | 1       | Cameras sit farther than 1 m from the subject                                            |
| **Grazing-angle floor**       | Raises the lowest weight of surfaces seen edge-on                                            | 0 to 1         | 0.1     | Edge-on surfaces drop out of the blend                                                   |
| **Splat falloff**             | Makes each dot count less towards its rim                                                    | 0 to 64        | 2       | Mixing between neighbouring dots looks rough                                             |

## Servers section [#servers-section]

<img alt="The top of the Servers section: the URL field with Connect, the folded Open recording, and Add mock server" src="__img2" />

| Control                                                                                                         | What it does                                                                 | When to use it                                                           |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| URL field and **Connect**                                                                                       | Connects to a capture server. The URL starts with `https://` and has no `#`. | For a real server. See [Add a server](/docs/client/add-a-server).        |
| **Open recording** (folded): **Colour .hevc**, **Depth .hevc (Main10)**, **Manifest .json**, **Play recording** | Plays a recording                                                            | To test without a server. See [Play a recording](/docs/client/playback). |
| **Add mock server**                                                                                             | Adds a simulated server. Development server only.                            | To try the client without hardware                                       |

## Server card [#server-card]

<img alt="A server card with Details open: Lock, Calibration, Layout, Counts, Network, and Shared with the Receive updates switch" src="__img3" />

| Control                                | What it does                                                                               | When to use it                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Set up**                             | Opens the setup view and takes the setup lock. Unavailable for a recording.                | To calibrate or place the server                  |
| Lock icon (**Acquire lock**)           | Takes the setup lock without opening setup                                                 | To keep others from changing the server           |
| Open-lock icon (**Release lock**)      | Gives the lock back                                                                        | When you’re done holding it                       |
| Circular arrow (**Refresh**)           | Fetches the server’s full state                                                            | The card looks out of date                        |
| Plug (**Reconnect**)                   | Connects again at once                                                                     | The card waits for an automatic retry             |
| Bin (**Remove**)                       | Disconnects and removes the card                                                           | To stop using a server, or to replay a recording  |
| **Refresh** in the stale-metadata box  | Fetches the server’s full state. Shown only with `Metadata is stale`.                      | When the box appears                              |
| **Details**                            | Folds the card’s full status out                                                           | To read lock, calibration and bundle details      |
| **Receive updates**, under **Details** | On: the server sends other clients’ calibration results and placement changes. Default on. | Turn it off if you don’t need them as they happen |

## Setup view [#setup-view]

| Control                                                | What it does                                                                     | When to use it                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Leave**                                              | Cancels a running calibration, releases the lock, closes setup. Commits nothing. | When you’re done. Commit first what you want to keep. |
| **Enter setup**, **Back**                              | Ask for the lock again, or close setup, after the session ended                  | After you were forced out                             |
| **Start**, **Cancel**, **Commit** (Depth quantization) | Run, stop, or put a depth calibration in force                                   | See [Calibrate depth](/docs/client/calibration)       |
| **Log** / **Linear** (Depth codes)                     | The histogram’s scale. Default **Log**.                                          | **Linear** to compare the big peaks                   |

## Placement [#placement]

<img alt="The Placement section with a draft: Draft and Changed chips, the draft pose fields, Move in 3D on with Translate selected, and Commit and Discard" src="__img4" />

| Control                                         | What it changes                                                                           | Range and default                                 | When to change it               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| **Edit**                                        | Starts a draft equal to the server’s placement                                            |                                                   | To move the server              |
| **x (m)**, **y (m)**, **z (m)**                 | Position relative to the anchor. +X right, +Y up, +Z forward.                             | −1000 to 1000 m, shown to 1 mm                    | Exact position                  |
| **yaw (°)**, **pitch (°)**, **roll (°)**        | Rotation, roll first, then pitch, then yaw                                                | −360 to 360°, shown to 0.1° with pitch −90 to 90° | Exact rotation                  |
| **−** / **+**, or **Arrow Down** / **Arrow Up** | Steps a field by 0.01 m or 1°; **Shift** with the arrow keys steps ten times that         |                                                   | Nudging                         |
| **Move in 3D**                                  | Shows a handle in the 3D view; dragging it moves the draft                                | Off                                               | Placing by eye                  |
| **Translate** / **Rotate**                      | Handle arrows that move, or rings that turn                                               | **Translate**                                     | **Rotate** to turn the server   |
| **Commit**                                      | Sends the draft; every client then draws the server there                                 |                                                   | The draft is right              |
| **Rebase**                                      | Keeps your pose on a newer server placement. Shown when someone else committed meanwhile. |                                                   | Before committing a stale draft |
| **Discard**                                     | Drops the draft                                                                           |                                                   | To start over                   |

## World anchors [#world-anchors]

| Control                             | What it changes                                                                                        | Default              | When to change it                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------- |
| **x (m)** … **roll (°)** per anchor | Where this browser draws the anchor and its servers. Never sent to a server. Same fields as placement. | At the origin, all 0 | To line servers up in your own view |
| **Reset**                           | Puts the anchor back at the origin                                                                     |                      | To undo your changes                |

## 3D view [#3d-view]

No settings; [Move around the 3D view](/docs/client/viewer#move-the-camera) lists the camera controls:

* **Orbit**: drag with the left button, or the arrow keys
* **Pan**: drag with the right button, or **Ctrl** with the arrow keys
* **Zoom**: the mouse wheel, or **Alt+Up** and **Alt+Down**

## What you can’t change in the client [#what-you-cant-change-in-the-client]

* **Point size and shape**: square dots 2 device pixels wide. Other sizes, round dots and a debug view are [developer options](/docs/client/developer/developer-options#point-settings).
* **Playback speed, looping and seeking**: set by the recording’s manifest. See [Manifest fields](/docs/client/playback#manifest-fields).
* **Reconnect delays and timeouts**: [developer options](/docs/client/developer/developer-options#connection-timing).
* **Background pause**: streams pause after the tab is hidden for 10 s. See [When the tab is in the background](/docs/client/viewer#when-the-tab-is-in-the-background).
* **Colour-only, depth-only and mask views**: not planned yet
