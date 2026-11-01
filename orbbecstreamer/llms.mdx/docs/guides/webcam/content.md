# Use a webcam as a camera (https://irc-hslu.github.io/orbbecstreamer/docs/guides/webcam)









A plain USB webcam can join a rig as its own server. It shows either as a
flat picture of the whole image (`none`) or as a point cloud whose depth a
model estimates from the colour image (`estimated`).

<Callout type="warn">
  Not in a release yet: webcams come with v0.1.8. A real webcam has been
  viewed once, in the lab, with a development build; the commands below have
  not been tried on a release package.
</Callout>

<Steps>
  <Step>
    ## Run a server on the webcam machine [#run-a-server-on-the-webcam-machine]

    Install the package on the machine the webcam is plugged into; see
    [Install the package](/docs/getting-started/install-package). A webcam is
    always the only camera of its server: a config that mixes a webcam with
    Femto Bolts, or lists two webcams, is refused. Run one server per webcam.

    Check that the server sees the webcam:

    ```bash
    /usr/lib/orbbec-streamer/bin/orbbec_streamer --uvc-test
    ```

    It opens the first webcam for about 3 seconds and prints its id and frame
    rate.

    Then, in `/etc/orbbec-streamer/live.yaml`, replace the `cameras:` list with
    one camera of `vendor: "uvc"`, turn sync off, and choose its depth source:

    | `depth_source`   | What viewers see                         | Needs                                                                                                                                                                  |
    | ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `none` (default) | A flat picture of the whole image        | Nothing extra                                                                                                                                                          |
    | `estimated`      | A point cloud marked **Estimated depth** | An NVIDIA GPU, and the webcam's intrinsics: `intrinsics_path` (a board calibration) or `horizontal_fov_deg`. The first start builds the model engine (about 3 minutes) |

    The full example, the stream sizes and the other keys are in
    [Webcam (2D) camera](/docs/server/configuration#webcam-2d-camera) and
    [Estimated depth](/docs/server/configuration#estimated-depth). Restart the
    server:

    ```bash
    sudo systemctl restart orbbec-streamer
    ```

    You should see, in the Operator Console's **Cameras & sync**, the webcam
    with **Colour only (no depth)** or **Estimated depth** after its id; see
    [What each panel shows](/docs/operator#what-each-panel-shows).
  </Step>

  <Step>
    ## View it next to the depth-camera servers [#view-it-next-to-the-depth-camera-servers]

    In the client, add the webcam's server next to your other servers; see
    [Add a server](/docs/client/add-a-server). From another computer, the
    webcam machine needs LAN viewers turned on; see
    [Remote viewers on the LAN](/docs/getting-started/install-package#remote-viewers-on-the-lan).
    Each server is separate; see [Multi-server](/docs/server/multi-server).

    Camera-pose calibration does not apply to a webcam; the console's
    calibration screens say `Position this camera with Placement.` Put it in the
    shared world with placement instead: in the Operator Console, open
    **Placement** (`/operator/placement`), or use the client's editor; see
    [Placement](/docs/guides/placement) and
    [Placement editing](/docs/client/placement-editing).

    You should see the webcam's picture or points next to the clouds of the
    other servers, where you placed it.
  </Step>
</Steps>

## Flat picture or estimated depth [#flat-picture-or-estimated-depth]

With `none`, the webcam is a rectangle showing its whole image, 1.5 m in
front of the camera. Points of other servers in front of it hide it.

<img alt="A webcam with no depth: its whole colour image drawn as a flat rectangle in the 3D view" src="__img0" />

*Lab, 2026-10-30: a Logitech BRIO on a development build of the server, `depth_source: none`. The room was dark.*

With `estimated`, it is a normal point cloud, and the server card marks it
**Estimated depth**: "from a single colour image; less accurate than
measured depth". The person mask applies, as for a depth camera.

<img alt="A webcam with estimated depth: the room as a point cloud" src="__img1" />

<img alt="The server card's Details: Layout reads Estimated depth (from a single colour image; less accurate than measured depth), and depth calibration and floor are missing because the camera has no measured depth" src="__img2" />

*Lab, 2026-10-30: the same BRIO with `depth_source: estimated`. The room was dark.*

How the client draws both is in [2D cameras](/docs/client/2d-cameras).

## Accuracy [#accuracy]

Estimated depth: about 9 % distance overestimate, AbsRel 0.19 against a
Femto Bolt, one indoor desk scene.

This holds only with `intrinsics_path`: the server then removes the
webcam's lens distortion before the model sees the picture. With
`horizontal_fov_deg` alone it does not hold. To make the calibration file,
see [Calibrated intrinsics](/docs/server/configuration#calibrated-intrinsics).

## Troubleshooting [#troubleshooting]

* **The server refuses the config.** A webcam must be the server's only
  camera, with sync off. With `estimated`, set exactly one of
  `intrinsics_path` and `horizontal_fov_deg`. See the rules in
  [Webcam (2D) camera](/docs/server/configuration#webcam-2d-camera).
* **Depth calibration, floor or camera pose are refused for the webcam.**
  They need measured depth. Use **Placement** in the console or the
  client instead.
* **`estimated` shows no points for the first few minutes.** The model
  engine is still building (about 3 minutes on the first start); the server
  log (`journalctl -u orbbec-streamer`) says `estimated depth warming up`.
