// punabot.js
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import fetch from 'node-fetch';

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const HYPIXEL_KEY = process.env.HYPIXEL_KEY;

// --- Health check server for Koyeb ---
const app = express();
const PORT = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send('Bot is running ✅');
});

app.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Store active RPS games
let activeGames = {};

// Slash commands definition
const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  {
    name: 'echo',
    description: 'Replies with Echo Goes Through Yours Ears!',
  },
  {
    name: 'bedwars',
    description: 'Get Bedwars stats for a Minecraft username',
    options: [
      {
        name: 'username',
        type: 3, // STRING
        description: 'Minecraft username',
        required: true,
      },
    ],
  },
  {
    name: 'rps',
    description: 'Challenge someone to Rock Paper Scissors',
    options: [
      {
        name: 'opponent',
        type: 6, // USER
        description: 'The user you want to challenge',
        required: true,
      },
    ],
  },
  {
    name: 'accept',
    description: 'Accept a Rock Paper Scissors challenge',
  },
];

// Register slash commands globally
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error(error);
  }
})();

// Ready event
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Sub To punagamer32 On YouTube', type: 0 }],
    status: 'online'
  });
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('Pong, I am here!');
  }

  if (commandName === 'echo') {
    await interaction.reply('Echo Goes Through Yours Ears!');
  }

  if (commandName === 'bedwars') {
    const username = interaction.options.getString('username');
    try {
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;

      const hypixelRes = await fetch(`https://api.hypixel.net/player?key=${HYPIXEL_KEY}&uuid=${uuid}`);
      const hypixelData = await hypixelRes.json();

      if (!hypixelData.player) return interaction.reply('Player not found!');

      const bedwars = hypixelData.player.stats.Bedwars;
      await interaction.reply(`🏰 Bedwars stats for **${username}**:
- Wins: ${bedwars.wins_bedwars}
- Losses: ${bedwars.losses_bedwars}
- Kills: ${bedwars.kills_bedwars}
- Deaths: ${bedwars.deaths_bedwars}`);
    } catch (err) {
      console.error(err);
      interaction.reply('Error fetching stats.');
    }
  }

  if (commandName === 'rps') {
    const opponent = interaction.options.getUser('opponent');
    activeGames[interaction.user.id] = { opponent: opponent.id, choices: {} };
    await interaction.reply(`${opponent}, you’ve been challenged to Rock‑Paper‑Scissors! Use \`/accept\`.`);
  }

  if (commandName === 'accept') {
    const challenger = Object.keys(activeGames).find(id => activeGames[id].opponent === interaction.user.id);
    if (!challenger) return interaction.reply('No active challenge found.');

    const game = activeGames[challenger];
    await interaction.reply(`Game started! Both players DM me with \`rock\`, \`paper\`, or \`scissors\`.`);

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
        interaction.channel.send(`🪨✂️📄 Results:\n<@${challenger}> chose **${p1}**\n<@${game.opponent}> chose **${p2}**\n${result}`);
        delete activeGames[challenger];
      }
    });
  }
});

// Login
client.login(DISCORD_TOKEN);


