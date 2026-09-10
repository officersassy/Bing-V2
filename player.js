import { auth,database,functions } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { ref,get,set,update,onValue,runTransaction,push,remove,onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { SHOP_ITEMS,ACHIEVEMENTS,AVATARS,RARITIES,CRATE_PRICE } from "./catalog.js?v=2.3.9";
import { BLANK,validWin } from "./game-engine.js";


const sassyLoadingAudio=document.getElementById("sassyLoadingAudio");
const bingoWinnerAudio=document.getElementById("bingoWinnerAudio");
let lastWinnerMusicKey=null;


// V2.4 — General Sassy voice announcer.
const SASSY_VOICE_COUNTS={start:5,pause:5,resume:5,invalid:6,slow:4,random:6};
const sassyVoiceAudio=new Audio();
sassyVoiceAudio.preload="auto";
sassyVoiceAudio.volume=0.82;
let sassyVoiceBusy=false;
let lastSassyVoicePick={};
let sassyVoiceUnlocked=false;
let pendingSassyVoice=null;
const SASSY_MIN_GAP_MS=30000;
let lastSassyVoiceAt=0;

function pickSassyVoice(category){
  const count=SASSY_VOICE_COUNTS[category]||0;
  if(!count)return null;
  let pick=1;
  if(count>1){
    do{pick=1+Math.floor(Math.random()*count);}while(pick===lastSassyVoicePick[category]);
  }
  lastSassyVoicePick[category]=pick;
  return `./assets/audio/sassy-voice/${category}-${String(pick).padStart(2,"0")}.mp3`;
}

async function playSassyVoice(category,{force=false}={}){
  const src=pickSassyVoice(category);
  if(!src)return false;
  if(sassyVoiceBusy&&!force)return false;
  if(!force && Date.now()-lastSassyVoiceAt<SASSY_MIN_GAP_MS)return false;
  if(force){try{sassyVoiceAudio.pause();}catch{}}
  try{
    sassyVoiceBusy=true;
    sassyVoiceAudio.src=src;
    sassyVoiceAudio.currentTime=0;
    await sassyVoiceAudio.play();
    sassyVoiceUnlocked=true;
    lastSassyVoiceAt=Date.now();
    return true;
  }catch(error){
    sassyVoiceBusy=false;
    // Browsers may block audio until the player interacts with the page.
    pendingSassyVoice=category;
    return false;
  }
}

sassyVoiceAudio.addEventListener("ended",()=>{sassyVoiceBusy=false;});
sassyVoiceAudio.addEventListener("error",()=>{sassyVoiceBusy=false;});

async function unlockSassyVoice(){
  sassyVoiceUnlocked=true;
  if(pendingSassyVoice&&!sassyVoiceBusy){
    const category=pendingSassyVoice;
    pendingSassyVoice=null;
    await playSassyVoice(category);
  }
}
document.addEventListener("pointerdown",unlockSassyVoice,{capture:true});
document.addEventListener("keydown",unlockSassyVoice,{capture:true});

function playAudioSafely(audio,{restart=true,volume=0.7}={}){
  if(!audio)return;
  try{
    audio.volume=volume;
    if(restart)audio.currentTime=0;
    const promise=audio.play();
    if(promise?.catch)promise.catch(()=>{});
  }catch(error){
    console.debug("Audio playback unavailable:",error);
  }
}

function playWinnerTuneOnce(winnerKey){
  if(!winnerKey || winnerKey===lastWinnerMusicKey)return;
  lastWinnerMusicKey=winnerKey;
  if(sassyLoadingAudio && !sassyLoadingAudio.paused)sassyLoadingAudio.pause();
  playAudioSafely(bingoWinnerAudio,{volume:0.65});
  // Winner celebration: about 15 seconds, then fade.
  setTimeout(()=>{
    if(!bingoWinnerAudio || bingoWinnerAudio.paused)return;
    const fade=setInterval(()=>{
      bingoWinnerAudio.volume=Math.max(0,bingoWinnerAudio.volume-0.06);
      if(bingoWinnerAudio.volume<=0.02){
        clearInterval(fade);
        bingoWinnerAudio.pause();
        bingoWinnerAudio.currentTime=0;
        bingoWinnerAudio.volume=0.65;
      }
    },140);
  },15000);
}

const $=id=>document.getElementById(id);
let user=null,profile=null,game={},card=[],marked=[],called=[],playerRoundId=null;
let previousAchievements = new Set();
let previousCoinBalance = null;
let previousWinnerKey = null;
let currentStoreFilter="all";
let lastCrateItem=null;

function show(id,text,type=""){const el=$(id);el.textContent=text;el.className=`message-box ${type}`.trim();}
function coins(n){return Number(n||0).toLocaleString("en-GB");}

function normaliseForModeration(value){
  return String(value||"")
    .toLowerCase()
    .replace(/[^a-z0-9]/g,"");
}

const BUILTIN_BANNED_USERNAME_TERMS=["fuck", "fucker", "fucking", "cunt", "shit", "bitch", "bastard", "dick", "cock", "pussy", "wanker", "twat", "slut", "whore", "porn", "porno", "sex", "nazi", "hitler"];


async function usernameIsBanned(value){
  const normalised=normaliseForModeration(value);

  // Permanent baseline is checked FIRST and needs no Firebase connection.
  if(BUILTIN_BANNED_USERNAME_TERMS.some(term=>
    normalised.includes(normaliseForModeration(term))
  )){
    return true;
  }

  try{
    const snap=await get(ref(database,"v2/bannedUsernameTerms"));
    return Object.values(snap.val()||{}).some(item=>{
      const term=normaliseForModeration(item?.term||"");
      return term && normalised.includes(term);
    });
  }catch(error){
    console.error("Username moderation lookup failed:",error);
    return false;
  }
}


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
  if (!["confetti-party","effect-fireworks","effect-coin-rain","effect-meteor","effect-jackpot","effect-lightning","effect-sassy-crown"].includes(profile?.cosmetics?.effect)) return;

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
          : effect==="effect-lightning"
            ? ["⚡","🌩️","✨","⚡"]
            : effect==="effect-sassy-crown"
              ? ["👑","💎","✨","⭐"]
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


function drawPdPauseModal(){
  const modal=$("pdPauseModal");
  if(!modal)return;

  const paused=game.status==="paused" &&
    playerRoundId===game.roundId &&
    card.length>0;

  modal.classList.toggle("hidden",!paused);
  if(!paused)return;

  const reason=game.pauseReason||"PD Duties";
  const lastCall=game.currentCall||"--";
  const resumeAt=Number(game.resumeCountdown?.resumeAt||0);
  const remaining=resumeAt?Math.max(0,Math.ceil((resumeAt-Date.now())/1000)):0;

  $("pdPauseTitle").textContent=remaining>0?"BINGO RESUMING":"BINGO PAUSED";
  $("pdPauseReason").textContent=reason;
  $("pdPauseLastCall").textContent=lastCall;

  const countdown=$("pdResumeCountdown");
  countdown.classList.toggle("hidden",remaining<=0);
  countdown.textContent=remaining>0?`${remaining}`:"";
}

function pdPauseMessage(){
  const reason=game.pauseReason||"PD Duties";
  const lastCall=game.currentCall||"--";
  const resumeAt=Number(game.resumeCountdown?.resumeAt||0);
  const remaining=resumeAt?Math.max(0,Math.ceil((resumeAt-Date.now())/1000)):0;
  return remaining>0
    ? `🚨 ${reason.toUpperCase()} — Resuming in ${remaining}… Last number: ${lastCall}`
    : `🚨 BINGO SUSPENDED — ${reason}. General Sassy reluctantly authorises actual police work. Last number: ${lastCall}. Your card and dabs are safe.`;
}

function drawWaitingState() {
  drawPdPauseModal();
  const tieWindowOpen=["stage-winner","winner"].includes(game.status) &&
    Number(game.claimWindowClosesAt||0)>=Date.now();
  const inRound = (["playing","paused"].includes(game.status)||tieWindowOpen) &&
    playerRoundId === game.roundId && card.length > 0;
  const paused = game.status === "paused" && inRound;

  $("waitingPanel").classList.toggle("hidden", !paused && inRound);
  $("liveGamePanel").classList.toggle("hidden", !inRound);
  $("ticketTitle").closest(".ticket-panel").classList.toggle("hidden", !inRound);
  $("claimBingoButton").classList.toggle("hidden", !inRound);
  $("claimBingoButton").disabled=paused || !(game.status==="playing"||tieWindowOpen);

  if (paused) {
    $("waitingMessage").textContent = pdPauseMessage();
  } else if (!inRound) {
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

const V25_DEAL_DISCOUNT=0.25;
let wishlistOnly=false;
function wishlistKey(){return `sassyWishlist:${user?.uid||"guest"}`;}
function getWishlist(){try{return new Set(JSON.parse(localStorage.getItem(wishlistKey())||"[]"));}catch{return new Set();}}
function saveWishlist(set){localStorage.setItem(wishlistKey(),JSON.stringify([...set]));drawShop();}
function toggleWishlist(id){const w=getWishlist();w.has(id)?w.delete(id):w.add(id);saveWishlist(w);}
function dayNumber(){return Math.floor(Date.now()/86400000);}
function dailyDealItem(){const paid=SHOP_ITEMS.filter(x=>x.price>0);return paid[dayNumber()%paid.length];}
function effectivePrice(item){return item.id===dailyDealItem()?.id?Math.max(1,Math.floor(item.price*(1-V25_DEAL_DISCOUNT))):item.price;}
function featuredItems(){const paid=SHOP_ITEMS.filter(x=>x.price>0);const d=dayNumber();return [0,7,17].map(n=>paid[(d+n)%paid.length]);}
let previewItemIndex=-1;
let previewTimer=null;
function previewPlayerName(){return String(profile?.username||user?.displayName||"GENERAL SASSY").toUpperCase();}
function previewItemsInOrder(){
  const wish=getWishlist();
  return SHOP_ITEMS.filter(item=>(currentStoreFilter==="all"||item.type===currentStoreFilter)&&(!wishlistOnly||wish.has(item.id)));
}
function previewMarkup(item){
  const name=previewPlayerName();
  if(item.type==="avatar") return `<div class="v251-avatar-stage"><img src="./${item.image}" alt=""><div><strong>${name}</strong><span>PLAYER AVATAR</span></div></div>`;
  if(item.type==="dabber") return `<div class="v251-ticket"><div class="v251-bingo-head"><b>B</b><b>I</b><b>N</b><b>G</b><b>O</b></div><div class="v251-grid"><i>7</i><i>18</i><i class="v251-marked">42</i><i>53</i><i>71</i></div><small>Watch 42 get dobbed</small></div>`;
  if(item.type==="theme") return `<div class="v251-ticket v251-theme"><div class="v251-theme-label">BINGO CARD</div><div class="v251-bingo-head"><b>B</b><b>I</b><b>N</b><b>G</b><b>O</b></div><div class="v251-grid"><i>4</i><i>19</i><i>FREE</i><i>52</i><i>69</i></div><div class="v251-grid"><i>11</i><i>27</i><i>39</i><i>58</i><i>74</i></div></div>`;
  if(item.type==="nameEffect") return `<div class="v251-name-stage"><span>PLAYER NAME</span><strong>${name}</strong><small>Shown on your profile and in game</small></div>`;
  if(item.type==="effect") return `<div class="v251-win-stage"><div class="v251-fx-layer" id="previewFxLayer"></div><div class="v251-trophy">🏆</div><strong>BINGO!</strong><span>${name}</span><button id="replayPreviewFx" type="button">↻ REPLAY EFFECT</button></div>`;
  return `<div class="v251-generic">${item.icon}</div>`;
}
function playPreviewEffect(item){
  clearTimeout(previewTimer);
  const layer=$("previewFxLayer"); if(!layer)return;
  layer.innerHTML=""; layer.className=`v251-fx-layer fx-${item.id}`;
  const specs={
    "confetti-party":["🎉","✨","🎊"],"effect-fireworks":["🎆","✨","💥"],"effect-coin-rain":["🪙","💰","✨"],
    "effect-meteor":["☄️","🔥","✨"],"effect-jackpot":["🎰","7️⃣","⭐","🪙"],"effect-lightning":["⚡","🌩️","✨"],"effect-sassy-crown":["👑","✨","💎","⭐"]
  };
  const bits=specs[item.id]||["✨","🎉"];
  for(let i=0;i<24;i++){
    const b=document.createElement("b"); b.textContent=bits[i%bits.length]; b.style.setProperty("--x",`${4+Math.random()*92}%`); b.style.setProperty("--d",`${Math.random()*.7}s`); b.style.setProperty("--r",`${-35+Math.random()*70}deg`); layer.appendChild(b);
  }
  layer.classList.remove("playing"); void layer.offsetWidth; layer.classList.add("playing");
  previewTimer=setTimeout(()=>layer?.classList.remove("playing"),3200);
}
function openPreview(item){
  if(!item)return;
  const r=rarityMeta(item), list=previewItemsInOrder(); previewItemIndex=list.findIndex(x=>x.id===item.id);
  $("previewVisual").innerHTML=storeVisual(item); $("previewRarity").className=`rarity-chip rarity-${item.rarity}`; $("previewRarity").textContent=`${r.icon} ${r.name}`;
  $("previewName").textContent=item.name; $("previewDescription").textContent=item.description||"";
  const demo=$("previewDemo"); demo.className=`v251-preview-demo preview-${item.type} cosmetic-${item.id}`; demo.dataset.item=item.id; demo.innerHTML=previewMarkup(item);
  $("previewType").textContent=({avatar:"AVATAR",dabber:"DOBBER",theme:"CARD THEME",nameEffect:"NAME EFFECT",effect:"WINNER EFFECT"}[item.type]||item.type).toUpperCase();
  $("previewOwned").textContent=isOwned(item)?"✓ OWNED":(item.price===0?"FREE":`${coins(effectivePrice(item))} 🪙`);
  $("storePreviewOverlay").classList.remove("hidden");
  $("previewPrev").disabled=list.length<2; $("previewNext").disabled=list.length<2;
  const replay=$("replayPreviewFx"); if(replay)replay.onclick=()=>playPreviewEffect(item);
  if(item.type==="effect") requestAnimationFrame(()=>playPreviewEffect(item));
}
function movePreview(step){const list=previewItemsInOrder();if(!list.length)return;previewItemIndex=(previewItemIndex+step+list.length)%list.length;openPreview(list[previewItemIndex]);}
function closePreview(){clearTimeout(previewTimer);$("storePreviewOverlay").classList.add("hidden");}

function renderV25Dashboard(){
 const deal=dailyDealItem(), w=getWishlist(), owned=SHOP_ITEMS.filter(isOwned).length;
 $("wishlistCount").textContent=w.size; $("collectionProgress").textContent=`${Math.round(owned/SHOP_ITEMS.length*100)}%`;
 const makeMini=item=>`<button class="v25-mini rarity-${item.rarity}" data-preview="${item.id}"><span>${item.icon}</span><strong>${item.name}</strong><small>${item.id===deal.id?`${coins(effectivePrice(item))} 🪙 · was ${coins(item.price)}`:`${coins(item.price)} 🪙`}</small></button>`;
 $("dailyDeal").innerHTML=makeMini(deal); $("featuredItems").innerHTML=featuredItems().map(makeMini).join("");
 document.querySelectorAll("[data-preview]").forEach(b=>b.onclick=()=>openPreview(SHOP_ITEMS.find(x=>x.id===b.dataset.preview)));
}

function drawShop(){
  if(!profile)return;

  $("storeCoinBalance").textContent=coins(profile.coins);
  const ownedCount=SHOP_ITEMS.filter(isOwned).length;
  $("ownedCosmeticCount").textContent=ownedCount;

  const wish=getWishlist();
  const visible=SHOP_ITEMS.filter(item=>
    (currentStoreFilter==="all" || item.type===currentStoreFilter) && (!wishlistOnly || wish.has(item.id))
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
          <div class="store-price">${item.price===0 ? "FREE" : (effectivePrice(item)!==item.price ? `${coins(effectivePrice(item))} 🪙 <small>was ${coins(item.price)}</small>` : `${coins(item.price)} 🪙`)}</div>
        </div>
      `;

      const button=document.createElement("button");
      button.className=owned ? "store-equip-button" : "store-buy-button";

      if(owned){
        button.textContent=equipped ? "✓ EQUIPPED" : "EQUIP";
        button.disabled=equipped;
        if(!equipped)button.onclick=()=>equipItem(item);
      }else{
        button.textContent=`BUY — ${coins(effectivePrice(item))} 🪙`;
        button.onclick=()=>buyItem(item);
      }

      const tools=document.createElement("div"); tools.className="v25-card-tools";
      const preview=document.createElement("button"); preview.type="button"; preview.className="ghost-button"; preview.textContent="👁 Preview"; preview.onclick=()=>openPreview(item);
      const heart=document.createElement("button"); heart.type="button"; heart.className="ghost-button"; heart.textContent=wish.has(item.id)?"♥ Saved":"♡ Wishlist"; heart.onclick=()=>toggleWishlist(item.id);
      const gift=document.createElement("button"); gift.type="button"; gift.className="ghost-button"; gift.textContent="🎁 Gift"; gift.onclick=async()=>{const username=prompt(`Gift ${item.name} to which username?`);if(!username)return;try{const giftFn=httpsCallable(functions,"giftStoreItem");const result=await giftFn({itemId:item.id,username});show("shopMessage",`Gift sent to ${result.data.recipient}!`,`success`);toast("Gift Sent",`${item.name} → ${result.data.recipient}`,"🎁");}catch(e){show("shopMessage",String(e?.message||"Gift failed").replace(/^FirebaseError:\s*/i,""),"error");}};
      tools.append(preview,heart,gift); card.appendChild(tools); card.appendChild(button);
      $("shopList").appendChild(card);
    });
  renderV25Dashboard();
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
  if(isOwned(item)){await equipItem(item);return;}
  const price=effectivePrice(item);
  if(Number(profile.coins||0)<price){show("shopMessage","Not enough Sassy Coins.","error");return;}
  try{
    show("shopMessage",`General Sassy is processing ${item.name}...`,"success");
    const buy=httpsCallable(functions,"buyStoreItem"); const result=await buy({itemId:item.id});
    show("shopMessage",`${item.name} purchased for ${coins(result.data?.pricePaid??price)} coins. No host cashier required.`,"success");
    toast("Purchase Complete",item.name,item.icon);
  }catch(error){console.error("Direct purchase failed",error);show("shopMessage",String(error?.message||"Purchase failed").replace(/^FirebaseError:\s*/i,""),"error");}
}

$("closeStorePreview").onclick=closePreview;
$("previewPrev").onclick=()=>movePreview(-1);
$("previewNext").onclick=()=>movePreview(1);
$("storePreviewOverlay").addEventListener("click",e=>{if(e.target===$("storePreviewOverlay"))closePreview();});
$("wishlistOnly").onclick=()=>{wishlistOnly=!wishlistOnly;$("wishlistOnly").textContent=wishlistOnly?"❤️ Showing Wishlist":"❤️ Wishlist Only";drawShop();};
$("closeCrateHistory").onclick=()=>$("crateHistoryOverlay").classList.add("hidden");
$("showCrateHistory").onclick=async()=>{const snap=await get(ref(database,`v2/transactions/${user.uid}`));const rows=Object.values(snap.val()||{}).filter(x=>x.type==="crate").sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,10);$("crateCount").textContent=Object.values(snap.val()||{}).filter(x=>x.type==="crate").length;$("crateHistoryList").innerHTML=rows.length?rows.map(x=>`<div><b>${x.rarity||"DROP"}</b><span>${x.reason||x.itemId}</span></div>`).join(""):"<p>No crates opened yet.</p>";$("crateHistoryOverlay").classList.remove("hidden");};

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
        if(game.status==="paused"){
          show("gameMessage","Game paused — your card is frozen until the host resumes.","error");
          return;
        }
        if(game.status!=="playing"){
          show("gameMessage","The round is not active.","error");
          return;
        }
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
  $("gameStageText").textContent=game.status==="paused"?"⏸ PAUSED":game.status==="playing"?stageName(stage()):"Waiting for host";
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
    playSassyVoice("invalid");
    try{
      await push(ref(database,"v2/sassyEvents"),{type:"invalid",uid:user.uid,name:profile.username||"Player",createdAt:Date.now()});
    }catch(error){console.debug("Host Sassy event unavailable:",error);}
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
  const name=$("newPlayerName").value.trim();

  if(name.length<2||name.length>24){
    alert("Username must be between 2 and 24 characters.");
    return;
  }

  if(await usernameIsBanned(name)){
    alert("That username is not allowed. Choose another one.");
    return;
  }

  await update(
    ref(database,`v2/profiles/${user.uid}`),
    {username:name,updatedAt:Date.now()}
  );

  $("nameModal").classList.add("hidden");
};

onAuthStateChanged(auth,async u=>{
  if(!u){location.href="./index.html";return;} user=u;
  const lobbyRef=ref(database,`v2/lobby/${u.uid}`);
  const connectedRef=ref(database,".info/connected");
  const joinedAt=Date.now();

  // Keep the lobby entry during temporary Wi-Fi/browser disconnects.
  // Firebase will mark the player offline instead of deleting them, then
  // automatically restore them to online when the connection comes back.
  onValue(connectedRef,async snap=>{
    if(snap.val()!==true)return;
    try{
      await update(lobbyRef,{online:true,joinedAt,lastSeen:Date.now()});
      await onDisconnect(lobbyRef).update({online:false});
    }catch(error){
      console.debug("Lobby presence update failed:",error);
    }
  });

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

// Keep the PD resume countdown moving on player screens.
setInterval(()=>{
  if(game.status==="paused" && game.resumeCountdown?.resumeAt) drawWaitingState();
},250);


// V2.3.14 — celebration music fires only for verified Bingo winners.
onValue(ref(database,"v2/verifiedWinners"),snap=>{
  const data=snap.val()||{};
  const roundWinners=game.roundId ? data[game.roundId] : null;
  if(!roundWinners)return;

  const entries=Object.entries(roundWinners);
  if(!entries.length)return;

  const winnerKey=`${game.roundId}:${entries.map(([key,value])=>`${key}:${value?.uid||value?.playerUid||""}`).sort().join("|")}`;
  playWinnerTuneOnce(winnerKey);
});


function stopWinnerTune(){
  if(!bingoWinnerAudio)return;
  try{
    bingoWinnerAudio.pause();
    bingoWinnerAudio.currentTime=0;
    bingoWinnerAudio.volume=0.65;
  }catch(error){
    console.debug("Could not stop winner audio:",error);
  }
  $("winnerOverlay")?.classList.add("hidden");
}

function stopLoadingTune(){
  if(!sassyLoadingAudio)return;
  try{
    sassyLoadingAudio.pause();
    sassyLoadingAudio.currentTime=0;
    sassyLoadingAudio.volume=0.45;
  }catch(error){
    console.debug("Could not stop loading audio:",error);
  }
}

let loadingTuneStarted=false;
let loadingTuneFadeTimer=null;

async function startSassyLoadingTune(){
  if(loadingTuneStarted || !sassyLoadingAudio)return;

  try{
    sassyLoadingAudio.volume=0.45;
    sassyLoadingAudio.currentTime=0;
    await sassyLoadingAudio.play();
    loadingTuneStarted=true;

    loadingTuneFadeTimer=setTimeout(()=>{
      if(sassyLoadingAudio.paused)return;
      const fade=setInterval(()=>{
        sassyLoadingAudio.volume=Math.max(0,sassyLoadingAudio.volume-0.08);
        if(sassyLoadingAudio.volume<=0.02){
          clearInterval(fade);
          sassyLoadingAudio.pause();
          sassyLoadingAudio.currentTime=0;
          sassyLoadingAudio.volume=0.45;
        }
      },120);
    },6500);
  }catch(error){
    // Autoplay was blocked. Do NOT mark it as started:
    // the first real user interaction below will retry it.
    console.debug("Loading tune waiting for user interaction.");
  }
}

// Try autoplay first. If the browser blocks it, retry on the first genuine
// click/tap/key press. Using capture means even the first menu interaction works.
window.addEventListener("load",()=>setTimeout(startSassyLoadingTune,250),{once:true});
document.addEventListener("pointerdown",startSassyLoadingTune,{capture:true});
document.addEventListener("keydown",startSassyLoadingTune,{capture:true});


// V2.3.16 — host-controlled winner music stop.
// As soon as the host moves away from a winner state (Continue/Next Round),
// Celebration stops immediately and the winner overlay closes.
let previousMusicGameStatus=null;
onValue(ref(database,"v2/game"),snap=>{
  const nextGame=snap.val()||{};
  const nextStatus=nextGame.status||"waiting";

  const wasWinnerState=["winner","stage-winner"].includes(previousMusicGameStatus);
  const isWinnerState=["winner","stage-winner"].includes(nextStatus);

  if(wasWinnerState && !isWinnerState){
    stopWinnerTune();
  }

  // Once the host starts/resumes live Bingo, the loading tune must end immediately.
  if(nextStatus==="playing"){
    stopLoadingTune();
  }

  previousMusicGameStatus=nextStatus;
});


// V2.4 — event choreography for General Sassy.
// Start, pause and resume are transition-based so refreshing mid-round does not replay them.
let sassyPreviousStatus=null;
let sassyPreviousRoundId=null;
let sassyPreviousCalledCount=0;
let sassySlowPlayedForRound=false;
let sassyLastRandomAt=0;

onValue(ref(database,"v2/game"),snap=>{
  const next=snap.val()||{};
  const status=next.status||"waiting";
  const roundId=next.roundId||null;
  const callCount=Object.keys(next.called||{}).length;

  if(sassyPreviousStatus!==null){
    const freshRound=status==="playing" && roundId && roundId!==sassyPreviousRoundId;
    const resumed=status==="playing" && sassyPreviousStatus==="paused";
    const justPaused=status==="paused" && sassyPreviousStatus!=="paused";

    if(freshRound){
      sassySlowPlayedForRound=false;
      sassyLastRandomAt=0;
      playSassyVoice("start",{force:true});
    }else if(justPaused){
      playSassyVoice("pause",{force:true});
    }else if(resumed){
      playSassyVoice("resume",{force:true});
    }

    if(status==="playing" && roundId===sassyPreviousRoundId && callCount>sassyPreviousCalledCount){
      const slowThreshold=String(next.mode||"").startsWith("90")?55:45;
      if(!sassySlowPlayedForRound && callCount>=slowThreshold){
        sassySlowPlayedForRound=true;
        playSassyVoice("slow");
      }else if(callCount>=12 && callCount-sassyLastRandomAt>=12 && Math.random()<0.10){
        if(playSassyVoice("random"))sassyLastRandomAt=callCount;
      }
    }
  }

  if(roundId!==sassyPreviousRoundId){
    sassySlowPlayedForRound=false;
    sassyLastRandomAt=0;
  }
  sassyPreviousStatus=status;
  sassyPreviousRoundId=roundId;
  sassyPreviousCalledCount=callCount;
});
