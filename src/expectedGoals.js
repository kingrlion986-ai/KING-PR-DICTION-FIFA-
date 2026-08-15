function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function calculateExpectedGoals(home, away) {
  const homeAttack =
    home.homeAvgScored || home.avgScored || 0;

  const homeDefense =
    home.homeAvgConceded || home.avgConceded || 0;

  const awayAttack =
    away.awayAvgScored || away.avgScored || 0;

  const awayDefense =
    away.awayAvgConceded || away.avgConceded || 0;

  let homeXG =
    homeAttack * 0.55 +
    awayDefense * 0.45;

  let awayXG =
    awayAttack * 0.55 +
    homeDefense * 0.45;

  // Avantage domicile léger
  homeXG *= 1.08;

  // Forme récente
  homeXG *= 1 + (home.form - 1) * 0.08;
  awayXG *= 1 + (away.form - 1) * 0.08;

  return {
    homeXG: clamp(homeXG, 0.15, 4.5),
    awayXG: clamp(awayXG, 0.15, 4.5)
  };
}

module.exports = {
  calculateExpectedGoals
};
