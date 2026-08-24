import { auth, database } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  get,
  onValue,
  runTransaction,
  push,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const denied = document.getElementById("hostDenied");
const dashboard = document.getElementById("hostDashboard");
const logoutButton = document.getElementById("hostLogoutButton");

const playerCount = document.getElementById("hostPlayerCount");
const playerList = document.getElementById("hostPlayerList");
const playerSearch = document.getElementById("playerSearch");

const noSelection = document.getElementById("noPlayerSelected");
const selectedPanel = document.getElementById("selectedPlayerPanel");
const selectedName = document.getElementById("selectedPlayerName");
const selectedEmail = document.getElementById("selectedPlayerEmail");
const selectedCoins = document.getElementById("selectedPlayerCoins");
const economyMessage = document.getElementById("hostEconomyMessage");

const customAmount = document.getElementById("customCoinAmount");
const customReason = document.getElementById("customCoinReason");
const customAwardButton = document.getElementById("customAwardButton");

const economyPlayers = document.getElementById("economyPlayers");
const economyCoins = document.getElementById("economyCoins");
const economyLifetime = document.getElementById("economyLifetime");

let hostUser = null;
let profiles = {};
let selectedUid = null;

function isAdminSnapshot(snapshot) {
  return snapshot.exists() && snapshot.val() === true;
}

function displayCoins(value) {
  return Number(value || 0).toLocaleString("en-GB");
}

function showHostMessage(text, type = "") {
  economyMessage.textContent = text;
  economyMessage.className = `message-box ${type}`.trim();
}

function selectedProfile() {
  return selectedUid ? profiles[selectedUid] || null : null;
}

function drawEconomyStats() {
  const values = Object.values(profiles);

  economyPlayers.textContent = String(values.length);
  economyCoins.textContent = displayCoins(
    values.reduce((sum, profile) => sum + Number(profile.coins || 0), 0)
  );
  economyLifetime.textContent = displayCoins(
    values.reduce((sum, profile) => sum + Number(profile.lifetimeCoins || 0), 0)
  );
}

function drawSelectedPlayer() {
  const profile = selectedProfile();

  if (!profile) {
    noSelection.classList.remove("hidden");
    selectedPanel.classList.add("hidden");
    return;
  }

  noSelection.classList.add("hidden");
  selectedPanel.classList.remove("hidden");

  selectedName.textContent = profile.username || "Player";
  selectedEmail.textContent = profile.email || "";
  selectedCoins.textContent = `${displayCoins(profile.coins)} 🪙`;
}

function drawPlayerList() {
  const query = playerSearch.value.trim().toLowerCase();

  const entries = Object.entries(profiles)
    .filter(([, profile]) => {
      if (!query) return true;

      return (
        String(profile.username || "").toLowerCase().includes(query) ||
        String(profile.email || "").toLowerCase().includes(query)
      );
    })
    .sort(([, a], [, b]) =>
      String(a.username || "").localeCompare(String(b.username || ""))
    );

  playerCount.textContent = String(Object.keys(profiles).length);
  playerList.innerHTML = "";

  if (!entries.length) {
    playerList.textContent = "No matching players.";
    return;
  }

  entries.forEach(([uid, profile]) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "host-player-row";

    if (uid === selectedUid) {
      row.classList.add("selected");
    }

    const identity = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = profile.username || "Player";

    const email = document.createElement("small");
    email.textContent = profile.email || "";

    identity.append(name, email);

    const balance = document.createElement("strong");
    balance.textContent = `${displayCoins(profile.coins)} 🪙`;

    row.append(identity, balance);

    row.addEventListener("click", () => {
      selectedUid = uid;
      drawPlayerList();
      drawSelectedPlayer();
      showHostMessage("");
    });

    playerList.appendChild(row);
  });
}

async function awardCoins(amount, reason) {
  const profile = selectedProfile();

  if (!profile || !selectedUid) {
    showHostMessage("Select a player first.", "error");
    return;
  }

  const numericAmount = Math.trunc(Number(amount));

  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    showHostMessage("Enter a valid non-zero coin amount.", "error");
    return;
  }

  const currentBalance = Number(profile.coins || 0);

  if (currentBalance + numericAmount < 0) {
    showHostMessage("That would make the player's balance negative.", "error");
    return;
  }

  const profileRef = ref(database, `v2/profiles/${selectedUid}`);

  try {
    await runTransaction(profileRef, (current) => {
      if (!current) return current;

      const existingCoins = Number(current.coins || 0);
      const nextCoins = existingCoins + numericAmount;

      if (nextCoins < 0) {
        return;
      }

      current.coins = nextCoins;

      if (numericAmount > 0) {
        current.lifetimeCoins =
          Number(current.lifetimeCoins || existingCoins) + numericAmount;
      }

      current.updatedAt = Date.now();

      return current;
    });

    const transactionRef = push(
      ref(database, `v2/transactions/${selectedUid}`)
    );

    await set(transactionRef, {
      amount: numericAmount,
      reason: String(reason || "Host adjustment").slice(0, 60),
      createdAt: Date.now(),
      createdBy: hostUser.uid,
      type: numericAmount > 0 ? "award" : "deduction"
    });

    showHostMessage(
      `${numericAmount > 0 ? "+" : ""}${numericAmount} Sassy Coins applied to ${profile.username}.`,
      "success"
    );
  } catch (error) {
    console.error(error);
    showHostMessage("Could not update the player's coins.", "error");
  }
}

document.querySelectorAll("[data-reward]").forEach((button) => {
  button.addEventListener("click", () => {
    awardCoins(
      Number(button.dataset.reward),
      button.dataset.reason
    );
  });
});

customAwardButton.addEventListener("click", () => {
  awardCoins(
    customAmount.value,
    customReason.value.trim() || "Host adjustment"
  );
});

playerSearch.addEventListener("input", drawPlayerList);

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  hostUser = user;

  const adminSnapshot = await get(
    ref(database, `v2/admins/${user.uid}`)
  );

  if (!isAdminSnapshot(adminSnapshot)) {
    denied.classList.remove("hidden");
    dashboard.classList.add("hidden");
    return;
  }

  denied.classList.add("hidden");
  dashboard.classList.remove("hidden");

  onValue(ref(database, "v2/profiles"), (snapshot) => {
    profiles = snapshot.val() || {};

    if (selectedUid && !profiles[selectedUid]) {
      selectedUid = null;
    }

    drawPlayerList();
    drawSelectedPlayer();
    drawEconomyStats();
  });
});
