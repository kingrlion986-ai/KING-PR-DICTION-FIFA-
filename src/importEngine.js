const fs = require("fs");
const path = require("path");

const IMPORT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "import.json"
);

const DATA_FILE = path.join(
  __dirname,
  "..",
  "data",
  "matches.json"
);

function importMatches() {
  const source = JSON.parse(
    fs.readFileSync(IMPORT_FILE, "utf8")
  );

  const target = JSON.parse(
    fs.readFileSync(DATA_FILE, "utf8")
  );

  const existing = target.matches || [];

  for (const match of source.matches || []) {
    const exists = existing.some(
      m =>
        m.home === match.home &&
        m.away === match.away &&
        m.date === match.date
    );

    if (!exists) {
      existing.push(match);
    }
  }

  target.matches = existing;

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(target, null, 2)
  );

  return existing.length;
}

module.exports = {
  importMatches
};
