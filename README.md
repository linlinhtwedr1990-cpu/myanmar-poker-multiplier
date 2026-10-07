# Myanmar Poker Multiplier — V10.2 Real-Player Multiplayer

## What this version does
- Create a room and share the room code.
- 3–5 real human players can join from separate devices/browsers.
- Uses PeerJS/WebRTC for peer connections; no Firebase billing is required.
- Host is authoritative for the actual V10 game engine.
- Each player receives only their own hand; other hands are never sent to that player.
- Synchronized actions: Upper decision, Center draw, offer, accept/reject, discard, and PLAY/WIN.
- Existing V10 card arrangement controls remain: Number, Color + Number, Suit + Number, manual drag, grouping.
- Owner Lin remains a non-playing creator mascot.

## Important
This is a browser prototype. It needs to be served from a web server (HTTPS is recommended) for real players to use it reliably. Opening files directly with `file://` is not the intended deployment method.

## Start locally
Use a simple static server in this folder, for example:

`python3 -m http.server 8000`

Then open `http://localhost:8000/v102.html` on the host. For players on different devices, deploy the folder to a public HTTPS static host.

## Room flow
1. Host opens V10.2 and clicks Create Room.
2. Host sends the room code to 2–4 other real players.
3. Players open the same public V10.2 web address and click Join Room.
4. Host starts once 3–5 players are connected.
5. Host runs the authoritative game; every device receives its own private hand plus public state.
