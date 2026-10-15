# Run two servers on one host (https://irc-hslu.github.io/orbbecstreamer/docs/server/multi-server)



A client fuses several rigs by connecting to one server per rig and laying out each server's per-camera clouds with that server's committed placement (`protocol/wire-format.md` §7, §9, §14, §18). The server side is plain: each instance is an ordinary single-server run. This page covers running two on one machine, for example one camera per instance.

## What each instance must own [#what-each-instance-must-own]

Instances share nothing at run time; everything below is set in the instance's own config. Example configs for two instances are in `server/config/multi-server/` (`rig-a.yaml`, `rig-b.yaml`).

| Resource                    | Setting                                                                                                                                                       | Rule                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera                      | `cameras[].serial_number`                                                                                                                                     | One serial per instance. Opening a device is exclusive.                                                                                            |
| WebTransport and page ports | `serving.listen_address`, `serving.page_listen_address`, `serving.page_http_listen_address`                                                                   | Distinct ports (the examples use 4443 and 4444).                                                                                                   |
| Gateway process             | spawned by the instance                                                                                                                                       | One gateway per instance. The core-to-gateway link is a socketpair, so it has no path to collide.                                                  |
| Identity                    | `serving.server_id`, `serving.server_name`                                                                                                                    | Distinct `server_id`. The default is `orbbec-streamer@<hostname>`, the same for both instances on one host, so a client could not tell them apart. |
| State                       | `calibration.camera_pose_path`, `calibration.placement_path`, `encoding.depth.quantization_profile_path`, `run.sensor_config_path`, `run.stream_profile_path` | Distinct files. The defaults are relative to the working directory and shared by name.                                                             |
| Recording and logs          | `debug_recording.directory`                                                                                                                                   | Distinct directory.                                                                                                                                |
| Dev certificate hash        | `serving.dev_certificate_hash_path`                                                                                                                           | Distinct file. Each instance has its own certificate, so the browser pins one hash per server.                                                     |
| Crash files                 | `serving.crash_directory`                                                                                                                                     | Distinct directory.                                                                                                                                |
| TensorRT engine cache       | `mask.rvm_engine_cache_dir`                                                                                                                                   | May be shared. Builds take a lock file, and the same engine serves both.                                                                           |

With one camera, set `sync.enabled: false` and give the camera the `primary` role, as the examples do. The two instances are not hardware-synchronised with each other; fusion across servers aligns by the clock sync of wire-format §14 and the capture timestamps, not by a trigger cable.

## Start [#start]

```sh
orbbec-streamer --live config/multi-server/rig-a.yaml
orbbec-streamer --live config/multi-server/rig-b.yaml
```

Calibrate and commit placement on each server separately (the setup lease is per server). A placement commit on one server changes nothing on the other. The client reads each server's `placementRevision` and `server.placement.updated`.

## Tested [#tested]

`gateway_serving_tests` runs two servers (each with its own controller, hub and fake gateway, one camera each) with one client. It checks that the two `serverId` values differ, that a placement commit on each (lease and `expectedRevision`) is acknowledged and announced by that server only, and that media reaches the client from both. A config test checks that the shipped examples share no port, path or identity.

Not yet checked: two real rigs on one machine under load (needs the second rig).
