const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

/* =========================
   OUTILS
========================= */

const avg = a =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

const clamp = (n, min, max) =>
  Math.max(min, Math.min(max, n));

function recent(matches, limit = 20) {
  return [...matches]
    .filter(m => m && m.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

function wavg(values) {
  let sum = 0;
  let weights = 0;

  values.forEach((v, i) => {
    const w = Math.max(0.35, 1 - i * 0.06);
    sum += v * w;
    weights += w;
  });

  return weights ? sum / weights : 0;
}

/* =========================
   ÉQUIPE
========================= */

function analyzeTeam(team) {
  const all = getTeamMatches(team) || [];
  const ms = recent(all);

  const scored = [], conceded = [];
  const hs = [], hc = [], as = [], ac = [];

  let points = 0;
  let wins = 0;

  ms.forEach(m => {
    const home =
      String(m.home).toLowerCase() === String(team).toLowerCase();

    const gf = Number(home ? m.homeGoals : m.awayGoals);
    const ga = Number(home ? m.awayGoals : m.homeGoals);

    scored.push(gf);
    conceded.push(ga);

    if (home) {
      hs.push(gf);
      hc.push(ga);
    } else {
      as.push(gf);
      ac.push(ga);
    }

    if (gf > ga) {
      wins++;
      points += 3;
    } else if (gf === ga) {
      points++;
    }
  });

  return {
    team,
    matches: all.length,
    recentMatches: ms.length,
    avgScored: wavg(scored),
    avgConceded: wavg(conceded),
    homeAvgScored: wavg(hs),
    homeAvgConceded: wavg(hc),
    awayAvgScored: wavg(as),
    awayAvgConceded: wavg(ac),
    winRate: ms.length ? wins / ms.length : 0,
    form: ms.length ? points / (ms.length * 3) : 0
  };
}

/* =========================
   H2H
========================= */

function analyzeH2H(home, away) {
  const ms = recent(
    getHeadToHead(home, away) || [],
    10
  );

  let hg = [], ag = [];
  let hw = 0, dr = 0, aw = 0;

  ms.forEach(m => {
    const original =
      String(m.home).toLowerCase() === String(home).toLowerCase();

    const h = Number(m.homeGoals);
    const a = Number(m.awayGoals);

    const homeGoals = original ? h : a;
    const awayGoals = original ? a : h;

    hg.push(homeGoals);
    ag.push(awayGoals);

    if (homeGoals > awayGoals) hw++;
    else if (homeGoals === awayGoals) dr++;
    else aw++;
  });

  const n = ms.length;

  return {
    matches: n,
    homeAvgScored: avg(hg),
    awayAvgScored: avg(ag),
    homeWinRate: n ? hw / n * 100 : 0,
    drawRate: n ? dr / n * 100 : 0,
    awayWinRate: n ? aw / n * 100 : 0
  };
}

/* =========================
   BUTS ATTENDUS
========================= */

function expectedGoals(home, away, h2h) {
  const homeAttack =
    home.homeAvgScored || home.avgScored || 1.25;

  const homeDefense =
    home.homeAvgConceded || home.avgConceded || 1.25;

  const awayAttack =
    away.awayAvgScored || away.avgScored || 1.25;

  const awayDefense =
    away.awayAvgConceded || away.avgConceded || 1.25;

  let hxg =
    homeAttack * 0.55 +
    awayDefense * 0.45;

  let axg =
    awayAttack * 0.55 +
    homeDefense * 0.45;

  /* H2H faible influence */
  if (h2h.matches >= 2) {
    hxg = hxg * 0.90 + h2h.homeAvgScored * 0.10;
    axg = axg * 0.90 + h2h.awayAvgScored * 0.10;
  }

  return {
    home: +clamp(hxg, 0.20, 4).toFixed(2),
    away: +clamp(axg, 0.20, 4).toFixed(2)
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
  return (
    Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k)
  );
}

/* =========================
   MATRICE + PETITS SCORES
========================= */

function correction(h, a, hxg, axg) {
  const rho = -0.10;

  if (h === 0 && a === 0) return 1 - hxg * axg * rho;
  if (h === 1 && a === 0) return 1 + axg * rho;
  if (h === 0 && a === 1) return 1 + hxg * rho;
  if (h === 1 && a === 1) return 1 - rho;

  return 1;
}

function buildMatrix(hxg, axg) {
  const matrix = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      matrix.push({
        homeGoals: h,
        awayGoals: a,
        probability:
          poisson(hxg, h) *
          poisson(axg, a) *
          correction(h, a, hxg, axg)
      });
    }
  }

  const total = matrix.reduce(
    (s, x) => s + x.probability,
    0
  );

  return matrix.map(x => ({
    ...x,
    probability: Math.max(0, x.probability / total)
  }));
}

/* =========================
   MARCHÉS
========================= */

function calculateMarkets(matrix) {
  const r = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0
  };

  matrix.forEach(x => {
    const { homeGoals: h, awayGoals: a, probability: p } = x;

    if (h > a) r.homeWin += p;
    else if (h === a) r.draw += p;
    else r.awayWin += p;

    if (h + a > 2) r.over25 += p;
    else r.under25 += p;

    if (h > 0 && a > 0) r.bttsYes += p;
    else r.bttsNo += p;
  });

  return r;
}

/* =========================
   CONFIANCE
========================= */

function calculateConfidence(home, away, markets) {
  const probabilities = [
    markets.homeWin,
    markets.draw,
    markets.awayWin
  ].sort((a, b) => b - a);

  const gap = probabilities[0] - probabilities[1];

  const data =
    Math.min(home.recentMatches, 20) +
    Math.min(away.recentMatches, 20);

  let base =
    gap < 0.05 ? 30 :
    gap < 0.10 ? 35 :
    gap < 0.15 ? 42 :
    gap < 0.25 ? 52 :
    62;

  return Math.round(
    clamp(base + data * 0.20, 25, 75)
  );
}

/* =========================
   PREDICTION
========================= */

function predictMatch(homeName, awayName) {
  const home = analyzeTeam(homeName);
  const away = analyzeTeam(awayName);

  const h2h = analyzeH2H(
    homeName,
    awayName
  );

  const xg = expectedGoals(
    home,
    away,
    h2h
  );

  const matrix = buildMatrix(
    xg.home,
    xg.away
  );

  const markets = calculateMarkets(matrix);

  const scores = [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const probs = [
    ["home", markets.homeWin],
    ["draw", markets.draw],
    ["away", markets.awayWin]
  ].sort((a, b) => b[1] - a[1]);

  const gap = probs[0][1] - probs[1][1];

  let winner;
  let message;

  if (gap < 0.05) {
    winner = "Match très serré";
    message = "Aucune équipe ne se détache";
  } else if (probs[0][0] === "home") {
    winner = homeName;
    message = "";
  } else if (probs[0][0] === "away") {
    winner = awayName;
    message = "";
  } else {
    winner = "Nul";
    message = "Le nul est fortement possible";
  }

  const confidence =
    calculateConfidence(
      home,
      away,
      markets
    );

  const dataQuality = Math.round(
    (
      Math.min(home.recentMatches, 20) +
      Math.min(away.recentMatches, 20)
    ) / 40 * 100
  );

  return {
    match: {
      home: homeName,
      away: awayName
    },

    teams: {
      home,
      away
    },

    h2h,

    expectedGoals: xg,

    predictions: {
      winner,
      confidence,
      message,

      homeWin: +(markets.homeWin * 100).toFixed(1),
      draw: +(markets.draw * 100).toFixed(1),
      awayWin: +(markets.awayWin * 100).toFixed(1),

      over25: +(markets.over25 * 100).toFixed(1),
      under25: +(markets.under25 * 100).toFixed(1),

      bttsYes: +(markets.bttsYes * 100).toFixed(1),
      bttsNo: +(markets.bttsNo * 100).toFixed(1),

      dataQuality
    },

    topScores: scores.map(s => ({
      score: `${s.homeGoals}-${s.awayGoals}`,
      probability: +(s.probability * 100).toFixed(1)
    }))
  };
}

module.exports = {
  predictMatch,
  analyzeTeam,
  analyzeH2H,
  expectedGoals,
  calculateMarkets,
  buildMatrix,
  getTopScores: matrix =>
    [...matrix]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
};
