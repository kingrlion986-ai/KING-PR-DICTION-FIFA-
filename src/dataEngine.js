const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  __dirname,
  "..",
  "data",
  "matches.json"
);

/**
 * Charge le fichier historique.
 */
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { matches: [] };
    }

    const content = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    if (!content.trim()) {
      return { matches: [] };
    }

    const data = JSON.parse(content);

    if (!data || !Array.isArray(data.matches)) {
      return { matches: [] };
    }

    return data;
  } catch (error) {
    console.error(
      "Erreur chargement des données :",
      error.message
    );

    return {
      matches: []
    };
  }
}

/**
 * Sauvegarde les données.
 */
function saveData(data) {
  const directory = path.dirname(DATA_FILE);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

/**
 * Nettoyage du nom d'une équipe.
 */
function normalizeTeamName(team) {
  if (typeof team !== "string") return "";

  return team
    .trim()
    .replace(/[,\s]+$/, "")
    .replace(/\s+/g, " ");
}

/**
 * Vérifie qu'un score est valide.
 */
function isValidGoals(value) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 30
  );
}

/**
 * Vérifie qu'une date est valide.
 */
function isValidDate(date) {
  if (!date) return false;

  const parsed = new Date(date);

  return !Number.isNaN(
    parsed.getTime()
  );
}

/**
 * Validation complète d'un match.
 */
function validateMatch(match) {
  if (!match || typeof match !== "object") {
    return false;
  }

  const home = normalizeTeamName(match.home);
  const away = normalizeTeamName(match.away);

  if (!home || !away) {
    return false;
  }

  if (home === away) {
    return false;
  }

  if (!isValidGoals(match.homeGoals)) {
    return false;
  }

  if (!isValidGoals(match.awayGoals)) {
    return false;
  }

  if (match.date && !isValidDate(match.date)) {
    return false;
  }

  return true;
}

/**
 * Crée une clé unique pour un match.
 *
 * La même rencontre avec la même date/heure
 * ne sera pas enregistrée deux fois.
 */
function getMatchKey(match) {
  return [
    normalizeTeamName(match.home).toLowerCase(),
    normalizeTeamName(match.away).toLowerCase(),
    match.homeGoals,
    match.awayGoals,
    match.date || ""
  ].join("|");
}

/**
 * Ajoute un match historique.
 */
function addMatch(match) {
  if (!validateMatch(match)) {
    throw new Error(
      "Match invalide. Vérifiez les équipes, les scores et la date."
    );
  }

  const data = loadData();

  const normalizedMatch = {
    id:
      match.id ||
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    date:
      match.date ||
      new Date().toISOString(),

    home: normalizeTeamName(match.home),
    away: normalizeTeamName(match.away),

    homeGoals: Number(match.homeGoals),
    awayGoals: Number(match.awayGoals),

    competition:
      typeof match.competition === "string" &&
      match.competition.trim()
        ? match.competition.trim()
        : "FIFA Virtual",

    source:
      typeof match.source === "string" &&
      match.source.trim()
        ? match.source.trim()
        : "FIFA_VIRTUAL"
  };

  const newKey =
    getMatchKey(normalizedMatch);

  const exists = data.matches.some(
    existing =>
      getMatchKey(existing) === newKey
  );

  if (exists) {
    return {
      ...normalizedMatch,
      duplicate: true
    };
  }

  data.matches.push(normalizedMatch);

  saveData(data);

  return normalizedMatch;
}

/**
 * Ajoute plusieurs matchs.
 */
function addMatches(matches) {
  if (!Array.isArray(matches)) {
    throw new Error(
      "La liste des matchs doit être un tableau."
    );
  }

  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const match of matches) {
    try {
      const result = addMatch(match);

      if (result.duplicate) {
        duplicates++;
      } else {
        added++;
      }
    } catch (error) {
      invalid++;
    }
  }

  return {
    added,
    duplicates,
    invalid,
    total: matches.length
  };
}

/**
 * Retourne tous les matchs.
 */
function getMatches() {
  return loadData().matches;
}

/**
 * Retourne les matchs d'une équipe.
 */
function getTeamMatches(teamName) {
  const team = normalizeTeamName(teamName);

  if (!team) {
    return [];
  }

  return getMatches().filter(
    match =>
      match.home === team ||
      match.away === team
  );
}

/**
 * Retourne les confrontations directes.
 */
function getHeadToHead(
  homeTeam,
  awayTeam
) {
  const home = normalizeTeamName(homeTeam);
  const away = normalizeTeamName(awayTeam);

  return getMatches().filter(
    match =>
      (
        match.home === home &&
        match.away === away
      ) ||
      (
        match.home === away &&
        match.away === home
      )
  );
}

/**
 * Retourne les équipes connues.
 */
function getTeams() {
  const teams = new Set();

  getMatches().forEach(match => {
    if (match.home) {
      teams.add(match.home);
    }

    if (match.away) {
      teams.add(match.away);
    }
  });

  return [...teams].sort();
}

/**
 * Statistiques générales sur les données.
 */
function getDataStats() {
  const matches = getMatches();

  const teams = getTeams();

  return {
    totalMatches: matches.length,
    totalTeams: teams.length,

    firstMatch:
      matches.length > 0
        ? matches
            .map(match => new Date(match.date))
            .sort(
              (a, b) => a - b
            )[0]
        : null,

    lastMatch:
      matches.length > 0
        ? matches
            .map(match => new Date(match.date))
            .sort(
              (a, b) => b - a
            )[0]
        : null
  };
}

module.exports = {
  loadData,
  saveData,
  addMatch,
  addMatches,
  getMatches,
  getTeamMatches,
  getHeadToHead,
  getTeams,
  getDataStats,
  validateMatch,
  normalizeTeamName,
  getMatchKey
};
