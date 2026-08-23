const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

/* OUTILS */

function avg(a) {
  return a.length
    ? a.reduce((x, y) => x + y, 0) / a.length
    : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function recent(matches, limit = 20) {
  return [...matches]
    .filter(m => m && m.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

function weight(i) {
  return Math.max(0.35, 1 - i * 0.06);
}

function wavg(values) {
  let sum = 0, w = 0;

  values.forEach((v, i) => {
    const x = weight(i);
    sum += v * x;
    w += x;
  });

  return w ? sum / w : 0;
}

/* ÉQUIPE */

function analyzeTeam(team) {
  const all = getTeamMatches(team) || [];
  const ms = recent(all);

  const scored = [];
  const conceded = [];
  const homeS = [], homeC = [];
  const awayS = [], awayC = [];

  let points = 0;
  let wins = 0;

  ms.forEach((m, i) => {
    const home =
      m.home.toLowerCase() === team.toLowerCase();

    const gf = Number(home ? m.homeGoals : m.awayGoals);
    const ga = Number(home ? m.awayGoals : m.homeGoals);

    scored.push(gf);
    conceded.push(ga);

    if (home) {
      homeS.push(gf);
      homeC.push(ga);
    } else {
      awayS.push(gf);
      awayC.push(ga);
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

    homeAvgScored: wavg(homeS),
    homeAvgConceded: wavg(homeC),

    awayAvgScored: wavg(awayS),
    awayAvgConceded: wavg(awayC),

    winRate: ms.length ? wins / ms.length : 0,
    form: ms.length ? points / (ms.length * 3) : 0
  };
}

/* H2H */

function analyzeH2H(home, away) {
  const ms = recent(
    getHeadToHead(home, away) || [],
    10
  );

  let hs = [], as = [];
  let hw = 0, dr = 0, aw = 0;

  ms.forEach(m => {
    const original =
      m.home.toLowerCase() === home.toLowerCase();

    const h = Number(m.homeGoals);
    const a = Number(m.awayGoals);

    const hg = original ? h : a;
    const ag = original ? a : h;

    hs.push(hg);
    as.push(ag);

    if (hg > ag) hw++;
    else if (hg === ag) dr++;
    else aw++;
  });

  const n = ms.length || 1;

  return {
    matches: ms.length,
    homeAvgScored: avg(hs),
    awayAvgScored: avg(as),
    homeWinRate: hw / n * 100,
    drawRate: dr / n * 100,
    awayWinRate: aw / n * 100
  };
}

/* BUTS ATTENDUS */

function expectedGoals(home, away, h2h) {
  const ha = home.homeAvgScored || home.avgScored || 1.2;
  const hd = home.homeAvgConceded || home.avgConceded || 1.2;

  const aa = away.awayAvgScored || away.avgScored || 1.2;
  const ad = away.awayAvgConceded || away.avgConceded || 1.2;

  let hxg = ha * 0.55 + ad * 0.45;
  let axg = aa * 0.55 + hd * 0.45;

  if (h2h.matches >= 2) {
    hxg = hxg * 0.9 + h2h.homeAvgScored * 0.1;
    axg = axg * 0.9 + h2h.awayAvgScored * 0.1;
  }

  return {
    home: +clamp(hxg, 0.2, 4).toFixed(2),
    away: +clamp(axg, 0.2, 4).toFixed(2)
  };
}

/* POISSON */

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

/* DIXON-COLES */

function dcCorrection(h, a, hxg, axg) {
  const rho = -0.10;

  if (h === 0 && a === 0)
    return 1 - hxg * axg * rho;

  if (h === 1 && a === 0)
    return 1 + axg * rho;

  if (h === 0 && a === 1)
    return 1 + hxg * rho;

  if (h === 1 && a === 1)
    return 1 - rho;

  return 1;
}

/* MATRICE */

function buildMatrix(hxg, axg) {
  const matrix = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p =
        poisson(hxg, h) *
        poisson(axg, a) *
        dcCorrection(h, a, hxg, axg);

      matrix.push({
        homeGoals: h,
        awayGoals: a,
        probability: Math.max(0, p)
      });
    }
  }

  const total = matrix.reduce(
    (s, x) => s + x.probability,
    0
  );

  return matrix.map(x => ({
    ...x,
    probability: x.probability / total
  }));
}

/* MARCHÉS */

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
    const h = x.homeGoals;
    const a = x.awayGoals;
    const p = x.probability;

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

/* TOP SCORES */

function getTopScores(matrix) {
  return [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);
}

/* CONFIANCE */

function confidence(home, away, markets) {
  const gap = Math.abs(
    markets.homeWin - markets.awayWin
  );

  const data =
    Math.min(
      100,
      (home.recentMatches + away.recentMatches) / 40 * 100
    );

  let base =
    gap < 0.05 ? 30 :
    gap < 0.10 ? 35 :
    gap < 0.20 ? 45 :
    gap < 0.30 ? 58 : 70;

  return Math.round(
    clamp(base + data * 0.10, 25, 75)
  );
}

/* PREDICTION */

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
  const scores = getTopScores(matrix);

  let winner = "Nul";

  if (
    markets.homeWin > markets.awayWin &&
    markets.homeWin > markets.draw
  ) {
    winner = homeName;
  } else if (
    markets.awayWin > markets.homeWin &&
    markets.awayWin > markets.draw
  ) {
    winner = awayName;
  }

  const conf = confidence(
    home,
    away,
    markets
  );

  const gap = Math.abs(
    markets.homeWin - markets.awayWin
  );

  const message =
    gap < 0.05
      ? "Match très serré"
      : gap < 0.10
        ? "Match serré"
        : winner === "Nul"
          ? "Nul possible"
          : "";

  const dataQuality = Math.round(
    (Math.min(home.recentMatches, 20) +
      Math.min(away.recentMatches, 20)) / 40 * 100
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
      confidence: conf,
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
  getTopScores
};
