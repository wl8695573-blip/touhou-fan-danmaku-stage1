'use strict';
// TODO: 超宽屏上触屏按钮位置有点挤,回头按宽度比例算
const cv=document.getElementById('cv');
const ctx=cv.getContext('2d');
const wrap=document.getElementById('wrap');
const keys={};
const pressed={};
const LK={
  up:['KeyW','ArrowUp'], down:['KeyS','ArrowDown'],
  left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'],
  fire:['KeyZ','KeyJ'], bomb:['KeyX','KeyK'],
  focus:['ShiftLeft','ShiftRight'],
};
addEventListener('keydown',e=>{
  titleBgmTry();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if(!keys[e.code]) pressed[e.code]=true;
  keys[e.code]=true;
  if((e.code==='Escape'||e.code==='KeyP') && G.state==='play') uiPause();
  else if((e.code==='Escape'||e.code==='KeyP') && G.state==='pause') uiResume();
});
addEventListener('keyup',e=>{ keys[e.code]=false; });
function held(name){
  const list=LK[name]; if(!list) return false;
  for(const c of list){ if(keys[c]) return true; }
  return false;
}
function consumePressed(name){
  const list=LK[name]; if(!list) return false;
  for(const c of list){ if(pressed[c]){ pressed[c]=false; return true; } }
  return false;
}
function vib(ms){
  if(!TOUCH||!cfg.vib) return;
  try{ if(typeof navigator!=='undefined'&&navigator.vibrate) navigator.vibrate(ms); }catch(e){}
}

let stars=[];
function genStars(){
  stars.length=0;
  for(let i=0;i<70;i++) stars.push({x:Math.random()*CVW,y:Math.random()*CVH*0.75,r:Math.random()*1.3+0.3,tw:Math.random()*6});
}
function detectTouch(){
  try{
    if(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches) return true;
  }catch(e){}
  try{
    if(typeof window!=='undefined'&&window!==null&&'ontouchstart' in window) return true;
  }catch(e){}
  return false;
}
function layoutCanvas(){
  let dispW=480;
  if(typeof window!=='undefined'&&window.innerWidth) dispW=window.innerWidth;
  if(wrap&&typeof wrap.clientWidth==='number'&&wrap.clientWidth>0) dispW=wrap.clientWidth;
  const dpr=(typeof window!=='undefined'&&window.devicePixelRatio)||1;
  SS=Math.max(1,Math.min(PORTRAIT?2.6:3,(dispW*dpr)/CVW));
  if(cv){
    cv.width=Math.max(1,Math.round(CVW*SS));
    cv.height=Math.max(1,Math.round(CVH*SS));
  }
}
function applySize(){
  let iw=480, ih=640;
  if(typeof window!=='undefined'&&window!==null&&window.innerWidth){ iw=window.innerWidth; ih=window.innerHeight; }
  PORTRAIT=ih>iw*1.02;
  TOUCH=detectTouch();
  try{ document.body.classList.toggle('port',PORTRAIT); document.body.classList.toggle('land',!PORTRAIT); }catch(e){}
  const newH=PORTRAIT?clamp(Math.round(480*ih/Math.max(iw,1)),640,1152):640;
  if(newH!==CVH){ CVH=newH; genStars(); }
  layoutCanvas();
}
applySize();

function touchReset(){ touch.act=false; touch.id=-1; touch.focus=false; tids.clear(); }
function ptFromClient(cx,cy){
  try{
    if(cv.getBoundingClientRect){
      const r=cv.getBoundingClientRect();
      if(r&&r.width&&r.height) return {x:(cx-r.left)/r.width*CVW, y:(cy-r.top)/r.height*CVH};
    }
  }catch(e){}
  return {x:cx,y:cy};
}
function grabTarget(p){
  touch.x=clamp(p.x,8,CVW-8); touch.y=clamp(p.y,40,CVH-16);
}
function tDown(ev){
  titleBgmTry();
  if(G.state!=='play') return;
  if(ev.target&&ev.target.closest&&ev.target.closest('.tc,.btn,.card,label,input,select,button')) return;
  if(ev.pointerType==='mouse'&&ev.button!==0) return;
  try{ ensureAudio(); }catch(e){}
  const id=(ev.pointerId!=null)?ev.pointerId:1;
  const p=ptFromClient(ev.clientX||0,ev.clientY||0);
  if(!touch.act){
    touch.act=true; touch.id=id; tids.clear(); tids.add(id);
    grabTarget(p);
    const d=Math.hypot(touch.x-P.x,touch.y-P.y);
    if(d>150&&P.inv<0.3) P.inv=Math.max(P.inv,0.3);   // 远距离瞬移给一点保护
  } else {
    if(!tids.has(id)) tids.add(id);
    touch.focus=tids.size>1;
  }
  try{ if(wrap&&wrap.setPointerCapture&&ev.pointerId!=null) wrap.setPointerCapture(ev.pointerId); }catch(e){}
}
function tMove(ev){
  if(!touch.act||ev.pointerId!==touch.id) return;
  grabTarget(ptFromClient(ev.clientX||0,ev.clientY||0));
}
function tUp(ev){
  const id=(ev.pointerId!=null)?ev.pointerId:1;
  tids.delete(id);
  if(id===touch.id){ touch.act=false; touch.id=-1; touch.focus=false; }
  else { touch.focus=tids.size>1&&touch.act; }
}
if(wrap&&typeof wrap.addEventListener==='function'){
  wrap.addEventListener('pointerdown',tDown,{passive:true});
  wrap.addEventListener('pointermove',tMove,{passive:true});
  wrap.addEventListener('pointerup',tUp,{passive:true});
  wrap.addEventListener('pointercancel',tUp,{passive:true});
}

const SKY_STAGE={top:[3,9,24],bot:[16,40,74],moon:[244,236,208]};
const SKY_BOSS={top:[28,5,26],bot:[88,18,52],moon:[255,223,159]};
const SKY_CLEAR={top:[4,12,22],bot:[20,60,70],moon:[240,240,230]};
let skyNow=SKY_STAGE, skyFrom=SKY_STAGE, skyT=1;
function skyTo(dst){ if(dst!==skyNow){ skyFrom=skyNow; skyNow=dst; skyT=0; } }
function skyMix(){ skyT=Math.min(1,skyT+0.012); }
function skyRGB(key){
  const a=skyFrom[key], b=skyNow[key], t=skyT;
  return 'rgb('+(a[0]+(b[0]-a[0])*t|0)+','+(a[1]+(b[1]-a[1])*t|0)+','+(a[2]+(b[2]-a[2])*t|0)+')';
}
let bgT=0;
function drawBackground(){
  bgT+=1/60;
  skyMix();
  ctx.fillStyle=skyRGB('top');
  ctx.fillRect(0,0,CVW,CVH);
  const g=ctx.createLinearGradient(0,0,0,CVH);
  g.addColorStop(0,skyRGB('top')); g.addColorStop(1,skyRGB('bot'));
  ctx.fillStyle=g; ctx.fillRect(0,0,CVW,CVH);
  // 月亮
  ctx.fillStyle='rgb('+skyNow.moon.join(',')+')';
  ctx.beginPath(); ctx.arc(398,86,30,0,TAU); ctx.fill();
  ctx.fillStyle='#00000022';
  ctx.beginPath(); ctx.arc(394,80,26,0,TAU); ctx.fill();
  // 星
  for(const s of stars){
    ctx.globalAlpha=0.3+0.7*Math.abs(Math.sin(bgT*s.tw+s.x));
    ctx.fillStyle='#dfe8ff';
    ctx.fillRect(s.x,s.y,s.r,s.r);
  }
  ctx.globalAlpha=1;
  // 湖面与反光（随屏高靠下）
  const hor=CVH-170;
  ctx.fillStyle='#06131f';
  ctx.fillRect(0,hor,CVW,CVH-hor);
  ctx.fillStyle='#0c2240';
  for(let i=0;i<6;i++){
    ctx.globalAlpha=0.35+0.2*Math.sin(bgT*0.7+i);
    ctx.fillRect(0,hor+10+i*26,CVW,5);
  }
  ctx.globalAlpha=1;
  // 雾
  ctx.fillStyle='#9fbcd9';
  ctx.globalAlpha=0.10+0.04*Math.sin(bgT*0.8);
  ctx.beginPath(); ctx.ellipse(120,hor-20,200,16,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(340,hor-40,180,14,0,0,TAU); ctx.fill();
  ctx.globalAlpha=1;
  // 时停特效
  if(G.freeze>0){
    ctx.fillStyle='rgba(220,235,255,'+(0.05+0.05*Math.sin(bgT*10))+')';
    ctx.fillRect(0,0,CVW,CVH);
  }
}

function drawShip(opt){
  const ch=CHARS[opt.c]; const s=opt.scale||1;
  ctx.save();
  ctx.translate(opt.x,opt.y);
  const bob=Math.sin(opt.anim*10)*1.2*s;
  // 兜底光晕（弹幕中易辨识）
  ctx.fillStyle='rgba(255,255,255,.06)';
  ctx.beginPath(); ctx.arc(0,0,21*s,0,TAU); ctx.fill();
  ctx.fillStyle=ch.hair;
  ctx.beginPath(); ctx.ellipse(0,-20*s+bob,11*s,15*s,0,0,TAU); ctx.fill();
  // 头饰特征（小模型上的识别点）
  if(opt.c==='marisa'){
    ctx.fillStyle=ch.outfit;
    ctx.beginPath(); ctx.ellipse(0,-34*s+bob,12*s,4*s,0,0,TAU); ctx.fill();   // 帽沿
    ctx.fillStyle='#e8e4da';
    ctx.fillRect(-10*s,-33*s+bob,20*s,2*s);                                    // 帽带
  } else if(opt.c==='sanae'){
    ctx.fillStyle='#ffffff';
    ctx.beginPath(); ctx.arc(-8*s,-27*s+bob,1.8*s,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8*s,-27*s+bob,1.8*s,0,TAU); ctx.fill();            // 蛙发饰
  } else {
    ctx.fillStyle=ch.ribbon||ch.outfit;
    ctx.beginPath(); ctx.arc(0,-34*s+bob,4*s,0,TAU); ctx.fill();
    ctx.fillStyle=ch.ribbon||ch.outfit;
    ctx.fillRect(-5*s,-37*s+bob,10*s,3*s);
  }
  ctx.fillStyle=ch.outfit;
  ctx.fillRect(-9*s,-7*s+bob,18*s,14*s);
  ctx.fillStyle=ch.outfit2;
  ctx.fillRect(-9*s,-7*s+bob,18*s,5*s);
  // 两侧白袖/手
  ctx.fillStyle=ch.outfit2;
  ctx.beginPath(); ctx.ellipse(-13*s,2*s+bob,3.4*s,4*s,-0.4,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13*s,2*s+bob,3.4*s,4*s,0.4,0,TAU); ctx.fill();
  ctx.fillStyle=ch.hair;
  ctx.fillRect(-12*s,-12*s+bob,3.5*s,10*s);
  ctx.fillRect(8.5*s,-12*s+bob,3.5*s,10*s);
  // 身后的大蝴蝶结（灵梦）
  if(opt.c==='reimu'){
    ctx.fillStyle='#e63946';
    ctx.beginPath();
    ctx.moveTo(0,10*s+bob); ctx.lineTo(-8*s,4*s+bob); ctx.lineTo(-2*s,2*s+bob);
    ctx.moveTo(0,10*s+bob); ctx.lineTo(8*s,4*s+bob); ctx.lineTo(2*s,2*s+bob);
    ctx.fill();
    ctx.beginPath(); ctx.arc(0,6*s+bob,2*s,0,TAU); ctx.fill();
  }
  ctx.fillStyle=ch.ribbon||ch.outfit;
  ctx.beginPath(); ctx.arc(0,-9*s+bob,2.6*s,0,TAU); ctx.fill();
  ctx.restore();
  // 判定显示
  if(opt.focus){
    ctx.strokeStyle='#fff8';
    ctx.beginPath(); ctx.arc(opt.x,opt.y+2*s,9*s,0,TAU); ctx.stroke();
    ctx.fillStyle='#ff5050';
    ctx.beginPath(); ctx.arc(opt.x,opt.y+2*s,1.8*s,0,TAU); ctx.fill();
  } else if(TOUCH&&cfg.hit){
    ctx.fillStyle='#ff5050';
    ctx.beginPath(); ctx.arc(opt.x,opt.y+2*s,1.8*s,0,TAU); ctx.fill();
  }
}

const PORT_IMG={};
const PORT={
  reimu:{skin:'#ffe4ce',hair:'#7c3028',eye:'#b52f26',torso:'#e63946',collar:'#f7f0ea'},
  marisa:{skin:'#ffe8d2',hair:'#e3b84f',eye:'#c78f1c',torso:'#25262e',collar:'#f4f1ec'},
  sanae:{skin:'#ffe6cf',hair:'#2fb39a',eye:'#17806e',torso:'#2f9e8f',collar:'#f2f7f0'},
};
function portZoom(){ return clamp((cfg.pzoom!=null?cfg.pzoom:100)/100,0.3,2.5); }
function portOff(){ return clamp(cfg.poff||0,-60,60)/100; }
/* 立绘来源：localStorage 本机选图 > chars/ 文件夹 > 程序绘制 */
function imgFromSrc(src,onOK){
  if(typeof Image==='undefined') return;
  try{
    const im=new Image();
    im.onload=()=>{ if(onOK) onOK(im); };
    im.onerror=()=>{ if(onOK) onOK(null); };
    im.src=src;
  }catch(e){ if(onOK) onOK(null); }
}
function loadCustomPortrait(cid,onOK){
  if(typeof Image==='undefined') return;
  const exts=['png','jpg','jpeg','webp'];
  let k=0;
  const next=()=>{
    if(k>=exts.length){ if(onOK) onOK(null); return; }
    imgFromSrc('chars/'+cid+'.'+exts[k++],im=>{
      if(im){ PORT_IMG[cid]=im; if(onOK) onOK(im); }
      else next();
    });
  };
  next();
}
function storedPortMap(){
  try{ const raw=localStorage.getItem('ths_stg_port');
    if(raw){ const m=JSON.parse(raw); if(m&&typeof m==='object') return m; }
  }catch(e){}
  return {};
}
function storeCustomPortrait(cid,src){
  try{
    const m=storedPortMap(); m[cid]=src;
    if(JSON.stringify(m).length<2500000) localStorage.setItem('ths_stg_port',JSON.stringify(m));
  }catch(e){}
}
function resetCustomPortrait(cid){
  try{
    const m=storedPortMap();
    if(m[cid]){ delete m[cid]; localStorage.setItem('ths_stg_port',JSON.stringify(m)); }
  }catch(e){}
  delete PORT_IMG[cid];
  loadCustomPortrait(cid,()=>{ redrawCard(cid); });
}
function loadPortraitSources(){
  const st=storedPortMap();
  for(const cid of Object.keys(CHARS)){
    if(st[cid]){
      imgFromSrc(st[cid],im=>{ if(im){ PORT_IMG[cid]=im; redrawCard(cid); } });
    } else {
      loadCustomPortrait(cid,im=>{ if(im) redrawCard(cid); });
    }
  }
}
function drawCustomPortrait(cid,c2){
  const img=PORT_IMG[cid];
  const w=c2.canvas.width, h=c2.canvas.height;
  if(!img||!img.width) return;
  const Z=portZoom(), poff=portOff();
  const ir=img.width/img.height, dr=w/h;
  let sw,sh,sx,sy;
  let scale;
  if(cfg.pfit){
    // 完整显示（整图装入，四周留边）
    scale=Math.min(w/img.width,h/img.height)*Z;
  } else {
    // 默认：裁切填满（cover）后按缩放比例放大/缩小
    const s0=Math.max(w/img.width,h/img.height);
    scale=s0*Z;
  }
  sw=img.width*scale; sh=img.height*scale;
  sx=(w-sw)/2; sy=(h-sh)/2+poff*h;
  c2.drawImage(img,0,0,img.width,img.height,sx,sy,sw,sh);
}
function drawPortrait(cid,c2){
  if(PORT_IMG[cid]){ drawCustomPortrait(cid,c2); return; }
  const ch=PORT[cid]||PORT.reimu;
  const w=c2.canvas.width, h=c2.canvas.height;
  const bg=c2.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#14355f'); bg.addColorStop(1,'#081527');
  c2.fillStyle=bg; c2.fillRect(0,0,w,h);
  // 头部后方光晕
  try{
    const rg=c2.createRadialGradient(w/2,h*0.4,8,w/2,h*0.4,h*0.52);
    rg.addColorStop(0,'rgba(140,190,255,.20)'); rg.addColorStop(1,'rgba(140,190,255,0)');
    c2.fillStyle=rg; c2.fillRect(0,0,w,h);
  }catch(e){}
  const Z=portZoom(), poff=portOff();
  const u=Math.min(w/220,h/340)*Z;
  c2.save();
  c2.translate(w/2,h/2+poff*h);
  c2.scale(u,u);
  c2.translate(-110,-170);
  const X=110, skin=ch.skin, hair=ch.hair, eye=ch.eye, torso=ch.torso, collar=ch.collar;
  const darkEye='#2b1a17';
  // 后发（大盘发）
  c2.fillStyle=hair;
  c2.beginPath(); c2.ellipse(X,132,62,88,0,0,TAU); c2.fill();
  // 脖子
  c2.fillStyle=skin;
  c2.fillRect(X-11,198,22,34);
  // 躯干（梯形 + 裁剪画领口/衣摆）
  c2.save();
  c2.beginPath();
  c2.moveTo(35,340); c2.lineTo(58,250); c2.quadraticCurveTo(X,226,162,250); c2.lineTo(185,340); c2.closePath();
  c2.clip();
  c2.fillStyle=torso; c2.fillRect(0,220,220,120);
  if(cid==='reimu'){
    // 白衣领与胸口红结
    c2.fillStyle=collar;
    c2.beginPath(); c2.moveTo(X-6,208); c2.lineTo(48,258); c2.lineTo(84,272); c2.lineTo(X-4,246); c2.closePath(); c2.fill();
    c2.beginPath(); c2.moveTo(X+6,208); c2.lineTo(172,258); c2.lineTo(136,272); c2.lineTo(X+4,246); c2.closePath(); c2.fill();
    c2.fillStyle='#e63946';
    c2.beginPath(); c2.ellipse(X-9,276,8,6,0,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X+9,276,8,6,0,0,TAU); c2.fill();
    c2.fillRect(X-3.5,268,7,12);
    c2.fillStyle='#ff5a6a'; c2.beginPath(); c2.ellipse(X-9,274,3.4,2.4,0,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X+9,274,3.4,2.4,0,0,TAU); c2.fill();
  } else if(cid==='marisa'){
    // 白色衬衫 + 深色马甲 + 底部白边
    c2.fillStyle=collar;
    c2.beginPath(); c2.moveTo(X-10,206); c2.lineTo(84,252); c2.lineTo(X,296); c2.lineTo(136,252); c2.closePath(); c2.fill();
    c2.fillStyle='#c9302e';
    c2.beginPath(); c2.ellipse(X,214,7,5,0,0,TAU); c2.fill();       // 领结
    c2.beginPath(); c2.ellipse(X-13,212,5.5,3.5,-0.6,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X+13,212,5.5,3.5,0.6,0,TAU); c2.fill();
    c2.fillStyle='#3f3c30';
    for(const gx of [96,110,124]){ c2.fillRect(gx-1.5,262,3,3); }
  } else {
    // 早苗：浅色水手领 + 白边
    c2.fillStyle=collar;
    c2.beginPath(); c2.moveTo(X-8,206); c2.lineTo(50,262); c2.lineTo(86,274); c2.lineTo(X,238); c2.closePath(); c2.fill();
    c2.beginPath(); c2.moveTo(X+8,206); c2.lineTo(170,262); c2.lineTo(134,274); c2.lineTo(X,238); c2.closePath(); c2.fill();
    c2.fillStyle='#7ce0c8';
    c2.beginPath(); c2.arc(X,272,5,0,TAU); c2.fill();
  }
  c2.fillStyle=collar;
  c2.fillRect(0,330,220,10);   // 底部衣摆白边（裁剪范围内）
  c2.restore();
  // 侧发（垂在胸前/肩侧）
  c2.fillStyle=hair;
  if(cid==='sanae'){
    c2.beginPath(); c2.ellipse(X-60,196,11,104,0,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X+60,196,11,104,0,0,TAU); c2.fill();
    c2.fillStyle='#f2f7f0';
    for(const sx of[X-60,X+60]){
      c2.beginPath(); c2.ellipse(sx-6,224,6,4,0,0,TAU); c2.fill();
      c2.beginPath(); c2.ellipse(sx+6,224,6,4,0,0,TAU); c2.fill();
      c2.fillRect(sx-1.8,214,3.6,12);
    }
  } else {
    c2.beginPath(); c2.ellipse(X-63,192,10,96,0,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X+63,192,10,96,0,0,TAU); c2.fill();
  }
  // 脸
  c2.fillStyle=skin;
  c2.beginPath(); c2.ellipse(X,146,46,54,0,0,TAU); c2.fill();
  // 腮红
  c2.fillStyle='rgba(255,140,140,.22)';
  c2.beginPath(); c2.ellipse(X-34,180,8,4,0,0,TAU); c2.fill();
  c2.beginPath(); c2.ellipse(X+34,180,8,4,0,0,TAU); c2.fill();
  // 眉
  c2.strokeStyle=hair; c2.lineWidth=2.6; c2.lineCap='round';
  for(const s of[-1,1]){
    c2.beginPath(); c2.moveTo(X+s*13,128); c2.quadraticCurveTo(X+s*22,122,X+s*31,128); c2.stroke();
  }
  // 眼
  for(const s of[-1,1]){
    const ex=X+s*21;
    c2.fillStyle=eye;
    c2.beginPath(); c2.ellipse(ex,158,9.6,11.5,0,0,TAU); c2.fill();
    c2.fillStyle='rgba(20,10,16,.28)';           // 上眼睑影
    c2.beginPath(); c2.ellipse(ex,153,9.6,6.2,0,0,Math.PI); c2.fill();
    c2.strokeStyle=darkEye; c2.lineWidth=1.6;
    c2.beginPath(); c2.ellipse(ex,158,9.6,11.5,0,0,TAU); c2.stroke();
    c2.fillStyle='#fff';
    c2.beginPath(); c2.arc(ex-3.4,153.5,2.9,0,TAU); c2.fill();
    c2.beginPath(); c2.arc(ex+4,164.5,1.5,0,TAU); c2.fill();
  }
  // 嘴
  c2.strokeStyle='#c96a5c'; c2.lineWidth=2.2; c2.lineCap='round';
  if(cid==='marisa'){
    c2.beginPath(); c2.arc(X,181,7,0.25*Math.PI,0.75*Math.PI); c2.stroke();
  } else {
    c2.beginPath(); c2.moveTo(X-5,184); c2.quadraticCurveTo(X,189,X+5,184); c2.stroke();
  }
  // 刘海（顶部发包 + 弧线锁发）
  c2.fillStyle=hair;
  c2.beginPath(); c2.ellipse(X,88,56,44,0,0,TAU); c2.fill();
  const tips=[{x:-50,y:124},{x:-36,y:130},{x:-22,y:132},{x:-8,y:128},{x:8,y:128},{x:22,y:132},{x:36,y:130},{x:50,y:124}];
  for(const t of tips){
    c2.beginPath(); c2.ellipse(X+t.x,t.y-26,9.6,28,0,0,TAU); c2.fill();
  }
  // 角色发饰
  if(cid==='reimu'){
    // 右侧红发带结
    c2.fillStyle='#e63946';
    c2.beginPath(); c2.ellipse(X+44,108,9,6,-0.3,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X+56,112,9,6,0.3,0,TAU); c2.fill();
    c2.beginPath(); c2.arc(X+50,110,3.2,0,TAU); c2.fill();
  } else if(cid==='marisa'){
    // 魔女帽：宽沿 + 高冠 + 白带（画在刘海之上）
    c2.fillStyle='#2b2b33';
    c2.beginPath(); c2.ellipse(X,96,79,17,0,0,TAU); c2.fill();
    c2.beginPath(); c2.ellipse(X,48,35,46,0,0,TAU); c2.fill();
    c2.save();
    c2.beginPath(); c2.ellipse(X,50,35,44,0,0,TAU); c2.clip();
    c2.fillStyle='#efe9dd';
    c2.fillRect(X-36,66,72,9);
    c2.restore();
    c2.fillStyle='#d8b24a';
    c2.beginPath(); c2.arc(X,30,4.4,0,TAU); c2.fill();
    c2.fillStyle='#2b2b33';
    c2.fillRect(X-3,12,6,16);
  } else {
    // 早苗：两只白色蛙发饰
    for(const fx of[X-22,X+6]){
      c2.fillStyle='#f7fbf7';
      c2.beginPath(); c2.ellipse(fx,100,8,6,0,0,TAU); c2.fill();
      c2.fillStyle='#232323';
      c2.beginPath(); c2.arc(fx-3,98.5,1.4,0,TAU); c2.fill();
      c2.beginPath(); c2.arc(fx+3,98.5,1.4,0,TAU); c2.fill();
    }
  }
  c2.restore();
}

let pshots=[], ebul=[], ens=[], its=[], pts=[];
let bo=null;
let bombsFx=[];
function clearEnts(){ pshots=[]; ebul=[]; ens=[]; its=[]; pts=[]; bo=null; bombsFx=[]; }

function dropItem(x,y,kind,vx,vy){
  if(its.length>260) return;
  its.push({x,y,vx:vx||0,vy:vy||(kind==='p'?60:50),kind,t:0,dead:false,g:0});
}
function showerItems(x,y,n){
  for(let i=0;i<n;i++){
    const a=Math.PI*0.7+Math.random()*Math.PI*0.6;
    const sp=rnd(160,340);
    its.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-240,kind:Math.random()<0.85?'s':'p',t:0,dead:false,g:920});
  }
}
function sparks(x,y,color,n,spd){
  for(let i=0;i<n;i++){
    const a=Math.random()*TAU, sp=rnd(20,spd||140);
    pts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,dur:rnd(0.2,0.5),color,r:rnd(1.5,3.5),dead:false,g:0});
  }
}
function ringFx(x,y,color,spd,r,n){
  for(let i=0;i<n;i++){
    const a=i/n*TAU;
    pts.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,t:0,dur:0.55,color,r,dead:false,g:0});
  }
}
function eSpawn(x,y,vx,vy,r,color,kind){
  if(ebul.length>2400) return;
  ebul.push({x,y,vx,vy,r,color,kind:kind||'c',t:0,dead:false,grazed:false,frozen:false,fx:0,fy:0});
}
function ring(x,y,n,spd,color,r,kind,spin){
  for(let i=0;i<n;i++){
    const a=(spin||0)+i*(TAU/n);
    eSpawn(x,y,Math.cos(a)*spd,Math.sin(a)*spd,r,color,kind);
  }
}
function fan(x,y,n,spread,aim,spd,color,r,kind){
  for(let i=0;i<n;i++){
    const off=(n===1?0:(i/(n-1)-0.5))*spread;
    const a=aim+off;
    eSpawn(x,y,Math.cos(a)*spd,Math.sin(a)*spd,r,color,kind);
  }
}
function aimed(x,y,spd,color,r,kind,n,spread){
  const a=angTo(x,y,P.x,P.y+4);
  fan(x,y,n||1,spread||0,a,spd,color,r,kind);
}
function freezeBullets(dur){
  G.freeze=dur;
  for(const b of ebul){
    if(!b.frozen){ b.frozen=true; b.fx=b.vx; b.fy=b.vy; b.vx=0; b.vy=0; }
  }
}
function unfreezeBullets(){
  for(const b of ebul){
    if(b.frozen){ b.frozen=false; b.vx=b.fx; b.vy=b.fy; }
  }
}
function addFairiesLine(n,color,aim){
  for(let i=0;i<n;i++){
    const nx=60+(420-60)*(n===1?0.5:i/(n-1));
    ens.push({kind:'fairy',x:nx+rnd(-6,6),y:-24-rnd(0,50),hp:aim?5:3,
      arriveY:rnd(80,150),t:rnd(0,2),fireT:rnd(1.2,2.2),color,
      shot:aim?1:0,drop:true,dead:false,leaveAt:null,r:8});
  }
}
function addFairySides(n,color){
  for(let i=0;i<n;i++){
    const side=i%2===0?-1:1;
    ens.push({kind:'fairy',x:side>0?CVW+20:-20,y:rnd(60,170),hp:4,arriveY:null,
      dir:side,t:rnd(0,2),fireT:1,color,shot:1,drop:true,dead:false,leaveAt:null,r:8});
  }
}
function updateEnemies(dt){
  for(let i=ens.length-1;i>=0;i--){
    const e=ens[i];
    e.t+=dt;
    if(e.hitT>0)e.hitT-=dt;
    if(e.kind!=='fairy') continue;
    if(e.arriveY!=null){
      if(e.y<e.arriveY){ e.y+=dt*(70+rnd(0,20)); }
      else {
        if(!e.leaveAt) e.leaveAt=e.t+rnd(5,9);
        e.fireT-=dt;
        if(e.t>e.leaveAt){
          e.y+=dt*130; e.x+=Math.sin(e.t*2)*dt*50;
          if(e.y>CVH+40) e.dead=true;
        } else if(e.fireT<=0&&!G.over){
          e.fireT=rnd(1.5,2.4);
          aimed(e.x,e.y+10,rnd(110,150)*diffMul(),'#ffd0d0',3.4,'c',1,0);
          if(e.shot) ring(e.x,e.y+10,Math.max(4,Math.round(6*diffCnt())),92*diffMul(),'#ffa8c8',3.2,'c',0);
        }
      }
    } else {
      e.x+=e.dir*dt*(120+Math.sin(e.t*3)*24);
      e.fireT-=dt;
      if(e.fireT<=0&&e.x>24&&e.x<CVW-24){ e.fireT=rnd(2.2,3); aimed(e.x,e.y,rnd(120,150)*diffMul(),'#ffd0d0',3.4,'c',1,0); }
      if((e.dir>0&&e.x>CVW+30)||(e.dir<0&&e.x<-30)) e.dead=true;
    }
  }
  ens=ens.filter(e=>!e.dead);
}
function drawEnemy(e){
  ctx.save(); ctx.translate(e.x,e.y);
  const flap=Math.sin(e.t*12);
  ctx.fillStyle='#ffffff44';
  ctx.beginPath(); ctx.ellipse(-11,0,8,3.4,0.5+flap*0.2,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11,0,8,3.4,-0.5-flap*0.2,0,TAU); ctx.fill();
  if(e.hitT>0){ ctx.globalAlpha=0.8; }
  ctx.fillStyle=e.color||'#fff';
  ctx.beginPath(); ctx.arc(0,0,7,0,TAU); ctx.fill();
  ctx.fillStyle='#ffe4c9';
  ctx.beginPath(); ctx.arc(0,-2,3.6,0,TAU); ctx.fill();
  ctx.fillStyle='#203040';
  ctx.fillRect(-3,5,6,4);
  ctx.globalAlpha=1;
  ctx.restore();
}
