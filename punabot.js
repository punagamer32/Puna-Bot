// --- punabot.js ---
import { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle  } from 'discord.js';
import fetch from 'node-fetch';
import express from 'express';
import os from 'os';
// --- Constants ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HYPIXEL_KEY = process.env.HYPIXEL_KEY;
const BOT_CHANNEL = process.env.BOT_CHANNEL;
// --- Saved Data ---
let scores = {}; // { userId: correctCount }
let activeGames = {};
// --- Discord client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});
//--- Trivia ---
import triviaData from './trivia.json' with { type: 'json' };
let currentTrivia = null;
let triviaActive = false;
let triviaTimeout = null;
function startTriviaRound(channel) {
  if (triviaActive) return;
  const randomIndex = Math.floor(Math.random() * triviaData.length);
  currentTrivia = triviaData[randomIndex];
  triviaActive = true;
  const button = new ButtonBuilder()
    .setCustomId('triviaAnswer')
    .setLabel('Answer Trivia')
    .setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(button);
  channel.send({ content: `🧠 Trivia Time!\n${currentTrivia.question}`, components: [row] });
  triviaTimeout = setTimeout(() => {
    triviaActive = false;
    currentTrivia = null;
    channel.send('⏰ Trivia round ended. No one got it in time!');
  }, 5 * 60 * 1000); // 5 minutes
}
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'triviaAnswer') {
    if (!triviaActive || !currentTrivia) {
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
    const guess = interaction.fields.getTextInputValue('answerField').trim();
    if (!triviaActive || !currentTrivia) {
      return interaction.reply({ content: 'No active trivia round!', ephemeral: true });
    }
    if (guess.toLowerCase() === currentTrivia.answer.toLowerCase()) {
      triviaActive = false;
      clearTimeout(triviaTimeout);
      scores[interaction.user.id] = (scores[interaction.user.id] || 0) + 1;
      currentTrivia = null;
      return interaction.reply(`🎉 ${interaction.user} answered correctly!`);
    } else {
      return interaction.reply({ content: '❌ Incorrect guess, try again!', ephemeral: true });
    }
  }
});
setInterval(() => {
  const channel = client.channels.cache.get(BOT_CHANNEL);
  if (channel) startTriviaRound(channel);
}, 30 * 60 * 1000);
// --- Jokes ---
import jokes from './jokes.json' with { type: 'json' };
// --- Health check server ---
const app = express();
const PORT = process.env.PORT || 8000;
app.get('/', (req, res) => res.send('Bot is running ✅'));
app.listen(PORT, () => console.log(`Health check server on ${PORT}`));
// --- Ready ---
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '@punagamer32 On YouTube', type: ActivityType.Watching }],
    status: 'online'
  });
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
    const score = scores[message.author.id] || 0;
    message.reply(`🏆 You have ${score} correct trivia answers!`);
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
  if (message.content.startsWith('!partychecker')) {
  const username = message.content.split(' ')[1];
  if (!username) return message.reply('Please provide a username!');
  try {
    // Step 1: Get UUID from Mojang
    const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (mojangRes.status === 204) return message.reply(`❌ ${username} is not valid.`);
    const mojangData = await mojangRes.json();
    const uuid = mojangData.id;
    // Step 2: Get Hypixel session info
    const sessionRes = await fetch(`https://api.hypixel.net/session?key=${HYPIXEL_KEY}&uuid=${uuid}`);
    const sessionData = await sessionRes.json();
    if (!sessionData.session) {
      return message.reply(`ℹ️ ${username} is not currently in a party or game.`);
    }
    const { gameType, players } = sessionData.session;
    // Step 3: Build response
    let reply = `🎉 Party info for **${username}**:\n`;
    reply += `Game: ${gameType}\n`;
    reply += `Players: ${players.join(', ')}\n`;
    reply += `Leader: ${players[0]}`; // usually first in the list
    return message.reply(reply);
  } catch (err) {
    console.error(err);
    return message.reply('⚠️ Error fetching party info.');
  }
}
  if (message.content.startsWith('!rps')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Mention someone to challenge!');
    activeGames[message.author.id] = { opponent: opponent.id, choices: {} };
    return message.channel.send(`${opponent}, type **!accept** to play Rock, Paper Scissors!`);
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
// --- Koyeb Ping ---
setInterval(async () => {
  try {
    const res = await fetch('https://puna-bot.koyeb.app/');
    console.log('Pinged Koyeb:', res.status);
  } catch (err) {
    console.error('Ping failed:', err);
  }
}, 150000); // every 2.5 minutes
// --- Login ---
client.login(DISCORD_TOKEN);
