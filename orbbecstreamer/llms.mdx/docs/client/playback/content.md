# Play a recording (https://irc-hslu.github.io/orbbecstreamer/docs/client/playback)







A recording is a folder with a small description file, `manifest.json`, and raw HEVC video files for colour and depth. The client plays it as if it came from a live server, through the same decoding and drawing steps. You don't need a server or a camera.

A recording has no setup to change: it refuses the setup lock, calibration and placement with the code `unsupported-by-file-source`. It shows the setup as it was when the recording started.

The manifest format is Appendix B of the protocol contract (change 0038, accepted 2026-10-17). Its schema is `protocol/schema/recording-manifest.json`.

## Play a server recording [#play-a-server-recording]

The server writes a recording when `debug_recording.record_gpu_outputs` is on. See [Debug recording output](/docs/server/running#debug-recording-output) for where the folder is and what it holds. A per-camera recording has `manifest.json` at the top and one folder per camera:

```text
debug/live/
  manifest.json
  cam0/gpu-output-color.hevc
  cam0/gpu-output-depth.hevc
  cam1/gpu-output-color.hevc
  cam1/gpu-output-depth.hevc
```

1. Start the client and open it. See [Run the client](/docs/client/dev-build).
2. Under **Servers**, unfold **Open recording**.
3. Under **Recording folder (with manifest.json)**, choose the recording folder itself, the one that has `manifest.json` at its top. Your browser asks to upload the files; they are read in the browser and go nowhere else. Where your browser supports it, **Browse for the folder…** does the same with a read-only folder picker.
4. Select **Play recording**.

<img alt="Open recording unfolded, with a recording folder chosen, and Play recording" src="__img0" />

The form checks the manifest first, then reads only the video files the manifest names. A problem with the manifest appears under the form; a problem with the videos appears on the new card.

If you choose a folder that holds exactly one recording folder, the client uses that one. A browser that has no folder choice (some phones) shows **Recording files** instead: select `manifest.json` and the videos together. That works only for a recording whose files are all at the top level, not for the per-camera folders above.

Tip: the client that the server itself serves connects to its own rig automatically. To open a recording of that same rig, select **Remove** on the live card first; one card can show a server at a time.

## What you should see [#what-you-should-see]

A new card appears under **Servers**, titled with the manifest's `serverName`:

* The status chip reads **Streaming**, and the line under the title `recorded-rig · recording file://recorded-rig`.
* **Pairs** goes up while the recording plays.
* **Set up** and the lock buttons are unavailable: `a recording has no setup or lock`.

<img alt="The card for the test recording: Recorded rig, Streaming, the recording address, a Setup and control only chip because the capture browser couldn’t decode HEVC, Pairs 0, and Set up unavailable" src="__img1" />

The point cloud appears in the 3D view. A browser that can't decode HEVC exactly uses the client's built-in decoder (Chrome on Linux without a VA-API driver does); the first frames then take a moment while the decoder downloads. See [Check your browser](/docs/client/browser-requirements).

How a recording plays:

* **Cameras share one timeline.** Every camera's frames carry a frame set number, counted from 0 for the whole recording, and the client sends the frames of all cameras on one timeline: frame set *k* of every camera at the same time. A camera that was not recording at some number (it dropped frames, or started late) gets no frame for that number. The client hands the frames of different cameras to the 3D view together only when they have the same number: it holds a frame set back until every camera that has a frame at that number has been decoded. It waits at most 100 ms. After that it hands over the cameras that are ready, and a camera that is late keeps showing its previous frame until its own frame arrives, so for a moment the cameras can differ by a few frames on screen. Frames that arrive after their number was handed over, or that a newer frame set replaced while waiting, are dropped and counted in the card's dropped count. A camera you turn off, or that is paused when the tab is hidden, is not waited for, and its waiting frames are discarded. A camera whose video cannot be decoded delays every frame by that 100 ms.
* **Timing.** Frame set *k* is stamped with the manifest's `startCaptureTimeUs` plus *k* divided by `frameRate`, rounded to the microsecond (when looping, *k* counts on through the passes). The real frame period differs slightly from `frameRate`, so this is an approximation for display.
* **Loop.** With `"loop": true` the recording starts again at frame set 0 after the last frame set of any camera. With `"loop": false`, or no `loop`, frames stop after the last one and the card stays connected. A recording never reconnects by itself. To play it again, select **Remove** on its card, then open it again.
* **A recording still being written** (`recording.state` is `in-progress`) plays what is in the files when you open it. A camera that has not written its first keyframe yet is left out, and the card lists it under the title. The last frame of each file is not played, because it may be cut. If no camera has a keyframe yet, the card shows `recording has no playable frames`. Open the folder again later to play more.

### Open a recording that is still being written [#open-a-recording-that-is-still-being-written]

Chrome refuses to read a file that changed after the browser handed it out, and a growing recording changes all the time.

* **Browse for the folder…** (the folder picker, where your browser has it) keeps the folder and reads the files again each time you select **Play recording**, so it usually works on a live recording. If it reports that the recording changed, choose the folder again.
* The **Recording folder** field (and **Recording files**) cannot: if a file changed after you chose the folder, the form says `the recording changed while it was being read; choose the folder again (or copy the folder first)`. Copy the folder, then choose the copy.

## Make a test recording [#make-a-test-recording]

Skip this section if you already have a recording that meets the [limits](#limits-and-requirements).

You need FFmpeg with the libx265 encoder, and Node.js. The team tested these commands with FFmpeg 8 and Node.js 24. The "depth" video here is a colour test pattern, so its point cloud is meaningless; it only shows that playback works.

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

2. Save the following script as `make-manifest.mjs` in `~/recording`. It describes one 640×576 camera with 90 frames. For your own recording, change `depthIntrinsics`, `MIN_MM`, `MAX_MM`, `frameRate` and `FRAMES`.

   ```js
   // Writes manifest.json (manifestVersion 1) for one camera recorded as colour.hevc + depth.hevc.
   import { writeFileSync } from 'node:fs';

   const MIN_MM = 300;   // depth range of the recording, in millimetres
   const MAX_MM = 5000;
   const FRAMES = 90;    // frames in each .hevc file

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
     manifestVersion: 1,
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
         // One run of frames: frame set 0 to FRAMES - 1.
         segments: [{ firstFrameSetIndex: 0, accessUnits: FRAMES }],
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

   It prints `wrote manifest.json`. Then open the folder `~/recording` as described in [Play a server recording](#play-a-server-recording).

For a recording with several cameras, give each camera its own pair of files and its own `bundles` entry (`streamLayout` `per-camera`). For frames a camera is missing, give it several `segments` (see below).

## Manifest fields [#manifest-fields]

The manifest is a JSON file of at most 1 MiB in UTF-8. Keys the client doesn't know are ignored.

| Field                                     | Meaning                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifestVersion`                         | Must be `1`. A manifest without it is refused; see [Older manifests](#older-manifests).                                                                                                                                                                                                                                                                         |
| `serverId`, `serverName`                  | The recording's identity. The card is titled with `serverName`. Two open recordings with the same `serverId` conflict.                                                                                                                                                                                                                                          |
| `streamLayout`                            | `per-camera`, one bundle per camera, or `concatenated`, exactly one bundle whose picture holds every camera as a tile.                                                                                                                                                                                                                                          |
| `frameRate`                               | Frames per second on every video, above 0 and at most 1000.                                                                                                                                                                                                                                                                                                     |
| `loop`                                    | Optional. `true`: start again at the first frame. `false` or absent: stop after the last frame.                                                                                                                                                                                                                                                                 |
| `startCaptureTimeUs`                      | Capture time of frame set 0, in microseconds. A whole number up to 9007199254740991, or a decimal string.                                                                                                                                                                                                                                                       |
| `cameras`                                 | One entry per camera: `cameraId`, `label`, `depthIntrinsics` (`width`, `height`, `fx`, `fy`, `cx`, `cy` in pixels), `serverFromDepthCamera` (a rigid 4×4 matrix, 16 numbers, column by column) and `connected`.                                                                                                                                                 |
| `quantization`                            | The depth profile: the range in millimetres, the fixed codes 0, 1, 2, 1022 and 1023, and `reconstructionLutMm`, 1024 millimetre values. Entry 0 must be 0, entries 1 and 2 must equal `minimumDepthMm`, entries 1022 and 1023 must equal `maximumDepthMm`, and entries 2 to 1022 must never decrease.                                                           |
| `placement`                               | `anchorId`, `anchorFromServer` (a rigid 4×4 matrix) and `revision`.                                                                                                                                                                                                                                                                                             |
| `calibrationRevision`, `metadataRevision` | Whole numbers of 0 or more. Any value works for a recording.                                                                                                                                                                                                                                                                                                    |
| `recording`                               | Optional, written by the server: `state` (`in-progress` or `complete`) and `droppedFrameSets` (a count). Without it the recording counts as `complete`.                                                                                                                                                                                                         |
| `bundles`                                 | 1 to 64 entries. One entry per bundle: `bundleId` (at most 128 characters, counted as Unicode code points), `cameraIds`, `tiles` (`cameraId`, `x`, `y`, `width`, `height`), `color` and `depth`, each `{ "file": "<path>" }`, and `segments`. Each of `color` and `depth` can add `"logical": { "x", "y", "width", "height" }` to use only part of the picture. |

**File paths** are relative to the folder that holds `manifest.json`, with `/` between names (for example `cam0/gpu-output-color.hevc`). A path can't start with `/`, can't have an empty, `.` or `..` name in it, can't contain `\`, and has at most 255 bytes. The client refuses a manifest with any other path.

**Segments** say which frame sets each video holds. A segment is `{ "firstFrameSetIndex": <n>, "accessUnits": <count> }`: the next `count` frames of both videos are frame sets `n`, `n + 1` and so on. List the segments in order. The next segment must start after the previous one has ended and a frame set has passed, because a gap is what separates two segments. Every segment starts with a keyframe. For a recording without gaps, one segment `{ "firstFrameSetIndex": 0, "accessUnits": <frames> }` per bundle is enough.

In a recording that is `complete`, the sum of `accessUnits` must equal the number of frames in each of the bundle's videos. The last segment of an `in-progress` recording may leave out `accessUnits` and then runs to the end of the videos. A bundle without segments is allowed only while `in-progress`, before its first keyframe.

### Older manifests [#older-manifests]

A manifest without `manifestVersion` is the format from before change request 0038. The client refuses it and says so on the form. Convert it with one command, run in the client folder:

```sh
node scripts/convert-manifest.mjs path/to/recording
```

Pass the recording folder (or its `manifest.json`). This writes `manifest.v1.json` next to the original, with one `segments` entry per bundle covering the whole videos, and leaves the original alone. Rename it to `manifest.json` in a copy of the recording folder, or add `--in-place` to replace the original. The script reads the videos to count their frames, and stops if colour and depth differ. A manifest with any `manifestVersion` other than `1` is refused as well.

## Limits and requirements [#limits-and-requirements]

The client checks all of these when you open a recording.

Every video must:

* be a raw HEVC (H.265) stream, not MP4, MKV or another container
* start with a keyframe, and every segment must start with an IDR keyframe, that carries the stream headers (VPS, SPS and PPS)
* carry the stream headers again in every keyframe
* keep one picture size, profile, level and bit depth for the whole file
* use the HEVC Main profile for colour and Main10 for depth
* use no B-frames: the stream headers must say that no frames are reordered
* fit in memory: the browser reads the files whole, so the files add up to at most 2 GiB

Colour and depth of a bundle must hold the same frames, with keyframes at the same positions.

The depth video must be Main10: 10-bit, with 4:2:0 colour sampling. Each depth pixel is a 10-bit code that the client turns into millimetres with the manifest's lookup table.

Each camera's area of the picture, its tile, must fit inside the picture. It must have the width and height given by the camera's `depthIntrinsics`, and the same size in colour and depth.

The setup is the one at the start of the recording: poses, placement, depth range and revisions. A change during the recording isn't in the file.

## Fix recording problems [#fix-recording-problems]

### Nothing decodes and Pairs stays at 0 [#nothing-decodes-and-pairs-stays-at-0]

Your browser can't decode HEVC exactly and the built-in decoder didn't load, or the browser has no WebCodecs. The card shows a **Setup and control only** chip, or the header's decoder chip is amber instead of **WebCodecs**. Read the `[decode path]` warning in the browser console; it names the reason. See [Check your browser](/docs/client/browser-requirements#fix-browser-problems).

### Messages under the Open recording form [#messages-under-the-open-recording-form]

| Message                                                                                                                                                                                  | Fix                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `choose the recording folder (the one that holds manifest.json)`                                                                                                                         | Choose a folder first.                                                                                                                                                      |
| `no manifest.json at the top of the chosen folder; choose the recording folder itself`                                                                                                   | Choose the folder that has `manifest.json` directly in it.                                                                                                                  |
| `the folder holds <n> recordings; choose the folder of one recording …`                                                                                                                  | Choose one recording folder instead of the folder above it.                                                                                                                 |
| `manifest.json is <n> bytes; the limit is 1048576 (1 MiB)` or `manifest is larger than the 1048576 byte (1 MiB) limit`                                                                   | The manifest is too big. A real manifest is a few kilobytes.                                                                                                                |
| `manifest is not JSON: …`                                                                                                                                                                | The manifest isn't valid JSON. Make it again with the script.                                                                                                               |
| `manifest: <field>: <problem>`, for example `manifest: frameRate: Number must be greater than 0`                                                                                         | A manifest field is missing or has the wrong type or range. See [Manifest fields](#manifest-fields).                                                                        |
| `manifest: manifestVersion: must be 1, …`                                                                                                                                                | The only version is 1.                                                                                                                                                      |
| `manifest: manifestVersion missing: this is a pre-0038 recording; convert it with …`                                                                                                     | The older format is refused. Convert it as described in [Older manifests](#older-manifests).                                                                                |
| `manifest: manifestVersion: missing, but the manifest has version 1 keys …`                                                                                                              | The manifest has `segments` or `recording` but no `manifestVersion`. Add `"manifestVersion": 1`.                                                                            |
| `manifest: bundles.<n>.color.file: file path '<path>' must …`                                                                                                                            | The path is not a relative path as described under [Manifest fields](#manifest-fields).                                                                                     |
| `manifest: bundles.<n>.segments…: an open segment …`, `…: only the last segment may be open …`, `…: segments must be in increasing order and must not overlap …`, `…: has no segments …` | A segment list breaks the rules under [Manifest fields](#manifest-fields).                                                                                                  |
| `manifest: bundles.<n>.bundleId: must be at most 128 Unicode code points, …` or `manifest: bundles: must have at most 64 bundles, …`                                                     | The client asks the server for every bundle by id, and that request allows at most 64 ids of at most 128 characters each. Shorten the bundle id, or use at most 64 bundles. |
| `file '<path>' named by the manifest is not in the chosen folder`                                                                                                                        | The folder lacks a video the manifest names. With a plain file selection, choose the folder instead.                                                                        |
| `the recording's files add up to <n> bytes; …`                                                                                                                                           | The videos are bigger than 2 GiB. Cut the recording.                                                                                                                        |
| `the recording changed while it was being read; choose the folder again …`                                                                                                               | A file changed after the browser handed it out (a recording still being written). Use **Browse for the folder…** or copy the folder.                                        |
| `manifest.json is not valid UTF-8`                                                                                                                                                       | Save the manifest as UTF-8.                                                                                                                                                 |
| `manifest uses '<path>' for both colour and depth`                                                                                                                                       | One file can be only one channel. Give colour and depth different files.                                                                                                    |
| `could not read the files: …` or `could not read the folder: …`                                                                                                                          | The browser couldn't read a file. Choose the folder again.                                                                                                                  |

### Messages on the card [#messages-on-the-card]

When the videos fail the checks, the card shows **Error**, the title `file://invalid-recording`, and a list of problems. Nothing plays.

| Message                                                                                                                               | Fix                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recording has no playable frames`                                                                                                    | A recording still being written has no camera with a keyframe in both files yet. Open it again later.                                                   |
| A note under the title, `bundle '<id>' … is left out`                                                                                 | An in-progress recording: that camera has nothing playable yet. The others play.                                                                        |
| `bundle '<id>' color: malformed Annex-B (no-start-code) …`                                                                            | The file isn't a raw HEVC stream, for example an MP4. Extract the raw stream: `ffmpeg -i in.mp4 -c:v copy -bsf:v hevc_mp4toannexb out.hevc`.            |
| `… malformed Annex-B (leading-garbage) …`                                                                                             | The file has extra bytes at the start, or is cut at the start.                                                                                          |
| `… malformed Annex-B (truncated-nal-header)`, `(forbidden-zero-bit)`, `(invalid-temporal-id)` or `(truncated-slice-header) …`         | The file is damaged or cut. Encode or export it again.                                                                                                  |
| `… malformed Annex-B (access-unit-without-picture) …`                                                                                 | The file ends with headers and no picture. Export it again. (In a recording still being written this tail is ignored.)                                  |
| `… malformed Annex-B (missing-first-slice) …`                                                                                         | The file starts in the middle of a picture. Cut it at a picture boundary.                                                                               |
| `… access unit 0 must be a keyframe carrying VPS, SPS and PPS`                                                                        | The file doesn't start with a keyframe that carries the stream headers. Cut it at a keyframe, or encode it again.                                       |
| `… access unit <n> (the start of the segment at frame set <k>) must be a keyframe carrying VPS, SPS and PPS`                          | A segment doesn't start with a keyframe. Fix the segment list or cut the video at the keyframe.                                                         |
| `… must be an IDR picture (CR 0038 B.3), not another keyframe type`                                                                   | A segment starts with a keyframe that isn't an IDR. Encode with IDR keyframes (x265 does).                                                              |
| `… keyframe access unit <n> does not carry VPS, SPS and PPS`                                                                          | A later keyframe lacks the stream headers. Encode with the headers repeated (x265: `repeat-headers=1`).                                                 |
| `… access unit <n>: SPS: …`                                                                                                           | The client can't read the stream header. The file is damaged or uses syntax the client doesn't read.                                                    |
| `… sps_max_num_reorder_pics is <n>; B-frames are not allowed …`                                                                       | The video has B-frames. Encode with `bframes=0`.                                                                                                        |
| `… HEVC profile_idc <n> is neither Main nor Main10`                                                                                   | Encode colour as Main and depth as Main10.                                                                                                              |
| `… the SPS in access unit <n> changes the stream format`                                                                              | The picture size, profile, level or bit depth changes inside the file. Split the file there, or encode it again.                                        |
| `bundle '<id>': colour has <a> access units, but the manifest's segments add up to <b>`, or the same for depth                        | In a complete recording the segments must add up to every video's frame count. Fix `accessUnits` or trim the video.                                     |
| `bundle '<id>': the manifest's closed segments hold <a> access units, but colour has <b> and depth has <c>`                           | A recording still being written has less data than its manifest says. Copy the files again.                                                             |
| `bundle '<id>': colour has <a> access units, depth has <b>; a frame set needs one of each`                                            | `convert-manifest.mjs` stops with this when the two files have different frame counts. Trim them to the same frames.                                    |
| `bundle '<id>': keyframes are not aligned at access unit <n> …`                                                                       | Encode both files with the same fixed keyframe interval, no scene-cut keyframes and no B-frames (x265: `keyint=30:min-keyint=30:scenecut=0:bframes=0`). |
| A message that contains `depth bitstream has 8-bit luma`, together with `depth channel must use HEVC Main10, got 'main'`              | The depth file is 8-bit, or you swapped the colour and depth files.                                                                                     |
| `snapshot: … depth bitstream has chroma_format_idc <n>, expected 4:2:0`                                                               | Encode the depth file with `yuv420p10le`.                                                                                                               |
| `snapshot: Camera '<id>' depth tile is <w>x<h> but its intrinsics declare <w>x<h>`                                                    | Make the tile size and the camera's `depthIntrinsics` size equal.                                                                                       |
| `snapshot: … tile 0 (camera '<id>') extends past the <w>x<h> logical image`                                                           | A tile doesn't fit the picture. Check the tile and the picture size.                                                                                    |
| `snapshot: Per-camera … tile for '<id>' must cover the full logical image`                                                            | With `per-camera`, the single tile must be the whole picture.                                                                                           |
| `snapshot: Per-camera layout must expose one bundle per camera …` or `snapshot: Concatenated layout must expose exactly one bundle …` | The number of bundles doesn't fit `streamLayout`.                                                                                                       |
| `snapshot: quantization: …`                                                                                                           | The depth lookup table breaks a rule. See `quantization` in [Manifest fields](#manifest-fields).                                                        |
| `startCaptureTimeUs … cannot be sent in control JSON`                                                                                 | Use a value of at most 9007199254740991.                                                                                                                |

### Other problems [#other-problems]

* **`This server is already open on the card "…" (live server)`** (or `(recording)`): this recording, or another source with the same `serverId`, is already open on the card the message names. Select **Remove** on that card to show this one, or give the manifest another `serverId`.
* **Playback is too fast or too slow**: set `frameRate` in the manifest to the stream rate of the recording, not the camera's capture rate.
* **A camera shows gaps**: it has none of those frame sets in its `segments`; the server dropped them, or the camera started late.
