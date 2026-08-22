const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

function avg(v) {
  return v.length
    ? v.reduce((a, b) => a + b, 0) / v.length
    : 0;
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
   ÉQUIPE
========================= */

function analyzeTeam(team) {
  const all = getTeamMatches(team) || [];
  const recent = recentMatches(all);

  let scored = [], conceded = [];
  let homeScored = [], homeConceded = [];
  let awayScored = [], awayConceded = [];
  let wins = 0, formPoints = [];

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
    winRate: recent.length ? wins / recent.length : 0,
    form: recent.length ? avg(formPoints) / 3 : 0,
    recentMatches: recent.length
  };
}

/* =========================
   H2H
========================= */

function analyzeH2H(home, away) {
  const matches = getHeadToHead(home, away) || [];
  const recent = recentMatches(matches);

  let hg = [], ag = [];
  let hw = 0, d = 0, aw = 0;

  for (const m of recent) {
    const original =
      m.home.toLowerCase() === home.toLowerCase();

    const h = Number(m.homeGoals);
    const a = Number(m.awayGoals);

    const homeGoals = original ? h : a;
    const awayGoals = original ? a : h;

    hg.push(homeGoals);
    ag.push(awayGoals);

    if (homeGoals > awayGoals) hw++;
    else if (homeGoals === awayGoals) d++;
    else aw++;
  }

  const total = recent.length || 1;

  return {
    matches: recent.length,
    homeAvgScored: avg(hg),
    homeAvgConceded: avg(ag),
    awayAvgScored: avg(ag),
    awayAvgConceded: avg(hg),
    homeWinRate: hw / total * 100,
    drawRate: d / total * 100,
    awayWinRate: aw / total * 100
  };
}

/* =========================
   XG
========================= */

function calculateExpectedGoals(home, away, h2h) {
  let homeXG =
    (home.homeAvgScored || home.avgScored) * 0.45 +
    (away.awayAvgConceded || away.avgConceded) * 0.35 +
    away.avgConceded * 0.20;

  let awayXG =
    (away.awayAvgScored || away.avgScored) * 0.45 +
    (home.homeAvgConceded || home.avgConceded) * 0.35 +
    home.avgConceded * 0.20;

  if (h2h.matches) {
    homeXG = homeXG * 0.85 + h2h.homeAvgScored * 0.15;
    awayXG = awayXG * 0.85 + h2h.awayAvgScored * 0.15;
  }

  return {
    home: Number(clamp(homeXG, 0.15, 4.5).toFixed(3)),
    away: Number(clamp(awayXG, 0.15, 4.5).toFixed(3))
  };
}

/* =========================
   POISSON
========================= */

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(lambda, k) {
  return Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k);
}

function buildScores(homeXG, awayXG) {
  const scores = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      scores.push({
        homeGoals: h,
        awayGoals: a,
        probability:
          poisson(homeXG, h) *
          poisson(awayXG, a)
      });
    }
  }

  const total =
    scores.reduce((s, x) => s + x.probability, 0);

  return scores.map(x => ({
    ...x,
    probability: x.probability / total
  }));
}

/* =========================
   PREDICTION
========================= */

function predictMatch(home, away) {
  const homeStats = analyzeTeam(home);
  const awayStats = analyzeTeam(away);
  const h2h = analyzeH2H(home, away);

  const expectedGoals =
    calculateExpectedGoals(
      homeStats,
      awayStats,
      h2h
    );

  const matrix =
    buildScores(
      expectedGoals.home,
      expectedGoals.away
    );

  let markets = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0
  };

  for (const x of matrix) {
    const h = x.homeGoals;
    const a = x.awayGoals;
    const p = x.probability;

    if (h > a) markets.homeWin += p;
    else if (h === a) markets.draw += p;
    else markets.awayWin += p;

    if (h + a > 2) markets.over25 += p;
    else markets.under25 += p;

    if (h > 0 && a > 0) markets.bttsYes += p;
    else markets.bttsNo += p;
  }

  const winner =
    markets.homeWin >= markets.awayWin &&
    markets.homeWin >= markets.draw
      ? home
      : markets.awayWin >= markets.draw
        ? away
        : "Nul";

  const totalMatches =
    homeStats.matches + awayStats.matches;

  const dataQuality =
    clamp(Math.round(totalMatches / 40 * 100), 0, 100);

  const sorted = [
  markets.homeWin,
  markets.draw,
  markets.awayWin
].sort((a, b) => b - a);

const separation =
  (sorted[0] - sorted[1]) * 100;

const confidence = clamp(
  Math.round(
    40 +
    separation * 0.45 +
    dataQuality * 0.08
  ),
  40,
  80
);

  const topScores = [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)
    .map(x => ({
      score: `${x.homeGoals}-${x.awayGoals}`,
      probability: x.probability * 100
    }));

  return {
    match: { home, away },

    teams: {
      home: homeStats,
      away: awayStats
    },

    h2h,
    expectedGoals,

    predictions: {
  winner,
  confidence,
      homeWin: +(markets.homeWin * 100).toFixed(1),
      draw: +(markets.draw * 100).toFixed(1),
      awayWin: +(markets.awayWin * 100).toFixed(1),
      over25: +(markets.over25 * 100).toFixed(1),
      under25: +(markets.under25 * 100).toFixed(1),
      bttsYes: +(markets.bttsYes * 100).toFixed(1),
      bttsNo: +(markets.bttsNo * 100).toFixed(1),
      dataQuality
    },

    topScores
  };
}

module.exports = {
  predictMatch,
  analyzeTeam,
  analyzeH2H
};
