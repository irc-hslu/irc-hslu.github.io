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

| Option                  | Default     | Meaning                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`                | `auto`      | `auto` picks WebGPU when an adapter exists, else WebGL2. `webgpu` or `webgl2` forces one.                                                                                                                                                                                                                        |
| `renderMode`            | `on-demand` | `on-demand` draws only when something changed. `continuous` draws every animation frame.                                                                                                                                                                                                                         |
| `parkWhenIdle`          | `true`      | With `on-demand`, the render loop stops after one animation frame without a draw and restarts on the next change or camera input. An idle view then costs no animation frames and no GPU submissions. Never stops in WebXR or with `continuous`. A host that moves the camera from code calls `requestRender()`. |
| `computePoints`         | `true`      | The WebGPU compute path, which blending needs. `false` keeps plain dots. Ignored with WebGL2.                                                                                                                                                                                                                    |
| `antialias`             | `false`     | Multisample antialiasing                                                                                                                                                                                                                                                                                         |
| `desynchronized`        | `true`      | Low-latency WebGL2 canvas, which may tear                                                                                                                                                                                                                                                                        |
| `preserveDrawingBuffer` | `false`     | Keeps the drawing buffer for canvas readback, for dev pages and screenshots                                                                                                                                                                                                                                      |

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
