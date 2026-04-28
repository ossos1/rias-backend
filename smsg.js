const { proto, getContentType, jidDecode } = require("@whiskeysockets/baileys");

function decode(jid) {
  if (!jid) return jid;
  if (/:\d+@/gi.test(jid)) {
    let decode = jidDecode(jid) || {};
    return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
  } else return jid;
}


function smsg(Cryptolord, m, store) {
  if (!m) return m;
  let M = proto.WebMessageInfo;

  // === Basic Keys ===
  if (m.key) {
    m.id = m.key.id;
    m.isBaileys = m.id?.startsWith("BAE5") && m.id?.length === 16;
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isGroup = m.chat?.endsWith("@g.us");

    m.sender = m.fromMe
      ? decode(Cryptolord.user.id)
      : decode(m.participant || m.key.participant || m.chat);

    if (m.isGroup) m.participant = decode(m.key.participant) || "";
  }

  // === Message Body ===
  if (m.message) {
    m.mtype = getContentType(m.message);

    m.msg =
      m.mtype === "viewOnceMessage"
        ? m.message[m.mtype]?.message?.[getContentType(m.message[m.mtype]?.message)]
        : m.message[m.mtype];

    m.body =
      m.message.conversation ||
      m.msg?.caption ||
      m.msg?.text ||
      (m.mtype === "listResponseMessage" && m.msg?.singleSelectReply?.selectedRowId) ||
      (m.mtype === "buttonsResponseMessage" && m.msg?.selectedButtonId) ||
      (m.mtype === "viewOnceMessage" && m.msg?.caption) ||
      m.text;

    // === Quoted Handling ===
    let quoted = (m.quoted = m.msg?.contextInfo?.quotedMessage || null);
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];

    if (m.quoted) {
      let type = getContentType(quoted);
      m.quoted = m.quoted?.[type];

      if (["productMessage"].includes(type)) {
        type = getContentType(m.quoted);
        m.quoted = m.quoted?.[type];
      }

      if (typeof m.quoted === "string") m.quoted = { text: m.quoted };

      m.quoted.mtype = type;
      m.quoted.id = m.msg?.contextInfo?.stanzaId;
      m.quoted.chat = m.msg?.contextInfo?.remoteJid || m.chat;

      m.quoted.isBaileys = m.quoted.id
        ? m.quoted.id.startsWith("BAE5") && m.quoted.id.length === 16
        : false;

      m.quoted.sender = decode(m.msg?.contextInfo?.participant);
      m.quoted.fromMe = m.quoted.sender === decode(Cryptolord.user.id);

      m.quoted.text =
        m.quoted.text ||
        m.quoted.caption ||
        m.quoted.conversation ||
        m.quoted.contentText ||
        m.quoted.selectedDisplayText ||
        m.quoted.title ||
        "";

      m.quoted.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];

      m.getQuotedObj = m.getQuotedMessage = async () => {
        if (!m.quoted.id) return false;
        let q = await store.loadMessage(m.chat, m.quoted.id);
        return smsg(Cryptolord, q, store);
      };

      let vM = (m.quoted.fakeObj = M.fromObject({
        key: {
          remoteJid: m.quoted.chat,
          fromMe: m.quoted.fromMe,
          id: m.quoted.id,
        },
        message: quoted,
        ...(m.isGroup ? { participant: m.quoted.sender } : {}),
      }));

      m.quoted.delete = () =>
        Cryptolord.sendMessage(m.quoted.chat, { delete: vM.key });

      m.quoted.copyNForward = (jid, forceForward = false, options = {}) =>
        Cryptolord.copyNForward(jid, vM, forceForward, options);

      m.quoted.download = () =>
        Cryptolord.downloadMediaMessage(m.quoted);
    }
  }

  // === Download Helper ===
  if (m.msg?.url) m.download = () => Cryptolord.downloadMediaMessage(m.msg);

  // === Normalize Text ===
  m.text =
    m.msg?.text ||
    m.msg?.caption ||
    m.message?.conversation ||
    m.msg?.contentText ||
    m.msg?.selectedDisplayText ||
    m.msg?.title ||
    "";

  // === Quick Reply ===
  m.reply = (text, chatId = m.chat, options = {}) =>
    Buffer.isBuffer(text)
      ? Cryptolord.sendMessage(
          chatId,
          { document: text, mimetype: "application/octet-stream", fileName: "file" },
          { quoted: m, ...options }
        )
      : Cryptolord.sendMessage(chatId, { text, ...options }, { quoted: m });

  // === Copy & Forward ===
  m.copy = () => smsg(Cryptolord, M.fromObject(M.toObject(m)), store);
  m.copyNForward = (jid = m.chat, forceForward = false, options = {}) =>
    Cryptolord.copyNForward(jid, m, forceForward, options);

  return m;
}

module.exports = smsg;