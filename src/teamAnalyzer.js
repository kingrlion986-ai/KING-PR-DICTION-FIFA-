const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "matches.json");

function loadMatches() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    const json = JSON.parse(data);

    return Array.isArray(json.matches) ? json.matches : [];
  } catch (error) {
    console.error("Erreur chargement des matchs :", error.message);
    return [];
  }
}

function analyzeTeam(teamName) {
  const matches = loadMatches();

  const teamMatches = matches.filter(
    match =>
      match.home === teamName ||
      match.away === teamName
  );

  if (teamMatches.length === 0) {
    return {
      team: teamName,
      matches: 0,
      goalsScored: 0,
      goalsConceded: 0,
      avgScored: 0,
      avgConceded: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      formPoints: 0
    };
  }

  let goalsScored = 0;
  let goalsConceded = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let formPoints = 0;

  teamMatches.forEach(match => {
    const isHome = match.home === teamName;

    const scored = isHome
      ? Number(match.homeGoals)
      : Number(match.awayGoals);

    const conceded = isHome
      ? Number(match.awayGoals)
      : Number(match.homeGoals);

    goalsScored += scored;
    goalsConceded += conceded;

    if (scored > conceded) {
      wins++;
      formPoints += 3;
    } else if (scored === conceded) {
      draws++;
      formPoints += 1;
    } else {
      losses++;
    }
  });

  const matchesPlayed = teamMatches.length;

  return {
    team: teamName,
    matches: matchesPlayed,

    goalsScored,
    goalsConceded,

    avgScored: goalsScored / matchesPlayed,
    avgConceded: goalsConceded / matchesPlayed,

    wins,
    draws,
    losses,

    winRate: wins / matchesPlayed,

    formPoints: formPoints / matchesPlayed
  };
}

module.exports = {
  loadMatches,
  analyzeTeam
};
