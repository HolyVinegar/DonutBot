const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const fs = require('fs');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

const TOKEN = 'MTQ4MzY1ODQzMDQ1MDM2ODU2Mw.GC1AUq.mXfeBQWiipc2ou4UrJ-vjhn6vfa41278RjPOec'
const CLIENT_ID = '1483658430450368563'
const GUILD_ID = '1483660541418278922'
const ADMIN_ID = '749512363664867370'
const PANEL_CHANNEL_ID = '1487766025687531530';
const EXECUTOR_IP = 'http://localhost:6000';

// ===== JSON =====
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

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName('link').setDescription('Link account'),

  new SlashCommandBuilder().setName('balance').setDescription('Check balance'),

  new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw money')
    .addStringOption(opt =>
      opt.setName('amount')
        .setDescription('Amount (1k, 2m)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Admin add balance')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to give money')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('amount')
        .setDescription('Amount (1k, 2m, etc)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('processwithdrawals')
    .setDescription('Admin process')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// ===== CLIENT =====
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_withdraw')
      .setLabel('🚀 Start Withdraw Mode')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: "⚙️ Admin Panel",
    components: [row]
  });
});

// ===== RECEIVE FROM MC BOT =====
app.post('/payment', async (req, res) => {
  const { type, discordId, player, amount } = req.body;

  try {
    const user = await client.users.fetch(discordId);

    if (type === "link") {
      await user.send(`🔗 You are linked with **${player}**`);
    }

    if (type === "deposit") {
      await user.send(`💰 Received $${amount}`);
    }
  } catch { }

  res.json({ ok: true });
});

app.listen(3000, () => console.log("🌐 Discord API 3000"));

// ===== INTERACTIONS =====
client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  let balances = loadJSON('balances.json');
  let linked = loadJSON('linked.json');
  let withdrawals = loadJSON('withdrawals.json');
  let linkCodes = loadJSON('linkCodes.json');

  if (!Array.isArray(withdrawals)) withdrawals = [];

  const id = interaction.user.id;

  // ===== LINK =====
  if (interaction.commandName === 'link') {

    if (linked[id]) {
      return interaction.reply("❌ Already linked");
    }

    let code;
    do {
      code = Math.floor(100 + Math.random() * 900);
    } while (Object.values(linkCodes).includes(code));

    linkCodes[id] = code;
    saveJSON('linkCodes.json', linkCodes);

    return interaction.reply(`💸 Pay **$${code}** in-game to link`);
  }

  // ===== BALANCE =====
  if (interaction.commandName === 'balance') {
    return interaction.reply(`💰 $${balances[id] || 0}`);
  }

  // ===== PARSE AMOUNT =====
  function parseAmount(input) {
    input = input.toLowerCase();
    let num = parseInt(input);

    if (input.endsWith('k')) num *= 1000;
    if (input.endsWith('m')) num *= 1000000;
    if (input.endsWith('b')) num *= 1000000000;

    return num;
  }

  // ===== WITHDRAW =====
  if (interaction.commandName === 'withdraw') {

    if (!linked[id]) return interaction.reply("❌ Link first");

    let input = interaction.options.getString('amount');
    let amount = parseAmount(input);

    if (!amount || amount <= 0) return interaction.reply("❌ Invalid amount");

    if ((balances[id] || 0) < amount) {
      return interaction.reply("❌ Not enough balance");
    }

    balances[id] -= amount;

    withdrawals.push({
      id: Date.now(),
      discordId: id,
      mcUser: linked[id],
      amount,
      status: "pending"
    });

    saveJSON('balances.json', balances);
    saveJSON('withdrawals.json', withdrawals);

    return interaction.reply(`📤 Withdraw queued: $${amount}`);
  }

  // ===== ADMIN DEPOSIT =====
  if (interaction.commandName === 'deposit') {
    if (id !== ADMIN_ID) return interaction.reply("❌ Not allowed");

    const user = interaction.options.getUser('user');
    let amount = parseAmount(interaction.options.getString('amount'));

    balances[user.id] = (balances[user.id] || 0) + amount;
    saveJSON('balances.json', balances);

    return interaction.reply(`✅ Added $${amount} to ${user.username}`);
  }

  // ===== PROCESS =====
  if (interaction.commandName === 'processwithdrawals') {

    if (id !== ADMIN_ID) return interaction.reply("❌ Not allowed");

    const pending = withdrawals.filter(w => w.status === "pending");

    if (pending.length === 0) return interaction.reply("No pending");

    await axios.post(`${EXECUTOR_IP}/process`, pending);

    withdrawals.forEach(w => {
      if (w.status === "pending") w.status = "done";
    });

    saveJSON('withdrawals.json', withdrawals);

    return interaction.reply(`✅ Processed ${pending.length}`);
  }
});

client.login(TOKEN);