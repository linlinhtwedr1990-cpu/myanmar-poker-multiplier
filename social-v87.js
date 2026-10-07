
import { loadProfile, saveProfile, rankedPlayers, loadHistory, clearLocalData } from "./profile-v87.js";

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function renderProfilePanel(onBack) {
  const p = loadProfile();
  $("#app").innerHTML = `<section class="panel social-panel">
    <div class="social-head"><div><h2>👤 My Local Profile</h2><p class="muted">Free Mode data stays on this Mac/browser.</p></div>
      <button id="back">Back</button></div>
    <div class="profile-editor">
      <div class="big-avatar">${esc(p.avatar || "🧑‍💻")}</div>
      <label>Display name<input id="profileName" maxlength="30" value="${esc(p.name || "Lin")}"></label>
      <label>Avatar<input id="profileAvatar" maxlength="4" value="${esc(p.avatar || "🧑‍💻")}"></label>
    </div>
    <button class="primary" id="save">Save Profile</button>
    <div id="profileMsg" class="message"></div>
    <h3>🏆 Local Leaderboard</h3>
    <div class="leaderboard">${rankedPlayers().map(x=>`
      <div class="rank-row"><span class="rank">#${x.rank}</span><span class="avatar">${esc(x.avatar||"🧑‍💻")}</span>
      <b>${esc(x.name)}</b><span>${x.wins}W / ${x.losses}L</span><span>${x.winRate.toFixed(0)}%</span><strong>${x.totalNetMMK||0} MMK</strong></div>`).join("") || `<p class="muted">Play a round to create leaderboard data.</p>`}</div>
    <h3>📜 Recent Rounds</h3>
    <div class="history">${loadHistory().slice(0,10).map(h=>`
      <div class="history-row"><b>Round ${h.round}</b><span>🏆 ${esc(h.winnerName)}</span><span>${h.winningFee} MMK fee</span><span>${new Date(h.at).toLocaleString()}</span></div>`).join("") || `<p class="muted">No rounds yet.</p>`}</div>
    <button id="reset" class="danger">Reset Local Profile & Statistics</button>
  </section>`;
  $("#back").onclick=onBack;
  $("#save").onclick=()=>{
    const saved=saveProfile({uid:p.uid||"local-0",name:$("#profileName").value,avatar:$("#profileAvatar").value});
    $("#profileMsg").textContent=`Saved as ${saved.name}.`;
  };
  $("#reset").onclick=()=>{
    if(confirm("Delete all local profile, leaderboard and round-history data?")){
      clearLocalData(); renderProfilePanel(onBack);
    }
  };
}
