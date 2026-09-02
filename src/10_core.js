'use strict';
const CVW = 480;           // 逻辑宽恒定
let CVH = 640;             // 逻辑高：横屏固定 640；手机竖屏按屏比放大(640~1152)
let SS = 1;                // 渲染超采样倍率（清晰度）
let TOUCH = false;         // 触屏模式：拖动即移动 + 自动射击
let PORTRAIT = false;      // 竖屏布局
let touch = { act:false, id:-1, x:240, y:CVH-90, focus:false };
const tids = new Set();

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const rndi=(a,b)=>Math.floor(rnd(a,b+1));
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const TAU=Math.PI*2;
function angTo(ax,ay,bx,by){return Math.atan2(by-ay,bx-ax);}

const G={
  state:'title',        // title|play|pause|over|clear
  char:'reimu',
  t:0,                  // 关卡内时间(秒)
  score:0, hi:0, lives:0, bombs:0, power:0, graze:0,
  stage:'intro',        // intro|field|midboss|field2|boss|clear
  phaseT:0,
  frame:0,
  over:false, flash:0, shake:0,
  freeze:0,             // 时停剩余
  events:[],            // 预排事件 {at, fn}
  spellName:'', spellSub:'', spellT:0, spellDur:0,
  banner:'', bannerSub:'', bannerT:0, bannerDur:0,
  msg:'', msgT:0,
  overReason:'',
};
const P={x:240,y:560,spd:4.6,focus:false,inv:2.5,fireT:0,anim:0,dead:false,deadT:0};
let cfg=loadCfg();

function loadCfg(){
  try{ const raw=localStorage.getItem('ths_stg_cfg');
    if(raw){ const o=JSON.parse(raw);
      return Object.assign({mus:60,sfx:80,mst:90,diff:'normal',hit:true,vib:true,pzoom:100,poff:0,pfit:false},o);
    }
  }catch(e){}
  return {mus:60,sfx:80,mst:90,diff:'normal',hit:true,vib:true,pzoom:100,poff:0,pfit:false};
}
function saveCfg(){
  try{ localStorage.setItem('ths_stg_cfg',JSON.stringify(cfg)); }catch(e){}
  try{ localStorage.setItem('ths_stg_hi',String(G.hi)); }catch(e){}
}

const DIFF={
  easy:{mul:0.86, count:0.92, lives:4, bombs:4, name:'简单'},
  normal:{mul:1.06, count:1.08, lives:3, bombs:3, name:'普通'},
  hard:{mul:1.24, count:1.40, lives:3, bombs:2, name:'困难'},
};
function diffMul(){ return DIFF[cfg.diff]?DIFF[cfg.diff].mul:1; }
function diffCnt(){ return DIFF[cfg.diff]?DIFF[cfg.diff].count:1; }

const CHARS={
  reimu:{ name:'博丽灵梦', shot:'追踪型 灵符「梦想封印」', bomb:'灵符「梦想天生」',
    hair:'#15151c', skin:'#ffdcc2', outfit:'#e63946', outfit2:'#f7f2ec',
    ribbon:'#e63946', band:'#222', bombName:'梦想天生',
    shotColor:'#ff9fae', bombColor:'#ffd7e0' },
  marisa:{ name:'雾雨魔理沙', shot:'直进型 魔符「星尘幻想」', bomb:'恋符「Master Spark」',
    hair:'#e6c25a', skin:'#ffe0c4', outfit:'#1b1b22', outfit2:'#f2f2ea',
    hat:'#f2efe8', hatBand:'#20303f', bombName:'Master Spark',
    shotColor:'#ffe27a', bombColor:'#fff3c2' },
  sanae:{ name:'东风谷早苗', shot:'诱导型 奇术「星之追踪」', bomb:'开海「海水分开之日」',
    hair:'#48c9b0', skin:'#ffddc4', outfit:'#2e8b57', outfit2:'#f5f7f0',
    ribbon:'#eaf7ff', band:'#1f4a3f', bombName:'海水分开之日',
    shotColor:'#8fe8c9', bombColor:'#c9f5e4' },
};

// 音频（WebAudio 合成，无外部文件）
let AC=null, aMaster=null, aMus=null, aSfx=null, bgmTimer=null, bgmStep=0, bgmNextT=0, bgmTrack='title';
let bgmScheduled=0, bgmPos=0;

function ensureAudio(){
  if(AC) { if(AC.state==='suspended') AC.resume(); return; }
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    aMaster=AC.createGain(); aMus=AC.createGain(); aSfx=AC.createGain();
    aMus.connect(aMaster); aSfx.connect(aMaster); aMaster.connect(AC.destination);
    applyVolumes();
  }catch(e){ AC=null; }
}
function applyVolumes(){
  if(!AC) return;
  aMaster.gain.value=(cfg.mst||0)/100;
  aMus.gain.value=(cfg.mus||0)/100*0.9;
  aSfx.gain.value=(cfg.sfx||0)/100;
}
function tone(freq,dur,type,vol,when,slideTo){
  if(!AC||!aSfx) return;
  const t0=(when==null?AC.currentTime:when);
  const o=AC.createOscillator(), g=AC.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30,slideTo),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001,vol||0.2),t0+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(aSfx);
  o.start(t0); o.stop(t0+dur+0.03);
}
function noise(dur,vol,when,freq){
  if(!AC||!aSfx) return;
  const t0=(when==null?AC.currentTime:when);
  const n=Math.floor(AC.sampleRate*dur);
  const buf=AC.createBuffer(1,n,AC.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const src=AC.createBufferSource(); src.buffer=buf;
  const g=AC.createGain(); g.gain.value=vol||0.3;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq||900;
  src.connect(f); f.connect(g); g.connect(aSfx);
  src.start(t0);
}
// 音效集合
function sfx(name){
  if(!AC) return;
  switch(name){
    case 'shot':   if(Math.random()<0.5) tone(1500+rnd(0,300),0.03,'square',0.012,undefined,900); break;
    case 'hit':    tone(300+rnd(0,120),0.05,'triangle',0.10,undefined,150); break;
    case 'graze':  tone(2400,0.03,'sine',0.04); break;
    case 'power':  tone(660,0.08,'square',0.12); tone(990,0.1,'square',0.10,AC.currentTime+0.06); break;
    case 'item':   tone(1300,0.06,'sine',0.09,undefined,1800); break;
    case 'bomb':   noise(0.7,0.5,undefined,500); tone(200,0.8,'sawtooth',0.25,undefined,60); break;
    case 'cancel': tone(520,0.12,'triangle',0.10,undefined,1040); break;
    case 'death':  tone(700,0.6,'sawtooth',0.22,undefined,70); noise(0.5,0.3,undefined,400); break;
    case '1up':    tone(523,0.1,'square',0.14); tone(659,0.1,'square',0.14,AC.currentTime+0.1);
                   tone(784,0.2,'square',0.14,AC.currentTime+0.2); break;
    case 'spell':  tone(392,0.12,'square',0.16); tone(494,0.12,'square',0.16,AC.currentTime+0.11);
                   tone(587,0.12,'square',0.16,AC.currentTime+0.22);
                   tone(784,0.3,'square',0.18,AC.currentTime+0.33); break;
    case 'select': tone(880,0.05,'square',0.08); break;
    case 'start':  tone(523,0.09,'square',0.12); tone(784,0.14,'square',0.12,AC.currentTime+0.09); break;
    case 'clear':  tone(523,0.14,'triangle',0.16); tone(659,0.14,'triangle',0.16,AC.currentTime+0.13);
                   tone(784,0.14,'triangle',0.16,AC.currentTime+0.26);
                   tone(1047,0.5,'triangle',0.18,AC.currentTime+0.39); break;
    case 'extend': tone(659,0.1,'square',0.14); tone(880,0.16,'square',0.14,AC.currentTime+0.09);
                   tone(1319,0.22,'square',0.12,AC.currentTime+0.2); break;
  }
}
const SCALE=[0,2,4,7,9,12,14];
function noteFreq(base,step){ return base*Math.pow(2,step/12); }
// 每条轨道：base + 小节数量 + 生成规则（用固定序列更稳）
const TRACKS={
  title:{bpm:96, base:220, bars:2, lead:2, bass:1, seq:null},
  stage:{bpm:138, base:196, bars:4, lead:1, bass:2, seq:null},
  boss: {bpm:150, base:208, bars:4, lead:3, bass:3, seq:null},
  clear:{bpm:120, base:262, bars:2, lead:2, bass:1, seq:null},
};
function bgmSeq(base, bars, kind){
  // 生成 16 步/小节 x bars 的引导序列（确定性伪随机）
  let s=0x9e3779b9;
  const rnd2=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const steps=bars*16, seq=[];
  for(let i=0;i<steps;i++){
    if(kind==='bass'){
      seq.push(i%8===0?0:(i%8===4?-2:null));
    }else{
      const p=(i*7)%steps;
      const on=(p<4)||(i%2===1&&rnd2()<0.5);
      seq.push(on?(rnd2()<0.6?(SCALE[Math.floor(rnd2()*SCALE.length)]):(SCALE[Math.floor(rnd2()*SCALE.length)]+12)):null);
    }
  }
  return seq;
}
function bgmPlay(track){
  // 优先播放 bgm/ 文件夹中的外部音频（title/stage/boss/clear.mp3|wav|ogg|m4a）
  if(extBgm[track]&&extBgm[track].ok){
    if(bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; }
    extCur=extBgm[track].el;
    if(extLastKey!==track){ try{ extCur.currentTime=0; }catch(e){} extLastKey=track; }
    bgmTrack=track;
    extVol(); extPlay();
    return;
  }
  if(!AC) return;
  if(track===bgmTrack && bgmTimer) return;
  bgmTrack=track;
  const T=TRACKS[track];
  if(!T.seq) T.seq=bgmSeq(T.base,T.bars, 'lead');
  if(!T.bseq) T.bseq=bgmSeq(T.base/2,T.bars,'bass');
  bgmStep=0; bgmPos=0; bgmScheduled=0;
  const spb=60/T.bpm/4;
  bgmNextT=AC.currentTime+0.08;
  if(bgmTimer) clearInterval(bgmTimer);
  bgmTimer=setInterval(bgmSched,40);
}
function bgmStop(){
  if(bgmTimer){clearInterval(bgmTimer); bgmTimer=null;}
  if(extCur){ try{ extCur.pause(); }catch(e){} }
  extLastKey=null;
}
function bgmSched(){
  if(!AC||!aMus) return;
  while(bgmNextT<AC.currentTime+0.18){
    const T=TRACKS[bgmTrack];
    const stepLen=60/T.bpm/4;
    const lead=T.seq[bgmStep%T.seq.length];
    const bass=T.bseq[bgmStep%T.bseq.length];
    const t0=bgmNextT;
    if(lead!=null){
      const f=noteFreq(T.base,lead);
      tone(f,stepLen*0.9,'square',0.05,t0);
      if(Math.random()<0.25) tone(f*2,stepLen*0.4,'triangle',0.02,t0);
    }
    if(bass!=null) tone(noteFreq(T.base/2,bass),stepLen*0.95,'triangle',0.09,t0);
    if(bgmTrack==='boss' && Math.random()<0.1) tone(1400+Math.random()*600,0.04,'sawtooth',0.012,t0);
    bgmNextT+=stepLen; bgmStep++;
  }
}
const extBgm={title:{},stage:{},boss:{},clear:{}};
let extCur=null, extLastKey=null;
function probeExtBgm(){
  if(typeof Audio==='undefined'||typeof document==='undefined') return;
  for(const key of Object.keys(extBgm)){
    const rec=extBgm[key]; if(rec.done) continue;
    rec.done=true;
    try{ const a=new Audio(); a.loop=true; a.preload='auto';
      const exts=['mp3','wav','ogg','m4a']; let i=0;
      a.addEventListener('canplaythrough',()=>{ rec.ok=true; rec.el=a; });
      a.addEventListener('error',()=>tryNext());
      const tryNext=()=>{ if(i>=exts.length) return; const ext=exts[i++]; try{ a.src='bgm/'+key+'.'+ext; }catch(e){ tryNext(); } };
      tryNext();
    }catch(e){}
  }
}
function extVol(){
  if(!extCur) return;
  extCur.volume=clamp((cfg.mst||0)/100*((cfg.mus||0)/100)*0.9,0,1);
}
function extPlay(){
  if(!extCur) return;
  try{ const pr=extCur.play(); if(pr&&pr.catch) pr.catch(()=>{}); }catch(e){}
}
function extPause(){
  if(extCur){ try{ extCur.pause(); }catch(e){} }
}
// 标题曲：首次交互后播放（浏览器要求先有手势）
let titleBgmOn=false;
function titleBgmTry(){
  if(G.state!=='title'||titleBgmOn) return;
  titleBgmOn=true;
  try{ ensureAudio(); }catch(e){}
  bgmPlay('title');
}
