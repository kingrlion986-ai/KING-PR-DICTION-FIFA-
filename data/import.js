const fs = require("fs");
const path = require("path");

const { addMatches } = require("./dataEngine");

const IMPORT_FILE = path.join(
  __dirname,
  "data",
  "import.json"
);

function main() {
  if (!fs.existsSync(IMPORT_FILE)) {
    console.error(
      "❌ Fichier data/import.json introuvable."
    );
    process.exit(1);
  }

  let matches;

  try {
    matches = JSON.parse(
      fs.readFileSync(
        IMPORT_FILE,
        "utf8"
      )
    );
  } catch (error) {
    console.error(
      "❌ import.json contient un JSON invalide."
    );

    console.error(error.message);
    process.exit(1);
  }

  if (!Array.isArray(matches)) {
    console.error(
      "❌ import.json doit contenir un tableau de matchs."
    );
    process.exit(1);
  }

  const result = addMatches(matches);

  console.log(
    "================================"
  );

  console.log(
    "⚽ ROI PREDICTION FIFA"
  );

  console.log(
    "📥 IMPORT TERMINÉ"
  );

  console.log(
    "================================"
  );

  console.log(
    `✅ Ajoutés     : ${result.added}`
  );

  console.log(
    `♻️ Doublons    : ${result.duplicates}`
  );

  console.log(
    `❌ Invalides   : ${result.invalid}`
  );

  console.log(
    `📊 Total traité: ${result.total}`
  );

  console.log(
    "================================"
  );
}

main();
