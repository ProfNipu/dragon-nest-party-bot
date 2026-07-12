// Persistent store of each user's registered characters, keyed by Discord
// user ID. Backed by a JSON file on disk (data/characters.json) so rosters
// survive a bot restart. For heavier usage, swap this for a real database
// (SQLite, etc.) — the add/remove/get functions below are the only things
// that would need to change.

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "characters.json");

const characters = new Map(); // userId -> [{ ign, className }, ...]

// Loads characters.json into memory at startup. If the file doesn't exist
// yet (first run) or is unreadable, starts with an empty roster instead of
// crashing.
function loadFromDisk() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const [userId, list] of Object.entries(parsed)) {
      characters.set(userId, list);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Couldn't read characters.json, starting with an empty roster:", err.message);
    }
  }
}

// Writes the full in-memory roster back out to disk. Called after every
// add/remove so the file is always current.
function saveToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const asObject = Object.fromEntries(characters);
    fs.writeFileSync(DATA_FILE, JSON.stringify(asObject, null, 2));
  } catch (err) {
    console.error("Couldn't save characters.json:", err.message);
  }
}

loadFromDisk();

// Adds a character to a user's roster. Returns a status string:
// "added" | "duplicate"
function addCharacter(userId, ign, className) {
  const list = characters.get(userId) || [];

  const isDuplicate = list.some((c) => c.ign.toLowerCase() === ign.toLowerCase());
  if (isDuplicate) return "duplicate";

  list.push({ ign, className });
  characters.set(userId, list);
  saveToDisk();
  return "added";
}

// Removes a character by IGN (case-insensitive). Returns true if removed.
function removeCharacter(userId, ign) {
  const list = characters.get(userId);
  if (!list) return false;

  const idx = list.findIndex((c) => c.ign.toLowerCase() === ign.toLowerCase());
  if (idx === -1) return false;

  list.splice(idx, 1);
  saveToDisk();
  return true;
}

function getCharacters(userId) {
  return characters.get(userId) || [];
}

module.exports = { addCharacter, removeCharacter, getCharacters };