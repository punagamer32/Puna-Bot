// punabot.js
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import fetch from 'node-fetch';
import express from 'express';
import os from 'os';

// Jokes
const jokes = [
  "Why don’t scientists trust atoms? Because they make up everything.",
  "Why did the scarecrow win an award? Because he was outstanding in his field.",
  "Why don’t skeletons fight each other? They don’t have the guts.",
  "What do you call fake spaghetti? An impasta.",
  "Why did the math book look sad? Because it had too many problems.",
  "Why can’t your nose be 12 inches long? Because then it would be a foot.",
  "Why did the bicycle fall over? It was two-tired.",
  "Why don’t oysters donate to charity? Because they’re shellfish.",
  "Why did the golfer bring two pairs of pants? In case he got a hole in one.",
  "Why did the computer go to the doctor? Because it caught a virus.",
  "Why was the broom late? It swept in.",
  "Why did the tomato blush? Because it saw the salad dressing.",
  "Why don’t eggs tell jokes? They’d crack each other up.",
  "Why did the chicken go to the séance? To talk to the other side.",
  "Why did the stadium get hot? All the fans left.",
  "Why did the cow go to outer space? To see the moooon.",
  "Why did the cookie go to the doctor? Because it felt crummy.",
  "Why did the man put his money in the blender? He wanted liquid assets.",
  "Why did the barber win the race? He knew all the shortcuts.",
  "Why did the belt go to jail? For holding up a pair of pants.",
  "Why did the cat sit on the computer? To keep an eye on the mouse.",
  "Why did the picture go to jail? Because it was framed.",
  "Why did the banana go to the doctor? Because it wasn’t peeling well.",
  "Why did the fish blush? Because it saw the ocean’s bottom.",
  "Why did the skeleton go to the party alone? He had no body to go with.",
  "Why did the man run around his bed? He was trying to catch up on sleep.",
  "Why did the duck get arrested? For quacking up.",
  "Why did the student eat his homework? Because the teacher said it was a piece of cake.",
  "Why did the frog take the bus? His car got toad away.",
  "Why did the pencil break up with the eraser? It found someone sharper.",
  "Why did the orange stop? It ran out of juice.",
  "Why did the pirate go to school? To improve his arrr-ticulation.",
  "Why did the mushroom go to the party? Because he was a fun-gi.",
  "Why did the man put his watch in the freezer? He wanted cold time.",
  "Why did the banker switch careers? He lost interest.",
  "Why did the dog sit in the shade? Because he didn’t want to be a hot dog.",
  "Why did the music teacher go to jail? She got caught with too many notes.",
  "Why did the grape stop in the middle of the road? It ran out of juice.",
  "Why did the snowman look through the carrots? He was picking his nose.",
  "Why did the boy bring a ladder to school? He wanted to go to high school.",
  "Why did the bee get married? Because he found his honey.",
  "Why did the man put his car in the oven? He wanted a hot rod.",
  "Why did the scarecrow become a successful politician? He was outstanding in his field.",
  "Why did the dog chase its tail? It was trying to make ends meet.",
  "Why did the man put his money in the fireplace? He wanted hot cash.",
  "Why did the chicken join the band? Because it had the drumsticks.",
  "Why did the cow sit down? To moo-ve over.",
  "Why did the man put his radio in the fridge? He wanted cool music.",
  "Why did the fish cross the road? To get to the other tide.",
  "Why did the man put his shoes in the oven? He wanted loafers.",
  "Why did the skeleton stay calm? Nothing got under his skin.",
  "Why did the man put his bed in the car? He wanted to sleep on the go.",
  "Why did the duck sit on the computer? To keep an eye on the web.",
  "Why did the man put his phone in the blender? He wanted a smart smoothie.",
  "Why did the cow go to the gym? To get moo-scles.",
  "Why did the man put his calendar in the freezer? He wanted cold dates.",
  "Why did the chicken sit in the shade? Because it didn’t want to be fried.",
  "Why did the man put his guitar in the fridge? He wanted cool jams.",
  "Why did the fish go to school? To improve its scales.",
  "Why did the man put his shoes in the fridge? He wanted cold feet.",
  "Why did the skeleton go to the barbecue? To get a spare rib.",
  "Why did the man put his computer in the oven? He wanted a hot spot.",
  "Why did the cow go to the party? To have a moo-d time.",
  "Why did the man put his wallet in the freezer? He wanted cold hard cash.",
  "Why did the chicken go to the library? To check out a book.",
  "Why did the man put his lamp in the fridge? He wanted a light snack.",
  "Why did the fish go to the doctor? Because it was feeling eel.",
  "Why did the man put his hat in the oven? He wanted a hot head.",
  "Why did the skeleton go to the dance? To shake a leg.",
  "Why did the man put his shoes in the microwave? He wanted fast food.",
  "Why did the cow go to the concert? To hear the moo-sic.",
  "Why did the man put his phone in the oven? He wanted hot calls.",
  "Why did the chicken go to the gym? To work on its pecks.",
  "Why did the man put his book in the fridge? He wanted a cool story.",
  "Why did the fish go to the party? To have a whale of a time.",
  "Why did the man put his shoes in the dishwasher? He wanted clean kicks.",
  "Why did the skeleton go to the restaurant? For spare ribs.",
  "Why did the man put his phone in the freezer? He wanted cold calls.",
  "Why did the cow go to the beach? To get tan lines.",
  "Why did the man put his shoes in the washing machine? He wanted fresh soles.",
  "Why did the chicken go to the movie? To see the eggs-traordinary film.",
  "Why did the man put his phone in the washing machine? He wanted clean calls.",
  "Why did the fish go to the concert? To hear the bass.",
  "Why did the man put his shoes in the dryer? He wanted warm soles.",
  "Why did the skeleton go to the store? To buy spare parts.",
  "Why did the man put his phone in the toaster? He wanted hot texts.",
  "Why did the cow go to the spa? To get a moo-ssage.",
  "Why did the man put his shoes in the freezer? He wanted ice kicks.",
  "Why did the chicken go to the park? To play peck-a-boo.",
  "Why did the man put his phone in the sink? He wanted wet calls.",
  "Why did the fish go to the gym? To work on its abs.",
  "Why did the man put his shoes in the oven? He wanted baked soles.",
  "Why did the skeleton go to the mechanic? To get a bone tune-up.",
  "Why did the man put his phone in the fridge? He wanted cool calls.",
  "Why did the cow go to the doctor? To get moo-dicine.",
  "Why did the man put his shoes in the fridge? He wanted chilled kicks.",
  "Why did the chicken go to the bakery? To get a loaf.",
  "Why did the man put his phone in the bathtub? He wanted clean calls.",
  "Why don’t skeletons fight each other? They don’t have the guts.",
  "I told my computer I needed a break, and now it won’t stop sending me Kit-Kats.",
  "Why did the scarecrow win an award? Because he was outstanding in his field!",
  "Parallel lines have so much in common… it’s a shame they’ll never meet.",
  "I asked my dog what's two minus two. He said nothing."
];

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



