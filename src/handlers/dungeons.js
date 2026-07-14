const DUNGEONS = [
  { name: "Green Dragon Nest [Hardcore]", type: "Raid", level: 50, partySize: "5-8", emoji: "🐲", weeklyLimit: 1 },
  { name: "Desert Dragon Nest [Classic]", type: "Raid", level: 60, partySize: "5-8", emoji: "🏜️", weeklyLimit: 1 },
  { name: "Desert Dragon Nest [Hardcore]", type: "Raid", level: 60, partySize: "5-8", emoji: "🏜️", weeklyLimit: 1 },
];

const DUNGEON_MAP = Object.fromEntries(DUNGEONS.map((d) => [d.name, d]));

function getDungeonInfo(name) {
  return DUNGEON_MAP[name] || null;
}

function getChoices() {
  return DUNGEONS.map((d) => ({
    name: `${d.emoji} ${d.name} (Lv${d.level})`,
    value: d.name,
  }));
}

module.exports = { DUNGEONS, getDungeonInfo, getChoices };
