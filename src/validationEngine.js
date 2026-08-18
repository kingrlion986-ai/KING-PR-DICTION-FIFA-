const fs = require("fs");
const path = require("path");
const { predictMatch } = require("./predictionEngine");

const DATA_FILE = path.join(
  __dirname,
  "..",
  "data",
  "matches.json"
);

function validatePredictions() {
  const data = JSON.parse(
    fs.readFileSync(DATA_FILE, "utf8")
  );

  const matches = [...(data.matches || [])]
    .sort(
      (a, b) =>
        new Date(a.date) - new Date(b.date)
    );

  let tested = 0;
  let winnerCorrect = 0;
  let scoreCorrect = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    // Pas assez d'historique
    if (i < 2) continue;

    // Temporairement retirer le match futur
    const backup = data.matches;
    data.matches = matches.slice(0, i);

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );

    try {
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

      if (
        prediction.predictions.winner ===
        actualWinner
      ) {
        winnerCorrect++;
      }

      if (
        prediction.topScores[0]?.score ===
        `${match.homeGoals}-${match.awayGoals}`
      ) {
        scoreCorrect++;
      }

      tested++;
    } finally {
      data.matches = backup;

      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
      );
    }
  }

  return {
    tested,
    winnerAccuracy: tested
      ? Number(
          ((winnerCorrect / tested) * 100).toFixed(1)
        )
      : 0,
    exactScoreAccuracy: tested
      ? Number(
          ((scoreCorrect / tested) * 100).toFixed(1)
        )
      : 0
  };
}

module.exports = {
  validatePredictions
};
