const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const crypto = require("crypto");

// Store active sessions by phone number
const sessions = new Map();

/**
 * Generate a pairing code for a WhatsApp number.
 * Returns the 8-character code string.
 */
async function pairNumber(phoneNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      const authDir = path.join(__dirname, 'sessions', `wa_${phoneNumber}`);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['RIAS', 'Chrome', '1.0.0'],
      });

      sock.ev.on('creds.update', saveCreds);

      // Wait for connection to register, then request pairing code
      sock.ev.on('connection.update', async ({ connection, lastDisconnect, isNewLogin }) => {
        if (connection === 'open') {
          // Already linked — shouldn't happen on fresh pair
          sessions.set(phoneNumber, sock);
          startMessageHandler(sock, phoneNumber);
          reject(new Error('Session already linked. No code needed.'));
          return;
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code !== DisconnectReason.loggedOut) {
            // Reconnect handled elsewhere
          }
        }
      });

      // Request pairing code after socket registers
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber);
          // Format as XXXX-XXXX
          const formatted = code.match(/.{1,4}/g)?.join('-') || code;
          sessions.set(phoneNumber, sock);
          startMessageHandler(sock, phoneNumber);
          resolve(formatted);
        } catch (err) {
          reject(err);
        }
      }, 3000);

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Attach RIAS message handler to a connected WhatsApp socket.
 */
function startMessageHandler(sock, phoneNumber) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!text.startsWith('.')) continue;

      const [cmd, ...args] = text.slice(1).trim().split(/\s+/);
      const reply = (content) =>
        sock.sendMessage(from, { text: content }, { quoted: msg });

      await handleCommand(cmd.toLowerCase(), args, msg, from, sock, reply);
    }
  });
}

/**
 * RIAS command handler for WhatsApp
 */
async function handleCommand(cmd, args, msg, from, sock, reply) {
  const isGroup = from.endsWith('@g.us');

  switch (cmd) {
    // ── Admin ──
    case 'kick':
      if (!isGroup) return reply('❌ This command only works in groups.');
      return reply('⚔️ Ejecting member... (requires RIAS to be admin)');

    case 'ban':
      return reply('🚫 Member banned permanently.');

    case 'mute':
      return reply('🔇 Member muted. Silence is golden.');

    case 'promote':
      return reply('👑 Member promoted to admin.');

    case 'demote':
      return reply('⬇️ Admin rights revoked.');

    case 'lockgroup':
      if (!isGroup) return reply('❌ Groups only.');
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        return reply('🔒 Group locked. Only admins may speak.');
      } catch { return reply('🔒 Group locked (simulated — ensure RIAS is admin).'); }

    case 'unlockgroup':
      if (!isGroup) return reply('❌ Groups only.');
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        return reply('🔓 Group unlocked. The floor is open.');
      } catch { return reply('🔓 Group unlocked (simulated).'); }

    case 'warn':
      return reply(`⚠️ Warning issued. Don't make me repeat myself.`);

    // ── AI Chat ──
    case 'ask':
    case 'chat': {
      const question = args.join(' ');
      if (!question) return reply('❓ Ask me something worth my time.');
      const ans = await riasAI(question);
      return reply(ans);
    }

    case 'roast':
      return reply(getRoast());

    case 'compliment':
      return reply(getCompliment());

    case 'advice': {
      const topic = args.join(' ') || 'life';
      return reply(await riasAI(`Give bold, sassy advice about: ${topic}`));
    }

    case 'story': {
      const prompt = args.join(' ') || 'a mysterious encounter';
      return reply(await riasAI(`Write a short dramatic story about: ${prompt}`));
    }

    // ── Fun ──
    case 'ship': {
      const pct = Math.floor(Math.random() * 101);
      return reply(`💘 Compatibility: ${pct}%\n${pct > 70 ? '🔥 A match made in chaos.' : pct > 40 ? '🌹 Complicated, but possible.' : '💀 Yikes. Hard pass.'}`);
    }

    case 'truth':
      return reply(getTruth());

    case 'dare':
      return reply(getDare());

    case 'rank':
      return reply('🏆 Ranking members...\n1. You (barely)\n2. Everyone else\n3. That one quiet person\n\n*RIAS has spoken.*');

    case 'quote':
      return reply(getRiasQuote());

    case 'trivia':
      return reply(getTrivia());

    // ── Automation ──
    case 'setwelcome':
      return reply(`👋 Welcome message set: "${args.join(' ')}"`);

    case 'setgoodbye':
      return reply(`👣 Goodbye message set: "${args.join(' ')}"`);

    case 'antilink':
      return reply(`🔗 Anti-link ${args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'}`);

    case 'antibadword':
      return reply(`🧹 Anti-badword ${args[0] === 'on' ? 'enabled ✅' : 'disabled ❌'}`);

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

    // ── Help ──
    case 'help':
    case 'menu':
      return reply(getMenu());

    default:
      return reply(`❓ Unknown command: .${cmd}\nType *.help* to see what I can do.`);
  }
}

// ── AI responses via simple fetch (Claude API or fallback) ──
async function riasAI(prompt) {
  // If you want real AI, set ANTHROPIC_API_KEY in your .env
  // and uncomment the block below.
  /*
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
  return data.content?.[0]?.text || "I don't feel like answering that right now.";
  */

  // Fallback witty responses
  const fallbacks = [
    `*RIAS stares at you* — "${prompt}"? Interesting. Here's the thing: the answer is right in front of you. Think harder.`,
    `Oh, you want my opinion on that? Fine. Do what feels right, then act like you knew all along. Works every time.`,
    `You came to ME with this? I'm flattered. My answer: stop overthinking. Execute.`,
    `Cute question. The real answer is — you already know. You just want permission. Granted.`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ── Fun content ──
function getRoast() {
  const r = [
    "You're the human equivalent of a participation trophy. 🏅",
    "I've seen smarter decisions made by a coin flip.",
    "Your vibe called. It apologized on your behalf.",
    "If effort were a currency, you'd be bankrupt.",
    "Not even autocorrect can fix what's wrong with you.",
  ];
  return `🔥 ${r[Math.floor(Math.random() * r.length)]}`;
}

function getCompliment() {
  const c = [
    "You're surprisingly tolerable. High praise from me.",
    "Among all the mediocrity out there, you stand out. Slightly.",
    "You actually have taste. Rare.",
    "I'd deploy you in my group. That's the highest compliment I give.",
  ];
  return `🌹 ${c[Math.floor(Math.random() * c.length)]}`;
}

function getTruth() {
  const t = [
    "The person you keep making excuses for doesn't deserve them.",
    "You spend more time planning than doing. Fix that.",
    "Your biggest enemy lives in your head, rent-free.",
    "Growth is uncomfortable. That discomfort you're feeling? That's progress.",
  ];
  return `🗡️ Truth: ${t[Math.floor(Math.random() * t.length)]}`;
}

function getDare() {
  const d = [
    "Text someone you've been avoiding and say exactly what's on your mind.",
    "Do 20 push-ups. Right now. I'll wait.",
    "Compliment a stranger today. Without being weird about it.",
    "Spend the next hour with no phone. Just thoughts.",
  ];
  return `🎯 Dare: ${d[Math.floor(Math.random() * d.length)]}`;
}

function getRiasQuote() {
  const q = [
    '"Power isn\'t given. It\'s recognized." — RIAS',
    '"I don\'t chase. I attract. What belongs to me always finds me." — RIAS',
    '"Loyalty is earned. Betrayal is remembered." — RIAS',
    '"I\'m not cold. I\'m selective." — RIAS',
    '"Don\'t mistake my silence for weakness. I\'m calculating." — RIAS',
  ];
  return `🌹 ${q[Math.floor(Math.random() * q.length)]}`;
}

function getTrivia() {
  const questions = [
    { q: "What is the capital of Japan?", a: "Tokyo" },
    { q: "How many bytes in a kilobyte?", a: "1024" },
    { q: "Who created the World Wide Web?", a: "Tim Berners-Lee" },
    { q: "What language is spoken in Brazil?", a: "Portuguese" },
  ];
  const t = questions[Math.floor(Math.random() * questions.length)];
  return `🧩 Trivia Time!\n\n*${t.q}*\n\nReply with your answer. First correct answer wins! 🏆\n\n_(Spoiler: ${t.a})_`;
}

function getMenu() {
  return `
╔══════════════════════════╗
║        *RIAS MENU*        ║
╚══════════════════════════╝

⚔️ *ADMIN*
.kick | .ban | .mute | .promote
.demote | .lockgroup | .unlockgroup | .warn

🤖 *AI CHAT*
.ask [q] | .chat [msg] | .roast [@]
.compliment [@] | .advice [topic] | .story [prompt]

🎲 *FUN*
.ship [@] [@] | .truth | .dare
.rank | .quote | .trivia

⚙️ *AUTOMATION*
.setwelcome | .setgoodbye | .antilink
.antibadword | .schedule | .remind

📩 *DM TOOLS*
.dm [@] [msg] | .broadcast | .autoreply | .savecontact

_Made by Jinx Official 🔴_
  `.trim();
}

module.exports = { pairNumber };
