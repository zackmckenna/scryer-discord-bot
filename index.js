require('dotenv').config();
const http = require('http');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});
const { Axiom } = require('@axiomhq/js');

const axiom = new Axiom({ token: process.env.AXIOM_TOKEN });
const _logBuffer = [];
const _origLog = console.log.bind(console);
const _origError = console.error.bind(console);
const _origWarn = console.warn.bind(console);

function _buffer(level, args) {
  _logBuffer.push({ _time: new Date().toISOString(), level, message: args.map(String).join(' '), service: 'scryer' });
}
console.log   = (...a) => { _origLog(...a);   _buffer('info',  a); };
console.error = (...a) => { _origError(...a); _buffer('error', a); };
console.warn  = (...a) => { _origWarn(...a);  _buffer('warn',  a); };

setInterval(async () => {
  if (!_logBuffer.length) return;
  const batch = _logBuffer.splice(0);
  try { axiom.ingest('scryer', batch); await axiom.flush(); } catch (_) {}
}, 10000);

process.on('beforeExit', () => axiom.flush().catch(() => {}));

// Health check server for failover monitoring
const HEALTH_PORT = 3099;
http.createServer((req, res) => {
  if (req.url === '/health') {
    const status = { status: 'ok', bot: client.isReady() ? 'connected' : 'connecting' };
    res.writeHead(client.isReady() ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(HEALTH_PORT, () => console.log('Health check listening on :' + HEALTH_PORT));
const cron = require('node-cron');
const Discord = require('discord.js');
const { GatewayIntentBits, Options } = require('discord.js');
const fs = require("fs");

// Event sourcing module
const { initRedis, publishEvent, getPlayerStats, getFlakeLeaderboard, refreshStats } = require('./events.js');

// Generate draft ID from channel and date
function getDraftId(channelId) {
  const today = new Date().toISOString().split('T')[0];
  return `draft-${channelId}-${today}`;
}
const path = require("path");

const client = new Discord.Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
  // Memory optimization: disable caching
  makeCache: Options.cacheWithLimits({
    MessageManager: 0,
    GuildMemberManager: {
      maxSize: 50,
      keepOverLimit: (member) => member.id === client.user?.id,
    },
    PresenceManager: 0,
    ReactionManager: 0,
    GuildMessageManager: 0,
    ThreadManager: 0,
    ThreadMemberManager: 0,
  }),
  sweepers: {
    messages: {
      interval: 300,
      lifetime: 60,
    },
    users: {
      interval: 600,
      filter: () => (user) => user.id !== client.user?.id,
    },
  },
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

async function loadEventData(channelId) {
  try {
    const [stateRes, partRes] = await Promise.all([
      db.execute({ sql: 'SELECT card_set, skip_delete FROM draft_state WHERE channel_id = ?', args: [channelId] }),
      db.execute({ sql: 'SELECT user_id, display_name, plus_ones FROM draft_participants WHERE channel_id = ? ORDER BY joined_at', args: [channelId] }),
    ]);
    const state = stateRes.rows[0];
    cardSet = state ? state.card_set : 'TBD';
    skipDelete = state ? Boolean(state.skip_delete) : false;
    participants = {};
    for (const row of partRes.rows) {
      participants[row.user_id] = { displayName: row.display_name, plusOnes: row.plus_ones };
    }
  } catch (e) {
    console.error('[DB] loadEventData failed:', e.message);
  }
}

async function saveEventData(channelId) {
  try {
    await db.execute({
      sql: 'INSERT INTO draft_state (channel_id, card_set, skip_delete) VALUES (?, ?, ?) ON CONFLICT(channel_id) DO UPDATE SET card_set=excluded.card_set, skip_delete=excluded.skip_delete',
      args: [channelId, cardSet, skipDelete ? 1 : 0],
    });
    await db.execute({ sql: 'DELETE FROM draft_participants WHERE channel_id = ?', args: [channelId] });
    for (const [userId, data] of Object.entries(participants)) {
      await db.execute({
        sql: 'INSERT INTO draft_participants (channel_id, user_id, display_name, plus_ones) VALUES (?, ?, ?, ?)',
        args: [channelId, userId, data.displayName, data.plusOnes],
      });
    }
  } catch (e) {
    console.error('[DB] saveEventData failed:', e.message);
  }
}

async function generateListText() {
  let list = `Draft ${getNextMonday()} ${cardSet || "TBD"}:\n`;
  let count = 1;
  for (const [id, data] of Object.entries(participants)) {
    const name = data?.displayName || id;
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

client.once('ready', async () => {
  console.log('✓ Scryer bot connected successfully!');
  console.log(`  Username: ${client.user.tag}`);
  console.log(`  User ID: ${client.user.id}`);
  console.log(`  Servers: ${client.guilds.cache.size}`);
  console.log(`  Prefix: ${prefix}`);
  console.log('  Ready to accept commands!');
  await initRedis();
});

// Error handlers for observability
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('Discord client warning:', warning);
});

client.on('shardError', (error) => {
  console.error('WebSocket error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

async function clearParticipants(channelId) {
  if (skipDelete) {
    console.log("Skip delete is active, not clearing data.");
    skipDelete = false;
    await saveEventData(channelId);
    return;
  }
  participants = {};
  cardSet = 'TBD';
  listMessageIds = [];
  messagesToUpdate = [];
  await saveEventData(channelId);
  console.log("Participants list and card set have been cleared.");
}

cron.schedule(
  '59 23 * * 1',
  async () => {
    try {
      console.log('[CRON] Running weekly cleanup...');
      const res = await db.execute('SELECT DISTINCT channel_id FROM draft_state');
      for (const row of res.rows) {
        const channelId = row.channel_id;
        await loadEventData(channelId);
        await clearParticipants(channelId);
        console.log(`[CRON] Cleared data for channel: ${channelId}`);
      }
    } catch (err) {
      console.error('[CRON] Failed to clear event data:', err);
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
  // Log all messages for debugging (can be removed later)
  if (message.content.startsWith(prefix)) {
    console.log(`[CMD] Channel ${message.channel.id}: ${message.author.tag} - ${message.content}`);
  }

  if (!message.content.startsWith(prefix) || message.author.bot) return;
  if (!message.member) return;

  const channelId = message.channel.id;
  await loadEventData(channelId);

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  const username = message.member.displayName;

  try {
    if (command === 'toggleskip') {
      skipDelete = !skipDelete;
      await message.channel.send(`Skip delete event is now set to ${skipDelete}.`);
      console.log(`[CMD] ${username} toggled skip: ${skipDelete}`);
    }
    else if (command === 'join' || command === 'jawn') {
      const displayName = message.member.displayName;
      participants[userId] = { plusOnes: 0, displayName };
      
      // Publish join event
      await publishEvent('draft.player_joined', {
        draft_id: getDraftId(channelId),
        player_id: userId,
        player_name: displayName,
        channel_id: channelId,
        set: cardSet
      });
      const list = await generateListText();
      await message.channel.send(`${username} has ${command}ed the draft.\n\n${list}`);
      console.log(`[CMD] ${username} joined the draft`);
    } else if (command === 'leave') {
      const leavingPlayer = participants[userId];
      delete participants[userId];
      
      // Publish leave event
      await publishEvent('draft.player_left', {
        draft_id: getDraftId(channelId),
        player_id: userId,
        player_name: leavingPlayer?.displayName || username,
        channel_id: channelId,
        reason: 'manual',
        set: cardSet
      });
      const list = await generateListText();
      await message.channel.send(`${username} has left the draft.\n\n${list}`);
      console.log(`[CMD] ${username} left the draft`);
    } else if (command === 'addplusone') {
      if (participants[userId]) {
        participants[userId].plusOnes++;
        const list = await generateListText();
        await message.channel.send(`${username} has added a plus one.\n\n${list}`);
        console.log(`[CMD] ${username} added plus one`);
      } else {
        await message.channel.send(`${username}, you need to join the event first.`);
      }
    } else if (command === 'removeplusone') {
      if (participants[userId] && participants[userId].plusOnes > 0) {
        participants[userId].plusOnes--;
        const list = await generateListText();
        await message.channel.send(`${username} has removed a plus one.\n\n${list}`);
        console.log(`[CMD] ${username} removed plus one`);
      } else {
        await message.channel.send(`${username}, you don't have any plus ones to remove.`);
      }
    } else if (command === 'set') {
      cardSet = args.join(' ');
      await message.channel.send(`The card set for the draft has been set to ${cardSet}.`);
      console.log(`[CMD] ${username} set card set to: ${cardSet}`);
    } else if (command === 'fire' || command === 'start') {
      const playerCount = Object.keys(participants).length;
      const playerNames = Object.values(participants).map(p => p.displayName);

      // Publish draft started event
      await publishEvent('draft.started', {
        draft_id: getDraftId(channelId),
        channel_id: channelId,
        set: cardSet,
        player_count: playerCount,
        players: playerNames
      });

      await message.channel.send(`🔥 **Draft ${cardSet} has FIRED!**\n\nPlayers: ${playerCount}\n${playerNames.join(', ')}\n\nGood luck everyone!`);
      console.log(`[CMD] ${username} fired draft with ${playerCount} players for set: ${cardSet}`);
    } else if (command === 'list') {
      const list = await generateListText();
      await message.channel.send(list);
      console.log(`[CMD] ${username} requested list`);
    } else if (command === 'help') {
      await message.channel.send('Commands:\n!join - join the draft!\n!leave - leave the draft!\n!addplusone - adds a plus one\n!removeplusone - removes a plus one if you have one\n!set [Card Set] - sets the card set of the event\n!fire - marks the draft as started (for tracking)\n!list - lists the current draft participants\n!stats [@user] - show draft participation stats\n!leaderboard - show flake leaderboard\n!sets - show set popularity stats\n!cleardraft - clears the draft data\n!toggleskip - skips automatic event deletion for one week.');
      console.log(`[CMD] ${username} requested help`);
    } else if (command === 'stats') {
      const mention = message.mentions.users.first();
      const targetUser = mention || message.author;
      const targetName = mention?.username || message.author.username;

      await refreshStats();
      const stats = await getPlayerStats(targetName);

      if (!stats || stats.drafts_joined === '0') {
        await message.channel.send(`📊 No draft history found for ${targetName}`);
        return;
      }

      const flakeRate = stats.flake_percentage || 0;
      const flakeEmoji = flakeRate > 30 ? '🚩' : flakeRate > 15 ? '🟡' : '🟢';

      const response = `📊 **Draft Stats for ${targetName}**
Drafts Joined: ${stats.drafts_joined}
Times Flaked: ${stats.drafts_flaked || 0}
Flake Rate: ${flakeRate}% ${flakeEmoji}
Last Draft: ${stats.last_draft_date ? new Date(stats.last_draft_date).toLocaleDateString() : 'Never'}`;

      await message.channel.send(response);
      console.log(`[CMD] ${username} requested stats for ${targetName}`);
    } else if (command === 'leaderboard') {
      await refreshStats();
      const { worst, best } = await getFlakeLeaderboard(3);

      let response = '📊 **Flake Leaderboard**\n\n';

      if (worst.length > 0) {
        response += '🚩 **Most Unreliable:**\n';
        worst.forEach((player, i) => {
          response += `${i+1}. ${player.player_name}: ${player.flake_percentage}% (${player.drafts_flaked}/${player.drafts_joined})\n`;
        });
      }

      response += '\n';

      if (best.length > 0) {
        response += '🟢 **Most Reliable:**\n';
        best.forEach((player, i) => {
          response += `${i+1}. ${player.player_name}: ${player.flake_percentage}% (${player.drafts_flaked}/${player.drafts_joined})\n`;
        });
      }

      if (worst.length === 0 && best.length === 0) {
        response = '📊 Not enough draft history yet!';
      }

      await message.channel.send(response);
      console.log(`[CMD] ${username} requested leaderboard`);
    } else if (command === 'sets') {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'homelab',
        user: 'admin',
        password: 'changeme_secure_password',
      });

      try {
        await pool.query('REFRESH MATERIALIZED VIEW drafts.set_stats');
        const result = await pool.query(
          'SELECT * FROM drafts.set_stats ORDER BY total_drafts DESC LIMIT 5'
        );

        if (result.rows.length === 0) {
          await message.channel.send('📊 No set data available yet! Use `!set <setname>` and `!fire` to track sets.');
          return;
        }

        let response = '📊 **Set Popularity Stats**\n\n';
        result.rows.forEach((set, i) => {
          const fireRate = set.fire_rate_percentage || 0;
          const emoji = fireRate >= 80 ? '🔥' : fireRate >= 50 ? '🟡' : '🔵';
          response += `${i+1}. **${set.set_name}** ${emoji}\n`;
          response += `   Drafts: ${set.total_drafts} | Fired: ${set.drafts_fired} (${fireRate}%)\n`;
          if (set.avg_players_per_draft) {
            response += `   Avg Players: ${parseFloat(set.avg_players_per_draft).toFixed(1)}\n`;
          }
          response += '\n';
        });

        await message.channel.send(response);
        console.log(`[CMD] ${username} requested set stats`);
      } catch (err) {
        console.error('[ERROR] Set stats query failed:', err);
        await message.channel.send('❌ Failed to fetch set stats.');
      } finally {
        pool.end();
      }
    } else if (command === 'cleardraft') {
      await clearParticipants(channelId);
      await message.channel.send(`The draft has been cleared.`);
      console.log(`[CMD] ${username} cleared draft`);
    }
    await saveEventData(channelId);
  } catch (error) {
    console.error(`[ERROR] Command ${command} failed:`, error);
    await message.channel.send('Sorry, an error occurred processing that command.').catch(e =>
      console.error('[ERROR] Failed to send error message:', e)
    );
  }
});

async function loginWithRetry(retries = 0) {
  try {
    await client.login(BOT_TOKEN);
  } catch (error) {
    const delay = Math.min(30000, 5000 * Math.pow(2, retries));
    console.error('Failed to login, retrying in ' + (delay/1000) + 's...', error.message);
    setTimeout(() => loginWithRetry(retries + 1), delay);
  }
}

console.log('Starting Scryer bot...');
loginWithRetry();
