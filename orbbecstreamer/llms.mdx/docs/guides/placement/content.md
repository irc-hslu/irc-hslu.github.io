# Placement (https://irc-hslu.github.io/orbbecstreamer/docs/guides/placement)



A server's **placement** is a rigid transform (a translation plus a
rotation) that says where its point cloud sits relative to a named anchor.
Once committed, every client draws that server's cloud there.

## The flow [#the-flow]

1. **Take the setup lock.** Open the server's [setup workspace](/docs/client/setup-workspace)
   with **Set up** on its card.
2. **Edit.** In the workspace's Placement section, change the pose with
   numeric fields or by dragging a 3D handle on the cloud. This only changes
   a local draft in your browser; nothing is sent yet. See
   [Place a server in the scene](/docs/client/placement-editing).
3. **Commit.** Select **Commit placement**. Once the server accepts it, the
   placement's revision goes up by one and every connected client redraws
   the cloud at the new pose. See
   [Commit or discard the draft](/docs/client/placement-editing#commit-or-discard-the-draft).

This is separate from a **world anchor**, which is where an anchor sits in
*your own* browser's scene: local to you, never sent anywhere. See
[Move an anchor in your view](/docs/client/world-anchors).

## What the server does with a commit today [#what-the-server-does-with-a-commit-today]

A real server accepts a placement commit over a browser session from the
client that holds the setup lock, as long as the placement is still at the
revision the draft started from. It saves the new placement to
`calibration.placement_path` before any client sees it, and restores it at
the next start (see the [`calibration` keys](/docs/server/configuration#calibration)).
With `placement_path: ""`, the placement is kept in memory only and resets
at every restart.

The server sends no video to browsers yet, so you edit the placement
without seeing your own camera's point cloud (see
[Serve to browsers](/docs/server/serving#status)). To try the editor without
a server, use the client's built-in mock server: see
[Mock server](/docs/client/developer/mock-server) and
[Placement check](/docs/client/developer/placement-check).
