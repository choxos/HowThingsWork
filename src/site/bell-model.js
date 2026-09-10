import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createBellModel(){
 const m=houseModel('Electric bell'),{part,box,rod,disk,ring,sphere,tube,control,finish}=m;
 const tau=Math.PI*2,lever=.03,inertia=.02*lever*lever,stiffness=60*lever*lever,damping=.06*lever*lever;
 const maxAngle=Math.asin(.0048/lever),breakAngle=Math.asin(.003/lever),pivotY=.65;
 const naturalTipX=(-.3-.65*Math.sin(breakAngle))/Math.cos(breakAngle);
 const gongCenter=[-.4*Math.cos(maxAngle)+1.8*Math.sin(maxAngle)+.7,pivotY+.4*Math.sin(maxAngle)+1.8*Math.cos(maxAngle),0];
 const system=part('system','Connected electric bell','A door-button press starts a contact–magnet–spring cycle. The useful result is repeated hammer strikes and optional bell sound.');
 const board=part('board','Mounting board','Supports the gong, electromagnet, insulated hinge, contacts and supply.',[0,0,0],system);
 box([3.3,3.3,.12],[0,1.65,-.3],'wood',board);box([3.5,.12,.7],[0,.06,-.2],'ink',board);
 const gong=part('gong','Metal gong','Its rim is struck by the hammer. The center screw holds it to the board while the dome can vibrate.',gongCenter,system);
 const shellGeometry=new THREE.SphereGeometry(.6,48,24,0,tau,.06,Math.PI/2-.06);shellGeometry.rotateX(Math.PI/2);
 const shell=new THREE.Mesh(shellGeometry,new THREE.MeshToonMaterial({color:0xe3b45e,side:THREE.DoubleSide}));gong.add(shell);ring(.59,.01,[0,0,0],'gold',gong);
 rod([0,0,-.3],[0,0,.65],.025,'metal',gong);disk(.06,.025,[0,0,.607],'ink',gong);
 const soundWaves=part('waves','Sound-wave indicator','Expanding rings mark a recent impact. They are a diagram of sound spreading, not visible air.',[0,0,0],gong),waves=[];
 for(let i=0;i<2;i++){const wave=ring(.66,.009,[0,0,.1],'blue',soundWaves);wave.material=wave.material.clone();wave.material.transparent=true;waves.push(wave);}
 const mechanism=part('mechanism','Magnet and striking mechanism','Coil current attracts the armature. Its motion opens the contact, and the return spring closes it again.',[0,0,0],system);
 const core=part('core','U-shaped iron core','The two coils magnetize opposite ends of this connected iron core.',[0,0,0],mechanism);
 for(const y of [1.15,1.55])rod([.22,y,0],[1.2,y,0],.09,'metal',core);
 rod([1.2,1.15,0],[1.2,1.55,0],.09,'metal',core);
 for(const y of [1.15,1.55])rod([1.2,y,-.3],[1.2,y,0],.04,'ink',core);
 const coils=part('coils','Two connected coils','Insulated copper wire winds around both core arms. Current goes around the two poles in opposite senses.',[0,0,0],mechanism);
 const winding=(y,reverse)=>{const points=[];for(let i=0;i<=280;i++){const t=i/280,a=(reverse?-1:1)*7*tau*t;points.push([reverse?1.05-.7*t:.35+.7*t,y+.125*Math.cos(a),.125*Math.sin(a)]);}return points;};
 tube(winding(1.15,false),.009,'clay',coils);tube(winding(1.55,true),.009,'clay',coils);
 tube([[1.05,1.275,0],[1.05,1.275,.23],[1.4,1.275,.23],[1.4,1.675,.23],[1.05,1.675,.23],[1.05,1.675,0]],.012,'clay',coils);
 const pivot=part('pivot','Insulated armature hinge','The hinge supports the moving armature without shorting its electrical path to the frame.',[0,pivotY,0],mechanism);
 rod([0,0,-.3],[0,0,.24],.035,'cream',pivot);disk(.055,.025,[0,0,.22],'ink',pivot);
 const armature=part('armature','Moving iron armature','This iron bar and its striker turn together about the supported hinge.',[0,0,0],pivot);
 ring(.05,.015,[0,0,0],'metal',armature);rod([0,.055,0],[0,.35,0],.025,'metal',armature);box([.08,.84,.15],[0,.72,0],'metal',armature);
 const rest=part('rest-stop','Armature rest stop','This fixed stop supports the armature at its unenergized position.',[-.05,pivotY+.18,0],mechanism);rod([0,0,-.3],[0,0,.04],.025,'ink',rest);
 const hammer=part('hammer','Hammer and stem','A rigid stem carries the hammer into the gong rim. An impact excites the optional sound.',[0,0,0],armature);
 rod([0,1.09,0],[-.4,1.8,0],.025,'metal',hammer);sphere(.1,[-.4,1.8,0],'ink',hammer);
 const spring=part('spring','Torsion return spring','One leg is fixed to the board; the other turns with the armature. The spring returns the armature when the magnetic pull fades.',[0,0,0],pivot);
 rod([-.18,0,-.3],[-.18,0,.03],.018,'metal',spring);rod([.055,0,0],[.18,0,0],.018,'metal',armature);rod([.18,0,0],[.18,0,.17],.018,'metal',armature);
 const sweep0=7*Math.PI,span=.14,wireLength=Math.hypot(span,sweep0*.09)+.18;
 let coilMesh,lastAngle=NaN,springRadius=.09;
 function springPath(angle){const sweep=sweep0-angle;let lo=.07,hi=.12;for(let i=0;i<30;i++){const radius=(lo+hi)/2,length=Math.hypot(span,sweep*radius)+2*(.18-radius);if(length>wireLength)hi=radius;else lo=radius;}springRadius=(lo+hi)/2;
  const helix=new THREE.Curve();helix.getPoint=(t,target=new THREE.Vector3())=>target.set(springRadius*Math.cos(Math.PI+sweep*t),springRadius*Math.sin(Math.PI+sweep*t),.03+span*t);helix.getPointAt=helix.getPoint;helix.getLength=()=>Math.hypot(span,sweep*springRadius);
  const path=new THREE.CurvePath();path.add(new THREE.LineCurve3(new THREE.Vector3(-.18,0,.03),helix.getPoint(0)));path.add(helix);path.add(new THREE.LineCurve3(helix.getPoint(1),new THREE.Vector3(.18*Math.cos(angle),-.18*Math.sin(angle),.17)));return path;
 }
 const contacts=part('contacts','Make-and-break contacts','A springy tongue stays against the screw briefly, then separates as the armature moves toward the magnet.',[0,0,0],mechanism);
 const fixedSupport=part('contact-support','Fixed contact support','An adjusting screw runs through this conducting support.',[-.65,1.33,0],contacts);
 const nut=ring(.033,.013,[0,0,0],'gold',fixedSupport);nut.rotation.y=Math.PI/2;rod([0,-.046,0],[0,-.046,-.3],.025,'metal',fixedSupport);
 const screw=part('fixed-contact','Adjusting screw and fixed contact','Retracting this screw holds the circuit open in the broken-contact experiment.',[0,0,0],contacts);
 rod([-.95,1.33,0],[-.35,1.33,0],.02,'gold',screw);const knob=disk(.055,.03,[-.96,1.33,0],'ink',screw);knob.rotation.set(0,0,Math.PI/2);
 box([.03,.18,.11],[-.335,1.33,0],'gold',screw);
 const movingContact=part('moving-contact','Springy contact tongue','Its root is attached to the armature. Preload keeps its pad against the screw until the tongue lifts away.',[0,0,0],contacts);
 const pad=box([.04,.06,.11],[0,0,0],'gold',movingContact);
 const tongueGeometry=new THREE.BufferGeometry(),tonguePositions=new Float32Array(41*4*3),tongueIndices=[];
 for(let i=0;i<40;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;tongueIndices.push(a,b,c,b,d,c);}
 tongueGeometry.setAttribute('position',new THREE.BufferAttribute(tonguePositions,3));tongueGeometry.setIndex(tongueIndices);
 const tongue=new THREE.Mesh(tongueGeometry,new THREE.MeshToonMaterial({color:0xb4c5b0,side:THREE.DoubleSide}));movingContact.add(tongue);
 const battery=part('battery','Low-voltage battery','The chosen voltage supplies the energy for repeated ringing.',[-.5,.3,0],system);
 box([.75,.4,.3],[0,.02,0],'leaf',battery);box([.14,.05,.12],[-.18,.225,.02],'gold',battery);box([.14,.05,.12],[.18,.225,.02],'metal',battery);
 rod([-.23,.05,.155],[-.13,.05,.155],.009,'cream',battery);rod([-.18,0,.155],[-.18,.1,.155],.009,'cream',battery);rod([.13,.05,.155],[.23,.05,.155],.009,'cream',battery);
 const button=part('button','Door button','Play presses the button for the chosen interval, then releases it. The bridge below the cap completes the circuit while pressed.',[-1.12,.7,0],system);
 const buttonCase=part('button-case','Button housing and guide','A supported sleeve guides the plunger; the return spring lifts its bridge after the hand releases it.',[0,0,0],button);
 box([.34,.32,.025],[0,0,-.065],'cream',buttonCase);
 for(const y of [-.15,.15])m.covers.push(box([.34,.02,.2],[0,y,.025],'cream',buttonCase));
 for(const x of [-.16,.16])m.covers.push(box([.02,.32,.2],[x,0,.025],'cream',buttonCase));
 for(const x of [-.12,.12])for(const y of [-.1,.1])rod([x,y,-.3],[x,y,-.0775],.012,'metal',buttonCase);
 const face=new THREE.Shape();face.moveTo(-.17,-.16);face.lineTo(.17,-.16);face.lineTo(.17,.16);face.lineTo(-.17,.16);face.closePath();const opening=new THREE.Path();opening.absarc(0,0,.108,0,tau,true);face.holes.push(opening);
 const cover=new THREE.Mesh(new THREE.ExtrudeGeometry(face,{depth:.02,bevelEnabled:false,curveSegments:32}),new THREE.MeshToonMaterial({color:0xf0dfaf}));cover.position.z=.115;buttonCase.add(cover);m.covers.push(cover);
 ring(.04,.01,[0,0,.14],'cream',buttonCase);for(const sign of [-1,1])rod([0,sign*.14,-.065],[0,sign*.04,.14],.008,'cream',buttonCase);
 for(const x of [-.08,.08]){box([.04,.06,.04],[x,0,.02],'gold',button);rod([x,0,-.0525],[x,0,0],.01,'cream',buttonCase);}
 const buttonSpring=part('button-spring','Button return spring','The anchored compression spring expands after the button is released. Its upper end stays against the contact bridge.',[0,0,0],button);
 rod([0,0,-.0525],[0,0,-.025],.006,'metal',buttonSpring);
 let buttonCoil,lastPressed;const buttonWireLength=Math.hypot(3*tau*.035,.1325)+.07;
 function buttonSpringPath(height){let lo=.03,hi=.045;for(let i=0;i<28;i++){const radius=(lo+hi)/2;if(Math.hypot(3*tau*radius,height)+2*radius>buttonWireLength)hi=radius;else lo=radius;}const radius=(lo+hi)/2,helix=new THREE.Curve();helix.getPoint=(t,target=new THREE.Vector3())=>target.set(radius*Math.cos(3*tau*t),radius*Math.sin(3*tau*t),-.025+height*t);helix.getPointAt=helix.getPoint;helix.getLength=()=>Math.hypot(3*tau*radius,height);const path=new THREE.CurvePath();path.add(new THREE.LineCurve3(new THREE.Vector3(0,0,-.025),helix.getPoint(0)));path.add(helix);path.add(new THREE.LineCurve3(helix.getPoint(1),new THREE.Vector3(0,0,-.025+height)));return path;}

 const plunger=part('plunger','Button contact bridge','The conducting bridge meets both fixed terminals when the button is down.',[0,0,0],button);
 box([.2,.03,.025],[0,0,.0525],'metal',plunger);rod([0,0,.065],[0,0,.17],.025,'cream',plunger);disk(.09,.04,[0,0,.18],'clay',plunger);
 const wires=part('wires','Complete series wiring','Battery positive → button → fixed contact → tongue → armature → return spring → coils → battery negative.',[0,0,0],system);
 tube([[-.68,.525,.02],[-.9,.57,.02],[-1.2,.58,.02],[-1.2,.7,.02]],.012,'clay',wires);
 tube([[-1.04,.7,.02],[-1.04,.95,.02],[-.65,1.05,.02],[-.65,1.284,0]],.012,'clay',wires);
 tube([[-.18,pivotY,.03],[-.28,.78,.2],[.25,.85,.2],[.35,1.275,.2],[.35,1.275,0]],.012,'clay',wires);
 tube([[.35,1.675,0],[.35,1.8,.23],[1.48,1.8,.23],[1.48,.6,.23],[-.32,.6,.23],[-.32,.525,.02]],.012,'ink',wires);
 const bypass=part('bypass','Contact-bypass jumper','This optional wire connects the fixed support directly to the spring terminal, bypassing the moving contact.',[0,0,0],wires);
 tube([[-.65,1.284,0],[-.53,1.13,.24],[-.3,.95,.24],[-.18,pivotY,.03]],.012,'blue',bypass);
 const field=part('field','Magnetic-field indicator','Blue loops indicate coil current. They are a diagram, not a visible substance or a calculated field map.',[0,0,0],core);
 for(const y of [1.15,1.55]){const loop=ring(.2,.008,[.1,y,.1],'blue',field);loop.scale.x=1.3;}
 control('voltage','Battery voltage',1.5,4.5,.5,3,'V','Illustrative circuit values: compare enough pull to strike with a weak supply.');
 control('holdTime','Button hold time',.2,.8,.05,.35,'s','The experiment is slowed so you can inspect the contact cycle. Play presses, holds and releases the button.');
 control('contact','Interrupter condition',0,2,1,0,'','Compare the working feedback loop with a retracted contact or a wire bypass.',[{value:0,label:'Normal contact'},{value:1,label:'Held open'},{value:2,label:'Bypassed by jumper'}]);
 control('sound','Bell sound',0,1,1,0,'','Enable sound to hear a short synthesized bell tone at each hammer impact.',[{value:0,label:'Muted'},{value:1,label:'Sound on'}]);
 let angle=0,velocity=0,current=0,elapsed=0,stage='ready',complete=false,strikes=0,lastImpact=-Infinity,armed=true,accumulator=0,lastClock=0;
 let audioContext,master,audioError=false;const voices=new Set();
 function setSound(enabled){if(!enabled){if(master)master.gain.setValueAtTime(0,audioContext.currentTime);return;}audioError=false;const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}try{if(!audioContext){audioContext=new Audio();master=audioContext.createGain();master.connect(audioContext.destination);}master.gain.setValueAtTime(1,audioContext.currentTime);audioContext.resume().catch(()=>{audioError=true;});}catch{audioError=true;}}
 function ding(){if(!audioContext||audioContext.state!=='running'||!result.getState().values.sound)return;const now=audioContext.currentTime;for(const [frequency,volume,decay] of [[880,.065,.32],[1435,.03,.18],[2167,.015,.1]]){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),voice={oscillator,gain};oscillator.frequency.value=frequency;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+decay);oscillator.connect(gain);gain.connect(master);voices.add(voice);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();voices.delete(voice);};oscillator.start(now);oscillator.stop(now+decay);}}
 function contactPose(v){const c=Math.cos(angle),s=Math.sin(angle),naturalX=naturalTipX*c+.65*s,naturalY=pivotY-naturalTipX*s+.65*c,face=-.32-(v.contact===1?.2:0),tipX=Math.max(face+.02,naturalX);return {tipX,tipY:naturalY,gap:Math.max(0,naturalX-.02-face)};}
 const tongueRestStart=new THREE.Vector3(-.04,.48,0),tongueRestEnd=new THREE.Vector3(naturalTipX,.65,0);
 const tongueLength=new THREE.CubicBezierCurve3(tongueRestStart,tongueRestStart.clone().add(new THREE.Vector3(-.08,-.05,0)),tongueRestEnd.clone().add(new THREE.Vector3(.04,-.1,0)),tongueRestEnd).getLength();
 function tonguePath(pose){const c=Math.cos(angle),s=Math.sin(angle),rotate=p=>new THREE.Vector3(p.x*c+p.y*s,pivotY-p.x*s+p.y*c,0),start=rotate(tongueRestStart),end=new THREE.Vector3(pose.tipX,pose.tipY,0),curve=new THREE.CubicBezierCurve3(start,new THREE.Vector3(),end.clone().add(new THREE.Vector3(.04*c-.1*s,-.04*s-.1*c,0)),end);let lo=0,hi=.5;
  for(let i=0;i<24;i++){const bend=(lo+hi)/2;curve.v1.copy(start).add(new THREE.Vector3(-.08*c-bend*s,.08*s-bend*c,0));if(curve.getLength()>tongueLength)hi=bend;else lo=bend;curve.needsUpdate=true;}
  return curve;
 }
 const result=finish(v=>{
  armature.rotation.z=-angle;screw.position.x=v.contact===1?-.2:0;bypass.visible=v.contact===2;
  const pressed=stage==='running'&&elapsed<v.holdTime,pose=contactPose(v);plunger.position.z=pressed?0:.0675;if(lastPressed!==pressed){lastPressed=pressed;const geometry=new THREE.TubeGeometry(buttonSpringPath(pressed?.065:.1325),180,.0035,6,false);if(buttonCoil){buttonCoil.geometry.dispose();buttonCoil.geometry=geometry;}else{buttonCoil=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xb4c5b0}));buttonSpring.add(buttonCoil);}}field.visible=current>.005;
  const curve=tonguePath(pose),end=curve.v3;
  for(let i=0;i<=40;i++){const p=curve.getPoint(i/40),t=curve.getTangent(i/40),normal=new THREE.Vector3(t.y,-t.x,0);for(let j=0;j<4;j++){const side=j===0||j===3?-1:1,z=j<2?-.045:.045,index=(i*4+j)*3;tonguePositions[index]=p.x+side*.004*normal.x;tonguePositions[index+1]=p.y+side*.004*normal.y;tonguePositions[index+2]=z;}}
  tongueGeometry.attributes.position.needsUpdate=true;tongueGeometry.computeVertexNormals();tongueGeometry.computeBoundingBox();tongueGeometry.computeBoundingSphere();pad.position.copy(end);
  if(lastAngle!==angle){lastAngle=angle;const geometry=new THREE.TubeGeometry(springPath(angle),260,.007,6,false);if(coilMesh){coilMesh.geometry.dispose();coilMesh.geometry=geometry;}else{coilMesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xce825f}));spring.add(coilMesh);}}
  const age=elapsed-lastImpact;for(let i=0;i<waves.length;i++){const phase=Math.min(1,age/.09+i*.35);waves[i].visible=age>=0&&phase<1;waves[i].scale.setScalar(1+phase*.6);waves[i].material.opacity=Math.max(0,.65*(1-phase));}
  const force=Math.min(.6,5e-5*current*current/(.006-lever*Math.sin(angle)+(.04/30)*(1-Math.cos(angle)))**2),closed=pose.gap<1e-9;
  const resultText=stage==='ready'?'Ready · press Play to ring the bell':complete?(strikes===0?'No strikes · the bell stayed quiet':strikes===1?'One strike · no repeated ringing':`${strikes} strikes · the bell rang repeatedly`):pressed&&v.contact===2&&strikes?'Steady pull holds the armature · no repeated ringing':strikes?`${strikes} ${strikes===1?'strike':'strikes'} so far`:pressed?'Button held · watching for a strike':'Button released · spring returning';
  return {state:{angle,velocity,current,elapsed,stage,complete,strikes,pressed,contactClosed:closed,contactGap:pose.gap,force,springRadius,wireLength,buttonWireLength,tongueLength,lastImpact:Number.isFinite(lastImpact)?lastImpact:null,soundReady:audioContext?.state==='running'&&!audioError},readings:[r('Your result',resultText),r('Hammer strikes',String(strikes)),r('Button',pressed?'Pressed':'Released'),r('Moving contact',closed?'Closed':'Open · '+(pose.gap*1000/30).toFixed(2)+' mm gap'),r('Coil current',(current*1000).toFixed(0)+' mA'),r('What happens now',complete?'Change a setting to compare another trial.':stage==='ready'?'Play presses the button and starts the experiment.':!pressed?'The spring brings the armature back.':v.contact===1?'The open path prevents current.':v.contact===2?'The jumper keeps current on when the contact opens.':closed?'Current builds; the magnet pulls.':'Current fades; inertia and the spring govern the return.'),r('Bell sound',!v.sound?'Muted · select Sound on to listen':audioError?'Audio unavailable in this browser':audioContext?.state==='running'?'On · synthesized impact tone':'Waiting for sound permission') ]};
 });
 const render=result.update;
 result.update=next=>{const before=result.getState().values;render(next);const values=result.getState().values;if(values.sound!==before.sound)setSound(values.sound===1);if(complete&&Object.keys(before).some(k=>before[k]!==values[k])){stage='ready';complete=false;}return render();};
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete)return render();if(stage==='ready'){stage='running';elapsed=0;strikes=0;lastImpact=-Infinity;armed=true;}const v=result.getState().values,previous=strikes,dt=.00005;accumulator+=seconds*.12;
  while(accumulator>=dt-1e-12&&!complete){accumulator-=dt;elapsed+=dt;const pressed=elapsed<v.holdTime,closed=contactPose(v).gap<1e-9,conducting=pressed&&(v.contact===2||closed);current+=dt*(conducting?(v.voltage-10*current)/.08:-current/.0005);
   const gap=.006-lever*Math.sin(angle)+(.04/30)*(1-Math.cos(angle)),force=Math.min(.6,5e-5*current*current/(gap*gap)),torque=force*(lever*Math.cos(angle)-(.04/30)*Math.sin(angle));
   velocity+=dt*(torque-stiffness*angle-damping*velocity)/inertia;angle+=dt*velocity;
   if(angle>=maxAngle){angle=maxAngle;if(velocity>0){if(armed){strikes++;lastImpact=elapsed;armed=false;}velocity*=-.15;}}
   if(angle<maxAngle-.02)armed=true;if(angle<=0){angle=0;velocity=0;}
   if(!pressed&&angle===0&&current<.00001){stage='finished';complete=true;current=0;}
  }
  if(complete)accumulator=0;if(strikes>previous)ding();return render();
 }
 result.reset=()=>{angle=0;velocity=0;current=0;elapsed=0;stage='ready';complete=false;strikes=0;lastImpact=-Infinity;armed=true;accumulator=0;lastClock=0;setSound(false);return render(result.defaults);};
 result.advance=advance;result.animate=t=>{const dt=Math.max(0,t-lastClock);lastClock=t;return advance(dt);};
 result.playback={label:'Ring the bell',stepLabel:'Advance one step',description:'Play presses the door button for the chosen time, then releases it. The mechanism is slowed; the optional bell tone sounds at each impact.',advance,step:()=>advance(.2),complete:()=>complete,blocked:()=>false};
 result.followParts=['armature','hammer','moving-contact','plunger'];result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:true,label:'Inspect the ringing result',available:()=>true};
 const dispose=result.dispose;result.dispose=()=>{for(const voice of voices)voice.oscillator.stop();voices.clear();if(audioContext)audioContext.close().catch(()=>{});dispose();};return result;
}
