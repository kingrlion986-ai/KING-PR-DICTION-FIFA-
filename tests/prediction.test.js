const { predictMatch } = require("../src/predictionEngine");

const result = predictMatch(
  "Team A",
  "Team B"
);

console.log(
  JSON.stringify(result, null, 2)
);
