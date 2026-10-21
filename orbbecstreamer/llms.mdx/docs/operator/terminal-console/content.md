# Terminal console (preview) (https://irc-hslu.github.io/orbbecstreamer/docs/operator/terminal-console)



`orbbec-console` is the Operator Console for a terminal. It ships with the
release package from poc.4 on. It shows whether the server service is
running and starts or stops it. From v0.1.0-poc.5 it also connects to the
server: it shows live status (cameras, calibration, streaming), takes the
setup lock, and runs and commits calibrations.

In poc.4 the server refuses the terminal console's connection, so there
only status and start/stop work; use the browser
[Operator Console](/docs/operator) for live status.

<Callout type="warn">
  **The server PC is a single-operator machine.** The server admits the
  terminal console from the server PC only (loopback). Until the terminal
  console gets an authentication token, any local user or process on the
  server PC can take the same control: the setup lock, depth-range
  calibration and commits. Give accounts on the server PC only to people who
  may operate it. From v0.1.6 the terminal console asks for the
  [operator role](/docs/operator#the-operator-role) and gets it on the
  server PC; from v0.1.0-poc.9 to v0.1.5 it never got it. See
  [What the terminal console can't do](#what-the-terminal-console-cant-do).
</Callout>

## Run it [#run-it]

On the server PC:

```bash
orbbec-console
```

| Key                | Action                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `s`                | Start the server, when it isn't started                                                                          |
| `x`                | Stop the server, after a confirmation                                                                            |
| `l`, `L`           | Take or release the setup lock                                                                                   |
| `c`                | Start a camera-pose calibration run; the packaged server refuses it unless the pose is already valid (see below) |
| `d`                | Start a depth-quantization calibration run                                                                       |
| `a`                | Cancel the running calibration                                                                                   |
| `k`                | Commit the solved result, after a confirmation                                                                   |
| `Tab`, `Shift+Tab` | Move between panes                                                                                               |
| `m`                | Minimise or reopen the focused pane                                                                              |
| `r`                | Reopen all panes                                                                                                 |
| `?`                | Help                                                                                                             |
| `q`, `Ctrl+C`      | Quit                                                                                                             |

The lock and calibration keys (`l`, `L`, `c`, `d`, `a`, `k`) need a server
that accepts the console (poc.5 or later). Each pane lists
only the keys that work right now. Commit always asks first, for
example `Commit the solved <kind> result? It replaces revision N.`

The terminal must be at least 80 columns by 24 rows. With less height, the
panes you aren't in collapse to their titles. Every state is also written
out in words, so the console works without colour; it respects `NO_COLOR`.

**Expected result:** while the service is stopped, the console shows the
chip **SERVER NOT STARTED** and the line `Server not started  The
orbbec-streamer service is not running.`, then `Press s to start it`. It
connects by itself as soon as the server is up.

Once the server is up, the console connects and fills its panes: Status,
Cameras, Calibration, Streaming and Log.

### When the server refuses the console [#when-the-server-refuses-the-console]

The console then shows the chip **REFUSED BY SERVER**, a headline that
depends on the server's answer and on the `--server` address, and retries
every 60 seconds. Starting and stopping still work.

| Headline                                                             | Cause and fix                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **This server does not admit the terminal console**                  | The server config doesn't allow it. Set `serving.allow_missing_origin: true` (it applies to loopback only) and restart the service, or use the browser console at `http://127.0.0.1:8080/operator`. The package sets it from poc.5.                       |
| **The terminal console is admitted only over loopback**              | `--server` names an IP address of another machine, or this machine's network address. On the server PC, run it with `--server https://127.0.0.1:<port>`. From another computer, use the browser console.                                                  |
| **This server did not admit the terminal console from this address** | `--server` names a host name, and the server saw the connection come from the network. On the server PC, use `--server https://127.0.0.1:<port>` and check that `serving.allow_missing_origin` is `true`. From another computer, use the browser console. |
| **The server refused the terminal console**                          | An older server, such as poc.4, that admits only browsers; the cause isn't certain. Use the browser console, or check `journalctl -u orbbec-streamer`.                                                                                                    |

### When the server is at its session limit [#when-the-server-is-at-its-session-limit]

The console shows the chip **SERVER AT SESSION LIMIT** and **The server is
not taking new sessions**. The server has reached its limit of sessions per
address (`serving.max_sessions_per_ip`; the package sets 8 from poc.5, and
the server's own default is 4) or in total (`serving.max_sessions`), or is
shutting down. Close another console or browser tab connected to the
server; the console retries by itself.

## What the terminal console can't do [#what-the-terminal-console-cant-do]

From v0.1.0-poc.9, the server separates a viewer role from an operator
role (see [The operator role](/docs/operator#the-operator-role)).

From v0.1.6 `orbbec-console` asks for the operator role. The server gives
it when the console runs on the server PC and `serving.allow_missing_origin`
is `true`, as the package sets it. The header shows its role after the
server line: **Role: Operator** or **Role: Viewer (no setup lock)**. From
v0.1.6 only an operator can take the setup lock and calibrate the depth
range. As a viewer, `l` and `calibrate` don't try; they print `The setup
lock needs the operator role: run this console on the server machine; the
server must allow connections without Origin (serving.allow_missing_origin).`
and `calibrate` exits with code `9`.

From v0.1.0-poc.9 to v0.1.5, `orbbec-console` sends no `Origin`, so it never
gets the role. It is a viewer, but a viewer could still take the plain
setup lock and calibrate the depth range.

| It can                                                           | It can't                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Take and release the plain setup lock (`l`, `L`)                 | Take over a lock another session holds                                |
| Run, cancel and commit a depth-range calibration (`d`, `a`, `k`) | Change sensor settings or the stream profile; use the browser console |
| Start and stop the service (`s`, `x`) and show status            | Open or close the cameras                                             |

When another session holds the lock, wait for it to end or ask its
holder to leave setup, or take the lock over in the browser console.

### With the cameras closed [#with-the-cameras-closed]

From v0.1.0-poc.9, the server keeps its cameras closed after it starts,
until a client opens them, unless `serving.start_capture_on_launch` is
`true` in `live.yaml` (the package doesn't set it). From v0.1.0-poc.10, the
terminal console speaks protocol 1.1 and connects while the cameras are
closed. It shows status but can't open the cameras: use **Start cameras**
in the browser [Operator Console](/docs/operator#cameras-closed) or on the
server's card in the [client](/docs/client/server-card).

In poc.9 the terminal console speaks protocol 1.0, which the server refuses
with `capture-not-running` while the cameras are closed: open the cameras
first.

## Start and stop without sudo [#start-and-stop-without-sudo]

Starting and stopping goes through systemd. Members of the group
`orbbec-operators` may start, stop and restart the `orbbec-streamer`
service without an admin password. Replace `<user>` with the account name:

```bash
sudo adduser <user> orbbec-operators
```

Log out and in again for the group to apply. To remove the right again,
run `sudo deluser <user> orbbec-operators`.

The group covers only starting, stopping and restarting `orbbec-streamer`.
Enabling or disabling it at boot, and any other service, still need an
admin. Without the group, the console never asks for a password; it shows
the command to run instead: `sudo systemctl start orbbec-streamer`.

## Check the state from a script [#check-the-state-from-a-script]

```bash
orbbec-console status --json
```

It prints one line of JSON with `status` (`ok`, `not-started`,
`unreachable`, `at-capacity` or `refused`), the console version and a
message, then exits:

| Exit code | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `0`       | OK                                                                      |
| `2`       | The server isn't started                                                |
| `3`       | The server can't be reached, or is at its session limit (`at-capacity`) |
| `7`       | The server refused the console                                          |

## Calibrate from a script [#calibrate-from-a-script]

This needs poc.5 or later. In poc.4 the command exits with code `7`.

```bash
orbbec-console calibrate depth --commit
```

The console calibrates the depth range. With the packaged settings
(`autocalibrate: false`), `calibrate pose` is refused with
`calibration-requires-operator` (exit code `6`) unless the server already has a
valid camera pose, and then it only re-runs that pose. Calibrate a missing pose
on the server; see [Camera pose calibration](/docs/server/camera-calibration).

Without `--commit`, the run
stops at a solved result without committing it. `--timeout 120s` sets how
long to wait. `Ctrl+C` cancels the run and releases the setup lock.

| Exit code | Meaning                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `0`       | Committed, or solved and ready to commit                                       |
| `3`       | The server can't be reached, or is at its session limit                        |
| `4`       | The calibration failed                                                         |
| `5`       | The setup lock isn't available                                                 |
| `6`       | The server refused the command; the reason code is printed                     |
| `7`       | The server refused the console                                                 |
| `9`       | From v0.1.6: the setup lock needs the operator role (this console is a viewer) |
| `130`     | Interrupted                                                                    |

## Try it without hardware [#try-it-without-hardware]

```bash
orbbec-console --demo
```

This runs the console against a built-in fake server with three cameras,
so you can see the full layout: Status, Cameras, Calibration, Streaming
and Log. `orbbec-console --demo-calibration` plays a calibration run with
the setup lock.

With an 80×24 terminal, `orbbec-console --demo` looks like this (v0.1.0-poc.8):

```text
OrbbecStreamer console 0.1.0-poc.8 DEMO: scripted fake server          CONNECTED
▸ Status ready · unlocked · stopped ────────────────────────────────────────────
  Server   Demo rig (fake-server)  round trip 0.1 ms
  State    ready · lock unlocked · stream: stopped · revision 11
  Sync     Not reported — needs protocol change 0029
  License  Not reported — needs protocol change 0031
  Setup    Not reported — needs protocol change 0032
  Cameras 3 of 3 connected ─────────────────────────────────────────────────────
  ● Camera 1       cam-a    depth 640x576  connected
  ● Camera 2       cam-b    depth 640x576  connected
  ● Camera 3       cam-c    depth 640x576  connected
  Calibration pose valid, depth valid, network missing ─────────────────────────
  camera-pose         valid     rev 3
  depth-quantization  valid     rev 2
  network             missing   rev 0
  Lock     unlocked
  Keys     l take the setup lock
  Streaming (no room; Tab to it to open) stopped ───────────────────────────────
  Log  ─────────────────────────────────────────────────────────────────────────
  22:33:58  connected to Demo rig (fake-server), revision 11
Tab focus · m minimise · r restore all · ? help · q quit
```

The rows **Not reported — needs protocol change …** are values the server
doesn't send yet; they are not errors.

In `--demo-calibration`, press `l` to take the setup lock, then `d` to start
a depth-range run. After about 10 seconds the run is solved and waits for
your commit (`k`):

```text
OrbbecStreamer console 0.1.0-poc.8 DEMO: scripted fake server          CONNECTED
  Status (no room; Tab to it to open) ready · owned by this console · stopped ──
  Cameras (no room; Tab to it to open) 3 of 3 connected ────────────────────────
▸ Calibration pose valid, depth running, network missing ───────────────────────
  camera-pose         valid     rev 3
  depth-quantization  running   rev 2  solved; awaiting commit
  network             missing   rev 0
  Lock     held by this console · expires in 13 s
  Keys     L release · a cancel run · k commit
  Run      depth-quantization running · elapsed 10.0 s · valid samples 1785812
           observed range 480–4500 mm · reconstruction error not reported
  Depth        ▂▃▄▅▅▆▆▇▇▇▇▇█▇▇▇▇▆▆▅▅▄▃▂▂▃▃▄▄▄▅▅▅▆▆▆▆▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▆▆▆▆▅▅▅▄▄
           log · 0 invalid/masked 18000 · 1 below min 60 · 1023 above max 800
  Result   The solved depth-quantization result is ready; it replaces revision
           2. Not in force until committed (k). Server: solved; awaiting
           commit
  Streaming (no room; Tab to it to open) stopped ───────────────────────────────
  Log  ─────────────────────────────────────────────────────────────────────────
  22:33:58  connected to Demo rig (fake-server), revision 11
  22:34:00  lock: owned by Terminal Console
  22:34:00  calibration depth-quantization: running, revision 2: Show the scene…
  22:34:10  calibration depth-quantization: running, revision 2: solved; awaiti…
Tab focus · m minimise · r restore all · ? help · q quit
```

## Other options [#other-options]

| Option                            | Meaning                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--version`                       | Print the version, for example `orbbec-console 0.1.0-poc.8`                                                                  |
| `--server https://host:port/path` | Connect to this address instead of the one the package publishes                                                             |
| `--cert-hash <hash>`              | Trust this SHA-256 certificate hash instead of the published ones: 64 hex characters, in either case, with or without colons |

From poc.5, these options may also come before a command, for example
`orbbec-console --server https://127.0.0.1:4443/orbbec status`.

By default the console reads the server's address and certificate hashes
from `/etc/orbbec-streamer/tls/public/transport.json` before every
connection, so a rotated certificate needs no action. This works from
v0.1.3. In v0.1.2 the package writes that file in an older format, and the
console reports `unreachable`; pass `--server https://127.0.0.1:4443/orbbec`
and `--cert-hash` with the `sha256Hex` of the file's first entry. The hash
changes when the certificate rotates.

From v0.1.3 the address in that file is `https://127.0.0.1:4443/orbbec` unless you set
another one. If you moved the server's WebTransport endpoint, add
`transport_url = https://<IP address>:<port>/orbbec` under `[tls]` in
`/etc/orbbec-streamer/tls.conf` and run
`sudo systemctl start orbbec-tls-renew.service`, or wait up to an hour for
its timer. It rewrites the file even when no certificate is due. The host must be an IP
address, not a name. Any other value is ignored with a warning, and the
default stays.

## Troubleshooting [#troubleshooting]

| Symptom                                                   | Cause and fix                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unreachable` in v0.1.2 although the server runs          | The console can't read that version's address file. Pass `--server` and `--cert-hash`, or upgrade to v0.1.3; see [Other options](#other-options).            |
| `orbbec-console: command not found`                       | It ships from poc.4 on. Check with `dpkg -l orbbec-streamer`.                                                                                                |
| Starting asks for admin rights or prints a `sudo` command | You aren't in `orbbec-operators`, or haven't logged in again since joining. See [Start and stop without sudo](#start-and-stop-without-sudo).                 |
| **REFUSED BY SERVER** while the server runs               | See [When the server refuses the console](#when-the-server-refuses-the-console). In poc.4 this is expected.                                                  |
| **SERVER AT SESSION LIMIT**                               | Too many sessions from this machine. See [When the server is at its session limit](#when-the-server-is-at-its-session-limit).                                |
| The calibration keys don't appear                         | Expected in poc.4. From poc.5, they appear only while the server accepts the console and the action is possible, for example `k` only after a run is solved. |
