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

function predictMatch(homeTeam, awayTeam) {
  const homeStats = analyzeTeam(homeTeam);
  const awayStats = analyzeTeam(awayTeam);

  const dataQuality =
  calculateDataQuality(
    homeStats.matches,
    awayStats.matches
  );

  const expectedGoals =
    calculateExpectedGoals(
      homeStats,
      awayStats
    );

  const matrix =
    buildPoissonMatrix(
      expectedGoals.homeXG,
      expectedGoals.awayXG
    );

  const markets =
    calculateMarkets(matrix);

  const topScores =
    getTopScores(matrix, 3);

  const winner =
    getWinner(markets);

  const confidence =
  calculateConfidence(
    markets.homeWin,
    markets.draw,
    markets.awayWin
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

    expectedGoals: {
      home: round(expectedGoals.homeXG, 3),
      away: round(expectedGoals.awayXG, 3)
    },

    predictions: {
      winner: prediction,
      dataQuality,

      homeWin: percentage(markets.homeWin),
      draw: percentage(markets.draw),
      awayWin: percentage(markets.awayWin),

      over25: percentage(markets.over25),
      under25: percentage(markets.under25),

      bttsYes: percentage(markets.bttsYes),
      bttsNo: percentage(markets.bttsNo),

      confidence
    },

    topScores: topScores.map(score => ({
      score:
        `${score.homeGoals}-${score.awayGoals}`,

      probability:
        percentage(score.probability)
    }))
  };
}

module.exports = {
  predictMatch
};
