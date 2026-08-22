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

/* Match récent = poids plus important */
function getMatchWeight(index) {
  return Math.max(0.35, 1 - index * 0.06);
}

function weightedAvg(values) {
  if (!values.length) return 0;

  let total = 0;
  let weights = 0;

  values.forEach((v, i) => {
    const w = getMatchWeight(i);
    total += v * w;
    weights += w;
  });

  return weights ? total / weights : 0;
}

function recentMatches(matches, limit = 20) {
  return [...matches]
    .filter(m => m && m.date)
    .sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    )
    .slice(0, limit);
}

/* =========================
   ANALYSE ÉQUIPE
========================= */

function analyzeTeam(team) {
  const all = getTeamMatches(team) || [];
  const recent = recentMatches(all, 20);

  let scored = [];
  let conceded = [];

  let homeScored = [];
  let homeConceded = [];

  let awayScored = [];
  let awayConceded = [];

  let points = 0;
  let wins = 0;

  recent.forEach((m, i) => {
    const isHome =
      m.home.toLowerCase() === team.toLowerCase();

    const gf = isHome
      ? Number(m.homeGoals)
      : Number(m.awayGoals);

    const ga = isHome
      ? Number(m.awayGoals)
      : Number(m.homeGoals);

    const weight = getMatchWeight(i);

    scored.push({ value: gf, weight });
    conceded.push({ value: ga, weight });

    if (isHome) {
      homeScored.push({ value: gf, weight });
      homeConceded.push({ value: ga, weight });
    } else {
      awayScored.push({ value: gf, weight });
      awayConceded.push({ value: ga, weight });
    }

    if (gf > ga) {
      wins++;
      points += 3;
    } else if (gf === ga) {
      points += 1;
    }
  });

  function wavg(list) {
    if (!list.length) return 0;

    const total = list.reduce(
      (s, x) => s + x.value * x.weight,
      0
    );

    const weights = list.reduce(
      (s, x) => s + x.weight,
      0
    );

    return weights ? total / weights : 0;
  }

  return {
    team,
    matches: all.length,

    avgScored: wavg(scored),
    avgConceded: wavg(conceded),

    homeAvgScored: wavg(homeScored),
    homeAvgConceded: wavg(homeConceded),

    awayAvgScored: wavg(awayScored),
    awayAvgConceded: wavg(awayConceded),

    winRate: recent.length
      ? wins / recent.length
      : 0,

    form: recent.length
      ? points / (recent.length * 3)
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

  recent.forEach(m => {
    const original =
      m.home.toLowerCase() ===
      home.toLowerCase();

    const hg = Number(m.homeGoals);
    const ag = Number(m.awayGoals);

    if (original) {
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
  });

  const total = recent.length;

  return {
    matches: total,

    homeAvgScored:
      avg(homeGoals),

    awayAvgScored:
      avg(awayGoals),

    homeWinRate:
  total ? (homeWins / total) * 100 : 0,

drawRate:
  total ? (draws / total) * 100 : 0,

awayWinRate:
  total ? (awayWins / total) * 100 : 0
    
  };
}

/* =========================
   BUTS ATTENDUS
========================= */

function calculateExpectedGoals(
  homeStats,
  awayStats,
  h2h
) {
  /*
   * Si une équipe possède des données,
   * on privilégie ses performances récentes.
   */

  let homeAttack =
    homeStats.homeAvgScored ||
    homeStats.avgScored;

  let homeDefense =
    homeStats.homeAvgConceded ||
    homeStats.avgConceded;

  let awayAttack =
    awayStats.awayAvgScored ||
    awayStats.avgScored;

  let awayDefense =
    awayStats.awayAvgConceded ||
    awayStats.avgConceded;

  /*
   * Si les données domicile/extérieur
   * sont absentes, on revient aux moyennes générales.
   */

  if (!homeAttack) homeAttack = 1.25;
  if (!homeDefense) homeDefense = 1.25;
  if (!awayAttack) awayAttack = 1.25;
  if (!awayDefense) awayDefense = 1.25;

  let homeXG =
    homeAttack * 0.55 +
    awayDefense * 0.45;

  let awayXG =
    awayAttack * 0.55 +
    homeDefense * 0.45;

  /*
   * H2H uniquement s'il existe.
   * Faible influence pour éviter de surévaluer
   * une seule confrontation.
   */

  if (h2h.matches >= 2) {
    homeXG =
      homeXG * 0.85 +
      h2h.homeAvgScored * 0.15;

    awayXG =
      awayXG * 0.85 +
      h2h.awayAvgScored * 0.15;
  }

  return {
    home: Number(
      clamp(homeXG, 0.20, 4.00).toFixed(2)
    ),

    away: Number(
      clamp(awayXG, 0.20, 4.00).toFixed(2)
    )
  };
}

/* =========================
   POISSON
========================= */

function factorial(n) {
  let r = 1;

  for (let i = 2; i <= n; i++) {
    r *= i;
  }

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
   MATRICE SCORES
========================= */

function buildMatrix(homeXG, awayXG) {
  const matrix = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      matrix.push({
        homeGoals: h,
        awayGoals: a,
        probability:
          poisson(homeXG, h) *
          poisson(awayXG, a)
      });
    }
  }

  const total = matrix.reduce(
    (sum, x) => sum + x.probability,
    0
  );

  return matrix.map(x => ({
    ...x,
    probability:
      x.probability / total
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

  for (const x of matrix) {
    const h = x.homeGoals;
    const a = x.awayGoals;
    const p = x.probability;

    if (h > a) r.homeWin += p;
    else if (h === a) r.draw += p;
    else r.awayWin += p;

    if (h + a > 2)
      r.over25 += p;
    else
      r.under25 += p;

    if (h > 0 && a > 0)
      r.bttsYes += p;
    else
      r.bttsNo += p;
  }

  return r;
}

/* =========================
   TOP SCORES
========================= */

function getTopScores(matrix) {
  return [...matrix]
    .sort(
      (a, b) =>
        b.probability - a.probability
    )
    .slice(0, 5);
}

/* =========================
   CONFIANCE
========================= */

function calculateConfidence(
  homeStats,
  awayStats,
  markets
) {
  const data =
    Math.min(
      100,
      ((homeStats.matches +
        awayStats.matches) / 40) * 100
    );

  const difference =
    Math.abs(
      markets.homeWin -
      markets.awayWin
    );

  const certainty =
    difference * 100;

  /*
   * La confiance dépend :
   * - de la quantité de données
   * - de l'écart entre les équipes
   */

  let confidence =
    data * 0.55 +
    certainty * 0.45;

  return Math.round(
    clamp(confidence, 20, 95)
  );
}

/* =========================
   PREDICTION
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

  const matrix =
    buildMatrix(
      expectedGoals.home,
      expectedGoals.away
    );

  const markets =
    calculateMarkets(matrix);

  const topScores =
    getTopScores(matrix);

  let winner;

  if (
    markets.draw >= markets.homeWin &&
    markets.draw >= markets.awayWin
  ) {
    winner = "Nul";
  } else if (
    markets.homeWin >= markets.awayWin
  ) {
    winner = home;
  } else {
    winner = away;
  }

  const confidence =
    calculateConfidence(
      homeStats,
      awayStats,
      markets
    );

  let message = "";

  const gap =
    Math.abs(
      markets.homeWin -
      markets.awayWin
    );

  if (gap < 0.08) {
    message = "Match très serré";
  } else if (gap < 0.15) {
    message = "Match serré";
  } else if (winner === "Nul") {
    message = "Le nul est fortement possible";
  }

  const dataQuality =
    Math.round(
      clamp(
        ((homeStats.matches +
          awayStats.matches) / 40) * 100,
        0,
        100
      )
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

    predictions: {
      winner,

      confidence,

      message,

      homeWin:
        +(markets.homeWin * 100).toFixed(1),

      draw:
        +(markets.draw * 100).toFixed(1),

      awayWin:
        +(markets.awayWin * 100).toFixed(1),

      over25:
        +(markets.over25 * 100).toFixed(1),

      under25:
        +(markets.under25 * 100).toFixed(1),

      bttsYes:
        +(markets.bttsYes * 100).toFixed(1),

      bttsNo:
        +(markets.bttsNo * 100).toFixed(1),

      dataQuality
    },

    topScores:
      topScores.map(s => ({
        score:
          `${s.homeGoals}-${s.awayGoals}`,

        probability:
          +(s.probability * 100).toFixed(2)
      }))
  };
}

/* =========================
   EXPORT
========================= */

module.exports = {
  predictMatch,
  analyzeTeam,
  analyzeH2H,
  calculateExpectedGoals,
  calculateMarkets,
  buildMatrix,
  getTopScores
};
