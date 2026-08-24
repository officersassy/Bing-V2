import { auth, database } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");

const quotes = [
  "General Sassy has reviewed the budget. Somehow, we now have coins.",
  "Create an account. Acquire coins. Pretend this is a sensible economy.",
  "Your Bingo career now has paperwork. General Sassy is delighted.",
  "Twenty-five starter coins. Spend them wisely. Or don't. I'm not your accountant."
];

document.getElementById("sassyQuote").textContent =
  `“${quotes[Math.floor(Math.random() * quotes.length)]}”`;

function showMessage(message, type = "") {
  authMessage.textContent = message;
  authMessage.className = `message-box ${type}`.trim();
}

function fallbackPlayerName(user, preferredName = "") {
  const cleanPreferred = String(preferredName || "").trim();

  if (cleanPreferred.length >= 2) {
    return cleanPreferred.slice(0, 24);
  }

  const emailName = String(user?.email || "Player")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (emailName.length >= 2 ? emailName : "Player").slice(0, 24);
}

async function ensureProfile(user, preferredName = "") {
  if (!user) {
    throw new Error("No authenticated user.");
  }

  const profileRef = ref(database, `v2/profiles/${user.uid}`);
  const snapshot = await get(profileRef);

  if (snapshot.exists()) {
    return snapshot.val();
  }

  const now = Date.now();

  const profile = {
    uid: user.uid,
    username: fallbackPlayerName(user, preferredName),
    email: user.email || "",
    coins: 25,
    lifetimeCoins: 25,
    role: "player",
    createdAt: now,
    updatedAt: now
  };

  await set(profileRef, profile);

  return profile;
}

function setMode(mode) {
  const login = mode === "login";

  loginTab.classList.toggle("active", login);
  registerTab.classList.toggle("active", !login);
  loginForm.classList.toggle("hidden", !login);
  registerForm.classList.toggle("hidden", login);

  showMessage("");
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  loginButton.disabled = true;
  showMessage("General Sassy is checking your credentials...");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    showMessage("Checking your V2 player profile...");

    await ensureProfile(credential.user);

    window.location.href = "./player.html";
  } catch (error) {
    console.error(error);

    const friendly =
      error.code === "auth/invalid-credential"
        ? "Email or password is incorrect."
        : "Could not sign in. Please try again.";

    showMessage(friendly, "error");
  } finally {
    loginButton.disabled = false;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  if (username.length < 2) {
    showMessage("Player name must contain at least 2 characters.", "error");
    return;
  }

  registerButton.disabled = true;
  showMessage("Creating your General Sassy account...");

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await ensureProfile(credential.user, username);

    showMessage(
      "Account created! General Sassy has begrudgingly issued 25 Sassy Coins.",
      "success"
    );

    setTimeout(() => {
      window.location.href = "./player.html";
    }, 600);
  } catch (error) {
    console.error(error);

    let friendly = "Could not finish creating your Bingo profile.";

    if (
      error.code === "PERMISSION_DENIED" ||
      error.code === "permission_denied" ||
      String(error.message || "").toLowerCase().includes("permission")
    ) {
      friendly =
        "Your login account was created, but Firebase blocked the V2 profile. Enable the V2 database rules, then sign in again and your 25 starter coins will be repaired automatically.";
    } else if (error.code === "auth/email-already-in-use") {
      friendly = "That email already has an account. Try signing in.";
    } else if (error.code === "auth/weak-password") {
      friendly = "Use a stronger password with at least 6 characters.";
    } else if (error.code === "auth/invalid-email") {
      friendly = "That email address does not look valid.";
    }

    showMessage(friendly, "error");
  } finally {
    registerButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const profile = await ensureProfile(user);

    if (profile) {
      window.location.href = "./player.html";
    }
  } catch (error) {
    console.error("Profile check/repair failed:", error);

    if (
      String(error?.message || "").toLowerCase().includes("permission") ||
      error?.code === "PERMISSION_DENIED"
    ) {
      showMessage(
        "Your account exists, but Firebase is blocking V2 profiles. Add the V2 database rules, then refresh this page.",
        "error"
      );
    }
  }
});
