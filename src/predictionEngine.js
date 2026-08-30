const {
  getTeamMatches,
  getHeadToHead
} = require("./dataEngine");

/* =========================
   OUTILS
========================= */

function avg(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function poisson(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;

  let fact = 1;

  for (let i = 2; i <= k; i++) {
    fact *= i;
  }

  return (
    Math.exp(-lambda) *
    Math.pow(lambda, k) /
    fact
  );
}

/* =========================
   ANALYSE ÉQUIPE
========================= */

function analyzeTeam(team) {
  const matches =
    getTeamMatches(team) || [];

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

  const results = [];

  for (const m of matches) {

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

    if (isHome) {
      homeScored.push(gf);
      homeConceded.push(ga);
    } else {
      awayScored.push(gf);
      awayConceded.push(ga);
    }

    if (gf > ga) {
      results.push(1);
    } else if (gf === ga) {
      results.push(0.5);
    } else {
      results.push(0);
    }
  }

  return {
    team,
    matches: matches.length,

    avgScored: avg(scored),
    avgConceded: avg(conceded),

    homeAvgScored: avg(homeScored),
    homeAvgConceded: avg(homeConceded),

    awayAvgScored: avg(awayScored),
    awayAvgConceded: avg(awayConceded),

    winRate: results.length
      ? results.reduce((a, b) => a + b, 0) /
        results.length
      : 0,

    form:
      avg(results.slice(-5)) * 2
  };
}

/* =========================
   BUTS ATTENDUS
========================= */

function calculateExpectedGoals(home, away) {

  const homeAttack =
    home.homeAvgScored ||
    home.avgScored ||
    1;

  const homeDefense =
    home.homeAvgConceded ||
    home.avgConceded ||
    1;

  const awayAttack =
    away.awayAvgScored ||
    away.avgScored ||
    1;

  const awayDefense =
    away.awayAvgConceded ||
    away.avgConceded ||
    1;

  let homeXG =
    (homeAttack * 0.60) +
    (awayDefense * 0.40);

  let awayXG =
    (awayAttack * 0.60) +
    (homeDefense * 0.40);

  homeXG *= 1.05;

  return {
    home: Number(
      clamp(homeXG, 0.20, 4.5).toFixed(2)
    ),

    away: Number(
      clamp(awayXG, 0.20, 4.5).toFixed(2)
    )
  };
}

/* =========================
   MATRICE DES SCORES
========================= */

function buildScores(homeXG, awayXG) {

  const scores = [];

  for (let h = 0; h <= 8; h++) {

    for (let a = 0; a <= 8; a++) {

      const probability =
        poisson(h, homeXG) *
        poisson(a, awayXG);

      scores.push({
        home: h,
        away: a,
        probability
      });
    }
  }

  return scores;
}

/* =========================
   MARCHÉS
========================= */

function calculateMarkets(scores) {

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let bttsYes = 0;

  for (const s of scores) {

    if (s.home > s.away) {
      homeWin += s.probability;
    }

    if (s.home === s.away) {
      draw += s.probability;
    }

    if (s.home < s.away) {
      awayWin += s.probability;
    }

    if (s.home + s.away >= 2) {
      over15 += s.probability;
    }

    if (s.home + s.away >= 3) {
      over25 += s.probability;
    }

    if (
      s.home > 0 &&
      s.away > 0
    ) {
      bttsYes += s.probability;
    }
  }

  return {
    homeWin: homeWin * 100,
    draw: draw * 100,
    awayWin: awayWin * 100,
    over15: over15 * 100,
    over25: over25 * 100,
    bttsYes: bttsYes * 100
  };
}

/* =========================
   VERDICT FINAL
========================= */

function chooseBestBet(
  markets,
  home,
  away,
  h2h,
  expectedGoals,
  dataQuality
) {

  const options = [];

  /* =========================
     VICTOIRE DOMICILE
  ========================= */

  let homeScore =
    markets.homeWin;

  if (home.form > away.form) {
    homeScore += 5;
  }

  if (home.winRate > away.winRate) {
    homeScore += 5;
  }

  if (
    expectedGoals.home >
    expectedGoals.away
  ) {
    homeScore += 5;
  }

  options.push({
    name: `Victoire ${home.team}`,
    probability: markets.homeWin,
    score: homeScore
  });

  /* =========================
     VICTOIRE EXTÉRIEUR
  ========================= */

  let awayScore =
    markets.awayWin;

  if (away.form > home.form) {
    awayScore += 5;
  }

  if (away.winRate > home.winRate) {
    awayScore += 5;
  }

  if (
    expectedGoals.away >
    expectedGoals.home
  ) {
    awayScore += 5;
  }

  options.push({
    name: `Victoire ${away.team}`,
    probability: markets.awayWin,
    score: awayScore
  });

  /* =========================
     MATCH NUL
  ========================= */

  let drawScore =
    markets.draw;

  const xgDifference =
    Math.abs(
      expectedGoals.home -
      expectedGoals.away
    );

  if (xgDifference < 0.35) {
    drawScore += 10;
  }

  if (
    Math.abs(
      home.form -
      away.form
    ) < 0.20
  ) {
    drawScore += 5;
  }

  options.push({
    name: "Match nul",
    probability: markets.draw,
    score: drawScore
  });

  /* =========================
     BTTS
  ========================= */

  let bttsScore =
    markets.bttsYes;

  if (
    expectedGoals.home >= 1.20 &&
    expectedGoals.away >= 1.20
  ) {
    bttsScore += 10;
  }

  if (
    home.avgScored >= 1.20 &&
    away.avgScored >= 1.20
  ) {
    bttsScore += 5;
  }

  if (
    home.avgConceded >= 1.20 &&
    away.avgConceded >= 1.20
  ) {
    bttsScore += 5;
  }

  options.push({
    name: "Les deux équipes marquent",
    probability: markets.bttsYes,
    score: bttsScore
  });

  /* =========================
     PLUS DE 1,5 BUTS
  ========================= */

  let over15Score =
    markets.over15;

  const totalXG =
    expectedGoals.home +
    expectedGoals.away;

  if (totalXG >= 2.40) {
    over15Score += 8;
  }

  if (totalXG >= 3.00) {
    over15Score += 7;
  }

  options.push({
    name: "Plus de 1,5 buts",
    probability: markets.over15,
    score: over15Score
  });

  /* =========================
     COMPARAISON
  ========================= */

  options.sort(
    (a, b) =>
      b.score - a.score
  );

  const best =
    options[0];

  const second =
    options[1];

  const separation =
    best.score -
    second.score;

  /* =========================
     SIGNAL
  ========================= */

  let signal = "ROUGE";
  let color = "#ef4444";
  let message =
    "VERDICT INSUFFISAMMENT FIABLE";

  if (
    dataQuality >= 70 &&
    best.probability >= 65 &&
    separation >= 5
  ) {

    signal = "VERT";
    color = "#22c55e";
    message = "VERDICT FORT";

  } else if (
    dataQuality >= 50 &&
    best.probability >= 55 &&
    separation >= 3
  ) {

    signal = "ORANGE";
    color = "#f59e0b";
    message = "VERDICT MOYEN";
  }

  /* =========================
     EXPLICATION
  ========================= */

  let reason = "";

  if (
    best.name ===
    `Victoire ${home.team}`
  ) {

    reason =
      "La combinaison forme, probabilité de victoire et buts attendus favorise l'équipe domicile.";

  } else if (
    best.name ===
    `Victoire ${away.team}`
  ) {

    reason =
      "La combinaison forme, probabilité de victoire et buts attendus favorise l'équipe extérieure.";

  } else if (
    best.name === "Match nul"
  ) {

    reason =
      "Les forces des deux équipes sont proches et les buts attendus sont équilibrés.";

  } else if (
    best.name ===
    "Les deux équipes marquent"
  ) {

    reason =
      "Les données offensives et défensives favorisent un scénario où les deux équipes trouvent le chemin des buts.";

  } else if (
    best.name ===
    "Plus de 1,5 buts"
  ) {

    reason =
      "Le volume de buts attendu et la distribution des scores favorisent au moins deux buts.";
  }

  return {
    option: best.name,

    probability:
      Number(
        best.probability.toFixed(1)
      ),

    score:
      Number(
        best.score.toFixed(1)
      ),

    signal,
    color,
    message,
    reason
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

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  const homeGoals = [];
  const awayGoals = [];

  for (const m of matches) {

    const sameOrder =
      m.home.toLowerCase() ===
      home.toLowerCase();

    const hg = sameOrder
      ? Number(m.homeGoals)
      : Number(m.awayGoals);

    const ag = sameOrder
      ? Number(m.awayGoals)
      : Number(m.homeGoals);

    homeGoals.push(hg);
    awayGoals.push(ag);

    if (hg > ag) {
      homeWins++;
    } else if (hg === ag) {
      draws++;
    } else {
      awayWins++;
    }
  }

  const total =
    matches.length;

  return {
    matches: total,

    homeAvgScored:
      Number(
        avg(homeGoals).toFixed(3)
      ),

    homeAvgConceded:
      Number(
        avg(awayGoals).toFixed(3)
      ),

    awayAvgScored:
      Number(
        avg(awayGoals).toFixed(3)
      ),

    awayAvgConceded:
      Number(
        avg(homeGoals).toFixed(3)
      ),

    homeWinRate:
      total
        ? Number(
            (
              homeWins /
              total *
              100
            ).toFixed(1)
          )
        : 0,

    drawRate:
      total
        ? Number(
            (
              draws /
              total *
              100
            ).toFixed(1)
          )
        : 0,

    awayWinRate:
      total
        ? Number(
            (
              awayWins /
              total *
              100
            ).toFixed(1)
          )
        : 0
  };
}

/* =========================
   SCORES PROBABLES
========================= */

function getTopScores(scores) {

  return scores
    .sort(
      (a, b) =>
        b.probability -
        a.probability
    )
    .slice(0, 3)
    .map(s => ({
      score:
        `${s.home}-${s.away}`,

      probability:
        Number(
          (
            s.probability *
            100
          ).toFixed(1)
        )
    }));
}

/* =========================
   PRÉDICTION PRINCIPALE
========================= */

function predictMatch(
  homeName,
  awayName
) {

  const home =
    analyzeTeam(homeName);

  const away =
    analyzeTeam(awayName);

  if (
    !home.matches ||
    !away.matches
  ) {
    throw new Error(
      "Données insuffisantes pour une ou deux équipes."
    );
  }

  const expectedGoals =
    calculateExpectedGoals(
      home,
      away
    );

  const scores =
    buildScores(
      expectedGoals.home,
      expectedGoals.away
    );

  const markets =
    calculateMarkets(scores);

  const totalMatches =
    home.matches +
    away.matches;

  const dataQuality =
    clamp(
      Math.round(
        (
          totalMatches /
          40
        ) * 100
      ),
      0,
      100
    );

  const h2h =
    analyzeH2H(
      homeName,
      awayName
    );

  const bestBet =
    chooseBestBet(
      markets,
      home,
      away,
      h2h,
      expectedGoals,
      dataQuality
    );

  /* =========================
     VAINQUEUR PROBABLE
  ========================= */

  let winner =
    "Match nul";

  if (
    markets.homeWin >
      markets.draw &&
    markets.homeWin >
      markets.awayWin
  ) {

    winner =
      homeName;

  } else if (
    markets.awayWin >
      markets.homeWin &&
    markets.awayWin >
      markets.draw
  ) {

    winner =
      awayName;
  }

  const confidence =
    Math.round(
      Math.max(
        markets.homeWin,
        markets.draw,
        markets.awayWin
      )
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

    expectedGoals,

    predictions: {

      winner,

      dataQuality,

      homeWin:
        Number(
          markets.homeWin.toFixed(1)
        ),

      draw:
        Number(
          markets.draw.toFixed(1)
        ),

      awayWin:
        Number(
          markets.awayWin.toFixed(1)
        ),

      over15:
        Number(
          markets.over15.toFixed(1)
        ),

      over25:
        Number(
          markets.over25.toFixed(1)
        ),

      bttsYes:
        Number(
          markets.bttsYes.toFixed(1)
        ),

      confidence
    },

    /* =========================
       VERDICT UNIQUE
    ========================= */

    bestBet,

    topScores:
      getTopScores(scores)
  };
}

/* =========================
   EXPORT
========================= */

module.exports = {
  predictMatch
};
