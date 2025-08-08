require('dotenv').config();
const cron = require('node-cron');
const Discord = require('discord.js');
const { GatewayIntentBits } = require('discord.js');
const fs = require("fs");
const path = require("path");

const client = new Discord.Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const prefix = '!';

const { BOT_TOKEN } = process.env;
let participants = {};
let cardSet = 'TBD';
let listMessageIds = [];
let messagesToUpdate = [];
let skipDelete = false;

function getFilePath(channelId) {
  return `./eventData_${channelId}.json`;
}

function loadEventData(channelId) {
  const filePath = getFilePath(channelId);
  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath);
    const parsedData = JSON.parse(rawData);
    participants = parsedData.participants;
    cardSet = parsedData.cardSet;
    messagesToUpdate = parsedData.messagesToUpdate;
    skipDelete = parsedData.skipDelete || false; // Load skipDelete state
  } else {
    participants = {};
    cardSet = 'TBD';
    listMessageIds = [];
    messagesToUpdate = [];
    skipDelete = false;
  }
}

function saveEventData(channelId) {
  const filePath = getFilePath(channelId);
  const data = {
    participants,
    cardSet,
    messagesToUpdate,
    skipDelete,
  };
  fs.writeFileSync(filePath, JSON.stringify(data));
}

async function generateListText() {
  let list = `Draft ${getNextMonday()} ${cardSet || "TBD"}:\n`;
  let count = 1;
  for (const [id, data] of Object.entries(participants)) {
    const user = await client.users.fetch(id);
    const name = data?.displayName || user.username;
    list += `${count}. ${name}\n`;
    count++;

    if (data.plusOnes) {
      for (let i = 1; i <= data.plusOnes; i++) {
        list += `${count}. ${name}'s plus one\n`;
        count++;
      }
    }
  }
  return list;
}

client.once('ready', () => {
  console.log('Bot is online.');
});

function clearParticipants(channelId) {
  if (skipDelete) {
    console.log("Skip delete is active, not clearing data.");
    skipDelete = false; // Reset skipDelete
    saveEventData(channelId);
    return;
  }
  participants = {};
  cardSet = 'TBD';
  listMessageIds = [];
  messagesToUpdate = [];
  saveEventData(channelId);
  console.log("Participants list and card set have been cleared.");
}

cron.schedule(
  '59 23 * * 1',
  () => {
    try {
      clearParticipants(channelId);
    } catch (err) {
      console.log('Failed to clear event data', err);
    }
  },
  {
    timezone: "America/New_York",
  }
);

function getNextMonday() {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7));
  nextMonday.setHours(0, 0, 0, 0);

  const month = nextMonday.getMonth() + 1;
  const day = nextMonday.getDate();

  return `${month}/${day}`;
}

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const channelId = message.channel.id;
  loadEventData(channelId);

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  const username = message.member.displayName;

  if (command === 'toggleskip') {
    skipDelete = !skipDelete;
    message.channel.send(`Skip delete event is now set to ${skipDelete}.`);
  }

  if (command === 'join' || command === 'jawn') {
    const displayName = message.member.displayName;
    participants[userId] = { plusOnes: 0, displayName };
    const list = await generateListText();
    message.channel.send(`${username} has ${command}ed the draft.\n\n${list}`);
  } else if (command === 'leave') {
    delete participants[userId];
    const list = await generateListText();
    message.channel.send(`${username} has left the draft.\n\n${list}`);
  } else if (command === 'addplusone') {
    if (participants[userId]) {
      participants[userId].plusOnes++;
      const list = await generateListText();
      message.channel.send(`${username} has added a plus one.\n\n${list}`);
    } else {
      message.channel.send(`${username}, you need to join the event first.`);
    }
  } else if (command === 'removeplusone') {
    if (participants[userId] && participants[userId].plusOnes > 0) {
      participants[userId].plusOnes--;
      const list = await generateListText();
      message.channel.send(`${username} has removed a plus one.\n\n${list}`);
    } else {
      message.channel.send(`${username}, you don't have any plus ones to remove.`);
    }
  } else if (command === 'set') {
    cardSet = args.join(' ');
    message.channel.send(`The card set for the draft has been set to ${cardSet}.`);
  } else if (command === 'list') {
    const list = await generateListText();
    await message.channel.send(list);
  } else if (command === 'help') {
    message.channel.send('Commands:\n!join - join the draft!\n!leave - leave the draft!\n!addplusone - adds a plus one\n!removeplusone - removes a plus one if you have one\n!set [Card Set] - sets the card set of the event\n!list - lists the current draft participants\n!cleardraft - clears the draft data\n!toggleskip - skips automatic event deletion for one week.');
  } else if (command === 'cleardraft') {
    clearParticipants(channelId);
    message.channel.send(`The draft has been cleared.`);
  }
  saveEventData(channelId);
});

client.login(BOT_TOKEN);