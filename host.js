import { auth,database } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref,get,set,update,onValue,push,runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { create75Card,create90Card,shuffle,missingCount,validWin } from "./game-engine.js";

const $=id=>document.getElementById(id);
let host=null,profiles={},selectedUid=null,game={},called=[];
let currentStageWinners=[];

function stageName(s){return({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House"})[s]||s;}
function currentStage(){return game.mode==="90-progressive"?(game.stage||"one-line"):(game.mode==="90-full-house"?"full-house":"one-line");}
function maxBall(){return game.mode?.startsWith("90")?90:75;}
function displayCall(n){if(game.mode?.startsWith("90"))return String(n);return `${n<=15?"B":n<=30?"I":n<=45?"N":n<=60?"G":"O"} ${n}`;}

async function createCardsForPlayers(mode){
  const updates={};
  Object.keys(profiles).forEach(uid=>{
    updates[`v2/gamePlayers/${uid}`]={card:mode.startsWith("90")?create90Card():create75Card(),marked:[],roundId:game.roundId||null};
  });
  await update(ref(database),updates);
}
function drawHost(){
  $("hostGameStatus").textContent=(game.status||"waiting").toUpperCase();
  $("hostCurrentCall").textContent=game.currentCall||"--";
  $("hostPlayersCount").textContent=Object.keys(profiles).length;
  $("hostCalledCount").textContent=called.length;
  $("hostStage").textContent=stageName(currentStage());
  $("hostCalledNumbers").innerHTML="";
  called.slice().reverse().forEach(n=>{const e=document.createElement("span");e.textContent=displayCall(n);$("hostCalledNumbers").appendChild(e);});
}
function drawPlayers(){
  const q=$("playerSearch").value.toLowerCase();
  $("hostPlayerList").innerHTML="";
  Object.entries(profiles).filter(([,p])=>!q||p.username?.toLowerCase().includes(q)||p.email?.toLowerCase().includes(q)).forEach(([uid,p])=>{
    const row=document.createElement("button");row.className=`host-player-row ${uid===selectedUid?"selected":""}`;
    row.innerHTML=`<div><strong>${p.username}</strong><small>${p.email}</small></div><b>${Number(p.coins||0).toLocaleString("en-GB")} 🪙</b>`;
    row.onclick=()=>{selectedUid=uid;drawPlayers();drawEconomy();};$("hostPlayerList").appendChild(row);
  });
}
function drawEconomy(){
  const p=profiles[selectedUid];

  if(!p){
    $("selectedPlayerEconomy").textContent="Select a player above.";
    $("economyControls").classList.add("hidden");
    $("kickSelectedPlayerButton").classList.add("hidden");
    return;
  }

  $("selectedPlayerEconomy").innerHTML=`<strong>${p.username}</strong><br><small>${p.email}</small>`;
  $("selectedCoins").textContent=`${Number(p.coins||0).toLocaleString("en-GB")} 🪙`;
  $("economyControls").classList.remove("hidden");
  $("kickSelectedPlayerButton").classList.remove("hidden");
}
async function award(amount,reason){
  if(!selectedUid)return;
  await runTransaction(ref(database,`v2/profiles/${selectedUid}`),p=>{
    if(!p)return p; const next=Number(p.coins||0)+amount;if(next<0)return;
    p.coins=next;if(amount>0)p.lifetimeCoins=Number(p.lifetimeCoins||0)+amount;p.updatedAt=Date.now();return p;
  });
  await set(push(ref(database,`v2/transactions/${selectedUid}`)),{amount,reason,createdAt:Date.now(),createdBy:host.uid});
}
document.querySelectorAll("[data-reward]").forEach(b=>b.onclick=()=>award(Number(b.dataset.reward),b.dataset.reason));

$("customAddCoins").onclick = async () => {
  const amount = Math.floor(Number($("customCoinAmount").value));

  if (!selectedUid || !Number.isFinite(amount) || amount <= 0) {
    alert("Select a player and enter a valid amount.");
    return;
  }

  await award(amount, "Custom General Sassy Credit");
  $("customCoinAmount").value = "";
};

$("customDeductCoins").onclick = async () => {
  const amount = Math.floor(Number($("customCoinAmount").value));

  if (!selectedUid || !Number.isFinite(amount) || amount <= 0) {
    alert("Select a player and enter a valid amount.");
    return;
  }

  const player = profiles[selectedUid];
  const available = Number(player?.coins || 0);
  const deduction = Math.min(amount, available);

  if (deduction <= 0) {
    alert("That player has no coins to deduct.");
    return;
  }

  const confirmed = window.confirm(
    `Deduct ${deduction} Sassy Coins from ${player.username}?`
  );

  if (!confirmed) return;

  await award(-deduction, "Custom General Sassy Deduction");
  $("customCoinAmount").value = "";
};

$("playerSearch").oninput=drawPlayers;
$("hostLogoutButton").onclick=async()=>{await signOut(auth);location.href="./index.html";};

$("openGameButton").onclick=async()=>{await update(ref(database,"v2/game"),{status:"joining"});};
$("startGameButton").onclick=async()=>{
  const mode=$("hostGameMode").value,roundId=`round-${Date.now()}`;
  game={mode,roundId,stage:"one-line"};
  await set(ref(database,"v2/game"),{mode,roundId,stage:"one-line",status:"playing",currentCall:"",called:{},drawOrder:shuffle(mode.startsWith("90")?90:75),startedAt:Date.now()});
  await createCardsForPlayers(mode);
  for(const uid of Object.keys(profiles)){
    await runTransaction(ref(database,`v2/profiles/${uid}/stats/gamesPlayed`),v=>Number(v||0)+1);
    await set(ref(database,`v2/profiles/${uid}/achievements/first-game`),Date.now());
  }
};
$("callNumberButton").onclick=async()=>{
  if(game.status!=="playing")return; const order=game.drawOrder||[]; if(called.length>=order.length)return;
  const n=Number(order[called.length]);
  await update(ref(database,"v2/game"),{currentCall:displayCall(n),[`called/${called.length}`]:n});
};
$("resetGameButton").onclick=async()=>{if(confirm("Reset the current round?"))await set(ref(database,"v2/game"),{status:"joining"});};

function drawNear(){
  $("nearWinnerList").innerHTML="";
  const rows=Object.entries(profiles).map(([uid,p])=>{
    const gp=window.gamePlayers?.[uid]; if(!gp)return null;
    return {uid,name:p.username,missing:missingCount(gp.card||[],gp.marked||[],called,game.mode,currentStage())};
  }).filter(Boolean).sort((a,b)=>a.missing-b.missing).slice(0,5);
  rows.forEach((r,i)=>{const e=document.createElement("div");e.className="leader-row";e.innerHTML=`<strong>${i+1}</strong><div><b>${r.name}</b><small>${r.missing} away</small></div><span>${r.missing===1?"🔥":""}</span>`;$("nearWinnerList").appendChild(e);});
}


function renderHostWinners(stage,winners){
  currentStageWinners=winners;

  if(!winners.length){
    $("hostWinnerPanel").classList.add("hidden");
    return;
  }

  $("hostWinnerPanel").classList.remove("hidden");
  $("hostWinnerTitle").textContent=`🏆 ${stageName(stage)} Winner${winners.length>1?"s":""}`;
  $("hostWinnerList").innerHTML=winners.map(w=>`<div>🏆 ${w.name||"Player"}</div>`).join("");

  const progressive=game.mode==="90-progressive"&&stage!=="full-house";
  $("continueStageButton").classList.toggle("hidden",!progressive);
  $("continueStageButton").textContent=
    stage==="one-line"?"Continue to Two Lines":"Continue to Full House";
}

$("continueStageButton").onclick=async()=>{
  const st=currentStage();
  if(game.mode!=="90-progressive"||st==="full-house")return;

  const next=st==="one-line"?"two-lines":"full-house";

  await update(ref(database,"v2/game"),{
    stage:next,
    status:"playing"
  });
};

$("newRoundButton").onclick=async()=>{
  if(!confirm("Start a fresh round?"))return;
  await set(ref(database,"v2/game"),{status:"joining"});
  $("hostWinnerPanel").classList.add("hidden");
};


async function resetLeaderboard(){
  const confirmed = window.confirm(
    "Reset leaderboard testing stats for ALL players? Accounts, coin balances and purchased cosmetics will stay intact."
  );

  if(!confirmed) return;

  const updates = {};

  Object.entries(profiles).forEach(([uid, profile]) => {
    updates[`v2/profiles/${uid}/stats`] = {
      gamesPlayed: 0,
      wins: 0,
      fullHouses: 0
    };

    // Reset lifetime leaderboard total to current wallet balance so test rewards
    // no longer leave the account miles ahead, while preserving spendable coins.
    updates[`v2/profiles/${uid}/lifetimeCoins`] = Number(profile.coins || 0);

    // Remove gameplay achievements that came from testing.
    updates[`v2/profiles/${uid}/achievements/first-game`] = null;
    updates[`v2/profiles/${uid}/achievements/first-win`] = null;
    updates[`v2/profiles/${uid}/achievements/five-wins`] = null;
    updates[`v2/profiles/${uid}/achievements/full-house`] = null;
    updates[`v2/profiles/${uid}/achievements/coin-1000`] = null;
  });

  // Clear old test claims/rewards so they cannot affect future rounds.
  updates["v2/claims"] = null;
  updates["v2/rewards"] = null;

  await update(ref(database), updates);

  alert("Leaderboard and gameplay test stats reset.");
}

async function kickSelectedPlayer(){
  const p = profiles[selectedUid];

  if(!p || !selectedUid) return;

  const confirmed = window.confirm(
    `Kick ${p.username || "this player"} from the current Bingo session? Their account and coins will NOT be deleted.`
  );

  if(!confirmed) return;

  const uid = selectedUid;

  // Removal is session-only. The profile/account remains.
  await set(ref(database,`v2/kicks/${uid}`),{
    kicked: true,
    kickedAt: Date.now(),
    kickedBy: host.uid,
    reason: "Removed by General Sassy"
  });

  await set(ref(database,`v2/gamePlayers/${uid}`),null);

  selectedUid = null;
  drawPlayers();
  drawEconomy();
}

$("resetLeaderboardButton").onclick = resetLeaderboard;
$("kickSelectedPlayerButton").onclick = kickSelectedPlayer;

onAuthStateChanged(auth,async u=>{
  if(!u){location.href="./index.html";return;}host=u;
  const a=await get(ref(database,`v2/admins/${u.uid}`));if(!a.exists()||a.val()!==true){$("hostDenied").classList.remove("hidden");return;}
  $("hostDashboard").classList.remove("hidden");
  onValue(ref(database,"v2/profiles"),s=>{profiles=s.val()||{};drawPlayers();drawEconomy();});
  onValue(ref(database,"v2/game"),s=>{game=s.val()||{};called=Object.values(game.called||{}).map(Number);drawHost();drawNear();});
  onValue(ref(database,"v2/gamePlayers"),s=>{window.gamePlayers=s.val()||{};drawNear();});
  onValue(ref(database,"v2/claims"),async s=>{
    const claims=s.val()||{},rid=game.roundId,stage=currentStage();const stageClaims=claims?.[rid]?.[stage]||{};
    const submitted=Object.values(stageClaims);

    // Never trust a player claim by itself. Re-check the claimed card against
    // the authoritative called numbers before displaying or rewarding it.
    const winners=submitted.filter(w=>{
      const gp=window.gamePlayers?.[w.uid];
      if(!gp || !Array.isArray(gp.card)) return false;

      return validWin(
        gp.card,
        gp.marked || [],
        called,
        game.mode,
        stage
      );
    });

    renderHostWinners(stage,winners);
    if(!winners.length)return;
    for(const w of winners){
      const reward=stage==="one-line"?100:stage==="two-lines"?200:500;
      const rewardKey=`${rid}-${stage}`;
      const already=await get(ref(database,`v2/rewards/${w.uid}/${rewardKey}`));
      if(already.exists())continue;
      await set(ref(database,`v2/rewards/${w.uid}/${rewardKey}`),true);
      selectedUid=w.uid;await award(reward,`${stageName(stage)} Win`);
      await runTransaction(ref(database,`v2/profiles/${w.uid}/stats/wins`),v=>Number(v||0)+1);
      await set(ref(database,`v2/profiles/${w.uid}/achievements/first-win`),Date.now());
      if(stage==="full-house"){await runTransaction(ref(database,`v2/profiles/${w.uid}/stats/fullHouses`),v=>Number(v||0)+1);await set(ref(database,`v2/profiles/${w.uid}/achievements/full-house`),Date.now());}
    }
    await update(ref(database,"v2/game"),{
      status: stage==="full-house" || game.mode!=="90-progressive"
        ? "winner"
        : "stage-winner"
    });
  });
});
