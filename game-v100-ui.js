
(function(){
  "use strict";
  const G=window.MMGameV100;
  const root=document.getElementById("app");
  const game=new G.GameV100();
  let selected=new Set(), groups=[], newlyDrawnId=null;

  const avatars=["🙂","😎","😄","🤠","🧑‍💼"];
  function cardName(c){return c.joker?`JOKER`:`${c.rank}${c.suit}`;}
  function cardClass(c){
    if(c.joker) return `joker ${c.jokerColor==="RED"?"joker-red":"joker-black"}`;
    return (c.suit==="♥"||c.suit==="♦") ? "red-card" : "black-card";
  }
  function uiRankValue(r){
    if(r==="A") return 1;
    if(r==="J") return 11;
    if(r==="Q") return 12;
    if(r==="K") return 13;
    return Number(r);
  }
  function sortNumber(hand){
    return hand.slice().sort((a,b)=>{
      if(a.joker && b.joker) return a.jokerColor.localeCompare(b.jokerColor);
      if(a.joker) return 99;
      if(b.joker) return 99;
      return uiRankValue(a.rank)-uiRankValue(b.rank) || a.suit.localeCompare(b.suit);
    });
  }
  function sortColorNumber(hand){
    const color=c=>c.joker ? (c.jokerColor==="RED"?0:1) : ((c.suit==="♥"||c.suit==="♦")?0:1);
    return hand.slice().sort((a,b)=>{
      return color(a)-color(b) ||
        (a.joker?99:uiRankValue(a.rank))-(b.joker?99:uiRankValue(b.rank)) ||
        a.suit.localeCompare(b.suit);
    });
  }
  function sortSuitNumber(hand){
    const suitOrder={"♦":0,"♥":1,"♣":2,"♠":3};
    return hand.slice().sort((a,b)=>{
      const sa=a.joker?99:(suitOrder[a.suit] ?? 98);
      const sb=b.joker?99:(suitOrder[b.suit] ?? 98);
      return sa-sb ||
        (a.joker?99:uiRankValue(a.rank))-(b.joker?99:uiRankValue(b.rank)) ||
        (a.jokerColor||"").localeCompare(b.jokerColor||"");
    });
  }
  function cardHTML(c, selected){
    return `<button draggable="true" class="cardface ${cardClass(c)} ${selected?"sel":""} ${typeof newlyDrawnId!=="undefined" && newlyDrawnId===c.id?"new-card":""}" data-id="${c.id}">
      ${c.joker?`<span class="joker-mark">🃏</span><span class="joker-text">${c.jokerColor} JOKER</span>`:`<span class="rank">${esc(c.rank)}</span><span class="suit">${esc(c.suit)}</span>`}
    </button>`;
  }
  function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
  function player(uid){return game.state.players.find(p=>p.uid===uid);}
  function renderSetup(){
    root.innerHTML=`<div class="setup card">
      <h1>🃏 Myanmar Poker Multiplier</h1>
      <p class="muted">V10.0 — Actual Local Gameplay</p>
      <div class="grid2">
        <label>Players <select id="pc"><option>3</option><option selected>4</option><option>5</option></select></label>
        <label>Starting Capital <input id="capital" type="number" value="5000" min="500"></label>
        <label>Winning Fee <input id="wf" type="number" value="500" min="0"></label>
        <label>Card Bonus <input id="cb" type="number" value="100" min="0"></label>
        <label>Maximum Debt <input id="md" type="number" value="500" min="100"></label>
      </div>
      <h2>Players</h2><div id="names"></div>
      <button class="primary" id="start">Start Game</button>
      <div class="rulebox"><b>Economy</b><br>Each player starts with 5,000 MMK. A player reaching −500 MMK is eliminated. The game records exactly whom the eliminated player owes.</div>
    </div>`;
    const names=document.getElementById("names");
    function rebuild(){
      const n=+document.getElementById("pc").value;
      names.innerHTML=Array.from({length:n},(_,i)=>`<label>${avatars[i]} Player ${i+1}<input class="pname" value="${i===0?"Lin":`Player ${i+1}`}"></label>`).join("");
    }
    document.getElementById("pc").onchange=rebuild; rebuild();
    document.getElementById("start").onclick=()=>{
      const n=+document.getElementById("pc").value;
      const ps=[...document.querySelectorAll(".pname")].map((x,i)=>({name:x.value.trim()||`Player ${i+1}`,avatar:avatars[i]}));
      // Configure the game without emitting a render between setup and round start.
      // This avoids replacing the clicked Start Game button mid-event.
      game.setup({players:ps,startCapital:+capital.value,winningFee:+wf.value,cardBonus:+cb.value,maxDebt:+md.value}, true);
      game.startRound();
    };
  }

  function render(){
    const s=game.state;if(!s){renderSetup();return;}
    if(s.status==="FINISHED"){renderResult();return;}
    const me=player(s.players[0].uid);
    root.innerHTML=`<div class="topbar"><div><b>Round ${s.round}</b> · ${esc(s.message)}</div><div>Capital: <b>${G.money(me.capital)}</b></div></div>
      <div class="table">
        <div class="mascot">👨‍🦲 <b>Owner Lin</b><span>Creator mascot</span></div>
        <div class="center"><div class="marker">UPPER · STARTER DECISION</div><div class="bigcard">${cardName(s.upper)}</div><div class="pile">CENTER<br><b>${s.center.length}</b></div><div class="marker">LOWER · BONUS CARD</div><div class="bigcard">${s.lower?cardName(s.lower):"—"}</div></div>
        <div class="seats">${s.players.map((p,i)=>`<div class="seat ${p.uid===s.turnUid?"turn":""} ${p.eliminated?"eliminated":""}">
          <div class="avatar">${p.avatar}</div><b>${esc(p.name)}</b><span>${p.hand.length} cards</span><span>${G.money(p.capital)}</span></div>`).join("")}</div>
      </div>
      <div class="controls card">${controls(me,s)}</div>
      <div class="hand card"><h3>Your Hand (${me.hand.length})</h3>
      <div class="sort-tools">
        <span>Arrange:</span>
        <button id="sortNumber">Number ↑</button>
        <button id="sortColor">Color + Number</button>
        <button id="sortSuit">Suit + Number</button>
        <span class="drag-note">↔ Drag cards manually</span>
      </div>
      <div id="handCards" class="cards">${me.hand.map(c=>cardHTML(c,selected.has(c.id))).join("")}</div>
      <div class="arranger"><button id="group">Group Selected</button><button id="clear">Clear Groups</button><button id="play" class="primary">PLAY / WIN</button><div id="groups">${groups.map((g,i)=>`<div>Group ${i+1}: ${g.map(cardName).join(" ")}</div>`).join("")}</div></div></div>`;
    document.querySelectorAll(".cardface").forEach(b=>{
      b.onclick=()=>{const id=b.dataset.id;selected.has(id)?selected.delete(id):selected.add(id);render();};
      b.ondragstart=e=>{e.dataTransfer.setData("text/plain",b.dataset.id);b.classList.add("dragging");};
      b.ondragend=()=>b.classList.remove("dragging");
      b.ondragover=e=>e.preventDefault();
      b.ondrop=e=>{
        e.preventDefault();
        const from=e.dataTransfer.getData("text/plain"), to=b.dataset.id;
        const a=me.hand.findIndex(c=>c.id===from), z=me.hand.findIndex(c=>c.id===to);
        if(a>=0&&z>=0&&a!==z){const [m]=me.hand.splice(a,1);me.hand.splice(z,0,m);render();}
      };
    });
    const sortNumberBtn=document.getElementById("sortNumber");
    if(sortNumberBtn) sortNumberBtn.onclick=()=>{me.hand=sortNumber(me.hand);groups=[];selected.clear();render();};
    const sortColorBtn=document.getElementById("sortColor");
    if(sortColorBtn) sortColorBtn.onclick=()=>{me.hand=sortColorNumber(me.hand);groups=[];selected.clear();render();};
    const sortSuitBtn=document.getElementById("sortSuit");
    if(sortSuitBtn) sortSuitBtn.onclick=()=>{me.hand=sortSuitNumber(me.hand);groups=[];selected.clear();render();};
    const group=document.getElementById("group"); if(group)group.onclick=()=>{const cards=me.hand.filter(c=>selected.has(c.id));if(cards.length){groups.push(cards);selected.clear();render();}};
    const clear=document.getElementById("clear");if(clear)clear.onclick=()=>{groups=[];selected.clear();render();};
    const play=document.getElementById("play");if(play)play.onclick=()=>game.play(me.uid,groups);
    bindControls(me,s);
    if(newlyDrawnId){
      const drawn=me.hand.find(c=>c.id===newlyDrawnId);
      if(drawn){
        const target=document.querySelector(`[data-id="${CSS.escape(newlyDrawnId)}"]`);
        const center=document.querySelector(".pile");
        if(target && center){
          const from=center.getBoundingClientRect(), to=target.getBoundingClientRect();
          const flyer=document.createElement("div");
          flyer.className=`flying-card ${cardClass(drawn)}`;
          flyer.innerHTML=drawn.joker
            ? `<span class="fly-joker">🃏</span><small>${drawn.jokerColor} JOKER</small>`
            : `<b>${esc(drawn.rank)}</b><span>${esc(drawn.suit)}</span>`;
          flyer.style.left=(from.left+from.width/2-28)+"px";
          flyer.style.top=(from.top+from.height/2-38)+"px";
          document.body.appendChild(flyer);
          requestAnimationFrame(()=>{
            flyer.style.setProperty("--dx",(to.left+to.width/2-(from.left+from.width/2))+"px");
            flyer.style.setProperty("--dy",(to.top+to.height/2-(from.top+from.height/2))+"px");
            flyer.classList.add("fly");
          });
          setTimeout(()=>flyer.remove(),850);
          setTimeout(()=>{newlyDrawnId=null;render();},900);
          newlyDrawnId=null;
        }
      }
    }
  }

  function controls(me,s){
    if(s.turnUid!==me.uid)return `<p>⏳ Waiting for <b>${esc(player(s.turnUid).name)}</b>…</p>`;
    if(s.phase==="STARTER_DECISION")return `<button id="take">Take Upper Card</button><button id="reject">Reject Upper</button>`;
    if(s.phase==="DRAW")return `<button id="draw" class="primary">Draw from Center</button>`;
    if(s.phase==="OFFER")return `<p>Select one card in your hand, then choose <b>Offer to Right</b>.</p><button id="offer">Offer Selected Card</button>`;
    if(s.phase==="RESPONSE")return s.offer&&s.offer.toUid===me.uid?`<p>Offered: <b>${cardName(s.offer.card)}</b></p><button id="accept" class="primary">Accept</button><button id="rejectOffer">Reject</button>`:"";
    if(s.phase==="DISCARD")return `<p>Choose one card to discard, or build your 13-card winning arrangement.</p><button id="discard">Discard Selected Card</button>`;
    return "";
  }
  function bindControls(me,s){
    const q=id=>document.getElementById(id);
    if(q("take"))q("take").onclick=()=>game.takeUpper(me.uid);
    if(q("reject"))q("reject").onclick=()=>game.rejectUpper(me.uid);
    if(q("draw"))q("draw").onclick=()=>{
      if(game.state.center.length){
        newlyDrawnId=game.state.center[0].id;
        game.draw(me.uid);
      }
    };
    if(q("offer"))q("offer").onclick=()=>{const id=[...selected][0];if(id)game.offer(me.uid,id);};
    if(q("accept"))q("accept").onclick=()=>game.accept(me.uid);
    if(q("rejectOffer"))q("rejectOffer").onclick=()=>game.reject(me.uid);
    if(q("discard"))q("discard").onclick=()=>{const id=[...selected][0];if(id)game.discard(me.uid,id);};
  }

  function renderResult(){
    const s=game.state, me=player(s.players[0].uid), w=player(s.winnerUid);
    root.innerHTML=`<div class="result card"><div class="winner">🎉 ${esc(w.name)} WINS!</div>
      <p>Round ${s.round} · Winning Fee ×${s.settlement.winningFeeMultiplier} · Card Bonus ×${s.settlement.cardBonusMultiplier}</p>
      <h2>Settlement</h2>
      <table><tr><th>Player</th><th>Capital</th><th>Debt</th></tr>${s.settlement.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${G.money(r.capital)}</td><td>${r.debt.length?r.debt.map(d=>`${G.money(d.amount)} → ${esc(player(d.to).name)}`).join("<br>"):"—"}</td></tr>`).join("")}</table>
      <h2>Payment Ledger</h2>${s.settlement.payments.map(p=>`<div class="payment">${esc(player(p.from).name)} → ${esc(player(p.to).name)}: <b>${G.money(p.amount)}</b> <small>${esc(p.reason)}</small></div>`).join("")}
      ${me.eliminated?`<div class="danger"><b>ELIMINATED</b><br>${Object.entries(me.debt).map(([to,a])=>`${G.money(a)} → ${esc(player(to).name)}`).join("<br>")||"No outstanding creditor recorded."}</div>`:""}
      <button id="next" class="primary">Next Round</button><button id="setup">New Game</button></div>`;
    document.getElementById("next").onclick=()=>{ if(s.players.some(p=>p.eliminated)){alert("An eliminated player cannot continue. Start a New Game.");return;} game.startRound(); };
    document.getElementById("setup").onclick=()=>{game.state=null;renderSetup();};
  }

  game.on(()=>{selected.clear(); if(game.state?.status==="FINISHED"){} render();});
  renderSetup();
})();

