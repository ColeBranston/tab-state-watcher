# Tab State Watcher

A Chrome extension (Manifest V3, TypeScript) that notifies you when any of your open tabs changes state.

## What it watches

| Change | Default |
| --- | --- |
| Page finished loading | on |
| Title changed (e.g. new message counts) | on |
| URL changed | on |
| Started / stopped playing sound | on |
| Discarded / restored by Memory Saver | on |
| Started loading | off |
| Muted / unmuted | off |
| Pinned / unpinned | off |
| Tab opened | off |
| Tab closed | off |

Each change shows a desktop notification. Click it to jump to that tab. The toolbar badge counts unread changes, and the popup lists the 100 most recent ones. Click an entry to switch to that tab.

Settings (right-click the icon → **Options**):

- Turn each kind of change on or off.
- **Ignore the tab I'm currently looking at** (on by default).
- **Per-tab cooldown** so a noisy tab can't spam you (5 seconds by default). Every change is still logged in the popup.
- **Keep notifications on screen** until you dismiss them.

## Build

```sh
npm install
npm run build
```

This compiles `src/` with TypeScript and copies `static/` into `dist/`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.

After a rebuild, click the reload icon on the extension card.

> On Windows, make sure Chrome notifications are allowed in **Settings → System → Notifications**. Focus Assist / Do Not Disturb will hide them.

## Project layout

```
src/
  background.ts   service worker: listens to chrome.tabs events, logs and notifies
  settings.ts     shared types, defaults, and storage helpers
  popup.ts        recent-changes list
  options.ts      settings page
static/           manifest, HTML, CSS, icons (copied into dist/)
scripts/          build helpers and icon generator (npm run icons)
```
