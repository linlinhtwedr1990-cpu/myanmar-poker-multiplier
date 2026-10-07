
const fs=require("fs"),vm=require("vm");
const code=fs.readFileSync("src/game-v100.js","utf8");
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(code,ctx);
const G=ctx.window.MMGameV100;
if(G.makeDeck().length!==108) throw new Error("Deck must contain 108 cards");
const g=new G.GameV100();
g.setup({players:[{name:"A"},{name:"B"},{name:"C"},{name:"D"}],startCapital:5000,winningFee:500,cardBonus:100,maxDebt:500});
g.startRound();
if(g.state.players.some(p=>p.hand.length!==13)) throw new Error("Every player must start with 13 cards");
const all=[...g.state.players.flatMap(p=>p.hand),g.state.upper,g.state.lower,...g.state.center];
if(new Set(all.map(c=>c.id)).size!==108) throw new Error("Cards must be unique");
console.log("V10.0 core tests passed");
