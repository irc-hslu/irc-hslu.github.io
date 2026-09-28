# Placement editing (https://irc-hslu.github.io/orbbecstreamer/docs/client/placement-editing)



## What it is [#what-it-is]

A server's **placement** says where the server sits relative to a named
anchor (for example a marker or a corner of the room): a translation in
metres and a rotation. Every client draws that server's point cloud with
it, so a committed placement is shared by all clients.

The **Placement** section of the [setup workspace](/docs/client/setup-workspace)
edits it in two stages:

1. **A local draft.** You change the placement in this browser. Your 3D
   view shows the draft at once, but nothing is sent to the server.
2. **Commit.** **Commit placement** sends the draft to the server. Only
   then does it become the server's placement, with a new revision number.

The client never commits a draft by itself. Leaving setup, losing the
lock or reconnecting never sends it.

Placements must be rigid: a translation plus a rotation. Scaling,
shearing and mirroring are not possible.

Where each **anchor** sits in your 3D scene is a separate, client-local
setting; see [World anchors](/docs/client/viewer#where-each-server-appears-world-anchors).

## How to use it [#how-to-use-it]

### Open the Placement section [#open-the-placement-section]

1. On the server's card, select **Set up**. The setup workspace opens and
   takes the server's setup lock. See [Setup workspace](/docs/client/setup-workspace).
2. Scroll to the **Placement** section, below the calibration sections.

It shows the server's current placement:

* **server placement:** the anchor and the revision, for example
  `anchor anchor-dev, revision 3`;
* **translation:** for example `x 0.500 · y 0.000 · z 1.000 m`;
* **rotation:** for example `yaw 30.0 · pitch 0.0 · roll 0.0°`.

### Start a draft [#start-a-draft]

Select **Edit placement**. The client makes a draft equal to the server's
placement and shows:

* `draft based on revision 3 · anchor anchor-dev`: the revision the draft
  starts from. The commit sends it as the expected revision.
* `same as the server placement` until you change something, then
  `changed locally, not committed (the 3D view shows the draft)`.
* Six fields, **Move in 3D**, and the draft actions.
* A note: the draft is local to this browser tab and held in memory only,
  and only **Commit placement** sends it.

### Edit with numbers [#edit-with-numbers]

The fields hold the draft pose:

| Field                           | Unit    | Meaning                                                                              |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| **x (m)**, **y (m)**, **z (m)** | metres  | Position of the server's origin relative to the anchor. +X right, +Y up, +Z forward. |
| **yaw (°)**                     | degrees | Turn about the vertical (+Y) axis.                                                   |
| **pitch (°)**                   | degrees | Tilt about the +X axis.                                                              |
| **roll (°)**                    | degrees | Turn about the +Z axis.                                                              |

The rotation is applied as roll first, then pitch, then yaw
(`R = Ry(yaw) · Rx(pitch) · Rz(roll)`). A positive yaw turns +Z towards
+X.

* Type a number. It applies as soon as it is valid, and your 3D view
  follows. A comma works as the decimal mark.
* **Arrow Up** and **Arrow Down** step by 0.01 m or 1°; hold **Shift**
  for ten times that. The **−** and **+** buttons next to each field do
  the same with the mouse.
* **Enter** applies the field. **Escape** shows the last applied values
  again.
* An invalid entry is not applied. Its reason appears under the field
  when you leave it or press **Enter**, for example
  `x: "abc" is not a number (not applied)`. The limits are ±1000 m and
  ±360°.

While a field has focus, the fields keep exactly what you typed. When you
leave the field or press **Enter**, they show the applied pose rounded to
1 mm and 0.1° and in standard ranges:

* **pitch** from -90° to 90°, **yaw** and **roll** from -180° to 180°;
* so yaw 200 is shown as -160, and pitch 100 with yaw 10 is shown as
  pitch 80, yaw -170, roll 180. Both are the same rotation you typed;
  nothing moves.
* At pitch exactly ±90°, yaw and roll turn about the same axis. The
  client then shows roll 0 and puts the whole turn in yaw.

A change from elsewhere (the 3D handle, a rebase, the server's placement)
replaces the fields at once, in the same standard form.

### Edit in 3D [#edit-in-3d]

1. Tick **Move in 3D (drag the handle on the server's cloud)**. A handle
   appears at the server's origin in the 3D view.
2. Under **handle**, choose **translate** (arrows: move along an axis) or
   **rotate** (rings: turn about an axis).
3. Drag an arrow or a ring. The draft and the fields follow the drag, and
   the section shows `changed locally, not committed (the 3D view shows the draft)`.
   Nothing is sent until you select **Commit placement**.

Typing in the fields moves the handle too. The handle only translates and
rotates; it has no scale control. Untick **Move in 3D** to remove it. It
is also removed when you discard the draft or select **Commit placement**,
and the checkbox shows `a placement commit is in progress` until the
commit is settled.

Verified on 2026-09-28 in headless Chromium 153 with software rendering
(SwiftShader), on both WebGL2 and WebGPU: dragging a translate arrow moved
x (to 0.104 m), and dragging a rotate ring turned yaw (to about -45°),
with nothing sent. It has not been tried on real GPU hardware yet.

### Commit, discard or rebase [#commit-discard-or-rebase]

* **Commit placement (expected revision N)** sends the draft to the server
  with `N`, the revision the draft started from. The protocol names this
  expected revision but does not define exactly what a server does with
  it; the expected behaviour, and what the mock server does, is to accept
  the commit only while its placement is still at revision `N`. You need
  the setup lock, which the setup workspace holds.
* **Discard draft** drops the draft. Your 3D view shows the server's
  placement again. Nothing is sent.
* **Rebase on server placement (revision M)** appears when the draft is
  stale (see [Troubleshooting](#troubleshooting)). It keeps your pose and
  makes revision `M` the base, so you can commit.

While a commit is on its way, the fields are read-only and the button
shows `in progress`.

Results appear under the section:

| Result                                                                                    | Meaning                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Commit placement: sent with expected revision 3; waiting for the server…`                | Sent, no answer yet.                                                           |
| `Commit placement: accepted (expected revision 3); waiting for the new server placement.` | The server accepted it; the new placement is on its way.                       |
| `Commit placement: accepted; the server placement is now revision 4.`                     | Done. The draft is cleared, and every client draws the new placement.          |
| `Commit placement rejected (<code>): <message>. …`                                        | The server refused it. The draft is kept.                                      |
| `Commit placement failed (<reason>): <message>. The draft is kept.`                       | No answer from the server (for example `timeout`), or the connection was lost. |

When a commit is not possible, the button is unavailable and says why
under it (for example `committing a placement needs the setup lock`), so
nothing is sent.

### Leaving setup keeps the draft [#leaving-setup-keeps-the-draft]

The draft belongs to this browser tab, to this server's card and to the
server it was made for. It is held in memory only. It is kept:

* when you leave setup: it comes back the next time you select **Set up**;
* when you are forced out of setup, or the connection drops and
  reconnects to the same server.

It is lost when you select **Discard draft**, when a commit of it is
applied, when you select **Remove** on the server's card, and when you
**reload or close the tab**. If the card's connection reaches a different
server after a reconnect, the draft is dropped with the notice
`The connection now reaches server <new>, not <old>: the placement draft for <old> was dropped… Nothing was sent.`
A draft is never sent without **Commit placement**.

Your 3D view shows the draft only while the setup workspace for that
server is open. Outside it, every server is drawn at its committed
placement.

## Expected result [#expected-result]

* While you edit, only your 3D view moves the server's cloud. Other
  clients and the server still have revision `N`.
* After **Commit placement**, the section shows
  `Commit placement: accepted; the server placement is now revision N+1.`,
  the server placement line shows the new revision, and every connected
  client draws the cloud at the new placement.
* The cloud may freeze or disappear for a moment after a commit: the
  server restarts its streams for the new placement, and the client never
  draws a frame with the placement of another revision.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                                                                                                                                                     | Cause                                                                                                                                                                                              | What to do                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stale: the server placement changed to revision M since this draft was based on revision N. …`, and **Commit placement** is unavailable with `the server placement changed (revision N -> M); discard or rebase the draft` | Another operator committed a placement after you started your draft.                                                                                                                               | Select **Rebase on server placement (revision M)** to keep your pose on top of the new revision, then commit. Or select **Discard draft** and start again from the new placement. |
| `Commit placement rejected (stale-revision): expectedRevision N is not the current placement revision M. …`                                                                                                                 | The server's placement moved before your commit arrived (a rare race: normally the client blocks a stale commit first). `stale-revision` is the mock server's code; a real server may use another. | Rebase, then commit again.                                                                                                                                                        |
| **Commit placement** says `committing a placement needs the setup lock`                                                                                                                                                     | This client does not hold the lock: you were forced out of setup, or the lock expired.                                                                                                             | Select **Enter setup again**. The draft is still there.                                                                                                                           |
| **Commit placement** says `waiting for the server state to refresh`                                                                                                                                                         | The client is fetching a fresh copy of the server's state.                                                                                                                                         | Wait a moment.                                                                                                                                                                    |
| **Commit placement** says `the draft equals the server placement`                                                                                                                                                           | There is nothing to commit.                                                                                                                                                                        | Change a field, or select **Discard draft**.                                                                                                                                      |
| `Not applied: anchorFromServer must be rigid (§9): …`                                                                                                                                                                       | A pose with scale, shear or mirroring was refused. The fields and the handle cannot produce one, so this is a bug.                                                                                 | Report it with the values you entered.                                                                                                                                            |
| **Edit placement** says `no server placement known yet`                                                                                                                                                                     | The client has not received the server's state yet.                                                                                                                                                | Wait until the card shows a live status.                                                                                                                                          |
| **Edit placement** says `the server placement is not rigid`                                                                                                                                                                 | The server sent a placement with scale or shear.                                                                                                                                                   | Fix the placement on the server side.                                                                                                                                             |
| `Move in 3D is not available: no rendering backend (§16): nothing is drawn`                                                                                                                                                 | The browser has no WebGPU or WebGL2, so there is no 3D view.                                                                                                                                       | Edit with the fields; see [Browser requirements](/docs/client/browser-requirements).                                                                                              |
| `Move in 3D is not available: the server is not drawn in this session`                                                                                                                                                      | The server's cloud is not in the 3D view right now (the session is still starting, or the card shows a conflict).                                                                                  | Wait until the card is live, then tick **Move in 3D** again.                                                                                                                      |
| **Move in 3D** shows `a placement commit is in progress`                                                                                                                                                                    | A commit is on its way; the draft cannot change until it is settled.                                                                                                                               | Wait for the result.                                                                                                                                                              |
| The draft is gone after a reload                                                                                                                                                                                            | Drafts are held in memory only.                                                                                                                                                                    | Start again with **Edit placement**. Commit drafts you want to keep.                                                                                                              |
| `The connection now reaches server <new>, not <old>: …`                                                                                                                                                                     | After a reconnect, the card reaches a different server, so the old draft no longer applies. Nothing was sent.                                                                                      | Check the card's address; start a new draft if needed.                                                                                                                            |
| After leaving a field, yaw, pitch or roll show other numbers than you typed (yaw 200 shows -160; pitch 100 shows 80 with yaw and roll changed by 180)                                                                       | The fields show the same rotation in standard ranges once you leave them.                                                                                                                          | Expected; the placement is unchanged.                                                                                                                                             |
| At pitch ±90°, roll jumps to 0 and yaw changes                                                                                                                                                                              | At ±90° pitch, yaw and roll turn about the same axis, so the client reports the whole turn as yaw.                                                                                                 | Expected. The placement itself is unchanged.                                                                                                                                      |
| A recording's placement cannot be committed                                                                                                                                                                                 | Recordings refuse the setup lock (`unsupported-by-file-source`).                                                                                                                                   | Edit the placement in the recording's manifest instead; see [Play back .hevc recordings](/docs/client/playback).                                                                  |
