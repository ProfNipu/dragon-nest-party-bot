require("dotenv").config();
const { Client, GatewayIntentBits, Collection, MessageFlags } = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
const { handleButton, handleSelectMenu, handleModalSubmit } = require("./handlers/buttonHandler");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Load all commands from src/commands into a Collection keyed by command name
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith("party:")) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("party:")) {
      await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith("party:")) {
      await handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: "Something went wrong handling that.", flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);