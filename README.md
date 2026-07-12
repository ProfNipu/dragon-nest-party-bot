# Party Bot — MMORPG Party Organizer for Discord

A Discord bot that lets people post a party/raid listing with role slots
(Tank, Healer, DPS, Support), and lets server members join with one click
using buttons. The roster updates live.

## Features
- `/party create` — post a listing with activity name, time, note, and how many of each role you need
- Click-to-join buttons for Tank / Healer / DPS / Support (no typing required)
- Leave and Disband buttons (only the party leader can disband)
- Roles auto-disable once full, embed turns green when the whole party is filled
- `/party list` — see all active parties in the current channel

## Setup

### 1. Create a Discord Application & Bot
1. Go to https://discord.com/developers/applications and click **New Application**.
2. Go to the **Bot** tab, click **Reset Token** to get your bot token (save it — you won't see it again).
3. Under **Privileged Gateway Intents**, you don't need to enable anything extra for this bot (it only uses slash commands and buttons).
4. Go to **OAuth2 → URL Generator**, check scopes `bot` and `applications.commands`, and under Bot Permissions check `Send Messages`, `Embed Links`, and `Use Slash Commands`. Copy the generated URL and open it to invite the bot to your server.

### 2. Configure the project
```bash
cp .env.example .env
```
Fill in `.env`:
- `DISCORD_TOKEN` — the bot token from step 1
- `CLIENT_ID` — your application's **Application ID** (General Information tab)
- `GUILD_ID` — (optional but recommended while testing) your Discord server's ID, so commands register instantly instead of taking up to an hour. Right-click your server icon → Copy Server ID (you need Developer Mode on in Discord settings).

### 3. Install & run
```bash
npm install
npm run deploy   # registers the /party slash command with Discord
npm start        # starts the bot
```

If it worked, you'll see `✅ Logged in as YourBot#1234` in the console.

## Usage
In Discord:
```
/party create activity: Molten Core Raid tanks: 2 healers: 2 dps: 5 time: Tonight 8pm EST note: Min item level 400
```
This posts an embed with join buttons. Anyone can click a role to sign up;
clicking a different role moves them there. The leader can hit **Disband**
when the run is over.

## Notes & next steps
- Party data is stored **in memory** — restarting the bot clears active parties. For persistence across restarts, swap `partyManager.js` to read/write a database (SQLite is a good lightweight option) instead of the `Map`.
- Want auto-expiring parties, DM notifications when a party fills, or a `/party edit` command? Those are natural next additions — just ask.
