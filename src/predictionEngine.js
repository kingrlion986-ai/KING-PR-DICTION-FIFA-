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

function weightedAvg(values, weights) {
  if (!values.length) return 0;

  let total = 0;
  let weightTotal = 0;

  for (let i = 0; i < values.length; i++) {
    total += values[i] * weights[i];
    weightTotal += weights[i];
  }

  return weightTotal ? total / weightTotal : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* =========================
   MATCHS RÉCENTS
========================= */

function recentMatches(matches, limit = 10) {
  return [...matches]
    .sort(
      (a, b) =>
        new Date(b.date || 0) -
        new Date(a.date || 0)
    )
    .slice(0, limit);
}

/* =========================
   POIDS TEMPOREL
========================= */

function getMatchWeight(index) {
  if (index < 3) return 1.00;
  if (index < 6) return 0.85;
  if (index < 8) return 0.75;
  return 0.65;
}

/* =========================
   ANALYSE ÉQUIPE
========================= */

function analyzeTeam(team) {
  const all = getTeamMatches(team) || [];
  const recent = recentMatches(all, 10);

  let scored = [];
  let conceded = [];
  let weights = [];

  let homeScored = [];
  let homeConceded = [];
  let homeWeights = [];

  let awayScored = [];
  let awayConceded = [];
  let awayWeights = [];

  let points = [];

  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const weight = getMatchWeight(i);

    const isHome =
      m.home.toLowerCase() ===
      team.toLowerCase();

    const gf = isHome
      ? Number(m.homeGoals)
      : Number(m.awayGoals);

    const ga = isHome
      ? Number(m.awayGoals)
      : Number(m.homeGoals);

    scored.push(gf);
    conceded.push(ga);
    weights.push(weight);

    if (isHome) {
      homeScored.push(gf);
      homeConceded.push(ga);
      homeWeights.push(weight);
    } else {
      awayScored.push(gf);
      awayConceded.push(ga);
      awayWeights.push(weight);
    }

    if (gf > ga) points.push(3);
    else if (gf === ga) points.push(1);
    else points.push(0);
  }

  return {
    team,
    matches: all.length,

    avgScored:
      weightedAvg(scored, weights),

    avgConceded:
      weightedAvg(conceded, weights),

    homeAvgScored:
      weightedAvg(homeScored, homeWeights),

    homeAvgConceded:
      weightedAvg(homeConceded, homeWeights),

    awayAvgScored:
      weightedAvg(awayScored, awayWeights),

    awayAvgConceded:
      weightedAvg(awayConceded, awayWeights),

    winRate: recent.length
      ? weightedAvg(
          points.map(p => p === 3 ? 1 : 0),
          weights
        )
      : 0,

    form: recent.length
      ? weightedAvg(points, weights) / 3
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
    const originalHome =
      m.home.toLowerCase() ===
      home.toLowerCase();

    const hg = Number(m.homeGoals);
    const ag = Number(m.awayGoals);

    if (originalHome) {
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

  const total = recent.length;

  return {
    matches: total,

    homeAvgScored:
      total ? avg(homeGoals) : 0,

    awayAvgScored:
      total ? avg(awayGoals) : 0,

    homeAvgConceded:
      total ? avg(awayGoals) : 0,

    awayAvgConceded:
      total ? avg(homeGoals) : 0,

    homeWinRate:
      total
        ? homeWins / total * 100
        : 0,

    drawRate:
      total
        ? draws / total * 100
        : 0,

    awayWinRate:
      total
        ? awayWins / total * 100
        : 0
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
  const homeAttack =
    homeStats.homeAvgScored ||
    homeStats.avgScored ||
    1;

  const homeDefense =
    homeStats.homeAvgConceded ||
    homeStats.avgConceded ||
    1;

  const awayAttack =
    awayStats.awayAvgScored ||
    awayStats.avgScored ||
    1;

  const awayDefense =
    awayStats.awayAvgConceded ||
    awayStats.avgConceded ||
    1;

  let homeXG =
    homeAttack * 0.55 +
    awayDefense * 0.45;

  let awayXG =
    awayAttack * 0.55 +
    homeDefense * 0.45;

  /*
   * H2H très faible influence.
   * Un seul ancien match ne doit pas
   * bouleverser toute la prédiction.
   */

  if (h2h.matches >= 3) {
    homeXG =
      homeXG * 0.90 +
      h2h.homeAvgScored * 0.10;

    awayXG =
      awayXG * 0.90 +
      h2h.awayAvgScored * 0.10;
  }

  return {
    home: Number(
      clamp(homeXG, 0.20, 3.50).toFixed(2)
    ),

    away: Number(
      clamp(awayXG, 0.20, 3.50).toFixed(2)
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
   DIXON-COLES
========================= */

function dixonColesCorrection(
  h,
  a,
  homeXG,
  awayXG,
  rho = -0.10
) {
  if (h === 0 && a === 0) {
    return 1 -
      homeXG * awayXG * rho;
  }

  if (h === 1 && a === 0) {
    return 1 + awayXG * rho;
  }

  if (h === 0 && a === 1) {
    return 1 + homeXG * rho;
  }

  if (h === 1 && a === 1) {
    return 1 - rho;
  }

  return 1;
}

/* =========================
   MATRICE DES SCORES
========================= */

function calculateScores(
  homeXG,
  awayXG
) {
  const scores = [];

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {

      let probability =
        poisson(homeXG, h) *
        poisson(awayXG, a);

      probability *=
        dixonColesCorrection(
          h,
          a,
          homeXG,
          awayXG
        );

      scores.push({
        homeGoals: h,
        awayGoals: a,
        probability
      });
    }
  }

  const total =
    scores.reduce(
      (sum, s) =>
        sum + s.probability,
      0
    );

  for (const s of scores) {
    s.probability /= total;
  }

  return scores;
}

/* =========================
   MARCHÉS
========================= */

function calculateMarkets(scores) {
  const markets = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0
  };

  for (const s of scores) {
    const h = s.homeGoals;
    const a = s.awayGoals;
    const p = s.probability;

    if (h > a)
      markets.homeWin += p;
    else if (h === a)
      markets.draw += p;
    else
      markets.awayWin += p;

    if (h + a > 2)
      markets.over25 += p;
    else
      markets.under25 += p;

    if (h > 0 && a > 0)
      markets.bttsYes += p;
    else
      markets.bttsNo += p;
  }

  return markets;
}

/* =========================
   SCORES PRINCIPAUX
========================= */

function getTopScores(
  scores,
  limit = 3
) {
  return [...scores]
    .sort(
      (a, b) =>
        b.probability -
        a.probability
    )
    .slice(0, limit);
}

/* =========================
   CONFIANCE
========================= */

function calculateConfidence(
  markets,
  homeStats,
  awayStats
) {
  const sorted = [
    markets.homeWin,
    markets.draw,
    markets.awayWin
  ].sort((a, b) => b - a);

  const margin =
    sorted[0] - sorted[1];

  const dataCount =
    Math.min(
      homeStats.matches,
      awayStats.matches
    );

  const dataFactor =
    clamp(dataCount / 20, 0, 1);

  /*
   * Plus les probabilités sont proches,
   * plus la confiance baisse.
   */

  let confidence =
    30 +
    margin * 100 * 0.70 +
    dataFactor * 10;

  return Math.round(
    clamp(confidence, 30, 90)
  );
}

/* =========================
   PRÉDICTION
========================= */

function predictMatch(home, away) {

  const homeStats =
    analyzeTeam(home);

  const awayStats =
    analyzeTeam(away);

  const h2h =
    analyzeH2H(home, away);

  /*
   * Si une équipe n'a aucune donnée,
   * on évite une fausse précision.
   */

  if (
    homeStats.matches === 0 ||
    awayStats.matches === 0
  ) {
    return {
      match: { home, away },

      teams: {
        home: homeStats,
        away: awayStats
      },

      h2h,

      expectedGoals: {
        home: 0,
        away: 0
      },

      predictions: {
        winner: "Données insuffisantes",
        confidence: 0,
        homeWin: 0,
        draw: 0,
        awayWin: 0,
        over25: 0,
        under25: 0,
        bttsYes: 0,
        bttsNo: 0,
        dataQuality: 0
      },

      topScores: []
    };
  }

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

  const markets =
    calculateMarkets(scores);

  const topScores =
    getTopScores(scores, 3);

  let winner;

  if (
    markets.homeWin >
      markets.awayWin &&
    markets.homeWin >
      markets.draw
  ) {
    winner = home;
  } else if (
    markets.awayWin >
      markets.homeWin &&
    markets.awayWin >
      markets.draw
  ) {
    winner = away;
  } else {
    winner = "Nul";
  }

  const confidence =
    calculateConfidence(
      markets,
      homeStats,
      awayStats
    );

  const totalMatches =
    homeStats.matches +
    awayStats.matches;

  const dataQuality =
    Math.round(
      clamp(
        totalMatches / 40 * 100,
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

      homeWin:
        +(markets.homeWin * 100)
          .toFixed(1),

      draw:
        +(markets.draw * 100)
          .toFixed(1),

      awayWin:
        +(markets.awayWin * 100)
          .toFixed(1),

      over25:
        +(markets.over25 * 100)
          .toFixed(1),

      under25:
        +(markets.under25 * 100)
          .toFixed(1),

      bttsYes:
        +(markets.bttsYes * 100)
          .toFixed(1),

      bttsNo:
        +(markets.bttsNo * 100)
          .toFixed(1),

      dataQuality
    },

    topScores:
      topScores.map(s => ({
        score:
          `${s.homeGoals}-${s.awayGoals}`,

        probability:
          +(s.probability * 100)
            .toFixed(1)
      }))
  };
}

/* =========================
   EXPORT
========================= */

module.exports = {
  predictMatch,
  analyzeTeam,
  analyzeH2H
};
