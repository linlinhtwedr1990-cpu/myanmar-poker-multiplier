import {
  deal, cardLabel, validateArrangement, bonusInfo, winningFeeMultiplier, settle
} from "./free-mode-v86.js";
import { loadProfile, saveProfile, saveRoundHistory } from "./profile-v87.js";
import { renderProfilePanel } from "./social-v87.js";
import { suggestArrangements, describeArrangement } from "./arrangement-assistant-v88.js";

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const state={players:[],game:null,selected:new Set(),groups:[],winFee:200,cardBonus:100,streaks:{},suggestions:[],suggestionIndex:0};

function saveStats(result){
  const key="mm-poker-free-stats-v86";
  const stats=JSON.parse(localStorage.getItem(key)||"{}");
  for(const row of result.rows){
    const s=stats[row.uid]||{uid:row.uid,name:row.name,gamesPlayed:0,wins:0,losses:0,totalNetMMK:0,totalWinningFees:0,totalCardBonuses:0,biggestWin:0,currentStreak:0,bestStreak:0};
    s.name=row.name;s.gamesPlayed++;
    if(row.uid===result.winnerUid){s.wins++;s.currentStreak++;s.bestStreak=Math.max(s.bestStreak,s.currentStreak);s.totalWinningFees+=result.winningFee;s.biggestWin=Math.max(s.biggestWin,row.net)}
    else {s.losses++;s.currentStreak=0}
    s.totalNetMMK+=row.net;s.totalCardBonuses+=row.received-(row.uid===result.winnerUid?result.winningFee:0);
    stats[row.uid]=s;
  }
  localStorage.setItem(key,JSON.stringify(stats));
}

function renderSetup(){
  $("#app").innerHTML=`<section class="panel">
    <h2>🃏 Free Mode — Local Table</h2>
    <p class="muted">No Firebase • No billing • Works offline after loading.</p>
    <div class="setup-grid">
      <label>Players <select id="count"><option>3</option><option selected>4</option><option>5</option></select></label>
      <label>Winning Fee <input id="wf" type="number" value="200" min="0" step="50"></label>
      <label>Card Bonus <input id="cb" type="number" value="100" min="0" step="50"></label>
    </div>
    <div id="names"></div>
    <div class="setup-actions"><button class="primary" id="start">Start Free Game</button><button id="profile">👤 Profile & Leaderboard</button></div>
  </section>`;
  const names=()=>{const n=+$("count").value;$("#names").innerHTML=Array.from({length:n},(_,i)=>`<label>Player ${i+1}<input class="pname" value="${i===0?"Lin":`Player ${i+1}`}"></label>`).join("")};
  $("count").onchange=names;names();
  const profile=loadProfile();
  if(profile.name){const first=document.querySelector(".pname"); if(first) first.value=profile.name;}
  $("profile").onclick=()=>renderProfilePanel(renderSetup);
  $("start").onclick=()=>{
    const n=+$("count").value;
    state.winFee=+$("wf").value||0;state.cardBonus=+$("cb").value||0;
    state.players=Array.from(document.querySelectorAll(".pname")).map((x,i)=>({uid:`local-${i}`,name:x.value.trim()||`Player ${i+1}`}));
    if(state.players[0]) saveProfile({uid:state.players[0].uid,name:state.players[0].name,avatar:loadProfile().avatar||"🧑‍💻"});
    state.streaks=Object.fromEntries(state.players.map(p=>[p.uid,0]));
    startRound();
  };
}
function startRound(){
  state.game=deal(state.players);
  state.selected.clear();state.groups=[];state.suggestions=[];state.suggestionIndex=0;
  state.game.hands.forEach(h=>{h.winFeeMultiplier=1});
  renderTable();
}
function current(){return state.game.hands[state.game.current]}
function currentPlayer(){return state.players[state.game.current]}

function renderTable(){
  const g=state.game,p=current();
  if(!g)return;
  const isStarterDecision=g.phase==="STARTER_DECISION"&&g.current===g.starter;
  const isCurrent=true;
  $("#app").innerHTML=`<section class="table-shell">
    <div class="table-head"><div><b>Round ${Number(localStorage.getItem("mm-round-v86")||0)+1}</b> · ${state.players.length} players</div><div class="pill">Turn: ${esc(currentPlayer().name)}</div></div>
    <div class="bonus-row"><span>Upper <b>${cardLabel(g.upper)}</b></span><span>Center <b>${g.center.length}</b> cards</span><span>Lower <b>${cardLabel(g.lower)}</b></span></div>
    <div class="opponents">${state.players.map((x,i)=>`<div class="opp ${i===g.current?"active":""}"><b>${esc(x.name)}</b><span>${g.hands[i].cards.length} cards</span>${i===g.starter?"⭐":""}</div>`).join("")}</div>
    <div class="instruction">${esc(isStarterDecision?`${currentPlayer().name}: take the Lower card or reject it and draw from the center.`:`${currentPlayer().name}: draw a card, then select one card to discard.`)}</div>
    <div id="hand" class="hand">${p.cards.map(c=>`<button class="card ${state.selected.has(c.id)?"sel":""}" data-id="${c.id}"><span>${esc(c.rank==="JOKER"?"🃏":c.rank)}</span><span>${esc(c.rank==="JOKER"?c.jokerColor:c.suit)}</span></button>`).join("")}</div>
    <div class="actions">
      ${isStarterDecision?`<button id="take" class="primary">Take Lower</button><button id="reject">Reject Lower → Draw</button>`:
        g.phase==="DRAW"?`<button id="draw" class="primary">Draw Center</button>`:
        g.phase==="OFFER"?`<button id="offer" class="primary">Offer Selected Card to Right</button>`:
        g.phase==="RESPONSE"?`<button id="accept" class="primary">Accept Offered Card</button><button id="rejectOffer">Reject & Draw</button>`:
        g.phase==="DISCARD"?`<button id="discard" class="primary">Discard Selected</button><button id="group">Add Selected as Group</button><button id="clearGroups">Clear Groups</button><button id="check">Check Arrangement / Win</button>`:""}
      <button id="profileBtn">👤 Profile</button><button id="new">New Round</button>
    </div>
    ${g.phase==="DISCARD"?`<div class="groups"><b>Arrangement groups:</b>${state.groups.length?state.groups.map((grp,i)=>`<span class="group-chip">G${i+1}: ${grp.length} cards <button data-rm="${i}" title="Remove group">×</button></span>`).join(""):" <span class="muted">none yet</span>"}</div><div id="assistant" class="assistant-panel"><b>🧠 Arrangement Assistant</b><span class="muted">Finds complete 13-card arrangements using the current player-count Senior rules.</span>${state.suggestions.length?`<div class="suggestion-actions"><button id="applySuggestion" class="primary">Apply Suggestion ${state.suggestionIndex+1}/${state.suggestions.length}</button><button id="nextSuggestion">Next Suggestion</button></div><div class="suggestion-groups">${describeArrangement(state.suggestions[state.suggestionIndex],p.cards).map((g,i)=>`<span class="suggestion-chip"><b>${i+1}. ${g.type}</b> — ${g.cards.map(cardLabel).join(" ")}</span>`).join("")}</div>`:`<div class="suggestion-actions"><button id="suggest" class="primary">✨ Suggest Arrangement</button></div>`}</div>`:""}
    <div id="message" class="message"></div>
  </section>`;
  $("#hand").querySelectorAll(".card").forEach(b=>b.onclick=()=>{const id=b.dataset.id;state.selected.has(id)?state.selected.delete(id):state.selected.add(id);renderTable()});
  if(isStarterDecision){$("#take").onclick=()=>{p.cards.push(g.lower);g.lower=null;g.phase="OFFER";renderTable()};$("#reject").onclick=()=>{g.phase="DRAW";renderTable()}}
  if(g.phase==="DRAW")$("#draw").onclick=()=>{if(!g.center.length)return show("Center is empty.");p.cards.push(g.center.shift());g.phase="OFFER";renderTable()};
  if(g.phase==="OFFER")$("#offer").onclick=()=>{if(state.selected.size!==1)return show("Select exactly one card.");const id=[...state.selected][0];const c=p.cards.find(x=>x.id===id);if(!c)return;g.offer={from:g.current,to:(g.current+1)%state.players.length,card:c};p.cards=p.cards.filter(x=>x.id!==id);g.phase="RESPONSE";state.selected.clear();renderTable()};
  if(g.phase==="RESPONSE"){$("#accept").onclick=()=>{const to=g.hands[g.offer.to];to.cards.push(g.offer.card);g.current=g.offer.to;g.offer=null;g.phase="DISCARD";renderTable()};$("#rejectOffer").onclick=()=>{g.phase="DRAW";g.offer=null;renderTable()}}
  if(g.phase==="DISCARD"){
    $("#discard").onclick=()=>{if(state.selected.size!==1)return show("Select exactly one card to discard.");const id=[...state.selected][0];p.cards=p.cards.filter(x=>x.id!==id);state.selected.clear();if(p.cards.length!==13){show("You must finish with 13 cards.");return}g.current=(g.current+1)%state.players.length;g.phase="DRAW";renderTable()};
    $("#group").onclick=()=>{if(state.selected.size<3)return show("Select at least 3 cards for a group.");const ids=[...state.selected];if(ids.some(id=>state.groups.flat().includes(id)))return show("A selected card is already in a group.");state.groups.push(ids);state.selected.clear();state.suggestions=[];renderTable()};
    $("#clearGroups").onclick=()=>{state.groups=[];state.selected.clear();state.suggestions=[];state.suggestionIndex=0;renderTable()};
    document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{state.groups.splice(Number(b.dataset.rm),1);state.suggestions=[];renderTable()});
    if($("#suggest")) $("#suggest").onclick=()=>{state.suggestions=suggestArrangements(p.cards,state.players.length,12);state.suggestionIndex=0;show(state.suggestions.length?`Found ${state.suggestions.length} valid arrangement option(s).`:`No complete arrangement found for this hand.`);renderTable()};
    if($("#nextSuggestion")) $("#nextSuggestion").onclick=()=>{state.suggestionIndex=(state.suggestionIndex+1)%state.suggestions.length;renderTable()};
    if($("#applySuggestion")) $("#applySuggestion").onclick=()=>{const sol=state.suggestions[state.suggestionIndex];if(!sol)return;state.groups=sol.groups.map(g=>[...g.ids]);state.selected.clear();show("Suggested arrangement applied. Check Arrangement / Win to submit it.");renderTable()};
    $("#check").onclick=checkWin;
  }
  $("#profileBtn").onclick=()=>renderProfilePanel(renderSetup);
  $("#new").onclick=()=>{if(confirm("Start a new round?"))startRound()};
}
function show(msg){const m=$("#message");if(m)m.textContent=msg}
function checkWin(){
  const p=current(); if(p.cards.length!==13)return show("You need exactly 13 cards.");
  const groups=state.groups.map(g=>g);
  const result=validateArrangement(p.cards,groups,state.players.length);
  if(!result.ok){show(result.error+"  Use the Test Arrangement button in the helper below or build groups in a future online UI.");return}
  const wm=winningFeeMultiplier(p.cards,state.streaks[p.uid]||0);
  p.winFeeMultiplier=wm.multiplier;
  const settlementPlayers=state.game.hands.map((h,i)=>({uid:h.uid,name:h.name,cards:h.cards,winFeeMultiplier:h.winFeeMultiplier||1}));
  const resultSet=settle(settlementPlayers,p.uid,state.winFee,state.cardBonus);
  state.streaks[p.uid]=(state.streaks[p.uid]||0)+1;
  for(const x of state.players)if(x.uid!==p.uid)state.streaks[x.uid]=0;
  localStorage.setItem("mm-round-v86",String(Number(localStorage.getItem("mm-round-v86")||0)+1));
  saveStats(resultSet); saveRoundHistory(resultSet, Number(localStorage.getItem("mm-round-v86")||0)); renderResult(resultSet,wm,groups);
}
function renderResult(r,wm,groups){
  $("#app").innerHTML=`<section class="panel result">
    <div class="winner">🏆 ${esc(state.players.find(p=>p.uid===r.winnerUid)?.name||"Winner")} wins!</div>
    <p>Winning fee multiplier: <b>${wm.multiplier}×</b>${wm.reasons.length?` · ${esc(wm.reasons.join(", "))}`:""}</p>
    <table><tr><th>Player</th><th>Bonus cards</th><th>Paid</th><th>Received</th><th>Net</th></tr>${r.rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.bonusCount}</td><td>${x.paid}</td><td>${x.received}</td><td><b>${x.net}</b></td></tr>`).join("")}</table>
    <p class="muted">Local statistics saved in this browser only.</p>
    <button class="primary" id="again">Next Round</button><button id="profileResult">👤 Profile & Leaderboard</button><button id="setup">Back to Setup</button>
  </section>`;
  $("#again").onclick=startRound;$("#profileResult").onclick=()=>renderProfilePanel(renderSetup);$("#setup").onclick=renderSetup;
}
renderSetup();

function v90MountArranger() {
  const root = document.querySelector("#v90Arranger");
  if (root && state.phase === "DISCARD") v90RenderArranger(root);
}
window.v90MountArranger = v90MountArranger;
