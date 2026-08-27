import { auth,database,functions } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { ref,get,set,update,onValue,runTransaction,push,remove,onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { SHOP_ITEMS,ACHIEVEMENTS,AVATARS,RARITIES,CRATE_PRICE } from "./catalog.js?v=2.3.7";
import { BLANK,validWin } from "./game-engine.js?v=2.3.7";

const $=id=>document.getElementById(id);
let user=null,profile=null,game={},card=[],marked=[],called=[],playerRoundId=null;
let previousAchievements = new Set();
let previousCoinBalance = null;
let previousWinnerKey = null;
let currentStoreFilter="all";
let lastCrateItem=null;

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
function avatarItem(id){
  return AVATARS.find(item=>item.id===id)||AVATARS[0];
}

function isOwned(item) {
  return item.price === 0 || Boolean(profile?.inventory?.[item.id]);
}

function isEquipped(item) {
  const c = profile?.cosmetics || {};

  const map = {
    dabber: c.dabber,
    theme: c.theme,
    effect: c.effect,
    nameEffect: c.nameEffect,
    avatar: c.avatar || "avatar-ball"
  };

  return map[item.type] === item.id;
}


function applyCosmetics() {
  const dabber = profile?.cosmetics?.dabber || "default";
  const theme = profile?.cosmetics?.theme || "default";
  const nameEffect = profile?.cosmetics?.nameEffect || "default";
  const effect = profile?.cosmetics?.effect || "default";
  const avatar = profile?.cosmetics?.avatar || "avatar-ball";

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
  $("equippedAvatar").textContent = cosmeticName(avatar);
  const selectedAvatar=avatarItem(avatar);
  $("profileAvatar").innerHTML=selectedAvatar?.image
    ? `<img class="profile-avatar-img" src="./${selectedAvatar.image}" alt="${selectedAvatar.name}">`
    : (selectedAvatar?.icon||"🎱");
  $("profileAvatar").dataset.avatar=avatar;
}

function fireConfettiCannons() {
  if (!["confetti-party","effect-fireworks","effect-coin-rain","effect-meteor","effect-jackpot"].includes(profile?.cosmetics?.effect)) return;

  const layer = $("confettiLayer");
  if (!layer) return;

  layer.innerHTML = "";
  const pieces = 90;
  const effect=profile?.cosmetics?.effect;
  const symbols=effect==="effect-fireworks"
    ? ["✨","💥","🎆","★"]
    : effect==="effect-coin-rain"
      ? ["🪙","💰","🪙","✨"]
      : effect==="effect-meteor"
        ? ["☄️","🔥","✦","☄️"]
        : effect==="effect-jackpot"
          ? ["🎰","7️⃣","⭐","🪙"]
          : ["●","■","▲","★"];

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
  $("winnerNames").innerHTML = names.map(name => `<div class="winner-name-row">🏆 ${name}</div>`).join("");

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
  const active = game.status === "playing" && playerRoundId === game.roundId && card.length > 0;

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
  $("gamesPlayed").textContent=profile.stats?.gamesPlayed||0;
  $("winsCount").textContent=profile.stats?.wins||0;
  $("fullHouseCount").textContent=profile.stats?.fullHouses||0;
  $("lifetimeCoins").textContent=coins(profile.lifetimeCoins);
  applyCosmetics();
}
function rarityMeta(item){
  return RARITIES[item.rarity] || RARITIES.common;
}

function storeVisual(item){
  if(item.type==="avatar" && item.image){
    return `<img class="premium-store-avatar" src="./${item.image}" alt="${item.name}">`;
  }
  return `<span class="premium-store-symbol">${item.icon}</span>`;
}

function drawShop(){
  if(!profile)return;

  $("storeCoinBalance").textContent=coins(profile.coins);
  const ownedCount=SHOP_ITEMS.filter(isOwned).length;
  $("ownedCosmeticCount").textContent=ownedCount;

  const visible=SHOP_ITEMS.filter(item=>
    currentStoreFilter==="all" || item.type===currentStoreFilter
  );

  $("storeItemCount").textContent=`${visible.length} items`;
  $("shopList").innerHTML="";

  visible
    .sort((a,b)=>{
      const order={sassy:5,legendary:4,epic:3,rare:2,common:1};
      return (order[b.rarity]||0)-(order[a.rarity]||0) || b.price-a.price;
    })
    .forEach(item=>{
      const owned=isOwned(item);
      const equipped=isEquipped(item);
      const rarity=rarityMeta(item);

      const card=document.createElement("article");
      card.className=`premium-store-item rarity-${item.rarity||"common"}`;

      card.innerHTML=`
        <div class="premium-store-visual">${storeVisual(item)}</div>
        <div class="premium-store-info">
          <span class="rarity-chip rarity-${item.rarity||"common"}">${rarity.icon} ${rarity.name}</span>
          <h3>${item.name}</h3>
          <p>${item.description||"General Sassy approved cosmetic."}</p>
          <div class="store-price">${item.price===0 ? "FREE" : `${coins(item.price)} 🪙`}</div>
        </div>
      `;

      const button=document.createElement("button");
      button.className=owned ? "store-equip-button" : "store-buy-button";

      if(owned){
        button.textContent=equipped ? "✓ EQUIPPED" : "EQUIP";
        button.disabled=equipped;
        if(!equipped)button.onclick=()=>equipItem(item);
      }else{
        button.textContent=`BUY — ${coins(item.price)} 🪙`;
        button.onclick=()=>buyItem(item);
      }

      card.appendChild(button);
      $("shopList").appendChild(card);
    });
}

document.querySelectorAll("#storeFilters button").forEach(button=>{
  button.onclick=()=>{
    currentStoreFilter=button.dataset.filter;
    document.querySelectorAll("#storeFilters button").forEach(b=>b.classList.remove("active"));
    button.classList.add("active");
    drawShop();
  };
});

function showCrateReward(item){
  lastCrateItem=item;
  const rarity=rarityMeta(item);
  const card=$("crateRevealCard");

  card.className=`crate-reveal-card rarity-${item.rarity}`;
  $("crateRevealIcon").innerHTML=item.type==="avatar"&&item.image
    ? `<img class="crate-avatar-prize" src="./${item.image}" alt="${item.name}">`
    : item.icon;
  $("crateRevealRarity").className=`rarity-chip rarity-${item.rarity}`;
  $("crateRevealRarity").textContent=`${rarity.icon} ${rarity.name}`;
  $("crateRevealName").textContent=item.name;
  $("crateRevealDescription").textContent=item.description||"New cosmetic unlocked.";
  $("crateEquipButton").classList.remove("hidden");
  $("crateOverlay").classList.remove("hidden");
}

$("closeCrateOverlay").onclick=()=>$("crateOverlay").classList.add("hidden");
$("crateEquipButton").onclick=async()=>{
  if(lastCrateItem){
    await equipItem(lastCrateItem);
    $("crateOverlay").classList.add("hidden");
  }
};

$("openSassyCrateButton").onclick=async()=>{
  if(Number(profile?.coins||0)<CRATE_PRICE){
    show("shopMessage","You need 1,000 Sassy Coins for a crate.","error");
    return;
  }

  const button=$("openSassyCrateButton");
  button.disabled=true;
  button.textContent="GENERAL SASSY IS CHOOSING...";

  try{
    const openCrate=httpsCallable(functions,"openSassyCrate");
    const result=await openCrate({});
    const data=result.data||{};

    if(data.complete){
      show("shopMessage","You already own every item available in the Sassy Crate.","success");
      return;
    }

    const item=SHOP_ITEMS.find(x=>x.id===data.itemId);

    if(!item)throw new Error("Unknown crate reward");

    showCrateReward(item);
    toast(`${rarityMeta(item).name} DROP!`,item.name,item.icon);
  }catch(error){
    console.error("Crate failed:",error);
    const rawMessage=String(error?.message||"");
    const cleanMessage=rawMessage
      .replace(/^FirebaseError:\s*/i,"")
      .replace(/^internal\s*/i,"")
      .trim();

    show(
      "shopMessage",
      rawMessage.toLowerCase().includes("coins")
        ? "Not enough Sassy Coins."
        : cleanMessage
          ? `Sassy Crate: ${cleanMessage}`
          : "Sassy Crate failed unexpectedly.",
      "error"
    );
  }finally{
    button.disabled=false;
    button.textContent="OPEN — 1,000 🪙";
  }
};

async function equipItem(item){
  const map = {
    dabber: "dabber",
    theme: "theme",
    effect: "effect",
    nameEffect: "nameEffect",
    avatar: "avatar"
  };

  const key = map[item.type];
  if(!key) return;

  if(!isOwned(item)){
    show("shopMessage","You need to buy that first.","error");
    return;
  }

  try{
    await set(
      ref(database,`v2/profiles/${user.uid}/cosmetics/${key}`),
      item.id
    );

    toast("Cosmetic Equipped",item.name,item.icon);
    show("shopMessage",`${item.name} equipped.`,"success");
  }catch(error){
    console.error("Equip failed:",error);
    show(
      "shopMessage",
      "Could not equip that item. Make sure the latest Firebase rules are published.",
      "error"
    );
  }
}
async function buyItem(item){
  if(isOwned(item)){
    await equipItem(item);
    return;
  }

  if(Number(profile.coins||0)<item.price){
    show("shopMessage","Not enough Sassy Coins.","error");
    return;
  }

  try{
    const requestRef=push(ref(database,`v2/purchaseRequests/${user.uid}`));

    await set(requestRef,{
      itemId:item.id,
      price:item.price,
      status:"pending",
      createdAt:Date.now()
    });

    show(
      "shopMessage",
      `Buying ${item.name}... keep the host page open for a moment.`,
      "success"
    );
  }catch(error){
    console.error("Purchase request failed:",error);
    show(
      "shopMessage",
      "Purchase request failed. Make sure the host is online.",
      "error"
    );
  }
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
    const avatar=avatarItem(p.avatar||"avatar-ball");
    const avatarVisual=avatar?.image
      ? `<img class="mini-avatar-img" src="./${avatar.image}" alt="${avatar.name}">`
      : `<span class="mini-avatar">${avatar?.icon||"🎱"}</span>`;
    row.innerHTML=`<strong>${i+1}</strong>${avatarVisual}<div><b>${p.username||"Player"}</b><small>${p.stats?.wins||0} wins</small></div><span>${coins(p.lifetimeCoins)} 🪙</span>`;
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
function stage(){
  if(game.mode==="90-progressive")return game.stage||"one-line";
  if(game.mode==="90-full-house")return "full-house";
  if(game.mode==="75-two-lines")return "two-lines";
  return "one-line";
}
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
  const tieWindowOpen=
    ["stage-winner","winner"].includes(game.status) &&
    Number(game.claimWindowClosesAt||0)>=Date.now();

  if(game.status!=="playing"&&!tieWindowOpen){
    show("gameMessage","The round is not accepting Bingo claims.","error");
    return;
  }

  if(playerRoundId!==game.roundId){
    show("gameMessage","You are waiting for the next round.","error");
    return;
  }

  if(!validWin(card,marked,called,game.mode,stage())){
    show("gameMessage",`Not a valid ${stageName(stage())} yet.`,"error");
    return;
  }

  try{
    await set(
      ref(database,`v2/claims/${game.roundId}/${stage()}/${user.uid}`),
      {
        uid:user.uid,
        name:profile.username,
        stage:stage(),
        claimedAt:Date.now()
      }
    );

    show("gameMessage","Bingo claim sent!","success");
  }catch(error){
    console.error(error);
    show("gameMessage","Your claim could not be submitted.","error");
  }
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
  const lobbyRef=ref(database,`v2/lobby/${u.uid}`);
  await set(lobbyRef,{
    online:true,
    joinedAt:Date.now()
  });
  onDisconnect(lobbyRef).remove();

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
  onValue(ref(database,"v2/publicProfiles"),s=>drawLeaderboard(s.val()||{}));
  onValue(ref(database,"v2/game"),async s=>{
    game=s.val()||{};
    called=Object.values(game.called||{}).map(Number);
    const gp=await get(ref(database,`v2/gamePlayers/${u.uid}`));
    if(gp.exists()){
      card=gp.val().card||[];
      marked=gp.val().marked||[];
      playerRoundId=gp.val().roundId||null;
    }else{
      card=[];
      marked=[];
      playerRoundId=null;
    }
    drawGame();
  });
  onValue(ref(database,`v2/gamePlayers/${u.uid}`),s=>{
    if(s.exists()){
      card=s.val().card||[];
      marked=s.val().marked||[];
      playerRoundId=s.val().roundId||null;
    }else{
      card=[];
      marked=[];
      playerRoundId=null;
    }
    drawGame();
  });

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

  onValue(ref(database,"v2/verifiedWinners"),s=>{
    const tree=s.val()||{};
    const rid=game.roundId;
    const st=stage();

    if(!rid)return;

    const stageWinners=tree?.[rid]?.[st]||{};
    const winners=Object.values(stageWinners);

    if(!winners.length)return;

    const key=`${rid}-${st}-${Object.keys(stageWinners).sort().join(",")}`;

    if(key===previousWinnerKey)return;
    previousWinnerKey=key;

    const names=winners.map(w=>{
      const av=avatarItem(w.avatar||"avatar-ball");
      const visual=av?.image
        ? `<img class="winner-avatar-img" src="./${av.image}" alt="${av.name}">`
        : `<span>${av?.icon||"🎱"}</span>`;
      return `${visual}<span>${w.name||"Player"}</span>`;
    });
    const reward=st==="one-line"?100:st==="two-lines"?200:500;
    const localWinner=winners.some(w=>w.uid===user.uid);

    showWinnerOverlay(stageName(st),names,localWinner?reward:0);

    if(localWinner){
      fireConfettiCannons();
    }
  });
  onValue(ref(database,`v2/purchaseRequests/${u.uid}`),snapshot=>{
    const requests=Object.values(snapshot.val()||{});
    const latest=requests.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0];

    if(!latest)return;

    if(latest.status==="complete"){
      show("shopMessage","Purchase complete. Item unlocked!","success");
    }else if(latest.status==="rejected"){
      show("shopMessage","Purchase was rejected — check your coin balance.","error");
    }
  });

});
