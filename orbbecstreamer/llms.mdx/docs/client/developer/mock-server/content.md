# Mock server (https://irc-hslu.github.io/orbbecstreamer/docs/client/developer/mock-server)



The mock server (`client/src/media/playback/mockServer.ts`) simulates one OrbbecStreamer capture server inside the client, on the same byte-level seam a WebTransport session uses. Real `ServerConnection`s connect to it, so the following run exactly as against a real server, with no network and no hardware:

* the handshake and snapshots;
* the setup lock, calibration and placement commits;
* shared-update filtering;
* media streams.

How it behaves:

* **Sessions**: one `MockServer` holds one server state. Every client that opens it gets its own session, and a reconnect opens a new session.
* **Time**: it comes only from the scheduler you pass in. With a `ManualScheduler`, every run is deterministic.
* **Media**: it comes from a recording (`.hevc` colour and depth files plus a manifest), the same format as recording playback. Without a recording the server has no media.
* **Open contract questions**: where the protocol contract is still open, the mock follows the client’s pending change requests (0007, 0008, 0009, 0012, 0014), listed at the top of `mockServer.ts` and on [Contract gaps and interim behaviour](/docs/client/developer/interim-behaviour). A real server may behave differently until those are decided.

## Use the mock server [#use-the-mock-server]

In a test:

```ts
const scheduler = new ManualScheduler(0n);
const created = createMockServer({ scheduler, snapshot: snapshotFixture() });
if (!created.ok) throw new Error(created.issues.join('; '));
const mock = created.value;
const connection = new ServerConnection({
  url: mock.url,
  opener: mock.opener(), // one opener per client
  scheduler,
  // clientId, displayName, platform, decoderProbe, ...
});
await connection.connect();
```

With media, create it from a recording:

```ts
const created = createMockServerFromRecording(manifest, bytesByKey, scheduler);
```

In a dev page or in composition code, add it as a source:

```ts
manager.add({ kind: 'mock', server: mock });
```

Create the mock on the same scheduler as the connection manager. Each connection manager that uses the same mock is another client of the same server. Two entries in one manager reach the same server id, and the second one reports a conflict.

Useful controls:

* **Scenario**: `setStreaming`, `setBundleAvailability`, and calibration scripts passed in `createMockServer({ calibration })`: duration, progress interval, accepted or failed, new camera poses or a new depth profile, and a depth-code histogram per progress message (`depthHistogram`; `syntheticDepthHistogram` in `src/dev/devMock.ts` is a ready-made one). The shell’s “Add mock server” scripts a 6 s depth-quantization run with that histogram.
* **Faults**: `dropSession`, `closeSession`, `delaySession`, `stallSession` / `resumeSession`, `sendMalformed`, `skipRevisions`, `sendStaleRevision`, `refuseSnapshots`, `expireLease`.
* **Inspection**: `sessions()`, `sessionOf(clientId)`, `lockHolder()`, `snapshot()`, `metadataRevision`, `session.requestCounts`, `session.mediaStats(bundleId)`.

## What you should see [#what-you-should-see]

* A client connects and receives a snapshot. With a recording, it receives paired colour and depth frames after it subscribes.
* The setup lock is exclusive. It stays held while its owner heartbeats every 5 s, and it expires 15 s after the last heartbeat.
* A calibration commit or placement commit reaches every client as a revision notice. Clients that opted in to shared updates, and the client that made the change, also receive the placement or calibration result itself. A placement commit restarts the media streams, which resume with a keyframe.
* Each fault drives the client’s recovery path: a resync, a reconnect, or `resync-failed` followed by a reconnect.

In the browser, with the dev server running (`npm run dev` in `client/`):

* **The app**: the side panel of [http://localhost:5173/](http://localhost:5173/) has a “Dev: mock server” section. **Add mock server** adds a mock as a new server card, with the source `mock mock://dev-mock-…`.
  * It is snapshot-only (`snapshot only, no media`). Only where a local copy of the unpublished sample recordings exists in `client/reference/hevc-web/` does it serve them (`reference recording`); see [Sample recordings](/docs/client/developer/test-the-client#sample-recordings).
  * The section exists only in the dev server. A production build (`npm run build`) contains no mock code.
* **Two clients of one mock**: the [cards check](/docs/client/developer/cards-check), [setup check](/docs/client/developer/setup-check) and [placement check](/docs/client/developer/placement-check) pages.

## Fix mock server problems [#fix-mock-server-problems]

* **`createMockServer` returns `ok: false`**: read `issues`. It needs a snapshot or a recording, the snapshot must be valid, and the snapshot’s lock must be free.
* **Nothing happens in a test**: a `ManualScheduler` only moves when you call `advanceBy` or `advanceTo`, and replies need a few microtask turns to settle.
* **No media**: check all of the following.
  * The mock needs a recording.
  * The client must subscribe, or list the bundle in `preferredBundleIds`.
  * The server must be `streaming`, with the bundle available.
  * If the snapshot has `autocalibrate` set, media is held until camera-pose is committed.
* **`skipRevisions` does not make the client resync**: a forward revision gap is not treated as an error until change request 0007 is decided. Use `sendStaleRevision` to exercise the resync path.
