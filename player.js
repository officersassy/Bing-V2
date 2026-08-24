import { auth,database } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref,get,set,update,onValue,runTransaction,push,remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { SHOP_ITEMS,ACHIEVEMENTS } from "./catalog.js";
import { BLANK,validWin } from "./game-engine.js";

const $=id=>document.getElementById(id);
let user=null,profile=null,game={},card=[],marked=[],called=[];
let previousAchievements = new Set();
let previousCoinBalance = null;
let previousWinnerKey = null;

function show(id,text,type=""){const el=$(id);el.textContent=text;el.className=`message-box ${type}`.trim();}
function coins(n){return Number(n||0).toLocaleString("en-GB");}

function toast(title, text, icon = "✨") {
  const stack = $("toastStack");
  if (!stack) return;

  const item = document.createElement("div");
  item.className = "toast-item";
  item.innerHTML = `<span>${icon}</span><div><strong>${title}</strong><small>${text}</small></div>`;
  stack.appendChild(item);

  setTimeout(() => item.classList.add("show"), 20);
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 250);
  }, 4200);
}

function cosmeticName(id) {
  const item = SHOP_ITEMS.find(x => x.id === id);
  return item ? item.name : "Default";
}

function applyCosmetics() {
  const dabber = profile?.cosmetics?.dabber || "default";
  const theme = profile?.cosmetics?.theme || "default";
  const nameEffect = profile?.cosmetics?.nameEffect || "default";
  const effect = profile?.cosmetics?.effect || "default";

  document.body.dataset.dabber = dabber;
  document.body.dataset.theme = theme;
  document.body.dataset.nameEffect = nameEffect;
  document.body.dataset.effect = effect;

  // Classes make the cosmetic selectors reliable across browsers.
  [...document.body.classList]
    .filter(name => name.startsWith("cosmetic-"))
    .forEach(name => document.body.classList.remove(name));

  [dabber, theme, nameEffect, effect]
    .filter(value => value && value !== "default")
    .forEach(value => document.body.classList.add(`cosmetic-${value}`));

  $("equippedDabber").textContent = cosmeticName(dabber);
  $("equippedTheme").textContent = cosmeticName(theme);
  $("equippedNameEffect").textContent = cosmeticName(nameEffect);
}

function fireConfettiCannons() {
  if (profile?.cosmetics?.effect !== "confetti-party") return;

  const layer = $("confettiLayer");
  if (!layer) return;

  layer.innerHTML = "";
  const pieces = 90;
  const symbols = ["●", "■", "▲", "★"];

  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("span");
    piece.className = `confetti-piece ${i % 2 === 0 ? "from-left" : "from-right"}`;
    piece.textContent = symbols[i % symbols.length];
    piece.style.setProperty("--x", `${Math.random() * 90 - 45}vw`);
    piece.style.setProperty("--y", `${-(35 + Math.random() * 60)}vh`);
    piece.style.setProperty("--r", `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
    piece.style.setProperty("--duration", `${1.6 + Math.random() * 1.1}s`);
    layer.appendChild(piece);
  }

  layer.classList.add("active");

  setTimeout(() => {
    layer.classList.remove("active");
    layer.innerHTML = "";
  }, 3400);
}

function showWinnerOverlay(stageLabel, names, reward = 0) {
  $("winnerTitle").textContent = `${stageLabel} Winner${names.length > 1 ? "s" : ""}`;
  $("winnerNames").innerHTML = names.map(name => `<div>🏆 ${name}</div>`).join("");

  if (reward > 0) {
    $("winnerReward").textContent = `+${reward} Sassy Coins`;
    $("winnerReward").classList.remove("hidden");
  } else {
    $("winnerReward").classList.add("hidden");
  }

  $("winnerOverlay").classList.remove("hidden");
}

$("closeWinnerOverlay").onclick = () => $("winnerOverlay").classList.add("hidden");

function drawWaitingState() {
  const active = game.status === "playing";

  $("waitingPanel").classList.toggle("hidden", active);
  $("liveGamePanel").classList.toggle("hidden", !active);
  $("ticketTitle").closest(".ticket-panel").classList.toggle("hidden", !active);
  $("claimBingoButton").classList.toggle("hidden", !active);

  if (!active) {
    const messages = [
      "General Sassy is preparing the battlefield.",
      "The numbers are being emotionally prepared for duty.",
      "Joining is open. Confidence is optional.",
      "General Sassy is pretending this is all under control."
    ];
    $("waitingMessage").textContent = messages[Math.floor(Math.random() * messages.length)];
  }
}

function detectAchievementToasts(nextProfile) {
  const current = new Set(Object.keys(nextProfile?.achievements || {}));

  current.forEach(id => {
    if (!previousAchievements.has(id)) {
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      if (achievement) {
        toast("Achievement Unlocked", `${achievement.icon} ${achievement.name}`, "🏅");
      }
    }
  });

  previousAchievements = current;
}

function detectCoinChange(nextProfile) {
  const nextCoins = Number(nextProfile?.coins || 0);

  if (previousCoinBalance !== null && nextCoins > previousCoinBalance) {
    toast(
      "Sassy Coins Added",
      `+${nextCoins - previousCoinBalance} coins`,
      "🪙"
    );
  }

  previousCoinBalance = nextCoins;
}

function drawProfile(){
  if(!profile)return;
  $("welcomeName").textContent=`Hi, ${profile.username}`;
  $("coinBalance").textContent=coins(profile.coins);
  $("menuCoinBalance").textContent=coins(profile.coins);
  $("profileName").textContent=profile.username;
  $("profileEmail").textContent=profile.email||"";
  $("profileInitial").textContent=(profile.username||"?")[0].toUpperCase();
  $("gamesPlayed").textContent=profile.stats?.gamesPlayed||0;
  $("winsCount").textContent=profile.stats?.wins||0;
  $("fullHouseCount").textContent=profile.stats?.fullHouses||0;
  $("lifetimeCoins").textContent=coins(profile.lifetimeCoins);
  applyCosmetics();
}
function drawShop(){
  $("shopList").innerHTML="";

  SHOP_ITEMS.forEach(item=>{
    const owned=Boolean(profile?.inventory?.[item.id]);
    const equipped = Object.values(profile?.cosmetics || {}).includes(item.id);

    const row=document.createElement("div");
    row.className="shop-item";
    row.innerHTML=`<div class="shop-icon">${item.icon}</div><div><strong>${item.name}</strong><small>${item.price} 🪙</small></div>`;

    const btn=document.createElement("button");

    if (owned) {
      btn.textContent = equipped ? "Equipped" : "Equip";
      btn.disabled = equipped;

      if (!equipped) {
        btn.onclick = () => equipItem(item);
      }
    } else {
      btn.textContent = "Buy";
      btn.onclick = () => buyItem(item);
    }

    row.appendChild(btn);
    $("shopList").appendChild(row);
  });
}

async function equipItem(item){
  const map = {
    dabber: "dabber",
    theme: "theme",
    effect: "effect",
    nameEffect: "nameEffect"
  };

  const key = map[item.type];
  if (!key) return;

  await update(
    ref(database,`v2/profiles/${user.uid}/cosmetics`),
    { [key]: item.id }
  );

  toast("Cosmetic Equipped", item.name, item.icon);
}
async function buyItem(item){
  if(Number(profile.coins||0)<item.price){show("shopMessage","Not enough Sassy Coins.","error");return;}
  try{
    const pRef=ref(database,`v2/profiles/${user.uid}`);
    const result=await runTransaction(pRef,current=>{
      if(!current||Number(current.coins||0)<item.price)return;
      current.coins=Number(current.coins||0)-item.price;
      current.inventory=current.inventory||{};
      current.inventory[item.id]=Date.now();
      current.updatedAt=Date.now();
      return current;
    });
    if(!result.committed){show("shopMessage","Purchase could not be completed.","error");return;}
    await set(push(ref(database,`v2/transactions/${user.uid}`)),{amount:-item.price,reason:`Bought ${item.name}`,createdAt:Date.now(),type:"purchase"});
    show("shopMessage",`${item.name} unlocked!`,"success");
  }catch(e){console.error(e);show("shopMessage","Purchase failed.","error");}
}
function drawAchievements(){
  $("achievementList").innerHTML="";
  ACHIEVEMENTS.forEach(a=>{
    const unlocked=Boolean(profile?.achievements?.[a.id]);
    const el=document.createElement("div");el.className=`achievement-item ${unlocked?"unlocked":""}`;
    el.innerHTML=`<span>${a.icon}</span><div><strong>${a.name}</strong><small>${a.description}</small></div><b>${unlocked?"✓":"🔒"}</b>`;
    $("achievementList").appendChild(el);
  });
}
function drawLeaderboard(data){
  const entries=Object.values(data||{}).sort((a,b)=>Number(b.stats?.wins||0)-Number(a.stats?.wins||0)||Number(b.lifetimeCoins||0)-Number(a.lifetimeCoins||0)).slice(0,20);
  $("leaderboardList").innerHTML="";
  entries.forEach((p,i)=>{
    const row=document.createElement("div");row.className="leader-row";
    row.innerHTML=`<strong>${i+1}</strong><div><b>${p.username||"Player"}</b><small>${p.stats?.wins||0} wins</small></div><span>${coins(p.lifetimeCoins)} 🪙</span>`;
    $("leaderboardList").appendChild(row);
  });
}
function drawCard(){
  const area=$("bingoCard");area.innerHTML="";
  const is90=game.mode?.startsWith("90");
  area.className=`v2-card ${is90?"card90":"card75"}`;
  card.forEach(value=>{
    const cell=document.createElement("button");cell.type="button";cell.className="v2-cell";
    if(value===BLANK||value===""){cell.classList.add("blank");cell.disabled=true;cell.textContent="";area.appendChild(cell);return;}
    cell.textContent=value;
    if(value==="FREE"){cell.classList.add("free","marked");cell.disabled=true;}
    else{
      const n=Number(value);
      if(called.includes(n))cell.classList.add("called");
      if(marked.includes(n))cell.classList.add("marked");
      cell.onclick=async()=>{
        if(!called.includes(n)){show("gameMessage","That number has not been called yet.","error");return;}
        marked=marked.includes(n)?marked.filter(x=>x!==n):[...marked,n];
        await set(ref(database,`v2/gamePlayers/${user.uid}/marked`),marked);
        drawCard();
      };
    }
    area.appendChild(cell);
  });
  $("markedCount").textContent=marked.length;
}
function stage(){return game.mode==="90-progressive"?(game.stage||"one-line"):(game.mode==="90-full-house"?"full-house":"one-line");}
function stageName(s){return({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House"})[s]||s;}
function drawGame(){
  $("gameModeBadge").textContent=(game.mode||"WAITING").replaceAll("-"," ").toUpperCase();
  $("gameStageText").textContent=game.status==="playing"?stageName(stage()):"Waiting for host";
  $("currentCall").textContent=game.currentCall||"--";
  $("calledCount").textContent=called.length;
  $("cardTypeBadge").textContent=game.mode?.startsWith("90")?"90 BALL":"75 BALL";
  $("ticketTitle").textContent=game.mode?.startsWith("90")?"90-Ball Ticket":"75-Ball Card";
  drawWaitingState();
  drawCard();
}
async function claim(){
  if(game.status!=="playing"){show("gameMessage","The round is not active.","error");return;}
  if(!validWin(card,marked,called,game.mode,stage())){show("gameMessage",`Not a valid ${stageName(stage())} yet.`,"error");return;}
  await set(ref(database,`v2/claims/${game.roundId}/${stage()}/${user.uid}`),{uid:user.uid,name:profile.username,stage:stage(),claimedAt:Date.now()});
  show("gameMessage","Bingo claim sent!","success");
}
$("claimBingoButton").onclick=claim;

const sideMenu = $("sideMenu");
const menuOverlay = $("menuOverlay");
const menuButton = $("menuButton");
const closeMenuButton = $("closeMenuButton");

function openMenu() {
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden", "false");
  menuOverlay.classList.remove("hidden");
  document.body.classList.add("menu-open");
}

function closeMenu() {
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden", "true");
  menuOverlay.classList.add("hidden");
  document.body.classList.remove("menu-open");
}

menuButton.onclick = openMenu;
closeMenuButton.onclick = closeMenu;
menuOverlay.onclick = closeMenu;

document.querySelectorAll(".side-menu-nav button").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".side-menu-nav button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".mobile-view").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    $(`view${btn.dataset.view}`).classList.add("active");

    closeMenu();
  };
});

$("logoutButton").onclick=async()=>{await signOut(auth);location.href="./index.html";};
$("editNameButton").onclick=()=>{$("newPlayerName").value=profile.username;$("nameModal").classList.remove("hidden");};
$("cancelNameButton").onclick=()=>$("nameModal").classList.add("hidden");
$("saveNameButton").onclick=async()=>{
  const name=$("newPlayerName").value.trim();if(name.length<2)return;
  await update(ref(database,`v2/profiles/${user.uid}`),{username:name,updatedAt:Date.now()});
  $("nameModal").classList.add("hidden");
};

onAuthStateChanged(auth,async u=>{
  if(!u){location.href="./index.html";return;} user=u;
  const adminSnap = await get(ref(database,`v2/admins/${u.uid}`));
  if (adminSnap.exists() && adminSnap.val() === true) {
    $("hostPanelButton").classList.remove("hidden");
    $("hostPanelButton").onclick = () => {
      location.href = "./host.html";
    };
  }

  onValue(ref(database,`v2/profiles/${u.uid}`),s=>{
    const nextProfile=s.val();
    detectAchievementToasts(nextProfile);
    detectCoinChange(nextProfile);
    profile=nextProfile;
    drawProfile();
    drawShop();
    drawAchievements();
  });
  onValue(ref(database,"v2/profiles"),s=>drawLeaderboard(s.val()||{}));
  onValue(ref(database,"v2/game"),async s=>{
    game=s.val()||{};
    called=Object.values(game.called||{}).map(Number);
    const gp=await get(ref(database,`v2/gamePlayers/${u.uid}`));
    if(gp.exists()){card=gp.val().card||[];marked=gp.val().marked||[];}
    drawGame();
  });
  onValue(ref(database,`v2/gamePlayers/${u.uid}`),s=>{if(s.exists()){card=s.val().card||[];marked=s.val().marked||[];drawGame();}});

  let handlingKick = false;

  onValue(ref(database,`v2/kicks/${u.uid}`),async snap=>{
    const kick = snap.val();

    if(!kick?.kicked || handlingKick) return;

    handlingKick = true;

    try {
      alert(
        kick.reason ||
        "General Sassy has removed you from the current Bingo session."
      );

      // Acknowledge this kick so it cannot fire again on the next login.
      await remove(ref(database,`v2/kicks/${u.uid}`));

      // Sign out before returning home so index.html does not immediately
      // redirect the same authenticated account back into player.html.
      await signOut(auth);
    } catch (error) {
      console.error("Kick acknowledgement failed:", error);
    } finally {
      location.href = "./index.html";
    }
  });

  onValue(ref(database,"v2/claims"),s=>{
    const claims=s.val()||{};
    const rid=game.roundId;
    const st=stage();

    if(!rid) return;

    const stageClaims=claims?.[rid]?.[st]||{};
    const winners=Object.values(stageClaims);

    if(!winners.length) return;

    const key=`${rid}-${st}-${Object.keys(stageClaims).sort().join(",")}`;

    if(key===previousWinnerKey) return;
    previousWinnerKey=key;

    const names=winners.map(w=>w.name||"Player");
    const reward=st==="one-line"?100:st==="two-lines"?200:500;

    const localWinner = winners.some(w => w.uid === user.uid);
    showWinnerOverlay(stageName(st), names, localWinner ? reward : 0);

    if (localWinner) {
      fireConfettiCannons();
    }
  });
});
