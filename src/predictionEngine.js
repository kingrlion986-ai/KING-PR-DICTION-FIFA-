const {
getTeamMatches,
getHeadToHead
} = require("./dataEngine");

/* =========================
OUTILS
========================= */

function avg(arr) {
if (!Array.isArray(arr) || !arr.length) return 0;

return arr.reduce(
(sum, value) => sum + Number(value || 0),
0
) / arr.length;
}

function clamp(value, min, max) {
return Math.max(min, Math.min(max, value));
}

function poisson(k, lambda) {
if (!Number.isFinite(lambda) || lambda <= 0) {
return k === 0 ? 1 : 0;
}

let factorial = 1;

for (let i = 2; i <= k; i++) {
factorial *= i;
}

return (
Math.exp(-lambda) *
Math.pow(lambda, k) /
factorial
);
}

/* =========================
ANALYSE ÉQUIPE
========================= */

function analyzeTeam(teamName) {
const matches = getTeamMatches(teamName) || [];

const validMatches = matches.filter(
m =>
m &&
typeof m.home === "string" &&
typeof m.away === "string" &&
Number.isFinite(Number(m.homeGoals)) &&
Number.isFinite(Number(m.awayGoals))
);

if (!validMatches.length) {
return {
team: teamName,
matches: 0,
avgScored: 0,
avgConceded: 0,
homeAvgScored: 0,
homeAvgConceded: 0,
awayAvgScored: 0,
awayAvgConceded: 0,
winRate: 0,
form: 0
};
}

const scored = [];
const conceded = [];

const homeScored = [];
const homeConceded = [];

const awayScored = [];
const awayConceded = [];

const results = [];

for (const match of validMatches) {
const isHome =
match.home.trim().toLowerCase() ===
teamName.trim().toLowerCase();

const gf = isHome
  ? Number(match.homeGoals)
  : Number(match.awayGoals);

const ga = isHome
  ? Number(match.awayGoals)
  : Number(match.homeGoals);

scored.push(gf);
conceded.push(ga);

if (isHome) {
  homeScored.push(gf);
  homeConceded.push(ga);
} else {
  awayScored.push(gf);
  awayConceded.push(ga);
}

if (gf > ga) {
  results.push(1);
} else if (gf === ga) {
  results.push(0.5);
} else {
  results.push(0);
}

}

return {
team: teamName,
matches: validMatches.length,

avgScored: avg(scored),
avgConceded: avg(conceded),

homeAvgScored: avg(homeScored),
homeAvgConceded: avg(homeConceded),

awayAvgScored: avg(awayScored),
awayAvgConceded: avg(awayConceded),

winRate:
  avg(results),

form:
  avg(results.slice(-5)) * 2

};
}

/* =========================
BUTS ATTENDUS
========================= */

function calculateExpectedGoals(home, away) {
const homeAttack =
home.homeAvgScored > 0
? home.homeAvgScored
: home.avgScored > 0
? home.avgScored
: 1;

const homeDefense =
home.homeAvgConceded > 0
? home.homeAvgConceded
: home.avgConceded > 0
? home.avgConceded
: 1;

const awayAttack =
away.awayAvgScored > 0
? away.awayAvgScored
: away.avgScored > 0
? away.avgScored
: 1;

const awayDefense =
away.awayAvgConceded > 0
? away.awayAvgConceded
: away.avgConceded > 0
? away.avgConceded
: 1;

let homeXG =
homeAttack * 0.60 +
awayDefense * 0.40;

let awayXG =
awayAttack * 0.60 +
homeDefense * 0.40;

homeXG *= 1.05;

return {
home: Number(
clamp(homeXG, 0.20, 4.50).toFixed(2)
),

away: Number(
  clamp(awayXG, 0.20, 4.50).toFixed(2)
)

};
}

/* =========================
SCORES
========================= */

function buildScores(homeXG, awayXG) {
const scores = [];

for (let home = 0; home <= 8; home++) {
for (let away = 0; away <= 8; away++) {
const probability =
poisson(home, homeXG) *
poisson(away, awayXG);

  scores.push({
    home,
    away,
    probability
  });
}

}

return scores;
}

/* =========================
MARCHÉS STATISTIQUES
========================= */

function calculateMarkets(scores) {
let homeWin = 0;
let draw = 0;
let awayWin = 0;

let over15 = 0;
let over25 = 0;
let bttsYes = 0;

for (const score of scores) {
if (score.home > score.away) {
homeWin += score.probability;
} else if (score.home === score.away) {
draw += score.probability;
} else {
awayWin += score.probability;
}

if (score.home + score.away >= 2) {
  over15 += score.probability;
}

if (score.home + score.away >= 3) {
  over25 += score.probability;
}

if (
  score.home > 0 &&
  score.away > 0
) {
  bttsYes += score.probability;
}

}

return {
homeWin: homeWin * 100,
draw: draw * 100,
awayWin: awayWin * 100,
over15: over15 * 100,
over25: over25 * 100,
bttsYes: bttsYes * 100
};
}

/* =========================
VERDICT STATISTIQUE UNIQUE
========================= */

function chooseVerdict(
markets,
home,
away,
expectedGoals
) {
const candidates = [];

/* Victoire domicile */

let homeScore = markets.homeWin;

if (home.form > away.form) {
homeScore += 5;
}

if (home.winRate > away.winRate) {
homeScore += 5;
}

if (expectedGoals.home > expectedGoals.away) {
homeScore += 5;
}

candidates.push({
type: "HOME_WIN",
label: "Victoire ${home.team}",
probability: markets.homeWin,
score: homeScore
});

/* Victoire extérieur */

let awayScore = markets.awayWin;

if (away.form > home.form) {
awayScore += 5;
}

if (away.winRate > home.winRate) {
awayScore += 5;
}

if (expectedGoals.away > expectedGoals.home) {
awayScore += 5;
}

candidates.push({
type: "AWAY_WIN",
label: "Victoire ${away.team}",
probability: markets.awayWin,
score: awayScore
});

/* Match nul */

let drawScore = markets.draw;

if (
Math.abs(
expectedGoals.home -
expectedGoals.away
) < 0.35
) {
drawScore += 10;
}

if (
Math.abs(
home.form -
away.form
) < 0.20
) {
drawScore += 5;
}

candidates.push({
type: "DRAW",
label: "Match nul",
probability: markets.draw,
score: drawScore
});

/* Les deux marquent */

let bttsScore = markets.bttsYes;

if (
expectedGoals.home >= 1.20 &&
expectedGoals.away >= 1.20
) {
bttsScore += 10;
}

if (
home.avgScored >= 1.20 &&
away.avgScored >= 1.20
) {
bttsScore += 5;
}

candidates.push({
type: "BTTS",
label: "Les deux équipes marquent",
probability: markets.bttsYes,
score: bttsScore
});

/* Plus de 1,5 buts */

let over15Score = markets.over15;

const totalXG =
expectedGoals.home +
expectedGoals.away;

if (totalXG >= 2.40) {
over15Score += 8;
}

if (totalXG >= 3.00) {
over15Score += 7;
}

candidates.push({
type: "OVER15",
label: "Plus de 1,5 buts",
probability: markets.over15,
score: over15Score
});

candidates.sort(
(a, b) => b.score - a.score
);

const best = candidates[0];
const second = candidates[1];

const separation =
best.score - second.score;

let signal = "ROUGE";

if (
best.probability >= 65 &&
separation >= 5
) {
signal = "VERT";
} else if (
best.probability >= 55 &&
separation >= 3
) {
signal = "ORANGE";
}

return {
option: best.label,

probability: Number(
  best.probability.toFixed(1)
),

signal,

message:
  signal === "VERT"
    ? "VERDICT FORT"
    : signal === "ORANGE"
      ? "VERDICT MOYEN"
      : "VERDICT INCERTAIN",

reason:
  best.type === "HOME_WIN"
    ? `Les données favorisent ${home.team}.`
    : best.type === "AWAY_WIN"
      ? `Les données favorisent ${away.team}.`
      : best.type === "DRAW"
        ? "Les données indiquent un équilibre entre les deux équipes."
        : best.type === "BTTS"
          ? "Les statistiques offensives favorisent un scénario où les deux équipes marquent."
          : "La projection totale des buts favorise un match avec plusieurs buts."

};
}

/* =========================
H2H
========================= */

function analyzeH2H(homeName, awayName) {
let matches = [];

try {
matches =
getHeadToHead(
homeName,
awayName
) || [];
} catch (error) {
matches = [];
}

let homeWins = 0;
let draws = 0;
let awayWins = 0;

const homeGoals = [];
const awayGoals = [];

for (const match of matches) {
if (
!match ||
typeof match.home !== "string" ||
typeof match.away !== "string"
) {
continue;
}

const sameOrder =
  match.home.trim().toLowerCase() ===
  homeName.trim().toLowerCase();

const hg = sameOrder
  ? Number(match.homeGoals)
  : Number(match.awayGoals);

const ag = sameOrder
  ? Number(match.awayGoals)
  : Number(match.homeGoals);

if (
  !Number.isFinite(hg) ||
  !Number.isFinite(ag)
) {
  continue;
}

homeGoals.push(hg);
awayGoals.push(ag);

if (hg > ag) {
  homeWins++;
} else if (hg === ag) {
  draws++;
} else {
  awayWins++;
}

}

const total =
homeGoals.length;

return {
matches: total,

homeAvgScored:
  Number(avg(homeGoals).toFixed(2)),

homeAvgConceded:
  Number(avg(awayGoals).toFixed(2)),

awayAvgScored:
  Number(avg(awayGoals).toFixed(2)),

awayAvgConceded:
  Number(avg(homeGoals).toFixed(2)),

homeWinRate:
  total
    ? Number(
        (homeWins / total * 100).toFixed(1)
      )
    : 0,

drawRate:
  total
    ? Number(
        (draws / total * 100).toFixed(1)
      )
    : 0,

awayWinRate:
  total
    ? Number(
        (awayWins / total * 100).toFixed(1)
      )
    : 0

};
}

/* =========================
SCORES PROBABLES
========================= */

function getTopScores(scores) {
return [...scores]
.sort(
(a, b) =>
b.probability -
a.probability
)
.slice(0, 3)
.map(score => ({
score:
"${score.home}-${score.away}",

  probability:
    Number(
      (
        score.probability * 100
      ).toFixed(1)
    )
}));

}

/* =========================
PRÉDICTION PRINCIPALE
========================= */

function predictMatch(
homeName,
awayName
) {
if (
typeof homeName !== "string" ||
typeof awayName !== "string"
) {
throw new Error(
"Les noms des équipes sont obligatoires."
);
}

homeName = homeName.trim();
awayName = awayName.trim();

if (!homeName || !awayName) {
throw new Error(
"Les deux équipes sont obligatoires."
);
}

if (
homeName.toLowerCase() ===
awayName.toLowerCase()
) {
throw new Error(
"Les deux équipes doivent être différentes."
);
}

const home =
analyzeTeam(homeName);

const away =
analyzeTeam(awayName);

if (
home.matches === 0 ||
away.matches === 0
) {
throw new Error(
"Données insuffisantes pour une ou deux équipes."
);
}

const expectedGoals =
calculateExpectedGoals(
home,
away
);

const scores =
buildScores(
expectedGoals.home,
expectedGoals.away
);

const markets =
calculateMarkets(scores);

const totalMatches =
home.matches +
away.matches;

const dataQuality =
clamp(
Math.round(
(totalMatches / 40) * 100
),
0,
100
);

const h2h =
analyzeH2H(
homeName,
awayName
);

const verdict =
chooseVerdict(
markets,
home,
away,
expectedGoals
);

let winner = "Match nul";

if (
markets.homeWin >
markets.draw &&
markets.homeWin >
markets.awayWin
) {
winner = homeName;
} else if (
markets.awayWin >
markets.homeWin &&
markets.awayWin >
markets.draw
) {
winner = awayName;
}

const winnerConfidence =
Number(
Math.max(
markets.homeWin,
markets.draw,
markets.awayWin
).toFixed(1)
);

return {
match: {
home: homeName,
away: awayName
},

teams: {
  home,
  away
},

h2h,

expectedGoals,

predictions: {
  winner,

  confidence:
    winnerConfidence,

  dataQuality,

  homeWin:
    Number(
      markets.homeWin.toFixed(1)
    ),

  draw:
    Number(
      markets.draw.toFixed(1)
    ),

  awayWin:
    Number(
      markets.awayWin.toFixed(1)
    ),

  over15:
    Number(
      markets.over15.toFixed(1)
    ),

  over25:
    Number(
      markets.over25.toFixed(1)
    ),

  bttsYes:
    Number(
      markets.bttsYes.toFixed(1)
    )
},

bestBet: verdict,

verdict,

topScores:
  getTopScores(scores)

};
}

/* =========================
EXPORT
========================= */

module.exports = {
predictMatch
};
