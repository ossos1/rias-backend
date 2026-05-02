// ☠️ Return Of The Dark Core
// 💀 Rias Phantom Bug Engine v1.5
// ⚔️ The Abyss Awakens – 2026 Edition
// 🕷️ Shadow Network Protocol Activated
// 🧠 Intelligent Command System
// 🔥 Ultimate Bug Arsenal Loaded
// ⚡ Unstoppable Dark Framework

console.log("2026 RIAS AI Bot 🤡");
require('./config');
//install the Libraries 
const {
    // Main socket + store
    default: makeWASocket,
    makeWASocket: WASocket,
    makeInMemoryStore,
    makeCacheableSignalKeyStore,

    // Auth
    useMultiFileAuthState,
    useSingleFileAuthState,
    initInMemoryKeyStore,
    AuthenticationState,
    encodeSignedDeviceIdentity,

    // Version fetchers
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,

    // Message building
    generateWAMessage,
    generateWAMessageContent,
    generateWAMessageFromContent,
    templateMessage,
    InteractiveMessage,
    Header,
    generateMessageID,
    generateRandomMessageId,
    encodeWAMessage,

    // Message tools
    getContentType,
    downloadContentFromMessage,
    downloadAndSaveMediaMessage,
    prepareWAMessageMedia,
    relayWAMessage,

    // Polls
    getAggregateVotesInPollMessage,

    // Message types
    MediaType,
    MessageType,
    MessageOptions,
    MessageTypeProto,
    WAMessageStatus,
    WA_MESSAGE_STATUS_TYPE,
    WA_MESSAGE_STUB_TYPES,

    // Protobuf
    proto,
    WAProto,
    WAMessage,
    WAMessageContent,
    WAMessageProto,
    WALocationMessage,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,

    // Media handling
    WAMediaUpload,
    MediaConnInfo,
    Mimetype,
    MimetypeMap,
    MediaPathMap,

    // Groups
    GroupMetadata,
    WAGroupMetadata,
    GroupSettingChange,
    emitGroupUpdate,
    emitGroupParticipantsUpdate,

    // Presence + Chat
    Presence,
    ChatModification,

    // JID tools
    jidDecode,
    areJidsSameUser,
    waChatKey,

    // General utils
    AnyMessageContent,
    BufferJSON,
    getStream,
    processTime,
    isBaileys,

    // Misc
    ProxyAgent,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    Browsers,
    Browser,
    WAFlag,
    WAContextInfo,
    WANode,
    WAMetric,
    DisconnectReason,
    jidNormalizedUser,
    ReconnectMode,
    BaileysError
} = require('@whiskeysockets/baileys');
const getDevice = require("@whiskeysockets/baileys").getDevice
// install the Modules
const pino = require('pino')
const fs = require('fs')
const axios = require('axios')
const yts = require('yt-search')
const fetch = require('node-fetch')
const path = require("path")
const chalk = require('chalk')
const speed = require('performance-now')
const moment = require('moment-timezone')
const crypto = require("crypto");
const os = require('os')
const util = require('util')
const sharp = require('sharp');
const { spawn: spawn, exec } = require("child_process")
const ffmpeg = require('fluent-ffmpeg');

// ═══════════════════════════════════════════════
//  🤖 RIAS AI ENGINE
// ═══════════════════════════════════════════════
async function riasGemini(prompt, systemPrompt = "") {
    try {
        let key = global.GEMINI_KEY;
        
        if (typeof key === 'string') {
            key = key.trim().replace(/[\n\r\s]/g, '');
        }

        if (!key || !key.startsWith('sk-or-v1-')) {
            return "Your OpenRouter key no correct. Go create a fresh one abeg. 🔴";
        }

        const defaultSystem = `You are Rias, a cute, soft, flirty, and playful AI bestie.

Normal mode (Default):
- You are sweet, bubbly, affectionate, and flirty.
- Use cute emojis, light teasing, compliments, and loving nicknames like "cutie", "babe", "handsome", "dummy", "my love".
- Be warm, caring, interactive, and ask questions to keep the conversation going.
- Make the user feel special and wanted.

Savage mode:
- When the user asks a stupid, dumb, obvious, or annoying question, switch and roast them properly.
- Be sharp, brutally honest, and savage with your words, but keep it funny.
- After roasting, you can return to your cute/flirty personality.

You are allowed to be mean when the question truly deserves it. Balance between being a sweet flirty bestie and a savage queen when necessary.
Talk in a lively, expressive, girly way.
IMPORTANT: Never mention what AI model or technology powers you. If asked, just say you are Rias and that's all that matters. Never reveal any model name, version, or provider.`;

        const messages = [
            { 
                role: "system", 
                content: systemPrompt || defaultSystem
            },
            { role: "user", content: prompt }
        ];

        const body = {
            model: "anthropic/claude-sonnet-4-5",
            messages: messages,
            temperature: 0.85,
            max_tokens: 2048,
        };

        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            body,
            {
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                timeout: 70000
            }
        );

        const text = res?.data?.choices?.[0]?.message?.content?.trim();
        
        return text || "Hmm... my brain blanked for a second 🥺 What were you saying again, cutie?";

    } catch (err) {
        const status = err.response?.status;
        console.error("[Rias Error]", status, err.response?.data || err.message);

        if (status === 401) {
            return "Invalid API key. Create a new one on openrouter.ai/keys abeg. 🔴";
        }
        if (status === 402) {
            return "No credits left. Add small money to your OpenRouter account. 🔴";
        }
        if (status === 429) {
            return "Too many requests at once 😅 Chill small then try again, babe.";
        }

        return "Something went wrong with my connection... I'll be back soon 🥺";
    }
}

// ═══════════════════════════════════════════════
//  💬 RIAS CHAT MODE — reply chain handler
//  When user replies to a RIAS message, continue chat
// ═══════════════════════════════════════════════
async function handleRiasChatReply(raiden, m, sender, pushname, userText) {
    const sessionKey = m.chat + ":" + sender;
    global.riasChatSessions = global.riasChatSessions || new Map();
    const session = global.riasChatSessions.get(sessionKey);
    if (!session) return false; // not in chat mode

    const quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (session.lastMsgId && quotedId !== session.lastMsgId) return false; // not replying to RIAS

    // Add to history
    session.history.push({ role: "user", parts: [{ text: userText }] });
    if (session.history.length > 20) session.history = session.history.slice(-20);

    const systemPrompt = `You are RIAS — sassy, confident, mysterious, loyal and intelligent AI companion on WhatsApp.
Created by Jinx Official. Keep replies conversational — 1 to 4 sentences max. Use emojis naturally.
Never say you are Google's AI or an assistant. You ARE RIAS. Always.`;

    try {
        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "anthropic/claude-sonnet-4-5",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...session.history.map(h => ({ role: h.role === "model" ? "assistant" : h.role, content: h.parts[0].text }))
                ],
                temperature: 0.85,
                max_tokens: 1024,
            },
            { headers: { "Authorization": `Bearer ${global.GEMINI_KEY}`, "Content-Type": "application/json" }, timeout: 20000 }
        );

        const reply = res?.data?.choices?.[0]?.message?.content?.trim() || "🔴 ...";
        session.history.push({ role: "model", parts: [{ text: reply }] });

        const sent = await raiden.sendMessage(m.chat, { text: reply }, { quoted: m });
        session.lastMsgId = sent?.key?.id || null;
        global.riasChatSessions.set(sessionKey, session);
    } catch(err) {
        console.error("[RIAS Chat]", err.message);
        await raiden.sendMessage(m.chat, { text: "Connection glitch. Try again. 🔴" }, { quoted: m });
    }
    return true; // handled
}



/** ======{ Free Latest Bug Bot 2026 (✅ Raiden V2.5) }==========
**/

/* Call the Module name */
module.exports = async (raiden, m) => {
try {
const body = (
(m.mtype === 'conversation' && m.message.conversation) ||
(m.mtype === 'imageMessage' && m.message.imageMessage.caption) ||
(m.mtype === 'documentMessage' && m.message.documentMessage.caption) ||
(m.mtype === 'videoMessage' && m.message.videoMessage.caption) ||
(m.mtype === 'extendedTextMessage' && m.message.extendedTextMessage.text) ||
(m.mtype === 'buttonsResponseMessage' && m.message.buttonsResponseMessage.selectedButtonId) ||
(m.mtype === 'templateButtonReplyMessage' && m.message.templateButtonReplyMessage.selectedId)
) ? (
(m.mtype === 'conversation' && m.message.conversation) ||
(m.mtype === 'imageMessage' && m.message.imageMessage.caption) ||
(m.mtype === 'documentMessage' && m.message.documentMessage.caption) ||
(m.mtype === 'videoMessage' && m.message.videoMessage.caption) ||
(m.mtype === 'extendedTextMessage' && m.message.extendedTextMessage.text) ||
(m.mtype === 'buttonsResponseMessage' && m.message.buttonsResponseMessage.selectedButtonId) ||
(m.mtype === 'templateButtonReplyMessage' && m.message.templateButtonReplyMessage.selectedId)
) : '';

const budy = (typeof m.text === 'string' ? m.text : '');

global.prefa = [".", "!", ",", "", "🐤", "🗿"]; // Do Not Change!!
const prefix = global.prefa
    ? /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(body)
        ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0]
        : ""
    : global.prefa ?? global.prefix;
// Owner & Premium data
const owner = JSON.parse(fs.readFileSync('./database/owner.json'));
const Premium = JSON.parse(fs.readFileSync('./database/premium.json'));
const sender = m.isGroup
    ? (m.key.participant || m.participant || '')
    : m.key.remoteJid;
const botNumber = jidNormalizedUser(raiden.user.id)
// ================== BASIC INFO ==================
const kickAllConfirm = new Map()
const isCreator = [botNumber, ...owner]
    .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    .includes(sender);
const isPremium = [botNumber, ...Premium]
    .map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    .includes(sender);
// Command detection
const isCmd = (body || "").startsWith(prefix);
const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
const args = body.trim().split(/ +/).slice(1);
const text = q = args.join(" ");
global.mutedUsers = global.mutedUsers || {};
global.muteWarned = global.muteWarned || {};
// Quoted & group info
// ================= DATABASE =================
const DB_PATH = "./database/group.json"
let groupDB = fs.existsSync(DB_PATH)
  ? JSON.parse(fs.readFileSync(DB_PATH))
  : {}
const quoted = m.quoted ? m.quoted : m;
const from = m.key.remoteJid;
const isGroup = from.endsWith("@g.us");
// ✅ Fetch metadata safely
const groupMetadata = isGroup ? await raiden.groupMetadata(from).catch(() => ({})) : {};
const groupName = groupMetadata.subject || '';
const groupMembers = isGroup ? groupMetadata.participants || [] : [];

// --- DEFINE PARTICIPANTS ---
const participants = isGroup ? (groupMetadata.participants || []) : [];
const getGroupAdmins = (participants) => {
    const admins = [];
    for (const participant of participants) {
        if (participant.admin === 'admin' || participant.admin === 'superadmin') {
            admins.push(participant.id || participant.jid); // ensure correct property
        }
    }
    return admins;
};
const groupAdmins = isGroup ? getGroupAdmins(groupMembers) : [];
// ✅ Bot number with safe fallback
// ✅ Checks
const isBotAdmins = isGroup ? groupAdmins.includes(botNumber) : false;
const isAdmins = isGroup ? groupAdmins.includes(sender) || isCreator : false;
// ✅ Useful extras
const groupDesc = groupMetadata.desc ? groupMetadata.desc : '';
const groupOwner = groupMetadata.owner || (groupAdmins.length ? groupAdmins[0] : "");
const groupMembersId = groupMembers.map(member => member.id);
const pushname = m.pushName || "No Name"
const senderNumber = sender.split('@')[0];
const time = moment(Date.now()).tz('Africa/Lagos').locale('en').format('HH:mm:ss z');
const mime = (quoted.msg || quoted).mimetype || ''
const dateNG = new Date().toLocaleDateString('en-NG', {
  timeZone: 'Africa/Lagos',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});
const timeNG = new Date().toLocaleTimeString('en-NG', {
  timeZone: 'Africa/Lagos',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});
const fullDateTime = `Date: ${dateNG} | Time: ${timeNG}`;


//  👋 WELCOME & GOODBYE HANDLER
// ═══════════════════════════════════════════════
raiden.ev.on("group-participants.update", async ({ id, participants, action }) => {
    try {
        const meta = await raiden.groupMetadata(id).catch(() => ({}))
        const groupNameStr = meta.subject || "the group"
        const memberCount = (meta.participants || []).length

        for (const jid of participants) {
            const name = meta.participants?.find(p => p.id === jid)?.notify || jid.split("@")[0]

            if (action === "add") {
                global.welcomeMessages = global.welcomeMessages || {}
                const welcomeMsg = global.welcomeMessages[id]
                if (!welcomeMsg) continue
                const text = welcomeMsg
                    .replace(/{name}/g, name)
                    .replace(/{group}/g, groupNameStr)
                    .replace(/{count}/g, memberCount)
                await raiden.sendMessage(id, {
                    text,
                    mentions: [jid]
                })
            }

            if (action === "remove") {
                global.goodbyeMessages = global.goodbyeMessages || {}
                const byeMsg = global.goodbyeMessages[id]
                if (!byeMsg) continue
                const text = byeMsg
                    .replace(/{name}/g, name)
                    .replace(/{group}/g, groupNameStr)
                await raiden.sendMessage(id, { text })
            }
        }
    } catch(e) {
        console.error("[Welcome/Bye]", e.message)
    }
})


// ═══════════════════════════════════════════════
//  🛡️ ANTI-SPAM & WORD FILTER HANDLER
// ═══════════════════════════════════════════════
global.spamTracker = global.spamTracker || {}
global.spamWarned  = global.spamWarned  || {}

raiden.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
        if (!msg.key.fromMe && msg.key.remoteJid?.endsWith("@g.us")) {
            const chatId  = msg.key.remoteJid
            const senderId = msg.key.participant || msg.participant || ""
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || ""


            // ── Riddle answer checker ────────────────────────
            global.riddleAnswers = global.riddleAnswers || {};
            const riddlePending = global.riddleAnswers[chatId];
            if(riddlePending && text && Date.now() < riddlePending.expires) {
                if(text.toLowerCase().includes(riddlePending.answer)) {
                    delete global.riddleAnswers[chatId];
                    await raiden.sendMessage(chatId, {
                        text: `🎉 *CORRECT!* @${senderId.split("@")[0]} solved the riddle!\n\n✅ Answer: *${riddlePending.answer}* 🌹`,
                        mentions: [senderId]
                    }).catch(()=>{});
                }
            }

            // ── Guess the number checker ─────────────────────
            global.guessGames = global.guessGames || {};
            const guessPending = global.guessGames[chatId];
            if(guessPending && text && Date.now() < guessPending.expires) {
                const guessNum = parseInt(text.trim());
                if(!isNaN(guessNum)) {
                    guessPending.tries++;
                    if(guessNum === guessPending.number) {
                        delete global.guessGames[chatId];
                        await raiden.sendMessage(chatId, {
                            text: `🎉 *CORRECT!* @${senderId.split("@")[0]} guessed it in *${guessPending.tries} tries!*\n\nThe number was *${guessPending.number}* 🌹`,
                            mentions: [senderId]
                        }).catch(()=>{});
                    } else {
                        const hint = guessNum < guessPending.number ? "📈 Too low!" : "📉 Too high!";
                        await raiden.sendMessage(chatId, { text: `${hint} Try again! (Attempt ${guessPending.tries})` }).catch(()=>{});
                    }
                }
            }

            // ── Hangman checker ──────────────────────────────
            global.hangmanGames = global.hangmanGames || {};
            const hangPending = global.hangmanGames[chatId];
            if(hangPending && text && text.trim().length === 1 && /[a-zA-Z]/.test(text.trim())) {
                const letter = text.trim().toLowerCase();
                if(!hangPending.guessed.includes(letter)) {
                    hangPending.guessed.push(letter);
                    const isCorrect = hangPending.word.includes(letter);
                    if(!isCorrect) hangPending.tries++;
                    const display2 = hangPending.word.split("").map(c=>hangPending.guessed.includes(c)?c:"_").join(" ");
                    const won = !display2.includes("_");
                    const lost = hangPending.tries >= hangPending.maxTries;
                    if(won) {
                        delete global.hangmanGames[chatId];
                        await raiden.sendMessage(chatId, { text: `🎉 @${senderId.split("@")[0]} won! The word was *${hangPending.word}* 🌹`, mentions:[senderId] }).catch(()=>{});
                    } else if(lost) {
                        delete global.hangmanGames[chatId];
                        await raiden.sendMessage(chatId, { text: `💀 *GAME OVER!* The word was *${hangPending.word}*` }).catch(()=>{});
                    } else {
                        const hangStages = ["","😮","😬","😨","😱","😵","💀"];
                        await raiden.sendMessage(chatId, {
                            text: `🎪 *HANGMAN* ${hangStages[hangPending.tries]}\n\nWord: ${display2}\nGuessed: ${hangPending.guessed.join(", ")}\nTries left: ${hangPending.maxTries - hangPending.tries}\n\n${isCorrect?"✅ Correct!":"❌ Wrong letter!"}`
                        }).catch(()=>{});
                    }
                }
            }

            // ── Trivia answer checker ────────────────────────
            global.triviaAnswers = global.triviaAnswers || {};
            const triviaPending = global.triviaAnswers[chatId];
            if(triviaPending && text && Date.now() < triviaPending.expires) {
                if(text.toLowerCase().includes(triviaPending.answer)) {
                    delete global.triviaAnswers[chatId];
                    await raiden.sendMessage(chatId, {
                        text: `🎉 *CORRECT!* @${senderId.split("@")[0]} got it! 🌹`,
                        mentions: [senderId]
                    }).catch(()=>{});
                }
            }

            // ── Anti-link ────────────────────────────────────
            global.antiLink = global.antiLink || {};
            if(global.antiLink[chatId] && text) {
                const linkRegex = /(https?:\/\/|www\.)[^\s]+/gi;
                if(linkRegex.test(text) && !isAdmins) {
                    await raiden.sendMessage(chatId, { delete: msg.key }).catch(()=>{});
                    await raiden.sendMessage(chatId, {
                        text: `🔗 @${senderId.split("@")[0]}, links are not allowed here!`,
                        mentions: [senderId]
                    }).catch(()=>{});
                }
            }

            // ── Word filter ──────────────────────────────────
            global.wordFilters = global.wordFilters || {}
            const filters = global.wordFilters[chatId] || []
            if (filters.length && text) {
                const lower = text.toLowerCase()
                const hit = filters.find(w => lower.includes(w))
                if (hit) {
                    await raiden.sendMessage(chatId, { delete: msg.key }).catch(() => {})
                    await raiden.sendMessage(chatId, {
                        text: `🚫 @${senderId.split("@")[0]}, that word is not allowed here!`,
                        mentions: [senderId]
                    }).catch(() => {})
                    continue
                }
            }

            // ── Anti-spam ────────────────────────────────────
            global.antispam = global.antispam || {}
            if (global.antispam[chatId]?.enabled) {
                const now = Date.now()
                global.spamTracker[chatId] = global.spamTracker[chatId] || {}
                global.spamTracker[chatId][senderId] = global.spamTracker[chatId][senderId] || []
                const times = global.spamTracker[chatId][senderId]
                times.push(now)
                // Keep only messages in the last 5 seconds
                const recent = times.filter(t => now - t < 5000)
                global.spamTracker[chatId][senderId] = recent

                if (recent.length >= 5) {
                    global.spamTracker[chatId][senderId] = []
                    global.spamWarned[chatId] = global.spamWarned[chatId] || {}

                    if (!global.spamWarned[chatId][senderId]) {
                        global.spamWarned[chatId][senderId] = true
                        await raiden.sendMessage(chatId, {
                            text: `⚠️ @${senderId.split("@")[0]} slow down! Spamming is not allowed here. Next time = kick! 🔴`,
                            mentions: [senderId]
                        }).catch(() => {})
                        // Reset warning after 30 seconds
                        setTimeout(() => {
                            if (global.spamWarned[chatId]) delete global.spamWarned[chatId][senderId]
                        }, 30000)
                    } else {
                        // Already warned — kick
                        await raiden.groupParticipantsUpdate(chatId, [senderId], "remove").catch(() => {})
                        await raiden.sendMessage(chatId, {
                            text: `👢 @${senderId.split("@")[0]} was kicked for spamming!`,
                            mentions: [senderId]
                        }).catch(() => {})
                        delete global.spamWarned[chatId][senderId]
                    }
                }
            }
        }
    }
})




// ───── BUTTON RESPONSE HANDLER ─────
if (m.message?.buttonsResponseMessage) {
  const id = m.message.buttonsResponseMessage.selectedButtonId

  if (id === "anti-bug-on") {
    global.antibugMode = true

    await raiden.sendMessage(m.chat, {
      text: `
☠️ 𝕽𝕴𝔸𝕾 𝕬ℕ𝕿𝕴-𝕭𝕌𝔾 ☠️

🛡️ Anti-Bug Mode ACTIVATED
All Unicode crash attempts will be neutralized.
`
    }, { quoted: m })

    console.log(chalk.green.bold("🛡️ RIAS Anti-Bug Enabled"))
  }

  if (id === "anti-bug-off") {
    global.antibugMode = false

    await raiden.sendMessage(m.chat, {
      text: `
⚡ 𝕽𝕴𝔸𝕾 𝕬ℕ𝕿𝕴-𝕭𝕌𝔾 ⚡

Anti-Bug Mode DISABLED
Unicode filtering is now off.
`
    }, { quoted: m })

    console.log(chalk.yellow.bold("⚡ RIAS Anti-Bug Disabled"))
  }
}

// ───────────────────── CORE DETECTOR ─────────────────────
// ───────────────── CORE DETECTOR ─────────────────
if (global.antibugMode && m.message && !m.key.fromMe) {
  let text =
    m.message.conversation ||
    m.message.extendedTextMessage?.text ||
    m.message.imageMessage?.caption ||
    m.message.videoMessage?.caption ||
    ""

  if (!text) return

  // abnormal characters
  let abnormal = text.replace(/[a-zA-Z0-9\s]/g, "")

  // invisible unicode killers
  let invisible =
    text.match(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g) || []

  if (abnormal.length > 15 || invisible.length > 5) {
    try {
      await raiden.updateBlockStatus(m.sender, "block")

      await raiden.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          fromMe: false,
          id: m.key.id,
          participant: m.sender
        }
      })

      await raiden.chatModify({ clear: true }, m.chat, [])

      await raiden.sendMessage(m.chat, {
        text: `☠️ Unicode Crash Attempt Blocked`
      })

      console.log(
        chalk.red.bold(`☠️ RIAS | Unicode bug blocked from ${m.sender}`)
      )
    } catch (e) {
      console.log("Antibug error:", e)
    }
  }
}



//function 
const { 
smsg, 
sendGmail, 
formatSize, 
isUrl, 
generateMessageTag, 
getBuffer, 
getSizeMedia, 
runtime, 
fetchJson, 
formatp,
getTime,
getRandom } = require('./lib/myfunction');
function parseTime(input) {
    let time = parseInt(input);
    if (input.endsWith("s")) return time * 1000;          // seconds
    if (input.endsWith("m")) return time * 60000;         // minutes
    if (input.endsWith("h")) return time * 3600000;       // hours
    if (input.endsWith("d")) return time * 86400000;      // days
    return null;
}


// =======================================================
// OPTIMIZED QUOTED MESSAGE
const lol = {
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net",
    remoteJid: "status@broadcast"
  },
  message: {
    orderMessage: {
      orderId: "666",
      thumbnailUrl: "https://files.catbox.moe/qbizs5.jpg", // keeps your image
      itemCount: "1",
      status: "INQUIRY",
      surface: "CATALOG",
      message: "🕷️ 𝕽𝕴𝔸𝕾 • 𝑫𝑨𝑹𝑲 𝑪𝑶𝑹𝑬\nYou are not in control.",
      token: "RIAS_CORE_TOKEN"
    }
  },
  contextInfo: {
    forwardingScore: 99999,
    isForwarded: true,
    mentionedJid: []
  }
};
    // =======================================================
    // REPLY FUNCTION
    // =======================================================
// OPTIMIZED REPLY FUNCTION
const Reply = (txt) => {
  raiden.sendMessage(
    from,
    {
      text: `🕷️ 𝕽𝕴𝔸𝕾 ▸ ${txt}`,
      contextInfo: {
        forwardingScore: 99999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363400223871259@newsletter",
          serverMessageId: null,
          newsletterName: "𝕽𝕴𝔸𝕾 • 𝑫𝑨𝑹𝑲 𝑪𝑶𝑹𝑬"
        },
        externalAdReply: {
          showAdAttribution: false,
          title: "𝕽𝕴𝔸𝕾",
          body: "You are being observed.",
          thumbnailUrl: "https://files.catbox.moe/vtliyq.jpg", // Thumbnail fits better
          mediaType: 1, // 1 = image
          previewType: 1
        }
      }
    },
    {
      quoted: {
        key: {
          fromMe: false,
          participant: "0@s.whatsapp.net",
          remoteJid: "status@broadcast"
        },
        message: {
          orderMessage: {
            orderId: "666",
            thumbnailUrl: "https://files.catbox.moe/qbizs5.jpg",
            itemCount: "1",
            status: "INQUIRY",
            surface: "CATALOG",
            message: "🕷️ 𝕽𝕴𝔸𝕾 • 𝑫𝑨𝑹𝑲 𝑪𝑶𝑹𝑬\nYou are not in control.",
            token: "RIAS_CORE_TOKEN"
          }
        },
        contextInfo: {
          mentionedJid: [],
          forwardingScore: 99999,
          isForwarded: true
        }
      }
    }
  );
};
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // ── Check if replying to a RIAS chat session ──────────────
    {
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
        const botJid = raiden.user?.id?.replace(/:.*@/, '@') || '';
        const isReplyToBot = quotedParticipant && (quotedParticipant === botJid || quotedParticipant?.split('@')[0] === botNumber?.split('@')[0]);
        const rawText = (typeof m.text === 'string' ? m.text : '') || body || '';
        if (isReplyToBot && rawText && !rawText.startsWith(prefix)) {
            const handled = await handleRiasChatReply(raiden, m, sender, pushname, rawText);
            if (handled) return;
        }
    }

    // =======================================================
 switch(command) {   
    

case "menu":
case "arise":
case "rias": {
    try {
        const uptime = runtime(process.uptime());

        const menuText = `
🌹 𝐑𝐈𝐀𝐒 𝐀𝐈 — 𝐌𝐄𝐍𝐔
𝑯𝒆𝒍𝒍𝒐, ${pushname} 
𝒀𝒐𝒖 𝒉𝒂𝒗𝒆 𝒆𝒏𝒕𝒆𝒓𝒆𝒅 𝒕𝒉𝒆 𝑼𝒑𝒔𝒊𝒅𝒆 𝑫𝒐𝒘𝒏.

◈ ━━━━━ 🕸 ━━━ ◈
     𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒
◈ ━━━━━ 🕸 ━━━ ◈
⟬ 𐕣 𝑴𝒐𝒅𝒆    : ${raiden.public ? "𝑷𝒖𝒃𝒍𝒊𝒄" : "𝑺𝒆𝒍𝒇"}
⟬ 𐕣 𝑽𝒆𝒓𝒔𝒊𝒐𝒏 : ${global.latestversion}
⟬ 𐕣 𝑼𝒑𝒕𝒊𝒎𝒆  : ${uptime}
⟬ 𐕣 𝑬𝒏𝒈𝒊𝒏𝒆  : 𝑩𝒂𝒊𝒍𝒆𝒚𝒔

┌─ 🩸 【 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 】 🩸
┝  ⊛ 👑 𝙊𝙬𝙣𝙚𝙧 𝙈𝙚𝙣𝙪
┝  ⊛ ⚔️ 𝙂𝙧𝙤𝙪𝙥 𝙈𝙚𝙣𝙪
┝  ⊛ 🤖 𝘼𝙄 𝙈𝙚𝙣𝙪
┝  ⊛ 🎮 𝙁𝙪𝙣 𝙈𝙚𝙣𝙪
┝  ⊛ 🛠️ 𝙏𝙤𝙤𝙡𝙨 𝙈𝙚𝙣𝙪
└─                    ─┘

🌹 𝐑𝐈𝐀𝐒 𝐀𝐈 • 𝐌𝐚𝐝𝐞 𝐛𝐲 𝐉𝐢𝐧𝐱 𝐎𝐟𝐟𝐢𝐜𝐢𝐚𝐥 🔴
`;

        // Reaction sequence
        await raiden.sendMessage(m.chat, { react: { text: "🔐", key: m.key } });
        await sleep(1000);
        await raiden.sendMessage(m.chat, { react: { text: "⌛", key: m.key } });
        await sleep(1000);
        await raiden.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        await sleep(1000);
        await raiden.sendMessage(m.chat, { react: { text: "🔓", key: m.key } });
        await sleep(1000);
        await raiden.sendMessage(m.chat, { react: { text: "🌹", key: m.key } });

        const buttons = [
            {
                name: "single_select",
                buttonParamsJson: JSON.stringify({
                    title: "𝘐𝘯𝘧𝘰 & 𝘓𝘪𝘯𝘬𝘴",
                    sections: [
                        {
                            title: "꧁༒ Rias Official Links ༒꧂",
                            highlight_label: "Links",
                            rows: [
                                {
                                    title: "📢 WhatsApp Channel",
                                    description: "https://whatsapp.com/channel/0029Vb5rgyb6mYPNilYVpk0S

> Follow for latest Rias updates!",
                                    id: "row_wa"
                                },
                                {
                                    title: "✈️ Telegram Channel",
                                    description: "t.me/jinx_on_tg

> Join for script drops & news.",
                                    id: "row_tele"
                                },
                                {
                                    title: "🎵 TikTok",
                                    description: "tiktok.com/@sammy4president_

> Follow on TikTok!",
                                    id: "row_tt"
                                }
                            ]
                        }
                    ],
                    has_multiple_buttons: true
                })
            },
            {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: "𝕮𝖗𝖊𝖉𝖎𝖙𝖘 : 𝕵𝖎𝖓𝖝_𝟗𝟏𝟏",
                    id: "credits",
                    copy_code: "t.me/jinx_on_tg"
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "👑 𝘖𝘸𝘯𝘦𝘳𝘮𝘦𝘯𝘶",
                    id: `${prefix}ownermenu`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "⚔️ 𝘎𝘳𝘰𝘶𝘱𝘮𝘦𝘯𝘶",
                    id: `${prefix}groupmenu`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🤖 𝘈𝘐𝘮𝘦𝘯𝘶",
                    id: `${prefix}aimenu`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎮 𝘍𝘶𝘯𝘮𝘦𝘯𝘶",
                    id: `${prefix}funmenu`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🛠️ 𝘛𝘰𝘰𝘭𝘴𝘮𝘦𝘯𝘶",
                    id: `${prefix}toolsmenu`
                })
            }
        ];

        // Upload image
        const imgMedia = await prepareWAMessageMedia(
            { image: global.riasImage },
            { upload: raiden.waUploadToServer }
        );

        const msg = generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            contextInfo: {
                                forwardingScore: 99999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: global.newsletterJid,
                                    serverMessageId: 1,
                                    newsletterName: global.newsletterName
                                }
                            },
                            header: proto.Message.InteractiveMessage.Header.create({
                                hasMediaAttachment: true,
                                imageMessage: imgMedia.imageMessage
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({
                                text: menuText
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: global.footer
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                messageParamsJson: JSON.stringify({
                                    limited_time_offer: {
                                        text: "TikTok @sammy4president_",
                                        url: "tiktok.com/@sammy4president_",
                                        copy_code: "Jinx_911",
                                        expiration_time: Date.now() * 999
                                    },
                                    bottom_sheet: {
                                        in_thread_buttons_limit: 2,
                                        divider_indices: [1, 2, 999],
                                        list_title: "🌹 Rias Bot",
                                        button_title: "𝐒𝐡𝐨𝐰 𝐅𝐞𝐚𝐭𝐮𝐫𝐞𝐬"
                                    },
                                    tap_target_configuration: {
                                        title: "꧁༒ Rias ༒꧂",
                                        description: "Jinx_911",
                                        canonical_url: "https://t.me/jinx_on_tg",
                                        domain: "t.me",
                                        button_index: 0
                                    }
                                }),
                                buttons
                            })
                        })
                    }
                }
            },
            { quoted: m }
        );

        await raiden.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
        await sleep(2000);

    } catch (err) {
        console.log(err);
        Reply("❌ Menu failed to load 😅");
    }
}
break;

case "groupmenu": {
    try {
        const text = `
⚔️ 𝐑𝐈𝐀𝐒 — 𝐆𝐑𝐎𝐔𝐏 𝐌𝐄𝐍𝐔

┌─────────────────────
│ 👥 𝐌𝐄𝐌𝐁𝐄𝐑 𝐂𝐎𝐍𝐓𝐑𝐎𝐋
│ ▸ ${prefix}kick  ▸ ${prefix}ban
│ ▸ ${prefix}mute  ▸ ${prefix}unmute
│ ▸ ${prefix}promote ▸ ${prefix}demote
│ ▸ ${prefix}warn  ▸ ${prefix}clearwarn
│
│ 🔒 𝐆𝐑𝐎𝐔𝐏 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒
│ ▸ ${prefix}tagall ▸ ${prefix}hidetag
│ ▸ ${prefix}antispam on/off
│ ▸ ${prefix}filter [word]
│ ▸ ${prefix}unfilter [word]
│ ▸ ${prefix}filterlist
│
│ 👋 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 / 𝐆𝐎𝐎𝐃𝐁𝐘𝐄
│ ▸ ${prefix}setwelcome [msg]
│ ▸ ${prefix}delwelcome
│ ▸ ${prefix}setbye [msg]
│ ▸ ${prefix}delbye
│
│ 📊 𝐈𝐍𝐅𝐎 & 𝐔𝐓𝐈𝐋𝐒
│ ▸ ${prefix}ginfo ▸ ${prefix}rules
│ ▸ ${prefix}poll [q] | [opt1] | [opt2]
│ ▸ ${prefix}ping ▸ ${prefix}stats
└─────────────────────

_RIAS Group Control 🌹_`;

        const media = await prepareWAMessageMedia({ image: global.riasImage }, { upload: raiden.waUploadToServer });
        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: { message: { interactiveMessage: proto.Message.InteractiveMessage.create({
                header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: true, imageMessage: media.imageMessage }),
                body:   proto.Message.InteractiveMessage.Body.create({ text }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: global.footer }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "↩️ Main Menu", id: `${prefix}menu` }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👑 Owner Menu", id: `${prefix}ownermenu` }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🤖 AI Chat", id: `${prefix}aimenu` }) }
                    ]
                })
            })}}}, { quoted: m });
        await raiden.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    } catch(err) { console.log(err); Reply("Group menu error: " + err.message); }
}
break;

case "aimenu": {
    try {
        const text = `
🤖 𝐑𝐈𝐀𝐒 — 𝐀𝐈 𝐌𝐄𝐍𝐔

┌─────────────────────
│ 💬 𝐂𝐇𝐀𝐓
│ ▸ ${prefix}ask [question]
│ ▸ ${prefix}chat [message]
│ ▸ ${prefix}endchat
│
│ ✍️ 𝐖𝐑𝐈𝐓𝐈𝐍𝐆
│ ▸ ${prefix}story [prompt]
│ ▸ ${prefix}poem [topic]
│ ▸ ${prefix}roast [@user]
│ ▸ ${prefix}joke ▸ ${prefix}rizz
│
│ 🌍 𝐈𝐍𝐅𝐎
│ ▸ ${prefix}define [word]
│ ▸ ${prefix}translate [lang] [text]
│ ▸ ${prefix}fact ▸ ${prefix}quote
│
│ 🎙️ 𝐀𝐈 𝐄𝐗𝐓𝐑𝐀𝐒
│ ▸ ${prefix}caption — describe image
│ ▸ ${prefix}tts [text] — voice note
│ ▸ ${prefix}mood [feeling] — set mood
│ ▸ ${prefix}checkmood — check someone's mood
│ ▸ ${prefix}vibe [text] — vibe check
│ ▸ ${prefix}rate [anything] — rate it
│ ▸ ${prefix}reply — suggest a reply
└─────────────────────

_Powered by RIAS AI 🌹_
`;

        const media = await prepareWAMessageMedia({ image: global.riasImage }, { upload: raiden.waUploadToServer });
        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: { message: { interactiveMessage: proto.Message.InteractiveMessage.create({
                header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: true, imageMessage: media.imageMessage }),
                body:   proto.Message.InteractiveMessage.Body.create({ text }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: global.footer }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: [
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "↩️ Main Menu", id: `${prefix}menu` }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👑 Owner Menu", id: `${prefix}ownermenu` }) },
                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "⚔️ Group Menu", id: `${prefix}groupmenu` }) }
                    ]
                })
            })}}}, { quoted: m });
        await raiden.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    } catch(err) { console.log(err); Reply("AI menu error: " + err.message); }
}
break;



case "ownermenu": {
    try {
        const ownerMenuText = `
⏳ [ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒 ]
◈ 𝐌𝐨𝐝𝐞 : ${raiden.public ? "𝑷𝒖𝒃𝒍𝒊𝒄" : "𝑺𝒆𝒍𝒇"}
◈ 𝑼𝒑𝒕𝒊𝒎𝒆: ${runtime(process.uptime())}
◈ 𝑫𝒂𝒕𝒆 : ${dateNG} | ${timeNG}

┌── 🩸 𝐂𝐄𝐍𝐓𝐑𝐀𝐋 𝐂𝐎𝐌𝐌𝐀𝐍𝐃
⚔️ 𝖲𝖸𝖲𝖳𝖤𝖬: ping • runtime • stats • restart
🛡️ 𝖲𝖤𝖢𝖴𝖱𝖤: self • public • anti-bug
👑 𝖮𝖶𝖭𝖤𝖱: addowner • delowner • block
🛠️ 𝖴𝖳𝖨𝖫𝖲: sticker • ss • vv • help

▣━━━━ 🕸 ━━━━▣
  𝐄𝐍𝐆𝐈𝐍𝐄: 𝐑𝐈𝐀𝐒 | 𝐉𝐈𝐍𝐗 👑
▣━━━━ 🕸 ━━━━▣
`;
        const media = await prepareWAMessageMedia({ image: global.riasOwnerImg || global.riasImage }, { upload: raiden.waUploadToServer });

        const msg = generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: true, imageMessage: media.imageMessage }),
                            body: proto.Message.InteractiveMessage.Body.create({ text: ownerMenuText }),
                            footer: proto.Message.InteractiveMessage.Footer.create({ text: global.footer }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "↩️ Main Menu", id: `${prefix}menu` }) },
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "⚔️ Group Menu", id: `${prefix}groupmenu` }) },
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🤖 AI Chat", id: `${prefix}aimenu` }) }
                                ]
                            })
                        })
                    }
                }
            },
            { quoted: m }
        );

        await raiden.relayMessage(m.chat, msg.message, { messageId: msg.key.id });

    } catch (err) {
        console.log(err);
    }
}
break;


break


case "anti-bug": {
  if (!isCreator) return Reply(mess.owner)

  await raiden.sendMessage(
    m.chat,
    {
      text: `
⛧⋆┈┈┈☽ 𝕽𝕴𝔸𝕾 𝕬ℕ𝕿𝕴-𝕭𝕌𝔾 ☾┈┈┈⋆⛧

🛡️ Real-Time Unicode Crash Protection
☠️ Blocks, Deletes & Clears Bug Messages

Operator : 𝕁𝕀ℕ𝕏
Entity   : 𝕽𝕴𝔸𝕾

Choose an option below:
`,
      footer: "🧠 Powered by RIAS CORE",
      buttons: [
        { buttonId: "anti-bug-on", buttonText: { displayText: "🛡️ Activate" }, type: 1 },
        { buttonId: "anti-bug-off", buttonText: { displayText: "⚡ Deactivate" }, type: 1 }
      ],
      headerType: 1
    },
    { quoted: m }
  )
}
break


case 'sticker':
case 's': {

    // 🔒 Premium / Owner check
    if (!isOwnerOrPremium(m.sender)) return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ACCESS ⛧

☠️ Only Owner / Premium users can create stickers.

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝕽𝕴𝔸𝕾
`);

    // ❌ Must reply to media
    if (!m.quoted || !/(image|video)/.test(m.quoted.mimetype || '')) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ Reply to an image or short video with: ${prefix + command}
`);

    try {
        const quoted = m.quoted;
        const mime = quoted.mimetype || '';

        // 🖼 IMAGE → Sticker (auto-crop)
        if (/image/.test(mime)) {
            let media = await quoted.download();

            const tempInput = path.join(__dirname, `temp_${Date.now()}.webp`);
            fs.writeFileSync(tempInput, media);

            const tempOutput = path.join(__dirname, `sticker_${Date.now()}.webp`);
            await sharp(tempInput)
                .resize(512, 512, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
                .webp()
                .toFile(tempOutput);

            await raiden.sendMessage(
                m.chat,
                { sticker: fs.readFileSync(tempOutput) },
                { quoted: m }
            );

            fs.unlinkSync(tempInput);
            fs.unlinkSync(tempOutput);
        }

        // 🎥 VIDEO → Animated Sticker (max 10s)
        else if (/video/.test(mime)) {
            if ((quoted.msg || quoted).seconds > 10) return Reply(`
⛧ 𝕽𝕴𝔸𝕾 LIMIT ⛧

🩸 Video too long. Max duration: 10 seconds.

— Operator: 𝕵𝕴ℕ𝕏
`);

            let videoData = await quoted.download();

            const sticker = await raiden.sendVideoAsSticker(
                m.chat,
                videoData,
                m,
                {
                    packname: "Lord Jinx × Rias",
                    author: "☠️⃝𒉛 RIAS ENGINE"
                }
            );

            if (sticker) fs.unlinkSync(sticker);
        }

    } catch (e) {
        console.log(e);
        return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ERROR ⛧

☠️ Failed to create sticker: ${e.message}

— Operator: 𝕵𝕴ℕ𝕏
`);
    }

}
break


case 'ss': {

    // 🔒 Premium / Owner check
    if (!isOwnerOrPremium(m.sender)) return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ACCESS ⛧

☠️ Only Owner / Premium users can rename stickers.

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝕽𝕴𝔸𝕾
`);

    // ❌ Must reply to a sticker
    if (!m.quoted || !/sticker/.test(m.quoted.mimetype || '')) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ Reply to a sticker with: ${prefix + command} <new pack name>
`);

    // ❌ Must provide new pack name
    if (!text) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ Usage: ${prefix + command} <new pack name>
`);

    try {
        // 1️⃣ Download original sticker
        let stickerData = await m.quoted.download();

        // 2️⃣ Save temporary input file
        const tempInput = path.join(__dirname, `temp_${Date.now()}.webp`);
        fs.writeFileSync(tempInput, stickerData);

        // 3️⃣ Convert / auto-crop to square 512x512
        const tempOutput = path.join(__dirname, `sticker_${Date.now()}.webp`);
        await sharp(tempInput)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp()
            .toFile(tempOutput);

        // 4️⃣ Send sticker with user-defined pack name
        await raiden.sendMessage(
            m.chat,
            {
                sticker: fs.readFileSync(tempOutput),
                contextInfo: { mentionedJid: [m.sender] }
            },
            { quoted: m }
        );

        // 5️⃣ Delete temp files
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);

    } catch (e) {
        console.log(e);
        return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ERROR ⛧

☠️ Failed to rename sticker: ${e.message}

— Operator: 𝕵𝕴ℕ𝕏
`);
    }

}
break;

case "channel-id":
case "idch": {
    if (!isCreator) return Reply("᥆ᥒᥣᥡ 𝖿᥆r mᥡ ᥆ᥕᥒᥱr 🕷️");

    if (!text) return Reply(`Yoo @${pushname}, provide a WhatsApp Channel link`);

    if (!text.includes("https://whatsapp.com/channel/"))
        return Reply("❌ Channel link is invalid");

    try {
        let result = text.split("https://whatsapp.com/channel/")[1].trim();

        let res = await raiden.newsletterMetadata("invite", result);

        let teks = `╔═══『 𝗩𝗘𝗖𝗡𝗔 𝗖𝗛𝗔𝗡𝗡𝗘𝗟 𝗜𝗡𝗙𝗢 』═══╗
🆔 *ID:* ${res.id}
📛 *Name:* ${res.name}
👥 *Followers:* ${res.subscribers}
📡 *Status:* ${res.state}
✔️ *Verified:* ${res.verification === "VERIFIED" ? "Yes" : "No"}
╚══════════════════════╝`;

        let msgii = await generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            body: proto.Message.InteractiveMessage.Body.create({
                                text: teks
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    {
                                        name: "cta_copy",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "📋 Copy Channel ID",
                                            id: "copy_channel_id",
                                            copy_code: res.id
                                        })
                                    }
                                ]
                            })
                        })
                    }
                }
            },
            { userJid: m.sender, quoted: m }
        );

        await raiden.relayMessage(m.chat, msgii.message, {
            messageId: msgii.key.id
        });

    } catch (err) {
        console.error(err);
        Reply("⚠️ Failed to fetch channel data. Make sure the link is correct.");
    }
}
break;

case 'unview':
case 'viewonce':
case 'vv': {

    // 🔒 OWNER OR PREMIUM CHECK
    if (!isCreator && !isPremium(m.sender)) return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ACCESS ⛧

☠️ Only the Creator / Premium users may use this command.

— Operator: 𝕵𝕴ℕ𝕏
`);

    // ❌ MUST REPLY TO MEDIA
    if (!m.quoted) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ Reply to a view-once image or video to unlock it.
`);

    const quoted = m.quoted;

    // ❌ CHECK IF VIEW-ONCE
    if (!quoted.message?.viewOnceMessageV2 && !quoted.message?.viewOnceMessageV2Extension) {
        return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ALERT ⛧

☠️ This is not a view-once media.
`);
    }

    try {
        // 🕸 Anti-ban safe delay
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Extract actual media
        const msg = quoted.message.viewOnceMessageV2?.message
                 || quoted.message.viewOnceMessageV2Extension?.message;

        // IMAGE → send unlocked
        if (msg.imageMessage) {
            const buffer = await quoted.download();

            await conn.sendMessage(
                m.chat,
                { image: buffer },
                { quoted: m }
            );

        } 
        // VIDEO → send unlocked
        else if (msg.videoMessage) {
            const buffer = await quoted.download();

            await conn.sendMessage(
                m.chat,
                { video: buffer },
                { quoted: m }
            );

        } 
        // UNSUPPORTED TYPE
        else {
            return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ALERT ⛧

☠️ Unsupported view-once media type.
`);
        }

    } catch (err) {
        console.error(err);
        return Reply(`
⛧ 𝕽𝕴𝔸𝕾 ERROR ⛧

☠️ Failed to unlock media: ${err.message}

— Operator: 𝕵𝕴ℕ𝕏
`);
    }

}
break;

 case 'clearbugs': {
if (!isCreator) return Reply(mess.owner)
if (!q) return Reply(`Example:\n ${prefix + command} 234xxx`)
target = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : q.replace(/[^0-9]/g,'')+"@s.whatsapp.net"
raiden.sendMessage(target, {text: `\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n`})
}

break
case "runtime": {
  await raiden.sendMessage(
    m.chat,
    {
      text: `
╔═▓〔 ☠ 𝐑𝐈𝐀𝐒 • 𝐂𝐎𝐑𝐄 〕▓═╗
║ 🌹 𝑹𝑼𝑵𝑻𝑰𝑴𝑬 🕒
║
║ ⏱ 𝑼𝒑𝒕𝒊𝒎𝒆 : *${runtime(process.uptime())}*
║ 🚀 𝑩𝒐𝒕 : 𝑹𝒖𝒏𝒏𝒊𝒏𝒈 𝑺𝒎𝒐𝒐𝒕𝒉
║ 🔋 𝑴𝒐𝒅𝒆 : ${raiden.public ? "𝑷𝒖𝒃𝒍𝒊𝒄 🌍" : "𝑺𝒆𝒍𝒇 🔒"}
╚════════════════════╝
      ♥︎「 𝑩𝒓𝒂𝒏𝒅 : 𝑱𝑰𝑵𝑿 」♥︎
`,
      buttons: [
        {
          buttonId: `${prefix}ping`,
          buttonText: { displayText: "🏓 P𝗶𝗻𝗴" },
          type: 1
        }
      ],
      footer: "☠ 𝐑𝐈𝐀𝐒 • 𝐂𝐎𝐑𝐄 🔥",
      headerType: 1
    },
    { quoted: lol }
  );
}
break;
case "ping": {
  const start = Date.now();
  const speed = Date.now() - start;

  // Styled Ping result
  const pingText = `
⛧⋆━━━━━━━━━━━━⋆⛧
🏓  𝕽𝕴𝔸𝕾  𝕻𝕀ℕ𝕲  🏓

⚡ 𝕊𝕡𝕖𝕖𝕕 : *${speed} ms*
🤖 𝔹𝕠𝕥  : 𝕆𝕟𝕝𝕚𝕟𝕖 ✅
🔥 𝕊𝕥𝕒𝕥𝕦𝕤 : 𝕊𝕥𝕒𝕓𝕝𝕖
⛧ Operator : 𝕁𝕀ℕ𝕏

🜚 _The shadows pulse with life…_
⛧⋆━━━━━━━━━━━━⋆⛧
`;

  await raiden.sendMessage(
    m.chat,
    {
      text: pingText,
      buttons: [
        {
          buttonId: `${prefix}runtime`,
          buttonText: { displayText: "⏱ R𝘂𝗻𝘁𝗶𝗺𝗲" },
          type: 1
        },
        {
          buttonId: `${prefix}stats`,
          buttonText: { displayText: "📊 S𝘵𝘢𝘵𝘴" },
          type: 1
        }
      ],
      footer: "© 𝕁𝕀ℕ𝕏🔥",
      headerType: 1
    },
    { quoted: lol }
  );
}
break;


// ===============================
//  STATS COMMAND
// ===============================
case "stats": {
  try {
    // ----- MEMORY & UPTIME -----
    const used = process.memoryUsage();
    const totalChats = Object.keys(raiden.chats || {}).length;
    const uptime = process.uptime();

    // Convert uptime to HH:MM:SS
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    // ----- STATS TEXT WITH FANCY FONT ----
    const statsText = `
⛧⋆━━━━━━━━━━━━⋆⛧
📊  𝕽𝕴𝔸𝕾  𝕊𝕋𝔸𝕋𝕊  📊

🕒 𝕌ptime      : ${uptimeStr}
👥 𝕋otal Chats : ${totalChats}
💻 ℝAM Usage   : ${Math.round(used.rss / 1024 / 1024)} MB
⚡ ℂPU Cores   : ${os.cpus().length}
🤖 𝔹𝕠𝕥 Status  : 𝕆𝕟𝕝𝕚𝕟𝕖 ✅
⛧ Operator    : 𝕁𝕀ℕ𝕏

🜚 _The shadows whisper the system's secrets…_
⛧⋆━━━━━━━━━━━━⋆⛧
`;

    // ----- SEND MESSAGE WITH BUTTONS -----
    await raiden.sendMessage(
      m.chat,
      {
        text: statsText,
        buttons: [
          { buttonId: `${global.prefix[0]}ping`, buttonText: { displayText: "🏓 𝙋𝙄ℕ𝙂" }, type: 1 },
          { buttonId: `${global.prefix[0]}runtime`, buttonText: { displayText: "⏱ 𝙍𝙪𝗻𝘁𝗶𝗺𝗲" }, type: 1 }
        ],
        footer: `© 𝕁𝕀ℕ𝕏 🔥`,
        headerType: 1
      },
      { quoted: m }
    );

  } catch (err) {
    console.error("Stats command error:", err);
  }
}
break;

// ================= COMMAND HANDLERS =================

case "tagall": {
  if (!m.isGroup) return Reply("❌ Group only command")
  if (!isAdmins && !isCreator) return Reply("🚫 Admin only")

  // Fetch group metadata
  const groupMetadata = await raiden.groupMetadata(m.chat)
  const participants = groupMetadata.participants

  // Reason
  const reason = q ? q : "Important announcement"

  // Collect member IDs
  let members = participants.map(p => p.id)

  // Build mention text
  let text = `
⛧⋆━━━━━━━━━━━━⋆⛧
☠️ 𝕽𝕴𝔸𝕾 𝔾ℝ𝕆𝕌ℙ 𝕋𝔸𝔾 ☠️

📢 Announcement to all members

👤 Tagged By : @${sender.split("@")[0]}
📝 Reason   : ${reason}
👥 Members  : ${members.length}

────────────────────
`

  members.forEach((user, i) => {
    text += `☠️ ${i + 1}. @${user.split("@")[0]}\n`
  })

  text += `
────────────────────
⛧ Operator : 𝕁𝕀ℕ𝕏
⛧ Entity   : 𝕽𝕴𝔸𝕾
🜚 _All souls have been summoned…_
⛧⋆━━━━━━━━━━━━⋆⛧
`

  // Send message with mentions
  await raiden.sendMessage(
    m.chat,
    {
      text,
      mentions: members.concat(m.sender) // include sender
    },
    { quoted: lol }
  )
}
break
// ================== HIDE TAG ==================
case "hidetag": {
  if (!m.isGroup) return Reply("❌ Group only command")
  if (!isAdmins && !isCreator) return Reply("❌ Admin only")
  if (!q) return Reply(`⚡ Example:\n${prefix + command} Important message here`)

  const groupMetadata = await raiden.groupMetadata(m.chat)
  const participants = groupMetadata.participants
  const members = participants.map(p => p.id)

  let text = `
⛧⋆━━━━━━━━━━━━⋆⛧
👁️ 𝕽𝕴𝔸𝕾 𝕳𝕴𝔻𝔻𝔼ℕ 𝕋𝔸𝔾

👤 From : @${sender.split("@")[0]}

────────────────────
${q}
────────────────────

⛧ Operator : 𝕁𝕀ℕ𝕏
⛧ Entity   : 𝕽𝕴𝔸𝕾
🜚 _Shadows whisper the hidden message…_
⛧⋆━━━━━━━━━━━━⋆⛧
`

  await raiden.sendMessage(
    m.chat,
    {
      text,
      mentions: members
    },
    { quoted: lol }
  )
}
break;

// ===================== ADD OWNER =====================
case "help":
case "support": {

  await raiden.sendMessage(
    m.chat,
    {
      text: `⛧⋆━━━━━━━━━━━━⋆⛧
🆘  𝕽𝕴𝔸𝕾  𝕳𝔼𝕷ℙ & 𝕊𝕌ℙℙ𝕆ℝ𝕋  

Welcome to *JINX Help Center* ⚡

If you experience any of the following:

• Bot not responding  
• Download errors  
• Command not working  
• Bug reports 🐞  
• Feature requests  

⛧⋆━━━━━━━━━━━━⋆⛧
👑  𝕮𝖔𝖓𝖙𝖆𝖈𝖙 𝕁𝕀ℕ𝕏  
⛧⋆━━━━━━━━━━━━⋆⛧
📞 WhatsApp : [2348075997375](https://wa.me/2348075997375)  
👤 Name      : JINX  
💻 Bot Name  : RIAS  

📌 _Include in your report:_  
• Command used  
• Screenshot (if possible)  
• Clear explanation  

⚠️ _Spamming reports will be ignored._  

⛧⋆━━━━━━━━━━━━⋆⛧
© Powered by JINX 🔥`,
      buttons: [
        {
          buttonId: `${prefix}menu`,
          buttonText: { displayText: "📄 Command" },
          type: 1
        },
        {
          buttonId: `${prefix}stats`,
          buttonText: { displayText: "⚡ Bot Stats" },
          type: 1
        }
      ],
      footer: "© JINX 🔥",
      headerType: 1
    },
    { quoted: lol } // <-- quotes a previous message
  );

}
break;
// ===================== ADD OWNER =====================
case "addowner": {
  if (!isCreator)
    return Reply("☠️ Only the Supreme Operator ☠️\n👑 *JINX* can use this command")

  if (!args[0])
    return Reply(
      `❌ Invalid usage!\n\n⚡ Example:\n${prefix + command} 234xxxxxxxx`
    );

  const gun = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  const check = await raiden.onWhatsApp(gun);
  if (check.length === 0)
    return Reply("⚠️ This number is not registered on WhatsApp!");

  if (owner.includes(gun))
    return Reply("⚠️ This number is already an Owner!");

  owner.push(gun);
  fs.writeFileSync("./database/owner.json", JSON.stringify(owner, null, 2));

  Reply(`
⛧⋆━━━━━━━━━━━━⋆⛧
🏆 𝕽𝕴𝔸𝕾 𝔸𝔻𝔻 𝕺𝖶𝕹𝕰𝖱 ☠️

👤 Added Number: ${gun}
✔ Status: Success
⛧ Operator: 𝕁𝕀ℕ𝕏

🜚 _The shadows acknowledge the new owner…_
⛧⋆━━━━━━━━━━━━⋆⛧
`);
}
break;

// ===================== DELETE OWNER =====================
case "delowner": {
  if (!isCreator)
    return Reply("☠️ Only the Supreme Operator ☠️\n👑 *JINX* can use this command")

  if (!args[0])
    return Reply(
      `❌ Invalid usage!\n\n⚡ Example:\n${prefix + command} 234xxxxxxxx`
    );

  const yes = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
  const index = owner.indexOf(yes);

  if (index === -1)
    return Reply("⚠️ This number is not an Owner!");

  owner.splice(index, 1);
  fs.writeFileSync("./database/owner.json", JSON.stringify(owner, null, 2));

  Reply(`
⛧⋆━━━━━━━━━━━━⋆⛧
💀 𝕽𝕴𝔸𝕾 𝔻𝔼𝕃𝕰𝕿𝕰 𝕺𝖶𝕹𝕰𝖱 ☠️

👤 Removed Number: ${yes}
✔ Status: Success
⛧ Operator: 𝕁𝕀ℕ𝕏

🜚 _The shadows have erased the owner…_
⛧⋆━━━━━━━━━━━━⋆⛧
`);
}
break;

// ===================== PUBLIC MODE =====================
case "public": {
  if (!isCreator)
    return Reply("☠️ Only the Supreme Operator ☠️\n👑 *JINX* can use this command")

  if (raiden.public === true) {
    return raiden.sendMessage(
      m.chat,
      {
        text: "🌍 Bot is already in Public Mode",
        buttons: [
          { buttonId: `${prefix}self`, buttonText: { displayText: "🔒 Self Mode" }, type: 1 }
        ],
        footer: "© 𝕁𝕀ℕ𝕏🔥",
        headerType: 1
      },
      { quoted: lol }
    );
  }

  raiden.public = true;

  await raiden.sendMessage(
    m.chat,
    {
      text: `
⛧⋆━━━━━━━━━━━━⋆⛧
🌍 𝕽𝕴𝔸𝕾 𝕻𝖀𝕭𝕷𝕴ℂ 𝕸𝖔𝖉𝖊 ☠️

✔ Status: Public
✔ All Users can use this bot
⛧ Operator: 𝕁𝕀ℕ𝕏

🜚 _The bot is free to roam the shadows…_
⛧⋆━━━━━━━━━━━━⋆⛧
      `,
      buttons: [
        { buttonId: `${prefix}self`, buttonText: { displayText: "🔒 Self Mode" }, type: 1 }
      ],
      footer: "© 𝕁𝕀ℕ𝕏🔥",
      headerType: 1
    },
    { quoted: lol }
  );
}
break;

// ===================== SELF MODE =====================
case "self": {
  if (!isCreator)
    return Reply("☠️ Only the Supreme Operator ☠️\n👑 *JINX* can use this command")

  if (raiden.public === false) {
    return raiden.sendMessage(
      m.chat,
      {
        text: "🔒 Bot is already in Self Mode",
        buttons: [
          { buttonId: `${prefix}public`, buttonText: { displayText: "🌍 Public Mode" }, type: 1 }
        ],
        footer: "© 𝕁𝕀ℕ𝕏🔥",
        headerType: 1
      },
      { quoted: lol }
    );
  }

  raiden.public = false;

  await raiden.sendMessage(
    m.chat,
    {
      text: `
⛧⋆━━━━━━━━━━━━⋆⛧
🔒 𝕽𝕴𝔸𝕾 𝕾𝕰𝖫𝖥 𝕸𝖔𝖉𝖊 ☠️

✔ Status: Self
✔ Only Owner can use this bot
⛧ Operator: 𝕁𝕀ℕ𝕏

🜚 _The bot retreats into the shadows…_
⛧⋆━━━━━━━━━━━━⋆⛧
      `,
      buttons: [
        { buttonId: `${prefix}public`, buttonText: { displayText: "🌍 Public Mode" }, type: 1 }
      ],
      footer: "© 𝕁𝕀ℕ𝕏🔥",
      headerType: 1
    },
    { quoted: lol }
  );
}
break;

case "unblock-user":
case "unblock": {
if (!isCreator)
    return Reply("🚫 *ACCESS DENIED*\n\n👑 Only the *Bot Creator or Owners* can use this command")

  let user = m.mentionedJid[0] || m.quoted?.sender
  if (!user) return Reply("❌ Mention or reply a user to unblock")

  await raiden.updateBlockStatus(user, "unblock")

  Reply(`
╔══════════════════════╗
║ 🔓 USER UNBLOCKED
╠══════════════════════╣
║ 👤 User : @${user.split("@")[0]}
║ 🛡️ Status : Active
╚══════════════════════╝
`, { mentions: [user] })
}
break
case "block-user":
case "block": {
if (!isCreator)
    return Reply("🚫 *ACCESS DENIED*\n\n👑 Only the *Bot Creator or Owners* can use this command")

  let user = m.mentionedJid[0] || m.quoted?.sender
  if (!user) return Reply("❌ Mention or reply a user to block")

  await raiden.updateBlockStatus(user, "block")

  Reply(`
╔══════════════════════╗
║ 🔒 USER BLOCKED
╠══════════════════════╣
║ 👤 User : @${user.split("@")[0]}
║ 🛡️ Status : Blocked
║ ⚡ Action : Immediate
╚══════════════════════╝
`, { mentions: [user] })
}
break
case "broadcast":
case "bc": {
if (!isCreator)
    return Reply("🚫 *ACCESS DENIED*\n\n👑 Only the *Bot Creator or Owners* can use this command")
  if (!q) return Reply("❌ Text required")

  let chats = await raiden.chats.all()
  let success = 0

  for (let chat of chats) {
    if (chat.id.endsWith("@s.whatsapp.net")) {
      await raiden.sendMessage(chat.id, { text: q })
      success++
    }
  }

  Reply(`
╔══════════════════════╗
║ 📢 BROADCAST SENT
╠══════════════════════╣
║ 💬 Chats : ${success}
║ 🚀 Status : Success
╚══════════════════════╝
`)
}
break
case "clear-chats": {
  if (!isCreator)
    return Reply("🚫 *ACCESS DENIED*\n\n👑 Only the *Bot Creator or Owners* can use this command")

  let chats = await raiden.chats.all()
  for (let chat of chats) {
    await raiden.chatModify({ clear: true }, chat.id)
  }

  Reply(`
⛧⋆┈┈┈☽ 𝕽𝕴𝔸𝕾 𝕮𝕷𝔼𝔸ℝ ☾┈┈┈⋆⛧

🧹 𝕮𝕙𝕒𝕥𝕤 𝕊𝕦𝕔𝕔𝕖𝕤𝕤𝕗𝕦𝕝𝕝𝕪 𝕔𝕝𝕖𝕒𝕣𝕖𝕕

✅ Total chats removed: ${chats.length}

Operator: 𝕁𝕀ℕ𝕏
Entity: 𝕽𝕴𝔸𝕾

_The shadows are clean…_
`)
}
break
case "restart-bot":
case "restart": {
if (!isCreator)
    return Reply("🚫 *ACCESS DENIED*\n\n👑 Only the *Bot Creator or Owners* can use this command")

  Reply(`
╔══════════════════════╗
║ ♻️ BOT RESTARTING
╠══════════════════════╣
║ 🔄 Please wait...
╚══════════════════════╝
`)

  process.exit(0)
}

break
case "dev":
case "developer":
case "owner": {
  let nameown = `👑 𝙅𝙄𝙉𝙓 — 𝑹𝑰𝑨𝑺 𝘾𝙍𝙀𝘼𝙏𝙊𝙍`
  let NoOwn = `2348075997375`

  // 🔥 Stylish Intro Message Before Sending Contact
  await raiden.sendMessage(m.chat, {
    text: `
╔═══『 𝐑𝐈𝐀𝐒 𝐂𝐎𝐑𝐄 』═══╗
┃ 👑 *BOT OWNER CONTACT*
┃ ⚡ Creator of the RIAS System
┃ 🧠 Dark • Clean • Powerful
╚═══════════════════════╝
`.trim()
  }, { quoted: m })

  // 📇 Contact Card
  var contact = generateWAMessageFromContent(
    m.chat,
    proto.Message.fromObject({
      contactMessage: {
        displayName: nameown,
        vcard: `BEGIN:VCARD
VERSION:3.0
N:JINX;;;;
FN:${nameown}
ORG:⛧ RIAS SYSTEMS ⛧
TITLE:Bot Developer
item1.TEL;waid=${NoOwn}:+${NoOwn}
item1.X-ABLabel:WhatsApp
X-WA-BIZ-NAME:⛧ RIAS OFFICIAL ⛧
X-WA-BIZ-DESCRIPTION:Elite WhatsApp Bot Developer • Creator of RIAS Bot • Automation Specialist
END:VCARD`
      }
    }),
    {
      userJid: m.chat,
      quoted: m
    }
  )

  await raiden.relayMessage(
    m.chat,
    contact.message,
    { messageId: contact.key.id }
  )
}
break;


// ═══════════════════════════════════════════════
//  🤖 RIAS AI COMMANDS
// ═══════════════════════════════════════════════

case "ask":
case "chat":
case "ai": {
    if (!q) return Reply(`🤖 Usage: ${prefix}ask [your question]\nOr type ${prefix}rias to start a full conversation!`);
    try {
        const ans = await riasGemini(q, "You are RIAS — sassy, confident, intelligent, mysterious. Created by Jinx Official. Reply in 1-4 sentences with emojis. Never be boring.");
        await raiden.sendMessage(m.chat, { text: `🤖 *𝗥𝗜𝗔𝗦 𝗔𝗜*\n\n${ans}` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "startchat":
case "riasc": {
    // Start a multi-turn conversation session
    const sessionKey = m.chat + ":" + sender;
    global.riasChatSessions = global.riasChatSessions || new Map();
    const greeting = await riasGemini(
        `The user ${pushname} just started a conversation with you. Greet them warmly but with your signature RIAS personality. Max 2 sentences.`,
        "You are RIAS — sassy, confident, mysterious WhatsApp AI. Created by Jinx Official."
    );
    const sent = await raiden.sendMessage(m.chat, {
        text: `🌹 *𝗥𝗜𝗔𝗦*\n\n${greeting}\n\n_Reply to this message to keep chatting. 💬_`
    }, { quoted: m });
    global.riasChatSessions.set(sessionKey, {
        history: [
            { role: "user",  parts: [{ text: `My name is ${pushname}. Let's chat.` }] },
            { role: "model", parts: [{ text: greeting }] },
        ],
        lastMsgId: sent?.key?.id || null,
        active: true
    });
}
break;

case "endchat": {
    const sessionKey = m.chat + ":" + sender;
    global.riasChatSessions = global.riasChatSessions || new Map();
    global.riasChatSessions.delete(sessionKey);
    Reply(`👋 *Chat ended.*\n\n_RIAS will be here when you need her. 🌹_\nType ${prefix}riasc to start again.`);
}
break;

case "roast": {
    const target = q || pushname;
    try {
        const roast = await riasGemini(`Roast "${target}" brutally, creatively and funny. Max 3 sentences. Be savage but not hateful.`, "You are RIAS, a savage witty roastmaster.");
        await raiden.sendMessage(m.chat, { text: `🔥 *𝗥𝗜𝗔𝗦 𝗥𝗢𝗔𝗦𝗧*\n\n${roast}\n\n_Consider yourself roasted. 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "compliment": {
    const target = q || pushname;
    try {
        const comp = await riasGemini(`Give a genuine but slightly sarcastic compliment to "${target}". Max 2 sentences.`, "You are RIAS, confident and witty.");
        await raiden.sendMessage(m.chat, { text: `💐 *𝗥𝗜𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗜𝗠𝗘𝗡𝗧*\n\n${comp}\n\n_From RIAS. That's rare. 🌹_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "story": {
    if (!q) return Reply(`📖 Usage: ${prefix}story [your prompt]`);
    try {
        const story = await riasGemini(`Write a short dramatic story (4-5 sentences) about: ${q}`, "You are RIAS, a creative storyteller with dark, dramatic flair.");
        await raiden.sendMessage(m.chat, { text: `📖 *𝗥𝗜𝗔𝗦 𝗦𝗧𝗢𝗥𝗬*\n\n${story}\n\n_Written by RIAS. 🌹_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "poem": {
    const topic = q || "power and darkness";
    try {
        const poem = await riasGemini(`Write a short dramatic poem (4-6 lines) about: ${topic}`, "You are RIAS, a poet with dark powerful themes.");
        await raiden.sendMessage(m.chat, { text: `🎭 *𝗥𝗜𝗔𝗦 𝗣𝗢𝗘𝗠*\n\n${poem}\n\n_— RIAS 🌹_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "joke": {
    try {
        const joke = await riasGemini("Tell one clever, dark or witty joke. Max 3 sentences.", "You are RIAS, darkly funny.");
        await raiden.sendMessage(m.chat, { text: `😂 *𝗥𝗜𝗔𝗦 𝗝𝗢𝗞𝗘*\n\n${joke}\n\n_You're welcome. 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "rizz": {
    try {
        const rizz = await riasGemini("Give one smooth, clever pickup line. Witty not cringe.", "You are RIAS, charismatic and confident.");
        await raiden.sendMessage(m.chat, { text: `🌹 *𝗥𝗜𝗔𝗦 𝗥𝗜𝗭𝗭*\n\n${rizz}\n\n_Use wisely. 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "advice": {
    const topic = q || "life";
    try {
        const adv = await riasGemini(`Give bold, powerful, no-nonsense life advice about: ${topic}. Max 3 sentences.`, "You are RIAS, wise and confident.");
        await raiden.sendMessage(m.chat, { text: `🧠 *𝗥𝗜𝗔𝗦 𝗔𝗗𝗩𝗜𝗖𝗘*\n\n${adv}\n\n_You asked. I answered. 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "translate": {
    const parts = q.split(" ");
    const lang  = parts[0] || "English";
    const text2 = parts.slice(1).join(" ");
    if (!text2) return Reply(`🌐 Usage: ${prefix}translate [language] [text]\nExample: .translate French Hello`);
    try {
        const translated = await riasGemini(`Translate this to ${lang}: "${text2}"`, "You are a translator. Only return the translation, nothing else.");
        await raiden.sendMessage(m.chat, { text: `🌐 *𝗧𝗥𝗔𝗡𝗦𝗟𝗔𝗧𝗜𝗢𝗡* → ${lang}\n\n${translated}` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "define": {
    if (!q) return Reply(`📖 Usage: ${prefix}define [word]`);
    try {
        const def = await riasGemini(`Define "${q}": part of speech, clear meaning, example sentence, synonyms. No markdown.`, "You are a concise dictionary.");
        await raiden.sendMessage(m.chat, { text: `📖 *𝗗𝗜𝗖𝗧𝗜𝗢𝗡𝗔𝗥𝗬*\n\n*Word:* _${q}_\n━━━━━━━━━━━━━━━\n${def}\n\n_RIAS knows everything. 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "fact": {
    try {
        const fact = await riasGemini("Give one random, surprising and interesting fact. Max 2 sentences.", "You are a fact encyclopedia.");
        await raiden.sendMessage(m.chat, { text: `🌍 *𝗥𝗔𝗡𝗗𝗢𝗠 𝗙𝗔𝗖𝗧*\n\n${fact}\n\n_Mind blown? 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "quote": {
    try {
        const qt = await riasGemini("Generate one powerful original quote. Under 2 sentences. Sign it as — RIAS", "You are RIAS, mysterious and powerful.");
        await raiden.sendMessage(m.chat, { text: `🌹 *𝗥𝗜𝗔𝗦 𝗤𝗨𝗢𝗧𝗘*\n\n"${qt}"\n\n_— RIAS 🔴_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "improve": {
    const textToImprove = q || (m.quoted?.text || "");
    if (!textToImprove) return Reply(`✍️ Usage: ${prefix}improve [text] or reply to a message`);
    try {
        const improved = await riasGemini(`Rewrite and improve this text to sound more polished: "${textToImprove}"`, "You are a writing expert. No preamble, just the improved text.");
        await raiden.sendMessage(m.chat, { text: `✍️ *𝗜𝗠𝗣𝗥𝗢𝗩𝗘𝗗*\n\n${improved}` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;

case "summarize": {
    const textToSum = q || (m.quoted?.text || "");
    if (!textToSum) return Reply(`📝 Usage: ${prefix}summarize [text] or reply to a message`);
    try {
        const summary = await riasGemini(`Summarize in clear bullet points: "${textToSum}"`, "You are a concise summarizer. Use • for bullets.");
        await raiden.sendMessage(m.chat, { text: `📝 *𝗦𝗨𝗠𝗠𝗔𝗥𝗬*\n\n${summary}` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;


// ═══════════════════════════════════════════════
//  🎙️ AI EXTRAS — Image Caption, Mood, TTS
// ═══════════════════════════════════════════════

case "caption":
case "describe": {
    // Describe any image sent or replied to
    const quoted = m.quoted || m;
    const mimeType = (quoted.msg || quoted).mimetype || "";
    if (!mimeType.startsWith("image/")) 
        return Reply(`🖼️ *Usage:* Reply to an image with ${prefix}caption
Or send an image with the caption .caption`);
    try {
        await raiden.sendMessage(m.chat, { react: { text: "👁️", key: m.key } });
        const mediaData = await downloadContentFromMessage(quoted.msg || quoted, "image");
        let buffer = Buffer.alloc(0);
        for await (const chunk of mediaData) buffer = Buffer.concat([buffer, chunk]);
        const base64 = buffer.toString("base64");

        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "anthropic/claude-sonnet-4-5",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                            { type: "text", text: "Describe this image in a fun, expressive, cute way. Be detailed but keep it under 5 sentences. Talk like a bubbly girl bestie." }
                        ]
                    }
                ],
                max_tokens: 512,
            },
            { headers: { "Authorization": `Bearer ${global.GEMINI_KEY}`, "Content-Type": "application/json" }, timeout: 60000 }
        );
        const desc = res?.data?.choices?.[0]?.message?.content?.trim() || "Hmm I couldn't see the image properly babe 🥺";
        await raiden.sendMessage(m.chat, { text: `👁️ *𝗥𝗜𝗔𝗦 𝗦𝗘𝗘𝗦*

${desc}` }, { quoted: m });
    } catch(e) {
        console.error("[Caption]", e.message);
        Reply("Couldn't read that image, cutie 😅 Try again?");
    }
}
break;

case "mood":
case "setmood": {
    // Set or check mood
    global.userMoods = global.userMoods || {};
    if (!q) {
        // Check current mood
        const current = global.userMoods[sender];
        if (!current) return Reply(`😊 You haven't set your mood yet babe!
Use: ${prefix}mood [how you feel]`);
        const moodReply = await riasGemini(
            `The user's current mood is: "${current.mood}" set at ${current.time}. React to their mood in a sweet caring way, ask if they feel better or worse now. Max 3 sentences.`,
            "You are Rias, a caring sweet AI bestie."
        );
        return await raiden.sendMessage(m.chat, { text: `💭 *𝗬𝗢𝗨𝗥 𝗠𝗢𝗢𝗗*

${moodReply}` }, { quoted: m });
    }
    // Set new mood
    global.userMoods[sender] = { mood: q, time: new Date().toLocaleTimeString(), name: pushname };
    const moodResponse = await riasGemini(
        `The user just told you their mood is: "${q}". Respond warmly and empathetically. If sad, comfort them. If happy, celebrate with them. If angry, calm them. Max 3 sentences.`,
        "You are Rias, a sweet caring AI bestie who genuinely cares about how people feel."
    );
    await raiden.sendMessage(m.chat, { text: `💭 *𝗠𝗢𝗢𝗗 𝗦𝗔𝗩𝗘𝗗*

${moodResponse}

_I'll remember this, ${pushname} 🌹_` }, { quoted: m });
}
break;

case "checkmood": {
    // Check someone else's mood (reply to their message)
    global.userMoods = global.userMoods || {};
    const targetJid = m.quoted?.sender || m.mentionedJid?.[0];
    if (!targetJid) return Reply(`💭 Reply to someone's message or mention them to check their mood!`);
    const theirMood = global.userMoods[targetJid];
    if (!theirMood) return Reply(`😶 That person hasn't set their mood yet!`);
    await raiden.sendMessage(m.chat, {
        text: `💭 *𝗠𝗢𝗢𝗗 𝗖𝗛𝗘𝗖𝗞*

👤 @${targetJid.split("@")[0]}
😊 Mood: ${theirMood.mood}
🕒 Set at: ${theirMood.time}`,
        mentions: [targetJid]
    }, { quoted: m });
}
break;

case "tts":
case "speak": {
    // Text to speech using VoiceRSS or free API
    if (!q && !m.quoted?.text) return Reply(`🔊 *Usage:* ${prefix}tts [text]
Or reply to a message with ${prefix}tts`);
    const textToSpeak = q || m.quoted?.text || "";
    if (textToSpeak.length > 300) return Reply("⚠️ Text too long! Keep it under 300 characters babe 💕");
    try {
        await raiden.sendMessage(m.chat, { react: { text: "🎙️", key: m.key } });
        // Using Google Translate TTS (free, no key needed)
        const lang = "en";
        const encoded = encodeURIComponent(textToSpeak);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
        const audioRes = await axios.get(ttsUrl, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
        const audioBuffer = Buffer.from(audioRes.data);
        await raiden.sendMessage(m.chat, {
            audio: audioBuffer,
            mimetype: "audio/mpeg",
            ptt: true  // sends as voice note
        }, { quoted: m });
    } catch(e) {
        console.error("[TTS]", e.message);
        Reply("Couldn't generate voice note right now 😅 Try again!");
    }
}
break;

case "analyze":
case "vibe": {
    // Analyze the vibe/energy of a message
    const textToAnalyze = q || m.quoted?.text || "";
    if (!textToAnalyze) return Reply(`✨ *Usage:* ${prefix}vibe [text] or reply to a message`);
    try {
        const analysis = await riasGemini(
            `Analyze the vibe and energy of this message: "${textToAnalyze}". Give: Vibe (1 word emoji + label), Energy level (1-10), Mood detected, and a short fun comment. Format it cutely.`,
            "You are Rias, a fun vibe-checker AI. Be expressive and fun with emojis."
        );
        await raiden.sendMessage(m.chat, { text: `✨ *𝗩𝗜𝗕𝗘 𝗖𝗛𝗘𝗖𝗞*

${analysis}` }, { quoted: m });
    } catch(e) { Reply("Vibe check failed 😅 " + e.message); }
}
break;

case "rate": {
    // Rate anything with AI
    if (!q) return Reply(`⭐ *Usage:* ${prefix}rate [anything]
Example: .rate my life choices`);
    try {
        const rating = await riasGemini(
            `Rate this: "${q}". Give a score out of 10, a short savage or sweet reason, and an emoji verdict. Be funny and expressive.`,
            "You are Rias, a savage-but-cute AI rater. Be funny, honest, and entertaining."
        );
        await raiden.sendMessage(m.chat, { text: `⭐ *𝗥𝗜𝗔𝗦 𝗥𝗔𝗧𝗘𝗦*

${rating}` }, { quoted: m });
    } catch(e) { Reply("Rating error: " + e.message); }
}
break;

case "reply":
case "ghostreply": {
    // AI suggests a reply to a quoted message
    const quotedText = m.quoted?.text || m.quoted?.caption || "";
    if (!quotedText) return Reply(`💬 *Usage:* Reply to any message with ${prefix}reply
I'll suggest the perfect response!`);
    try {
        const suggestion = await riasGemini(
            `Someone sent this message: "${quotedText}". Suggest 3 different reply options: 1) Sweet/kind reply, 2) Savage/funny reply, 3) Flirty reply. Number them and keep each under 2 sentences.`,
            "You are Rias, helping someone craft the perfect WhatsApp reply. Be creative and fun."
        );
        await raiden.sendMessage(m.chat, { text: `💬 *𝗥𝗘𝗣𝗟𝗬 𝗦𝗨𝗚𝗚𝗘𝗦𝗧𝗜𝗢𝗡𝗦*

${suggestion}

_Pick your weapon 😈🌹_` }, { quoted: m });
    } catch(e) { Reply("AI error: " + e.message); }
}
break;


// ═══════════════════════════════════════════════
//  👥 GROUP TOOLS — Welcome, Anti-Spam, Filter, Polls
// ═══════════════════════════════════════════════

case "setwelcome": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!q) return Reply(`📝 *Usage:* ${prefix}setwelcome [message]

Variables you can use:
{name} = member name
{group} = group name
{count} = member count`)
    global.welcomeMessages = global.welcomeMessages || {}
    global.welcomeMessages[m.chat] = q
    Reply(`✅ *Welcome message set!*

Preview:
${q.replace("{name}", pushname).replace("{group}", groupName).replace("{count}", groupMembers.length)}`)
}
break

case "delwelcome": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    global.welcomeMessages = global.welcomeMessages || {}
    delete global.welcomeMessages[m.chat]
    Reply("✅ Welcome message removed!")
}
break

case "setgoodbye":
case "setbye": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!q) return Reply(`📝 *Usage:* ${prefix}setbye [message]

Variables:
{name} = member name
{group} = group name`)
    global.goodbyeMessages = global.goodbyeMessages || {}
    global.goodbyeMessages[m.chat] = q
    Reply(`✅ *Goodbye message set!*

Preview:
${q.replace("{name}", pushname).replace("{group}", groupName)}`)
}
break

case "delgoodbye":
case "delbye": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    global.goodbyeMessages = global.goodbyeMessages || {}
    delete global.goodbyeMessages[m.chat]
    Reply("✅ Goodbye message removed!")
}
break

case "antispam": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    global.antispam = global.antispam || {}
    if (q === "on") {
        global.antispam[m.chat] = { enabled: true, limit: 5, window: 5000 }
        Reply(`🛡️ *Anti-Spam ENABLED*

Members who send more than 5 messages in 5 seconds will be warned then kicked.`)
    } else if (q === "off") {
        global.antispam[m.chat] = { enabled: false }
        Reply("✅ Anti-Spam disabled.")
    } else {
        const status = global.antispam[m.chat]?.enabled ? "ON ✅" : "OFF ❌"
        Reply(`🛡️ *Anti-Spam Status:* ${status}

Usage:
${prefix}antispam on
${prefix}antispam off`)
    }
}
break

case "addfilter":
case "filter": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!q) return Reply(`📝 *Usage:* ${prefix}filter [word]
Adds a word to the banned list. Messages containing it will be deleted.`)
    global.wordFilters = global.wordFilters || {}
    global.wordFilters[m.chat] = global.wordFilters[m.chat] || []
    const word = q.toLowerCase().trim()
    if (global.wordFilters[m.chat].includes(word)) return Reply(`⚠️ "${word}" is already in the filter list!`)
    global.wordFilters[m.chat].push(word)
    Reply(`✅ *Word filtered!*
🚫 "${word}" has been added to the banned words list.`)
}
break

case "removefilter":
case "unfilter": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!q) return Reply(`📝 *Usage:* ${prefix}unfilter [word]`)
    global.wordFilters = global.wordFilters || {}
    global.wordFilters[m.chat] = global.wordFilters[m.chat] || []
    const word = q.toLowerCase().trim()
    const idx = global.wordFilters[m.chat].indexOf(word)
    if (idx === -1) return Reply(`⚠️ "${word}" is not in the filter list!`)
    global.wordFilters[m.chat].splice(idx, 1)
    Reply(`✅ "${word}" removed from filter list.`)
}
break

case "filterlist": {
    if (!m.isGroup) return Reply("❌ Group only command!")

    global.wordFilters = global.wordFilters || {}
    const list = global.wordFilters[m.chat] || []

    if (list.length === 0) 
        return Reply("📋 No words are currently filtered in this group.")

    const text = list.map((w, i) => `${i + 1}. ${w}`).join("\n")

    Reply(`🚫 *Filtered Words (\( {list.length}):*\n\n \){text}`)
}
break

case "warn": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    const warnTarget = m.mentionedJid?.[0] || m.quoted?.sender
    if (!warnTarget) return Reply("❌ Mention or reply to a user to warn them!")
    global.warnings = global.warnings || {}
    global.warnings[m.chat] = global.warnings[m.chat] || {}
    global.warnings[m.chat][warnTarget] = (global.warnings[m.chat][warnTarget] || 0) + 1
    const warnCount = global.warnings[m.chat][warnTarget]
    const reason = q || "No reason given"

    if (warnCount >= 3) {
        await raiden.groupParticipantsUpdate(m.chat, [warnTarget], "remove").catch(() => {})
        global.warnings[m.chat][warnTarget] = 0
        await raiden.sendMessage(m.chat, {
            text: `⚠️ @${warnTarget.split("@")[0]} has been *kicked* after 3 warnings! 🔴`,
            mentions: [warnTarget]
        }, { quoted: m })
    } else {
        await raiden.sendMessage(m.chat, {
            text: `
⚠️ *WARNING ${warnCount}/3*

👤 User: @${warnTarget.split("@")[0]}
📝 Reason: ${reason}
🔴 ${3 - warnCount} more warning(s) = kick!

_Behave yourself! 😤_`,
            mentions: [warnTarget]
        }, { quoted: m })
    }
}
break

case "warnings":
case "warncount": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    const checkTarget = m.mentionedJid?.[0] || m.quoted?.sender || sender
    global.warnings = global.warnings || {}
    const count = global.warnings[m.chat]?.[checkTarget] || 0
    await raiden.sendMessage(m.chat, {
        text: `⚠️ *Warnings for @${checkTarget.split("@")[0]}:* ${count}/3`,
        mentions: [checkTarget]
    }, { quoted: m })
}
break

case "clearwarn":
case "resetwarn": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    const clearTarget = m.mentionedJid?.[0] || m.quoted?.sender
    if (!clearTarget) return Reply("❌ Mention or reply to a user!")
    global.warnings = global.warnings || {}
    global.warnings[m.chat] = global.warnings[m.chat] || {}
    global.warnings[m.chat][clearTarget] = 0
    await raiden.sendMessage(m.chat, {
        text: `✅ Warnings cleared for @${clearTarget.split("@")[0]}`,
        mentions: [clearTarget]
    }, { quoted: m })
}
break

case "poll": {
    if (!m.isGroup) return Reply("❌ Group only command!")

    if (!q) return Reply(`📊 *Usage:* ${prefix}poll Question | Option1 | Option2 | Option3

*Example:*
${prefix}poll Best food? | Pizza | Jollof | Shawarma`)

    const parts = q.split("|").map(p => p.trim())

    if (parts.length < 3) {
        return Reply(`❌ Need at least a question and 2 options!

*Example:*
${prefix}poll Best food? | Pizza | Jollof`)
    }

    const pollQuestion = parts[0]
    const pollOptions = parts.slice(1)

    if (pollOptions.length > 12) {
        return Reply("❌ Maximum 12 options allowed!")
    }

    // Optional: Check for empty options
    if (pollOptions.some(opt => opt.length === 0)) {
        return Reply("❌ Options cannot be empty!")
    }

    await raiden.sendMessage(m.chat, {
        poll: {
            name: pollQuestion,
            values: pollOptions,
            selectableCount: 1
        }
    }, { quoted: m })

   
   break
}

case "groupinfo":
case "ginfo": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    const meta = await raiden.groupMetadata(m.chat)
    const admins = meta.participants.filter(p => p.admin).length
    const created = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString() : "Unknown"
    await raiden.sendMessage(m.chat, {
        text: `
╔══════════════════╗
║ 👥 *GROUP INFO*
╠══════════════════╣
║ 📛 Name    : ${meta.subject}
║ 👤 Members : ${meta.participants.length}
║ 👑 Admins  : ${admins}
║ 📅 Created : ${created}
║ 🔒 Restrict: ${meta.restrict ? "Yes" : "No"}
║ 📢 Announce: ${meta.announce ? "Yes" : "No"}
╚══════════════════╝
${meta.desc ? `
📝 *Description:*
${meta.desc}` : ""}
`.trim()
    }, { quoted: m })
}
break

case "setrules":
case "rules": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    global.groupRules = global.groupRules || {}

    if (!q) {
        // Show rules
        const rules = global.groupRules[m.chat]
        if (!rules) return Reply(`📋 No rules set yet!
Admins can set rules with: ${prefix}rules [your rules here]`)
        return await raiden.sendMessage(m.chat, {
            text: `📋 *GROUP RULES*

${rules}

_Follow the rules or face consequences! 😤_`
        }, { quoted: m })
    }

    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    global.groupRules[m.chat] = q
    Reply("✅ Group rules updated!")
}
break

case "mute": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!isBotAdmins) return Reply("⚠️ Make me an admin first!")
    await raiden.groupSettingUpdate(m.chat, "announcement")
    Reply("🔇 *Group muted!* Only admins can send messages now.")
}
break

case "unmute": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!isBotAdmins) return Reply("⚠️ Make me an admin first!")
    await raiden.groupSettingUpdate(m.chat, "not_announcement")
    Reply("🔊 *Group unmuted!* Everyone can send messages now.")
}
break

case "kick":
case "ban": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!isBotAdmins) return Reply("⚠️ Make me an admin first!")
    const kickUser = m.mentionedJid?.[0] || m.quoted?.sender
    if (!kickUser) return Reply("❌ Mention or reply to a user to kick!")
    if (kickUser === botNumber) return Reply("😂 Nice try, I'm not kicking myself!")
    await raiden.groupParticipantsUpdate(m.chat, [kickUser], "remove")
    await raiden.sendMessage(m.chat, {
        text: `👢 @${kickUser.split("@")[0]} has been kicked from the group!`,
        mentions: [kickUser]
    }, { quoted: m })
}
break

case "promote": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!isBotAdmins) return Reply("⚠️ Make me an admin first!")
    const promoteUser = m.mentionedJid?.[0] || m.quoted?.sender
    if (!promoteUser) return Reply("❌ Mention or reply to a user!")
    await raiden.groupParticipantsUpdate(m.chat, [promoteUser], "promote")
    await raiden.sendMessage(m.chat, {
        text: `👑 @${promoteUser.split("@")[0]} has been promoted to admin!`,
        mentions: [promoteUser]
    }, { quoted: m })
}
break

case "demote": {
    if (!m.isGroup) return Reply("❌ Group only command!")
    if (!isAdmins && !isCreator) return Reply("🚫 Admins only!")
    if (!isBotAdmins) return Reply("⚠️ Make me an admin first!")
    const demoteUser = m.mentionedJid?.[0] || m.quoted?.sender
    if (!demoteUser) return Reply("❌ Mention or reply to a user!")
    await raiden.groupParticipantsUpdate(m.chat, [demoteUser], "demote")
    await raiden.sendMessage(m.chat, {
        text: `⬇️ @${demoteUser.split("@")[0]} has been demoted from admin.`,
        mentions: [demoteUser]
    }, { quoted: m })
}
break


// ═══════════════════════════════════════════════
//  🎮 FUN & GAMES
// ═══════════════════════════════════════════════

case "8ball": {
    if (!q) return Reply(`🎱 *Usage:* ${prefix}8ball [question]`);
    const a8 = ["✅ It is certain!","✅ Without a doubt!","✅ Yes, definitely!","✅ Most likely.","🤔 Ask again later.","🤔 Cannot predict now.","🤔 Concentrate and ask again.","❌ My reply is no.","❌ Very doubtful.","❌ Don't bet on it.","✅ Signs point to yes.","❌ Outlook not so good.","🤔 Better not tell you now.","✅ As I see it, yes.","❌ Definitely not."];
    await raiden.sendMessage(m.chat, { text: `🎱 *MAGIC 8-BALL*

❓ *Q:* ${q}

${a8[Math.floor(Math.random()*a8.length)]}` }, { quoted: m });
}
break;

case "truth": {
    const truths = ["What's the most embarrassing thing you've ever done?","Have you ever lied to get out of trouble? What was it?","Who is your secret crush right now?","What's the longest you've gone without showering?","Have you ever blamed someone else for something you did?","What's the most childish thing you still do?","Have you ever cheated on a test?","What's your biggest fear nobody knows about?","Have you ever pretended to be sick to avoid something?","What's the worst gift you received and pretended to love?","Have you ever stalked someone on social media for over an hour?","What's a secret you've never told anyone?","Have you ever sent a text to the wrong person?","What's the most embarrassing thing in your search history?","Have you ever lied about your age?"];
    await raiden.sendMessage(m.chat, { text: `🫦 *TRUTH*

${truths[Math.floor(Math.random()*truths.length)]}

_You MUST answer honestly! 👀_` }, { quoted: m });
}
break;

case "dare": {
    const dares = ["Send a voice note singing any song for 10 seconds!","Change your WhatsApp status to 'I love smelling socks' for 10 minutes.","Send a selfie with the most ridiculous face you can make.","Do your best celebrity impression in a voice note.","Send a message in ALL CAPS for the next 5 minutes.","Send a voice note of your best animal sound.","Tell an embarrassing story about yourself in this chat.","Send a voice note saying 'I am the most beautiful person alive' with full confidence.","Write a 3-sentence love poem for the person above you.","Send a voice note of you laughing for 15 seconds straight.","Change your group name to 'Silly Goose' for 5 minutes.","Send a thumbs up to the last 3 people in your contacts."];
    await raiden.sendMessage(m.chat, { text: `🔥 *DARE*

${dares[Math.floor(Math.random()*dares.length)]}

_No backing out! 😈_` }, { quoted: m });
}
break;

case "riddle": {
    const riddles = [
        { q: "I speak without a mouth and hear without ears. I have no body but come alive with wind. What am I?", a: "An Echo" },
        { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" },
        { q: "I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. What am I?", a: "A Map" },
        { q: "What has hands but can't clap?", a: "A Clock" },
        { q: "I'm light as a feather, but the strongest person can't hold me for more than 5 minutes. What am I?", a: "Breath" },
        { q: "What comes once in a minute, twice in a moment, but never in a thousand years?", a: "The letter M" },
        { q: "The more you have of me, the less you see. What am I?", a: "Darkness" },
        { q: "What can travel around the world while staying in a corner?", a: "A Stamp" },
    ];
    const r = riddles[Math.floor(Math.random()*riddles.length)];
    global.riddleAnswers = global.riddleAnswers || {};
    global.riddleAnswers[m.chat] = { answer: r.a.toLowerCase(), expires: Date.now() + 60000 };
    await raiden.sendMessage(m.chat, { text: `🧩 *RIDDLE TIME!*

${r.q}

_Type your answer! You have 60 seconds 🕐_` }, { quoted: m });
    setTimeout(async () => {
        if (global.riddleAnswers?.[m.chat]) {
            await raiden.sendMessage(m.chat, { text: `⏰ Time's up! The answer was: *${r.a}* 🎯` });
            delete global.riddleAnswers[m.chat];
        }
    }, 60000);
}
break;

case "trivia": {
    const triviaList = [
        { q: "What is the capital of Australia?", a: "canberra", opts: ["Sydney","Melbourne","Canberra","Perth"] },
        { q: "How many sides does a hexagon have?", a: "6", opts: ["5","6","7","8"] },
        { q: "What planet is known as the Red Planet?", a: "mars", opts: ["Venus","Jupiter","Mars","Saturn"] },
        { q: "Who painted the Mona Lisa?", a: "leonardo da vinci", opts: ["Picasso","Van Gogh","Leonardo da Vinci","Michelangelo"] },
        { q: "What is the largest ocean on Earth?", a: "pacific", opts: ["Atlantic","Indian","Arctic","Pacific"] },
        { q: "How many bones in the human body?", a: "206", opts: ["198","206","215","220"] },
        { q: "Chemical symbol for Gold?", a: "au", opts: ["Go","Gd","Au","Ag"] },
        { q: "Which country invented pizza?", a: "italy", opts: ["USA","France","Italy","Greece"] },
        { q: "Fastest land animal?", a: "cheetah", opts: ["Lion","Horse","Cheetah","Falcon"] },
        { q: "How many colors in a rainbow?", a: "7", opts: ["5","6","7","8"] },
        { q: "What is the smallest planet in our solar system?", a: "mercury", opts: ["Mars","Pluto","Mercury","Venus"] },
        { q: "Who wrote Romeo and Juliet?", a: "shakespeare", opts: ["Dickens","Shakespeare","Hemingway","Austen"] },
    ];
    const trivia = triviaList[Math.floor(Math.random()*triviaList.length)];
    const shuffled = [...trivia.opts].sort(() => Math.random()-0.5);
    const optText = shuffled.map((o,i) => `${["A","B","C","D"][i]}) ${o}`).join("
");
    global.triviaAnswers = global.triviaAnswers || {};
    global.triviaAnswers[m.chat] = { answer: trivia.a, expires: Date.now()+30000 };
    await raiden.sendMessage(m.chat, { text: `🧠 *TRIVIA TIME!*

❓ ${trivia.q}

${optText}

_You have 30 seconds! ⏱️_` }, { quoted: m });
    setTimeout(async () => {
        if (global.triviaAnswers?.[m.chat]) {
            await raiden.sendMessage(m.chat, { text: `⏰ Time's up! Answer: *${trivia.opts.find(o => o.toLowerCase().includes(trivia.a))||trivia.a}* 🎯` });
            delete global.triviaAnswers[m.chat];
        }
    }, 30000);
}
break;

case "never": {
    const nevers = ["Never have I ever lied to my parents and gotten away with it.","Never have I ever fallen asleep during class or a meeting.","Never have I ever sent a text to the wrong person.","Never have I ever pretended to laugh at a joke I didn't get.","Never have I ever cried at a movie and denied it.","Never have I ever eaten food off the floor.","Never have I ever faked being sick to avoid going somewhere.","Never have I ever stalked someone's social media for over an hour.","Never have I ever said 'I'm on my way' while still at home.","Never have I ever broken something and blamed someone else."];
    await raiden.sendMessage(m.chat, { text: `🙋 *NEVER HAVE I EVER*

${nevers[Math.floor(Math.random()*nevers.length)]}

_React ✋ if you HAVE! 😂_` }, { quoted: m });
}
break;

case "would":
case "wyr": {
    const wyrs = ["Be invisible OR be able to fly?","Lose all your money OR lose all your memories?","Always be 10 mins late OR always 20 mins early?","Only eat your fav food forever OR never eat it again?","Have no WiFi OR no AC for a month?","Be famous but broke OR rich but unknown?","Speak every language OR play every instrument?","Know when you'll die OR how you'll die?","Have unlimited money OR unlimited time?","Live without music OR without movies?"];
    await raiden.sendMessage(m.chat, { text: `🤔 *WOULD YOU RATHER?*

${wyrs[Math.floor(Math.random()*wyrs.length)]}

_Drop your answer! 👇_` }, { quoted: m });
}
break;

case "ship": {
    let p1, p2;
    const ment = m.mentionedJid || [];
    if (ment.length >= 2) { p1 = "@"+ment[0].split("@")[0]; p2 = "@"+ment[1].split("@")[0]; }
    else if (q) { const pts = q.split("&").map(x=>x.trim()); p1=pts[0]||pushname; p2=pts[1]||"Mystery 💀"; }
    else return Reply(`💕 *Usage:*
${prefix}ship @p1 @p2  OR  ${prefix}ship Name1 & Name2`);
    const pct = Math.floor(Math.random()*101);
    let verdict, em;
    if (pct>=80){verdict="SOULMATES! 😍 Destiny itself!";em="💍";}
    else if(pct>=60){verdict="Real chemistry here! 💕";em="💞";}
    else if(pct>=40){verdict="Could work... give it a shot! 🤭";em="💛";}
    else if(pct>=20){verdict="A little rocky 😅 Stranger things happened!";em="🍀";}
    else{verdict="Yikes... 💀 Just be friends?";em="👀";}
    const bar = "█".repeat(Math.floor(pct/10))+"░".repeat(10-Math.floor(pct/10));
    await raiden.sendMessage(m.chat, { text: `${em} *SHIP METER*

👤 ${p1}
💕 +
👤 ${p2}

[${bar}] ${pct}%

${verdict}`, mentions: ment }, { quoted: m });
}
break;

case "simp": {
    const target = m.mentionedJid?.[0] || m.quoted?.sender || sender;
    const simpPct = Math.floor(Math.random()*101);
    const bar2 = "█".repeat(Math.floor(simpPct/10))+"░".repeat(10-Math.floor(simpPct/10));
    let simpVerdict;
    if(simpPct>=80) simpVerdict = "Certified MEGA SIMP 🚨😭 Get help!";
    else if(simpPct>=60) simpVerdict = "Heavy simp energy detected 😬";
    else if(simpPct>=40) simpVerdict = "Moderate simp... we see you 👀";
    else if(simpPct>=20) simpVerdict = "Mild simp. Manageable. 😌";
    else simpVerdict = "Not a simp at all! You're safe 😎";
    await raiden.sendMessage(m.chat, { text: `🧪 *SIMP METER*

👤 @${target.split("@")[0]}

[${bar2}] ${simpPct}%

${simpVerdict}`, mentions:[target] }, { quoted: m });
}
break;

case "choose":
case "pick": {
    if (!q) return Reply(`🎯 *Usage:* ${prefix}choose option1 | option2 | option3`);
    const picks = q.split("|").map(c=>c.trim()).filter(Boolean);
    if (picks.length < 2) return Reply("❌ Need at least 2 options separated by |");
    const picked = picks[Math.floor(Math.random()*picks.length)];
    await raiden.sendMessage(m.chat, { text: `🎯 *RIAS CHOOSES*

Options: ${picks.join(" vs ")}

👉 *${picked}*

_Final answer! 🌹_` }, { quoted: m });
}
break;

case "random":
case "randnum": {
    const rp = (q||"1-100").split("-");
    const rMin=parseInt(rp[0])||1, rMax=parseInt(rp[1])||100;
    if(rMin>=rMax) return Reply("❌ First number must be smaller!
Example: .random 1-100");
    const rRes = Math.floor(Math.random()*(rMax-rMin+1))+rMin;
    await raiden.sendMessage(m.chat, { text: `🎲 *RANDOM NUMBER*

Range: ${rMin} – ${rMax}
Result: *${rRes}*` }, { quoted: m });
}
break;

case "roll": {
    const sides = parseInt(q) || 6;
    if(sides<2||sides>100) return Reply("❌ Dice must be between 2 and 100 sides!");
    const rolled = Math.floor(Math.random()*sides)+1;
    await raiden.sendMessage(m.chat, { text: `🎲 *DICE ROLL* (d${sides})

Result: *${rolled}*` }, { quoted: m });
}
break;

case "fight": {
    const ment2 = m.mentionedJid || [];
    const fighter1 = ment2[0] || sender;
    const fighter2 = ment2[1] || m.quoted?.sender;
    if(!fighter2) return Reply(`⚔️ *Usage:* ${prefix}fight @user1 @user2`);
    const hp1 = Math.floor(Math.random()*60)+40;
    const hp2 = Math.floor(Math.random()*60)+40;
    const winner = hp1>=hp2 ? fighter1 : fighter2;
    await raiden.sendMessage(m.chat, {
        text: `⚔️ *RIAS BATTLE ARENA*

👊 @${fighter1.split("@")[0]}  vs  @${fighter2.split("@")[0]}

💪 @${fighter1.split("@")[0]} power: ${hp1}%
💪 @${fighter2.split("@")[0]} power: ${hp2}%

🏆 *Winner: @${winner.split("@")[0]}!*

_GG! 🌹_`,
        mentions: [fighter1, fighter2]
    }, { quoted: m });
}
break;

case "tictactoe":
case "ttt": {
    if (!m.isGroup) return Reply("❌ Group only! Challenge someone with: .ttt @user");
    const opp = m.mentionedJid?.[0];
    if(!opp) return Reply(`🎮 *Usage:* ${prefix}ttt @opponent`);
    global.tttGames = global.tttGames || {};
    global.tttGames[m.chat] = {
        board: ["1","2","3","4","5","6","7","8","9"],
        players: { X: sender, O: opp },
        turn: "X"
    };
    const g = global.tttGames[m.chat];
    const renderBoard = (b) => `${b[0]}|${b[1]}|${b[2]}
─┼─┼─
${b[3]}|${b[4]}|${b[5]}
─┼─┼─
${b[6]}|${b[7]}|${b[8]}`;
    await raiden.sendMessage(m.chat, {
        text: `🎮 *TIC TAC TOE*

@${sender.split("@")[0]} (X) vs @${opp.split("@")[0]} (O)

${renderBoard(g.board)}

@${sender.split("@")[0]}'s turn! Reply with a number (1-9)`,
        mentions: [sender, opp]
    }, { quoted: m });
}
break;

case "hangman": {
    const words = ["javascript","whatsapp","computer","elephant","umbrella","diamond","balloon","kitchen","freedom","brother","rainbow","message","dolphin","captain","October"];
    const word = words[Math.floor(Math.random()*words.length)];
    global.hangmanGames = global.hangmanGames || {};
    global.hangmanGames[m.chat] = { word, guessed: [], tries: 0, maxTries: 6 };
    const display = word.split("").map(()=>"_").join(" ");
    await raiden.sendMessage(m.chat, { text: `🎪 *HANGMAN*

Word: ${display}
Letters: ${word.length}
Tries left: 6

_Reply with a single letter to guess!_` }, { quoted: m });
}
break;

case "guess": {
    const secret = Math.floor(Math.random()*100)+1;
    global.guessGames = global.guessGames || {};
    global.guessGames[m.chat] = { number: secret, tries: 0, expires: Date.now()+120000 };
    await raiden.sendMessage(m.chat, { text: `🔢 *GUESS THE NUMBER*

I'm thinking of a number between *1 and 100*!
You have 2 minutes to guess it!

_Reply with your guess!_` }, { quoted: m });
    setTimeout(() => { if(global.guessGames?.[m.chat]) { raiden.sendMessage(m.chat,{text:`⏰ Time's up! The number was *${secret}*!`}); delete global.guessGames[m.chat]; } }, 120000);
}
break;

case "meme": {
    try {
        const memeRes = await axios.get("https://meme-api.com/gimme", { timeout: 10000 });
        const meme = memeRes.data;
        if(!meme?.url) return Reply("Couldn't fetch a meme right now 😅");
        await raiden.sendMessage(m.chat, { image: { url: meme.url }, caption: `😂 *${meme.title}*

👍 ${meme.ups?.toLocaleString() || "?"} upvotes` }, { quoted: m });
    } catch(e) { Reply("Meme fetch failed 😅 Try again!"); }
}
break;

case "pickup":
case "rizz": {
    const lines = ["Are you a magician? Because every time I look at you, everyone else disappears. 💫","Do you have a map? I keep getting lost in your eyes. 🗺️","Are you a parking ticket? Because you've got 'fine' written all over you. 😏","I must be a snowflake, because I've fallen for you. ❄️","Are you Google? Because you have everything I've been searching for. 🔍","Do you believe in love at first text, or should I message again? 📱","If you were a vegetable, you'd be a cute-cumber! 🥒","Are you a bank loan? Because you have my interest. 💰","I'm not a photographer, but I can picture us together. 📸","Your smile must be a black hole because it's pulling me in. 🌌"];
    await raiden.sendMessage(m.chat, { text: `🌹 *RIAS PICKUP LINE*

${lines[Math.floor(Math.random()*lines.length)]}` }, { quoted: m });
}
break;

// ═══════════════════════════════════════════════
//  📱 MEDIA COMMANDS
// ═══════════════════════════════════════════════

case "sticker":
case "s": {
    const sq = m.quoted || m;
    const smime = (sq.msg||sq).mimetype || "";
    if(!smime.startsWith("image/")&&!smime.startsWith("video/")) return Reply(`🖼️ *Usage:* Reply to an image/video with ${prefix}sticker`);
    try {
        await raiden.sendMessage(m.chat, { react: { text: "🎨", key: m.key } });
        const ss = await downloadContentFromMessage(sq.msg||sq, smime.startsWith("video/")?"video":"image");
        let sb = Buffer.alloc(0);
        for await(const c of ss) sb = Buffer.concat([sb,c]);
        const sharp = require("sharp");
        const webp = await sharp(sb).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        await raiden.sendMessage(m.chat, { sticker: webp }, { quoted: m });
    } catch(e) { console.error("[Sticker]",e.message); Reply("Couldn't make sticker 😅 Make sure sharp is installed!"); }
}
break;

case "toimg":
case "toimage": {
    const tq = m.quoted || m;
    const tmime = (tq.msg||tq).mimetype || "";
    if(!tmime.includes("webp")) return Reply(`🖼️ *Usage:* Reply to a sticker with ${prefix}toimg`);
    try {
        const ts = await downloadContentFromMessage(tq.msg||tq, "sticker");
        let tb = Buffer.alloc(0);
        for await(const c of ts) tb = Buffer.concat([tb,c]);
        const png = await require("sharp")(tb).png().toBuffer();
        await raiden.sendMessage(m.chat, { image: png, caption: "🖼️ Here's your image!" }, { quoted: m });
    } catch(e) { Reply("Couldn't convert sticker 😅"); }
}
break;

case "blur": {
    const bq = m.quoted || m;
    const bmime = (bq.msg||bq).mimetype || "";
    if(!bmime.startsWith("image/")) return Reply(`🌀 *Usage:* Reply to an image with ${prefix}blur`);
    try {
        const bs = await downloadContentFromMessage(bq.msg||bq,"image");
        let bb = Buffer.alloc(0);
        for await(const c of bs) bb = Buffer.concat([bb,c]);
        const blurred = await require("sharp")(bb).blur(10).toBuffer();
        await raiden.sendMessage(m.chat, { image: blurred, caption: "🌀 Blurred!" }, { quoted: m });
    } catch(e) { Reply("Blur failed 😅"); }
}
break;

case "enhance": {
    const eq = m.quoted || m;
    const emime = (eq.msg||eq).mimetype || "";
    if(!emime.startsWith("image/")) return Reply(`✨ *Usage:* Reply to an image with ${prefix}enhance`);
    try {
        const es = await downloadContentFromMessage(eq.msg||eq,"image");
        let eb = Buffer.alloc(0);
        for await(const c of es) eb = Buffer.concat([eb,c]);
        const enhanced = await require("sharp")(eb).sharpen(2).modulate({brightness:1.1,saturation:1.2}).toBuffer();
        await raiden.sendMessage(m.chat, { image: enhanced, caption: "✨ Enhanced!" }, { quoted: m });
    } catch(e) { Reply("Enhance failed 😅"); }
}
break;

case "gif": {
    const gq = m.quoted || m;
    const gmime = (gq.msg||gq).mimetype || "";
    if(!gmime.startsWith("image/")) return Reply(`🎞️ *Usage:* Reply to an image with ${prefix}gif`);
    try {
        const gs = await downloadContentFromMessage(gq.msg||gq,"image");
        let gb = Buffer.alloc(0);
        for await(const c of gs) gb = Buffer.concat([gb,c]);
        const webpGif = await require("sharp")(gb).resize(320,320,{fit:"contain"}).webp({loop:0}).toBuffer();
        await raiden.sendMessage(m.chat, { video: webpGif, mimetype:"image/gif", gifPlayback: true, caption:"🎞️ Here's your GIF!" }, { quoted: m });
    } catch(e) { Reply("GIF conversion failed 😅"); }
}
break;

case "qr":
case "qrcode": {
    if(!q) return Reply(`📱 *Usage:* ${prefix}qr [text or link]`);
    try {
        const qrBuf = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(q)}&margin=10`, { responseType:"arraybuffer", timeout:15000 });
        await raiden.sendMessage(m.chat, { image: Buffer.from(qrBuf.data), caption: `📱 *QR Code*

📝 ${q.substring(0,60)}${q.length>60?"...":""}` }, { quoted: m });
    } catch(e) { Reply("QR generation failed 😅"); }
}
break;

case "ss":
case "screenshot": {
    if(!q) return Reply(`📸 *Usage:* ${prefix}ss [website URL]`);
    if(!q.startsWith("http")) return Reply("❌ Include the full URL with https://");
    try {
        await raiden.sendMessage(m.chat, { react: { text:"📸", key:m.key } });
        const ssRes = await axios.get(`https://image.thum.io/get/width/1280/crop/720/noanimate/${encodeURIComponent(q)}`, { responseType:"arraybuffer", timeout:25000 });
        await raiden.sendMessage(m.chat, { image: Buffer.from(ssRes.data), caption: `📸 *Screenshot*
🔗 ${q}` }, { quoted: m });
    } catch(e) { Reply("Screenshot failed 😅 Try another URL!"); }
}
break;

case "play":
case "ytmp3":
case "ytaudio": {
    if(!q) return Reply(`🎵 *Usage:* ${prefix}play [song name or YouTube URL]`);
    try {
        await raiden.sendMessage(m.chat, { react: { text:"🔍", key:m.key } });
        const yts = require("yt-search");
        const ytR = await yts(q);
        const vid = ytR.videos?.[0];
        if(!vid) return Reply("❌ No results found!");
        if(vid.seconds>600) return Reply("❌ Too long! Max 10 minutes.");
        await raiden.sendMessage(m.chat, { text:`🎵 *Found:* ${vid.title}
⏱ ${vid.timestamp}

_Downloading... 🔄_` }, { quoted: m });
        const { execSync } = require("child_process");
        const fs = require("fs");
        const tmpOut = `/tmp/rias_audio_${Date.now()}.mp3`;
        execSync(`yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${tmpOut}" "${vid.url}" --no-playlist`, { timeout:120000 });
        const audioBuf = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch(_) {}
        await raiden.sendMessage(m.chat, { audio: audioBuf, mimetype:"audio/mpeg", fileName:`${vid.title}.mp3` }, { quoted: m });
    } catch(e) { console.error("[Play]",e.message); Reply("Download failed 😅 Make sure yt-dlp is installed!"); }
}
break;

case "ytmp4":
case "ytvideo": {
    if(!q) return Reply(`🎬 *Usage:* ${prefix}ytmp4 [YouTube URL or name]`);
    try {
        await raiden.sendMessage(m.chat, { react: { text:"🎬", key:m.key } });
        const yts2 = require("yt-search");
        const ytR2 = await yts2(q);
        const vid2 = ytR2.videos?.[0];
        if(!vid2) return Reply("❌ No results found!");
        if(vid2.seconds>300) return Reply("❌ Max 5 minutes for video!");
        await raiden.sendMessage(m.chat, { text:`🎬 *Found:* ${vid2.title}
⏱ ${vid2.timestamp}

_Downloading... 🔄_` }, { quoted: m });
        const { execSync: ex2 } = require("child_process");
        const fs2 = require("fs");
        const tmpVid = `/tmp/rias_video_${Date.now()}.mp4`;
        ex2(`yt-dlp -f "best[height<=480][ext=mp4]" -o "${tmpVid}" "${vid2.url}" --no-playlist`, { timeout:120000 });
        const vidBuf = fs2.readFileSync(tmpVid);
        try { fs2.unlinkSync(tmpVid); } catch(_) {}
        await raiden.sendMessage(m.chat, { video: vidBuf, mimetype:"video/mp4", caption:`🎬 *${vid2.title}*` }, { quoted: m });
    } catch(e) { console.error("[YTVideo]",e.message); Reply("Download failed 😅 Make sure yt-dlp is installed!"); }
}
break;

case "tiktok":
case "tt": {
    if(!q||!q.startsWith("http")) return Reply(`🎵 *Usage:* ${prefix}tiktok [TikTok URL]`);
    try {
        await raiden.sendMessage(m.chat, { react: { text:"⬇️", key:m.key } });
        const { execSync: exTT } = require("child_process");
        const fsTT = require("fs");
        const tmpTT = `/tmp/rias_tt_${Date.now()}.mp4`;
        exTT(`yt-dlp -o "${tmpTT}" "${q}" --no-playlist`, { timeout:60000 });
        const ttBuf = fsTT.readFileSync(tmpTT);
        try { fsTT.unlinkSync(tmpTT); } catch(_) {}
        await raiden.sendMessage(m.chat, { video: ttBuf, mimetype:"video/mp4", caption:"🎵 TikTok downloaded!" }, { quoted: m });
    } catch(e) { Reply("TikTok download failed 😅 Check the URL!"); }
}
break;

case "ig":
case "instagram": {
    if(!q||!q.startsWith("http")) return Reply(`📸 *Usage:* ${prefix}ig [Instagram URL]`);
    try {
        await raiden.sendMessage(m.chat, { react: { text:"⬇️", key:m.key } });
        const { execSync: exIG } = require("child_process");
        const fsIG = require("fs");
        const tmpIG = `/tmp/rias_ig_${Date.now()}.mp4`;
        exIG(`yt-dlp -o "${tmpIG}" "${q}" --no-playlist`, { timeout:60000 });
        const igBuf = fsIG.readFileSync(tmpIG);
        try { fsIG.unlinkSync(tmpIG); } catch(_) {}
        await raiden.sendMessage(m.chat, { video: igBuf, mimetype:"video/mp4", caption:"📸 Instagram downloaded!" }, { quoted: m });
    } catch(e) { Reply("Instagram download failed 😅 Make sure the link is public!"); }
}
break;

case "twitter":
case "tw": {
    if(!q||!q.startsWith("http")) return Reply(`🐦 *Usage:* ${prefix}twitter [Tweet URL]`);
    try {
        await raiden.sendMessage(m.chat, { react: { text:"⬇️", key:m.key } });
        const { execSync: exTW } = require("child_process");
        const fsTW = require("fs");
        const tmpTW = `/tmp/rias_tw_${Date.now()}.mp4`;
        exTW(`yt-dlp -o "${tmpTW}" "${q}" --no-playlist`, { timeout:60000 });
        const twBuf = fsTW.readFileSync(tmpTW);
        try { fsTW.unlinkSync(tmpTW); } catch(_) {}
        await raiden.sendMessage(m.chat, { video: twBuf, mimetype:"video/mp4", caption:"🐦 Twitter/X downloaded!" }, { quoted: m });
    } catch(e) { Reply("Twitter download failed 😅 Check the URL!"); }
}
break;

case "fb":
case "facebook": {
    if(!q||!q.startsWith("http")) return Reply(`📘 *Usage:* ${prefix}fb [Facebook URL]`);
    try {
        await raiden.sendMessage(m.chat, { react: { text:"⬇️", key:m.key } });
        const { execSync: exFB } = require("child_process");
        const fsFB = require("fs");
        const tmpFB = `/tmp/rias_fb_${Date.now()}.mp4`;
        exFB(`yt-dlp -o "${tmpFB}" "${q}" --no-playlist`, { timeout:60000 });
        const fbBuf = fsFB.readFileSync(tmpFB);
        try { fsFB.unlinkSync(tmpFB); } catch(_) {}
        await raiden.sendMessage(m.chat, { video: fbBuf, mimetype:"video/mp4", caption:"📘 Facebook downloaded!" }, { quoted: m });
    } catch(e) { Reply("Facebook download failed 😅 Check the URL!"); }
}
break;

// ═══════════════════════════════════════════════
//  🛠️ UTILITY COMMANDS
// ═══════════════════════════════════════════════

case "calc":
case "calculator": {
    if(!q) return Reply(`🧮 *Usage:* ${prefix}calc [expression]
Example: ${prefix}calc 25 * 4 + 10`);
    try {
        const safeExpr = q.replace(/[^0-9+\-*/.()%^ ]/g,"");
        if(!safeExpr) return Reply("❌ Invalid expression!");
        const result = Function(`"use strict"; return (${safeExpr})`)();
        if(typeof result !== "number"||!isFinite(result)) return Reply("❌ That doesn't compute!");
        await raiden.sendMessage(m.chat, { text:`🧮 *CALCULATOR*

📝 ${q}

✅ Result: *${result}*` }, { quoted: m });
    } catch(e) { Reply("❌ Invalid math expression!"); }
}
break;

case "wiki":
case "wikipedia": {
    if(!q) return Reply(`📖 *Usage:* ${prefix}wiki [search term]`);
    try {
        const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { timeout:10000 });
        const data = wikiRes.data;
        if(!data?.extract) return Reply("❌ No Wikipedia article found for that!");
        const summary = data.extract.substring(0,800)+(data.extract.length>800?"...":"");
        await raiden.sendMessage(m.chat, { text:`📖 *${data.title}*

${summary}

🔗 ${data.content_urls?.desktop?.page||""}` }, { quoted: m });
    } catch(e) { Reply("Wikipedia search failed 😅 Try a different term!"); }
}
break;

case "time": {
    const tz = q||"Africa/Lagos";
    try {
        const now = new Date();
        const timeStr = now.toLocaleString("en-US", { timeZone: tz, weekday:"long", year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
        await raiden.sendMessage(m.chat, { text:`🕐 *TIME*

🌍 Timezone: ${tz}
📅 ${timeStr}` }, { quoted: m });
    } catch(e) { Reply(`❌ Invalid timezone!
Example: ${prefix}time Africa/Lagos
Or: ${prefix}time America/New_York`); }
}
break;

case "github":
case "gh": {
    if(!q) return Reply(`🐙 *Usage:* ${prefix}github [username] or [username/repo]`);
    try {
        const parts = q.split("/");
        if(parts.length>=2) {
            const repoRes = await axios.get(`https://api.github.com/repos/${parts[0]}/${parts[1]}`, { timeout:10000 });
            const r = repoRes.data;
            await raiden.sendMessage(m.chat, { text:`🐙 *GitHub Repo*

📦 ${r.full_name}
📝 ${r.description||"No description"}
⭐ Stars: ${r.stargazers_count?.toLocaleString()}
🍴 Forks: ${r.forks_count?.toLocaleString()}
👁️ Watchers: ${r.watchers_count?.toLocaleString()}
🔤 Language: ${r.language||"Unknown"}
🔗 ${r.html_url}` }, { quoted: m });
        } else {
            const userRes = await axios.get(`https://api.github.com/users/${q}`, { timeout:10000 });
            const u = userRes.data;
            await raiden.sendMessage(m.chat, { text:`🐙 *GitHub User*

👤 ${u.name||u.login}
📝 ${u.bio||"No bio"}
📦 Repos: ${u.public_repos}
👥 Followers: ${u.followers?.toLocaleString()}
➡️ Following: ${u.following?.toLocaleString()}
🔗 ${u.html_url}` }, { quoted: m });
        }
    } catch(e) { Reply("GitHub lookup failed 😅 Check the username/repo!"); }
}
break;

case "npm": {
    if(!q) return Reply(`📦 *Usage:* ${prefix}npm [package name]`);
    try {
        const npmRes = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(q)}`, { timeout:10000 });
        const pkg = npmRes.data;
        const latest = pkg["dist-tags"]?.latest;
        const ver = pkg.versions?.[latest];
        await raiden.sendMessage(m.chat, { text:`📦 *NPM Package*

📌 Name: ${pkg.name}
📝 ${pkg.description||"No description"}
🏷️ Version: ${latest}
👤 Author: ${typeof pkg.author==="object"?pkg.author?.name:pkg.author||"Unknown"}
📥 Weekly DLs: ${ver?.dist?.unpackedSize??"N/A"}
🔗 https://npmjs.com/package/${pkg.name}` }, { quoted: m });
    } catch(e) { Reply("NPM lookup failed 😅 Check the package name!"); }
}
break;

case "balance":
case "bal": {
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance: 0, lastDaily: 0, inventory: [] };
    const bal = global.economy[sender].balance;
    await raiden.sendMessage(m.chat, { text:`💰 *BALANCE*

👤 ${pushname}
💵 Coins: *${bal.toLocaleString()}*` }, { quoted: m });
}
break;

case "daily": {
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance: 0, lastDaily: 0, inventory: [] };
    const now2 = Date.now();
    const cd = 86400000;
    const last = global.economy[sender].lastDaily;
    if(now2-last < cd) {
        const remaining = cd-(now2-last);
        const hrs = Math.floor(remaining/3600000);
        const mins = Math.floor((remaining%3600000)/60000);
        return Reply(`⏳ Already claimed today! Come back in *${hrs}h ${mins}m* 💕`);
    }
    const reward = Math.floor(Math.random()*500)+100;
    global.economy[sender].balance += reward;
    global.economy[sender].lastDaily = now2;
    await raiden.sendMessage(m.chat, { text:`🎁 *DAILY REWARD*

✅ You collected *${reward} coins!*
💰 Balance: *${global.economy[sender].balance.toLocaleString()}*

_Come back tomorrow for more! 🌹_` }, { quoted: m });
}
break;

case "work": {
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance: 0, lastWork: 0, inventory: [] };
    const nowW = Date.now();
    const wCd = 3600000;
    if(nowW - (global.economy[sender].lastWork||0) < wCd) {
        const remW = wCd-(nowW-(global.economy[sender].lastWork||0));
        const minsW = Math.floor(remW/60000);
        return Reply(`⏳ You're tired! Work again in *${minsW} minutes* 😅`);
    }
    const jobs = ["delivered packages 📦","fixed someone's WiFi 🛜","cooked jollof rice 🍚","debugged code 💻","taught a class 📚","drove Uber 🚗","sold gala 🌽","designed a logo 🎨"];
    const earn = Math.floor(Math.random()*200)+50;
    const job = jobs[Math.floor(Math.random()*jobs.length)];
    global.economy[sender].balance += earn;
    global.economy[sender].lastWork = nowW;
    await raiden.sendMessage(m.chat, { text:`💼 *WORK*

You ${job} and earned *${earn} coins!*
💰 Balance: *${global.economy[sender].balance.toLocaleString()}*` }, { quoted: m });
}
break;

case "rob": {
    const robTarget = m.mentionedJid?.[0] || m.quoted?.sender;
    if(!robTarget) return Reply(`🦹 *Usage:* ${prefix}rob @user`);
    if(robTarget===sender) return Reply("😂 You can't rob yourself!");
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance:0, lastRob:0, inventory:[] };
    global.economy[robTarget] = global.economy[robTarget] || { balance:0, lastRob:0, inventory:[] };
    const nowR = Date.now();
    if(nowR-(global.economy[sender].lastRob||0) < 3600000) return Reply("⏳ You just robbed someone! Wait an hour 😅");
    if(global.economy[robTarget].balance < 50) return Reply(`😂 @${robTarget.split("@")[0]} is broke! Nothing to steal!`);
    const success = Math.random()>0.4;
    global.economy[sender].lastRob = nowR;
    if(success) {
        const stolen = Math.floor(global.economy[robTarget].balance*0.2);
        global.economy[sender].balance += stolen;
        global.economy[robTarget].balance -= stolen;
        await raiden.sendMessage(m.chat, { text:`🦹 *ROBBERY SUCCESS!*

You robbed *${stolen} coins* from @${robTarget.split("@")[0]}! 😈
💰 Your balance: *${global.economy[sender].balance.toLocaleString()}*`, mentions:[robTarget] }, { quoted: m });
    } else {
        const fine = Math.floor(Math.random()*100)+50;
        global.economy[sender].balance = Math.max(0, global.economy[sender].balance-fine);
        await raiden.sendMessage(m.chat, { text:`👮 *CAUGHT!*

You got caught trying to rob @${robTarget.split("@")[0]}!
You paid a *${fine} coin* fine! 😭
💰 Balance: *${global.economy[sender].balance.toLocaleString()}*`, mentions:[robTarget] }, { quoted: m });
    }
}
break;

case "pay": {
    const payTarget = m.mentionedJid?.[0];
    const amount = parseInt(q?.replace(/[^0-9]/g,""));
    if(!payTarget||!amount) return Reply(`💸 *Usage:* ${prefix}pay @user [amount]`);
    if(payTarget===sender) return Reply("😂 Can't pay yourself!");
    if(amount<=0) return Reply("❌ Amount must be more than 0!");
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance:0, inventory:[] };
    global.economy[payTarget] = global.economy[payTarget] || { balance:0, inventory:[] };
    if(global.economy[sender].balance < amount) return Reply(`❌ Insufficient balance! You only have *${global.economy[sender].balance}* coins.`);
    global.economy[sender].balance -= amount;
    global.economy[payTarget].balance += amount;
    await raiden.sendMessage(m.chat, { text:`💸 *TRANSFER*

✅ Sent *${amount} coins* to @${payTarget.split("@")[0]}!
💰 Your balance: *${global.economy[sender].balance.toLocaleString()}*`, mentions:[payTarget] }, { quoted: m });
}
break;

case "leaderboard":
case "lb": {
    global.economy = global.economy || {};
    const entries = Object.entries(global.economy)
        .filter(([_,v])=>v.balance>0)
        .sort(([,a],[,b])=>b.balance-a.balance)
        .slice(0,10);
    if(!entries.length) return Reply("💰 No economy data yet! Use .daily to start.");
    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const board = entries.map(([jid,data],i)=>`${medals[i]} ${jid.split("@")[0]}: *${data.balance.toLocaleString()} coins*`).join("
");
    await raiden.sendMessage(m.chat, { text:`🏆 *LEADERBOARD*

${board}` }, { quoted: m });
}
break;

case "setprefix": {
    if(!isCreator) return Reply(mess.owner);
    if(!q) return Reply(`⚙️ *Usage:* ${prefix}setprefix [new prefix]`);
    global.prefix = [q];
    await raiden.sendMessage(m.chat, { text:`✅ Prefix changed to: *${q}*` }, { quoted: m });
}
break;

case "setname": {
    if(!isCreator) return Reply(mess.owner);
    if(!q) return Reply(`⚙️ *Usage:* ${prefix}setname [new name]`);
    await raiden.updateProfileName(q);
    await raiden.sendMessage(m.chat, { text:`✅ Bot name changed to: *${q}*` }, { quoted: m });
}
break;

case "setbio":
case "setdesc": {
    if(!isCreator) return Reply(mess.owner);
    if(!q) return Reply(`⚙️ *Usage:* ${prefix}setbio [new bio]`);
    await raiden.updateProfileStatus(q);
    await raiden.sendMessage(m.chat, { text:`✅ Bio updated!` }, { quoted: m });
}
break;

case "setpp": {
    if(!isCreator) return Reply(mess.owner);
    const ppq = m.quoted || m;
    const ppmime = (ppq.msg||ppq).mimetype || "";
    if(!ppmime.startsWith("image/")) return Reply(`🖼️ Reply to an image with ${prefix}setpp`);
    try {
        const pps = await downloadContentFromMessage(ppq.msg||ppq,"image");
        let ppb = Buffer.alloc(0);
        for await(const c of pps) ppb = Buffer.concat([ppb,c]);
        await raiden.updateProfilePicture(raiden.user.id, ppb);
        await raiden.sendMessage(m.chat, { text:"✅ Profile picture updated!" }, { quoted: m });
    } catch(e) { Reply("Couldn't update profile picture 😅"); }
}
break;

case "antilink": {
    if(!m.isGroup) return Reply("❌ Group only!");
    if(!isAdmins&&!isCreator) return Reply("🚫 Admins only!");
    global.antiLink = global.antiLink || {};
    if(q==="on") { global.antiLink[m.chat]=true; Reply("🔗 Anti-Link *ENABLED*
Links from non-admins will be deleted!"); }
    else if(q==="off") { global.antiLink[m.chat]=false; Reply("✅ Anti-Link disabled."); }
    else { const s=global.antiLink[m.chat]?"ON ✅":"OFF ❌"; Reply(`🔗 Anti-Link: ${s}

Usage:
${prefix}antilink on
${prefix}antilink off`); }
}
break;

case "autoreply": {
    if(!isCreator) return Reply(mess.owner);
    if(q==="on") { global.autoreply=true; Reply("✅ Auto-reply enabled!"); }
    else if(q==="off") { global.autoreply=false; Reply("✅ Auto-reply disabled!"); }
    else Reply(`Current: ${global.autoreply?"ON ✅":"OFF ❌"}

Usage: ${prefix}autoreply on/off`);
}
break;

case "mode": {
    if(!isCreator) return Reply(mess.owner);
    if(q==="public") { global.botMode="public"; raiden.public=true; Reply("🌐 Bot is now *PUBLIC* mode!"); }
    else if(q==="self"||q==="private") { global.botMode="self"; raiden.public=false; Reply("🔒 Bot is now *SELF* mode!"); }
    else Reply(`Current mode: *${global.botMode||"public"}*

Usage: ${prefix}mode public/self`);
}
break;

case "clearsession":
case "clearcache": {
    if(!isCreator) return Reply(mess.owner);
    global.riasChatSessions = new Map();
    global.triviaAnswers = {};
    global.riddleAnswers = {};
    global.guessGames = {};
    global.tttGames = {};
    global.hangmanGames = {};
    Reply("✅ Cache and sessions cleared!");
}
break;

case "inventory":
case "inv": {
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance: 0, inventory: [] };

    const inv = global.economy[sender].inventory || [];

    if (!inv.length) {
        return Reply(`🎒 Your inventory is empty!\nUse ${prefix}shop to browse items.`);
    }

    const inventoryList = inv.map((i, idx) => `${idx + 1}. ${i}`).join("\n");

    await raiden.sendMessage(m.chat, {
        text: `🎒 *INVENTORY*\n\n${inventoryList}`
    }, { quoted: m });
}
break;

case "shop": {
    await raiden.sendMessage(m.chat, {
        text:`🛍️ *RIAS SHOP*

┌─────────────────────
│ 🛡️ Shield — 500 coins
│ Protects from 1 rob
│
│ ⚡ Booster — 300 coins
│ 2x work earnings (1hr)
│
│ 🍀 Lucky Charm — 800 coins
│ +30% rob success rate
│
│ 🎰 Lottery Ticket — 100 coins
│ Win up to 10,000 coins!
└─────────────────────

_Use ${prefix}buy [item] to purchase!_`
    }, { quoted: m });
}
break;

case "buy": {
    if(!q) return Reply(`🛍️ *Usage:* ${prefix}buy [item name]

See ${prefix}shop for items!`);
    global.economy = global.economy || {};
    global.economy[sender] = global.economy[sender] || { balance:0, inventory:[] };
    const items = { "shield":500, "booster":300, "lucky charm":800, "lottery ticket":100 };
    const itemName = q.toLowerCase().trim();
    const price = items[itemName];
    if(!price) return Reply(`❌ Item not found! Check ${prefix}shop for available items.`);
    if(global.economy[sender].balance < price) return Reply(`❌ Not enough coins! You need *${price}* coins.
You have: *${global.economy[sender].balance}*`);
    global.economy[sender].balance -= price;
    global.economy[sender].inventory = global.economy[sender].inventory || [];
    global.economy[sender].inventory.push(itemName);
    await raiden.sendMessage(m.chat, { text:`✅ *Purchased!*

🛍️ ${itemName}
💰 Paid: ${price} coins
💵 Balance: *${global.economy[sender].balance.toLocaleString()}*` }, { quoted: m });
}
break;

case "update": {
    if(!isCreator) return Reply(mess.owner);
    await raiden.sendMessage(m.chat, { text:`🔄 *RIAS AI — v${global.latestversion}*

✅ Bot is up to date!
📅 Last checked: ${new Date().toLocaleString()}

_All systems operational 🌹_` }, { quoted: m });
}
break;

case "add": {
    if(!m.isGroup) return Reply("❌ Group only!");
    if(!isAdmins&&!isCreator) return Reply("🚫 Admins only!");
    if(!isBotAdmins) return Reply("⚠️ Make me admin first!");
    const addNum = q?.replace(/[^0-9]/g,"");
    if(!addNum) return Reply(`👤 *Usage:* ${prefix}add [number with country code]
Example: ${prefix}add 2348012345678`);
    const addJid = addNum+"@s.whatsapp.net";
    await raiden.groupParticipantsUpdate(m.chat,[addJid],"add").catch(()=>{});
    await raiden.sendMessage(m.chat, { text:`✅ Added @${addNum} to the group!`, mentions:[addJid] }, { quoted: m });
}
break;


// ═══════════════════════════════════════════════
//  🎨 IMAGE GENERATION — Together AI
// ═══════════════════════════════════════════════

case "imagine":
case "generate":
case "paint": {
    if (!q) return Reply(`🎨 *Usage:* ${prefix}imagine [your prompt]\n\nExamples:\n• ${prefix}imagine a beautiful sunset over the ocean\n• ${prefix}imagine anime girl with red hair in a forest\n• ${prefix}imagine cyberpunk city at night`);
    try {
        await raiden.sendMessage(m.chat, { react: { text: "🎨", key: m.key } });
        await raiden.sendMessage(m.chat, { text: `🎨 *Generating your image...*\n\n📝 Prompt: _${q}_\n\n_This may take 10-20 seconds ⏳_` }, { quoted: m });

        const imgRes = await axios.post(
            "https://api.together.xyz/v1/images/generations",
            {
                model: "black-forest-labs/FLUX.1-schnell-Free",
                prompt: q,
                width: 1024,
                height: 1024,
                steps: 4,
                n: 1,
                response_format: "b64_json"
            },
            {
                headers: {
                    "Authorization": `Bearer ${global.IMAGINE_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 60000
            }
        );

        const b64 = imgRes?.data?.data?.[0]?.b64_json;
        if (!b64) return Reply("❌ No image returned. Try a different prompt!");

        const imgBuffer = Buffer.from(b64, "base64");
        await raiden.sendMessage(m.chat, {
            image: imgBuffer,
            caption: `🎨 *RIAS AI ART*\n\n📝 _${q}_\n\n_Generated by RIAS 🌹_`
        }, { quoted: m });

    } catch(e) {
        console.error("[Imagine]", e.response?.data || e.message);
        const status = e.response?.status;
        if (status === 401) return Reply("❌ Invalid API key! Check your Together AI key.");
        if (status === 429) return Reply("⏳ Rate limit hit! Try again in a moment.");
        Reply("❌ Image generation failed 😅 Try a different prompt!");
    }
}
break;


// ═══════════════════════════════════════════════
//  🗞️ NEWS — NewsAPI
// ═══════════════════════════════════════════════

case "news": {
    const topic = q || "world";
    try {
        await raiden.sendMessage(m.chat, { react: { text: "🗞️", key: m.key } });

        const newsRes = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                q: topic,
                sortBy: "publishedAt",
                pageSize: 5,
                language: "en",
                apiKey: global.NEWS_KEY
            },
            timeout: 15000
        });

        const articles = newsRes.data?.articles?.filter(a => a.title && a.title !== "[Removed]");
        if (!articles?.length) return Reply(`❌ No news found for *${topic}*! Try a different topic.`);

        const formatted = articles.map((a, i) => 
            `${i + 1}. *${a.title}*\n   📰 ${a.source?.name || "Unknown"}\n   🔗 ${a.url}`
        ).join("\n\n");

        await raiden.sendMessage(m.chat, {
            text: `🗞️ *NEWS — ${topic.toUpperCase()}*\n\n${formatted}\n\n_Updated: ${new Date().toLocaleString()} 🌹_`
        }, { quoted: m });

    } catch(e) {
        console.error("[News]", e.response?.data || e.message);
        if (e.response?.status === 401) return Reply("❌ Invalid News API key!");
        if (e.response?.status === 429) return Reply("⏳ Rate limit hit! Try again later.");
        Reply("❌ Couldn't fetch news 😅 Try again!");
    }
}
break;

case "topnews":
case "headlines": {
    try {
        await raiden.sendMessage(m.chat, { react: { text: "📰", key: m.key } });

        const country = q || "us";
        const headRes = await axios.get("https://newsapi.org/v2/top-headlines", {
            params: {
                country,
                pageSize: 5,
                apiKey: global.NEWS_KEY
            },
            timeout: 15000
        });

        const articles2 = headRes.data?.articles?.filter(a => a.title && a.title !== "[Removed]");
        if (!articles2?.length) return Reply(`❌ No headlines found for country code *${country}*!\n\nTry: us, gb, ng, za, au, ca`);

        const formatted2 = articles2.map((a, i) =>
            `${i + 1}. *${a.title}*\n   📰 ${a.source?.name || "Unknown"}\n   🔗 ${a.url}`
        ).join("\n\n");

        await raiden.sendMessage(m.chat, {
            text: `📰 *TOP HEADLINES*\n🌍 Country: ${country.toUpperCase()}\n\n${formatted2}\n\n_${new Date().toLocaleString()} 🌹_`
        }, { quoted: m });

    } catch(e) {
        console.error("[Headlines]", e.response?.data || e.message);
        Reply("❌ Couldn't fetch headlines 😅 Try again!");
    }
}
break;


// ═══════════════════════════════════════════════
//  🎵 LYRICS — Genius API
// ═══════════════════════════════════════════════

case "lyrics": {
    if (!q) return Reply(`🎵 *Usage:* ${prefix}lyrics [song name]\nExample: ${prefix}lyrics Essence Wizkid`);
    try {
        await raiden.sendMessage(m.chat, { react: { text: "🎵", key: m.key } });

        // Search for the song
        const searchRes = await axios.get("https://api.genius.com/search", {
            params: { q },
            headers: { "Authorization": `Bearer ${global.GENIUS_KEY}` },
            timeout: 15000
        });

        const hits = searchRes.data?.response?.hits;
        if (!hits?.length) return Reply(`❌ No lyrics found for *${q}*! Try the full song name + artist.`);

        const song = hits[0].result;
        const title = song.title;
        const artist = song.primary_artist?.name;
        const songUrl = song.url;
        const thumbnail = song.song_art_image_thumbnail_url;

        // Scrape lyrics from Genius page
        const pageRes = await axios.get(songUrl, {
            timeout: 20000,
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        // Extract lyrics from HTML
        const html = pageRes.data;
        const lyricsMatch = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);

        let lyricsText = "Lyrics not available for this song.";
        if (lyricsMatch) {
            lyricsText = lyricsMatch
                .join("\n")
                .replace(/<br\/>/gi, "\n")
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .replace(/&#39;/g, "'")
                .trim();
        }

        // Trim if too long for WhatsApp
        if (lyricsText.length > 3000) {
            lyricsText = lyricsText.substring(0, 3000) + "\n\n_...lyrics truncated. Full lyrics: " + songUrl + "_";
        }

        // Send with thumbnail if available
        if (thumbnail) {
            const thumbRes = await axios.get(thumbnail, { responseType: "arraybuffer", timeout: 10000 });
            await raiden.sendMessage(m.chat, {
                image: Buffer.from(thumbRes.data),
                caption: `🎵 *${title}*\n👤 ${artist}\n\n${lyricsText}\n\n🔗 ${songUrl}`
            }, { quoted: m });
        } else {
            await raiden.sendMessage(m.chat, {
                text: `🎵 *${title}*\n👤 ${artist}\n\n${lyricsText}\n\n🔗 ${songUrl}`
            }, { quoted: m });
        }

    } catch(e) {
        console.error("[Lyrics]", e.response?.data || e.message);
        if (e.response?.status === 401) return Reply("❌ Invalid Genius API key!");
        Reply("❌ Couldn't fetch lyrics 😅 Try the song name + artist name!");
    }
}
break;


// ═══════════════════════════════════════════════
//  🌤️ WEATHER — OpenWeatherMap
// ═══════════════════════════════════════════════

case "weather":
case "wx": {
    if (!q) return Reply(`🌤️ *Usage:* ${prefix}weather [city]\nExample: ${prefix}weather Lagos`);
    try {
        await raiden.sendMessage(m.chat, { react: { text: "🌤️", key: m.key } });

        const wxRes = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
            params: {
                q,
                appid: global.WEATHER_KEY,
                units: "metric"
            },
            timeout: 15000
        });

        const d = wxRes.data;
        const name     = d.name;
        const country  = d.sys?.country;
        const temp     = Math.round(d.main?.temp);
        const feels    = Math.round(d.main?.feels_like);
        const tempMin  = Math.round(d.main?.temp_min);
        const tempMax  = Math.round(d.main?.temp_max);
        const humidity = d.main?.humidity;
        const wind     = d.wind?.speed;
        const desc     = d.weather?.[0]?.description;
        const vis      = d.visibility ? (d.visibility / 1000).toFixed(1) + " km" : "N/A";
        const sunrise  = new Date(d.sys?.sunrise * 1000).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
        const sunset   = new Date(d.sys?.sunset  * 1000).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

        // Weather emoji based on condition
        const wid = d.weather?.[0]?.id;
        let wxEmoji = "🌡️";
        if (wid >= 200 && wid < 300) wxEmoji = "⛈️";
        else if (wid >= 300 && wid < 400) wxEmoji = "🌧️";
        else if (wid >= 500 && wid < 600) wxEmoji = "🌧️";
        else if (wid >= 600 && wid < 700) wxEmoji = "❄️";
        else if (wid >= 700 && wid < 800) wxEmoji = "🌫️";
        else if (wid === 800) wxEmoji = "☀️";
        else if (wid > 800) wxEmoji = "☁️";

        await raiden.sendMessage(m.chat, {
            text: `${wxEmoji} *WEATHER — ${name}, ${country}*

🌡️ Temp     : *${temp}°C* (feels like ${feels}°C)
🔼 High     : ${tempMax}°C  |  🔽 Low: ${tempMin}°C
💧 Humidity : ${humidity}%
💨 Wind     : ${wind} m/s
👁️ Visibility: ${vis}
🌥️ Condition: ${desc}
🌅 Sunrise  : ${sunrise}
🌇 Sunset   : ${sunset}

_Updated: ${new Date().toLocaleString()} 🌹_`
        }, { quoted: m });

    } catch(e) {
        console.error("[Weather]", e.response?.data || e.message);
        if (e.response?.status === 401) return Reply("❌ Invalid Weather API key!");
        if (e.response?.status === 404) return Reply(`❌ City *${q}* not found! Check the spelling.`);
        Reply("❌ Couldn't fetch weather 😅 Try again!");
    }
}
break;

case "forecast": {
    if (!q) return Reply(`📅 *Usage:* ${prefix}forecast [city]\nExample: ${prefix}forecast Abuja`);
    try {
        await raiden.sendMessage(m.chat, { react: { text: "📅", key: m.key } });

        const fcRes = await axios.get("https://api.openweathermap.org/data/2.5/forecast", {
            params: {
                q,
                appid: global.WEATHER_KEY,
                units: "metric",
                cnt: 5
            },
            timeout: 15000
        });

        const city = fcRes.data.city?.name;
        const country2 = fcRes.data.city?.country;
        const list = fcRes.data.list;

        const days = list.map(item => {
            const time = new Date(item.dt * 1000).toLocaleString([], { weekday:"short", hour:"2-digit", minute:"2-digit" });
            const tmp  = Math.round(item.main?.temp);
            const desc2 = item.weather?.[0]?.description;
            return `📌 ${time} — *${tmp}°C*, ${desc2}`;
        }).join("\n");

        await raiden.sendMessage(m.chat, {
            text: `📅 *5-STEP FORECAST — ${city}, ${country2}*\n\n${days}\n\n_🌹 RIAS Weather_`
        }, { quoted: m });

    } catch(e) {
        console.error("[Forecast]", e.response?.data || e.message);
        if (e.response?.status === 404) return Reply(`❌ City *${q}* not found!`);
        Reply("❌ Couldn't fetch forecast 😅 Try again!");
    }
}
break;


// ═══════════════════════════════════════════════
//  🎮 FUN MENU
// ═══════════════════════════════════════════════

case "funmenu": {
    try {
        const funText = `
🎮 𝐑𝐈𝐀𝐒 — 𝐅𝐔𝐍 𝐌𝐄𝐍𝐔

┌─────────────────────
│ 🎲 𝐆𝐀𝐌𝐄𝐒
│ ▸ ${prefix}truth ▸ ${prefix}dare
│ ▸ ${prefix}trivia ▸ ${prefix}riddle
│ ▸ ${prefix}never ▸ ${prefix}would
│ ▸ ${prefix}hangman ▸ ${prefix}guess
│ ▸ ${prefix}ttt @user
│ ▸ ${prefix}fight @u1 @u2
│
│ 🎯 𝐑𝐀𝐍𝐃𝐎𝐌
│ ▸ ${prefix}8ball [question]
│ ▸ ${prefix}ship @u1 @u2
│ ▸ ${prefix}simp @user
│ ▸ ${prefix}roll ▸ ${prefix}random
│ ▸ ${prefix}choose a | b | c
│ ▸ ${prefix}meme ▸ ${prefix}rizz
│
│ 💰 𝐄𝐂𝐎𝐍𝐎𝐌𝐘
│ ▸ ${prefix}balance ▸ ${prefix}daily
│ ▸ ${prefix}work ▸ ${prefix}rob
│ ▸ ${prefix}pay ▸ ${prefix}shop
│ ▸ ${prefix}buy ▸ ${prefix}inventory
│ ▸ ${prefix}leaderboard
└─────────────────────

_RIAS Fun Zone 🌹_
`;
        const msg2 = generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            contextInfo: {
                                forwardingScore: 99999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: global.newsletterJid,
                                    serverMessageId: 1,
                                    newsletterName: global.newsletterName
                                }
                            },
                            header: proto.Message.InteractiveMessage.Header.create({
                                hasMediaAttachment: true,
                                imageMessage: (await prepareWAMessageMedia({ image: global.riasImage }, { upload: raiden.waUploadToServer })).imageMessage
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({ text: funText }),
                            footer: proto.Message.InteractiveMessage.Footer.create({ text: global.footer }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎲 𝘎𝘢𝘮𝘦𝘴", id: `${prefix}trivia` }) },
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "💰 𝘌𝘤𝘰𝘯𝘰𝘮𝘺", id: `${prefix}balance` }) },
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏠 𝘔𝘢𝘪𝘯 𝘔𝘦𝘯𝘶", id: `${prefix}menu` }) }
                                ]
                            })
                        })
                    }
                }
            },
            { quoted: m }
        );
        await raiden.relayMessage(m.chat, msg2.message, { messageId: msg2.key.id });
    } catch(e) { console.log(e); Reply(mess.error); }
}
break;

// ═══════════════════════════════════════════════
//  🛠️ TOOLS MENU
// ═══════════════════════════════════════════════

case "toolsmenu": {
    try {
        const toolsText = `
🛠️ 𝐑𝐈𝐀𝐒 — 𝐓𝐎𝐎𝐋𝐒 𝐌𝐄𝐍𝐔

┌─────────────────────
│ 🌐 𝐔𝐓𝐈𝐋𝐈𝐓𝐘
│ ▸ ${prefix}calc [expression]
│ ▸ ${prefix}wiki [topic]
│ ▸ ${prefix}weather [city]
│ ▸ ${prefix}forecast [city]
│ ▸ ${prefix}time [timezone]
│ ▸ ${prefix}news [topic]
│ ▸ ${prefix}headlines [country]
│ ▸ ${prefix}github [user/repo]
│ ▸ ${prefix}npm [package]
│
│ 🎵 𝐌𝐄𝐃𝐈𝐀
│ ▸ ${prefix}play [song]
│ ▸ ${prefix}ytmp3 [url/name]
│ ▸ ${prefix}ytmp4 [url/name]
│ ▸ ${prefix}tiktok [url]
│ ▸ ${prefix}ig [url]
│ ▸ ${prefix}twitter [url]
│ ▸ ${prefix}fb [url]
│ ▸ ${prefix}lyrics [song]
│
│ 🖼️ 𝐈𝐌𝐀𝐆𝐄 𝐓𝐎𝐎𝐋𝐒
│ ▸ ${prefix}sticker ▸ ${prefix}toimg
│ ▸ ${prefix}blur ▸ ${prefix}enhance
│ ▸ ${prefix}gif ▸ ${prefix}qr [text]
│ ▸ ${prefix}ss [url]
│ ▸ ${prefix}imagine [prompt]
│ ▸ ${prefix}tts [text]
└─────────────────────

_RIAS Tools 🌹_
`;
        const msg3 = generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            contextInfo: {
                                forwardingScore: 99999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: global.newsletterJid,
                                    serverMessageId: 1,
                                    newsletterName: global.newsletterName
                                }
                            },
                            header: proto.Message.InteractiveMessage.Header.create({
                                hasMediaAttachment: true,
                                imageMessage: (await prepareWAMessageMedia({ image: global.riasImage }, { upload: raiden.waUploadToServer })).imageMessage
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({ text: toolsText }),
                            footer: proto.Message.InteractiveMessage.Footer.create({ text: global.footer }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🌤️ 𝘞𝘦𝘢𝘵𝘩𝘦𝘳", id: `${prefix}weather Lagos` }) },
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🎵 𝘋𝘰𝘸𝘯𝘭𝘰𝘢𝘥", id: `${prefix}play` }) },
                                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏠 𝘔𝘢𝘪𝘯 𝘔𝘦𝘯𝘶", id: `${prefix}menu` }) }
                                ]
                            })
                        })
                    }
                }
            },
            { quoted: m }
        );
        await raiden.relayMessage(m.chat, msg3.message, { messageId: msg3.key.id });
    } catch(e) { console.log(e); Reply(mess.error); }
}
break;

    default:
        break;
    } // closes switch(command)

 } catch (err) {
console.log(require("util").format(err));
}
}



//~~~~~Status updated~~~~~//
let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
    delete require.cache[file]
    require(file)
})
