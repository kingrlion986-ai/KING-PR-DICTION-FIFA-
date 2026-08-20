const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

function clean(name) {
  return String(name || "")
    .trim()
    .replace(/[,\s]+$/, "")
    .replace(/\s+/g, " ");
}

/*
 * Poids selon l'ancienneté du match.
 */
function getRecentWeight(index, total) {
  const age = total - 1 - index;

  if (age === 0) return 1.00;
  if (age === 1) return 0.85;
  if (age === 2) return 0.70;
  if (age === 3) return 0.55;
  if (age === 4) return 0.40;

  return 0.25;
}

function weightedAverage(values) {
  if (!values.length) return 0;

  let total = 0;
  let weightTotal = 0;

  for (const item of values) {
    total += item.value * item.weight;
    weightTotal += item.weight;
  }

  return weightTotal
    ? total / weightTotal
    : 0;
}

/*
 * Analyse les confrontations directes.
 */
function analyzeH2H(homeTeam, awayTeam) {
  const home = clean(homeTeam);
  const away = clean(awayTeam);

  const matches = getHeadToHead(
    home,
    away
  ).sort(
    (a, b) =>
      new Date(a.date) - new Date(b.date)
  );

  if (!matches.length) {
    return {
      matches: 0,
      homeAvgScored: 0,
      homeAvgConceded: 0,
      awayAvgScored: 0,
      awayAvgConceded: 0,
      homeWinRate: 0,
      drawRate: 0,
      awayWinRate: 0
    };
  }

  let homeScored = [];
  let homeConceded = [];
  let awayScored = [];
  let awayConceded = [];

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];

    const isHome =
      clean(m.home) === home;

    const homeGoals = Number(
      isHome
        ? m.homeGoals
        : m.awayGoals
    );

    const awayGoals = Number(
      isHome
        ? m.awayGoals
        : m.homeGoals
    );

    /*
     * Les confrontations récentes ont
     * également plus de poids.
     */
    const weight =
      getRecentWeight(
        i,
        matches.length
      );

    homeScored.push({
      value: homeGoals,
      weight
    });

    homeConceded.push({
      value: awayGoals,
      weight
    });

    awayScored.push({
      value: awayGoals,
      weight
    });

    awayConceded.push({
      value: homeGoals,
      weight
    });

    if (homeGoals > awayGoals) {
      homeWins += weight;
    } else if (
      homeGoals === awayGoals
    ) {
      draws += weight;
    } else {
      awayWins += weight;
    }
  }

  const totalWeight =
    homeWins +
    draws +
    awayWins;

  return {
    matches: matches.length,

    homeAvgScored:
      weightedAverage(homeScored),

    homeAvgConceded:
      weightedAverage(homeConceded),

    awayAvgScored:
      weightedAverage(awayScored),

    awayAvgConceded:
      weightedAverage(awayConceded),

    homeWinRate:
      totalWeight
        ? homeWins / totalWeight
        : 0,

    drawRate:
      totalWeight
        ? draws / totalWeight
        : 0,

    awayWinRate:
      totalWeight
        ? awayWins / totalWeight
        : 0
  };
}

function analyzeTeam(team) {
  team = clean(team);

  const matches = getTeamMatches(team)
    .filter(
      m =>
        clean(m.home) === team ||
        clean(m.away) === team
    )
    .sort(
      (a, b) =>
        new Date(a.date) - new Date(b.date)
    );

  if (!matches.length) {
    return {
      team,
      matches: 0,
      avgScored: 0,
      avgConceded: 0,
      homeAvgScored: 0,
      homeAvgConceded: 0,
      awayAvgScored: 0,
      awayAvgConceded: 0,
      winRate: 0,
      form: 0
    };
  }

  const scored = [];
  const conceded = [];
  const homeScored = [];
  const homeConceded = [];
  const awayScored = [];
  const awayConceded = [];

  let wins = 0;
  let weightedWins = 0;
  let totalWeight = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];

    const isHome =
      clean(m.home) === team;

    const s = Number(
      isHome
        ? m.homeGoals
        : m.awayGoals
    );

    const c = Number(
      isHome
        ? m.awayGoals
        : m.homeGoals
    );

    const weight =
      getRecentWeight(
        i,
        matches.length
      );

    scored.push({
      value: s,
      weight
    });

    conceded.push({
      value: c,
      weight
    });

    if (isHome) {
      homeScored.push({
        value: s,
        weight
      });

      homeConceded.push({
        value: c,
        weight
      });
    } else {
      awayScored.push({
        value: s,
        weight
      });

      awayConceded.push({
        value: c,
        weight
      });
    }

    if (s > c) {
      wins++;
      weightedWins += weight;
    }

    totalWeight += weight;
  }

  /*
   * Forme récente pondérée.
   */
  const recent =
    matches.slice(-5);

  let formPoints = 0;
  let formWeight = 0;

  for (
    let i = 0;
    i < recent.length;
    i++
  ) {
    const m = recent[i];

    const isHome =
      clean(m.home) === team;

    const s = Number(
      isHome
        ? m.homeGoals
        : m.awayGoals
    );

    const c = Number(
      isHome
        ? m.awayGoals
        : m.homeGoals
    );

    const originalIndex =
      matches.length -
      recent.length +
      i;

    const weight =
      getRecentWeight(
        originalIndex,
        matches.length
      );

    const points =
      s > c
        ? 3
        : s === c
        ? 1
        : 0;

    formPoints +=
      points * weight;

    formWeight += weight;
  }

  return {
    team,
    matches: matches.length,

    avgScored:
      weightedAverage(scored),

    avgConceded:
      weightedAverage(conceded),

    homeAvgScored:
      weightedAverage(homeScored),

    homeAvgConceded:
      weightedAverage(homeConceded),

    awayAvgScored:
      weightedAverage(awayScored),

    awayAvgConceded:
      weightedAverage(awayConceded),

    winRate:
      totalWeight
        ? weightedWins / totalWeight
        : wins / matches.length,

    form:
      formWeight
        ? formPoints / formWeight
        : 0
  };
}

module.exports = {
  analyzeTeam,
  analyzeH2H
};
