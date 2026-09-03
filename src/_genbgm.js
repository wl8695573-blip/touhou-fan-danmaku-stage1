// Original sample BGM synthesizer (same algorithm as the game's built-in music).
// Usage: node src/_genbgm.js [outDir]   (default: repo-root/bgm_samples)
'use strict';
const fs = require('fs');
const path = require('path');

const SR = 22050;

const SCALE=[0,2,4,7,9,12,14];
function noteFreq(base,step){ return base*Math.pow(2,step/12); }
function bgmSeq(base, bars, kind){
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
const TRACKS={
  title:{bpm:96, base:220, bars:2},
  stage:{bpm:138, base:196, bars:4},
  boss: {bpm:150, base:208, bars:4},
  clear:{bpm:120, base:262, bars:2},
};

function mixTone(buf, t0, freq, dur, vol, type){
  const i0=Math.floor(t0*SR);
  const n=Math.floor(dur*SR);
  const atk=Math.floor(0.006*SR);
  for(let i=0;i<n;i++){
    const idx=i0+i;
    if(idx>=buf.length) break;
    const ph=(i/SR)*freq;
    let w;
    if(type==='square'){
      const p=ph-Math.floor(ph);
      w=p<0.5?1:-1;
    } else {
      const p=ph-Math.floor(ph);
      w=1-4*Math.abs(p-0.5);
    }
    const e=Math.min(1,i/atk)*(1-i/n);
    buf[idx]+=w*vol*e;
  }
}
function renderTrack(key){
  const T=TRACKS[key];
  const lead=bgmSeq(T.base,T.bars,'lead');
  const bseq=bgmSeq(T.base/2,T.bars,'bass');
  const spb=60/T.bpm/4;
  const tileSec=lead.length*spb;
  const reps=Math.max(1,Math.ceil(19/tileSec));
  const totalSec=Math.min(tileSec*reps,34);
  const len=Math.floor(totalSec*SR);
  const buf=new Float64Array(len);
  for(let r=0;r<reps;r++){
    const off=r*lead.length;
    for(let i=0;i<lead.length;i++){
      const t0=(off+i)*spb;
      const lv=lead[i];
      if(lv!=null){
        const f=noteFreq(T.base,lv);
        mixTone(buf,t0,f,spb*0.9,0.16,'square');
        mixTone(buf,t0,f*2,spb*0.42,0.035,'triangle');
      }
      const bv=bseq[i];
      if(bv!=null) mixTone(buf,t0,noteFreq(T.base/2,bv),spb*0.95,0.30,'triangle');
    }
  }
  return buf;
}
function writeWav(file, buf){
  const data=new Int16Array(buf.length);
  for(let i=0;i<buf.length;i++){
    let v=Math.max(-1,Math.min(1,buf[i]))*0.92;
    data[i]=v<0?Math.round(v*32768):Math.round(v*32767);
  }
  const h=Buffer.alloc(44);
  h.write('RIFF',0,'ascii'); h.writeUInt32LE(36+data.length*2,4); h.write('WAVE',8,'ascii');
  h.write('fmt ',12,'ascii'); h.writeUInt32LE(16,16); h.writeUInt16LE(1,20);
  h.writeUInt16LE(1,22); h.writeUInt32LE(SR,24); h.writeUInt32LE(SR*2,28);
  h.writeUInt16LE(2,32); h.writeUInt16LE(16,34);
  h.write('data',36,'ascii'); h.writeUInt32LE(data.length*2,40);
  fs.writeFileSync(file,Buffer.concat([h,Buffer.from(data.buffer)]));
  return data.length/SR;
}
const outDir = process.argv[2] || path.join(__dirname,'..','bgm_samples');
fs.mkdirSync(outDir,{recursive:true});
for(const key of Object.keys(TRACKS)){
  const sec=writeWav(path.join(outDir,key+'.wav'), renderTrack(key));
  console.log(key+'.wav ok '+Math.round(sec)+'s -> '+outDir);
}
