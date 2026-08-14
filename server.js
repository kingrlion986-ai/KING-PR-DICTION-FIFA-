const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Route principale
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    project: "ROI PREDICTION FIFA",
    version: "1.0.0",
    status: "online",
    message: "FIFA Virtual AI is running"
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`FIFA Virtual AI running on port ${PORT}`);
});
