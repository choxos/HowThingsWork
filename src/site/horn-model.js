import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createHornModel(){
 const m=houseModel('Electric horn'),{part,box,cylinder,ring,rod,tube,control,finish}=m;
 const tau=Math.PI*2,scale=100,breakPosition=.00035,dt=.000001;
 const system=part('system','Connected electric horn','Current pulls an iron bar and its diaphragm. The bar opens the contact, current falls, and the diaphragm springs back.');
 const housing=part('housing','Clamped housing and supports','A rigid frame clamps the diaphragm edge and carries the coil, fixed pole, and contact supports.',[0,0,0],system);
 for(const y of [.57,.63]){const clamp=ring(.95,.035,[0,y,0],'ink',housing);clamp.rotation.x=Math.PI/2;}
 for(const a of [Math.PI*.25,Math.PI*.75,Math.PI*1.25,Math.PI*1.75]){
  const x=Math.cos(a)*.95,z=Math.sin(a)*.95;cylinder(.032,.16,[x,.61,z],'gold',housing);
 }
 for(const x of [-.72,.72])rod([x,.65,-.55],[x,2.16,-.55],.045,'ink',housing);
 box([1.52,.1,.12],[0,1.23,-.55],'ink',housing);box([1.52,.12,.15],[0,2.14,-.55],'ink',housing);rod([0,2.14,-.55],[0,2.14,0],.07,'metal',housing);
 const cover=part('cover','Removable outer shell','The protective shell encloses the electromagnet. Remove it to inspect the feedback mechanism.',[0,0,0],housing);
 const outer=new THREE.Mesh(new THREE.CylinderGeometry(.96,.96,1.56,64,1,true),new THREE.MeshToonMaterial({color:0x91aa7e,side:THREE.DoubleSide}));outer.position.y=1.41;cover.add(outer);m.covers.push(outer);
 const lid=cylinder(.96,.07,[0,2.2,0],'leaf',cover);m.covers.push(lid);
 const mechanism=part('mechanism','Electromagnet and diaphragm assembly','The fixed coil attracts the moving iron bar across a small air gap.',[0,0,0],system);
 const pole=part('fixed-pole','Fixed iron pole','Attached to the frame. Its lower face remains separated from the moving bar.',[0,0,0],mechanism);
 cylinder(.14,.37,[0,1.955,0],'metal',pole);
 const coil=part('coil','Insulated electromagnetic coil','A winding around the bar and pole creates magnetic attraction when supplied with current.',[0,0,0],mechanism);
 for(const y of [1.235,1.975])for(const front of [true,false]){const geometry=new THREE.TorusGeometry(.25,.055,8,32,Math.PI);if(!front)geometry.rotateZ(Math.PI);geometry.rotateX(Math.PI/2);const flange=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xf0dfaf}));flange.position.y=y;coil.add(flange);if(front)m.covers.push(flange);}
 // Cutaway removes only the front halves. Matching endpoints retain one continuous winding in the complete view.
 for(let half=0;half<36;half++){const winding=[];for(let j=0;j<=20;j++){const t=(half*20+j)/720,a=t*18*tau;winding.push([.25*Math.cos(a),1.25+.7*t,.25*Math.sin(a)]);}const segment=tube(winding,.014,'clay',coil);if(half%2===0)m.covers.push(segment);}
 for(const x of [-.34,.34])rod([x,1.23,0],[x,1.23,-.55],.025,'cream',housing);
 for(const side of [-1,1])rod([side*.19,1.23,0],[side*.34,1.23,0],.025,'cream',housing);
 const diaphragm=part('diaphragm','Clamped flexible diaphragm','The edge remains fixed. Its center moves with the bar; the curved sheet supplies the restoring force.',[0,0,0],mechanism);
 const rings=24,sectors=64,diaphragmGeometry=new THREE.BufferGeometry(),positions=new Float32Array((rings+1)*(sectors+1)*2*3),indices=[];
 for(let layer=0;layer<2;layer++)for(let j=0;j<rings;j++)for(let i=0;i<sectors;i++){const a=layer*(rings+1)*(sectors+1)+j*(sectors+1)+i,b=a+1,c=a+sectors+1,d=c+1;if(layer)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}
 for(const j of [0,rings])for(let i=0;i<sectors;i++){const a=j*(sectors+1)+i,b=a+1,c=a+(rings+1)*(sectors+1),d=c+1;indices.push(a,c,b,b,c,d);}
 diaphragmGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));diaphragmGeometry.setIndex(indices);
 const sheet=new THREE.Mesh(diaphragmGeometry,new THREE.MeshToonMaterial({color:0xb4c5b0,side:THREE.DoubleSide}));diaphragm.add(sheet);
 const bar=part('moving-bar','Moving iron bar and center fixing','The bar is bolted to the flat center of the diaphragm. It translates axially without touching the coil.',[0,0,0],diaphragm);
 cylinder(.14,1.02,[0,1.11,0],'metal',bar);cylinder(.18,.05,[0,.6,0],'gold',bar);cylinder(.07,.055,[0,.55,0],'ink',bar);
 const collar=part('collar','Bar collar and insulated actuator','The collar rises with the bar. Its insulating tab lifts the contact leaf only after the initial clearance is used up.',[0,0,0],bar);
 cylinder(.23,.055,[0,1.0125,0],'metal',collar);box([.2,.025,.09],[-.24,1.0525,.18],'cream',collar);
 const contacts=part('contacts','Mechanically operated contact breaker','The supported spring leaf touches a fixed pad until the rising bar lifts it away.',[0,0,0],mechanism);
 const anchor=part('contact-anchor','Insulated contact support','Two insulated terminals connect the leaf and fixed pad without shorting through the housing.',[0,0,0],contacts);
 rod([-.88,.67,-.36],[-.88,1.18,-.36],.045,'ink',anchor);rod([-.88,.67,-.36],[-.67,.67,-.67],.035,'ink',anchor);
 box([.2,.2,.35],[-.88,1.105,-.18],'cream',anchor);box([.13,.03,.26],[-.88,1.106,.05],'metal',anchor);
 const fixed=part('fixed-contact','Fixed contact pad','Its top face meets the moving pad. Held open retracts this pad downward.',[0,0,0],contacts);
 rod([-.88,1.015,-.16],[-.4,1.015,-.16],.025,'gold',fixed);rod([-.4,1.015,-.16],[-.4,.8,-.16],.025,'gold',fixed);rod([-.4,.8,-.16],[-.4,.8,0],.025,'gold',fixed);
 const adjustingScrew=cylinder(.018,.245,[-.4,.9225,0],'gold',fixed),fixedPad=box([.12,.025,.1],[-.4,1.0575,0],'gold',fixed);
 const leaf=part('contact-leaf','Spring contact leaf and moving pad','Root fixed to the insulated support; the free end is pushed upward by the bar collar.',[0,0,0],contacts);
 const leafGeometry=new THREE.BufferGeometry(),leafPositions=new Float32Array(33*4*3),leafIndices=[];
 for(let i=0;i<32;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;leafIndices.push(a,b,c,b,d,c);}
 leafGeometry.setAttribute('position',new THREE.BufferAttribute(leafPositions,3));leafGeometry.setIndex(leafIndices);
 const leafMesh=new THREE.Mesh(leafGeometry,new THREE.MeshToonMaterial({color:0xb4c5b0,side:THREE.DoubleSide}));leaf.add(leafMesh);
 const pad=box([.12,.03,.1],[-.4,1.085,0],'gold',leaf);
 const actuatorExtension=box([.21,.012,.26],[-.325,1.106,.09],'metal',leaf);
 const trumpet=part('trumpet','Hollow projecting horn','A hollow chamber and flared outlet couple diaphragm vibration to the air. The model does not solve acoustic resonance.',[0,0,0],system);
 const profile=[[.95,.565],[.87,.44],[.64,.3],[.38,.12],[.22,-.08],[.2,-.25],[.28,-.55],[.53,-.86],[.84,-1.08]];
 const hornPoints=profile.map(([radius,y])=>new THREE.Vector2(radius,y));for(const [radius,y] of [...profile].reverse())hornPoints.push(new THREE.Vector2(radius+.035,y));hornPoints.push(hornPoints[0].clone());
 const projector=new THREE.Mesh(new THREE.LatheGeometry(hornPoints,64),new THREE.MeshToonMaterial({color:0xce825f,side:THREE.DoubleSide}));trumpet.add(projector);
 const mouth=ring(.857,.027,[0,-1.08,0],'gold',trumpet);mouth.rotation.x=Math.PI/2;
 const battery=part('battery','Low-voltage supply','The selected voltage drives current through the complete series circuit.',[-1.7,.45,0],system);
 box([.65,.48,.35],[0,0,0],'leaf',battery);for(const x of [-.16,.16])box([.12,.045,.13],[x,.265,0],x<0?'gold':'metal',battery);
 rod([-.21,.05,.18],[-.11,.05,.18],.009,'cream',battery);rod([-.16,0,.18],[-.16,.1,.18],.009,'cream',battery);rod([.11,.05,.18],[.21,.05,.18],.009,'cream',battery);
 const button=part('button','Horn push-button','Play holds a conducting bridge across two terminals, then releases it.',[-1.7,1.3,0],system);
 const buttonGuide=part('button-guide','Button case and shaft guide','The supported guide surrounds the sliding shaft. The housing can be removed to inspect the return spring.',[0,0,0],button);
 box([.42,.45,.075],[0,0,-.08],'cream',buttonGuide);
 for(const x of [-.1,.1]){box([.05,.08,.075],[x,0,0],'gold',button);rod([x,0,-.0425],[x,0,-.0375],.018,'cream',buttonGuide);}
 for(const x of [-.17,.17])for(const y of [-.18,.18])rod([x,y,-.0425],[x,y,.15],.012,'metal',buttonGuide);
 for(const y of [-.215,.215])m.covers.push(box([.42,.02,.2],[0,y,.05],'cream',buttonGuide));
 for(const x of [-.2,.2])m.covers.push(box([.02,.45,.2],[x,0,.05],'cream',buttonGuide));
 const buttonFace=new THREE.Shape();buttonFace.moveTo(-.21,-.225);buttonFace.lineTo(.21,-.225);buttonFace.lineTo(.21,.225);buttonFace.lineTo(-.21,.225);buttonFace.closePath();const aperture=new THREE.Path();aperture.absarc(0,0,.125,0,tau,true);buttonFace.holes.push(aperture);
 const face=new THREE.Mesh(new THREE.ExtrudeGeometry(buttonFace,{depth:.02,bevelEnabled:false,curveSegments:32}),new THREE.MeshToonMaterial({color:0xf0dfaf}));face.position.z=.14;buttonGuide.add(face);m.covers.push(face);
 ring(.039,.009,[0,0,.125],'cream',buttonGuide);for(const sign of [-1,1])rod([0,sign*.19,.15],[0,sign*.045,.125],.009,'cream',buttonGuide);
 const buttonSpring=part('button-spring','Anchored button return spring','The compression spring stays seated against the fixed backing and the moving bridge in both positions.',[0,0,0],button);
 const buttonSpringLength=Math.hypot(3*tau*.035,.1525)+2*(.035-.028);let buttonCoil,lastPressed;
 function springPath(height){let lo=.025,hi=.05;for(let i=0;i<28;i++){const radius=(lo+hi)/2;if(Math.hypot(3*tau*radius,height)+2*(radius-.028)>buttonSpringLength)hi=radius;else lo=radius;}const radius=(lo+hi)/2,helix=new THREE.Curve();helix.getPoint=(t,target=new THREE.Vector3())=>target.set(radius*Math.cos(3*tau*t),radius*Math.sin(3*tau*t),-.025+height*t);helix.getPointAt=helix.getPoint;helix.getLength=()=>Math.hypot(3*tau*radius,height);const path=new THREE.CurvePath();path.add(new THREE.LineCurve3(new THREE.Vector3(.028,0,-.025),helix.getPoint(0)));path.add(helix);path.add(new THREE.LineCurve3(helix.getPoint(1),new THREE.Vector3(.028,0,-.025+height)));return path;}
 ring(.028,.004,[0,0,-.025],'metal',buttonSpring);for(const side of [-1,1])rod([side*.06,0,-.0425],[side*.028,0,-.025],.004,'metal',buttonSpring);
 const plunger=part('plunger','Button bridge and insulated cap','The bridge visibly meets the terminals when the button is pressed.',[0,0,0],button);
 box([.27,.06,.025],[0,0,.05],'metal',plunger);rod([0,0,-.03],[0,0,.15],.022,'cream',plunger);m.disk(.11,.05,[0,0,.175],'clay',plunger);
 const wires=part('wires','Complete electrical circuit','Supply positive → button → fixed contact → moving leaf → coil → supply negative.',[0,0,0],system);
 tube([[-1.86,.7375,0],[-2.03,.9,0],[-2.03,1.3,0],[-1.8,1.3,0]],.015,'clay',wires);
 tube([[-1.6,1.3,0],[-1.3,1.3,-.2],[-1.3,1.015,-.2],[-.88,1.015,-.16]],.015,'clay',wires);
 tube([[-.88,1.106,.05],[-.7,1.15,.4],[.25,1.25,.4],[.25,1.25,0]],.014,'clay',wires);
 tube([[.25,1.95,0],[.47,2.05,.37],[.65,2.05,.37],[.65,.86,.37],[-1.54,.86,.37],[-1.54,.7375,0]],.014,'ink',wires);
 const bypass=part('bypass','Optional contact jumper','Connects the two contact terminals so the coil stays powered despite leaf movement.',[0,0,0],wires);
 tube([[-.88,1.015,-.16],[-1.06,1.035,.19],[-.88,1.106,.05]],.015,'blue',bypass);
 const field=part('field','Current indicator','Blue loops indicate coil current; they are not a computed magnetic-field map.',[0,0,0],coil);
 for(const y of [1.4,1.7]){const loop=ring(.34,.009,[0,y,0],'blue',field);loop.rotation.x=Math.PI/2;}
 control('voltage','Supply voltage',6,15,3,12,'V','Compare weak pull with repeated contact-breaking vibration. Constants are illustrative.');
 control('holdTime','Button hold time',.04,.12,.02,.04,'s','Actual modeled time; playback slows the mechanism one hundred times.');
 control('contact','Interrupter condition',0,2,1,0,'','Compare feedback with an open circuit and a continuous-current bypass.',[{value:0,label:'Normal make-break'},{value:1,label:'Held open'},{value:2,label:'Bypass jumper'}]);
 control('sound','Horn sound',0,1,1,0,'','Optional synthesized tone follows measured repeated vibration, not loudness or full trumpet acoustics.',[{value:0,label:'Muted'},{value:1,label:'Sound on'}]);
 let x=0,velocity=0,current=0,elapsed=0,accumulator=0,lastClock=0,stage='ready',complete=false,cycles=0,breaks=0,lastCrossing=null,periods=[],peak=0,trough=0,lastX=0,previousClosed=true;
 let context,oscillator,gain,audioError=false,playing=false;
 const frequency=()=>periods.length?1/(periods.reduce((a,b)=>a+b,0)/periods.length):0;
 function mute(){if(gain&&context)gain.gain.setValueAtTime(0,context.currentTime);}
 function sound(enabled){if(!enabled){mute();return;}try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}if(!context){context=new Audio();oscillator=context.createOscillator();gain=context.createGain();oscillator.type='sawtooth';gain.gain.value=0;oscillator.connect(gain);gain.connect(context.destination);oscillator.start();}audioError=false;context.resume().catch(()=>{audioError=true;});}catch{audioError=true;}}
 const result=finish(v=>{
  const displacement=x*scale,leafLift=Math.max(0,x-breakPosition)*scale,fixedDrop=v.contact===1?.12:0,contactGap=leafLift+fixedDrop;
  bar.position.y=displacement;fixedPad.position.y=1.0575-fixedDrop;adjustingScrew.scale.y=(.245-fixedDrop)/.245;adjustingScrew.position.y=.9225-fixedDrop/2;pad.position.y=1.085+leafLift;actuatorExtension.position.y=1.106+leafLift;bypass.visible=v.contact===2;field.visible=current>.005;
  const pressed=stage==='running'&&elapsed<v.holdTime;plunger.position.z=pressed?0:.09;
  if(lastPressed!==pressed){lastPressed=pressed;const geometry=new THREE.TubeGeometry(springPath(pressed?.0625:.1525),180,.0035,6,false);if(buttonCoil){buttonCoil.geometry.dispose();buttonCoil.geometry=geometry;}else{buttonCoil=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xb4c5b0}));buttonSpring.add(buttonCoil);}}
  // Preserve the leaf centerline length as it bends; the free pad slides a small distance along its overlap.
  function leafLength(span){let length=0,previous=0;for(let i=1;i<=32;i++){const t=i/32,y=leafLift*t*t*(3-2*t);length+=Math.hypot(span/32,y-previous);previous=y;}return length;}
  let low=.4,high=.48;for(let i=0;i<24;i++){const span=(low+high)/2;if(leafLength(span)>.48)high=span;else low=span;}const leafSpan=(low+high)/2,padShift=leafSpan-.48;pad.position.x=-.4+padShift;actuatorExtension.position.x=-.325+padShift;
  for(let layer=0;layer<2;layer++)for(let j=0;j<=rings;j++)for(let i=0;i<=sectors;i++){const radius=.18+(.95-.18)*j/rings,a=tau*i/sectors,t=j/rings,flex=(1-t*t)**2,index=((layer*(rings+1)+j)*(sectors+1)+i)*3;positions[index]=radius*Math.cos(a);positions[index+1]=.6+displacement*flex+(layer?.009:-.009);positions[index+2]=radius*Math.sin(a);}
  diaphragmGeometry.attributes.position.needsUpdate=true;diaphragmGeometry.computeVertexNormals();diaphragmGeometry.computeBoundingBox();diaphragmGeometry.computeBoundingSphere();
  for(let i=0;i<=32;i++){const t=i/32,lift=leafLift*t*t*(3-2*t);for(let j=0;j<4;j++){const index=(i*4+j)*3;leafPositions[index]=-.88+leafSpan*t;leafPositions[index+1]=1.106+lift+(j<2?-.006:.006);leafPositions[index+2]=(j===0||j===3?-.05:.05);}}
  leafGeometry.attributes.position.needsUpdate=true;leafGeometry.computeVertexNormals();leafGeometry.computeBoundingBox();leafGeometry.computeBoundingSphere();
  const hz=frequency(),sustained=pressed&&v.contact===0&&periods.length>=3&&breaks>=3;
  if(context?.state==='running'&&gain){oscillator.frequency.setValueAtTime(Math.max(40,hz||250),context.currentTime);gain.gain.setTargetAtTime(v.sound&&sustained&&playing?.018:0,context.currentTime,.015);}
  const outcome=stage==='ready'?'Ready · Play presses the horn button':complete?(periods.length>=3&&breaks>=3?`${cycles} diaphragm cycles · sustained tone produced`:'No sustained tone · no repeated make-break vibration'):sustained?'Rapid make-break vibration produces a sustained tone':pressed&&v.contact===2?'Steady magnetic pull · no sustained tone':pressed&&v.contact===1?'Open circuit · no magnetic pull':pressed?'Watching the diaphragm build motion':'Button released · vibration decaying';
  return {state:{x,velocity,current,elapsed,stage,complete,cycles,breaks,frequency:hz,pressed,contactClosed:contactGap<1e-12,contactGap:contactGap/scale,airGap:.0015-x,peak,trough,leafLength:leafLength(leafSpan),leafSpan,buttonSpringLength,sustained,producedTone:periods.length>=3&&breaks>=3,soundReady:context?.state==='running'&&!audioError},readings:[r('Your result',outcome),r('Diaphragm cycles',String(cycles)),r('Vibration frequency',hz?`${hz.toFixed(0)} Hz (model)`:'Not yet periodic'),r('Button',pressed?'Pressed':'Released'),r('Interrupter',contactGap<1e-12?'Closed':`Open · ${(contactGap/scale*1000).toFixed(3)} mm gap`),r('Coil current',`${current.toFixed(2)} A`),r('Center movement',`${(x*1000).toFixed(3)} mm`),r('Horn sound',!v.sound?'Muted':audioError?'Audio unavailable':sustained?'Synthesized tone at the modeled frequency':'Quiet · no established powered oscillation'),r('Model limit','Illustrative dynamics; no calibrated loudness','No acoustic resonance solver; transient clicks are omitted.')]};
 });
 const render=result.update;
 result.update=next=>{const before=result.getState().values;render(next);const after=result.getState().values;if(after.sound!==before.sound)sound(after.sound===1);if(complete&&Object.keys(after).some(k=>k!=='sound'&&before[k]!==after[k])){clear();}return render();};
 function clear(){playing=false;x=velocity=current=elapsed=accumulator=lastClock=lastX=0;stage='ready';complete=false;cycles=breaks=0;lastCrossing=null;periods=[];peak=trough=0;previousClosed=true;mute();}
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete)return render();const v=result.getState().values;if(stage==='ready'){stage='running';previousClosed=v.contact!==1;}accumulator+=seconds*.01;
  while(accumulator>=dt-1e-14&&!complete){accumulator-=dt;elapsed+=dt;const pressed=elapsed<v.holdTime,closed=v.contact!==1&&x<=breakPosition,conducting=pressed&&(v.contact===2||closed);
   if(previousClosed&&!closed&&pressed)breaks++;previousClosed=closed;
   current+=dt*(conducting?(v.voltage-3*current)/.003:-current/.00005);const force=Math.min(8,1e-6*current*current/(.0015-x)**2);
   velocity+=dt*(force-18000*x-3*velocity)/.008;lastX=x;x+=dt*velocity;peak=Math.max(peak,x);trough=Math.min(trough,x);
   if(lastX<=0&&x>0&&velocity>0&&pressed&&v.contact===0){if(lastCrossing!==null){const period=elapsed-lastCrossing;cycles++;periods.push(period);if(periods.length>8)periods.shift();}lastCrossing=elapsed;}
   if(!pressed&&Math.abs(x)<1e-8&&Math.abs(velocity)<1e-5&&current<1e-6){x=velocity=current=0;stage='finished';complete=true;accumulator=0;mute();}
  }return render();
 }
 result.advance=advance;result.animate=t=>{if(!Number.isFinite(t))return render();const delta=Math.max(0,t-lastClock);lastClock=t;return advance(delta);};
 result.reset=()=>{clear();render(result.defaults);return render();};
 result.playback={label:'Sound the horn',stepLabel:'Advance one step',description:'Play presses and releases the horn button. The modeled mechanism runs one hundred times slower; optional audio uses its measured vibration frequency.',advance,step:()=>advance(.05),complete:()=>complete,blocked:()=>false,setPlaying:enabled=>{playing=enabled===true;if(!playing)mute();render();}};
 result.followParts=['moving-bar','diaphragm','contact-leaf','plunger'];result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:true,label:'Inspect the horn result',available:()=>true};
 const dispose=result.dispose;result.dispose=()=>{mute();if(oscillator)oscillator.stop();if(context)context.close().catch(()=>{});dispose();};return result;
}
