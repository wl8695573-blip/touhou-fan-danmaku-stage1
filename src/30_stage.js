'use strict';

function updatePlayer(dt){
  if(G.state!=='play') return;
  if(P.dead){ P.deadT-=dt; return; }
  if(P.inv>0) P.inv-=dt;
  P.anim+=dt;
  let dx=0,dy=0;
  if(held('left'))dx-=1; if(held('right'))dx+=1;
  if(held('up'))dy-=1; if(held('down'))dy+=1;
  P.focus=held('focus')||(touch.act&&touch.focus);
  const sp=(P.focus?2.3:P.spd);
  if(dx&&dy){dx*=0.7071;dy*=0.7071;}
  P.x+=dx*sp*dt; P.y+=dy*sp*dt;
  // 触屏：手指目标平滑跟随（雷霆战机式）
  if(touch.act){
    const k=1-Math.exp(-dt*22);
    P.x+=(touch.x-P.x)*k; P.y+=(touch.y-P.y)*k;
  }
  P.x=clamp(P.x,8,CVW-8);
  P.y=clamp(P.y,24,CVH-12);
  // 开火（触屏模式自动射击）
  P.fireT-=dt;
  if((TOUCH||held('fire'))&&P.fireT<=0){
    P.fireT=fireInterval();
    pfire();
  }
  if(consumePressed('bomb')&&bombsFx.length===0&&G.bombs>0&&!P.dead){ tryBomb(); }
}
function tryBomb(){
  if(G.state!=='play'||P.dead||bombsFx.length>0||G.bombs<=0) return;
  doBomb();
}
function fireInterval(){ return 0.105; }
function pfire(){
  const ch=G.char, pw=G.power;
  const x=P.x,y=P.y-18;
  const mk=(vx,vy,dmg,hom,color,r)=>{
    pshots.push({x,y,vx,vy,dmg,hom:!!hom,turn:8,t:0,dead:false,r:r||3,color:color||'#ffd'});
  };
  // 弹幕量已削减：低火力时只有 1 条主弹道，火力≥3 出双翼、≥6 出外翼
  if(ch==='reimu'){
    mk(0,-540,5,true,'#ff9fae',3.4);
    if(pw>=3){ mk(-90,-510,4,true,'#ffd0da',3); mk(90,-510,4,true,'#ffd0da',3); }
    if(pw>=6){ mk(-170,-470,4,true,'#ffb0c0',3); mk(170,-470,4,true,'#ffb0c0',3); }
  } else if(ch==='marisa'){
    mk(0,-680,10,false,'#ffe27a',4);
    if(pw>=3){ mk(-84,-620,7,false,'#fff0b0',3.2); mk(84,-620,7,false,'#fff0b0',3.2); }
    if(pw>=6){ mk(-155,-560,6,false,'#ffd75e',3); mk(155,-560,6,false,'#ffd75e',3); }
  } else { // sanae
    mk(0,-540,5,true,'#8fe8c9',3.2);
    if(pw>=3){ mk(-105,-500,4,true,'#b9f2dc',3); mk(105,-500,4,true,'#b9f2dc',3); }
    if(pw>=6){ mk(-185,-450,4,true,'#eafff4',2.8); mk(185,-450,4,true,'#eafff4',2.8); }
  }
  sfx('shot');
}
/* 自机弹更新（含追踪） */
function nearestTarget(x,y){
  let best=null,bd=1e9;
  for(const e of ens){ if(e.y<34) continue; const d=dist2(x,y,e.x,e.y); if(d<bd){bd=d;best=e;} }
  if(bo&&bo.vulnerable&&!bo.dying){ const d=dist2(x,y,bo.x,bo.y); if(d<bd){bd=d;best=bo;} }
  return best;
}
function updatePshots(dt){
  for(let i=pshots.length-1;i>=0;i--){
    const b=pshots[i];
    b.t+=dt;
    if(b.hom){
      const tg=nearestTarget(b.x,b.y);
      if(tg){
        const want=angTo(b.x,b.y,tg.x,tg.y);
        const cur=Math.atan2(b.vy,b.vx);
        let d=want-cur;
        while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
        const maxT=b.turn*dt;
        const nd=clamp(d,-maxT,maxT);
        const spd=Math.hypot(b.vx,b.vy);
        b.vx=Math.cos(cur+nd)*spd; b.vy=Math.sin(cur+nd)*spd;
      }
    }
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(b.y<-24||b.x<-16||b.x>CVW+16||b.dead) pshots.splice(i,1);
  }
  // 碰撞（自机弹 vs 敌人/中Boss/Boss；屏幕外(<y44)的敌人不可被击杀，保证“先看见再打倒”）
  for(let i=pshots.length-1;i>=0;i--){
    const b=pshots[i];
    let hit=false;
    for(const e of ens){
      if(!e.dead&&e.y>44&&dist2(b.x,b.y,e.x,e.y)<(e.r?e.r+8:10.5*10.5)){
        e.hp-=b.dmg; sparks(b.x,b.y,'#ffd75e',3,80); e.hitT=0.06;
        if(e.hp<=0&&!e.dead){ killEnemy(e); }
        hit=true; break;
      }
    }
    if(!hit&&bo&&bo.vulnerable&&!bo.dying){
      if(dist2(b.x,b.y,bo.x,bo.y)<(bo.r?bo.r:20)*(bo.r?bo.r:20)){
        bossDamage(b.dmg,b.x,b.y);
        hit=true;
      }
    }
    if(hit){ pshots.splice(i,1); sfx('hit'); }
  }
}
function killEnemy(e){
  e.dead=true;
  sparks(e.x,e.y,e.color||'#fff',10,150);
  G.score+=100;
  if(e.drop&&Math.random()<0.5) dropItem(e.x,e.y,'p');
  else dropItem(e.x,e.y,'s');
}
function bossDamage(dmg,x,y){
  if(!bo||bo.dying) return;
  if(bo.approach){ return; } // 入场时无敌
  bo.hp-=dmg; bo.flash=0.05; G.score+=4;
  sparks(x,y,'#ffffff',2,60);
  if(bo.hp<=0) bossPhaseBreak();
}
function updateEbul(dt){
  if(G.freeze>0) G.freeze-=dt;
  else unfreezeBullets();
  const hitR=2.2;
  for(let i=ebul.length-1;i>=0;i--){
    const b=ebul[i];
    b.t+=dt;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    // 擦弹
    if(!b.grazed&&!P.dead&&G.state==='play'&&P.inv<=0){
      const d=dist2(b.x,b.y,P.x,P.y+4);
      if(d<22*22&&d>8*8){ b.grazed=true; G.graze++; G.score+=5; sfx('graze'); }
    }
    // 命中判定
    if(!P.dead&&P.inv<=0&&G.state==='play'){
      if(dist2(b.x,b.y,P.x,P.y+2)<(b.r+hitR)*(b.r+hitR)){ hitPlayer(); }
    }
    if(b.x<-30||b.x>CVW+30||b.y<-40||b.y>CVH+30||b.dead) ebul.splice(i,1);
  }
  // 炸弹清理
  if(bombsFx.length){
    for(let i=ebul.length-1;i>=0;i--){
      const b=ebul[i];
      if(!b.dead&&Math.random()<0.5){
        b.dead=true;
        pts.push({x:b.x,y:b.y,vx:0,vy:-40,t:0,dur:0.4,color:'#fff9d0',r:2.5,dead:false,g:0});
        if(Math.random()<0.25) dropItem(b.x,b.y,'s',0,-60);
        G.score+=10;
      }
    }
  }
  if(G.freeze>0&&Math.random()<0.2) sfx('cancel');
}
function hitPlayer(){
  if(P.dead||P.inv>0||bombsFx.length>0) return;
  killPlayer();
}
function killPlayer(){
  P.dead=true; P.deadT=2.2;
  sparks(P.x,P.y,'#ffffff',40,260);
  ringFx(P.x,P.y,'#ff5555',60,3,26);
  sfx('death'); vib(70);
  G.lives--;
  if(G.lives<0){
    gameOver('「弹尽粮绝…雾之湖畔的真相只能留给下次了」');
    return;
  }
}
function respawnPlayer(){
  P.dead=false; P.inv=3.5; P.x=240; P.y=CVH-70; P.focus=false;
  G.power=Math.max(0,G.power-1);
}
function updateItems(dt){
  for(let i=its.length-1;i>=0;i--){
    const it=its[i];
    it.t+=dt;
    if(it.g){ it.vy+=it.g*dt; }
    it.x+=it.vx*dt; it.y+=it.vy*dt;
    // 磁吸
    if(!P.dead){
      const d=dist2(it.x,it.y,P.x,P.y);
      if(d<80*80){
        const a=angTo(it.x,it.y,P.x,P.y);
        it.vx=Math.cos(a)*260; it.vy=Math.sin(a)*260;
      } else if(d<120*120){ it.vx*=1.02; it.vy=Math.max(-120,it.vy-20*dt); }
    }
    if(Math.abs(it.x-P.x)<16&&Math.abs(it.y-P.y)<22&&!P.dead){
      collectItem(it); it.dead=true;
    }
    if(it.y>CVH+20) it.dead=true;
  }
  its=its.filter(i=>!i.dead);
}
function collectItem(it){
  if(it.kind==='p'){
    if(G.power<8){ G.power++; sfx('power'); }
    else { G.score+=500; sfx('item'); }
  } else if(it.kind==='b'){
    if(G.bombs<6){ G.bombs++; }
    sfx('1up');
  } else {
    G.score+=100;
    sfx('item');
  }
  pts.push({x:it.x,y:it.y,vx:0,vy:-30,t:0,dur:0.35,color:'#fff',r:2,dead:false});
}
function updateParticles(dt){
  for(let i=pts.length-1;i>=0;i--){
    const p=pts[i];
    p.t+=dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.g)p.vy+=p.g*dt;
    if(p.t>p.dur) pts.splice(i,1);
  }
}
function drawParticles(){
  for(const p of pts){
    ctx.globalAlpha=1-p.t/p.dur;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function doBomb(){
  if(G.bombs<=0) return;
  G.bombs--;
  sfx('bomb'); vib(25);
  bombsFx.push({t:0,dur:2.3,ch:G.char,nextD:0});
  P.inv=3;
}
function updateBombFx(dt){
  for(let i=bombsFx.length-1;i>=0;i--){
    const f=bombsFx[i];
    f.t+=dt; f.nextD-=dt;
    if(f.nextD<=0){ f.nextD=0.05; ringFx(P.x,P.y+30,'#ffe9b0',40,3,18); }
    // 对敌伤害
    for(const e of ens){ if(!e.dead){ e.hp-=6; if(e.hp<=0) killEnemy(e); } }
    if(bo&&bo.vulnerable){ bossDamage(2.2,bo.x,bo.y); }
    if(f.t>=f.dur){ bombsFx.splice(i,1); }
  }
}
function drawBombFx(){
  for(const f of bombsFx){
    const k=1-f.t/f.dur;
    if(f.ch==='reimu'){
      ctx.strokeStyle='rgba(255,140,160,'+(0.7*k)+')'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.arc(P.x,P.y,40+90*(1-k),0,TAU); ctx.stroke();
    } else if(f.ch==='marisa'){
      ctx.fillStyle='rgba(255,240,180,'+(0.35*k)+')';
      ctx.fillRect(P.x-40,0,80,CVH);
      ctx.fillStyle='rgba(255,215,94,'+(0.6*k)+')';
      ctx.fillRect(P.x-7,0,14,CVH);
    } else {
      ctx.fillStyle='rgba(190,255,230,'+(0.3*k)+')';
      ctx.beginPath(); ctx.ellipse(P.x,P.y,70*(1.6-k),50*(1.6-k),0,0,TAU); ctx.fill();
      ctx.strokeStyle='rgba(240,255,250,'+(0.6*k)+')'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(P.x,P.y,50*k+20,0,TAU); ctx.stroke();
    }
  }
}
let lifeNeed=50000;
function checkLife(){
  while(G.score>=lifeNeed){
    lifeNeed+=50000;
    if(G.lives<6){ G.lives++; sfx('extend'); banner('残机 +1','',2.0,'#ffd75e'); }
  }
}
function stageEvent(at,fn){ G.events.push({at,fn}); }
const BOSS_STAGES=['midboss','boss','boss2'];
function processEvents(){
  G.events=G.events.filter(ev=>{
    if(G.t>=ev.at){ ev.fn(); return false; }
    return true;
  });
}
function initStageScript(){
  G.events=[];
  stageEvent(0.3,()=>{ banner('Stage 1','雾之湖畔的异变调查',3.2,'#ffd75e'); });
  // —— 道中妖精波（约20秒，形状/颜色轮换，弹速整体已上调）——
  const colors=['#ff9fae','#ffe27a','#9be1ff','#b9f2c9','#e6b9ff','#ffd0d0'];
  for(let i=0;i<9;i++){
    const t=i*2.1;
    const c=colors[i%colors.length];
    const kind=i%4;
    stageEvent(t+1.2,()=>{
      if(G.stage!=='field') return;
      if(kind===0) addFairiesLine(5,c,false);
      else if(kind===1) addFairiesLine(4,c,true);
      else if(kind===2){ addFairySides(2,c); addFairiesLine(3,c,false); }
      else { addFairiesLine(6,c,true); }
    });
  }
  stageEvent(19.5,()=>{ if(G.stage==='field'){ G.stage='midboss'; stageMidBoss(); } });
  // —— 第二段道中（中Boss后） ——
  for(let i=0;i<7;i++){
    const t=37+i*2.4;
    const c=colors[(i+2)%colors.length];
    stageEvent(t,()=>{
      if(G.stage!=='field2') return;
      if(i%3===0) addFairiesLine(5,c,true);
      else if(i%3===1){ addFairySides(3,c); }
      else addFairiesLine(4,c,false);
    });
  }
  stageEvent(62,()=>{ if(G.stage==='field2'){ G.stage='boss'; stageBoss(); } });
}
function stageMidBoss(){
  banner('琪露诺','雾之湖的冰之妖精 登场！',2.4,'#9be1ff');
  sfx('spell');
  bossStart('cirno');
}
function stageBoss(){
  banner('十六夜咲夜','红魔馆的女仆长 登场！',2.6,'#e6e6f0');
  sfx('spell');
  bgmPlay('boss');
  bossStart('sakuya');
}
/* —— 第三段：深入红魔馆（咲夜击破后） —— */
function remiliaApproach(){
  const colors=['#e8c4f0','#ffb9d0','#c9a8ff','#ffd9e8'];
  const bT=Math.max(G.t+18,84);           // 蕾米莉亚登场不早于 84s（保持节奏）
  let t=G.t+1.3, i=0;
  while(t<bT-2){
    const tt=t, ci=i%4;
    stageEvent(tt,()=>{
      if(G.stage!=='field3') return;
      if(ci%3===0) addFairiesLine(5,colors[ci],true);
      else if(ci%3===1){ addFairySides(3,colors[ci]); addFairiesLine(2,colors[ci],false); }
      else addFairiesLine(6,colors[ci],true);
    });
    t+=2.2; i++;
  }
  stageEvent(bT,()=>{ if(G.stage==='field3'){ stageRemilia(); } });
}
function stageRemilia(){
  if(G.stage!=='field3') return;
  G.stage='boss2';
  banner('蕾米莉亚·斯卡雷特','红魔馆之主 登场！',2.6,'#ffb3c8');
  sfx('spell');
  bgmPlay('boss');
  bossStart('remilia');
}
function updateStage(dt){
  if(G.state!=='play') return;
  G.t+=dt;
  processEvents();
  if(BOSS_STAGES.includes(G.stage)){
    if(bo&&bo.alive) updateBoss(dt);
  }
}
