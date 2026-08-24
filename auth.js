import { auth, database } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const $=id=>document.getElementById(id);
const loginTab=$("loginTab"),registerTab=$("registerTab"),loginForm=$("loginForm"),registerForm=$("registerForm"),message=$("authMessage");
let submitting=false;

function msg(text,type=""){message.textContent=text;message.className=`message-box ${type}`.trim();}
function mode(login){loginTab.classList.toggle("active",login);registerTab.classList.toggle("active",!login);loginForm.classList.toggle("hidden",!login);registerForm.classList.toggle("hidden",login);msg("");}
loginTab.onclick=()=>mode(true); registerTab.onclick=()=>mode(false);

function cleanUsername(value){
  return value.trim().toLowerCase();
}

function validUsername(value){
  return /^[a-z0-9._-]{2,24}$/.test(value);
}

function usernameEmail(username){
  // Firebase Auth still uses Email/Password internally, but players never need
  // to know or enter an email address.
  return `${username}@generalsassybingo.invalid`;
}

async function ensureProfile(user,name=""){
  const pRef=ref(database,`v2/profiles/${user.uid}`);
  const snap=await get(pRef);
  if(snap.exists()) return;

  const clean=(name||user.email?.split("@")[0]||"Player").trim().slice(0,24);
  const now=Date.now();

  const profile={
    uid:user.uid,
    username:clean,
    email:"",
    coins:25,
    lifetimeCoins:25,
    role:"player",
    createdAt:now,
    updatedAt:now,
    stats:{gamesPlayed:0,wins:0,fullHouses:0},
    cosmetics:{dabber:"default",theme:"default",nameEffect:"default",effect:"default"},
    inventory:{},
    achievements:{"account-created":now}
  };

  await set(pRef,profile);
}

loginForm.onsubmit=async e=>{
  e.preventDefault();
  submitting=true;

  try{
    const username=cleanUsername($("loginUsername").value);

    if(!validUsername(username)){
      msg("Username can use letters, numbers, dots, dashes and underscores.","error");
      return;
    }

    msg("Signing in...");

    const c=await signInWithEmailAndPassword(
      auth,
      usernameEmail(username),
      $("loginPassword").value
    );

    await ensureProfile(c.user,username);
    location.href="./player.html";
  }catch(err){
    console.error(err);
    msg("Could not sign in. Check your username and password.","error");
  }finally{
    submitting=false;
  }
};

registerForm.onsubmit=async e=>{
  e.preventDefault();
  submitting=true;

  try{
    const username=cleanUsername($("registerName").value);

    if(!validUsername(username)){
      msg("Username must be 2–24 characters using letters, numbers, dots, dashes or underscores.","error");
      return;
    }

    msg("Creating your account...");

    const c=await createUserWithEmailAndPassword(
      auth,
      usernameEmail(username),
      $("registerPassword").value
    );

    await ensureProfile(c.user,username);

    msg("Account created. 25 Sassy Coins issued.","success");
    setTimeout(()=>location.href="./player.html",400);
  }catch(err){
    console.error(err);

    if(err.code==="auth/email-already-in-use"){
      msg("That username is already taken.","error");
    }else{
      msg("Could not create account.","error");
    }
  }finally{
    submitting=false;
  }
};

onAuthStateChanged(auth,user=>{
  if(user&&!submitting) location.href="./player.html";
});
