const Baileys = require("@whiskeysockets/baileys");

// This extracts everything we need safely
const { 
  default: makeWASocket, 
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore  // We pull it directly from the main package now
} = Baileys;
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const chalk = require('chalk');
const cheerio = require("cheerio");
const { writeExif, imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { sendGmail, formatSize, isUrl, generateMessageTag, getBuffer, getSizeMedia, runtime, fetchJson, formatp, getTime, getRandom } = require('./lib/myfunction');
const smsg = require("./smsg");
const moment = require("moment-timezone");
const readline = require("readline");
const cfonts = require('cfonts');
const { color } = require('./lib/color');
const sessionsRoot = path.join(__dirname, "pairing");
if (!fs.existsSync(sessionsRoot)) fs.mkdirSync(sessionsRoot, { recursive: true });
const normalizeJid = (jid = "") =>
  jid.includes("@") ? jid : jid + "@s.whatsapp.net";
// Global sessions map - shared across files
global.sessions = global.sessions || new Map();

const listcolor = [
  chalk.red.bold,
  chalk.green.bold,
  chalk.yellow.bold,
  chalk.blue.bold,
  chalk.magenta.bold,
  chalk.cyan.bold,
];
const colorize = (text) => listcolor[Math.floor(Math.random() * listcolor.length)](text);

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach(file => {
      const curPath = path.join(folderPath, file);
      fs.lstatSync(curPath).isDirectory() ? deleteFolderRecursive(curPath) : fs.unlinkSync(curPath);
    });
    fs.rmdirSync(folderPath);
  }
}

// ✅ BROWSER ROTATION WITH EDGE SUPPORT
// ✅ REPLACED BROWSER SECTION
// 1. Define the browsers at the top of the file
const availableBrowsers = [
  ['Ubuntu', 'Chrome', '20.0.04'],
  ['Windows', 'Chrome', '11.0.1'],
  ['Mac OS', 'Chrome', '10.0.1'],
  ['Linux', 'Chrome', '8.0.1']
];

function getRandomBrowserConfig() {
  const selected = availableBrowsers[Math.floor(Math.random() * availableBrowsers.length)];
  return {
    os: selected[0],
    name: selected[1], // Changed from 'browser' to 'name' to avoid confusion
    version: selected[2]
  };
}

let isLoaded = false; // Add this at the very top of your file

// 2. Inside your startpairing function
// [NEW FUNCTION] Stats Tracker
function getSessionStats() {
  const sessionsRoot = path.join(__dirname, 'pairing');
  
  // 1. Count folders on disk (Saved Sessions)
  let savedCount = 0;
  if (fs.existsSync(sessionsRoot)) {
    savedCount = fs.readdirSync(sessionsRoot).filter(dir => 
      fs.statSync(path.join(sessionsRoot, dir)).isDirectory()
    ).length;
  }

  // 2. Count active connections in memory (Active Sessions)
  const activeCount = global.sessions ? global.sessions.size : 0;

  return {
    saved: savedCount,
    active: activeCount
  };
}

async function startpairing(phoneNumber, chatId = null, bot = null, onStarted = null) {
  phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

  const sessionsRoot = path.join(__dirname, 'pairing'); 
  const sessionDir = path.join(sessionsRoot, phoneNumber);

  if (!fs.existsSync(sessionsRoot)) fs.mkdirSync(sessionsRoot, { recursive: true });
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  if (global.sessions && global.sessions.has(phoneNumber)) {
    const oldSock = global.sessions.get(phoneNumber);
    try { oldSock.ws?.close(); } catch {}
    try { oldSock.end(new Error("Replaced by new pairing")); } catch {}
    global.sessions.delete(phoneNumber);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const store = makeInMemoryStore({
    logger: pino().child({ level: 'silent', stream: 'store' })
  });

  const browserConfig = getRandomBrowserConfig();

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    version,
    browser: [browserConfig.os, browserConfig.name, browserConfig.version], 
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on('creds.update', saveCreds);

  console.log(`[PAIRING] System Online for: ${phoneNumber}`);
  
  store.bind(sock.ev);
  global.sessions.set(phoneNumber, sock);

  try { if (typeof onStarted === 'function') onStarted(phoneNumber, sock); } catch (e) {}

  if (chatId && bot) {
    await bot.sendMessage(chatId, `Connecting WhatsApp number: *${phoneNumber}*...\nPlease wait for pairing code...`, { parse_mode: "Markdown" });
  }

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;

        const message = `
╔═════════════════════╗
║  🌹  𝗥𝗜𝗔𝗦 𝗔𝗜 𝗣𝗔𝗜𝗥𝗜𝗡𝗚  🌹
╠═════════════════════╣
║ 📞 Nᴜᴍʙᴇʀ : ${phoneNumber}
║ 🔑 Cᴏᴅᴇ    : ${code}
║ ⏰ Vᴀʟɪᴅ Fᴏʀ : 2 Mɪɴᴜᴛᴇs
╠═════════════════════╣
║ 1️⃣  Oᴘᴇɴ WʜᴀᴛsAᴘᴘ
║ 2️⃣  Lɪɴᴋᴇᴅ Dᴇᴠɪᴄᴇs
║ 3️⃣  Lɪɴᴋ ᴀ Dᴇᴠɪᴄᴇ
║ 4️⃣  Eɴᴛᴇʀ Cᴏᴅᴇ ✅
╠═════════════════════╣
║ 🌹 RIAS AI • Jinx Official
╚═════════════════════╝`;

        if (chatId && bot) {
          await bot.sendMessage(chatId, message.trim(), {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "🌹 RIAS Channel", url: "https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S" }]]
            }
          });
        }
        
      } catch (err) {
        console.error("Pairing code error:", err);
        global.sessions.delete(phoneNumber);
      }
    }, 3000);
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      console.log(`[SUCCESS] ${phoneNumber} is now ONLINE`);
      // Update stats when a connection opens
      const stats = getSessionStats();
      console.log(`[STATS] Total Active Sessions: ${stats.active}`);
    }
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startpairing(phoneNumber, chatId, bot), 5000);
      } else {
        global.sessions.delete(phoneNumber);
      }
    }
  });

    sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const msg = chatUpdate.messages[0];
      if (!msg || !msg.message) return;

      // 1. Ignore messages sent by the bot's own system (Baileys/WA internal)
      if (msg.key && msg.key.remoteJid === 'status@broadcast') return;
      
      // 2. Format the message using your smsg function
      const mek = smsg(sock, msg, store);

      // 3. DEBUG: This will show you exactly what the bot "sees" in your console
      console.log(chalk.hex('#FF00FF').bold(`[MSG] From: ${mek.sender.split('@')[0]} | Type: ${mek.mtype}`));

      // 4. Call your command file
      // NOTE: Make sure "./base.js" is the correct path to your commands!
      require("./base.js")(sock, mek, chatUpdate, store);

    } catch (err) {
      // 5. CRITICAL: Stop hiding errors! This will tell you why it's failing.
      console.error(chalk.red.bold("[ERROR in messages.upsert]:"), err);
    }
  });

  return sock;
}


// --- UPDATED SESSION MANAGER ---

function loadAllSessions() {
  if (isLoaded) return; // If it already ran, STOP.
  
  const sessionsRoot = path.join(__dirname, 'pairing');
  if (!fs.existsSync(sessionsRoot)) return;

  const dirs = fs.readdirSync(sessionsRoot).filter(dir => 
    fs.statSync(path.join(sessionsRoot, dir)).isDirectory()
  );

  console.log(chalk.hex('#00FF00').bold(`[SYSTEM] Found ${dirs.length} saved sessions. Starting auto-load...`));
  
  isLoaded = true; // Mark as done

  dirs.forEach(dir => {
    startpairing(dir).catch(() => {});
  });
}


// Initial Load

module.exports = { startpairing, getSessionStats };




async function startpairingImmediate(phoneNumber, chatId = null, bot = null) {
  return new Promise(async (resolve, reject) => {
    try {
      if (activeCount >= MAX_CONCURRENT_SESSIONS) {
        console.warn(colorize(`[WARNING] Starting immediate session even though activeCount ${activeCount} >= MAX ${MAX_CONCURRENT_SESSIONS}`));
      }
      activeCount++;
      await startpairing(phoneNumber, chatId, bot, (phone, sock) => {
        activeSessions.set(phone, sock);
        sock.ev.on('connection.update', (u) => {
          const { connection } = u;
          if (connection === 'close') {
            if (activeSessions.has(phone)) activeSessions.delete(phone);
            if (activeCount > 0) activeCount--;
          }
        });
      });
      resolve();
    } catch (err) {
      if (activeCount > 0) activeCount--;
      reject(err);
    }
  });
}

function getStats() {
  return {
    queued: sessionQueue.length,
    active: activeSessions.size,
    activeCount,
    maxConcurrent: MAX_CONCURRENT_SESSIONS,
    maxTotalSaved: MAX_TOTAL_SESSIONS
  };
}

loadAllSessions();

module.exports = {
  startpairing,
  startpairingImmediate,
  loadAllSessions,
  sessions: global.sessions,
  getSessionManagerStats: getStats
};