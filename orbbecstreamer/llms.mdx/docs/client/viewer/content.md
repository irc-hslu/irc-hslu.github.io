# Move around the 3D view (https://irc-hslu.github.io/orbbecstreamer/docs/client/viewer)









The 3D view, left of the side panel, draws one coloured point cloud per bundle for every connected server and open recording, in one shared scene. Each point is one depth pixel, coloured by the same pixel of the colour video, and each cloud sits where its server’s placement puts it.

Today the 3D view stays empty in the main client, because no browser tested so far decodes HEVC video. You can still move the camera, and the placement handle appears in the view. See [Check your browser](/docs/client/browser-requirements).

## Move the camera [#move-the-camera]

1. Connect a server or play a recording. The clouds appear as soon as decoded frames arrive; there is nothing to switch on.
2. Click the 3D view once, so that it receives your key presses.
3. Move around with the controls in this table.

| Action                        | Mouse                                                                 | Touch                 | Keyboard                    |
| ----------------------------- | --------------------------------------------------------------------- | --------------------- | --------------------------- |
| Orbit around the target point | Drag with the left button                                             | Drag with one finger  | Arrow keys                  |
| Pan (move the target point)   | Drag with the right button, or **Ctrl** and drag with the left button | Drag with two fingers | **Ctrl** and arrow keys     |
| Zoom in and out               | Mouse wheel                                                           | Pinch                 | **Alt+Up** and **Alt+Down** |

The camera turns around a target point that starts 2 metres in front of the scene origin. At start, the camera sits 3 metres from that point, slightly above it, looking forward.

Each wheel step zooms by about 2 % of the current distance, so zooming is fine up close and fast far away. Points closer than 1 cm or farther than 100 metres from the camera aren’t drawn. There is no reset button: to get back to the start view, move back by hand.

## What you should see [#what-you-should-see]

Once your browser decodes a server’s video, you should see a coloured point cloud on a dark background. Gaps appear where the depth reading was missing or out of range; the view hides those pixels instead of drawing them at the near or far limit. Until then, the view is dark and empty.

The following picture doesn’t come from the main client. It shows what the renderer draws with WebGL2, using the synthetic two-camera scene of the developer render check.

<img alt="A point cloud of a checkerboard wall with an orange sphere in front of it, and a gap in the wall behind the sphere. This is test data drawn by the client’s renderer on a test page, because the capture browser couldn’t decode HEVC video" src="__img0" />

When frames are drawn, every bundle row on the server card reads `ready, drawing`, and **uploaded** keeps going up.

Each point is a square dot 2 device pixels wide, with WebGPU and with WebGL2. On a display scaled to 200 %, a dot looks 1 pixel wide. The view stays sharp when you resize the panel or window, or move the window to a screen with another scaling. The `renderer:` line at the top of the side panel says which backend is in use. See [Check your browser](/docs/client/browser-requirements).

Where two cameras see the same surface, the view blends their colours instead of mixing their dots. See [Blend overlapping cameras](#blend-overlapping-cameras).

These viewer features are coming soon:

* A control to change the point size, points that grow when you get closer, and round points
* Headset (WebXR) viewing

The view has no switches for colour only, depth only or the foreground mask. These are not planned yet.

## Blend overlapping cameras [#blend-overlapping-cameras]

When two or more cameras see the same surface, each of them contributes points there. Without blending, the dot nearest to you wins pixel by pixel, so the overlap looks like a noisy mix of both cameras’ colours. With blending, the view mixes the cameras’ colours smoothly, in linear light, so mixed areas keep their brightness. A camera counts more where it sees the surface well:

* it looks at the surface from close to your viewing direction;
* the surface is close to it and faces it;
* the point is away from the edge of what the camera sees, such as a silhouette or the image border, where depth readings are least reliable.

Only surfaces within a few centimetres of the nearest surface blend; a surface behind it stays hidden.

Blending needs WebGPU. With WebGL2, the nearest dot always wins and the blend controls are switched off.

The following pictures don’t come from the main client. They show the renderer on a developer test page, with test data from two cameras whose colours are tinted red and blue so that their overlap stands out. Without blending, the overlap is a noise of red and blue dots:

<img alt="Point cloud of a checkerboard wall with a sphere in front, drawn without blending: where the two cameras overlap, the squares are a speckled mix of red-tinted and blue-tinted dots" src="__img1" />

With blending, the colours mix smoothly, and each camera fades out towards its own edges, such as around the sphere’s shadow on the wall:

<img alt="The same scene drawn with blending: the squares are evenly coloured, with smooth red-to-blue transitions where one camera’s view ends" src="__img2" />

### Switch blending on or off [#switch-blending-on-or-off]

Blending is on by default.

1. Find the **View** section under the header of the side panel.
2. Select or clear **Blend overlapping cameras**. The view changes at once.
3. Read the line under the switch. It says how points are drawn now:

| Status line                                                      | Meaning                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Blending overlapping cameras.`                                  | Blending is on.                                                                                                   |
| `Blending off: the nearest point is drawn.`                      | You switched blending off.                                                                                        |
| `Preparing blending… plain points meanwhile.`                    | The graphics card is still preparing blending, for a moment after the page loads. Plain dots are drawn meanwhile. |
| `Blending unavailable, plain points: …`                          | The graphics card couldn’t run blending. The text after the colon says why. Plain dots are drawn.                 |
| `Blending needs WebGPU; with WebGL2 the nearest point is drawn.` | The browser uses WebGL2.                                                                                          |

The settings stay in this browser tab only. They aren’t sent to any server, and they go back to the defaults when you reload the page.

### Tune blending [#tune-blending]

Open **Blend tuning** in the **View** section to change how cameras are weighed. [What you can tweak](/docs/client/what-you-can-tweak#blend-tuning) lists the eight fields, their ranges and defaults, and when to change each. **Reset tuning** restores every default.

## Fix drawing problems [#fix-drawing-problems]

| What you see                                                                         | Why                                                                                                                                                     | What to do                                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The panel shows `renderer: rendering-incompatible`                                   | The browser has neither WebGPU nor WebGL2, or hardware acceleration is off.                                                                             | Turn on hardware acceleration, or try another browser. See [Check your browser](/docs/client/browser-requirements).                                                                 |
| The card shows `Setup and control only: this browser lacks …`                        | The browser can’t decode the video, so there are no frames to draw.                                                                                     | Use a browser and machine with HEVC decoding.                                                                                                                                       |
| A bundle row stays `ready, no frame yet`, and **decoded pairs** stays at 0           | No frames reach the client.                                                                                                                             | Check that the server is streaming. The card’s status and **last close** line say whether the connection is up.                                                                     |
| **decoded pairs** goes up, **uploaded** doesn’t, and **dropped** does                | Frames arrive but belong to a newer server setup than the one the client holds.                                                                         | Wait: the client fetches the new setup and resumes by itself. If it doesn’t, select **Remove** on the card and add the server again.                                                |
| The cloud freezes or disappears for a moment after a calibration or placement change | The client never draws a frame with the setup of another revision.                                                                                      | Wait. Drawing resumes once the new setup arrives.                                                                                                                                   |
| A bundle row shows `upload error: …`                                                 | The graphics card rejected a frame. The bundle stays hidden until the next good frame.                                                                  | This usually clears by itself. If it keeps happening, reload the page.                                                                                                              |
| The clouds disappear after the graphics driver or GPU resets                         | The browser lost its GPU device.                                                                                                                        | Wait: the clouds come back by themselves within a few frames. If they don’t, reload the page.                                                                                       |
| One bundle isn’t blended with the others, while blending is on                       | Its points don’t fit the GPU’s buffer limit: about 5.6 million depth pixels per bundle on a GPU that allows no more. The bundle is drawn as plain dots. | Configure the server with fewer or smaller cameras per bundle, for example one bundle per camera.                                                                                   |
| A bundle row shows `rendering incompatible (too-many-tiles): …`                      | The bundle packs more than 16 cameras into one stream.                                                                                                  | Configure the server with 16 cameras or fewer per bundle, for example one bundle per camera.                                                                                        |
| A bundle row shows `metadata invalid (…)`                                            | The server’s description of this bundle doesn’t add up. The client keeps the last good frame.                                                           | Check the server’s calibration and placement.                                                                                                                                       |
| The cloud looks mirrored, left to right or top to bottom                             | The coordinate convention between servers and the client isn’t final yet.                                                                               | Report it with the server’s calibration.                                                                                                                                            |
| Two servers’ clouds overlap                                                          | Their placements put them in the same place.                                                                                                            | [Place a server in the scene](/docs/client/placement-editing), or [move an anchor in your view](/docs/client/world-anchors).                                                        |
| A cloud moved in your view but not for other people                                  | You moved its anchor, or you have an uncommitted placement draft. Both stay in your browser.                                                            | Commit the placement, or select **Reset to identity** or **Discard draft**.                                                                                                         |
| The picture tears with WebGL2, showing parts of two frames                           | The client asks WebGL2 for a low-latency canvas, which can tear.                                                                                        | This is expected: it trades tearing for lower delay.                                                                                                                                |
| The view is slow or jerky                                                            | Each camera adds about one point per depth pixel.                                                                                                       | Close other graphics-heavy tabs, and connect only the servers you need. With WebGPU, clear **Blend overlapping cameras** in the **View** section: blending draws every point twice. |
| The **View** status line says `Blending unavailable, plain points: …`                | The graphics card or driver couldn’t run blending. The view falls back to plain dots.                                                                   | Reload the page. If it stays, update the graphics driver, and report the text after the colon.                                                                                      |
| A surface shows through another one in front of it                                   | The depth tolerance is larger than the gap between the two surfaces.                                                                                    | Lower **Depth tolerance (m)** or **Depth tolerance per metre** under **Blend tuning**.                                                                                              |
| Where cameras overlap, the colours look smeared or doubled                           | The cameras’ placements or calibrations don’t quite agree, so blending mixes two slightly shifted images.                                               | Check the placements and calibrations. Meanwhile, raise **View-angle sharpness**, so that one camera dominates.                                                                     |
| Where cameras overlap, the surface is speckled even with blending on                 | The two cameras see the surface more than the depth tolerance apart, so only the nearer one is drawn at each pixel.                                     | Raise **Depth tolerance (m)** a little, or check the cameras’ calibration.                                                                                                          |
