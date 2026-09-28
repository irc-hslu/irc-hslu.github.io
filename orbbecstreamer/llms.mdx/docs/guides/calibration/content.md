# Calibration (https://irc-hslu.github.io/orbbecstreamer/docs/guides/calibration)



There are three calibration kinds. Each one is a server-side state with an
optional client-side workspace to run it from. Today the server and client
cannot talk to each other at all (see [Serve to browsers](/docs/server/serving)),
so every client-side calibration in this table works only against the
client's own built-in mock server, not against a real `orbbec_streamer`.

| Kind               | Server                                                                                               | Client                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera pose        | Works, from the local console. [Camera pose calibration](/docs/server/camera-calibration).           | Placeholder screen only; no controls. [Calibration](/docs/client/calibration#camera-pose).                                                                                    |
| Depth quantization | Works, from a CLI tool. [Depth quantization calibrator](/docs/server/depth-quantization-calibrator). | Start, watch, cancel and commit a run against the mock server. [Calibration](/docs/client/calibration#depth-quantization), [Mock server](/docs/client/developer/mock-server). |
| Network            | Not available. A stream is reserved in the wire format (§1); no calibration procedure exists yet.    | Not available: waits for change request 0018.                                                                                                                                 |

Once WebTransport serving exists, the client's depth-quantization workspace
is expected to work the same way against a real server. Until then, run
camera pose and depth quantization calibration on the server console: see
[First stream](/docs/getting-started/first-stream) for a config already set
up for your cameras.
