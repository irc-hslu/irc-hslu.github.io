# Placement check (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/placement-check)



The placement check (`client/dev/placement-check.html`, code in `client/src/dev/placementCheck.tsx` and `client/src/dev/placementScenario.ts`) is a dev-only page for [placement editing](/docs/client/placement-editing) and [world anchors](/docs/client/world-anchors). It is never part of the production build.

It runs two clients of one [mock server](/docs/client/developer/mock-server):

* **Client A** has a 3D view (WebGPU or WebGL2; none if neither starts) and decodes with WebCodecs when the browser can.
* **Client B** has no 3D view.

Both use the app’s own setup workspace, server cards and World anchors section. The mock serves the sample recordings when `client/reference/hevc-web/` exists; they aren’t published, so otherwise it is snapshot-only.

“Where a client draws the server” is read from its renderer, so the checks work with or without media. With media and HEVC decoding, A’s cloud visibly moves in the 3D view.

## Run the check [#run-the-check]

Start the dev server in `client/`:

```bash
npm run dev
```

Open this URL:

```text
http://localhost:5173/dev/placement-check.html?autorun=1
```

Without `autorun=1`, press **Run scenario** once the columns appear.

The scenario, in order:

1. Both clients connect at the same placement revision.
2. A enters setup. The Placement section shows the server placement, and **Edit** is available.
3. A starts a draft and types a pose (x 0.5 m, z 1 m, yaw 30°). The draft is dirty, A draws the server at the draft, B does not move, and the mock still has the old revision after a wait.
4. A selects **Commit placement (expected revision 1)**. A and B get revision 2 and both draw the committed placement; A’s draft is cleared.
5. B starts its own draft without the lock. A commits another edit (revision 3) and leaves setup. B enters setup: its draft is kept, marked stale, and **Commit placement** is unavailable with the stale reason. Pressing it anyway sends nothing.
6. B selects **Rebase on server placement (revision 3)**, which keeps its pose, and commits. A and B get revision 4 and draw B’s pose.
7. A moves the world anchor (x 2 m, yaw 90°). Only A’s drawing moves; B and every revision stay the same. A scaled anchor pose is refused. **Reset** restores A’s drawing.
8. B leaves setup, and the lock is free.

## What you should see [#what-you-should-see]

* `body[data-state]` ends as `done`, and the log ends with `verdict: 8 steps passed`.
* `window.__placementCheckReport` holds the report: `state`, `media`, `renderer`, `steps[]` (`name`, `ok`, `detail`), `log`, `errors` and `verdict`. The same JSON is in the collapsed “report JSON” panel.
* Without HEVC decoding, the log starts with two `Subscribe to bundle-cam0 failed: not-decode-compatible` warnings. They are expected: the clients cannot decode the streams, so no frames are drawn, but the placement checks still pass.
* Recorded run, 2026-09-28, headless Chromium 153 on Linux, with:

  ```bash
  chromium --headless=new --no-sandbox --disable-gpu --use-angle=swiftshader \
    --enable-unsafe-swiftshader --virtual-time-budget=60000 --dump-dom \
    "http://localhost:5193/dev/placement-check.html?autorun=1"
  ```

  (dev server on port 5193 for that run). Result: `data-state="done"`, `verdict: 8 steps passed`, `errors` empty. A drew with WebGL2 (SwiftShader), the mock used the sample recording, and this browser had no HEVC decoding, so the checks ran on the renderer’s geometry and no frames were drawn. The page drives the editor’s controllers, not the mouse or keyboard, so it does not exercise dragging the 3D handle. That was verified separately with real mouse drags in headless Chromium 153: on 2026-09-28 with SwiftShader, and the same day on a real GPU (NVIDIA RTX 4090 through Vulkan), on WebGL2 and WebGPU each time. See [Test the client](/docs/client/developer/test-the-client#browsers-tested-so-far).

The same scenario runs in Node on a simulated clock as part of `npm test` (`client/src/tests/placementEditor.test.ts`).

## Fix check problems [#fix-check-problems]

* **`failed` with `timed out waiting for: …`**: the named step did not reach the expected state within 8 s. The text after it shows the placement revision A, B and the mock had at that moment.
* **`failed` with `watchdog: not done after 90 s`**: the run hung. Reload the page and check the browser console.
* **The 3D view stays empty**: the browser has no WebGPU or WebGL2, or no HEVC decoding. The scenario still passes; the report’s `renderer` field says which case applies.
* **The run fails after you clicked controls on the page**: the scenario expects to drive the workspaces itself. Reload and run it without clicking.

## Run headless on a real GPU [#run-headless-on-a-real-gpu]

On a Linux machine with an NVIDIA GPU, headless Chromium can render on the GPU through ANGLE and Vulkan instead of SwiftShader:

```bash
# WebGPU on the GPU (the app picks WebGPU when an adapter exists)
chromium --headless=new --use-angle=vulkan --enable-features=Vulkan \
  --ignore-gpu-blocklist --enable-unsafe-webgpu \
  --remote-debugging-port=9222 http://localhost:5173/dev/placement-check.html?autorun=1

# WebGL2 on the GPU (turn WebGPU off so the app falls back to WebGL2)
chromium --headless=new --use-angle=vulkan --enable-features=Vulkan \
  --ignore-gpu-blocklist --disable-gpu-compositing \
  --disable-features=WebGPU,WebGPUService \
  --remote-debugging-port=9222 http://localhost:5173/dev/placement-check.html?autorun=1
```

To check that the GPU is in use, read the renderer string from a WebGL2 context (`WEBGL_debug_renderer_info`): it names the GPU, for example `ANGLE (NVIDIA, Vulkan … NVIDIA GeForce RTX 4090)`, instead of `SwiftShader`.

Troubleshooting:

* **A DevTools screenshot of the canvas is black or blank**: headless page screenshots do not capture a GPU-composited canvas. For WebGL2, add `--disable-gpu-compositing`. For WebGPU, read the canvas back in the page instead of taking a page screenshot.
* **The header chip shows WebGPU although you wanted WebGL2**: WebGPU is available on the GPU even without `--enable-unsafe-webgpu`. Turn it off with `--disable-features=WebGPU,WebGPUService`.
