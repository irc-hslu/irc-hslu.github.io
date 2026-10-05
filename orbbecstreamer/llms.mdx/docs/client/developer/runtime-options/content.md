# Runtime options for embedding (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/runtime-options)



A page that embeds the client runtime, such as the Operator Console, starts it with `startAppRuntime(container, options)` from `client/src/app/appRuntime.ts` and adds servers with `model.add(source)`. This page covers two options for that: a control-only runtime, and pinned server certificates.

## Start a control-only runtime [#start-a-control-only-runtime]

Use this when the page shows server state and runs setup, but draws no point clouds.

```ts
import { startAppRuntime } from '../app/appRuntime.js';

const runtime = startAppRuntime(container, { media: 'none', displayName: 'Operator Console' });
const model = await runtime.ready;
model.add({ kind: 'webtransport', url: 'https://capture-01.local:4433/orbbec' });
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

## Pin a server certificate [#pin-a-server-certificate]

Use this when the browser runs on the server PC and the server uses a short-lived self-signed certificate (release ADR-0004). The browser then checks the certificate against the hash you give it instead of a certificate authority. [Serve to browsers](/docs/server/serving#development-a-pinned-certificate-hash) explains the certificate rules (ECDSA P-256, valid for less than 14 days) and how to compute the hash.

```ts
import { parseCertificateHash } from '../app/serverSource.js';

const hash = parseCertificateHash('8e:dd:4a:62:46:85:ea:98:17:dd:fa:1d:34:cd:39:b7:28:86:fc:b0:a1:71:a5:15:f4:d5:29:74:43:53:ce:87');
if (!hash.ok) throw new Error(hash.issues.join('; '));
model.add({ kind: 'webtransport', url: 'https://127.0.0.1:4433/orbbec', serverCertificateHashes: [hash.value] });
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

## Troubleshooting [#troubleshooting]

* **A subscribe returns `not-decode-compatible`**: expected with `media: 'none'`. The runtime told the server it decodes nothing, so `connection.compatibility` has `renderingCompatible: false` and `clientRole(compatibility)` (`client/src/state/compatibility.ts`) returns `control-only`. Start a runtime with `media: 'full'` to draw.
* **`Opening handshake failed.` with a hash**: the hash doesn’t match the certificate, or the certificate breaks the browser’s rules. Check that you hashed the DER bytes, not the PEM file. The certificate must be ECDSA P-256 and valid for less than 14 days.
* **`serverCertificateHashes[0]: a SHA-256 certificate hash has 32 bytes, got N`** in `sourceIssues`: the value is not a SHA-256 digest. Build it with `parseCertificateHash`.
* **Safari**: assume `serverCertificateHashes` isn’t supported. Use a certificate from a certificate authority the browser trusts.
