const fs   = require('fs')
const path = require('path')

// ===============================
// 🔌 BOT BASIC CONFIGURATION
// ===============================
global.connect   = true
global.status    = true
global.Ownername = "𝕵𝔦𝔫𝔵 𝔖𝔞m͜͡𝔞"
global.owner     = ["2348075997375"]
global.prefix    = ["", ".", "!", "/"]
global.packname  = "𝐑𝐈𝐀𝐒 𝐀𝐈"
global.Bailey    = "Bᴀɪʟᴇʏ"

// ===============================
// 👑 BOT IDENTITY SETTINGS
// ===============================
global.Botname       = "𝐑𝐈𝐀𝐒 𝐀𝐈"
global.latestversion = "3.0"
global.botMode       = "public"

// ===============================
// ⚙️ FEATURE TOGGLES
// ===============================
global.autoTyping   = true
global.autoRead     = false
global.autoRecord   = false
global.autobio      = false
global.autoreply    = true
global.antiLink     = false
global.antiFake     = false
global.antiDelete   = true
global.antiSpam     = true
global.antibugMode  = false

// ===============================
// 📩 MESSAGE RESPONSES
// ===============================
global.mess = {
  owner: "🔐 *𝗢𝘄𝗻𝗲𝗿 𝗢𝗻𝗹𝘆!*",
  wait:  "⏳ *𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴...*",
  done:  "✅ *𝗦𝘂𝗰𝗰𝗲𝘀𝘀!*",
  error: "❌ *𝗘𝗿𝗿𝗼𝗿 𝗢𝗰𝗰𝘂𝗿𝗿𝗲𝗱!*"
}

// ===============================
// 💾 MEDIA GLOBALS (LOCAL FILES)
// ===============================
function safeRead(filePath) {
  const fullPath = path.resolve(__dirname, filePath)
  if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath)
  console.warn(`\x1b[33m[WARN] Missing media file: ${filePath}\x1b[0m`)
  return null
}

// RIAS uses catbox images directly — local files kept as fallback
global.vecImage      = safeRead('./lib/image/vec.jpg')
global.vecOwnerImage = safeRead('./lib/image/vec2.jpg')
global.androidImage  = safeRead('./lib/image/vec3.jpg')
global.iosImage      = safeRead('./lib/image/vec4.jpg')
global.groupImage    = safeRead('./lib/image/vec5.jpg')
global.specialImage  = safeRead('./lib/image/vec1.jpg')
global.menuAudio     = safeRead('./lib/menu.mp3')

// RIAS image URLs (used in menus)
global.riasImage     = { url: "https://files.catbox.moe/h0flrc.jpg" }
global.riasOwnerImg  = { url: "https://files.catbox.moe/pvmmqz.jpg" }

// ===============================
// 📝 FOOTER & NEWSLETTER
// ===============================
global.footer          = "🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 • 𝗠𝗮𝗱𝗲 𝗯𝘆 𝗝𝗶𝗻𝘅"
global.newsletterJid   = "120363400223871259@newsletter"
global.newsletterName  = "🌹 𝗥𝗜𝗔𝗦 𝗔𝗜 • 𝗝𝗶𝗻𝘅 𝗢𝗳𝗳𝗶𝗰𝗶𝗮𝗹"

// ===============================
// 🤖 AI CONFIG
// ===============================
global.GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyCMs3-yP3wlWwnhprO9iE_t-oEYDpDjl1M"

// ===============================
// 🎨 IMAGE GENERATION (Together AI)
// Get key: together.ai → Settings → API Keys
// ===============================
global.IMAGINE_KEY = process.env.IMAGINE_KEY || "tgp_v1_GSQTgdAaT98qEPIBaSu3VzjT_OxOYhlOo5sztX9OMbE"

// ===============================
// 🗞️ NEWS (NewsAPI)
// Get key: newsapi.org → Register
// ===============================
global.NEWS_KEY = process.env.NEWS_KEY || "78e160db7d8d49f3af92c36107ee7528"

// ===============================
// 🎵 LYRICS (Genius)
// Get key: genius.com/api-clients → New API Client
// ===============================
global.GENIUS_KEY = process.env.GENIUS_KEY || "gJLrt6b_q9QdwrRgR6ifr4cQhG8klAYHo3UI"

// Chat sessions memory for .rias conversation mode
global.riasChatSessions = global.riasChatSessions || new Map()

// ===============================
// ⚡ HOT RELOAD
// ===============================
let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log('\x1b[32mCONFIG UPDATED:\x1b[0m', __filename)
  delete require.cache[file]
  require(file)
})
