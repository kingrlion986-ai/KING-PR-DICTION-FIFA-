function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function calculateExpectedGoals(home, away) {
  const homeAttack =
    home.homeAvgScored || home.avgScored;

  const homeDefense =
    home.homeAvgConceded || home.avgConceded;

  const awayAttack =
    away.awayAvgScored || away.avgScored;

  const awayDefense =
    away.awayAvgConceded || away.avgConceded;

  let homeXG =
    homeAttack * 0.6 +
    awayDefense * 0.4;

  let awayXG =
    awayAttack * 0.6 +
    homeDefense * 0.4;

  homeXG *= 1.05;

  return {
    homeXG: clamp(homeXG, 0.15, 4),
    awayXG: clamp(awayXG, 0.15, 4)
  };
}

module.exports = { calculateExpectedGoals };
