GENERAL SASSY BINGO V2 — PHASE 1.1 ACCOUNT REPAIR

WHY YOUR ACCOUNT WAS CREATED WITHOUT COINS
Firebase Authentication and Realtime Database are separate systems.

Your email/password account was successfully created in Authentication.
Then the website tried to create:

v2/profiles/YOUR-UID

with 25 starter coins.

Your current Realtime Database rules rejected that second write.

WHAT PHASE 1.1 FIXES
- Existing Auth accounts with no V2 profile are automatically repaired.
- Signing in creates the missing V2 profile.
- The repaired profile receives the original 25 starter Sassy Coins.
- New registrations also use the same safe profile creation function.
- Better error messages tell you if the database rules are the problem.

WHAT YOU MUST DO IN FIREBASE
1. Firebase Console -> Realtime Database -> Rules.
2. KEEP your existing V1 rules.
3. Add the "v2" block from FIREBASE-RULES-MERGE.txt inside your existing "rules" object.
4. Click Publish.

ALSO CHECK
Firebase Console -> Authentication -> Sign-in method -> Email/Password must be Enabled.

THEN
Upload all files from this ZIP to your Bingo-V2 GitHub repo.
Hard refresh the site.
Sign in with the account you already created.

The missing profile and 25 coins should be created automatically.

PHASE 2
Once this is working, Phase 2 will add trusted Bingo rewards and host-controlled coin awards.
