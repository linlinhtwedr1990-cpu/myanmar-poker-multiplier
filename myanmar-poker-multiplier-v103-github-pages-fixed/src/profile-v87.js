
// Myanmar Poker Multiplier — V8.7 Local Profile & Leaderboard
// No Firebase. All data stays in this browser's localStorage.

export const PROFILE_KEY = "mm-poker-free-profile-v87";
export const STATS_KEY = "mm-poker-free-stats-v86";
export const HISTORY_KEY = "mm-poker-free-history-v87";

export function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || "{}"); }
  catch { return {}; }
}
export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); }
  catch { return {}; }
}
export function saveProfile(profile) {
  const clean = {
    uid: String(profile.uid || "local-0"),
    name: String(profile.name || "Lin").trim().slice(0, 30) || "Player",
    avatar: String(profile.avatar || "🧑‍💻").slice(0, 4)
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
  return clean;
}
export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}
export function saveRoundHistory(result, roundNo) {
  const history = loadHistory();
  history.unshift({
    round: roundNo,
    winnerUid: result.winnerUid,
    winnerName: result.rows.find(r => r.uid === result.winnerUid)?.name || "Winner",
    winningFee: result.winningFee,
    rows: result.rows.map(r => ({
      uid: r.uid, name: r.name, bonusCount: r.bonusCount,
      paid: r.paid, received: r.received, net: r.net
    })),
    at: new Date().toISOString()
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}
export function rankedPlayers() {
  const stats = loadStats();
  return Object.values(stats).sort((a,b) =>
    (b.wins-a.wins) ||
    ((b.winRate||0)-(a.winRate||0)) ||
    ((b.totalNetMMK||0)-(a.totalNetMMK||0)) ||
    ((b.biggestWin||0)-(a.biggestWin||0)) ||
    String(a.name).localeCompare(String(b.name))
  ).map((p,i)=>({...p,rank:i+1,winRate:p.gamesPlayed ? (p.wins/p.gamesPlayed)*100 : 0}));
}
export function clearLocalData() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem("mm-round-v86");
}
