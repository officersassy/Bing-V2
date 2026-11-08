// Medic Bingo Bash: locally hosted ElevenLabs recordings, no browser TTS.
const GROUPS={
  start:5,pause:5,resume:5,invalid:6,slow:4,random:6
};
const GAP_MS=30000;
export function createDillonAnnouncer(){
 let current=null,lastAt=0,lastPick={},pending=null,unlocked=false;
 const prefix=new URL('./assets/dillon-voice/',import.meta.url).href;
 const play=(category,{force=false}={})=>{
   const count=GROUPS[category];if(!count)return false;
   if(!unlocked){pending={category,force};return false;}
   const now=Date.now();
   if(!force && (current&&!current.paused || now-lastAt<GAP_MS))return false;
   if(current){current.pause();current.currentTime=0;current=null;}
   let index=1+Math.floor(Math.random()*count);
   if(count>1 && index===lastPick[category])index=index%count+1;
   lastPick[category]=index;
   const clip=new Audio(prefix+category+'-'+String(index).padStart(2,'0')+'.mp3');
   clip.preload='auto';clip.volume=0.85;current=clip;
   clip.onended=()=>{if(current===clip)current=null;};
   clip.onerror=()=>{if(current===clip)current=null;};
   const result=clip.play();
   if(result&&typeof result.catch==='function')result.catch(()=>{if(current===clip)current=null;});
   lastAt=now;pending=null;return true;
 };
 const unlock=()=>{unlocked=true;if(pending){const next=pending;pending=null;play(next.category,next);}};
 document.addEventListener('pointerdown',unlock,{once:true,capture:true});
 document.addEventListener('keydown',unlock,{once:true,capture:true});
 return {speak:play};
}
