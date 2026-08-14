function factorial(n) {
  if (n <= 1) return 1;

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

function poissonProbability(lambda, goals) {
  if (lambda < 0 || goals < 0) return 0;

  return (
    Math.exp(-lambda) *
    Math.pow(lambda, goals) /
    factorial(goals)
  );
}

function buildGoalDistribution(expectedGoals, maxGoals = 7) {
  const distribution = [];

  for (let goals = 0; goals <= maxGoals; goals++) {
    distribution.push({
      goals,
      probability: poissonProbability(
        expectedGoals,
        goals
      )
    });
  }

  return distribution;
}

function buildPoissonMatrix(homeExpectedGoals, awayExpectedGoals) {
  const homeDistribution =
    buildGoalDistribution(homeExpectedGoals);

  const awayDistribution =
    buildGoalDistribution(awayExpectedGoals);

  const matrix = [];

  for (const home of homeDistribution) {
    for (const away of awayDistribution) {

      matrix.push({
        homeGoals: home.goals,
        awayGoals: away.goals,

        probability:
          home.probability *
          away.probability
      });

    }
  }

  return matrix;
}

function calculateMarkets(matrix) {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over25 = 0;
  let under25 = 0;

  let bttsYes = 0;
  let bttsNo = 0;

  for (const result of matrix) {
    const {
      homeGoals,
      awayGoals,
      probability
    } = result;

    // 1X2
    if (homeGoals > awayGoals) {
      homeWin += probability;
    } else if (homeGoals === awayGoals) {
      draw += probability;
    } else {
      awayWin += probability;
    }

    // Over / Under 2.5
    if (homeGoals + awayGoals > 2) {
      over25 += probability;
    } else {
      under25 += probability;
    }

    // BTTS
    if (homeGoals > 0 && awayGoals > 0) {
      bttsYes += probability;
    } else {
      bttsNo += probability;
    }
  }

  return {
    homeWin,
    draw,
    awayWin,

    over25,
    under25,

    bttsYes,
    bttsNo
  };
}

function getTopScores(matrix, limit = 3) {
  return [...matrix]
    .sort(
      (a, b) =>
        b.probability - a.probability
    )
    .slice(0, limit);
}

module.exports = {
  factorial,
  poissonProbability,
  buildGoalDistribution,
  buildPoissonMatrix,
  calculateMarkets,
  getTopScores
};
