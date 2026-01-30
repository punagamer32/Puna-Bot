// punabot.js

// --- Health check server for Koyeb ---
const app = express();
const PORT = process.env.PORT || 8000;
app.get('/', (req, res) => res.send('Bot is running ✅'));
app.listen(PORT, () => console.log(`Health check server on ${PORT}`));

// Optional self‑ping to keep alive
setInterval(async () => {
  try {
    const res = await fetch('https://your-app-name.koyeb.app');
    console.log('Pinged Koyeb:', res.status);
  } catch (err) {
    console.error('Ping failed:', err);
  }
}, 300000);

// --- Discord client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HYPIXEL_KEY = process.env.HYPIXEL_KEY;

// Store active RPS games
let activeGames = {};

// Ready event
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '@punagamer32 On YouTube', type: ActivityType.Watching }],
    status: 'online'
  });
});

// --- Unified message handler ---
client.on('messageCreate', async (message) => {
  console.log(`[${message.author.tag}] ${message.content}`);
  if (message.author.bot) return;

  // Ping
  if (message.content === '!ping') return message.reply('Pong, I am here!');

  // Echo
  if (message.content === '!echo') return message.reply('Echo Goes Through Your Ears!');

  // Joke
  if (message.content === '!joke') {
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return message.reply(joke);
  }

  // Altchecker
  if (message.content.startsWith('!altchecker')) {
    const username = message.content.split(' ')[1];
    if (!username) return message.reply('Please provide a Minecraft username!');
    try {
      const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      if (res.status === 204) return message.reply(`❌ ${username} is not a valid Mojang account.`);
      const data = await res.json();
      return message.reply(data?.id ? `✅ ${username} is valid.` : `❌ ${username} is not valid.`);
    } catch (err) {
      console.error(err);
      return message.reply('⚠️ Error checking account.');
    }
  }

  // Bedwars
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

  // RPS challenge
  if (message.content.startsWith('!rps')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('You need to mention someone to challenge!');
    activeGames[message.author.id] = { opponent: opponent.id, choices: {} };
    return message.channel.send(`${opponent}, you’ve been challenged to Rock‑Paper‑Scissors! Type \`!accept\`.`);
  }

  // RPS accept
  if (message.content === '!accept') {
    const challenger = Object.keys(activeGames).find(id => activeGames[id].opponent === message.author.id);
    if (!challenger) return;
    return message.channel.send(`Game started! Both players DM me with \`rock\`, \`paper\`, or \`scissors\`.`);
  }

  // Handle DM choices
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

// --- Login ---
client.login(DISCORD_TOKEN);
