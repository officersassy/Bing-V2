import { auth,database } from "./firebase.js";
import { onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref,get,set,update,onValue,runTransaction,push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { SHOP_ITEMS,ACHIEVEMENTS } from "./catalog.js";
import { BLANK,validWin } from "./game-engine.js";

const $=id=>document.getElementById(id);
let user=null,profile=null,game={},card=[],marked=[],called=[];

function show(id,text,type=""){const el=$(id);el.textContent=text;el.className=`message-box ${type}`.trim();}
function coins(n){return Number(n||0).toLocaleString("en-GB");}
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
}
function drawShop(){
  $("shopList").innerHTML="";
  SHOP_ITEMS.forEach(item=>{
    const owned=Boolean(profile?.inventory?.[item.id]);
    const row=document.createElement("div");row.className="shop-item";
    row.innerHTML=`<div class="shop-icon">${item.icon}</div><div><strong>${item.name}</strong><small>${item.price} 🪙</small></div>`;
    const btn=document.createElement("button");btn.textContent=owned?"Owned":`Buy`;
    btn.disabled=owned;btn.onclick=()=>buyItem(item);
    row.appendChild(btn);$("shopList").appendChild(row);
  });
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
  onValue(ref(database,`v2/profiles/${u.uid}`),s=>{profile=s.val();drawProfile();drawShop();drawAchievements();});
  onValue(ref(database,"v2/profiles"),s=>drawLeaderboard(s.val()||{}));
  onValue(ref(database,"v2/game"),async s=>{
    game=s.val()||{};
    called=Object.values(game.called||{}).map(Number);
    const gp=await get(ref(database,`v2/gamePlayers/${u.uid}`));
    if(gp.exists()){card=gp.val().card||[];marked=gp.val().marked||[];}
    drawGame();
  });
  onValue(ref(database,`v2/gamePlayers/${u.uid}`),s=>{if(s.exists()){card=s.val().card||[];marked=s.val().marked||[];drawGame();}});
});
