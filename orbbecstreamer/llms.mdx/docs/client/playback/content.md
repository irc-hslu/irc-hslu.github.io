# Play a recording (https://irc-hslu.github.io/orbbecstreamer/docs/client/playback)







A recording is a colour video, a depth video and a small description file, the manifest. The client plays it as if it came from a live server, through the same decoding and drawing steps. You don’t need a server or a camera.

The client plays one colour frame and one depth frame per tick, at the manifest’s `frameRate`. It pairs frame *n* of the colour file with frame *n* of the depth file. A recording has no setup to change: it refuses the setup lock, calibration and placement with the code `unsupported-by-file-source`.

## Make a test recording [#make-a-test-recording]

Skip this section if you already have a recording that meets the [file requirements](#file-requirements).

You need FFmpeg with the libx265 encoder, and Node.js. The team tested these commands with FFmpeg 8 and Node.js 24. The “depth” video here is a colour test pattern, so its point cloud is meaningless; it only shows that playback works.

1. Make a folder for the recording and create the two videos. Run this in any folder:

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

   The options put a keyframe at every 30th frame in both files, turn off B-frames, repeat the stream headers in every keyframe, and make the depth file 10-bit.

2. Save the following script as `make-manifest.mjs` in `~/recording`. It describes one 640×576 camera. For your own recording, change `depthIntrinsics`, `MIN_MM`, `MAX_MM` and `frameRate`.

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

   The script writes a depth lookup table with exactly 1024 entries, which is why a script is easier than writing the file by hand.

3. Run the script in `~/recording`:

   ```bash
   node make-manifest.mjs
   ```

   It prints `wrote manifest.json`.

## Open the recording [#open-the-recording]

1. Start the client and open it. See [Run the client](/docs/client/dev-build).
2. Under **Open recording**, choose the three files:
   * **Colour .hevc**: `colour.hevc`
   * **Depth .hevc (Main10)**: `depth.hevc`
   * **Manifest .json**: `manifest.json`
3. Select **Play recording**.

<img alt="The Open recording form with colour.hevc, depth.hevc and manifest.json chosen, and the Play recording button" src="__img0" />

The form checks the manifest first, then reads the videos. A problem with the manifest appears under the form; a problem with the videos appears on the new card.

## What you should see [#what-you-should-see]

A new card appears under **Servers**, titled with the manifest’s `serverName`:

* The status reads `streaming`.
* The next line reads `serverId: recorded-rig · recording file://recorded-rig`.
* The bundle row reads `bundle-cam0: 1 camera, available; ready, drawing` once frames reach the 3D view, and `ready, no frame yet` before that.
* **decoded pairs** and **uploaded** keep going up while the recording plays.

<img alt="The card for the test recording: status streaming, titled Recorded rig, the recording address, and the Setup and control only line, because the capture browser couldn’t decode HEVC, so decoded pairs stays at 0" src="__img1" />

The point cloud appears in the 3D view when your browser can decode HEVC. Nobody has confirmed this in any browser yet; see [Check your browser](/docs/client/browser-requirements).

With `"loop": true`, the recording plays forever. With `"loop": false`, frames stop after the last one and the card stays connected. A recording never reconnects by itself. To play it again, select **Remove** on its card, then open it again.

## File requirements [#file-requirements]

The client checks all of these when you open a recording.

Both videos must:

* be raw HEVC (H.265) streams, not MP4, MKV or another container
* start with a keyframe that carries the stream headers (VPS, SPS and PPS)
* carry the stream headers again in every keyframe
* keep one picture size, profile, level and bit depth for the whole file
* use the HEVC Main or Main10 profile
* contain only whole pictures, with no cut picture at the start and no headers alone at the end
* use no B-frames, which broke the keyframe check in our tests
* fit in memory, because the browser reads both files whole

The pair of videos must have the same number of frames, and keyframes at the same frame positions.

The depth video must be Main10: 10-bit, with 4:2:0 colour sampling. Each depth pixel is a 10-bit code that the client turns into millimetres with the manifest’s lookup table.

Each camera’s area of the picture, its tile, must fit inside the picture. It must have the width and height given by the camera’s `depthIntrinsics`, and the same size in colour and depth.

## Manifest fields [#manifest-fields]

The manifest is a JSON file with these fields:

| Field                                     | Meaning                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverId`, `serverName`                  | The recording’s identity. The card is titled with `serverName`. Two open recordings with the same `serverId` conflict.                                                                                                                                                                                |
| `streamLayout`                            | `per-camera`, one bundle per camera, or `concatenated`, exactly one bundle whose picture holds every camera as a tile.                                                                                                                                                                                |
| `frameRate`                               | Frames per second on both videos, above 0 and at most 1000.                                                                                                                                                                                                                                           |
| `loop`                                    | `true`: start again at the first frame. `false`: stop after the last frame.                                                                                                                                                                                                                           |
| `startCaptureTimeUs`                      | Capture time of the first frame, in microseconds. A number or a decimal string, at most 9007199254740991.                                                                                                                                                                                             |
| `cameras`                                 | One entry per camera: `cameraId`, `label`, `depthIntrinsics` (`width`, `height`, `fx`, `fy`, `cx`, `cy` in pixels), `serverFromDepthCamera` (a rigid 4×4 matrix, 16 numbers, column by column) and `connected`.                                                                                       |
| `quantization`                            | The depth profile: the range in millimetres, the fixed codes 0, 1, 2, 1022 and 1023, and `reconstructionLutMm`, 1024 millimetre values. Entry 0 must be 0, entries 1 and 2 must equal `minimumDepthMm`, entries 1022 and 1023 must equal `maximumDepthMm`, and entries 2 to 1022 must never decrease. |
| `placement`                               | `anchorId`, `anchorFromServer` (a rigid 4×4 matrix) and `revision`.                                                                                                                                                                                                                                   |
| `calibrationRevision`, `metadataRevision` | Whole numbers of 0 or more. Any value works for a recording.                                                                                                                                                                                                                                          |
| `bundles`                                 | One entry per bundle: `bundleId`, `cameraIds`, `tiles` (`cameraId`, `x`, `y`, `width`, `height`), and `color` and `depth`, each `{ "file": "<key>" }`. Each can add `"logical": { "x", "y", "width", "height" }` to use only part of the picture.                                                     |

The `file` values are names for the files, not paths. The colour file you choose is used for the `color.file` name and the depth file for the `depth.file` name, whatever your files are called. The form opens one colour and one depth file, so every bundle must name the same `color.file` and the same `depth.file`, and the two names must differ.

## Fix recording problems [#fix-recording-problems]

### Nothing decodes and `decoded pairs` stays at 0 [#nothing-decodes-and-decoded-pairs-stays-at-0]

Your browser can’t decode HEVC. The card shows `Setup and control only: this browser lacks HEVC colour decoding and HEVC Main10 depth decoding.`, or the top of the panel shows a line that starts with `decoders: WebCodecs VideoDecoder is unavailable`. Use a browser that can decode HEVC Main and Main10, usually through GPU video decoding. See [Check your browser](/docs/client/browser-requirements).

### Messages under the Open recording form [#messages-under-the-open-recording-form]

| Message                                                                                           | Fix                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `choose the colour .hevc file`, or the same for depth, or `choose the recording manifest (.json)` | Choose all three files.                                                                              |
| `manifest is not JSON: …`                                                                         | The manifest isn’t valid JSON. Make it again with the script.                                        |
| `manifest: <field>: <problem>`, for example `manifest: frameRate: Number must be greater than 0`  | A manifest field is missing or has the wrong type or range. See [Manifest fields](#manifest-fields). |
| `manifest names 2 colour files; this form opens exactly one`, or the same for depth               | Give every bundle the same `color.file` and the same `depth.file`.                                   |
| `manifest uses '<key>' for both colour and depth`                                                 | Use two different names for `color.file` and `depth.file`.                                           |
| `colour file '<name>' is empty`, or the same for depth                                            | The chosen file has 0 bytes.                                                                         |
| `could not read the files: …`                                                                     | The browser couldn’t read a chosen file. Choose it again.                                            |

### Messages on the card [#messages-on-the-card]

When the videos fail the checks, the card shows the status `error`, the title `file://invalid-recording`, and a list of problems. Nothing plays.

| Message                                                                                                                               | Fix                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundle '<id>' color: malformed Annex-B (no-start-code) …`                                                                            | The file isn’t a raw HEVC stream, for example an MP4. Extract the raw stream: `ffmpeg -i in.mp4 -c:v copy -bsf:v hevc_mp4toannexb out.hevc`.            |
| `… malformed Annex-B (leading-garbage) …`                                                                                             | The file has extra bytes at the start, or is cut at the start.                                                                                          |
| `… malformed Annex-B (truncated-nal-header)`, `(forbidden-zero-bit)`, `(invalid-temporal-id)` or `(truncated-slice-header) …`         | The file is damaged or cut. Encode or export it again.                                                                                                  |
| `… malformed Annex-B (access-unit-without-picture) …`                                                                                 | The file ends with headers and no picture. Export it again.                                                                                             |
| `… malformed Annex-B (missing-first-slice) …`                                                                                         | The file starts in the middle of a picture. Cut it at a picture boundary.                                                                               |
| `… access unit 0 must be a keyframe carrying VPS, SPS and PPS`                                                                        | The file doesn’t start with a keyframe that carries the stream headers. Cut it at a keyframe, or encode it again.                                       |
| `… keyframe access unit <n> does not carry VPS, SPS and PPS`                                                                          | A later keyframe lacks the stream headers. Encode with the headers repeated (x265: `repeat-headers=1`).                                                 |
| `… access unit <n>: SPS: …`                                                                                                           | The client can’t read the stream header. The file is damaged or uses syntax the client doesn’t read.                                                    |
| `… HEVC profile_idc <n> is neither Main nor Main10`                                                                                   | Encode colour as Main and depth as Main10.                                                                                                              |
| `… the SPS in access unit <n> changes the stream format`                                                                              | The picture size, profile, level or bit depth changes inside the file. Split the file there, or encode it again.                                        |
| `bundle '<id>': colour has <a> access units, depth has <b>; a frame set needs one of each`                                            | The two files have different frame counts. Trim them to the same frames.                                                                                |
| `bundle '<id>': keyframes are not aligned at access unit <n> …`                                                                       | Encode both files with the same fixed keyframe interval, no scene-cut keyframes and no B-frames (x265: `keyint=30:min-keyint=30:scenecut=0:bframes=0`). |
| A message that contains `depth bitstream has 8-bit luma`, together with `depth channel must use HEVC Main10, got 'main'`              | The depth file is 8-bit, or you swapped the colour and depth files.                                                                                     |
| `snapshot: … depth bitstream has chroma_format_idc <n>, expected 4:2:0`                                                               | Encode the depth file with `yuv420p10le`.                                                                                                               |
| `snapshot: Camera '<id>' depth tile is <w>x<h> but its intrinsics declare <w>x<h>`                                                    | Make the tile size and the camera’s `depthIntrinsics` size equal.                                                                                       |
| `snapshot: … tile 0 (camera '<id>') extends past the <w>x<h> logical image`                                                           | A tile doesn’t fit the picture. Check the tile and the picture size.                                                                                    |
| `snapshot: Per-camera … tile for '<id>' must cover the full logical image`                                                            | With `per-camera`, the single tile must be the whole picture.                                                                                           |
| `snapshot: Per-camera layout must expose one bundle per camera …` or `snapshot: Concatenated layout must expose exactly one bundle …` | The number of bundles doesn’t fit `streamLayout`.                                                                                                       |
| `snapshot: quantization: …`                                                                                                           | The depth lookup table breaks a rule. See `quantization` in [Manifest fields](#manifest-fields).                                                        |
| `startCaptureTimeUs … cannot be sent in control JSON`                                                                                 | Use a value of at most 9007199254740991.                                                                                                                |

### Other problems [#other-problems]

* **`conflict: server <serverId> is already rendered by …`**: this recording, or another source with the same `serverId`, is already open. Remove the other card, or give the manifest another `serverId`.
* **Playback is too fast or too slow**: set `frameRate` in the manifest to the recording’s frame rate.
