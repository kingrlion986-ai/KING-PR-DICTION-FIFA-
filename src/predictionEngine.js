const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

/* =========================
   OUTILS
========================= */

function avg(a) {
  return a.length
    ? a.reduce((x, y) => x + y, 0) / a.length
    : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function weight(i) {
  return Math.max(0.35, 1 - i * 0.06);
}

function recent(matches, limit = 20) {
  return [...matches]
    .filter(m => m && m.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

function wavg(values) {
  if (!values.length) return 0;

  let total = 0;
  let weights = 0;

  values.forEach((v, i) => {
    const w = weight(i);
    total += v * w;
    weights += w;
  });

  return total / weights;
}

/* =========================
   ÉQUIPE
========================= */

function analyzeTeam(team) {
  const all = getTeamMatches(team) || [];
  const r = recent(all);

  const scored = [];
  const conceded = [];
  const homeScored = [];
  const homeConceded = [];
  const awayScored = [];
  const awayConceded = [];

  let wins = 0;
  let points = 0;

  r.forEach(m => {
    const home =
      m.home.toLowerCase() === team.toLowerCase();

    const gf = Number(home ? m.homeGoals : m.awayGoals);
    const ga = Number(home ? m.awayGoals : m.homeGoals);

    scored.push(gf);
    conceded.push(ga);

    if (home) {
      homeScored.push(gf);
      homeConceded.push(ga);
    } else {
      awayScored.push(gf);
      awayConceded.push(ga);
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
    avgScored: wavg(scored),
    avgConceded: wavg(conceded),
    homeAvgScored: wavg(homeScored),
    homeAvgConceded: wavg(homeConceded),
    awayAvgScored: wavg(awayScored),
    awayAvgConceded: wavg(awayConceded),
    winRate: r.length ? wins / r.length : 0,
    form: r.length ? points / (r.length * 3) : 0,
    recentMatches: r.length
  };
}

/* =========================
   H2H
========================= */

function analyzeH2H(home, away) {
  const r = recent(getHeadToHead(home, away) || [], 10);

  let hg = [];
  let ag = [];
  let hw = 0;
  let d = 0;
  let aw = 0;

  r.forEach(m => {
    const same =
      m.home.toLowerCase() === home.toLowerCase();

    const h = Number(same ? m.homeGoals : m.awayGoals);
    const a = Number(same ? m.awayGoals : m.homeGoals);

    hg.push(h);
    ag.push(a);

    if (h > a) hw++;
    else if (h === a) d++;
    else aw++;
  });

  return {
    matches: r.length,
    homeAvgScored: avg(hg),
    awayAvgScored: avg(ag),
    homeWinRate: r.length ? hw / r.length : 0,
    drawRate: r.length ? d / r.length : 0,
    awayWinRate: r.length ? aw / r.length : 0
  };
}

/* =========================
   XG
========================= */

function expectedGoals(h, a, h2h) {
  let ha = h.homeAvgScored || h.avgScored || 1.25;
  let hd = h.homeAvgConceded || h.avgConceded || 1.25;

  let aa = a.awayAvgScored || a.avgScored || 1.25;
  let ad = a.awayAvgConceded || a.avgConceded || 1.25;

  let hxg = ha * 0.55 + ad * 0.45;
  let axg = aa * 0.55 + hd * 0.45;

  /* H2H seulement si suffisamment de matchs */
  if (h2h.matches >= 3) {
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
  return Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k);
}

/* =========================
   DIXON-COLES
========================= */

function dcCorrection(h, a, lh, la) {
  const rho = -0.13;

  if (h === 0 && a === 0)
    return 1 - lh * la * rho;

  if (h === 1 && a === 0)
    return 1 + la * rho;

  if (h === 0 && a === 1)
    return 1 + lh * rho;

  if (h === 1 && a === 1)
    return 1 - rho;

  return 1;
}

function buildMatrix(lh, la) {
  const matrix = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p =
        poisson(lh, h) *
        poisson(la, a) *
        dcCorrection(h, a, lh, la);

      matrix.push({
        homeGoals: h,
        awayGoals: a,
        probability: p
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
    const h = x.homeGoals;
    const a = x.awayGoals;
    const p = x.probability;

    if (h > a) r.homeWin += p;
    else if (h === a) r.draw += p;
    else r.awayWin += p;

    if (h + a >= 3) r.over25 += p;
    else r.under25 += p;

    if (h > 0 && a > 0) r.bttsYes += p;
    else r.bttsNo += p;
  });

  return r;
}

/* =========================
   SCORES
========================= */

function getTopScores(matrix) {
  return [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5)
    .map(x => ({
      score: `${x.homeGoals}-${x.awayGoals}`,
      probability: +(x.probability * 100).toFixed(1)
    }));
}

/* =========================
   CONFIANCE
========================= */

function confidence(h, a, markets) {
  const data =
    clamp(
      (h.matches + a.matches) / 40,
      0,
      1
    );

  const values = [
    markets.homeWin,
    markets.draw,
    markets.awayWin
  ].sort((x, y) => y - x);

  const separation = values[0] - values[1];

  /*
   * Un match serré ne doit jamais
   * recevoir une confiance artificiellement élevée.
   */
  let c = 30 + separation * 100;

  c += data * 15;

  return Math.round(
    clamp(c, 25, 75)
  );
}

/* =========================
   PREDICTION
========================= */

function predictMatch(home, away) {
  const hs = analyzeTeam(home);
  const as = analyzeTeam(away);
  const h2h = analyzeH2H(home, away);

  const xg = expectedGoals(hs, as, h2h);
  const matrix = buildMatrix(xg.home, xg.away);
  const markets = calculateMarkets(matrix);
  const topScores = getTopScores(matrix);

  let winner = "Nul";

  if (
    markets.homeWin > markets.draw &&
    markets.homeWin > markets.awayWin
  ) {
    winner = home;
  } else if (
    markets.awayWin > markets.draw &&
    markets.awayWin > markets.homeWin
  ) {
    winner = away;
  }

  const conf = confidence(
    hs,
    as,
    markets
  );

  const gap = Math.abs(
    markets.homeWin - markets.awayWin
  );

  let message = "";

  if (gap < 0.05)
    message = "Match très serré";
  else if (gap < 0.10)
    message = "Match serré";
  else if (winner === "Nul")
    message = "Nul fortement possible";

  const quality = Math.round(
    clamp(
      ((hs.matches + as.matches) / 40) * 100,
      0,
      100
    )
  );

  return {
    match: { home, away },

    teams: {
      home: hs,
      away: as
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

      dataQuality: quality
    },

    topScores
  };
}

module.exports = {
  predictMatch,
  analyzeTeam,
  analyzeH2H,
  expectedGoals,
  buildMatrix,
  calculateMarkets,
  getTopScores
};
