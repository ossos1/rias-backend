const express = require('express');
const cors = require('cors');
const { connectWhatsApp, pairNumber } = require('./wa');
const { deployTelegram } = require('./tg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Health check ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'RIAS backend online 🔴', version: '1.0.0' });
});

// ─── WhatsApp: get pairing code ─────────────────────────────
app.post('/api/wa/pair', async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Phone number is required.' });

  const clean = number.replace(/\D/g, '');
  if (clean.length < 7) return res.status(400).json({ error: 'Invalid phone number.' });

  try {
    const code = await pairNumber(clean);
    return res.json({ code });
  } catch (err) {
    console.error('[WA pair error]', err);
    return res.status(500).json({ error: err.message || 'Failed to generate pairing code.' });
  }
});

// ─── Telegram: deploy bot ────────────────────────────────────
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
    console.error('[TG deploy error]', err);
    return res.status(500).json({ error: err.message || 'Deployment failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔴 RIAS backend running on port ${PORT}\n`);
});
