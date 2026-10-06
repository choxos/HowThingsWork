import * as THREE from 'three';
import {fillLine,lineObject,textLabel} from './scene-kit.js';
import {COMMAND_WORDS,RECOGNITION,commandDtw} from './speech-recognition-physics.js';

const C={ink:0x374736,paper:0xfbf6e9,board:0x71916e,gold:0xd7a64d,copper:0xb9824f,blue:0x397b94,red:0xc14f39,gray:0xa8b4a4,pale:0xe7dfce,purple:0x8063a3,clay:0xce825f};
const label=(parent,text,x,y,width=5.3,height=.20,z=.13,color='#374736')=>textLabel(parent,text,{width,height,position:[x,y,z],color});
const graph=(parent,count,color=C.blue)=>{const o=lineObject(count,color,parent);o.frustumCulled=false;return o;};
const line=(parent,points,color=C.ink)=>{const o=graph(parent,points.length,color);fillLine(o,points);return o;};
const route=(kit,parent,points,color=C.copper,r=.013)=>points.slice(1).map((p,i)=>kit.rod(points[i],p,r,color,parent));
const own=(object,color)=>{object.material=object.material.clone();object.material.color.setHex(color);return object;};
const marker=(kit,parent,color=C.gold)=>{const o=kit.sphere(.035,[0,0,0],color,parent);o.material=new THREE.MeshBasicMaterial({color,toneMapped:false});return o;};
function onPath(points,fraction){
  const lengths=points.slice(1).map((p,i)=>new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...points[i])));let d=lengths.reduce((a,b)=>a+b,0)*fraction;
  for(let i=0;i<lengths.length;i++){if(d<=lengths[i] || i===lengths.length-1)return new THREE.Vector3(...points[i]).lerp(new THREE.Vector3(...points[i+1]),lengths[i]?d/lengths[i]:0);d-=lengths[i];}
  return new THREE.Vector3(...points[0]);
}
function cells(parent,count){
  const geometry=new THREE.BufferGeometry(),index=[];
  for(let i=0;i<count;i++){const a=i*4;index.push(a,a+1,a+2,a,a+2,a+3);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*12),3));geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*12),3));geometry.setIndex(index);geometry.setDrawRange(0,0);
  const o=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:THREE.DoubleSide}));o.frustumCulled=false;parent.add(o);return o;
}
const setCell=(o,i,x0,y0,x1,y1,color)=>{o.geometry.attributes.position.array.set([x0,y0,.10,x1,y0,.10,x1,y1,.10,x0,y1,.10],i*12);for(let j=0;j<4;j++)o.geometry.attributes.color.array.set([color.r,color.g,color.b],i*12+j*3);};
const changedCells=(o,n)=>{o.geometry.attributes.position.needsUpdate=true;o.geometry.attributes.color.needsUpdate=true;o.geometry.setDrawRange(0,n*6);o.geometry.boundingBox=null;o.geometry.boundingSphere=null;};
const frame=(p,x,y,w,h)=>line(p,[[x,y,.06],[x+w,y,.06],[x+w,y+h,.06],[x,y+h,.06],[x,y,.06]],C.gray);

export function createRecognitionGeometry(kit){
  const system=kit.part('system','Speech becomes an action','A supplied recording enters an illustrated phone, becomes sampled numbers, is compared with stored examples and produces a word or a local command. The display is laid beside the open phone and remains connected by its ribbon. Hardware is enlarged and illustrative.');
  const part=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const phone=part('phone','Open phone assembly','Inspect the microphone, powered circuit, processor and memory beneath the screen. This is a functional teaching assembly, not a product schematic.');phone.userData.explosionCategory=true;
  const shell=part('shell','Phone frame','The rim, corner posts and fasteners support the board and components.',phone);
  for(const x of [-2.94,-.36])kit.box([.12,4.48,.36],[x,0,.05],C.ink,shell);
  for(const y of [-2.18,2.18])kit.box([2.58,.12,.36],[-1.65,y,.05],C.ink,shell);
  const mounts=[[-2.67,-1.87],[-.63,-1.87],[-2.67,1.87],[-.63,1.87]];
  for(const [x,y] of mounts){kit.disk(.095,.27,[x,y,.06],C.gray,shell);kit.disk(.073,.025,[x,y,.23],C.gold,shell);line(shell,[[x-.04,y,.25],[x+.04,y,.25]],C.ink);}
  const back=part('rear-cover','Rear cover','The removable back closes the enclosure beneath the supported board.',phone);kit.box([2.57,4.35,.10],[-1.65,0,-.18],C.ink,back);kit.covers.push(back);
  const board=part('board','Circuit board','Representative supply, return, analog and digital routes join the mounted components. Separate routing heights represent separate circuit-board layers.',phone);kit.box([2.22,3.98,.075],[-1.65,0,.17],C.board,board);
  const battery=part('battery','Phone battery','An assigned battery supplies the phone electronics. Speech carries information, not the energy needed to run the processor or display.',phone);kit.box([1.55,1.17,.18],[-1.48,-1.05,.32],C.pale,battery);label(battery,'BATTERY',-1.48,-1.04,1.27,.15,.423);kit.box([.20,.16,.045],[-2.02,-.40,.32],C.gold,battery);kit.box([.20,.16,.045],[-.98,-.40,.32],C.gray,battery);
  const power=part('power','Power and microphone switch','A regulator and shared return power the board. The microphone switch disconnects the modeled input; the phone can still report silence.',phone);kit.box([.38,.30,.14],[-2.38,-.64,.32],C.ink,power);label(power,'PWR',-2.38,-.64,.31,.10,.401,'#fbf6e9');
  const contactA=[-2.67,-1.12,.35],contactB=[-2.43,-1.12,.35];for(const p of [contactA,contactB])kit.sphere(.038,p,C.gold,power);
  const switchPivot=new THREE.Group();switchPivot.position.set(...contactA);power.add(switchPivot);kit.rod([0,0,0],[.24,0,0],.026,C.gold,switchPivot);
  const microphone=part('microphone','Microphone capsule','Pressure can move a thin membrane against a fixed backplate and change an electrical signal. This view explains the transducer; the actual input here is a supplied digital recording.',phone);
  kit.disk(.245,.16,[-2.38,-1.72,.33],C.ink,microphone);kit.disk(.19,.055,[-2.38,-1.72,.43],C.gold,microphone);
  const diaphragm=part('diaphragm','Microphone diaphragm','An exaggerated membrane movement represents the incoming waveform. It is not a calibrated displacement or a simulation of microphone acoustics.',microphone);
  const membrane=own(kit.disk(.181,.015,[-2.38,-1.72,.48],C.blue,diaphragm),C.blue);kit.ring(.185,.024,[-2.38,-1.72,.477],C.gray,diaphragm);
  const adc=part('adc','Sampler and converter','The recording supplies 16-bit sample values. The 8 kHz experiment first applies an offline antialias filter. The board then illustrates those numbers going to the processor.',phone);kit.box([.51,.48,.17],[-2.26,.02,.35],C.ink,adc);label(adc,'ADC',-2.26,.02,.43,.14,.447,'#fbf6e9');
  const processor=part('processor','Processor','Short overlapping frames become spectra and mel features. Whole-word templates are matched with dynamic time warping, then a word is selected.',phone);const processorBody=own(kit.box([.82,.80,.16],[-1.68,.84,.35],C.ink,processor),C.ink);label(processor,'PROCESSOR',-1.68,.84,.74,.11,.442,'#fbf6e9');
  const memory=part('memory','Stored voice examples','One separate reference take for each word and speaker is stored here. The input take is never used as its own reference.',phone);kit.box([.49,.76,.16],[-.85,1.15,.35],C.ink,memory);label(memory,'MEMORY',-.85,1.15,.43,.09,.443,'#fbf6e9');
  const clock=part('clock','Sampling clock','The selected 8 or 16 kHz rate sets the sample interval. Analysis uses 25 ms frames with a new frame every 10 ms.',phone);kit.box([.47,.20,.11],[-.91,.10,.34],C.gray,clock);label(clock,'CLOCK',-.91,.10,.42,.08,.403);
  for(const [parent,x,y,w,h] of [[adc,-2.26,.02,.51,.48],[processor,-1.68,.84,.82,.80],[memory,-.85,1.15,.49,.76]])for(const side of [-1,1])for(let i=0;i<4;i++)kit.rod([x+side*w/2,y-h*.3+i*h*.2,.31],[x+side*(w/2+.075),y-h*.3+i*h*.2,.24],.013,C.gray,parent);
  const traces=part('traces','Connected signal and power paths','Gold carries the microphone and sample signals. Purple carries stored patterns and the output. Red supply and blue return keep those signals distinct from electrical power.',phone);traces.userData.explosionExcluded=true;
  const paths={
    batteryFeed:[[-2.02,-.40,.32],[-2.02,-.64,.25],[-2.19,-.64,.32]],
    batteryReturn:[[-.98,-.40,.32],[-.56,-.40,.235],[-.56,-1.92,.235]],
    rail:[[-2.38,-.49,.32],[-2.81,-.49,.235],[-2.81,1.65,.235],[-.50,1.65,.235]],
    adcSupply:[[-2.81,.22,.235],[-2.59,.22,.235],[-2.59,.17,.31],[-2.515,.17,.31]],
    cpuSupply:[[-1.96,1.65,.235],[-1.96,1.24,.35]],
    memorySupply:[[-.85,1.65,.235],[-.85,1.53,.35]],
    clockSupply:[[-.50,1.65,.235],[-.50,.10,.235],[-.675,.10,.34]],
    ground:[[-2.38,-.79,.32],[-2.80,-.79,.22],[-2.80,-1.92,.22],[-.56,-1.92,.235],[-.56,1.75,.22],[-2.49,1.75,.22]],
    adcReturn:[[-2.26,-.22,.35],[-2.26,-.32,.22],[-2.80,-.32,.22],[-2.80,-.79,.22]],
    cpuReturn:[[-1.68,.44,.35],[-1.68,.35,.22],[-.56,.35,.22]],
    memoryReturn:[[-.605,1.15,.35],[-.56,1.15,.22]],
    clockReturn:[[-1.145,.10,.34],[-1.145,-.32,.22],[-2.80,-.32,.22]],
    switchFeed:[[-2.81,-.49,.235],[-2.81,-1.12,.235],contactA],
    microphoneSupply:[contactB,[-2.43,-1.47,.33]],
    microphoneReturn:[[-2.38,-1.88,.33],[-2.38,-1.92,.22]],
    analog:[[-2.14,-1.72,.36],[-1.99,-1.72,.48],[-1.99,-1.83,.48],[-2.74,-1.83,.48],[-2.74,.02,.39],[-2.515,.02,.35]],
    samples:[[-2.005,.02,.35],[-1.70,.02,.43],[-1.70,.44,.35]],
    stored:[[-1.095,1.15,.35],[-1.195,1.15,.43],[-1.195,.98,.43],[-1.27,.98,.35]],
    timing:[[-.91,.20,.34],[-.91,.33,.41],[-1.45,.33,.41],[-1.45,.44,.35]],
  };
  const wireMeshes=Object.fromEntries(Object.entries(paths).map(([key,p])=>[key,route(kit,traces,p,key.toLowerCase().includes('return') || key==='ground'?C.blue:['analog','samples','timing'].includes(key)?C.gold:key==='stored'?C.purple:C.red,.010)]));

  const display=part('display','Connected display assembly','The screen is laid beside the phone so the whole signal path remains visible. A flex cable carries display information and power.');display.userData.explosionCategory=true;
  const bezel=part('bezel','Display frame','A frame and backing support the screen. The open service arrangement is illustrative.',display);kit.box([2.69,4.48,.26],[1.53,0,.04],C.ink,bezel);
  const screen=part('screen','Word and application screen','Recognized directions move the token. Go and stop control the small runner; yes and no confirm or cancel. Dictation writes the selected word instead. Commands change the application only after the decision.',display);kit.box([2.45,4.18,.045],[1.53,0,.195],C.paper,screen);
  const cable=part('display-cable','Display flex cable','Three representative routes connect processor data, regulated supply and common return to the screen. They are functional paths, not a pin-accurate connector.',system);
  const outputPaths={data:[[-1.27,.70,.35],[-.21,.70,.29],[-.10,.55,.08],[.10,.55,.08],[.23,.70,.29],[.30,.70,.23]],supply:[[-.50,1.65,.235],[-.18,1.65,.23],[-.08,1.48,.02],[.13,1.48,.02],[.31,1.65,.23]],return:[[-.56,-1.92,.235],[-.16,-1.92,.20],[-.06,-1.72,-.01],[.14,-1.72,-.01],[.31,-1.92,.23]]};
  for(const [key,p] of Object.entries(outputPaths))route(kit,cable,p,key==='data'?C.purple:key==='return'?C.blue:C.red,.027);
  const outputMarker=marker(kit,cable,C.purple),signalMarkers=['analog','samples','stored'].map(key=>({key,object:marker(kit,traces,key==='stored'?C.purple:C.gold)}));
  label(screen,'VOICE → WORD → ACTION',1.53,1.76,2.22,.155,.233);
  const screenStatus=label(screen,'Ready',1.53,1.39,2.19,.20,.239),screenWord=label(screen,'…',1.53,.96,2.20,.33,.242);
  const grid=new THREE.Group();screen.add(grid);grid.userData.explosionExcluded=true;
  for(const x of [-1,0,1])line(grid,[[1.53+x*.53,-1.0,.24],[1.53+x*.53,.5,.24]],C.pale);
  for(const y of [-1,0,1])line(grid,[[.76,-.25+y*.53,.24],[2.30,-.25+y*.53,.24]],C.pale);
  const token=own(kit.disk(.12,.035,[1.53,-.25,.265],C.blue,grid),C.blue);
  const tokenRing=kit.ring(.16,.022,[1.53,-.25,.282],C.gold,grid);
  const runner=new THREE.Group();screen.add(runner);runner.position.set(.74,-1.28,.28);kit.ring(.15,.018,[0,0,0],C.gray,runner);const runnerDot=kit.disk(.045,.022,[.15,0,.025],C.gold,runner);
  const confirmation=label(screen,'',1.79,-1.28,1.72,.20,.245),screenFooter=label(screen,'Waiting for speech',1.53,-1.76,2.19,.145,.242);

  const voice=part('voice','Supplied voice recording','A real one-second recording from the Speech Commands dataset feeds the experiment. This source stands in for incoming speech; it does not record you.');
  kit.box([.72,1.02,.44],[-3.79,-1.31,.10],C.clay,voice);const speaker=kit.cylinder(.29,.10,[-3.39,-1.31,.10],C.ink,voice);speaker.rotation.z=Math.PI/2;
  const waves=new THREE.Group();waves.userData.explosionExcluded=true;system.add(waves);
  const airArcs=Array.from({length:4},(_,i)=>graph(waves,17,C.blue));
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  const title=label(guides,'',-.59,2.62,7.05,.25,.40),status=label(guides,'',-.59,-2.70,7.05,.23,.40);
  label(guides,'RECORDING',-3.76,-.57,.92,.14,.35);label(guides,'MIC',-2.38,-2.04,.56,.12,.51);label(guides,'OPEN PHONE',-1.65,2.34,2.3,.16,.28);label(guides,'SCREEN',1.53,2.34,2.3,.16,.28);

  const detail=(id,name,description)=>{const p=part(id,name,description);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;return p;};
  const samples=detail('samples','Samples and short frames','Only arrived samples are shown. The lower view enlarges the latest complete 25 ms frame and the window applied before its Fourier transform.');
  label(samples,'A VOICE BECOMES NUMBERS',0,2.45,5.3,.27);const samplesHeader=label(samples,'',0,2.07,5.3,.20);
  frame(samples,-2.35,.62,4.7,.96);line(samples,[[-2.35,1.10,.06],[2.35,1.10,.06]],C.pale);
  const waveform=graph(samples,2000),sampleCursor=graph(samples,2,C.red),sampleBracket=graph(samples,5,C.gold);
  label(samples,'Time through recording: 0 → 1,000 ms',0,.40,5.0,.18);
  frame(samples,-2.35,-1.25,4.7,1.06);line(samples,[[-2.35,-.72,.06],[2.35,-.72,.06]],C.pale);
  const rawFrame=graph(samples,400,C.gray),windowedFrame=graph(samples,400,C.blue),windowLine=graph(samples,400,C.gold);
  label(samples,'One 25 ms frame: gray raw · blue windowed · gold taper',0,-1.51,5.3,.18);
  const sampleNumber=label(samples,'',0,-1.94,5.3,.20),sampleBits=label(samples,'',0,-2.29,5.3,.21);

  const features=detail('features','Spectrum and spectrogram','A windowed Fourier transform gives amplitude by frequency. The spectrogram reveals only completed frames. Twenty-three mel filters and twelve nonzero cepstral coefficients supply the matcher.');
  label(features,'LOOK AT THE CHANGING FREQUENCIES',0,2.45,5.3,.25);const featuresHeader=label(features,'',0,2.09,5.3,.18);
  frame(features,-2.30,.50,4.60,1.13);const spectrum=graph(features,257,C.blue);
  for(const [x,text]of [[-2.30,'0 Hz'],[0,'4 kHz'],[2.30,'8 kHz']])label(features,text,x,.27,.57,.17);
  label(features,'Amplitude: −80 dBFS at bottom, 0 dBFS at top',0,1.82,5.2,.16);
  frame(features,-2.30,-1.35,4.60,1.20);const spectrogram=cells(features,98*65),gramCursor=graph(features,2,C.red);
  label(features,'8 kHz',-2.52,-.15,.42,.14);label(features,'0 Hz',-2.52,-1.35,.42,.14);label(features,'Frame centers in time: 0 → 1,000 ms',0,-1.59,4.8,.18);
  const featureNumbers=label(features,'',0,-1.94,5.3,.19),featureFooter=label(features,'',0,-2.29,5.3,.18);

  const mel=detail('mel','Mel filters and matching features','Each overlapping filter sums weighted spectral power. Taking logarithms and a cosine transform produces the short feature vector used for matching. These are calculated from the currently displayed frame.');
  label(mel,'A SPECTRUM BECOMES MATCHING NUMBERS',0,2.45,5.3,.25);const melHeader=label(mel,'',0,2.07,5.3,.18);
  frame(mel,-2.3,.95,4.6,.72);const filterCurves=Array.from({length:23},(_,i)=>graph(mel,257,[C.blue,C.gold,C.purple][i%3]));
  label(mel,'23 overlapping weights · 0 → 8,000 Hz · height 0 → 1',0,.74,5.3,.17);
  frame(mel,-2.3,-.29,4.6,.70);const melBars=Array.from({length:23},()=>own(kit.box([.13,.01,.025],[0,0,.12],C.blue,mel),C.blue));
  label(mel,'Weighted powers: −80 → 0 dB relative to largest filter',0,-.53,5.3,.17);
  frame(mel,-2.3,-1.67,4.6,.82);line(mel,[[-2.3,-1.26,.08],[2.3,-1.26,.08]],C.gray);
  const cepstralBars=Array.from({length:12},()=>own(kit.box([.24,.01,.025],[0,0,.12],C.purple,mel),C.purple));
  label(mel,'Log powers → cosine transform → c₁ through c₁₂',0,-1.91,5.3,.18);const melFooter=label(mel,'',0,-2.27,5.3,.18);

  const matches=detail('matches','Stored examples and matching','Short-time features are aligned to each stored word by dynamic time warping. The input is a separate take. Lower scores fit better; scores are not confidence percentages.');
  label(matches,'WHICH STORED WORD FITS?',0,2.45,5.3,.26);const matchHeader=label(matches,'',0,2.10,5.3,.18);
  const columns=[-1.45,-.15,.88,1.91];['Candidate','Sound','Context','Total'].forEach((text,i)=>label(matches,text,columns[i],1.72,1.12,.18));
  const scoreRows=Array.from({length:9},(_,i)=>({texts:columns.map(x=>label(matches,'',x,1.40-i*.255,1.10,.182)),bar:own(kit.box([.10,.13,.018],[-2.40,1.40-i*.255,.08],C.gray,matches),C.gray)}));
  frame(matches,-2.13,-1.93,4.26,.80);const alignment=graph(matches,240,C.purple);
  label(matches,'Alignment: received frames → · stored frames ↑',0,-2.14,5.3,.16);const matchFooter=label(matches,'',0,-2.42,5.3,.15);

  const context=detail('context','Same sound, different words','Right and write share a pronunciation. The same acoustic template is deliberately used for both, while assigned context preferences can choose one spelling. A neutral tie performs no action.');
  label(context,'SOUND ALONE CANNOT PICK THE SPELLING',0,2.45,5.3,.25);
  label(context,'RIGHT     /r aɪ t/     WRITE',0,1.91,5.0,.31);
  label(context,'Dictionary pronunciation, not decoded sound boundaries',0,1.52,5.3,.17);
  const contextPrompt=label(context,'',0,.98,5.1,.26),contextSound=label(context,'',0,.45,5.1,.20),contextScores=label(context,'',0,-.10,5.1,.22);
  const preferenceBars=[-1.2,1.2].map(x=>own(kit.box([.52,.80,.05],[x,-.94,.05],C.gold,context),C.gold));
  const preferenceLabels=[-1.2,1.2].map(x=>label(context,'',x,-1.55,1.6,.21));
  const contextResult=label(context,'',0,-2.03,5.3,.22);label(context,'Assigned preferences illustrate context, not certainty',0,-2.40,5.3,.17);
  return {system,phone,shell,back,board,battery,power,contactA,contactB,switchPivot,microphone,diaphragm,membrane,adc,processor,processorBody,memory,clock,traces,paths,wireMeshes,display,bezel,screen,cable,outputPaths,outputMarker,signalMarkers,grid,token,tokenRing,runner,runnerDot,screenStatus,screenWord,confirmation,screenFooter,voice,waves,airArcs,guides,title,status,samples,samplesHeader,waveform,sampleCursor,sampleBracket,rawFrame,windowedFrame,windowLine,sampleNumber,sampleBits,features,featuresHeader,spectrum,spectrogram,gramCursor,featureNumbers,featureFooter,mel,melHeader,filterCurves,melBars,cepstralBars,melFooter,matches,matchHeader,scoreRows,alignment,matchFooter,context,contextPrompt,contextSound,contextScores,preferenceBars,preferenceLabels,contextResult,details:[samples,features,mel,matches,context]};
}

export function recognitionSpectrum(frame,plan){
  if(!frame)return [];
  const sum=plan.window.reduce((a,b)=>a+b,0);
  return Array.from(frame.power,(p,k)=>Math.max(-80,20*Math.log10(Math.max(1e-12,(k===0 || k===frame.power.length-1?1:2)*Math.sqrt(p)/sum))));
}

export function updateRecognitionGeometry(g,s,p){
  const v=s.values, listening=s.stage==='listening', receiving=listening && !!v.microphone;
  g.title.userData.setText(`Recorded “${COMMAND_WORDS[v.word]}” · Voice ${v.voice?'B':'A'}`);
  g.status.userData.setText(s.stage==='ready'?'Play, then follow sound → samples → word':s.stage==='listening'?'Capturing complete frames':s.stage==='choosing'?'Comparing words and context':s.accepted?`“${s.word}”${s.matchesRecording?'':' · recognition mistake'} → ${v.application?'text':s.action??'no command'}`:s.reason);
  g.switchPivot.rotation.z=v.microphone?0:.75;
  g.membrane.position.z=.48+(receiving?s.sample*.035:0);
  g.processorBody.material.color.setHex(s.accepted?C.board:s.stage==='choosing'?C.gold:C.ink);
  for(let i=0;i<g.airArcs.length;i++){
    const f=(s.time*2+i/4)%1,x=-3.27+f*.66,y=-1.31-f*.36;
    fillLine(g.airArcs[i],Array.from({length:17},(_,j)=>{const a=-.8+j*.1;return [x+.08*Math.cos(a),y+.27*Math.sin(a),.37];}));g.airArcs[i].visible=listening;
  }
  g.signalMarkers.forEach(({key,object},i)=>{object.visible=receiving || key==='stored' && s.stage==='choosing';object.position.copy(onPath(g.paths[key],(s.time*1.5+i/3)%1));});
  g.outputMarker.visible=s.accepted && s.time<p.actionEnd;g.outputMarker.position.copy(onPath(g.outputPaths.data,s.fraction));
  g.screenStatus.userData.setText(s.stage==='ready'?'Ready':s.stage==='listening'?'Listening…':s.stage==='choosing'?'Choosing…':s.accepted?'Selected word':'No word selected');
  g.screenWord.userData.setText(s.decided?(s.word??'Try again'):'…');
  const pos=v.application?[0,0]:s.position;
  g.runner.visible=!v.application;g.runnerDot.position.set(.15*Math.cos(s.runnerAngle),.15*Math.sin(s.runnerAngle),.025);
  g.grid.visible=!v.application;g.token.position.set(1.53+pos[0]*.53,-.25+pos[1]*.53,.265);g.tokenRing.position.copy(g.token.position);g.tokenRing.position.z=.29;
  g.token.material.color.setHex(s.action==='confirm'?C.board:s.action==='cancel'?C.red:C.blue);g.tokenRing.visible=s.action==='confirm';
  g.confirmation.userData.setText(v.application?(s.dictation?`Text: ${s.dictation}`:'Dictation waits'):s.action==='confirm'?'Confirmed ✓':s.action==='cancel'?'Canceled':s.action==='run'?'Running':s.action==='stop'?'Stopped':s.accepted&&s.action==='move'?`Moved ${s.word}`:s.accepted?'No assigned command':'');
  g.screenFooter.userData.setText(s.accepted&&!s.matchesRecording?'This recognition is wrong':v.application?'Word becomes editable text':'Local application only');

  g.samplesHeader.userData.setText(`${p.rate.toLocaleString('en-US')} samples/s · ${s.framesArrived} / ${p.analysis.count} frames arrived`);
  const points=[];for(let n=0;n<s.samplesArrived;n+=8)points.push([-2.35+4.7*n/p.audio.samples.length,1.10+p.audio.samples[n]*.45,.12]);
  fillLine(g.waveform,points);fillLine(g.sampleCursor,s.samplesArrived?[[-2.35+4.7*s.samplesArrived/p.audio.samples.length,.62,.14],[-2.35+4.7*s.samplesArrived/p.audio.samples.length,1.58,.14]]:[]);
  const f=s.frame;
  if(f){const x0=-2.35+4.7*f.start/p.audio.samples.length,x1=-2.35+4.7*f.end/p.audio.samples.length;fillLine(g.sampleBracket,[[x0,.62,.13],[x1,.62,.13],[x1,1.58,.13],[x0,1.58,.13],[x0,.62,.13]]);}else fillLine(g.sampleBracket,[]);
  const framePoints=fn=>f?Array.from({length:p.analysis.length},(_,i)=>[-2.35+4.7*i/(p.analysis.length-1),-.72+fn(i)*.47,.12]):[];
  fillLine(g.rawFrame,framePoints(i=>p.audio.samples[f.start+i]));fillLine(g.windowedFrame,framePoints(i=>f.windowed[i]));fillLine(g.windowLine,framePoints(i=>p.window[i]));
  g.sampleNumber.userData.setText(f?`Frame ${f.index+1}: ${(f.start/p.rate*1000).toFixed(0)}–${(f.end/p.rate*1000).toFixed(0)} ms · RMS ${f.rms.toFixed(4)}`:'No complete frame yet');
  g.sampleBits.userData.setText(`Latest sample ${s.sampleCode} · bits ${s.sampleBits}`);

  const spectrum=recognitionSpectrum(f,p);fillLine(g.spectrum,spectrum.map((db,k)=>[-2.30+4.60*(k*p.rate/p.analysis.nfft)/8000,.50+(Math.min(0,db)+80)/80*1.13,.13]));
  g.featuresHeader.userData.setText(`${p.analysis.length} samples per frame · ${p.analysis.nfft} FFT points · Nyquist ${p.rate/2} Hz`);
  const color=new THREE.Color(),paper=new THREE.Color(C.paper),ink=new THREE.Color(C.blue),count=s.framesArrived*65;
  if(g.gramPlan!==p.analysis || g.gramFrames!==s.framesArrived){
    for(let i=0;i<s.framesArrived;i++){
      const frame=p.analysis.frames[i],levels=recognitionSpectrum(frame,p),center=(frame.start+p.analysis.length/2)/p.rate;
      for(let b=0;b<65;b++){
        const hz=b*8000/64,k=Math.min(levels.length-1,Math.round(hz*p.analysis.nfft/p.rate));
        color.copy(paper).lerp(ink,hz>p.rate/2?0:Math.max(0,Math.min(1,(levels[k]+65)/55)));
        setCell(g.spectrogram,i*65+b,-2.30+4.60*(center-.005),-1.35+1.20*Math.max(0,hz-62.5)/8000,-2.30+4.60*(center+.005),-1.35+1.20*Math.min(8000,hz+62.5)/8000,color);
      }
    }
    changedCells(g.spectrogram,count);g.gramPlan=p.analysis;g.gramFrames=s.framesArrived;
  }
  const gramEnd=s.framesArrived?(p.analysis.frames[s.framesArrived-1].start+p.analysis.length/2)/p.rate+.005:0;
  fillLine(g.gramCursor,s.framesArrived?[[-2.30+4.60*gramEnd,-1.35,.14],[-2.30+4.60*gramEnd,-.15,.14]]:[]);
  g.featureNumbers.userData.setText(f?`23 mel filters → 12 matching numbers · c₁ ${f.ceps[1].toFixed(2)} · c₂ ${f.ceps[2].toFixed(2)}`:'The first complete frame supplies the first features');
  g.featureFooter.userData.setText(`${['Hamming','Hann','Rectangular'][v.window]} window · strongest sidelobe ${p.leakage.sidelobe.toFixed(1)} dB`);

  g.melHeader.userData.setText(f?`Current frame: ${(f.start/p.rate*1000).toFixed(0)}–${(f.end/p.rate*1000).toFixed(0)} ms`:'Filters are ready; input features wait for samples');
  if(g.filterBank!==p.bank){g.filterCurves.forEach((curve,j)=>fillLine(curve,Array.from(p.bank.filters[j].weights,(w,k)=>[-2.3+4.6*k*p.rate/p.analysis.nfft/8000,.95+.72*w,.12])));g.filterBank=p.bank;}
  const melMax=f?Math.max(...f.mel):0,cepsMax=f?Math.max(1,...Array.from(f.ceps).slice(1).map(Math.abs)):1;
  g.melBars.forEach((bar,j)=>{bar.visible=!!f;const db=f&&melMax?Math.max(-80,10*Math.log10(Math.max(1e-30,f.mel[j]/melMax))):-80,height=.70*(db+80)/80;bar.scale.y=Math.max(.001,height)/.01;bar.position.set(-2.3+4.6*(j+.5)/23,-.29+height/2,.12);});
  g.cepstralBars.forEach((bar,j)=>{bar.visible=!!f;const signed=f?.ceps[j+1]??0,height=.40*signed/cepsMax;bar.scale.y=Math.max(.001,Math.abs(height))/.01;bar.position.set(-2.3+4.6*(j+.5)/12,-1.26+height/2,.12);bar.material.color.setHex(signed>=0?C.purple:C.gold);});
  g.melFooter.userData.setText(f?`Coefficient scale: ±${cepsMax.toFixed(2)} · c₀ omitted from matching`:'No future filter outputs or coefficients are shown');

  g.matchHeader.userData.setText(`Reference voices: ${['A only','B only','A and B'][v.examples]} · input is a separate take`);
  g.scoreRows.forEach(({texts,bar},i)=>{
    const c=s.candidates[i],values=c?[c.word,c.distance.toFixed(3),(c.score-c.distance).toFixed(3),c.score.toFixed(3)]:['','','',''];texts.forEach((text,j)=>text.userData.setText(values[j]));bar.visible=!!c;bar.material.color.setHex(i===0?C.gold:C.gray);
  });
  const historyKey=`${s.framesArrived}:${s.best?.family}:${s.best?.voice}`;
  if(g.alignmentPlan!==p.analysis || g.alignmentKey!==historyKey){
    const ref=s.best?p.references.find(x=>x.word===s.best.family && x.voice===s.best.voice):null;
    const seq=s.history?.received?p.analysis.sequence.slice(0,s.history.received):[];
    const path=ref && seq.length?commandDtw(seq,ref.sequence,{path:true}).path:[];
    fillLine(g.alignment,path.map(([i,j])=>[-2.13+4.26*i/Math.max(1,seq.length-1),-1.93+.80*j/Math.max(1,ref.sequence.length-1),.12]));g.alignmentPlan=p.analysis;g.alignmentKey=historyKey;
  }
  g.matchFooter.userData.setText(s.best?`Lead ${s.lead.toFixed(3)}; requires ${RECOGNITION.minimumLead.toFixed(2)} · ${s.decided?s.reason:'tentative until recording ends'}`:'No input frames to match');

  g.contextPrompt.userData.setText(['No contextual clue','“Turn ___.”','“Please ___ it.”'][v.context]);
  const right=s.candidates.find(x=>x.word==='right'),write=s.candidates.find(x=>x.word==='write'),priors=v.context===0?[.5,.5]:v.context===1?[.9,.1]:[.1,.9];
  g.contextSound.userData.setText(right?`Same acoustic distance: ${right.distance.toFixed(3)} for both`:'Same pronunciation; sound has not arrived yet');
  g.contextScores.userData.setText(right?`Total: right ${right.score.toFixed(3)} · write ${write.score.toFixed(3)}`:'Acoustic scores wait for input');
  g.preferenceBars.forEach((bar,i)=>{bar.scale.y=priors[i];bar.position.y=-1.36+.40*priors[i];});
  g.preferenceLabels.forEach((label,i)=>label.userData.setText(`${i?'write':'right'}: ${priors[i].toFixed(2)}`));
  g.contextResult.userData.setText(s.decided?(s.word?`Chosen word: ${s.word}`:`No word: ${s.reason}`):'The decision waits for the complete recording');
}
