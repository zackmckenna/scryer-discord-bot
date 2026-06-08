const { Pool } = require('pg');
const { createClient } = require('redis');

// PostgreSQL connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'homelab',
  user: 'admin',
  password: 'changeme_secure_password',
});

// Redis connection
let redisClient = null;
let redisConnected = false;

async function initRedis() {
  try {
    redisClient = createClient({ 
      url: 'redis://localhost:6379',
      password: 'changeme_redis_password'
    });
    
    redisClient.on('error', (err) => {
      console.error('[REDIS] Error:', err.message);
      redisConnected = false;
    });
    
    redisClient.on('connect', () => {
      console.log('[REDIS] ✅ Connected');
      redisConnected = true;
    });

    await redisClient.connect();
  } catch (err) {
    console.error('[REDIS] Failed to connect:', err.message);
  }
}

// Publish event to both Redis and PostgreSQL
async function publishEvent(eventType, data) {
  const event = {
    event_type: eventType,
    draft_id: data.draft_id,
    player_id: data.player_id,
    player_name: data.player_name,
    channel_id: data.channel_id,
    data: data,
    timestamp: new Date().toISOString()
  };

  // 1. Publish to Redis Stream (for real-time consumers)
  if (redisConnected) {
    try {
      await redisClient.xAdd('drafts:events', '*', {
        type: eventType,
        data: JSON.stringify(event)
      });
      console.log(`[EVENT] Redis → ${eventType}`);
    } catch (err) {
      console.error('[EVENT] Redis publish failed:', err.message);
    }
  }

  // 2. Write to PostgreSQL (for querying/stats)
  try {
    await pool.query(
      `INSERT INTO drafts.events (event_type, draft_id, player_id, player_name, channel_id, data, timestamp)
       VALUES (, , , , , , )`,
      [
        event.event_type,
        event.draft_id,
        event.player_id,
        event.player_name,
        event.channel_id,
        event.data,
        event.timestamp
      ]
    );
    console.log(`[EVENT] PostgreSQL → ${eventType}`);
  } catch (err) {
    console.error('[EVENT] PostgreSQL write failed:', err.message);
  }
}

// Get player stats from materialized view
async function getPlayerStats(playerName) {
  try {
    const result = await pool.query(
      'SELECT * FROM drafts.player_stats WHERE player_name = ',
      [playerName]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('[STATS] Query failed:', err.message);
    return null;
  }
}

// Get flake leaderboard
async function getFlakeLeaderboard(limit = 5) {
  try {
    const worst = await pool.query(
      `SELECT player_name, drafts_joined, drafts_flaked, flake_percentage
       FROM drafts.player_stats 
       WHERE drafts_joined >= 3
       ORDER BY flake_percentage DESC NULLS LAST
       LIMIT `,
      [limit]
    );
    
    const best = await pool.query(
      `SELECT player_name, drafts_joined, drafts_flaked, flake_percentage
       FROM drafts.player_stats 
       WHERE drafts_joined >= 3
       ORDER BY flake_percentage ASC
       LIMIT `,
      [limit]
    );
    
    return { worst: worst.rows, best: best.rows };
  } catch (err) {
    console.error('[LEADERBOARD] Query failed:', err.message);
    return { worst: [], best: [] };
  }
}

// Refresh materialized view
async function refreshStats() {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW drafts.player_stats');
    console.log('[STATS] Materialized view refreshed');
  } catch (err) {
    console.error('[STATS] Refresh failed:', err.message);
  }
}

module.exports = {
  initRedis,
  publishEvent,
  getPlayerStats,
  getFlakeLeaderboard,
  refreshStats
};
