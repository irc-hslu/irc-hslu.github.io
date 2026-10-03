# Use the browser client (https://irc-hslu.github.io/orbbecstreamer/docs/client)



The OrbbecStreamer client is a web page that shows 3D point clouds from one or more capture servers in one shared 3D view. You also use it to set up each server: calibrate its depth and place it in the scene.

## Read the pages in this order [#read-the-pages-in-this-order]

If you’re new to the client, follow these pages in order:

1. [Run the client](/docs/client/dev-build): install it and open it in your browser.
2. [Check your browser](/docs/client/browser-requirements): find out what your browser can do.
3. [Add a server](/docs/client/add-a-server): connect to a capture server, or to the built-in mock server.
4. [Read a server card](/docs/client/server-card): understand each line of a server’s status.
5. [Move around the 3D view](/docs/client/viewer): orbit, pan and zoom.
6. [Play a recording](/docs/client/playback): use recorded files instead of a server.
7. [Set up a server](/docs/client/setup-workspace): open the setup view for one server.
8. [Calibrate depth](/docs/client/calibration): run and commit a depth calibration.
9. [Place a server in the scene](/docs/client/placement-editing): move a server’s point cloud and share the new position.
10. [Move an anchor in your view](/docs/client/world-anchors): line up servers in your own view only.

## What works today [#what-works-today]

The client runs from a development server on your machine. Two limits apply to everything below:

* **No real server yet**: the capture server doesn’t accept browser connections yet, so the client can’t reach one. See [Serve to browsers](/docs/server/serving). Today, everything works only against the built-in mock server or a recording.
* **No point clouds from video yet**: the client decodes HEVC video in the browser, but decoding hasn’t worked in any browser tested so far. See [Check your browser](/docs/client/browser-requirements).

With those limits, you can do the following today:

* **Connect**: add the mock server, or open a recording. Adding a real server by its address is built, but can’t connect yet.
* **Watch**: see each server’s status on its card
* **Set up**: against the mock server, take the setup lock, run and commit a depth calibration, and move the server’s placement with numbers or a 3D handle
* **Try it without hardware**: the development server has the built-in mock server

These parts are not available yet:

* **Camera-pose calibration**: the camera calibration screen is a placeholder.
* **Network calibration**: not available yet.
* **Headset (WebXR) viewing**: coming soon.

## Words used in these pages [#words-used-in-these-pages]

These terms appear on the client’s screens:

* **Server card**: the box in the side panel that shows one server’s status and buttons.
* **Setup lock**: only one client at a time can change a server’s setup, and that client holds the setup lock. The lock is also called the **lease**, because it runs out 15 seconds after its last renewal. While you hold it, the client renews it every 5 seconds.
* **Revision**: a version number. Each time a server’s calibration or placement changes, its revision goes up by one.
* **Placement**: where a server’s point cloud sits relative to a named reference point, the **anchor**.
* **Draft**: a placement change you’ve made in your browser but not sent to the server yet.
* **Bundle**: a colour video stream and a depth video stream that a server sends together. A bundle covers one or more cameras.
* **Snapshot**: a full copy of a server’s state. The client fetches one when it needs to catch up.
* **Shared updates**: calibration results and placement changes that a server sends to every client that asked for them.
* **Mock server**: a simulated capture server inside the development build, for trying the client without hardware.

Developers can read [Mock server](/docs/client/developer/mock-server), [Test the client](/docs/client/developer/test-the-client) and [Contract gaps and interim behaviour](/docs/client/developer/interim-behaviour).
