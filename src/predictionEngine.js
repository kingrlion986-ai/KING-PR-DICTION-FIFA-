const {
  analyzeTeam,
  analyzeH2H
} = require("./teamAnalyzer");

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

function round(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function percentage(value) {
  return round(value * 100, 1);
}

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

/*
 * Mélange les statistiques générales
 * avec les confrontations directes.
 *
 * 80% forme/statistiques
 * 20% H2H
 */
function applyH2H(expectedGoals, h2h) {
  if (!h2h || h2h.matches === 0) {
    return expectedGoals;
  }

  let H2H_WEIGHT = 0;

  if (h2h.matches === 1) {
    H2H_WEIGHT = 0.05;
  } else if (h2h.matches === 2) {
    H2H_WEIGHT = 0.08;
  } else if (h2h.matches === 3) {
    H2H_WEIGHT = 0.12;
  } else if (h2h.matches === 4) {
    H2H_WEIGHT = 0.16;
  } else {
    H2H_WEIGHT = 0.20;
  }

  const GENERAL_WEIGHT =
    1 - H2H_WEIGHT;

  const homeXG =
    expectedGoals.homeXG * GENERAL_WEIGHT +
    h2h.homeAvgScored * H2H_WEIGHT;

  const awayXG =
    expectedGoals.awayXG * GENERAL_WEIGHT +
    h2h.awayAvgScored * H2H_WEIGHT;

  return {
    homeXG: Math.max(
      0.15,
      Math.min(4.5, homeXG)
    ),

    awayXG: Math.max(
      0.15,
      Math.min(4.5, awayXG)
    )
  };
}

function predictMatch(
  homeTeam,
  awayTeam
) {
  const homeStats =
    analyzeTeam(homeTeam);

  const awayStats =
    analyzeTeam(awayTeam);

  /*
   * Analyse des confrontations directes.
   */
  const h2h =
    analyzeH2H(
      homeTeam,
      awayTeam
    );

  const dataQuality =
    calculateDataQuality(
      homeStats.matches,
      awayStats.matches
    );

  /*
   * Calcul initial des buts attendus.
   */
  const baseExpectedGoals =
    calculateExpectedGoals(
      homeStats,
      awayStats
    );

  /*
   * Ajout de l'influence H2H.
   */
  const expectedGoals =
    applyH2H(
      baseExpectedGoals,
      h2h
    );

  const matrix =
    buildPoissonMatrix(
      expectedGoals.homeXG,
      expectedGoals.awayXG
    );

  const markets =
    calculateMarkets(matrix);

  const topScores =
    getTopScores(
      matrix,
      3
    );

  const winner =
    getWinner(markets);

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
        round(
          h2h.homeAvgScored,
          3
        ),

      homeAvgConceded:
        round(
          h2h.homeAvgConceded,
          3
        ),

      awayAvgScored:
        round(
          h2h.awayAvgScored,
          3
        ),

      awayAvgConceded:
        round(
          h2h.awayAvgConceded,
          3
        ),

      homeWinRate:
        percentage(
          h2h.homeWinRate
        ),

      drawRate:
        percentage(
          h2h.drawRate
        ),

      awayWinRate:
        percentage(
          h2h.awayWinRate
        )
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
        percentage(
          markets.homeWin
        ),

      draw:
        percentage(
          markets.draw
        ),

      awayWin:
        percentage(
          markets.awayWin
        ),

      over25:
        percentage(
          markets.over25
        ),

      under25:
        percentage(
          markets.under25
        ),

      bttsYes:
        percentage(
          markets.bttsYes
        ),

      bttsNo:
        percentage(
          markets.bttsNo
        ),

      confidence
    },

    topScores:
      topScores.map(
        score => ({
          score:
            `${score.homeGoals}-${score.awayGoals}`,

          probability:
            percentage(
              score.probability
            )
        })
      )
  };
}

module.exports = {
  predictMatch
};
