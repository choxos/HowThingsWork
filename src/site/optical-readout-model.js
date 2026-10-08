import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {surface,lineObject,segmentLines,fillLine,textLabel} from './scene-kit.js';
import {READOUT,READOUT_DEFAULTS as D,READOUT_DOMAINS,createReadoutController} from './optical-readout-physics.js';

const VIOLET=0x8351b2,GOLD=0xb17e26,INK=0x394233,RED=0xb74130,GLASS=0xa6c7cc;

function geometry(kit){
  const {part,box,cylinder,rod}=kit;
  const system=part('system','Optical-disc readout','An enlarged cutaway connects a moving track, optical pickup, photodiode and receiver. The optical train is schematic. The receiver uses an explicitly assigned response, not a calculation of real Blu-ray diffraction.');
  const assembly=part('assembly','Connected optical pickup and receiver','Violet light travels from the laser to the moving track. Gold shows returned light reaching the detector. A cable takes the electrical signal to the receiver board. The bit display comes from received samples.',[0,0,0],system);
  const pickup=part('pickup','Pickup beneath the track','The laser, collimator, polarizing splitter, quarter-wave plate, fold mirror and objective share a supported carriage. The moving track section stays in this inspection for context. The spindle and positioning servos are outside the close-up.',[0,0,0],assembly);
  const base=box([3.7,.16,1.0],[-1.65,-1.25,0],'cream',pickup);
  const detectorBracket=box([.82,.08,.72],[-2,-1.12,.76],'metal',pickup);
  for(const z of [-.36,.36])rod([-3.6,-1.45,z],[.35,-1.45,z],.05,'metal',pickup);
  for(const x of [-3.15,-.15])for(const z of [-.36,.36])box([.28,.18,.20],[x,-1.39,z],'clay',pickup);
  const source=part('source','Laser and collimating lens','A violet laser sends light toward a collimator. The collimator reduces the beam divergence before the objective focuses it on the data layer. Read-light level changes the assigned collected power; 0 turns off the light.',[0,0,0],pickup);
  const laser=cylinder(.15,.42,[-3.16,-.65,0],'ink',source);laser.rotation.z=Math.PI/2;
  const collimator=cylinder(.20,.06,[-2.73,-.65,0],GLASS,source);collimator.rotation.z=Math.PI/2;
  box([.55,.43,.42],[-3.15,-1,0],'metal',source);box([.12,.34,.12],[-2.73,-1.01,0],'metal',source);
  const splitter=part('splitter','Polarizing beam splitter','The outgoing polarization passes through the cube. After a round trip through the quarter-wave plate, returned light has a perpendicular linear polarization and is redirected toward the detector. This is one common pickup arrangement.',[0,0,0],pickup);
  const cube=box([.40,.40,.40],[-2,-.65,0],GLASS,splitter);
  const splitterFace=box([.015,.40,.56],[-2,-.65,0],'metal',splitter);splitterFace.rotation.y=-Math.PI/4;
  box([.42,.34,.42],[-2,-1.02,0],'metal',splitter);
  const waveplate=part('waveplate','Quarter-wave plate','With its axes at 45° to the input polarization, the plate changes outgoing linear polarization to circular polarization. Its second passage changes the returning beam so the splitter can separate it from the source beam. It is not a shutter or a light-to-electric converter.',[0,0,0],pickup);
  const plate=box([.055,.43,.43],[-1.34,-.65,0],'blue',waveplate);box([.1,.305,.48],[-1.34,-1.0175,0],'metal',waveplate);
  const mirror=part('mirror','Fold mirror','A 45° mirror turns the horizontal beam upward toward the objective. The return beam follows the same folded path back to the splitter.',[0,0,0],pickup);
  const fold=surface(kit,new THREE.BoxGeometry(.025,.51,.42),'metal',mirror);fold.position.set(-.65,-.65,0);fold.rotation.z=-Math.PI/4;
  const half=.255/Math.sqrt(2),back=.0125/Math.sqrt(2),shape=new THREE.Shape();
  shape.moveTo(-half+back,-half-back);shape.lineTo(half+back,-half-back);shape.lineTo(half+back,half-back);shape.closePath();
  const backingGeometry=new THREE.ExtrudeGeometry(shape,{depth:.42,bevelEnabled:false});backingGeometry.translate(0,0,-.21);
  const foldBacking=surface(kit,backingGeometry,'cream',mirror);foldBacking.position.set(-.65,-.65,0);
  const supportTop=-.65-half-back,foldSupport=box([.40,supportTop+1.17,.4],[-.65+back,(supportTop-1.17)/2,0],'metal',mirror);
  const objective=part('objective','Objective and lens holder','The objective focuses on the reflective data layer. Real drives adjust focus and radial tracking continuously; this close-up assumes a centered, locked pickup. Beam widths, relief depth and distances are exaggerated.',[0,0,0],pickup);
  const lens=cylinder(.25,.10,[-.65,.57,0],GLASS,objective);
  const holder=kit.ring(.30,.045,[-.65,.57,0],'ink',objective);holder.rotation.x=Math.PI/2;
  for(const z of [-.34,.34]){rod([-.22,-1.17,z],[-.22,.57,z],.025,'metal',objective);rod([-.22,.57,z],[-.65,.57,z],.025,'metal',objective);}
  const track=part('track','Moving track and reflective relief','A straightened piece of a pressed-disc track passes the fixed focus. The shape changes the collected optical signal through wave interference. Both pits and lands reflect. Here the relief is enlarged and the receiver response is assigned; its contrast is not predicted from the drawn depth.',[0,0,0],pickup);
  const cover=box([3.2,.19,.64],[-.65,1.65,0],GLASS,track);
  const segments=Array.from({length:10},()=>box([1,.16,.64],[0,1.48,0],'metal',track));
  const cursor=segmentLines(1,GOLD,track);fillLine(cursor,[[-.65,1.14,.35],[-.65,1.84,.35]]);
  const trackLabel=textLabel(track,'Track moves left · relief enlarged',{height:.22,width:3.5,position:[-.65,2,.06]});
  const detector=part('detector','Four-area photodiode','The gold return path reaches a segmented silicon detector. Its four photocurrents sum to the data signal. Differences between areas can help servo control in real pickups; this centered demonstration assigns equal shares and does not simulate those servos.',[0,0,0],pickup);
  const detectorFrame=new THREE.Group();detector.add(detectorFrame);
  for(const x of [-.265,.265])box([.05,.58,.12],[-2+x,-.65,1.08],'ink',detectorFrame);
  for(const y of [-.265,.265])box([.48,.05,.12],[-2,-.65+y,1.08],'ink',detectorFrame);
  const cells=[];for(const x of [-.125,.125])for(const y of [-.125,.125]){const cell=box([.23,.23,.04],[-2+x,-.65+y,1.1],'gold',detector);cell.material=cell.material.clone();cells.push(cell);}
  const detectorPost=rod([-2,-1.08,1.04],[-2,-.94,1.04],.04,'metal',detector);
  const shutter=part('shutter','Return-path shutter','An added teaching shutter blocks only the return branch between splitter and detector. The track still receives light, but its signal cannot reach the receiver. Real drives do not need this demonstration shutter.',[0,0,0],pickup);
  const blade=box([.63,.63,.035],[-2,-.65,.60],'clay',shutter);
  for(const x of [-2.38,-1.62])rod([x,-1.1,.6],[x,.53,.6],.018,'metal',shutter);
  const electronics=part('electronics','Receiver circuit board','Photocurrent becomes a voltage. Timing and equalization are assumed locked to a known reference. The sampled voltage feeds either a four-state sequence detector or a one-sample threshold comparison. Only the receiver output populates the estimated bit display.',[0,0,0],assembly);
  const board=box([2.25,2.25,.14],[1.8,-.04,.10],'leaf',electronics);
  const boardStand=box([2.35,.17,.70],[1.8,-1.25,.1],'cream',electronics);
  for(const x of [1.05,2.55])box([.26,.16,.55],[x,-1.415,.1],'metal',electronics);
  const cable=kit.tube([[-1.72,-.65,1.03],[-1.38,-1.05,1.02],[.20,-1.06,.47],[.66,-.72,.21]],.035,'clay',electronics);
  const amplifier=box([.58,.48,.15],[1.05,-.72,.23],'ink',electronics),decoder=box([.77,.55,.15],[2.16,-.65,.23],'ink',electronics);
  const wire=kit.tube([[1.34,-.72,.26],[1.56,-.72,.26],[1.78,-.65,.26]],.02,'gold',electronics);
  const display=box([1.98,.68,.04],[1.8,.49,.22],'cream',electronics);
  const displayLabels=Array.from({length:28},(_,i)=>textLabel(electronics,'·',{height:.19,width:.12,position:[.88+(i%14)*.14,.65-Math.floor(i/14)*.28,.26]}));
  const modeLabel=textLabel(electronics,'Sequence detector',{height:.22,width:2.15,position:[1.8,1.26,.26]});
  const outcomeLabel=textLabel(electronics,'Press Play',{height:.21,width:2.3,position:[1.8,-.04,.30]});
  textLabel(electronics,'I → V',{height:.20,width:.54,position:[1.05,-.72,.32],color:'#fff5d6'});
  textLabel(electronics,'Samples → bits',{height:.16,width:.74,position:[2.16,-.65,.32],color:'#fff5d6'});
  const flow=kit.sphere(.06,[0,0,0],'gold',electronics);flow.material=flow.material.clone();
  const outgoing=lineObject(6,VIOLET,pickup),returning=lineObject(6,GOLD,pickup),cone=segmentLines(4,VIOLET,pickup);
  fillLine(outgoing,[[-2.95,-.65,0],[-.65,-.65,0],[-.65,.57,0],[-.65,1.39,0]]);
  fillLine(returning,[[-.62,1.39,.025],[-.62,-.62,.025],[-2,-.62,.025],[-2,-.62,1.08]]);
  fillLine(cone,[[-.87,.62,0],[-.65,1.39,0],[-.43,.62,0],[-.65,1.39,0],[-.65,1.39,0],[-.43,.62,0],[-.65,1.39,0],[-.87,.62,0]]);
  const dots=[kit.sphere(.045,[0,0,0],VIOLET,pickup),kit.sphere(.045,[0,0,0],GOLD,pickup)];
  const currentLabel=textLabel(assembly,'',{height:.27,width:3.35,position:[-1.65,-1.86,.2]});
  textLabel(assembly,'Violet: outgoing light · gold: return',{height:.25,width:4.8,position:[-.65,-2.23,.15]});
  const signal=part('signal','From returned light to recovered bits','The upper trace is photocurrent from an assigned three-cell response. The middle trace is sampled amplifier output with repeatable added noise. The bottom row is recovered channel bits. A known reference row checks the answer; it is never supplied to the detector.',[10,0,0],system);
  signal.userData.inspectionOnly='signal';signal.userData.explosionExcluded=true;
  const label=(text,x,y,width=5,height=.29,color='#394233')=>textLabel(signal,text,{height,width,position:[x,y,.06],color});
  label('Light → current → samples → channel bits',0,2.67,6.4,.34);
  const signalTitle=label('',0,2.28,6.4,.28);
  const axes=segmentLines(6,INK,signal);fillLine(axes,[[-2.6,1.1,0],[2.6,1.1,0],[-2.6,1.1,0],[-2.6,1.76,0],[-2.6,-.05,0],[2.6,-.05,0],[-2.6,-.05,0],[-2.6,.66,0]]);
  const currentCurve=lineObject(31,GOLD,signal),voltageCurve=lineObject(31,VIOLET,signal),progress=segmentLines(2,RED,signal);
  const sampleDots=Array.from({length:30},()=>kit.sphere(.03,[0,0,0],'ink',signal));
  label('Summed photocurrent (μA)',0,1.91,4.5,.28);label('Sampled output (V)',0,.84,4.5,.28);
  const currentTop=label('',-2.97,1.72,.60,.27),voltageTop=label('',-2.97,.59,.60,.27),voltageBottom=label('',-2.97,-.03,.60,.27);
  label('0',-2.95,1.12,.4,.27);const clockLabel=label('',0,-.31,6.3,.27);
  label('Known track',0,-.64,3,.29);label('Receiver estimate',0,-1.27,3,.29);
  const known=Array.from({length:28},(_,i)=>label('',-2.5+i*.185,-.96,.18,.33));
  const estimated=Array.from({length:28},(_,i)=>label('',-2.5+i*.185,-1.59,.18,.33));
  const bitCells=Array.from({length:28},(_,i)=>{const cell=box([.17,.30,.015],[-2.5+i*.185,-1.59,.03],'cream',signal);cell.material=cell.material.clone();return cell;});
  const answer=label('',0,-1.96,6.4,.29),limit=label('Channel bits only; payload decoding and error correction follow.',0,-2.32,6.6,.26);
  for(const object of [outgoing,returning,cone,...dots,cable,wire,flow])object.userData.explosionExcluded=true;
  for(const object of [pickup,track,electronics]){object.userData.explosionCategory=true;object.userData.explosionRigid=true;}
  return {system,assembly,pickup,base,detectorBracket,source,laser,collimator,splitter,cube,splitterFace,waveplate,plate,mirror,fold,foldBacking,foldSupport,objective,lens,holder,track,cover,segments,cursor,trackLabel,detector,detectorFrame,detectorPost,cells,shutter,blade,electronics,board,boardStand,cable,amplifier,decoder,wire,display,displayLabels,modeLabel,outcomeLabel,flow,outgoing,returning,cone,dots,currentLabel,signal,signalTitle,axes,currentCurve,voltageCurve,progress,sampleDots,currentTop,voltageTop,voltageBottom,clockLabel,known,estimated,bitCells,answer,limit};
}

function updateGeometry(g,s){
  const beam=-.65,left=s.travel-8,right=s.travel+8;
  let start=0;const runs=s.track.runs.map((length,i)=>{const run={start,end:start+length,pit:i%2===0};start+=length;return run;});
  runs.unshift({start:-100,end:0,pit:false});runs.push({start:s.track.cells,end:100,pit:false});
  g.segments.forEach((mesh,i)=>{const run=runs[i],a=Math.max(left,run.start),b=Math.min(right,run.end),height=run.pit?.08:.16;
    mesh.visible=b>a;mesh.scale.set(Math.max(.0001,(b-a)*.2),height/.16,1);mesh.position.set(beam+((a+b)/2-s.travel)*.2,1.55-height/2,0);
  });
  const pit=s.track.levels[Math.floor(s.travel)]===0,reflectionY=1.55-(pit?.08:.16);
  fillLine(g.outgoing,[[-2.95,-.65,0],[-.65,-.65,0],[-.65,.57,0],[-.65,reflectionY,0]]);
  fillLine(g.cone,[[-.87,.62,0],[-.65,reflectionY,0],[-.43,.62,0],[-.65,reflectionY,0]]);
  const on=s.values.power>0;g.outgoing.visible=on;g.cone.visible=on;g.returning.visible=on;
  const returnEnd=s.values.blocked?.58:1.08;
  fillLine(g.returning,[[-.62,reflectionY,.025],[-.62,-.62,.025],[-2,-.62,.025],[-2,-.62,returnEnd]]);g.returning.visible=on;
  g.blade.position.y=s.values.blocked?-.65:.15;
  g.cells.forEach(cell=>cell.material.color.setRGB(.24+s.current/8e-6*.50,.24+s.current/8e-6*.34,.13));
  g.currentLabel.userData.setText(`Σ photodiode current: ${(s.current*1e6).toFixed(2)} μA`);
  const path=(object,points,fraction)=>{const vectors=points.map(p=>new THREE.Vector3(...p)),lengths=vectors.slice(1).map((p,i)=>p.distanceTo(vectors[i]));let distance=fraction*lengths.reduce((a,b)=>a+b,0),i=0;while(i<lengths.length-1&&distance>lengths[i])distance-=lengths[i++];object.position.copy(vectors[i]).lerp(vectors[i+1],distance/lengths[i]);};
  path(g.dots[0],[[-2.95,-.65,0],[-.65,-.65,0],[-.65,reflectionY,0]],s.time%1);
  path(g.dots[1],[[-.62,reflectionY,.025],[-.62,-.62,.025],[-2,-.62,.025],[-2,-.62,returnEnd]],(s.time+.3)%1);
  g.dots[0].visible=on;g.dots[1].visible=on;
  path(g.flow,[[-1.72,-.65,1.03],[-1.38,-1.05,1.02],[.20,-1.06,.47],[.66,-.72,.21]],(s.time*.7)%1);g.flow.visible=s.signalPresent;
  const status=!s.signalPresent?'No return signal':s.complete?`${s.bits.length-s.errors}/${s.track.cells} channel bits match`:`${s.bits.length}/${s.track.cells} bits estimated`;
  g.modeLabel.userData.setText(s.values.decoder?'One-sample slicer':'Sequence detector');g.outcomeLabel.userData.setText(status);
  g.displayLabels.forEach((label,i)=>label.userData.setText(i>=s.track.cells?'':s.bits[i]===undefined?'·':String(s.bits[i])));
  const xmax=s.sampleCount>0?s.sampleCount:1,px=n=>-2.6+5.2*n/s.target.length;
  const maxCurrent=8,minVoltage=-.6,maxVoltage=1.2,pyI=x=>1.1+.66*x*1e6/maxCurrent,pyV=x=>-.05+.66*(x-minVoltage)/(maxVoltage-minVoltage);
  const beforeCurrent=s.lowCurrent+s.swing;
  fillLine(g.currentCurve,[[px(0),pyI(beforeCurrent),.03],...s.currentSamples.slice(0,xmax).map((v,i)=>[px(i+1),pyI(v),.03])].slice(0,s.sampleCount+1));
  fillLine(g.voltageCurve,[[px(0),pyV(beforeCurrent*READOUT.transimpedance),.03],...s.received.map((v,i)=>[px(i+1),pyV(v),.03])]);
  g.sampleDots.forEach((dot,i)=>{dot.visible=i<s.sampleCount;if(dot.visible)dot.position.set(px(i+1),pyV(s.received[i]),.035);});
  fillLine(g.progress,[[px(s.travel),1.05,.04],[px(s.travel),1.78,.04],[px(s.travel),-.08,.04],[px(s.travel),.68,.04]]);
  g.currentTop.userData.setText(String(maxCurrent));g.voltageTop.userData.setText(maxVoltage.toFixed(1));g.voltageBottom.userData.setText(minVoltage.toFixed(1));
  g.signalTitle.userData.setText(`Track ${s.values.pattern?'B':'A'} · ${s.values.decoder?'threshold slicing':'four-state sequence detection'}`);
  g.clockLabel.userData.setText(`${s.sampleCount}/${s.target.length} samples · ${s.time.toFixed(2)} s view · 2-sample look-ahead`);
  g.known.forEach((label,i)=>label.userData.setText(i<s.track.cells?String(s.track.bits[i]):''));
  g.estimated.forEach((label,i)=>label.userData.setText(i>=s.track.cells?'':s.bits[i]===undefined?'·':String(s.bits[i])));
  g.bitCells.forEach((cell,i)=>{cell.visible=i<s.track.cells;cell.material.color.set(s.bits[i]===undefined?0xf0dfaf:s.bits[i]===s.track.bits[i]?0xb8caa6:0xe99580);});
  g.answer.userData.setText(s.signalPresent?`${s.errors} mismatches against known track${s.complete?'':'; estimate may change'}`:'No return light: the receiver cannot recover this track.');
}

export function createOpticalReadoutModel(){
  const kit=houseModel('Optical-disc readout'),g=geometry(kit),controller=createReadoutController();
  const choices=(...labels)=>labels.map((label,value)=>({value,label}));
  const specs={pattern:['Track example','','Choose a different local pit/land sequence. These obey ordinary Blu-ray run lengths, but are not complete 17PP sectors.',choices('Track A · 26 cells','Track B · 28 cells')],power:['Read-light level','%','Scales the assigned collected light. Changing a control starts a fresh read. 0 turns the light off.'],blocked:['Return path','','Move the teaching shutter into the detector branch.',choices('Clear','Blocked')],noise:['Added receiver noise','','Repeatable Gaussian test noise added after photoconversion. It is not a prediction of disc noise or bit-error rate.',choices('None','Moderate · 0.45 μA RMS','Strong · 1.20 μA RMS')],decoder:['Detection method','','Sequence detection chooses the received-sample path with minimum squared error. The slicer decides each delayed sample against the midpoint. Neither knows the reference answer.',choices('Sequence detector','One-sample slicer')]};
  for(const key of Object.keys(D)){const [label,unit,help,options]=specs[key];kit.control(key,label,...READOUT_DOMAINS[key],D[key],unit,help,options);}
  const result=kit.finish(()=>{const s=controller.getState();updateGeometry(g,s);return {state:s,readings:[
    reading('Your result',!s.signalPresent?'No returned light; no bits recovered':s.complete?`${s.track.cells-s.errors} of ${s.track.cells} channel bits match the known track`:`${s.bits.length} of ${s.track.cells} channel bits estimated`,!s.signalPresent?'The receiver has no optical signal. Added electronic noise, if selected, can remain.':s.complete?'Green cells match the reference; orange cells differ. No payload error correction is applied.':'Press Play. The estimate uses received samples and can change as more samples arrive.'),
    reading('Recovered channel bits',s.bits.length?s.bits.join(''):s.signalPresent?'Waiting for usable samples':'No optical signal','A 1 means a change between successive estimated track levels. A 0 means no change. These are channel bits, not decoded movie or music data.'),
    reading('Light at detector',`${(s.light*1e6).toFixed(2)} μW`,'Illustrative collected power, with an assigned three-cell response. Both pits and lands reflect; this is not a diffraction-based optical contrast prediction.'),
    reading('Summed photocurrent',`${(s.current*1e6).toFixed(2)} μA`,`${(s.current*1e6/4).toFixed(2)} μA per equal detector area. I = RP with illustrative R = 0.20 A/W. Dark current and focus/tracking imbalance are omitted.`),
    reading('Amplifier output',`${s.voltage.toFixed(3)} V`,'100 kΩ current-to-voltage gain plus the chosen input-referred noise. Bipolar linear receiver, with clock, offset and gain known. Samples are the input to detection.'),
    reading('Known-track comparison',`${s.errors} mismatches among ${s.bits.length} estimates`,'The reference row is used only to check the output. With noise, the best-fitting sequence can still be wrong. Two extra land samples provide look-ahead.'),
    reading('Readout clock',`${s.sampleCount} / ${s.target.length} samples · ${s.time.toFixed(2)} s view`,`${(s.time*READOUT.cellsPerSecond/READOUT.channelRate*1e6).toFixed(3)} μs at the 66 million cells/s Blu-ray reference. Display slowed 22 million times. Light-travel dots are schematic, not photon timing.`),
  ]};});
  const render=result.update;let previousTime=0,disposed=false;const sync=()=>render(controller.getState().values);
  result.update=(input={})=>{controller.update(input);return sync();};result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const delta=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(delta);};
  result.replayState=controller.replayState;
  result.playback={label:'Read the optical track',description:'Watch returned light become photocurrent, sampled voltage and estimated channel bits.',stepLabel:'Acquire one channel sample',advance:result.advance,step:()=>result.advance(1/READOUT.cellsPerSecond),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: connected readout','assembly'],['Inspect: optical pickup','pickup'],['Inspect: moving track','track'],['Inspect: photodiode','detector'],['Inspect: samples and recovered bits','signal']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'signal',label:'Inspect the recovered bit stream',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='assembly';result.initialView='front';result.initialIsolated=true;result.frameVisibleOnly=true;result.framePadding=.57;result.selectionOutline=false;result.transparentBackground=true;
  kit.root.updateMatrixWorld(true);
  const assemblyBounds=new THREE.Box3().setFromObject(g.assembly),signalBounds=new THREE.Box3().setFromObject(g.signal);
  g.signal.position.add(assemblyBounds.getCenter(new THREE.Vector3()).sub(signalBounds.getCenter(new THREE.Vector3())));
  kit.root.updateMatrixWorld(true);
  const sceneSize=new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()),assemblySize=assemblyBounds.getSize(new THREE.Vector3());
  result.overviewZoom=Math.max(sceneSize.x,sceneSize.y,sceneSize.z)*.7/(Math.max(assemblySize.x,assemblySize.y,assemblySize.z)*.52);
  result.viewDirections={front:[1.1,1.2,8],iso:[3.3,2.3,6]};
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:p.id==='signal'?[0,0,6]:p.id==='detector'?[0,0,6]:[1.1,1.2,8]}]));
  for(const p of result.parts)p.framePadding=p.id==='signal'?.48:p.id==='assembly'?.52:.62;
  result.frameBoundsForPart=id=>id==='signal'?new THREE.Box3(new THREE.Vector3(-3.4,-2.55,-.05),new THREE.Vector3(3.4,2.92,.15)).applyMatrix4(g.signal.matrixWorld):null;
  result.thumbnailOmit=[g.signal];result.catalogParts=result.parts.filter(p=>!['system','assembly'].includes(p.id));result.topology=g;
  result.inspectionObjects=id=>id==='signal'?[g.signal]:[];
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}
