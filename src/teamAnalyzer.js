const { getTeamMatches } = require("./dataEngine");

function clean(name) {
  return String(name || "")
    .trim()
    .replace(/[,\s]+$/, "")
    .replace(/\s+/g, " ");
}

function analyzeTeam(team) {
  team = clean(team);

  const matches = getTeamMatches(team)
    .filter(
      m =>
        clean(m.home) === team ||
        clean(m.away) === team
    )
    .sort(
      (a, b) =>
        new Date(a.date) - new Date(b.date)
    );

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

  const home = [];
  const away = [];

  for (const m of matches) {

    const isHome =
      clean(m.home) === team;

    const s = Number(
      isHome
        ? m.homeGoals
        : m.awayGoals
    );

    const c = Number(
      isHome
        ? m.awayGoals
        : m.homeGoals
    );

    scored += s;
    conceded += c;

    if (s > c) {
      wins++;
    }

    if (isHome) {
      home.push({ s, c });
    } else {
      away.push({ s, c });
    }
  }

  const avg = values =>
    values.length
      ? values.reduce(
          (sum, value) => sum + value,
          0
        ) / values.length
      : 0;


  // 5 derniers matchs
  const recent = matches.slice(-5);

  const formPoints =
    recent.reduce(
      (points, m) => {

        const isHome =
          clean(m.home) === team;

        const s = Number(
          isHome
            ? m.homeGoals
            : m.awayGoals
        );

        const c = Number(
          isHome
            ? m.awayGoals
            : m.homeGoals
        );

        if (s > c) {
          return points + 3;
        }

        if (s === c) {
          return points + 1;
        }

        return points;
      },
      0
    );

  const form =
    formPoints / recent.length;


  return {
    team,

    matches: matches.length,

    avgScored:
      scored / matches.length,

    avgConceded:
      conceded / matches.length,

    homeAvgScored:
      avg(home.map(x => x.s)),

    homeAvgConceded:
      avg(home.map(x => x.c)),

    awayAvgScored:
      avg(away.map(x => x.s)),

    awayAvgConceded:
      avg(away.map(x => x.c)),

    winRate:
      wins / matches.length,

    form
  };
}

module.exports = {
  analyzeTeam
};
