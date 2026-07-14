const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "limits.json");

let clears = {};
try {
  clears = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
} catch {
  clears = {};
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(clears, null, 2));
}

function getWeekKey() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const hours = now.getHours();

  let daysToSubtract = (dayOfWeek + 1) % 7;
  if (dayOfWeek === 6 && hours < 8) {
    daysToSubtract = 7;
  }

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - daysToSubtract);
  weekStart.setHours(8, 0, 0, 0);

  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, "0");
  const d = String(weekStart.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getClears(ign, activity) {
  const week = getWeekKey();
  return clears[ign]?.[week]?.[activity] || 0;
}

function getRemaining(ign, activity, limit) {
  const used = getClears(ign, activity);
  return Math.max(0, limit - used);
}

function addClear(ign, activity) {
  const week = getWeekKey();
  if (!clears[ign]) clears[ign] = {};
  if (!clears[ign][week]) clears[ign][week] = {};
  clears[ign][week][activity] = (clears[ign][week][activity] || 0) + 1;
  save();
}

function getStatus(ign, activities) {
  const week = getWeekKey();
  const result = [];
  for (const { name, limit } of activities) {
    const used = clears[ign]?.[week]?.[name] || 0;
    result.push({ name, used, limit, remaining: Math.max(0, limit - used) });
  }
  return result;
}

module.exports = { getClears, getRemaining, addClear, getStatus };
