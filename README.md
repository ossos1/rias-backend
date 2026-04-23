# RIAS Backend 🔴
> Made by **Jinx Official**

Node.js backend powering RIAS — WhatsApp (Baileys) + Telegram bot deployment via REST API.

---

## 📦 Stack

| Package | Purpose |
|---|---|
| `express` | REST API server |
| `@whiskeysockets/baileys` | WhatsApp Web connection + pairing |
| `node-telegram-bot-api` | Telegram bot polling |
| `cors` | Allow requests from your frontend |
| `pino` | Silent logger for Baileys |

---

## 🚀 Local Setup

```bash
# 1. Clone / unzip the project
cd rias-backend

# 2. Install dependencies
npm install

# 3. Copy env file
cp .env.example .env

# 4. Start the server
npm start
# or for auto-reload during dev:
npm run dev
```

Server runs at: `http://localhost:3000`

---

## ☁️ Deploy to Railway (recommended — free tier)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Push this folder to a GitHub repo
3. Railway auto-detects Node.js and runs `npm start`
4. Copy your Railway URL (e.g. `https://rias-backend.up.railway.app`)
5. In your frontend HTML, set:
   ```js
   const BACKEND = 'https://rias-backend.up.railway.app';
   ```

### Other free options:
- **Render.com** — same process, free tier spins down after inactivity
- **Koyeb** — always-on free tier
- **VPS** — run with `pm2 start index.js --name rias`

---

## 🔌 API Endpoints

### `GET /`
Health check.
```json
{ "status": "RIAS backend online 🔴", "version": "1.0.0" }
```

### `POST /api/wa/pair`
Generate a WhatsApp pairing code.

**Body:**
```json
{ "number": "2348012345678" }
```
**Response:**
```json
{ "code": "ABCD-EFGH" }
```

### `POST /api/tg/deploy`
Deploy RIAS to a Telegram bot.

**Body:**
```json
{ "token": "123456:ABC-...", "userId": "987654321" }
```
**Response:**
```json
{ "botUsername": "YourBotName", "ownerId": "987654321" }
```

---

## 💬 WhatsApp Commands

| Command | Description |
|---|---|
| `.kick @user` | Remove a member |
| `.ban @user` | Permanently ban |
| `.mute @user` | Silence a member |
| `.promote @user` | Make admin |
| `.demote @user` | Remove admin |
| `.lockgroup` | Admins-only chat |
| `.unlockgroup` | Open chat |
| `.warn @user` | Issue warning |
| `.ask [q]` | AI answer |
| `.chat [msg]` | Chat with RIAS |
| `.roast [@]` | RIAS roasts someone |
| `.compliment [@]` | RIAS compliments |
| `.advice [topic]` | Sassy advice |
| `.story [prompt]` | AI story |
| `.ship [@] [@]` | Compatibility % |
| `.truth` | Unfiltered truth |
| `.dare` | RIAS dares you |
| `.rank` | Member rankings |
| `.quote` | RIAS original quote |
| `.trivia` | Trivia game |
| `.setwelcome [msg]` | Welcome message |
| `.setgoodbye [msg]` | Goodbye message |
| `.antilink on/off` | Block links |
| `.antibadword on/off` | Filter words |
| `.schedule [time] [msg]` | Scheduled message |
| `.remind [time] [msg]` | Reminder |
| `.dm @user [msg]` | DM a member |
| `.broadcast [msg]` | Message all contacts |
| `.autoreply on/off` | Away auto-reply |
| `.savecontact @user` | Save contact |
| `.help` | Show this menu |

---

## 🤖 Enable Real AI (Optional)

In `wa.js` and `tg.js`, find the `riasAI()` function.
Uncomment the Anthropic API block and set your key in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

RIAS will then give real AI-powered responses using Claude Haiku.

---

## 📁 File Structure

```
rias-backend/
├── index.js        ← Express server + API routes
├── wa.js           ← WhatsApp Baileys + command handler
├── tg.js           ← Telegram bot + command handler
├── package.json
├── .env.example
├── sessions/       ← Auto-created: WhatsApp auth sessions
└── README.md
```

---

## ⚠️ Notes

- **WhatsApp**: RIAS must be added to a group and made admin for group commands to work.
- **Telegram**: RIAS must be added to a group and given admin rights for kick/ban/mute.
- Sessions are stored locally in `./sessions/`. Back them up to avoid re-pairing.
- For production, use a database (MongoDB/Redis) instead of in-memory Maps.

---

*RIAS — Made by Jinx Official 🔴*
