const express = require("express");
const path = require("path");

const { predictMatch } = require("./src/predictionEngine");

const {
addMatches,
getDataStats
} = require("./src/dataEngine");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(
path.join(__dirname, "public")
));

// ==========================================
// PAGE PRINCIPALE
// ==========================================

app.get("/", (req, res) => {
res.sendFile(
path.join(__dirname, "public", "index.html")
);
});

// ==========================================
// PAGE ADMIN
// ==========================================

app.get("/admin", (req, res) => {
res.sendFile(
path.join(__dirname, "public", "admin.html")
);
});

// Permet aussi d'ouvrir directement /admin.html
app.get("/admin.html", (req, res) => {
res.sendFile(
path.join(__dirname, "public", "admin.html")
);
});

// ==========================================
// STATUS
// ==========================================

app.get("/api/status", (req, res) => {
res.json({
success: true,
project: "ROI PREDICTION FIFA",
version: "1.0.0",
status: "online",
message: "FIFA Virtual AI is running"
});
});

// ==========================================
// PRÉDICTION
// ==========================================

app.get("/api/predict", (req, res) => {
try {
const home = String(
req.query.home || ""
).trim();

const away = String(
  req.query.away || ""
).trim();

if (!home || !away) {
  return res.status(400).json({
    success: false,
    message: "Les deux équipes sont obligatoires."
  });
}

if (
  home.toLowerCase() ===
  away.toLowerCase()
) {
  return res.status(400).json({
    success: false,
    message: "Les deux équipes doivent être différentes."
  });
}

const prediction =
  predictMatch(home, away);

res.json({
  success: true,
  prediction
});

} catch (error) {
console.error(
"Erreur prédiction :",
error
);

res.status(500).json({
  success: false,
  message: "Erreur interne pendant la prédiction."
});

}
});

// ==========================================
// IMPORT ADMIN
//
// Format :
//
// Chelsea 2-1 Leeds United | 2026-08-15 | 20:30
// Brentford 1-3 Chelsea | 2026-08-15 | 19:50
//
// ==========================================

app.post("/api/matches", (req, res) => {
try {
const text =
String(req.body.text || "").trim();

if (!text) {
  return res.status(400).json({
    success: false,
    message: "Aucun match fourni."
  });
}

const lines = text
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const matches = [];
let invalid = 0;

for (const line of lines) {

  const parts =
    line.split("|").map(
      value => value.trim()
    );

  if (parts.length < 3) {
    invalid++;
    continue;
  }

  const match =
    parts[0].match(
      /^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/
    );

  if (!match) {
    invalid++;
    continue;
  }

  const home =
    match[1].trim();

  const homeGoals =
    Number(match[2]);

  const awayGoals =
    Number(match[3]);

  const away =
    match[4].trim();

  const date =
    parseDate(
      parts[1],
      parts[2]
    );

  if (!date) {
    invalid++;
    continue;
  }

  matches.push({
    home,
    away,
    homeGoals,
    awayGoals,
    date,
    competition:
      "FIFA FC 26. England Championship",
    source:
      "FIFA_VIRTUAL"
  });
}

if (!matches.length) {
  return res.status(400).json({
    success: false,
    message: "Aucun match valide trouvé.",
    added: 0,
    duplicates: 0,
    invalid
  });
}

const result =
  addMatches(matches);

res.json({
  success: true,
  added: result.added || 0,
  duplicates: result.duplicates || 0,
  invalid:
    invalid + (result.invalid || 0),
  total: lines.length
});

} catch (error) {

console.error(
  "Erreur import :",
  error
);

res.status(500).json({
  success: false,
  message: error.message
});

}
});

// ==========================================
// STATISTIQUES DES DONNÉES
// ==========================================

app.get("/api/data/stats", (req, res) => {
try {

const stats =
  getDataStats();

res.json({
  success: true,
  stats
});

} catch (error) {

console.error(
  "Erreur statistiques :",
  error
);

res.status(500).json({
  success: false,
  message:
    "Impossible de récupérer les statistiques."
});

}
});

// ==========================================
// DATE + HEURE
//
// 2026-08-15 | 20:30
// ↓
// ISO
// ==========================================

function parseDate(
dateValue,
timeValue
) {

const dateMatch =
String(dateValue || "").match(
/^(\d{4})-(\d{2})-(\d{2})$/
);

const timeMatch =
String(timeValue || "").match(
/^(\d{1,2}):(\d{2})$/
);

if (!dateMatch || !timeMatch) {
return null;
}

const year =
Number(dateMatch[1]);

const month =
Number(dateMatch[2]);

const day =
Number(dateMatch[3]);

const hour =
Number(timeMatch[1]);

const minute =
Number(timeMatch[2]);

if (
month < 1 ||
month > 12 ||
day < 1 ||
day > 31 ||
hour < 0 ||
hour > 23 ||
minute < 0 ||
minute > 59
) {
return null;
}

const date =
new Date(
year,
month - 1,
day,
hour,
minute,
0
);

if (
date.getFullYear() !== year ||
date.getMonth() !== month - 1 ||
date.getDate() !== day ||
date.getHours() !== hour ||
date.getMinutes() !== minute
) {
return null;
}

return date.toISOString();
}

// ==========================================
// 404 API
// ==========================================

app.use("/api", (req, res) => {
res.status(404).json({
success: false,
message: "Route API introuvable."
});
});

// ==========================================
// SERVEUR
// ==========================================

app.listen(
PORT,
"0.0.0.0",
() => {
console.log(
"ROI Prediction FIFA running on port ${PORT}"
);
}
);
