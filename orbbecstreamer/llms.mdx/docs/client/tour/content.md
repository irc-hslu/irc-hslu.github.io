# Tour of the client (https://irc-hslu.github.io/orbbecstreamer/docs/client/tour)











The client is one browser page: a 3D view that fills the window and a side panel on the right. Read this page first.

## Open the client [#open-the-client]

1. In the repository’s `client` folder, run `npm ci` once, then `npm run dev`. See [Run the client](/docs/client/dev-build).
2. Open [http://localhost:5173/](http://localhost:5173/). The 3D view reads `No servers yet · Connect a server or open a recording`.

## Find your way around the main screen [#find-your-way-around-the-main-screen]

<img alt="The client with the mock server added. Callouts: 1 the 3D view, showing the render check’s synthetic test scene composited in for this picture and labelled as such; 2 the panel toggle; 3 the header with the WebGPU and WebCodecs chips and the theme button; 4 the View section; 5 the Connect field, Open recording and Add mock server; 6 the server card; 7 World anchors" src="__img0" />

The point cloud in this picture is the client’s synthetic test scene from the render check, pasted into the 3D view. It isn’t a live capture: no browser tested so far decodes the servers’ video, so the real 3D view stays empty today.

| # | Area              | What you do there                                                                                                             | Read more                                                          |
| - | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1 | 3D view           | Drag to orbit, right-drag to pan, scroll to zoom.                                                                             | [Move around the 3D view](/docs/client/viewer)                     |
| 2 | Panel toggle      | **Hide panel** gives the 3D view the whole window; **Show panel** brings the panel back.                                      |                                                                    |
| 3 | Header            | The **WebGPU** or **WebGL2** and **WebCodecs** chips say what your browser can do. The sun or moon button switches the theme. | [Check your browser](/docs/client/browser-requirements)            |
| 4 | **View**          | The **Blend** switch and **Blend tuning**.                                                                                    | [What you can tweak](/docs/client/what-you-can-tweak#view-section) |
| 5 | **Servers**       | Type an address and select **Connect**, open a recording, or select **Add mock server**.                                      | [Add a server](/docs/client/add-a-server)                          |
| 6 | Server card       | One per server: status, calibration, lock and buttons.                                                                        | [Read a server card](/docs/client/server-card)                     |
| 7 | **World anchors** | Move where your browser draws each anchor.                                                                                    | [Move an anchor in your view](/docs/client/world-anchors)          |

## Find your way around the setup view [#find-your-way-around-the-setup-view]

Select **Set up** on a card. The setup view takes the server’s setup lock and replaces **Servers** and **World anchors**.

<img alt="The setup view for the Dev mock server, with the synthetic test scene in the 3D view. Callouts: 1 the SET UP title with the Leave button; 2 the Locked by you, Active and lock countdown chips; 3 Camera pose; 4 Depth quantization; 5 Network; 6 Placement" src="__img1" />

| # | Area                   | What you do there                                                   | Read more                                                     |
| - | ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1 | Title and **Leave**    | Leave and release the lock. Nothing is committed.                   | [Set up a server](/docs/client/setup-workspace)               |
| 2 | Chips                  | **Locked by you**, the session (**Active**) and the lock countdown. | [Set up a server](/docs/client/setup-workspace)               |
| 3 | **Camera pose**        | Not in the client yet.                                              | [Calibrate depth](/docs/client/calibration#camera-pose)       |
| 4 | **Depth quantization** | **Start**, **Cancel** and **Commit** a depth calibration.           | [Calibrate depth](/docs/client/calibration)                   |
| 5 | **Network**            | Not available yet.                                                  | [Calibrate depth](/docs/client/calibration#network)           |
| 6 | **Placement**          | **Edit**, move the server, then **Commit**.                         | [Place a server in the scene](/docs/client/placement-editing) |

## Go from a server to the 3D view [#go-from-a-server-to-the-3d-view]

1. Select **Add mock server**, or type a server’s address and select **Connect**.
2. Wait for the card’s status chip to turn **Ready** or **Streaming**.
3. Check the card for a **Setup and control only** chip. Without it, your browser decodes the video, and **Pairs** goes up.
4. Click the 3D view, then orbit, pan and zoom.
5. If the card shows **Needs setup**, select **Set up**, then [calibrate depth](/docs/client/calibration) and [place the server](/docs/client/placement-editing).

## Switch the theme, or use a small screen [#switch-the-theme-or-use-a-small-screen]

The sun button in the header switches to the light theme; the moon button switches back. This browser remembers your choice. The 3D view stays dark in both themes.

<img alt="The client in the light theme: a light side panel next to the 3D view, which shows the synthetic test scene" src="__img2" />

On a window narrower than 720 pixels, the 3D view takes the top 42 % of the screen and the panel scrolls below it:

<img alt="The client at phone width: the 3D view with the synthetic test scene on top, and the panel below it with the header, View and Servers" src="__img3" />

[What you can tweak](/docs/client/what-you-can-tweak) lists every control.
