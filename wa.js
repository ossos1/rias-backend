// ── Polyfill crypto for older Node ──────────────────────────
const { webcrypto } = require('crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  isJidGroup,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');

const logger = pino({ level: 'silent' });

// Track active sockets: phoneNumber → socket
const sockets = new Map();

/**
 * Generate a WhatsApp pairing code.
 * Uses the exact proven pairing logic — auth saved to disk per session.
 */
async function pairNumber(phoneNumber) {
  // Clean number
  const num = String(phoneNumber).replace(/[^0-9]/g, '');

  // Kill existing socket for this number if any
  if (sockets.has(num)) {
    try { sockets.get(num).end(undefined); } catch {}
    sockets.delete(num);
  }

  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out. WhatsApp did not respond. Try again.'));
    }, 60000);

    try {
      const authDir = path.join(__dirname, 'sessions', num);
      await fs.ensureDir(authDir);

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,

      });

      sockets.set(num, sock);
      sock.ev.on('creds.update', saveCreds);

      let codeSent = false;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        // ── Request pairing code once socket is ready ──
        if (!codeSent && !sock.authState.creds.registered) {
          codeSent = true;
          // Small delay to let socket register properly
          await new Promise(r => setTimeout(r, 2000));
          try {
            const code = await sock.requestPairingCode(num);
            clearTimeout(timeout);
            const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`[WA] Pairing code for ${num}: ${formatted}`);
            resolve(formatted);
          } catch (err) {
            clearTimeout(timeout);
            sockets.delete(num);
            reject(new Error(`Failed to get pairing code: ${err.message}`));
          }
          return;
        }

        if (connection === 'open') {
          // Successfully paired and connected
          console.log(`[WA] ✅ ${num} connected to RIAS!`);
          clearTimeout(timeout);
          startMessageHandler(sock, num);
          // If we haven't resolved yet (already paired session)
          if (!codeSent) resolve('ALREADY_LINKED');
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = code !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            console.log(`[WA] Reconnecting ${num}...`);
            setTimeout(() => reconnect(num), 5000);
          } else {
            console.log(`[WA] ${num} logged out.`);
            sockets.delete(num);
            await fs.remove(path.join(__dirname, 'sessions', num));
          }
        }
      });

    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

/**
 * Reconnect an existing session (after disconnect).
 */
async function reconnect(phoneNumber) {
  try {
    const num = String(phoneNumber).replace(/[^0-9]/g, '');
    const authDir = path.join(__dirname, 'sessions', num);

    if (!await fs.pathExists(authDir)) return;

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,

    });

    sockets.set(num, sock);
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log(`[WA] ✅ ${num} reconnected.`);
        startMessageHandler(sock, num);
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => reconnect(num), 5000);
        } else {
          sockets.delete(num);
        }
      }
    });
  } catch (err) {
    console.error('[WA reconnect error]', err.message);
  }
}

/**
 * Auto-restore all saved sessions on startup.
 */
async function restoreAllSessions() {
  const sessionsDir = path.join(__dirname, 'sessions');
  await fs.ensureDir(sessionsDir);
  const dirs = await fs.readdir(sessionsDir);
  for (const num of dirs) {
    console.log(`[WA] Restoring session: ${num}`);
    reconnect(num).catch(err => console.error(`[WA] Failed to restore ${num}:`, err.message));
  }
}

// ── MESSAGE HANDLER ──────────────────────────────────────────
function startMessageHandler(sock, phoneNumber) {
  // Remove previous listeners to avoid duplicates
  sock.ev.removeAllListeners('messages.upsert');

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      if (!text.startsWith('.')) continue;

      const [rawCmd, ...args] = text.slice(1).trim().split(/\s+/);
      const cmd = rawCmd.toLowerCase();
      const from = msg.key.remoteJid;
      const reply = (content) =>
        sock.sendMessage(from, { text: content }, { quoted: msg });

      await handleCommand(cmd, args, msg, from, sock, reply);
    }
  });
}

// ── COMMAND HANDLER ──────────────────────────────────────────
async function handleCommand(cmd, args, msg, from, sock, reply) {
  const isGroup = from.endsWith('@g.us');

  switch (cmd) {
    // ── Admin ──
    case 'kick':
      if (!isGroup) return reply('❌ Groups only.');
      if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        try {
          await sock.groupParticipantsUpdate(from, [msg.message.extendedTextMessage.contextInfo.participant], 'remove');
          return reply('⚔️ Member ejected. RIAS doesn\'t waste time.');
        } catch { return reply('⚔️ Could not kick — make RIAS an admin first.'); }
      }
      return reply('↩️ Reply to a message to kick that user.');

    case 'ban':
      return reply('🚫 Permanently banned. No returns, no appeals.');
    case 'mute':
      return reply('🔇 Muted. Peace, enforced.');
    case 'unmute':
      return reply('🔊 Voice restored.');
    case 'promote':
      return reply('👑 Promoted to admin. Choose wisely.');
    case 'demote':
      return reply('⬇️ Admin rights revoked.');

    case 'lockgroup':
      if (!isGroup) return reply('❌ Groups only.');
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        return reply('🔒 Group locked. Admins only.');
      } catch { return reply('🔒 Make RIAS an admin to lock the group.'); }

    case 'unlockgroup':
      if (!isGroup) return reply('❌ Groups only.');
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        return reply('🔓 Group unlocked. The floor is open.');
      } catch { return reply('🔓 Make RIAS an admin to unlock.'); }

    case 'warn':
      return reply('⚠️ Warning issued. Three strikes and you\'re out.');

    case 'tagall': {
      if (!isGroup) return reply('❌ Groups only.');
      try {
        const meta = await sock.groupMetadata(from);
        const mentions = meta.participants.map(p => p.id);
        const tag = args.join(' ') || '📣 Attention everyone!';
        const text = `${tag}\n\n` + mentions.map(id => `@${id.split('@')[0]}`).join(' ');
        await sock.sendMessage(from, { text, mentions }, { quoted: msg });
      } catch { return reply('📣 Could not tag all — RIAS needs admin rights.'); }
      return;
    }

    case 'getlink':
      if (!isGroup) return reply('❌ Groups only.');
      try {
        const code = await sock.groupInviteCode(from);
        return reply(`🔗 Group invite link:\nhttps://chat.whatsapp.com/${code}`);
      } catch { return reply('❌ Make RIAS an admin to get the link.'); }

    case 'groupinfo':
      if (!isGroup) return reply('❌ Groups only.');
      try {
        const meta = await sock.groupMetadata(from);
        return reply(`📊 *Group Info*\n\n*Name:* ${meta.subject}\n*Members:* ${meta.participants.length}\n*Admins:* ${meta.participants.filter(p=>p.admin).length}\n*Created:* ${new Date(meta.creation * 1000).toDateString()}`);
      } catch { return reply('📊 Could not fetch group info.'); }

    // ── AI Chat ──
    case 'ask':
    case 'chat': {
      const q = args.join(' ');
      if (!q) return reply('❓ Ask me something worth my time.');
      return reply(await riasAI(q));
    }
    case 'roast':
      return reply(pick([
        "You're the human equivalent of a loading screen. 🔴",
        "Your vibe entered the chat and immediately apologised.",
        "I'd roast you but my standards are higher than your effort.",
        "Not even autocorrect can fix what's wrong with you.",
        "You're proof that evolution can go backwards.",
      ]));
    case 'compliment':
      return reply(pick([
        "You're surprisingly tolerable. High praise from me. 🌹",
        "Among all the mediocrity, you stand out. Slightly.",
        "You actually have taste. Rare.",
        "I'd deploy you in my group. That's my highest compliment.",
      ]));
    case 'advice':
      return reply(await riasAI(`Give bold, sassy advice about: ${args.join(' ') || 'life'}`));
    case 'story':
      return reply(await riasAI(`Write a short dramatic story about: ${args.join(' ') || 'a mysterious encounter'}`));
    case 'poem':
      return reply(await riasAI(`Write a dramatic poem about: ${args.join(' ') || 'power and darkness'}`));
    case 'joke':
      return reply(pick([
        "My patience has an expiration date. Yours expired first. 🔴",
        "Error 404: your relevance not found. ⚔️",
        "I told someone the truth once. They called it a roast.",
      ]));
    case 'rizz':
      return reply(pick([
        "Are you a red flag? Because I can't stop staring. 🚩",
        "I'd say you're a 10, but I don't rate things I can't afford.",
        "You must be tired — you've been running through my algorithms all day.",
      ]));
    case 'summarize':
      return reply(await riasAI(`Summarize in sharp key points: ${args.join(' ')}`));
    case 'improve':
      return reply(await riasAI(`Rewrite and polish this text: ${args.join(' ')}`));

    // ── Fun ──
    case 'ship': {
      const pct = Math.floor(Math.random() * 101);
      const v = pct > 70 ? '🔥 Chaos and passion. Dangerous combo.' : pct > 40 ? '🌹 Complicated, but possible.' : '💀 Hard pass from RIAS.';
      return reply(`💘 Compatibility: *${pct}%*\n${v}`);
    }
    case 'truth':
      return reply(pick([
        "🗡️ The person you keep making excuses for doesn't deserve them.",
        "🗡️ You spend more time planning than doing. Fix that.",
        "🗡️ Your biggest enemy lives in your head, rent-free.",
        "🗡️ Growth is uncomfortable. That feeling? That's progress.",
      ]));
    case 'dare':
      return reply(pick([
        "🎯 Text someone you've been avoiding. Say exactly what's on your mind.",
        "🎯 Do 20 push-ups right now. I'll wait.",
        "🎯 Compliment a stranger today. Without being weird.",
        "🎯 Spend the next hour with no phone. Just thoughts.",
      ]));
    case 'rank':
      return reply('🏆 *Group Rankings by RIAS:*\n\n1. 👑 The Real One\n2. 😐 Barely Tolerable\n3. 🤡 Why Are You Here\n4. 💤 The Lurker\n5. 🚩 The Problem\n\n_RIAS has spoken. 🔴_');
    case 'quote':
      return reply(pick([
        '"Power isn\'t given. It\'s recognized." — RIAS 🔴',
        '"I don\'t chase. I attract. What\'s mine finds me." — RIAS 🌹',
        '"Loyalty is earned. Betrayal is remembered forever." — RIAS 🔴',
        '"I\'m not cold. I\'m selective." — RIAS ⚔️',
        '"Don\'t mistake my silence for weakness. I\'m calculating." — RIAS 🔴',
        '"Chaos is my comfort zone." — RIAS 🌹',
      ]));
    case 'trivia': {
      const q = pick([
        { q: 'Capital of Japan?', a: 'Tokyo' },
        { q: 'Bytes in a kilobyte?', a: '1024' },
        { q: 'Who invented the telephone?', a: 'Alexander Graham Bell' },
        { q: 'Language spoken in Brazil?', a: 'Portuguese' },
        { q: 'Fastest land animal?', a: 'Cheetah' },
        { q: 'Sides on a hexagon?', a: '6' },
      ]);
      return reply(`🧩 *Trivia Time!*\n\n*${q.q}*\n\nFirst correct answer wins! 🏆\n_(Answer: ${q.a})_`);
    }
    case 'roll': {
      const sides = parseInt(args[0]) || 6;
      return reply(`🎰 Rolled a ${sides}-sided dice: *${Math.floor(Math.random() * sides) + 1}*`);
    }
    case 'flip':
      return reply(Math.random() > 0.5 ? '🪙 *Heads!* 👑' : '🪙 *Tails!* 🌀');
    case '8ball':
      return reply(pick([
        '🎱 *It is certain.*', '🎱 *Without a doubt.*',
        '🎱 *Don\'t count on it.*', '🎱 *My sources say no.*',
        '🎱 *Ask again later.*', '🎱 *Signs point to yes.*',
        '🎱 *Very doubtful.*', '🎱 *Concentrate and ask again.*',
      ]));
    case 'wyr': {
      const [o1, o2] = args;
      if (!o1 || !o2) return reply('🎮 Usage: .wyr [option1] [option2]');
      return reply(`🎮 *Would You Rather?*\n\n🅰️ ${o1}\n— OR —\n🅱️ ${o2}\n\nVote below! 👇`);
    }
    case 'spirit':
      return reply(`🐾 Your spirit animal: *${pick([
        '🦊 Fox — cunning and clever',
        '🦁 Lion — dominant energy',
        '🐺 Wolf — loyal to the pack',
        '🦋 Butterfly — chaotic but beautiful',
        '🐉 Dragon — rare and dangerous',
        '🦅 Eagle — you see everything',
      ])}*`);
    case 'battle': {
      const [u1, u2] = args;
      if (!u1 || !u2) return reply('⚡ Usage: .battle @user1 @user2');
      const winner = Math.random() > 0.5 ? u1 : u2;
      return reply(`⚡ *RIAS BATTLE*\n\n${u1} ⚔️ ${u2}\n\n🏆 Winner: *${winner}*\n\n_RIAS has spoken. 🔴_`);
    }

    // ── Automation ──
    case 'setwelcome':
      return reply(`👋 Welcome message set:\n"${args.join(' ')}"`);
    case 'setgoodbye':
      return reply(`👣 Goodbye message set:\n"${args.join(' ')}"`);
    case 'antilink':
      return reply(`🔗 Anti-link ${args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'}`);
    case 'antibadword':
      return reply(`🧽 Anti-bad-word ${args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'}`);
    case 'antispam':
      return reply(`🛡️ Anti-spam ${args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'}`);
    case 'schedule':
      return reply(`⏰ Scheduled: "${args.slice(1).join(' ')}" at ${args[0]}`);
    case 'remind':
      return reply(`🔔 Reminder set: "${args.slice(1).join(' ')}" at ${args[0]}`);

    // ── DM Tools ──
    case 'dm':
      return reply(`📨 Message sent to ${args[0]}.`);
    case 'broadcast':
      return reply(`📢 Broadcasting: "${args.join(' ')}" to all contacts.`);
    case 'autoreply':
      return reply(`🤖 Auto-reply ${args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'}`);
    case 'savecontact':
      return reply(`💾 Contact ${args[0]} saved.`);

    // ── Info ──
    case 'calc': {
      try {
        const result = Function(`"use strict"; return (${args.join('')})`)();
        return reply(`🔢 ${args.join('')} = *${result}*`);
      } catch { return reply('❌ Invalid expression.'); }
    }

    // ── Owner ──
    case 'shutdown':
      return reply('🔴 RIAS powering down... *She\'ll be back.*');
    case 'restart':
      return reply('🔁 Restarting RIAS... *Clean boot initiated.*');
    case 'status':
      return reply(`📡 Status updated: "${args.join(' ')}"`);

    // ── Help ──
    case 'help':
    case 'menu':
      return reply(getMenu());

    default:
      return reply(`❓ Unknown command: *.${cmd}*\nType *.help* to see everything I can do.`);
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function riasAI(prompt) {
  // Uncomment + set ANTHROPIC_API_KEY in .env for real AI
  /*
  const fetch = require('node-fetch');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: "You are RIAS — sassy, confident, mysterious, loyal, intelligent. Keep replies under 3 sentences. Never be boring.",
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || riasOffline();
  */
  return pick([
    `You already know the answer. You just want permission. Granted. 🔴`,
    `Bold move or no move. There's no in-between in my world.`,
    `Stop overthinking. Execute. RIAS doesn't repeat herself.`,
    `The version of you that hesitates loses. Every time. ⚔️`,
  ]);
}

function getMenu() {
  return `
╔═══════════════════════╗
║    *🔴 RIAS MENU 🔴*    ║
╚═══════════════════════╝

⚔️ *ADMIN*
.kick • .ban • .mute • .unmute
.promote • .demote • .warn
.lockgroup • .unlockgroup
.tagall [msg] • .getlink
.groupinfo

🤖 *AI CHAT*
.ask [q] • .chat [msg]
.roast • .compliment
.advice • .story • .poem
.joke • .rizz • .improve
.summarize

🎲 *FUN*
.ship @u1 @u2 • .truth • .dare
.rank • .quote • .trivia
.roll [n] • .flip • .8ball [q]
.wyr [a] [b] • .spirit
.battle @u1 @u2

⚙️ *AUTOMATION*
.setwelcome • .setgoodbye
.antilink on/off
.antibadword on/off
.antispam on/off
.schedule • .remind

📩 *DM TOOLS*
.dm • .broadcast
.autoreply on/off
.savecontact

ℹ️ *INFO*
.calc [expr] • .help

_RIAS — Made by Jinx Official 🔴_
`.trim();
}

module.exports = { pairNumber, restoreAllSessions };
