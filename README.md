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

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd scryer
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
npm run watch
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
4. Invite the bot to your server with the following permissions:
   - Send Messages
   - Read Message History
   - Use Slash Commands (optional for future updates)

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - See package.json for details