const express = require("express");
const path = require("path");

const {
  predictMatch
} = require("./src/predictionEngine");

const {
  addMatches,
  getDataStats
} = require("./src/dataEngine");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "5mb"
}));

app.use(express.static(
  path.join(__dirname, "public")
));

/* =========================
   PAGES
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "admin.html")
  );
});

app.get("/admin.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "admin.html")
  );
});

/* =========================
   STATUS
========================= */

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    project: "ROI PREDICTION FIFA",
    version: "1.0.0",
    status: "online",
    message: "FIFA Virtual AI is running"
  });
});

/* =========================
   PREDICTION
========================= */

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

    res.json({
      success: true,
      prediction
    });

  } catch (error) {

    console.error(
      "Erreur prédiction:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Erreur interne pendant la prédiction."
    });
  }
});

/* =========================
   IMPORT DES MATCHS
========================= */

app.post("/api/matches", (req, res) => {

  try {

    const text =
      typeof req.body.text === "string"
        ? req.body.text
        : "";

    if (!text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Aucune donnée reçue."
      });
    }

    const matches =
      parseFifaText(text);

    if (!matches.length) {
      return res.status(400).json({
        success: false,
        message:
          "Aucun match valide trouvé."
      });
    }

    const result =
      addMatches(matches);

    res.json({
      success: true,
      ...result,
      parsed: matches.length
    });

  } catch (error) {

    console.error(
      "Erreur import:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   IMPORT ADMIN
   Alias
========================= */

app.post("/api/admin/import", (req, res) => {

  try {

    const text =
      typeof req.body.text === "string"
        ? req.body.text
        : "";

    if (!text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Aucune donnée reçue."
      });
    }

    const matches =
      parseFifaText(text);

    if (!matches.length) {
      return res.status(400).json({
        success: false,
        message:
          "Aucun match valide trouvé."
      });
    }

    const result =
      addMatches(matches);

    res.json({
      success: true,
      ...result,
      parsed: matches.length
    });

  } catch (error) {

    console.error(
      "Erreur import admin:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =========================
   STATISTIQUES
========================= */

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
      "Erreur statistiques:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Impossible de récupérer les statistiques."
    });
  }
});

/* =========================
   PARSEUR FIFA
========================= */

function parseFifaText(text) {

  const matches = [];

  /*
   * On sépare les différents matchs.
   * Les données FIFA contiennent généralement
   * "---" entre les matchs.
   */

  const blocks =
    text.split(/\s*---+\s*/);

  for (const block of blocks) {

    const match =
      parseBlock(block);

    if (match) {
      matches.push(match);
    }
  }

  return matches;
}

/* =========================
   PARSE UN MATCH
========================= */

function parseBlock(block) {

  const lines =
    block
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  /*
   * Date + heure
   *
   * 19.08.2026 (23:50)
   */

  let date = null;

  for (const line of lines) {

    const dateMatch =
      line.match(
        /(\d{2})\.(\d{2})\.(\d{4})\s*\((\d{1,2}):(\d{2})\)/
      );

    if (dateMatch) {

      const day =
        dateMatch[1];

      const month =
        dateMatch[2];

      const year =
        dateMatch[3];

      const hour =
        dateMatch[4].padStart(2, "0");

      const minute =
        dateMatch[5];

      date =
        `${year}-${month}-${day}T${hour}:${minute}:00`;

      break;
    }
  }

  if (!date) {
    return null;
  }

  /*
   * Recherche du score.
   *
   * Accepte :
   *
   * 1 : 3
   * 1:3
   * Arsenal 1 : 3 Manchester City
   */

  let scoreIndex = -1;
  let scoreMatch = null;

  for (let i = 0; i < lines.length; i++) {

    const found =
      lines[i].match(
        /(\d+)\s*:\s*(\d+)/
      );

    if (found) {
      scoreIndex = i;
      scoreMatch = found;
      break;
    }
  }

  if (
    scoreIndex === -1 ||
    !scoreMatch
  ) {
    return null;
  }

  const homeGoals =
    Number(scoreMatch[1]);

  const awayGoals =
    Number(scoreMatch[2]);

  let home = "";
  let away = "";

  /*
   * CAS 1
   *
   * Arsenal 1 : 3 Manchester City
   */

  const sameLine =
    lines[scoreIndex].match(
      /^(.+?)\s+(\d+)\s*:\s*(\d+)\s+(.+)$/
    );

  if (sameLine) {

    home =
      cleanTeam(sameLine[1]);

    away =
      cleanTeam(sameLine[4]);

  } else {

    /*
     * CAS 2
     *
     * Arsenal
     * 1 : 3
     * Manchester City
     */

    const before = [];

    for (
      let i = scoreIndex - 1;
      i >= 0;
      i--
    ) {

      const name =
        cleanTeam(lines[i]);

      if (isTeamName(name)) {
        before.unshift(name);

        if (before.length >= 2) {
          break;
        }
      }
    }

    /*
     * Le premier nom avant le score
     * est domicile.
     *
     * Le deuxième est extérieur.
     */

    if (before.length >= 2) {

      home = before[
        before.length - 2
      ];

      away = before[
        before.length - 1
      ];

    } else if (before.length === 1) {

      home = before[0];

      /*
       * Cherche l'équipe après le score.
       */

      for (
        let i = scoreIndex + 1;
        i < lines.length;
        i++
      ) {

        const name =
          cleanTeam(lines[i]);

        if (isTeamName(name)) {
          away = name;
          break;
        }
      }
    }
  }

  /*
   * Nettoyage des noms
   */

  home =
    cleanTeam(home);

  away =
    cleanTeam(away);

  /*
   * Sécurité
   */

  if (
    !home ||
    !away ||
    home.toLowerCase() ===
      away.toLowerCase()
  ) {
    return null;
  }

  /*
   * Ignore les lignes qui ne sont
   * clairement pas des équipes.
   */

  if (
    !isTeamName(home) ||
    !isTeamName(away)
  ) {
    return null;
  }

  return {
    home,
    away,
    homeGoals,
    awayGoals,
    date,
    competition:
      "FIFA FC 26. England Championship",
    source:
      "FIFA_VIRTUAL"
  };
}

/* =========================
   NETTOYAGE ÉQUIPE
========================= */

function cleanTeam(name) {

  return String(name || "")
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, "")
    .replace(/[^A-Za-zÀ-ÿ0-9'& .-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   RECONNAÎTRE UNE ÉQUIPE
========================= */

function isTeamName(name) {

  if (!name) {
    return false;
  }

  const bad = [
    "FIFA",
    "FC 26",
    "FC 26. England Championship",
    "England Championship",
    "Résultats pour",
    "Informations sur les jeux",
    "Populaire",
    "Favoris",
    "Coupon",
    "Historique",
    "Menu"
  ];

  for (const word of bad) {

    if (
      name
        .toLowerCase()
        .includes(word.toLowerCase())
    ) {
      return false;
    }
  }

  /*
   * Une équipe doit contenir
   * au moins une lettre.
   */

  return /[A-Za-zÀ-ÿ]/.test(name);
}

/* =========================
   404 API
   IMPORTANT :
   doit être APRÈS les routes
========================= */

app.use("/api", (req, res) => {

  res.status(404).json({
    success: false,
    message:
      "Route API introuvable."
  });
});

/* =========================
   SERVEUR
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `ROI Prediction FIFA running on port ${PORT}`
    );

  }
);
