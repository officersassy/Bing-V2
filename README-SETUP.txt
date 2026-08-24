GENERAL SASSY BINGO V2 — PHASE 1

WHAT THIS PACK DOES
- Email/password player accounts
- Persistent Firebase player profiles
- 25 Sassy Coin starter balance
- Player dashboard
- Player name editing
- Sign in / sign out
- V2 data kept under /v2 so V1 is untouched

IMPORTANT FIREBASE SETUP

1. Open Firebase Console.
2. Open your existing bingo-5174e project.
3. Go to Build -> Authentication.
4. Click Get started if needed.
5. Open Sign-in method.
6. Enable Email/Password.
7. Save.

DATABASE RULES
The file firebase-rules-v2.json contains safe Phase 1 rules.

IMPORTANT:
Do not blindly replace your full existing Realtime Database rules with this file if
V1 still needs its existing rules.

Instead merge the "v2" section into your current top-level "rules" object.

WHY COINS CANNOT BE CHANGED YET
Phase 1 deliberately prevents players from editing their own coin balance after the
25-coin account creation reward.

Win rewards will be added in Phase 2 using a trusted host/server-side path rather than
letting a player's browser award itself coins.

GITHUB
Upload these files directly to the root of the NEW Bingo-V2 repository:
- index.html
- player.html
- style.css
- firebase.js
- auth.js
- player.js

Then enable GitHub Pages on main / root.

V1 is not used or modified by this pack.
