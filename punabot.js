// --- punabot.js ---
import { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';
import fetch from 'node-fetch';
import express from 'express';
import ms from "ms";
import os from 'os';
import { MongoClient } from "mongodb";
import fs from 'fs';
import crypto from "crypto";
const jokes = JSON.parse(fs.readFileSync('./jokes.json', 'utf-8'));
const triviaData = JSON.parse(fs.readFileSync('./trivia.json', 'utf-8'));
// --- Constants ---
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ No MongoDB connection string found in environment!");
  process.exit(1);
}
const clientDB = new MongoClient(MONGO_URI);
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HYPIXEL_KEY = process.env.HYPIXEL_KEY;
// --- Discord client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});
// --- Globals ---
let db;
let giveawayRoles;
let settingsCollection;
const triviaState = {};
// --- Start Trivia Round ---
async function startTriviaRound(channel) {
  const guildId = channel.guild.id;
  if (triviaState[guildId]?.active) return;
  const randomIndex = Math.floor(Math.random() * triviaData.length);
  const currentTrivia = triviaData[randomIndex];
  triviaState[guildId] = {
    active: true,
    currentTrivia,
    timeout: setTimeout(() => {
      triviaState[guildId].active = false;
      triviaState[guildId].currentTrivia = null;
      channel.send('⏰ Trivia round ended. No one got it in time!');
    }, 5 * 60 * 1000)
  };
  const button = new ButtonBuilder()
    .setCustomId('triviaAnswer')
    .setLabel('Answer Trivia')
    .setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(button);
  channel.send({ content: `🧠 Trivia Time!\n${currentTrivia.question}`, components: [row] });
}
client.on('interactionCreate', async (interaction) => {
  const guildId = interaction.guildId;
  const state = triviaState[guildId];
  if (interaction.isButton() && interaction.customId === 'triviaAnswer') {
    if (!state?.active || !state.currentTrivia) {
      return interaction.reply({ content: 'No active trivia round!', ephemeral: true });
    }
    const modal = new ModalBuilder()
      .setCustomId('triviaModal')
      .setTitle('Trivia Answer')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('answerField')
            .setLabel('Your Answer')
            .setStyle(TextInputStyle.Short)
        )
      );
    return interaction.showModal(modal);
  }
if (interaction.isModalSubmit() && interaction.customId === 'triviaModal') {
  try {
    const guildId = interaction.guildId;
    const state = triviaState[guildId];
    const guess = interaction.fields.getTextInputValue('answerField').trim();
    if (!state?.active || !state.currentTrivia) {
      return interaction.reply({ content: 'No active trivia round!', ephemeral: true });
    }
    if (guess.toLowerCase() === state.currentTrivia.answer.toLowerCase()) {
      clearTimeout(state.timeout);
      state.active = false;
      state.currentTrivia = null;
      const scoresCollection = db.collection("scores");
      await scoresCollection.updateOne(
        { userId: interaction.user.id },
        { $inc: { correctCount: 1 } },
        { upsert: true }
      );
      return interaction.reply(`🎉 ${interaction.user} answered correctly!`);
    } else {
      return interaction.reply({ content: '❌ Incorrect answer!', ephemeral: true });
    }
  } catch (err) {
    console.error("Trivia modal error:", err);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: "⚠️ Something went wrong processing your answer.", ephemeral: true });
    }
  }
}
});
// --- Health check server ---
const app = express();
const PORT = process.env.PORT || 8000;
app.get('/', (req, res) => res.send('Bot is running ✅'));
app.listen(PORT, () => console.log(`Health check server on ${PORT}`));
// --- Unified message handler ---
client.on('messageCreate', async (message) => {
  console.log(`[${message.author.tag}] (${message.channel.type}) ${message.content}`);
  if (message.author.bot) return;
  if (message.content === '!ping') return message.reply('Pong! I am here!');
  if (message.content === '!echo') return message.reply('Echo rips through your ears!');
  if (message.content === '!joke') {
    const randomIndex = Math.floor(Math.random() * jokes.length);
    const joke = jokes[randomIndex];
    return message.reply(joke);
  }
  if (message.content === '!trivia') {
    const scoresCollection = db.collection("scores");
    const userScore = await scoresCollection.findOne({ userId: message.author.id }); // no guildId
    const score = userScore?.correctCount || 0;
    return message.reply(`🏆 You have ${score} correct trivia answers!`);
  }
  if (message.content === '!triviamanual') {
  if (!message.member.permissions.has('ManageGuild')) {
    return message.reply("❌ You need the **Manage Server** permission to start trivia manually.");
  }
  startTriviaRound(message.channel);
}
  if (message.content.startsWith('!altchecker')) {
    const username = message.content.split(' ')[1];
    if (!username) return message.reply('Please provide a username!');
    try {
      const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      if (res.status === 204) return message.reply(`❌ ${username} is not valid.`);
      const data = await res.json();
      return message.reply(data?.id ? `✅ ${username} is valid.` : `❌ ${username} is not valid.`);
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error checking account.');
    }
  }
  if (message.content.startsWith('!bedwars')) {
    const username = message.content.split(' ')[1];
    if (!username) return message.reply('Please provide a username!');
    try {
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;
      const hypixelRes = await fetch(`https://api.hypixel.net/player?key=${HYPIXEL_KEY}&uuid=${uuid}`);
      const hypixelData = await hypixelRes.json();
      if (!hypixelData.player) return message.reply('Player not found!');
      const bedwars = hypixelData.player.stats.Bedwars;
      return message.reply(
        `🏰 Bedwars stats for **${username}**:\nWins: ${bedwars.wins_bedwars}\nLosses: ${bedwars.losses_bedwars}\nKills: ${bedwars.kills_bedwars}\nDeaths: ${bedwars.deaths_bedwars}`
      );
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching stats.');
    }
  }
  if (message.content.startsWith('!partychecker')) {
  const username = message.content.split(' ')[1];
  if (!username) return message.reply('Please provide a username!');
  try {
    const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (mojangRes.status === 204) return message.reply(`❌ ${username} is not valid.`);
    const mojangData = await mojangRes.json();
    const uuid = mojangData.id;
    const sessionRes = await fetch(`https://api.hypixel.net/session?key=${HYPIXEL_KEY}&uuid=${uuid}`);
    const sessionData = await sessionRes.json();
    if (!sessionData.session) {
      return message.reply(`ℹ️ ${username} is not currently in a party or game.`);
    }
    const { gameType, players } = sessionData.session;
    let reply = `🎉 Party info for **${username}**:\n`;
    reply += `Game: ${gameType}\n`;
    reply += `Players: ${players.join(', ')}\n`;
    reply += `Leader: ${players[0]}`;
    return message.reply(reply);
  } catch (err) {
    console.error(err);
    return message.reply('⚠️ Error fetching party info.');
    }
  }
  if (message.content.startsWith('!rps')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Mention someone to challenge!');
    const gamesCollection = db.collection("games");
    await gamesCollection.insertOne({
      challenger: message.author.id,
      opponent: opponent.id,
      choices: {}
    });
    return message.channel.send(`${opponent}, type **!accept** to play Rock, Paper Scissors!`);
  }
if (message.content === '!accept') {
  const gamesCollection = db.collection("games");
  const game = await gamesCollection.findOne({ opponent: message.author.id });
  if (!game) return;
  return message.channel.send(`Game started! Both players DM me with rock/paper/scissors.`);
}
if (message.channel.type === ChannelType.DM) {
  const gamesCollection = db.collection("games");
  const game = await gamesCollection.findOne({
    $or: [
      { challenger: message.author.id },
      { opponent: message.author.id }
    ]
  });
  if (!game) return;
  game.choices[message.author.id] = message.content.toLowerCase();
  await gamesCollection.updateOne({ _id: game._id }, { $set: { choices: game.choices } });
  if (Object.keys(game.choices).length === 2) {
    const [p1, p2] = [game.choices[game.challenger], game.choices[game.opponent]];
    let result;
    if (p1 === p2) result = 'It’s a tie!';
    else if ((p1 === 'rock' && p2 === 'scissors') ||
             (p1 === 'scissors' && p2 === 'paper') ||
             (p1 === 'paper' && p2 === 'rock')) result = `<@${game.challenger}> wins!`;
    else result = `<@${game.opponent}> wins!`;
    message.client.channels.cache
      .find(c => c.type === 0 && c.members.has(game.challenger))
      ?.send(`🪨✂️📄 Results:\n<@${game.challenger}> chose **${p1}**\n<@${game.opponent}> chose **${p2}**\n${result}`);
    await gamesCollection.deleteOne({ _id: game._id });
  }
}
  if (message.content.startsWith('!channel')) {
    const args = message.content.split(' ').slice(1);
    if (args.length === 0) {
      return message.reply(
        "📌 Channel command usage:\n" +
        "`!channel set` → Set the bot’s channel to the current channel (requires Manage Server)\n" +
        "`!channel check` → Check the current bot channel"
      );
    }
    if (args[0] === 'set') {
      if (!message.member.permissions.has('ManageGuild')) {
        return message.reply("❌ You need the **Manage Server** permission to set the bot channel.");
      }
      await settingsCollection.updateOne(
        { guildId: message.guild.id },
        { $set: { botChannel: message.channel.id } },
        { upsert: true }
      );
      return message.reply(`✅ Bot channel set to ${message.channel}.`);
    }
    if (args[0] === 'check') {
      const settings = await settingsCollection.findOne({ guildId: message.guild.id });
      if (!settings?.botChannel) {
        return message.reply("⚠️ No bot channel set yet. Use `!channel set` in the desired channel.");
      }
      return message.reply(`📢 Current bot channel is <#${settings.botChannel}>.`);
    }
  }
  if (message.content === '!status') {
  const mongoStatus = db ? "✅ Connected" : "❌ Not connected";
  const discordStatus = client.user ? `✅ Logged in as ${client.user.tag}` : "❌ Not logged in";
  return message.reply(`📡 Status:\nDiscord: ${discordStatus}\nMongoDB: ${mongoStatus}`);
  }
  if (message.author.bot) return;
  const args = message.content.split(" ");
  const cmd = args.shift().toLowerCase();
  if (cmd === "!giveaway" && args[0] === "roles") {
    const role = message.mentions.roles.first();
    if (!role) return message.reply("❌ Mention a role.");
    const existing = await giveawayRoles.findOne({ guildId: message.guild.id, roleId: role.id });
    if (existing) {
      await giveawayRoles.deleteOne({ guildId: message.guild.id, roleId: role.id });
      return message.reply(`🔄 Removed ${role} from giveaway managers.`);
    } else {
      await giveawayRoles.insertOne({ guildId: message.guild.id, roleId: role.id });
      return message.reply(`✅ Added ${role} as giveaway manager.`);
    }
  }
  if (cmd === "!giveaway" && args[0] === "create") {
    const [prize, duration, winners, ...extra] = args.slice(1);
    if (!prize || !duration || !winners) return message.reply("❌ Usage: !giveaway create {prize} {duration} {winners} {extra info}");
    const allowedRoles = await giveawayRoles.find({ guildId: message.guild.id }).toArray();
    const hasRole = allowedRoles.some(r => message.member.roles.cache.has(r.roleId));
    if (!message.member.permissions.has("ManageGuild") && !hasRole) {
      return message.reply("❌ You don’t have permission to create giveaways.");
    }
    const giveawayId = crypto.randomBytes(4).toString("hex");
    const durationMs = ms(duration);
    const endTime = Date.now() + durationMs;
    const giveaway = {
      giveaway_id: giveawayId,
      giveaway_channel: message.channel.id,
      users: [],
      prize,
      duration,
      creator: message.author.id,
      winners: parseInt(winners),
      winner: null,
      extra: extra.join(" "),
      endTime,
      createdAt: Date.now()
    };
    await db.collection("giveaways").insertOne(giveaway);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`enter_${giveawayId}`)
        .setLabel("Enter Giveaway")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`participants_${giveawayId}`)
        .setLabel("Participants")
        .setStyle(ButtonStyle.Secondary)
    );
    message.channel.send({
      content: `🎉 **Giveaway Started!**\nPrize: ${prize}\nDuration: ${duration}\nWinners: ${winners}\nInformation: ${extra.join(" ")}\nCreator: ${message.author}\nID: ${giveawayId}`,
      components: [row]
    });
    setTimeout(async () => {
      try {
        const channel = await client.channels.fetch(message.channel.id);
        endGiveaway(giveawayId, channel);
      } catch (err) {
        console.error("Error ending giveaway:", err);
      }
    }, durationMs);
  }
  if (cmd === "!giveaway" && args[0] === "end") {
    const id = args[1];
    if (!id) return message.reply("❌ Provide giveaway ID.");
    await endGiveaway(id, message.channel);
  }
  if (cmd === "!giveaway" && args[0] === "cancel") {
    const id = args[1];
    await db.collection("giveaways").deleteOne({ giveaway_id: id });
    return message.reply(`❌ Giveaway ${id} cancelled.`);
  }
  if (cmd === "!giveaway" && args[0] === "reroll") {
    const id = args[1];
    await rerollGiveaway(id, message.channel);
  }
});
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === "triviaAnswer") {
    return;
  }
  if (interaction.customId.startsWith("enter_") || 
      interaction.customId.startsWith("leave_") || 
      interaction.customId.startsWith("participants_")) {
    const [action, id] = interaction.customId.split("_");
    const giveaways = db.collection("giveaways");
    const giveaway = await giveaways.findOne({ giveaway_id: id });
    if (!giveaway) return interaction.reply({ content: "⚠️ Giveaway not found.", ephemeral: true });
    if (action === "enter") {
      if (giveaway.users.includes(interaction.user.id)) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`leave_${id}`).setLabel("Leave Giveaway").setStyle(ButtonStyle.Danger)
        );
        return interaction.reply({ content: "❌ You have already entered this giveaway.", ephemeral: true, components: [row] });
      }
      giveaway.users.push(interaction.user.id);
      await giveaways.updateOne({ giveaway_id: id }, { $set: { users: giveaway.users } });
      return interaction.reply({ content: "✅ You have successfully entered the giveaway.", ephemeral: true });
    }
    if (action === "leave") {
      giveaway.users = giveaway.users.filter(u => u !== interaction.user.id);
      await giveaways.updateOne({ giveaway_id: id }, { $set: { users: giveaway.users } });
      return interaction.reply({ content: "🚪 You have left the giveaway.", ephemeral: true });
    }
    if (action === "participants") {
      const total = giveaway.users.length;
      const list = giveaway.users.map(u => `<@${u}>`).join(", ") || "No participants yet.";
      return interaction.reply({ 
        content: `👥 Participants in Giveaway ${id}\nTotal Entries: ${total}\n${list}`, 
        ephemeral: true 
      });
    }
  }
});
async function endGiveaway(id, channel=null) {
  const giveaways = db.collection("giveaways");
  const giveaway = await giveaways.findOne({ giveaway_id: id });
  if (!giveaway) return;
  if (giveaway.users.length === 0) {
    return channel?.send(`⚠️ Giveaway ${id} ended with no entries.`);
  }
  const winners = [];
  for (let i = 0; i < giveaway.winners; i++) {
    const winner = giveaway.users[Math.floor(Math.random() * giveaway.users.length)];
    if (!winners.includes(winner)) winners.push(winner);
  }
  await giveaways.updateOne({ giveaway_id: id }, { $set: { winner: winners } });
  channel?.send(`🎉 Giveaway ${id} ended!\nPrize: ${giveaway.prize}\nWinners: ${winners.map(w => `<@${w}>`).join(", ")}`);
}
async function rerollGiveaway(id, channel) {
  const giveaways = db.collection("giveaways");
  const giveaway = await giveaways.findOne({ giveaway_id: id });
  if (!giveaway) return;
  if (giveaway.users.length === 0) return channel.send(`⚠️ No entries to reroll.`);
  const winners = [];
  for (let i = 0; i < giveaway.winners; i++) {
    const winner = giveaway.users[Math.floor(Math.random() * giveaway.users.length)];
    if (!winners.includes(winner)) winners.push(winner);
  }
  await giveaways.updateOne({ giveaway_id: id }, { $set: { winner: winners } });
  channel.send(`🔄 Giveaway ${id} rerolled!\nNew Winners: ${winners.map(w => `<@${w}>`).join(", ")}`);
}
setInterval(async () => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    const result = await db.collection("giveaways").deleteMany({ createdAt: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`🗑️ Cleaned up ${result.deletedCount} old giveaways`);
    }
  } catch (err) {
    console.error("Error cleaning up giveaways:", err);
  }
}, 24 * 60 * 60 * 1000);
// --- Render Ping ---
console.log("Node.js version:", process.version)
setInterval(async () => {
  try {
    const res = await fetch('https://puna-bot-v1ar.onrender.com/');
    console.log('Pinged Render:', res.status);
  } catch (err) {
    console.error('Ping failed:', err);
  }
}, 150000);
// --- Startup ---
if (!DISCORD_TOKEN) {
  console.error("❌ No DISCORD_TOKEN found in environment!");
  process.exit(1);
}
async function startBot() {
  try {
    console.log("Connecting with URI:", MONGO_URI);
    await clientDB.connect();
    db = clientDB.db("punabot");
    giveawayRoles = db.collection("giveawayRoles");
    settingsCollection = db.collection("settings");
    console.log("✅ Connected to MongoDB");
    try {
      await client.login(DISCORD_TOKEN);
      console.log("✅ Bot login attempt complete");
    } catch (err) {
      console.error("❌ Discord login failed:", err);
      process.exit(1);
    }
    client.on('error', (err) => {
      console.error("❌ Discord client error:", err);
    });
    client.on('shardError', (err, shardId) => {
      console.error(`❌ Shard ${shardId} error:`, err);
    });
    client.on('debug', (info) => {
      console.log("🔎 Discord debug:", info);
    });
    client.once('ready', async () => {
      console.log(`✅ Logged in as ${client.user.tag}`);
      client.user.setPresence({
        activities: [{
          name: '@punagamer32 On YouTube',
          type: ActivityType.Streaming,
          url: 'https://www.youtube.com/@punagamer32/live'
        }],
        status: 'online'
      });
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const settings = await settingsCollection.findOne({ guildId });
          if (settings?.botChannel) {
            const channel = await client.channels.fetch(settings.botChannel);
            if (channel && channel.isTextBased()) {
              console.log(`⚡ Starting trivia round immediately in ${guild.name} → ${channel.name}`);
              startTriviaRound(channel);
            }
          }
        } catch (err) {
          console.error(`Startup trivia error in ${guild.name}:`, err);
        }
      }
      setInterval(async () => {
        for (const [guildId, guild] of client.guilds.cache) {
          try {
            const settings = await settingsCollection.findOne({ guildId });
            if (settings?.botChannel) {
              const channel = await client.channels.fetch(settings.botChannel);
              if (channel && channel.isTextBased()) {
                console.log(`⚡ Starting trivia round in ${guild.name} → ${channel.name}`);
                startTriviaRound(channel);
              }
            }
          } catch (err) {
            console.error(`Trivia interval error in ${guild.name}:`, err);
          }
        }
      }, 30 * 60 * 1000);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    setTimeout(startBot, 10000);
  }
}
startBot();
