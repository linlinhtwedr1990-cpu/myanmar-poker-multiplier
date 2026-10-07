(function(){
'use strict';
const G=window.MMGameV100, root=document.getElementById('app');
const avatars=['🙂','😎','😄','🤠','🧑‍💼'];
const state={mode:null,peer:null,conn:null,connections:[],room:null,isHost:false,uid:null,name:'',avatar:'🙂',roster:[],game:null,mirror:null,selected:new Set(),groups:[],newlyDrawnId:null,message:'',status:'offline'};
function uid(){return 'P'+Math.random().toString(36).slice(2,9).toUpperCase()}
function roomCode(){return 'MP-'+Math.random().toString(36).slice(2,7).toUpperCase()}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function money(n){return G.money(n)}
function player(id){return state.mirror?.players.find(p=>p.uid===id)}
function localPlayer(){return player(state.uid)}
function send(m){if(state.conn?.open)state.conn.send(m)}
function broadcast(m){state.connections=state.connections.filter(c=>c&&c.open);state.connections.forEach(c=>c.send(m))}
function publicRoster(){return state.roster.map(p=>({uid:p.uid,name:p.name,avatar:p.avatar,host:!!p.host}))}
function hostRoster(){return [{uid:state.uid,name:state.name,avatar:state.avatar,host:true},...state.roster.filter(p=>p.uid!==state.uid)]}
function makeProjection(){
 const s=state.game.state;
 return {settings:s.settings,round:s.round,status:s.status,phase:s.phase,winnerUid:s.winnerUid,starterUid:s.starterUid,turnUid:s.turnUid,upper:s.upper,lower:s.lower,centerCount:s.center.length,offer:s.offer?{fromUid:s.offer.fromUid,toUid:s.offer.toUid,card:s.offer.card}:null,message:s.message,players:s.players.map(p=>({uid:p.uid,name:p.name,avatar:p.avatar,capital:p.capital,eliminated:p.eliminated,wins:p.wins,streak:p.streak,handCount:p.hand.length,hand:p.uid===arguments[0]?p.hand:undefined})),settlement:s.settlement};
}
function projectFor(uid){
 const s=state.game.state;
 return {settings:s.settings,round:s.round,status:s.status,phase:s.phase,winnerUid:s.winnerUid,starterUid:s.starterUid,turnUid:s.turnUid,upper:s.upper,lower:s.lower,centerCount:s.center.length,offer:s.offer?{fromUid:s.offer.fromUid,toUid:s.offer.toUid,card:s.offer.card}:null,message:s.message,players:s.players.map(p=>{const x={uid:p.uid,name:p.name,avatar:p.avatar,capital:p.capital,eliminated:p.eliminated,wins:p.wins,streak:p.streak,handCount:p.hand.length};if(p.uid===uid)x.hand=p.hand;return x}),settlement:s.settlement};
}
function sync(){broadcast({type:'state',state:projectFor('__PUBLIC__')});state.connections.forEach(c=>{const uid=c.__playerUid;if(uid)c.send({type:'state',state:projectFor(uid)})}); render();}
// Broadcast public projection separately so no client's hand leaks.
function syncAll(){state.connections=state.connections.filter(c=>c&&c.open);for(const c of state.connections){if(c.__playerUid)c.send({type:'state',state:projectFor(c.__playerUid)})}state.mirror=projectFor(state.uid);render()}
function createRoom(){
 state.mode='host';state.isHost=true;state.uid=uid();state.room=roomCode();state.status='connecting';state.game=new G.GameV100();
 state.peer=new Peer('mm-poker-'+state.room.replace(/[^A-Z0-9]/g,''),{debug:0});
 state.peer.on('open',()=>{state.status='ready';state.message='Room created. Share the room code with the other players.';state.roster=hostRoster();render()});
 state.peer.on('connection',c=>{c.on('open',()=>{if(hostRoster().length>=5){c.send({type:'full'});c.close();return}state.connections.push(c);c.on('data',m=>hostMessage(c,m));c.on('close',()=>{state.roster=hostRoster().filter(p=>p.uid!==c.__playerUid);syncRoster();});c.on('error',()=>{});});});
 state.peer.on('error',e=>{state.status='error';state.message='Room error: '+e.type;render()});render();
}
function syncRoster(){state.roster=hostRoster();broadcast({type:'roster',players:publicRoster()});render()}
function hostMessage(c,m){
 if(!m)return;
 if(m.type==='join'){if(hostRoster().length>=5){c.send({type:'full'});c.close();return}const p={...m.player,host:false};c.__playerUid=p.uid;state.roster=hostRoster().filter(x=>x.uid!==p.uid).concat(p);c.send({type:'welcome',room:state.room,players:publicRoster(),status:state.game.state?.status||'READY'});syncRoster();if(state.game.state?.status==='PLAYING')c.send({type:'state',state:projectFor(p.uid)});return}
 if(m.type==='start'&&state.isHost){startGame();return}
 if(m.type==='action'&&state.isHost){handleAction(c.__playerUid,m.action,m.data||{});return}
}
function joinRoom(){
 const code=document.getElementById('roomCode').value.trim().toUpperCase();if(!/^MP-[A-Z0-9]{5}$/.test(code)){alert('Enter a room code such as MP-ABCDE.');return}
 state.mode='client';state.isHost=false;state.uid=uid();state.room=code;state.status='connecting';state.peer=new Peer(undefined,{debug:0});
 state.peer.on('open',()=>{state.conn=state.peer.connect('mm-poker-'+code.replace(/[^A-Z0-9]/g,''),{reliable:true});state.conn.on('open',()=>state.conn.send({type:'join',player:{uid:state.uid,name:state.name,avatar:state.avatar}}));state.conn.on('data',clientMessage);state.conn.on('close',()=>{state.status='error';state.message='Disconnected from host.';render()})});
 state.peer.on('error',e=>{state.status='error';state.message='Could not join room: '+e.type;render()});render();
}
function clientMessage(m){if(!m)return;if(m.type==='welcome'){state.status='ready';state.message='Connected. Waiting for the host.';state.roster=m.players;render()}if(m.type==='roster'){state.roster=m.players;render()}if(m.type==='state'){state.mirror=m.state;state.status=m.state.status==='PLAYING'?'playing':state.status;state.newlyDrawnId=null;render()}if(m.type==='full'){state.status='error';state.message='Room is full.';render()}if(m.type==='notice'){state.message=m.message;render()}}
function startGame(){
 if(!state.isHost||hostRoster().length<3)return;
 const ps=hostRoster().map(p=>({name:p.name,avatar:p.avatar}));
 state.game.setup({players:ps,startCapital:5000,winningFee:500,cardBonus:100,maxDebt:500},true);
 state.game.state.players.forEach((p,i)=>p.uid=hostRoster()[i].uid);
 state.game.startRound();
 state.roster=hostRoster();syncAll();
}
function request(action,data){if(state.isHost){handleAction(state.uid,action,data);return}send({type:'action',action,data})}
function handleAction(uid0,action,data){if(!state.game||!uid0)return;const s=state.game.state;if(s.status!=='PLAYING')return;
 try{
  if(action==='takeUpper')state.game.takeUpper(uid0);
  else if(action==='rejectUpper')state.game.rejectUpper(uid0);
  else if(action==='draw')state.game.draw(uid0);
  else if(action==='offer')state.game.offer(uid0,data.cardId);
  else if(action==='accept')state.game.accept(uid0);
  else if(action==='reject')state.game.reject(uid0);
  else if(action==='discard')state.game.discard(uid0,data.cardId);
  else if(action==='play'){const p=state.game.player(uid0);const groups=(data.groups||[]).map(ids=>ids.map(id=>p.hand.find(c=>c.id===id)).filter(Boolean));state.game.play(uid0,groups)}
  else return;
  syncAll();
 }catch(e){const c=state.connections.find(x=>x.__playerUid===uid0);if(c)c.send({type:'notice',message:'Action failed: '+e.message})}
}
function leave(){try{state.connections.forEach(c=>c.close());state.conn?.close();state.peer?.destroy()}catch(e){}location.reload()}
function render(){if(!state.mode)return renderLobbyHome();if(state.mode==='client'&&state.status==='connecting')return renderConnecting();if(state.mirror?.status==='PLAYING'||state.mirror?.status==='FINISHED')return renderGame();return renderLobby()}
function renderLobbyHome(){root.innerHTML=`<div class="lobby card"><h1>🃏 Myanmar Poker Multiplier</h1><p class="muted"><b>V10.2 — Real-Player Multiplayer</b></p><div class="grid2"><label>Your Name<input id="mpName" value="Lin"></label><label>Avatar<select id="mpAvatar">${avatars.map(a=>`<option>${a}</option>`).join('')}</select></label></div><div class="lobby-actions"><button class="primary" id="create">🏠 Create Room</button><button id="showJoin">🔑 Join Room</button></div><div class="rulebox"><b>How it works</b><br>Each person uses their own device. No AI players. Your cards are private to you; only the public game state is synchronized.</div></div>`;document.getElementById('create').onclick=()=>{readIdentity();createRoom()};document.getElementById('showJoin').onclick=()=>{readIdentity();root.querySelector('.lobby-actions').innerHTML=`<label>Room Code<input id="roomCode" placeholder="MP-ABCDE" maxlength="8" value="${esc(new URLSearchParams(location.search).get('room')||'')}"></label><button class="primary" id="join">Join Room</button><button id="back">Back</button>`;document.getElementById('join').onclick=joinRoom;document.getElementById('back').onclick=renderLobbyHome}}
function readIdentity(){state.name=(document.getElementById('mpName')?.value||'Player').trim()||'Player';state.avatar=document.getElementById('mpAvatar')?.value||'🙂'}
function renderConnecting(){root.innerHTML=`<div class="lobby card"><h1>🃏 Connecting…</h1><p>${esc(state.message||'Connecting to room '+state.room)}</p></div>`}
function renderLobby(){const list=state.isHost?hostRoster():state.roster;root.innerHTML=`<div class="lobby card"><div class="room-head"><span>ROOM</span><strong class="room-code">${esc(state.room)}</strong><button id="copy">📋 Copy Invite</button></div><div class="status ${esc(state.status)}">${esc(state.message||state.status)}</div><h2>Players <small>${list.length}/5</small></h2><div class="lobby-players">${list.map(p=>`<div class="lobby-player"><span class="avatar">${p.avatar}</span> <b>${esc(p.name)}</b>${p.host?'<span class="host">HOST</span>':''}<span class="connected">● Connected</span></div>`).join('')}</div>${state.isHost?`<button class="primary" id="start" ${list.length<3?'disabled':''}>▶ Start Game (${list.length}/3–5)</button>`:'<p class="muted">Waiting for the host to start the game…</p>'}<button id="leave">Leave Room</button></div>`;document.getElementById('copy').onclick=()=>{const u=new URL(location.href);u.searchParams.set('room',state.room);const text=`Join my Myanmar Poker room: ${u.toString()}`;navigator.clipboard?.writeText(text).then(()=>toast('Invite link copied')).catch(()=>prompt('Copy this invite link:',text));};document.getElementById('leave').onclick=leave;const b=document.getElementById('start');if(b)b.onclick=startGame}
function toast(t){const x=document.createElement('div');x.className='toast';x.textContent=t;document.body.appendChild(x);setTimeout(()=>x.remove(),1600)}
function cardName(c){return c?.joker?'JOKER':`${c?.rank||''}${c?.suit||''}`}
function cardClass(c){if(c?.joker)return `joker ${c.jokerColor==='RED'?'joker-red':'joker-black'}`;return c.suit==='♥'||c.suit==='♦'?'red-card':'black-card'}
function rankVal(r){return r==='A'?1:r==='J'?11:r==='Q'?12:r==='K'?13:Number(r)}
function sortHand(hand,mode){const suit={'♦':0,'♥':1,'♣':2,'♠':3};return hand.slice().sort((a,b)=>{if(mode==='number')return (a.joker?99:rankVal(a.rank))-(b.joker?99:rankVal(b.rank))||a.suit.localeCompare(b.suit);if(mode==='color'){const c=x=>x.joker?(x.jokerColor==='RED'?0:1):((x.suit==='♥'||x.suit==='♦')?0:1);return c(a)-c(b)||(a.joker?99:rankVal(a.rank))-(b.joker?99:rankVal(b.rank));}const sa=a.joker?99:suit[a.suit],sb=b.joker?99:suit[b.suit];return sa-sb||(a.joker?99:rankVal(a.rank))-(b.joker?99:rankVal(b.rank))})}
function cardHTML(c,sel){return `<button draggable="true" class="cardface ${cardClass(c)} ${sel?'sel':''}" data-id="${c.id}">${c.joker?`<span class="joker-mark">🃏</span><span class="joker-text">${c.jokerColor} JOKER</span>`:`<span class="rank">${esc(c.rank)}</span><span class="suit">${esc(c.suit)}</span>`}</button>`}
function renderGame(){const s=state.mirror,me=localPlayer();if(!me)return renderLobby();if(s.status==='FINISHED')return renderResult();const can=s.turnUid===state.uid;root.innerHTML=`<div class="game-shell"><div class="netbar"><b>ROOM ${esc(state.room)}</b><span class="sync-dot">🟢 ${state.isHost?'HOST':'CONNECTED'} · ${s.message}</span><button id="leave">Leave</button></div><div class="topbar"><div><b>Round ${s.round}</b> · ${esc(s.message)}</div><div>Capital: <b>${money(me.capital)}</b></div></div><div class="table"><div class="mascot">👨‍🦲 <b>Owner Lin</b><span>Creator mascot</span></div><div class="center"><div class="marker">UPPER · STARTER DECISION</div><div class="bigcard">${s.upper?cardName(s.upper):'—'}</div><div class="pile">CENTER<br><b>${s.centerCount}</b></div><div class="marker">LOWER · BONUS CARD</div><div class="bigcard">${s.lower?cardName(s.lower):'—'}</div>${s.offer?`<div class="offerbox">Offered: <b>${cardName(s.offer.card)}</b><br>${esc(player(s.offer.fromUid)?.name)} → ${esc(player(s.offer.toUid)?.name)}</div>`:''}</div><div class="seats">${s.players.map(p=>`<div class="seat ${p.uid===s.turnUid?'turn':''} ${p.uid===state.uid?'my-seat':''} ${p.eliminated?'eliminated':''}"><div class="avatar">${p.avatar}</div><b>${esc(p.name)}</b><span>${p.handCount} cards</span><span>${money(p.capital)}</span></div>`).join('')}</div></div><div class="controls card">${controls(s,me,can)}</div><div class="hand card"><h3>Your Hand (${me.hand?.length||0})</h3><div class="sort-tools"><span>Arrange:</span><button id="sortNumber">Number ↑</button><button id="sortColor">Color + Number</button><button id="sortSuit">Suit + Number</button><span class="drag-note">↔ Drag cards manually</span></div><div id="handCards" class="cards">${(me.hand||[]).map(c=>cardHTML(c,state.selected.has(c.id))).join('')}</div><div class="arranger"><button id="group">Group Selected</button><button id="clear">Clear Groups</button><button id="play" class="primary">PLAY / WIN</button><div id="groups">${state.groups.map((g,i)=>`<div>Group ${i+1}: ${g.map(id=>cardName(me.hand.find(c=>c.id===id))).join(' ')}</div>`).join('')}</div></div></div></div>`;bindGameUI(s,me,can)}
function controls(s,me,can){if(!can)return `<p>⏳ Waiting for <b>${esc(player(s.turnUid)?.name||'player')}</b>…</p>`;if(s.phase==='STARTER_DECISION')return `<button id="take">Take Upper Card</button><button id="reject">Reject Upper</button>`;if(s.phase==='DRAW')return `<button id="draw" class="primary">Draw from Center</button>`;if(s.phase==='OFFER')return `<p>Select one card, then offer it to the player on your right.</p><button id="offer">Offer Selected Card</button>`;if(s.phase==='RESPONSE'&&s.offer?.toUid===state.uid)return `<p>Offered: <b>${cardName(s.offer.card)}</b></p><button id="accept" class="primary">Accept</button><button id="rejectOffer">Reject</button>`;if(s.phase==='RESPONSE')return `<p>Waiting for ${esc(player(s.offer?.toUid)?.name||'player')}…</p>`;if(s.phase==='DISCARD')return `<p>Choose one card to discard, or build your 13-card winning arrangement.</p><button id="discard">Discard Selected Card</button>`;return ''}
function bindGameUI(s,me,can){const q=id=>document.getElementById(id);q('leave').onclick=leave;document.querySelectorAll('.cardface').forEach(b=>{b.onclick=()=>{const id=b.dataset.id;state.selected.has(id)?state.selected.delete(id):state.selected.add(id);renderGame()};b.ondragstart=e=>e.dataTransfer.setData('text/plain',b.dataset.id);b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const a=me.hand.findIndex(c=>c.id===e.dataTransfer.getData('text/plain')),z=me.hand.findIndex(c=>c.id===b.dataset.id);if(a>=0&&z>=0){const [x]=me.hand.splice(a,1);me.hand.splice(z,0,x);renderGame()}}});if(q('sortNumber'))q('sortNumber').onclick=()=>{me.hand=sortHand(me.hand,'number');state.groups=[];state.selected.clear();renderGame()};if(q('sortColor'))q('sortColor').onclick=()=>{me.hand=sortHand(me.hand,'color');state.groups=[];state.selected.clear();renderGame()};if(q('sortSuit'))q('sortSuit').onclick=()=>{me.hand=sortHand(me.hand,'suit');state.groups=[];state.selected.clear();renderGame()};if(q('group'))q('group').onclick=()=>{const ids=me.hand.filter(c=>state.selected.has(c.id)).map(c=>c.id);if(ids.length){state.groups.push(ids);state.selected.clear();renderGame()}};if(q('clear'))q('clear').onclick=()=>{state.groups=[];state.selected.clear();renderGame()};if(q('play'))q('play').onclick=()=>{if(state.groups.length)request('play',{groups:state.groups});else toast('Create your winning groups first.')};if(q('take'))q('take').onclick=()=>request('takeUpper');if(q('reject'))q('reject').onclick=()=>request('rejectUpper');if(q('draw'))q('draw').onclick=()=>request('draw');if(q('offer'))q('offer').onclick=()=>{const id=[...state.selected][0];if(id)request('offer',{cardId:id});else toast('Select a card to offer.')};if(q('accept'))q('accept').onclick=()=>request('accept');if(q('rejectOffer'))q('rejectOffer').onclick=()=>request('reject');if(q('discard'))q('discard').onclick=()=>{const id=[...state.selected][0];if(id)request('discard',{cardId:id});else toast('Select a card to discard.')}}
function renderResult(){const s=state.mirror,me=localPlayer(),w=player(s.winnerUid);root.innerHTML=`<div class="result card"><div class="winner">🎉 ${esc(w?.name||'Player')} WINS!</div><p>Round ${s.round} · Winning Fee ×${s.settlement?.winningFeeMultiplier||1} · Card Bonus ×${s.settlement?.cardBonusMultiplier||1}</p><h2>Settlement</h2><table><tr><th>Player</th><th>Capital</th><th>Debt</th></tr>${(s.settlement?.rows||[]).map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.capital)}</td><td>${r.debt?.length?r.debt.map(d=>money(d.amount)+' → '+esc(player(d.to)?.name||d.to)).join('<br>'):'—'}</td></tr>`).join('')}</table><button id="leave" class="primary">Back to Lobby</button></div>`;document.getElementById('leave').onclick=leave}
render();
const invite=new URLSearchParams(location.search).get('room');
if(invite && /^MP-[A-Z0-9]{5}$/.test(invite.toUpperCase())){ setTimeout(()=>{readIdentity(); joinRoom();},250); }
})();
