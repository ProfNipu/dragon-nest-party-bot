const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { ROLE_LABELS, isFull, getAllMemberIds } = require("./partyManager");

// ROLE_LABELS values are "<emoji> <name>" — this pulls just the leading
// emoji out regardless of how many words follow (so multi-word names like
// "Flexible (DPS)" don't break button rendering).
function roleEmoji(roleKey) {
  return ROLE_LABELS[roleKey].split(" ")[0];
}

// Same idea but returns everything after the emoji — the plain role name
// used in each member line (e.g. "Paladin", "Flexible (DPS)").
function roleNamePlain(roleKey) {
  return ROLE_LABELS[roleKey].split(" ").slice(1).join(" ");
}

// Short codes used in the roster list. Roles with a plain string code get
// numbered only when more than one slot is open (PL, then PL1/PL2/...).
// Sorceress uses two fixed, non-numbered codes (EL, FU) since its two
// slots aren't interchangeable — SOR3/SOR4 is a fallback if a party ever
// asks for more than 2. Flexible always numbers its slots (DPS1, DPS2...)
// since those slots are naturally interchangeable and can be many.
const ROLE_CODES = {
  tank: "PL",
  healer: "PR",
  swordmaster: "SM",
  mercenary: "MC",
  sorceress: ["Sorce", "FU"],
  acrobat: "Arc",
  flexible: "DPS",
};

function getSlotCode(roleKey, index, cap) {
  if (roleKey === "sorceress") {
    return ROLE_CODES.sorceress[index] || `SOR${index + 1}`;
  }
  if (roleKey === "flexible") {
    return `${ROLE_CODES.flexible}${index + 1}`;
  }
  const code = ROLE_CODES[roleKey] || roleKey.toUpperCase();
  return cap > 1 ? `${code}${index + 1}` : code;
}

// The label shown on the join button itself — one button covers the whole
// role (not a single slot). Sorceress shows "Sorce" rather than its two
// slot codes (EL/FU), since those are roster-line codes, not a button name.
function getRoleButtonCode(roleKey) {
  if (roleKey === "sorceress") return "Sorce";
  return ROLE_CODES[roleKey] || roleKey.toUpperCase();
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

  const totalCap = Object.values(party.roles).reduce((sum, r) => sum + r.cap, 0);
  const totalJoined = getAllMemberIds(party).length;
  details.push(`\nStatus : ${isFull(party) ? "FULL" : "OPEN"}`);
  details.push(`Members : ${totalJoined}/${totalCap}`);
  if (party.nestType) details.push(`Raid Nest : ${party.nestType}`);

  embed.setDescription(details.join("\n"));

  const rosterEntries = [];
  for (const [roleKey, role] of Object.entries(party.roles)) {
    for (let i = 0; i < role.cap; i++) {
      const code = getSlotCode(roleKey, i, role.cap);
      const member = role.members[i];
      const value = member
        ? `${member.subclass ? `${member.subclass} ` : ""}<@${member.userId}>`
        : "_open_";
      rosterEntries.push({ code, value });
    }
  }
  const maxCodeLength = Math.max(...rosterEntries.map((e) => e.code.length));
  const rosterLines = rosterEntries.map(
    (e) => `${e.code.padEnd(maxCodeLength)} : ${e.value}`
  );
  embed.addFields({
    name: "\u200b",
    value: rosterLines.join("\n"),
    inline: false,
  });

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
        .setLabel(getRoleButtonCode(roleKey))
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

module.exports = { buildPartyEmbed, buildPartyButtons, getSlotCode };