const { REST } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const { BOT_TOKEN } = process.env;

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!'
  },
  {
    name: 'join',
    description: 'Join the Magic: The Gathering event'
  },
  {
    name: 'leave',
    description: 'Leave the Magic: The Gathering event'
  },
  {
    name: 'list_players',
    description: 'List all players in the Magic: The Gathering event'
  },
];

const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();