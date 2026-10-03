# Run the client (https://irc-hslu.github.io/orbbecstreamer/docs/client/dev-build)





The client is a web page that you serve from your own machine with a development server. You install it once, start the server, then open the page in your browser.

## Install and start the client [#install-and-start-the-client]

You need Node.js 24 with npm, and a copy of the OrbbecStreamer repository. The client was built and tested with Node.js 24; the repository doesn’t require a particular version.

1. Install the client’s dependencies. Run this in the repository’s top folder:

   ```bash
   cd client
   npm ci
   ```

   `npm ci` installs the exact versions listed in `client/package-lock.json`.

2. Start the development server. Run this in the `client` folder:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173/](http://localhost:5173/) in your browser.

Leave the terminal open while you use the client. To stop the server, press **Ctrl+C** in that terminal.

## What you should see [#what-you-should-see]

The terminal shows a line like `VITE v6.4.3  ready in 300 ms`, then `➜  Local:   http://localhost:5173/`. The version and time may differ. In the browser, the page shows a dark 3D view on the left and a side panel on the right. On a narrow window, the panel moves below the 3D view.

<img alt="The client right after it opens: an empty dark 3D view on the left, and the side panel on the right with the renderer and decoder lines, the Add server and Open recording forms, the Dev: mock server section, an empty Servers list and an empty World anchors section" src="__img0" />

From the top, the side panel shows:

* **Header**: `OrbbecStreamer client`, the protocol version, and the `renderer:` and `decoders:` lines. [Check your browser](/docs/client/browser-requirements) explains them.
* **Add server**: connect to a capture server. See [Add a server](/docs/client/add-a-server).
* **Open recording**: play recorded files. See [Play a recording](/docs/client/playback).
* **Dev: mock server**: add a simulated server. This section exists only in the development server.
* **Servers (0)**: one card per server you add.
* **World anchors (0)**: see [Move an anchor in your view](/docs/client/world-anchors).

## Build a static copy [#build-a-static-copy]

You don’t need this step to use the client. It makes a folder of static files you can serve with any web server. Run this in the `client` folder:

```bash
npm run build
npm run preview
```

`npm run build` checks the code and writes the files to `client/dist/`. `npm run preview` serves that folder at [http://localhost:4173/](http://localhost:4173/). The built copy has no **Dev: mock server** section.

## Troubleshooting [#troubleshooting]

These are the problems people hit most when starting the client:

* **`Error: Port 5173 is already in use`**: another development server is running. Stop it, or start this one on another port and open that port instead. In the `client` folder:

  ```bash
  npm run dev -- --port 5174
  ```

* **`npm: command not found`**: Node.js is installed without npm on this machine. Install npm with your Node.js distribution. Once `client/node_modules/` exists, you can also start the server without npm. In the `client` folder:

  ```bash
  ./node_modules/.bin/vite
  ```

* **The panel says `renderer: rendering-incompatible`**: your browser can’t draw 3D. See [Check your browser](/docs/client/browser-requirements).

* **Nothing works when you open the page from another computer**: the development server only answers on this computer (`localhost`). Browsers also turn off the features the client needs on plain `http://` pages that aren’t `localhost`. Open the client on the machine that runs it. The repository has no HTTPS setup for the development server yet.
