# Seam quality (https://irc-hslu.github.io/orbbecstreamer/docs/server/seam-quality)



Colour is aligned to depth by the Orbbec SDK (`streams.alignment:
color_to_depth`). At a silhouette that alignment can put the colour of the
person onto the depth of the wall behind them. A client then shows a
head-coloured patch lying flat on the wall, or a thin curtain of points in the
air between the head and the wall. This page describes the three GPU passes
that remove those pixels, the configuration keys, and how to check the effect
on a camera. Nothing on the wire changes: the passes only turn more depth
pixels into code 0, which already means "invalid" (wire format §8).

## Why it happens [#why-it-happens]

* **Parallax.** The colour sensor sits about 3 cm from the depth sensor. A
  wall pixel right beside the head is seen by the depth sensor but hidden from
  the colour sensor, because the head is in front of it. The SDK's alignment
  looks the colour up for every depth pixel and does not test for this, so the
  wall pixel gets the colour of the head. The band is one-sided, on the side of
  the head away from the colour sensor. Its width in depth pixels is
  `fx × baseline × (1 / z_near − 1 / z_far)`: about 8 pixels for a person at
  1.2 m in front of a wall at 3 m, and shrinking as the person moves back.
* **Mixed pixels.** The depth of a pixel on a silhouette is often a mixture of
  the two surfaces ("flying pixel"), or missing. The bilateral filter used to
  average across the jump and to fill missing depth from the neighbours, which
  made more mixtures.
* **Mask overreach.** The soft matte can extend a few pixels past the true
  silhouette, onto the wall.

## What the server does [#what-the-server-does]

All three passes run on the processing stream, per camera, after
[rectification](./rectification) and the mask. The source depth buffer is never
modified (calibration and the recorders read it). They apply with
`processing.depth_filter_backend: bilateral_cuda`; `identity_copy` stays a pure
copy so the filter and mapping can be compared with it.

1. **Colour occlusion test.** Every valid depth pixel is projected into the
   colour image (using the colour intrinsics, lens model and the
   depth-to-colour extrinsic read from the camera) and its depth in the colour
   frame is kept in a z-buffer. A depth pixel that is more than a tolerance
   behind the nearest surface at its colour pixel, or at a neighbouring cell
   (to absorb the small mismatch between this projection and the SDK's), is
   invalid. This needs `streams.alignment: color_to_depth` and a usable colour
   calibration; a camera without one only loses this pass, with a warning.
2. **Flying pixels and silhouette band.**
   * A pixel whose depth differs from a valid neighbour by more than
     `max(flying_pixel_jump_mm, flying_pixel_jump_ratio × the nearer depth)` is
     invalid. A smooth surface is far below that: at 1.5 m one pixel is about
     3 mm.
   * Mask erosion happens only at depth jumps: a masked pixel close to the mask
     edge that lies behind a nearer masked surface is invalid, so overreach onto
     the wall goes, while a silhouette where the depths agree (feet on the
     floor, a hand on the body) keeps every pixel. One more pixel of foreground
     is dropped where the mask edge is itself a depth jump.
3. **Bilateral filter.** Flagged pixels are invalid and never contribute to a
   neighbour. A depth range term lowers the weight of neighbours at another
   depth: it is flat within `s = max(bilateral_depth_sigma_mm,
   bilateral_depth_sigma_ratio × depth)` (sensor noise is smoothed as before)
   and Gaussian beyond it. A neighbour above the jump threshold never
   contributes. A pixel without depth stays invalid
   (`bilateral_fill_holes: false`); the filter does not invent depth.

Pixels removed this way are holes. With two cameras the other camera usually
fills them in the fused cloud; where it cannot, the hole is the price of not
showing the wrong colour.

## Configuration [#configuration]

All keys are in the `processing` section, optional, and on by default. They
are checked when the file is loaded; a value out of range, negative or not a
finite number stops start-up with the key's name.

| Key                            | Type    | Default | Range             | Effect                                                                                                                                            |
| ------------------------------ | ------- | ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seam_filter_enabled`          | bool    | `true`  |                   | Master switch for the occlusion test and the flying-pixel and silhouette passes. The filter's own range term and hole policy (below) stay as set. |
| `occlusion_test_enabled`       | bool    | `true`  |                   | The colour occlusion test alone. Active with `color_to_depth` only; with another alignment it is off, with one warning.                           |
| `occlusion_tolerance_mm`       | float   | `20`    | ≥ 0               | A pixel is occluded when it is further than the nearest surface by more than `max(this, ratio × depth)`.                                          |
| `occlusion_tolerance_ratio`    | float   | `0.02`  | ≥ 0               | Relative part of the tolerance.                                                                                                                   |
| `occlusion_zbuffer_downsample` | integer | `2`     | 1–4               | The z-buffer has the colour image size divided by this. 2 closes the gaps between projected depth pixels.                                         |
| `occlusion_neighbourhood_px`   | integer | `1`     | 0–2               | Cells around the pixel's own that are searched for a nearer surface.                                                                              |
| `flying_pixel_radius_px`       | integer | `1`     | 0–3               | Window radius for the flying-pixel test. 0 turns it off.                                                                                          |
| `flying_pixel_jump_mm`         | float   | `30`    | ≥ 0               | Fixed part of the jump threshold.                                                                                                                 |
| `flying_pixel_jump_ratio`      | float   | `0.03`  | ≥ 0               | Relative part of the jump threshold. Not both zero while the radius is above 0.                                                                   |
| `seam_erode_px`                | integer | `2`     | 0–4               | A masked pixel this close to the mask edge is removed when it lies behind a nearer surface. 0 turns it off.                                       |
| `seam_search_px`               | integer | `4`     | `seam_erode_px`–8 | How far to look for the nearer surface.                                                                                                           |
| `seam_foreground_erode_px`     | integer | `1`     | 0–2               | Foreground pixels removed where the mask edge is a depth jump.                                                                                    |
| `bilateral_depth_sigma_mm`     | float   | `10`    | ≥ 0               | Fixed part of the range sigma. Both sigmas 0 turns the range term off.                                                                            |
| `bilateral_depth_sigma_ratio`  | float   | `0.01`  | ≥ 0               | Relative part of the range sigma.                                                                                                                 |
| `bilateral_fill_holes`         | bool    | `false` |                   | `true` brings back the old behaviour: a pixel without depth takes its neighbours' mean.                                                           |
| `mask_foreground_threshold`    | integer | `128`   | 0–255             | Foreground when the mask is at least this. Used by the filter, by the passes above and by the depth calibration.                                  |

`bilateral_mask_threshold` is deprecated. It was parsed but never applied
before 0.1.6: the filter always used 128, whatever the file said (the earlier
example configurations said 32). The working setting is the new
`mask_foreground_threshold`. The old key is still read and range-checked
(0–255) but ignored, and when it is present the server logs one warning at
start-up. If both are present, `mask_foreground_threshold` is used. An existing
configuration therefore keeps the effective 128 with no edit; remove the old
key when convenient. Set `mask_foreground_threshold` below 128 only if you want
a wider foreground mask, which also widens the overreach the passes have to
remove.

To get the filter as it was before these passes, set `seam_filter_enabled:
false`, `bilateral_depth_sigma_mm: 0`, `bilateral_depth_sigma_ratio: 0` and
`bilateral_fill_holes: true`.

## Cost [#cost]

Measured on the RTX 4090 with the `dev-relwithdebinfo` build, at the largest
depth size (1024 × 1024), 200 launches, while other work shared the GPU
(busy machine, treat as an upper bound):

| Per camera                                                                | p50      | p99            |
| ------------------------------------------------------------------------- | -------- | -------------- |
| Occlusion test and flying-pixel/silhouette passes (including both clears) | 0.044 ms | 0.054–0.060 ms |
| Bilateral filter, new                                                     | 0.089 ms | 0.092–0.097 ms |
| Bilateral filter, before                                                  | 0.074 ms | 0.077–0.081 ms |
| Added by the change                                                       | 0.06 ms  |                |

At 640 × 576 it is proportionally smaller. No host synchronisation and no
allocation per frame is added: the flag image and the z-buffer are allocated
once and reused.

## Check it on a real camera [#check-it-on-a-real-camera]

The check records for about 20 s from one camera, no board needed, and prints
the numbers before and after. Stop the service first (one process owns the
cameras), put a person in front of a wall or some furniture with straight
edges in view, and run, from `server/`:

```bash
build/dev-relwithdebinfo/orbbec_streamer_seam_quality_check --config config/dev/live.yaml --seconds 20 --output seam-quality.json
```

It reports, for the first camera of the configuration (`--camera <id>` picks
another):

* **Flying (mixed) depth pixels per frame**, in the rectified source depth,
  after the filter as it was before (BEFORE) and after the passes and the new
  filter (AFTER). A mixed pixel differs from both neighbours of an opposite
  pair by more than the jump threshold; a clean step edge is not counted.
* **Valid depth pixels per frame** after each filter, and the share of the
  valid depth the occlusion test and the flying-pixel pass removed.
* **Straightness of long edges** (at least 120 px) in the raw and in the
  rectified colour image: the RMS distance of the edge pixels to their fitted
  line, median and 90th percentile. After rectification the long edges of a
  door frame or a table should be straight to a fraction of a pixel.

The mask in this check is "everything is foreground" (no RVM), so it measures
the occlusion test and the flying-pixel pass; the silhouette band needs a mask
and is covered by the unit tests. The check does not write to the
configuration or the pose files.

For a visual comparison on the whole pipeline, run the same scene four times
with the debug recording on, changing only `mask.backend` (`fill_all`, `rvm`)
and `processing.depth_filter_backend` (`identity_copy`, `bilateral_cuda`), and
look at the wall beside the head in each. `fill_all` with `identity_copy` shows
the alignment alone; `rvm` with `bilateral_cuda` is the production setting.

## Limits [#limits]

* The projection into the colour image uses the lens model that the camera
  reports. Brown-Conrady, its six-coefficient form and Kannala-Brandt are
  handled; the camera's "modified Brown-Conrady" model is treated as the
  six-coefficient form, and an unknown or inverse model as a pinhole. This
  has not been compared with the SDK's own alignment on a camera; the
  neighbourhood and the tolerance cover a small mismatch, not a wrong model.
* Colour that falls outside the colour sensor's field of view is not flagged.
* The passes remove wrong pixels; they do not recover colour for them. A
  client that wants no holes needs the second camera's view of the same place.
* Colour mixing from 4:2:0 chroma subsampling and HEVC ringing at an edge
  happens after these passes and is not addressed here.
