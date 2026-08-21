const { addMatch } = require("./src/dataEngine");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n⚽ IMPORT FIFA VIRTUAL");
console.log("Colle tes résultats, un par ligne.");
console.log("Format : Chelsea 2-1 Leeds United");
console.log("Tape FIN pour terminer.\n");

const lines = [];

rl.on("line", line => {
  line = line.trim();

  if (!line) return;

  if (line.toUpperCase() === "FIN") {
    importer();
    rl.close();
    return;
  }

  lines.push(line);
});

function importer() {
  let added = 0;
  let invalid = 0;

  for (const line of lines) {
    const match = line.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/);

    if (!match) {
      console.log(`❌ Format incorrect : ${line}`);
      invalid++;
      continue;
    }

    const [, home, homeGoals, awayGoals, away] = match;

    try {
      const result = addMatch({
        home,
        away,
        homeGoals: Number(homeGoals),
        awayGoals: Number(awayGoals),
        competition: "FIFA FC 26. England Championship",
        source: "FIFA_VIRTUAL"
      });

      if (result.duplicate) {
        console.log(`⚠️ Déjà présent : ${line}`);
      } else {
        console.log(`✅ Ajouté : ${line}`);
        added++;
      }
    } catch (error) {
      console.log(`❌ Erreur : ${line}`);
      invalid++;
    }
  }

  console.log("\n📊 IMPORT TERMINÉ");
  console.log(`✅ Ajoutés : ${added}`);
  console.log(`❌ Invalides : ${invalid}`);
}
