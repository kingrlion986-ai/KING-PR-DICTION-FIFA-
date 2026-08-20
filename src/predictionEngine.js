const { analyzeTeam } = require("./teamAnalyzer");

const {
  buildPoissonMatrix,
  calculateMarkets,
  getTopScores
} = require("./poissonEngine");

const {
  calculateExpectedGoals
} = require("./expectedGoals");

const {
  calculateConfidence
} = require("./confidenceEngine");

const {
  calculateDataQuality
} = require("./qualityEngine");

const {
  getHeadToHead
} = require("./dataEngine");


function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}


function percentage(value) {
  return round(value * 100, 1);
}


/**
 * Retourne le vainqueur selon les probabilités.
 */
function getWinner(markets) {
  const options = [
    {
      type: "HOME",
      probability: markets.homeWin
    },
    {
      type: "DRAW",
      probability: markets.draw
    },
    {
      type: "AWAY",
      probability: markets.awayWin
    }
  ];

  return options.sort(
    (a, b) => b.probability - a.probability
  )[0];
}


/**
 * Analyse les confrontations directes.
 *
 * Le H2H est volontairement limité à 10 %
 * de l'influence finale.
 */
function analyzeH2H(homeTeam, awayTeam) {

  const matches = getHeadToHead(
    homeTeam,
    awayTeam
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

  let homeScored = 0;
  let homeConceded = 0;

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (const match of matches) {

    const isHome =
      match.home === homeTeam;

    const homeGoals = Number(
      isHome
        ? match.homeGoals
        : match.awayGoals
    );

    const awayGoals = Number(
      isHome
        ? match.awayGoals
        : match.homeGoals
    );

    homeScored += homeGoals;
    homeConceded += awayGoals;

    if (homeGoals > awayGoals) {
      homeWins++;
    } else if (homeGoals === awayGoals) {
      draws++;
    } else {
      awayWins++;
    }
  }

  return {
    matches: matches.length,

    homeAvgScored:
      homeScored / matches.length,

    homeAvgConceded:
      homeConceded / matches.length,

    awayAvgScored:
      homeConceded / matches.length,

    awayAvgConceded:
      homeScored / matches.length,

    homeWinRate:
      homeWins / matches.length,

    drawRate:
      draws / matches.length,

    awayWinRate:
      awayWins / matches.length
  };
}


/**
 * Mélange les probabilités générales
 * avec le H2H.
 *
 * Poids :
 * - statistiques générales : 30 %
 * - forme/récence : 60 %
 * - H2H : 10 %
 */
function applyH2HWeight(
  baseMarkets,
  h2h
) {

  if (!h2h.matches) {
    return baseMarkets;
  }

  const H2H_WEIGHT = 0.10;
  const BASE_WEIGHT = 0.90;

  const home =
    baseMarkets.homeWin * BASE_WEIGHT +
    h2h.homeWinRate * H2H_WEIGHT;

  const draw =
    baseMarkets.draw * BASE_WEIGHT +
    h2h.drawRate * H2H_WEIGHT;

  const away =
    baseMarkets.awayWin * BASE_WEIGHT +
    h2h.awayWinRate * H2H_WEIGHT;

  const total =
    home + draw + away;

  return {
    ...baseMarkets,

    homeWin: home / total,
    draw: draw / total,
    awayWin: away / total
  };
}


/**
 * Ajuste légèrement les expected goals
 * avec le H2H sans lui permettre de dominer.
 */
function applyH2HToExpectedGoals(
  expectedGoals,
  h2h
) {

  if (!h2h.matches) {
    return expectedGoals;
  }

  const H2H_WEIGHT = 0.10;

  const homeH2H =
    h2h.homeAvgScored;

  const awayH2H =
    h2h.awayAvgScored;

  const home =
    expectedGoals.homeXG * (1 - H2H_WEIGHT) +
    homeH2H * H2H_WEIGHT;

  const away =
    expectedGoals.awayXG * (1 - H2H_WEIGHT) +
    awayH2H * H2H_WEIGHT;

  return {
    homeXG: Math.max(
      0.15,
      Math.min(4.5, home)
    ),

    awayXG: Math.max(
      0.15,
      Math.min(4.5, away)
    )
  };
}


/**
 * Prédiction principale.
 */
function predictMatch(
  homeTeam,
  awayTeam
) {

  const homeStats =
    analyzeTeam(homeTeam);

  const awayStats =
    analyzeTeam(awayTeam);


  /**
   * Qualité des données.
   */
  const dataQuality =
    calculateDataQuality(
      homeStats.matches,
      awayStats.matches
    );


  /**
   * H2H.
   */
  const h2h =
    analyzeH2H(
      homeTeam,
      awayTeam
    );


  /**
   * Expected goals de base.
   */
  const baseExpectedGoals =
    calculateExpectedGoals(
      homeStats,
      awayStats
    );


  /**
   * Petit ajustement H2H.
   * Maximum 10 %.
   */
  const expectedGoals =
    applyH2HToExpectedGoals(
      baseExpectedGoals,
      h2h
    );


  /**
   * Matrice de Poisson.
   */
  const matrix =
    buildPoissonMatrix(
      expectedGoals.homeXG,
      expectedGoals.awayXG
    );


  /**
   * Marchés de base.
   */
  const baseMarkets =
    calculateMarkets(matrix);


  /**
   * Intégration H2H.
   * Le H2H ne peut représenter
   * que 10 % du résultat final.
   */
  const markets =
    applyH2HWeight(
      baseMarkets,
      h2h
    );


  /**
   * Meilleurs scores.
   */
  const topScores =
    getTopScores(
      matrix,
      3
    );


  /**
   * Vainqueur.
   */
  const winner =
    getWinner(markets);


  /**
   * Confiance.
   */
  const confidence =
    calculateConfidence(
      markets.homeWin,
      markets.draw,
      markets.awayWin,
      dataQuality
    );


  let prediction;

  if (winner.type === "HOME") {
    prediction = homeTeam;

  } else if (winner.type === "AWAY") {
    prediction = awayTeam;

  } else {
    prediction = "DRAW";
  }


  return {

    match: {
      home: homeTeam,
      away: awayTeam
    },


    teams: {
      home: homeStats,
      away: awayStats
    },


    h2h: {

      matches: h2h.matches,

      homeAvgScored:
        round(h2h.homeAvgScored, 3),

      homeAvgConceded:
        round(h2h.homeAvgConceded, 3),

      awayAvgScored:
        round(h2h.awayAvgScored, 3),

      awayAvgConceded:
        round(h2h.awayAvgConceded, 3),

      homeWinRate:
        percentage(h2h.homeWinRate),

      drawRate:
        percentage(h2h.drawRate),

      awayWinRate:
        percentage(h2h.awayWinRate)
    },


    expectedGoals: {

      home:
        round(
          expectedGoals.homeXG,
          3
        ),

      away:
        round(
          expectedGoals.awayXG,
          3
        )
    },


    predictions: {

      winner: prediction,

      dataQuality,

      homeWin:
        percentage(markets.homeWin),

      draw:
        percentage(markets.draw),

      awayWin:
        percentage(markets.awayWin),

      over25:
        percentage(markets.over25),

      under25:
        percentage(markets.under25),

      bttsYes:
        percentage(markets.bttsYes),

      bttsNo:
        percentage(markets.bttsNo),

      confidence
    },


    topScores:
      topScores.map(score => ({

        score:
          `${score.homeGoals}-${score.awayGoals}`,

        probability:
          percentage(
            score.probability
          )
      }))
  };
}


module.exports = {
  predictMatch
};
