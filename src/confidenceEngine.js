function calculateConfidence(homeWin, draw, awayWin, dataQuality = 0) {
  const values = [
    Number(homeWin),
    Number(draw),
    Number(awayWin)
  ].sort((a, b) => b - a);

  if (values.some(v => !Number.isFinite(v))) {
    return 30;
  }

  const quality = Number(dataQuality) || 0;
  const gap = values[0] - values[1];

  return Math.round(
    Math.max(
      30,
      Math.min(90, 35 + gap * 100 + quality * 0.2)
    )
  );
}

module.exports = {
  calculateConfidence
};
