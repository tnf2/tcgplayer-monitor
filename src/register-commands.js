require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('add-monitor').setDescription('Monitor a TCGPlayer product for price alerts')
    .addStringOption(o => o.setName('url').setDescription('TCGPlayer product URL').setRequired(true))
    .addNumberOption(o => o.setName('max_price').setDescription('Buy Target (Max Price) — alert when total price drops to or below this').setRequired(false))
    .addNumberOption(o => o.setName('min_price').setDescription('Sell Target (Min Price) — alert when total price rises to or above this').setRequired(false)),
  new SlashCommandBuilder().setName('list-monitors').setDescription('List your active monitors'),
  new SlashCommandBuilder().setName('remove-monitor').setDescription('Remove a monitor')
    .addIntegerOption(o => o.setName('id').setDescription('Monitor ID').setRequired(true)),
  new SlashCommandBuilder().setName('pause-monitor').setDescription('Pause a monitor')
    .addIntegerOption(o => o.setName('id').setDescription('Monitor ID').setRequired(true)),
  new SlashCommandBuilder().setName('resume-monitor').setDescription('Resume a paused monitor')
    .addIntegerOption(o => o.setName('id').setDescription('Monitor ID').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Trying guild commands first...');
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('Guild commands registered!');
  } catch (e) {
    console.log(`Guild registration failed (${e.message}), trying global...`);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Global commands registered (may take up to 1 hour to appear).');
  }
})();
