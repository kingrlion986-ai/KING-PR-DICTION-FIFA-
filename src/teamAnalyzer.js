const { getTeamMatches } = require("./dataEngine");

function analyzeTeam(team) {
  const matches = getTeamMatches(team);

  if (!matches.length) {
    return {
      team,
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

  let scored = 0;
  let conceded = 0;
  let wins = 0;
  let home = [];
  let away = [];

  for (const m of matches) {
    const isHome = m.home === team;
    const s = isHome ? m.homeGoals : m.awayGoals;
    const c = isHome ? m.awayGoals : m.homeGoals;

    scored += s;
    conceded += c;

    if (s > c) wins++;

    (isHome ? home : away).push({ s, c });
  }

  const avg = n => n ? n.reduce((a, b) => a + b, 0) / n.length : 0;

  return {
    team,
    matches: matches.length,

    avgScored: scored / matches.length,
    avgConceded: conceded / matches.length,

    homeAvgScored: avg(home.map(x => x.s)),
    homeAvgConceded: avg(home.map(x => x.c)),

    awayAvgScored: avg(away.map(x => x.s)),
    awayAvgConceded: avg(away.map(x => x.c)),

    winRate: wins / matches.length,

    form: matches
      .slice(-5)
      .reduce((p, m) => {
        const isHome = m.home === team;
        const s = isHome ? m.homeGoals : m.awayGoals;
        const c = isHome ? m.awayGoals : m.homeGoals;
        return p + (s > c ? 3 : s === c ? 1 : 0);
      }, 0) / Math.min(5, matches.length)
  };
}

module.exports = { analyzeTeam };
