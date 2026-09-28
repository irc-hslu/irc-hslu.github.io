# Placement (https://irc-hslu.github.io/orbbecstreamer/docs/guides/placement)



Placement fixes where each server's point cloud sits in a scene shared by
several servers. Nothing here is available to a user yet.

| Side   | Status                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Server | Accepts a revisioned placement commit over the control protocol, but nothing sends one yet.                                             |
| Client | No placement editor. Every server is drawn where its own stored placement puts it. [Placement editing](/docs/client/placement-editing). |

Once the client ships a placement editor, it will commit through the path
the server already accepts.
