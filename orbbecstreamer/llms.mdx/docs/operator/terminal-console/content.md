# Terminal console (preview) (https://irc-hslu.github.io/orbbecstreamer/docs/operator/terminal-console)



`orbbec-console` is the Operator Console for a terminal. It ships with the
release package from poc.4 on. It shows whether the server service is
running and starts or stops it.

In poc.4 the server still refuses the terminal console's connection. Live
status (cameras, calibration, streaming), the setup lock and calibration
from the terminal therefore **come in a later release**. Until then, use
the browser [Operator Console](/docs/operator) for live status.

## Run it [#run-it]

On the server PC:

```bash
orbbec-console
```

| Key                | Action                                         |
| ------------------ | ---------------------------------------------- |
| `s`                | Start the server, when it isn't started        |
| `x`                | Stop the server, after a confirmation          |
| `l`, `L`           | Take or release the setup lock                 |
| `c`                | Start a camera-pose calibration run            |
| `d`                | Start a depth-quantization calibration run     |
| `a`                | Cancel the running calibration                 |
| `k`                | Commit the solved result, after a confirmation |
| `Tab`, `Shift+Tab` | Move between panes                             |
| `m`                | Minimise or reopen the focused pane            |
| `r`                | Reopen all panes                               |
| `?`                | Help                                           |
| `q`, `Ctrl+C`      | Quit                                           |

The lock and calibration keys (`l`, `L`, `c`, `d`, `a`, `k`) need a server
that accepts the console, which comes in a later release. Each pane lists
only the keys that work right now. Commit always asks first, for
example `Commit the solved <kind> result? It replaces revision N.`

The terminal must be at least 80 columns by 24 rows. With less height, the
panes you aren't in collapse to their titles. Every state is also written
out in words, so the console works without colour; it respects `NO_COLOR`.

**Expected result:** while the service is stopped, the console shows the
chip **SERVER NOT STARTED** and the line `Server not started  The
orbbec-streamer service is not running.`, then `Press s to start it`. It
connects by itself as soon as the server is up.

In poc.4 the server always refuses the console: its gateway answers the
connection with HTTP 400. The console then shows the chip **REFUSED BY
SERVER** and the headline **The server refused the terminal console**, and
retries every 60 seconds. Starting and stopping still work. Use the browser
console at `http://127.0.0.1:8080/operator` for live status. The refusal
ends with a later server release that adds the setting
`serving.allow_missing_origin`.

## Start and stop without sudo [#start-and-stop-without-sudo]

Starting and stopping goes through systemd. Members of the group
`orbbec-operators` may start, stop and restart the `orbbec-streamer`
service without an admin password. Replace `<user>` with the account name:

```bash
sudo adduser <user> orbbec-operators
```

Log out and in again for the group to apply. To take the right away again,
run `sudo deluser <user> orbbec-operators`.

The group covers only starting, stopping and restarting `orbbec-streamer`.
Enabling or disabling it at boot, and any other service, still need an
admin. Without the group, the console asks for an admin password, or shows
the command to run instead: `sudo systemctl start orbbec-streamer`.

## Check the state from a script [#check-the-state-from-a-script]

```bash
orbbec-console status --json
```

It prints one line of JSON with `status` (`ok`, `not-started`,
`unreachable` or `refused`), the console version and a message, then exits:

| Exit code | Meaning                        |
| --------- | ------------------------------ |
| `0`       | OK                             |
| `2`       | The server isn't started       |
| `3`       | The server can't be reached    |
| `7`       | The server refused the console |

## Calibrate from a script [#calibrate-from-a-script]

This comes in a later release, once the server accepts terminal consoles.
In poc.4 the command exits with code `7`.

```bash
orbbec-console calibrate depth --commit
```

Use `pose` instead of `depth` for camera pose. Without `--commit`, the run
stops at a solved result without committing it. `--timeout 120s` sets how
long to wait. `Ctrl+C` cancels the run and releases the setup lock.

| Exit code | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| `0`       | Committed, or solved and ready to commit                   |
| `3`       | The server can't be reached                                |
| `4`       | The calibration failed                                     |
| `5`       | The setup lock isn't available                             |
| `6`       | The server refused the command; the reason code is printed |
| `7`       | The server refused the console                             |
| `130`     | Interrupted                                                |

## Try it without hardware [#try-it-without-hardware]

```bash
orbbec-console --demo
```

This runs the console against a built-in fake server with three cameras,
so you can see the full layout: Status, Cameras, Calibration, Streaming
and Log. `orbbec-console --demo-calibration` plays a calibration run with
the setup lock.

## Other options [#other-options]

| Option                            | Meaning                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--version`                       | Print the version, for example `orbbec-console 0.1.0-poc.4`                                                                  |
| `--server https://host:port/path` | Connect to this address instead of the one the package publishes                                                             |
| `--cert-hash <hash>`              | Trust this SHA-256 certificate hash instead of the published ones: 64 hex characters, in either case, with or without colons |

By default the console reads the server's address and certificate hashes
from `/etc/orbbec-streamer/tls/public/transport.json` before every
connection, so a rotated certificate needs no action.

## Troubleshooting [#troubleshooting]

| Symptom                                                                                     | Cause and fix                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orbbec-console: command not found`                                                         | It ships from poc.4 on. Check with `dpkg -l orbbec-streamer`.                                                                                                                                                                                  |
| Starting asks for admin rights or prints a `sudo` command                                   | You aren't in `orbbec-operators`, or haven't logged in again since joining. See [Start and stop without sudo](#start-and-stop-without-sudo).                                                                                                   |
| **REFUSED BY SERVER** and **The server refused the terminal console** while the server runs | Expected in poc.4: the gateway answers with HTTP 400 because it admits only browsers until a later server release adds `serving.allow_missing_origin`. Use the browser console at `http://127.0.0.1:8080/operator`. Start and stop still work. |
| The calibration keys don't appear                                                           | Expected in poc.4. From a later release, they appear only while the server accepts the console and the action is possible, for example `k` only after a run is solved.                                                                         |
