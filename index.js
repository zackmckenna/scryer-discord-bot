require("dotenv").config();
const cron = require("node-cron");
const Discord = require("discord.js");
const { GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const http = require("http");

const client = new Discord.Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const prefix = "!";
const { BOT_TOKEN } = process.env;
const EVENTS_API = "http://127.0.0.1:18794/api/events";

let participants = {};
let cardSet = "TBD";
let listMessageIds = [];
let messagesToUpdate = [];
let skipDelete = false;

// ============================================================
// EVENT EMITTER - Posts CloudEvents to events-service
// ============================================================

function emitEvent(type, data, subject) {
  const event = {
    specversion: "1.0",
    id: `scryer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: `com.scryer.draft.${type}`,
    source: "scryer-bot",
    subject: subject || undefined,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    data,
  };

  const body = JSON.stringify(event);
  const url = new URL(EVENTS_API);

  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        console.error(`Event emit failed: ${res.statusCode}`);
      }
    }
  );

  req.on("error", (err) => {
    console.error("Event emit error:", err.message);
  });

  req.write(body);
  req.end();
}

// ============================================================
// DATA PERSISTENCE
// ============================================================

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
    skipDelete = parsedData.skipDelete || false;
  } else {
    participants = {};
    cardSet = "TBD";
    listMessageIds = [];
    messagesToUpdate = [];
    skipDelete = false;
  }
}

function saveEventData(channelId) {
  const filePath = getFilePath(channelId);
  const data = { participants, cardSet, messagesToUpdate, skipDelete };
  fs.writeFileSync(filePath, JSON.stringify(data));
}

// ============================================================
// HELPERS
// ============================================================

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

function getNextMonday() {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7));
  nextMonday.setHours(0, 0, 0, 0);
  return `${nextMonday.getMonth() + 1}/${nextMonday.getDate()}`;
}

function getParticipantCount() {
  let total = Object.keys(participants).length;
  for (const data of Object.values(participants)) {
    total += data.plusOnes || 0;
  }
  return total;
}

function clearParticipants(channelId) {
  if (skipDelete) {
    console.log("Skip delete is active, not clearing data.");
    skipDelete = false;
    saveEventData(channelId);
    return;
  }

  const count = getParticipantCount();
  participants = {};
  cardSet = "TBD";
  listMessageIds = [];
  messagesToUpdate = [];
  saveEventData(channelId);

  emitEvent("cleared", {
    channelId,
    previousCount: count,
    trigger: "cron",
  });

  console.log("Participants list and card set have been cleared.");
}

// ============================================================
// LIFECYCLE
// ============================================================

client.once("ready", () => {
  console.log("Bot is online.");
  emitEvent("bot_started", { timestamp: new Date().toISOString() });
});

// Weekly clear: Monday 11:59 PM ET
cron.schedule(
  "59 23 * * 1",
  () => {
    try {
      const files = fs
        .readdirSync("./")
        .filter(
          (file) => file.startsWith("eventData_") && file.endsWith(".json")
        );
      files.forEach((file) => {
        const channelId = file.replace("eventData_", "").replace(".json", "");
        loadEventData(channelId);
        clearParticipants(channelId);
        console.log(`Cleared data for channel: ${channelId}`);
      });
    } catch (err) {
      console.log("Failed to clear event data", err);
    }
  },
  { timezone: "America/New_York" }
);

// ============================================================
// COMMANDS
// ============================================================

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const channelId = message.channel.id;
  loadEventData(channelId);

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  const username = message.member.displayName;

  if (command === "toggleskip") {
    skipDelete = !skipDelete;
    message.channel.send(`Skip delete event is now set to ${skipDelete}.`);
    emitEvent("skip_toggled", { skipDelete, user: username }, channelId);
  }

  if (command === "join" || command === "jawn") {
    participants[userId] = { plusOnes: 0, displayName: username };
    const list = await generateListText();
    message.channel.send(`${username} has ${command}ed the draft.\n\n${list}`);

    emitEvent("joined", {
      user: username,
      userId,
      channelId,
      totalParticipants: getParticipantCount(),
      cardSet,
    }, channelId);

  } else if (command === "leave") {
    delete participants[userId];
    const list = await generateListText();
    message.channel.send(`${username} has left the draft.\n\n${list}`);

    emitEvent("left", {
      user: username,
      userId,
      channelId,
      totalParticipants: getParticipantCount(),
    }, channelId);

  } else if (command === "addplusone") {
    if (participants[userId]) {
      participants[userId].plusOnes++;
      const list = await generateListText();
      message.channel.send(`${username} has added a plus one.\n\n${list}`);

      emitEvent("plusone_added", {
        user: username,
        userId,
        channelId,
        plusOnes: participants[userId].plusOnes,
        totalParticipants: getParticipantCount(),
      }, channelId);
    } else {
      message.channel.send(`${username}, you need to join the event first.`);
    }
  } else if (command === "removeplusone") {
    if (participants[userId] && participants[userId].plusOnes > 0) {
      participants[userId].plusOnes--;
      const list = await generateListText();
      message.channel.send(`${username} has removed a plus one.\n\n${list}`);

      emitEvent("plusone_removed", {
        user: username,
        userId,
        channelId,
        plusOnes: participants[userId].plusOnes,
        totalParticipants: getParticipantCount(),
      }, channelId);
    } else {
      message.channel.send(
        `${username}, you don't have any plus ones to remove.`
      );
    }
  } else if (command === "set") {
    const oldCardSet = cardSet;
    cardSet = args.join(" ");
    message.channel.send(
      `The card set for the draft has been set to ${cardSet}.`
    );

    emitEvent("cardset_changed", {
      user: username,
      channelId,
      oldCardSet,
      newCardSet: cardSet,
    }, channelId);

  } else if (command === "list") {
    const list = await generateListText();
    await message.channel.send(list);
  } else if (command === "help") {
    message.channel.send(
      "Commands:\n!join - join the draft!\n!leave - leave the draft!\n!addplusone - adds a plus one\n!removeplusone - removes a plus one if you have one\n!set [Card Set] - sets the card set of the event\n!list - lists the current draft participants\n!cleardraft - clears the draft data\n!toggleskip - skips automatic event deletion for one week."
    );
  } else if (command === "cleardraft") {
    clearParticipants(channelId);
    message.channel.send(`The draft has been cleared.`);

    emitEvent("cleared", {
      user: username,
      channelId,
      trigger: "manual",
    }, channelId);
  }

  saveEventData(channelId);
});

// ============================================================
// ERROR HANDLING
// ============================================================

client.on("error", (error) => {
  console.error("Discord client error:", error.message);
  emitEvent("error", { error: error.message, type: "client" });
});

client.on("shardError", (error) => {
  console.error("WebSocket error:", error.message);
  emitEvent("error", { error: error.message, type: "shard" });
});

client.on("shardDisconnect", (event, shardId) => {
  console.log(`Shard ${shardId} disconnected (code ${event.code}). Reconnecting...`);
  emitEvent("disconnected", { shardId, code: event.code });
});

client.on("shardReconnecting", (shardId) => {
  console.log(`Shard ${shardId} reconnecting...`);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error?.message || error);
  emitEvent("error", { error: error?.message || String(error), type: "unhandled" });
});

client.login(BOT_TOKEN);
