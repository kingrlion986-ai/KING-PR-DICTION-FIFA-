const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

/* =========================
   OUTILS
========================= */

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function recentMatches(matches, limit = 10) {
  return [...matches]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

/* =========================
   ANALYSE ÉQUIPE
========================= */

function analyzeTeam(team) {

  const all = getTeamMatches(team) || [];
  const recent = recentMatches(all, 10);

  let scored = [];
  let conceded = [];

  let homeScored = [];
  let homeConceded = [];

  let awayScored = [];
  let awayConceded = [];

  let wins = 0;
  let formPoints = [];

  for (const m of recent) {

    const isHome =
      m.home.toLowerCase() === team.toLowerCase();

    const gf = isHome
      ? Number(m.homeGoals)
      : Number(m.awayGoals);

    const ga = isHome
      ? Number(m.awayGoals)
      : Number(m.homeGoals);

    scored.push(gf);
    conceded.push(ga);

    if (isHome) {
      homeScored.push(gf);
      homeConceded.push(ga);
    } else {
      awayScored.push(gf);
      awayConceded.push(ga);
    }

    if (gf > ga) {
      wins++;
      formPoints.push(3);
    } else if (gf === ga) {
      formPoints.push(1);
    } else {
      formPoints.push(0);
    }
  }

  return {
    team,
    matches: all.length,

    avgScored: avg(scored),
    avgConceded: avg(conceded),

    homeAvgScored: avg(homeScored),
    homeAvgConceded: avg(homeConceded),

    awayAvgScored: avg(awayScored),
    awayAvgConceded: avg(awayConceded),

    winRate: recent.length
      ? wins / recent.length
      : 0,

    form: recent.length
      ? avg(formPoints) / 3
      : 0,

    recentMatches: recent.length
  };
}

/* =========================
   H2H
========================= */

function analyzeH2H(home, away) {

  const matches =
    getHeadToHead(home, away) || [];

  const recent =
    recentMatches(matches, 10);

  let homeGoals = [];
  let awayGoals = [];

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (const m of recent) {

    const isOriginal =
      m.home.toLowerCase() === home.toLowerCase();

    const hg = Number(m.homeGoals);
    const ag = Number(m.awayGoals);

    if (isOriginal) {
      homeGoals.push(hg);
      awayGoals.push(ag);

      if (hg > ag) homeWins++;
      else if (hg === ag) draws++;
      else awayWins++;

    } else {
      homeGoals.push(ag);
      awayGoals.push(hg);

      if (ag > hg) homeWins++;
      else if (ag === hg) draws++;
      else awayWins++;
    }
  }

  const total = recent.length || 1;

  return {
    matches: recent.length,

    homeAvgScored:
      Number(avg(homeGoals).toFixed(3)),

    homeAvgConceded:
      Number(avg(awayGoals).toFixed(3)),

    awayAvgScored:
      Number(avg(awayGoals).toFixed(3)),

    awayAvgConceded:
      Number(avg(homeGoals).toFixed(3)),

    homeWinRate:
      Number((homeWins / total * 100).toFixed(1)),

    drawRate:
      Number((draws / total * 100).toFixed(1)),

    awayWinRate:
      Number((awayWins / total * 100).toFixed(1))
  };
}

/* =========================
   BUTS ATTENDUS
========================= */

function calculateExpectedGoals(homeStats, awayStats, h2h) {

  const homeRecent =
    homeStats.homeAvgScored ||
    homeStats.avgScored ||
    0;

  const homeDefense =
    homeStats.homeAvgConceded ||
    homeStats.avgConceded ||
    0;

  const awayRecent =
    awayStats.awayAvgScored ||
    awayStats.avgScored ||
    0;

  const awayDefense =
    awayStats.awayAvgConceded ||
    awayStats.avgConceded ||
    0;

  let homeXG =
    homeRecent * 0.45 +
    awayDefense * 0.35 +
    awayStats.avgConceded * 0.20;

  let awayXG =
    awayRecent * 0.45 +
    homeDefense * 0.35 +
    homeStats.avgConceded * 0.20;

  if (h2h.matches > 0) {

    homeXG =
      homeXG * 0.85 +
      h2h.homeAvgScored * 0.15;

    awayXG =
      awayXG * 0.85 +
      h2h.awayAvgScored * 0.15;
  }

  return {
    home: Number(
      clamp(homeXG, 0.15, 4.5).toFixed(3)
    ),

    away: Number(
      clamp(awayXG, 0.15, 4.5).toFixed(3)
    )
  };
}

/* =========================
   POISSON
========================= */

function factorial(n) {
  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

function poisson(lambda, k) {
  return (
    Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k)
  );
}

/* =========================
   SCORES
========================= */

function calculateScores(homeXG, awayXG) {

  const scores = [];

  for (let h = 0; h <= 6; h++) {

    for (let a = 0; a <= 6; a++) {

      const probability =
        poisson(homeXG, h) *
        poisson(awayXG, a);

      scores.push({
        score: `${h}-${a}`,
        probability
      });
    }
  }

  return scores.sort(
    (a, b) => b.probability - a.probability
  );
}

/* =========================
   ISSUE ANALYSE
========================= */

function predictMatch(home, away) {

  const homeStats =
    analyzeTeam(home);

  const awayStats =
    analyzeTeam(away);

  const h2h =
    analyzeH2H(home, away);

  const expectedGoals =
    calculateExpectedGoals(
      homeStats,
      awayStats,
      h2h
    );

  const scores =
    calculateScores(
      expectedGoals.home,
      expectedGoals.away
    );

  /*
   * Probabilités statistiques.
   * Elles servent uniquement à résumer
   * les données historiques.
   */

  let homeWin = 0;
let draw = 0;
let awayWin = 0;

for (const s of scores) {
  const [h, a] = s.score.split("-").map(Number);

  if (h > a) homeWin += s.probability;
  else if (h === a) draw += s.probability;
  else awayWin += s.probability;
}

const total = homeWin + draw + awayWin;

homeWin = homeWin / total * 100;
draw = draw / total * 100;
awayWin = awayWin / total * 100;
  
  let result;

  if (
    homeWin >= awayWin &&
    homeWin >= draw
  ) {
    result = home;
  } else if (awayWin >= draw) {
    result = away;
  } else {
    result = "Nul";
  }

  /*
   * Qualité basée sur le nombre réel
   * de données disponibles.
   */

  const totalMatches =
    homeStats.matches +
    awayStats.matches;

  const dataQuality =
    clamp(
      Math.round(
        totalMatches / 40 * 100
      ),
      0,
      100
    );

  return {

    match: {
      home,
      away
    },

    teams: {
      home: homeStats,
      away: awayStats
    },

    h2h,

    expectedGoals,

    analysis: {
      result,
      homeWin: Number(homeWin.toFixed(1)),
      draw: Number(draw.toFixed(1)),
      awayWin: Number(awayWin.toFixed(1)),
      dataQuality
    },

    topScores:
      scores.slice(0, 3).map(x => ({
        score: x.score,
        probability:
          Number(
            (x.probability * 100).toFixed(1)
          )
      }))
  };
}

module.exports = {
  predictMatch,
  analyzeTeam,
  analyzeH2H
};
