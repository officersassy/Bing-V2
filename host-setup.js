import { auth } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const email = document.getElementById("setupEmail");
const password = document.getElementById("setupPassword");
const loginButton = document.getElementById("setupLoginButton");
const signedOut = document.getElementById("setupSignedOut");
const signedIn = document.getElementById("setupSignedIn");
const account = document.getElementById("setupAccount");
const uidBox = document.getElementById("hostUid");
const copyButton = document.getElementById("copyUidButton");
const message = document.getElementById("setupMessage");

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true;
  message.textContent = "Signing in...";

  try {
    await signInWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value
    );
  } catch (error) {
    console.error(error);
    message.textContent = "Could not sign in.";
    message.className = "message-box error";
  } finally {
    loginButton.disabled = false;
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(uidBox.textContent);
  message.textContent = "UID copied.";
  message.className = "message-box success";
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    signedOut.classList.remove("hidden");
    signedIn.classList.add("hidden");
    return;
  }

  signedOut.classList.add("hidden");
  signedIn.classList.remove("hidden");

  account.textContent = user.email || "Host";
  uidBox.textContent = user.uid;
});
