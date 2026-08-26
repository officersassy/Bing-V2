const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

const app = initializeApp({
  projectId: "bingo-5174e",
  databaseURL: "https://bingo-5174e-default-rtdb.europe-west1.firebasedatabase.app"
});

const auth = getAuth(app);
const db = getDatabase(app);

setGlobalOptions({
  region: "europe-west1",
  maxInstances: 3
});

const CRATE_PRICE = 1000;
const RARITY_WEIGHTS = {
  common:42,
  rare:30,
  epic:18,
  legendary:8,
  sassy:2
};

const CRATE_CATALOG = [
  {
    "id": "avatar-gold-crown",
    "name": "Golden Crown",
    "rarity": "rare"
  },
  {
    "id": "avatar-disco",
    "name": "Disco Ball",
    "rarity": "rare"
  },
  {
    "id": "avatar-fire",
    "name": "Flaming Bingo",
    "rarity": "rare"
  },
  {
    "id": "avatar-diamond",
    "name": "Diamond King",
    "rarity": "epic"
  },
  {
    "id": "avatar-leprechaun",
    "name": "Lucky Leprechaun",
    "rarity": "epic"
  },
  {
    "id": "avatar-disco-queen",
    "name": "Disco Queen",
    "rarity": "epic"
  },
  {
    "id": "avatar-skull",
    "name": "Neon Skull",
    "rarity": "epic"
  },
  {
    "id": "avatar-devil",
    "name": "Bingo Devil",
    "rarity": "epic"
  },
  {
    "id": "avatar-general",
    "name": "General Sassy",
    "rarity": "legendary"
  },
  {
    "id": "avatar-jackpot",
    "name": "Jackpot",
    "rarity": "legendary"
  },
  {
    "id": "avatar-sassy",
    "name": "Legendary General",
    "rarity": "sassy"
  },
  {
    "id": "dabber-blue",
    "name": "Electric Blue",
    "rarity": "common"
  },
  {
    "id": "dabber-pink",
    "name": "Hot Pink",
    "rarity": "common"
  },
  {
    "id": "dabber-green",
    "name": "Lucky Toxic",
    "rarity": "rare"
  },
  {
    "id": "dabber-gold",
    "name": "Midas Stamp",
    "rarity": "rare"
  },
  {
    "id": "dabber-plasma",
    "name": "Plasma Strike",
    "rarity": "epic"
  },
  {
    "id": "dabber-diamond",
    "name": "Diamond Impact",
    "rarity": "legendary"
  },
  {
    "id": "theme-neon",
    "name": "Neon Afterdark",
    "rarity": "rare"
  },
  {
    "id": "theme-gold",
    "name": "Royal Vault",
    "rarity": "epic"
  },
  {
    "id": "theme-fire",
    "name": "Inferno",
    "rarity": "epic"
  },
  {
    "id": "theme-rainbow",
    "name": "Prismatic Riot",
    "rarity": "legendary"
  },
  {
    "id": "theme-galaxy",
    "name": "Sassy Galaxy",
    "rarity": "legendary"
  },
  {
    "id": "theme-obsidian",
    "name": "Black Diamond",
    "rarity": "legendary"
  },
  {
    "id": "theme-general",
    "name": "General's Private Table",
    "rarity": "sassy"
  },
  {
    "id": "confetti-party",
    "name": "Confetti Cannon",
    "rarity": "rare"
  },
  {
    "id": "effect-fireworks",
    "name": "Firework Takeover",
    "rarity": "epic"
  },
  {
    "id": "effect-coin-rain",
    "name": "Coin Storm",
    "rarity": "legendary"
  },
  {
    "id": "effect-meteor",
    "name": "Meteor Shower",
    "rarity": "legendary"
  },
  {
    "id": "effect-jackpot",
    "name": "Jackpot Explosion",
    "rarity": "sassy"
  },
  {
    "id": "name-vip",
    "name": "VIP Gold",
    "rarity": "epic"
  },
  {
    "id": "name-rainbow",
    "name": "Prismatic Name",
    "rarity": "epic"
  },
  {
    "id": "name-royal",
    "name": "Royal Diamond",
    "rarity": "legendary"
  },
  {
    "id": "name-electric",
    "name": "Electric Sassy",
    "rarity": "legendary"
  },
  {
    "id": "name-general",
    "name": "GENERAL'S FAVOURITE",
    "rarity": "sassy"
  }
];

function collectUserPaths(value, targetUid, basePath, updates) {
  if (value === null || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const path = basePath ? `${basePath}/${key}` : key;

    if (key === targetUid) {
      updates[path] = null;
      continue;
    }

    if (child && typeof child === "object" && child.uid === targetUid) {
      updates[path] = null;
      continue;
    }

    collectUserPaths(child, targetUid, path, updates);
  }
}

function weightedPick(items) {
  const rarityGroups = {};

  for (const item of items) {
    (rarityGroups[item.rarity] ||= []).push(item);
  }

  const availableRarities = Object.keys(rarityGroups);
  const total = availableRarities.reduce(
    (sum, rarity) => sum + (RARITY_WEIGHTS[rarity] || 1),
    0
  );

  let roll = Math.random() * total;
  let chosenRarity = availableRarities[0];

  for (const rarity of availableRarities) {
    roll -= RARITY_WEIGHTS[rarity] || 1;
    if (roll <= 0) {
      chosenRarity = rarity;
      break;
    }
  }

  const pool = rarityGroups[chosenRarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

exports.openSassyCrate = onCall(
  { region:"europe-west1", maxInstances:3, timeoutSeconds:30 },
  async request => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const uid = request.auth.uid;
    const profileRef = db.ref(`v2/profiles/${uid}`);
    const snap = await profileRef.get();

    if (!snap.exists()) {
      throw new HttpsError("not-found", "Profile not found.");
    }

    const profile = snap.val() || {};
    const inventory = profile.inventory || {};
    const available = CRATE_CATALOG.filter(item => !inventory[item.id]);

    if (!available.length) {
      return { ok:true, complete:true };
    }

    if (Number(profile.coins || 0) < CRATE_PRICE) {
      throw new HttpsError("failed-precondition", "Not enough Sassy Coins.");
    }

    const reward = weightedPick(available);

    const transaction = await profileRef.transaction(current => {
      if (!current) return;
      current.inventory = current.inventory || {};

      if (current.inventory[reward.id]) return;
      if (Number(current.coins || 0) < CRATE_PRICE) return;

      current.coins = Number(current.coins || 0) - CRATE_PRICE;
      current.inventory[reward.id] = Date.now();
      current.updatedAt = Date.now();
      current.achievements = current.achievements || {};
      current.achievements["crate-first"] ||= Date.now();

      if (reward.rarity === "legendary" || reward.rarity === "sassy") {
        current.achievements["crate-legendary"] ||= Date.now();
      }

      return current;
    });

    if (!transaction.committed) {
      throw new HttpsError("aborted", "Crate could not be completed. Try again.");
    }

    await db.ref(`v2/transactions/${uid}`).push({
      amount:-CRATE_PRICE,
      reason:`Sassy Crate — ${reward.name}`,
      type:"crate",
      itemId:reward.id,
      rarity:reward.rarity,
      createdAt:Date.now(),
      createdBy:"openSassyCrate"
    });

    return {
      ok:true,
      complete:false,
      itemId:reward.id,
      rarity:reward.rarity
    };
  }
);

exports.deleteBingoUser = onCall(
  { region:"europe-west1", maxInstances:3, timeoutSeconds:60 },
  async request => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const callerUid = request.auth.uid;
    const targetUid = String(request.data?.targetUid || "").trim();

    if (!targetUid) {
      throw new HttpsError("invalid-argument", "Missing target user.");
    }

    if (targetUid === callerUid) {
      throw new HttpsError("failed-precondition", "You cannot delete your own admin account here.");
    }

    const adminSnapshot = await db.ref(`v2/admins/${callerUid}`).get();

    if (adminSnapshot.val() !== true) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const targetAdminSnapshot = await db.ref(`v2/admins/${targetUid}`).get();

    if (targetAdminSnapshot.val() === true) {
      throw new HttpsError("failed-precondition", "Admin accounts cannot be deleted from the Host panel.");
    }

    try {
      await auth.getUser(targetUid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        console.error("Unable to check Firebase Authentication user:", error);
        throw new HttpsError("internal", "Unable to verify the selected Firebase account.");
      }
    }

    const updates = {
      [`v2/profiles/${targetUid}`]: null,
      [`v2/publicProfiles/${targetUid}`]: null,
      [`v2/lobby/${targetUid}`]: null,
      [`v2/gamePlayers/${targetUid}`]: null,
      [`v2/kicks/${targetUid}`]: null,
      [`v2/transactions/${targetUid}`]: null,
      [`v2/rewards/${targetUid}`]: null,
      [`v2/purchaseRequests/${targetUid}`]: null
    };

    const [claimsSnapshot, winnersSnapshot] = await Promise.all([
      db.ref("v2/claims").get(),
      db.ref("v2/verifiedWinners").get()
    ]);

    collectUserPaths(claimsSnapshot.val(), targetUid, "v2/claims", updates);
    collectUserPaths(winnersSnapshot.val(), targetUid, "v2/verifiedWinners", updates);

    await db.ref().update(updates);

    try {
      await auth.deleteUser(targetUid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        console.error("Authentication deletion failed:", error);
        throw new HttpsError("internal", "Bingo data was removed, but the Firebase login could not be deleted.");
      }
    }

    return { ok:true, targetUid };
  }
);
