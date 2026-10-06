import * as THREE from 'three';
import { fillLine, lineObject, segmentLines, textLabel } from './scene-kit.js';
import { CD_SAMPLE_RATE, CD_FRAME_BITS } from './cd-codec.js';
import { CD_TIMING, CD_SOUNDS } from './cd-physics.js';

const C={ink:0x374736,paper:0xfbf6e9,pale:0xe7dfce,blue:0x397b94,gold:0xb08a38,red:0xc14f39,green:0x78a477,gray:0xa8b4a4,purple:0x8063a3};
const label=(p,text,x,y,w=5.8,h=.19,z=.13)=>textLabel(p,text,{width:w,height:h,position:[x,y,z]});
const line=(p,points,color=C.gray)=>{const o=lineObject(points.length,color,p);fillLine(o,points);return o;};
const own=o=>{o.material=o.material.clone();return o;};
const flat=(o,color)=>{o.material=new THREE.MeshBasicMaterial({color});return o;};
const graph=(p,n,color)=>lineObject(n,color,p);
const set=(o,text)=>o.userData.setText(text);
const rectangle=(p,x,y,w,h)=>line(p,[[x,y,.06],[x+w,y,.06],[x+w,y+h,.06],[x,y+h,.06],[x,y,.06]]);
const hex=x=>x<0?'?':x.toString(16).toUpperCase().padStart(2,'0');

export function createCdDetails(kit,system){
  const details=[],panels={};
  const panel=(id,name,description,title)=>{
    const p=kit.part(id,name,description,[0,0,0],system);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;details.push(p);panels[id]=p;
    flat(kit.box([6.12,5.45,.035],[0,-.04,-.08],C.paper,p),C.paper);label(p,title,0,2.42,5.8,.25);return p;
  };
  const optics=panel('optics','Laser to photodetector','The laser is focused through the 1.2 mm transparent substrate. A splitter directs some returned light to a detector. Pits and lands both reflect light; diffraction changes the collected return. The digital model starts after ideal transition detection.','LIGHT GOES IN; A CHANGING SIGNAL COMES OUT');
  flat(kit.box([4.4,.19,.1],[.3,1.53,0],C.blue,optics),0xbdd5d9);kit.box([4.4,.014,.11],[.3,1.637,.01],C.ink,optics);label(optics,'Reflective pattern above the transparent substrate',.1,1.89,5.5,.18);
  kit.box([.68,.35,.13],[-2.10,-.58,0],C.ink,optics);label(optics,'780 nm laser',-2.1,-.96,1.4,.17);
  kit.box([.12,.68,.13],[-1.37,-.58,0],C.blue,optics);label(optics,'Collimator',-1.4,-1.22,1.3,.16);
  const splitter=kit.box([.56,.56,.08],[-.45,-.58,0],C.pale,optics);line(optics,[[-.73,-.86,.12],[-.17,-.30,.12]],C.ink);label(optics,'Splitter',-.50,.01,1.05,.17);
  const mirror=kit.box([.12,.53,.13],[.90,-.58,0],C.gray,optics);mirror.rotation.z=-Math.PI/4;label(optics,'Fold mirror',1.95,-.70,1.65,.17);
  kit.box([.59,.17,.13],[.90,.69,0],C.blue,optics);label(optics,'Objective',1.98,.68,1.7,.17);
  kit.box([.65,.30,.13],[-.45,-1.49,0],C.gold,optics);label(optics,'Photodetector',.85,-1.50,1.8,.18);
  const outgoing=graph(optics,5,C.red),returning=graph(optics,5,C.gold),lightStatus=label(optics,'',0,-2.00,5.8,.20);
  label(optics,'Visible beam color and component sizes are illustrative',0,-2.42,5.8,.17);

  const track=panel('track','Spot, marks and transitions','This enlarged patch comes from the actual EFM recording. A one marks a change of pit/land level; zero means no change. A scalar Airy first-dark-ring diameter is shown as a spot-size reference, not a calibrated detector response.','MARKS STORE TRANSITIONS, NOT AUDIO SAMPLE BITS');
  const trackTitle=label(track,'',0,2.01,5.8,.18),trackScale=label(track,'',0,1.69,5.8,.17);
  const pits=Array.from({length:64},()=>own(kit.box([1,.16,.055],[0,1.02,.055],C.ink,track)));
  line(track,[[-2.70,1.02,.015],[2.7,1.02,.015]],C.gray);
  const neighbors=[graph(track,2,C.gray),graph(track,2,C.gray)];
  const spot=own(kit.disk(1,.008,[0,1.02,.12],C.red,track));spot.material.transparent=true;spot.material.opacity=.20;spot.material.depthWrite=false;
  const spotRing=kit.ring(1,.013,[0,1.02,.14],C.red,track),trackCursor=graph(track,2,C.red),levels=graph(track,130,C.blue),transitionDots=Array.from({length:64},()=>kit.sphere(.022,[0,-.48,.12],C.gold,track));
  label(track,'Ideal pit/land level; actual detector voltage is not computed',0,-.83,5.8,.17);
  const bitsA=label(track,'',0,-1.18,5.8,.19),bitsB=label(track,'',0,-1.48,5.8,.19),trackResult=label(track,'',0,-1.94,5.8,.19);
  label(track,'Gold dots mark channel ones; the pale circle is a size reference',0,-2.43,5.8,.17);

  const codec=panel('codec','One channel frame and EFM','A channel frame has 588 cells: a 24-cell sync, 33 fourteen-cell words and 34 three-cell merges. EFM reverses a fixed table; CIRC then restores the audio-byte order and repairs known erasures. Placeholder control bytes do not form a complete disc table of contents.','588 CHANNEL CELLS CARRY ONE FRAME');
  label(codec,'24 sync + 33 × 14 coded cells + 34 × 3 merging cells',0,2.01,5.8,.19);
  const frameBlocks=[];let frameAt=0;
  const block=(width,color)=>{const o=kit.box([5.3*width/588,.31,.04],[-2.65+5.3*(frameAt+width/2)/588,1.48,.02],color,codec);frameAt+=width;frameBlocks.push(o);};
  block(24,C.red);block(3,C.pale);
  for(let j=0;j<33;j++){block(14,j===0?C.purple:(j>=13&&j<=16||j>=29)?C.gold:C.blue);block(3,C.pale);}
  label(codec,'Red sync · purple control · blue data · gold parity',0,1.05,5.8,.17);
  const codeHeader=label(codec,'',0,.66,5.8,.18),bitBoxes=Array.from({length:14},(_,j)=>{
    const x=-2.53+j*5.06/13,box=own(kit.box([.30,.35,.05],[x,.19,.03],C.pale,codec)),text=label(codec,'',x,.19,.27,.21);return {box,text};
  });
  const receivedWord=label(codec,'',0,-.34,5.8,.19),byteResult=label(codec,'',0,-.86,5.8,.27);
  label(codec,'EFM byte → parity and delays undone → stereo PCM',0,-1.38,5.8,.19);
  const codecProgress=label(codec,'',0,-1.88,5.8,.19);label(codec,'A channel one is a transition; it is not an audio-data one',0,-2.43,5.8,.17);

  const errors=panel('errors','Repair or report missing data','The reader flags invalid EFM words as known erasures. C1 tries up to four erasures per 32-byte word. Undoing the 4j frame delays spreads bursts among 28-byte C2 words, which can also repair up to four known erasures. Anything unresolved stays flagged.','INTERLEAVING SPREADS A BURST BEFORE REPAIR');
  const errorHeader=label(errors,'',0,2.00,5.8,.18);
  const byteRow=(count,y)=>Array.from({length:count},(_,j)=>{
    const width=5.45/count,x=-2.725+width*(j+.5),box=flat(kit.box([width*.91,.29,.04],[x,y,.02],C.pale,errors),C.pale),text=label(errors,'',x,y,width*.91,.13);return {box,text};
  });
  const receivedRow=byteRow(32,1.33);const receivedLabel=label(errors,'',0,1.70,5.8,.17);
  label(errors,'C1 correction → undo the 0, 4, 8, …, 108-frame delays',0,.87,5.8,.18);
  const spreadRow=byteRow(28,.23),spreadLabel=label(errors,'',0,.58,5.8,.17);
  label(errors,'C2 correction: four parity bytes constrain 24 data bytes',0,-.22,5.8,.18);
  const correctedRow=byteRow(28,-.81),correctedLabel=label(errors,'',0,-.47,5.8,.17);
  const repairCounts=label(errors,'',0,-1.34,5.8,.19),missingCount=label(errors,'',0,-1.82,5.8,.20);
  label(errors,'Gray waiting · red unresolved · green data · gold parity',0,-2.43,5.8,.17);

  const waveform=panel('waveform','Recovered stereo waveform','These plots use the samples reconstructed from received symbols and CIRC, never a copy of the intended sound. Future samples stay blank. Red bars flag unresolved samples muted to zero; the close-up shows 128 recovered sample pairs after the 10 ms fade-in.','THE ACTUAL RECOVERED LEFT AND RIGHT SAMPLES');
  const waveHeader=label(waveform,'',0,2.02,5.8,.19),waveRows=[1.14,.13].map((y,i)=>{
    label(waveform,i?'RIGHT':'LEFT',-2.78,y,.48,.15);rectangle(waveform,-2.44,y-.33,5.06,.66);
    const signal=segmentLines(320,i?C.gold:C.blue,waveform),missing=segmentLines(320,C.red,waveform);return {y,signal,missing};
  });
  const waveCursor=graph(waveform,2,C.red);label(waveform,'0 → 0.4 s · range in each small interval; red flags muted loss',0,-.43,5.8,.17);
  rectangle(waveform,-2.44,-1.59,5.06,.65);const closeup=[graph(waveform,128,C.blue),graph(waveform,128,C.gold)];
  label(waveform,'Recovered pairs at 10.00–12.90 ms · blue left · gold right',0,-1.88,5.8,.17);
  const waveFooter=label(waveform,'',0,-2.39,5.8,.18);

  const layers=panel('layers','Read through the transparent disc','A pressed CD has a nominal 1.2 mm transparent substrate. The reflective patterned surface is protected on the label side. The laser enters from the opposite side and focuses at the reflective layer. Tiny pit relief and coating thicknesses are enlarged here.','THE LASER READS THROUGH THE CLEAR SUBSTRATE');
  kit.box([4.72,.15,.05],[0,1.33,0],C.gold,layers);label(layers,'Label and protective coating',0,1.77,5.5,.19);
  const profile=[[-2.36,1.14,.12],[-1.75,1.14,.12],[-1.75,1.06,.12],[-1.0,1.06,.12],[-1.0,1.14,.12],[.10,1.14,.12],[.10,1.06,.12],[.85,1.06,.12],[.85,1.14,.12],[2.36,1.14,.12]];line(layers,profile,C.ink);
  flat(kit.box([4.72,1.18,.035],[0,.43,-.04],C.blue,layers),0xbdd5d9);label(layers,'Transparent substrate: nominal 1.2 mm',0,.43,4.5,.21);
  line(layers,[[-2.67,-.16,.12],[-2.67,1.14,.12]],C.ink);line(layers,[[-2.77,-.16,.12],[-2.57,-.16,.12]],C.ink);line(layers,[[-2.77,1.14,.12],[-2.57,1.14,.12]],C.ink);
  const layerBeams=[line(layers,[[-.34,-1.4,.15],[0,1.14,.15]],C.red),line(layers,[[.34,-1.4,.15],[0,1.14,.15]],C.red)];
  kit.box([.92,.15,.07],[0,-1.40,.03],C.gray,layers);label(layers,'Objective below the read side',0,-1.79,5.8,.19);
  label(layers,'Pit relief and coating thicknesses are enlarged, not to scale',0,-2.40,5.8,.17);

  const phase=panel('phase','A separate two-wave experiment','Two equal coherent waves have a round-trip phase difference 4πnh/λ. Their intensity, relative to in-phase addition, is cos²(2πnh/λ). This conceptual comparison does not calculate a real detector signal or change the recorded data.','WHY A SMALL HEIGHT DIFFERENCE CAN MATTER');
  const phaseHeader=label(phase,'',0,2.01,5.8,.18),phaseLines=[graph(phase,181,C.blue),graph(phase,181,C.gold),graph(phase,181,C.purple)];
  for(const [text,y] of [['First wave',1.34],['Second wave',.26],['Their sum',-.82]]){label(phase,text,-2.29,y+.33,1.2,.17);line(phase,[[-2.7,y,.02],[2.7,y,.02]],C.pale);}
  const phaseResult=label(phase,'',0,-1.56,5.8,.24);label(phase,'Equal coherent waves only; this is not a detector-contrast test',0,-2.05,5.8,.17);
  label(phase,'Changing this experiment leaves the stored bits and sound unchanged',0,-2.43,5.8,.16);

  const spin=panel('spin','Constant track speed and outward spiral','The same track speed needs fewer revolutions per minute at a larger radius. The physical read radius follows r² = r₀² + pvt/π, using 1.6 micrometer pitch. The spiral drawing uses coarse turns so its path is visible; numerical drift uses the real pitch.','OUTWARD TRACKING SLOWS THE SPINDLE');
  const circle=kit.ring(1.29,.025,[-1.17,.59,.03],C.gray,spin),hole=kit.ring(.167,.017,[-1.17,.59,.04],C.gray,spin);
  const spiralLine=graph(spin,1601,C.blue),spinMarker=kit.sphere(.055,[-1.17,.59,.12],C.red,spin),radiusGuide=graph(spin,2,C.red);
  const spinReadouts=[1.54,1.07,.60,.13,-.34].map(y=>label(spin,'',1.34,y,2.5,.18));
  label(spin,'Coarse spiral diagram',-1.17,-.99,2.6,.17);const spinProgress=label(spin,'',0,-1.37,5.8,.19);
  line(spin,[[-2.55,-1.76,.06],[2.55,-1.76,.06]],C.gray);const driftMarker=kit.sphere(.054,[-2.55,-1.76,.12],C.gold,spin);
  const driftLabel=label(spin,'',0,-2.05,5.8,.18),spinFooter=label(spin,'',0,-2.45,5.8,.16);
  fillLine(spiralLine,Array.from({length:1601},(_,i)=>{const a=16*2*Math.PI*i/1600,r=1.29*(25+(58-25)*i/1600)/58;return [-1.17+r*Math.cos(a),.59+r*Math.sin(a),.06];}));

  return {details,panels,optics,outgoing,returning,lightStatus,track,trackTitle,trackScale,pits,neighbors,spot,spotRing,trackCursor,levels,transitionDots,bitsA,bitsB,trackResult,
    codec,frameBlocks,codeHeader,bitBoxes,receivedWord,byteResult,codecProgress,errors,errorHeader,receivedRow,receivedLabel,spreadRow,spreadLabel,correctedRow,correctedLabel,repairCounts,missingCount,
    waveform,waveHeader,waveRows,waveCursor,closeup,waveFooter,waveKey:null,layers,layerBeams,phase,phaseHeader,phaseLines,phaseResult,spin,circle,hole,spiralLine,spinMarker,radiusGuide,spinReadouts,spinProgress,driftMarker,driftLabel,spinFooter};
}

function setSegments(object,segments){
  const data=object.geometry.attributes.position.array;segments.forEach((pair,i)=>data.set(pair.flat(),i*6));object.geometry.attributes.position.needsUpdate=true;object.geometry.setDrawRange(0,segments.length*2);
}

export function updateCdDetails(g,s,p){
  const lit=!!s.values.laser,beam=lit&&s.time<CD_TIMING.readEnd;
  fillLine(g.outgoing,beam?[[-1.75,-.58,.16],[-.45,-.58,.16],[.90,-.58,.16],[.90,.69,.16],[.90,1.637,.16]]:[]);
  fillLine(g.returning,beam?[[.98,1.637,.17],[.98,.69,.17],[.98,-.50,.17],[-.37,-.50,.17],[-.37,-1.33,.17]]:[]);
  set(g.lightStatus,lit?'Ideal transition detector feeds the real digital decoder':'Laser off: there is no optical signal to decode');g.layerBeams.forEach(o=>{o.visible=beam;});

  const count=p.disc.channel.bits.length,windowStart=Math.min(count-64,Math.floor(Math.min(s.cells,count-1)/64)*64),cellW=5.4/64,visible=p.disc.levels.slice(windowStart,windowStart+64),bits=p.disc.channel.bits.slice(windowStart,windowStart+64);
  let begin=0,number=0;
  while(begin<64){let end=begin+1;while(end<64&&visible[end]===visible[begin])end++;
    if(visible[begin]<0){const pit=g.pits[number++];pit.visible=true;pit.position.x=-2.7+(begin+end)*cellW/2;pit.scale.x=(end-begin)*cellW;}
    begin=end;
  }
  for(let i=number;i<g.pits.length;i++)g.pits[i].visible=false;
  const pitchHeight=1600/p.optics.cellNm*cellW,spotSize=p.optics.spotDiameterNm/p.optics.cellNm*cellW/2,cursor=-2.7+Math.min(64,Math.max(0,s.cells-windowStart))*cellW;
  g.neighbors.forEach((o,i)=>fillLine(o,[[-2.7,1.02+(i?1:-1)*pitchHeight,.025],[2.7,1.02+(i?1:-1)*pitchHeight,.025]]));
  g.spot.scale.set(spotSize,spotSize,spotSize);g.spot.position.x=cursor;g.spot.visible=lit;
  g.spotRing.scale.set(spotSize,spotSize,1);g.spotRing.position.x=cursor;g.spotRing.visible=lit;
  fillLine(g.trackCursor,[ [cursor,-.52,.14],[cursor,1.53,.14] ]);
  fillLine(g.levels,Array.from(visible,(level,i)=>[[-2.7+i*cellW,-.05+level*.19,.12],[-2.7+(i+1)*cellW,-.05+level*.19,.12]]).flat());
  g.transitionDots.forEach((o,i)=>{o.position.x=-2.7+i*cellW;o.visible=!!bits[i];});
  set(g.trackTitle,`Stored cells ${windowStart.toLocaleString('en-US')}–${(windowStart+63).toLocaleString('en-US')} · dark shapes are one pit/land level`);
  set(g.trackScale,`Cell ${p.optics.cellNm.toFixed(1)} nm · track pitch 1.6 µm · spot reference ${(p.optics.spotDiameterNm/1000).toFixed(2)} µm`);
  set(g.bitsA,Array.from(bits.slice(0,32)).join(' '));set(g.bitsB,Array.from(bits.slice(32)).join(' '));
  set(g.trackResult,!lit?'Laser off: stored pattern remains; no transitions are retrieved':s.time<=4?`${s.receivedCells} cells have arrived at 16 cells/s in this close-up`:`${s.receivedCells.toLocaleString('en-US')} channel cells retrieved; ordinary runs span 3T to 11T`);

  const example=p.read?.lossStart??Math.floor(p.disc.input.length/2),symbol=s.values.loss===1?7:0,first=example*588+44+17*symbol,recorded=p.disc.channel.bits.slice(first,first+14),arrived=s.receivedCells>=first+14;
  set(g.codeHeader,`Example frame ${example}, data symbol ${symbol+1}: stored EFM word`);
  g.bitBoxes.forEach(({box,text},i)=>{box.material.color.set(recorded[i]?C.gold:C.pale);set(text,String(recorded[i]));});
  const byte=arrived?p.read.efm.frames[example][symbol]:null;
  set(g.receivedWord,arrived?`Received word: ${Array.from(p.read.received.slice(first,first+14)).join('')}`:'Received word: waiting for this part of the track');
  set(g.byteResult,byte===null?'No retrieved byte yet':byte<0?'Invalid EFM word → known erasure':`14 channel cells → byte ${byte} (0x${hex(byte)})`);
  set(g.codecProgress,`${s.decodedSymbols.toLocaleString('en-US')} data symbols demodulated · ${s.samplePairs.toLocaleString('en-US')} stereo pairs recovered`);

  set(g.errorHeader,s.values.loss?['','One selected word is unreadable','Eight consecutive frames are unreadable','196 consecutive frames are unreadable'][s.values.loss]:'Clean symbols pass through both parity checks');
  const target=Math.floor(p.disc.input.length/2),c2Frame=target-56;
  const paint=(row,bytes,ready,parity)=>row.forEach(({box,text},j)=>{
    const known=typeof ready==='function'?ready(j):ready,value=known?bytes[j]:null;
    box.material.color.set(!known?0xede7da:value<0?0xf3c4b9:parity(j)?0xe7c877:0xd3e1c7);set(text,!known?'·':hex(value));
  });
  paint(g.receivedRow,p.read?.efm.frames[target]??[],s.frames>target,j=>j>=12&&j<=15||j>=28);
  paint(g.spreadRow,p.read?Array.from({length:28},(_,j)=>p.read.circ.c1[c2Frame+4*j][j]):[],j=>s.c1Frames>c2Frame+4*j,j=>j>=12&&j<=15);
  paint(g.correctedRow,p.read?.circ.c2[c2Frame]??[],s.c2Frames>c2Frame,j=>j>=12&&j<=15);
  set(g.receivedLabel,`Received F2 frame ${target}: 32 bytes, before parity inversion and C1`);
  set(g.spreadLabel,`C2 word ${c2Frame}: bytes drawn from C1 frames ${c2Frame}–${c2Frame+108}`);
  set(g.correctedLabel,`That same 28-byte word after C2${s.c2Frames>c2Frame&&p.read.circ.c2[c2Frame].some(x=>x<0)?': unresolved':s.c2Frames>c2Frame?': checked and complete':': waiting'}`);
  set(g.repairCounts,`Flagged read symbols ${s.stats.erased} · C1 repaired ${s.stats.c1Repaired} · C2 repaired ${s.stats.c2Repaired}`);
  set(g.missingCount,`${s.stats.missingSamples} unresolved channel samples${s.readComplete?' muted in the output':' so far'}`);

  set(g.waveHeader,`${CD_SOUNDS[s.values.content]} · ${s.samplePairs.toLocaleString('en-US')} / 17,640 stereo pairs available`);
  const key=`${s.values.content}:${s.values.loss}:${s.values.laser}:${s.samplePairs}`;
  if(g.waveKey!==key){
    g.waveKey=key;
    g.waveRows.forEach((row,ch)=>{
      const signal=[],missing=[],samples=p.read?.recovered.pcm[ch],valid=p.read?.recovered.valid[ch];
      if(samples)for(let bin=0;bin<320;bin++){
        const start=Math.floor(bin*samples.length/320),end=Math.min(s.samplePairs,Math.floor((bin+1)*samples.length/320));if(end<=start)break;
        let lo=1,hi=-1,lost=false;
        for(let i=start;i<end;i++){if(!valid[i])lost=true;else{lo=Math.min(lo,samples[i]/32768);hi=Math.max(hi,samples[i]/32768);}}
        const x=-2.44+5.06*(bin+.5)/320;
        if(hi>=lo)signal.push([[x,row.y+.30*lo,.10],[x,row.y+.30*hi,.10]]);
        if(lost)missing.push([[x,row.y-.31,.12],[x,row.y+.31,.12]]);
      }
      setSegments(row.signal,signal);setSegments(row.missing,missing);
      fillLine(g.closeup[ch],samples?Array.from({length:Math.min(128,Math.max(0,s.samplePairs-441))},(_,i)=>[-2.44+5.06*i/127,-1.265+.30*samples[441+i]/32768,.12+ch*.01]):[]);
    });
  }
  const waveX=-2.44+5.06*s.audioTime/CD_TIMING.audio;
  fillLine(g.waveCursor,s.listening?[[waveX,-.25,.15],[waveX,1.5,.15]]:[]);
  set(g.waveFooter,!lit?'No laser signal: no decoded waveform or sound':s.readComplete?`${s.stats.missingSamples} unresolved samples · 44,100 pairs/s · 16 bits per channel`:'Future samples stay blank while parity and delays are resolved');

  set(g.phaseHeader,`Optical depth λ/${p.optics.denominator}: h = ${p.optics.depthNm.toFixed(1)} nm for n = 1.55`);
  g.phaseLines.forEach((o,j)=>fillLine(o,Array.from({length:181},(_,i)=>{
    const a=i/180*4*Math.PI,first=Math.sin(a),second=Math.sin(a+p.optics.radians),value=j===0?first:j===1?second:(first+second)/2;
    return [-2.70+5.4*i/180,[1.34,.26,-.82][j]+.26*value,.12];
  })));
  set(g.phaseResult,`${p.optics.degrees.toFixed(0)}° phase difference → ${(100*p.optics.intensity).toFixed(0)}% normalized intensity`);

  const radius=1.29*s.spiral.radiusMm/58,angle=-s.spiral.angle,x=-1.17+radius*Math.cos(angle),y=.59+radius*Math.sin(angle);
  g.spinMarker.position.set(x,y,.13);fillLine(g.radiusGuide,[[-1.17,.59,.12],[x,y,.12]]);
  const readouts=[`Track speed ${(s.values.velocity/10).toFixed(1)} m/s`,`${s.spiral.rpm.toFixed(1)} rpm here`,`${s.spiral.radiusMm.toFixed(4)} mm radius`,`At 25 mm: ${s.spiral.innerRpm.toFixed(1)} rpm`,`At 58 mm: ${s.spiral.outerRpm.toFixed(1)} rpm`];
  g.spinReadouts.forEach((o,i)=>set(o,readouts[i]));
  set(g.spinProgress,`This excerpt travels outward ${s.spiral.travelMicrometers.toFixed(3)} µm through ${s.spiral.turns.toFixed(3)} turns`);
  const full=(p.disc.seconds*s.values.velocity/10*1.6e-6/Math.PI+s.spiral.startMm**2/1e6)**.5*1000-s.spiral.startMm;
  g.driftMarker.position.x=-2.55+5.10*Math.min(1,s.spiral.travelMicrometers/Math.max(1e-12,full*1000));
  set(g.driftLabel,`Outward-motion bar: ${(full*1000).toFixed(3)} µm across its whole width`);
  set(g.spinFooter,`25–58 mm reference: 20,625 turns · ${s.spiral.referenceLength.toFixed(0)} m · ${s.spiral.referenceMinutes.toFixed(1)} min`);
}
