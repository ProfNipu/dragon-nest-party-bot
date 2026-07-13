// Simple in-memory store of active parties, keyed by the Discord message ID
// that hosts the party's embed. Swap this for a database (SQLite, etc.) if
// you need parties to survive a bot restart.

const parties = new Map();

// Full labels (emoji + name) shown in the embed roster fields.
const ROLE_LABELS = {
  tank: "🛡️ Paladin",
  healer: "❤️ Healers",
  swordmaster: "⚔️ Swordmasters",
  mercenary: "🗡️ Mercenaries",
  sorceress: "🔮 Sorceresses",
  acrobat: "🤸 Acrobats",
  flexible: "🔀 Flexible (DPS)",
};

// Short labels for button text — buttons have limited horizontal space,
// especially with 5 roles in one row.
const ROLE_BUTTON_LABELS = {
  tank: "Paladin",
  healer: "Healers",
  swordmaster: "SM",
  mercenary: "Merc",
  sorceress: "Sorc",
  acrobat: "Acro",
  flexible: "Flex",
};

function createParty({ messageId, channelId, leaderId, activity, time, note, nestType, roleCaps }) {
  const roles = {};
  for (const [key, cap] of Object.entries(roleCaps)) {
    if (cap > 0) {
      roles[key] = { cap, members: [] };
    }
  }

  const party = {
    messageId,
    channelId,
    leaderId,
    activity,
    time: time || null,
    note: note || null,
    nestType: nestType || null,
    roles,
    createdAt: Date.now(),
  };

  parties.set(messageId, party);
  return party;
}

function getParty(messageId) {
  return parties.get(messageId);
}

function getAllParties() {
  return Array.from(parties.values());
}

function deleteParty(messageId) {
  return parties.delete(messageId);
}

// Moves a party's data from its old message ID to a new one — used when
// reposting ("recalling") a party under a fresh message so old join/leave
// buttons don't linger on a buried message.
function rekeyParty(oldMessageId, newMessageId) {
  const party = parties.get(oldMessageId);
  if (!party) return null;
  parties.delete(oldMessageId);
  party.messageId = newMessageId;
  parties.set(newMessageId, party);
  return party;
}

// Adds a user to a role, removing them from any other role in the same
// party first (a member can only hold one role at a time). Each member is
// stored as { userId, subclass } — subclass is null for roles that don't
// have subclass choices defined.
// Returns a status string: "joined" | "full" | "no-such-role"
function joinRole(messageId, userId, roleKey, subclass = null) {
  const party = parties.get(messageId);
  if (!party) return "no-such-party";
  const role = party.roles[roleKey];
  if (!role) return "no-such-role";

  removeMember(messageId, userId); // clear any existing signup first

  if (role.members.length >= role.cap) return "full";
  role.members.push({ userId, subclass });
  return "joined";
}

function removeMember(messageId, userId) {
  const party = parties.get(messageId);
  if (!party) return false;
  let removed = false;
  for (const role of Object.values(party.roles)) {
    const idx = role.members.findIndex((m) => m.userId === userId);
    if (idx !== -1) {
      role.members.splice(idx, 1);
      removed = true;
    }
  }
  return removed;
}

function isFull(party) {
  return Object.values(party.roles).every((r) => r.members.length >= r.cap);
}

// Does this user currently hold any role in the party?
function isMember(party, userId) {
  return Object.values(party.roles).some((role) =>
    role.members.some((m) => m.userId === userId)
  );
}

// Every current member's user ID across all roles, no duplicates.
function getAllMemberIds(party) {
  const ids = new Set();
  for (const role of Object.values(party.roles)) {
    for (const member of role.members) ids.add(member.userId);
  }
  return Array.from(ids);
}

module.exports = {
  ROLE_LABELS,
  ROLE_BUTTON_LABELS,
  createParty,
  getParty,
  getAllParties,
  deleteParty,
  rekeyParty,
  joinRole,
  removeMember,
  isFull,
  isMember,
  getAllMemberIds,
};