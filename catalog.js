export const RARITIES = {
  common:    { name:"COMMON",    icon:"●", weight:42 },
  rare:      { name:"RARE",      icon:"◆", weight:30 },
  epic:      { name:"EPIC",      icon:"✦", weight:18 },
  legendary: { name:"LEGENDARY", icon:"★", weight:8 },
  sassy:     { name:"SASSY",     icon:"👑", weight:2 }
};

export const SHOP_ITEMS = [
  { id:"avatar-ball", name:"Classic Bingo Ball", price:0, icon:"🎱", image:"assets/avatars/avatar-ball.webp?v=2.2.0", type:"avatar", rarity:"common", description:"The original. Simple, clean, iconic." },
  { id:"avatar-smile", name:"Happy Dobber", price:0, icon:"😄", image:"assets/avatars/avatar-smile.webp?v=2.2.0", type:"avatar", rarity:"common", description:"A dangerously cheerful dobber." },
  { id:"avatar-star", name:"Lucky Star", price:0, icon:"⭐", image:"assets/avatars/avatar-star.webp?v=2.2.0", type:"avatar", rarity:"common", description:"For players convinced luck is a strategy." },
  { id:"avatar-clover", name:"Lucky Clover", price:0, icon:"🍀", image:"assets/avatars/avatar-clover.webp?v=2.2.0", type:"avatar", rarity:"common", description:"Four leaves. Zero guarantees." },
  { id:"avatar-crown", name:"Little Crown", price:0, icon:"👑", image:"assets/avatars/avatar-crown.webp?v=2.2.0", type:"avatar", rarity:"common", description:"Tiny crown. Massive ego." },
  { id:"avatar-gold-crown", name:"Golden Crown", price:300, icon:"👑", image:"assets/avatars/avatar-gold-crown.webp?v=2.2.0", type:"avatar", rarity:"rare", description:"Royal treatment without the responsibilities." },
  { id:"avatar-disco", name:"Disco Ball", price:450, icon:"🪩", image:"assets/avatars/avatar-disco.webp?v=2.2.0", type:"avatar", rarity:"rare", description:"Turns every leaderboard into Saturday night." },
  { id:"avatar-fire", name:"Flaming Bingo", price:600, icon:"🔥", image:"assets/avatars/avatar-fire.webp?v=2.2.0", type:"avatar", rarity:"rare", description:"For players who insist they are on fire." },
  { id:"avatar-diamond", name:"Diamond King", price:900, icon:"💎", image:"assets/avatars/avatar-diamond.webp?v=2.2.0", type:"avatar", rarity:"epic", description:"Expensive-looking because subtlety is overrated." },
  { id:"avatar-leprechaun", name:"Lucky Leprechaun", price:1000, icon:"🍀", image:"assets/avatars/avatar-leprechaun.webp?v=2.2.0", type:"avatar", rarity:"epic", description:"Lucky, green and financially questionable." },
  { id:"avatar-disco-queen", name:"Disco Queen", price:1100, icon:"🪩", image:"assets/avatars/avatar-disco-queen.webp?v=2.2.0", type:"avatar", rarity:"epic", description:"Own the dancefloor and the Bingo hall." },
  { id:"avatar-skull", name:"Neon Skull", price:1250, icon:"💀", image:"assets/avatars/avatar-skull.webp?v=2.2.0", type:"avatar", rarity:"epic", description:"Neon menace for serious dobbers." },
  { id:"avatar-devil", name:"Bingo Devil", price:1300, icon:"😈", image:"assets/avatars/avatar-devil.webp?v=2.2.0", type:"avatar", rarity:"epic", description:"For absolutely angelic behaviour." },
  { id:"avatar-general", name:"General Sassy", price:1500, icon:"🫡", image:"assets/avatars/avatar-general.webp?v=2.2.0", type:"avatar", rarity:"legendary", description:"General Sassy personally disapproves." },
  { id:"avatar-jackpot", name:"Jackpot", price:1750, icon:"🎰", image:"assets/avatars/avatar-jackpot.webp?v=2.2.0", type:"avatar", rarity:"legendary", description:"Casino energy without losing real money." },
  { id:"avatar-sassy", name:"Legendary General", price:3000, icon:"⭐", image:"assets/avatars/avatar-sassy.webp?v=2.2.0", type:"avatar", rarity:"sassy", description:"The ultimate Sassy status symbol." },

  { id:"dabber-blue", name:"Electric Blue", price:100, icon:"💙", type:"dabber", rarity:"common", description:"A crisp electric-blue dob with a proper glow." },
  { id:"dabber-pink", name:"Hot Pink", price:175, icon:"🩷", type:"dabber", rarity:"common", description:"Bright enough to offend nearby retinas." },
  { id:"dabber-green", name:"Lucky Toxic", price:250, icon:"💚", type:"dabber", rarity:"rare", description:"Toxic green with a radioactive pulse." },
  { id:"dabber-gold", name:"Midas Stamp", price:400, icon:"🟡", type:"dabber", rarity:"rare", description:"Every dob looks unnecessarily expensive." },
  { id:"dabber-plasma", name:"Plasma Strike", price:750, icon:"⚡", type:"dabber", rarity:"epic", description:"Electric purple impact with a crackling ring." },
  { id:"dabber-diamond", name:"Diamond Impact", price:1400, icon:"💎", type:"dabber", rarity:"legendary", description:"A crystalline dob made for show-offs." },

  { id:"theme-neon", name:"Neon Afterdark", price:500, icon:"✨", type:"theme", rarity:"rare", description:"Deep neon cyan and violet with animated edge light." },
  { id:"theme-gold", name:"Royal Vault", price:850, icon:"🏆", type:"theme", rarity:"epic", description:"Polished gold trim, dark velvet and luxury shine." },
  { id:"theme-fire", name:"Inferno", price:1100, icon:"🔥", type:"theme", rarity:"epic", description:"Animated heat glow and ember-style card lighting." },
  { id:"theme-rainbow", name:"Prismatic Riot", price:1500, icon:"🌈", type:"theme", rarity:"legendary", description:"A moving spectrum aura that refuses to be subtle." },
  { id:"theme-galaxy", name:"Sassy Galaxy", price:1800, icon:"🌌", type:"theme", rarity:"legendary", description:"Deep-space card with stars, nebula glow and cosmic cells." },
  { id:"theme-obsidian", name:"Black Diamond", price:2400, icon:"🖤", type:"theme", rarity:"legendary", description:"Gloss-black glass with diamond-white highlights." },
  { id:"theme-general", name:"General's Private Table", price:4000, icon:"🎖️", type:"theme", rarity:"sassy", description:"Gold command insignia, animated prestige border and maximum ego." },

  { id:"confetti-party", name:"Confetti Cannon", price:750, icon:"🎉", type:"effect", rarity:"rare", description:"Twin cannons fill the screen when you win." },
  { id:"effect-fireworks", name:"Firework Takeover", price:1250, icon:"🎆", type:"effect", rarity:"epic", description:"Full-screen winner fireworks with sparkling bursts." },
  { id:"effect-coin-rain", name:"Coin Storm", price:1750, icon:"🪙", type:"effect", rarity:"legendary", description:"Sassy Coins rain across your victory screen." },
  { id:"effect-meteor", name:"Meteor Shower", price:2100, icon:"☄️", type:"effect", rarity:"legendary", description:"Flaming meteors streak through your winner celebration." },
  { id:"effect-jackpot", name:"Jackpot Explosion", price:3200, icon:"🎰", type:"effect", rarity:"sassy", description:"Jackpot symbols, gold stars and maximum casino nonsense." },

  { id:"name-vip", name:"VIP Gold", price:1000, icon:"👑", type:"nameEffect", rarity:"epic", description:"Animated gold halo around your player name." },
  { id:"name-rainbow", name:"Prismatic Name", price:1400, icon:"🌈", type:"nameEffect", rarity:"epic", description:"Smooth animated spectrum text." },
  { id:"name-royal", name:"Royal Diamond", price:2000, icon:"💎", type:"nameEffect", rarity:"legendary", description:"Diamond-white lettering with royal purple bloom." },
  { id:"name-electric", name:"Electric Sassy", price:2300, icon:"⚡", type:"nameEffect", rarity:"legendary", description:"Blue lightning flickers around your name." },
  { id:"name-general", name:"GENERAL'S FAVOURITE", price:4500, icon:"🎖️", type:"nameEffect", rarity:"sassy", description:"Animated command-gold name reserved for outrageous spenders." }
];

export const AVATARS = SHOP_ITEMS.filter(item => item.type === "avatar");

export const CRATE_PRICE = 1000;
export const CRATE_ITEMS = SHOP_ITEMS.filter(item => item.price > 0);

export const ACHIEVEMENTS = [
  { id:"account-created", name:"Fresh Recruit", icon:"🫡", description:"Create a V2 account." },
  { id:"first-game", name:"Eyes Down", icon:"🎱", description:"Play your first V2 game." },
  { id:"games-10", name:"Regular Customer", icon:"🪑", description:"Play 10 games." },
  { id:"games-25", name:"Bingo Resident", icon:"🏕️", description:"Play 25 games." },
  { id:"first-win", name:"First Bingo", icon:"🎉", description:"Win your first round." },
  { id:"five-wins", name:"Getting Suspicious", icon:"👀", description:"Win 5 rounds." },
  { id:"ten-wins", name:"Serial Dobber", icon:"🖊️", description:"Win 10 rounds." },
  { id:"wins-25", name:"Bingo Menace", icon:"😈", description:"Win 25 rounds." },
  { id:"full-house", name:"House Proud", icon:"🏠", description:"Win a Full House." },
  { id:"fullhouse-5", name:"Property Tycoon", icon:"🏘️", description:"Win 5 Full Houses." },
  { id:"coin-1000", name:"Sassy Millionaire-ish", icon:"🪙", description:"Earn 1,000 lifetime coins." },
  { id:"coin-2500", name:"Coin Hoarder", icon:"💰", description:"Earn 2,500 lifetime coins." },
  { id:"coin-5000", name:"Sassy High Roller", icon:"💎", description:"Earn 5,000 lifetime coins." },
  { id:"crate-first", name:"What's In The Box?", icon:"📦", description:"Open your first Sassy Crate." },
  { id:"crate-legendary", name:"Ridiculous Luck", icon:"🌟", description:"Pull a Legendary or Sassy item from a crate." }
];
