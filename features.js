// ── features.js — RIAS Advanced Feature Systems ──────────────
const fs   = require('fs-extra');
const path = require('path');
const axios = require('axios');

// ── STORES ────────────────────────────────────────────────────
const antiLinkMap   = new Map(); // groupJid → bool
const antiSpamMap   = new Map(); // groupJid → bool
const spamTracker   = new Map(); // `${group}:${user}` → {count,timer}
const statsStore    = new Map(); // `${group}:${user}` → {msgs,xp}
const birthdayStore = new Map(); // userJid → {day,month,name}
const welcomeStore  = new Map(); // groupJid → {enabled,msg}
const goodbyeStore  = new Map(); // groupJid → {enabled,msg}
const levelStore    = new Map(); // `${group}:${user}` → {xp,level}

// ── XP / LEVEL SYSTEM ────────────────────────────────────────
const XP_PER_MSG  = 8;
const XP_TABLE    = [0,100,250,500,900,1400,2000,2800,3800,5000,7000,10000];
const LEVEL_NAMES = [
  'Rookie 🌱','Bronze ⚔️','Silver 🥈','Gold 🏆',
  'Platinum 💎','Diamond 💠','Master 🔥','Grandmaster 🌟',
  'Legend 👑','Mythic 🔴','RIAS Tier 🌹','Ghost Mode 👻'
];

function getLevelInfo(xp) {
  let lvl = 0;
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]) { lvl = i; break; }
  }
  return {
    level : lvl,
    name  : LEVEL_NAMES[lvl] || LEVEL_NAMES[LEVEL_NAMES.length - 1],
    next  : XP_TABLE[lvl + 1] || null,
    xp,
  };
}

function addXP(groupJid, userJid) {
  const key  = `${groupJid}:${userJid}`;
  const data = levelStore.get(key) || { xp: 0, level: 0 };
  data.xp   += XP_PER_MSG;
  const before = data.level;
  const info   = getLevelInfo(data.xp);
  data.level   = info.level;
  levelStore.set(key, data);
  return { leveledUp: info.level > before, ...info };
}

// ── STATS TRACKER ────────────────────────────────────────────
function trackMessage(groupJid, userJid) {
  const key  = `${groupJid}:${userJid}`;
  const data = statsStore.get(key) || { msgs: 0 };
  data.msgs += 1;
  statsStore.set(key, data);
}

function getGroupStats(groupJid) {
  const result = [];
  for (const [key, val] of statsStore) {
    if (key.startsWith(groupJid + ':')) {
      const userJid = key.split(':').slice(1).join(':');
      result.push({ userJid, msgs: val.msgs });
    }
  }
  return result.sort((a, b) => b.msgs - a.msgs);
}

// ── ANTI-SPAM ────────────────────────────────────────────────
const SPAM_LIMIT   = 5;   // messages
const SPAM_WINDOW  = 5000; // ms

function checkSpam(groupJid, userJid) {
  const key  = `${groupJid}:${userJid}`;
  const now  = Date.now();
  const data = spamTracker.get(key) || { count: 0, first: now };
  if (now - data.first > SPAM_WINDOW) {
    data.count = 1; data.first = now;
  } else {
    data.count += 1;
  }
  spamTracker.set(key, data);
  return data.count >= SPAM_LIMIT;
}

// ── PERSIST DATA ────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'rias_data.json');

async function saveAll() {
  try {
    await fs.writeJson(DATA_FILE, {
      antiLink  : Object.fromEntries(antiLinkMap),
      antiSpam  : Object.fromEntries(antiSpamMap),
      stats     : Object.fromEntries(statsStore),
      birthdays : Object.fromEntries(birthdayStore),
      welcome   : Object.fromEntries(welcomeStore),
      goodbye   : Object.fromEntries(goodbyeStore),
      levels    : Object.fromEntries(levelStore),
    });
  } catch (e) { console.error('[DATA] Save error:', e.message); }
}

async function loadAll() {
  try {
    if (!await fs.pathExists(DATA_FILE)) return;
    const d = await fs.readJson(DATA_FILE);
    const load = (map, src) => src && Object.entries(src).forEach(([k,v]) => map.set(k,v));
    load(antiLinkMap,   d.antiLink);
    load(antiSpamMap,   d.antiSpam);
    load(statsStore,    d.stats);
    load(birthdayStore, d.birthdays);
    load(welcomeStore,  d.welcome);
    load(goodbyeStore,  d.goodbye);
    load(levelStore,    d.levels);
    console.log('[DATA] ✅ Feature data loaded');
  } catch (e) { console.error('[DATA] Load error:', e.message); }
}

setInterval(saveAll, 5 * 60 * 1000); // auto-save every 5 min

// ── BIRTHDAY CHECKER ─────────────────────────────────────────
function startBirthdayChecker(sockets) {
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== 8 || now.getMinutes() > 2) return;
    const today = { day: now.getDate(), month: now.getMonth() + 1 };

    for (const [jid, data] of birthdayStore) {
      if (data.day !== today.day || data.month !== today.month) continue;
      for (const [, sock] of sockets) {
        try {
          // Try to message every group and see if the person is there
          const msg =
`🎂 ${bold('𝗛𝗔𝗣𝗣𝗬  𝗕𝗜𝗥𝗧𝗛𝗗𝗔𝗬!')} 🎂

🎉 @${jid.split('@')[0]} is celebrating their birthday today!

🌹 ${italic('"May your day be as powerful as RIAS herself."')}

🎊 From RIAS AI with love 🔴 ${now.getFullYear()}`;

          await sock.sendMessage(data.groupJid || jid, { text: msg, mentions: [jid] });
        } catch {}
      }
    }
  }, 60 * 60 * 1000);
}

// ── FONT HELPERS (duplicated for standalone use) ─────────────
function bold(t) {
  return [...t].map(c => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90)  return String.fromCodePoint(n + 0x1D400 - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(n + 0x1D41A - 97);
    if (n >= 48 && n <= 57)  return String.fromCodePoint(n + 0x1D7CE - 48);
    return c;
  }).join('');
}
function italic(t) {
  return [...t].map(c => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90)  return String.fromCodePoint(n + 0x1D434 - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(n + 0x1D44E - 97);
    return c;
  }).join('');
}

// ── WELCOME / GOODBYE HANDLER ────────────────────────────────
async function handleGroupUpdate(sock, events) {
  for (const event of events) {
    const groupJid = event.id;
    for (const participant of event.participants) {
      const userNum = participant.split('@')[0];

      if (event.action === 'add') {
        // ── WELCOME ──
        const cfg = welcomeStore.get(groupJid);
        const welcomeMsg = cfg?.msg || `Welcome to the group, @${userNum}! 🌹\nWe're glad to have you here.\n\nType ${process.env.PREFIX || '.'}menu to see what RIAS can do. 🔴`;
        if (cfg?.enabled !== false) {
          try {
            const imgBuf = await fetchBuffer(process.env.BOT_IMAGE || 'https://files.catbox.moe/h0flrc.jpg');
            if (imgBuf) {
              await sock.sendMessage(groupJid, {
                image: imgBuf,
                caption:
`╔══════════════════════╗
║  🌅  ${bold('𝗪𝗘𝗟𝗖𝗢𝗠𝗘!')}  🌅  ║
╚══════════════════════╝

👋 Hey @${userNum}!

${welcomeMsg}

${italic('RIAS is watching. Behave.')} 🔴`,
                mentions: [participant],
              });
            } else {
              await sock.sendMessage(groupJid, {
                text:
`🌅 ${bold('𝗪𝗘𝗟𝗖𝗢𝗠𝗘!')}

👋 Hey @${userNum}!
${welcomeMsg}

${italic('RIAS is watching. Behave.')} 🔴`,
                mentions: [participant],
              });
            }
          } catch (e) { console.error('[Welcome]', e.message); }
        }
      }

      if (event.action === 'remove') {
        // ── GOODBYE ──
        const cfg = goodbyeStore.get(groupJid);
        const goodbyeMsg = cfg?.msg || `@${userNum} has left the group. 👋\n\n${italic('Another one bites the dust. 🔴')}`;
        if (cfg?.enabled !== false) {
          try {
            await sock.sendMessage(groupJid, {
              text:
`👋 ${bold('𝗚𝗢𝗢𝗗𝗕𝗬𝗘!')}

${goodbyeMsg}

${italic('RIAS notes your departure. 🌹')}`,
              mentions: [participant],
            });
          } catch (e) { console.error('[Goodbye]', e.message); }
        }
      }
    }
  }
}

async function fetchBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(res.data);
  } catch { return null; }
}

module.exports = {
  // Stores (for use in wa.js commands)
  antiLinkMap, antiSpamMap, spamTracker,
  statsStore, birthdayStore, welcomeStore, goodbyeStore, levelStore,
  // Functions
  addXP, getLevelInfo, trackMessage, getGroupStats,
  checkSpam, saveAll, loadAll,
  startBirthdayChecker, handleGroupUpdate,
  bold, italic,
};
