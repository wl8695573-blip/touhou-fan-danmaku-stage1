// Headless smoke test: stubs DOM/Canvas, runs the game scripts, simulates the
// full stage flow on desktop (640p) and portrait phone (tall screen + touch).
// Usage (after building src/_check.js):
//   node src/smoke.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const codePath = process.argv[2] || path.join(__dirname, '_check.js');
const code = fs.readFileSync(codePath, 'utf8');

function makeCtx() {
  const tgt = {};
  const grad = { addColorStop() {} };
  const handler = {
    get(t, p) {
      if (p === 'canvas') return tgt;
      if (p in t) return t[p];
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
      return (...a) => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  };
  return new Proxy(tgt, handler);
}
function makeEl(id) {
  const el = {
    id, dataset: {}, style: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    textContent: '', innerHTML: '', value: '50', checked: true,
    addEventListener() {}, appendChild(c) { this.children.push(c); },
    getContext: () => makeCtx(),
    width: 100, height: 100,
  };
  return el;
}
const els = {};
const sandbox = {
  console,
  document: {
    getElementById: (id) => els[id] || (els[id] = makeEl(id)),
    createElement: (tag) => makeEl('made-' + tag),
  },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {},
  requestAnimationFrame: () => 0,
  setTimeout: (fn) => { try { return fn(); } catch (e) { errors.push(e); } },
  clearInterval() {}, setInterval: () => 0,
  Math, JSON, Object, Array, Number, String, Boolean, parseInt, parseFloat, isNaN,
  AudioContext: undefined, window: undefined, navigator: undefined,
};
const errors = [];
sandbox.__errors = errors;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// ---- Phase 2: desktop (landscape, CVH=640) full-stage flow ----
const sim = `
(() => {
  try {
    if(CVH!==640) throw new Error('desktop CVH='+CVH);
    G.state='play'; G.char='reimu';
    G.lives=99; G.bombs=5; G.power=6; G.score=0; G.graze=0; G.stage='field';
    clearEnts(); P.dead=false; P.inv=5; P.x=240; P.y=540;
    initStageScript();
    let seenMid=false, seenBoss=false, seenRemi=false, seenClear=false, frames=0;
    for(let i=0;i<13200;i++){
      frames++;
      if(P.dead&&P.deadT<=0) respawnPlayer();
      P.inv=4;
      P.x = 200 + Math.sin(i*0.01)*150; P.y = 480 + Math.sin(i*0.03)*60;
      if(bo && bo.vulnerable && !bo.dying){
        pshots.push({x:bo.x,y:bo.y+6,vx:0,vy:0,dmg:300,hom:false,t:0,dead:false,r:4,color:'#fff'});
      }
      tick(1/60);
      if(bo){ if(bo.kind==='cirno') seenMid=true; if(bo.kind==='sakuya') seenBoss=true; if(bo.kind==='remilia') seenRemi=true; }
      if(G.stage==='clear'){ seenClear=true; break; }
    }
    return JSON.stringify({
      ok:true, stage:G.stage, t:+G.t.toFixed(1), score:G.score, frames,
      seenMid, seenBoss, seenRemi, seenClear,
      ebul:ebul.length, ens:ens.length, its:its.length,
      lives:G.lives, banner:G.banner, over:G.over
    });
  } catch(e){ return JSON.stringify({ok:false, err:String(e), stack:e&&e.stack}); }
})();
`;
const out = vm.runInContext(sim, sandbox);
console.log('RESULT ' + out);
if (errors.length) console.log('ASYNC_ERRORS ' + errors.length + ' first: ' + String(errors[0]));
if(out.indexOf('"seenRemi":true')<0 || out.indexOf('"seenClear":true')<0){ errors.push(new Error('stage flow incomplete (remilia/clear)')); }

// ---- Phase 3: bomb/death/characters/pause/settings/portrait regressions ----
const sim2 = `
(() => {
  try {
    G.state='play'; clearEnts(); bombsFx=[];
    for(let k=0;k<60;k++) eSpawn(240+rnd(-200,200),400+rnd(-100,100),0,0,3,'#fff','c');
    G.bombs=1; doBomb(); for(let i=0;i<200;i++) tick(1/60);
    if(ebul.length>=50) throw new Error('bomb did not clear bullets: '+ebul.length);
    P.dead=false; P.inv=0; G.lives=0; ebul=[]; eSpawn(P.x,P.y,0,0,5,'#fff','c');
    for(let i=0;i<30;i++) tick(1/60);
    if(G.state!=='over') throw new Error('gameOver not triggered, lives='+G.lives);
    uiStart();
    for(const c of ['reimu','marisa','sanae']){
      G.char=c; P.x=240; P.y=500;
      for(let i=0;i<120;i++){ tick(1/60);
        if((i%10)===0) pshots.push({x:P.x,y:P.y-20,vx:0,vy:-500,dmg:5,hom:false,t:0,dead:false,r:3,color:'#fff'}); }
      updatePshots(1/60);
    }
    uiPause(); if(G.state!=='pause') throw new Error('pause failed');
    uiResume(); if(G.state!=='play') throw new Error('resume failed');
    cfg.diff='hard'; cfg.vib=false; saveCfg();
    cfg.pzoom=150; cfg.poff=20; cfg.pfit=true;
    redrawAllCards();
    if(portZoom()!==1.5||portOff()!==0.2) throw new Error('portrait zoom pars wrong');
    cfg.pzoom=100; cfg.poff=0; cfg.pfit=false;
    redrawAllCards();
    probeExtBgm();
    if(Object.keys(extBgm).length!==4) throw new Error('extBgm keys wrong');
    storeCustomPortrait('reimu','data:image/png;base64,AAAA');
    resetCustomPortrait('reimu');
    if(PORT_IMG.reimu) throw new Error('resetCustomPortrait failed');
    return JSON.stringify({ok2:true});
  } catch(e){ return JSON.stringify({ok2:false, err:String(e), stack:e&&e.stack}); }
})();
`;
const out2 = vm.runInContext(sim2, sandbox);
console.log('RESULT2 ' + out2);
if (errors.length) console.log('ASYNC_ERRORS2 ' + errors.length + ' first: ' + String(errors[0]));

// ---- Phase 4: portrait phone (390x844) + touch controls ----
sandbox.window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, ontouchstart: true };
const sim3 = `
(() => {
  try {
    applySize();
    if(CVH!==1039) throw new Error('portrait CVH='+CVH+' (expect 1039)');
    if(cv.width!==1170) throw new Error('canvas width='+cv.width+' (expect 1170)');
    if(!TOUCH) throw new Error('TOUCH should be true on touch device');
    if(!PORTRAIT) throw new Error('PORTRAIT should be true');
    G.state='play'; G.char='marisa'; G.bombs=2; G.power=4;
    clearEnts(); P.dead=false; P.inv=4; P.x=100; P.y=100; P.fireT=0;
    initStageScript(); tids.clear();
    const before=pshots.length;
    tDown({clientX:330,clientY:CVH-60,pointerId:1,pointerType:'touch'});
    for(let i=0;i<150;i++){ tick(1/60); }
    if(P.x<280) throw new Error('ship did not follow touch: x='+P.x);
    if(P.y<CVH-200) throw new Error('ship did not follow touch downward: y='+P.y);
    if(pshots.length<=before) throw new Error('autofire not working (TOUCH mode)');
    tDown({clientX:300,clientY:CVH-80,pointerId:2,pointerType:'touch'});
    tick(1/60);
    if(!P.focus) throw new Error('two-finger focus failed');
    tUp({pointerId:2,pointerType:'touch'});
    tick(1/60);
    if(P.focus) throw new Error('focus should clear after second finger up');
    const bombs0=G.bombs;
    tryBomb();
    if(bombsFx.length!==1||G.bombs!==bombs0-1) throw new Error('touch bomb failed');
    for(let i=0;i<30;i++) tick(1/60);
    tUp({pointerId:1,pointerType:'touch'});
    tick(1/60);
    if(touch.act) throw new Error('touch still active after up');
    window.innerHeight=700;
    applySize();
    if(CVH!==862) throw new Error('resized CVH='+CVH+' (expect 862)');
    for(let i=0;i<300;i++){ P.inv=4; tick(1/60); }
    if(G.over) throw new Error('resize sim died');
    return JSON.stringify({ok3:true, CVH, w:cv.width, h:cv.height, px:+P.x.toFixed(0), py:+P.y.toFixed(0), ebul:ebul.length});
  } catch(e){ return JSON.stringify({ok3:false, err:String(e), stack:e&&e.stack}); }
})();
`;
const out3 = vm.runInContext(sim3, sandbox);
console.log('RESULT3 ' + out3);
if (errors.length) console.log('ASYNC_ERRORS3 ' + errors.length + ' first: ' + String(errors[0]));

// ---- Phase 5: portrait phone full-stage flow (tall screen) ----
const sim4 = `
(() => {
  try {
    window.innerWidth=390; window.innerHeight=844;
    applySize();
    G.state='play'; G.char='sanae';
    G.lives=99; G.bombs=5; G.power=6; G.score=0; G.graze=0; G.stage='field';
    clearEnts(); P.dead=false; P.inv=5; P.x=240; P.y=CVH-120;
    initStageScript();
    let seenMid=false, seenBoss=false, seenRemi=false, seenClear=false;
    for(let i=0;i<18000;i++){
      if(P.dead&&P.deadT<=0) respawnPlayer();
      P.inv=4;
      P.x = 200 + Math.sin(i*0.011)*160; P.y = CVH-160 + Math.sin(i*0.03)*80;
      if(bo && bo.vulnerable && !bo.dying){
        pshots.push({x:bo.x,y:bo.y+6,vx:0,vy:0,dmg:300,hom:false,t:0,dead:false,r:4,color:'#fff'});
      }
      tick(1/60);
      if(bo){ if(bo.kind==='cirno') seenMid=true; if(bo.kind==='sakuya') seenBoss=true; if(bo.kind==='remilia') seenRemi=true; }
      if(G.stage==='clear'){ seenClear=true; break; }
    }
    if(!seenMid||!seenBoss||!seenRemi||!seenClear) throw new Error('flow incomplete mid='+seenMid+' boss='+seenBoss+' remi='+seenRemi+' clear='+seenClear);
    return JSON.stringify({ok4:true, stage:G.stage, t:+G.t.toFixed(1), score:G.score, CVH});
  } catch(e){ return JSON.stringify({ok4:false, err:String(e), stack:e&&e.stack}); }
})();
`;
const out4 = vm.runInContext(sim4, sandbox);
console.log('RESULT4 ' + out4);
if (errors.length) console.log('ASYNC_ERRORS4 ' + errors.length + ' first: ' + String(errors[0]));
