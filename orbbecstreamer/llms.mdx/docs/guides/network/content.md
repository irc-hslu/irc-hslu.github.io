# Network sensing (https://irc-hslu.github.io/orbbecstreamer/docs/guides/network)







**Network sensing** is how OrbbecStreamer learns about the network between
a server and a viewer. It only measures and reports. It does not change the
bitrate, the encoder settings or what the server sends.

It is part of protocol 1.2 (change 0018), from v0.1.1. It works only
between a server and a viewer that both support it. A viewer or server without it sees nothing new.

## How it works [#how-it-works]

Sensing is **passive**. Each side works out its numbers from traffic that
already flows: the connection's own statistics, the media it receives, and
the regular round-trip checks between viewer and server. It sends no extra
test traffic.

It is **periodic**. Each side sends a report about once a second, and an
extra one when a number moves a lot. A side never sends more than four
reports a second.

It runs in **both directions**:

* The server measures towards each viewer: round-trip time, how much data
  it got through to that viewer, and how much was lost on the way.
* Each viewer reports back what it sees: round-trip time, how fast data
  arrives, and how long data waits in the network.

Loopback, local network and remote viewers are measured the same way.

A viewer only sees the numbers for its own connection. The
[Operator Console](/docs/operator) is meant to show every viewer's numbers
side by side. No viewer gets another viewer's numbers or an address.

## Read the estimates [#read-the-estimates]

Every number comes with a few words that say how far to trust it.

| Word                                | What it tells you                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Lower bound                         | The real value is at least this high. The Operator Console shows "≥" before the value.          |
| Confidence: `low`, `medium`, `high` | How steady the recent samples were. It says nothing about whether the number is the true limit. |
| Not measured                        | No valid value. It is never guessed.                                                            |

### Lower bound [#lower-bound]

Most rates are lower bounds. The server only sends as much as the cameras
produce, so a rate it reaches is not the most the path could carry. The
rate at which data arrives at a viewer is always a lower bound, and so is
the burst rate.

Treat a number as the path's real capacity only if it is not a lower bound
and its confidence is `medium` or `high`.

### Confidence [#confidence]

Confidence is about **precision**, not accuracy. Over the last few seconds,
`high` needs at least 5 samples that agree closely. `medium` needs at least
3 that agree fairly well. Anything else is `low`.

A `high` lower bound is a steady number that is still only a floor.
A `low` number may just be new: a connection that started a moment ago has
few samples.

### Not measured [#not-measured]

A number that is "not measured" has no valid samples yet, or can't be
measured on that side. Some are only missing at first. For example, the
loss figure needs data to have been sent in the window.

## What a browser can't measure [#what-a-browser-cant-measure]

A browser tab can see less of the connection than the server can. These
stay "not measured" on the viewer side, whatever the network does:

* **Packet loss, in either direction.** Only the server's sending side sees
  loss, so loss is reported for the server-to-viewer direction only.
  Viewer-to-server loss isn't measured at all.
* **The viewer's own sending rate** and the capacity of the viewer-to-server
  path. The server reports how fast it receives data from the viewer. That is
  a sanity check, not a capacity figure.
* **Connection internals** such as congestion window, data in flight,
  acknowledgement timing and congestion marks.
* **Anything while the tab is hidden.** A browser slows hidden tabs, which
  would look like a network collapse. The viewer marks the report as
  suspended instead of reporting a drop.

Some browsers expose connection statistics and some don't. Sensing doesn't
depend on them: round-trip time from the regular checks and the rates from
arriving media always work.

## The Operator Console's Network panel [#the-operator-consoles-network-panel]

The **Network** panel (`/operator/network`, in the left navigation) shows
the estimates for every session connected to the server, one row each. Only
sessions with the [operator role](/docs/operator#the-operator-role) see it;
open the console on the server PC. Your own session is marked **You**.

<img alt="The Network panel with five sessions: role, peer, the rates in both directions, round-trip time, loss, queue delay and report age for each" src="__img0" />

*Captured against the client's mock server, so the sessions and figures are made up.*

The columns are **Session**, **Role**, **Peer**, **Server to client rate
(approx.), Mbit/s**, **Media, Mbit/s**, **Client to server rate, Mbit/s**,
**RTT smoothed / min, ms**, **Loss s→c, %**, **Queue delay p95, ms** and
**Report age**. The small bars after a number show its confidence. Select
**+** on a row for its **Measurement details**.

<img alt="A session's measurement details: each measure with its lower-bound mark, confidence and number of samples" src="__img1" />

How to read the cells:

| You see                | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `≥` before a value     | A lower bound: the real value is at least this high. Screen readers say "at least". |
| `— not measured`       | No valid estimate yet, or one the browser can't give.                               |
| `not reporting`        | The session's client sends no network reports, for example an older client.         |
| `no client report yet` | The client reports, but its first report hasn't arrived.                            |
| `unknown`              | The server sent a value this console doesn't know.                                  |

**Loss s→c** is only the loss from the server to the viewer: the browser
doesn't expose the loss in the other direction.

On **Overview**, the Network row sums it up as `N sessions · worst RTT … ·
worst loss …`, with the same `≥` and `(low confidence)` marks.

Other messages on the panel:

| Message                                                                          | Meaning                                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `This server does not report network numbers. It needs protocol 1.2 or later; …` | The server is v0.1.0 or older. Update the server, then reload. |
| `Waiting for network telemetry`                                                  | The panel has opened and the first report hasn't arrived yet.  |
| `Network telemetry stopped arriving. Values shown are as of …`                   | Reports stopped; the numbers are from that time.               |
| `The server lists at most 64 sessions. More may be connected and are not shown.` | The server caps the list.                                      |
| `No other sessions are connected.`                                               | Only this console is connected.                                |

## Active probes [#active-probes]

Active probes are short, deliberate bursts of test data that fill gaps when
passive data is thin. From v0.1.1 the server has them, but they are **off
by default**: the server offers them to no session and sends no probe
traffic.

The packaged `/etc/orbbec-streamer/live.yaml` lists the key commented
out. To try probes, set it under `serving:` and run
`sudo systemctl restart orbbec-streamer`:

```yaml
serving:
  network_probes: true
```

Turn them on at your own risk: probes add traffic on top of the live
streams. Only viewers whose browser client supports probes take part. The
release notes say when the default changes.

A server older than v0.1.1 doesn't know the key and refuses to start with
`Unsupported serving key: network_probes`. Before you downgrade, delete
the line from `live.yaml`.

## See also [#see-also]

* [Operator Console](/docs/operator)
* [Network reports on the server](/docs/server/serving#network-reports-protocol-12)
