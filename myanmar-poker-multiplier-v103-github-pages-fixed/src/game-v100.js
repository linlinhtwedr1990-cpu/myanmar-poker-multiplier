
(function(){
  "use strict";

  const SUITS = ["♠","♥","♦","♣"];
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  function makeDeck(){
    const d=[];
    let n=0;
    for(let deck=1;deck<=2;deck++){
      for(const suit of SUITS){
        for(const rank of RANKS){
          d.push({id:`c${++n}`,rank,suit,joker:false,deck});
        }
      }
    }
    d.push({id:"rj1",rank:"JOKER",suit:"",joker:true,jokerColor:"RED"});
    d.push({id:"rj2",rank:"JOKER",suit:"",joker:true,jokerColor:"RED"});
    d.push({id:"bj1",rank:"JOKER",suit:"",joker:true,jokerColor:"BLACK"});
    d.push({id:"bj2",rank:"JOKER",suit:"",joker:true,jokerColor:"BLACK"});
    return d;
  }

  function shuffle(a){
    const x=a.slice();
    for(let i=x.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [x[i],x[j]]=[x[j],x[i]];
    }
    return x;
  }

  function rankVal(r){
    if(r==="A") return 1;
    if(r==="J") return 11;
    if(r==="Q") return 12;
    if(r==="K") return 13;
    return Number(r);
  }

  function isSenior(cards, players){
    if(cards.length!==3) return false;
    const jok=cards.filter(c=>c.joker);
    const real=cards.filter(c=>!c.joker);
    const target=[3,4,5];
    if(jok.length===0){
      return real.every(c=>c.suit==="♦") &&
        target.every(v=>real.some(c=>rankVal(c.rank)===v));
    }
    if(jok.length===1 && real.length===2){
      return real.every(c=>c.suit==="♦") &&
        real.every(c=>target.includes(rankVal(c.rank))) &&
        new Set(real.map(c=>rankVal(c.rank))).size===2;
    }
    return false;
  }

  function isHouse(cards){
    if(cards.length<3) return false;
    const real=cards.filter(c=>!c.joker);
    if(!real.length) return false;
    const r=real[0].rank;
    return real.every(c=>c.rank===r);
  }

  function isSequence(cards){
    if(cards.length<3 || cards.some(c=>c.joker)) return false;
    const vals=cards.map(c=>rankVal(c.rank)).sort((a,b)=>a-b);
    if(new Set(vals).size!==vals.length) return false;
    // Ordinary consecutive sequence, plus J-Q-K-A.
    const jqka=[10,11,12,13,1];
    if(vals.length===4 && vals.join(",")==="1,10,11,12") return false;
    if(vals.length===4 && vals.join(",")==="1,11,12,13") return true;
    for(let i=1;i<vals.length;i++) if(vals[i]!==vals[i-1]+1) return false;
    return true;
  }

  function validGroup(cards, players){
    return isSenior(cards,players)||isHouse(cards)||isSequence(cards);
  }

  function seniorRequirements(players){
    if(players===3) return {trueSenior:2,jokerSenior:0};
    if(players===4) return {trueSenior:1,jokerSenior:1};
    return {trueSenior:1,jokerSenior:0};
  }

  function validateArrangement(groups, hand, players){
    const flat=groups.flat();
    const ids=flat.map(c=>c.id);
    if(flat.length!==13 || ids.length!==new Set(ids).size) return {ok:false,reason:"Arrangement must contain exactly 13 unique cards."};
    const handIds=new Set(hand.map(c=>c.id));
    if(ids.some(id=>!handIds.has(id))) return {ok:false,reason:"Arrangement contains a card not in the hand."};
    if(groups.some(g=>!validGroup(g,players))) return {ok:false,reason:"One or more groups are invalid."};
    let ts=0, js=0;
    for(const g of groups){
      if(isSenior(g,players)){
        if(g.some(c=>c.joker)) js++; else ts++;
      }
    }
    const req=seniorRequirements(players);
    if(ts<req.trueSenior || js<req.jokerSenior) return {ok:false,reason:`Senior requirement: ${req.trueSenior} True Senior + ${req.jokerSenior} Joker Senior.`};
    return {ok:true,trueSenior:ts,jokerSenior:js};
  }

  function bonusMultiplier(hand){
    const ac=hand.filter(c=>c.rank==="A" && c.suit==="♠").length;
    const sevens=hand.filter(c=>c.rank==="7" && c.suit==="♦").length;
    const redJ=hand.filter(c=>c.joker && c.jokerColor==="RED").length;
    if(ac>=1 && sevens>=1 && redJ>=1) return 5;
    if(ac>=2 || sevens>=2) return 3;
    return 1;
  }

  function winMultiplier(arr, hand, streak){
    let m=1;
    if(arr.trueSenior>=2 && arr.jokerSenior===0) m=Math.max(m,2);
    if(streak>=2) m=Math.max(m,2); // this win makes the streak 3
    if(hand.filter(c=>c.joker).length===4) m=Math.max(m,3);
    return m;
  }

  function money(n){ return `${Math.round(n).toLocaleString()} MMK`; }

  class GameV100{
    constructor(){
      this.state=null;
      this.subscribers=[];
    }
    on(fn){this.subscribers.push(fn); return ()=>this.subscribers=this.subscribers.filter(x=>x!==fn);}
    emit(){this.subscribers.forEach(fn=>fn(this.state));}

    setup(cfg, silent=false){
      const players=cfg.players.map((p,i)=>({
        uid:`p${i+1}`, name:p.name||`Player ${i+1}`, avatar:p.avatar||"🙂",
        human:i===0, capital:cfg.startCapital, debt:{}, eliminated:false,
        wins:0, streak:0, totalWins:0
      }));
      this.state={
        settings:{playerCount:players.length,startCapital:cfg.startCapital,maxDebt:cfg.maxDebt,
          winningFee:cfg.winningFee,cardBonus:cfg.cardBonus},
        players, round:0, status:"READY", phase:"SETUP", winnerUid:null,
        deck:[],center:[],upper:null,lower:null,starterUid:null,turnUid:null,
        offer:null, history:[], settlement:null, message:"Ready to start."
      };
      if(!silent) this.emit();
    }

    startRound(){
      const s=this.state;
      s.round++;
      s.status="PLAYING"; s.phase="STARTER_DECISION"; s.winnerUid=null; s.settlement=null; s.offer=null;
      s.deck=shuffle(makeDeck());
      s.upper=s.deck.shift();
      s.players.forEach(p=>p.hand=[]);
      for(let i=0;i<13;i++) s.players.forEach(p=>p.hand.push(s.deck.shift()));
      s.lower=s.deck[s.deck.length-1] || null;
      s.center=s.deck.slice(0,-1);
      // Starter rotates each round.
      const starterIndex=(s.round-1)%s.players.length;
      s.starterUid=s.players[starterIndex].uid;
      s.turnUid=s.starterUid;
      s.message=`${s.players[starterIndex].name} is the starter.`;
      this.emit();
    }

    player(uid){return this.state.players.find(p=>p.uid===uid);}
    takeUpper(uid){
      const s=this.state;if(s.turnUid!==uid||s.phase!=="STARTER_DECISION")return this.fail("Not your decision.");
      const p=this.player(uid);
      if(!s.upper)return this.fail("No Upper Card.");
      p.hand.push(s.upper);
      s.upper=null;
      s.phase="DISCARD"; s.message=`${p.name} took the Upper Card. Choose one card to discard.`;
      this.emit();
    }
    rejectUpper(uid){
      const s=this.state;if(s.turnUid!==uid||s.phase!=="STARTER_DECISION")return this.fail("Not your decision.");
      s.phase="DRAW"; s.message=`${this.player(uid).name} rejected Upper. Draw from Center.`;
      this.emit();
    }
    draw(uid){
      const s=this.state;if(s.turnUid!==uid||s.phase!=="DRAW")return this.fail("You cannot draw now.");
      const p=this.player(uid); const c=s.center.shift();
      if(!c)return this.fail("Center is empty.");
      p.hand.push(c); s.phase="OFFER"; s.message=`${p.name} drew a card. You may offer one card to the player on your right.`;
      this.emit();
    }
    offer(uid,cardId){
      const s=this.state;if(s.turnUid!==uid||s.phase!=="OFFER")return this.fail("You cannot offer now.");
      const p=this.player(uid); const idx=p.hand.findIndex(c=>c.id===cardId);
      if(idx<0)return this.fail("Card not found.");
      const right=s.players[(s.players.indexOf(p)+1)%s.players.length];
      const c=p.hand.splice(idx,1)[0];
      s.offer={fromUid:uid,toUid:right.uid,card:c};
      s.phase="RESPONSE"; s.message=`${right.name} may accept the offered card or reject it.`;
      this.emit();
    }
    accept(uid){
      const s=this.state;if(s.phase!=="RESPONSE"||!s.offer||s.offer.toUid!==uid)return this.fail("No card is offered to you.");
      const p=this.player(uid); p.hand.push(s.offer.card);
      s.offer=null;s.phase="DISCARD";s.turnUid=uid;s.message=`${p.name} accepted the offered card. Discard one card.`;
      this.emit();
    }
    reject(uid){
      const s=this.state;if(s.phase!=="RESPONSE"||!s.offer||s.offer.toUid!==uid)return this.fail("No card is offered to you.");
      s.offer=null;s.phase="DRAW";s.turnUid=uid;s.message=`${this.player(uid).name} rejected the offer. Draw from Center.`;
      this.emit();
    }
    discard(uid,cardId){
      const s=this.state;if(s.turnUid!==uid||s.phase!=="DISCARD")return this.fail("Discard is not available.");
      const p=this.player(uid); if(p.hand.length!==14)return this.fail("You must have 14 cards before discarding.");
      const idx=p.hand.findIndex(c=>c.id===cardId);if(idx<0)return this.fail("Card not found.");
      p.hand.splice(idx,1);
      const next=s.players[(s.players.indexOf(p)+1)%s.players.length];
      s.turnUid=next.uid;s.phase="DRAW";s.message=`${next.name}'s turn: draw from Center.`;
      this.emit();
    }
    play(uid,groups){
      const s=this.state;if(s.turnUid!==uid||s.phase!=="DISCARD")return this.fail("Play is only available after drawing/receiving.");
      const p=this.player(uid);
      const v=validateArrangement(groups,p.hand,s.settings.playerCount);
      if(!v.ok)return this.fail(v.reason);
      if(p.hand.length!==13)return this.fail("You must have exactly 13 cards.");
      this.finishRound(uid,v);
    }
    finishRound(uid,arr){
      const s=this.state; const winner=this.player(uid);
      winner.wins++; winner.streak++; winner.totalWins++;
      s.players.filter(p=>p.uid!==uid).forEach(p=>p.streak=0);
      const wf=winMultiplier(arr,winner.hand,winner.streak);
      const bm=bonusMultiplier(winner.hand);
      const payments=[];
      // Winner's winning fee is paid by every non-winner.
      for(const p of s.players){
        if(p.uid!==uid) payments.push({from:p.uid,to:uid,amount:s.settings.winningFee*wf,reason:"Winning Fee"});
      }
      // Loser-to-loser bonus differences.
      const losers=s.players.filter(p=>p.uid!==uid);
      const counts=losers.map(p=>({p,count:countBonus(p.hand)}));
      for(let i=0;i<counts.length;i++) for(let j=i+1;j<counts.length;j++){
        const a=counts[i],b=counts[j];
        const diff=Math.abs(a.count-b.count)*s.settings.cardBonus;
        if(!diff)continue;
        if(a.count>b.count) payments.push({from:a.p.uid,to:b.p.uid,amount:diff,reason:"Card Bonus"});
        else payments.push({from:b.p.uid,to:a.p.uid,amount:diff,reason:"Card Bonus"});
      }
      // Apply payments, allowing debt down to -maxDebt.
      for(const pay of payments){
        const from=this.player(pay.from), to=this.player(pay.to);
        from.capital-=pay.amount; to.capital+=pay.amount;
        if(from.capital<0){
          const debtAmt=Math.min(-from.capital,s.settings.maxDebt);
          from.debt[to.uid]=(from.debt[to.uid]||0)+debtAmt;
        }
      }
      // Mark eliminated players at threshold.
      for(const p of s.players){
        if(p.capital<=-s.settings.maxDebt){p.capital=-s.settings.maxDebt;p.eliminated=true;}
      }
      // Add special winner bonus as a separate reward, not deducted from losers.
      if(bm>1){ winner.capital += s.settings.cardBonus*(bm-1); }
      const rows=s.players.map(p=>({uid:p.uid,name:p.name,capital:p.capital,debt:Object.entries(p.debt).map(([to,amount])=>({to,amount}))}));
      s.winnerUid=uid;s.status="FINISHED";s.phase="FINISHED";
      s.settlement={winnerUid:uid,winningFeeMultiplier:wf,cardBonusMultiplier:bm,payments,rows};
      s.message=`${winner.name} wins Round ${s.round}!`;
      s.history.push({round:s.round,winnerUid:uid,winnerName:winner.name,settlement:s.settlement});
      this.emit();
    }
    fail(msg){this.state.message=msg;this.emit();return false;}
  }

  function countBonus(hand){
    return hand.filter(c=>(c.rank==="A"&&c.suit==="♠")||(c.rank==="7"&&c.suit==="♦")||c.joker).length;
  }

  window.MMGameV100={GameV100,makeDeck,validateArrangement,seniorRequirements,bonusMultiplier,countBonus,money};
})();
