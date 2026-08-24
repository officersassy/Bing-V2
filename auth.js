import { auth, database } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const $=id=>document.getElementById(id);
const loginTab=$("loginTab"),registerTab=$("registerTab"),loginForm=$("loginForm"),registerForm=$("registerForm"),message=$("authMessage");
let submitting=false;

function msg(text,type=""){message.textContent=text;message.className=`message-box ${type}`.trim();}
function mode(login){loginTab.classList.toggle("active",login);registerTab.classList.toggle("active",!login);loginForm.classList.toggle("hidden",!login);registerForm.classList.toggle("hidden",login);msg("");}
loginTab.onclick=()=>mode(true); registerTab.onclick=()=>mode(false);

async function ensureProfile(user,name=""){
  const pRef=ref(database,`v2/profiles/${user.uid}`);
  const snap=await get(pRef);
  if(snap.exists()) return;
  const clean=(name||user.email?.split("@")[0]||"Player").trim().slice(0,24);
  const now=Date.now();
  await set(pRef,{
    uid:user.uid,username:clean,email:user.email||"",coins:25,lifetimeCoins:25,role:"player",
    createdAt:now,updatedAt:now,stats:{gamesPlayed:0,wins:0,fullHouses:0},
    cosmetics:{dabber:"default",theme:"default",nameEffect:"default"},
    inventory:{},achievements:{"account-created":now}
  });
}

loginForm.onsubmit=async e=>{
  e.preventDefault();submitting=true;
  try{
    msg("Signing in...");
    const c=await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);
    await ensureProfile(c.user);
    location.href="./player.html";
  }catch(err){console.error(err);msg("Could not sign in. Check your email and password.","error");}
  finally{submitting=false;}
};

registerForm.onsubmit=async e=>{
  e.preventDefault();submitting=true;
  try{
    msg("Creating your account...");
    const c=await createUserWithEmailAndPassword(auth,$("registerEmail").value.trim(),$("registerPassword").value);
    await ensureProfile(c.user,$("registerName").value.trim());
    msg("Account created. 25 Sassy Coins issued.","success");
    setTimeout(()=>location.href="./player.html",400);
  }catch(err){console.error(err);msg(err.code==="auth/email-already-in-use"?"That email already has an account.":"Could not create account.","error");}
  finally{submitting=false;}
};

onAuthStateChanged(auth,user=>{if(user&&!submitting) location.href="./player.html";});
