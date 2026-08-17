# Monopoly Banker

A local, offline digital banker for physical-board Monopoly. Keep the real
board, dice, tokens, and cards on the table — this app handles cash,
property ownership, rent, mortgages, houses/hotels, trades, bankruptcy,
and the full transaction history.

No account, no cloud, no internet connection required after install.

## Run it

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Vite will print a local URL, typically:

```
http://localhost:5173
```

Open that in your browser and you're playing.

## Use it from other devices on the same Wi-Fi

The dev server is already configured to listen on your network. When you
run `npm run dev`, look for the second URL it prints, e.g.:

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.10:5173/
```

Open the **Network** address on a phone or tablet connected to the same
Wi-Fi to view/use the same interface. Note: each device runs its own
browser-local copy of the game data (see "How saving works" below) — this
isn't a shared live multiplayer sync, so for now, treat one device as the
official banker and have players glance at it rather than editing from
multiple screens at once.

## How saving works

Game state is written to the browser's IndexedDB after every action.
Closing the tab, closing the browser, or restarting your computer won't
lose your game — reopen the app and pick up exactly where you left off,
from the **Continue Game** or **Saved Games** screen.

Data is stored per-browser, on that one device. Clearing your browser's
site data for this app (or opening it in a different browser/profile)
will start you with a clean slate.

## Building for production / a static host

```bash
npm run build
```

This outputs a static `dist/` folder you can open with `npm run preview`
or host on any static file server — still no backend required.

## Project structure

```
src/
  App.jsx       — the entire game: board data, engine, and UI
  storage.js    — IndexedDB persistence layer
  main.jsx      — React entry point
```

The Monopoly board data, rents, and rules live in a single dataset near
the top of `App.jsx` (`BOARD`), separate from the UI, if you want to
adjust prices or house rules.
