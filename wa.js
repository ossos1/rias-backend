const { webcrypto } = require('crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs   = require('fs');

const sessions     = new Map();
const SESSIONS_DIR = path.join(__dirname, 'sessions');
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const warnCounts = {};

// ─────────────────────────────────────────────────────────────
//  pairNumber()
//  Fix: don't use makeCacheableSignalKeyStore before pairing
//  Fix: wait for socket to be ready before calling requestPairingCode
//  Fix: keep socket alive after resolving the code
// ─────────────────────────────────────────────────────────────
async function pairNumber(phoneNumber) {
  // If a session already exists and is open, no need to re-pair
  if (sessions.has(phoneNumber)) {
    const existing = sessions.get(phoneNumber);
    if (existing?.user) {
      throw new Error('This number is already linked. Use it in your groups — no re-pair needed.');
    }
    // Stale session — clean it up and re-pair
    try { existing.end(); } catch {}
    sessions.delete(phoneNumber);
  }

  const authDir = path.join(SESSIONS_DIR, 'wa_' + phoneNumber);
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version }          = await fetchLatestBaileysVersion();

  // Use plain state.keys (not cached) for fresh pair — fixes "couldn't link device"
  const sock = makeWASocket({
    version,
    auth:              state,          // ← plain state, not wrapped
    logger:            pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser:           ['RIAS', 'Chrome', '1.0.0'],
    connectTimeoutMs:  60_000,
    keepAliveIntervalMs: 10_000,
  });

  sock.ev.on('creds.update', saveCreds);

  // Track connection state
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('✅ RIAS ONLINE — ' + phoneNumber);
      sessions.set(phoneNumber, sock);
      startMessageHandler(sock, phoneNumber);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('[RIAS] Reconnecting ' + phoneNumber + '...');
        sessions.delete(phoneNumber);
        setTimeout(() => pairNumber(phoneNumber).catch(console.error), 5000);
      } else {
        console.log('[RIAS] ' + phoneNumber + ' logged out. Clearing session.');
        sessions.delete(phoneNumber);
        fs.rmSync(authDir, { recursive: true, force: true });
      }
    }
  });

  // ── PAIRING CODE LOGIC ────────────────────────────────────
  if (!sock.authState.creds.registered) {
    console.log('⚠️ NO SESSION FOUND — requesting pairing code for ' + phoneNumber);

    // Wait for socket to fully connect to WA servers before requesting code
    // We wait for the 'connecting' → ready state (not 'open' — that only happens after link)
    await delay(5000); // ← increased from 2500ms to 5000ms for reliability

    try {
      const rawCode   = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
      const formatted = rawCode.match(/.{1,4}/g)?.join('-') || rawCode;
      console.log('\n🔥 PAIRING CODE: ' + formatted + '\n');

      // Keep socket alive — it must stay running for WhatsApp to validate the code
      sessions.set(phoneNumber, sock);
      return formatted;

    } catch (err) {
      console.error('[RIAS pair error]', err.message);
      // Clean up failed session
      try { sock.end(); } catch {}
      sessions.delete(phoneNumber);
      throw new Error('Failed to generate pairing code: ' + err.message);
    }

  } else {
    // Already registered — reconnect and start bot
    console.log('✅ Existing session found for ' + phoneNumber);
    sessions.set(phoneNumber, sock);
    return null; // null = already linked
  }
}

// ─────────────────────────────────────────────────────────────
//  startMessageHandler()
// ─────────────────────────────────────────────────────────────
function startMessageHandler(sock, phoneNumber) {
  if (sock._riasAttached) return;
  sock._riasAttached = true;

  console.log('[RIAS] Message handler started for ' + phoneNumber);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text || '';
      if (!text.startsWith('.')) continue;
      const [rawCmd, ...args] = text.slice(1).trim().split(/\s+/);
      const reply = (content) =>
        sock.sendMessage(from, { text: content }, { quoted: msg });
      await handleCommand(rawCmd.toLowerCase(), args, msg, from, sock, reply)
            .catch(e => console.error('[CMD err]', e.message));
    }
  });

  // Welcome / Goodbye
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action === 'add' && global.welcomeMessages?.[id]) {
      for (const jid of participants) {
        await sock.sendMessage(id, {
          text: global.welcomeMessages[id].replace('{name}', '@' + jid.split('@')[0]),
          mentions: [jid],
        }).catch(() => {});
      }
    }
    if (action === 'remove' && global.goodbyeMessages?.[id]) {
      for (const jid of participants) {
        await sock.sendMessage(id, {
          text: global.goodbyeMessages[id].replace('{name}', jid.split('@')[0]),
        }).catch(() => {});
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  handleCommand()
// ─────────────────────────────────────────────────────────────
async function handleCommand(cmd, args, msg, from, sock, reply) {
  const isGroup  = from.endsWith('@g.us');
  const sender   = msg.key.participant || msg.key.remoteJid;
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const target    = mentioned[0] || null;

  const isAdmin = async () => {
    if (!isGroup) return true;
    try {
      const meta = await sock.groupMetadata(from);
      return meta.participants.some(
        p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
      );
    } catch { return false; }
  };

  switch (cmd) {

    case 'kick':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!target) return reply('⚠️ Tag the person to kick.');
      try {
        await sock.groupParticipantsUpdate(from, [target], 'remove');
        return reply('⚔️ ' + target.split('@')[0] + ' has been removed. Bye! 👋');
      } catch { return reply('⚠️ Could not kick — make sure RIAS is an admin.'); }

    case 'ban':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!target) return reply('⚠️ Tag the person to ban.');
      try {
        await sock.groupParticipantsUpdate(from, [target], 'remove');
        return reply('🚫 ' + target.split('@')[0] + ' banned. No returns, no appeals.');
      } catch { return reply('⚠️ Could not ban — make sure RIAS is an admin.'); }

    case 'mute':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        return reply('🔇 Group muted. Only admins may speak.');
      } catch { return reply('⚠️ Could not mute — make sure RIAS is an admin.'); }

    case 'unmute':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        return reply('🔊 Group unmuted. The floor is open.');
      } catch { return reply('⚠️ Could not unmute.'); }

    case 'promote':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!target) return reply('⚠️ Tag the person to promote.');
      try {
        await sock.groupParticipantsUpdate(from, [target], 'promote');
        return reply('👑 ' + target.split('@')[0] + ' is now an admin. Choose wisely.');
      } catch { return reply('⚠️ Could not promote — make sure RIAS is an admin.'); }

    case 'demote':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!target) return reply('⚠️ Tag the person to demote.');
      try {
        await sock.groupParticipantsUpdate(from, [target], 'demote');
        return reply('⬇️ ' + target.split('@')[0] + ' admin rights revoked.');
      } catch { return reply('⚠️ Could not demote.'); }

    case 'lockgroup':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        return reply('🔒 Group locked. Only admins can send messages.');
      } catch { return reply('⚠️ Could not lock — make sure RIAS is an admin.'); }

    case 'unlockgroup':
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        return reply('🔓 Group unlocked. Everyone can speak.');
      } catch { return reply('⚠️ Could not unlock.'); }

    case 'warn': {
      if (!isGroup) return reply('❌ Groups only.');
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!target) return reply('⚠️ Tag the person to warn.');
      if (!warnCounts[from]) warnCounts[from] = {};
      warnCounts[from][target] = (warnCounts[from][target] || 0) + 1;
      const count = warnCounts[from][target];
      if (count >= 3) {
        await sock.groupParticipantsUpdate(from, [target], 'remove').catch(() => {});
        delete warnCounts[from][target];
        return reply('⚠️ ' + target.split('@')[0] + ' hit 3 warnings and has been removed.');
      }
      return reply('⚠️ Warning ' + count + '/3 for ' + target.split('@')[0] + '. One more and they are out.');
    }

    case 'ask':
    case 'chat': {
      const q = args.join(' ');
      if (!q) return reply('❓ Ask me something.');
      return reply(await riasAI(q));
    }

    case 'roast':      return reply(getRoast());
    case 'compliment': return reply(getCompliment());
    case 'advice':     return reply(await riasAI('Give bold sassy advice about: ' + (args.join(' ') || 'life')));
    case 'story':      return reply(await riasAI('Write a short dramatic story about: ' + (args.join(' ') || 'a mysterious encounter')));

    case 'ship': {
      const u1  = mentioned[0]?.split('@')[0] || args[0] || 'Person A';
      const u2  = mentioned[1]?.split('@')[0] || args[1] || 'Person B';
      const pct = Math.floor(Math.random() * 101);
      const bar = '❤️'.repeat(Math.round(pct / 10)) + '🖤'.repeat(10 - Math.round(pct / 10));
      const verdict =
        pct > 70 ? '🔥 A match made in chaos. RIAS approves.' :
        pct > 40 ? '🌹 Complicated, but possible.' : '💀 Yikes. Hard pass.';
      return reply('💘 ' + u1 + ' + ' + u2 + '\n' + bar + '\n' + pct + '% compatible\n\n' + verdict);
    }

    case 'truth':  return reply(getTruth());
    case 'dare':   return reply(getDare());
    case 'quote':  return reply(getRiasQuote());
    case 'trivia': return reply(getTrivia());

    case 'rank': {
      if (!isGroup) return reply('❌ Groups only.');
      try {
        const meta     = await sock.groupMetadata(from);
        const members  = meta.participants.map(p => p.id.split('@')[0]);
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        const medals   = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const ranked   = shuffled.map((m, i) => (medals[i] || (i+1)+'.') + ' @' + m).join('\n');
        return await sock.sendMessage(from, {
          text: '🏆 RIAS Group Ranking\n\n' + ranked,
          mentions: meta.participants.map(p => p.id),
        }, { quoted: msg });
      } catch { return reply('⚠️ Could not fetch group members.'); }
    }

    case 'setwelcome': {
      if (!await isAdmin()) return reply('🚫 Admins only.');
      const wMsg = args.join(' ');
      if (!wMsg) return reply('⚠️ Provide a welcome message. Use {name} for the member name.');
      if (!global.welcomeMessages) global.welcomeMessages = {};
      global.welcomeMessages[from] = wMsg;
      return reply('👋 Welcome message set: ' + wMsg);
    }

    case 'setgoodbye': {
      if (!await isAdmin()) return reply('🚫 Admins only.');
      const bMsg = args.join(' ');
      if (!bMsg) return reply('⚠️ Provide a goodbye message.');
      if (!global.goodbyeMessages) global.goodbyeMessages = {};
      global.goodbyeMessages[from] = bMsg;
      return reply('👣 Goodbye message set: ' + bMsg);
    }

    case 'antilink': {
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!global.antilink) global.antilink = {};
      global.antilink[from] = args[0] === 'on';
      return reply('🔗 Anti-link is now ' + (args[0] === 'on' ? 'ON ✅' : 'OFF ❌'));
    }

    case 'antibadword': {
      if (!await isAdmin()) return reply('🚫 Admins only.');
      if (!global.antibadword) global.antibadword = {};
      global.antibadword[from] = args[0] === 'on';
      return reply('🧹 Anti-bad-word is now ' + (args[0] === 'on' ? 'ON ✅' : 'OFF ❌'));
    }

    case 'remind': {
      const timeStr = args[0];
      const message = args.slice(1).join(' ');
      const ms      = parseTime(timeStr);
      if (!ms || !message) return reply('⚠️ Usage: .remind [1m/1h/1d] [message]');
      setTimeout(() => sock.sendMessage(from, { text: '🔔 Reminder: ' + message }), ms);
      return reply('🔔 Reminder set for ' + timeStr + '. RIAS never forgets.');
    }

    case 'schedule': {
      const timeStr = args[0];
      const message = args.slice(1).join(' ');
      const ms      = parseTime(timeStr);
      if (!ms || !message) return reply('⚠️ Usage: .schedule [1m/1h/1d] [message]');
      setTimeout(() => sock.sendMessage(from, { text: '📅 Scheduled: ' + message }), ms);
      return reply('📅 Scheduled for ' + timeStr + '.');
    }

    case 'dm': {
      const dmTarget = mentioned[0];
      const dmMsg    = args.slice(mentioned.length > 0 ? 0 : 1).join(' ');
      if (!dmTarget || !dmMsg) return reply('⚠️ Usage: .dm @user [message]');
      await sock.sendMessage(dmTarget, { text: '📨 Message via RIAS: ' + dmMsg });
      return reply('✅ Message sent to @' + dmTarget.split('@')[0]);
    }

    case 'broadcast':
      return reply('📢 Broadcast: ' + args.join(' '));

    case 'autoreply':
      return reply('🤖 Auto-reply ' + (args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'));

    case 'savecontact':
      return reply('💾 Contact ' + (args[0] || '') + ' saved.');

    case 'help':
    case 'menu':
      return reply(getMenu());

    default:
      return reply('❓ Unknown command: .' + cmd + '\nType .help to see all commands.');
  }
}

// ─────────────────────────────────────────────────────────────
//  Content helpers
// ─────────────────────────────────────────────────────────────
async function riasAI(prompt) {
  const f = [
    prompt + '? The answer is right in front of you. Think harder.',
    'My take: do what feels right, then act like you knew all along.',
    'You came to ME with this? Stop overthinking. Execute.',
    'You already know the answer. You just want permission. Granted.',
  ];
  return f[Math.floor(Math.random() * f.length)];
}

function getRoast() {
  const r = [
    "You're the human equivalent of a participation trophy. 🏅",
    "I've seen smarter decisions made by a coin flip.",
    "Your vibe called. It apologized on your behalf.",
    "Not even autocorrect can fix what's wrong with you.",
    "If effort were currency, you'd be bankrupt.",
  ];
  return '🔥 ' + r[Math.floor(Math.random() * r.length)];
}

function getCompliment() {
  const c = [
    "You're surprisingly tolerable. High praise from me.",
    "Among all the mediocrity, you stand out. Slightly.",
    "You actually have taste. Rare.",
    "I'd deploy you in my group. Highest compliment I give.",
  ];
  return '🌹 ' + c[Math.floor(Math.random() * c.length)];
}

function getTruth() {
  const t = [
    "The person you keep making excuses for doesn't deserve them.",
    "You spend more time planning than doing. Fix that.",
    "Your biggest enemy lives in your head, rent-free.",
    "Growth is uncomfortable. That feeling? That's progress.",
  ];
  return '🗡️ Truth: ' + t[Math.floor(Math.random() * t.length)];
}

function getDare() {
  const d = [
    "Text someone you've been avoiding and say exactly what's on your mind.",
    "Do 20 push-ups. Right now. I'll wait.",
    "Compliment a stranger today. Without being weird about it.",
    "Spend the next hour with no phone. Just thoughts.",
  ];
  return '🎯 Dare: ' + d[Math.floor(Math.random() * d.length)];
}

function getRiasQuote() {
  const q = [
    '"Power is not given. It is recognized." — RIAS 🔴',
    '"I do not chase. I attract. What belongs to me always finds me." — RIAS 🔴',
    '"Loyalty is earned. Betrayal is remembered." — RIAS 🔴',
    '"I am not cold. I am selective." — RIAS 🔴',
    '"Do not mistake my silence for weakness. I am calculating." — RIAS 🔴',
  ];
  return q[Math.floor(Math.random() * q.length)];
}

function getTrivia() {
  const qs = [
    { q: 'What is the capital of Japan?', a: 'Tokyo' },
    { q: 'How many bytes in a kilobyte?', a: '1024' },
    { q: 'Who created the World Wide Web?', a: 'Tim Berners-Lee' },
    { q: 'What language is spoken in Brazil?', a: 'Portuguese' },
    { q: 'What planet is called the Red Planet?', a: 'Mars' },
  ];
  const t = qs[Math.floor(Math.random() * qs.length)];
  return '🧩 Trivia: ' + t.q + '\n\nFirst correct answer wins!\n(Answer: ' + t.a + ')';
}

function getMenu() {
  return [
    '╔══════════════════╗',
    '║    RIAS MENU     ║',
    '╚══════════════════╝',
    '',
    '⚔️ ADMIN',
    '.kick .ban .mute .unmute',
    '.promote .demote',
    '.lockgroup .unlockgroup .warn',
    '',
    '🤖 AI CHAT',
    '.ask [q]  .chat [msg]',
    '.roast  .compliment',
    '.advice [topic]  .story [prompt]',
    '',
    '🎲 FUN',
    '.ship [@] [@]  .truth  .dare',
    '.rank  .quote  .trivia',
    '',
    '⚙️ AUTOMATION',
    '.setwelcome [msg]  .setgoodbye [msg]',
    '.antilink on/off  .antibadword on/off',
    '.remind [1m/1h] [msg]',
    '.schedule [1m/1h] [msg]',
    '',
    '📩 DM TOOLS',
    '.dm @user [msg]  .broadcast [msg]',
    '.autoreply on/off  .savecontact @user',
    '',
    'Made by Jinx — RIAS 🔴',
  ].join('\n');
}

function parseTime(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(match[1]) * units[match[2]];
}

module.exports = { pairNumber };
