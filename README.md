# Project BattleWorld v0.1

An original, small 2D online multiplayer arena prototype inspired by classic side-scrolling mobile shooters.

## Features in this prototype
- Public matchmaking (automatically joins a public room)
- Private rooms with shareable six-character codes
- Real-time player movement and shooting
- Health, scoring and respawning
- Mobile touch controls and desktop keyboard controls

## Run it on a computer
1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`

## Deploy online
This project needs a Node.js host that supports persistent WebSocket connections.
1. Upload this folder to a GitHub repository.
2. Create a new Node web service on a hosting provider that supports WebSockets.
3. Use build command: `npm install`
4. Use start command: `npm start`
5. Open the public HTTPS URL on your phone and share it with friends.

A free hosting tier may sleep, limit bandwidth or change its terms. If the service sleeps, players may need to wait for it to wake up.

## Current prototype limitations
- No accounts, password protection, anti-cheat or moderation yet.
- Public rooms are simple groups of up to eight players, not regional matchmaking.
- The game is a prototype; movement and hit detection need more testing and tuning.
- This is not yet ready for public app-store release.
- Use original artwork, sounds, names and maps when expanding the game.

## Next development milestones
1. Improve controls, aiming and level design.
2. Add player accounts and persistent profiles.
3. Add better matchmaking and regional servers.
4. Add moderation, reporting and anti-cheat protections.
5. Package and test for Android.
