(function(){
  'use strict';
  const KEY='mm_poker_v101_player';
  const state={mode:null,peer:null,conn:null,connections:[],room:null,isHost:false,name:'',avatar:'🙂',players:[],status:'offline',message:''};
  const avatars=['🙂','😎','😄','🤠','🧑‍💼'];
  function uid(){return 'P'+Math.random().toString(36).slice(2,9).toUpperCase();}
  function roomCode(){return 'MP-'+Math.random().toString(36).slice(2,7).toUpperCase();}
  function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function send(msg){if(state.conn&&state.conn.open)state.conn.send(msg);}
  function broadcast(msg){state.connections=state.connections.filter(c=>c&&c.open);state.connections.forEach(c=>c.send(msg));}
  function roster(){return [{uid:state.playerUid,name:state.name,avatar:state.avatar,host:true},...state.players.filter(p=>p.uid!==state.playerUid)];}
  function publishRoster(){const list=roster();state.players=list;broadcast({type:'roster',players:list}); render();}
  function create(){
    state.mode='host'; state.isHost=true; state.room=roomCode(); state.playerUid=uid(); state.status='creating';
    state.peer=new Peer('mm-poker-'+state.room.replace(/[^A-Z0-9]/g,''),{debug:0});
    state.peer.on('open',()=>{state.status='ready';state.message='Room created. Share the room code with your players.';publishRoster();});
    state.peer.on('connection',c=>{c.on('open',()=>{if(roster().length>=5){c.send({type:'full'});c.close();return;} state.connections.push(c);c.send({type:'welcome',host:true,room:state.room,players:roster()}); publishRoster();});c.on('data',m=>onHostMessage(c,m));c.on('close',()=>{state.connections=state.connections.filter(x=>x!==c);publishRoster();});});
    state.peer.on('error',e=>{state.status='error';state.message='Could not create room: '+e.type;render();});
    render();
  }
  function join(){
    const code=document.getElementById('roomCode').value.trim().toUpperCase();
    if(!/^MP-[A-Z0-9]{5}$/.test(code)){alert('Enter a valid room code such as MP-7K42A.');return;}
    state.mode='client';state.isHost=false;state.room=code;state.playerUid=uid();state.status='connecting';
    state.peer=new Peer(undefined,{debug:0});
    state.peer.on('open',()=>{state.conn=state.peer.connect('mm-poker-'+code.replace(/[^A-Z0-9]/g,''),{reliable:true});state.conn.on('open',()=>state.conn.send({type:'join',player:{uid:state.playerUid,name:state.name,avatar:state.avatar}}));state.conn.on('data',onClientMessage);state.conn.on('close',()=>{state.status='offline';state.message='Disconnected from host.';render();});});
    state.peer.on('error',e=>{state.status='error';state.message='Could not join room: '+e.type;render();});render();
  }
  function onHostMessage(c,m){
    if(!m||m.type!=='join')return;
    if(roster().length>=5){c.send({type:'full'});c.close();return;}
    state.players.push(m.player);state.players=[...new Map(state.players.map(p=>[p.uid,p])).values()];c.send({type:'welcome',host:true,room:state.room,players:roster()});publishRoster();
  }
  function onClientMessage(m){
    if(!m)return;
    if(m.type==='welcome'){state.status='ready';state.message='Connected to host.';state.players=m.players;render();}
    if(m.type==='roster'){state.players=m.players;render();}
    if(m.type==='full'){state.status='error';state.message='This room already has 5 players.';render();}
    if(m.type==='start'){state.status='started';state.message='Game started by the host.';render();}
  }
  function leave(){try{state.connections.forEach(c=>c.close());state.conn&&state.conn.close();state.peer&&state.peer.destroy();}catch(e){};location.reload();}
  function copyInvite(){const text=`Join my Myanmar Poker room: ${state.room}`;if(navigator.clipboard)navigator.clipboard.writeText(text);alert('Room code copied: '+state.room);}
  function render(){
    const root=document.getElementById('app');
    if(!root)return;
    root.innerHTML=`<div class="setup card lobby">
      <h1>🃏 Myanmar Poker Multiplier</h1><p class="muted">V10.1 — Multiplayer Lobby</p>
      ${state.mode===null?`<div class="grid2"><label>Your Name<input id="mpName" value="Lin"></label><label>Avatar<select id="mpAvatar">${avatars.map(a=>`<option>${a}</option>`).join('')}</select></label></div><div class="lobby-actions"><button class="primary" id="createRoom">🏠 Create Room</button><button id="showJoin">🔑 Join Room</button></div><div class="rulebox"><b>How players join</b><br>Create a room, send the room code to your friends, and they join from their own phones or computers.</div>`:
      `<div class="room-head"><span>ROOM</span><strong>${esc(state.room||'—')}</strong><button id="copyRoom">📋 Copy Code</button></div><div class="status ${state.status}">${esc(state.message||state.status)}</div>
      <h2>Players <small>${state.players.length}/5</small></h2><div class="lobby-players">${state.players.map((p,i)=>`<div class="lobby-player"><span class="avatar">${p.avatar}</span><b>${esc(p.name)}</b>${p.host?'<span class="host">HOST</span>':''}<span class="connected">● Connected</span></div>`).join('')||'<div class="muted">Waiting…</div>'}</div>
      ${state.isHost?`<button class="primary" id="startLobby" ${state.players.length<3?'disabled':''}>▶ Start Game (${state.players.length}/3–5)</button>`:''}
      ${!state.isHost&&state.status==='ready'?'<p class="muted">Waiting for the host to start the game…</p>':''}<button id="leaveRoom">Leave Room</button></div>`}
      ${state.mode===null?'':state.mode==='client'&&state.status==='connecting'?'<p class="muted">Connecting…</p>':''}`;
    if(state.mode===null){
      document.getElementById('createRoom').onclick=()=>{state.name=document.getElementById('mpName').value.trim()||'Player';state.avatar=document.getElementById('mpAvatar').value;create();};
      document.getElementById('showJoin').onclick=()=>{state.name=document.getElementById('mpName')?.value.trim()||'Player';state.avatar=document.getElementById('mpAvatar')?.value||'🙂';root.querySelector('.lobby-actions').innerHTML=`<label>Room Code<input id="roomCode" placeholder="MP-ABCDE" maxlength="8"></label><button class="primary" id="joinRoom">Join Room</button><button id="backLobby">Back</button>`;document.getElementById('joinRoom').onclick=join;document.getElementById('backLobby').onclick=render;};
    }else{document.getElementById('copyRoom').onclick=copyInvite;document.getElementById('leaveRoom').onclick=leave;const b=document.getElementById('startLobby');if(b)b.onclick=()=>{broadcast({type:'start'});alert('Lobby is ready. V10.2 will synchronize the actual game between these devices.');};}
  }
  window.MMPokerLobbyV101={render,create,join,leave};
  render();
})();
