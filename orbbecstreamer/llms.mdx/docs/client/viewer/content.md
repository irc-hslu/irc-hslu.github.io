# The 3D viewer (https://irc-hslu.github.io/orbbecstreamer/docs/client/viewer)





## What it is [#what-it-is]

The large area to the left of the client's side panel is the 3D viewer. It
draws one live, coloured point cloud per camera bundle, for every connected
server and every open recording, all in one shared scene. The client
rebuilds each point on the GPU from the depth stream, using the server's
camera calibration and placement, and colours it from the colour stream.

What you see:

* **One point per depth pixel.** Each point takes the colour of the same
  pixel in the colour stream (the server aligns colour to depth before
  sending).
* **Only valid depth is drawn.** The server marks every depth pixel with a
  code. The viewer hides:

  * pixels marked invalid (outside the foreground mask, or no reading);
  * pixels marked closer than the server's minimum depth;
  * pixels marked farther than the server's maximum depth.

  A hidden pixel leaves a gap; it is never drawn as a wall at the near or
  far limit.
* **Every server in one scene.** Each server's cloud is placed with that
  server's placement (where the server sits relative to its anchor). Two
  servers never mix, even if they use the same bundle names.
* **Point size.** Points are 2 pixels wide on WebGL2 and 1 pixel wide on
  WebGPU. WebGPU has no adjustable point size yet.

<img alt="The 3D view with two point clouds side by side, each a checkerboard wall with an orange sphere in front. This is synthetic test data from the wiring check page, drawn by the real renderer, because the capture browser could not decode HEVC" src="__img0" />

## How to use it [#how-to-use-it]

1. Open the client in a desktop browser.
2. In the side panel, connect to a server under **Add server**, or play a
   recording under **Open recording**. The viewer shows the clouds as soon
   as frames arrive; there is nothing to switch on.
3. Move around with the camera controls below. Click the viewer once first
   so that it has keyboard focus.

### Camera controls [#camera-controls]

The viewer uses an orbit camera. It turns around a target point that
starts 2 m in front of the scene origin. At start the camera sits 3 m from
the target, slightly above it, looking forward along +Z.

| Action                  | Mouse                                           | Touch                 | Keyboard              |
| ----------------------- | ----------------------------------------------- | --------------------- | --------------------- |
| Orbit around the target | Drag with the left button                       | Drag with one finger  | Arrow keys            |
| Pan (move the target)   | Drag with the right button, or Ctrl + left-drag | Drag with two fingers | Ctrl + arrow keys     |
| Zoom in and out         | Mouse wheel                                     | Pinch                 | Alt + Up / Alt + Down |

Mouse-wheel zoom moves roughly 2% of the current distance per wheel step (the exact amount depends on the browser's wheel delta), so it is
fine up close and fast far away. Points closer than 1 cm or farther than
100 m from the camera are not drawn. There is no "reset view" control; to
get back to the start view, navigate back manually.

### Which graphics backend is in use [#which-graphics-backend-is-in-use]

The client uses WebGPU when the browser offers it. Otherwise it falls back
to WebGL2. The `renderer:` line at the top of the side panel, under the
protocol version, tells you which one is active:

| Panel shows                                                   | Meaning                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `renderer: webgpu`                                            | WebGPU is in use.                                                                         |
| `renderer: webgl2`                                            | WebGL2 is in use (WebGPU is missing or failed to start).                                  |
| `renderer: rendering-incompatible. Rendering incompatible: …` | Neither backend is available. No point clouds are drawn, and the viewer area stays empty. |

The collapsible **renderer notes (N)** line, when present, tells you why the client chose that
backend. Examples are `WebGPU not supported`, or
`WebGPU initialisation failed: …` followed by `fresh canvas for the WebGL2
fallback`.

A browser without a rendering backend can still connect to a server for
control and setup.

### Where each server appears: world anchors [#where-each-server-appears-world-anchors]

A server's placement says where the server sits relative to a named anchor
(for example, a marker or a corner of the room). The client then decides
where that anchor sits in its shared scene. That anchor pose is
**client-local**: it is stored only in this browser tab, it is never sent
to a server, and it never changes a server's placement. To change a
server's placement itself, see [Placement editing](/docs/client/placement-editing).

The side panel's **World anchors** section, below the server cards, lists
every anchor that a connected server's placement names. It needs no setup
lock. For each anchor it shows:

* **used by:** the servers whose placement names it;
* whether a pose was set in this browser, or `no pose set: at the scene
  origin`, and the pose, for example `at the scene origin (identity)`;
* six fields: **x (m)**, **y (m)**, **z (m)**, **yaw (°)**, **pitch (°)**
  and **roll (°)**;
* **Reset to identity**, which puts the anchor back at the scene origin.

To move an anchor:

1. Type in its fields. A valid value applies at once, and every server
   that uses the anchor moves with it in your 3D view. **Arrow Up** and
   **Arrow Down** step by 0.01 m or 1° (**Shift**: ten times that).
2. To undo, select **Reset to identity**.

The fields work as in [Placement editing](/docs/client/placement-editing#edit-with-numbers),
with the same rotation order. Only rigid poses are accepted; a refused pose
shows `Not applied (not a rigid transform): …` and changes nothing.

Anchor poses are not saved: reloading the page puts every anchor back at
the scene origin.

### Not available yet [#not-available-yet]

**Coming soon**, tracked in `client/docs/development/ROADMAP.md` (Phase 2):

* **Point-size and splat settings**, and larger points on WebGPU.
* **Blending of overlapping cameras.** Where two cameras see the same
  surface, both sets of points are drawn.
* **WebXR (headset) viewing.**

**Not available, and not on the roadmap yet:**

* **View toggles.** There are no switches for colour only, depth only or
  the foreground mask. The viewer always shows coloured points.
* **Hidden-pixel debug view.** The renderer can show pixels closer or
  farther than the depth range in blue and red. The client has no switch
  for it.

## Expected result [#expected-result]

* The side panel shows `renderer: webgpu` or `renderer: webgl2`.
* For each connected server or open recording, the server card's layout
  shows `ready, drawing` for each bundle, and the **uploaded** counter goes
  up.
* The viewer shows a coloured point cloud on a dark background. Gaps appear
  where the depth was invalid or out of range.
* Dragging, the wheel and the arrow keys move the view smoothly.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                               | Likely cause                                                                                                                                          | What to do                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel shows `renderer: rendering-incompatible`                                                                        | The browser has neither WebGPU nor WebGL2, or hardware acceleration is off.                                                                           | Enable hardware acceleration in the browser settings, or try another browser with WebGPU or WebGL2. No browser has been verified end to end yet.                                                     |
| Server card shows `Setup and control only: this browser lacks HEVC colour decoding` or `… HEVC Main10 depth decoding` | The browser cannot decode the streams, so there are no frames to draw.                                                                                | Use a browser and GPU with HEVC (Main and Main10) decoding. No browser has been verified for this yet.                                                                                               |
| Panel shows `decoders: WebCodecs VideoDecoder is unavailable: …`                                                      | The browser has no WebCodecs video decoding.                                                                                                          | Use a browser with WebCodecs video decoding.                                                                                                                                                         |
| A bundle row stays `ready, no frame yet`, and **decoded pairs** stays at 0                                            | No colour and depth frames are reaching the client yet.                                                                                               | Check that the server is streaming. The card's status and **last close** line say whether the connection is up.                                                                                      |
| **decoded pairs** goes up, but **uploaded** does not and **dropped** does                                             | Frames are arriving but are not drawn, for example because they belong to a newer server setup than the one the client holds.                         | After a change on the server (calibration, depth range, placement), the client fetches the new setup and resumes on its own. If it does not, select **Remove** on the card and add the server again. |
| The cloud freezes, or disappears for a moment, right after a calibration or placement change on the server            | The client never draws a frame with the setup of a different revision. It waits for the new setup.                                                    | Wait a moment; drawing resumes once the new setup has arrived.                                                                                                                                       |
| A bundle row shows `upload error: …`                                                                                  | The GPU rejected a frame. The bundle stays hidden until the next good frame.                                                                          | Usually clears by itself. If it keeps happening, reload the page.                                                                                                                                    |
| A bundle row shows `rendering incompatible (too-many-tiles): …`                                                       | The bundle packs more than 16 cameras into one stream, which the viewer cannot draw.                                                                  | Use a server stream layout with 16 cameras or fewer per bundle (for example, one bundle per camera).                                                                                                 |
| A bundle row shows `metadata invalid (…)`                                                                             | The server's setup for this bundle is not consistent.                                                                                                 | The client keeps showing the last good frame. Check the server's calibration and placement.                                                                                                          |
| A card shows `conflict: server … is already rendered by …`                                                            | The same server was added twice. Only one card per server is drawn.                                                                                   | Remove the duplicate card.                                                                                                                                                                           |
| The cloud looks mirrored (left and right, or up and down, swapped)                                                    | The coordinate convention between server and client is still being settled in change request 0011. The client assumes one reading of it.              | Known limitation until change request 0011 is decided. Report it with the server's calibration so the teams can check the convention.                                                                |
| Two servers' clouds overlap                                                                                           | Their placements put them in the same place, or they use different anchors that both sit at the scene origin in this browser.                         | Move one server with [Placement editing](/docs/client/placement-editing), or move its anchor under **World anchors** (this browser only).                                                            |
| A server's cloud moved in my view but not for other operators                                                         | You moved its anchor under **World anchors**, or you have an uncommitted placement draft open in the setup workspace. Both are local to this browser. | Commit the placement if it is right (see [Placement editing](/docs/client/placement-editing)); otherwise **Reset to identity** or **Discard draft**.                                                 |
| The picture tears on WebGL2 (parts of two frames at once)                                                             | WebGL2 uses a low-latency canvas where the browser allows it. This can tear.                                                                          | Expected; it trades tearing for lower latency.                                                                                                                                                       |
| The view is slow or jerky                                                                                             | Many points: roughly one per depth pixel per camera.                                                                                                  | Close other GPU-heavy tabs, and connect only the servers you need: each adds its full point count.                                                                                                   |
