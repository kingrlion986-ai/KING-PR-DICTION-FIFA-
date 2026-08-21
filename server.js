const express = require("express");
const path = require("path");

const { predictMatch } = require("./predictionEngine");
const {
  addMatch,
  getDataStats
} = require("./src/dataEngine")

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
        message:
          "Les deux équipes sont obligatoires."
      });
    }

    if (
      home.toLowerCase() ===
      away.toLowerCase()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Les deux équipes doivent être différentes."
      });
    }

    const prediction =
      predictMatch(home, away);

    return res.json({
      success: true,
      prediction
    });

  } catch (error) {

    console.error(
      "Erreur prédiction :",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Erreur interne pendant la prédiction."
    });
  }
});

// ==========================================
// IMPORT ADMIN
//
// Format accepté :
//
// Chelsea 2-1 Leeds United | 21/08/2026 18:30
// Brentford 1-3 Crystal Palace | 21/08/2026 18:50
//
// ==========================================

app.post(
  "/api/admin/import",
  (req, res) => {

    try {

      const text =
        typeof req.body.text === "string"
          ? req.body.text.trim()
          : "";

      if (!text) {
        return res.status(400).json({
          success: false,
          message:
            "Aucun match fourni."
        });
      }

      const lines =
        text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean);

      let added = 0;
      let duplicates = 0;
      let invalid = 0;

      for (const line of lines) {

        /*
         * Sépare :
         *
         * Chelsea 2-1 Leeds United
         *
         * et :
         *
         * 21/08/2026 18:30
         */

        const parts =
          line.split("|");

        const matchPart =
          parts[0].trim();

        const datePart =
          parts[1]
            ? parts[1].trim()
            : "";

        /*
         * Reconnaît :
         *
         * Équipe 2-1 Équipe
         */

        const match =
          matchPart.match(
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

        /*
         * Date / heure
         */

        let date;

        if (datePart) {

          const parsed =
            parseFrenchDate(datePart);

          if (!parsed) {
            invalid++;
            continue;
          }

          date = parsed;

        } else {

          date =
            new Date().toISOString();
        }

        try {

          const result =
            addMatch({
              date,
              home,
              away,
              homeGoals,
              awayGoals,
              competition:
                "FIFA FC 26. England Championship",
              source:
                "FIFA_VIRTUAL"
            });

          if (result.duplicate) {
            duplicates++;
          } else {
            added++;
          }

        } catch (error) {

          console.error(
            "Match invalide :",
            line,
            error.message
          );

          invalid++;
        }
      }

      return res.json({
        success: true,
        added,
        duplicates,
        invalid,
        total: lines.length
      });

    } catch (error) {

      console.error(
        "Erreur import :",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Erreur interne pendant l'import."
      });
    }
  }
);

// ==========================================
// STATISTIQUES DES DONNÉES
// ==========================================

app.get(
  "/api/data/stats",
  (req, res) => {

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
  }
);

// ==========================================
// CONVERSION DATE FRANÇAISE
//
// 21/08/2026 18:30
// ↓
// 2026-08-21T18:30:00
// ==========================================

function parseFrenchDate(value) {

  const match =
    value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
    );

  if (!match) {
    return null;
  }

  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  const year =
    Number(match[3]);

  const hour =
    match[4]
      ? Number(match[4])
      : 0;

  const minute =
    match[5]
      ? Number(match[5])
      : 0;

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
    date.getDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

// ==========================================
// ERREUR 404 API
// ==========================================

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "Route API introuvable."
    });
  }
);

// ==========================================
// SERVEUR
// ==========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ROI Prediction FIFA running on port ${PORT}`
    );
  }
);
