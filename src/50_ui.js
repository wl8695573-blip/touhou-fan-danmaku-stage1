'use strict';
function drawPshots(){
  for(const b of pshots){
    ctx.fillStyle=b.color;
    ctx.globalAlpha=0.5;
    ctx.beginPath(); ctx.arc(b.x,b.y+6,b.r*0.6,0,TAU); ctx.fill();
    ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill();
  }
}
function drawEbul(){
  for(const b of ebul){
    const a=Math.atan2(b.vy,b.vx);
    if(b.kind==='i'){
      ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(a+Math.PI/2);
      ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(2.4,5); ctx.lineTo(-2.4,5); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if(b.kind==='k'){
      ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(a);
      ctx.fillStyle=b.color;
      ctx.fillRect(-5.5,-1.7,11,3.4);
      ctx.fillStyle='rgba(255,255,255,.75)';
      ctx.fillRect(-4.6,-0.8,7,1.6);
      ctx.restore();
    } else if(b.kind==='o'){
      ctx.fillStyle=b.color;
      ctx.globalAlpha=0.25; ctx.beginPath(); ctx.arc(b.x,b.y,b.r+2.6,0,TAU); ctx.fill();
      ctx.globalAlpha=1;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill();
    } else {
      ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(b.x-b.r*0.25,b.y-b.r*0.25,b.r*0.4,0,TAU); ctx.fill();
    }
  }
}
function drawItems(){
  for(const it of its){
    const tw=Math.sin(it.t*8+it.x)*1.5;
    if(it.kind==='p'){
      ctx.fillStyle='#ff5a6a';
      ctx.beginPath(); ctx.arc(it.x,it.y+tw,4.5,0,TAU); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('P',it.x,it.y+tw+3);
    } else {
      ctx.fillStyle='#ffd75e';
      ctx.save(); ctx.translate(it.x,it.y+tw); ctx.rotate(Math.sin(it.t*6)*0.4);
      ctx.beginPath();
      for(let k=0;k<10;k++){
        const r=k%2===0?5:2.2, a=k/10*TAU-Math.PI/2;
        k===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.textAlign='left';
}
function hudText(s,x,y,size,color,align){
  ctx.font=(size||16)+'px "Microsoft YaHei",sans-serif';
  ctx.textAlign=align||'left';
  ctx.lineWidth=3; ctx.strokeStyle='#000a'; ctx.strokeText(s,x,y);
  ctx.fillStyle=color||'#fff'; ctx.fillText(s,x,y);
  ctx.textAlign='left';
}
function drawHUD(){
  ctx.textAlign='left';
  hudText('得分 '+G.score.toLocaleString(),10,20,15,'#fff');
  hudText('HI '+G.hi.toLocaleString(),10,38,12,'#ffd75e');
  hudText('时间 '+Math.floor(G.t)+'s',10,56,11,'#9fd0ff');
  hudText('擦弹 '+G.graze,10,72,11,'#cfe0f5');
  // 残机
  ctx.font='11px "Microsoft YaHei",sans-serif';
  ctx.fillStyle='#dce8ff'; ctx.fillText('残机 x'+G.lives,CVW-74,20);
  ctx.fillStyle='#ffe27a'; ctx.fillText('灵符 x'+G.bombs,CVW-74,36);
  // 火力
  ctx.fillStyle='#dce8ff';
  ctx.fillText('火力 '+G.power+'/8',CVW-74,52);
  ctx.fillStyle='#ff9fae'; ctx.fillRect(CVW-86,58,Math.min(76,G.power/8*76),4);
  drawBossBar();
}
function banner(text,sub,dur,color){
  G.banner=text; G.bannerSub=sub||'';
  G.bannerT=dur||2; G.bannerDur=G.bannerT;
  G.bannerColor=color||'#fff';
}
function drawBanner(){
  if(!G.banner||G.bannerT<=0) return;
  G.bannerT-=1/60;
  const a=clamp(G.bannerT/0.4,0,1)*clamp((G.bannerDur-G.bannerT)/0.3,0,1);
  const pop=1+Math.max(0,(G.bannerT-G.bannerDur+0.25))*2;
  ctx.save();
  ctx.globalAlpha=a;
  ctx.translate(CVW/2,Math.round(CVH*0.35));
  ctx.scale(pop,pop);
  ctx.textAlign='center';
  ctx.font='bold 30px "Microsoft YaHei",sans-serif';
  ctx.lineWidth=5; ctx.strokeStyle='#000c';
  ctx.strokeText(G.banner,0,0);
  ctx.fillStyle=G.bannerColor||'#fff';
  ctx.fillText(G.banner,0,0);
  if(G.bannerSub){
    ctx.font='15px "Microsoft YaHei",sans-serif';
    ctx.lineWidth=4;
    ctx.strokeText(G.bannerSub,0,26);
    ctx.fillStyle='#eaf4ff'; ctx.fillText(G.bannerSub,0,26);
  }
  ctx.restore();
  ctx.textAlign='left';
}
let tcEl=null, bombBtn=null, bombN=null, pauseBtn=null, lastBombN=-1, lastTcShow=-1;
function initTc(){
  tcEl=document.getElementById('tc');
  bombBtn=document.getElementById('bBomb');
  bombN=document.getElementById('bBombN');
  pauseBtn=document.getElementById('bPauseT');
  if(bombBtn&&typeof bombBtn.addEventListener==='function'){
    bombBtn.addEventListener('pointerdown',e=>{
      e.preventDefault(); e.stopPropagation();
      try{ ensureAudio(); }catch(err){}
      tryBomb();
    });
  }
  if(pauseBtn&&typeof pauseBtn.addEventListener==='function'){
    pauseBtn.addEventListener('pointerdown',e=>{
      e.preventDefault(); e.stopPropagation();
      if(G.state==='play') uiPause();
    });
  }
}
function syncTc(){
  const show=TOUCH&&G.state==='play';
  if(tcEl&&show!==(lastTcShow===1)){
    tcEl.style.display=show?'':'none';
    lastTcShow=show?1:0;
  }
  if(TOUCH&&bombN&&G.bombs!==lastBombN){
    lastBombN=G.bombs;
    bombN.textContent='×'+G.bombs;
    if(bombBtn) bombBtn.classList.toggle('zero',G.bombs<=0);
  }
}
let lastT=0, rafId=0;
function frame(ts){
  rafId=requestAnimationFrame(frame);
  if(!lastT)lastT=ts;
  let dt=(ts-lastT)/1000; lastT=ts;
  if(dt>0.05)dt=0.05;
  G.frame++;
  if(G.state==='play') tick(dt);
  else if(G.state==='clear'||G.state==='over'){ tickBg(dt); }
  paint();
  syncTc();
}
function tickBg(dt){ skyMix(); bgT+=dt; }
function tick(dt){
  bgT+=dt;
  updateStage(dt);
  if(P.dead){ P.deadT-=dt; if(P.deadT<=0) respawnPlayer(); }
  else updatePlayer(dt);
  updatePshots(dt);
  updateEnemies(dt);
  updateEbul(dt);
  updateItems(dt);
  updateParticles(dt);
  updateBombFx(dt);
  checkLife();
  if((G.stage==='boss'||G.stage==='boss2')&&bo&&bo.alive&&bo.vulnerable) skyTo(SKY_BOSS);
  if(G.stage==='clear') skyTo(SKY_CLEAR);
}
function paint(){
  ctx.setTransform(SS,0,0,SS,0,0);
  drawBackground();
  if(G.state==='title'){
    // 标题下播放静谧的湖面（装饰星星飘动）
    ctx.fillStyle='rgba(160,190,220,.25)';
    ctx.fillText('雾之湖 · 星空下',20,CVH-30);
    return;
  }
  drawItems();
  for(const e of ens) drawEnemy(e);
  if(bo&&bo.alive) drawBoss();
  drawPshots();
  if(!P.dead&&G.state!=='clear') drawShip({c:G.char,x:P.x,y:P.y,scale:1,anim:P.anim,focus:P.focus});
  drawEbul();
  drawParticles();
  drawBombFx();
  if(G.state==='pause') ctx.fillStyle='rgba(2,6,14,.4)';
  drawHUD();
  drawBanner();
  // 低速文字提示
  if(P.focus&&!P.dead) hudText('SLOW',P.x-24,P.y+22,10,'#9fd0ff');
  // 触屏开局引导
  if(TOUCH&&G.state==='play'&&G.t<6&&!P.dead&&!P.focus){
    hudText('按住拖动移动 · 双指按住 = 低速',CVW/2,CVH-58,13,'#bcdcf5','center');
  }
}
const $=id=>document.getElementById(id);
const screens=['scn-title','scn-set','scn-pause','scn-over','scn-clear'];
function showScn(id){
  for(const s of screens) $(s).classList.toggle('hidden',s!==id);
}
let selChar='reimu';
const cardCvs={};
function buildCards(){
  const box=$('cards'); box.innerHTML='';
  for(const cid of Object.keys(CHARS)){
    const d=document.createElement('div');
    d.className='card'+(cid===selChar?' on':'');
    d.dataset.c=cid;
    const cv2=document.createElement('canvas'); cv2.width=220; cv2.height=340;
    d.appendChild(cv2);
    cardCvs[cid]=cv2;
    const n=document.createElement('div'); n.className='cname'; n.textContent=CHARS[cid].name; d.appendChild(n);
    const dd=document.createElement('div'); dd.className='cd'; dd.textContent=CHARS[cid].shot; d.appendChild(dd);
    d.addEventListener('click',()=>{ selChar=cid; sfx('select');
      for(const c of box.children) c.classList.toggle('on',c.dataset.c===cid);
      drawPortrait(cid,cv2.getContext('2d'));
    });
    box.appendChild(d);
    drawPortrait(cid,cv2.getContext('2d'));
  }
}
function redrawCard(cid){
  const cv2=cardCvs[cid];
  if(cv2) drawPortrait(cid,cv2.getContext('2d'));
}
function redrawAllCards(){
  for(const cid of Object.keys(CHARS)){
    try{ redrawCard(cid); }catch(e){}
  }
}
function uiStart(){
  try{ ensureAudio(); }catch(e){}
  sfx('start');
  touchReset();
  G.char=selChar;
  G.score=0; G.graze=0; G.lives=DIFF[cfg.diff].lives; G.bombs=DIFF[cfg.diff].bombs;
  G.power=0; G.t=0; G.freeze=0; G.over=false; G.flash=0;
  G.stage='field'; lifeNeed=50000;
  G.hi=Math.max(G.hi,Number(localStorage.getItem('ths_stg_hi')||0));
  clearEnts();
  P.x=240; P.y=CVH-90; P.dead=false; P.inv=2.0; P.focus=false; P.anim=0;
  skyTo(SKY_STAGE);
  initStageScript();
  bgmPlay('stage');
  showScn('none');
  G.state='play';
}
function uiPause(){
  if(G.state!=='play') return;
  G.state='pause';
  touchReset();
  if(AC&&AC.state==='running') AC.suspend();
  extPause();
  showScn('scn-pause');
}
function uiResume(){
  if(G.state!=='pause') return;
  G.state='play';
  try{ ensureAudio(); }catch(e){}
  extVol(); extPlay();
  showScn('none');
}
function uiQuit(){
  bgmStop();
  touchReset();
  if(AC) try{ AC.resume(); }catch(e){}
  showScn('scn-title');
  G.state='title';
  skyTo(SKY_STAGE);
  try{ ensureAudio(); }catch(e){}
  bgmPlay('title');
}
function uiRetry(){ uiStart(); }
function gameOver(msg){
  G.state='over';
  touchReset();
  bgmStop(); sfx('death');
  $('overMsg').textContent=msg||'「精疲力竭…」';
  $('overStat').innerHTML='<b>得分</b> '+G.score.toLocaleString()+'　<b>擦弹</b> '+G.graze+
    '　<b>关卡</b> '+Math.floor(G.t)+'s';
  showScn('scn-over');
}
function uiShowClear(){
  G.state='clear';
  touchReset();
  if(G.score>G.hi){ G.hi=G.score; }
  saveCfg();
  $('clearStat').innerHTML='<b>最终得分</b> '+G.score.toLocaleString()+'<br><b>擦弹</b> '+G.graze+
    '　<b>通关时间</b> '+Math.floor(G.t)+'s<br><b>使用角色</b> '+CHARS[G.char].name;
  showScn('scn-clear');
}
function bindSet(){
  const bind=(id,key,vid)=>{
    const el=$(id);
    el.value=cfg[key];
    $(vid).textContent=cfg[key];
    el.addEventListener('input',()=>{ cfg[key]=Number(el.value); $(vid).textContent=el.value;
      applyVolumes(); saveCfg(); });
  };
  bind('sMus','mus','vMus'); bind('sSfx','sfx','vSfx'); bind('sMst','mst','vMst');
  $('cHit').checked=cfg.hit!==false;
  $('cHit').addEventListener('change',()=>{ cfg.hit=$('cHit').checked; saveCfg(); });
  $('cVib').checked=cfg.vib!==false;
  $('cVib').addEventListener('change',()=>{ cfg.vib=$('cVib').checked; saveCfg(); });
  const syncDiff=()=>{
    for(const b of $('segDiff').children){
      b.classList.toggle('on',b.dataset.d===cfg.diff);
    }
  };
  syncDiff();
  for(const b of $('segDiff').children){
    b.addEventListener('click',()=>{ cfg.diff=b.dataset.d; syncDiff(); saveCfg(); sfx('select'); });
  }
  // 立绘显示（缩放/上下位置/完整显示）——实时刷新标题立绘卡
  const bindZoom=(id,key,vid,fmt)=>{
    const el=$(id);
    el.value=cfg[key];
    $(vid).textContent=fmt(cfg[key]);
    el.addEventListener('input',()=>{ cfg[key]=Number(el.value); $(vid).textContent=fmt(cfg[key]);
      saveCfg(); redrawAllCards(); });
  };
  bindZoom('sZoom','pzoom','vZoom',v=>v+'%');
  bindZoom('sPoff','poff','vPoff',v=>(v>0?'+':'')+v);
  $('cFit').checked=!!cfg.pfit;
  $('cFit').addEventListener('change',()=>{ cfg.pfit=$('cFit').checked; saveCfg(); redrawAllCards(); });
}
function bindPortButtons(){
  const fi=$('portFile');
  $('bPick').addEventListener('click',()=>{ sfx('select');
    if(fi&&fi.click) fi.click(); });
  $('bResetPort').addEventListener('click',()=>{ sfx('select'); resetCustomPortrait(selChar); });
  if(fi&&typeof fi.addEventListener==='function'){
    fi.addEventListener('change',()=>{
      const f=fi.files&&fi.files[0];
      if(!f) return;
      if(typeof FileReader==='undefined') return;
      try{
        const rd=new FileReader();
        rd.onload=()=>{
          const src=String(rd.result||'');
          if(!src) return;
          imgFromSrc(src,im=>{
            if(im){ PORT_IMG[selChar]=im; redrawCard(selChar); storeCustomPortrait(selChar,src); }
          });
        };
        rd.readAsDataURL(f);
      }catch(e){}
    });
  }
}
function bindUI(){
  $('bStart').addEventListener('click',uiStart);
  $('bSet').addEventListener('click',()=>{ sfx('select'); showScn('scn-set'); });
  $('bHelp').addEventListener('click',()=>{ sfx('select');
    $('helpBox').classList.toggle('hidden'); });
  $('bSetBack').addEventListener('click',()=>{ sfx('select');
    showScn(G.state==='pause'?'scn-pause':'scn-title'); });
  $('bPauseSet').addEventListener('click',()=>{ sfx('select'); showScn('scn-set'); });
  $('bResume').addEventListener('click',uiResume);
  $('bRetry').addEventListener('click',()=>{ try{ ensureAudio(); }catch(e){} uiStart(); });
  $('bQuit').addEventListener('click',uiQuit);
  $('bRetry2').addEventListener('click',()=>{ try{ ensureAudio(); }catch(e){} uiStart(); });
  $('bQuit2').addEventListener('click',uiQuit);
  $('bAgain').addEventListener('click',()=>{ try{ ensureAudio(); }catch(e){} uiStart(); });
  $('bQuit3').addEventListener('click',uiQuit);
}
let sizeTimer=0;
function boot(){
  applySize();
  G.hi=Number(localStorage.getItem('ths_stg_hi')||0);
  buildCards();
  bindUI();
  bindSet();
  bindPortButtons();
  initTc();
  showScn('scn-title');
  loadPortraitSources();
  probeExtBgm();
  try{
    if(typeof window!=='undefined'&&window.addEventListener){
      window.addEventListener('resize',()=>{ clearTimeout(sizeTimer); sizeTimer=setTimeout(applySize,120); });
      window.addEventListener('orientationchange',()=>{ setTimeout(applySize,150); });
    }
    if(document&&document.addEventListener){
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden&&G.state==='play') uiPause();
      });
    }
  }catch(e){}
  requestAnimationFrame(t=>{ lastT=t; rafId=requestAnimationFrame(frame); });
}
boot();
