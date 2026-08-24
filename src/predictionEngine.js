const { getTeamMatches, getHeadToHead } = require("./dataEngine");

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function recent(matches,limit=20,matchDate=null){
  let r=(matches||[]).filter(m=>m&&m.date);

  if(matchDate){
    const d=new Date(matchDate);
    if(!isNaN(d))
      r=r.filter(m=>new Date(m.date)<d);
  }

  return r.sort((a,b)=>new Date(b.date)-new Date(a.date))
          .slice(0,limit);
}

function avg(a){
  return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
}

function wavg(a){
  if(!a.length)return 0;
  let s=0,w=0;
  a.forEach((v,i)=>{
    const q=Math.max(.35,1-i*.06);
    s+=v*q;w+=q;
  });
  return s/w;
}

/* =========================
   ÉQUIPE
========================= */

function analyzeTeam(team,matchDate=null){
  const all=getTeamMatches(team)||[];
  const r=recent(all,20,matchDate);

  let scored=[],conceded=[],hs=[],hc=[],as=[],ac=[];
  let wins=0,points=0;

  r.forEach(m=>{
    const home=m.home.toLowerCase()===team.toLowerCase();
    const gf=Number(home?m.homeGoals:m.awayGoals);
    const ga=Number(home?m.awayGoals:m.homeGoals);

    scored.push(gf);conceded.push(ga);

    if(home){hs.push(gf);hc.push(ga);}
    else{as.push(gf);ac.push(ga);}

    if(gf>ga){wins++;points+=3;}
    else if(gf===ga)points++;
  });

  return {
    team,
    matches:r.length,
    avgScored:wavg(scored),
    avgConceded:wavg(conceded),
    homeAvgScored:wavg(hs),
    homeAvgConceded:wavg(hc),
    awayAvgScored:wavg(as),
    awayAvgConceded:wavg(ac),
    winRate:r.length?wins/r.length:0,
    form:r.length?points/(r.length*3):0,
    recentMatches:r.length
  };
}

/* =========================
   H2H
========================= */

function analyzeH2H(home,away,matchDate=null){
  const r=recent(getHeadToHead(home,away)||[],10,matchDate);

  let hg=[],ag=[],hw=0,d=0,aw=0;

  r.forEach(m=>{
    const same=m.home.toLowerCase()===home.toLowerCase();
    const h=Number(same?m.homeGoals:m.awayGoals);
    const a=Number(same?m.awayGoals:m.homeGoals);

    hg.push(h);ag.push(a);

    if(h>a)hw++;
    else if(h===a)d++;
    else aw++;
  });

  return {
    matches:r.length,
    homeAvgScored:avg(hg),
    awayAvgScored:avg(ag),
    homeWinRate:r.length?hw/r.length:0,
    drawRate:r.length?d/r.length:0,
    awayWinRate:r.length?aw/r.length:0
  };
}

/* =========================
   BUTS ATTENDUS
========================= */

function expectedGoals(h,a,h2h){
  const ha=h.homeAvgScored||h.avgScored||1.25;
  const hd=h.homeAvgConceded||h.avgConceded||1.25;
  const aa=a.awayAvgScored||a.avgScored||1.25;
  const ad=a.awayAvgConceded||a.avgConceded||1.25;

  let home=ha*.55+ad*.45;
  let away=aa*.55+hd*.45;

  /* Un seul H2H ne doit presque rien changer */
  if(h2h.matches>=3){
    home=home*.9+h2h.homeAvgScored*.1;
    away=away*.9+h2h.awayAvgScored*.1;
  }

  return {
    home:+clamp(home,.2,4).toFixed(2),
    away:+clamp(away,.2,4).toFixed(2)
  };
}

/* =========================
   POISSON
========================= */

function factorial(n){
  let r=1;
  for(let i=2;i<=n;i++)r*=i;
  return r;
}

function poisson(l,k){
  return Math.exp(-l)*Math.pow(l,k)/factorial(k);
}

function buildMatrix(lh,la){
  const m=[];

  for(let h=0;h<=8;h++){
    for(let a=0;a<=8;a++){
      m.push({
        homeGoals:h,
        awayGoals:a,
        probability:poisson(lh,h)*poisson(la,a)
      });
    }
  }

  const total=m.reduce((s,x)=>s+x.probability,0);

  return m.map(x=>({
    ...x,
    probability:x.probability/total
  }));
}

/* =========================
   MARCHÉS
========================= */

function calculateMarkets(m){
  const r={
    homeWin:0,draw:0,awayWin:0,
    over25:0,under25:0,
    bttsYes:0,bttsNo:0
  };

  m.forEach(x=>{
    const h=x.homeGoals,a=x.awayGoals,p=x.probability;

    if(h>a)r.homeWin+=p;
    else if(h===a)r.draw+=p;
    else r.awayWin+=p;

    if(h+a>=3)r.over25+=p;
    else r.under25+=p;

    if(h>0&&a>0)r.bttsYes+=p;
    else r.bttsNo+=p;
  });

  return r;
}

function getTopScores(m){
  return [...m]
    .sort((a,b)=>b.probability-a.probability)
    .slice(0,5)
    .map(x=>({
      score:`${x.homeGoals}-${x.awayGoals}`,
      probability:+(x.probability*100).toFixed(1)
    }));
}

/* =========================
   CONFIANCE
========================= */

function getConfidence(h,a,m){
  const p=[
    m.homeWin,
    m.draw,
    m.awayWin
  ].sort((x,y)=>y-x);

  const separation=p[0]-p[1];
  const data=clamp((h.matches+a.matches)/40,0,1);

  return Math.round(
    clamp(30+separation*100+data*10,25,75)
  );
}

/* =========================
   PREDICTION
========================= */

function predictMatch(home,away,date=null,time=null){

  const matchDate=
    date
      ? `${date}T${time||"23:59"}:00`
      : null;

  const hs=analyzeTeam(home,matchDate);
  const as=analyzeTeam(away,matchDate);
  const h2h=analyzeH2H(home,away,matchDate);

  const xg=expectedGoals(hs,as,h2h);
  const matrix=buildMatrix(xg.home,xg.away);
  const markets=calculateMarkets(matrix);
  const topScores=getTopScores(matrix);

  let winner="Nul";

  if(markets.homeWin>markets.draw &&
     markets.homeWin>markets.awayWin)
    winner=home;

  else if(markets.awayWin>markets.draw &&
          markets.awayWin>markets.homeWin)
    winner=away;

  const confidence=getConfidence(hs,as,markets);

  const gap=Math.abs(
    markets.homeWin-markets.awayWin
  );

  let message="";

  if(gap<.05)
    message="Match très serré";
  else if(gap<.10)
    message="Match serré";
  else if(winner==="Nul")
    message="Nul fortement possible";

  const quality=Math.round(
    clamp((hs.matches+as.matches)/40*100,0,100)
  );

  return {
    match:{home,away,date,time},

    teams:{
      home:hs,
      away:as
    },

    h2h,

    expectedGoals:xg,

    predictions:{
      winner,
      confidence,
      message,

      homeWin:+(markets.homeWin*100).toFixed(1),
      draw:+(markets.draw*100).toFixed(1),
      awayWin:+(markets.awayWin*100).toFixed(1),

      over25:+(markets.over25*100).toFixed(1),
      under25:+(markets.under25*100).toFixed(1),

      bttsYes:+(markets.bttsYes*100).toFixed(1),
      bttsNo:+(markets.bttsNo*100).toFixed(1),

      dataQuality:quality
    },

    topScores
  };
}

module.exports={
  predictMatch,
  analyzeTeam,
  analyzeH2H,
  expectedGoals,
  buildMatrix,
  calculateMarkets,
  getTopScores
};
