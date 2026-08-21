const { addMatches } = require("./src/dataEngine");

const matches = [
  {
    date: "2026-08-21T10:30:00",
    home: "Brentford",
    away: "Crystal Palace",
    homeGoals: 2,
    awayGoals: 1,
    competition: "FIFA FC 26. England Championship",
    source: "FIFA_VIRTUAL"
  },

  {
    date: "2026-08-21T09:50:00",
    home: "Chelsea",
    away: "Leeds United",
    homeGoals: 1,
    awayGoals: 2,
    competition: "FIFA FC 26. England Championship",
    source: "FIFA_VIRTUAL"
  }

  // Ajoute ici les nouveaux matchs
];

try {
  const result = addMatches(matches);

  console.log("================================");
  console.log("   IMPORT FIFA VIRTUAL");
  console.log("================================");
  console.log(`Total     : ${result.total}`);
  console.log(`Ajoutés   : ${result.added}`);
  console.log(`Doublons  : ${result.duplicates}`);
  console.log(`Invalides : ${result.invalid}`);
  console.log("================================");
} catch (error) {
  console.error("Erreur :", error.message);
}
