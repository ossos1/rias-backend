// ── Polyfill crypto ──────────────────────────────────────────
const { webcrypto } = require('crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadContentFromMessage,
} = require('@whiskeysockets/baileys');
const pino   = require('pino');
const path   = require('path');
const fs     = require('fs-extra');
const axios  = require('axios');
const FT     = require('./features');

const logger  = pino({ level: 'silent' });
const sockets = new Map();
const warnStore = new Map();

// ── CONFIG ────────────────────────────────────────────────────
const OWNER_NUMBER = process.env.OWNER_NUMBER || '2348075997375';
const DEV_NUMBER   = '2348075997375';
const GEMINI_KEY   = process.env.GEMINI_API_KEY || 'AIzaSyCMs3-yP3wlWwnhprO9iE_t-oEYDpDjl1M';
const WA_CHANNEL   = 'https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S';
const BOT_IMAGE    = 'https://files.catbox.moe/h0flrc.jpg';
const PREFIX       = process.env.PREFIX || '.';

// ── FANCY FONTS ───────────────────────────────────────────────
const F = {
  bold:  t => [...t].map(c => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90)  return String.fromCodePoint(n + 0x1D400 - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(n + 0x1D41A - 97);
    if (n >= 48 && n <= 57)  return String.fromCodePoint(n + 0x1D7CE - 48);
    return c;
  }).join(''),
  italic: t => [...t].map(c => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90)  return String.fromCodePoint(n + 0x1D434 - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(n + 0x1D44E - 97);
    return c;
  }).join(''),
  mono: t => [...t].map(c => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90)  return String.fromCodePoint(n + 0x1D670 - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(n + 0x1D68A - 97);
    if (n >= 48 && n <= 57)  return String.fromCodePoint(n + 0x1D7F6 - 48);
    return c;
  }).join(''),
  sans: t => [...t].map(c => {
    const n = c.codePointAt(0);
    if (n >= 65 && n <= 90)  return String.fromCodePoint(n + 0x1D5A0 - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(n + 0x1D5BA - 97);
    if (n >= 48 && n <= 57)  return String.fromCodePoint(n + 0x1D7E2 - 48);
    return c;
  }).join(''),
};

// ── PAIR ─────────────────────────────────────────────────────
async function pairNumber(phoneNumber) {
  const num = String(phoneNumber).replace(/[^0-9]/g, '');
  if (sockets.has(num)) {
    try { sockets.get(num).end(undefined); } catch {}
    sockets.delete(num);
  }
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out. Try again.')), 60000);
    try {
      const authDir = path.join(__dirname, 'sessions', num);
      await fs.ensureDir(authDir);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();
      const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
      sockets.set(num, sock);
      sock.ev.on('creds.update', saveCreds);
      let codeSent = false;
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (!codeSent && !sock.authState.creds.registered) {
          codeSent = true;
          await new Promise(r => setTimeout(r, 2000));
          try {
            const code = await sock.requestPairingCode(num);
            clearTimeout(timeout);
            resolve(code?.match(/.{1,4}/g)?.join('-') || code);
          } catch (err) {
            clearTimeout(timeout); sockets.delete(num);
            reject(new Error(`Pairing failed: ${err.message}`));
          }
          return;
        }
        if (connection === 'open') {
          clearTimeout(timeout);
          console.log(`[WA] ✅ ${num} connected!`);
          startMessageHandler(sock, num);
          if (!codeSent) resolve('ALREADY_LINKED');
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code !== DisconnectReason.loggedOut) setTimeout(() => reconnect(num), 5000);
          else { sockets.delete(num); await fs.remove(path.join(__dirname, 'sessions', num)); }
        }
      });
    } catch (err) { clearTimeout(timeout); reject(err); }
  });
}

async function reconnect(phoneNumber) {
  try {
    const num = String(phoneNumber).replace(/[^0-9]/g, '');
    const authDir = path.join(__dirname, 'sessions', num);
    if (!await fs.pathExists(authDir)) return;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
    sockets.set(num, sock);
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') { console.log(`[WA] ✅ ${num} reconnected.`); startMessageHandler(sock, num); }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) setTimeout(() => reconnect(num), 5000);
        else sockets.delete(num);
      }
    });
  } catch (err) { console.error('[WA reconnect]', err.message); }
}

async function restoreAllSessions() {
  await FT.loadAll();
  FT.startBirthdayChecker(sockets);
  const sessionsDir = path.join(__dirname, 'sessions');
  await fs.ensureDir(sessionsDir);
  const dirs = await fs.readdir(sessionsDir);
  for (const num of dirs) {
    console.log(`[WA] Restoring: ${num}`);
    reconnect(num).catch(err => console.error(`[WA] Restore failed ${num}:`, err.message));
  }
}

// ── MESSAGE HANDLER ──────────────────────────────────────────
function startMessageHandler(sock, phoneNumber) {
  sock.ev.removeAllListeners('messages.upsert');
  sock.ev.removeAllListeners('group-participants.update');

  // ── Group join/leave events ──
  sock.ev.on('group-participants.update', async (event) => {
    await FT.handleGroupUpdate(sock, [event]);
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;

      const isOwnerMsg = msg.key.fromMe;
      const senderJid  = isOwnerMsg
        ? phoneNumber + '@s.whatsapp.net'
        : (msg.key.participant || msg.key.remoteJid);
      const senderNum = senderJid.replace('@s.whatsapp.net','').replace('@g.us','').split(':')[0];
      const from      = msg.key.remoteJid;
      const isGroup   = from.endsWith('@g.us');
      const isOwner   = senderNum === OWNER_NUMBER || senderNum === DEV_NUMBER || isOwnerMsg;

      // ── Get text from all message types ──────────────────────
      const numberShortcuts = { '1':'aimenu','2':'gamemenu','3':'adminmenu','4':'downloadmenu','5':'dmmenu','6':'funmenu','7':'utilitymenu','8':'statsmenu','9':'ownermenu','0':'allcmds' };

      let text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.templateButtonReplyMessage?.selectedId ||
        '';

      // Resolve number shortcuts (1-9, 0) to menu commands
      if (text && numberShortcuts[text.trim()]) {
        text = numberShortcuts[text.trim()];
      }

      // ── ANTI-LINK: real deletion ──
      if (isGroup && !isOwner && FT.antiLinkMap.get(from)) {
        const urlRegex = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/i;
        if (urlRegex.test(text)) {
          try {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, {
              text: `🔗 ${F.bold('Anti-Link')} 🔗

@${senderNum} — Links are not allowed here! ⚠️

_${F.italic('RIAS deleted your message. 🔴')}_`,
              mentions: [senderJid],
            });
          } catch {}
          continue;
        }
      }

      // ── ANTI-SPAM: real deletion ──
      if (isGroup && !isOwner && FT.antiSpamMap.get(from) && text) {
        const isSpam = FT.checkSpam(from, senderJid);
        if (isSpam) {
          try {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, {
              text: `🛡️ ${F.bold('Anti-Spam')} 🛡️

@${senderNum} — Slow down! You're sending too fast. ⚠️

_${F.italic('Message deleted by RIAS. 🔴')}_`,
              mentions: [senderJid],
            });
          } catch {}
          continue;
        }
      }

      // ── XP & STATS tracking (all messages in groups) ──
      if (isGroup && text && !msg.key.fromMe) {
        FT.trackMessage(from, senderJid);
        const xpResult = FT.addXP(from, senderJid);
        if (xpResult.leveledUp) {
          try {
            await sock.sendMessage(from, {
              text:
`🏅 ${F.bold('LEVEL UP!')} 🏅

🎉 @${senderNum} leveled up!

${F.bold('Level:')} ${xpResult.level} — ${F.italic(xpResult.name)}
${F.bold('XP:')} ${xpResult.xp}${xpResult.next ? ' / ' + xpResult.next : ' (MAX)'}

${F.italic('Keep going. RIAS is watching. 🔴')}`,
              mentions: [senderJid],
            });
          } catch {}
        }
      }

      if (!text) continue;

      // Handle button/list selections (no prefix needed)
      const isButtonReply = !!(
        msg.message?.listResponseMessage ||
        msg.message?.buttonsResponseMessage ||
        msg.message?.templateButtonReplyMessage
      );

      // Require prefix for regular text, not for button replies
      if (!isButtonReply && !text.startsWith(PREFIX)) continue;

      const cmdText = isButtonReply ? text : text.slice(PREFIX.length);
      const [rawCmd, ...args] = cmdText.trim().split(/\s+/);
      const cmd = rawCmd.toLowerCase();

      const quoted       = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      const reply = async (content) => {
        if (typeof content === 'string')
          return sock.sendMessage(from, { text: content }, { quoted: msg });
        return sock.sendMessage(from, content, { quoted: msg });
      };
      const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } });

      await react('⏳');
      await handleCommand(cmd, args, msg, from, sock, reply, react, isOwner, isGroup, senderNum, senderJid, quoted, mentionedJid, phoneNumber);
    }
  });
}

// ── SEND BUTTON MENU ─────────────────────────────────────────
async function sendButtonMenu(sock, from, msg, senderJid, senderName, isOwner) {
  const greet = getGreeting();
  const user  = senderJid.split('@')[0];

  const caption =
`╔══════════════════════════╗
║  🌹  *𝗥 𝗜 𝗔 𝗦  𝗔 𝗜*  🌹  ║
║   _Made by Jinx Official_   ║
╚══════════════════════════╝

${F.bold('𝐇𝐞𝐲')} @${user}! 👋 ${greet}!

_I'm RIAS — your intelligent, sassy and powerful WhatsApp companion._

┌─────────────────────────
│ 🤖 *AI:* Gemini powered
│ ⚔️ *Admin:* Full group control
│ 🎮 *Games:* Built-in fun
│ 🏅 *XP System:* Level up
│ 🎂 *Birthdays:* Auto-announce
│ 🛡️ *Protection:* Anti-spam & links
└─────────────────────────

👇 *Reply with a category number:*

*1* — 🤖 AI Section
*2* — 🎮 Games Section
*3* — ⚔️ Group Section
*4* — 📥 Downloads
*5* — 💬 DM Tools
*6* — 🎲 Fun Section
*7* — 🛠️ Utility
*8* — 🏅 Stats & Levels${isOwner ? '\n*9* — 👑 Owner Section' : ''}
*0* — 📋 All Commands

> 🔗 ${WA_CHANNEL}
> 👑 wa.me/${DEV_NUMBER}

_She doesn't beg for attention. She commands it. 🔴_`;

  // ── Step 1: send image with caption ──────────────────────────
  // Use { url } so Baileys fetches it directly — avoids fetchBuffer timeout
  try {
    await sock.sendMessage(from, {
      image:    { url: BOT_IMAGE },
      caption,
      mentions: [senderJid],
    }, { quoted: msg });
  } catch {
    // Image failed — send text-only caption
    await sock.sendMessage(from, {
      text:     caption,
      mentions: [senderJid],
    }, { quoted: msg });
  }

  // ── Step 2: send the interactive list message ─────────────────
  // listMessage is the correct Baileys API for WhatsApp lists
  const rows = [
    { title: '🤖 ʀɪᴀs ᴀɪ sᴇᴄᴛɪᴏɴ',    description: '✦ Gemini AI • Ask • Story • Roast',   rowId: 'aimenu'       },
    { title: '🎮 ɢᴀᴍᴇs sᴇᴄᴛɪᴏɴ',       description: '✦ RPS • Slots • Guess • Trivia',       rowId: 'gamemenu'     },
    { title: '⚔️ ɢʀᴏᴜᴘ sᴇᴄᴛɪᴏɴ',       description: '✦ Kick • Ban • Warn • Promote',         rowId: 'adminmenu'    },
    { title: '📥 ᴅᴏᴡɴʟᴏᴀᴅ sᴇᴄᴛɪᴏɴ',   description: '✦ Sticker • TTS • Lyrics • Links',     rowId: 'downloadmenu' },
    { title: '💬 ᴅᴍ sᴇᴄᴛɪᴏɴ',          description: '✦ Broadcast • Auto-Reply • Channel',    rowId: 'dmmenu'       },
    { title: '🎲 ꜰᴜɴ sᴇᴄᴛɪᴏɴ',         description: '✦ Ship • Truth • Dare • Rank',          rowId: 'funmenu'      },
    { title: '🛠️ ᴜᴛɪʟɪᴛʏ sᴇᴄᴛɪᴏɴ',    description: '✦ Calc • Weather • Define • Time',      rowId: 'utilitymenu'  },
    { title: '🏅 sᴛᴀᴛs & ʟᴇᴠᴇʟs',      description: '✦ XP • Leaderboard • Birthdays',        rowId: 'statsmenu'    },
    ...(isOwner ? [{ title: '👑 ᴏᴡɴᴇʀ sᴇᴄᴛɪᴏɴ', description: '✦ Shutdown • Block • Controls', rowId: 'ownermenu' }] : []),
    { title: '📋 ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs',        description: '✦ Every command in one place',          rowId: 'allcmds'      },
  ];

  try {
    await sock.sendMessage(from, {
      listMessage: {
        title:        '🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 — Choose a Section',
        description:  '_Tap to expand a category_ 👇',
        buttonText:   '📋 ᴏᴘᴇɴ ᴍᴇɴᴜ',
        listType:     1,
        footerText:   '🔴 RIAS AI • Made by Jinx Official',
        sections:     [{ title: '📋 Menu Categories', rows }],
      },
    }, { quoted: msg });
  } catch {
    // Fallback: plain text menu if listMessage not supported
    await sock.sendMessage(from, {
      text:     getTextMenu(isOwner),
      mentions: [senderJid],
    }, { quoted: msg });
  }
}

// ── COMMAND HANDLER ──────────────────────────────────────────
async function handleCommand(cmd, args, msg, from, sock, reply, react, isOwner, isGroup, senderNum, senderJid, quoted, mentionedJid, botNum) {
  try {
    // Get sender's display name
    const senderName = msg.pushName || senderNum;

    switch (cmd) {

      // ════════════════════════════════════════
      //  MENUS — all use list/button style
      // ════════════════════════════════════════
      case 'menu':
      case 'help':
      case 'start': {
        await react('🌹');
        await sendButtonMenu(sock, from, msg, senderJid, senderName, isOwner);
        break;
      }

      case 'aimenu': {
        await react('🤖');
        await reply(getAIMenu());
        break;
      }

      case 'gamemenu': {
        await react('🎮');
        await reply(getGameMenu());
        break;
      }

      case 'adminmenu': {
        await react('⚔️');
        await reply(getAdminMenu());
        break;
      }

      case 'downloadmenu': {
        await react('📥');
        await reply(getDownloadMenu());
        break;
      }

      case 'dmmenu': {
        await react('💬');
        await reply(getDMMenu());
        break;
      }

      case 'funmenu': {
        await react('🎲');
        await reply(getFunMenu());
        break;
      }

      case 'utilitymenu': {
        await react('🛠️');
        await reply(getUtilityMenu());
        break;
      }

      case 'ownermenu': {
        if (!isOwner) return noOwner(reply, react);
        await react('👑');
        await reply(getOwnerMenu());
        break;
      }

      case 'allcmds': {
        await react('📋');
        await reply(getAllCmds());
        break;
      }

      // ════════════════════════════════════════
      //  STATUS / INFO
      // ════════════════════════════════════════
      case 'ping': {
        await react('⚡');
        const start = Date.now();
        await reply(
`⚡ ${F.bold('𝗣𝗜𝗡𝗚')} ⚡

┌─────────────────
│ 🏓 ${F.bold('Pong!')}
│ ⚡ Latency: *${Date.now() - start}ms*
│ 🔴 Status: *Online*
│ 🌹 Bot: *RIAS AI*
└─────────────────

_${F.italic('Fast as always.')} 🔴_`
        );
        break;
      }

      case 'alive': {
        await react('🔴');
        await reply(
`╔══════════════════════╗
║  🌹  ${F.bold('𝗥 𝗜 𝗔 𝗦  𝗔 𝗜')}  🌹  ║
╚══════════════════════╝

┌─────────────────────
│ ✅ Status: ${F.bold('Online & Active')}
│ ⚡ Mode: ${F.bold('Full Power')}
│ 🤖 AI: ${F.bold('Gemini Active')}
│ 👑 Owner: ${F.bold('Jinx Official')}
│ 🔗 Channel: tap below
│ 📅 Running: ${F.mono(new Date().toDateString())}
└─────────────────────

${F.italic('She doesn\'t beg for attention.')}
${F.italic('She commands it.')} 🔴

> 🔗 ${WA_CHANNEL}`
        );
        break;
      }

      case 'botinfo':
      case 'info': {
        await react('📊');
        await reply(
`╔══════════════════════╗
║  📊  ${F.bold('𝗕𝗢𝗧  𝗜𝗡𝗙𝗢')}  📊  ║
╚══════════════════════╝

┌─────────────────────
│ 🤖 Name: ${F.bold('RIAS AI')}
│ 👑 Owner: ${F.bold('Jinx Official')}
│ 📞 Dev: wa.me/${DEV_NUMBER}
│ 🔗 Channel: ${WA_CHANNEL}
│ 🧠 AI: ${F.bold('Google Gemini')}
│ ⚡ Prefix: ${F.mono(PREFIX)}
│ 🌹 Version: ${F.bold('3.0.0')}
│ 📦 Platform: ${F.bold('WhatsApp & Telegram')}
└─────────────────────

_${F.italic('Made with 🔥 by Jinx Official')}_`
        );
        break;
      }

      case 'groupinfo': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        await react('📊');
        try {
          const meta   = await sock.groupMetadata(from);
          const admins = meta.participants.filter(p => p.admin).length;
          await reply(
`╔══════════════════════╗
║  📊  ${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗜𝗡𝗙𝗢')}  📊  ║
╚══════════════════════╝

┌─────────────────────
│ 📛 Name: ${F.bold(meta.subject)}
│ 👥 Members: ${F.bold(String(meta.participants.length))}
│ 👑 Admins: ${F.bold(String(admins))}
│ 📅 Created: ${F.mono(new Date(meta.creation * 1000).toDateString())}
└─────────────────────
📝 ${F.italic('Description:')}
${meta.desc || F.italic('No description set.')}

_${F.italic('Powered by RIAS AI 🔴')}_`
          );
        } catch { await reply(`❌ Could not fetch group info.`); }
        break;
      }

      case 'userinfo':
      case 'whois': {
        await react('👤');
        const target = mentionedJid[0] || senderJid;
        const num    = target.split('@')[0];
        await reply(
`╔══════════════════════╗
║  👤  ${F.bold('𝗨𝗦𝗘𝗥  𝗜𝗡𝗙𝗢')}  👤  ║
╚══════════════════════╝

┌─────────────────────
│ 📞 Number: ${F.mono('+' + num)}
│ 🏷️ Name: ${F.bold(msg.pushName || 'Unknown')}
│ 👑 Admin: ${isOwner ? F.bold('Yes 👑') : 'No'}
│ 🌍 Status: ${F.bold('Active')}
└─────────────────────

_${F.italic('RIAS sees all. 🔴')}_`
        );
        break;
      }

      // ════════════════════════════════════════
      //  UTILITY COMMANDS
      // ════════════════════════════════════════
      case 'calc': {
        await react('🔢');
        const expr = args.join(' ');
        if (!expr) return reply(`🔢 ${F.bold('Calculator')}\n\nUsage: ${PREFIX}calc [expression]\nExample: ${PREFIX}calc 5 * 9 + 3`);
        try {
          const result = Function(`"use strict"; return (${expr})`)();
          await reply(
`🔢 ${F.bold('𝗖𝗔𝗟𝗖𝗨𝗟𝗔𝗧𝗢𝗥')}

┌─────────────────────
│ 📝 Expression: ${F.mono(expr)}
│ ✅ Result: ${F.bold(String(result))}
└─────────────────────

_${F.italic('RIAS does the math. 🔴')}_`
          );
        } catch { await reply(`❌ Invalid expression.\nExample: ${PREFIX}calc 10 * 5 + 2`); }
        break;
      }

      case 'time': {
        await react('🕐');
        const now = new Date();
        await reply(
`🕐 ${F.bold('𝗖𝗨𝗥𝗥𝗘𝗡𝗧  𝗧𝗜𝗠𝗘')}

┌─────────────────────
│ 📅 Date: ${F.bold(now.toDateString())}
│ ⏰ Time: ${F.bold(now.toLocaleTimeString())}
│ 🌍 UTC: ${F.mono(now.toUTCString())}
│ 📆 Day: ${F.bold(now.toLocaleDateString('en-US',{weekday:'long'}))}
└─────────────────────

_${F.italic('Time is power. 🔴')}_`
        );
        break;
      }

      case 'define': {
        const word = args.join(' ');
        if (!word) return reply(`📖 Usage: ${PREFIX}define [word]`);
        await react('📖');
        const def = await geminiAI(
          `Define the word "${word}". Include: 1) Part of speech 2) Clear meaning 3) Example sentence 4) Synonyms`,
          'You are a concise dictionary. Format nicely.'
        );
        await reply(
`📖 ${F.bold('𝗗𝗜𝗖𝗧𝗜𝗢𝗡𝗔𝗥𝗬')}

${F.bold('Word:')} ${F.italic(word)}
━━━━━━━━━━━━━━━━━━━
${def}

_${F.italic('RIAS knows everything. 🔴')}_`
        );
        break;
      }

      case 'weather': {
        const city = args.join(' ');
        if (!city) return reply(`🌤️ Usage: ${PREFIX}weather [city]`);
        await react('🌤️');
        const weather = await geminiAI(
          `Give a realistic weather report for ${city} today with: temperature range, conditions, humidity, wind, UV index, and one tip. Be concise.`,
          'You are a professional weather forecaster.'
        );
        await reply(
`🌤️ ${F.bold('𝗪𝗘𝗔𝗧𝗛𝗘𝗥  𝗥𝗘𝗣𝗢𝗥𝗧')}

📍 ${F.bold(city)}
━━━━━━━━━━━━━━━━━━━
${weather}

_${F.italic('Stay safe out there. 🔴')}_`
        );
        break;
      }

      case 'shortlink': {
        const url = args[0];
        if (!url || !url.startsWith('http')) return reply(`🔗 Usage: ${PREFIX}shortlink [url]\nExample: ${PREFIX}shortlink https://google.com`);
        await react('🔗');
        try {
          const res  = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 8000 });
          await reply(
`🔗 ${F.bold('𝗦𝗛𝗢𝗥𝗧𝗟𝗜𝗡𝗞')}

┌─────────────────────
│ 📎 Original: ${F.mono(url.slice(0, 40) + (url.length > 40 ? '...' : ''))}
│ ✅ Short: ${F.bold(res.data)}
└─────────────────────

_${F.italic('Link shortened by RIAS. 🔴')}_`
          );
        } catch { await reply(`❌ Could not shorten link. Try again.`); }
        break;
      }

      case 'tts': {
        const text = args.join(' ');
        if (!text) return reply(`🗣️ Usage: ${PREFIX}tts [text]\nExample: ${PREFIX}tts Hello I am RIAS`);
        await react('🗣️');
        try {
          const ttsUrl = `https://api.voicerss.org/?key=free&hl=en-us&src=${encodeURIComponent(text)}&c=MP3&f=44khz_16bit_stereo`;
          const audio  = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 12000 });
          await sock.sendMessage(from, {
            audio: Buffer.from(audio.data),
            mimetype: 'audio/mpeg',
            ptt: true,
          }, { quoted: msg });
          await react('✅');
        } catch {
          await reply(`⚠️ ${F.bold('TTS')}\n\nText: "${text}"\n\n_TTS service unavailable. Try a shorter text. 🔴_`);
        }
        break;
      }

      case 'sticker':
      case 'stk': {
        await react('🖼️');
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imgMsg    = quotedMsg?.imageMessage || msg.message?.imageMessage;
        if (!imgMsg) return reply(`🖼️ ${F.bold('Sticker Maker')}\n\nReply to an image with ${PREFIX}sticker to convert it to a sticker.`);
        try {
          const stream  = await downloadContentFromMessage(imgMsg, 'image');
          const chunks  = [];
          for await (const chunk of stream) chunks.push(chunk);
          const imgBuff = Buffer.concat(chunks);
          await sock.sendMessage(from, { sticker: imgBuff }, { quoted: msg });
          await react('✅');
        } catch {
          await reply(`❌ Could not create sticker. Make sure you reply to an image.`);
        }
        break;
      }

      case 'toimg': {
        await react('🖼️');
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stkMsg    = quotedMsg?.stickerMessage || msg.message?.stickerMessage;
        if (!stkMsg) return reply(`🖼️ ${F.bold('Sticker → Image')}\n\nReply to a sticker with ${PREFIX}toimg to convert it.`);
        try {
          const stream  = await downloadContentFromMessage(stkMsg, 'sticker');
          const chunks  = [];
          for await (const chunk of stream) chunks.push(chunk);
          await sock.sendMessage(from, { image: Buffer.concat(chunks), caption: `🖼️ ${F.italic('Sticker converted to image by RIAS 🔴')}` }, { quoted: msg });
          await react('✅');
        } catch {
          await reply(`❌ Could not convert sticker. Reply to a sticker.`);
        }
        break;
      }

      // ════════════════════════════════════════
      //  AI COMMANDS
      // ════════════════════════════════════════
      case 'ask':
      case 'ai':
      case 'chat': {
        const q = args.join(' ');
        if (!q) return reply(`🤖 Usage: ${PREFIX}${cmd} [question]\nExample: ${PREFIX}ask What is quantum physics?`);
        await react('🤖');
        const ans = await geminiAI(q, 'You are RIAS — sassy, confident, mysterious, loyal, intelligent. Keep replies under 5 sentences. Use emojis where fitting. Never be boring.');
        await reply(`🤖 ${F.bold('𝗥𝗜𝗔𝗦  𝗔𝗜')}\n\n${ans}\n\n_${F.italic('Powered by Gemini 🔴')}_`);
        break;
      }

      case 'roast': {
        const target = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : (args.join(' ') || 'this person');
        await react('🔥');
        const roast = await geminiAI(`Roast ${target} brutally, creatively and funny. Max 3 sentences. Be savage but not hateful.`, 'You are RIAS, a savage witty roastmaster.');
        await reply(`🔥 ${F.bold('𝗥𝗜𝗔𝗦  𝗥𝗢𝗔𝗦𝗧')}\n\n${roast}\n\n_${F.italic('Consider yourself roasted. 🔴')}_`);
        break;
      }

      case 'compliment': {
        const target = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : (args.join(' ') || senderName);
        await react('💐');
        const comp = await geminiAI(`Give a genuine but slightly sarcastic compliment to ${target}. Max 2 sentences.`, 'You are RIAS, confident and witty.');
        await reply(`💐 ${F.bold('𝗥𝗜𝗔𝗦  𝗖𝗢𝗠𝗣𝗟𝗜𝗠𝗘𝗡𝗧')}\n\n${comp}\n\n_${F.italic('From RIAS. That\'s rare. 🌹')}_`);
        break;
      }

      case 'advice': {
        const topic = args.join(' ') || 'life';
        await react('🧠');
        const adv = await geminiAI(`Give bold, powerful, no-nonsense life advice about: ${topic}. Max 3 sentences.`, 'You are RIAS, wise and confident.');
        await reply(`🧠 ${F.bold('𝗥𝗜𝗔𝗦  𝗔𝗗𝗩𝗜𝗖𝗘')}\n\n${adv}\n\n_${F.italic('You asked. I answered. 🔴')}_`);
        break;
      }

      case 'story': {
        const prompt = args.join(' ') || 'a mysterious encounter in the dark';
        await react('📖');
        const story = await geminiAI(`Write a short dramatic story (4-5 sentences) about: ${prompt}`, 'You are RIAS, a creative storyteller with dark, dramatic flair.');
        await reply(`📖 ${F.bold('𝗥𝗜𝗔𝗦  𝗦𝗧𝗢𝗥𝗬')}\n\n${story}\n\n_${F.italic('Written by RIAS. 🌹')}_`);
        break;
      }

      case 'poem': {
        const topic = args.join(' ') || 'power and darkness';
        await react('🎭');
        const poem = await geminiAI(`Write a short dramatic poem (4-6 lines) about: ${topic}`, 'You are RIAS, a poet with dark, powerful themes.');
        await reply(`🎭 ${F.bold('𝗥𝗜𝗔𝗦  𝗣𝗢𝗘𝗠')}\n\n${poem}\n\n_${F.italic('— RIAS 🌹')}_`);
        break;
      }

      case 'joke': {
        await react('😂');
        const joke = await geminiAI('Tell one clever, dark or witty joke. Max 3 sentences.', 'You are RIAS, darkly funny.');
        await reply(`😂 ${F.bold('𝗥𝗜𝗔𝗦  𝗝𝗢𝗞𝗘')}\n\n${joke}\n\n_${F.italic('You\'re welcome. 🔴')}_`);
        break;
      }

      case 'rizz': {
        await react('🌹');
        const rizz = await geminiAI('Give one smooth, clever pickup line. Witty not cringe.', 'You are RIAS, charismatic and confident.');
        await reply(`🌹 ${F.bold('𝗥𝗜𝗔𝗦  𝗥𝗜𝗭𝗭')}\n\n${rizz}\n\n_${F.italic('Use wisely. 🔴')}_`);
        break;
      }

      case 'improve': {
        const text = args.join(' ') || getQuotedText(msg);
        if (!text) return reply(`✍️ Usage: ${PREFIX}improve [text] or reply to a message`);
        await react('✍️');
        const improved = await geminiAI(`Rewrite and improve this text to sound more polished and professional: "${text}"`, 'You are a writing expert.');
        await reply(`✍️ ${F.bold('𝗜𝗠𝗣𝗥𝗢𝗩𝗘𝗗  𝗧𝗘𝗫𝗧')}\n\n${improved}`);
        break;
      }

      case 'summarize': {
        const text = args.join(' ') || getQuotedText(msg);
        if (!text) return reply(`📝 Usage: ${PREFIX}summarize [text] or reply to a message`);
        await react('📝');
        const summary = await geminiAI(`Summarize this in clear bullet points: "${text}"`, 'You are a concise summarizer.');
        await reply(`📝 ${F.bold('𝗦𝗨𝗠𝗠𝗔𝗥𝗬')}\n\n${summary}`);
        break;
      }

      case 'translate': {
        const lang = args[0] || 'English';
        const text = args.slice(1).join(' ') || getQuotedText(msg);
        if (!text) return reply(`🌐 Usage: ${PREFIX}translate [language] [text]\nExample: .translate French Hello`);
        await react('🌐');
        const translated = await geminiAI(`Translate this to ${lang}: "${text}"`, 'You are a translator. Only return the translation.');
        await reply(`🌐 ${F.bold('𝗧𝗥𝗔𝗡𝗦𝗟𝗔𝗧𝗜𝗢𝗡')} → ${F.italic(lang)}\n\n${translated}`);
        break;
      }

      case 'fact': {
        await react('🌍');
        const fact = await geminiAI('Give one random, surprising and interesting fact. Max 2 sentences.', 'You are a fact encyclopedia.');
        await reply(`🌍 ${F.bold('𝗥𝗔𝗡𝗗𝗢𝗠  𝗙𝗔𝗖𝗧')}\n\n${fact}\n\n_${F.italic('Mind blown? 🔴')}_`);
        break;
      }

      case 'quote': {
        await react('🌹');
        const q = await geminiAI('Generate one powerful, original motivational quote. Keep it under 2 sentences. Sign it as RIAS.', 'You are RIAS, mysterious and powerful.');
        await reply(`🌹 ${F.bold('𝗥𝗜𝗔𝗦  𝗤𝗨𝗢𝗧𝗘')}\n\n"${q}"\n\n_${F.italic('— RIAS 🔴')}_`);
        break;
      }

      case 'news': {
        const topic = args.join(' ') || 'world';
        await react('📰');
        const news = await geminiAI(`Give 3 realistic current news headlines about ${topic}. Number them.`, 'You are a news reporter.');
        await reply(`📰 ${F.bold('𝗟𝗔𝗧𝗘𝗦𝗧  𝗡𝗘𝗪𝗦')}: ${F.italic(topic)}\n\n${news}\n\n_${F.italic('Stay informed. 🔴')}_`);
        break;
      }

      // ════════════════════════════════════════
      //  ADMIN COMMANDS
      // ════════════════════════════════════════
      case 'kick': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return reply(`↩️ Reply to or mention the user to kick.`);
        try {
          await sock.groupParticipantsUpdate(from, [target], 'remove');
          await react('⚔️');
          await sock.sendMessage(from, {
            text: `⚔️ ${F.bold('KICKED!')}\n\n@${target.split('@')[0]} has been ejected.\n_${F.italic('RIAS doesn\'t waste time. 🔴')}_`,
            mentions: [target],
          }, { quoted: msg });
        } catch { await reply(`❌ Could not kick. Make RIAS an admin first.`); }
        break;
      }

      case 'ban': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return reply(`↩️ Reply to or mention the user to ban.`);
        try {
          await sock.groupParticipantsUpdate(from, [target], 'remove');
          await react('🚫');
          await sock.sendMessage(from, {
            text: `🚫 ${F.bold('BANNED!')}\n\n@${target.split('@')[0]} permanently removed.\n_${F.italic('No returns. No appeals. 🔴')}_`,
            mentions: [target],
          }, { quoted: msg });
        } catch { await reply(`❌ Could not ban. Make RIAS an admin.`); }
        break;
      }

      case 'mute': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'announcement');
          await react('🔇');
          await reply(`🔇 ${F.bold('GROUP MUTED')}\n\nOnly admins can send messages.\n_${F.italic('Peace, enforced by RIAS. 🔴')}_`);
        } catch { await reply(`❌ Make RIAS an admin first.`); }
        break;
      }

      case 'unmute': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'not_announcement');
          await react('🔊');
          await reply(`🔊 ${F.bold('GROUP UNMUTED')}\n\nEveryone can speak again.\n_${F.italic('The floor is open. 🔴')}_`);
        } catch { await reply(`❌ Make RIAS an admin first.`); }
        break;
      }

      case 'lockgroup': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'announcement');
          await react('🔒');
          await reply(`🔒 ${F.bold('GROUP LOCKED')}\n\nOnly admins may speak.\n_${F.italic('RIAS has sealed the gates. 🔴')}_`);
        } catch { await reply(`❌ Make RIAS an admin first.`); }
        break;
      }

      case 'unlockgroup': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'not_announcement');
          await react('🔓');
          await reply(`🔓 ${F.bold('GROUP UNLOCKED')}\n\nAll members can now send messages.\n_${F.italic('The gates are open. 🔴')}_`);
        } catch { await reply(`❌ Make RIAS an admin first.`); }
        break;
      }

      case 'promote': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply(`↩️ Mention the user to promote.`);
        try {
          await sock.groupParticipantsUpdate(from, [target], 'promote');
          await react('👑');
          await sock.sendMessage(from, {
            text: `👑 ${F.bold('PROMOTED!')}\n\n@${target.split('@')[0]} is now an admin.\n_${F.italic('Choose wisely. 🔴')}_`,
            mentions: [target],
          }, { quoted: msg });
        } catch { await reply(`❌ Could not promote. Make RIAS an admin.`); }
        break;
      }

      case 'demote': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply(`↩️ Mention the user to demote.`);
        try {
          await sock.groupParticipantsUpdate(from, [target], 'demote');
          await react('⬇️');
          await sock.sendMessage(from, {
            text: `⬇️ ${F.bold('DEMOTED!')}\n\n@${target.split('@')[0]} is no longer an admin.\n_${F.italic('Power can be reclaimed. 🔴')}_`,
            mentions: [target],
          }, { quoted: msg });
        } catch { await reply(`❌ Could not demote. Make RIAS an admin.`); }
        break;
      }

      case 'warn': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply(`↩️ Mention the user to warn.`);
        const key = `${from}:${target}`;
        warnStore.set(key, (warnStore.get(key) || 0) + 1);
        const count = warnStore.get(key);
        await react('⚠️');
        if (count >= 3) {
          try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            warnStore.delete(key);
            await sock.sendMessage(from, {
              text: `🚫 ${F.bold('AUTO-KICKED!')}\n\n@${target.split('@')[0]} reached 3 warnings.\n_${F.italic('RIAS warned you. 🔴')}_`,
              mentions: [target],
            }, { quoted: msg });
          } catch {
            await sock.sendMessage(from, {
              text: `⚠️ ${F.bold(`Warning ${count}/3`)}\n\n@${target.split('@')[0]} — Final warning!\n_(Make RIAS admin for auto-kick)_`,
              mentions: [target],
            }, { quoted: msg });
          }
        } else {
          await sock.sendMessage(from, {
            text: `⚠️ ${F.bold(`Warning ${count}/3`)}\n\n@${target.split('@')[0]} has been warned.\n_${F.italic(`${3 - count} warning${3-count !== 1 ? 's' : ''} left before removal. 🔴`)}_`,
            mentions: [target],
          }, { quoted: msg });
        }
        break;
      }

      case 'warnreset': {
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply(`↩️ Mention the user to reset warnings.`);
        warnStore.delete(`${from}:${target}`);
        await react('✅');
        await sock.sendMessage(from, {
          text: `✅ ${F.bold('Warnings cleared')} for @${target.split('@')[0]}.`,
          mentions: [target],
        }, { quoted: msg });
        break;
      }

      case 'tagall': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          const meta     = await sock.groupMetadata(from);
          const mentions = meta.participants.map(p => p.id);
          const tag      = args.join(' ') || '📣 Attention everyone!';
          const text     = `📣 ${F.bold(tag)}\n\n` + mentions.map(id => `@${id.split('@')[0]}`).join(' ');
          await sock.sendMessage(from, { text, mentions }, { quoted: msg });
          await react('📣');
        } catch { await reply(`❌ RIAS needs admin rights to tag all.`); }
        break;
      }

      case 'getlink': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          const code = await sock.groupInviteCode(from);
          await react('🔗');
          await reply(`🔗 ${F.bold('GROUP INVITE LINK')}\n\nhttps://chat.whatsapp.com/${code}\n\n_${F.italic('Share responsibly. 🔴')}_`);
        } catch { await reply(`❌ Make RIAS an admin to get the link.`); }
        break;
      }

      case 'resetlink': {
        if (!isGroup) return reply(`❌ ${F.bold('Groups only!')}`);
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupRevokeInvite(from);
          const newCode = await sock.groupInviteCode(from);
          await react('🔄');
          await reply(`🔄 ${F.bold('LINK RESET!')}\n\nNew link:\nhttps://chat.whatsapp.com/${newCode}`);
        } catch { await reply(`❌ Make RIAS an admin first.`); }
        break;
      }

      case 'delete':
      case 'del': {
        if (!isOwner) return noOwner(reply, react);
        const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!quotedKey) return reply(`↩️ Reply to the message you want to delete.`);
        try {
          await sock.sendMessage(from, {
            delete: {
              remoteJid: from,
              id: quotedKey,
              participant: quotedParticipant,
              fromMe: quotedParticipant === (botNum + '@s.whatsapp.net'),
            }
          });
          await react('🗑️');
        } catch { await reply(`❌ Could not delete. Make RIAS admin.`); }
        break;
      }

      // ════════════════════════════════════════
      //  FUN COMMANDS
      // ════════════════════════════════════════
      case 'ship': {
        await react('💘');
        const p1  = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : (args[0] || 'Person1');
        const p2  = mentionedJid[1] ? `@${mentionedJid[1].split('@')[0]}` : (args[1] || 'Person2');
        const pct = Math.floor(Math.random() * 101);
        const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
        const verdict = pct >= 80 ? '🔥 SOULMATES! Pure fire.' : pct >= 60 ? '💕 Strong connection!' : pct >= 40 ? '🌹 Complicated, but possible.' : pct >= 20 ? '😬 Needs a lot of work...' : '💀 Hard pass from RIAS.';
        await reply(`💘 ${F.bold('𝗦𝗛𝗜𝗣  𝗠𝗘𝗧𝗘𝗥')}\n\n👤 ${p1} + ${p2} 👤\n\n[${bar}] ${F.bold(pct + '%')}\n\n${verdict}\n\n_${F.italic('RIAS has calculated your fate. 🔴')}_`);
        break;
      }

      case 'truth': {
        await react('🗡️');
        const truth = await geminiAI('Give one deep, uncomfortable truth about life. Max 2 sentences. Be bold.', 'You are RIAS, brutally honest.');
        await reply(`🗡️ ${F.bold('𝗧𝗥𝗨𝗧𝗛')}\n\n${truth}\n\n_${F.italic('Can you handle it? 🔴')}_`);
        break;
      }

      case 'dare': {
        await react('🎯');
        const dare = await geminiAI('Give one bold, fun dare challenge. Max 2 sentences. Keep it appropriate.', 'You are RIAS, daring and fun.');
        await reply(`🎯 ${F.bold('𝗗𝗔𝗥𝗘')}\n\n${dare}\n\n_${F.italic('RIAS dared you. No backing out. 🔴')}_`);
        break;
      }

      case 'rank': {
        await react('🏆');
        try {
          if (isGroup) {
            const meta     = await sock.groupMetadata(from);
            const members  = meta.participants.slice(0, 8).sort(() => Math.random() - 0.5);
            const medals   = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
            const rankings = members.map((m, i) => `${medals[i]} @${m.id.split('@')[0]}`).join('\n');
            await sock.sendMessage(from, {
              text: `🏆 ${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗥𝗔𝗡𝗞𝗜𝗡𝗚𝗦')}\n${F.italic('by RIAS AI')}\n\n${rankings}\n\n_${F.italic('RIAS has spoken. 🔴')}_`,
              mentions: members.map(m => m.id),
            }, { quoted: msg });
          } else {
            await reply(`🏆 Rankings only work in groups!`);
          }
        } catch {
          await reply(`🏆 ${F.bold('Rankings')}\n\n1. 👑 The Real One\n2. 😐 Barely Tolerable\n3. 🤡 Why Are You Here\n4. 💤 The Lurker\n5. 🚩 The Problem\n\n_${F.italic('RIAS has spoken. 🔴')}_`);
        }
        break;
      }

      case 'trivia': {
        await react('🧩');
        const trivia = await geminiAI('Give one interesting trivia question with 4 options (A B C D) and the answer. Format:\nQuestion\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: X', 'You are a fun trivia host.');
        await reply(`🧩 ${F.bold('𝗧𝗥𝗜𝗩𝗜𝗔  𝗧𝗜𝗠𝗘!')}\n\n${trivia}\n\n_${F.italic('First correct answer wins! 🏆')}_`);
        break;
      }

      case 'roll': {
        await react('🎰');
        const sides  = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await reply(`🎰 ${F.bold(`Dice Roll (d${sides})`)}\n\nResult: ${F.bold(String(result))} ${result === sides ? '🎉 MAX!' : result === 1 ? '💀 MIN!' : ''}`);
        break;
      }

      case 'flip': {
        await react('🪙');
        const result = Math.random() > 0.5;
        await reply(`🪙 ${F.bold('𝗖𝗢𝗜𝗡  𝗙𝗟𝗜𝗣')}\n\n${result ? `👑 ${F.bold('HEADS!')}` : `🌀 ${F.bold('TAILS!')}`}\n\n_${F.italic('Fate has spoken. 🔴')}_`);
        break;
      }

      case '8ball': {
        const question = args.join(' ');
        if (!question) return reply(`🎱 Usage: ${PREFIX}8ball [question]`);
        await react('🎱');
        const answers = ['🟢 It is certain.','🟢 Without a doubt.','🟢 Signs point to yes.','🟡 Ask again later.','🟡 Cannot predict now.','🔴 Don\'t count on it.','🔴 My sources say no.','🔴 Very doubtful.'];
        await reply(`🎱 ${F.bold('𝗠𝗔𝗚𝗜𝗖  𝟴-𝗕𝗔𝗟𝗟')}\n\n❓ ${F.italic(question)}\n\n${pick(answers)}\n\n_${F.italic('RIAS has consulted the universe. 🔴')}_`);
        break;
      }

      case 'wyr': {
        await react('🎮');
        const splitIdx = args.findIndex(a => a.toLowerCase() === 'or');
        const o1 = splitIdx > 0 ? args.slice(0, splitIdx).join(' ') : args[0];
        const o2 = splitIdx > 0 ? args.slice(splitIdx + 1).join(' ') : args.slice(1).join(' ');
        if (!o1 || !o2) return reply(`🎮 Usage: ${PREFIX}wyr [option1] or [option2]\nExample: .wyr fly or be invisible`);
        await reply(`🎮 ${F.bold('𝗪𝗢𝗨𝗟𝗗  𝗬𝗢𝗨  𝗥𝗔𝗧𝗛𝗘𝗥?')}\n\n🅰️ ${F.bold(o1)}\n\n— OR —\n\n🅱️ ${F.bold(o2)}\n\nReact 🅰️ or 🅱️ to vote!\n\n_${F.italic('RIAS is watching your choice. 🔴')}_`);
        break;
      }

      case 'spirit': {
        await react('🐾');
        const animals = [
          { a: '🦊 Fox',     d: 'Cunning, clever, always three steps ahead.' },
          { a: '🦁 Lion',    d: 'Dominant, fearless, built to lead.' },
          { a: '🐺 Wolf',    d: 'Loyal to the pack, deadly to enemies.' },
          { a: '🦋 Butterfly',d: 'Chaotic but beautiful, always transforming.' },
          { a: '🐉 Dragon',  d: 'Rare, powerful, impossible to tame.' },
          { a: '🦅 Eagle',   d: 'You see what others miss. Born for altitude.' },
          { a: '🐍 Snake',   d: 'Patient, precise, strikes when it matters most.' },
          { a: '🐆 Leopard', d: 'Silent, fast, and absolutely deadly.' },
        ];
        const chosen = pick(animals);
        await reply(`🐾 ${F.bold('𝗦𝗣𝗜𝗥𝗜𝗧  𝗔𝗡𝗜𝗠𝗔𝗟')}\n\n${F.bold(chosen.a)}\n\n"${F.italic(chosen.d)}"\n\n_${F.italic('RIAS has revealed your true nature. 🔴')}_`);
        break;
      }

      case 'battle': {
        await react('⚡');
        const p1 = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : args[0];
        const p2 = mentionedJid[1] ? `@${mentionedJid[1].split('@')[0]}` : args[1];
        if (!p1 || !p2) return reply(`⚡ Usage: ${PREFIX}battle @user1 @user2`);
        const hp1  = Math.floor(Math.random() * 40) + 60;
        const hp2  = Math.floor(Math.random() * 40) + 60;
        const win  = hp1 > hp2 ? p1 : p2;
        const lose = hp1 > hp2 ? p2 : p1;
        await reply(
`⚡ ${F.bold('𝗥𝗜𝗔𝗦  𝗕𝗔𝗧𝗧𝗟𝗘  𝗔𝗥𝗘𝗡𝗔')} ⚡

🥊 ${p1} [${F.mono(hp1 + ' HP')}]
         𝗩𝗦
🥊 ${p2} [${F.mono(hp2 + ' HP')}]

━━━━━━━━━━━━━━━━━━━
💥 ${p1} attacks! (${Math.floor(Math.random()*30)+10} DMG)
💥 ${p2} counter-attacks! (${Math.floor(Math.random()*25)+5} DMG)
💫 Final blow landed!
━━━━━━━━━━━━━━━━━━━

🏆 ${F.bold('WINNER:')} ${win}
💀 ${F.bold('LOSER:')} ${lose}

_${F.italic('RIAS has judged. 🔴')}_`
        );
        break;
      }

      // ════════════════════════════════════════
      //  GAME COMMANDS
      // ════════════════════════════════════════
      case 'rps': {
        await react('✊');
        const validMap = { rock: 0, paper: 1, scissors: 2, r: 0, p: 1, s: 2 };
        const uKey = args[0]?.toLowerCase();
        if (!uKey || validMap[uKey] === undefined)
          return reply(`✊ ${F.bold('Rock Paper Scissors')}\n\nUsage: ${PREFIX}rps [rock/paper/scissors]\nShortcut: r/p/s`);
        const choices = ['✊ Rock','✋ Paper','✌️ Scissors'];
        const uIdx = validMap[uKey], bIdx = Math.floor(Math.random() * 3);
        const wins  = [[0,2,1],[1,0,2],[2,1,0]];
        const outcome = wins[uIdx][bIdx];
        const resultText = outcome === 0 ? `🤝 ${F.bold('TIE!')}` : outcome === 1 ? `🏆 ${F.bold('You Win!')}` : `💀 ${F.bold('RIAS Wins!')}`;
        await reply(`✊ ${F.bold('𝗥𝗢𝗖𝗞  𝗣𝗔𝗣𝗘𝗥  𝗦𝗖𝗜𝗦𝗦𝗢𝗥𝗦')}\n\n👤 You: ${F.bold(choices[uIdx])}\n🤖 RIAS: ${F.bold(choices[bIdx])}\n\n${resultText}\n\n_${F.italic('Play again? 🔴')}_`);
        break;
      }

      case 'guess': {
        await react('🎲');
        const secret = Math.floor(Math.random() * 10) + 1;
        const guess  = parseInt(args[0]);
        if (!guess) return reply(`🎲 ${F.bold('Number Guess')}\n\nGuess a number 1-10!\nUsage: ${PREFIX}guess [1-10]`);
        if (guess === secret) {
          await reply(`🎲 ${F.bold('𝗡𝗨𝗠𝗕𝗘𝗥  𝗚𝗨𝗘𝗦𝗦')}\n\n🎉 ${F.bold('CORRECT!')} The number was ${F.bold(String(secret))}!\n\n_${F.italic('Lucky. 🔴')}_`);
        } else {
          await reply(`🎲 ${F.bold('𝗡𝗨𝗠𝗕𝗘𝗥  𝗚𝗨𝗘𝗦𝗦')}\n\n❌ Wrong! The number was ${F.bold(String(secret))}.\nYou guessed ${F.bold(String(guess))}.\n\n_${F.italic('Try again? 🔴')}_`);
        }
        break;
      }

      case 'slots': {
        await react('🎰');
        const symbols = ['🍒','🍋','🍊','⭐','💎','7️⃣','🔔','🍇'];
        const s1 = pick(symbols), s2 = pick(symbols), s3 = pick(symbols);
        const win      = s1 === s2 && s2 === s3;
        const twoMatch = s1 === s2 || s2 === s3 || s1 === s3;
        await reply(
`🎰 ${F.bold('𝗥𝗜𝗔𝗦  𝗦𝗟𝗢𝗧𝗦')}

┌─────────────┐
│  ${s1}  ${s2}  ${s3}  │
└─────────────┘

${win ? `🎉 ${F.bold('JACKPOT! YOU WIN!')}` : twoMatch ? `💰 ${F.bold('Two match! Small win!')}` : `💀 ${F.bold('No match. Try again.')}`}

_${F.italic(`${PREFIX}slots to spin again. 🔴`)}_`
        );
        break;
      }

      // ════════════════════════════════════════
      //  MUSIC / DOWNLOAD SECTION
      // ════════════════════════════════════════
      case 'play': {
        await react('🎵');
        const song = args.join(' ');
        if (!song) return reply(`🎵 Usage: ${PREFIX}play [song name]`);
        await reply(
`🎵 ${F.bold('𝗥𝗜𝗔𝗦  𝗠𝗨𝗦𝗜𝗖')}

🔍 Searching: ${F.italic(song)}

⚠️ ${F.italic('Music download requires YouTube API integration on your server.')}

💡 Join our channel for updates:
🔗 ${WA_CHANNEL}

_${F.italic('RIAS 🔴')}_`
        );
        break;
      }

      case 'lyrics': {
        await react('🎤');
        const song = args.join(' ');
        if (!song) return reply(`🎤 Usage: ${PREFIX}lyrics [song name]`);
        const lyr = await geminiAI(`Give the first verse and chorus of the song "${song}". If you don't know it, say so clearly.`, 'You are a music encyclopedia.');
        await reply(`🎤 ${F.bold('𝗟𝗬𝗥𝗜𝗖𝗦:')} ${F.italic(song)}\n\n${lyr}\n\n_${F.italic('RIAS knows music. 🔴')}_`);
        break;
      }

      // ════════════════════════════════════════
      //  DM TOOLS
      // ════════════════════════════════════════
      case 'broadcast':
      case 'bc': {
        if (!isOwner) return noOwner(reply, react);
        const bcMsg = args.join(' ');
        if (!bcMsg) return reply(`📢 Usage: ${PREFIX}broadcast [message]`);
        await react('📢');
        await reply(`📢 ${F.bold('BROADCAST SENT')}\n\nMessage: "${F.italic(bcMsg)}"\n\n_${F.italic('RIAS has delivered your words. 🔴')}_`);
        break;
      }

      case 'autoreply': {
        if (!isOwner) return noOwner(reply, react);
        const state = args[0]?.toLowerCase();
        if (!state) return reply(`🤖 Usage: ${PREFIX}autoreply on/off`);
        await react('🤖');
        await reply(`🤖 ${F.bold('Auto-reply')} ${state === 'on' ? F.bold('enabled ✅') : F.bold('disabled ❌')}`);
        break;
      }

      // ════════════════════════════════════════
      //  OWNER COMMANDS
      // ════════════════════════════════════════
      case 'shutdown': {
        if (!isOwner) return noOwner(reply, react);
        await react('🔴');
        await reply(`🔴 ${F.bold('RIAS Powering Down...')}\n\n_${F.italic('She\'ll be back. She always comes back. 🌹')}_`);
        setTimeout(() => process.exit(0), 2000);
        break;
      }

      case 'restart': {
        if (!isOwner) return noOwner(reply, react);
        await react('🔁');
        await reply(`🔁 ${F.bold('Restarting RIAS...')}\n\n_${F.italic('Clean boot initiated. Give me 10 seconds. 🔴')}_`);
        setTimeout(() => process.exit(1), 2000);
        break;
      }

      case 'block': {
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply(`↩️ Mention the user to block.`);
        try {
          await sock.updateBlockStatus(target, 'block');
          await react('🚫');
          await sock.sendMessage(from, { text: `🚫 @${target.split('@')[0]} has been blocked.`, mentions: [target] }, { quoted: msg });
        } catch { await reply(`❌ Could not block user.`); }
        break;
      }

      case 'unblock': {
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply(`↩️ Mention the user to unblock.`);
        try {
          await sock.updateBlockStatus(target, 'unblock');
          await react('✅');
          await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} has been unblocked.`, mentions: [target] }, { quoted: msg });
        } catch { await reply(`❌ Could not unblock user.`); }
        break;
      }

      case 'join': {
        if (!isOwner) return noOwner(reply, react);
        const link = args[0];
        if (!link) return reply(`🔗 Usage: ${PREFIX}join [group invite link]`);
        try {
          const code = link.split('https://chat.whatsapp.com/')[1];
          await sock.groupAcceptInvite(code);
          await react('✅');
          await reply(`✅ RIAS has joined the group!`);
        } catch { await reply(`❌ Could not join. Invalid link or already a member.`); }
        break;
      }

      case 'leave': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply(`❌ Use in a group.`);
        await react('👋');
        await reply(`👋 ${F.bold('RIAS is leaving...')}\n\n_${F.italic('It was a pleasure. 🌹')}_`);
        setTimeout(() => sock.groupLeave(from), 2000);
        break;
      }

      case 'setstatus': {
        if (!isOwner) return noOwner(reply, react);
        const status = args.join(' ');
        if (!status) return reply(`📡 Usage: ${PREFIX}setstatus [your status]`);
        try {
          await sock.updateProfileStatus(status);
          await react('📡');
          await reply(`📡 Status updated to: "${F.italic(status)}"`);
        } catch { await reply(`❌ Could not update status.`); }
        break;
      }

      case 'setprefix': {
        if (!isOwner) return noOwner(reply, react);
        await react('⚙️');
        await reply(`⚙️ ${F.bold('Prefix set to:')} ${F.mono(args[0] || '.')}\n\n_(Restart bot for full effect)_`);
        break;
      }

      // ════════════════════════════════════════
      //  CONTACT / CHANNEL
      // ════════════════════════════════════════
      case 'channel': {
        await react('📡');
        await reply(`📡 ${F.bold('𝗝𝗢𝗜𝗡  𝗥𝗜𝗔𝗦  𝗖𝗛𝗔𝗡𝗡𝗘𝗟')}\n\nGet updates, new features and announcements:\n\n🔗 ${WA_CHANNEL}\n\n_${F.italic('Stay in the loop. 🔴')}_`);
        break;
      }

      case 'dev':
      case 'owner': {
        await react('👑');
        await reply(`👑 ${F.bold('𝗕𝗢𝗧  𝗖𝗥𝗘𝗔𝗧𝗢𝗥')}\n\n🌹 ${F.bold('Name:')} Jinx Official\n📞 ${F.bold('Contact:')} wa.me/${DEV_NUMBER}\n📡 ${F.bold('Channel:')} ${WA_CHANNEL}\n\n_${F.italic('The mind behind RIAS. 🔴')}_`);
        break;
      }

      // ════════════════════════════════════════
      //  WELCOME / GOODBYE CONFIG
      // ════════════════════════════════════════
      case 'setwelcome': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        const wMsg = args.join(' ');
        FT.welcomeStore.set(from, { enabled: true, msg: wMsg || null });
        await FT.saveAll();
        await react('👋');
        await reply(`👋 ${F.bold('Welcome message set!')}

"${F.italic(wMsg || 'Default welcome message')}"

_${F.italic('RIAS will greet new members. 🔴')}_`);
        break;
      }

      case 'setgoodbye': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        const gMsg = args.join(' ');
        FT.goodbyeStore.set(from, { enabled: true, msg: gMsg || null });
        await FT.saveAll();
        await react('👋');
        await reply(`👋 ${F.bold('Goodbye message set!')}

"${F.italic(gMsg || 'Default goodbye message')}"

_${F.italic('RIAS will farewell departing members. 🔴')}_`);
        break;
      }

      case 'welcome': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        const state = args[0]?.toLowerCase();
        const cfg   = FT.welcomeStore.get(from) || {};
        cfg.enabled = state !== 'off';
        FT.welcomeStore.set(from, cfg);
        await FT.saveAll();
        await react(cfg.enabled ? '✅' : '❌');
        await reply(`🌅 Welcome messages ${cfg.enabled ? F.bold('enabled ✅') : F.bold('disabled ❌')}`);
        break;
      }

      case 'goodbye': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        const state = args[0]?.toLowerCase();
        const cfg   = FT.goodbyeStore.get(from) || {};
        cfg.enabled = state !== 'off';
        FT.goodbyeStore.set(from, cfg);
        await FT.saveAll();
        await react(cfg.enabled ? '✅' : '❌');
        await reply(`👋 Goodbye messages ${cfg.enabled ? F.bold('enabled ✅') : F.bold('disabled ❌')}`);
        break;
      }

      // ════════════════════════════════════════
      //  ANTI-LINK / ANTI-SPAM REAL TOGGLES
      // ════════════════════════════════════════
      case 'antilink': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        const on = args[0]?.toLowerCase() === 'on';
        FT.antiLinkMap.set(from, on);
        await FT.saveAll();
        await react(on ? '🔗' : '✅');
        await reply(`🔗 ${F.bold('Anti-Link')} ${on ? F.bold('ENABLED ✅') : F.bold('DISABLED ❌')}

${on ? F.italic('Links from non-admins will be auto-deleted. 🔴') : F.italic('Link protection off.')}`);
        break;
      }

      case 'antispam': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        const on = args[0]?.toLowerCase() === 'on';
        FT.antiSpamMap.set(from, on);
        await FT.saveAll();
        await react(on ? '🛡️' : '✅');
        await reply(`🛡️ ${F.bold('Anti-Spam')} ${on ? F.bold('ENABLED ✅') : F.bold('DISABLED ❌')}

${on ? F.italic('Spam messages will be auto-deleted. 🔴') : F.italic('Spam protection off.')}`);
        break;
      }

      // ════════════════════════════════════════
      //  GROUP STATS
      // ════════════════════════════════════════
      case 'stats':
      case 'groupstats': {
        if (!isGroup) return reply('❌ Groups only.');
        await react('📊');
        const stats = FT.getGroupStats(from);
        if (!stats.length) return reply(`📊 ${F.bold('No stats yet.')} Chat more to generate stats!`);
        const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const top    = stats.slice(0, 10);
        const lines  = top.map((s, i) => `${medals[i]} @${s.userJid.split('@')[0]} — ${F.bold(s.msgs + ' msgs')}`).join('\n');
        const mentions = top.map(s => s.userJid);
        await sock.sendMessage(from, {
          text:
`📊 ${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗦𝗧𝗔𝗧𝗦')}
${F.italic('Top chatters in this group')}

${lines}

📈 ${F.bold('Total tracked:')} ${stats.reduce((a,s) => a + s.msgs, 0)} messages

_${F.italic('RIAS tracks everything. 🔴')}_`,
          mentions,
        }, { quoted: msg });
        break;
      }

      case 'resetstats': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Groups only.');
        for (const key of [...FT.statsStore.keys()]) {
          if (key.startsWith(from + ':')) FT.statsStore.delete(key);
        }
        await FT.saveAll();
        await react('🗑️');
        await reply(`🗑️ ${F.bold('Group stats reset!')} Starting fresh. 🔴`);
        break;
      }

      // ════════════════════════════════════════
      //  LEVELING SYSTEM
      // ════════════════════════════════════════
      case 'level':
      case 'rank2':
      case 'xp': {
        await react('🏅');
        const target  = mentionedJid[0] || senderJid;
        const key     = `${from}:${target}`;
        const data    = FT.levelStore.get(key) || { xp: 0, level: 0 };
        const info    = FT.getLevelInfo(data.xp);
        const progress = info.next ? Math.floor((data.xp - (info.level > 0 ? [0,100,250,500,900,1400,2000,2800,3800,5000,7000][info.level-1] || 0 : 0)) / (info.next - (info.level > 0 ? [0,100,250,500,900,1400,2000,2800,3800,5000,7000][info.level-1] || 0 : 0)) * 10) : 10;
        const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
        await sock.sendMessage(from, {
          text:
`🏅 ${F.bold('𝗟𝗘𝗩𝗘𝗟  𝗖𝗔𝗥𝗗')}

👤 @${target.split('@')[0]}

┌─────────────────────
│ 🏆 Level: ${F.bold(String(info.level))} — ${F.italic(info.name)}
│ ⚡ XP: ${F.bold(String(info.xp))}${info.next ? ' / ' + info.next : ' (MAX!)'}
│ 📊 Progress: [${bar}]
└─────────────────────

_${F.italic('Keep chatting to level up. 🔴')}_`,
          mentions: [target],
        }, { quoted: msg });
        break;
      }

      case 'leaderboard':
      case 'lb': {
        if (!isGroup) return reply('❌ Groups only.');
        await react('🏆');
        const entries = [];
        for (const [key, val] of FT.levelStore) {
          if (key.startsWith(from + ':')) {
            const userJid = key.split(':').slice(1).join(':');
            const info    = FT.getLevelInfo(val.xp);
            entries.push({ userJid, xp: val.xp, level: info.level, name: info.name });
          }
        }
        if (!entries.length) return reply(`🏆 ${F.bold('No leaderboard data yet.')} Chat more!`);
        entries.sort((a, b) => b.xp - a.xp);
        const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣'];
        const top     = entries.slice(0, 5);
        const lines   = top.map((e, i) => `${medals[i]} @${e.userJid.split('@')[0]}\n   Lv.${e.level} ${e.name} — ${e.xp} XP`).join('\n\n');
        const mentions = top.map(e => e.userJid);
        await sock.sendMessage(from, {
          text:
`🏆 ${F.bold('𝗫𝗣  𝗟𝗘𝗔𝗗𝗘𝗥𝗕𝗢𝗔𝗥𝗗')}
${F.italic('Most active members')}

${lines}

_${F.italic('Type ' + PREFIX + 'level to check your rank. 🔴')}_`,
          mentions,
        }, { quoted: msg });
        break;
      }

      // ════════════════════════════════════════
      //  BIRTHDAY SYSTEM
      // ════════════════════════════════════════
      case 'setbirthday': {
        const input = args[0]; // format: DD/MM
        if (!input || !input.includes('/')) return reply(`🎂 Usage: ${PREFIX}setbirthday [DD/MM]\nExample: .setbirthday 15/06`);
        const [day, month] = input.split('/').map(Number);
        if (!day || !month || day > 31 || month > 12) return reply('❌ Invalid date. Use DD/MM format.');
        FT.birthdayStore.set(senderJid, { day, month, name: senderName, groupJid: isGroup ? from : null });
        await FT.saveAll();
        await react('🎂');
        await reply(
`🎂 ${F.bold('Birthday Registered!')}

🌹 Name: ${F.bold(senderName)}
📅 Date: ${F.bold(`${day}/${month}`)}

${F.italic('RIAS will announce your birthday! 🔴')}`
        );
        break;
      }

      case 'mybirthday': {
        await react('🎂');
        const bd = FT.birthdayStore.get(senderJid);
        if (!bd) return reply(`🎂 No birthday set. Use ${PREFIX}setbirthday [DD/MM] to set one.`);
        await reply(`🎂 ${F.bold('Your Birthday')}: ${F.bold(`${bd.day}/${bd.month}`)}

${F.italic('RIAS has it saved. 🌹')}`);
        break;
      }

      case 'birthdays': {
        if (!isGroup) return reply('❌ Groups only.');
        await react('🎂');
        const bdays = [...FT.birthdayStore.entries()].filter(([,v]) => v.groupJid === from || !v.groupJid);
        if (!bdays.length) return reply(`🎂 ${F.bold('No birthdays registered yet.')}\nUse ${PREFIX}setbirthday [DD/MM] to register!`);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const lines  = bdays.map(([jid, v]) => `🎂 @${jid.split('@')[0]} — ${v.day} ${months[v.month-1]}`).join('\n');
        await sock.sendMessage(from, {
          text: `🎂 ${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗕𝗜𝗥𝗧𝗛𝗗𝗔𝗬𝗦')}\n\n${lines}\n\n_${F.italic('RIAS announces birthdays at 8 AM. 🔴')}_`,
          mentions: bdays.map(([jid]) => jid),
        }, { quoted: msg });
        break;
      }

      case 'removebirthday': {
        FT.birthdayStore.delete(senderJid);
        await FT.saveAll();
        await react('✅');
        await reply(`✅ ${F.bold('Birthday removed.')} RIAS won't announce it anymore.`);
        break;
      }

      // ════════════════════════════════════════
      //  DEFAULT
      // ════════════════════════════════════════
      default: {
        await react('❓');
        await reply(`❓ ${F.bold('Unknown command:')} ${F.mono(PREFIX + cmd)}\n\nType ${F.mono(PREFIX + 'menu')} to see all commands.\n\n_${F.italic('RIAS knows ' + PREFIX + 'help too. 🔴')}_`);
        break;
      }
    }
  } catch (err) {
    console.error(`[CMD ERROR] ${cmd}:`, err.message);
    try { await reply(`⚠️ Error in ${F.mono(PREFIX + cmd)}: ${err.message}`); } catch {}
  }
}

// ════════════════════════════════════════
//  MENU TEXT BUILDERS  — fully fonted
// ════════════════════════════════════════

// ── Small caps style using unicode ──────
const SC = {
  'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ',
  'j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'Q','r':'ʀ',
  's':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ',
};
const sc  = t => [...t.toLowerCase()].map(c => SC[c] || c).join('');
const sep = (n=26) => '─'.repeat(n);

function getTextMenu(isOwner) {
  return `
╔══════════════════════════╗
║  🌹  ${F.bold('𝗥𝗜𝗔𝗦  𝗠𝗘𝗡𝗨')}  🌹  ║
╚══════════════════════════╝

${F.bold('𝗖𝗛𝗢𝗢𝗦𝗘 𝗔 𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗬')} 👇

🤖 ${F.mono(PREFIX+'aimenu')}  ${F.italic('→ ' + sc('rias ai section'))}
🎮 ${F.mono(PREFIX+'gamemenu')}  ${F.italic('→ ' + sc('games section'))}
⚔️ ${F.mono(PREFIX+'adminmenu')}  ${F.italic('→ ' + sc('group control'))}
📥 ${F.mono(PREFIX+'downloadmenu')}  ${F.italic('→ ' + sc('media & downloads'))}
💬 ${F.mono(PREFIX+'dmmenu')}  ${F.italic('→ ' + sc('dm tools'))}
🎲 ${F.mono(PREFIX+'funmenu')}  ${F.italic('→ ' + sc('fun & random'))}
🛠️ ${F.mono(PREFIX+'utilitymenu')}  ${F.italic('→ ' + sc('utilities'))}
🏅 ${F.mono(PREFIX+'statsmenu')}  ${F.italic('→ ' + sc('stats & levels'))}${isOwner ? '\n👑 ' + F.mono(PREFIX+'ownermenu') + '  ' + F.italic('→ ' + sc('owner controls')) : ''}
📋 ${F.mono(PREFIX+'allcmds')}  ${F.italic('→ ' + sc('all commands'))}

_${F.italic('She doesn\'t beg for attention. She commands it.')} 🔴_`.trim();
}

// ─────────────────────────────────────────────
function getAIMenu() {
  return `
╔══════════════════════════╗
║  🤖  ${F.bold('𝗥𝗜𝗔𝗦  𝗔𝗜  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  🤖  ║
╚══════════════════════════╝

${F.bold('𝗖𝗢𝗡𝗩𝗘𝗥𝗦𝗔𝗧𝗜𝗢𝗡')} 💬
┌${sep()}
│ ${F.mono(PREFIX+'ai')} ${sc('[question]')}
│   ${F.italic('Ask RIAS literally anything')}
│
│ ${F.mono(PREFIX+'chat')} ${sc('[message]')}
│   ${F.italic('Casual talk — she always bites back')}
└${sep()}

${F.bold('𝗪𝗥𝗜𝗧𝗜𝗡𝗚  𝗧𝗢𝗢𝗟𝗦')} ✍️
┌${sep()}
│ ${F.mono(PREFIX+'improve')} ${sc('[text]')}
│ ${F.mono(PREFIX+'summarize')} ${sc('[text]')}
│ ${F.mono(PREFIX+'translate')} ${sc('[lang] [text]')}
│ ${F.mono(PREFIX+'define')} ${sc('[word]')}
└${sep()}

${F.bold('𝗖𝗥𝗘𝗔𝗧𝗜𝗩𝗘')} 🎨
┌${sep()}
│ ${F.mono(PREFIX+'story')} ${sc('[prompt]')}  ${F.italic('short story')}
│ ${F.mono(PREFIX+'poem')} ${sc('[topic]')}  ${F.italic('original poem')}
│ ${F.mono(PREFIX+'joke')}  ${F.italic('dark & witty')}
│ ${F.mono(PREFIX+'rizz')}  ${F.italic('smooth pickup line')}
└${sep()}

${F.bold('𝗞𝗡𝗢𝗪𝗟𝗘𝗗𝗚𝗘')} 🌍
┌${sep()}
│ ${F.mono(PREFIX+'fact')}  ${F.italic('random surprising fact')}
│ ${F.mono(PREFIX+'quote')}  ${F.italic('RIAS original quote')}
│ ${F.mono(PREFIX+'weather')} ${sc('[city]')}
│ ${F.mono(PREFIX+'news')} ${sc('[topic]')}
│ ${F.mono(PREFIX+'lyrics')} ${sc('[song]')}
└${sep()}

${F.bold('𝗦𝗢𝗖𝗜𝗔𝗟')} 💡
┌${sep()}
│ ${F.mono(PREFIX+'roast')} ${sc('@user')}  ${F.italic('savage roast')}
│ ${F.mono(PREFIX+'compliment')} ${sc('@user')}
│ ${F.mono(PREFIX+'advice')} ${sc('[topic]')}
└${sep()}

_${F.italic('Powered by Google Gemini AI 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getGameMenu() {
  return `
╔══════════════════════════╗
║  🎮  ${F.bold('𝗚𝗔𝗠𝗘𝗦  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  🎮  ║
╚══════════════════════════╝

${F.bold('𝗔𝗩𝗔𝗜𝗟𝗔𝗕𝗟𝗘  𝗚𝗔𝗠𝗘𝗦')} 🕹️
┌${sep()}
│
│ ✊  ${F.mono(PREFIX+'rps')} ${sc('[r/p/s]')}
│     ${F.italic('Rock Paper Scissors vs RIAS')}
│
│ 🎲  ${F.mono(PREFIX+'guess')} ${sc('[1-10]')}
│     ${F.italic('Guess the secret number')}
│
│ 🎰  ${F.mono(PREFIX+'slots')}
│     ${F.italic('Spin the slot machine!')}
│
│ 🧩  ${F.mono(PREFIX+'trivia')}
│     ${F.italic('Answer a trivia question')}
│
│ 💘  ${F.mono(PREFIX+'ship')} ${sc('@u1 @u2')}
│     ${F.italic('Compatibility meter')}
│
│ ⚡  ${F.mono(PREFIX+'battle')} ${sc('@u1 @u2')}
│     ${F.italic('Epic battle arena')}
│
│ 🎱  ${F.mono(PREFIX+'8ball')} ${sc('[question]')}
│     ${F.italic('The all-knowing 8-ball')}
│
│ 🪙  ${F.mono(PREFIX+'flip')}  ${F.italic('Heads or Tails')}
│
│ 🎯  ${F.mono(PREFIX+'roll')} ${sc('[sides]')}  ${F.italic('Roll a dice')}
│
└${sep()}

_${F.italic('May the odds be in your favor. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getAdminMenu() {
  return `
╔══════════════════════════╗
║  ⚔️  ${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  ⚔️  ║
╚══════════════════════════╝

${F.bold('𝗠𝗘𝗠𝗕𝗘𝗥  𝗖𝗢𝗡𝗧𝗥𝗢𝗟')} 👥
┌${sep()}
│ ${F.mono(PREFIX+'kick')} ${sc('@user')}   ${F.italic('remove member')}
│ ${F.mono(PREFIX+'ban')} ${sc('@user')}    ${F.italic('permanent ban')}
│ ${F.mono(PREFIX+'promote')} ${sc('@user')} ${F.italic('make admin')}
│ ${F.mono(PREFIX+'demote')} ${sc('@user')}  ${F.italic('remove admin')}
└${sep()}

${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗖𝗢𝗡𝗧𝗥𝗢𝗟')} 🔒
┌${sep()}
│ ${F.mono(PREFIX+'mute')}        ${F.italic('mute group')}
│ ${F.mono(PREFIX+'unmute')}      ${F.italic('unmute group')}
│ ${F.mono(PREFIX+'lockgroup')}   ${F.italic('admins only')}
│ ${F.mono(PREFIX+'unlockgroup')} ${F.italic('open group')}
│ ${F.mono(PREFIX+'tagall')} ${sc('[msg]')}  ${F.italic('tag everyone')}
└${sep()}

${F.bold('𝗠𝗢𝗗𝗘𝗥𝗔𝗧𝗜𝗢𝗡')} ⚠️
┌${sep()}
│ ${F.mono(PREFIX+'warn')} ${sc('@user')}        ${F.italic('warn (3=kick)')}
│ ${F.mono(PREFIX+'warnreset')} ${sc('@user')}   ${F.italic('clear warns')}
│ ${F.mono(PREFIX+'antilink')} ${sc('on/off')}   ${F.italic('block links')}
│ ${F.mono(PREFIX+'antispam')} ${sc('on/off')}   ${F.italic('block spam')}
│ ${F.mono(PREFIX+'welcome')} ${sc('on/off')}    ${F.italic('welcome msgs')}
│ ${F.mono(PREFIX+'goodbye')} ${sc('on/off')}    ${F.italic('goodbye msgs')}
│ ${F.mono(PREFIX+'delete')}       ${F.italic('delete replied msg')}
└${sep()}

${F.bold('𝗟𝗜𝗡𝗞𝗦  &  𝗜𝗡𝗙𝗢')} 🔗
┌${sep()}
│ ${F.mono(PREFIX+'getlink')}   ${F.italic('get invite link')}
│ ${F.mono(PREFIX+'resetlink')} ${F.italic('reset link')}
│ ${F.mono(PREFIX+'groupinfo')} ${F.italic('group stats')}
│ ${F.mono(PREFIX+'userinfo')} ${sc('@user')}
└${sep()}

_${F.italic('Requires RIAS to be group admin. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getDownloadMenu() {
  return `
╔══════════════════════════╗
║  📥  ${F.bold('𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  📥  ║
╚══════════════════════════╝

${F.bold('𝗠𝗨𝗦𝗜𝗖')} 🎵
┌${sep()}
│ ${F.mono(PREFIX+'play')} ${sc('[song]')}   ${F.italic('play a song')}
│ ${F.mono(PREFIX+'lyrics')} ${sc('[song]')} ${F.italic('get song lyrics')}
└${sep()}

${F.bold('𝗠𝗘𝗗𝗜𝗔  𝗧𝗢𝗢𝗟𝗦')} 🖼️
┌${sep()}
│ ${F.mono(PREFIX+'sticker')}   ${F.italic('image → sticker')}
│ ${F.mono(PREFIX+'toimg')}     ${F.italic('sticker → image')}
│ ${F.mono(PREFIX+'tts')} ${sc('[text]')} ${F.italic('text to speech')}
└${sep()}

${F.bold('𝗟𝗜𝗡𝗞𝗦')} 🔗
┌${sep()}
│ ${F.mono(PREFIX+'shortlink')} ${sc('[url]')} ${F.italic('shorten url')}
└${sep()}

${F.bold('𝗖𝗢𝗠𝗜𝗡𝗚  𝗦𝗢𝗢𝗡')} 📦
┌${sep()}
│ ${F.mono(PREFIX+'video')} ${sc('[search]')}
│ ${F.mono(PREFIX+'gif')} ${sc('[search]')}
└${sep()}

_${F.italic('More tools coming soon. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getDMMenu() {
  return `
╔══════════════════════════╗
║  💬  ${F.bold('𝗗𝗠  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  💬  ║
╚══════════════════════════╝

${F.bold('𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧')} 📢
┌${sep()}
│ ${F.mono(PREFIX+'broadcast')} ${sc('[msg]')} ${F.italic('send to all')}
│ ${F.mono(PREFIX+'bc')} ${sc('[msg]')}         ${F.italic('short form')}
└${sep()}

${F.bold('𝗔𝗨𝗧𝗢  𝗧𝗢𝗢𝗟𝗦')} 🤖
┌${sep()}
│ ${F.mono(PREFIX+'autoreply')} ${sc('on/off')}
│ ${F.mono(PREFIX+'setstatus')} ${sc('[text]')}
│ ${F.mono(PREFIX+'setwelcome')} ${sc('[msg]')}
│ ${F.mono(PREFIX+'setgoodbye')} ${sc('[msg]')}
└${sep()}

${F.bold('𝗦𝗢𝗖𝗜𝗔𝗟')} 📡
┌${sep()}
│ ${F.mono(PREFIX+'channel')} ${F.italic('join RIAS channel')}
│ ${F.mono(PREFIX+'dev')}     ${F.italic('contact developer')}
│ ${F.mono(PREFIX+'owner')}   ${F.italic('bot creator info')}
└${sep()}

> 🔗 ${WA_CHANNEL}

_${F.italic('DM automation by RIAS 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getFunMenu() {
  return `
╔══════════════════════════╗
║  🎲  ${F.bold('𝗙𝗨𝗡  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  🎲  ║
╚══════════════════════════╝

${F.bold('𝗦𝗢𝗖𝗜𝗔𝗟  𝗙𝗨𝗡')} 💘
┌${sep()}
│ ${F.mono(PREFIX+'ship')} ${sc('@u1 @u2')}  ${F.italic('compatibility %')}
│ ${F.mono(PREFIX+'rank')}           ${F.italic('rank group members')}
│ ${F.mono(PREFIX+'battle')} ${sc('@u1 @u2')} ${F.italic('epic battle')}
│ ${F.mono(PREFIX+'spirit')}         ${F.italic('reveal spirit animal')}
└${sep()}

${F.bold('𝗧𝗥𝗨𝗧𝗛  𝗢𝗥  𝗗𝗔𝗥𝗘')} 🎯
┌${sep()}
│ ${F.mono(PREFIX+'truth')}         ${F.italic('hard unfiltered truth')}
│ ${F.mono(PREFIX+'dare')}          ${F.italic('bold dare from RIAS')}
│ ${F.mono(PREFIX+'wyr')} ${sc('[a] or [b]')} ${F.italic('would you rather')}
└${sep()}

${F.bold('𝗥𝗔𝗡𝗗𝗢𝗠')} 🎱
┌${sep()}
│ ${F.mono(PREFIX+'8ball')} ${sc('[question]')} ${F.italic('magic 8-ball')}
│ ${F.mono(PREFIX+'roll')} ${sc('[sides]')}     ${F.italic('roll a dice')}
│ ${F.mono(PREFIX+'flip')}           ${F.italic('coin flip')}
│ ${F.mono(PREFIX+'trivia')}         ${F.italic('trivia question')}
│ ${F.mono(PREFIX+'quote')}          ${F.italic('RIAS original quote')}
└${sep()}

_${F.italic('Good vibes only. Well... mostly. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getUtilityMenu() {
  return `
╔══════════════════════════╗
║  🛠️  ${F.bold('𝗨𝗧𝗜𝗟𝗜𝗧𝗬  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  🛠️  ║
╚══════════════════════════╝

${F.bold('𝗖𝗔𝗟𝗖  &  𝗧𝗜𝗠𝗘')} 🔢
┌${sep()}
│ ${F.mono(PREFIX+'calc')} ${sc('[expr]')}  ${F.italic('calculator')}
│ ${F.mono(PREFIX+'time')}         ${F.italic('current time & date')}
└${sep()}

${F.bold('𝗞𝗡𝗢𝗪𝗟𝗘𝗗𝗚𝗘')} 📖
┌${sep()}
│ ${F.mono(PREFIX+'define')} ${sc('[word]')}      ${F.italic('dictionary')}
│ ${F.mono(PREFIX+'translate')} ${sc('[lang] [text]')}
│ ${F.mono(PREFIX+'weather')} ${sc('[city]')}    ${F.italic('weather report')}
│ ${F.mono(PREFIX+'news')} ${sc('[topic]')}      ${F.italic('latest headlines')}
│ ${F.mono(PREFIX+'fact')}              ${F.italic('random fact')}
└${sep()}

${F.bold('𝗠𝗘𝗗𝗜𝗔  𝗧𝗢𝗢𝗟𝗦')} 🔗
┌${sep()}
│ ${F.mono(PREFIX+'shortlink')} ${sc('[url]')}  ${F.italic('shorten url')}
│ ${F.mono(PREFIX+'tts')} ${sc('[text]')}       ${F.italic('text to speech')}
│ ${F.mono(PREFIX+'sticker')}          ${F.italic('image → sticker')}
│ ${F.mono(PREFIX+'toimg')}            ${F.italic('sticker → image')}
└${sep()}

${F.bold('𝗕𝗢𝗧  𝗜𝗡𝗙𝗢')} ℹ️
┌${sep()}
│ ${F.mono(PREFIX+'ping')}     ${F.italic('response speed')}
│ ${F.mono(PREFIX+'alive')}    ${F.italic('bot status card')}
│ ${F.mono(PREFIX+'botinfo')}  ${F.italic('full bot info')}
│ ${F.mono(PREFIX+'groupinfo')} ${F.italic('group stats')}
└${sep()}

_${F.italic('Everyday tools by RIAS. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getStatsMenu() {
  return `
╔══════════════════════════╗
║  🏅  ${F.bold('𝗦𝗧𝗔𝗧𝗦  &  𝗟𝗘𝗩𝗘𝗟𝗦')}  🏅  ║
╚══════════════════════════╝

${F.bold('𝗫𝗣  𝗟𝗘𝗩𝗘𝗟  𝗦𝗬𝗦𝗧𝗘𝗠')} ⚡
┌${sep()}
│ ${F.mono(PREFIX+'level')} ${sc('[@user]')}   ${F.italic('view level card')}
│ ${F.mono(PREFIX+'leaderboard')}  ${F.italic('top xp holders')}
│ ${F.mono(PREFIX+'lb')}           ${F.italic('short leaderboard')}
└${sep()}

${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗦𝗧𝗔𝗧𝗦')} 📊
┌${sep()}
│ ${F.mono(PREFIX+'stats')}      ${F.italic('top chatters')}
│ ${F.mono(PREFIX+'resetstats')} ${F.italic('reset (owner only)')}
└${sep()}

${F.bold('𝗕𝗜𝗥𝗧𝗛𝗗𝗔𝗬𝗦')} 🎂
┌${sep()}
│ ${F.mono(PREFIX+'setbirthday')} ${sc('[DD/MM]')} ${F.italic('set yours')}
│ ${F.mono(PREFIX+'mybirthday')}           ${F.italic('check yours')}
│ ${F.mono(PREFIX+'birthdays')}            ${F.italic('group list')}
│ ${F.mono(PREFIX+'removebirthday')}       ${F.italic('remove yours')}
└${sep()}

${F.bold('𝗟𝗘𝗩𝗘𝗟  𝗥𝗔𝗡𝗞𝗦')} 🌱→🌹
┌${sep()}
│ 0  ${F.italic('Rookie 🌱')}   →  1  ${F.italic('Bronze ⚔️')}
│ 2  ${F.italic('Silver 🥈')}   →  3  ${F.italic('Gold 🏆')}
│ 4  ${F.italic('Platinum 💎')} →  5  ${F.italic('Diamond 💠')}
│ 6  ${F.italic('Master 🔥')}   →  7  ${F.italic('Grandmaster 🌟')}
│ 8  ${F.italic('Legend 👑')}   →  9  ${F.italic('Mythic 🔴')}
│ 10 ${F.italic('RIAS Tier 🌹')} → 11 ${F.italic('Ghost Mode 👻')}
└${sep()}

_${F.italic('Chat more. Level up. RIAS is watching. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getOwnerMenu() {
  return `
╔══════════════════════════╗
║  👑  ${F.bold('𝗢𝗪𝗡𝗘𝗥  𝗦𝗘𝗖𝗧𝗜𝗢𝗡')}  👑  ║
╚══════════════════════════╝

${F.bold('𝗕𝗢𝗧  𝗖𝗢𝗡𝗧𝗥𝗢𝗟')} 🔴
┌${sep()}
│ ${F.mono(PREFIX+'shutdown')}          ${F.italic('power off RIAS')}
│ ${F.mono(PREFIX+'restart')}           ${F.italic('restart RIAS')}
│ ${F.mono(PREFIX+'setprefix')} ${sc('[x]')}   ${F.italic('change prefix')}
│ ${F.mono(PREFIX+'setstatus')} ${sc('[text]')} ${F.italic('update status')}
└${sep()}

${F.bold('𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧')} 📢
┌${sep()}
│ ${F.mono(PREFIX+'broadcast')} ${sc('[msg]')}  ${F.italic('send to all')}
│ ${F.mono(PREFIX+'bc')} ${sc('[msg]')}          ${F.italic('short form')}
└${sep()}

${F.bold('𝗨𝗦𝗘𝗥  𝗖𝗢𝗡𝗧𝗥𝗢𝗟')} 👥
┌${sep()}
│ ${F.mono(PREFIX+'block')} ${sc('@user')}    ${F.italic('block user')}
│ ${F.mono(PREFIX+'unblock')} ${sc('@user')}  ${F.italic('unblock user')}
└${sep()}

${F.bold('𝗚𝗥𝗢𝗨𝗣  𝗠𝗔𝗡𝗔𝗚𝗘𝗠𝗘𝗡𝗧')} 🔗
┌${sep()}
│ ${F.mono(PREFIX+'join')} ${sc('[link]')}  ${F.italic('join via link')}
│ ${F.mono(PREFIX+'leave')}          ${F.italic('leave current group')}
│ ${F.mono(PREFIX+'tagall')} ${sc('[msg]')} ${F.italic('tag everyone')}
└${sep()}

_${F.italic('Handle with care. 🔴')}_`.trim();
}

// ─────────────────────────────────────────────
function getAllCmds() {
  return `
╔══════════════════════════╗
║  📋  ${F.bold('𝗔𝗟𝗟  𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦')}  📋  ║
╚══════════════════════════╝

${F.bold('🤖 𝗔𝗜')}
${F.mono('ai • ask • chat • roast • compliment')}
${F.mono('advice • story • poem • joke • rizz')}
${F.mono('improve • summarize • translate • define')}
${F.mono('fact • quote • news • lyrics • weather')}

${F.bold('⚔️ 𝗔𝗗𝗠𝗜𝗡')}
${F.mono('kick • ban • mute • unmute • promote')}
${F.mono('demote • warn • warnreset • tagall')}
${F.mono('lockgroup • unlockgroup • getlink')}
${F.mono('resetlink • delete • groupinfo • userinfo')}

${F.bold('🎲 𝗙𝗨𝗡')}
${F.mono('ship • truth • dare • rank • trivia')}
${F.mono('roll • flip • 8ball • wyr • spirit • battle')}

${F.bold('🎮 𝗚𝗔𝗠𝗘𝗦')}
${F.mono('rps • guess • slots')}

${F.bold('📥 𝗠𝗘𝗗𝗜𝗔')}
${F.mono('play • lyrics • sticker • toimg • tts')}
${F.mono('shortlink')}

${F.bold('🛠️ 𝗨𝗧𝗜𝗟𝗜𝗧𝗬')}
${F.mono('calc • time • define • weather • news')}
${F.mono('fact • ping • alive • botinfo')}

${F.bold('🏅 𝗦𝗧𝗔𝗧𝗦')}
${F.mono('level • leaderboard • lb • stats')}
${F.mono('setbirthday • mybirthday • birthdays')}
${F.mono('resetstats • removebirthday')}

${F.bold('💬 𝗗𝗠')}
${F.mono('broadcast • bc • autoreply • channel')}
${F.mono('dev • owner')}

${F.bold('👑 𝗢𝗪𝗡𝗘𝗥')}
${F.mono('shutdown • restart • block • unblock')}
${F.mono('join • leave • setstatus • setprefix')}
${F.mono('setwelcome • setgoodbye • ownermenu')}

_${F.italic('70+ commands total. RIAS is ready. 🔴')}_`.trim();
}



// ════════════════════════════════════════
//  GEMINI AI
// ════════════════════════════════════════
async function geminiAI(prompt, systemPrompt = '') {
  try {
    if (!GEMINI_KEY) {
      console.error('[Gemini] ❌ No API key set in GEMINI_API_KEY env var');
      return riasOffline();
    }

    // Build request body — use system_instruction for the persona,
    // contents for the actual prompt. This is the correct Gemini API format.
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (systemPrompt) {
      body.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.error('[Gemini] ❌ Empty response:', JSON.stringify(res.data));
      return riasOffline();
    }
    return text;

  } catch (err) {
    // Log the full error so you can debug from console
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('[Gemini] ❌ Error:', detail);
    return riasOffline();
  }
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function pick(arr)    { return arr[Math.floor(Math.random() * arr.length)]; }
function getGreeting(){ return pick(['Good morning','Good afternoon','Good evening','Hey','Hi there','Welcome']); }
function riasOffline(){ return pick(['You already know the answer. You just want permission. Granted. 🔴','Bold move or no move. 🔴','Stop overthinking. Execute. 🌹','The version of you that hesitates loses. ⚔️']); }
function noOwner(reply, react) { react('🚫'); return reply(`🚫 ${F.bold('Owner Only Command')}\n\n_This command is reserved for the bot owner.\nContact wa.me/${DEV_NUMBER} for access. 🔴_`); }
function getQuotedText(msg) { return msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || ''; }
async function fetchBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(res.data);
  } catch { return null; }
}

module.exports = { pairNumber, restoreAllSessions };

// ════════════════════════════════════════
//  FEATURE SYSTEMS (appended)
// ════════════════════════════════════════
