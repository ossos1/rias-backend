# RIAS Backend v2 🔴
> WhatsApp (Baileys + MongoDB) + Telegram | Made by Jinx Official

---

## ⚡ Quick Setup (Railway + MongoDB Atlas)

### Step 1 — Get a FREE MongoDB database

1. Go to [mongodb.com/atlas](https://mongodb.com/atlas) → Sign up free
2. Create a **Free Cluster** (M0 Sandbox)
3. Create a database user (username + password — save these)
4. Under **Network Access** → Add IP → click **"Allow Access from Anywhere"** (0.0.0.0/0)
5. Click **Connect** → **Drivers** → copy your connection string:
   ```
   mongodb+srv://youruser:yourpass@cluster0.xxxxx.mongodb.net/rias
   ```

### Step 2 — Deploy to Railway

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. In Railway → your project → **Variables** tab → add:
   ```
   MONGODB_URI = mongodb+srv://youruser:yourpass@cluster0.xxxxx.mongodb.net/rias
   PORT = 3000
   ```
4. Railway redeploys automatically → copy your public URL

### Step 3 — Connect frontend

In your `rias-v2.html`, update:
```js
const BACKEND = 'https://your-railway-url.up.railway.app';
```

### Step 4 — Test WhatsApp pairing

1. Open your hosted RIAS site
2. Enter your WhatsApp number (with country code, e.g. `2348012345678`)
3. Click **Generate Pairing Code**
4. On your phone: WhatsApp → **⋮ Menu** → **Linked Devices** → **Link a Device** → **Link with phone number instead**
5. Enter the 8-character code (e.g. `ABCD-EFGH`)
6. Done — RIAS is now connected to your WhatsApp ✅

---

## 💬 WhatsApp Commands (prefix: `.`)

### ⚔️ Admin
| Command | Description |
|---|---|
| `.kick @user` | Remove member |
| `.ban @user` | Permanent ban |
| `.mute @user` | Silence member |
| `.unmute @user` | Restore voice |
| `.promote @user` | Make admin |
| `.demote @user` | Remove admin |
| `.lockgroup` | Admins-only mode |
| `.unlockgroup` | Open group |
| `.warn @user` | Issue warning |
| `.tagall [msg]` | Tag everyone |
| `.getlink` | Get invite link |
| `.pin` | Pin replied message |
| `.delete` | Delete replied message |

### 🤖 AI Chat
| Command | Description |
|---|---|
| `.ask [question]` | Ask RIAS anything |
| `.chat [msg]` | Talk to RIAS |
| `.roast @user` | Brutal roast |
| `.compliment @user` | Compliment someone |
| `.advice [topic]` | Sassy advice |
| `.story [prompt]` | Short story |
| `.poem [topic]` | Original poem |
| `.joke` | Dark joke |
| `.rizz @user` | Smooth line |
| `.improve [text]` | Polish text |
| `.summarize [text]` | Key points |

### 🎲 Fun
| Command | Description |
|---|---|
| `.ship @u1 @u2` | Compatibility % |
| `.truth` | Hard truth |
| `.dare` | RIAS dares you |
| `.rank` | Rank members |
| `.quote` | RIAS quote |
| `.trivia` | Trivia game |
| `.roll [sides]` | Roll dice |
| `.flip` | Coin flip |
| `.8ball [q]` | Magic 8-ball |
| `.wyr [a] [b]` | Would you rather |
| `.spirit` | Spirit animal |
| `.battle @u1 @u2` | Member battle |

### ⚙️ Automation
`.setwelcome` • `.setgoodbye` • `.antilink on/off` • `.antibadword on/off` • `.antispam on/off` • `.schedule` • `.remind`

### 📩 DM Tools
`.dm` • `.broadcast` • `.autoreply on/off` • `.savecontact`

### ℹ️ Info
`.groupinfo` • `.calc` • `.help`

### 👑 Owner
`.shutdown` • `.restart` • `.status`

---

## 🤖 Enable Real AI (Optional)

In `wa.js` and `tg.js`, uncomment the Anthropic API block and set:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

*RIAS — Made by Jinx Official 🔴*
