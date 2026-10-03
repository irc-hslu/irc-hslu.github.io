# Place a server in the scene (https://irc-hslu.github.io/orbbecstreamer/docs/client/placement-editing)







A server’s **placement** is its position in metres and rotation relative to its anchor, a named reference point such as a marker or a corner of the room. Every client draws the server’s point cloud there.

You change a placement in two stages:

1. **Draft**: you change the placement in your browser. Your 3D view shows the change at once, but nothing is sent.
2. **Commit**: **Commit placement** sends the draft to the server. The server’s placement then gets a new revision, and every client draws the server there.

The client never commits a draft by itself. Leaving setup, losing the lock or reconnecting never sends it.

## Start a draft [#start-a-draft]

1. On the server’s card, select **Set up**. See [Set up a server](/docs/client/setup-workspace).
2. Scroll down to the **Placement** section, below the calibration sections. It shows the server’s placement now:
   * **server placement**: the anchor and the revision, for example `anchor anchor-origin, revision 1`
   * **translation**: for example `x 0.000 · y 0.000 · z 0.000 m`
   * **rotation**: for example `yaw 0.0 · pitch 0.0 · roll 0.0°`
3. Select **Edit placement**. The client makes a draft equal to the server’s placement. The line `draft based on revision 1 · anchor anchor-origin` names the revision your draft starts from.

## Edit the draft with numbers [#edit-the-draft-with-numbers]

The six fields hold the draft:

| Field                           | Unit    | Meaning                                                                              |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| **x (m)**, **y (m)**, **z (m)** | metres  | Position of the server relative to the anchor. +X is right, +Y is up, +Z is forward. |
| **yaw (°)**                     | degrees | Turn about the vertical axis. A positive yaw turns +Z towards +X.                    |
| **pitch (°)**                   | degrees | Tilt about the +X axis.                                                              |
| **roll (°)**                    | degrees | Turn about the +Z axis.                                                              |

The client applies roll first, then pitch, then yaw.

1. Type a number. It applies as soon as it’s valid, and your 3D view follows. You can use a comma as the decimal mark.
2. To nudge a value, press **Arrow Up** or **Arrow Down**: each press steps by 0.01 m or 1°, and ten times that with **Shift**. The **−** and **+** buttons next to each field do the same.
3. Press **Enter** to apply the field, or **Escape** to show the last applied value again.

An invalid entry isn’t applied. Its reason appears under the field when you leave it or press **Enter**, for example `x: "abc" is not a number (not applied)`. Positions can’t exceed ±1000 m, and angles can’t exceed ±360°.

When you leave a field, the fields show the draft rounded to 1 mm and 0.1°, with pitch between −90° and 90° and yaw and roll between −180° and 180°. So yaw 200 shows as −160. The rotation itself doesn’t change.

## Edit the draft in 3D [#edit-the-draft-in-3d]

1. Tick **Move in 3D (drag the handle on the server’s cloud)**. A handle appears at the server’s position in the 3D view.
2. Under **handle**, choose **translate** to show arrows that move along an axis, or **rotate** to show rings that turn about an axis.
3. Drag an arrow or a ring. The draft and the fields follow the drag.

Typing in the fields moves the handle too. The handle can’t scale the cloud. To remove it, untick **Move in 3D**. It also disappears when you discard the draft or commit it.

## What you should see [#what-you-should-see]

While you edit, the section shows `changed locally, not committed (the 3D view shows the draft)`, and only your 3D view moves the server’s cloud. Other clients and the server still have the old revision.

<img alt="The client with a placement draft open: in the 3D view, the translate handle with red, green and blue arrows at the server’s draft position; in the side panel, the Placement section with the server placement at revision 1, the draft changed locally to x 0.500, z 1.000 and yaw 30.0, Move in 3D ticked with translate selected, and the Commit placement (expected revision 1) and Discard draft buttons. No point cloud is drawn because the capture browser couldn’t decode HEVC" src="__img0" />

<img alt="Close-up of the Placement section with the draft: the server placement, the draft line based on revision 1, the changed locally note, the six draft fields, the Move in 3D checkbox, the handle choice, and the Commit placement and Discard draft buttons" src="__img1" />

## Commit or discard the draft [#commit-or-discard-the-draft]

* **Commit placement (expected revision 1)** sends the draft. The number is the revision your draft started from. A server should accept the commit only while its placement is still at that revision, as the mock server does. You need the setup lock, which the setup view holds.
* **Discard draft** throws the draft away. Your 3D view shows the server’s placement again. Nothing is sent.
* **Rebase on server placement (revision 2)** appears when someone else committed a placement after you started your draft. It keeps your draft’s position and rotation, and makes the newer revision its starting point, so you can commit.

While a commit is on its way, the fields are read-only and the button shows `in progress`. The result appears under the section, and screen readers announce it:

| Result                                                                                                                                                                           | Meaning                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Commit placement: sent with expected revision 1; waiting for the server…`                                                                                                       | Sent, no answer yet.                                                                                                                           |
| `Commit placement: accepted (expected revision 1); waiting for the new server placement.`                                                                                        | The server accepted it; the new placement is on its way.                                                                                       |
| `Commit placement: accepted; the server placement is now revision 2.`                                                                                                            | Done. The draft is cleared, and every client draws the new placement.                                                                          |
| `Commit placement rejected (<code>): <message>. …`                                                                                                                               | The server refused it. Your draft is kept.                                                                                                     |
| `Commit placement failed (<reason>): <message>. The draft is kept.`                                                                                                              | The server didn’t answer, for example `timeout`, or the connection was lost.                                                                   |
| `Commit placement failed (not-applied): The server accepted the commit, but after reconnecting its placement is still at revision 1; commit again if needed. The draft is kept.` | The connection dropped after the server accepted, and the new connection shows the old placement. The client never resends a commit by itself. |

After a commit, the cloud may freeze or disappear for a moment. The server restarts its video for the new placement, and the client never draws a frame with another revision’s placement.

### Keyboard focus [#keyboard-focus]

When the button you selected disappears, keyboard focus moves to the next control that makes sense, so you don’t lose your place:

| You select                                      | Focus moves to                   |
| ----------------------------------------------- | -------------------------------- |
| **Edit placement**                              | The first draft field, **x (m)** |
| **Discard draft**                               | **Edit placement**               |
| **Commit placement**, once the draft is cleared | **Edit placement**               |
| **Rebase on server placement**                  | **Commit placement**             |

If that control isn’t there, focus moves to the **Placement** heading. When you move focus elsewhere yourself, it stays where you put it.

## Where your draft is kept [#where-your-draft-is-kept]

The draft belongs to this browser tab and this server, and it’s held in memory only:

* **Kept**: when you leave setup, when you’re forced out, and when the connection drops and comes back to the same server. It comes back the next time you select **Set up**.
* **Lost**: when you select **Discard draft**, when you commit it, when you select **Remove** on the card, and when you reload or close the tab.

Your 3D view shows the draft only while the setup view for that server is open. Outside it, every server is drawn at its committed placement.

## Fix placement problems [#fix-placement-problems]

| What you see                                                                                                                                                                                                 | Why                                                                                                                          | What to do                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `stale: the server placement changed to revision M since this draft was based on revision N. …`, and **Commit placement** says `the server placement changed (revision N -> M); discard or rebase the draft` | Someone committed a placement after you started your draft.                                                                  | Select **Rebase on server placement** to keep your pose on the new revision, then commit. Or select **Discard draft** and start again. |
| `Commit placement rejected (…): …` about the revision                                                                                                                                                        | The server’s placement changed after the client’s last check and before your commit arrived.                                 | Rebase, then commit again.                                                                                                             |
| **Commit placement** says `committing a placement needs the setup lock`                                                                                                                                      | You don’t hold the lock: you were forced out, or the lock ran out.                                                           | Select **Enter setup again**. Your draft is still there.                                                                               |
| **Commit placement** says `waiting for the server state to refresh`                                                                                                                                          | The client is fetching a fresh copy of the server’s state.                                                                   | Wait a moment.                                                                                                                         |
| **Commit placement** says `the draft equals the server placement`                                                                                                                                            | There is nothing to commit.                                                                                                  | Change a field, or select **Discard draft**.                                                                                           |
| **Edit placement** says `no server placement known yet`                                                                                                                                                      | The client hasn’t received the server’s state yet.                                                                           | Wait until the card shows a live status.                                                                                               |
| **Edit placement** says `the server placement is not rigid`                                                                                                                                                  | The server’s placement stretches or skews the cloud.                                                                         | Fix the placement on the server side.                                                                                                  |
| `Not applied: The pose must be rigid: scale, shear, mirroring and perspective are not allowed.`                                                                                                              | The client refused a pose that would stretch or mirror the cloud. The fields and handle can’t produce one, so this is a bug. | Report it with the values you entered.                                                                                                 |
| `Move in 3D is not available: no rendering backend`                                                                                                                                                          | The browser can’t draw 3D.                                                                                                   | Edit with the fields. See [Check your browser](/docs/client/browser-requirements).                                                     |
| `Move in 3D is not available: the server is not drawn in this session`                                                                                                                                       | The server’s cloud isn’t in the 3D view yet, or the card shows a conflict.                                                   | Wait until the card is live, then tick **Move in 3D** again.                                                                           |
| **Move in 3D** shows `a placement commit is in progress`                                                                                                                                                     | The draft can’t change until the commit is settled.                                                                          | Wait for the result.                                                                                                                   |
| `Commit placement failed (not-applied): …` after a reconnect                                                                                                                                                 | The server accepted the commit, but its placement didn’t change.                                                             | Check the draft, then select **Commit placement** again.                                                                               |
| The draft is gone after a reload                                                                                                                                                                             | Drafts are held in memory only.                                                                                              | Start again with **Edit placement**. Commit drafts you want to keep.                                                                   |
| `The connection now reaches server <new>, not <old>: …`                                                                                                                                                      | After a reconnect, the card reaches a different server, so the client dropped the old draft. Nothing was sent.               | Check the card’s address, and start a new draft if needed.                                                                             |
| Yaw, pitch or roll show other numbers than you typed                                                                                                                                                         | The fields show the same rotation in standard ranges once you leave them.                                                    | Nothing to do: the placement is unchanged. At pitch ±90°, the client shows the whole turn as yaw and roll as 0.                        |
| You can’t commit a recording’s placement                                                                                                                                                                     | Recordings refuse the setup lock.                                                                                            | Edit `placement` in the recording’s manifest. See [Play a recording](/docs/client/playback).                                           |
