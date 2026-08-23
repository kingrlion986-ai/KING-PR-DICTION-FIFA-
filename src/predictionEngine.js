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

function teamKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* =========================
   TRI DATE + HEURE
========================= */

function recentMatches(matches, limit = 20) {
  return [...(matches || [])]
    .filter(m => {
      if (!m || !m.date) return false;
      return !Number.isNaN(
        new Date(m.date).getTime()
      );
    })
    .sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    )
    .slice(0, limit);
}

/* =========================
   POIDS DES MATCHS
========================= */

function getMatchWeight(index) {
  return Math.max(
    0.40,
    1 - index * 0.045
  );
}

function weightedAverage(list) {
  if (!list.length) return 0;

  let total = 0;
  let weights = 0;

  list.forEach((value, index) => {
    const weight =
      getMatchWeight(index);

    total += value * weight;
    weights += weight;
  });

  return weights
    ? total / weights
    : 0;
}

/* =========================
   ANALYSE ÉQUIPE
========================= */

function analyzeTeam(team) {
  const all =
    getTeamMatches(team) || [];

  const recent =
    recentMatches(all, 20);

  const scored = [];
  const conceded = [];

  const homeScored = [];
  const homeConceded = [];

  const awayScored = [];
  const awayConceded = [];

  let wins = 0;
  let points = 0;

  recent.forEach(m => {
    const isHome =
      teamKey(m.home) ===
      teamKey(team);

    const gf = isHome
      ? Number(m.homeGoals)
      : Number(m.awayGoals);

    const ga = isHome
      ? Number(m.awayGoals)
      : Number(m.homeGoals);

    if (
      !Number.isFinite(gf) ||
      !Number.isFinite(ga)
    ) {
      return;
    }

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
      points += 3;
    } else if (gf === ga) {
      points += 1;
    }
  });

  return {
    team,

    matches: all.length,

    recentMatches: recent.length,

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
      recent.length
        ? wins / recent.length
        : 0,

    form:
      recent.length
        ? points /
          (recent.length * 3)
        : 0
  };
}

/* =========================
   H2H
========================= */

function analyzeH2H(home, away) {
  const matches =
    getHeadToHead(
      home,
      away
    ) || [];

  const recent =
    recentMatches(matches, 5);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  const homeGoals = [];
  const awayGoals = [];

  recent.forEach(m => {
    const hg =
      Number(m.homeGoals);

    const ag =
      Number(m.awayGoals);

    if (
      !Number.isFinite(hg) ||
      !Number.isFinite(ag)
    ) {
      return;
    }

    const originalHome =
      teamKey(m.home) ===
      teamKey(home);

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
  });

  const total =
    homeGoals.length;

  return {
    matches: total,

    homeAvgScored:
      avg(homeGoals),

    awayAvgScored:
      avg(awayGoals),

    homeWinRate:
      total
        ? homeWins / total
        : 0,

    drawRate:
      total
        ? draws / total
        : 0,

    awayWinRate:
      total
        ? awayWins / total
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
  let homeAttack =
    homeStats.homeAvgScored ||
    homeStats.avgScored ||
    1.25;

  let homeDefense =
    homeStats.homeAvgConceded ||
    homeStats.avgConceded ||
    1.25;

  let awayAttack =
    awayStats.awayAvgScored ||
    awayStats.avgScored ||
    1.25;

  let awayDefense =
    awayStats.awayAvgConceded ||
    awayStats.avgConceded ||
    1.25;

  /*
   * Mélange attaque/défense.
   */

  let homeXG =
    homeAttack * 0.60 +
    awayDefense * 0.40;

  let awayXG =
    awayAttack * 0.60 +
    homeDefense * 0.40;

  /*
   * H2H très faible influence.
   */

  if (h2h.matches >= 2) {
    homeXG =
      homeXG * 0.90 +
      h2h.homeAvgScored * 0.10;

    awayXG =
      awayXG * 0.90 +
      h2h.awayAvgScored * 0.10;
  }

  return {
    home: Number(
      clamp(
        homeXG,
        0.30,
        3.50
      ).toFixed(2)
    ),

    away: Number(
      clamp(
        awayXG,
        0.30,
        3.50
      ).toFixed(2)
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
   MATRICE
========================= */

function buildMatrix(
  homeXG,
  awayXG
) {
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

  const total =
    matrix.reduce(
      (sum, item) =>
        sum + item.probability,
      0
    );

  return matrix.map(item => ({
    ...item,

    probability:
      total
        ? item.probability / total
        : 0
  }));
}

/* =========================
   MARCHÉS
========================= */

function calculateMarkets(matrix) {
  const result = {
    homeWin: 0,
    draw: 0,
    awayWin: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0
  };

  matrix.forEach(item => {
    const h =
      item.homeGoals;

    const a =
      item.awayGoals;

    const p =
      item.probability;

    if (h > a)
      result.homeWin += p;
    else if (h === a)
      result.draw += p;
    else
      result.awayWin += p;

    if (h + a >= 3)
      result.over25 += p;
    else
      result.under25 += p;

    if (h > 0 && a > 0)
      result.bttsYes += p;
    else
      result.bttsNo += p;
  });

  /*
   * Sécurise les marchés.
   */

  const total =
    result.homeWin +
    result.draw +
    result.awayWin;

  if (total > 0) {
    result.homeWin /= total;
    result.draw /= total;
    result.awayWin /= total;
  }

  const goalsTotal =
    result.over25 +
    result.under25;

  if (goalsTotal > 0) {
    result.over25 /= goalsTotal;
    result.under25 /= goalsTotal;
  }

  const bttsTotal =
    result.bttsYes +
    result.bttsNo;

  if (bttsTotal > 0) {
    result.bttsYes /= bttsTotal;
    result.bttsNo /= bttsTotal;
  }

  return result;
}

/* =========================
   SCORES
========================= */

function getTopScores(
  matrix,
  limit = 5
) {
  return [...matrix]
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
  homeStats,
  awayStats,
  markets
) {
  const dataCount =
    Math.min(
      homeStats.recentMatches +
      awayStats.recentMatches,
      40
    );

  const dataFactor =
    dataCount / 40;

  const probabilities = [
    markets.homeWin,
    markets.draw,
    markets.awayWin
  ].sort((a, b) => b - a);

  const strongest =
    probabilities[0];

  const second =
    probabilities[1];

  const gap =
    strongest - second;

  let base;

  if (gap < 0.03)
    base = 32;
  else if (gap < 0.06)
    base = 38;
  else if (gap < 0.10)
    base = 45;
  else if (gap < 0.15)
    base = 53;
  else if (gap < 0.22)
    base = 63;
  else
    base = 72;

  const dataBonus =
    dataFactor * 8;

  return Math.round(
    clamp(
      base + dataBonus,
      25,
      80
    )
  );
}

/* =========================
   RISQUE
========================= */

function getRisk(confidence) {
  if (confidence < 40)
    return "Très élevé";

  if (confidence < 50)
    return "Élevé";

  if (confidence < 65)
    return "Moyen";

  if (confidence < 75)
    return "Faible";

  return "Très faible";
}

/* =========================
   PREDICTION
========================= */

function predictMatch(
  home,
  away
) {
  const homeStats =
    analyzeTeam(home);

  const awayStats =
    analyzeTeam(away);

  const h2h =
    analyzeH2H(
      home,
      away
    );

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
    getTopScores(
      matrix,
      5
    );

  let winner;

  if (
    markets.draw >=
      markets.homeWin &&
    markets.draw >=
      markets.awayWin
  ) {
    winner = "Nul";
  } else if (
    markets.homeWin >=
    markets.awayWin
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

  const risk =
    getRisk(confidence);

  const gap =
    Math.abs(
      markets.homeWin -
      markets.awayWin
    );

  let message;

  if (gap < 0.03) {
    message =
      "Match extrêmement serré";
  } else if (gap < 0.07) {
    message =
      "Match très serré";
  } else if (gap < 0.12) {
    message =
      "Match serré";
  } else if (winner === "Nul") {
    message =
      "Le nul est fortement possible";
  } else {
    message =
      "Avantage statistique";
  }

  /*
   * Qualité des données :
   * uniquement les matchs récents
   * réellement exploitables.
   */

  const usable =
    homeStats.recentMatches +
    awayStats.recentMatches;

  const dataQuality =
    Math.round(
      clamp(
        usable / 40 * 100,
        0,
        100
      )
    );

  const mainScore =
    topScores[0] || null;

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

      risk,

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

      mainScore:
        mainScore
          ? `${mainScore.homeGoals}-${mainScore.awayGoals}`
          : null,

      mainScoreProbability:
        mainScore
          ? +(mainScore.probability * 100)
              .toFixed(1)
          : 0,

      dataQuality
    },

    topScores:
      topScores.map(item => ({
        score:
          `${item.homeGoals}-${item.awayGoals}`,

        probability:
          +(item.probability * 100)
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
  analyzeH2H,
  calculateExpectedGoals,
  calculateMarkets,
  buildMatrix,
  getTopScores
};
