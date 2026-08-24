import { auth, database } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const email = document.getElementById("setupEmail");
const password = document.getElementById("setupPassword");
const loginButton = document.getElementById("setupLoginButton");
const logoutButton = document.getElementById("setupLogoutButton");

const signedOut = document.getElementById("setupSignedOut");
const signedIn = document.getElementById("setupSignedIn");
const account = document.getElementById("setupAccount");

const alreadyAdminBox = document.getElementById("alreadyAdminBox");
const claimAdminBox = document.getElementById("claimAdminBox");
const adminTakenBox = document.getElementById("adminTakenBox");

const claimAdminButton = document.getElementById("claimAdminButton");
const message = document.getElementById("setupMessage");

let currentUser = null;

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message-box ${type}`.trim();
}

function showOnly(target) {
  [alreadyAdminBox, claimAdminBox, adminTakenBox].forEach((box) => {
    box.classList.add("hidden");
  });

  if (target) {
    target.classList.remove("hidden");
  }
}

async function refreshSetupState(user) {
  currentUser = user;

  if (!user) {
    signedOut.classList.remove("hidden");
    signedIn.classList.add("hidden");
    showOnly(null);
    return;
  }

  signedOut.classList.add("hidden");
  signedIn.classList.remove("hidden");
  account.textContent = user.email || "Host";

  showMessage("Checking General Sassy admin status...");

  try {
    const ownAdminSnapshot = await get(
      ref(database, `v2/admins/${user.uid}`)
    );

    if (ownAdminSnapshot.exists() && ownAdminSnapshot.val() === true) {
      showOnly(alreadyAdminBox);
      showMessage("Administrator access confirmed.", "success");
      return;
    }

    const bootstrapSnapshot = await get(
      ref(database, "v2/adminBootstrap/claimed")
    );

    if (bootstrapSnapshot.exists() && bootstrapSnapshot.val() === true) {
      showOnly(adminTakenBox);
      showMessage(
        "The one-time administrator slot has already been claimed.",
        "error"
      );
      return;
    }

    showOnly(claimAdminBox);
    showMessage(
      "No administrator exists yet. This account may claim the one-time host role."
    );
  } catch (error) {
    console.error(error);
    showMessage(
      "Could not check admin status. Make sure the Phase 2.1 Firebase rules are published.",
      "error"
    );
  }
}

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true;
  showMessage("Signing in...");

  try {
    await signInWithEmailAndPassword(
      auth,
      email.value.trim(),
      password.value
    );
  } catch (error) {
    console.error(error);
    showMessage("Could not sign in.", "error");
  } finally {
    loginButton.disabled = false;
  }
});

claimAdminButton.addEventListener("click", async () => {
  if (!currentUser) return;

  const confirmed = window.confirm(
    "Make this account the permanent General Sassy V2 administrator?"
  );

  if (!confirmed) return;

  claimAdminButton.disabled = true;
  showMessage("General Sassy is claiming the command chair...");

  try {
    // The rules only allow this when adminBootstrap/claimed does not yet exist.
    // Multi-location update is intentionally represented with two writes that are
    // each guarded by the same bootstrap rule; the admin write is additionally
    // blocked once bootstrap has been claimed.
    await update(
      ref(database, "v2"),
      {
        [`admins/${currentUser.uid}`]: true,
        "adminBootstrap/claimed": true,
        "adminBootstrap/uid": currentUser.uid
      }
    );

    showOnly(alreadyAdminBox);

    showMessage(
      "General Sassy administrator created. Nobody else can claim this role now.",
      "success"
    );
  } catch (error) {
    console.error(error);

    showMessage(
      "Admin claim was blocked. Publish the Phase 2.1 Firebase rules, refresh, and try again.",
      "error"
    );

    await refreshSetupState(currentUser);
  } finally {
    claimAdminButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  refreshSetupState(user);
});
