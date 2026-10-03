# Move an anchor in your view (https://irc-hslu.github.io/orbbecstreamer/docs/client/world-anchors)





Each server’s placement is relative to a named anchor, for example a marker or a corner of the room. The **World anchors** section decides where each anchor sits in your 3D view. These anchor positions stay in this browser tab: the client never sends them to a server, and they never change a server’s placement.

To change where a server sits for everyone, see [Place a server in the scene](/docs/client/placement-editing) instead.

## Move an anchor [#move-an-anchor]

1. Connect at least one server. The **World anchors** section, below the server cards, lists every anchor that a connected server’s placement names. You don’t need the setup lock.
2. Find the anchor by its name, for example `Anchor anchor-origin`. The **used by** line lists the servers placed relative to it.
3. Type in the fields:

   * **x (m)**, **y (m)** and **z (m)** move the anchor, in metres. +X is right, +Y is up and +Z is forward.
   * **yaw (°)**, **pitch (°)** and **roll (°)** turn it, in degrees.

   A valid value applies at once, and every server that uses the anchor moves with it in your 3D view. **Arrow Up** and **Arrow Down** step by 0.01 m or 1°; hold **Shift** for ten times that. The **−** and **+** buttons do the same with the mouse.
4. To put the anchor back at the scene origin, select **Reset to identity**.

The fields work like the placement fields. See [Edit with numbers](/docs/client/placement-editing#edit-the-draft-with-numbers).

## What you should see [#what-you-should-see]

<img alt="The World anchors section with one anchor, anchor-origin, used by the Dev mock server: no pose set, at the scene origin, the Anchor pose (this browser only) fields for x, y, z, yaw, pitch and roll, all at zero, and the Reset to identity button" src="__img0" />

Before you change anything, the anchor reads `no pose set: at the scene origin`. After a change, it reads `pose set in this browser:` followed by the pose. The servers that use the anchor then move in your 3D view only. Other people’s views don’t change.

The section is hidden while the setup view is open.

## Fix anchor problems [#fix-anchor-problems]

These are the common anchor problems and their fixes:

* **`No connected server names an anchor yet.`**: no server is connected, or the connected servers have no placement yet. Connect a server and wait until its card shows a live status.
* **`Not applied (not a rigid transform): …`**: the client refused a pose that would stretch or mirror the scene, and nothing changed. The fields can’t produce such a pose, so this is a bug. Report it with the values you typed.
* **The anchors are back at the origin after a reload**: anchor positions aren’t saved. Set them again after each reload.
* **A server moved for you but not for anyone else**: this is how anchors work. To move a server for everyone, [place it in the scene](/docs/client/placement-editing).
