// ==========================
// IMPORTS
// ==========================
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const bedrock = require('bedrock-protocol');
const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const admin = require('firebase-admin');




// ==========================
// FIREBASE SETUP
// ==========================
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://c-37-project-9153a-default-rtdb.firebaseio.com"
});

const db = admin.database();
async function getData(path) { const snap = await db.ref(path).once('value'); return snap.val() || {}; }
async function setData(path, value) { await db.ref(path).set(value); }
async function updateData(path, value) { await db.ref(path).update(value); }

// ==========================
// CONFIG
// ==========================
const CONFIG = {
  // New (env variable)
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: "1483658430450368563",
  GUILD_ID: "1483660541418278922",
  ADMIN_ID: "749512363664867370",
  PANEL_CHANNEL_ID: "1487766025687531530",
  EXECUTOR_IP: "http://localhost:6000", // executor runs in same service
  MC_HOST: "oce.donutsmp.net",
  MC_PORT: 19132,
  MC_EMAIL: "tauheedadspam@gmail.com"
};

// ==========================
// EXPRESS SETUP
// ==========================
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// ==========================
// DISCORD BOT
// ==========================
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Register slash commands
const commands = [
  new SlashCommandBuilder().setName('link').setDescription('Link account'),
  new SlashCommandBuilder().setName('balance').setDescription('Check balance'),
  new SlashCommandBuilder()
    .setName('withdraw').setDescription('Withdraw money')
    .addStringOption(opt => opt.setName('amount').setDescription('Amount (1k,2m)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('deposit').setDescription('Admin add balance')
    .addUserOption(opt => opt.setName('user').setDescription('User to give money').setRequired(true))
    .addStringOption(opt => opt.setName('amount').setDescription('Amount (1k,2m)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('processwithdrawals').setDescription('Admin process')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
})();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(CONFIG.PANEL_CHANNEL_ID);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('start_withdraw').setLabel('🚀 Start Withdraw Mode').setStyle(ButtonStyle.Danger)
    );
    await channel.send({ content: "⚙️ Admin Panel", components: [row] });
  } catch { console.log("⚠️ Panel channel not found"); }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const id = interaction.user.id;
  let balances = await getData('balances');
  let linked = await getData('linked');
  let withdrawals = await getData('withdrawals') || [];
  let linkCodes = await getData('linkCodes') || {};

  function parseAmount(input) {
    input = input.toLowerCase().trim();
    let num = parseInt(input);
    if (isNaN(num)) return 0;
    if (input.endsWith('k')) num *= 1_000;
    if (input.endsWith('m')) num *= 1_000_000;
    if (input.endsWith('b')) num *= 1_000_000_000;
    return num;
  }

  // LINK
  if (interaction.commandName === 'link') {
    if (linked[id]) return interaction.reply("❌ Already linked");
    let code;
    do { code = Math.floor(100 + Math.random() * 900); } while (Object.values(linkCodes).includes(code));
    linkCodes[id] = code;
    await setData('linkCodes', linkCodes);
    return interaction.reply(`💸 Pay **$${code}** in-game to link`);
  }

  // BALANCE
  if (interaction.commandName === 'balance') return interaction.reply(`💰 $${balances[id] || 0}`);

  // WITHDRAW
  if (interaction.commandName === 'withdraw') {
    if (!linked[id]) return interaction.reply("❌ Link first");
    let amount = parseAmount(interaction.options.getString('amount'));
    if (!amount || amount <= 0) return interaction.reply("❌ Invalid amount");
    if ((balances[id] || 0) < amount) return interaction.reply("❌ Not enough balance");

    balances[id] -= amount;
    withdrawals.push({ id: Date.now(), discordId: id, mcUser: linked[id], amount, status: "pending" });
    await setData('balances', balances);
    await setData('withdrawals', withdrawals);

    return interaction.reply(`📤 Withdraw queued: $${amount}`);
  }

  // ADMIN DEPOSIT
  if (interaction.commandName === 'deposit') {
    if (id !== CONFIG.ADMIN_ID) return interaction.reply("❌ Not allowed");
    const user = interaction.options.getUser('user');
    let amount = parseAmount(interaction.options.getString('amount'));
    balances[user.id] = (balances[user.id] || 0) + amount;
    await setData('balances', balances);
    return interaction.reply(`✅ Added $${amount} to ${user.username}`);
  }

  // PROCESS WITHDRAWALS
  if (interaction.commandName === 'processwithdrawals') {
    if (id !== CONFIG.ADMIN_ID) return interaction.reply("❌ Not allowed");
    const pending = withdrawals.filter(w => w.status === "pending");
    if (!pending.length) return interaction.reply("No pending withdrawals");

    await axios.post(CONFIG.EXECUTOR_IP + '/process', pending);
    withdrawals.forEach(w => { if (w.status === "pending") w.status = "done"; });
    await setData('withdrawals', withdrawals);
    return interaction.reply(`✅ Processed ${pending.length}`);
  }
});

client.login(CONFIG.DISCORD_TOKEN);

// ==========================
// MC BOT
// ==========================
let lastPayments = [];
let running = true;

function startMCBot() {
  if (!running) return;
  const bot = bedrock.createClient({
    host: CONFIG.MC_HOST,
    port: CONFIG.MC_PORT,
    username: CONFIG.MC_EMAIL,
    offline: false
  });

  bot.on('text', async packet => {
    if (!packet.message) return;
    const msg = packet.message.replace(/§./g, '');
    console.log("📩", msg);
    const match = msg.match(/([.\w]+) paid you \$([0-9]+[kmb]?)/i);
    if (!match) return;

    const player = match[1];
    const raw = match[2];
    let amount = parseInt(raw.toLowerCase().replace(/[kmb]/, '')); // fallback
    if (raw.toLowerCase().endsWith('k')) amount *= 1_000;
    if (raw.toLowerCase().endsWith('m')) amount *= 1_000_000;
    if (raw.toLowerCase().endsWith('b')) amount *= 1_000_000_000;

    const key = `${player}-${amount}`;
    if (lastPayments.includes(key)) return;
    lastPayments.push(key);
    setTimeout(() => { lastPayments = lastPayments.filter(k => k !== key); }, 5000);

    let linkCodes = await getData('linkCodes');
    let linked = await getData('linked');
    let balances = await getData('balances');

    // LINK
    for (const discordId in linkCodes) {
      if (linkCodes[discordId] <= amount && !linked[discordId]) {
        linked[discordId] = player.toLowerCase();
        delete linkCodes[discordId];
        await setData('linked', linked);
        await setData('linkCodes', linkCodes);

        await axios.post(`http://localhost:${PORT}/payment`, { type: "link", discordId, player }).catch(()=>{});
        return;
      }
    }

    // DEPOSIT
    const discordId = Object.keys(linked).find(id => linked[id].toLowerCase() === player.toLowerCase());
    if (!discordId) return;

    balances[discordId] = (balances[discordId] || 0) + amount;
    await setData('balances', balances);

    await axios.post(`http://localhost:${PORT}/payment`, { type: "deposit", discordId, amount }).catch(()=>{});
    console.log(`💰 Deposited $${amount} to ${discordId}`);
  });

  bot.on('disconnect', () => { if (running) setTimeout(startMCBot, 5000); });
}

startMCBot();

// ==========================
// EXECUTOR (Withdraw / AutoHotkey)
// ==========================
app.post('/process', async (req, res) => {
  const withdrawals = req.body;

  withdrawals.forEach((w, i) => {
    setTimeout(() => {
      const cmd = `/pay ${w.mcUser} ${w.amount}`;
      console.log("💸", cmd);
      exec(`AutoHotkey.exe pay.ahk "${cmd}"`);
    }, i * 4000);
  });

  // Mark as done
  let allWithdrawals = await getData('withdrawals');
  withdrawals.forEach(w => {
    const index = allWithdrawals.findIndex(x => x.id === w.id);
    if (index !== -1) allWithdrawals[index].status = "done";
  });
  await setData('withdrawals', allWithdrawals);

  res.json({ success: true });
});

// ==========================
// STOP MC BOT
// ==========================
app.post('/stop-bot', (req, res) => {
  running = false;
  res.json({ ok: true });
});