# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Scryer**, a Discord bot designed for managing Magic: The Gathering draft events. The bot handles participant registration, plus-one management, card set tracking, and automated weekly cleanup of draft data.

## Development Commands

**Start the bot:**
```bash
cd scryer
npm start
```

**Development with auto-restart:**
```bash
cd scryer
npm run dev
```

**Install dependencies:**
```bash
cd scryer
npm install
```

**Docker deployment:**
```bash
cd scryer
docker-compose up -d
```

**Build Docker image manually:**
```bash
cd scryer
docker build -t scryer-bot .
```

## Architecture

### Core Components

- **`index.js`**: Main bot application containing all command handling, event data persistence, and scheduled cleanup
- **`commands.js`**: Slash command definitions (appears to be unused/legacy code)
- **`package.json`**: Dependencies and npm scripts

### Key Features

1. **Per-Channel Event Data**: Each Discord channel maintains separate event data stored in `eventData_<channelId>.json` files
2. **Persistent Storage**: Event data persists between bot restarts using JSON file storage
3. **Scheduled Cleanup**: Automatic participant list clearing every Monday at 11:59 PM ET using node-cron
4. **Skip Protection**: `!toggleskip` command allows bypassing one week of automatic cleanup

### Command System

The bot uses a prefix-based command system (`!` prefix) with the following commands:
- `!join` / `!jawn`: Join draft
- `!leave`: Leave draft  
- `!addplusone` / `!removeplusone`: Manage guest players
- `!set [Card Set]`: Set the card set for the draft
- `!list`: Display current participants
- `!cleardraft`: Manual cleanup
- `!toggleskip`: Skip automatic cleanup for one week
- `!help`: Display help

### Data Structure

Event data is stored per channel with the following structure:
```javascript
{
  participants: { 
    userId: { 
      plusOnes: number, 
      displayName: string 
    } 
  },
  cardSet: string,
  messagesToUpdate: array,
  skipDelete: boolean
}
```

## Environment Setup

Required environment variables in `.env` file:
- `BOT_TOKEN`: Discord bot token

## Dependencies

- **discord.js v14**: Discord API wrapper
- **node-cron**: Scheduled task management  
- **dotenv**: Environment variable management
- **nodemon**: Development auto-restart

## Docker Configuration

- Uses Node.js 18 Alpine base image
- Runs as non-root user for security
- Volume mounts for data persistence
- Production-ready logging configuration

## Bot Permissions Required

- Send Messages
- Read Message History
- Use External Emojis (optional)

## File Structure

```
scryer/
├── index.js              # Main bot application
├── commands.js           # Legacy slash commands (unused)
├── package.json          # Dependencies and scripts
├── Dockerfile           # Container definition
├── docker-compose.yml   # Container orchestration
├── eventData_*.json     # Per-channel event data files
└── README.md           # Project documentation
```