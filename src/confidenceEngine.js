function calculateConfidence(
  homeWin,
  draw,
  awayWin,
  dataQuality
) {
  const values = [homeWin, draw, awayWin]
    .sort((a, b) => b - a);

  const gap = values[0] - values[1];

  return Math.round(
    Math.max(
      30,
      Math.min(
        90,
        35 + gap * 100 + dataQuality * 0.2
      )
    )
  );
}

module.exports = {
  calculateConfidence
};
