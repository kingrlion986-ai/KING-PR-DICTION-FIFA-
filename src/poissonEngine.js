function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poisson(lambda, k) {
  return Math.exp(-lambda) *
    Math.pow(lambda, k) /
    factorial(k);
}

function buildPoissonMatrix(homeXG, awayXG, max = 8) {
  const matrix = [];

  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
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
    (s, x) => s + x.probability,
    0
  );

  return matrix.map(x => ({
    ...x,
    probability: x.probability / total
  }));
}

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
    const { homeGoals: h, awayGoals: a, probability: p } = x;

    if (h > a) r.homeWin += p;
    else if (h === a) r.draw += p;
    else r.awayWin += p;

    if (h + a > 2) r.over25 += p;
    else r.under25 += p;

    if (h > 0 && a > 0) r.bttsYes += p;
    else r.bttsNo += p;
  }

  return r;
}

function getTopScores(matrix, limit = 3) {
  return [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}

module.exports = {
  poisson,
  buildPoissonMatrix,
  calculateMarkets,
  getTopScores
};
