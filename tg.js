const TelegramBot = require('node-telegram-bot-api');

// Track deployed bots in memory (use a DB for persistence in prod)
const activeBots = new Map();

/**
 * Deploy RIAS to a Telegram bot using a user-provided token.
 * Returns { botUsername, ownerId }
 */
async function deployTelegram(token, ownerId) {
  // Stop existing bot with this token if any
  if (activeBots.has(token)) {
    try { activeBots.get(token).stopPolling(); } catch {}
    activeBots.delete(token);
  }

  const bot = new TelegramBot(token, { polling: true });

  // Verify token by fetching bot info
  let me;
  try {
    me = await bot.getMe();
  } catch (err) {
    throw new Error('Invalid bot token or Telegram API error.');
  }

  activeBots.set(token, bot);
  attachRiasHandlers(bot, ownerId, me.username);

  return { botUsername: me.username, ownerId };
}

/**
 * Attach all RIAS command handlers to a Telegram bot instance.
 */
function attachRiasHandlers(bot, ownerId, botUsername) {
  const isOwner = (id) => String(id) === String(ownerId);

  // ── /start ──────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'stranger';
    bot.sendMessage(msg.chat.id,
      `*RIAS online.* 🔴\n\nWelcome, ${name}. I'm not your average bot.\n\nType /menu to see what I can do — or impress me on your own.`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /menu ────────────────────────────────────────────────────
  bot.onText(/\/menu/, (msg) => {
    bot.sendMessage(msg.chat.id, getMenu(), { parse_mode: 'Markdown' });
  });

  // ── /ask ─────────────────────────────────────────────────────
  bot.onText(/\/ask (.+)/, async (msg, match) => {
    const answer = await riasAI(match[1]);
    bot.sendMessage(msg.chat.id, `🤖 ${answer}`, { parse_mode: 'Markdown' });
  });

  // ── /roast ───────────────────────────────────────────────────
  bot.onText(/\/roast/, (msg) => {
    bot.sendMessage(msg.chat.id, getRoast());
  });

  // ── /compliment ──────────────────────────────────────────────
  bot.onText(/\/compliment/, (msg) => {
    bot.sendMessage(msg.chat.id, getCompliment());
  });

  // ── /quote ───────────────────────────────────────────────────
  bot.onText(/\/quote/, (msg) => {
    bot.sendMessage(msg.chat.id, getRiasQuote(), { parse_mode: 'Markdown' });
  });

  // ── /truth ───────────────────────────────────────────────────
  bot.onText(/\/truth/, (msg) => {
    bot.sendMessage(msg.chat.id, getTruth());
  });

  // ── /dare ────────────────────────────────────────────────────
  bot.onText(/\/dare/, (msg) => {
    bot.sendMessage(msg.chat.id, getDare());
  });

  // ── /trivia ──────────────────────────────────────────────────
  bot.onText(/\/trivia/, (msg) => {
    bot.sendMessage(msg.chat.id, getTrivia(), { parse_mode: 'Markdown' });
  });

  // ── /ship ────────────────────────────────────────────────────
  bot.onText(/\/ship (.+) (.+)/, (msg, match) => {
    const pct = Math.floor(Math.random() * 101);
    const verdict = pct > 70 ? '🔥 A match made in chaos.' : pct > 40 ? '🌹 Complicated, but possible.' : '💀 Yikes. Hard pass.';
    bot.sendMessage(msg.chat.id, `💘 *${match[1]}* + *${match[2]}* = ${pct}%\n${verdict}`, { parse_mode: 'Markdown' });
  });

  // ── /advice ──────────────────────────────────────────────────
  bot.onText(/\/advice (.+)/, async (msg, match) => {
    const advice = await riasAI(`Give bold, sassy advice about: ${match[1]}`);
    bot.sendMessage(msg.chat.id, `🧠 ${advice}`);
  });

  // ── /story ───────────────────────────────────────────────────
  bot.onText(/\/story (.+)/, async (msg, match) => {
    const story = await riasAI(`Write a short dramatic story about: ${match[1]}`);
    bot.sendMessage(msg.chat.id, `📖 ${story}`);
  });

  // ── Admin: /kick /ban /mute (groups only) ───────────────────
  bot.onText(/\/kick/, async (msg) => {
    if (msg.chat.type === 'private') return bot.sendMessage(msg.chat.id, '❌ Groups only.');
    if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Owner only.');
    if (msg.reply_to_message) {
      try {
        await bot.kickChatMember(msg.chat.id, msg.reply_to_message.from.id);
        bot.sendMessage(msg.chat.id, '⚔️ Member ejected. RIAS doesn\'t waste time.');
      } catch { bot.sendMessage(msg.chat.id, '⚠️ Could not kick — make sure I\'m an admin.'); }
    } else {
      bot.sendMessage(msg.chat.id, '↩️ Reply to a message to kick that user.');
    }
  });

  bot.onText(/\/ban/, async (msg) => {
    if (msg.chat.type === 'private') return bot.sendMessage(msg.chat.id, '❌ Groups only.');
    if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Owner only.');
    if (msg.reply_to_message) {
      try {
        await bot.banChatMember(msg.chat.id, msg.reply_to_message.from.id);
        bot.sendMessage(msg.chat.id, '🚫 Permanently banned. No returns.');
      } catch { bot.sendMessage(msg.chat.id, '⚠️ Could not ban — make sure I\'m an admin.'); }
    } else {
      bot.sendMessage(msg.chat.id, '↩️ Reply to a message to ban that user.');
    }
  });

  bot.onText(/\/mute/, async (msg) => {
    if (msg.chat.type === 'private') return bot.sendMessage(msg.chat.id, '❌ Groups only.');
    if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Owner only.');
    if (msg.reply_to_message) {
      try {
        await bot.restrictChatMember(msg.chat.id, msg.reply_to_message.from.id, {
          permissions: { can_send_messages: false },
        });
        bot.sendMessage(msg.chat.id, '🔇 Muted. Peace restored.');
      } catch { bot.sendMessage(msg.chat.id, '⚠️ Could not mute — make sure I\'m an admin.'); }
    } else {
      bot.sendMessage(msg.chat.id, '↩️ Reply to a message to mute that user.');
    }
  });

  bot.onText(/\/unmute/, async (msg) => {
    if (!isOwner(msg.from.id)) return;
    if (msg.reply_to_message) {
      try {
        await bot.restrictChatMember(msg.chat.id, msg.reply_to_message.from.id, {
          permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true },
        });
        bot.sendMessage(msg.chat.id, '🔓 Unmuted.');
      } catch {}
    }
  });

  // ── /broadcast (owner only) ─────────────────────────────────
  bot.onText(/\/broadcast (.+)/, (msg, match) => {
    if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Owner only command.');
    bot.sendMessage(msg.chat.id, `📢 Broadcast sent: "${match[1]}"`);
  });

  // ── /warn ────────────────────────────────────────────────────
  bot.onText(/\/warn/, (msg) => {
    if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Owner only.');
    bot.sendMessage(msg.chat.id, '⚠️ Warning issued. Don\'t test me again.');
  });

  // ── /rank ────────────────────────────────────────────────────
  bot.onText(/\/rank/, (msg) => {
    bot.sendMessage(msg.chat.id, '🏆 Member Rankings:\n1. You (barely)\n2. Everyone else\n3. That one lurker\n\n*RIAS has spoken.* 🔴', { parse_mode: 'Markdown' });
  });

  // ── Catch-all for unknown / commands ────────────────────────
  bot.on('message', (msg) => {
    const text = msg.text || '';
    if (!text.startsWith('/')) return;
    const known = ['/start','/menu','/ask','/roast','/compliment','/quote','/truth','/dare','/trivia','/ship','/advice','/story','/kick','/ban','/mute','/unmute','/broadcast','/warn','/rank'];
    const cmd = text.split(' ')[0].split('@')[0];
    if (!known.includes(cmd)) {
      bot.sendMessage(msg.chat.id, `❓ Unknown command: ${cmd}\nType /menu to see what I can do.`);
    }
  });

  console.log(`[TG] RIAS deployed as @${botUsername} | Owner: ${ownerId}`);
}

// ── Shared content helpers ────────────────────────────────────

async function riasAI(prompt) {
  const fallbacks = [
    `*RIAS considers your question...* — "${prompt}"? The answer is right in front of you. Think harder.`,
    `Oh, you want my take on that? Fine. Do what feels right, then act like you knew all along. Works every time.`,
    `You came to ME with this? I'm flattered. My answer: stop overthinking. Execute.`,
    `Cute question. The real answer is — you already know. You just want permission. Granted.`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function getRoast() {
  const r = [
    "You're the human equivalent of a participation trophy. 🏅",
    "I've seen smarter decisions made by a coin flip.",
    "Your vibe called. It apologized on your behalf.",
    "Not even autocorrect can fix what's wrong with you.",
  ];
  return `🔥 ${r[Math.floor(Math.random() * r.length)]}`;
}

function getCompliment() {
  const c = [
    "You're surprisingly tolerable. High praise from me.",
    "Among all the mediocrity out there, you stand out. Slightly.",
    "You actually have taste. Rare.",
  ];
  return `🌹 ${c[Math.floor(Math.random() * c.length)]}`;
}

function getTruth() {
  const t = [
    "The person you keep making excuses for doesn't deserve them.",
    "You spend more time planning than doing. Fix that.",
    "Your biggest enemy lives in your head, rent-free.",
    "Growth is uncomfortable. That discomfort? That's progress.",
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
    '"Power isn\'t given. It\'s recognized." — RIAS 🔴',
    '"I don\'t chase. I attract." — RIAS 🔴',
    '"Loyalty is earned. Betrayal is remembered." — RIAS 🔴',
    '"I\'m not cold. I\'m selective." — RIAS 🔴',
  ];
  return q[Math.floor(Math.random() * q.length)];
}

function getTrivia() {
  const questions = [
    { q: "What is the capital of Japan?", a: "Tokyo" },
    { q: "How many bytes in a kilobyte?", a: "1024" },
    { q: "Who invented the telephone?", a: "Alexander Graham Bell" },
    { q: "What language is spoken in Brazil?", a: "Portuguese" },
  ];
  const t = questions[Math.floor(Math.random() * questions.length)];
  return `🧩 *Trivia Time!*\n\n*${t.q}*\n\nFirst correct answer wins! 🏆\n_(Answer: ${t.a})_`;
}

function getMenu() {
  return `
*╔══════════════════════════╗*
*║        RIAS MENU          ║*
*╚══════════════════════════╝*

⚔️ *ADMIN* _(groups only)_
/kick | /ban | /mute | /unmute | /warn | /rank

🤖 *AI CHAT*
/ask [question]
/advice [topic]
/story [prompt]

🎲 *FUN*
/ship [name1] [name2]
/truth | /dare | /trivia
/roast | /compliment | /quote

📩 *OWNER*
/broadcast [message]

_Made by Jinx Official 🔴_
  `.trim();
}

module.exports = { deployTelegram };
