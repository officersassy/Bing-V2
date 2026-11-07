// Medic Bingo Bash: browser-native Dillon Sass announcer.
// No recorded impersonation or external audio requests; voice depends on the player's device.
const LINES={
 start:["Control to all crews. We have multiple patients suffering acute Bingo withdrawal. Commencing treatment.",
        "Dillon Sass reporting for duty. Gloves on, dabbers out, dignity optional.",
        "Medic Bingo Bash is live. If you flatline before full house, that's a paperwork nightmare."],
 pause:["Control, temporary stand-down. Someone has discovered an actual emergency.",
        "Dillon Sass is on a call. Keep your bingo cards stable and your drama contained.",
        "Emergency dispatch. The game is paused, not your questionable life choices."],
 resume:["Patient stabilised. Back to treating these tragic bingo performances.",
         "Control confirms we're back on duty. Dabbers ready, darlings.",
         "We're back. The only thing more critical than your patient is that missing number."],
 invalid:["That's not a Bingo, sweetheart. Even a student paramedic could diagnose that.",
          "Negative, control. False alarm. Somebody prescribe this one a calculator.",
          "No Bingo detected. Your claim has been discharged against medical advice.",
          "That claim needs urgent assessment, because it is absolutely delusional."],
 slow:["We're still here? I've completed three patient handovers since the last decent Bingo.",
       "Control, requesting refreshments and a miracle. This round is taking forever."],
 random:["Dillon Sass reminds you: a dabber is not an approved medical device.",
         "Your bingo card's prognosis is guarded, darling.",
         "If anyone needs oxygen after that number, please form an orderly queue.",
         "Some of these cards have worse observations than my last night shift."],
 winner:["Code Bingo! Somebody fetch the defibrillator. We've got a winner!",
         "Control, we have a confirmed Bingo. The patient is suddenly very smug."]
};
export function createDillonAnnouncer(){
 let busy=false,lastAt=0,lastPick={},pending=null,enabled=false;
 const MIN_GAP=30000;
 const synth=typeof window!=="undefined" ? window.speechSynthesis : null;
 function pick(category){
  const options=LINES[category];if(!options)return null;
  let idx=Math.floor(Math.random()*options.length);
  if(options.length>1&&idx===lastPick[category])idx=(idx+1)%options.length;
  lastPick[category]=idx;return options[idx];
 }
 function speak(category,{force=false}={}){
  if(!synth||typeof SpeechSynthesisUtterance==="undefined")return false;
  if(!force&&(busy||Date.now()-lastAt<MIN_GAP))return false;
  if(!enabled){pending=category;return false;}
  const line=pick(category);if(!line)return false;
  if(force)synth.cancel();
  const utterance=new SpeechSynthesisUtterance(line);
  const voices=synth.getVoices();
  const british=voices.find(v=>/^en-GB/i.test(v.lang)&&/male|daniel|george|ryan|oliver/i.test(v.name))
    ||voices.find(v=>/^en-GB/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));
  if(british)utterance.voice=british;
  utterance.lang="en-GB";utterance.rate=1.04;utterance.pitch=1.16;utterance.volume=0.85;
  busy=true;lastAt=Date.now();pending=null;
  utterance.onend=utterance.onerror=()=>{busy=false;};
  try{synth.speak(utterance);return true;}catch{busy=false;return false;}
 }
 function unlock(){
  enabled=true;
  if(pending&&!busy){const category=pending;pending=null;speak(category);}
 }
 document.addEventListener("pointerdown",unlock,{capture:true,once:true});
 document.addEventListener("keydown",unlock,{capture:true,once:true});
 return {speak};
}
