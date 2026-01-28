// punabot.js
import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Environment variables (set these in Katabump dashboard)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const HYPIXEL_KEY = process.env.HYPIXEL_KEY

// Store active RPS games
let activeGames = {};

// Ready event
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Set bot presence
  client.user.setPresence({
    activities: [{ name: 'Bedwars 🛡️', type: 0 }], // Playing Bedwars
    status: 'online'
  });
});

// Message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- Ping command ---
  if (message.content === '!ping') {
    return message.reply('Pong, I am here!');
  }
  if (message.content === '!echo') {
    return message.reply('Echo Goes Through Yours Ears!');
  }
  // --- Bedwars stats ---
  if (message.content.startsWith('!bedwars')) {
    const username = message.content.split(' ')[1];
    if (!username) return message.reply('Please provide a username!');

    try {
      // Get UUID from Mojang
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;

      // Get stats from Hypixel
      const hypixelRes = await fetch(`https://api.hypixel.net/player?key=${HYPIXEL_KEY}&uuid=${uuid}`);
      const hypixelData = await hypixelRes.json();

      if (!hypixelData.player) return message.reply('Player not found!');

      const bedwars = hypixelData.player.stats.Bedwars;
      message.reply(`🏰 Bedwars stats for **${username}**:
- Wins: ${bedwars.wins_bedwars}
- Losses: ${bedwars.losses_bedwars}
- Kills: ${bedwars.kills_bedwars}
- Deaths: ${bedwars.deaths_bedwars}`);
    } catch (err) {
      console.error(err);
      message.reply('Error fetching stats.');
    }
  }

  // --- Rock Paper Scissors ---
  if (message.content.startsWith('!rps')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('You need to mention someone to challenge!');

    activeGames[message.author.id] = { opponent: opponent.id, choices: {} };
    message.channel.send(`${opponent}, you’ve been challenged to Rock‑Paper‑Scissors! Type \`!accept\`.`);
  }

  if (message.content === '!accept') {
    const challenger = Object.keys(activeGames).find(id => activeGames[id].opponent === message.author.id);
    if (!challenger) return;

    const game = activeGames[challenger];
    message.channel.send(`Game started! Both players DM me with \`rock\`, \`paper\`, or \`scissors\`.`);

    client.on('messageCreate', (dmMsg) => {
      if (dmMsg.channel.type !== 1) return; // Only DMs
      if (![challenger, game.opponent].includes(dmMsg.author.id)) return;

      game.choices[dmMsg.author.id] = dmMsg.content.toLowerCase();
      if (Object.keys(game.choices).length === 2) {
        const [p1, p2] = [game.choices[challenger], game.choices[game.opponent]];
        let result;
        if (p1 === p2) result = 'It’s a tie!';
        else if ((p1 === 'rock' && p2 === 'scissors') ||
                 (p1 === 'scissors' && p2 === 'paper') ||
                 (p1 === 'paper' && p2 === 'rock')) {
          result = `<@${challenger}> wins!`;
        } else {
          result = `<@${game.opponent}> wins!`;
        }
        message.channel.send(`🪨✂️📄 Results:\n<@${challenger}> chose **${p1}**\n<@${game.opponent}> chose **${p2}**\n${result}`);
        delete activeGames[challenger];
      }
    });
  }
});

// Login
client.login(DISCORD_TOKEN);





