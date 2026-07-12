const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { ROLE_LABELS, ROLE_BUTTON_LABELS, isFull } = require("./partyManager");

// ROLE_LABELS values are "<emoji> <name>" — this pulls just the leading
// emoji out regardless of how many words follow (so multi-word names like
// "Flexible (DPS)" don't break button rendering).
function roleEmoji(roleKey) {
  return ROLE_LABELS[roleKey].split(" ")[0];
}

function buildPartyEmbed(party) {
  const embed = new EmbedBuilder()
    .setTitle(`🗡️ ${party.activity}`)
    .setColor(isFull(party) ? 0x2ecc71 : 0x5865f2)
    .setFooter({
      text: isFull(party) ? "Party is full!" : "Tap a role below to join",
    })
    .setTimestamp(party.createdAt);

  const details = [];
  if (party.time) details.push(`🕒 **When:** ${party.time}`);
  details.push(`👑 **Leader:** <@${party.leaderId}>`);
  if (party.note) details.push(`📝 **Note:** ${party.note}`);
  embed.setDescription(details.join("\n"));

  for (const [roleKey, role] of Object.entries(party.roles)) {
    const label = ROLE_LABELS[roleKey];
    const filledSlots = role.members.map((m) =>
      m.subclass ? `<@${m.userId}> — ${m.subclass}` : `<@${m.userId}>`
    );
    while (filledSlots.length < role.cap) filledSlots.push("_open_");
    embed.addFields({
      name: `${label}  (${role.members.length}/${role.cap})`,
      value: filledSlots.join("\n"),
      inline: false,
    });
  }

  return embed;
}

function buildPartyButtons(party) {
  const rows = [];
  let row = new ActionRowBuilder();

  const roleKeys = Object.keys(party.roles);
  roleKeys.forEach((roleKey, i) => {
    const role = party.roles[roleKey];
    const full = role.members.length >= role.cap;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`party:join:${roleKey}`)
        .setLabel(ROLE_BUTTON_LABELS[roleKey])
        .setEmoji(roleEmoji(roleKey))
        .setStyle(full ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(full)
    );
    // Wrap after 3 role buttons per row (Discord's actual max is 5, but 3
    // keeps rows balanced/neat instead of one packed row + a lonely leftover).
    if ((i + 1) % 3 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  });

  // Always push whatever's left in the role-buttons row (even a partial
  // one) before starting a fresh row for Leave/Disband — otherwise role
  // buttons and these two can overflow past the 5-per-row limit together.
  if (row.components.length > 0) {
    rows.push(row);
  }
  row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("party:ping")
      .setLabel("Ping")
      .setEmoji("📣")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("party:leave")
      .setLabel("Leave")
      .setEmoji("🚪")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("party:kick")
      .setLabel("Kick")
      .setEmoji("👢")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("party:finish")
      .setLabel("Finish")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("party:disband")
      .setLabel("Disband")
      .setEmoji("💥")
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(row);

  return rows;
}

module.exports = { buildPartyEmbed, buildPartyButtons };