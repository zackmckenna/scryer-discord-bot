# Scryer Discord Bot

A Discord bot for managing Magic: The Gathering draft events with automated participant tracking and weekly cleanup.

## Features

- **Draft Management**: Track participants for weekly MTG draft events
- **Plus Ones**: Allow participants to add guest players
- **Card Set Tracking**: Set and display the card set for each draft
- **Automated Cleanup**: Automatically clears event data every Monday at 11:59 PM ET
- **Skip Protection**: Toggle to prevent automatic cleanup for one week
- **Multi-Channel Support**: Maintains separate event data per Discord channel

## Commands

| Command | Description |
|---------|-------------|
| `!join` or `!jawn` | Join the draft |
| `!leave` | Leave the draft |
| `!addplusone` | Add a plus one to your registration |
| `!removeplusone` | Remove a plus one from your registration |
| `!set [Card Set]` | Set the card set for the draft |
| `!list` | Display current participants |
| `!cleardraft` | Manually clear all draft data |
| `!toggleskip` | Skip automatic cleanup for one week |
| `!help` | Display help message |

## Setup

### Prerequisites

- Node.js 18 or higher
- Discord Bot Token
- Docker (optional)

### Environment Variables

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_discord_bot_token_here
```

### Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/zackmckenna/scryer-discord-bot.git
cd scryer-discord-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and add your Discord bot token
```

4. **Run the bot:**
```bash
npm start
```

### Detailed Setup

1. Clone the repository:
```bash
git clone https://github.com/zackmckenna/scryer-discord-bot.git
cd scryer-discord-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create your `.env` file with your Discord bot token

4. Run the bot:
```bash
npm start
# or for development with auto-restart:
npm run dev
```

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

2. Or build and run manually:
```bash
docker build -t scryer-bot .
docker run -d --name scryer-bot --env-file .env -v $(pwd)/data:/app/data scryer-bot
```

### Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token to your `.env` file
4. Generate an invite link with the following permissions:
   - **Send Messages** - Required for bot responses
   - **Read Message History** - Required to read user commands
   - **Use External Emojis** (optional) - For enhanced visual responses

5. **Bot invite URL format:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=3072&scope=bot
```
Replace `YOUR_BOT_CLIENT_ID` with your bot's client ID from the Developer Portal.

## Data Persistence

The bot stores event data in JSON files named `eventData_<channelId>.json`. Each Discord channel maintains its own separate event data.

In Docker deployments, event data is persisted through volume mounts to prevent data loss on container restarts.

## Scheduled Tasks

- **Weekly Cleanup**: Every Monday at 11:59 PM Eastern Time, the bot automatically clears participant data
- **Skip Toggle**: Use `!toggleskip` to prevent cleanup for one week

## Development

The bot is built with:
- **discord.js v14** - Discord API wrapper
- **node-cron** - Scheduled task management
- **dotenv** - Environment variable management

### Project Structure

```
scryer/
├── index.js          # Main bot application
├── package.json      # Dependencies and scripts
├── Dockerfile        # Container definition
├── docker-compose.yml # Container orchestration
├── .gitignore        # Git ignore patterns
├── .dockerignore     # Docker ignore patterns
└── README.md         # This file
```

## Troubleshooting

### Common Issues

**Bot doesn't respond to commands:**
- Verify the bot token is correct in your `.env` file
- Check that the bot is online in your Discord server (should show as online)
- Ensure the bot has "Send Messages" permission in the channel
- Commands must start with `!` (e.g., `!help` not `help`)

**Bot loses data after restart:**
- For local development: Event data files are automatically saved
- For Docker: Ensure volume mounts are configured correctly
- Check file permissions if running in Docker

**Scheduled cleanup not working:**
- The bot clears data every Monday at 11:59 PM Eastern Time
- Use `!toggleskip` to skip cleanup for one week if needed
- Check container timezone settings if using Docker

### Getting Help

If you encounter issues:
1. Check the console/logs for error messages
2. Verify your Discord bot token and permissions
3. Test commands in a channel where the bot has full permissions
4. Create an issue on GitHub with details about the problem

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - See package.json for details