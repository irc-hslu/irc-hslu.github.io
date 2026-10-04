# Move an anchor in your view (https://irc-hslu.github.io/orbbecstreamer/docs/client/world-anchors)





Each server’s placement is relative to a named anchor, for example a marker or a corner of the room. The **World anchors** section decides where each anchor sits in your 3D view. These anchor positions stay in this browser tab: the client never sends them to a server, and they never change a server’s placement.

To change where a server sits for everyone, see [Place a server in the scene](/docs/client/placement-editing) instead.

## Move an anchor [#move-an-anchor]

1. Connect a server. **World anchors**, below the server cards, lists every anchor a connected server names. No lock needed.
2. Find the anchor by name, for example **anchor-dev**. The line under it lists its servers and reads `at origin`, or `custom pose` once you moved it.
3. Type in **x (m)**, **y (m)**, **z (m)**, **yaw (°)**, **pitch (°)** or **roll (°)**. A valid value applies at once, and the anchor’s servers move with it in your 3D view. The fields work like the [placement fields](/docs/client/placement-editing#edit-the-draft-with-numbers).
4. To put the anchor back at the origin, select **Reset**.

<img alt="World anchors with one anchor, anchor-dev, used by the Dev mock server at origin: the Anchor pose (this browser only) fields, all zero, and Reset" src="__img0" />

Other people’s views don’t change. The section is hidden while the setup view is open.

## Fix anchor problems [#fix-anchor-problems]

* **`No connected server names an anchor yet.`**: no server is connected, or the connected servers have no placement yet. Connect a server and wait until its card shows **Ready** or **Streaming**.
* **`Not applied (not a rigid transform): …`**: the client refused a pose that would stretch or mirror the scene, and nothing changed. The fields can’t produce such a pose, so this is a bug. Report it with the values you typed.
* **The anchors are back at the origin after a reload**: anchor positions aren’t saved. Set them again after each reload.
* **A server moved for you but not for anyone else**: this is how anchors work. To move a server for everyone, [place it in the scene](/docs/client/placement-editing).
