// ── Polyfill crypto FIRST ────────────────────────────────────
const { webcrypto } = require('crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pairNumber, restoreAllSessions } = require('./wa');
const { deployTelegram } = require('./tg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Health ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'RIAS online 🔴', version: '2.0.0', bot: 'RIAS by Jinx Official' });
});

// ── WhatsApp: pair ───────────────────────────────────────────
app.post('/api/wa/pair', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Phone number is required.' });
  number = String(number).replace(/[^0-9]/g, '');
  if (number.length < 7) return res.status(400).json({ error: 'Invalid phone number.' });

  try {
    const result = await pairNumber(number);
    if (result === 'ALREADY_LINKED') {
      return res.json({ code: null, message: 'This number is already linked to RIAS ✅' });
    }
    return res.json({ code: result });
  } catch (err) {
    console.error('[WA pair error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Telegram: deploy ─────────────────────────────────────────
app.post('/api/tg/deploy', async (req, res) => {
  const { token, userId } = req.body;
  if (!token || !token.includes(':'))
    return res.status(400).json({ error: 'Invalid bot token.' });
  if (!userId || isNaN(userId))
    return res.status(400).json({ error: 'Invalid Telegram user ID.' });
  try {
    const result = await deployTelegram(token, userId);
    return res.json(result);
  } catch (err) {
    console.error('[TG deploy error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🔴 RIAS backend running on port ${PORT}`);
  console.log(`   Bot: RIAS | Author: Jinx Official\n`);
  // Restore all previously paired WhatsApp sessions
  await restoreAllSessions();
});
