function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateExpectedGoals(homeStats, awayStats) {
  const homeAttack =
    homeStats.avgScored || 0;

  const homeDefense =
    homeStats.avgConceded || 0;

  const awayAttack =
    awayStats.avgScored || 0;

  const awayDefense =
    awayStats.avgConceded || 0;

  /*
   * Première estimation.
   *
   * L'idée est de combiner :
   * - la capacité offensive de l'équipe
   * - la faiblesse défensive adverse
   */

  let homeXG =
    (homeAttack * 0.60) +
    (awayDefense * 0.40);

  let awayXG =
    (awayAttack * 0.60) +
    (homeDefense * 0.40);

  /*
   * Petit avantage domicile.
   */

  homeXG *= 1.08;

  /*
   * Empêche les valeurs extrêmes
   * avec peu de données.
   */

  homeXG = clamp(homeXG, 0.15, 4.5);
  awayXG = clamp(awayXG, 0.15, 4.5);

  return {
    homeXG,
    awayXG
  };
}

module.exports = {
  calculateExpectedGoals
};
