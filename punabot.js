// --- punabot.js ---
import { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';
import fetch from 'node-fetch';
import express from 'express';
import os from 'os';
import { MongoClient } from "mongodb";
import fs from 'fs';
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
    await interaction.showModal(modal);
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
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '@punagamer32 On YouTube', type: ActivityType.Streaming, url: 'https://www.youtube.com/@punagamer32/live' }],
    status: 'online'
  });
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const settings = await settingsCollection.findOne({ guildId });
      if (settings?.botChannel) {
        const channel = await client.channels.fetch(settings.botChannel);
        if (channel) {
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
          if (channel) {
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
});
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
    settingsCollection = db.collection("settings");
    console.log("✅ Connected to MongoDB");
    await client.login(DISCORD_TOKEN);
    console.log("✅ Bot login attempt complete");
  } catch (err) {
    console.error("❌ Startup failed:", err);
    setTimeout(startBot, 10000);
  }
}
startBot();


