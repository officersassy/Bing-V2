import { auth,database,functions } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { ref,get,set,update,onValue,push,runTransaction,remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { create75Card,create90Card,shuffle,missingCount,validWin,createBalanced90Draw } from "./game-engine.js";
import { SHOP_ITEMS,AVATARS } from "./catalog.js?v=2.2.2";

const $=id=>document.getElementById(id);
let host=null,profiles={},lobby={},selectedUid=null,game={},called=[],hostDrawOrder=[];
const TIE_WINDOW_MS=5000;
let currentStageWinners=[];
let localTieLockUntil=0;
let tieButtonTimer=null;

function stageName(s){return({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House"})[s]||s;}
function currentStage(){
  if(game.mode==="90-progressive")return game.stage||"one-line";
  if(game.mode==="90-full-house")return "full-house";
  if(game.mode==="75-two-lines")return "two-lines";
  return "one-line";
}
function maxBall(){return game.mode?.startsWith("90")?90:75;}
function displayCall(n){if(game.mode?.startsWith("90"))return String(n);return `${n<=15?"B":n<=30?"I":n<=45?"N":n<=60?"G":"O"} ${n}`;}

async function createCardsForPlayers(mode,activeUids,roundId){
  const updates={};
  const cards=[];

  activeUids.forEach(uid=>{
    const card=mode.startsWith("90")?create90Card():create75Card();
    cards.push(card);
    updates[`v2/gamePlayers/${uid}`]={card,marked:[],roundId};
  });

  // Remove stale game cards for accounts that are not in this live lobby.
  Object.keys(window.gamePlayers||{}).forEach(uid=>{
    if(!activeUids.includes(uid)){
      updates[`v2/gamePlayers/${uid}`]=null;
    }
  });

  await update(ref(database),updates);
  return cards;
}
function drawHost(){
  $("hostGameStatus").textContent=(game.status||"waiting").toUpperCase();
  $("hostCurrentCall").textContent=game.currentCall||"--";
  $("hostPlayersCount").textContent=activePlayerEntries().length;
  $("hostCalledCount").textContent=called.length;
  $("hostStage").textContent=stageName(currentStage());
  $("hostCalledNumbers").innerHTML="";
  called.slice().reverse().forEach(n=>{const e=document.createElement("span");e.textContent=displayCall(n);$("hostCalledNumbers").appendChild(e);});
}
function activePlayerEntries(){
  return Object.keys(lobby)
    .map(uid=>[uid,profiles[uid]])
    .filter(([,profile])=>Boolean(profile));
}

function drawPlayers(){
  const q=$("playerSearch").value.toLowerCase();
  $("hostPlayerList").innerHTML="";

  activePlayerEntries()
    .filter(([,p])=>!q||p.username?.toLowerCase().includes(q)||p.email?.toLowerCase().includes(q))
    .forEach(([uid,p])=>{
      const row=document.createElement("button");
      row.className=`host-player-row ${uid===selectedUid?"selected":""}`;
      const av=AVATARS.find(a=>a.id===(p.cosmetics?.avatar||"avatar-ball"))||AVATARS[0];
      const avVisual=av?.image
        ? `<img class="mini-avatar-img" src="./${av.image}" alt="${av.name}">`
        : `<span class="mini-avatar">${av?.icon||"🎱"}</span>`;
      row.innerHTML=`${avVisual}<div><strong>${p.username}</strong><small>${p.email||"Username account"}</small></div><b>${Number(p.coins||0).toLocaleString("en-GB")} 🪙</b>`;
      row.onclick=()=>{selectedUid=uid;drawPlayers();drawEconomy();};
      $("hostPlayerList").appendChild(row);
    });
}
function drawEconomy(){
  const p=profiles[selectedUid];

  if(!p){
    $("selectedPlayerEconomy").textContent="Select a player above.";
    $("economyControls").classList.add("hidden");
    $("kickSelectedPlayerButton").classList.add("hidden");
    $("deleteSelectedPlayerButton").classList.add("hidden");
    return;
  }

  $("selectedPlayerEconomy").innerHTML=`<strong>${p.username}</strong><br><small>${p.email}</small>`;
  $("selectedCoins").textContent=`${Number(p.coins||0).toLocaleString("en-GB")} 🪙`;
  $("economyControls").classList.remove("hidden");
  $("kickSelectedPlayerButton").classList.remove("hidden");
  $("deleteSelectedPlayerButton").classList.remove("hidden");
}
async function award(amount,reason,targetUid=selectedUid){
  if(!targetUid)return false;

  const result=await runTransaction(ref(database,`v2/profiles/${targetUid}`),p=>{
    if(!p)return;
    const next=Number(p.coins||0)+amount;
    if(next<0)return;

    p.coins=next;
    if(amount>0)p.lifetimeCoins=Number(p.lifetimeCoins||0)+amount;
    p.updatedAt=Date.now();
    return p;
  });

  if(!result.committed)return false;

  await set(push(ref(database,`v2/transactions/${targetUid}`)),{
    amount,reason,createdAt:Date.now(),createdBy:host.uid,
    type:amount>=0?"award":"deduction"
  });

  const profile=result.snapshot.val()||{};

  const lifetime=Number(profile.lifetimeCoins||0);
  if(lifetime>=1000) await set(ref(database,`v2/profiles/${targetUid}/achievements/coin-1000`),Date.now());
  if(lifetime>=2500) await set(ref(database,`v2/profiles/${targetUid}/achievements/coin-2500`),Date.now());
  if(lifetime>=5000) await set(ref(database,`v2/profiles/${targetUid}/achievements/coin-5000`),Date.now());

  return true;
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
  const mode=$("hostGameMode").value;
  const roundId=`round-${Date.now()}`;
  const activeUids=activePlayerEntries().map(([uid])=>uid);

  if(!activeUids.length){
    alert("No active players are in the lobby.");
    return;
  }

  game={mode,roundId,stage:"one-line"};
  localTieLockUntil=0;
  const cards=await createCardsForPlayers(mode,activeUids,roundId);

  const draw=mode.startsWith("90")
    ? createBalanced90Draw(cards)
    : {order:shuffle(75),profile:"random"};

  hostDrawOrder=draw.order;

  await set(ref(database,"v2/adminState"),{
    roundId,
    drawOrder:draw.order,
    paceProfile:draw.profile
  });

  await set(ref(database,"v2/game"),{
    mode,
    roundId,
    stage:"one-line",
    status:"playing",
    currentCall:"",
    called:{},
    startedAt:Date.now(),
    stageWinnerAt:null,
    claimWindowClosesAt:null
  });

  await remove(ref(database,`v2/verifiedWinners/${roundId}`));

  for(const uid of activeUids){
    await runTransaction(ref(database,`v2/profiles/${uid}/stats/gamesPlayed`),v=>Number(v||0)+1);
    await set(ref(database,`v2/profiles/${uid}/achievements/first-game`),Date.now());
  }
};
$("callNumberButton").onclick=async()=>{
  if(game.status!=="playing")return;

  if(!hostDrawOrder.length){
    const drawSnap=await get(ref(database,"v2/adminState/drawOrder"));
    hostDrawOrder=drawSnap.val()||[];
  }

  if(called.length>=hostDrawOrder.length)return;

  const n=Number(hostDrawOrder[called.length]);
  await update(ref(database,"v2/game"),{
    currentCall:displayCall(n),
    [`called/${called.length}`]:n
  });
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

  if(tieButtonTimer){
    clearTimeout(tieButtonTimer);
    tieButtonTimer=null;
  }

  if(progressive){
    const firebaseClose=Number(game.claimWindowClosesAt||0);
    const closeAt=Math.max(firebaseClose,localTieLockUntil);
    const remaining=Math.max(0,closeAt-Date.now());

    if(remaining>0){
      $("continueStageButton").disabled=true;
      $("continueStageButton").textContent="Collecting tied claims…";
      tieButtonTimer=setTimeout(()=>{
        $("continueStageButton").disabled=false;
        $("continueStageButton").textContent=
          stage==="one-line"?"Continue to Two Lines":"Continue to Full House";
        tieButtonTimer=null;
      },remaining);
    }else{
      $("continueStageButton").disabled=false;
      $("continueStageButton").textContent=
        stage==="one-line"?"Continue to Two Lines":"Continue to Full House";
    }
  }
}

$("continueStageButton").onclick=async()=>{
  const st=currentStage();
  if(game.mode!=="90-progressive"||st==="full-house")return;

  const tieClose=Math.max(Number(game.claimWindowClosesAt||0),localTieLockUntil);
  if(tieClose>Date.now()){
    alert("Still collecting tied Bingo claims for a few seconds.");
    return;
  }

  const next=st==="one-line"?"two-lines":"full-house";

  localTieLockUntil=0;
  await update(ref(database,"v2/game"),{
    stage:next,
    status:"playing",
    stageWinnerAt:null,
    claimWindowClosesAt:null
  });
};

$("newRoundButton").onclick=async()=>{
  if(!confirm("Start a fresh round?"))return;
  await set(ref(database,"v2/game"),{status:"joining"});
  $("hostWinnerPanel").classList.add("hidden");
};



async function deleteSelectedPlayerAccount(){
  const p=profiles[selectedUid];
  if(!p||!selectedUid)return;

  const username=p.username||"this player";

  const first=window.confirm(
    `PERMANENTLY DELETE ${username}?\\n\\nThis removes their login, coins, purchases, achievements, stats and V2 profile. This cannot be undone.`
  );
  if(!first)return;

  const typed=window.prompt(
    `Type DELETE to permanently remove ${username}.`
  );

  if(typed!=="DELETE"){
    alert("Account deletion cancelled.");
    return;
  }

  const button=$("deleteSelectedPlayerButton");
  button.disabled=true;
  button.textContent="Deleting...";

  try{
    const deleteBingoUser=httpsCallable(functions,"deleteBingoUser");
    const result=await deleteBingoUser({targetUid:selectedUid});

    if(!result?.data?.ok){
      throw new Error(result?.data?.message||"Delete failed");
    }

    alert(`${username} has been permanently deleted.`);

    selectedUid=null;
    drawPlayers();
    drawEconomy();
  }catch(error){
    console.error("Permanent account deletion failed:",error);

    const message=
      error?.message?.includes("not-found")
        ? "The delete service is not deployed yet. Follow CLOUD-FUNCTION-SETUP.txt."
        : "Account deletion failed. Check that the Cloud Function is deployed and you are signed in as an admin.";

    alert(message);
  }finally{
    button.disabled=false;
    button.textContent="🗑️ Delete Account Permanently";
  }
}

async function resetLeaderboard(){
  const confirmed = window.confirm(
    "Reset leaderboard testing stats for ALL players? Accounts, current coin balances and purchased cosmetics will stay intact."
  );

  if(!confirmed) return;

  const button = $("resetLeaderboardButton");
  button.disabled = true;

  try {
    const jobs = [];

    Object.entries(profiles).forEach(([uid, profile]) => {
      const currentCoins = Number(profile.coins || 0);

      jobs.push(
        update(
          ref(database, `v2/profiles/${uid}`),
          {
            stats: {
              gamesPlayed: 0,
              wins: 0,
              fullHouses: 0
            },
            lifetimeCoins: currentCoins,
            updatedAt: Date.now()
          }
        )
      );

      // Keep account-created achievement, remove gameplay/testing achievements.
      jobs.push(remove(ref(database, `v2/profiles/${uid}/achievements/first-game`)));
      jobs.push(remove(ref(database, `v2/profiles/${uid}/achievements/first-win`)));
      jobs.push(remove(ref(database, `v2/profiles/${uid}/achievements/five-wins`)));
      jobs.push(remove(ref(database, `v2/profiles/${uid}/achievements/full-house`)));
      jobs.push(remove(ref(database, `v2/profiles/${uid}/achievements/coin-1000`)));
    });

    await Promise.all(jobs);

    // Clear historical test claims/reward locks after profile resets complete.
    await remove(ref(database, "v2/claims"));
    await remove(ref(database, "v2/rewards"));

    alert("Leaderboard and gameplay test stats reset successfully.");
  } catch (error) {
    console.error("Leaderboard reset failed:", error);
    alert(
      "Leaderboard reset failed. Make sure the latest Firebase rules are published, then try again."
    );
  } finally {
    button.disabled = false;
  }
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
  await set(ref(database,`v2/lobby/${uid}`),null);

  selectedUid = null;
  drawPlayers();
  drawEconomy();
}

$("resetLeaderboardButton").onclick = resetLeaderboard;
$("kickSelectedPlayerButton").onclick = kickSelectedPlayer;
$("deleteSelectedPlayerButton").onclick = deleteSelectedPlayerAccount;


async function evaluateMilestoneAchievements(uid,p){
  if(!p)return;
  const games=Number(p.stats?.gamesPlayed||0);
  const wins=Number(p.stats?.wins||0);
  const houses=Number(p.stats?.fullHouses||0);
  const lifetime=Number(p.lifetimeCoins||0);
  const unlocks={};
  const now=Date.now();

  if(games>=10)unlocks["games-10"]=now;
  if(games>=25)unlocks["games-25"]=now;
  if(wins>=10)unlocks["ten-wins"]=now;
  if(wins>=25)unlocks["wins-25"]=now;
  if(houses>=5)unlocks["fullhouse-5"]=now;
  if(lifetime>=2500)unlocks["coin-2500"]=now;
  if(lifetime>=5000)unlocks["coin-5000"]=now;

  for(const [id,time] of Object.entries(unlocks)){
    if(!p.achievements?.[id]){
      await set(ref(database,`v2/profiles/${uid}/achievements/${id}`),time);
    }
  }
}

onAuthStateChanged(auth,async u=>{
  if(!u){location.href="./index.html";return;}host=u;
  const a=await get(ref(database,`v2/admins/${u.uid}`));if(!a.exists()||a.val()!==true){$("hostDenied").classList.remove("hidden");return;}
  $("hostDashboard").classList.remove("hidden");
  onValue(ref(database,"v2/profiles"),async s=>{
    profiles=s.val()||{};
    drawPlayers();
    drawEconomy();

    const updates={};
    Object.entries(profiles).forEach(([uid,p])=>{
      updates[`v2/publicProfiles/${uid}`]={
        username:p.username||"Player",
        avatar:p.cosmetics?.avatar||"avatar-ball",
        lifetimeCoins:Number(p.lifetimeCoins||0),
        stats:p.stats||{gamesPlayed:0,wins:0,fullHouses:0}
      };
      evaluateMilestoneAchievements(uid,p);
    });

    if(Object.keys(updates).length){
      await update(ref(database),updates);
    }
  });
  onValue(ref(database,"v2/lobby"),s=>{lobby=s.val()||{};drawPlayers();drawHost();});
  onValue(ref(database,"v2/adminState/drawOrder"),s=>{hostDrawOrder=s.val()||[];});
  onValue(ref(database,"v2/game"),s=>{game=s.val()||{};called=Object.values(game.called||{}).map(Number);drawHost();drawNear();});
  onValue(ref(database,"v2/gamePlayers"),s=>{window.gamePlayers=s.val()||{};drawNear();});
  onValue(ref(database,"v2/claims"),async s=>{
    const claims=s.val()||{};
    const rid=game.roundId;
    const stage=currentStage();
    const stageClaims=claims?.[rid]?.[stage]||{};
    const submitted=Object.values(stageClaims);

    const winners=submitted.filter(w=>{
      const gp=window.gamePlayers?.[w.uid];

      if(!gp || gp.roundId!==rid || !Array.isArray(gp.card))return false;

      return validWin(
        gp.card,
        gp.marked||[],
        called,
        game.mode,
        stage
      );
    });

    // Only host-verified winners are published to player devices.
    const verifiedMap={};
    winners.forEach(w=>{
      verifiedMap[w.uid]={
        uid:w.uid,
        name:profiles[w.uid]?.username||w.name||"Player",
        avatar:profiles[w.uid]?.cosmetics?.avatar||"avatar-ball",
        stage,
        verifiedAt:Date.now()
      };
    });

    await set(ref(database,`v2/verifiedWinners/${rid}/${stage}`),verifiedMap||{});

    if(winners.length && !game.stageWinnerAt && localTieLockUntil<=Date.now()){
      localTieLockUntil=Date.now()+TIE_WINDOW_MS;
    }

    renderHostWinners(stage,winners);

    if(!winners.length)return;

    // First genuine winner freezes calling but opens a short tie window.
    if(!game.stageWinnerAt){
      const now=Date.now();
      await update(ref(database,"v2/game"),{
        status:stage==="full-house"||game.mode!=="90-progressive"?"winner":"stage-winner",
        stageWinnerAt:now,
        claimWindowClosesAt:now+TIE_WINDOW_MS
      });
    }

    for(const w of winners){
      const reward=stage==="one-line"?100:stage==="two-lines"?200:500;
      const rewardKey=`${rid}-${stage}`;
      const already=await get(ref(database,`v2/rewards/${w.uid}/${rewardKey}`));

      if(already.exists())continue;

      await set(ref(database,`v2/rewards/${w.uid}/${rewardKey}`),true);
      await award(reward,`${stageName(stage)} Win`,w.uid);

      const winsResult=await runTransaction(
        ref(database,`v2/profiles/${w.uid}/stats/wins`),
        value=>Number(value||0)+1
      );

      const wins=Number(winsResult.snapshot.val()||0);

      await set(ref(database,`v2/profiles/${w.uid}/achievements/first-win`),Date.now());

      if(wins>=5) await set(ref(database,`v2/profiles/${w.uid}/achievements/five-wins`),Date.now());
      if(wins>=10) await set(ref(database,`v2/profiles/${w.uid}/achievements/ten-wins`),Date.now());
      if(wins>=25) await set(ref(database,`v2/profiles/${w.uid}/achievements/wins-25`),Date.now());

      if(stage==="full-house"){
        const houseResult=await runTransaction(
          ref(database,`v2/profiles/${w.uid}/stats/fullHouses`),
          value=>Number(value||0)+1
        );
        const houses=Number(houseResult.snapshot.val()||0);
        await set(ref(database,`v2/profiles/${w.uid}/achievements/full-house`),Date.now());
        if(houses>=5) await set(ref(database,`v2/profiles/${w.uid}/achievements/fullhouse-5`),Date.now());
      }
    }
  });
  onValue(ref(database,"v2/purchaseRequests"),async snapshot=>{
    const requests=snapshot.val()||{};

    for(const [uid,userRequests] of Object.entries(requests)){
      for(const [requestId,request] of Object.entries(userRequests||{})){
        if(request?.status!=="pending") continue;

        const item=SHOP_ITEMS.find(entry=>entry.id===request.itemId);

        if(!item){
          // Do not destroy a purchase request just because this host tab is
          // running an older catalogue. A refreshed host can process it.
          console.warn(
            "Unknown shop item on this host build:",
            request.itemId,
            "Refresh the host page."
          );
          continue;
        }

        if(item.price<=0){
          await update(ref(database,`v2/purchaseRequests/${uid}/${requestId}`),{
            status:"rejected",
            processedAt:Date.now(),
            reason:"Free items do not require purchase"
          });
          continue;
        }

        const profileRef=ref(database,`v2/profiles/${uid}`);

        const result=await runTransaction(profileRef,current=>{
          if(!current) return;

          current.inventory=current.inventory||{};

          if(current.inventory[item.id]){
            return current;
          }

          const balance=Number(current.coins||0);

          if(balance<item.price){
            return;
          }

          current.coins=balance-item.price;
          current.inventory[item.id]=Date.now();
          current.updatedAt=Date.now();

          return current;
        });

        if(result.committed){
          await set(push(ref(database,`v2/transactions/${uid}`)),{
            amount:-item.price,
            reason:`Bought ${item.name}`,
            createdAt:Date.now(),
            createdBy:host.uid,
            type:"purchase"
          });

          await update(ref(database,`v2/purchaseRequests/${uid}/${requestId}`),{
            status:"complete",
            itemId:item.id,
            processedAt:Date.now()
          });
        }else{
          await update(ref(database,`v2/purchaseRequests/${uid}/${requestId}`),{
            status:"rejected",
            processedAt:Date.now(),
            reason:"Insufficient coins or profile unavailable"
          });
        }
      }
    }
  });

});
