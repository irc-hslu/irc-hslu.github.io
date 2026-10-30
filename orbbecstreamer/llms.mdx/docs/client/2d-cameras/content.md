# 2D cameras (https://irc-hslu.github.io/orbbecstreamer/docs/client/2d-cameras)



A server can have a 2D camera, such as a webcam, instead of a depth camera. The client shows these two kinds without extra steps.

## A camera with no depth [#a-camera-with-no-depth]

A camera with no depth appears in the 3D view as a flat picture: a rectangle that shows the camera's whole colour image. It sits 1.5 m in front of the camera, in the same place as that camera's points would be, so it follows the server's placement. Points of other servers in front of it hide it, and points behind it do not. It has no points, so it adds nothing to the point count, and the client does not report missing depth for it. When every camera of a server is a 2D camera, the server card shows the depth calibration as a neutral **Depth missing** chip, not a problem, because that calibration needs measured depth.

The picture is drawn on WebGPU and on WebGL2, which VR uses. In VR it is not dimmed or faded with the panel (not built). The depth test was checked with a synthetic scene read back from a real GPU on WebGPU and WebGL2; it has not been checked on a headset.

## A camera with estimated depth [#a-camera-with-estimated-depth]

A camera whose depth is estimated from a single colour image draws a normal point cloud. Its row in the server card's **Layout** list carries the mark **Estimated depth**. The row says in brackets that the depth comes "from a single colour image; less accurate than measured depth".

## Try it [#try-it]

The client is tested against the mock server only. No server with a real webcam exists yet, so everything on this page is simulated. In the development build, open the client with `?mockDepthSource=none` or `?mockDepthSource=estimated`, then select **Add mock server**. The mock has one camera with that source. The `none` mock shows the reference colour picture as a flat rectangle, and the `estimated` mock shows the reference point cloud with the mark.

See [mock server](/docs/client/developer/mock-server) for the other mock switches.
