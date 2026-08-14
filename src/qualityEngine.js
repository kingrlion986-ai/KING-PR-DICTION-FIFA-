function calculateDataQuality(homeMatches, awayMatches) {
  const total = homeMatches + awayMatches;

  if (total === 0) return 0;

  return Math.min(
    100,
    Math.round((total / 20) * 100)
  );
}

module.exports = {
  calculateDataQuality
};
