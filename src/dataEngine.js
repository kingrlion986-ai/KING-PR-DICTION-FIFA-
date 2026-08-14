const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  __dirname,
  "..",
  "data",
  "matches.json"
);

function loadData() {
  try {
    const content = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const data = JSON.parse(content);

    if (!Array.isArray(data.matches)) {
      data.matches = [];
    }

    return data;

  } catch (error) {
    return {
      matches: []
    };
  }
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function validateMatch(match) {
  if (!match) return false;

  if (!match.home || !match.away) {
    return false;
  }

  if (
    typeof match.homeGoals !== "number" ||
    typeof match.awayGoals !== "number"
  ) {
    return false;
  }

  if (
    match.homeGoals < 0 ||
    match.awayGoals < 0
  ) {
    return false;
  }

  return true;
}

function addMatch(match) {
  if (!validateMatch(match)) {
    throw new Error(
      "Match invalide."
    );
  }

  const data = loadData();

  const newMatch = {
    id: Date.now().toString(),

    date:
      match.date ||
      new Date().toISOString(),

    home: match.home.trim(),
    away: match.away.trim(),

    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals
  };

  data.matches.push(newMatch);

  saveData(data);

  return newMatch;
}

function getMatches() {
  return loadData().matches;
}

function getTeams() {
  const matches = getMatches();

  const teams = new Set();

  matches.forEach(match => {
    teams.add(match.home);
    teams.add(match.away);
  });

  return [...teams].sort();
}

module.exports = {
  loadData,
  saveData,
  addMatch,
  getMatches,
  getTeams,
  validateMatch
};
