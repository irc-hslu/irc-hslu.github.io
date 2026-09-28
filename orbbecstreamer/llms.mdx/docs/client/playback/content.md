# Play back .hevc recordings (https://irc-hslu.github.io/orbbecstreamer/docs/client/playback)





## What it is [#what-it-is]

A recording is three files:

* a colour `.hevc` file;
* a depth `.hevc` file;
* a recording manifest (`.json`) that describes the camera, the depth range
  and the frame rate.

The client plays a recording through its normal pipeline: connection,
keyframe gating, WebCodecs decoding, colour/depth pairing and point-cloud
rendering. A simulated server inside the browser stands in for a capture
server, so no server and no camera are needed.

What the simulated server does:

* It sends one colour frame and one depth frame per tick, at the manifest's
  `frameRate`. The `.hevc` files have no timing of their own.
* Frame *n* of the colour file is paired with frame *n* of the depth file.
* With `"loop": true` it starts again at the first frame after the last one.
  With `"loop": false` it stops after the last frame.
* A recording has no setup to change. Lock, calibration and placement
  requests are refused with the code `unsupported-by-file-source`.

## File requirements [#file-requirements]

The client checks all of these when you open the recording. The exact
messages are listed under Troubleshooting.

Both `.hevc` files:

* are raw H.265 Annex-B streams, where NAL units are separated by
  `00 00 01` or `00 00 00 01` start codes. MP4, MKV and other containers are
  not accepted;
* start with a keyframe (an IDR, CRA or BLA picture) that carries the VPS,
  SPS and PPS;
* carry the VPS, SPS and PPS again in every keyframe;
* keep one format for the whole file: the SPS never changes the picture
  size, profile, level or bit depth;
* use the HEVC Main or Main10 profile;
* contain only whole pictures: the file does not start in the middle of a
  picture and does not end with parameter sets alone.

The pair of files:

* has the same number of frames (access units) in colour and in depth;
* has keyframes at the same frame positions in colour and in depth.

The depth file:

* is Main10, with 10-bit luma and 4:2:0 chroma. Each depth pixel is a 10-bit
  code that the client turns into millimetres with the manifest's lookup
  table.

Frame size:

* The coded size comes from the SPS. By default the usable (logical) region
  is the SPS conformance window, which is the whole picture when the encoder
  did not crop.
* Each camera tile must fit inside that region.
* Each camera's tile must have the size given by its `depthIntrinsics` width
  and height.
* Colour and depth tiles of a camera must have the same size.

Use no B-frames. With B-frames the keyframe check failed in our tests. The
files must also be small enough to hold in memory: the browser reads both
files whole.

## How to do it [#how-to-do-it]

### 1. Get two compatible files [#1-get-two-compatible-files]

Use a colour and a depth recording that meet the requirements above.

To try the feature without a recording, generate a synthetic pair of test
patterns with FFmpeg and libx265 (tested with FFmpeg 8 and Node 24). The
"depth" file here is a colour test pattern encoded as Main10, so the point
cloud it produces is meaningless. It only shows that playback works.

```bash
mkdir -p ~/recording && cd ~/recording
ffmpeg -y -f lavfi -i testsrc2=size=640x576:rate=30 -frames:v 90 \
  -c:v libx265 -pix_fmt yuv420p \
  -x265-params "keyint=30:min-keyint=30:scenecut=0:bframes=0:repeat-headers=1" \
  colour.hevc
ffmpeg -y -f lavfi -i testsrc2=size=640x576:rate=30 -frames:v 90 \
  -c:v libx265 -pix_fmt yuv420p10le \
  -x265-params "keyint=30:min-keyint=30:scenecut=0:bframes=0:repeat-headers=1" \
  depth.hevc
```

What the options do:

* `keyint=30:min-keyint=30:scenecut=0` puts a keyframe at exactly every
  30th frame in both files, so the keyframes line up.
* `bframes=0` turns off B-frames.
* `repeat-headers=1` puts the VPS, SPS and PPS in every keyframe.
* `yuv420p10le` makes the depth file Main10 with 10-bit 4:2:0.

### 2. Write the manifest [#2-write-the-manifest]

The manifest includes a depth lookup table with exactly 1024 entries, so the
easiest way to write it is with a script. Save this as `make-manifest.mjs`
in the same folder.

It describes one 640x576 camera. Replace the camera values with your own
where needed:

* `depthIntrinsics` (`fx`, `fy`, `cx`, `cy`);
* `MIN_MM` and `MAX_MM`;
* `frameRate`.

```js
// Writes manifest.json for one camera recorded as colour.hevc + depth.hevc.
import { writeFileSync } from 'node:fs';

const MIN_MM = 300;   // depth range of the recording, in millimetres
const MAX_MM = 5000;

// Linear depth LUT: 1024 entries, code 0 = 0, codes 1 and 2 = MIN_MM,
// codes 2..1022 rise from MIN_MM to MAX_MM, code 1023 = MAX_MM.
const lut = new Array(1024).fill(0);
for (let code = 2; code <= 1022; code += 1) {
  lut[code] = MIN_MM + Math.floor(((MAX_MM - MIN_MM) * (code - 2) + 510) / 1020);
}
lut[1] = MIN_MM;
lut[1023] = MAX_MM;

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const manifest = {
  serverId: 'recorded-rig',
  serverName: 'Recorded rig',
  streamLayout: 'per-camera',
  frameRate: 30,
  loop: true,
  startCaptureTimeUs: 0,
  cameras: [
    {
      cameraId: 'cam0',
      label: 'Camera 0',
      depthIntrinsics: { width: 640, height: 576, fx: 504.3, fy: 504.4, cx: 320, cy: 288 },
      serverFromDepthCamera: identity,
      connected: true,
    },
  ],
  quantization: {
    revision: 1,
    kind: 'linear',
    minimumDepthMm: MIN_MM,
    maximumDepthMm: MAX_MM,
    adaptiveUniformMix: 0,
    calibrationStats: null,
    invalidCode: 0,
    belowMinimumCode: 1,
    firstValidCode: 2,
    lastValidCode: 1022,
    aboveMaximumCode: 1023,
    reconstructionLutMm: lut,
  },
  placement: { anchorId: 'origin', anchorFromServer: identity, revision: 1 },
  calibrationRevision: 1,
  metadataRevision: 1,
  bundles: [
    {
      bundleId: 'bundle-cam0',
      cameraIds: ['cam0'],
      tiles: [{ cameraId: 'cam0', x: 0, y: 0, width: 640, height: 576 }],
      color: { file: 'colour.hevc' },
      depth: { file: 'depth.hevc' },
    },
  ],
};

writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote manifest.json');
```

Run it:

```bash
cd ~/recording
node make-manifest.mjs
```

It prints `wrote manifest.json`.

Manifest fields:

| Field                                     | Meaning                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `serverId`, `serverName`                  | Identity of the simulated server. The server card is titled with `serverName`. Two open recordings with the same `serverId` conflict.                                                                                                                                                      |
| `streamLayout`                            | `per-camera` (one bundle per camera) or `concatenated` (exactly one bundle whose picture holds every camera as a tile).                                                                                                                                                                    |
| `frameRate`                               | Frames per second on both channels, above 0 and at most 1000.                                                                                                                                                                                                                              |
| `loop`                                    | `true`: restart at the first frame. `false`: stop after the last frame.                                                                                                                                                                                                                    |
| `startCaptureTimeUs`                      | Capture timestamp of the first frame, in microseconds. A number, or a decimal string. At most 2^53 − 1.                                                                                                                                                                                    |
| `cameras`                                 | Camera geometry, one entry per camera: `cameraId`, `label`, `depthIntrinsics` (`width`, `height`, `fx`, `fy`, `cx`, `cy` in pixels), `serverFromDepthCamera` (a rigid 4×4 matrix, 16 numbers, column-major), `connected`.                                                                  |
| `quantization`                            | The depth profile: range in millimetres, the fixed codes 0/1/2/1022/1023, and `reconstructionLutMm`, 1024 millimetre values. Entry 0 must be 0, entries 1 and 2 must equal `minimumDepthMm`, entries 1022 and 1023 must equal `maximumDepthMm`, and entries 2 to 1022 must never decrease. |
| `placement`                               | `anchorId`, `anchorFromServer` (a rigid 4×4 matrix) and `revision`.                                                                                                                                                                                                                        |
| `calibrationRevision`, `metadataRevision` | Non-negative integers. Any value works for a recording.                                                                                                                                                                                                                                    |
| `bundles`                                 | One entry per bundle: `bundleId`, `cameraIds`, `tiles` (`cameraId`, `x`, `y`, `width`, `height`, relative to the logical region), and `color` / `depth`, each `{ "file": "<key>" }`, optionally with `"logical": { "x", "y", "width", "height" }` to override the logical region.          |

The `file` values are keys, not paths. When you open the recording, the
colour file you pick is used for the `color.file` key and the depth file for
the `depth.file` key, whatever the picked files are called. The "Open
recording" form opens exactly one colour and one depth file, so every bundle
must name the same `color.file`, every bundle the same `depth.file`, and the
two keys must differ.

### 3. Open it in the client [#3-open-it-in-the-client]

1. Start the client:

   ```bash
   # working directory: the repository root
   cd client
   npm run dev
   ```

2. Open [http://localhost:5173](http://localhost:5173) in a browser that can decode HEVC (see
   Troubleshooting).

3. In the side panel, under **Open recording**, choose the files:
   * **Colour .hevc**: `colour.hevc`
   * **Depth .hevc (Main10)**: `depth.hevc`
   * **Manifest .json**: `manifest.json`

4. Select **Play recording**.

The form checks the manifest first; the `.hevc` files are read only if it is
valid. The bitstream checks run next, and any problem they find appears on
the new server card.

<img alt="The Open recording form in the side panel: file pickers for the colour .hevc file, the depth .hevc file and the manifest, and a Play recording button" src="__img0" />

## Expected result [#expected-result]

A new server card appears under **Servers** (see
[Read the server card](/docs/client/server-card)):

* the status label reads `streaming`;
* the title is the manifest's `serverName` (`Recorded rig`);
* the next line reads
  `serverId: recorded-rig · recording file://recorded-rig`;
* the layout has one row per bundle, for example
  `bundle-cam0: 1 camera, available; ready, drawing` once frames reach the
  renderer (`ready, no frame yet` before that);
* `decoded pairs` and `uploaded` keep increasing while the recording plays.

The point cloud should appear in the viewport. The whole pipeline is built
and tested, but decoding has not yet been checked in a real desktop browser
with HEVC support. That check is tracked in
`client/docs/development/ROADMAP.md` (Phase 2, "Check with real decoded HEVC frames in a browser").

With `"loop": true` it loops
forever. With `"loop": false`, frames stop after the last one and the card
stays connected. Select **Remove** to close it. A recording never
reconnects by itself. To replay it, select **Remove** on its card, then
open it again.

## Troubleshooting [#troubleshooting]

### Nothing decodes (`decoded pairs` stays 0) [#nothing-decodes-decoded-pairs-stays-0]

The browser cannot decode HEVC. This is a known limitation of some browsers
and platforms, and the client then works for control and setup only. You
see one of these:

* on the card: `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`;
* at the top of the panel: `decoders: WebCodecs VideoDecoder is unavailable: control and setup only (§16).`

Use a browser that can decode HEVC and HEVC Main10, usually through GPU
video decoding. In our one test so far, headless Chromium on Linux could
decode neither.

### Messages under the Open recording form [#messages-under-the-open-recording-form]

| Message                                                                                                                             | Cause and fix                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `choose the colour .hevc file` (or depth, or `choose the recording manifest (.json)`)                                               | A file was not picked. Pick all three.                                                           |
| `manifest is not JSON: …`                                                                                                           | The manifest file is not valid JSON. Regenerate it with the script.                              |
| `manifest: <field>: <problem>`, for example `manifest: placement: Required` or `manifest: frameRate: Number must be greater than 0` | A manifest field is missing or has the wrong type or range. See the field table.                 |
| `manifest names 2 colour files; this form opens exactly one` (or depth)                                                             | Bundles name different files. Give every bundle the same `color.file` and the same `depth.file`. |
| `manifest uses '<key>' for both colour and depth`                                                                                   | `color.file` and `depth.file` are equal. Use two different keys.                                 |
| `colour file '<name>' is empty` (or depth)                                                                                          | The picked file has 0 bytes.                                                                     |
| `could not read the files: …`                                                                                                       | The browser could not read a picked file. Pick it again.                                         |

### Messages on the card [#messages-on-the-card]

When the bitstream checks fail, the card shows status `error`, the title
`file://invalid-recording`, and the problems as a list. Nothing plays.

| Message                                                                                                                                        | Cause and fix                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundle '<id>' color: malformed Annex-B (no-start-code) …`                                                                                     | The file is not a raw Annex-B stream, for example an MP4. Extract the raw stream, for example `ffmpeg -i in.mp4 -c:v copy -bsf:v hevc_mp4toannexb out.hevc`.                                             |
| `… malformed Annex-B (leading-garbage) …`                                                                                                      | Bytes before the first start code. The file is not raw Annex-B, or it is cut at the start.                                                                                                               |
| `… malformed Annex-B (truncated-nal-header / forbidden-zero-bit / invalid-temporal-id / truncated-slice-header) …`                             | Corrupt or truncated NAL units. Re-encode or re-export the file.                                                                                                                                         |
| `… malformed Annex-B (access-unit-without-picture) …`                                                                                          | A group of NAL units has no picture, for example parameter sets at the very end. Re-export the file.                                                                                                     |
| `… malformed Annex-B (missing-first-slice) …`                                                                                                  | The file starts in the middle of a picture. Cut it at a picture boundary.                                                                                                                                |
| `… access unit 0 must be a keyframe carrying VPS, SPS and PPS`                                                                                 | The file does not start with a keyframe that carries the parameter sets. Cut it at a keyframe, or re-encode.                                                                                             |
| `… keyframe access unit <n> does not carry VPS, SPS and PPS`                                                                                   | A later keyframe lacks the parameter sets. Encode with the parameter sets repeated (x265: `repeat-headers=1`).                                                                                           |
| `… access unit <n>: SPS: …`                                                                                                                    | The SPS cannot be read. The file is corrupt or uses syntax the client does not parse.                                                                                                                    |
| `… HEVC profile_idc <n> is neither Main nor Main10`                                                                                            | Another HEVC profile, such as 4:4:4 or 12-bit. Re-encode as Main (colour) or Main10 (depth).                                                                                                             |
| `… the SPS in access unit <n> changes the stream format`                                                                                       | The size, profile, level or bit depth changes mid-file. Split the file there, or re-encode.                                                                                                              |
| `bundle '<id>': colour has <a> access units, depth has <b>; a frame set needs one of each`                                                     | The two files have different frame counts. Trim them to the same frames.                                                                                                                                 |
| `bundle '<id>': keyframes are not aligned at access unit <n> …`                                                                                | Keyframes are at different positions in the two files. Encode both with the same fixed keyframe interval, no scene-cut keyframes and no B-frames (x265: `keyint=30:min-keyint=30:scenecut=0:bframes=0`). |
| `snapshot: bundle '<id>' depth bitstream has 8-bit luma, §8 needs 10` together with `snapshot: depth channel must use HEVC Main10, got 'main'` | The depth file is 8-bit Main, or the colour and depth files were picked the other way round.                                                                                                             |
| `snapshot: … depth bitstream has chroma_format_idc <n>, expected 4:2:0`                                                                        | Depth must be 4:2:0. Re-encode with `yuv420p10le`.                                                                                                                                                       |
| `snapshot: Camera '<id>' depth tile is <w>x<h> but its intrinsics declare <w>x<h>`                                                             | The tile size and the camera's `depthIntrinsics` size differ. Make them equal.                                                                                                                           |
| `snapshot: … tile 0 (camera '<id>') extends past the <w>x<h> logical image`                                                                    | A tile does not fit the picture. Check the tile and the picture size.                                                                                                                                    |
| `snapshot: Per-camera … tile for '<id>' must cover the full logical image`                                                                     | With `per-camera`, the single tile must be the whole picture.                                                                                                                                            |
| `snapshot: Per-camera layout must expose one bundle per camera …` or `snapshot: Concatenated layout must expose exactly one bundle …`          | The bundle count does not fit `streamLayout`.                                                                                                                                                            |
| `snapshot: quantization: …`                                                                                                                    | The depth lookup table breaks a rule (see `quantization` in the field table). Regenerate it with the script.                                                                                             |
| `startCaptureTimeUs … cannot be sent in control JSON`                                                                                          | Use a value of at most 9007199254740991.                                                                                                                                                                 |

### Other problems [#other-problems]

* **`conflict: server <serverId> is already rendered by …`**: the same
  recording, or another source with the same `serverId`, is already open.
  Remove the other card, or give the manifest a different `serverId`.
* **Playback runs too fast or too slow**: `frameRate` in the manifest sets
  the speed. Set it to the rate the files were recorded at.
