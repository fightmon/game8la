// 拆解 RTP 來源：哪個符號、幾連、倍數貢獻多少
import { createGame, mulberry32, SYMS, VOL } from '../public/lubu/engine.mjs';
const N = parseInt(process.argv[2],10) || 200000;
const BET = 20;
for (const vol of ['low','mid','high']) {
  const g = createGame({ rtp:96, vol, rng: mulberry32(7), flatPayK:true, drift:false });
  let bet=0, base=0, afterMulti=0, instant=0, jp=0;
  const bySym={}, byCount={8:0,10:0,12:0};
  let multiSpins=0, multiSumTotal=0, boards=0, multiCells=0, bonusCells=0, fgSpins=0;
  for(let i=0;i<N;i++){
    const r=g.spin(BET);
    bet+=r.cost; base+=r.baseWin; instant+=r.instantWin; jp+=r.jackpot?r.jackpot.amount:0;
    afterMulti += r.baseWin*(r.multiSum>0?r.multiSum:1);
    if(r.multiSum>0){multiSpins++; multiSumTotal+=r.multiSum;}
    if(r.wasFreeSpin) fgSpins++;
    boards++;
    for(const c of r.startBoard){ if(c.kind==='multi')multiCells++; if(c.kind==='bonus')bonusCells++; }
    for(const st of r.steps) for(const m of st.matches){
      bySym[m.id]=(bySym[m.id]||0)+m.pay;
      byCount[m.count>=12?12:m.count>=10?10:8]++;
    }
  }
  console.log(`\n=== ${VOL[vol].name}（payK=1, ${N.toLocaleString()} 轉）===`);
  console.log(`基礎贏分RTP ${(base/bet*100).toFixed(1)}%  →  套倍數後 ${(afterMulti/bet*100).toFixed(1)}%  (放大 ${(afterMulti/base).toFixed(2)}x)`);
  console.log(`FG即時獎 ${(instant/bet*100).toFixed(1)}%   彩金 ${(jp/bet*100).toFixed(1)}%   FG佔轉數 ${(fgSpins/N*100).toFixed(1)}%`);
  console.log(`每盤平均倍數格 ${(multiCells/boards).toFixed(2)} 個、Bonus格 ${(bonusCells/boards).toFixed(2)} 個`);
  console.log(`有倍數的轉佔 ${(multiSpins/N*100).toFixed(1)}%，其平均總倍數 ${(multiSumTotal/Math.max(1,multiSpins)).toFixed(1)}x`);
  const tot=Object.values(bySym).reduce((a,b)=>a+b,0);
  console.log('各符號基礎RTP貢獻:');
  for(const s of SYMS){ const v=bySym[s.id]||0; console.log(`  ${s.name.padEnd(6)} ${(v/bet*100).toFixed(1).padStart(6)}%  (佔 ${(v/tot*100).toFixed(1)}%)`); }
  console.log(`中獎檔位次數  8-9:${byCount[8]}  10-11:${byCount[10]}  12+:${byCount[12]}`);
}
