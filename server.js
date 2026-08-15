const express = require("express");
const path = require("path");

const { predictMatch } = require("./src/predictionEngine");

const app = express();

const PORT = process.env.PORT || 3000;

const {
  addMatch,
  getMatches,
  getTeams
} = require("./src/dataEngine");

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Statut de l'application
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    project: "ROI PREDICTION FIFA",
    version: "1.0.0",
    status: "online",
    message: "FIFA Virtual AI is running"
  });
});

// Prédiction d'un match
app.get("/api/predict", (req, res) => {
  const { home, away } = req.query;

  if (!home || !away) {
    return res.status(400).json({
      success: false,
      error: "Les équipes home et away sont obligatoires."
    });
  }

  try {
    const prediction = predictMatch(home, away);

    res.json({
      success: true,
      prediction
    });

  } catch (error) {
    console.error("Prediction error:", error);

    res.status(500).json({
      success: false,
      error: "Impossible de générer la prédiction."
    });
  }
});

// Liste des matchs historiques
app.get("/api/matches", (req, res) => {
  try {
    res.json({
      success: true,
      count: getMatches().length,
      matches: getMatches()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Impossible de charger les matchs."
    });
  }
});

// Liste des équipes
app.get("/api/teams", (req, res) => {
  try {
    res.json({
      success: true,
      teams: getTeams()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Impossible de charger les équipes."
    });
  }
});

// Ajouter un résultat
app.post("/api/matches", (req, res) => {
  try {
    const match = addMatch(req.body);

    res.status(201).json({
      success: true,
      message: "Match enregistré.",
      match
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Route inconnue
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route introuvable."
  });
});

// Démarrage
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ROI Prediction FIFA running on port ${PORT}`);
});
