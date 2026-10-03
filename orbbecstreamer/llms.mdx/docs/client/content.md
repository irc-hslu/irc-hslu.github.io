# Use the browser client (https://irc-hslu.github.io/orbbecstreamer/docs/client)



The OrbbecStreamer client is a web page that shows 3D point clouds from one or more capture servers in one shared 3D view. You also use it to set up each server: calibrate its depth and place it in the scene. New to the client? Start with the [Tour of the client](/docs/client/tour).

## Find the page for your task [#find-the-page-for-your-task]

| Task                                       | Page                                                          |
| ------------------------------------------ | ------------------------------------------------------------- |
| Install and start the client               | [Run the client](/docs/client/dev-build)                      |
| Find out what your browser supports        | [Check your browser](/docs/client/browser-requirements)       |
| Connect to a server, or to the mock server | [Add a server](/docs/client/add-a-server)                     |
| Understand a server’s status               | [Read a server card](/docs/client/server-card)                |
| Orbit, pan, zoom and blend cameras         | [Move around the 3D view](/docs/client/viewer)                |
| Play recorded files instead of a server    | [Play a recording](/docs/client/playback)                     |
| Hold a server’s setup lock                 | [Set up a server](/docs/client/setup-workspace)               |
| Run and commit a depth calibration         | [Calibrate depth](/docs/client/calibration)                   |
| Move a server for everyone                 | [Place a server in the scene](/docs/client/placement-editing) |
| Line up servers in your view only          | [Move an anchor in your view](/docs/client/world-anchors)     |
| Look up any control, its range and default | [What you can tweak](/docs/client/what-you-can-tweak)         |

## What works today [#what-works-today]

The client runs from a development server on your machine. Two limits apply to every page:

* **No real server yet**: the capture server doesn’t accept browser connections yet. See [Serve to browsers](/docs/server/serving). Use the built-in mock server or a recording instead.
* **No point clouds from video yet**: no browser tested so far decodes the HEVC video the servers send. See [Check your browser](/docs/client/browser-requirements).

Within those limits, these work against the mock server: server cards, the setup lock, depth calibration, placement with numbers or a 3D handle, world anchors and the blend settings. These aren’t available yet:

* **Camera-pose calibration**: the Camera pose section is a placeholder
* **Network calibration**
* **Headset (WebXR) viewing**

## Words used on the client’s screens [#words-used-on-the-clients-screens]

* **Server card**: the box in the side panel that shows one server’s status and buttons
* **Setup lock**, or **lease**: only the client that holds it can change a server’s setup. It runs out 15 seconds after its last renewal; the holder renews it every 5 seconds.
* **Revision**: a version number that goes up by one with each change to a server’s calibration or placement
* **Placement**: where a server’s point cloud sits relative to a named reference point, the **anchor**
* **Draft**: a placement change made in your browser and not sent yet
* **Bundle**: a colour video stream and a depth video stream that a server sends together, for one or more cameras
* **Snapshot**: a full copy of a server’s state, fetched when the client needs to catch up
* **Shared updates**: calibration results and placement changes that a server sends to every client that asked for them
* **Mock server**: a simulated capture server in the development build, for trying the client without hardware

Developers: see [Test the client](/docs/client/developer/test-the-client), [Mock server](/docs/client/developer/mock-server) and [Contract gaps and interim behaviour](/docs/client/developer/interim-behaviour).
