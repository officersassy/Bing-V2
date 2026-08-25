export const SHOP_ITEMS = [
  { id:"avatar-ball", name:"Classic Bingo Ball", price:0, icon:"🎱", image:"assets/avatars/avatar-ball.png?v=2.1.6", type:"avatar", tier:"free" },
  { id:"avatar-smile", name:"Happy Dobber", price:0, icon:"😄", image:"assets/avatars/avatar-smile.png?v=2.1.6", type:"avatar", tier:"free" },
  { id:"avatar-star", name:"Lucky Star", price:0, icon:"⭐", image:"assets/avatars/avatar-star.png?v=2.1.6", type:"avatar", tier:"free" },
  { id:"avatar-clover", name:"Lucky Clover", price:0, icon:"🍀", image:"assets/avatars/avatar-clover.png?v=2.1.6", type:"avatar", tier:"free" },
  { id:"avatar-crown", name:"Little Crown", price:0, icon:"👑", image:"assets/avatars/avatar-crown.png?v=2.1.6", type:"avatar", tier:"free" },

  { id:"avatar-gold-crown", name:"Golden Crown", price:300, icon:"👑", image:"assets/avatars/avatar-gold-crown.png?v=2.1.6", type:"avatar", tier:"premium" },
  { id:"avatar-disco", name:"Disco Ball", price:450, icon:"🪩", image:"assets/avatars/avatar-disco.png?v=2.1.6", type:"avatar", tier:"premium" },
  { id:"avatar-fire", name:"Flaming Bingo", price:600, icon:"🔥", image:"assets/avatars/avatar-fire.png?v=2.1.6", type:"avatar", tier:"premium" },
  { id:"avatar-diamond", name:"Diamond", price:900, icon:"💎", image:"assets/avatars/avatar-diamond.png?v=2.1.6", type:"avatar", tier:"premium" },
  { id:"avatar-skull", name:"Neon Skull", price:1250, icon:"💀", image:"assets/avatars/avatar-skull.png?v=2.1.6", type:"avatar", tier:"premium" },
  { id:"avatar-jackpot", name:"Jackpot", price:1750, icon:"🎰", image:"assets/avatars/avatar-jackpot.png?v=2.1.6", type:"avatar", tier:"premium" },
  { id:"avatar-sassy", name:"General Sassy Approved", price:3000, icon:"🫡", image:"assets/avatars/avatar-sassy.png?v=2.1.6", type:"avatar", tier:"legendary" },

  { id:"dabber-blue", name:"Blue Dabber", price:100, icon:"💙", type:"dabber" },
  { id:"dabber-pink", name:"Pink Dabber", price:175, icon:"🩷", type:"dabber" },
  { id:"dabber-green", name:"Lucky Green Dabber", price:200, icon:"💚", type:"dabber" },
  { id:"dabber-gold", name:"Gold Dabber", price:250, icon:"🟡", type:"dabber" },

  { id:"theme-neon", name:"Neon Card", price:500, icon:"✨", type:"theme" },
  { id:"theme-gold", name:"Luxury Gold Card", price:850, icon:"🏆", type:"theme" },
  { id:"theme-fire", name:"Inferno Card", price:1100, icon:"🔥", type:"theme" },
  { id:"theme-rainbow", name:"Rainbow Riot Card", price:1500, icon:"🌈", type:"theme" },

  { id:"confetti-party", name:"Party Confetti", price:750, icon:"🎉", type:"effect" },
  { id:"effect-fireworks", name:"Winner Fireworks", price:1250, icon:"🎆", type:"effect" },
  { id:"effect-coin-rain", name:"Sassy Coin Rain", price:1750, icon:"🪙", type:"effect" },

  { id:"name-vip", name:"VIP Name Glow", price:1000, icon:"👑", type:"nameEffect" },
  { id:"name-rainbow", name:"Rainbow Name", price:1400, icon:"🌈", type:"nameEffect" },
  { id:"name-royal", name:"Royal Name", price:2000, icon:"💎", type:"nameEffect" }
];

export const AVATARS = SHOP_ITEMS.filter(item => item.type === "avatar");

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
  { id:"coin-5000", name:"Sassy High Roller", icon:"💎", description:"Earn 5,000 lifetime coins." }
];
