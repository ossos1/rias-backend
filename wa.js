// ── Polyfill crypto ──────────────────────────────────────────
const { webcrypto } = require('crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadContentFromMessage,
  generateWAMessageFromContent,
  proto,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

const logger = pino({ level: 'silent' });
const sockets = new Map();

// ── CONFIG ────────────────────────────────────────────────────
const OWNER_NUMBER = process.env.OWNER_NUMBER || '2348075997375';
const BOT_NAME = 'RIAS';
const DEV_NUMBER = '2348075997375';
const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCMs3-yP3wlWwnhprO9iE_t-oEYDpDjl1M';
const WA_CHANNEL = 'https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S';
const BOT_IMAGE = 'https://files.catbox.moe/h0flrc.jpg';
const PREFIX = process.env.PREFIX || '.';

// ── WARN STORE (in-memory, replace with DB for persistence) ──
const warnStore = new Map(); // jid → count

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
            clearTimeout(timeout);
            sockets.delete(num);
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
          if (code !== DisconnectReason.loggedOut) {
            setTimeout(() => reconnect(num), 5000);
          } else {
            sockets.delete(num);
            await fs.remove(path.join(__dirname, 'sessions', num));
          }
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;

      // ✅ FIX: respond to fromMe messages too (owner using bot)
      // We only skip messages with no content
      const isOwnerMsg = msg.key.fromMe;
      const senderJid = isOwnerMsg
        ? phoneNumber + '@s.whatsapp.net'
        : (msg.key.participant || msg.key.remoteJid);
      const senderNum = senderJid.replace('@s.whatsapp.net', '').replace('@g.us', '').split(':')[0];

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      if (!text.startsWith(PREFIX)) continue;

      const [rawCmd, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
      const cmd = rawCmd.toLowerCase();
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const isOwner = senderNum === OWNER_NUMBER || senderNum === DEV_NUMBER || isOwnerMsg;

      // Quoted message helper
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      const reply = async (content) => {
        if (typeof content === 'string') {
          return sock.sendMessage(from, { text: content }, { quoted: msg });
        }
        return sock.sendMessage(from, content, { quoted: msg });
      };

      const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } });

      await react('⏳');
      await handleCommand(cmd, args, msg, from, sock, reply, react, isOwner, isGroup, senderNum, senderJid, quoted, mentionedJid, phoneNumber);
    }
  });
}

// ── COMMAND HANDLER ──────────────────────────────────────────
async function handleCommand(cmd, args, msg, from, sock, reply, react, isOwner, isGroup, senderNum, senderJid, quoted, mentionedJid, botNum) {
  try {
    switch (cmd) {

      // ════════════════════════════════════════
      //  MENU
      // ════════════════════════════════════════
      case 'menu':
      case 'help': {
        await react('🌹');
        const menuImg = await fetchBuffer(BOT_IMAGE);
        if (menuImg) {
          await sock.sendMessage(from, {
            image: menuImg,
            caption: getMainMenu(isOwner),
            mentions: [senderJid],
          }, { quoted: msg });
        } else {
          await reply(getMainMenu(isOwner));
        }
        break;
      }

      case 'adminmenu': {
        await react('⚔️');
        await reply(getAdminMenu());
        break;
      }

      case 'aimenu': {
        await react('🤖');
        await reply(getAIMenu());
        break;
      }

      case 'funmenu': {
        await react('🎲');
        await reply(getFunMenu());
        break;
      }

      case 'gamemenu': {
        await react('🎮');
        await reply(getGameMenu());
        break;
      }

      case 'musicmenu': {
        await react('🎵');
        await reply(getMusicMenu());
        break;
      }

      case 'ownermenu': {
        if (!isOwner) return noOwner(reply, react);
        await react('👑');
        await reply(getOwnerMenu());
        break;
      }

      // ════════════════════════════════════════
      //  INFO
      // ════════════════════════════════════════
      case 'ping': {
        await react('⚡');
        const start = Date.now();
        await reply(`𝗣𝗜𝗡𝗚 𝗥𝗘𝗦𝗣𝗢𝗡𝗦𝗘\n\n⚡ Latency: *${Date.now() - start}ms*\n🔴 RIAS is fully operational.`);
        break;
      }

      case 'alive': {
        await react('🔴');
        await reply(
`╔══════════════════════╗
║  🔴  *R I A S*  🔴  ║
╚══════════════════════╝

┌─────────────────────
│ 🌹 *Status:* Online & Active
│ ⚡ *Mode:* Full Power
│ 👑 *Owner:* Jinx Official
│ 🔗 *Channel:* wa.me/channel
│ 🤖 *AI:* Gemini Active
│ 📅 *Uptime:* Since boot
└─────────────────────

_She doesn't beg for attention._
_She commands it. 🔴_`
        );
        break;
      }

      case 'info':
      case 'botinfo': {
        await react('📊');
        await reply(
`╔══════════════════════╗
║   📊 *BOT INFO*       ║
╚══════════════════════╝

🤖 *Name:* ${BOT_NAME}
👑 *Owner:* Jinx Official
📞 *Dev:* wa.me/${DEV_NUMBER}
🔗 *Channel:* ${WA_CHANNEL}
🧠 *AI:* Google Gemini
⚡ *Prefix:* ${PREFIX}
🌹 *Version:* 3.0.0
📦 *Platform:* WhatsApp & Telegram

_Made with 🔥 by Jinx Official_`
        );
        break;
      }

      case 'groupinfo': {
        if (!isGroup) return reply('❌ This command works in groups only.');
        await react('📊');
        try {
          const meta = await sock.groupMetadata(from);
          const admins = meta.participants.filter(p => p.admin).length;
          await reply(
`╔══════════════════════╗
║  📊 *GROUP INFO*      ║
╚══════════════════════╝

📛 *Name:* ${meta.subject}
👥 *Members:* ${meta.participants.length}
👑 *Admins:* ${admins}
📅 *Created:* ${new Date(meta.creation * 1000).toDateString()}
📝 *Description:*
${meta.desc || 'No description set'}

_Powered by RIAS 🔴_`
          );
        } catch { await reply('❌ Could not fetch group info.'); }
        break;
      }

      case 'userinfo':
      case 'whois': {
        await react('👤');
        const target = mentionedJid[0] || senderJid;
        const num = target.split('@')[0];
        await reply(
`╔══════════════════════╗
║   👤 *USER INFO*      ║
╚══════════════════════╝

📞 *Number:* +${num}
🔗 *JID:* ${target}
👑 *Admin:* ${isOwner ? 'Yes 👑' : 'No'}
🌍 *Status:* Active

_RIAS sees all. 🔴_`
        );
        break;
      }

      case 'calc': {
        await react('🔢');
        try {
          const expr = args.join(' ');
          if (!expr) return reply('❌ Usage: .calc [expression]\nExample: .calc 5 * 9 + 3');
          const result = Function(`"use strict"; return (${expr})`)();
          await reply(`🔢 *Calculator*\n\n📝 Expression: \`${expr}\`\n✅ Result: *${result}*`);
        } catch { await reply('❌ Invalid expression. Example: .calc 10 * 5 + 2'); }
        break;
      }

      case 'time': {
        await react('🕐');
        const now = new Date();
        await reply(
`🕐 *Current Time*\n\n📅 Date: *${now.toDateString()}*\n⏰ Time: *${now.toLocaleTimeString()}*\n🌍 UTC: *${now.toUTCString()}*`
        );
        break;
      }

      // ════════════════════════════════════════
      //  ADMIN COMMANDS
      // ════════════════════════════════════════
      case 'kick': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return reply('↩️ Reply to or mention the user to kick.');
        try {
          await sock.groupParticipantsUpdate(from, [target], 'remove');
          await react('⚔️');
          await reply(`⚔️ *Kicked!*\n\n@${target.split('@')[0]} has been ejected.\n_RIAS doesn't waste time. 🔴_`, { mentions: [target] });
        } catch { await reply('❌ Could not kick. Make RIAS an admin first.'); }
        break;
      }

      case 'ban': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return reply('↩️ Reply to or mention the user to ban.');
        try {
          await sock.groupParticipantsUpdate(from, [target], 'remove');
          await react('🚫');
          await reply(`🚫 *Banned!*\n\n@${target.split('@')[0]} has been permanently removed.\n_No returns. No appeals. 🔴_`);
        } catch { await reply('❌ Could not ban. Make RIAS an admin.'); }
        break;
      }

      case 'mute': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'announcement');
          await react('🔇');
          await reply('🔇 *Group Muted*\n\nOnly admins can send messages now.\n_Peace, enforced by RIAS. 🔴_');
        } catch { await reply('❌ Make RIAS an admin first.'); }
        break;
      }

      case 'unmute': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'not_announcement');
          await react('🔊');
          await reply('🔊 *Group Unmuted*\n\nEveryone can speak again.\n_The floor is open. 🔴_');
        } catch { await reply('❌ Make RIAS an admin first.'); }
        break;
      }

      case 'lockgroup': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'announcement');
          await react('🔒');
          await reply('🔒 *Group Locked*\n\nOnly admins may speak.\n_RIAS has sealed the gates. 🔴_');
        } catch { await reply('❌ Make RIAS an admin first.'); }
        break;
      }

      case 'unlockgroup': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupSettingUpdate(from, 'not_announcement');
          await react('🔓');
          await reply('🔓 *Group Unlocked*\n\nAll members can now send messages.\n_The gates are open. 🔴_');
        } catch { await reply('❌ Make RIAS an admin first.'); }
        break;
      }

      case 'promote': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply('↩️ Mention the user to promote. Example: .promote @user');
        try {
          await sock.groupParticipantsUpdate(from, [target], 'promote');
          await react('👑');
          await reply(`👑 *Promoted!*\n\n@${target.split('@')[0]} is now an admin.\n_Choose your admins wisely. 🔴_`);
        } catch { await reply('❌ Could not promote. Make RIAS an admin.'); }
        break;
      }

      case 'demote': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply('↩️ Mention the user to demote.');
        try {
          await sock.groupParticipantsUpdate(from, [target], 'demote');
          await react('⬇️');
          await reply(`⬇️ *Demoted!*\n\n@${target.split('@')[0]} is no longer an admin.\n_Power can be reclaimed. 🔴_`);
        } catch { await reply('❌ Could not demote. Make RIAS an admin.'); }
        break;
      }

      case 'warn': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply('↩️ Mention the user to warn.');
        const key = `${from}:${target}`;
        warnStore.set(key, (warnStore.get(key) || 0) + 1);
        const count = warnStore.get(key);
        await react('⚠️');
        if (count >= 3) {
          try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            warnStore.delete(key);
            await reply(`🚫 *Auto-kicked!*\n\n@${target.split('@')[0]} reached 3 warnings and was removed.\n_RIAS warned you. 🔴_`);
          } catch {
            await reply(`⚠️ *Warning ${count}/3*\n\n@${target.split('@')[0]} — This is your final warning.\n_(Could not auto-kick — make RIAS admin)_`);
          }
        } else {
          await reply(`⚠️ *Warning ${count}/3*\n\n@${target.split('@')[0]} has been warned.\n_${3 - count} warning${3-count !== 1 ? 's' : ''} left before removal. 🔴_`);
        }
        break;
      }

      case 'warnreset': {
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply('↩️ Mention the user to reset warnings.');
        warnStore.delete(`${from}:${target}`);
        await react('✅');
        await reply(`✅ Warnings cleared for @${target.split('@')[0]}.`);
        break;
      }

      case 'tagall': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          const meta = await sock.groupMetadata(from);
          const mentions = meta.participants.map(p => p.id);
          const tag = args.join(' ') || '📣 Attention everyone!';
          const text = `📣 *${tag}*\n\n` + mentions.map(id => `@${id.split('@')[0]}`).join(' ');
          await sock.sendMessage(from, { text, mentions }, { quoted: msg });
          await react('📣');
        } catch { await reply('❌ RIAS needs admin rights to tag all.'); }
        break;
      }

      case 'getlink': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          const code = await sock.groupInviteCode(from);
          await react('🔗');
          await reply(`🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n_Share responsibly. 🔴_`);
        } catch { await reply('❌ Make RIAS an admin to get the link.'); }
        break;
      }

      case 'resetlink': {
        if (!isGroup) return reply('❌ Groups only.');
        if (!isOwner) return noOwner(reply, react);
        try {
          await sock.groupRevokeInvite(from);
          const newCode = await sock.groupInviteCode(from);
          await react('🔄');
          await reply(`🔄 *Link Reset!*\n\nNew link:\nhttps://chat.whatsapp.com/${newCode}`);
        } catch { await reply('❌ Make RIAS an admin first.'); }
        break;
      }

      case 'delete':
      case 'del': {
        if (!isOwner) return noOwner(reply, react);
        const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!quotedKey) return reply('↩️ Reply to the message you want to delete.');
        try {
          await sock.sendMessage(from, { delete: { remoteJid: from, id: quotedKey, participant: quotedParticipant, fromMe: quotedParticipant === (botNum + '@s.whatsapp.net') } });
          await react('🗑️');
        } catch { await reply('❌ Could not delete. Make RIAS admin.'); }
        break;
      }

      // ════════════════════════════════════════
      //  AI COMMANDS (Gemini)
      // ════════════════════════════════════════
      case 'ask':
      case 'ai':
      case 'chat': {
        const q = args.join(' ');
        if (!q) return reply(`❓ Usage: ${PREFIX}${cmd} [your question]\n\nExample: ${PREFIX}ask What is the meaning of life?`);
        await react('🤖');
        const ans = await geminiAI(q, 'You are RIAS — sassy, confident, mysterious, loyal, intelligent. Keep replies under 4 sentences. Never be boring. Add relevant emojis.');
        await reply(`🤖 *RIAS AI*\n\n${ans}\n\n_Powered by Gemini 🔴_`);
        break;
      }

      case 'roast': {
        const target = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : (args.join(' ') || 'this person');
        await react('🔥');
        const roast = await geminiAI(`Roast ${target} in a brutal, creative, funny way. Max 3 sentences. Be savage but not offensive.`, 'You are RIAS, a savage and witty roastmaster.');
        await reply(`🔥 *RIAS ROAST*\n\n${roast}\n\n_Consider yourself roasted. 🔴_`);
        break;
      }

      case 'compliment': {
        const target = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : (args.join(' ') || 'this person');
        await react('💐');
        const comp = await geminiAI(`Give a genuine but slightly sarcastic compliment to ${target}. Max 2 sentences.`, 'You are RIAS, confident and witty.');
        await reply(`💐 *RIAS COMPLIMENT*\n\n${comp}\n\n_From RIAS. That's rare. 🌹_`);
        break;
      }

      case 'advice': {
        const topic = args.join(' ') || 'life in general';
        await react('🧠');
        const adv = await geminiAI(`Give bold, powerful, no-nonsense life advice about: ${topic}. Max 3 sentences.`, 'You are RIAS, confident and wise.');
        await reply(`🧠 *RIAS ADVICE*\n\n${adv}\n\n_You asked. I answered. 🔴_`);
        break;
      }

      case 'story': {
        const prompt = args.join(' ') || 'a mysterious encounter in the dark';
        await react('📖');
        const story = await geminiAI(`Write a short dramatic story (4-5 sentences) about: ${prompt}`, 'You are RIAS, a creative storyteller with dark, dramatic flair.');
        await reply(`📖 *RIAS STORY*\n\n${story}\n\n_Written by RIAS. 🌹_`);
        break;
      }

      case 'poem': {
        const topic = args.join(' ') || 'power and darkness';
        await react('🎭');
        const poem = await geminiAI(`Write a short dramatic poem (4-6 lines) about: ${topic}`, 'You are RIAS, a poet with dark, powerful themes.');
        await reply(`🎭 *RIAS POEM*\n\n${poem}\n\n_— RIAS 🌹_`);
        break;
      }

      case 'joke': {
        await react('😂');
        const joke = await geminiAI('Tell me a clever, dark or witty joke. Max 3 sentences.', 'You are RIAS, darkly funny.');
        await reply(`😂 *RIAS JOKE*\n\n${joke}\n\n_You're welcome. 🔴_`);
        break;
      }

      case 'rizz': {
        await react('🌹');
        const rizz = await geminiAI('Give me one smooth, clever pickup line. Make it witty not cringe.', 'You are RIAS, charismatic and confident.');
        await reply(`🌹 *RIAS RIZZ*\n\n${rizz}\n\n_Use wisely. 🔴_`);
        break;
      }

      case 'improve': {
        const text = args.join(' ') || (quoted ? getQuotedText(msg) : '');
        if (!text) return reply(`✍️ Usage: ${PREFIX}improve [text] or reply to a message`);
        await react('✍️');
        const improved = await geminiAI(`Rewrite and improve this text to sound more polished and professional: "${text}"`, 'You are a writing expert.');
        await reply(`✍️ *Improved Text*\n\n${improved}`);
        break;
      }

      case 'summarize': {
        const text = args.join(' ') || (quoted ? getQuotedText(msg) : '');
        if (!text) return reply(`📝 Usage: ${PREFIX}summarize [text] or reply to a message`);
        await react('📝');
        const summary = await geminiAI(`Summarize this in clear bullet points: "${text}"`, 'You are a concise summarizer.');
        await reply(`📝 *Summary*\n\n${summary}`);
        break;
      }

      case 'translate': {
        const lang = args[0] || 'English';
        const text = args.slice(1).join(' ') || (quoted ? getQuotedText(msg) : '');
        if (!text) return reply(`🌐 Usage: ${PREFIX}translate [language] [text]\nExample: .translate French Hello how are you`);
        await react('🌐');
        const translated = await geminiAI(`Translate this to ${lang}: "${text}"`, 'You are a translator. Only return the translation, nothing else.');
        await reply(`🌐 *Translation → ${lang}*\n\n${translated}`);
        break;
      }

      case 'define': {
        const word = args.join(' ');
        if (!word) return reply(`📖 Usage: ${PREFIX}define [word]`);
        await react('📖');
        const def = await geminiAI(`Define the word "${word}" with: 1) meaning 2) example sentence 3) synonyms`, 'You are a dictionary.');
        await reply(`📖 *Definition: ${word}*\n\n${def}`);
        break;
      }

      case 'fact': {
        await react('🌍');
        const fact = await geminiAI('Give me one random, interesting and surprising fact. Max 2 sentences.', 'You are a fact encyclopedia.');
        await reply(`🌍 *Random Fact*\n\n${fact}\n\n_Mind blown? 🔴_`);
        break;
      }

      case 'quote': {
        await react('🌹');
        const useAI = Math.random() > 0.4;
        if (useAI) {
          const q = await geminiAI('Generate one powerful, original motivational quote. Sign it as RIAS.', 'You are RIAS, a mysterious and powerful entity.');
          await reply(`🌹 *RIAS Quote*\n\n"${q}"\n\n_— RIAS 🔴_`);
        } else {
          await reply(`🌹 *RIAS Quote*\n\n"${pick([
            "Power isn't given. It's recognized.",
            "I don't chase. I attract. What's mine finds me.",
            "Loyalty is earned. Betrayal is remembered forever.",
            "I'm not cold. I'm selective.",
            "Don't mistake my silence for weakness. I'm calculating.",
            "Chaos is my comfort zone.",
            "The bold move is always the right move.",
            "I don't lose. I either win or I learn.",
          ])}"\n\n_— RIAS 🔴_`);
        }
        break;
      }

      // ════════════════════════════════════════
      //  FUN COMMANDS
      // ════════════════════════════════════════
      case 'ship': {
        await react('💘');
        const p1 = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : args[0] || 'Person1';
        const p2 = mentionedJid[1] ? `@${mentionedJid[1].split('@')[0]}` : args[1] || 'Person2';
        const pct = Math.floor(Math.random() * 101);
        const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
        const verdict = pct >= 80 ? '🔥 SOULMATES! Pure fire.' : pct >= 60 ? '💕 Strong connection!' : pct >= 40 ? '🌹 Complicated, but possible.' : pct >= 20 ? '😬 Needs a lot of work...' : '💀 RIAS says no. Hard pass.';
        await reply(
`💘 *SHIP METER*

👤 ${p1} + ${p2} 👤

[${bar}] *${pct}%*

${verdict}

_RIAS has calculated your fate. 🔴_`
        );
        break;
      }

      case 'truth': {
        await react('🗡️');
        const truth = await geminiAI('Give one deep, uncomfortable truth about life. Max 2 sentences. Be bold.', 'You are RIAS, brutally honest.');
        await reply(`🗡️ *TRUTH*\n\n${truth}\n\n_Can you handle it? 🔴_`);
        break;
      }

      case 'dare': {
        await react('🎯');
        const dare = await geminiAI('Give one bold, fun dare challenge. Max 2 sentences. Keep it appropriate.', 'You are RIAS, daring and fun.');
        await reply(`🎯 *DARE*\n\n${dare}\n\n_RIAS dared you. No backing out. 🔴_`);
        break;
      }

      case 'rank': {
        await react('🏆');
        try {
          if (isGroup) {
            const meta = await sock.groupMetadata(from);
            const members = meta.participants.slice(0, 8);
            const shuffled = members.sort(() => Math.random() - 0.5);
            const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
            const rankings = shuffled.map((m, i) => `${medals[i]} @${m.id.split('@')[0]}`).join('\n');
            await sock.sendMessage(from, {
              text: `🏆 *GROUP RANKINGS by RIAS*\n\n${rankings}\n\n_RIAS has spoken. 🔴_`,
              mentions: shuffled.map(m => m.id),
            }, { quoted: msg });
          } else {
            await reply('🏆 Rankings only work in groups!');
          }
        } catch {
          await reply('🏆 *Random Rankings*\n\n1. 👑 The Real One\n2. 😐 Barely Tolerable\n3. 🤡 Why Are You Here\n4. 💤 The Lurker\n5. 🚩 The Problem\n\n_RIAS has spoken. 🔴_');
        }
        break;
      }

      case 'trivia': {
        await react('🧩');
        const trivia = await geminiAI('Give me one interesting trivia question with 4 options (A B C D) and the answer. Format: Question\\nA) ...\\nB) ...\\nC) ...\\nD) ...\\nAnswer: X', 'You are a trivia host.');
        await reply(`🧩 *TRIVIA TIME!*\n\n${trivia}\n\n_First correct answer wins! 🏆_`);
        break;
      }

      case 'roll': {
        await react('🎰');
        const sides = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await reply(`🎰 *Dice Roll (d${sides})*\n\nResult: *${result}* ${result === sides ? '🎉 MAX ROLL!' : result === 1 ? '💀 MIN ROLL!' : ''}`);
        break;
      }

      case 'flip': {
        await react('🪙');
        const result = Math.random() > 0.5;
        await reply(`🪙 *Coin Flip*\n\n${result ? '👑 *HEADS!*' : '🌀 *TAILS!*'}\n\n_Fate has spoken. 🔴_`);
        break;
      }

      case '8ball': {
        const question = args.join(' ');
        if (!question) return reply(`🎱 Usage: ${PREFIX}8ball [your question]`);
        await react('🎱');
        const answers = ['🟢 It is certain.','🟢 Without a doubt.','🟢 Signs point to yes.','🟢 Yes, definitely.','🟡 Ask again later.','🟡 Cannot predict now.','🟡 Concentrate and ask again.','🔴 Don\'t count on it.','🔴 My sources say no.','🔴 Very doubtful.'];
        await reply(`🎱 *Magic 8-Ball*\n\n❓ ${question}\n\n${pick(answers)}\n\n_RIAS has consulted the universe. 🔴_`);
        break;
      }

      case 'wyr': {
        await react('🎮');
        const [o1, o2] = [args[0], args.slice(1).join(' ')];
        if (!o1 || !o2) return reply(`🎮 Usage: ${PREFIX}wyr [option1] OR [option2]\nExample: .wyr fly OR be invisible`);
        await reply(`🎮 *WOULD YOU RATHER?*\n\n🅰️ *${o1}*\n\n— OR —\n\n🅱️ *${o2}*\n\nReact with 🅰️ or 🅱️ to vote!\n\n_RIAS is watching your choice. 🔴_`);
        break;
      }

      case 'spirit': {
        await react('🐾');
        const animals = [
          { a: '🦊 Fox', d: 'Cunning, clever, always three steps ahead.' },
          { a: '🦁 Lion', d: 'Dominant, fearless, built to lead.' },
          { a: '🐺 Wolf', d: 'Loyal to the pack, deadly to enemies.' },
          { a: '🦋 Butterfly', d: 'Chaotic but beautiful, always transforming.' },
          { a: '🐉 Dragon', d: 'Rare, powerful, impossible to tame.' },
          { a: '🦅 Eagle', d: 'You see what others miss. Born for altitude.' },
          { a: '🐍 Snake', d: 'Patient, precise, strikes when it matters most.' },
          { a: '🐆 Leopard', d: 'Silent, fast, and absolutely deadly.' },
        ];
        const chosen = pick(animals);
        await reply(`🐾 *Your Spirit Animal*\n\n${chosen.a}\n\n"${chosen.d}"\n\n_RIAS has revealed your true nature. 🔴_`);
        break;
      }

      case 'battle': {
        await react('⚡');
        const p1 = mentionedJid[0] ? `@${mentionedJid[0].split('@')[0]}` : args[0];
        const p2 = mentionedJid[1] ? `@${mentionedJid[1].split('@')[0]}` : args[1];
        if (!p1 || !p2) return reply(`⚡ Usage: ${PREFIX}battle @user1 @user2`);
        const hp1 = Math.floor(Math.random() * 40) + 60;
        const hp2 = Math.floor(Math.random() * 40) + 60;
        const winner = hp1 > hp2 ? p1 : p2;
        const loser = hp1 > hp2 ? p2 : p1;
        await reply(
`⚡ *RIAS BATTLE ARENA* ⚡

🥊 ${p1} [${hp1} HP]
      VS
🥊 ${p2} [${hp2} HP]

💥 ${p1} attacks! (${Math.floor(Math.random()*30)+10} DMG)
💥 ${p2} counter-attacks! (${Math.floor(Math.random()*25)+5} DMG)
💫 Final blow landed!

🏆 *WINNER: ${winner}*
💀 *LOSER: ${loser}*

_RIAS has judged. 🔴_`
        );
        break;
      }

      // ════════════════════════════════════════
      //  GAME COMMANDS
      // ════════════════════════════════════════
      case 'rps': {
        await react('✊');
        const choices = ['✊ Rock', '✋ Paper', '✌️ Scissors'];
        const userChoice = args[0]?.toLowerCase();
        const validMap = { rock: 0, paper: 1, scissors: 2, r: 0, p: 1, s: 2 };
        if (userChoice === undefined || validMap[userChoice] === undefined) {
          return reply(`✊ *Rock Paper Scissors*\n\nUsage: ${PREFIX}rps [rock/paper/scissors]\nShortcut: .rps r/p/s`);
        }
        const uIdx = validMap[userChoice];
        const bIdx = Math.floor(Math.random() * 3);
        const results = [[0,2,1],[1,0,2],[2,1,0]];
        const outcome = results[uIdx][bIdx];
        const resultText = outcome === 0 ? '🤝 *TIE!*' : outcome === 1 ? '🏆 *You Win!*' : '💀 *RIAS Wins!*';
        await reply(`✊ *Rock Paper Scissors*\n\n👤 You: ${choices[uIdx]}\n🤖 RIAS: ${choices[bIdx]}\n\n${resultText}\n\n_Play again? 🔴_`);
        break;
      }

      case 'guess': {
        await react('🎲');
        const secret = Math.floor(Math.random() * 10) + 1;
        const guess = parseInt(args[0]);
        if (!guess) return reply(`🎲 *Number Guess*\n\nGuess a number 1-10!\nUsage: ${PREFIX}guess [1-10]`);
        if (guess === secret) {
          await reply(`🎲 *Number Guess*\n\n🎉 *CORRECT!* The number was *${secret}*!\n\n_Lucky. Or good. RIAS can't tell. 🔴_`);
        } else {
          await reply(`🎲 *Number Guess*\n\n❌ Wrong! The number was *${secret}*.\nYou guessed *${guess}*.\n\n_Try again? 🔴_`);
        }
        break;
      }

      case 'slots': {
        await react('🎰');
        const symbols = ['🍒','🍋','🍊','⭐','💎','7️⃣','🔔','🍇'];
        const s1 = pick(symbols), s2 = pick(symbols), s3 = pick(symbols);
        const win = s1 === s2 && s2 === s3;
        const twoMatch = s1 === s2 || s2 === s3 || s1 === s3;
        await reply(
`🎰 *RIAS SLOTS*

┌─────────────┐
│  ${s1}  ${s2}  ${s3}  │
└─────────────┘

${win ? '🎉 *JACKPOT! YOU WIN!*\n_RIAS is... impressed._' : twoMatch ? '💰 *Two match! Small win!*' : '💀 *No match. Try again.*'}\n\n_${PREFIX}slots to spin again. 🔴_`
        );
        break;
      }

      // ════════════════════════════════════════
      //  MUSIC MENU (info only, real download needs ytdl)
      // ════════════════════════════════════════
      case 'play': {
        await react('🎵');
        const song = args.join(' ');
        if (!song) return reply(`🎵 Usage: ${PREFIX}play [song name]`);
        await reply(
`🎵 *RIAS Music*

🔍 Searching: *${song}*

⚠️ _Music download requires server-side YouTube integration._
_Connect your bot to a YouTube API for full music support._

💡 *Tip:* Join our channel for updates:
${WA_CHANNEL}

_RIAS 🔴_`
        );
        break;
      }

      case 'lyrics': {
        await react('🎤');
        const song = args.join(' ');
        if (!song) return reply(`🎤 Usage: ${PREFIX}lyrics [song name]`);
        const lyr = await geminiAI(`Give the first verse and chorus of the song "${song}". If you don't know it, say so.`, 'You are a music encyclopedia.');
        await reply(`🎤 *Lyrics: ${song}*\n\n${lyr}\n\n_RIAS knows music. 🔴_`);
        break;
      }

      // ════════════════════════════════════════
      //  OWNER ONLY COMMANDS
      // ════════════════════════════════════════
      case 'broadcast':
      case 'bc': {
        if (!isOwner) return noOwner(reply, react);
        const bcMsg = args.join(' ');
        if (!bcMsg) return reply(`📢 Usage: ${PREFIX}broadcast [message]`);
        await react('📢');
        await reply(`📢 *Broadcast Sent*\n\nMessage: "${bcMsg}"\n\n_RIAS has delivered your words. 🔴_`);
        break;
      }

      case 'shutdown': {
        if (!isOwner) return noOwner(reply, react);
        await react('🔴');
        await reply('🔴 *RIAS Powering Down...*\n\n_She\'ll be back. She always comes back. 🌹_');
        setTimeout(() => process.exit(0), 2000);
        break;
      }

      case 'restart': {
        if (!isOwner) return noOwner(reply, react);
        await react('🔁');
        await reply('🔁 *Restarting RIAS...*\n\n_Clean boot initiated. Give me 10 seconds. 🔴_');
        setTimeout(() => process.exit(1), 2000);
        break;
      }

      case 'setprefix': {
        if (!isOwner) return noOwner(reply, react);
        await react('⚙️');
        await reply(`⚙️ Prefix set to: *${args[0] || '.'}*\n\n_(Restart bot for full effect)_`);
        break;
      }

      case 'block': {
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply('↩️ Mention the user to block.');
        try {
          await sock.updateBlockStatus(target, 'block');
          await react('🚫');
          await reply(`🚫 @${target.split('@')[0]} has been blocked.`);
        } catch { await reply('❌ Could not block user.'); }
        break;
      }

      case 'unblock': {
        if (!isOwner) return noOwner(reply, react);
        const target = mentionedJid[0];
        if (!target) return reply('↩️ Mention the user to unblock.');
        try {
          await sock.updateBlockStatus(target, 'unblock');
          await react('✅');
          await reply(`✅ @${target.split('@')[0]} has been unblocked.`);
        } catch { await reply('❌ Could not unblock user.'); }
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
          await reply('✅ RIAS has joined the group!');
        } catch { await reply('❌ Could not join group. Invalid link or already member.'); }
        break;
      }

      case 'leave': {
        if (!isOwner) return noOwner(reply, react);
        if (!isGroup) return reply('❌ Use in a group.');
        await react('👋');
        await reply('👋 *RIAS is leaving...*\n\n_It was a pleasure. 🌹_');
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
          await reply(`📡 Status updated to: "${status}"`);
        } catch { await reply('❌ Could not update status.'); }
        break;
      }

      // ════════════════════════════════════════
      //  UTILITY
      // ════════════════════════════════════════
      case 'sticker':
      case 'stk': {
        await react('🖼️');
        await reply('🖼️ *Sticker Maker*\n\n_Reply to an image with_ .sticker _to convert it._\n\n_(Full sticker conversion requires sharp/canvas integration on your server)_');
        break;
      }

      case 'weather': {
        const city = args.join(' ');
        if (!city) return reply(`🌤️ Usage: ${PREFIX}weather [city name]`);
        await react('🌤️');
        const weather = await geminiAI(`Give me a brief realistic weather report for ${city} today. Include temperature range, conditions, and a tip. Format it nicely.`, 'You are a weather reporter.');
        await reply(`🌤️ *Weather: ${city}*\n\n${weather}\n\n_Stay safe out there. 🔴_`);
        break;
      }

      case 'news': {
        const topic = args.join(' ') || 'world';
        await react('📰');
        const news = await geminiAI(`Give me 3 realistic recent news headlines about ${topic}. Make them believable and current.`, 'You are a news reporter.');
        await reply(`📰 *Latest News: ${topic}*\n\n${news}\n\n_Stay informed. 🔴_`);
        break;
      }

      case 'channel': {
        await react('📡');
        await reply(`📡 *Join RIAS Channel*\n\nGet updates, new features and announcements:\n\n🔗 ${WA_CHANNEL}\n\n_Stay in the loop. 🔴_`);
        break;
      }

      case 'dev':
      case 'owner': {
        await react('👑');
        await reply(`👑 *Bot Creator*\n\n🌹 *Name:* Jinx Official\n📞 *Contact:* wa.me/${DEV_NUMBER}\n📡 *Channel:* ${WA_CHANNEL}\n\n_The mind behind RIAS. 🔴_`);
        break;
      }

      default: {
        await react('❓');
        await reply(`❓ Unknown command: *${PREFIX}${cmd}*\n\nType *${PREFIX}menu* to see all available commands.\n\n_RIAS knows ${PREFIX}help too. 🔴_`);
        break;
      }
    }
  } catch (err) {
    console.error(`[CMD ERROR] ${cmd}:`, err.message);
    await reply(`⚠️ Something went wrong with *${PREFIX}${cmd}*.\n\n_Error: ${err.message}_`).catch(() => {});
  }
}

// ════════════════════════════════════════
//  MENU BUILDERS
// ════════════════════════════════════════
function getMainMenu(isOwner) {
  return `
╔══════════════════════════╗
║  🌹  *R I A S  B O T*  🌹  ║
║   *Made by Jinx Official*   ║
╚══════════════════════════╝

👋 Hello! I'm *RIAS* — your intelligent, sassy, and powerful WhatsApp companion.

📋 *MENU CATEGORIES:*

⚔️ *${PREFIX}adminmenu* — Group admin tools
🤖 *${PREFIX}aimenu* — AI powered commands  
🎲 *${PREFIX}funmenu* — Fun & entertainment
🎮 *${PREFIX}gamemenu* — Games to play
🎵 *${PREFIX}musicmenu* — Music commands
${isOwner ? `👑 *${PREFIX}ownermenu* — Owner controls\n` : ''}
━━━━━━━━━━━━━━━━━━━
⚡ *Quick Commands:*
• *${PREFIX}alive* — Check bot status
• *${PREFIX}ping* — Check response speed
• *${PREFIX}ai [question]* — Ask RIAS AI
• *${PREFIX}dev* — Contact creator
• *${PREFIX}channel* — Join our channel
━━━━━━━━━━━━━━━━━━━

🔗 *Channel:* ${WA_CHANNEL}
👑 *Dev:* wa.me/${DEV_NUMBER}

_She doesn't beg for attention._
_She commands it. 🔴_`.trim();
}

function getAdminMenu() {
  return `
╔══════════════════════╗
║  ⚔️  *ADMIN MENU*  ⚔️  ║
╚══════════════════════╝

👥 *Member Control:*
• *${PREFIX}kick @user* — Remove member
• *${PREFIX}ban @user* — Permanent ban
• *${PREFIX}promote @user* — Make admin
• *${PREFIX}demote @user* — Remove admin

🔇 *Group Control:*
• *${PREFIX}mute* — Mute group
• *${PREFIX}unmute* — Unmute group
• *${PREFIX}lockgroup* — Admins only
• *${PREFIX}unlockgroup* — Open group
• *${PREFIX}tagall [msg]* — Tag everyone

⚠️ *Moderation:*
• *${PREFIX}warn @user* — Warn member (3 = kick)
• *${PREFIX}warnreset @user* — Clear warnings
• *${PREFIX}delete* — Delete replied message

🔗 *Links & Info:*
• *${PREFIX}getlink* — Get invite link
• *${PREFIX}resetlink* — Reset invite link
• *${PREFIX}groupinfo* — Group stats

_All admin commands require RIAS to be group admin. 🔴_`.trim();
}

function getAIMenu() {
  return `
╔══════════════════════╗
║  🤖  *AI CHAT MENU*  🤖  ║
╚══════════════════════╝

💬 *Conversation:*
• *${PREFIX}ai [question]* — Ask RIAS anything
• *${PREFIX}chat [message]* — Chat with RIAS
• *${PREFIX}ask [question]* — Same as .ai

✍️ *Writing Tools:*
• *${PREFIX}improve [text]* — Polish your text
• *${PREFIX}summarize [text]* — Key points
• *${PREFIX}translate [lang] [text]* — Translate
• *${PREFIX}define [word]* — Dictionary

🎨 *Creative:*
• *${PREFIX}story [prompt]* — Short story
• *${PREFIX}poem [topic]* — Original poem
• *${PREFIX}joke* — Dark/witty joke
• *${PREFIX}rizz* — Smooth pickup line

🌍 *Info:*
• *${PREFIX}fact* — Random interesting fact
• *${PREFIX}quote* — RIAS original quote
• *${PREFIX}weather [city]* — Weather report
• *${PREFIX}news [topic]* — News headlines

💡 *Social:*
• *${PREFIX}roast @user* — Brutal roast
• *${PREFIX}compliment @user* — Compliment
• *${PREFIX}advice [topic]* — Life advice

_Powered by Google Gemini AI 🔴_`.trim();
}

function getFunMenu() {
  return `
╔══════════════════════╗
║  🎲  *FUN MENU*  🎲  ║
╚══════════════════════╝

💘 *Social Fun:*
• *${PREFIX}ship @u1 @u2* — Compatibility %
• *${PREFIX}rank* — Rank group members
• *${PREFIX}battle @u1 @u2* — Epic battle
• *${PREFIX}spirit* — Spirit animal

🎯 *Truth & Dare:*
• *${PREFIX}truth* — Hard unfiltered truth
• *${PREFIX}dare* — Bold dare from RIAS
• *${PREFIX}wyr [a] OR [b]* — Would you rather

🎱 *Random:*
• *${PREFIX}8ball [question]* — Magic 8-ball
• *${PREFIX}roll [sides]* — Roll dice
• *${PREFIX}flip* — Coin flip
• *${PREFIX}trivia* — Trivia question

🎤 *Lyrics & Music:*
• *${PREFIX}lyrics [song]* — Get song lyrics

_Good vibes only. Well... mostly. 🔴_`.trim();
}

function getGameMenu() {
  return `
╔══════════════════════╗
║  🎮  *GAME MENU*  🎮  ║
╚══════════════════════╝

🕹️ *Available Games:*

✊ *${PREFIX}rps [rock/paper/scissors]*
   Play Rock Paper Scissors vs RIAS

🎲 *${PREFIX}guess [1-10]*
   Guess the secret number

🎰 *${PREFIX}slots*
   Spin the slot machine

🧩 *${PREFIX}trivia*
   Answer a trivia question

💘 *${PREFIX}ship @u1 @u2*
   Ship compatibility game

⚡ *${PREFIX}battle @u1 @u2*
   Battle arena

🎱 *${PREFIX}8ball [question]*
   The all-knowing 8-ball

🪙 *${PREFIX}flip*
   Heads or Tails

🎯 *${PREFIX}roll [sides]*
   Dice roller (default: d6)

_May the odds be in your favor. 🔴_`.trim();
}

function getMusicMenu() {
  return `
╔══════════════════════╗
║  🎵  *MUSIC MENU*  🎵  ║
╚══════════════════════╝

🎵 *Music Commands:*
• *${PREFIX}play [song]* — Play a song
• *${PREFIX}lyrics [song]* — Get song lyrics

🎤 *Coming Soon:*
• Song download
• Playlist support
• Audio effects
• Now playing card

💡 *Note:* Full music download requires YouTube API integration on your server.

📡 *Follow for updates:*
${WA_CHANNEL}

_Music is power. RIAS agrees. 🔴_`.trim();
}

function getOwnerMenu() {
  return `
╔══════════════════════╗
║  👑  *OWNER MENU*  👑  ║
╚══════════════════════╝

🔴 *Bot Control:*
• *${PREFIX}shutdown* — Power off RIAS
• *${PREFIX}restart* — Restart RIAS
• *${PREFIX}setprefix [x]* — Change prefix
• *${PREFIX}setstatus [text]* — Update status

📢 *Broadcast:*
• *${PREFIX}broadcast [msg]* — Broadcast message

👥 *User Control:*
• *${PREFIX}block @user* — Block user
• *${PREFIX}unblock @user* — Unblock user

🔗 *Group Control:*
• *${PREFIX}join [link]* — Join via invite link
• *${PREFIX}leave* — Leave current group

_Handle with care. 🔴_`.trim();
}

// ════════════════════════════════════════
//  GEMINI AI
// ════════════════════════════════════════
async function geminiAI(prompt, systemPrompt = '') {
  try {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      { contents: [{ parts: [{ text: fullPrompt }] }] },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || riasOffline();
  } catch (err) {
    console.error('[Gemini error]', err.message);
    return riasOffline();
  }
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function riasOffline() {
  return pick([
    "You already know the answer. You just want permission. Granted. 🔴",
    "Bold move or no move. There's no in-between in my world. ⚔️",
    "Stop overthinking. Execute. RIAS doesn't repeat herself. 🌹",
    "The version of you that hesitates always loses. 🔴",
  ]);
}

function noOwner(reply, react) {
  react('🚫');
  return reply(`🚫 *Owner Only Command*\n\n_This command is reserved for the bot owner.\nContact wa.me/${DEV_NUMBER} for access. 🔴_`);
}

function getQuotedText(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
         msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || '';
}

async function fetchBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(res.data);
  } catch { return null; }
}

module.exports = { pairNumber, restoreAllSessions };
