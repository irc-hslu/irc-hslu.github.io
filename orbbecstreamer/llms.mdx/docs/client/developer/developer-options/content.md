# Developer options (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/developer-options)



These options have no control in the client UI. A developer sets them in code, and some through the render check’s query parameters. The app uses the defaults below. For the controls users can change, see [What you can tweak](/docs/client/what-you-can-tweak).

## Point settings [#point-settings]

`RenderSettings`, passed as `settings` in `PointCloudRendererOptions` or changed with `PointCloudRenderer.setSettings` (`client/src/rendering/pointCloudRenderer.ts`, ranges in `client/src/rendering/splats.ts`). They apply to WebGPU and WebGL2. The render check takes the query parameter in brackets; see [Test the client](/docs/client/developer/test-the-client).

| Setting                          | Default  | Range             | Meaning                                                                                             |
| -------------------------------- | -------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `pointSize` (`pointSize`)        | 2        | 1 or more         | Dot size in framebuffer pixels, in screen mode. On a display scaled to 200 %, 2 pixels look like 1. |
| `pointSizeMode` (`sizeMode`)     | `screen` | `screen`, `world` | `world` sizes each dot by its depth pixel’s footprint.                                              |
| `worldPointScale` (`worldScale`) | 1.5      | 0 or more         | Scale of the footprint in world mode                                                                |
| `maxPointSize` (`maxSize`)       | 16       | 1 or more         | Largest dot in world mode, in framebuffer pixels                                                    |
| `splatShape` (`shape`)           | `square` | `square`, `round` | Dot shape                                                                                           |
| `debugView` (`debug=1`)          | `false`  |                   | Draws below-range codes blue and above-range codes red                                              |

The blend settings are in the same object; the app exposes them in its **View** section.

## Renderer options [#renderer-options]

`PointCloudRendererOptions`, fixed when the renderer is created:

| Option                  | Default     | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`                | `auto`      | `auto` picks WebGPU when an adapter exists, else WebGL2. `webgpu` or `webgl2` forces one.                                                                                                                                                                                                                                                                                                                                                         |
| `renderMode`            | `on-demand` | `on-demand` draws only when something changed. `continuous` draws every animation frame.                                                                                                                                                                                                                                                                                                                                                          |
| `parkWhenIdle`          | `true`      | With `on-demand`, the render loop stops after one animation frame without a draw and restarts on the next change or camera input. An idle view then costs no animation frames and no GPU submissions. Never stops in WebXR or with `continuous`. A host that moves the camera from code calls `requestRender()`.                                                                                                                                  |
| `computePoints`         | `true`      | The WebGPU compute path, which blending needs. `false` keeps plain dots. Ignored with WebGL2.                                                                                                                                                                                                                                                                                                                                                     |
| `webgl2Blend`           | `'auto'`    | Blending on WebGL2, with the same formulas as WebGPU, while `blend` is on. `'auto'`: on where the GPU can do it, with the checks and the automatic fallback below. `true`: always on, no checks (tests, the render check). `false`: plain dots. Needs 16-bit float render targets; desktop only (WebXR keeps plain dots). `stats().webgl2Blend` and `stats().drawPathNote` say whether it draws and why. See [WebGL2 blending](#webgl2-blending). |
| `antialias`             | `false`     | Multisample antialiasing                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `desynchronized`        | `true`      | Low-latency WebGL2 canvas, which may tear                                                                                                                                                                                                                                                                                                                                                                                                         |
| `preserveDrawingBuffer` | `false`     | Keeps the drawing buffer for canvas readback, for dev pages and screenshots                                                                                                                                                                                                                                                                                                                                                                       |

### WebGL2 blending [#webgl2-blending]

With `webgl2Blend`, WebGL2 views look like WebGPU's blended view, and `drawPath` reads `webgl2-blend`. On the lab machine the render check's synthetic scenes match WebGPU on at least 99.8 % of the compared pixels, within 3/255, mean colour difference (CIEDE2000) at most 0.02.

With `'auto'`, the renderer decides when to blend:

| Case                                                                                                        | What happens                                                 | `drawPathNote`                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| No 16-bit float render targets (`EXT_color_buffer_float` or `EXT_color_buffer_half_float`)                  | Plain dots, for good                                         | `16-bit float targets unavailable`                                                                                                 |
| The browser names a software renderer (SwiftShader, llvmpipe)                                               | Plain dots until the user forces blending                    | `SwiftShader: blending off by default` (others: `software renderer: blending off by default`)                                      |
| The browser hides the renderer name (no `WEBGL_debug_renderer_info`, or a generic name such as `Apple GPU`) | Blending stays on only if the start-up check passes          | `checking the blending cost`, then nothing, or the reason it went off; each with `; pass timing unavailable` without a timer query |
| A named GPU                                                                                                 | Blending on                                                  | nothing, or `pass timing unavailable` without a timer query                                                                        |
| The blending passes take more than 40 % of the frame time for 2 s                                           | Plain dots until **Blend** is switched off and on, or forced | `blending off: over 40 % of the frame budget (… of … ms)`                                                                          |
| A render target can't be drawn into                                                                         | Plain dots, for good                                         | e.g. `R16UI weight target incomplete (status 0x8cdd): blending off`                                                                |
| WebXR                                                                                                       | Plain dots (blending in XR comes later)                      | `XR draws the nearest point (no blending in XR yet)`                                                                               |

How it measures:

* **Timer query** (`EXT_disjoint_timer_query_webgl2`, Chrome on the desktop): the GPU time of each blending pass, sampled one frame at a time and never waited on. `stats().webgl2Blend.passMs` holds the recent medians per pass (`weight`, `visibility`, `accumulation`, `resolve`, `total`).
* **Start-up check**, without a timer query (Quest, Safari) or with a hidden renderer name: about 1 s with blending, then 1 s with plain dots (each from its first counted frame, and at least 12 drawn frames), comparing the time between animation frames. It runs only while the view draws anyway, and never stalls the GPU. It only sees frames that miss the display refresh, so `drawPathNote` says `pass timing unavailable`.
* The frame budget is the display's frame time, but at least 1/60 s (and at most 1/30 s): on a 144 Hz screen the limit stays 6.7 ms, not 2.8 ms. The frame time is estimated from animation frames that drew nothing (1/60 s until known). Babylon's own GPU frame-time capture (Inspector) pauses the timing.
* Known limit: when fewer than 2 frames per second are drawn, neither the fallback nor the start-up check can decide; blending stays as it is.

`forceWebgl2Blend()` (the **Blend anyway** button in the **View** section) turns blending on until the page reloads, past the SwiftShader default and the fallback. A render target that reads incomplete for one frame (Chrome does this for a fresh R16UI target in about half the runs) draws plain dots for that frame and is checked again; only after 3 frames does blending go off.

Measured cost (synthetic scenes, NVIDIA RTX 4090 only, Chrome for Testing 155, 2026-10-18, `perf/run.mjs` 3 runs, medians; an unrelated background job was present but idle): The GPU was mostly at its idle clock (P8, 210 MHz) during these runs, so these numbers likely overstate the cost on this card; a re-measurement with the clocks held up is planned.

* 1 or 2 cameras (640×576): 1.3 or 2.1 ms GPU per frame, no frame-rate change.
* 4 cameras: 3.4 ms GPU per frame, about 14 % fewer frames per second (50 to 43).
* 8 cameras at 1920×576: 16.8 ms GPU per frame, over the 6.7 ms limit at 60 Hz: `'auto'` falls back to nearest after 2 s. Weaker GPUs are expected to fall back with fewer cameras (not measured).
* `forceWebgl2Blend()` (**Blend anyway**) forces it on.
* Three mock servers with media ran faster with blending (23.3 against 19.8 fps). That is unexplained, probably decode-bound variance, not a speed-up from blending.

Two differences from WebGPU remain:

* **Border band.** WebGL2 drops a dot whose centre is just outside the view, where WebGPU clips it pixel by pixel. So a band up to half a dot wide at the edge of the view can differ: 1 pixel at the default 2-pixel dots, up to 32 pixels at the largest 64-pixel dots. The same happens at the camera's near plane, 1 cm in front of the camera.
* **Scene depth.** As on WebGPU, the blended cloud does not hide the grid or the placement gizmo behind it. With plain WebGL2 dots it does.

To compare it with WebGPU yourself, see the render check's `blend=webgl2` in [Test the client](/docs/client/developer/test-the-client).

## Connection timing [#connection-timing]

`ServerConnectionOptions.timing` (`client/src/connections/serverConnection.ts`).

### Reconnect policy [#reconnect-policy]

`DEFAULT_RECONNECT_POLICY`, in `timing.reconnect`:

| Option            | Default | Meaning                                                                                             |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `enabled`         | `true`  | Reconnect after a session ends, except after a local close or a protocol version mismatch           |
| `initialDelayUs`  | 1 s     | Wait before the first attempt                                                                       |
| `backoffFactor`   | 2       | Each further attempt waits this many times longer                                                   |
| `maxDelayUs`      | 30 s    | Longest wait                                                                                        |
| `maxAttempts`     | `null`  | Failed attempts before giving up; `null` never gives up                                             |
| `jitter`          | 0.5     | Each wait is drawn uniformly from `(1 − jitter)` to 1 times the nominal wait, here 50 to 100 %      |
| `stableSessionUs` | 10 s    | A session must stay up this long after its hello before its end resets the wait to `initialDelayUs` |

A session that ends sooner than `stableSessionUs` after its hello counts as another failed attempt, so a server that drops every session at once is retried ever more slowly. `ServerConnectionOptions.random` replaces `Math.random` for the jitter in tests. While a retry waits, the card shows `reconnect scheduled`; [Reconnect](/docs/client/server-card#what-each-button-does) skips the wait.

### Timeouts [#timeouts]

`DEFAULT_SERVER_CONNECTION_TIMING`:

| Option                      | Default | Meaning                                                                                                                                                                     |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connectDeadlineUs`         | 10 s    | Capability probe, session open and hello exchange. The card shows `connect timeout`.                                                                                        |
| `requestTimeoutUs`          | 10 s    | A request answered by `server.ack` or `server.error`. The card shows `failed (timeout)`.                                                                                    |
| `snapshotRequestTimeoutUs`  | 10 s    | A `client.snapshot.request`                                                                                                                                                 |
| `mediaHeaderDeadlineUs`     | 5 s     | How long media stream headers may stay incomplete before the session closes                                                                                                 |
| `mediaHeaderPollUs`         | 0.25 s  | How often that condition is checked. The check runs only while a header is pending or a channel is held, so an idle session sets no timer for it.                           |
| `sessionCloseGraceUs`       | 0.25 s  | After a fatal transport error, how long to wait for the session’s own close                                                                                                 |
| `ownPlacementResultGraceUs` | 5 s     | After an accepted placement commit, how long a placement update counts as this client’s own result (interim, see [Contract gaps](/docs/client/developer/interim-behaviour)) |

`validateTiming` rejects zero or negative timeouts, a `maxDelayUs` below `initialDelayUs`, and a `jitter` outside 0 to 1.

## Fixed timing [#fixed-timing]

These are constants, not options:

| Constant                        | Value | File                                     | Meaning                                                     |
| ------------------------------- | ----- | ---------------------------------------- | ----------------------------------------------------------- |
| `LOCK_HEARTBEAT_INTERVAL_US`    | 5 s   | `client/src/state/setupLock.ts`          | The lock holder renews the setup lock this often            |
| `LOCK_EXPIRY_US`                | 15 s  | `client/src/state/setupLock.ts`          | A lock runs out this long after its last renewal            |
| `PING_INTERVAL_US`              | 10 s  | `client/src/connections/clockSync.ts`    | Clock-sync ping interval, for the card’s `min RTT`          |
| `PING_TIMEOUT_US`               | 5 s   | `client/src/connections/clockSync.ts`    | A pong later than this is ignored                           |
| `PROGRESS_ANNOUNCE_INTERVAL_MS` | 5 s   | `client/src/calibration/announcement.ts` | Screen readers hear calibration progress at most this often |
