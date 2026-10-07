// Myanmar Poker Multiplier — V8.8 Free Mode
// Local arrangement assistant. It searches exact-cover partitions of a 13-card hand.
import { isTrueSenior, isJokerSenior, isHouse, RANKS } from './free-mode-v86.js';

const value = r => r==='A'?14:r==='K'?13:r==='Q'?12:r==='J'?11:Number(r);

function isSequence(cards){
  if(cards.length<3 || cards.some(c=>c.rank==='JOKER' || !c.suit)) return false;
  if(new Set(cards.map(c=>c.suit)).size!==1) return false;
  const vals=cards.map(c=>value(c.rank)).sort((a,b)=>a-b);
  if(new Set(vals).size!==vals.length) return false;
  let ok=true; for(let i=1;i<vals.length;i++) if(vals[i]!==vals[i-1]+1) ok=false;
  return ok || (vals.length===4 && vals.join(',')==='11,12,13,14');
}

function validGroup(cards){
  return isTrueSenior(cards)||isJokerSenior(cards)||isHouse(cards)||isSequence(cards);
}
function seniorType(cards){
  if(isTrueSenior(cards)) return 'TRUE SENIOR';
  if(isJokerSenior(cards)) return 'JOKER SENIOR';
  if(isHouse(cards)) return 'HOUSE';
  if(isSequence(cards)) return 'SEQUENCE';
  return 'GROUP';
}

function combos(n,min=3){
  const out=[];
  for(let mask=0;mask<(1<<n);mask++){
    const bits=mask.toString(2).split('1').length-1;
    if(bits>=min) out.push(mask);
  }
  return out;
}

export function suggestArrangements(cards, playerCount=4, maxSolutions=12){
  if(!Array.isArray(cards)||cards.length!==13) return [];
  const n=cards.length, full=(1<<n)-1;
  const candidates=[];
  for(const mask of combos(n,3)){
    const group=[];
    for(let i=0;i<n;i++) if(mask&(1<<i)) group.push(cards[i]);
    if(validGroup(group)) candidates.push({mask,ids:group.map(c=>c.id),type:seniorType(group),size:group.length});
  }
  const byCard=Array.from({length:n},()=>[]);
  for(const g of candidates) for(let i=0;i<n;i++) if(g.mask&(1<<i)) byCard[i].push(g);
  const solutions=[];
  const seen=new Set();
  function seniorCounts(groups){
    const t=groups.filter(g=>g.type==='TRUE SENIOR').length;
    const j=groups.filter(g=>g.type==='JOKER SENIOR').length;
    return {t,j};
  }
  function finalOK(groups){
    const {t,j}=seniorCounts(groups);
    if(playerCount===3) return t===2;
    if(playerCount===4) return t===1&&j===1;
    if(playerCount===5) return t===1;
    return true;
  }
  function score(groups){
    const seniors=groups.filter(g=>g.type.includes('SENIOR')).length;
    const sequences=groups.filter(g=>g.type==='SEQUENCE').length;
    const houses=groups.filter(g=>g.type==='HOUSE').length;
    return seniors*100+sequences*10+houses*8-groups.length;
  }
  function dfs(mask,groups){
    if(solutions.length>=maxSolutions*4) return;
    if(mask===full){ if(finalOK(groups)) solutions.push({groups:[...groups],score:score(groups)}); return; }
    let first=-1;
    for(let i=0;i<n;i++) if(!(mask&(1<<i))){first=i;break;}
    const options=byCard[first].filter(g=>(g.mask&mask)===0).sort((a,b)=>b.size-a.size);
    for(const g of options) dfs(mask|g.mask,[...groups,g]);
  }
  dfs(0,[]);
  solutions.sort((a,b)=>b.score-a.score||a.groups.length-b.groups.length);
  const unique=[];
  for(const s of solutions){
    const key=s.groups.map(g=>g.ids.slice().sort().join('|')).sort().join('||');
    if(!seen.has(key)){seen.add(key);unique.push(s);if(unique.length>=maxSolutions)break;}
  }
  return unique;
}

export function describeArrangement(solution,cards){
  const map=new Map(cards.map(c=>[c.id,c]));
  return solution.groups.map(g=>({
    type:g.type,
    cards:g.ids.map(id=>map.get(id)),
    label:`${g.type} · ${g.size} cards`
  }));
}
