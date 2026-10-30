# Soft Sticky Notes — Complete starter project

A soft-minimal, offline-first note app with:
- Windows Electron desktop app that stays above ordinary windows.
- Local notes and attachments.
- Custom translucent colour, opacity, decorations, fonts, text size and corner radius.
- Inline images with resize handles (drag the bottom-right corner).
- Paste or drag images into the note; double-click an image to remove it.
- Temporary two-person chat using room codes and WebSockets, with text and small image sharing.
- Responsive installable PWA starter for mobile with local IndexedDB notes and offline caching.

## Important architecture notes
- Notes and attachments are local to each device in this starter. They do not automatically synchronize between Windows and mobile yet.
- Chat needs internet to connect two different devices. The local chat server runs on your computer for testing; remote friends cannot reach `localhost`. To chat over the internet, deploy `chat-server/server.js` to a host that supports persistent WebSockets and configure the same public `wss://` URL in both clients.
- The mobile PWA includes a room-code chat panel and can auto-join a room when opened at `/chat/ROOMCODE`. The desktop app joins by entering the room code. For desktop invitation links, share the deployed PWA URL with `/chat/ROOMCODE` appended.
- No chat messages are written to a database. The server holds room connections in memory and expires idle rooms after 30 minutes. Restarting the server clears all rooms.
- This is an initial local-run project, not a production audited release. Do not use it for sensitive messages.

## Requirements
- Windows 10/11
- Node.js 20+ (Node.js 24 should work)
- Internet for first `npm install`

## Run the Windows desktop app
From the project root:

```bash
npm install
npm run desktop
```

The app stores data under Electron's user-data folder in `StickyNotesData/notes.json` and `StickyNotesData/attachments/`. Use the settings menu to select a different storage parent folder or export a backup.

## Run the local temporary chat server
Open a second terminal in the project root:

```bash
npm run chat
```

It listens on `ws://localhost:8787`. In the desktop app, open the heart chat button, create a room on one app, and enter the room code on the second app. For two computers on the same Wi-Fi, use your host computer's LAN IP and set `chatEndpoint` in `desktop/src/renderer.js` to `ws://YOUR-LAN-IP:8787` (allow Node through Windows Firewall).

For internet chat, deploy the chat server to a WebSocket-capable host and change `chatEndpoint` in `desktop/src/renderer.js` to the resulting `wss://` URL. Set `VITE_CHAT_URL` to that same URL when building the PWA. Vercel can host the web/PWA frontend, but deploy this standalone Node WebSocket server to a service that supports persistent WebSocket connections.

## Run the mobile PWA locally

```bash
npm run web
```

Open the printed local URL on your computer. For testing on a phone on the same Wi-Fi, open the Vite network URL shown in the terminal. To install publicly, deploy the `web` folder with Vercel (Vite project, build command `npm run web:build` from repository root may need Vercel root configuration; simplest use root directory `web`, build command `npx vite build --config vite.config.js`, output directory `../web-dist` adjusted to `web-dist` depending on Vercel root).

The PWA stores note content and pasted/uploaded image data locally in IndexedDB and supports offline caching after first visit. Images can be resized using the bottom-right handle. It includes a basic chat panel; set `VITE_CHAT_URL` to the deployed WebSocket server URL when building the public PWA.

## Build Windows installer

```bash
npm run desktop:dist
```

The Windows installer will be in `release/`.

## Project layout
- `desktop/src/` — Electron desktop app
- `chat-server/` — temporary WebSocket room server
- `web/` — responsive PWA starter
