require('dotenv').config();
require('./config');

const { loadAllSessions } = require('./pair.js');
const chalk  = require('chalk');
const cfonts = require('cfonts');

// ── RIAS BANNER ───────────────────────────────────────────────
cfonts.say('RIAS AI', {
  font:       'block',
  align:      'center',
  colors:     ['red', 'white'],
  background: 'transparent',
  space:      false,
});
console.log(chalk.hex('#FF2D55').bold('  ╔══════════════════════════════════════════════════╗'));
console.log(chalk.hex('#FF2D55').bold('  ║          🌹  R I A S  A I  B O T  🌹             ║'));
console.log(chalk.hex('#FF2D55').bold('  ║            Made by  Jinx Official                 ║'));
console.log(chalk.hex('#FF2D55').bold('  ╚══════════════════════════════════════════════════╝'));
console.log(chalk.hex('#E8B84B').bold(`  ⚡ Starting RIAS AI Engine...\n`));

// Restore saved WhatsApp sessions
loadAllSessions();

// ── IMPORTS ───────────────────────────────────────────────────
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  generateWAMessageFromContent,
  proto,
  jidDecode,
  getContentType,
} = require('@whiskeysockets/baileys');

const fs      = require('fs');
const path    = require('path');
const pino    = require('pino');
const axios   = require('axios');
const moment  = require('moment-timezone');
const TelegramBot = require('node-telegram-bot-api');
const smsg    = require('./smsg');
const { runtime, getBuffer } = require('./lib/myfunction');
const { startpairing } = require('./pair');

const sessionsRoot = path.join(__dirname, 'pairing');

// ── TELEGRAM SETUP ────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ||
  (fs.existsSync('./telegram.token') ? fs.readFileSync('./telegram.token','utf-8').trim() : '');

if (!TELEGRAM_BOT_TOKEN) {
  console.log(chalk.red.bold('[ERROR] No Telegram bot token found!'));
  console.log(chalk.yellow.bold('[HINT] Set TELEGRAM_BOT_TOKEN in your .env file'));
  console.log(chalk.yellow.bold('[HINT] Or paste it in telegram.token file'));
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// ── DATABASE ──────────────────────────────────────────────────
const dataFile = path.join(__dirname, 'telegram.meta.json');
const db = fs.existsSync(dataFile)
  ? JSON.parse(fs.readFileSync(dataFile))
  : { admins: [], premium: [] };
if (!Array.isArray(db.admins))  db.admins  = [];
if (!Array.isArray(db.premium)) db.premium = [];
const saveDB = () => fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));

// ── OWNER / PREMIUM ───────────────────────────────────────────
const MAIN_OWNER_TG_ID = process.env.TELEGRAM_OWNER_ID || '6625805865';

const isTGOwner = (id) => String(id) === String(MAIN_OWNER_TG_ID) || db.admins.includes(String(id));
const isTGPremium = (id) => db.premium.includes(String(id));
const isTGOwnerOrPremium = (id) => isTGOwner(id) || isTGPremium(id);

if (!db.admins.includes(MAIN_OWNER_TG_ID)) { db.admins.push(MAIN_OWNER_TG_ID); saveDB(); }

// ── HELPERS ───────────────────────────────────────────────────
global.sessions = global.sessions || new Map();

const getUptime = () => {
  const s = process.uptime();
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${Math.floor(s%60)}s`;
};

function getRandomImg() {
  const dir = path.join(__dirname, 'lib', 'image');
  const names = ['vec1.jpg','vec2.jpg','vec3.jpg','vec4.jpg','vec5.jpg'];
  const available = names.filter(n => fs.existsSync(path.join(dir, n)));
  if (!available.length) return null;
  return path.join(dir, available[Math.floor(Math.random() * available.length)]);
}

// denied msg helper
const denied = (sender) =>
`╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗
║
║ 🔒 𝗔𝗰𝗰𝗲𝘀𝘀 𝗗𝗲𝗻𝗶𝗲𝗱, ${sender}
║
║ ❗ Owner / Premium only
║
║ ⚡ Contact Jinx Official
╚═══════════════════╝`;

// ── /start ────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId  = msg.chat.id;
  const sender  = msg.from.first_name || msg.from.username || 'User';
  const imgPath = getRandomImg();

  const text =
`🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 • 𝗝𝗶𝗻𝘅 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹

👁 𝗪𝗘𝗟𝗖𝗢𝗠𝗘, ${sender}!

𝙄'𝙢 𝙍𝙄𝘼𝙎 — 𝙮𝙤𝙪𝙧 𝙞𝙣𝙩𝙚𝙡𝙡𝙞𝙜𝙚𝙣𝙩, 𝙨𝙖𝙨𝙨𝙮 & 𝙥𝙤𝙬𝙚𝙧𝙛𝙪𝙡
𝙒𝙝𝙖𝙩𝙨𝘼𝙥𝙥 & 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢 𝙘𝙤𝙢𝙥𝙖𝙣𝙞𝙤𝙣.

┌─────────────────────
│ 🤖 𝗔𝗜 — Google Gemini
│ ⚔️ 𝗔𝗱𝗺𝗶𝗻 — Full group control
│ 🎮 𝗚𝗮𝗺𝗲𝘀 — Built-in fun
│ 🏅 𝗫𝗣 𝗦𝘆𝘀𝘁𝗲𝗺 — Level up by chatting
│ 🎂 𝗕𝗶𝗿𝘁𝗵𝗱𝗮𝘆𝘀 — Auto-announced
└─────────────────────

📌 Use /pair <number> to deploy RIAS
📌 Use /menu to see all commands

𝗦𝗵𝗲 𝗱𝗼𝗲𝘀𝗻'𝘁 𝗯𝗲𝗴 𝗳𝗼𝗿 𝗮𝘁𝘁𝗲𝗻𝘁𝗶𝗼𝗻.
𝗦𝗵𝗲 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀 𝗶𝘁. 🔴`;

  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔗 WA Channel', url: 'https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S' },
          { text: '👑 Contact Jinx', url: 'https://wa.me/2348075997375' },
        ],
        [{ text: '📋 /menu — See Commands', callback_data: 'menu' }],
      ]
    }
  };

  if (imgPath) {
    await bot.sendPhoto(chatId, imgPath, { caption: text, ...buttons });
  } else {
    await bot.sendMessage(chatId, text, buttons);
  }

  // play intro audio
  const audio = path.join(__dirname, 'lib', 'jinx.mp3');
  if (fs.existsSync(audio)) {
    await bot.sendAudio(chatId, audio, { title: 'RIAS AI Online', performer: 'Jinx Official' });
  }
});

// ── /menu ─────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  const chatId   = msg.chat.id;
  const sender   = msg.from.first_name || msg.from.username || 'User';
  const imgPath  = getRandomImg();

  const banner =
`🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 — 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗖𝗲𝗻𝘁𝗿𝗲

[ 𝙎𝙮𝙨𝙩𝙚𝙢 𝙎𝙩𝙖𝙩𝙪𝙨 ]
┏━━━━━━━━━━━━━━━━━━━┓
┃ 👤 User   : ${sender}
┃ ⏱️ Uptime : ${getUptime()}
┃ 🌹 Bot    : RIAS AI v3.0
┃ 🧠 AI     : Gemini 1.5 Flash
┗━━━━━━━━━━━━━━━━━━━┛

[ 𝙒𝙝𝙖𝙩𝙨𝘼𝙥𝙥 𝘿𝙚𝙥𝙡𝙤𝙮𝙢𝙚𝙣𝙩 ]
⟡ /pair <number>    → Link WhatsApp
⟡ /delpair <number> → Unlink WhatsApp
⟡ /listpaired       → View sessions

[ 𝙊𝙬𝙣𝙚𝙧 𝘾𝙤𝙣𝙩𝙧𝙤𝙡 ]
⟡ /addowner <tg_id> → Add admin
⟡ /delowner <tg_id> → Remove admin
⟡ /addpremium <id>  → Add premium
⟡ /delpremium <id>  → Remove premium

[ 𝙄𝙣𝙛𝙤 ]
⟡ /ping    → Response speed
⟡ /stats   → Bot statistics
⟡ /help    → Show this menu

━━━━━━━━━━━━━━━━━━━
🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 • 𝗝𝗶𝗻𝘅 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹`;

  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔗 WA Channel', url: 'https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S' },
          { text: '👑 Contact Jinx', url: 'https://wa.me/2348075997375' },
        ],
        [{ text: '📱 Pair WhatsApp', callback_data: 'pair_help' }],
      ]
    }
  };

  if (imgPath) {
    await bot.sendPhoto(chatId, imgPath, { caption: banner, ...buttons });
  } else {
    await bot.sendMessage(chatId, banner, buttons);
  }

  const menuAudio = path.join(__dirname, 'lib', 'menu.mp3');
  if (fs.existsSync(menuAudio)) {
    await bot.sendAudio(chatId, menuAudio, { title: 'RIAS Menu', performer: 'Jinx Official' });
  }
});

// ── /help alias ───────────────────────────────────────────────
bot.onText(/\/help/, (msg) => bot.emit('text', msg, ['/menu']));

// ── /ping ─────────────────────────────────────────────────────
bot.onText(/\/ping/, async (msg) => {
  const start = Date.now();
  const sent  = await bot.sendMessage(msg.chat.id, '⏳ Pinging...');
  await bot.editMessageText(
`⚡ 𝗣𝗜𝗡𝗚 𝗥𝗘𝗦𝗣𝗢𝗡𝗦𝗘

🏓 Pong!
⚡ Latency: ${Date.now() - start}ms
✅ RIAS AI is Online
⏱️ Uptime: ${getUptime()}

🌹 RIAS AI • Jinx Official`,
    { chat_id: msg.chat.id, message_id: sent.message_id }
  );
});

// ── /stats ────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  if (!isTGOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, denied(msg.from.first_name));
  const dirs = fs.existsSync(sessionsRoot)
    ? fs.readdirSync(sessionsRoot).filter(d => fs.statSync(path.join(sessionsRoot, d)).isDirectory())
    : [];
  const active = dirs.filter(d => global.sessions.has(d)).length;
  await bot.sendMessage(msg.chat.id,
`📊 𝗥𝗜𝗔𝗦 𝗦𝗧𝗔𝗧𝗦

┏━━━━━━━━━━━━━━━━━━━┓
┃ 📱 Total Sessions : ${dirs.length}
┃ ✅ Active Online  : ${active}
┃ ❌ Offline        : ${dirs.length - active}
┃ ⏱️ Uptime         : ${getUptime()}
┃ 👑 Admins         : ${db.admins.length}
┃ 💎 Premium        : ${db.premium.length}
┗━━━━━━━━━━━━━━━━━━━┛

🌹 RIAS AI • Jinx Official`
  );
});

// ── /pair ─────────────────────────────────────────────────────
bot.onText(/^\/pair(?:\s+(\d+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const sender = msg.from.first_name || 'User';
  const phone  = match[1];

  if (!isTGOwnerOrPremium(msg.from.id)) {
    return bot.sendMessage(chatId, denied(sender), {
      reply_markup: { inline_keyboard: [[
        { text: '👑 Contact Jinx', url: 'https://wa.me/2348075997375' }
      ]]}
    });
  }

  if (!phone) {
    return bot.sendMessage(chatId,
`🌹 𝗣𝗔𝗜𝗥 𝗥𝗜𝗔𝗦 𝗧𝗢 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣

Usage: /pair <phone_number>
Example: /pair 2348012345678

📌 Use your full number with country code
📌 No + sign needed

🌹 RIAS AI • Jinx Official`
    );
  }

  if (!/^\d+$/.test(phone)) {
    return bot.sendMessage(chatId, '❌ Invalid number format.\nUse digits only e.g. 2348012345678');
  }

  if (global.sessions.has(phone)) {
    return bot.sendMessage(chatId,
`✅ 𝗔𝗹𝗿𝗲𝗮𝗱𝘆 𝗔𝗰𝘁𝗶𝘃𝗲

📱 ${phone} is already linked and online.
Use /delpair ${phone} to unlink first.`
    );
  }

  await bot.sendMessage(chatId,
`╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗
║ ▶ Operation : PAIRING
║ ▶ Status    : CONNECTING
║ 📱 Number   : ${phone}
║ ⏳ Please wait...
╚═══════════════════╝`
  );

  try {
    await startpairing(phone, chatId, bot);
  } catch (err) {
    console.error('[Pair Error]', err.message);
    global.sessions.delete(phone);
    await bot.sendMessage(chatId,
`❌ 𝗣𝗮𝗶𝗿𝗶𝗻𝗴 𝗙𝗮𝗶𝗹𝗲𝗱

Error: ${err.message}

Try again or contact Jinx Official.`, {
      reply_markup: { inline_keyboard: [[
        { text: '👑 Contact Jinx', url: 'https://wa.me/2348075997375' }
      ]]}
    });
  }
});

// ── /delpair ──────────────────────────────────────────────────
bot.onText(/^\/delpair(?:\s+(\S+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const sender = msg.from.first_name || 'User';
  const id     = match[1];

  if (!isTGOwnerOrPremium(msg.from.id)) return bot.sendMessage(chatId, denied(sender));
  if (!id) return bot.sendMessage(chatId, 'Usage: /delpair <number>\nExample: /delpair 2348012345678');

  const target = path.join(sessionsRoot, id);
  try {
    if (!fs.existsSync(target)) return bot.sendMessage(chatId, `❌ Session "${id}" not found.`);

    if (global.sessions.has(id)) {
      try { const s = global.sessions.get(id); s?.end?.(new Error('Deleted')); s?.ws?.close?.(); } catch {}
      global.sessions.delete(id);
    }

    fs.rmSync(target, { recursive: true, force: true });

    await bot.sendMessage(chatId,
`╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗
║ ✅ Session Deleted
║ 📱 Number: ${id}
╚═══════════════════╝`
    );
  } catch (e) {
    await bot.sendMessage(chatId, `❌ Failed to delete: ${e.message}`);
  }
});

// ── /listpaired ───────────────────────────────────────────────
bot.onText(/^\/listpaired$/i, async (msg) => {
  const chatId = msg.chat.id;
  if (!isTGOwnerOrPremium(msg.from.id)) return bot.sendMessage(chatId, denied(msg.from.first_name));

  try {
    const dirs = fs.existsSync(sessionsRoot)
      ? fs.readdirSync(sessionsRoot).filter(d => fs.statSync(path.join(sessionsRoot, d)).isDirectory())
      : [];

    if (!dirs.length) {
      return bot.sendMessage(chatId,
`╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗
║ 📭 No paired sessions yet
║ Use /pair <number> to link WhatsApp
╚═══════════════════╝`
      );
    }

    const lines = dirs.map((d, i) =>
      `${i+1}. 📱 ${d} — ${global.sessions.has(d) ? '✅ Online' : '❌ Offline'}`
    );

    await bot.sendMessage(chatId,
`╔═══[ 📱 𝗣𝗮𝗶𝗿𝗲𝗱 𝗦𝗲𝘀𝘀𝗶𝗼𝗻𝘀 ]═══╗

${lines.join('\n')}

Total: ${dirs.length} | Active: ${dirs.filter(d=>global.sessions.has(d)).length}

╚═══════════════════════╝`
    );
  } catch (e) {
    bot.sendMessage(chatId, `❌ Error: ${e.message}`);
  }
});

// ── /addowner ─────────────────────────────────────────────────
bot.onText(/^\/addowner(?:\s+(\d+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const sender = msg.from.first_name || 'User';
  if (!isTGOwner(msg.from.id)) return bot.sendMessage(chatId, denied(sender));
  const id = String(match[1] || '');
  if (!id) return bot.sendMessage(chatId, 'Usage: /addowner <telegram_user_id>');
  if (db.admins.includes(id)) return bot.sendMessage(chatId, `❌ ${id} is already an owner.`);
  db.admins.push(id); saveDB();
  await bot.sendMessage(chatId, `✅ Owner added: ${id}\n\n🌹 RIAS AI • Jinx Official`);
});

// ── /delowner ─────────────────────────────────────────────────
bot.onText(/^\/delowner(?:\s+(\d+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const sender = msg.from.first_name || 'User';
  if (!isTGOwner(msg.from.id)) return bot.sendMessage(chatId, denied(sender));
  const id = String(match[1] || '');
  if (!id) return bot.sendMessage(chatId, 'Usage: /delowner <telegram_user_id>');
  if (id === MAIN_OWNER_TG_ID) return bot.sendMessage(chatId, '❌ Cannot remove the main owner.');
  db.admins = db.admins.filter(x => x !== id); saveDB();
  await bot.sendMessage(chatId, `✅ Owner removed: ${id}\n\n🌹 RIAS AI • Jinx Official`);
});

// ── /addpremium ───────────────────────────────────────────────
bot.onText(/^\/addpremium(?:\s+(\d+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isTGOwner(msg.from.id)) return bot.sendMessage(chatId, denied(msg.from.first_name));
  const id = String(match[1] || '');
  if (!id) return bot.sendMessage(chatId, 'Usage: /addpremium <telegram_user_id>');
  if (db.premium.includes(id)) return bot.sendMessage(chatId, `❌ ${id} is already premium.`);
  db.premium.push(id); saveDB();
  await bot.sendMessage(chatId, `💎 Premium added: ${id}\n\n🌹 RIAS AI • Jinx Official`);
});

// ── /delpremium ───────────────────────────────────────────────
bot.onText(/^\/delpremium(?:\s+(\d+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!isTGOwner(msg.from.id)) return bot.sendMessage(chatId, denied(msg.from.first_name));
  const id = String(match[1] || '');
  if (!id) return bot.sendMessage(chatId, 'Usage: /delpremium <telegram_user_id>');
  db.premium = db.premium.filter(x => x !== id); saveDB();
  await bot.sendMessage(chatId, `✅ Premium removed: ${id}\n\n🌹 RIAS AI • Jinx Official`);
});

// ── CALLBACK QUERIES (inline button taps) ─────────────────────
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  await bot.answerCallbackQuery(q.id);
  if (q.data === 'menu') bot.emit('text', q.message, ['/menu']);
  if (q.data === 'pair_help') {
    await bot.sendMessage(chatId,
`📱 𝗛𝗼𝘄 𝘁𝗼 𝗣𝗮𝗶𝗿 𝗥𝗜𝗔𝗦

1️⃣ Send: /pair <your_number>
   Example: /pair 2348075997375

2️⃣ You'll receive a pairing code

3️⃣ Open WhatsApp on your phone
   → Linked Devices
   → Link a Device
   → Enter code manually

4️⃣ RIAS is now linked! ✅

🌹 RIAS AI • Jinx Official`
    );
  }
});

// ── STARTUP LOGS ──────────────────────────────────────────────
console.log(chalk.green.bold('  ✅ Telegram Bot Online'));
console.log(chalk.yellow.bold(`  ✅ Main Owner TG ID: ${MAIN_OWNER_TG_ID}`));
console.log(chalk.cyan.bold('  ✅ WhatsApp Sessions Loading...\n'));

// ── HOT RELOAD ────────────────────────────────────────────────
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  delete require.cache[file];
  require(file);
  console.log(chalk.green('[RIAS] index.js hot reloaded'));
});

// ═══════════════════════════════════════════════════════════════
//  🌐 RIAS WEB DEPLOY API
//  Anyone visits the site → enters credentials → bot deploys
//  No new files. No new base. Just this.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the RIAS frontend HTML
app.use(express.static(__dirname));
app.get('/', (_req, res) => {
  const html = path.join(__dirname, 'rias-v3.html');
  if (fs.existsSync(html)) return res.sendFile(html);
  res.send('<h1>🌹 RIAS AI Online</h1>');
});

// ── GET /api/status ──────────────────────────────────────────
// Frontend polls this to know the server is alive
app.get('/api/status', (_req, res) => {
  res.json({
    status:   'online',
    bot:      'RIAS AI',
    by:       'Jinx Official',
    sessions: global.sessions ? global.sessions.size : 0,
    uptime:   Math.floor(process.uptime()),
  });
});

// ── POST /api/wa/pair ────────────────────────────────────────
// Body:    { number: "2348012345678" }
// Returns: { success: true, code: "ABCD-EFGH" }
//
// How it works:
//  1. User enters their WhatsApp number on the website
//  2. We call startpairing() from pair.js (same as /pair Telegram command)
//  3. Intercept the pairing code before it goes to Telegram
//  4. Return it to the website so the user sees it immediately
app.post('/api/wa/pair', async (req, res) => {
  const { number } = req.body || {};
  if (!number) return res.status(400).json({ error: 'Phone number is required.' });

  const num = String(number).replace(/[^0-9]/g, '');
  if (num.length < 7 || num.length > 15)
    return res.status(400).json({ error: 'Invalid number. Include country code, digits only. e.g. 2348012345678' });

  if (global.sessions?.has(num))
    return res.status(400).json({ error: `${num} is already linked and active. Use it in your WhatsApp groups.` });

  // Create a fake bot that captures the pairing code instead of sending to Telegram
  let codeResolver, codeRejecter;
  const codePromise = new Promise((resolve, reject) => {
    codeResolver = resolve;
    codeRejecter = reject;
  });

  const codeTimeout = setTimeout(() => {
    codeRejecter(new Error('Timed out waiting for WhatsApp. Try again.'));
  }, 60000);

  const fakeTgBot = {
    // pair.js calls bot.sendMessage(chatId, message) — we intercept it
    sendMessage: async (_chatId, text) => {
      // The code message always contains XXXX-XXXX format
      const match = String(text).match(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
      if (match) {
        clearTimeout(codeTimeout);
        codeResolver(match[0]);
      }
    }
  };

  try {
    // Start pairing using the exact same function Telegram /pair uses
    startpairing(num, '__web__', fakeTgBot).catch(err => {
      clearTimeout(codeTimeout);
      codeRejecter(err);
    });

    const code = await codePromise;
    return res.json({ success: true, code });

  } catch (err) {
    console.error('[Web /wa/pair]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/wa/status/:number ───────────────────────────────
// Frontend polls this after user enters the code to confirm link
app.get('/api/wa/status/:number', (req, res) => {
  const num = req.params.number.replace(/[^0-9]/g, '');
  res.json({
    number:  num,
    status:  global.sessions?.has(num) ? 'connected' : 'waiting',
    online:  global.sessions?.has(num),
  });
});

// ── POST /api/tg/deploy ──────────────────────────────────────
// Body:    { token: "123:AAF...", userId: "123456789" }
// Returns: { success: true, botName, botUsername }
//
// How it works:
//  1. User gets their bot token from @BotFather on Telegram
//  2. User gets their Telegram ID from @userinfobot
//  3. We spin up a TelegramBot instance for their token
//  4. Set them as the owner
//  5. Register all commands (pair, delpair, listpaired, menu etc.)
//  6. Send them a welcome message confirming it's live

const deployedTgBots = new Map(); // token -> { bot, ownerId }

app.post('/api/tg/deploy', async (req, res) => {
  const { token, userId } = req.body || {};

  if (!token || !token.includes(':'))
    return res.status(400).json({ error: 'Invalid bot token. Get one from @BotFather on Telegram.' });
  if (!userId || isNaN(userId))
    return res.status(400).json({ error: 'Invalid Telegram User ID. Message @userinfobot on Telegram to get yours.' });

  // Stop old instance if same token is re-deployed
  if (deployedTgBots.has(token)) {
    try { deployedTgBots.get(token).bot.stopPolling(); } catch {}
    deployedTgBots.delete(token);
  }

  let userBot;
  try {
    userBot = new TelegramBot(token, { polling: true });

    // Verify token is valid
    const me = await userBot.getMe().catch(err => {
      throw new Error('Invalid bot token — ' + err.message + '. Check with @BotFather.');
    });

    deployedTgBots.set(token, { bot: userBot, ownerId: String(userId) });
    console.log(chalk.green.bold(`[TG DEPLOY] @${me.username} live for owner ${userId}`));

    // Send welcome to the user's Telegram
    await userBot.sendMessage(Number(userId),
`╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗
║
║ ✅ Bot Deployed Successfully!
║
║ 🤖 Bot: @${me.username}
║ 👑 Owner: You (${userId})
║ 🔴 Status: Online
║
║ 📱 /pair <number> — Link WhatsApp
║ 📋 /menu          — All commands
║ ℹ️  /start         — Welcome
║
╚═══════════════════╝

🌹 RIAS AI • Made by Jinx Official`,
      { parse_mode: 'Markdown' }
    ).catch(() => {
      throw new Error(
        `Bot deployed but couldn't message you. Did you send /start to @${me.username} first?`
      );
    });

    // Register all Telegram commands on this user's bot
    mountTelegramCommands(userBot, String(userId), me.username);

    return res.json({ success: true, botName: me.first_name, botUsername: me.username });

  } catch (err) {
    console.error('[Web /tg/deploy]', err.message);
    if (userBot) try { userBot.stopPolling(); } catch {}
    deployedTgBots.delete(token);
    return res.status(500).json({ error: err.message });
  }
});

// ── mountTelegramCommands() ──────────────────────────────────
// Registers /start /menu /pair /delpair /listpaired /addowner etc.
// on any TelegramBot instance — same logic as the main bot above
function mountTelegramCommands(tgBot, ownerId, botUsername) {

  const isOwner = (id) => String(id) === String(ownerId);

  // Per-bot database stored in memory (persisted to disk per botUsername)
  const dbPath = path.join(__dirname, `tg_${botUsername}.json`);
  const bdb    = fs.existsSync(dbPath)
    ? JSON.parse(fs.readFileSync(dbPath))
    : { admins: [ownerId], premium: [] };
  const saveBDB = () => fs.writeFileSync(dbPath, JSON.stringify(bdb, null, 2));
  if (!bdb.admins.includes(ownerId)) { bdb.admins.push(ownerId); saveBDB(); }

  const isAdmin   = (id) => isOwner(id) || bdb.admins.includes(String(id));
  const isPremium = (id) => bdb.premium.includes(String(id));
  const canUse    = (id) => isAdmin(id) || isPremium(id);

  const deny = (chatId, name = 'User') => tgBot.sendMessage(chatId,
`╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗
║ 🔒 Access Denied, ${name}
║ ❗ Owner / Premium only
╚═══════════════════╝`
  );

  const getUp = () => {
    const s = process.uptime();
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${Math.floor(s%60)}s`;
  };

  tgBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name   = msg.from.first_name || 'User';
    await tgBot.sendMessage(chatId,
`🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 • 𝗝𝗶𝗻𝘅 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹

👁 𝗪𝗘𝗟𝗖𝗢𝗠𝗘, ${name}!

𝙄'𝙢 𝙍𝙄𝘼𝙎 — 𝙮𝙤𝙪𝙧 𝙞𝙣𝙩𝙚𝙡𝙡𝙞𝙜𝙚𝙣𝙩, 𝙨𝙖𝙨𝙨𝙮 & 𝙥𝙤𝙬𝙚𝙧𝙛𝙪𝙡
𝙒𝙝𝙖𝙩𝙨𝘼𝙥𝙥 & 𝙏𝙚𝙡𝙚𝙜𝙧𝙖𝙢 𝙘𝙤𝙢𝙥𝙖𝙣𝙞𝙤𝙣.

📌 /pair <number> — Link WhatsApp
📌 /menu          — All commands

𝗦𝗵𝗲 𝗱𝗼𝗲𝘀𝗻'𝘁 𝗯𝗲𝗴 𝗳𝗼𝗿 𝗮𝘁𝘁𝗲𝗻𝘁𝗶𝗼𝗻.
𝗦𝗵𝗲 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀 𝗶𝘁. 🔴`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🔗 WA Channel', url: 'https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S' }, { text: '👑 Jinx', url: 'https://wa.me/2348075997375' }]
      ]}}
    );
  });

  tgBot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    const name   = msg.from.first_name || 'User';
    await tgBot.sendMessage(chatId,
`🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 — 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗖𝗲𝗻𝘁𝗿𝗲

┏━━━━━━━━━━━━━━━━━━━┓
┃ 👤 User   : ${name}
┃ ⏱️ Uptime : ${getUp()}
┃ 🌹 Bot    : RIAS AI v3.0
┗━━━━━━━━━━━━━━━━━━━┛

[ 𝙒𝙝𝙖𝙩𝙨𝘼𝙥𝙥 𝘿𝙚𝙥𝙡𝙤𝙮𝙢𝙚𝙣𝙩 ]
⟡ /pair <number>    → Link WhatsApp
⟡ /delpair <number> → Unlink
⟡ /listpaired       → View sessions

[ 𝙊𝙬𝙣𝙚𝙧 𝘾𝙤𝙣𝙩𝙧𝙤𝙡 ]
⟡ /addowner <id>    → Add admin
⟡ /delowner <id>    → Remove admin
⟡ /addpremium <id>  → Add premium

[ 𝙄𝙣𝙛𝙤 ]
⟡ /ping  /stats  /help

🌹 RIAS AI • Jinx Official`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🔗 WA Channel', url: 'https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S' }]
      ]}}
    );
  });

  tgBot.onText(/\/ping/, async (msg) => {
    const start = Date.now();
    const sent  = await tgBot.sendMessage(msg.chat.id, '⏳ Pinging...');
    await tgBot.editMessageText(
      `⚡ Pong!\n⚡ Latency: ${Date.now()-start}ms\n✅ Online\n⏱️ Uptime: ${getUp()}\n\n🌹 RIAS AI`,
      { chat_id: msg.chat.id, message_id: sent.message_id }
    );
  });

  tgBot.onText(/\/stats/, async (msg) => {
    if (!isAdmin(msg.from.id)) return deny(msg.chat.id, msg.from.first_name);
    const dirs = fs.existsSync(path.join(__dirname,'pairing'))
      ? fs.readdirSync(path.join(__dirname,'pairing')).filter(d=>fs.statSync(path.join(__dirname,'pairing',d)).isDirectory())
      : [];
    await tgBot.sendMessage(msg.chat.id,
`📊 𝗥𝗜𝗔𝗦 𝗦𝗧𝗔𝗧𝗦

┏━━━━━━━━━━━━━━━━━━━┓
┃ 📱 Total Sessions : ${dirs.length}
┃ ✅ Active Online  : ${dirs.filter(d=>global.sessions.has(d)).length}
┃ ⏱️ Uptime         : ${getUp()}
┃ 👑 Admins         : ${bdb.admins.length}
┃ 💎 Premium        : ${bdb.premium.length}
┗━━━━━━━━━━━━━━━━━━━┛

🌹 RIAS AI • Jinx Official`
    );
  });

  tgBot.onText(/^\/pair(?:\s+(\d+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phone  = match[1];
    if (!canUse(msg.from.id)) return deny(chatId, msg.from.first_name);
    if (!phone) return tgBot.sendMessage(chatId, '📱 Usage: /pair <number>\nExample: /pair 2348012345678');
    if (global.sessions?.has(phone)) return tgBot.sendMessage(chatId, `✅ ${phone} is already linked.\nUse /delpair ${phone} to unlink first.`);
    await tgBot.sendMessage(chatId, `╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗\n║ 📱 Pairing: ${phone}\n║ ⏳ Please wait...\n╚═══════════════════╝`);
    try {
      await startpairing(phone, chatId, tgBot);
    } catch (err) {
      global.sessions?.delete(phone);
      tgBot.sendMessage(chatId, `❌ Pairing failed: ${err.message}\n\nTry again or contact Jinx Official.`, {
        reply_markup: { inline_keyboard: [[{ text: '👑 Contact Jinx', url: 'https://wa.me/2348075997375' }]]}
      });
    }
  });

  tgBot.onText(/^\/delpair(?:\s+(\S+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!canUse(msg.from.id)) return deny(chatId, msg.from.first_name);
    const id = match[1];
    if (!id) return tgBot.sendMessage(chatId, 'Usage: /delpair <number>');
    const target = path.join(__dirname, 'pairing', id);
    try {
      if (!fs.existsSync(target)) return tgBot.sendMessage(chatId, `❌ Session "${id}" not found.`);
      if (global.sessions?.has(id)) {
        try { const s = global.sessions.get(id); s?.end?.(new Error('Deleted')); s?.ws?.close?.(); } catch {}
        global.sessions.delete(id);
      }
      fs.rmSync(target, { recursive: true, force: true });
      tgBot.sendMessage(chatId, `╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗\n║ ✅ Session Deleted\n║ 📱 Number: ${id}\n╚═══════════════════╝`);
    } catch (e) { tgBot.sendMessage(chatId, `❌ Error: ${e.message}`); }
  });

  tgBot.onText(/^\/listpaired$/i, async (msg) => {
    const chatId = msg.chat.id;
    if (!canUse(msg.from.id)) return deny(chatId, msg.from.first_name);
    const dirs = fs.existsSync(path.join(__dirname,'pairing'))
      ? fs.readdirSync(path.join(__dirname,'pairing')).filter(d=>fs.statSync(path.join(__dirname,'pairing',d)).isDirectory())
      : [];
    if (!dirs.length) return tgBot.sendMessage(chatId, '╔═══[ 🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 ]═══╗\n║ 📭 No paired sessions yet.\n╚═══════════════════╝');
    const lines = dirs.map((d,i) => `${i+1}. 📱 ${d} — ${global.sessions?.has(d) ? '✅ Online' : '❌ Offline'}`);
    tgBot.sendMessage(chatId, `╔═══[ 📱 Paired Sessions ]═══╗\n\n${lines.join('\n')}\n\nTotal: ${dirs.length} | Active: ${dirs.filter(d=>global.sessions?.has(d)).length}\n╚═══════════════════════╝`);
  });

  tgBot.onText(/^\/addowner(?:\s+(\d+))?$/i, async (msg, match) => {
    if (!isOwner(msg.from.id)) return deny(msg.chat.id, msg.from.first_name);
    const id = String(match[1]||'');
    if (!id) return tgBot.sendMessage(msg.chat.id, 'Usage: /addowner <telegram_id>');
    if (bdb.admins.includes(id)) return tgBot.sendMessage(msg.chat.id, `❌ ${id} is already an owner.`);
    bdb.admins.push(id); saveBDB();
    tgBot.sendMessage(msg.chat.id, `✅ Owner added: ${id}\n\n🌹 RIAS AI`);
  });

  tgBot.onText(/^\/delowner(?:\s+(\d+))?$/i, async (msg, match) => {
    if (!isOwner(msg.from.id)) return deny(msg.chat.id, msg.from.first_name);
    const id = String(match[1]||'');
    if (!id) return tgBot.sendMessage(msg.chat.id, 'Usage: /delowner <telegram_id>');
    if (id === String(ownerId)) return tgBot.sendMessage(msg.chat.id, '❌ Cannot remove yourself as owner.');
    bdb.admins = bdb.admins.filter(x => x !== id); saveBDB();
    tgBot.sendMessage(msg.chat.id, `✅ Owner removed: ${id}\n\n🌹 RIAS AI`);
  });

  tgBot.onText(/^\/addpremium(?:\s+(\d+))?$/i, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return deny(msg.chat.id, msg.from.first_name);
    const id = String(match[1]||'');
    if (!id) return tgBot.sendMessage(msg.chat.id, 'Usage: /addpremium <telegram_id>');
    if (bdb.premium.includes(id)) return tgBot.sendMessage(msg.chat.id, `❌ ${id} is already premium.`);
    bdb.premium.push(id); saveBDB();
    tgBot.sendMessage(msg.chat.id, `💎 Premium added: ${id}\n\n🌹 RIAS AI`);
  });

  tgBot.onText(/^\/delpremium(?:\s+(\d+))?$/i, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return deny(msg.chat.id, msg.from.first_name);
    const id = String(match[1]||'');
    if (!id) return tgBot.sendMessage(msg.chat.id, 'Usage: /delpremium <telegram_id>');
    bdb.premium = bdb.premium.filter(x => x !== id); saveBDB();
    tgBot.sendMessage(msg.chat.id, `✅ Premium removed: ${id}\n\n🌹 RIAS AI`);
  });

  tgBot.on('callback_query', async (q) => {
    await tgBot.answerCallbackQuery(q.id);
    if (q.data === 'menu') tgBot.emit('text', { chat: q.message.chat, from: q.from }, ['/menu']);
  });

  tgBot.on('polling_error', (err) => {
    if (err.message?.includes('401')) {
      console.error(`[TG] Invalid token for @${botUsername}, stopping.`);
      tgBot.stopPolling();
      // Remove from deployedTgBots
      for (const [t, v] of deployedTgBots.entries()) {
        if (v.bot === tgBot) { deployedTgBots.delete(t); break; }
      }
    }
  });
}

// ── Start the web server ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(chalk.green.bold(`\n  🌐 RIAS Web Deploy running on port ${PORT}`));
  console.log(chalk.cyan.bold(`  🌐 Open http://localhost:${PORT} to access the site\n`));
});
