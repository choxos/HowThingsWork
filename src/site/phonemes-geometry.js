import * as THREE from 'three';
import {fillLine,lineObject,textLabel} from './scene-kit.js';
import {VOWELS,GROUPS,TABLE_II,MEASUREMENTS,phonemeSpectrum,phonemeTransfer,PHONEME_TIMING} from './phonemes-physics.js';

const C={ink:0x374736,paper:0xfbf6e9,pale:0xe7dfce,blue:0x397b94,gold:0x9b711d,red:0xc14f39,purple:0x8063a3,gray:0xa8b4a4,green:0xd5e1c4};
const label=(p,text,x,y,w=5.8,h=.20,z=.16,color='#374736')=>textLabel(p,text,{width:w,height:h,position:[x,y,z],color});
const graph=(p,n,color=C.blue)=>lineObject(n,color,p);
const line=(p,points,color=C.gray)=>{const o=graph(p,points.length,color);fillLine(o,points);return o;};
const rect=(p,x,y,w,h)=>line(p,[[x,y,.05],[x+w,y,.05],[x+w,y+h,.05],[x,y+h,.05],[x,y,.05]]);
const own=(o)=>{o.material=o.material.clone();return o;};

function gram(parent,x,y,w,h){
  const count=208*129,geometry=new THREE.BufferGeometry(),indices=[];
  for(let i=0;i<count;i++){const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);}
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*12),3));geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*12),3));geometry.setIndex(indices);geometry.setDrawRange(0,0);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false}));mesh.frustumCulled=false;parent.add(mesh);rect(parent,x,y,w,h);
  const cursor=graph(parent,2,C.red);return {mesh,cursor,x,y,w,h,previous:0,analysis:null};
}
function updateGram(g,s,p){
  const fresh=g.analysis!==p.analysis||g.previous>s.framesArrived,first=fresh?0:g.previous,positions=g.mesh.geometry.attributes.position,colors=g.mesh.geometry.attributes.color,paper=new THREE.Color(C.paper),ink=new THREE.Color(C.blue),color=new THREE.Color();
  for(let f=first;f<s.framesArrived;f++){
    const frame=p.frames[f],db=phonemeSpectrum(frame,p),center=(frame.start+p.frame.length/2)/p.rate;
    for(let b=0;b<129;b++){
      const hz=b*62.5,k=Math.min(db.length-1,Math.round(hz*p.frame.nfft/p.rate)),i=f*129+b;
      const x0=g.x+g.w*(center-.005)/p.duration,x1=g.x+g.w*(center+.005)/p.duration,y0=g.y+g.h*Math.max(0,hz-31.25)/8000,y1=g.y+g.h*Math.min(8000,hz+31.25)/8000;
      positions.array.set([x0,y0,.10,x1,y0,.10,x1,y1,.10,x0,y1,.10],i*12);
      color.copy(paper).lerp(ink,hz>p.rate/2?0:Math.max(0,Math.min(1,(db[k]+65)/55)));
      for(let j=0;j<4;j++)colors.array.set([color.r,color.g,color.b],i*12+j*3);
    }
  }
  if(fresh||first!==s.framesArrived){positions.needsUpdate=true;colors.needsUpdate=true;g.mesh.geometry.setDrawRange(0,s.framesArrived*129*6);g.mesh.geometry.boundingBox=null;g.mesh.geometry.boundingSphere=null;}
  const end=s.framesArrived?(p.frames[s.framesArrived-1].start+p.frame.length/2)/p.rate+.005:0;
  fillLine(g.cursor,s.framesArrived?[[g.x+g.w*end/p.duration,g.y,.14],[g.x+g.w*end/p.duration,g.y+g.h,.14]]:[]);
  g.previous=s.framesArrived;g.analysis=p.analysis;
}

export function createPhonemeGeometry(kit){
  const system=kit.part('system','Sound source, filter and pattern','A functional source-filter diagram. Periodic excitation or turbulence passes through a chosen filter to produce the exact samples used by the analyzer. Housings and moving markers are illustrative, not anatomical cavities.');
  system.userData.explosionCategory=true;
  const part=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const source=part('source','Periodic voice or turbulence','Vocal-fold vibration provides harmonic excitation for vowels. Turbulence at a constriction provides noise for fricatives. The diagram separates these sources so their effects can be compared.');
  kit.box([1.18,1.39,.20],[-2.41,1.07,0],C.pale,source);
  label(source,'SOURCE',-2.41,1.94,1.2,.17);const sourceTitle=label(source,'',-2.41,1.58,1.1,.17);
  const foldA=kit.box([.15,.44,.15],[-2.51,1.04,.18],C.gold,source),foldB=kit.box([.15,.44,.15],[-2.31,1.04,.18],C.gold,source);
  const nozzle=new THREE.Group();source.add(nozzle);kit.box([.30,.12,.15],[-2.41,1.25,.18],C.blue,nozzle);kit.box([.30,.12,.15],[-2.41,.93,.18],C.blue,nozzle);
  const sourceTrace=graph(source,400,C.blue),sourceNumber=label(source,'',-2.41,.50,1.1,.16);
  const filters=part('filters','Vowel resonances or frication band','Three second-order resonance filters use measured vowel formants. Fricatives use an assigned broad noise band instead. The simplified [z] voice component bypasses that noise filter before being added at the output. Sliders mark frequency on a common 0–8 kHz scale; they are not measured anatomical dimensions.');
  const resonators=[-.78,.22,1.22].map((x,i)=>{
    const group=new THREE.Group();filters.add(group);
    kit.box([.72,1.39,.20],[x,1.07,0],C.green,group);label(group,`F${i+1}`,x,1.60,.62,.16);
    line(group,[[x,.75,.15],[x,1.37,.15]],C.ink);const slider=kit.box([.38,.07,.07],[x,1,.19],C.gold,group),number=label(group,'',x,.50,.86,.16);return {group,slider,number,x};
  });
  label(filters,'VOCAL TRACT FILTER',.22,1.94,2.9,.17);
  const noiseFilter=new THREE.Group();filters.add(noiseFilter);kit.box([2.72,1.39,.20],[.22,1.07,.02],C.green,noiseFilter);
  label(noiseFilter,'FRONT-CAVITY FILTER',.22,1.58,2.55,.18);const noiseBand=graph(noiseFilter,129,C.ink),noiseNumber=label(noiseFilter,'',.22,.50,2.55,.17);
  const output=part('output','Resulting sound','The synthesized samples are both the analyzer input and optional audio output. Each sustained sound lasts 800 ms, with short fades and a separating gap.');
  kit.box([.94,1.39,.20],[2.48,1.07,0],C.pale,output);kit.disk(.31,.11,[2.48,1.16,.17],C.ink,output);const cone=own(kit.disk(.22,.02,[2.48,1.16,.24],C.blue,output));
  label(output,'SOUND',2.48,1.94,1.1,.17);const outputTitle=label(output,'',2.48,.58,.88,.20);
  const routes=new THREE.Group();system.add(routes);routes.userData.explosionExcluded=true;
  for(const [a,b] of [[[-1.82,1.06,.10],[-1.15,1.06,.10]],[[1.59,1.06,.10],[2.01,1.06,.10]]])kit.rod(a,b,.023,C.gold,routes);
  const vowelLinks=new THREE.Group();routes.add(vowelLinks);
  for(const x of [-.28,.72])kit.rod([x-.14,1.06,.10],[x+.14,1.06,.10],.023,C.gold,vowelLinks);
  const markers=[-1.49,1.8].map(x=>own(kit.sphere(.045,[x,1.06,.19],C.gold,routes)));
  const voicingRoute=new THREE.Group();routes.add(voicingRoute);
  line(voicingRoute,[[-1.82,.76,.16],[-1.49,.76,.16],[-1.49,.13,.16],[1.80,.13,.16],[1.80,.76,.16],[2.01,.76,.16]],C.purple);
  label(voicingRoute,'Voice added after the noise filter',.22,.31,2.75,.14);
  const title=label(system,'',0,2.45,6.15,.27),subtitle=label(system,'Functional sound model · not an anatomical simulation',0,2.16,6.15,.16);
  label(system,'ACTUAL SPECTROGRAM',0,-.14,5.8,.18);
  const overviewGram=gram(system,-2.68,-1.71,5.36,1.31);
  label(system,'8 kHz',-2.95,-.40,.47,.14);label(system,'0 Hz',-2.95,-1.71,.47,.14);
  label(system,'Time: 0 → 2.1 seconds · darker = stronger',0,-1.86,5.8,.18);
  const status=label(system,'',0,-2.23,6.15,.19),footer=label(system,'Play to send two sounds through the same analyzer',0,-2.54,6.15,.17);

  const details=[];
  const detail=(id,name,description)=>{const p=kit.part(id,name,description,[0,0,0],system);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;details.push(p);return p;};
  const spectrum=detail('spectrum','One frame and its spectrum','The latest complete 25 ms frame produces a Fourier spectrum. Gold lines mark the assigned formant frequencies, while blue peaks show the harmonics actually present. A formant need not coincide with an FFT peak.');
  label(spectrum,'ONE SHORT FRAME, MANY FREQUENCIES',0,2.45,5.8,.25);const spectrumHeader=label(spectrum,'',0,2.08,5.8,.19);
  rect(spectrum,-2.65,.80,5.3,.68);line(spectrum,[[-2.65,1.14,.06],[2.65,1.14,.06]],C.pale);
  const rawFrame=graph(spectrum,400,C.gray),windowedFrame=graph(spectrum,400,C.blue),windowLine=graph(spectrum,400,C.gold);
  label(spectrum,'25 ms · gray raw · blue windowed · gold taper',0,.58,5.8,.18);
  rect(spectrum,-2.65,-1.23,5.3,1.35);const spectrumLine=graph(spectrum,257,C.blue),formantMarks=Array.from({length:3},()=>graph(spectrum,2,C.gold));
  const formantLabels=Array.from({length:3},()=>label(spectrum,'',0,.29,.70,.15));
  for(const [x,text]of [[-2.65,'0 Hz'],[0,'4 kHz'],[2.65,'8 kHz']])label(spectrum,text,x,-1.47,.55,.17);
  const spectrumValues=label(spectrum,'',0,-1.87,5.8,.19),spectrumFooter=label(spectrum,'',0,-2.22,5.8,.18);label(spectrum,'Amplitude scale: −80 dBFS at bottom, 0 at top',0,-2.54,5.8,.16);

  const spectrogram=detail('spectrogram','Changing frequencies through time','Only completed frames appear in this time-frequency map. Vowels produce harmonic bands; frication spreads energy over a broader region. A second panel compares spectra from each completed sound.');
  label(spectrogram,'TWO SOUNDS LEAVE TWO PATTERNS',0,2.45,5.8,.25);const gramHeader=label(spectrogram,'',0,2.10,5.8,.19);
  const detailGram=gram(spectrogram,-2.60,.04,5.2,1.65);
  label(spectrogram,'8 kHz',-2.88,1.69,.48,.14);label(spectrogram,'0 Hz',-2.88,.04,.48,.14);label(spectrogram,'0 → 2.1 s · blank regions contain no future frames',0,-.20,5.8,.17);
  rect(spectrogram,-2.60,-1.69,5.2,1.08);const comparisons=[graph(spectrogram,257,C.blue),graph(spectrogram,257,C.red)];
  label(spectrogram,'0 → 8 kHz · blue first sound · red second sound',0,-1.93,5.8,.18);
  const gramFooter=label(spectrogram,'',0,-2.31,5.8,.19);

  const vowels=detail('vowels','Measured vowel chart','Historical formant measurements show overlapping vowel distributions. Large markers indicate the selected vowel targets; small dots are 1,520 measured productions. The reference group changes published centroids and distance counts, not the sound.');
  label(vowels,'ONE VOWEL, MANY DIFFERENT VOICES',0,2.45,5.8,.25);const vowelHeader=label(vowels,'',0,2.08,5.8,.18);
  const point=(f1,f2)=>[-2.43+4.86*(3800-f2)/3400,1.50-2.91*(f1-150)/1250,.10];
  rect(vowels,-2.43,-1.41,4.86,2.91);
  for(const f2 of [1000,2000,3000]){const x=point(150,f2)[0];line(vowels,[[x,-1.41,.06],[x,1.5,.06]],C.pale);label(vowels,String(f2),x,-1.61,.63,.15);}
  for(const f1 of [200,600,1000,1400]){const y=point(f1,400)[1];line(vowels,[[-2.43,y,.06],[2.43,y,.06]],C.pale);label(vowels,String(f1),-2.69,y,.45,.15);}
  const dotGeometry=new THREE.BufferGeometry();dotGeometry.setAttribute('position',new THREE.Float32BufferAttribute(MEASUREMENTS.flatMap(r=>point(r.f1,r.f2)),3));
  const cloud=new THREE.Points(dotGeometry,new THREE.PointsMaterial({size:3,sizeAttenuation:false,color:C.gray,transparent:true,opacity:.63}));vowels.add(cloud);
  const means=VOWELS.map(v=>label(vowels,v.ipa,0,0,.25,.17,.15,'#374736'));
  const selected=[C.blue,C.red].map(color=>kit.ring(.085,.018,[0,0,.19],color,vowels));
  label(vowels,'F2 decreases → (Hz) · F1 increases downward',0,-1.92,5.8,.18);
  const vowelFooter=label(vowels,'',0,-2.25,5.8,.19),vowelNote=label(vowels,'',0,-2.56,5.8,.16);

  const comparison=detail('comparison','Compare the two sounds','Measured target formants and pitch are shown separately from analyzed spectral power. Results appear only after each sound finishes. The selected symbols name the synthesized input; this lesson does not detect phonemes.');
  label(comparison,'WHAT CHANGED BETWEEN THE SOUNDS?',0,2.45,5.8,.25);
  const resultNames=[label(comparison,'',-1.49,1.96,2.45,.31,.16,'#397b94'),label(comparison,'',1.49,1.96,2.45,.31,.16,'#c14f39')];
  const rowLabels=['Excitation','Pitch F0','Formants F1 / F2 / F3','Power below 1 kHz','Power above 4 kHz','Spectral centroid'];
  const resultRows=rowLabels.map((text,i)=>{const y=1.45-i*.51;label(comparison,text,0,y,5.6,.17);return [-1.49,1.49].map(x=>label(comparison,'',x,y-.23,2.66,.19));});
  const resultFooter=label(comparison,'',0,-2.08,5.8,.20);label(comparison,'Formants are targets; power measures one completed 25 ms frame',0,-2.47,5.8,.16);
  return {system,source,sourceTitle,sourceNumber,sourceTrace,foldA,foldB,nozzle,filters,resonators,noiseFilter,noiseBand,noiseNumber,output,cone,outputTitle,routes,vowelLinks,markers,voicingRoute,title,subtitle,overviewGram,status,footer,
    spectrum,spectrumHeader,rawFrame,windowedFrame,windowLine,spectrumLine,formantMarks,formantLabels,spectrumValues,spectrumFooter,
    spectrogram,gramHeader,detailGram,comparisons,gramFooter,vowels,vowelHeader,point,cloud,means,selected,vowelFooter,vowelNote,
    comparison,resultNames,resultRows,resultFooter,details};
}

export function updatePhonemeGeometry(g,s,p){
  const index=s.active>=0?s.active:s.complete?1:0,token=p.tokens[index],q=token.parameters,v=s.values,emitting=s.active>=0&&!!v.airflow,names=p.tokens.map(t=>`[${t.parameters.ipa}]`);
  g.title.userData.setText(`${names[0]} → ${names[1]} · how sound patterns differ`);
  g.sourceTitle.userData.setText(q.kind==='vowel'?'VOICE':q.voiced?'VOICE + NOISE':'TURBULENCE');
  g.sourceNumber.userData.setText(q.f0?`${q.f0.toFixed(0)} Hz pitch`:'No periodic pitch');
  const folds=q.kind==='vowel'||q.voiced;g.foldA.visible=folds;g.foldB.visible=folds;g.nozzle.visible=q.kind==='fricative';
  const opening=emitting&&folds?.04+.08*(.5+.5*Math.sin(s.time*q.f0*.16)):0;g.foldA.position.x=-2.48-opening;g.foldB.position.x=-2.34+opening;
  g.foldA.position.y=g.foldB.position.y=q.voiced?.76:1.04;
  const sourceArrived=emitting?Math.min(token.count,Math.max(0,s.arrived-Math.round(p.starts[index]*p.rate))):0;
  const sourceCount=Math.min(120,sourceArrived),sourceStart=sourceArrived-sourceCount;
  fillLine(g.sourceTrace,emitting?Array.from({length:sourceCount},(_,i)=>[-2.91+i/119,.23+.09*token.source[sourceStart+i],.21]):[]);
  g.resonators.forEach((r,i)=>{r.group.visible=q.kind==='vowel';r.slider.visible=q.kind==='vowel';r.number.userData.setText(q.kind==='vowel'?`${q.formants[i]} Hz`:'');if(q.kind==='vowel')r.slider.position.y=.75+.62*q.formants[i]/8000;});
  g.noiseFilter.visible=q.kind==='fricative';
  g.vowelLinks.visible=q.kind==='vowel';
  g.voicingRoute.visible=!!q.voiced;
  if(q.kind==='fricative'){fillLine(g.noiseBand,Array.from({length:129},(_,i)=>[-.95+i/128*2.34,.75+.62*phonemeTransfer(q,i*62.5).re,.20]));g.noiseNumber.userData.setText(`Assigned band center ${q.center} Hz`);}
  g.cone.position.z=.28+(emitting?s.sample*.045:0);g.outputTitle.userData.setText(emitting?names[index]:s.complete?'Finished':'Waiting');
  g.markers.forEach((o,i)=>{o.visible=emitting;o.position.x=(i?1.59:-1.82)+((s.time*2+i*.3)%1)*(i?.42:.67);});
  updateGram(g.overviewGram,s,p);updateGram(g.detailGram,s,p);
  g.status.userData.setText(s.status);g.footer.userData.setText(`${s.framesArrived} / ${p.frames.length} complete frames · ${v.rate} kHz sampling · ${v.airflow?'airflow on':'airflow off'}`);

  const f=s.frame,frameSound=f?p.starts.findIndex(start=>(f.start+p.frame.length/2)/p.rate>=start&&(f.start+p.frame.length/2)/p.rate<start+PHONEME_TIMING.segment):-1,frameParameters=frameSound>=0?p.tokens[frameSound].parameters:null;
  g.spectrumHeader.userData.setText(f?`${(f.start/p.rate*1000).toFixed(0)}–${(f.end/p.rate*1000).toFixed(0)} ms · ${frameParameters?`[${frameParameters.ipa}]`:'quiet gap'}`:'No complete frame has arrived');
  const points=fn=>f?Array.from({length:p.frame.length},(_,i)=>[-2.65+5.3*i/(p.frame.length-1),1.14+.30*fn(i),.12]):[];
  fillLine(g.rawFrame,points(i=>p.samples[f.start+i]));fillLine(g.windowedFrame,points(i=>f.windowed[i]));fillLine(g.windowLine,points(i=>p.window[i]));
  fillLine(g.spectrumLine,phonemeSpectrum(f,p).map((db,k)=>[-2.65+5.3*k*p.rate/p.frame.nfft/8000,-1.23+(Math.min(0,db)+80)/80*1.35,.12]));
  g.formantMarks.forEach((line,i)=>{const hz=frameParameters?.formants[i],x=-2.65+5.3*(hz??0)/8000;fillLine(line,hz?[[x,-1.23,.15],[x,.12,.15]]:[]);g.formantLabels[i].userData.setText(hz?`F${i+1}`:'');g.formantLabels[i].position.x=x;});
  g.spectrumValues.userData.setText(frameParameters?.formants.length?`Target formants: ${frameParameters.formants.join(' / ')} Hz`:frameParameters?`Noise band centered at ${frameParameters.center} Hz${frameParameters.f0?' · plus periodic voice':''}`:'No active sound in this frame');
  g.spectrumFooter.userData.setText(`${['Hamming','Hann','Rectangular'][v.window]} · ${p.frame.length} samples · ${p.frame.nfft} FFT points · ${p.rate/p.frame.nfft} Hz grid`);
  g.gramHeader.userData.setText(`${names[0]} first · ${names[1]} second · Nyquist ${p.rate/2} Hz`);
  g.comparisons.forEach((o,i)=>fillLine(o,s.finished[i]?phonemeSpectrum(p.frames[p.midFrames[i]],p).map((db,k)=>[-2.6+5.2*k*p.rate/p.frame.nfft/8000,-1.69+(Math.min(0,db)+80)/80*1.08,.12+i*.01]):[]));
  g.gramFooter.userData.setText(s.heard===2?'Both patterns are ready to compare':s.heard===1?'First sound complete; second spectrum waits':'Comparison spectra appear after each sound finishes');

  g.vowelHeader.userData.setText(`Small dots: 1,520 measurements · labels: ${GROUPS[v.references].name}’s published means`);
  g.means.forEach((o,i)=>{const pt=g.point(TABLE_II.f1[v.references][i],TABLE_II.f2[v.references][i]);o.position.set(pt[0],pt[1],.15);});
  g.selected.forEach((o,i)=>{const f=p.tokens[i].parameters.formants;o.visible=f.length>0;if(f.length)o.position.set(...g.point(f[0],f[1]));o.position.z=.20+i*.03;});
  const r=p.referenceStats;g.vowelFooter.userData.setText(`${r.right} / 1,520 nearest own vowel using ${GROUPS[v.references].name}’s means`);
  g.vowelNote.userData.setText(`Children: ${r.children}/300 · own-group means: ${r.ownGroup}/1,520 · distance is not listener accuracy`);
  p.tokens.forEach((t,i)=>{
    const q=t.parameters,b=s.bandResults[i];g.resultNames[i].userData.setText(`[${q.ipa}] as in ${q.word}`);
    const row=[q.kind==='vowel'?'Periodic voice':q.voiced?'Noise + periodic voice':'Noise',q.f0?`${q.f0.toFixed(1)} Hz`:'None',q.formants.length?`${q.formants.join(' / ')} Hz`:'No vowel targets',b?(b.total?`${(100*b.low).toFixed(1)}%`:'No energy'):'Waiting',b?(b.total?`${(100*b.high).toFixed(1)}%`:'No energy'):'Waiting',b?(b.centroid===null?'No energy':`${b.centroid.toFixed(0)} Hz`):'Waiting'];
    row.forEach((text,j)=>g.resultRows[j][i].userData.setText(text));
  });
  g.resultFooter.userData.setText(!v.airflow?'Airflow off: no acoustic energy in either segment':s.complete?'Both measured patterns are ready to compare':'Play to measure both sounds');
}
