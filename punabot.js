// punabot.js
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import fetch from 'node-fetch';
import express from 'express';
import os from 'os';

// Jokes
const jokes = fetch('jokes.json');

// --- Health check server ---
const app = express();
const PORT = process.env.PORT || 8000;
app.get('/', (req, res) => res.send('Bot is running ✅'));
app.listen(PORT, () => console.log(`Health check server on ${PORT}`));

// --- Discord client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HYPIXEL_KEY = process.env.HYPIXEL_KEY;
let activeGames = {};

// Ready
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '@punagamer32 On YouTube', type: ActivityType.Watching }],
    status: 'online'
  });
});

// Unified message handler
client.on('messageCreate', async (message) => {
  console.log(`[${message.author.tag}] (${message.channel.type}) ${message.content}`);
  if (message.author.bot) return;
  if (message.content === '!ping') return message.reply('Pong!');
  if (message.content === '!echo') return message.reply('Echo Goes Through Your Ears!');
  if (message.content === '!joke') {
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return message.reply(joke);
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
      return message.reply(`🏰 Bedwars stats for **${username}**:\nWins: ${bedwars.wins_bedwars}\nLosses: ${bedwars.losses_bedwars}\nKills: ${bedwars.kills_bedwars}\nDeaths: ${bedwars.deaths_bedwars}`);
    } catch (err) {
      console.error(err);
      return message.reply('Error fetching stats.');
    }
  }

  }

  if (message.content.startsWith('!rps')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Mention someone to challenge!');
    activeGames[message.author.id] = { opponent: opponent.id, choices: {} };
    return message.channel.send(`${opponent}, type !accept to play RPS.`);
  }

  if (message.content === '!accept') {
    const challenger = Object.keys(activeGames).find(id => activeGames[id].opponent === message.author.id);
    if (!challenger) return;
    return message.channel.send(`Game started! Both players DM me with rock/paper/scissors.`);
  }

  if (message.channel.type === 1) { // DM
    const challenger = Object.keys(activeGames).find(id =>
      [id, activeGames[id].opponent].includes(message.author.id)
    );
    if (!challenger) return;
    const game = activeGames[challenger];
    game.choices[message.author.id] = message.content.toLowerCase();
    if (Object.keys(game.choices).length === 2) {
      const [p1, p2] = [game.choices[challenger], game.choices[game.opponent]];
      let result;
      if (p1 === p2) result = 'It’s a tie!';
      else if ((p1 === 'rock' && p2 === 'scissors') ||
               (p1 === 'scissors' && p2 === 'paper') ||
               (p1 === 'paper' && p2 === 'rock')) result = `<@${challenger}> wins!`;
      else result = `<@${game.opponent}> wins!`;
      message.client.channels.cache
        .find(c => c.type === 0 && c.members.has(challenger))
        ?.send(`🪨✂️📄 Results:\n<@${challenger}> chose **${p1}**\n<@${game.opponent}> chose **${p2}**\n${result}`);
      delete activeGames[challenger];
    }
  }
});

//Koyeb Ping
import fetch from 'node-fetch';

setInterval(async () => {
  try {
    const res = await fetch('https://puna-bot.koyeb.app/');
    console.log('Pinged Koyeb:', res.status);
  } catch (err) {
    console.error('Ping failed:', err);
  }
}, 150000); // every 2.5 minutes


// Login
client.login(DISCORD_TOKEN);
