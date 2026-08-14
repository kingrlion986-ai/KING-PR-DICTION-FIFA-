function calculateConfidence(homeWin, draw, awayWin) {
  const values = [homeWin, draw, awayWin]
    .sort((a, b) => b - a);

  const separation = values[0] - values[1];

  return Math.min(
    95,
    Math.max(
      30,
      Math.round(50 + separation * 100)
    )
  );
}

module.exports = {
  calculateConfidence
};
