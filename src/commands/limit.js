const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getStatus } = require("../handlers/limitManager");
const { DUNGEONS } = require("../handlers/dungeons");
const { getCharacters } = require("../handlers/characterManager");

const ALLOWED_ROLES = ["Supreme Leader", "Vice", "Officer"];

function memberHasAllowedRole(member) {
  if (!member?.roles) return false;
  return member.roles.cache.some((role) => ALLOWED_ROLES.includes(role.name));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("limit")
    .setDescription("Check your remaining weekly clears for dungeons/nests")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Whose limit to check (defaults to you, requires Officer/Vice/Supreme Leader)")
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("user") ?? interaction.user;

    if (targetUser.id !== interaction.user.id && !memberHasAllowedRole(interaction.member)) {
      return interaction.reply({
        content: "❌ You need the **Officer**, **Vice**, or **Supreme Leader** role to check other people's limits.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const chars = getCharacters(targetUser.id);
    if (chars.length === 0) {
      const whose = targetUser.id === interaction.user.id ? "Kamu" : `${targetUser.username}`;
      return interaction.reply({
        content: `${whose} belum daftarin karakter! Pake \`/character add\` dulu ya.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const activities = DUNGEONS.map((d) => ({ name: d.name, limit: d.weeklyLimit }));

    const result = [];
    for (const char of chars) {
      const statuses = getStatus(char.ign, activities);
      const lines = statuses.map(
        (s) => `${s.remaining > 0 ? "✅" : "⛔"} **${s.name}** — ${s.used}/${s.limit}`
      );
      result.push(`**${char.ign}** (${char.className})`, ...lines, "");
    }

    return interaction.reply({
      content: `**📊 Weekly Limit — ${targetUser.username}**\n\n${result.join("\n")}`,
    });
  },
};
