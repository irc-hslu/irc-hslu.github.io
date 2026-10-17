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

While a connection owns the setup lock, it also holds a Web Lock (named `orbbecstreamer:setup-lease:…`, visible in `navigator.locks.query()`), so Chrome doesn't freeze the tab and stop the renewals. The connection releases it when the lock is released, runs out or is lost, when the session ends (so a reconnect never inherits it), and on `disconnect()`, which `dispose()` calls for every server. Without `navigator.locks` the client holds nothing.

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

## Start with a subset of the bundles [#start-with-a-subset-of-the-bundles]

By default the client subscribes every bundle of a server after the handshake. A page that shows only some cameras at first can pass `initialBundleIds` to `add`, so the server doesn't start a stream, and send a keyframe, for each hidden camera:

```ts
model.add({ kind: 'webtransport', url: 'https://capture-01.local:4443/orbbec' }, { initialBundleIds: [bundleA] });
```

After the hello snapshot the client sends one `client.subscribe` with these bundles only (the contract lets a client subscribe any bundles after the snapshot, §4a); `client.hello` still lists no preferred bundles. Ids the server doesn't have are ignored, and an empty list subscribes nothing. Bundles outside the list, including ones a later snapshot adds, stay unsubscribed until the page calls `connection.subscribe`. `pipeline.notRequestedBundles` lists them. The subset applies again after each reconnect, and hidden-tab suspension pauses and resumes only the bundles that were subscribed. A recording ignores the option: it plays what its hello announces. With `media: 'none'` the option has no effect, because that runtime subscribes nothing.

## Read the operator state (protocol 1.1) [#read-the-operator-state-protocol-11]

A connection to a server that announces protocol 1.1 keeps the minor-1 operator state in `connection.operatorState` (also on `EntryPipeline.connectionView`). It is separate from `connection.state` on purpose: these messages carry the current `metadataRevision` and never increment it, so they never trigger a resync, and a copy with a lower revision than the held one is ignored.

| Field           | Meaning                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cameras`       | Per camera: its `server.sensor.capabilities` and the latest `server.sensor.config` per sensor (the applied values). Operator sessions only.                 |
| `profiles`      | The latest `server.stream.profiles`: the list, the active and pending profile, `switchState`. Operator sessions only.                                       |
| `telemetry`     | The latest `server.sync.telemetry` window and when it arrived. 3 s without a window is a fault (`telemetrySilent`). Operator sessions only.                 |
| `setupProgress` | The latest `server.setup.progress`: the complete task list. Every session gets it, with no marker.                                                          |
| `complete`      | True after `server.operator.replay-complete`. A new hello or snapshot sets it false until the next marker. A session that is not `operator` never gets one. |

Selectors in `src/state/operatorState.ts`: `sensorProperties`, `appliedValues`, `hasCapabilities`, `telemetrySilent`, `setupProgressIdle`. Listen for the `operator-state` event (`change`: `capabilities`, `config`, `profiles`, `telemetry`, `setup-progress`, `replay-complete` or `cleared`). When capture leaves `running` the cameras and telemetry are cleared (`cleared`); the profile list and the task list stay.

Two operator writes, both needing the lease, the `operator` role and protocol 1.1:

```ts
await pipeline.setSensorConfig(cameraId, 'color', [{ propertyId: 'auto-exposure', value: false }, { propertyId: 'exposure', value: 120 }]);
await pipeline.setStreamProfile('nfov-640x576-15');
```

Nothing is sent before the matching message arrived in this session: `setSensorConfig` needs the camera's capabilities and `setStreamProfile` needs `server.stream.profiles`, otherwise the result is `unsupported-by-server`. Out-of-bound arguments (not 1..32 changes, an empty property id, a `NaN`) fail `invalid-argument`. The server's refusal passes through as `rejected` with its code (`sensor-out-of-range`, `sensor-busy`, `profile-switch-in-progress` and so on). The ack of `setSensorConfig` follows the `server.sensor.config` it caused; the ack of `setStreamProfile` follows the `switching` broadcast, and the switch ends with `profiles.switchState` back at `idle`.

Pass `features: ['preview-media']` to `startAppRuntime` (or a pipeline) to ask for preview media; only the Operator Console's route does. `features` is a minor-1 hello field, so a 1.0 server that rejects the hello gets the one-time 1.0 retry without it. The client does not yet draw preview descriptors differently: it reads `preview` and checks that both channels agree, nothing more.

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
* `EntryPipeline.connectionView` is the connection without `connect` and `disconnect`; the full `ServerConnection` is not exposed on an entry.
* `pipeline.startCapture()` asks a server with closed cameras to open them; `pipeline.stopCapture()` closes them (operator role and lease). See [Mock server](/docs/client/developer/mock-server#fake-capture-idle-mode-protocol-11).

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

A channel the check finds inexact is decoded by the client's own decoder (FFmpeg's HEVC decoder compiled to WebAssembly, `client/wasm/hevc`). It runs in one module worker per stream, with no `SharedArrayBuffer`. It returns ordinary `VideoFrame`s (`I420` for colour, `I420P10` with LSB-aligned 10-bit samples for depth), so pairing and the depth read are the same as for WebCodecs. The colour upload differs: the client copies the three `I420` planes out of the frame at the same time as the depth codes, writes them to the GPU as one-byte-per-sample textures and converts YUV to RGB on the GPU (WebGPU: one render pass into the colour texture; WebGL2: in the point shader). Handing such a frame to the browser instead (`copyExternalImageToTexture`, `texSubImage2D`) cost several milliseconds of GPU-process or main-thread CPU per frame. On WebGPU this applies to colour frames up to 1 megapixel (every per-camera stream and 2-camera concatenations); larger frames keep the browser copy, which costs the same there. Only BT.709-type colour (a BT.709 or BT.601 matrix, BT.709 or unspecified primaries, an SDR transfer) takes this path; a BT.2020 matrix keeps the browser copy; it matches the browser's conversion within 1 level on smooth content and within 4 at sharp colour edges. The client loads it lazily: the file is fetched with a SHA-384 integrity hash and compiled the first time a channel (or a server's hello) needs it, once per page. Colour and depth decide separately, so one camera can mix a WebCodecs channel with a WASM one.

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

## Ask for the operator role [#ask-for-the-operator-role]

Protocol 1.1 (wire-format §11, §16) lets a session ask for the `operator` role. Only the Operator Console's control runtime asks:

```ts
const control = startAppRuntime(container, { media: 'none', displayName: 'Operator Console', role: 'operator' });
const preview = startAppRuntime(previewContainer, { media: 'full', displayName: 'Operator Console preview' }); // no role: a viewer
```

* Without `role` (the default) the hello carries no `role` field and every session is a viewer. The client still announces protocol 1.1.
* The server decides the role once per session; a reconnect decides again. Read the granted role from `state.role` (`'viewer'`, `'operator'`, or `null` while no session is up). A 1.0 server sends no role, so its sessions read `'viewer'`.
* `ServerConnectionOptions.authToken` (`string | null`) is reserved: servers ignore it. Nothing sets it yet. The client never logs it, and the constructor refuses a token over 4096 characters or a role over 64.

### Read newer servers [#read-newer-servers]

A session whose `server.hello` announces 1.1 reads server messages tolerantly (§16): a message of a type the client doesn't know, and unknown fields of a known message, are ignored. Each kind is logged once per session as a warning; after 16 kinds the rest go unlogged. A known field with an invalid value still fails that one connection with `invalid-message`. A session that announces 1.0 reads as before 1.1: an unknown type fails the connection, and unknown fields are dropped silently. A server announces the lower of its minor and the client's, so a 1.1 server answering the 1.0 retry below announces 1.0. The client also caps the session's minor at what it announced itself: in the 1.0 retry a server announcing 1.1 gets no role, no takeover and no tolerant reader.

### Connect to a 1.0 server [#connect-to-a-10-server]

A 1.0 server rejects a hello that carries `role` or `authToken` with `invalid-message`. The connection then retries **once**, on a new session, with a 1.0 hello without those fields, and the session is a viewer:

* `state.helloFallback` is `'minor-0'`, and a `hello-fallback` event names the rejected session. `connect()` resolves with the retry's outcome. The rejected session raises no `closed` event, so the state goes from `connecting` to `connected` without an error in between.
* A second rejection is reported as it is; there is no further retry.
* Any other code, or a rejection after the hello was accepted, never triggers the retry.
* It is not sticky: every reconnect starts again with the 1.1 hello.

### Take over the setup lock [#take-over-the-setup-lock]

`acquireLock({ takeover: true })` (also on the pipeline) asks to end a lease someone else holds. The server's answer passes through unchanged, for example `role-required` for a viewer or `rate-limited`. On a 1.0 server the request is refused locally as `unsupported-by-server` and nothing is sent. The connection never retries it.

The evicted owner receives the `server.lock.state` that names the new owner, as it arrives. Its connection then emits `lease-lost` with `cause: 'owned-by-other'`. The other causes are `'unlocked'` (the lease expired or reached the 30-minute cap) and `'heartbeat-rejected'`. A heartbeat refused with `rate-limited` is not a loss: the lease is kept and the 5-second cadence stays.

Every `server.lock.state` the client applies is also a `lock-state` event. `connection.serverLock` holds the lock as the server last stated it: from the hello or a resync snapshot, then from each applied `server.lock.state`, with the server's own `expiresAtUs` as a `bigint`. It is `null` only while no session is up. Near the cap that value stops advancing. Use it for a remaining-time display; `state.lock` also moves on local heartbeat renewals.

An operator session gets `server.operator.replay-complete` after every hello and snapshot, as an `operator-replay-complete` event. Its `metadataRevision` is never an increment. A viewer session drops the message.

### Use the entry's connection [#use-the-entrys-connection]

`model.pipeline(id).connectionView` is the entry's connection without `connect()` and `disconnect()` (type `EntryConnection`). Use it for state, events, subscriptions and requests. `pipeline(id).connection` still exists but is deprecated: its `disconnect()` stops the manager's entry and its reconnects. Remove an entry with `model.remove(id)`.

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

## Control the cloud view and shut down [#control-the-cloud-view-and-shut-down]

The model that `ready` resolves with has four members for a live preview. All are no-ops without a rendering backend, and none allocates per frame.

| Member                                                                                     | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frameAll(): boolean`                                                                      | Fits the visible cloud into the orbit camera and keeps the viewing direction. The fit comes from the camera rig's view frusta, capped at 3 m depth, not from the points, so it doesn't follow the subject. It always jumps, so reduced motion needs no special case. Returns `false` and changes nothing when no bundle is visible.                                                                                                                                                                                                                                       |
| `resetView(): void`                                                                        | Restores the default orbit pose. Also a jump.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pointsDrawn(): number \| null`                                                            | An **estimate** of the points drawn. For each drawn bundle, the client counts the depth codes inside the valid range on a grid of every 4th pixel in both directions, inside the bundle's tiles only, and multiplies by 16. Invalid, below-range and above-range codes aren't counted, so a scene with only background reads `0`. It samples from the depth plane the upload already holds (no extra copy, WebCodecs or the built-in decoder), at most once a second per bundle. `null` before the first sample. Bundles turned off with `setBundleVisible` are excluded. |
| `setBundleVisible(entryId: ConnectionEntryId, bundleId: BundleId, visible: boolean): void` | Turns one bundle's cloud off or on at once, independent of its subscription. The bundle keeps streaming and uploading, and tile views are unaffected. A bundle you turned off stays off across reconnects and when it leaves and re-enters the scene, until you set it visible or remove the server entry. Its status line reads "ready, hidden". `frameAll` and `pointsDrawn` ignore it.                                                                                                                                                                                 |

A bundle whose stream ends leaves the scene: after an accepted `client.unsubscribe`, an unavailable bundle or a bundle removed by a snapshot, its last frame is removed instead of staying frozen. Frames still being decoded when the stream ended are dropped, not shown. Its textures stay, and the next decoded pair makes it appear again. This includes the hidden-tab pause: the cloud goes after the tab has been hidden for 10 seconds and the server has accepted the unsubscribe, never while a WebXR session presents, and it returns after the tab is shown again.

On-demand rendering draws at most once per animation frame, and only after an upload or camera movement, so the cloud never draws faster than the capture delivers. There is no frame-rate cap to set.

`handle.dispose()` returns a `Promise<void>`. It resolves once the WebTransport sessions have settled `closed` and the GPU device is released, each wait bounded by 2 seconds, and it never rejects. Calling it twice returns the same promise, and callers that ignore the result keep working.

## Enter VR (experimental, behind a flag) [#enter-vr-experimental-behind-a-flag]

**Experimental.** `startAppRuntime(container, { xr: true })`, or `?xr=1` in the page URL (dev server and packaged build alike), adds an **Enter VR** button next to the side-panel toggle. Without WebXR in the browser there is no button; without VR support it is unavailable, and its tip says why. The flag is off by default; with it off the client creates and loads nothing for VR, and the page, the engine choice and `client.hello` are unchanged.

With the flag on and VR supported, the renderer starts on WebGL2, because the 3D engine presents VR only on WebGL2. In the headset a status pill and a panel (Servers, View, Place, Exit VR) show the same servers as the desktop. Each server row shows its capture-to-display time. A server is **Delayed** above 200 ms and **Stale** after more than 1 s without a new frame. Points between you and the open panel (or the pill) are drawn darker, so the text stays readable. On Vision Pro the points fade out near the edge of the play area. Where the headset supports it, both eyes are drawn in one pass (multiview). Not built yet: the Notices list and some View toggles. No headset has run this yet: treat it as a test build.

Every page load also checks once whether this browser could present VR on WebGPU, and writes the answer under **Renderer notes** in the side panel header, for example `VR engine: WebGL2. WebGPU-XR probe failed (navigator.xr is absent).` This never delays start-up.

## Troubleshooting [#troubleshooting]

* **A subscribe returns `not-decode-compatible`**: expected with `media: 'none'`. The runtime told the server it decodes nothing, so `connection.compatibility` has `renderingCompatible: false` and `clientRole(compatibility)` (`client/src/state/compatibility.ts`) returns `control-only`. Start a runtime with `media: 'full'` to draw.
* **`Opening handshake failed.` with a hash**: the hash doesn’t match the certificate, or the certificate breaks the browser’s rules. Check that you hashed the DER bytes, not the PEM file. The certificate must be ECDSA P-256 and valid for less than 14 days.
* **`serverCertificateHashes[0]: a SHA-256 certificate hash has 32 bytes, got N`** in `sourceIssues`: the value is not a SHA-256 digest. Build it with `parseCertificateHash`.
* **`This page’s server offers no transport discovery: add the server by its URL`** on a `discovered` card: the origin answered 404 before any connection succeeded through discovery. The client doesn’t retry. Once a connection has succeeded through discovery, a 404 counts as a passing outage, and the client retries with backoff.
* **`transport discovery: … answered HTTP 500`**, **`fetching … failed`**, **`timed out after 5000 ms`**, **`not a discovery document (Content-Type …)`** or **`Rejected transport discovery document`**: this attempt failed. The client retries with backoff and fetches the document again each time.
* **Safari**: assume `serverCertificateHashes` isn’t supported. Use a certificate from a certificate authority the browser trusts.
