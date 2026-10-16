# Real-image check (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/real-image-check)



`client/scripts/qa/real-image/check.mjs` answers one question: is the point cloud correct on real images? It drives the running client in Chrome for Testing 155, reads back the colour and depth the client uploaded to the GPU, and prints a PASS, WARN and FAIL table. It also writes `out.json` and screenshots to `client/scripts/qa/.out/real-image/` (`--out` changes that).

It measures the app itself. The dev server exposes `window.__orbbec.readBundle`, which copies the uploaded depth codes, the transmitted LUT and the colour texture back. The script unprojects and maps colour with the client's own modules; it doesn't carry a copy of the pipeline.

## Run it [#run-it]

Install once: `cd client && npm ci`, then `cd scripts/qa && npm ci`. Run from `client/scripts/qa/`.

```bash
node real-image/check.mjs --synthetic --cast warm --expect-plane   # dry run on a synthetic scene: should PASS
node real-image/check.mjs --synthetic-dark                         # black picture, almost no depth: WARN
node real-image/check.mjs --recording <folder>                     # your own recording folder
node real-image/check.mjs http://localhost:5173/                   # a dev client that already reaches the server
node real-image/check.mjs http://127.0.0.1:8080                    # the packaged page: screenshots only
```

| Option                                       | Meaning                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cast warm\|cool\|none`                    | The colour cast the scene has. With `warm` or `cool`, the script FAILs when red and blue look swapped. Default `none`: only R - B is reported.                                  |
| `--expect-plane`                             | A wall or floor fills the middle of the view: a non-planar centre patch FAILs instead of WARN.                                                                                  |
| `--samples N`                                | Frames read back per colour path (default 5).                                                                                                                                   |
| `--timeout S`                                | Seconds to wait for the first decoded frame (default 90).                                                                                                                       |
| `--allow-dark`                               | An all-dark scene exits 0. Default: exit 3, because a black picture is also what a pipeline bug looks like. FAIL rows that need no scene (LUT, frames, colour paths) stay FAIL. |
| `--keep-dark`                                | Don't turn failures into WARN when the scene is dark.                                                                                                                           |
| `--out DIR`, `--vite-port N`, `--cdp-port N` | Output folder, the script's own Vite port (5291) and Chrome's debugging port (9371).                                                                                            |

`--synthetic` and `--recording` start this checkout's own Vite and stop it at the end. With a URL, the script only opens that page. A dev URL gives every check below.

The script's Chrome starts with an empty profile each run, so the dev page has no saved server, and a plain `npm run dev` offers no transport discovery. To check a live server, start the dev client on the server PC so that it takes discovery from the packaged page server, and allow its origin on the server:

1. In `/etc/orbbec-streamer/live.yaml`, add `http://localhost:5173` to `serving.allowed_origins`, then `sudo systemctl restart orbbec-streamer`.
2. In the `client` folder: `ORBBEC_DISCOVERY_FROM=http://127.0.0.1:8080 npm run dev`. The dev page now adds the server as the packaged page does, with its certificate hashes. Only a loopback address is accepted.
3. In `client/scripts/qa`: `node real-image/check.mjs http://localhost:5173/`, plus `--cast` and `--expect-plane` to suit the scene.

The packaged page is a production build, which strips the readback hook, so the script can only screenshot it: it reports a WARN for the missing checks, tells a missing server (FAIL) from a blank 3D view, and doesn't measure anything else.

The exit code is 1 when any row is FAIL, and 3 when every camera is dark (see `--allow-dark`).

## What each check means [#what-each-check-means]

Rows are named `<camera>/<check>`. A scene counts as **dark** when the mean luma is under 12 and its 99th percentile under 48 (a covered lens). Then the script adds `scene dark (cameras covered?)` as a WARN and reports every content-dependent failure as WARN, so you can run the script before the cameras face the room.

| Check             | What it measures                                                                                                                                                                                                                                                | PASS                                             | WARN                                                                                                          | FAIL                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `path`            | Which colour path ran: planar YUV to RGB, or the browser copy                                                                                                                                                                                                   | planar used                                      | planar did not run                                                                                            |                                                                               |
| `colour/levels`   | Mean, spread and clipping of the colour the points sample, per channel: only pixels with a valid depth code, because colour aligned to depth is black where depth is invalid (under 500 such pixels: the whole picture). `colour/channels` uses the same pixels | no clipping, spread present                      | more than 2 % of a channel at or below 2 or at or above 253, a flat picture (spread under 6), or a dark scene | more than 10 % clipped                                                        |
| `colour/paths`    | The same recording with `?colourPath=planar` and `?colourPath=frame`: difference of the mean per channel                                                                                                                                                        | at most 2 levels                                 | up to 4 levels                                                                                                | more than 4                                                                   |
| `colour/channels` | With `--cast`: is red above blue (warm) or the other way round (cool)?                                                                                                                                                                                          | cast as expected                                 | cast under 8 levels                                                                                           | the opposite cast: channel swap                                               |
| `depth/lut`       | The GPU LUT equals the transmitted one; entry 0 is 0; the LUT rises                                                                                                                                                                                             | all hold                                         |                                                                                                               | any fails                                                                     |
| `depth/valid`     | Share of valid codes (not 0, below min or above max)                                                                                                                                                                                                            | 30 % or more                                     | 10 to 30 %, or over 30 % below or above range                                                                 | under 10 %                                                                    |
| `depth/range`     | Decoded millimetres of the valid codes through the LUT stay inside the profile's minimum and maximum                                                                                                                                                            | inside                                           |                                                                                                               | outside, or no valid code                                                     |
| `depth/histogram` | Decoded millimetres of the valid codes in 16 equal bins across the profile range                                                                                                                                                                                | information only                                 |                                                                                                               |                                                                               |
| `geometry`        | Bounding box and median distance of the unprojected cloud in metres, and the share of points in front of the camera under the server pose                                                                                                                       | 99.9 % in front, median inside the profile range |                                                                                                               | otherwise                                                                     |
| `depth/plane`     | Plane fit to a central 96 x 96 patch, RMS residual in millimetres                                                                                                                                                                                               | 10 mm or less                                    | up to 25 mm; more, unless `--expect-plane`; or the patch is under 60 % valid                                  | more than 25 mm with `--expect-plane`                                         |
| `alignment`       | Edge overlap score: the share of depth edges (a jump of more than 50 mm or 3 %) with a colour edge within 2 px                                                                                                                                                  | 0.5 or more and clearly above chance             | 0.3 to 0.5, under 150 depth edges, or barely above chance                                                     | under 0.3, or the score at a shift of more than 3 px or a flip is 0.15 higher |
| `screenshots`     | The 3D view from the default camera and from the framed view                                                                                                                                                                                                    | taken                                            |                                                                                                               |                                                                               |

The planar versus browser-copy comparison uses the same source twice, so the scene is static or loops; the mean of several frames per run is compared, not single frames. The row `path` says whether the forced copy run really left the planar path.

`readBundle` needs the WebGPU engine, while the 3D screenshots come from the WebGL2 engine (`?engine=webgl2`), so a full run opens the page with both engines. A headless Chrome captures a WebGPU canvas as blank white. The colour and depth tile pictures are written beside them: depth uses the tile views' colours (black invalid, blue below range, red above, a grey ramp from near to far).

## Dev hooks it uses [#dev-hooks-it-uses]

All three work on the dev server only and are removed from production builds.

* `window.__orbbec.readBundle(entryId, bundleId)` reads back the uploaded depth codes, LUT and colour of a bundle (`client/src/rendering/textureReadback.ts`, installed in `client/src/app/devHooks.ts`).
* `?colourPath=frame` forces the browser-copy colour upload. The default is the planar path.
* `?engine=webgl2|webgpu` picks the engine.

## Synthetic content [#synthetic-content]

`--synthetic` plays a made-up recording (cached in `client/scripts/qa/.cache/real-image/`, made with ffmpeg with libx265): a tilted wall at 2.2 m with a box at 1.4 m and a disc at 1.0 m, warm colours, invalid, below-minimum and above-maximum patches, identity pose, lossless depth. Say "synthetic" next to any number from it. It shows that the script and the pipeline agree; it says nothing about a camera.
