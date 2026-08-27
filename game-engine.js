export const BLANK = "__BLANK__";

export function shuffle(max){
  const order=Array.from({length:max},(_,i)=>i+1);
  const buffer=new Uint32Array(1);

  for(let i=order.length-1;i>0;i--){
    const range=i+1;
    const limit=Math.floor(0x100000000/range)*range;
    let value;
    do{
      crypto.getRandomValues(buffer);
      value=buffer[0];
    }while(value>=limit);
    const j=value%range;
    [order[i],order[j]]=[order[j],order[i]];
  }
  return order;
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

export function createBalanced90Draw(){
  // V2.3.7 FAIR DRAW — player cards are intentionally ignored.
  // crypto.getRandomValues + rejection sampling + Fisher-Yates.
  const order=Array.from({length:90},(_,i)=>i+1);
  const buffer=new Uint32Array(1);

  for(let i=order.length-1;i>0;i--){
    const range=i+1;
    const limit=Math.floor(0x100000000/range)*range;
    let value;
    do{
      crypto.getRandomValues(buffer);
      value=buffer[0];
    }while(value>=limit);
    const j=value%range;
    [order[i],order[j]]=[order[j],order[i]];
  }

  return {order,profile:"true-random"};
}
