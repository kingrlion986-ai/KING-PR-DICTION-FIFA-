const { analyzeTeam } = require("./teamAnalyzer");
const {
  getHeadToHead
} = require("./dataEngine");

const {
  buildPoissonMatrix,
  getTopScores
} = require("./poissonEngine");

const {
  calculateExpectedGoals
} = require("./expectedGoals");

const {
  calculateConfidence
} = require("./confidenceEngine");

const {
  calculateDataQuality
} = require("./qualityEngine");


function round(value, decimals = 2) {
  return Number(Number(value || 0).toFixed(decimals));
}


/*
 * Signal de solidité de l'analyse.
 *
 * Ce signal indique uniquement la qualité/convergence
 * des données utilisées par le modèle.
 */
function getSignal(confidence, dataQuality) {

  if (
    dataQuality < 50 ||
    confidence < 45
  ) {
    return {
      level: "FAIBLE",
      color: "red",
      icon: "🔴"
    };
  }

  if (
    dataQuality >= 80 &&
    confidence >= 65
  ) {
    return {
      level: "FORT",
      color: "green",
      icon: "🟢"
    };
  }

  return {
    level: "MOYEN",
    color: "orange",
    icon: "🟠"
  };
}


/*
 * Calcule le résultat principal.
 *
 * Important :
 * on conserve les calculs existants et on ajoute
 * seulement le système de signal.
 */
function predictMatch(homeTeam, awayTeam) {

  if (!homeTeam || !awayTeam) {
    throw new Error(
      "Les deux équipes sont obligatoires."
    );
  }

  const home =
    String(homeTeam).trim();

  const away =
    String(awayTeam).trim();


  if (!home || !away) {
    throw new Error(
      "Les noms des équipes sont invalides."
    );
  }


  if (
    home.toLowerCase() ===
    away.toLowerCase()
  ) {
    throw new Error(
      "Les deux équipes doivent être différentes."
    );
  }


  /*
   * Analyse des équipes
   */

  const homeStats =
    analyzeTeam(home);

  const awayStats =
    analyzeTeam(away);


  if (!homeStats || !awayStats) {
    throw new Error(
      "Impossible d'analyser les équipes."
    );
  }


  /*
   * H2H
   */

  const h2hMatches =
    getHeadToHead(home, away) || [];


  /*
   * Qualité des données
   */

  const dataQuality =
    calculateDataQuality(
      homeStats.matches || 0,
      awayStats.matches || 0
    );


  /*
   * Buts attendus
   */

  const expectedGoals =
    calculateExpectedGoals(
      homeStats,
      awayStats
    );


  const homeXG =
    round(expectedGoals.home);

  const awayXG =
    round(expectedGoals.away);


  /*
   * Matrice de Poisson
   */

  const matrix =
    buildPoissonMatrix(
      homeXG,
      awayXG
    );


  /*
   * Scores les plus probables
   */

  const topScores =
    getTopScores(matrix, 3);


  /*
   * Probabilités 1X2
   *
   * On calcule directement depuis la matrice
   * afin de garder une logique simple.
   */

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;


  for (let h = 0; h < matrix.length; h++) {

    for (let a = 0; a < matrix[h].length; a++) {

      const probability =
        Number(matrix[h][a]) || 0;


      if (h > a) {
        homeWin += probability;
      }

      else if (h === a) {
        draw += probability;
      }

      else {
        awayWin += probability;
      }
    }
  }


  /*
   * Conversion en pourcentage
   */

  homeWin =
    round(homeWin * 100, 1);

  draw =
    round(draw * 100, 1);

  awayWin =
    round(awayWin * 100, 1);


  /*
   * Normalisation
   */

  const total =
    homeWin +
    draw +
    awayWin;


  if (total > 0) {

    homeWin =
      round(homeWin / total * 100, 1);

    draw =
      round(draw / total * 100, 1);

    awayWin =
      round(
        100 - homeWin - draw,
        1
      );
  }


  /*
   * Détermination de la tendance principale
   */

  let winner;

  if (
    homeWin >= draw &&
    homeWin >= awayWin
  ) {
    winner = home;
  }

  else if (
    awayWin >= homeWin &&
    awayWin >= draw
  ) {
    winner = away;
  }

  else {
    winner = "Match nul";
  }


  /*
   * Confiance
   */

  const confidence =
    calculateConfidence(
      homeWin / 100,
      draw / 100,
      awayWin / 100
    );


  /*
   * Signal
   */

  const signal =
    getSignal(
      confidence,
      dataQuality
    );


  /*
   * H2H simplifié
   */

  let h2h = {
    matches: 0,
    homeWinRate: 0,
    drawRate: 0,
    awayWinRate: 0
  };


  if (h2hMatches.length > 0) {

    let hw = 0;
    let dr = 0;
    let aw = 0;


    for (const match of h2hMatches) {

      const hg =
        Number(match.homeGoals);

      const ag =
        Number(match.awayGoals);


      if (
        !Number.isFinite(hg) ||
        !Number.isFinite(ag)
      ) {
        continue;
      }


      if (hg > ag) {
        hw++;
      }

      else if (hg === ag) {
        dr++;
      }

      else {
        aw++;
      }
    }


    const count =
      hw + dr + aw;


    if (count > 0) {

      h2h = {
        matches: count,

        homeWinRate:
          round(hw / count * 100, 1),

        drawRate:
          round(dr / count * 100, 1),

        awayWinRate:
          round(aw / count * 100, 1)
      };
    }
  }


  /*
   * Résultat final
   */

  return {

    match: {
      home,
      away
    },


    teams: {
      home: homeStats,
      away: awayStats
    },


    h2h,


    expectedGoals: {
      home: homeXG,
      away: awayXG
    },


    predictions: {

      /*
       * Tendance principale
       */
      winner,

      /*
       * Probabilités conservées pour
       * le fonctionnement interne/API.
       */
      homeWin,
      draw,
      awayWin,

      /*
       * Qualité
       */
      dataQuality,

      /*
       * Confiance
       */
      confidence,

      /*
       * Nouveau signal
       */
      signal: signal.level,
      signalColor: signal.color,
      signalIcon: signal.icon
    },


    /*
     * Conservé pour l'analyse,
     * mais l'interface ne l'affiche plus.
     */
    topScores
  };
}


module.exports = {
  predictMatch,
  getSignal
};
