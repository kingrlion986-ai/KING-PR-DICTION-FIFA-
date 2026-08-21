const { addMatches } = require("./src/dataEngine");

// =====================================================
// AJOUTE TES NOUVEAUX MATCHS ICI
// =====================================================

const matches = [
  {
    date: "2026-08-15T20:10:00",
    home: "Chelsea",
    away: "Leeds United",
    homeGoals: 2,
    awayGoals: 1,
    competition: "FIFA FC 26. England Championship",
    source: "FIFA_VIRTUAL"
  },

  // Ajoute les prochains matchs ici :
  //
  // {
  //   date: "2026-08-15T21:30:00",
  //   home: "Brentford",
  //   away: "Crystal Palace",
  //   homeGoals: 1,
  //   awayGoals: 2,
  //   competition: "FIFA FC 26. England Championship",
  //   source: "FIFA_VIRTUAL"
  // }
];

// =====================================================
// IMPORT AUTOMATIQUE
// =====================================================

try {
  const result = addMatches(matches);

  console.log("\n=================================");
  console.log("⚽ ROI PREDICTION FIFA");
  console.log("=================================");
  console.log(`✅ Ajoutés      : ${result.added}`);
  console.log(`♻️ Doublons     : ${result.duplicates}`);
  console.log(`❌ Invalides    : ${result.invalid}`);
  console.log(`📊 Total traité : ${result.total}`);
  console.log("=================================\n");

} catch (error) {
  console.error("❌ Erreur :", error.message);
}
