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

The server's setup-state machine accepts a placement commit and tracks its
revision, but reaching it needs the network layer that carries client
commands to the server, which does not exist yet (see
[Setup state](/docs/server/how-it-works/setup-state#what-works-today)). Even once that
exists, a placement is kept in memory only and is not saved to disk, so it
resets on every server restart.

Until then, the flow above works only against the client's own built-in
mock server: see [Mock server](/docs/client/developer/mock-server) and
[Placement check](/docs/client/developer/placement-check). A real
`orbbec_streamer` server has no way to receive a commit yet.
