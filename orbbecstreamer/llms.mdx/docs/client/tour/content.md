# Tour of the client (https://irc-hslu.github.io/orbbecstreamer/docs/client/tour)







The client is one browser page: a 3D view on the left and a side panel on the right. This page shows where everything is and takes you from an empty page to a connected server. Read it first.

## Open the client [#open-the-client]

1. In the repository’s `client` folder, run `npm ci` once, then `npm run dev`. [Run the client](/docs/client/dev-build) has the details.
2. Open [http://localhost:5173/](http://localhost:5173/) in your browser.

The page opens with a dark, empty 3D view and no servers. On a window narrower than 720 pixels, the side panel moves below the 3D view.

## Find your way around the main screen [#find-your-way-around-the-main-screen]

The side panel scrolls on its own, and the 3D view stays in place. This is the screen with one server added:

<img alt="The client with the mock server added. Callouts: 1 the 3D view on the left; in the side panel, 2 the header with the renderer and decoders lines, 3 the View section, 4 Add server, 5 Open recording, 6 Dev: mock server, 7 the server card, 8 World anchors" src="__img0" />

| # | Area                 | What you do there                                                                              | Read more                                                             |
| - | -------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1 | 3D view              | See every server’s point cloud in one scene. Drag to orbit, right-drag to pan, scroll to zoom. | [Move around the 3D view](/docs/client/viewer)                        |
| 2 | Header               | Read what your browser can do: the `renderer:` and `decoders:` lines.                          | [Check your browser](/docs/client/browser-requirements)               |
| 3 | **View**             | Switch **Blend overlapping cameras** and open **Blend tuning**.                                | [What you can tweak](/docs/client/what-you-can-tweak#view-section)    |
| 4 | **Add server**       | Connect to a capture server by its address.                                                    | [Add a server](/docs/client/add-a-server)                             |
| 5 | **Open recording**   | Play a recorded colour and depth video pair.                                                   | [Play a recording](/docs/client/playback)                             |
| 6 | **Dev: mock server** | Add a simulated server. Only the development server has this section.                          | [Add a server](/docs/client/add-a-server#add-the-mock-server-instead) |
| 7 | **Servers**          | One card per server or recording: its status, setup lock, calibration, counts and buttons.     | [Read a server card](/docs/client/server-card)                        |
| 8 | **World anchors**    | Move where your browser draws each anchor, in your view only.                                  | [Move an anchor in your view](/docs/client/world-anchors)             |

## Find your way around the setup view [#find-your-way-around-the-setup-view]

Select **Set up** on a card to open the setup view for that server. It takes the server’s setup lock and replaces areas 4 to 8. The header, the **View** section and the 3D view stay.

<img alt="The setup view for the Dev mock server. Callouts: 1 the status label and title, 2 the Leave setup (release lock) button, 3 the session and lock lines, 4 Camera pose, 5 Depth quantization, 6 Network, 7 Placement" src="__img1" />

| # | Area                           | What you do there                                                | Read more                                                            |
| - | ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1 | Title                          | Check the status label: `locked-by-me` while you hold the lock.  | [Set up a server](/docs/client/setup-workspace)                      |
| 2 | **Leave setup (release lock)** | Leave and release the lock. Nothing is committed on the way out. | [Set up a server](/docs/client/setup-workspace#leave-the-setup-view) |
| 3 | **session** and **lock**       | Check that you hold the lock, and when it runs out.              | [Set up a server](/docs/client/setup-workspace)                      |
| 4 | **Camera pose**                | Read its state. Camera-pose calibration isn’t in the client yet. | [Calibrate depth](/docs/client/calibration#camera-pose)              |
| 5 | **Depth quantization**         | Start, watch, cancel and commit a depth calibration.             | [Calibrate depth](/docs/client/calibration)                          |
| 6 | **Network**                    | Read its state. Network calibration isn’t available yet.         | [Calibrate depth](/docs/client/calibration#network)                  |
| 7 | **Placement**                  | Move the server in the scene, then commit it for everyone.       | [Place a server in the scene](/docs/client/placement-editing)        |

## Go from a server to the 3D view [#go-from-a-server-to-the-3d-view]

1. Add a server. In **Dev: mock server**, select **Add mock server**. For a real server, type its address in **Add server** and select **Connect to server**.
2. Watch the new card. Its status goes from `connecting` to a live one, such as `streaming`.
3. Check the card for an orange `Setup and control only` line. Without it, your browser can decode the video, and **decoded pairs** and **uploaded** go up.
4. Click the 3D view, then orbit, pan and zoom to find the point cloud.
5. If the card shows `needs-setup`, select **Set up**, then [calibrate depth](/docs/client/calibration) and [place the server](/docs/client/placement-editing).

Today, the 3D view stays empty in the main client. No browser tested so far decodes HEVC video, so every card shows `Setup and control only`, and the capture server doesn’t accept browser connections yet. Cards, setup, calibration and placement all work against the mock server. See [Use the browser client](/docs/client#what-works-today).

## Change settings [#change-settings]

[What you can tweak](/docs/client/what-you-can-tweak) lists every control in the client, with its range, default and when to change it.
