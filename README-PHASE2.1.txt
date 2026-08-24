GENERAL SASSY BINGO V2 — PHASE 2.1

THIS VERSION REMOVES MANUAL ADMIN DATABASE SETUP.

SETUP:

1. Firebase Console -> Realtime Database -> Rules.
2. Replace the rules with the contents of FIREBASE-RULES-PHASE2.1.txt.
3. Click Publish.
4. Upload this ZIP to your Bingo-V2 GitHub repository.
5. Open /host-setup.html.
6. Sign in with the account you want as host.
7. Click "Make This Account General Sassy Admin".
8. Confirm.
9. Open /host.html.

SECURITY MODEL:

- Only the first authenticated account can claim the admin role.
- The bootstrap flag is written at the same time as the admin UID.
- Once bootstrap/claimed is true, Firebase rules reject any later admin claim.
- Players cannot edit their own coin balances.
- Only the registered admin can award or deduct coins.

DO NOT DELETE:
v2/adminBootstrap
or
v2/admins

after the host has been created.
