# Runtime options for embedding (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/runtime-options)



A page that embeds the client runtime, such as the Operator Console, starts it with `startAppRuntime(container, options)` from `client/src/app/appRuntime.ts` and adds servers with `model.add(source)`. This page covers two options for that: a control-only runtime, and pinned server certificates.

## Start a control-only runtime [#start-a-control-only-runtime]

Use this when the page shows server state and runs setup, but draws no point clouds.

```ts
import { startAppRuntime } from '../app/appRuntime.js';

const runtime = startAppRuntime(container, { media: 'none', displayName: 'Operator Console' });
const model = await runtime.ready;
model.add({ kind: 'webtransport', url: 'https://capture-01.local:4443/orbbec' });
```

`media` is `'full'` (the default) or `'none'`. With `'none'` the runtime:

* creates no canvas, renderer, GPU device, decoders or decoder support probe, and doesn't ask for WebXR support. It doesn't touch `container`;
* never sends `client.subscribe`. That holds after a handshake, for bundles a later snapshot adds, after a revision change and after a reconnect. `client.hello` lists no preferred bundles;
* cancels any media stream a server opens anyway, and decodes nothing;
* tells each server in `client.hello` that it has no WebGPU, WebGL2, WebXR or HEVC decoding. The server sees a control and setup client, and the connection refuses a manual `subscribe` with `not-decode-compatible`.

On its own, the runtime sends only `client.hello`, `client.ping` (clock sync) and `client.snapshot.request` (a resync after an unexpected revision, or `refreshSnapshot()`). The setup lock, its lease heartbeat, calibration, placement commits and reconnects work as in the full runtime. They are sent only when the page asks for them.

What the model reports instead of a renderer:

| Member                                           | Value with `media: 'none'`                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `renderer`                                       | `{ kind: 'none', message: 'Control only: this runtime draws nothing and receives no media.', notes: [] }` |
| `renderSettings`                                 | `null`                                                                                                    |
| `decoders`                                       | `{ kind: 'unavailable', message: 'Control only: nothing is decoded.' }`                                   |
| `attachPlacementGizmo(id, …)`                    | `{ ok: false, message: 'control-only: nothing is drawn' }`                                                |
| `pipeline(id).controlOnly`                       | `true`                                                                                                    |
| `pipeline(id).status.bundles`, `withheldBundles` | always empty                                                                                              |

Every member returns one of these values; none of them throws. Hidden-tab media suspension isn’t installed, because there is no media to pause.

At a lower level, `ConnectionManager` and `ServerPipeline` take the same option: `media: 'none'` with `renderer: null`. A full pipeline without a renderer throws `a renderer is required unless media is 'none'`.

## Read per-bundle stats [#read-per-bundle-stats]

Use this when the page shows how each camera bundle is doing, for example a live preview strip. `model.pipeline(id)` returns the entry's `EntryPipeline`; ask it for one bundle, or for all of them:

```ts
const stats = model.pipeline(id)?.bundleStats(bundleId);   // BundleStats | null
const all = model.pipeline(id)?.allBundleStats();          // ReadonlyMap<BundleId, BundleStats>
```

| Field                | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fps`                | Completed frame sets per second over the last 2 s. Until a bundle has been streaming for 2 s, it counts intervals over the time observed, so a new bundle isn't under-reported.                                                                                                                                                                                                                                                                                   |
| `decodeLatencyMs`    | `{ p50, p95 }` from decoder submit to decoder output over the last 5 s. For a frame set it is the slower of the colour and depth frames. `null` when the latency probe is off, or when no sample is in the window.                                                                                                                                                                                                                                                |
| `droppedFrameSets`   | Count of lost frame sets by reason. The synchroniser's `missingColor`, `missingDepth`, `revisionMismatch`, `timestampMismatch` and `discarded`, and the render feed's `no-target`, `revision-mismatch`, `geometry-mismatch`, `colour-unmappable`, `depth-unreadable`, `target-changed`, `upload-failed`, `superseded` and `disposed`, and `decoderOutputDropped`: a frame the built-in decoder lost because it had no free frame buffer. Every reason is present. |
| `lastFrameSetNumber` | The last completed frame set as a `bigint`, or `null` before the first one.                                                                                                                                                                                                                                                                                                                                                                                       |
| `decodePath`         | How the colour and the depth channel are decoded, and why: `{ colour, depth }`, each a `DecodePathInfo`. See [Read how a channel is decoded](#read-how-a-channel-is-decoded).                                                                                                                                                                                                                                                                                     |

* Before the first frame set of a session, `bundleStats` already returns an object for a bundle the connection has: `fps` is 0 and `lastFrameSetNumber` is `null`. Show "Waiting for frames" while `lastFrameSetNumber` is `null`.
* Everything counts from the start of the current session. A reconnect, or a bundle removed from the snapshot, starts that bundle over, and `bundleStats` returns `null` for a bundle the connection doesn't have. A control-only runtime returns `null` for every bundle. For a removed entry, `model.pipeline(id)` is already `null`, so `model.pipeline(id)?.bundleStats(bundleId)` gives `undefined`.
* The stats are plain reads: poll at 1 Hz. The media path writes into preallocated ring buffers and allocates nothing per frame. The window is only sorted when you read.
* `decodeLatencyMs` needs the latency probe, which is off by default. Turn it on for a runtime with `startAppRuntime(container, { latencyProbe: true })`. Per frame set it costs about a dozen `performance.now()` calls (arrival, receive, submit and output of each channel, pairing, depth read, upload) and writes into preallocated rings, with no allocation. `pipeline.latencyReport()` then returns the [per-stage percentiles](/docs/client/developer/latency). With the option off, no clock is read for the probe and `decodeLatencyMs` stays `null`.
* `dispose()` on a `media: 'full'` runtime also releases the GPU: the WebGPU device is destroyed and the WebGL2 context is lost, so a page can mount and dispose runtimes repeatedly without hitting the browser's context limit.
* `EntryPipeline` does not give out the decoding sink or the render feed. `bundleStats` is the way to see a bundle's counters.

## Read how a channel is decoded [#read-how-a-channel-is-decoded]

Use this to show whether a camera's colour and depth are decoded by the browser, and why not when they aren't. The client decodes a channel with WebCodecs only if the browser returns exact frames. At startup it decodes two tiny built-in HEVC streams (one per channel) and compares the result with a known-good decode. The check is bounded (about 6 seconds at most) and runs beside the connections. A server's `client.hello` waits for it, so a bundle normally appears with its decision already made; a stream that opens earlier holds its records until the check finishes.

`BundleStats.decodePath` is present from the moment the bundle exists, before the first frame (`lastFrameSetNumber` is still `null`). Each channel is one of these, and `probe` is always present as a key:

| `path`      | `reason`           | Meaning                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`   | `probing`          | The check hasn't finished. Show "Checking decoder…".                                                                                                                                                                                                                                                                                                 |
| `webcodecs` | `probe-exact`      | The browser returned exact frames. WebCodecs decodes this channel.                                                                                                                                                                                                                                                                                   |
| `wasm`      | `probe-inexact`    | The browser's frames aren't exact, or it can't decode HEVC. The client's own WebAssembly decoder serves this channel.                                                                                                                                                                                                                                |
| `wasm`      | `runtime-demoted`  | The same, after a run-time signal that a re-check confirmed (see below).                                                                                                                                                                                                                                                                             |
| `none`      | `wasm-load-failed` | The browser's frames aren't exact and the client's own decoder could not be loaded. `detail` holds the reason, for example `HTTP 404 for the decoder file` or `blocked by the page's content security policy (script-src needs 'wasm-unsafe-eval')`. The channel isn't decoded, so the bundle isn't shown. Final for the page: a reload tries again. |
| `none`      | `unsupported`      | The browser's frames aren't exact and there is no other decoder: the browser has no workers, WebAssembly or `VideoFrame`, or the client decodes nothing. This channel isn't decoded, so the bundle isn't shown.                                                                                                                                      |

`probe` is `null` while the check runs, and when no check applies (the client decodes nothing, or the embedding code supplied no check: then both channels read `webcodecs` / `probe-exact` with `probe: null`). Otherwise it holds what was measured:

| Field                  | Meaning                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `codec`                | The codec string of the check.                                                                                                    |
| `hardwareAcceleration` | The preference of the configuration that ran: `prefer-software` (tried first for depth) or `no-preference`.                       |
| `format`               | The pixel format of the decoded frames (`I420`, `NV12`, `I420P10`, …), or `null` for an opaque frame or when nothing was decoded. |
| `exact`                | `true` if the frames matched.                                                                                                     |
| `source`               | `run`: measured in this page load. `cache`: read from the stored result.                                                          |
| `at`                   | When the check ran, in epoch milliseconds (`Date.now()`).                                                                         |

A channel the check finds inexact is decoded by the client's own decoder (FFmpeg's HEVC decoder compiled to WebAssembly, `client/wasm/hevc`). It runs in one module worker per stream, with no `SharedArrayBuffer`. It returns ordinary `VideoFrame`s (`I420` for colour, `I420P10` with LSB-aligned 10-bit samples for depth), so pairing, the depth read and the GPU upload are the same as for WebCodecs. The client loads it lazily: the file is fetched with a SHA-384 integrity hash and compiled the first time a channel (or a server's hello) needs it, once per page. Colour and depth decide separately, so one camera can mix a WebCodecs channel with a WASM one.

A channel is exact when its decoded frames hash-match the reference. Colour: `I420` or `NV12` planes. Depth: a 10-bit format with LSB-aligned samples (for example `I420P10`) and matching planes. An opaque frame (`format` `null`), another format, a decoder error, a timeout (5 s) or any difference means not exact. `isConfigSupported` alone is never taken as proof.

The two channels decide separately. A bundle needs both, so one inexact channel still withholds it.

```ts
const stats = model.pipeline(id)?.bundleStats(bundleId);
const depth = stats?.decodePath.depth;       // DecodePathInfo
if (depth?.path === 'pending') showChip('Checking decoder…');
else if (depth?.path === 'none') showChip(`Depth not decoded (${depth.reason})`);
```

* `decodePath` reports what each channel's decoder actually does. A bundle whose stream is running reports the path that stream's decoder was created on (`webcodecs` or `wasm`); a decoder that is unsupported or has failed reports `none` / `unsupported`; a bundle with no stream yet reports the shared decision. After the shared decision changes, decoders already running keep reporting `webcodecs` (with the newer `probe`, whose `exact` may then be `false`) until they are replaced. The object is the same between reads and changes only when something it reports changes, so you can compare it by reference.
* The hello follows the decision (§16): a channel that is not decoded isn't advertised, so the server's card shows `Setup and control only: this browser lacks HEVC Main10 depth decoding.` (or colour) and no media is requested.
* The result is stored in `localStorage` for 30 days, per browser (full user agent), GPU, check version, check rules and client build. Without storage (a private window, blocked site data) it works the same and the check runs on every page load. A check that failed with a decoder error or a timeout is not stored.
* A decoder that fails on one server (a corrupt stream, too many errors) affects only that bundle's channel for the session. It doesn't change the shared decision or the stored result. A built-in decoder that fails is not replaced by WebCodecs: the channel stays on `wasm`, the stream's decoder is replaced up to three times and then the bundle is withheld, as for WebCodecs.
* A decoder worker that does not start (its script is blocked or missing) also counts as a failed load (its script raises `onerror` before it reports ready; a worker that is merely slow fails only its own stream's decoder). The channels then read `none` / `wasm-load-failed` with the reason in `detail`, and the hello stops advertising them.
* The built-in decoder doesn't support streams that reorder frames (B-frames). It checks the SPS of every keyframe: `sps_max_num_reorder_pics` must be 0, and a keyframe whose SPS can't be read is refused too, because the decoder can't match output frames to timestamps otherwise.
* A failed load of the built-in decoder is reported once per page, as a console warning: `Depth/colour cannot be decoded in this browser: the built-in decoder failed to load (<reason>)`. The server's hello then leaves the channel out, so its card shows `Setup and control only`.
* If a decoded depth frame is not 10-bit, or a colour frame is not `I420` or `NV12`, the client drops the stored result and checks again once for that channel. The channel is switched away from WebCodecs (to `wasm` / `runtime-demoted`) only if the new check isn't exact. Frames from the built-in decoder never start this check.
* Add `?decodeProbe=force` to the page URL to ignore the stored result and check again.
* The check runs once per page, and every server shares its result.

Measured on 2026-10-10 with Google Chrome 155 on Ubuntu 26.04 and an RTX 4090 (a headed browser):

| Browser flags                                                             | Colour                                                                        | Depth                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Default                                                                   | `none` / `unsupported`, `format` `null`: the browser doesn't decode HEVC      | `none` / `unsupported`, `format` `null`                        |
| VA-API (`--enable-features=VaapiOnNvidiaGPUs` with `nvidia-vaapi-driver`) | `none` / `unsupported`, `format` `NV12`: the values differ from the reference | `none` / `unsupported`, `format` `null`: the frames are opaque |

## Pin a server certificate [#pin-a-server-certificate]

Use this when the browser runs on the server PC and the server uses a short-lived self-signed certificate (release ADR-0004). The browser then checks the certificate against the hash you give it instead of a certificate authority. [Serve to browsers](/docs/server/serving#development-a-pinned-certificate-hash) explains the certificate rules (ECDSA P-256, valid for less than 14 days) and how to compute the hash.

```ts
import { parseCertificateHash } from '../app/serverSource.js';

const hash = parseCertificateHash('8e:dd:4a:62:46:85:ea:98:17:dd:fa:1d:34:cd:39:b7:28:86:fc:b0:a1:71:a5:15:f4:d5:29:74:43:53:ce:87');
if (!hash.ok) throw new Error(hash.issues.join('; '));
model.add({ kind: 'webtransport', url: 'https://127.0.0.1:4443/orbbec', serverCertificateHashes: [hash.value] });
```

Replace the hash with your server certificate’s SHA-256 hash.

* `serverCertificateHashes` is optional on a `webtransport` source. It has the WebTransport API’s shape: `readonly { algorithm: 'sha-256'; value: BufferSource }[]`. It is passed as `new WebTransport(url, { serverCertificateHashes })` on every connect and reconnect of that entry. Absent or empty, the constructor gets no options, and the browser uses its normal certificate check.
* `parseCertificateHash(text)` accepts 64 hex digits, in any case, with or without `:` between the bytes: paste what `openssl x509 -fingerprint -sha256` prints after `=`, without the `sha256 Fingerprint=` prefix. It also accepts base64, standard or URL-safe, with or without padding. Anything that doesn’t decode to exactly 32 bytes is refused with an issue message.
* Pass two hashes, the current one and the next, to survive a certificate rotation. The browser accepts a certificate that matches any of them.
* A source with an invalid hash, for example of the wrong length, fails only that entry. Its `status.sourceIssues` names the hash, and nothing is opened.
* The hashes are fixed for the entry. After the server rotates to a certificate you didn’t pass, remove the entry and add it again with the new hash.
* The client doesn’t fetch hashes from anywhere. Your page gets them and passes them in.
* The **Add server** form in the main client has no hash field yet.

### Check it in a browser [#check-it-in-a-browser]

On 2026-10-05 the client code was checked in headless Chromium 153. It ran against a local WebTransport server with a 13-day ECDSA P-256 certificate made with the `openssl` steps on [Serve to browsers](/docs/server/serving#development-a-pinned-certificate-hash):

| Hashes passed                           | Result                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| The certificate’s hash, parsed from hex | connected                                                                           |
| The same hash, parsed from base64       | connected                                                                           |
| A wrong hash, then the right one        | connected                                                                           |
| None                                    | refused: `Opening handshake failed.` (the browser logs `CERTIFICATE_VERIFY_FAILED`) |
| A wrong hash only                       | refused: `Opening handshake failed.`                                                |

## Discover the server that served the page [#discover-the-server-that-served-the-page]

A page served from the server PC can find its server through transport discovery (wire-format Appendix A). The page fetches `GET /.well-known/orbbec/transport` from its own origin. The response names the WebTransport `url` and up to two certificate hashes.

Two ways to use it:

```ts
// 1. Let the pipeline discover before every connect attempt, including reconnects.
model.add({ kind: 'discovered' });

// 2. Fetch once and get a webtransport source (the Operator Console's path).
import { discoverTransport } from '../app/transportDiscovery.js';
const result = await discoverTransport();
if (result.kind === 'found') model.add(result.source);
```

* `{ kind: 'discovered' }` fetches the document again before every attempt, so a rotated certificate is picked up on the next reconnect. A source from `discoverTransport()` keeps the hashes it was built with.
* `discoverTransport(port?)` returns one of three results:
  * `{ kind: 'found', source, warnings }`: `source` is `{ kind: 'webtransport', url, serverCertificateHashes? }`; the hashes key is left out when the list is empty;
  * `{ kind: 'none', reason: 'not-offered' | 'not-available' }`: ask the user for a URL;
  * `{ kind: 'error', message }`.
* Only a page whose origin is `https:`, or `http://127.0.0.1` / `http://localhost`, may use discovery. On any other origin, `discoverTransport()` returns `none` with reason `not-available`, and a `discovered` source fails with a `sourceIssues` entry. Nothing is fetched in either case.
* The fetch never leaves the page’s origin. It uses `cache: 'no-store'`, `credentials: 'same-origin'`, `mode: 'same-origin'` and `redirect: 'error'`.
* The fetch and the body read stop after 5 seconds, inside the 10-second connect deadline. A result that arrives after the connection gave up on that attempt never opens a session.
* A `200` response must have `Content-Type: application/json`. Anything else fails the attempt with `not a discovery document (Content-Type …)`, for example a host that answers every path with its `index.html`.
* `vite` and `vite preview` answer 404 for `/.well-known/` paths, so the development server behaves like a host without discovery.
* In tests, inject `TransportDiscoveryPort` (`client/src/connections/transportDiscovery.ts`): pass `transportDiscovery` to `ConnectionManager` or `ServerPipeline`, or pass the port to `discoverTransport`.

## Tell where a connection closed [#tell-where-a-connection-closed]

`ServerPipelineStatus.lastClose` (and `ServerConnection.lastCloseReason`) is the reason the last session ended. Every close carries a `stage`, so a caller can tell a discovery failure from a failed handshake without matching message text:

| `stage`     | Meaning                                                                                        | Examples                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `discovery` | The discovery fetch or document validation failed, before any WebTransport handshake.          | `404` first, `5xx`, a network error, an invalid document                                                     |
| `connect`   | The opening handshake, the connect timeout, or any failure before `server.hello` was accepted. | A refused handshake, `connect-timeout`, a reset before the hello, a fatal `server.error` answering the hello |
| `session`   | After the session was established.                                                             | A protocol error, the server closing the session, the control stream ending, a resync failure                |

`lastClose` keeps its `stage` across a reconnect and changes only when the next close happens.

A local `disconnect()` (and removing a card) takes the stage of what it interrupts:

* in an established session: `session`;
* while the discovery fetch is running: `discovery`;
* in the handshake, before the hello: `connect`;
* during a reconnect backoff, with no attempt in flight: the stage of the attempt that failed last.

A `discovered` source that can't be set up at all (the page isn't served by the server PC) never builds a connection, so `lastClose` stays `null`. `start()` and `reconnect()` still resolve with a failure whose `stage` is `discovery`. A disposed entry reports `connect`.

## Troubleshooting [#troubleshooting]

* **A subscribe returns `not-decode-compatible`**: expected with `media: 'none'`. The runtime told the server it decodes nothing, so `connection.compatibility` has `renderingCompatible: false` and `clientRole(compatibility)` (`client/src/state/compatibility.ts`) returns `control-only`. Start a runtime with `media: 'full'` to draw.
* **`Opening handshake failed.` with a hash**: the hash doesn’t match the certificate, or the certificate breaks the browser’s rules. Check that you hashed the DER bytes, not the PEM file. The certificate must be ECDSA P-256 and valid for less than 14 days.
* **`serverCertificateHashes[0]: a SHA-256 certificate hash has 32 bytes, got N`** in `sourceIssues`: the value is not a SHA-256 digest. Build it with `parseCertificateHash`.
* **`This page’s server offers no transport discovery: add the server by its URL`** on a `discovered` card: the origin answered 404 before any connection succeeded through discovery. The client doesn’t retry. Once a connection has succeeded through discovery, a 404 counts as a passing outage, and the client retries with backoff.
* **`transport discovery: … answered HTTP 500`**, **`fetching … failed`**, **`timed out after 5000 ms`**, **`not a discovery document (Content-Type …)`** or **`Rejected transport discovery document`**: this attempt failed. The client retries with backoff and fetches the document again each time.
* **Safari**: assume `serverCertificateHashes` isn’t supported. Use a certificate from a certificate authority the browser trusts.
