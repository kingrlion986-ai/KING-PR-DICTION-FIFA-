const { getMatches } = require("./dataEngine");
const { predictMatch } = require("./predictionEngine");

function validatePredictions() {
  const matches = getMatches();

  let tested = 0;
  let winnerCorrect = 0;
  let scoreCorrect = 0;

  for (const match of matches) {
    const prediction = predictMatch(
      match.home,
      match.away
    );

    const actualWinner =
      match.homeGoals > match.awayGoals
        ? match.home
        : match.awayGoals > match.homeGoals
        ? match.away
        : "DRAW";

    if (prediction.predictions.winner === actualWinner) {
      winnerCorrect++;
    }

    const predictedScore =
      prediction.topScores[0]?.score;

    const actualScore =
      `${match.homeGoals}-${match.awayGoals}`;

    if (predictedScore === actualScore) {
      scoreCorrect++;
    }

    tested++;
  }

  return {
    tested,
    winnerAccuracy:
      tested
        ? Number(
            ((winnerCorrect / tested) * 100).toFixed(1)
          )
        : 0,
    exactScoreAccuracy:
      tested
        ? Number(
            ((scoreCorrect / tested) * 100).toFixed(1)
          )
        : 0
  };
}

module.exports = {
  validatePredictions
};
