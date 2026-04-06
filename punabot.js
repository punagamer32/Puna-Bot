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
  if (message.content.startsWith('!gd')) {
    const player = message.content.split(' ')[1];
    if (!player) return message.reply('❌ Please provide a player name.');
    try {
      const res = await fetch(`https://gdbrowser.com/api/profile/${encodeURIComponent(player)}`);
      const data = await res.json();
      if (!data || data.error) return message.reply(`⚠️ Could not find stats for ${player}.`);
      const baseStats = `⭐ Stars: ${data.stars}\n🌙 Moons: ${data.moons}\n🔑 Secret Coins: ${data.Coins}\n💰 User Coins: ${data.coins}\n👹 Demons: ${data.demons}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gd_normal_${player}`)
          .setLabel('Level Stats')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`gd_demons_${player}`)
          .setLabel('Demons')
          .setStyle(ButtonStyle.Danger)
      );
      return message.channel.send({ content: `📊 Stats for **${player}**\n${baseStats}`, components: [row] });
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching GD stats.');
    }
  }
});
async function fetchDifficultyCount(player, difficulty, platformer=false) {
  const res = await fetch(`https://gdbrowser.com/api/search/${encodeURIComponent(player)}?difficulty=${difficulty}${platformer ? "&platformer=true" : ""}`);
  const levels = await res.json();
  return levels.length;
}
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      const [prefix, type, player] = interaction.customId.split('_');
      if (prefix !== 'gd') return;
      await interaction.deferReply();
      try {
        const res = await fetch(`https://gdbrowser.com/api/profile/${encodeURIComponent(player)}`);
        const data = await res.json();
    if (type === 'levels') {
      const autoClassic = await fetchDifficultyCount(player, "auto");
      const autoPlatformer = await fetchDifficultyCount(player, "auto", true);
      const easyClassic = await fetchDifficultyCount(player, "easy");
      const easyPlatformer = await fetchDifficultyCount(player, "easy", true);
      // … repeat for Normal, Hard, Harder, Insane
    
      await interaction.editReply({
        content: `📜 Level Stats for **${player}**:
    Classic → Auto: ${autoClassic}, Easy: ${easyClassic}, Normal: ${normalClassic}, Hard: ${hardClassic}, Harder: ${harderClassic}, Insane: ${insaneClassic}
    Platformer → Auto: ${autoPlatformer}, Easy: ${easyPlatformer}, Normal: ${normalPlatformer}, Hard: ${hardPlatformer}, Harder: ${harderPlatformer}, Insane: ${insanePlatformer}`
      });
    }
    if (type === 'demons') {
      const easyDemonClassic = await fetchDifficultyCount(player, "easy demon");
      const easyDemonPlatformer = await fetchDifficultyCount(player, "easy demon", true);
      const mediumDemonClassic = await fetchDifficultyCount(player, "medium demon");
      const mediumDemonPlatformer = await fetchDifficultyCount(player, "medium demon", true);
      // … repeat for Hard, Insane, Extreme Demon
      await interaction.editReply({
        content: `👹 Demon Stats for **${player}**:
    Classic → Easy: ${easyDemonClassic}, Medium: ${mediumDemonClassic}, Hard: ${hardDemonClassic}, Insane: ${insaneDemonClassic}, Extreme: ${extremeDemonClassic}
    Platformer → Easy: ${easyDemonPlatformer}, Medium: ${mediumDemonPlatformer}, Hard: ${hardDemonPlatformer}, Insane: ${insaneDemonPlatformer}, Extreme: ${extremeDemonPlatformer}`
      });
    }
  } catch (err) {
    console.error(err);
    await interaction.editReply({ content: '⚠️ Error fetching GD stats.' });
  }
});
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!level')) {
    const args = message.content.split(' ');
    const levelId = args[1];
    const subCommand = args[2];
    const player = args[3];
    if (!levelId) return message.reply('❌ Please provide a level ID.');
    try {
      if (subCommand === 'playerstats' && player) {
        const res = await fetch(`https://gdbrowser.com/api/level/${levelId}`);
        const levelData = await res.json();
        return message.reply(`📊 Stats for **${player}** on level ${levelData.name} (ID: ${levelId})\nAttempts: TBD\nCompletion: TBD`);
      }
      if (subCommand === 'leaderboard') {
        const res = await fetch(`https://gdbrowser.com/api/leaderboard/${levelId}`);
        const lbData = await res.json();
        let leaderboard = lbData.map((entry, i) => `${i + 1}. ${entry.username} – ${entry.percent}%`).join('\n');
        return message.reply(`🏆 Leaderboard for level ${levelId}:\n${leaderboard}`);
      }
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error fetching level data.');
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
