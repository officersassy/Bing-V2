V2.3.7 TRUE RANDOM DRAW
- Removed card-aware 90-ball balancing.
- 90-ball draw ignores player cards completely.
- 75-ball and 90-ball use Fisher-Yates.
- Random source is crypto.getRandomValues with rejection sampling.
- No UID, name, stats, winner history or card state influences draw order.
- Website-only update: upload to GitHub and hard refresh Host.
- No functions deploy and no Firebase rules update required.
