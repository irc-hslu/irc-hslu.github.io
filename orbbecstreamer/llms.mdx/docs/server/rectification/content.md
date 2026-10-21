# Rectification (https://irc-hslu.github.io/orbbecstreamer/docs/server/rectification)



The wire contract (`protocol/wire-format.md` §7) says images are rectified on
the server, with no distortion coefficients on the wire. The server now does
this. With `streams.alignment: color_to_depth`, both encoded streams, depth and
colour, carry rectified images, so a client can unproject with the plain
pinhole intrinsics (`fx`, `fy`, `cx`, `cy`) it receives.

## What the server does [#what-the-server-does]

1. **Reads the lens data from the camera.** At start-up the server reads the
   depth and colour intrinsics, both distortion models (the model name and
   `k1`..`k6`, `p1`, `p2`) and the depth-to-colour extrinsic from the Orbbec
   SDK. It logs them once per camera:

   ```text
   Orbbec calibration: camera=orbbec:… depth: 640x576 fx=… fy=… cx=… cy=… distortion=brown-conrady-k6 k1=… k2=… k3=… k4=… k5=… k6=… p1=… p2=…
   Orbbec calibration: camera=orbbec:… colour: 1280x720 fx=… … distortion=…
   Orbbec calibration: camera=orbbec:… depth_to_colour (translation in millimetres): R=[…] t_mm=[…]
   ```

   The translation is in millimetres, unlike the metre-based poses elsewhere.
   Rectification itself does not use the colour lens or the extrinsic; the
   colour occlusion test of [Seam quality](./seam-quality) does.
2. **Builds one map per camera.** From the depth intrinsics and distortion it
   computes a remap table once, on the CPU, with OpenCV's
   `initUndistortRectifyMap`, and uploads it to the GPU. The rectified image
   keeps the same `fx`, `fy`, `cx`, `cy`, so nothing changes on the wire. A
   lens with no distortion needs no map and costs nothing per frame.
3. **Remaps every frame on the GPU**, first in the processing stage, before the
   depth filter, the masks and NVENC:
   * **Depth** uses nearest neighbour, so a value is never blended across a
     depth edge. Invalid depth (0) stays invalid, and a pixel whose source lies
     outside the camera image becomes invalid.
   * **Colour** uses bilinear interpolation, and only when colour is aligned
     to depth (`streams.alignment: color_to_depth`). Aligned colour sits on the
     depth pixel grid, so the depth lens model applies to it. A source outside
     the image becomes black. Native-size colour is not rectified.

The remap runs on the existing processing stream, takes its output buffers
from the buffer pool (no allocation per frame in steady state) and adds no
host synchronisation.

## When frames are not rectified [#when-frames-are-not-rectified]

Rectification never stops the server. When it cannot apply, the frames stream
as the camera made them, which is what earlier versions did, and the server
logs a warning once:

| Case                                                                                                        | What happens                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `streams.alignment: depth_to_color`                                                                         | Depth frames are colour-sized and the depth lens map does not fit them. No camera is rectified. This deviates from wire-format §7.  |
| `streams.alignment` disabled                                                                                | Colour is native, not on the depth grid. No camera is rectified, same deviation.                                                    |
| Depth lens model the server cannot rectify (modified or inverse Brown-Conrady, or a model a newer SDK adds) | That camera streams unrectified. The warning names the model; report the camera and its firmware version so the model can be added. |
| Depth distortion coefficients all zero                                                                      | An identity: nothing to do, no warning.                                                                                             |

Set `streams.alignment: color_to_depth` (the development config does) to get
rectified streams.

## Supported lens models [#supported-lens-models]

| SDK model                                  | Used by the server                  |
| ------------------------------------------ | ----------------------------------- |
| none                                       | No remap                            |
| Brown-Conrady, Brown-Conrady k6            | Yes (OpenCV model)                  |
| Kannala-Brandt 4                           | Yes (OpenCV fisheye)                |
| Modified or inverse Brown-Conrady, unknown | No: that camera streams unrectified |

The Femto Bolt reports `brown-conrady-k6` for both depth and colour. Its depth
lens uses the large rational form (for example `k1` around 28 and `k4` around
28\); the map builds in a few milliseconds at start-up.

## Camera pose calibration uses the same images [#camera-pose-calibration-uses-the-same-images]

The calibration board is detected in rectified pixels: the engine remaps each
colour frame with the camera's map before detection, so the pose matches the
images the server streams. The corner overlay that the setup console draws is
in the same rectified pixels.

## Recalibrate after upgrading [#recalibrate-after-upgrading]

Camera pose files written by earlier versions were measured on images with lens
distortion in them. They still load and the server keeps using the saved poses,
but it logs one warning:

```text
calibrated before rectification - recalibration recommended
```

Run [camera pose calibration](./camera-calibration) again. Each pose write now
also writes `camera-pose.json.image-model` next to the file, a small sidecar
that records whether every camera was rectified (`rectified-v1`) or at least
one was not (`unrectified`, which logs its own warning). The marker is only on
disk; it is not on the wire.

The depth quantization profile is a histogram of depth values and does not
depend on lens geometry, so it needs no recalibration and has no marker.

### Downgrading [#downgrading]

The marker is a separate file, so `camera-pose.json` has exactly the keys older
servers require and they load it without a change. Nothing breaks on a
downgrade. If an older server then recalibrates, the sidecar's revision no
longer matches the pose, so a newer server reads that pose as "before
rectification" and warns.

## Recordings [#recordings]

The debug GPU-input recordings (`record_gpu_inputs`) are taken before
processing, so they hold the raw, unrectified frames. The GPU-output recordings
are the encoded streams and are rectified.

## GPU cost [#gpu-cost]

Measured with CUDA events on an RTX 4090, one camera at 640×576 (depth
nearest neighbour plus aligned colour bilinear), 500 frames after warm-up:

| Work per camera and frame | p50      | p99      | max      |
| ------------------------- | -------- | -------- | -------- |
| Depth and colour remap    | 0.009 ms | 0.009 ms | 0.021 ms |
| Depth remap alone         | 0.004 ms | 0.005 ms | 0.005 ms |

The map takes 2.9 MB of GPU memory per camera. The test is
`frame_rectifier_unit_tests`; it prints these numbers.
