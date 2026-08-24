export const BLANK = "__BLANK__";

export function shuffle(max) {
  const values = Array.from({length:max},(_,i)=>i+1);
  for (let i=values.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [values[i],values[j]]=[values[j],values[i]];
  }
  return values;
}

function uniqueRandom(min,max,count) {
  const pool=Array.from({length:max-min+1},(_,i)=>i+min);
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool.slice(0,count).sort((a,b)=>a-b);
}

export function create75Card() {
  const cols=[
    uniqueRandom(1,15,5),
    uniqueRandom(16,30,5),
    uniqueRandom(31,45,5),
    uniqueRandom(46,60,5),
    uniqueRandom(61,75,5)
  ];
  const card=[];
  for(let r=0;r<5;r++){
    for(let c=0;c<5;c++){
      card.push(r===2&&c===2?"FREE":cols[c][r]);
    }
  }
  return card;
}

export function create90Card() {
  while(true){
    const rowCols=[0,1,2].map(()=>uniqueRandom(0,8,5));
    const used=new Set(rowCols.flat());
    if(used.size<9) continue;
    const grid=Array.from({length:3},()=>Array(9).fill(BLANK));
    for(let c=0;c<9;c++){
      const rows=[0,1,2].filter(r=>rowCols[r].includes(c));
      const min=c===0?1:c*10;
      const max=c===8?90:c*10+9;
      const nums=uniqueRandom(min,max,rows.length);
      rows.forEach((r,i)=>grid[r][c]=nums[i]);
    }
    return grid.flat();
  }
}

export function validWin(card, marked, called, mode, stage="one-line") {
  const markedSet=new Set((marked||[]).map(Number));
  const calledSet=new Set((called||[]).map(Number));
  const complete=(value)=>{
    if(value==="FREE") return true;
    if(value===BLANK||value===""||value==null) return true;
    const n=Number(value);
    return markedSet.has(n)&&calledSet.has(n);
  };

  if(mode.startsWith("90")){
    const rows=[0,1,2].map(r=>card.slice(r*9,r*9+9).filter(v=>v!==BLANK&&v!==""));
    const completed=rows.filter(row=>row.every(complete)).length;
    if(mode==="90-full-house"||stage==="full-house") return rows.flat().every(complete);
    if(stage==="two-lines") return completed>=2;
    return completed>=1;
  }

  if(mode==="75-corners") return [0,4,20,24].every(i=>complete(card[i]));
  const rows=[0,1,2,3,4].map(r=>card.slice(r*5,r*5+5));
  const completed=rows.filter(row=>row.every(complete)).length;
  if(mode==="75-two-lines") return completed>=2;
  return completed>=1;
}

export function missingCount(card, marked, called, mode, stage="one-line") {
  const markedSet=new Set((marked||[]).map(Number));
  const calledSet=new Set((called||[]).map(Number));
  const miss=(value)=>{
    if(value==="FREE"||value===BLANK||value===""||value==null) return 0;
    const n=Number(value);
    return markedSet.has(n)&&calledSet.has(n)?0:1;
  };

  if(mode.startsWith("90")){
    const rows=[0,1,2].map(r=>card.slice(r*9,r*9+9).reduce((s,v)=>s+miss(v),0)).sort((a,b)=>a-b);
    if(mode==="90-full-house"||stage==="full-house") return rows.reduce((a,b)=>a+b,0);
    if(stage==="two-lines") return rows[0]+rows[1];
    return rows[0];
  }
  if(mode==="75-corners") return [0,4,20,24].reduce((s,i)=>s+miss(card[i]),0);
  const rows=[0,1,2,3,4].map(r=>card.slice(r*5,r*5+5).reduce((s,v)=>s+miss(v),0)).sort((a,b)=>a-b);
  if(mode==="75-two-lines") return rows[0]+rows[1];
  return rows[0];
}

function card90Milestones(card,order){
  const position=new Map(order.map((number,index)=>[number,index+1]));
  const rows=[0,1,2].map(row=>
    card.slice(row*9,row*9+9).filter(value=>value!==BLANK&&value!=="")
  );

  const finishes=rows.map(row=>
    Math.max(...row.map(number=>position.get(Number(number))||90))
  ).sort((a,b)=>a-b);

  return {
    oneLine:finishes[0],
    twoLines:finishes[1],
    fullHouse:finishes[2]
  };
}

function distanceToRange(value,range){
  if(value<range[0])return range[0]-value;
  if(value>range[1])return value-range[1];
  return 0;
}

export function createBalanced90Draw(cards){
  const usable=(cards||[]).filter(card=>Array.isArray(card)&&card.length===27);

  if(!usable.length){
    return {order:shuffle(90),profile:"random"};
  }

  const roll=Math.random();
  const profile=
    roll<.25
      ? {name:"quick",oneLine:[25,42],twoLines:[45,62],fullHouse:[65,80]}
      : roll<.75
        ? {name:"standard",oneLine:[35,52],twoLines:[52,68],fullHouse:[70,84]}
        : {name:"slow",oneLine:[45,60],twoLines:[60,75],fullHouse:[78,89]};

  let best=shuffle(90);
  let bestScore=Infinity;

  for(let attempt=0;attempt<3500;attempt+=1){
    const order=shuffle(90);
    const milestones=usable.map(card=>card90Milestones(card,order));

    const earliest={
      oneLine:Math.min(...milestones.map(item=>item.oneLine)),
      twoLines:Math.min(...milestones.map(item=>item.twoLines)),
      fullHouse:Math.min(...milestones.map(item=>item.fullHouse))
    };

    const score=
      distanceToRange(earliest.oneLine,profile.oneLine)**2+
      distanceToRange(earliest.twoLines,profile.twoLines)**2+
      distanceToRange(earliest.fullHouse,profile.fullHouse)**2;

    if(score<bestScore){
      bestScore=score;
      best=order;
    }

    if(score===0)break;
  }

  return {order:best,profile:profile.name};
}
