const bedrock = require('bedrock-protocol');
const express = require('express');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(express.json());

let bot;
let running = true;

function loadJSON(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let lastPayments = [];

function parseAmount(raw) {
  raw = raw.toLowerCase();
  let num = parseInt(raw);

  if (raw.endsWith('k')) num *= 1000;
  if (raw.endsWith('m')) num *= 1000000;
  if (raw.endsWith('b')) num *= 1000000000;

  return num;
}

function startBot() {
  if (!running) return;

  bot = bedrock.createClient({
    host: 'oce.donutsmp.net',
    port: 19132,
    username: 'YOUR_EMAIL',
    offline: false
  });

  bot.on('text', async (packet) => {
    if (!packet.message) return;

    const msg = packet.message.replace(/§./g, '');
    console.log("📩", msg);

    const match = msg.match(/([.\w]+) paid you \$([0-9]+[kmb]?)/i);
    if (!match) return;

    const player = match[1];
    const raw = match[2];
    const amount = parseAmount(raw);

    const key = `${player}-${amount}`;
    if (lastPayments.includes(key)) return;

    lastPayments.push(key);
    setTimeout(() => {
      lastPayments = lastPayments.filter(k => k !== key);
    }, 5000);

    const linkCodes = loadJSON('linkCodes.json');
    const linked = loadJSON('linked.json');
    const balances = loadJSON('balances.json');

    // ===== LINK =====
    for (const discordId in linkCodes) {
      if (linkCodes[discordId] === amount && !linked[discordId]) {

        linked[discordId] = player.toLowerCase();
        saveJSON('linked.json', linked);

        delete linkCodes[discordId];
        saveJSON('linkCodes.json', linkCodes);

        console.log(`🔗 Linked ${discordId} -> ${player}`);

        await axios.post('http://localhost:3000/payment', {
          type: "link",
          discordId,
          player
        }).catch(()=>{});

        return;
      }
    }

    // ===== DEPOSIT =====
    const discordId = Object.keys(linked)
      .find(id => linked[id].toLowerCase() === player.toLowerCase());

    if (!discordId) return;

    balances[discordId] = (balances[discordId] || 0) + amount;
    saveJSON('balances.json', balances);

    console.log(`💰 Deposited $${amount}`);

    await axios.post('http://localhost:3000/payment', {
      type: "deposit",
      discordId,
      amount
    }).catch(()=>{});
  });

  bot.on('disconnect', () => {
    if (running) setTimeout(startBot, 5000);
  });
}

startBot();

// ===== API =====
app.post('/stop-bot', (req, res) => {
  running = false;
  if (bot) bot.disconnect();
  res.json({ ok: true });
});

app.listen(5000, () => console.log("MC API 5000"));