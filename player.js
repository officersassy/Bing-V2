import { auth, database } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  get,
  set,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const welcomeName = document.getElementById("welcomeName");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const memberSince = document.getElementById("memberSince");
const profileInitial = document.getElementById("profileInitial");
const coinBalance = document.getElementById("coinBalance");
const bigCoinBalance = document.getElementById("bigCoinBalance");
const transactionList = document.getElementById("transactionList");

const logoutButton = document.getElementById("logoutButton");
const editNameButton = document.getElementById("editNameButton");
const nameModal = document.getElementById("nameModal");
const newPlayerName = document.getElementById("newPlayerName");
const cancelNameButton = document.getElementById("cancelNameButton");
const saveNameButton = document.getElementById("saveNameButton");
const profileMessage = document.getElementById("profileMessage");

let currentUser = null;
let currentProfile = null;
let unsubscribeProfile = null;

function formatCoins(value) {
  return Number(value || 0).toLocaleString("en-GB");
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}


function formatTransactionDate(timestamp) {
  if (!timestamp) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function drawTransactions(transactionsObject) {
  if (!transactionList) return;

  const items = Object.values(transactionsObject || {})
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 20);

  transactionList.innerHTML = "";

  if (!items.length) {
    transactionList.textContent = "No coin activity yet.";
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "transaction-row";

    const left = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = item.reason || "Sassy Coins";

    const date = document.createElement("small");
    date.textContent = formatTransactionDate(item.createdAt);

    left.append(title, date);

    const amount = document.createElement("strong");
    amount.className =
      Number(item.amount || 0) >= 0
        ? "transaction-positive"
        : "transaction-negative";

    const numericAmount = Number(item.amount || 0);
    amount.textContent =
      `${numericAmount >= 0 ? "+" : ""}${numericAmount.toLocaleString("en-GB")} 🪙`;

    row.append(left, amount);
    transactionList.appendChild(row);
  });
}

function drawProfile(profile) {
  currentProfile = profile;

  const name = profile.username || "Player";
  const coins = formatCoins(profile.coins);

  welcomeName.textContent = `Welcome, ${name}`;
  profileName.textContent = name;
  profileEmail.textContent = profile.email || currentUser?.email || "--";
  memberSince.textContent = formatDate(profile.createdAt);
  profileInitial.textContent = name.charAt(0).toUpperCase();

  coinBalance.textContent = coins;
  bigCoinBalance.textContent = coins;
}

function profileStatus(message, type = "") {
  profileMessage.textContent = message;
  profileMessage.className = `message-box ${type}`.trim();
}

function fallbackPlayerName(user) {
  const emailName = String(user?.email || "Player")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (emailName.length >= 2 ? emailName : "Player").slice(0, 24);
}

async function repairMissingProfile(user) {
  const now = Date.now();

  const profile = {
    uid: user.uid,
    username: fallbackPlayerName(user),
    email: user.email || "",
    coins: 25,
    lifetimeCoins: 25,
    role: "player",
    createdAt: now,
    updatedAt: now
  };

  await set(
    ref(database, `v2/profiles/${user.uid}`),
    profile
  );

  return profile;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  currentUser = user;

  const profileRef = ref(database, `v2/profiles/${user.uid}`);
  const snapshot = await get(profileRef);

  if (!snapshot.exists()) {
    try {
      await repairMissingProfile(user);
    } catch (error) {
      console.error("Unable to repair missing V2 profile:", error);
      alert(
        "Your login exists but your V2 profile is blocked by Firebase rules. Enable the V2 database rules, then reload."
      );
      return;
    }
  }

  if (unsubscribeProfile) unsubscribeProfile();

  unsubscribeProfile = onValue(profileRef, (profileSnapshot) => {
    if (!profileSnapshot.exists()) return;
    drawProfile(profileSnapshot.val());
  });

  onValue(
    ref(database, `v2/transactions/${user.uid}`),
    (transactionSnapshot) => {
      drawTransactions(transactionSnapshot.val() || {});
    }
  );
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

editNameButton.addEventListener("click", () => {
  newPlayerName.value = currentProfile?.username || "";
  profileStatus("");
  nameModal.classList.remove("hidden");
  newPlayerName.focus();
});

cancelNameButton.addEventListener("click", () => {
  nameModal.classList.add("hidden");
});

saveNameButton.addEventListener("click", async () => {
  const name = newPlayerName.value.trim();

  if (name.length < 2 || name.length > 24) {
    profileStatus("Use a player name between 2 and 24 characters.", "error");
    return;
  }

  saveNameButton.disabled = true;

  try {
    await update(
      ref(database, `v2/profiles/${currentUser.uid}`),
      {
        username: name,
        updatedAt: Date.now()
      }
    );

    profileStatus("Player name updated.", "success");

    setTimeout(() => {
      nameModal.classList.add("hidden");
    }, 450);
  } catch (error) {
    console.error(error);
    profileStatus("Could not update your player name.", "error");
  } finally {
    saveNameButton.disabled = false;
  }
});
