// Subclass options per role. An empty array means "no subclass picker —
// clicking the role button joins immediately", which is the current
// behavior for Healer/DPS/Support. Add entries here as you define more
// classes for other roles later.

const ROLE_SUBCLASSES = {
  tank: ["Guardian", "Destroyer", "Crusader"],
  healer: ["Saint", "Physician", "Inquisitor"],
  swordmaster: ["Moonlord", "Gladiator", "Dark Avenger"],
  mercenary: ["Destroyer", "Barbarian"],
  sorceress: ["Elestra", "Saleana", "Majesty", "Smasher"],
  acrobat: ["Tempest", "Wind Walker"],
  flexible: ["Moonlord", "Gladiator", "Destroyer", "Barbarian", "Dark Avenger", "Guardian", "Crusader", "Saint", "Inquisitor", "Elestra", "Saleana", "Majesty", "Smasher", "Wind Walker", "Tempest", "Artillery", "Sniper", "Adept", "Physician", "Shooting Star", "Gear Master", "Spirit Dancer", "Blade Dancer", "Dark Summoner", "Soul Eater"],
};

function getSubclasses(roleKey) {
  return ROLE_SUBCLASSES[roleKey] || [];
}

function hasSubclasses(roleKey) {
  return getSubclasses(roleKey).length > 0;
}

// The "flexible" role's list doubles as the master list of every class in
// the game (it's used for "any DPS" signups), so character registration
// reuses it instead of maintaining a separate list.
function getAllClassNames() {
  return ROLE_SUBCLASSES.flexible;
}

function isClassValidForRole(className, roleKey) {
  const subclasses = ROLE_SUBCLASSES[roleKey];
  return subclasses ? subclasses.includes(className) : false;
}

function getRoleKeysForClass(className) {
  const roles = [];
  for (const [roleKey, subclasses] of Object.entries(ROLE_SUBCLASSES)) {
    if (subclasses.includes(className)) {
      roles.push(roleKey);
    }
  }
  return roles;
}

module.exports = { ROLE_SUBCLASSES, getSubclasses, hasSubclasses, getAllClassNames, isClassValidForRole, getRoleKeysForClass };