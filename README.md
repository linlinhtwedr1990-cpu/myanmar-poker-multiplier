# Myanmar Poker Multiplier — V10.3 Web / Share-Link Edition

## What this version adds
- Public-web deployment ready
- One-click **Copy Invite Link**
- Invite URL contains the room code (`?room=MP-ABCDE`)
- Opening an invite link automatically prepares the Join Room flow
- Real-player rooms: 3–5 players
- No AI players
- No Firebase billing required
- Peer-to-peer multiplayer uses PeerJS

## Quick test on one computer
Use a local HTTP server (not `file://`). From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser.

## Put it on the internet
The folder is a static website and can be deployed to a static HTTPS host such as GitHub Pages, Netlify, or Cloudflare Pages. Upload the contents of this folder as the site files.

After deployment, send players the site URL. The host creates a room and uses **Copy Invite Link**. Players can open that link directly on their phones.

### Important
- Use an **HTTPS** public URL for the deployed site.
- Do not open the HTML by double-clicking the file for multiplayer testing.
- PeerJS provides the signaling/broker connection; the game itself does not require Firebase Cloud Functions.
- This is still a prototype multiplayer architecture. Before public release, add authentication, authoritative server validation, reconnect handling, anti-cheat controls, and production-grade signaling/server infrastructure.
