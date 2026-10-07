// Myanmar Poker Multiplier — V8.7 Free Mode
// Local hot-seat engine. No Firebase, no billing, no network.
// Firebase can be added later without changing the card/rules model.

export const SUITS = ["♠","♥","♦","♣"];
export const SUIT_NAMES = {"♠":"spades","♥":"hearts","♦":"diamonds","♣":"clubs"};
export const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

export function buildDeck() {
  const d=[];
  for (let copy=1; copy<=2; copy++) {
    for (const suit of SUITS) for (const rank of RANKS)
      d.push({id:`${copy}-${rank}${suit}`,rank,suit,jokerColor:null});
  }
  d.push({id:"R1-JOKER",rank:"JOKER",suit:"",jokerColor:"RED"});
  d.push({id:"R2-JOKER",rank:"JOKER",suit:"",jokerColor:"RED"});
  d.push({id:"B1-JOKER",rank:"JOKER",suit:"",jokerColor:"BLACK"});
  d.push({id:"B2-JOKER",rank:"JOKER",suit:"",jokerColor:"BLACK"});
  return d;
}
export function shuffle(a, rng=Math.random) {
  const x=[...a];
  for(let i=x.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[x[i],x[j]]=[x[j],x[i]];}
  return x;
}
export function deal(players, rng=Math.random) {
  const deck=shuffle(buildDeck(),rng);
  const upper=deck.shift();
  const hands=players.map(p=>({uid:p.uid,name:p.name,cards:[]}));
  for(let i=0;i<13;i++) for(const h of hands) h.cards.push(deck.shift());
  const lower=deck.pop();
  const center=deck;
  const starter=Math.floor(rng()*players.length);
  return {upper,lower,center,hands,starter,current:starter,phase:"STARTER_DECISION",winner:null,events:[]};
}
export function cardLabel(c) {
  return c.rank==="JOKER" ? (c.jokerColor==="RED" ? "🃏R" : "🃏B") : `${c.rank}${c.suit}`;
}
export function isSameCard(a,b){ return a && b && a.id===b.id; }

function counts(cards, keyFn){const m=new Map();for(const c of cards){const k=keyFn(c);m.set(k,(m.get(k)||0)+1)}return m}
function suitRank(c){return c.suit+c.rank}
const rankValue = r => r==="A"?14:r==="K"?13:r==="Q"?12:r==="J"?11:Number(r);

export function isTrueSenior(cards){
  return cards.length===3 && cards.every(c=>c.suit==="♦") &&
    new Set(cards.map(c=>c.rank)).size===3 &&
    ["3","4","5"].every(r=>cards.some(c=>c.rank===r));
}
export function isJokerSenior(cards){
  if(cards.length!==3) return false;
  const jokers=cards.filter(c=>c.rank==="JOKER");
  if(jokers.length!==1) return false;
  const non=jokers.length ? cards.filter(c=>c.rank!=="JOKER") : cards;
  return non.every(c=>c.suit==="♦") &&
    new Set(non.map(c=>c.rank)).size===non.length &&
    non.every(c=>["3","4","5"].includes(c.rank));
}
export function isHouse(cards){
  if(cards.length<3) return false;
  const nonJ=cards.filter(c=>c.rank!=="JOKER");
  if(!nonJ.length) return false;
  const r=nonJ[0].rank;
  return nonJ.every(c=>c.rank===r);
}
function isSequence(cards){
  if(cards.length<3) return false;
  if(cards.some(c=>c.rank==="JOKER")) return false; // explicit conservative local rule
  if(cards.some(c=>!c.suit)) return false;
  const suits=new Set(cards.map(c=>c.suit));
  if(suits.size!==1) return false;
  const vals=cards.map(c=>rankValue(c.rank)).sort((a,b)=>a-b);
  if(new Set(vals).size!==vals.length) return false;
  // Normal consecutive sequence
  let ok=true; for(let i=1;i<vals.length;i++) if(vals[i]!==vals[i-1]+1) ok=false;
  if(ok) return true;
  // J-Q-K-A is explicitly allowed
  return vals.length===4 && vals.join(",")==="11,12,13,14";
}
function allDistinct(cards){return new Set(cards.map(c=>c.id)).size===cards.length}

export function validateArrangement(cards, groups, playerCount=4){
  if(cards.length!==13 || !allDistinct(cards)) return {ok:false,error:"Arrangement must contain exactly 13 unique cards."};
  if(!Array.isArray(groups) || !groups.length) return {ok:false,error:"Create at least one group."};
  const flat=groups.flat();
  if(flat.length!==13 || new Set(flat).size!==13) return {ok:false,error:"Every card must appear exactly once in the groups."};
  const byId=new Map(cards.map(c=>[c.id,c]));
  if(flat.some(id=>!byId.has(id))) return {ok:false,error:"A group contains a card not in your hand."};

  const seniors=groups.filter(g=>g.length===3 && isTrueSenior(g.map(id=>byId.get(id))));
  const jokerSeniors=groups.filter(g=>g.length===3 && isJokerSenior(g.map(id=>byId.get(id))));
  const invalid=groups.filter(g=>{
    const cs=g.map(id=>byId.get(id));
    return !(isTrueSenior(cs)||isJokerSenior(cs)||isHouse(cs)||isSequence(cs));
  });
  if(invalid.length) return {ok:false,error:"One or more groups are not a valid Senior, House, or sequence."};

  if(playerCount===3 && seniors.length!==2) return {ok:false,error:"3-player game requires 2 True Senior Colors."};
  if(playerCount===4 && !(seniors.length===1 && jokerSeniors.length===1))
    return {ok:false,error:"4-player game requires 1 True Senior + 1 Joker Senior."};
  if(playerCount===5 && seniors.length!==1) return {ok:false,error:"5-player game requires 1 True Senior Color."};

  return {ok:true};
}

export function bonusInfo(cards){
  const as=cards.filter(c=>c.rank==="A"&&c.suit==="♠").length;
  const sevens=cards.filter(c=>c.rank==="7"&&c.suit==="♦").length;
  const redJ=cards.filter(c=>c.rank==="JOKER"&&c.jokerColor==="RED").length;
  const jokers=cards.filter(c=>c.rank==="JOKER").length;
  let multiplier=1, label="";
  if(as>=1 && sevens>=1 && redJ>=1){multiplier=5;label="A♠ + 7♦ + Red Joker";}
  else if(as>=2 || sevens>=2){multiplier=3;label=as>=2?"2× A♠":"2× 7♦";}
  return {multiplier,label,bonusCount:as+sevens+jokers};
}
export function winningFeeMultiplier(cards, streak=0){
  let m=1, reasons=[];
  const jokers=cards.filter(c=>c.rank==="JOKER").length;
  if(jokers===4){m=Math.max(m,3);reasons.push("Four Jokers")}
  if(isTrueSenior(cards.filter(c=>c.suit==="♦" && ["3","4","5"].includes(c.rank))) &&
     cards.length===3){m=Math.max(m,2);reasons.push("True Senior")}
  if(streak>=2){m=Math.max(m,2);reasons.push("3-game streak")}
  return {multiplier:m,reasons};
}
export function settle(players, winnerUid, winFee, cardBonus){
  const w=players.find(p=>p.uid===winnerUid);
  const rows=players.map(p=>({uid:p.uid,name:p.name,bonusCount:bonusInfo(p.cards).bonusCount,paid:0,received:0,net:0}));
  const wr=rows.find(r=>r.uid===winnerUid);
  const wf=winFee*(w?.winFeeMultiplier||1);
  wr.received += wf;
  // Winner does not pay loser card bonuses. Losers settle pairwise differences.
  const losers=rows.filter(r=>r.uid!==winnerUid);
  for(let i=0;i<losers.length;i++) for(let j=i+1;j<losers.length;j++){
    const a=losers[i],b=losers[j],diff=a.bonusCount-b.bonusCount;
    if(diff>0){a.paid+=diff*cardBonus;b.received+=diff*cardBonus}
    else if(diff<0){b.paid+=(-diff)*cardBonus;a.received+=(-diff)*cardBonus}
  }
  for(const r of rows) r.net=r.received-r.paid;
  return {winnerUid,winningFee:wf,rows};
}
