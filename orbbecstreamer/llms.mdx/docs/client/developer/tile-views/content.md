# Tile views (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/tile-views)





A tile view draws one camera's **colour** or **depth** image into a canvas you provide. It reads the same decoded frames that the 3D view shows: no second decoder, no extra upload, and nothing waits for a slow view. All views of one screen share the renderer's WebGPU device. The Operator Console uses tile views (operator request R8).

The design and its measurements are in `client/docs/development/r8-tile-views.md`.

<img alt="Colour (left) and depth (right) tile views of the render check's two synthetic cameras" src="__img0" />

## Show a tile [#show-a-tile]

Each server's pipeline has a `tileViews` source. Attach a fresh canvas, one with no other context, for a camera and a channel. Give the canvas a CSS width **and** height, and an accessible name, because it is an image to assistive technology:

```ts
const canvas = document.createElement('canvas');
canvas.style.width = '400px';
canvas.style.height = '225px';
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', `Depth image of camera ${cameraLabel}`);

const pipeline = runtime.pipeline(entryId); // AppRuntimeModel
if (pipeline?.tileViews.support.kind === 'webgpu') {
  const view = pipeline.tileViews.attach(canvas, cameraId, 'depth', { maxFps: 15, fit: 'contain' });
  const offState = view.onStateChange((state) => render(state));       // live / waiting / unavailable
  const offContent = view.onContentChange((content) => layout(content)); // where the tile sits, for overlays
  // ... later, when the canvas unmounts:
  offState();
  offContent();
  view.close();
}
```

* Lay out the canvas with CSS only, with both width and height set (a canvas without a CSS height keeps its default 150-pixel height). The view sets the canvas's pixel size itself: CSS size × `devicePixelRatio`, but never more pixels than the tile's native resolution. It follows a change of `devicePixelRatio` too, for example when you move the window to a monitor with another scale.
* `maxFps` caps redraws; the default is 15 and the range is 1 to 60. A view never draws faster than frames arrive.
* `fit` is `contain` (letterbox, the default) or `cover` (crop). The tile's aspect ratio is always kept.
* You can attach any number of views of the same camera and channel, on one screen or several.
* A view follows its server across reconnects and calibration changes. Attach once per mounted canvas.
* Disposing the pipeline closes its views.

On a screen with tile views but no 3D view, call `runtime.setSceneDrawing(false)`. Frames keep arriving and the tiles stay live, but the 3D scene is no longer drawn. The render loop keeps running on demand, so released GPU memory is still freed. The call is ignored while a WebXR session presents. Call `setSceneDrawing(true)` when the 3D view is shown again.

## View states [#view-states]

| `state.kind`  | `reason`              | Meaning                                                                                                                                                                      |
| ------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `live`        |                       | Showing a frame. `tileWidth` and `tileHeight` give the tile's native size.                                                                                                   |
| `waiting`     | `not-connected`       | The server isn't connected.                                                                                                                                                  |
| `waiting`     | `no-frame`            | Connected, but no frame of this camera has arrived yet.                                                                                                                      |
| `waiting`     | `hidden`              | The last frame can't be shown: a calibration change, a failed upload or a lost GPU device. The view goes live again with the next frame.                                     |
| `unavailable` | `unknown-camera`      | The server's snapshot has no such camera.                                                                                                                                    |
| `unavailable` | `bundle-incompatible` | This client can't render the camera's stream, for example because it has too many tiles.                                                                                     |
| `unavailable` | `unsupported-engine`  | No WebGPU. In this version, tile views need WebGPU; the WebGL2 fallback has none.                                                                                            |
| `unavailable` | `canvas-in-use`       | The canvas already has another context, or another view uses it.                                                                                                             |
| `unavailable` | `gpu-setup-failed`    | The canvas couldn't be configured on the GPU device, or the tile couldn't be bound. A warning is logged (`[tile views]`). The view retries after the GPU device is restored. |
| `unavailable` | `closed`              | `close()` was called or the server entry was removed. This state is final.                                                                                                   |

`onStateChange` fires only when the kind, the reason or the tile size changes, never once per frame. `view.frameSetNumber` gives the frame set on screen; read it when you need it.

## Depth colours [#depth-colours]

Depth codes go through the server's transmitted lookup table. The colours are fixed:

| Code       | Meaning                                  | Colour                                         |
| ---------- | ---------------------------------------- | ---------------------------------------------- |
| 0          | Invalid, or outside the foreground mask  | black `#000000`                                |
| above 1023 | Malformed sample, shown as invalid       | black `#000000`                                |
| 1          | Nearer than the profile's minimum depth  | blue `#2659FF`                                 |
| 2 to 1022  | Valid depth                              | grey, from `#F2F2F2` (near) to `#404040` (far) |
| 1023       | Farther than the profile's maximum depth | red `#FF401A`                                  |

The grey ramp is linear in millimetres. Its ends are the table entries for codes 2 and 1022, which are the profile's minimum and maximum depth. Label a legend with those two values. With an adaptive profile, equal code steps aren't equal grey steps. Blue and red are the same colours that the 3D view's debug mode uses.

## Draw overlays on a tile [#draw-overlays-on-a-tile]

`view.content` is `null` while the view isn't live. When live, it holds `tileWidth`, `tileHeight` and `rect`: the tile's rectangle in the canvas's CSS pixels after `contain` or `cover`. With `cover`, the rectangle extends past the canvas. `onContentChange` fires when the canvas is resized, `fit` changes, the tile size changes, or the view goes live or stops being live.

To place an overlay on a tile pixel, use `tileToCss`, exported from `client/src/rendering/tileViews.ts`:

```ts
const content = view.content;
if (content !== null) {
  const { x, y } = tileToCss(content, u, v); // CSS pixels from the canvas's top-left corner
}
```

`(u, v)` are tile-relative logical pixels: the origin is at the top left, `v` grows downward, and a pixel's centre is at its integer coordinate. Pixel `(0, 0)` covers `-0.5` to `0.5` on each axis. This follows the client's interim convention, pending protocol change 0011.

## Check tile views in a browser [#check-tile-views-in-a-browser]

The render check draws a colour and a depth tile for each of its two synthetic cameras:

```
http://localhost:5173/dev/render-check.html?autorun=1&engine=webgpu&tiles=1&readback=1
```

After the run, the check reads every tile back from the GPU and compares each pixel with the expected colour. This covers the depth sentinels, both ends of the grey ramp and a malformed sample. Then it checks that one idle second has no tile draw and no GPU submit. The result is in `window.__renderCheckReport.tiles`. With `engine=webgl2` the check ends `failed` with “tile views unsupported here: webgl2”, as expected.

For performance, the perf harness has two scenarios on synthetic media: `mock-media-8srv-webgpu` and `mock-media-8srv-webgpu-tiles16`, which adds 16 views at 15 fps. Run them with `node perf/run.mjs <checkout> <port> --only mock-media-8srv` in `client/scripts/qa`. The tile metrics are under `tiles` in each run's JSON.

## Troubleshooting [#troubleshooting]

* **The view stays `waiting` with `no-frame`.** No frame of this camera has arrived. Check that the server streams and that this browser can decode its video. Headless Chromium can't decode HEVC, so only the synthetic pages show frames there.
* **`unavailable` with `canvas-in-use`.** Give each view its own new canvas. A canvas that has had a `2d` or `webgl` context can't be used for a tile.
* **`unavailable` with `unsupported-engine`.** The browser runs the WebGL2 fallback, or there is no 3D view at all. Use a browser with WebGPU.
