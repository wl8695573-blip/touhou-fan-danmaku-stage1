'use strict';
// TODO: 咲夜时停那段现在只是整体减速,想改成慢动作加残影
let bossTick=0;

function bossStart(kind){
  bo={
    kind, alive:true, x:240, y:-60, t:0, phT:0,
    phase:0, hp:0, hpMax:1, vulnerable:false, approach:true,
    flash:0, dying:false, dieT:0, shootT:0, spinA:0, sub:0,
    freezeNextAt:0, moveX:0,
  };
  bo.phases=PHASES[kind];
  for(const p of bo.phases){ p.fireT=undefined; p.frozenAt=undefined; p.freezeDur=undefined; }
  bo.hpMax=bo.hp=bo.phases[0].hp;
  bossTick=0;
}
const PHASES={
  cirno:[
    {name:'冰弾乱舞',hp:760,spell:false,move:'cirnoFloat'},
    {name:'冰符「Icicle Fall」',hp:1280,spell:true,move:'cirnoFloat'},
    {name:'雹符「Hailstorm」',hp:1520,spell:true,move:'cirnoFloat'},
  ],
  sakuya:[
    {name:'银刃乱舞',hp:1200,spell:false,move:'sakuyaFloat'},
    {name:'银符「Silver Blade」',hp:2200,spell:true,move:'sakuyaSweep'},
    {name:'奇术',hp:1600,spell:false,move:'sakuyaFloat'},
    {name:'幻符「杀人玩偶」',hp:3000,spell:true,move:'sakuyaLunge'},
    {name:'时符「Private Square」',hp:4000,spell:true,move:'sakuyaLunge'},
  ],
  remilia:[
    {name:'绯红弹幕',hp:1000,spell:false,move:'remiliaFloat'},
    {name:'红符「不夜城レッド」',hp:2600,spell:true,move:'remiliaFloat'},
    {name:'红雾狂宴',hp:1700,spell:false,move:'remiliaLunge'},
    {name:'神枪「Spear the Gungnir」',hp:3800,spell:true,move:'remiliaLunge'},
    {name:'深红终幕',hp:5900,spell:false,move:'remiliaLunge'},
  ],
};
const MIDBOSS_LIFE={cirno:4000,sakuya:6000,remilia:10000};
const SPELL_BONUS={cirno:5000,sakuya:8000,remilia:10000};

function updateBoss(dt){
  if(!bo||!bo.alive) return;
  bossTick+=dt;
  bo.t+=dt; bo.flash=Math.max(0,bo.flash-dt);
  if(bo.dying){ bo.dieT-=dt; bo.y-=dt*40;
    if(Math.random()<0.3) sparks(bo.x+rnd(-20,20),bo.y+rnd(-30,10),'#fff',3,120);
    if(bo.dieT<=0) finishBossDefeat();
    return;
  }
  // 入场
  if(bo.approach){
    bo.x=lerp(bo.x,240,dt*1.6);
    bo.y=lerp(bo.y,150,dt*1.1);
    if(Math.abs(bo.x-240)<4&&bo.y>140){ bo.approach=false; bo.phT=0; bo.vulnerable=true; }
    return;
  }
  bo.phT+=dt;
  const def=bo.phases[bo.phase];
  moveBoss(bo,def,dt);
  def.fire(bo,dt);
  // 接触玩家
  if(!P.dead&&P.inv<=0&&G.state==='play'){
    if(dist2(bo.x,bo.y,P.x,P.y+8)<(22*22)) killPlayer();
  }
}
function moveBoss(bo,def,dt){
  const t=bo.t;
  switch(def.move){
    case 'cirnoFloat':
      bo.x=240+Math.sin(t*0.9)*70;
      bo.y=150+Math.sin(t*1.7)*26;
      break;
    case 'sakuyaFloat':
      bo.x=240+Math.sin(t*0.7)*95;
      bo.y=145+Math.sin(t*1.3)*40;
      break;
    case 'sakuyaSweep':
      bo.x=240+Math.sin(t*0.55)*180;
      bo.y=130+Math.sin(t*2.2)*50;
      break;
    case 'sakuyaLunge':
      bo.moveX=(bo.moveX||1);
      bo.x+=bo.moveX*dt*60;
      bo.y=150+Math.sin(t*1.9)*36;
      if(bo.x>430){bo.x=430;bo.moveX=-1;}
      if(bo.x<50){bo.x=50;bo.moveX=1;}
      break;
    case 'remiliaFloat':
      bo.x=240+Math.sin(t*0.62)*115;
      bo.y=140+Math.sin(t*1.15)*30;
      break;
    case 'remiliaLunge':
      bo.moveX=(bo.moveX||1);
      bo.x+=bo.moveX*dt*78;
      bo.y=140+Math.sin(t*1.7)*40;
      if(bo.x>440){bo.x=440;bo.moveX=-1;}
      if(bo.x<40){bo.x=40;bo.moveX=1;}
      break;
  }
}
function cirnoFire(bo,dt){
  const m=diffMul(),c=diffCnt();
  const ph=bo.phases[bo.phase];
  if(!ph.fireT) ph.fireT=0; ph.fireT-=dt;
  const kind=bo.kind;
  if(kind==='cirno'&&bo.phase===0){
    if(ph.fireT<=0){ ph.fireT=0.62/m;
      fan(bo.x,bo.y,3,0.42,angTo(bo.x,bo.y,P.x,P.y+4),150*m,'#bfe9ff',3.4,'c');
      if(Math.random()<0.4) aimed(bo.x,bo.y+6,200*m,'#ffffff',3,'i',1,0);
    }
  } else if(kind==='cirno'&&bo.phase===1){
    // 冰锥雨 + 冰晶
    if(ph.fireT<=0){ ph.fireT=0.16/m;
      const sx=P.x+rnd(-90,90);
      const spd=rnd(150,210)*m;
      eSpawn(clamp(sx,26,CVW-26),-18,0,spd,3.2,'#eaf7ff','i');
      if(Math.random()<0.25) eSpawn(clamp(P.x+rnd(-130,130),26,CVW-26),-18,0,spd*1.1,3,'#ffffff','i');
    }
    if(Math.random()<0.08*m) ring(bo.x,bo.y,Math.max(4,Math.round(8*c)),70*m,'#9be1ff',3,'c',0);
  } else if(kind==='cirno'&&bo.phase===2){
    // 自转冰轮 + 乱雹
    bo.spinA+=dt*1.15;
    if(ph.fireT<=0){ ph.fireT=0.05/m;
      const n=Math.max(6,Math.round(9*c));
      for(let k=0;k<n;k++){
        const a=bo.spinA+k*(TAU/n)+Math.sin(bo.t)*0.3;
        eSpawn(bo.x,bo.y,Math.cos(a)*105*m,Math.sin(a)*105*m,3.2,'#9fe4ff','c');
      }
    }
    if(Math.random()<0.12*m){ eSpawn(rnd(30,CVW-30),-20,rnd(-40,40),rnd(120,230)*m,3,'#ffffff','i'); }
  }
}
function sakuyaFire(bo,dt){
  const m=diffMul(),c=diffCnt();
  const ph=bo.phases[bo.phase];
  if(!ph.fireT) ph.fireT=0; ph.fireT-=dt;
  const P2=bo.phase;
  if(P2===0){
    if(ph.fireT<=0){ ph.fireT=0.85/m;
      aimed(bo.x,bo.y+4,170*m,'#d6e8f5',3.6,'k',4,0.34);
      if(Math.random()<0.5) aimed(bo.x,bo.y+4,120*m,'#ffffff',3.2,'k',1,0);
    }
  } else if(P2===1){
    // 银刃连发 + 低速圆刃
    if(ph.fireT<=0){ ph.fireT=0.34/m;
      aimed(bo.x,bo.y+4,185*m,'#d9ecfa',3.6,'k',3,0.16);
    }
    bo.sub+=dt;
    if(bo.sub>1.4/m){ bo.sub=0;
      ring(bo.x,bo.y,Math.max(10,Math.round(20*c)),52*m,'#a8c8e8',3.2,'k',bo.t*0.9);
    }
  } else if(P2===2){
    if(ph.fireT<=0){ ph.fireT=0.09/m;
      bo.spinA+=0.55;
      eSpawn(bo.x,bo.y,Math.cos(bo.spinA)*96*m,Math.sin(bo.spinA)*96*m,3,'#ff9fae','c');
      if(Math.random()<0.18) aimed(bo.x,bo.y,210*m,'#ffb9c8',3,'c',1,0);
    }
  } else if(P2===3){
    // 杀人玩偶：双侧螺旋刀 + 瞄准
    if(ph.fireT<=0){ ph.fireT=0.07/m;
      bo.spinA+=0.16;
      const sp=108*m;
      for(const s of[-1,1]){
        const a=bo.spinA+ (s>0?0:Math.PI);
        eSpawn(bo.x+Math.cos(a)*26,bo.y+Math.sin(a)*26,Math.cos(a)*sp,Math.sin(a)*sp,3.4,'#ff8090','k');
      }
    }
    if(Math.random()<0.06) aimed(bo.x,bo.y,160*m,'#ffd0da',3,'k',1,0);
  } else if(P2===4){
    // 时符：周期时停 + 白弹封锁
    if(!ph.frozenAt) ph.frozenAt=0;
    if(bo.t-ph.frozenAt> (ph.freezeDur||0) && G.freeze<=0){
      ph.frozenAt=bo.t; ph.freezeDur=7;
      freezeBullets(4.0);
      ringFx(bo.x,bo.y,'#fff',140,3,40);
      sfx('spell');
    }
    if(G.freeze>0){
      if(ph.fireT<=0){ ph.fireT=0.3/m;
        aimed(bo.x,bo.y,150*m,'#ffffff',3.6,'o',3,0.5);
        if(Math.random()<0.5) eSpawn(rnd(60,CVW-60),-20,0,rnd(120,170)*m,3,'#e8f2ff','i');
      }
    } else if(ph.fireT<=0){
      ph.fireT=0.13/m;
      const a=bo.spinA; bo.spinA+=0.9;
      eSpawn(bo.x,bo.y,Math.cos(a)*120*m,Math.sin(a)*120*m,3.4,'#ffe9a8','c');
      if(Math.random()<0.12) aimed(bo.x,bo.y,180*m,'#ffffff',3,'k',1,0);
    }
  }
}
function remiliaFire(bo,dt){
  const m=diffMul(),c=diffCnt();
  const ph=bo.phases[bo.phase];
  if(!ph.fireT) ph.fireT=0; ph.fireT-=dt;
  const P2=bo.phase;
  if(P2===0){
    // 绯红弹幕：五连瞄准刀弹 + 慢速白球
    if(ph.fireT<=0){ ph.fireT=0.9/m;
      aimed(bo.x,bo.y+4,175*m,'#ff8096','k',5,0.5);
      if(Math.random()<0.5) aimed(bo.x,bo.y+4,120*m,'#ffffff','o',1,0);
    }
    bo.sub+=dt;
    if(bo.sub>2.2/m){ bo.sub=0;
      ring(bo.x,bo.y,Math.max(8,Math.round(14*c)),80*m,'#ffa8b8','k',bo.t*0.7);
    }
  } else if(P2===1){
    // 红符「不夜城」：绕身赤环 + 高速针雨 + 坠落火球
    if(ph.fireT<=0){ ph.fireT=0.24/m;
      ring(bo.x,bo.y,Math.max(6,Math.round(10*c)),110*m,'#ff5a6a','c',bo.spinA);
      bo.spinA+=0.35;
    }
    bo.sub+=dt;
    if(bo.sub>1.15/m){ bo.sub=0;
      aimed(bo.x,bo.y,225*m,'#ffb3c8','k',3,0.22);
    }
    if(Math.random()<0.10*m){ eSpawn(rnd(40,CVW-40),-18,0,rnd(150,230)*m,3.6,'#ff8f6a','i'); }
  } else if(P2===2){
    // 红雾狂宴：双旋转紫弹 + 瞄准紫刀
    if(ph.fireT<=0){ ph.fireT=0.06/m;
      bo.spinA+=0.7;
      for(const s of[-1,1]){
        const a=bo.spinA+s*0.9+Math.sin(bo.t*1.3)*0.4;
        eSpawn(bo.x,bo.y,Math.cos(a)*118*m,Math.sin(a)*118*m,3.2,'#c9a8ff','c');
      }
    }
    if(Math.random()<0.1) aimed(bo.x,bo.y,200*m,'#e6c4ff','k',1,0);
  } else if(P2===3){
    // 神枪：贯穿级高速大弹 + 侧向刀阵
    bo.sub+=dt;
    if(bo.sub>0.5/m){ bo.sub=0;
      aimed(bo.x,bo.y,150*m,'#ff8fd0','k',1,0);
    }
    if(ph.fireT<=0){ ph.fireT=1.55/m;
      sfx('spell');
      aimed(bo.x,bo.y+2,330*m,'#ff4a5e','o',3,0.16);   // 三连神枪
      ringFx(bo.x,bo.y,'#ff4a5e',120,3,22);
    }
    if(Math.random()<0.14*m){ ring(bo.x,bo.y,Math.max(6,Math.round(9*c)),92*m,'#ffa8c8','k',bo.t); }
  } else {
    // 深红终幕：全弹混合狂宴
    if(ph.fireT<=0){ ph.fireT=0.05/m;
      bo.spinA+=1.1;
      const n=Math.max(5,Math.round(7*c));
      for(let k=0;k<n;k++){
        const a=bo.spinA+k*(TAU/n);
        eSpawn(bo.x,bo.y,Math.cos(a)*(100+Math.sin(bo.t*2.1)*30)*m,Math.sin(a)*(100+Math.sin(bo.t*2.1)*30)*m,3.2,'#ff6a8a','c');
      }
    }
    bo.sub+=dt;
    if(bo.sub>1.6/m){ bo.sub=0;
      aimed(bo.x,bo.y,240*m,'#ffd0da','k',5,0.6);
      if(Math.random()<0.4) aimed(bo.x,bo.y,300*m,'#ffffff','o',1,0);
    }
  }
}
/* 统一分发表 */
for(const k of ['cirno','sakuya','remilia']){
  PHASES[k].forEach((p,i)=>{ p.fire=p.fire||(k==='cirno'?cirnoFire:(k==='sakuya'?sakuyaFire:remiliaFire)); });
}
function bossPhaseBreak(){
  if(!bo||bo.dying) return;
  const defs=bo.phases, idx=bo.phase;
  if(idx>=defs.length-1){
    // Boss 击破演出
    bo.vulnerable=false; bo.dying=true; bo.dieT=2.0;
    ringFx(bo.x,bo.y,'#ffd75e',90,3,30);
    sfx('death');
    return;
  }
  // 击破当前阶段
  const bonus=(defs[idx].spell?SPELL_BONUS[bo.kind]:3000);
  G.score+=bonus;
  if(defs[idx].spell){
    sfx('clear');
    banner('スペルカード クリア！','+'+bonus.toLocaleString(),1.8,'#ffe27a');
    for(const b of ebul){ sparks(b.x,b.y,'#fff9d0',2,140); }
    ebul=[];
    showerItems(bo.x,bo.y,Math.max(6,Math.round(9*diffCnt())),true);
  } else {
    banner('阶段击破','+'+bonus.toLocaleString(),1.4,'#9fd0ff');
    ringFx(bo.x,bo.y,'#ffffff',80,3,20);
  }
  bo.phase++;
  const nd=defs[bo.phase];
  bo.hp=bo.hpMax=nd.hp;
  bo.phT=0; bo.sub=0; bo.spinA=0;
  if(nd.spell){ banner(nd.name,'',2.2,spellColor(bo.kind,nd.name)); sfx('spell'); }
}
function spellColor(kind,name){
  if(name.indexOf('时')>=0) return '#ffffff';
  if(kind==='remilia') return '#ffb3c8';
  return kind==='cirno'?'#7fd4ff':'#e8c4f0';
}
function finishBossDefeat(){
  const kind=bo.kind;
  bo.alive=false; bo.vulnerable=false;
  ringFx(bo.x,bo.y,'#ffffff',160,4,40);
  sparks(bo.x,bo.y,'#ffffff',60,300);
  sfx('1up');
  if(kind==='cirno'){
    G.score+=MIDBOSS_LIFE.cirno;
    banner('道中 Clear！','+'+MIDBOSS_LIFE.cirno.toLocaleString(),2.2,'#7fd4ff');
    bo=null;
    G.stage='field2';
    padWavesUntil(Math.max(G.t+2,33));
  } else if(kind==='sakuya'){
    G.score+=MIDBOSS_LIFE.sakuya;
    banner('「咲夜」击破！','+'+MIDBOSS_LIFE.sakuya.toLocaleString(),2.0,'#e6e6f0');
    bo=null;
    G.stage='field3';
    remiliaApproach();
  } else {
    // 蕾米莉亚击破 → 通关
    G.score+=MIDBOSS_LIFE.remilia;
    bo=null;
    G.stage='clear';
    stageClearSequence();
  }
}
function padWavesUntil(tUntil){
  const colors=['#ff9fae','#ffe27a','#9be1ff','#b9f2c9'];
  let t=G.t+1.4;
  let i=0;
  while(t<tUntil){
    const tt=t, ci=i%4;
    stageEvent(tt,()=>{
      if(G.stage!=='field2') return;
      if(ci%2===0) addFairiesLine(4,colors[ci],true);
      else addFairySides(2,colors[ci]);
    });
    t+=2.1; i++;
  }
}
function stageClearSequence(){
  bgmStop();
  setTimeout(()=>{ sfx('clear'); bgmPlay('clear'); uiShowClear(); },900);
}
function drawBoss(){
  if(!bo||!bo.alive) return;
  ctx.save(); ctx.translate(bo.x,bo.y);
  const bob=Math.sin(bossTick*2.4)*3;
  const hit=bo.flash>0;
  if(bo.kind==='cirno'){
    // 冰翼
    ctx.fillStyle=hit?'#ffffff':'#bfefff';
    for(const s of[-1,1]){
      ctx.save(); ctx.scale(s,1); ctx.translate(-10,-24);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-18,10); ctx.lineTo(-6,20); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle=hit?'#fff':bo.approach?'#6a7f96':'#7fd8f0';
    ctx.beginPath(); ctx.arc(0,8,16,0,TAU); ctx.fill();
    ctx.fillStyle=hit?'#fff':'#0e2f40';
    ctx.beginPath(); ctx.arc(0,4,12,0,TAU); ctx.fill();
    ctx.fillStyle=hit?'#fff':'#d8f6ff';
    ctx.beginPath(); ctx.arc(0,-2,8,0,TAU); ctx.fill();
    ctx.fillStyle='#9be1ff'; ctx.fillRect(-14,20,28,10);
  } else if(bo.kind==='remilia'){
    // 蕾米莉亚：银发 + 蝙蝠翼 + 深蓝礼裙
    ctx.fillStyle=hit?'#ffffff':'#e6c4ff';
    ctx.beginPath(); ctx.arc(0,2,16,0,TAU); ctx.fill();
    // 蝙蝠翼
    ctx.fillStyle=hit?'#fff':'#43305e';
    for(const s of[-1,1]){
      ctx.save(); ctx.scale(s,1); ctx.translate(10,-16);
      ctx.beginPath(); ctx.moveTo(0,-6);
      ctx.quadraticCurveTo(14,-16,26,-6);
      ctx.quadraticCurveTo(20,2,30,16);
      ctx.quadraticCurveTo(16,12,6,20);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle=hit?'#fff':'#262a44';
    ctx.beginPath(); ctx.arc(0,8,13,0,TAU); ctx.fill();
    ctx.fillStyle=hit?'#fff':'#f2eef7';
    ctx.beginPath(); ctx.arc(0,0,9.5,0,TAU); ctx.fill();
    ctx.fillStyle='#b3121e';
    ctx.beginPath(); ctx.arc(0,0,2.2,0,TAU); ctx.fill();     // 红瞳点缀
    ctx.fillStyle='#1d1f33'; ctx.fillRect(-14,24,28,14);
    ctx.fillStyle='#f2eef7'; ctx.fillRect(-14,38,28,3);
    ctx.fillStyle='#b3121e';
    ctx.beginPath(); ctx.arc(0,44,2.6,0,TAU); ctx.fill();
    ctx.fillStyle='#f2eef7'; ctx.fillRect(-6,46,12,2);
  } else {
    // 咲夜：银发 + 女仆装 + 环绕飞刀
    ctx.fillStyle='#e9ecf2';
    ctx.beginPath(); ctx.arc(0,6,16,0,TAU); ctx.fill();
    ctx.fillRect(-12,6,24,6);
    ctx.fillStyle=hit?'#fff':'#14161c';
    ctx.beginPath(); ctx.arc(0,-2,12,0,TAU); ctx.fill();
    ctx.fillStyle=hit?'#fff':'#f4f1ec';
    ctx.beginPath(); ctx.arc(0,-8,7,0,TAU); ctx.fill();
    ctx.fillStyle='#dfe3ea'; ctx.fillRect(-15,22,30,6);
    ctx.fillStyle='#14161c'; ctx.fillRect(-15,30,30,12);
    ctx.fillStyle='#f4f1ec'; ctx.fillRect(-15,34,30,3);
    // 飞刀环绕
    ctx.strokeStyle='#dfe8f2';
    for(let i=0;i<7;i++){
      const a=bossTick*2+i*(TAU/7);
      const kx=Math.cos(a)*34, ky=Math.sin(a)*34+bob;
      ctx.save(); ctx.translate(kx,ky); ctx.rotate(a+Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(1.4,3); ctx.lineTo(0,2); ctx.lineTo(-1.4,3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.translate(0,bob);
  ctx.restore();
}
function drawBossBar(){
  if(!bo||!bo.alive||bo.approach||bo.dying) return;
  const def=bo.phases[bo.phase];
  const w=300, x=(CVW-w)/2, y=16;
  ctx.fillStyle='rgba(4,10,20,0.55)';
  ctx.fillRect(x-4,y-14,w+8,26);
  ctx.fillStyle='#cfd8e8';
  ctx.font='13px "Microsoft YaHei",sans-serif';
  ctx.textAlign='center';
  ctx.fillText(def.name,x+w/2,y-2);
  const k=clamp(bo.hp/bo.hpMax,0,1);
  ctx.fillStyle='#1a2636'; ctx.fillRect(x,y+10,w,8);
  ctx.fillStyle=def.spell?'#ffd75e':'#c86a6a';
  ctx.fillRect(x,y+10,w*k,8);
  ctx.strokeStyle='#8fa6c8'; ctx.strokeRect(x-0.5,y+9.5,w+1,9);
  ctx.textAlign='left';
}
