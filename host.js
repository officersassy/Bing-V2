import { auth,database } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref,get,set,update,onValue,push,runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { create75Card,create90Card,shuffle,missingCount } from "./game-engine.js";

const $=id=>document.getElementById(id);
let host=null,profiles={},selectedUid=null,game={},called=[];

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
  if(!p){$("selectedPlayerEconomy").textContent="Select a player above.";$("economyControls").classList.add("hidden");return;}
  $("selectedPlayerEconomy").innerHTML=`<strong>${p.username}</strong><br><small>${p.email}</small>`;
  $("selectedCoins").textContent=`${Number(p.coins||0).toLocaleString("en-GB")} 🪙`;
  $("economyControls").classList.remove("hidden");
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

onAuthStateChanged(auth,async u=>{
  if(!u){location.href="./index.html";return;}host=u;
  const a=await get(ref(database,`v2/admins/${u.uid}`));if(!a.exists()||a.val()!==true){$("hostDenied").classList.remove("hidden");return;}
  $("hostDashboard").classList.remove("hidden");
  onValue(ref(database,"v2/profiles"),s=>{profiles=s.val()||{};drawPlayers();drawEconomy();});
  onValue(ref(database,"v2/game"),s=>{game=s.val()||{};called=Object.values(game.called||{}).map(Number);drawHost();drawNear();});
  onValue(ref(database,"v2/gamePlayers"),s=>{window.gamePlayers=s.val()||{};drawNear();});
  onValue(ref(database,"v2/claims"),async s=>{
    const claims=s.val()||{},rid=game.roundId,stage=currentStage();const stageClaims=claims?.[rid]?.[stage]||{};
    const winners=Object.values(stageClaims);if(!winners.length)return;
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
    if(game.mode==="90-progressive"&&stage!=="full-house"){
      await update(ref(database,"v2/game"),{stage:stage==="one-line"?"two-lines":"full-house"});
    }else{
      await update(ref(database,"v2/game"),{status:"winner"});
    }
  });
});
