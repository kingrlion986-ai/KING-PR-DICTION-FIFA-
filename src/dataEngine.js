const fs = require("fs");
const path = require("path");

/* =========================
   FICHIER DES DONNÉES
========================= */

const DATA_FILE = path.join(
  __dirname,
  "..",
  "data",
  "matches.json"
);

/* =========================
   NORMALISATION
========================= */

function normalizeTeamName(team) {
  return String(team || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/* =========================
   CHARGEMENT
========================= */

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {
        matches: []
      };
    }

    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const data = JSON.parse(raw);

    if (
      !data ||
      !Array.isArray(data.matches)
    ) {
      return {
        matches: []
      };
    }

    return data;

  } catch (error) {

    console.error(
      "Erreur lecture matches.json :",
      error.message
    );

    return {
      matches: []
    };
  }
}

/* =========================
   SAUVEGARDE
========================= */

function saveData(data) {

  const dir =
    path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}

/* =========================
   VALIDATION
========================= */

function isValidGoals(value) {

  const goals =
    Number(value);

  return (
    Number.isInteger(goals) &&
    goals >= 0 &&
    goals <= 30
  );
}

function isValidDate(value) {

  if (!value) {
    return false;
  }

  const date =
    new Date(value);

  return !isNaN(
    date.getTime()
  );
}

/* =========================
   VALIDATION MATCH
========================= */

function validateMatch(match) {

  if (!match) {
    return false;
  }

  if (
    typeof match.home !== "string" ||
    !match.home.trim()
  ) {
    return false;
  }

  if (
    typeof match.away !== "string" ||
    !match.away.trim()
  ) {
    return false;
  }

  if (
    !isValidGoals(
      match.homeGoals
    )
  ) {
    return false;
  }

  if (
    !isValidGoals(
      match.awayGoals
    )
  ) {
    return false;
  }

  if (
    !isValidDate(match.date)
  ) {
    return false;
  }

  return true;
}

/* =========================
   CLÉ UNIQUE MATCH
========================= */

function getMatchKey(match) {

  return [
    normalizeTeamName(match.home),
    normalizeTeamName(match.away),
    Number(match.homeGoals),
    Number(match.awayGoals),
    new Date(match.date)
      .toISOString()
  ].join("|");
}

/* =========================
   AJOUTER UN MATCH
========================= */

function addMatch(match) {

  if (!validateMatch(match)) {
    throw new Error(
      "Match invalide."
    );
  }

  const data =
    loadData();

  const normalizedMatch = {

    date:
      new Date(match.date)
        .toISOString(),

    home:
      match.home
        .trim()
        .replace(/\s+/g, " "),

    away:
      match.away
        .trim()
        .replace(/\s+/g, " "),

    homeGoals:
      Number(match.homeGoals),

    awayGoals:
      Number(match.awayGoals),

    competition:
      match.competition ||
      "FIFA FC 26. England Championship",

    source:
      match.source ||
      "FIFA_VIRTUAL"
  };

  const newKey =
    getMatchKey(
      normalizedMatch
    );

  const duplicate =
    data.matches.some(
      existing =>
        getMatchKey(existing) ===
        newKey
    );

  if (duplicate) {
    return {
      added: false,
      duplicate: true,
      match: normalizedMatch
    };
  }

  data.matches.push(
    normalizedMatch
  );

  saveData(data);

  return {
    added: true,
    duplicate: false,
    match: normalizedMatch
  };
}

/* =========================
   AJOUTER PLUSIEURS MATCHS
========================= */

function addMatches(matches) {

  if (!Array.isArray(matches)) {
    throw new Error(
      "La liste des matchs est invalide."
    );
  }

  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const match of matches) {

    try {

      const result =
        addMatch(match);

      if (result.duplicate) {
        duplicates++;
      } else {
        added++;
      }

    } catch (error) {

      invalid++;

      console.error(
        "Match ignoré :",
        error.message
      );
    }
  }

  return {
    added,
    duplicates,
    invalid,
    total: matches.length
  };
}

/* =========================
   TOUS LES MATCHS
========================= */

function getMatches() {

  const data =
    loadData();

  return data.matches;
}

/* =========================
   MATCHS D'UNE ÉQUIPE
========================= */

/*
 * IMPORTANT :
 *
 * La recherche est maintenant
 * insensible aux majuscules,
 * minuscules et espaces.
 *
 * Exemple :
 *
 * Wolverhampton wanderers
 * Wolverhampton Wanderers
 * WOLVERHAMPTON WANDERERS
 *
 * = même équipe
 */

function getTeamMatches(teamName) {

  const data =
    loadData();

  const target =
    normalizeTeamName(
      teamName
    );

  if (!target) {
    return [];
  }

  return data.matches.filter(
    match => {

      const home =
        normalizeTeamName(
          match.home
        );

      const away =
        normalizeTeamName(
          match.away
        );

      return (
        home === target ||
        away === target
      );
    }
  );
}

/* =========================
   HEAD TO HEAD
========================= */

function getHeadToHead(
  homeTeam,
  awayTeam
) {

  const data =
    loadData();

  const home =
    normalizeTeamName(
      homeTeam
    );

  const away =
    normalizeTeamName(
      awayTeam
    );

  if (!home || !away) {
    return [];
  }

  return data.matches.filter(
    match => {

      const matchHome =
        normalizeTeamName(
          match.home
        );

      const matchAway =
        normalizeTeamName(
          match.away
        );

      /*
       * On accepte les deux ordres :
       *
       * Chelsea vs Arsenal
       *
       * Arsenal vs Chelsea
       */

      return (
        (
          matchHome === home &&
          matchAway === away
        ) ||
        (
          matchHome === away &&
          matchAway === home
        )
      );
    }
  );
}

/* =========================
   LISTE DES ÉQUIPES
========================= */

function getTeams() {

  const data =
    loadData();

  const teams = new Map();

  for (const match of data.matches) {

    if (match.home) {

      const key =
        normalizeTeamName(
          match.home
        );

      if (!teams.has(key)) {
        teams.set(
          key,
          match.home
            .trim()
            .replace(/\s+/g, " ")
        );
      }
    }

    if (match.away) {

      const key =
        normalizeTeamName(
          match.away
        );

      if (!teams.has(key)) {
        teams.set(
          key,
          match.away
            .trim()
            .replace(/\s+/g, " ")
        );
      }
    }
  }

  return Array.from(
    teams.values()
  ).sort(
    (a, b) =>
      a.localeCompare(
        b,
        "fr"
      )
  );
}

/* =========================
   STATISTIQUES DONNÉES
========================= */

function getDataStats() {

  const data =
    loadData();

  const matches =
    data.matches || [];

  const teams =
    getTeams();

  const competitions =
    [
      ...new Set(
        matches
          .map(
            match =>
              match.competition
          )
          .filter(Boolean)
      )
    ];

  const sources =
    [
      ...new Set(
        matches
          .map(
            match =>
              match.source
          )
          .filter(Boolean)
      )
    ];

  return {

    totalMatches:
      matches.length,

    totalTeams:
      teams.length,

    totalCompetitions:
      competitions.length,

    competitions,

    sources,

    firstMatch:
      matches.length
        ? matches
            .map(m =>
              new Date(m.date)
            )
            .sort(
              (a, b) =>
                a - b
            )[0]
            .toISOString()
        : null,

    lastMatch:
      matches.length
        ? matches
            .map(m =>
              new Date(m.date)
            )
            .sort(
              (a, b) =>
                b - a
            )[0]
            .toISOString()
        : null
  };
}

/* =========================
   EXPORT
========================= */

module.exports = {

  loadData,
  saveData,

  normalizeTeamName,

  isValidGoals,
  isValidDate,
  validateMatch,

  getMatchKey,

  addMatch,
  addMatches,

  getMatches,
  getTeamMatches,
  getHeadToHead,

  getTeams,
  getDataStats
};
