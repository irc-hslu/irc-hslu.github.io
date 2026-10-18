# View in VR (https://irc-hslu.github.io/orbbecstreamer/docs/client/view-in-vr)



Headset viewing is experimental. It is off by default in the package. It does not work out of the box: you turn it on yourself, and the headset must open the viewer over HTTPS with a trusted certificate.

The team has not yet tried this on a headset; it has been checked only in an emulator. Treat it as a test build.

## What you need [#what-you-need]

* A server PC with LAN viewers turned on. They use HTTPS on port 8443. See [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan).
* A headset that the page can reach on the LAN: Apple Vision Pro or Meta Quest 3 / 3S.
* The headset's browser must support WebXR, the browser API for headsets, and must trust the server's certificate.

## Turn it on [#turn-it-on]

1. Set up LAN viewers on the server PC, as the install page says.
2. Trust the installation's certificate authority on the headset. Use the same fingerprint check as step 4 of [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan): the fingerprint on the headset must match the one on the server PC. How to import a certificate differs by headset. The team has not tried it on either.
3. In the headset's browser, open `https://<server-hostname>.local:8443/?xr=1` or `https://<server-LAN-IP>:8443/?xr=1`. The name or address must be one the server's certificate covers.

`?xr=1` is the only switch for users. Without it the client loads nothing for VR.

## Enter VR [#enter-vr]

With `?xr=1`, in a browser that has WebXR, an **Enter VR** button appears next to the side-panel toggle. Without WebXR there is no button. If VR can't start, the button is disabled and its tip says why, for example `VR is not available in this browser` or `VR needs the 3D view`.

With the flag on, the client draws with WebGL2, because the 3D engine presents VR only on WebGL2.

Select **Enter VR**. Inside the headset you see the point clouds and a small status pill, for example `● 2 of 2 Streaming`. The pill names a problem when one server is **Delayed** or **Stale**.

## Use the panel [#use-the-panel]

Select the pill to open the panel. Select **Close**, or press B or Y on a Quest controller, to close it. The panel has three tabs: **Servers**, **View** and **Place**.

* **Servers** lists each server with its state and capture-to-display time. At the bottom are **Seated** and **Larger text**, and **Exit VR**.
* **View** has **Point size**, **Shape** (**Square** or **Round**) and **Snap turn**.
* **Place** has **Life size**, **Tabletop**, **Recentre**, and **Turn**, **Scale** and **Height** controls.

Not built yet: the **Notices** list, a comfort vignette, and markers for world anchors and cameras. The panel does not show controls for them.

## Move the scene [#move-the-scene]

* **Grab:** press and hold on empty space to hold the scene, then move your hand to move it.
* **Scale and turn:** hold with both hands. Moving them apart or together scales the scene. Turning the line between them turns it.
* **Snap turn:** on Meta Quest 3 / 3S, push the right stick sideways to turn by 30° (45° can be chosen with **Snap turn** in **View**). On Apple Vision Pro there is no stick: use **Snap turn** in the **View** tab.
* **Seated:** use it when you sit. It lowers the floor to a seated eye height.
* **Larger text:** makes the panel text larger. The panel pages instead of growing.

Expected on Apple Vision Pro (not yet seen on a device): the points fade out near the edge of the play area, and the session ends if you stay outside. The notice reads `Near the edge of the play area`.

## Leave VR [#leave-vr]

Select **Exit VR** in the panel, or use the headset's own exit. The desktop page shows `Left VR`.

## Device notes [#device-notes]

* **Apple Vision Pro:** gaze and pinch. No stick, so use the panel for snap turn.
* **Meta Quest 3 / 3S:** controllers or hands. Right-stick snap turn.

## Troubleshooting [#troubleshooting]

* **The page says the connection is not private:** the headset does not trust the certificate. Repeat step 2.
* **The `.local` name doesn't open on the headset:** use the server's LAN IP address instead, if the certificate covers it. Whether the Quest resolves `.local` names is untested.
* **No Enter VR button:** check that the URL has `?xr=1` and that the headset's browser supports WebXR.
* **`VR needs a reload to start. Reload now?`:** accept. The client reloads once to switch to WebGL2.
* **`VR was not allowed. Allow it in the browser's site settings, then try again.`:** allow VR for the site.
* **`VR ended: you left the play area. Enter VR again.`:** select **Enter VR** again.

More about the flag for developers, including the development server: [Runtime options](/docs/client/developer/runtime-options#enter-vr-experimental-behind-a-flag).
