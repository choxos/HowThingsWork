import * as THREE from 'three';
import {textLabel,lineObject,fillLine,solidArrow} from './scene-kit.js';
import {photodiodeSample,formatPhotodiodeQuantity as fmt} from './photodiode-physics.js';

const C={ink:0x374736,wire:0xb78b46,red:0xc14f39,blue:0x2b5d9c,p:0xeccdc6,n:0xc6d8ea,ir:0xb47fc7,gold:0xe3b45e};
const label=(parent,text,x,y,width=5,height=.2,z=.3)=>textLabel(parent,text,{position:[x,y,z],width,height,color:'#374736'});
const line=(parent,points,color=C.ink)=>{const object=lineObject(points.length,color,parent);fillLine(object,points);return object;};
const excluded=object=>{object.userData.explosionExcluded=true;object.userData.selectionExcluded=true;return object;};
const own=(object,opacity=1)=>{object.material=object.material.clone();object.material.transparent=opacity<1;object.material.opacity=opacity;object.material.depthWrite=opacity===1;return object;};
const vector=p=>new THREE.Vector3(...p);

export function createPhotodiodeGeometry(kit){
  const {part,box,rod,sphere,disk,ring}=kit;
  const bench=part('bench','Photodiode experiment','Light arrives at a two-lead detector. A two-pole selector connects one of three measurement circuits.');
  const board=part('board','Optical bench','Supports an enlarged experiment. The source-to-detector distance is compressed.',[0,0,-.22],bench);box([6.9,4.35,.13],[0,0,0],'cream',board);
  const source=part('source','950 nm light source','A teaching source with adjustable on-axis radiant intensity. Purple represents invisible infrared.',[-2.5,1.1,1.4],bench);
  const direction=vector([3.5,0,-1.1]).normalize();source.quaternion.setFromUnitVectors(vector([0,0,1]),direction);
  box([.65,.65,.65],[0,0,-.33],'blue',source);const sourceWindow=own(disk(.24,.025,[0,0,.01],C.ir,source));
  const sourceSupport=part('source-support','Source support','Holds the infrared source facing the detector.',[0,0,0],bench);rod([-2.5-direction.x*.33,.775,1.4-direction.z*.33],[-2.5,-.05,-.05],.055,'metal',sourceSupport);box([.7,.16,.5],[-2.5,-.08,-.05],'ink',sourceSupport);
  const sourceText=excluded(label(bench,'',-2.42,1.9,1.65,.21,.45)),sourceTiming=excluded(label(bench,'',-2.45,.35,1.5,.18,1.3));
  const rail=part('rail','Distance rail','The source slides on this rail. The selected distance sets inverse-square light loss; drawn travel is compressed.',[0,0,0],bench);rod([-3.05,-.19,.123],[-1.75,-.19,-.286],.035,'metal',rail);

  const detector=part('detector','BPW34-style photodiode','A flat, clear, two-lead package encloses a sensitive silicon die. The internal dimensions are schematic.',[1,1.1,.3],bench);detector.rotation.y=-Math.atan2(3.5,1.1);
  const cover=part('cover','Clear flat package','The light enters through this flat clear package. It protects the die.',[0,0,0],detector);const coverMesh=own(box([.86,1.08,.64],[0,0,0],'blue',cover),.18);kit.covers.push(cover);
  const cathode=part('cathode','Cathode lead and support','The back contact collects electrons on the n side. It is positive relative to the anode under reverse bias.',[0,0,0],detector);
  const cathodePoints=[[0,-.8,-.19],[0,-.28,-.19],[0,0,-.19]];for(let i=1;i<cathodePoints.length;i++)rod(cathodePoints[i-1],cathodePoints[i],.035,'metal',cathode);
  box([.6,.6,.05],[0,0,-.16],'metal',cathode);
  const die=part('die','Silicon sensing die','Absorbed light generates carriers. The n side collects electrons and the p side collects holes.',[0,0,0],detector);
  box([.52,.52,.06],[0,0,-.105],C.n,die);box([.52,.52,.08],[0,0,-.035],'cream',die);const surface=own(box([.52,.52,.035],[0,0,.0225],C.p,die));
  const anode=part('anode','Anode lead','The front contact collects holes on the p side. It becomes positive in open-circuit photovoltaic operation.',[0,0,0],detector);
  const anodePoints=[[0,.8,-.19],[0,.36,-.19]];rod(anodePoints[0],anodePoints[1],.035,'metal',anode);
  const pad=part('top-contact','Front contact pad','A small contact leaves most of the sensitive face exposed.',[0,0,0],detector);box([.12,.08,.02],[0,.18,.05],'gold',pad);
  const bond=part('bond-wire','Fine bond wire','Connects the front die contact to the anode lead.',[0,0,0],detector);
  const bondPoints=[[0,.36,-.19],[0,.39,.18],[0,.18,.06]];kit.tube(bondPoints,.01,'gold',bond);
  const cathodeMark=part('cathode-mark','Cathode mark','Identifies the cathode side of the package.',[0,0,0],cover);box([.55,.06,.014],[0,-.44,.326],'ink',cathodeMark);
  const cradle=part('cradle','Detector cradle','Supports the two terminals while the package faces the source.',[0,0,0],bench);box([.42,.16,.5],[1,.32,-.12],'wood',cradle);
  detector.updateMatrixWorld(true);
  const terminals=[detector.localToWorld(vector(anodePoints[0])),detector.localToWorld(vector(cathodePoints[0]))];
  for(const p of terminals)rod([p.x,p.y,-.14],[p.x,p.y,p.z-.06],.05,'wood',cradle);
  const sockets=part('sockets','Anode and cathode sockets','Both package leads meet the measurement circuit at these contacts.',[0,0,0],bench);const socketObjects=terminals.map(p=>sphere(.06,p.toArray(),'metal',sockets));
  const detectorText=excluded(label(bench,'',1.15,2.02,1.7,.2,.5)),distanceText=excluded(label(bench,'',.85,.57,1.6,.19,1));

  const shutter=part('shutter','Direct-beam shutter','Blocks the source beam while leaving the independent background light unchanged.',[-.7,1.1,.8343],bench);shutter.rotation.y=detector.rotation.y;
  const blade=part('shutter-blade','Sliding opaque blade','The blade moves into the direct optical path when the shutter closes.',[0,0,0],shutter);box([.7,.75,.08],[0,0,0],'ink',blade);sphere(.09,[0,.46,0],'wood',blade);
  const shutterSupport=part('shutter-support','Shutter guide','The blade slides in this guide.',[0,0,0],shutter);rod([-.42,-.42,0],[-.42,1.15,0],.025,'metal',shutterSupport);rod([.42,-.42,0],[.42,1.15,0],.025,'metal',shutterSupport);
  const shutterText=excluded(label(bench,'',-.62,.4,1.35,.18,.7));

  const wiring=part('wiring','Anode and cathode buses','Two separate conductors connect the detector to the measurement selector. Crossings at different depths are insulated.',[0,0,0],bench);
  const paths=[
    [terminals[0].toArray(),[2.94,terminals[0].y,terminals[0].z],[2.94,0,.3],[-2.55,0,.3]],
    [terminals[1].toArray(),[1.25,.3,.16],[2.98,.3,.16],[2.98,-.2,.16],[-1.45,-.2,.16]],
  ];
  const wires=[];function wire(path,parent=wiring){for(let i=1;i<path.length;i++)wires.push({a:path[i-1],b:path[i],object:rod(path[i-1],path[i],.022,C.wire,parent)});}
  paths.forEach(p=>wire(p));
  const selector=part('selector','Two-pole measurement selector','Only one pair of blades closes. Both terminals of the other two instruments are disconnected.',[0,0,0],bench);
  const branches=[],switches=[];
  const names=['Reverse-bias current meter','Zero-bias current meter','Open-circuit voltmeter'];
  for(let mode=0;mode<3;mode++){
    const x=-2+2*mode,branch=part(['reverse-meter','short-meter','voltmeter'][mode],names[mode],['An ideal instrument holds cathode 5 V above anode and measures current.','An ideal ammeter joins the leads with zero voltage drop.','An ideal infinite-resistance voltmeter reads voltage while taking no current.'][mode],[x,-1.18,.18],bench);
    const body=own(box([1.67,.88,.36],[0,0,0],mode===2?'leaf':'blue',branch));box([1.48,.62,.025],[0,0,.2],'cream',branch);
    const text=label(branch,'',0,-.05,1.4,.24,.23);label(branch,['5 V + AMMETER','SHORT + AMMETER','OPEN + VOLTMETER'][mode],0,.2,1.44,.13,.24);const stateText=label(branch,'',0,-.32,1.5,.12,.23);
    const pins=[[-.55,.51,0],[.55,.51,0]].map(p=>sphere(.055,p,'metal',branch));
    const ends=[];
    for(let side=0;side<2;side++){
      const sx=x+(side===0?-.55:.55),sy=side===0?0:-.2,z=side===0?.3:.16;
      const start=[sx,sy,z],end=[sx,-.6,z],length=sy+.6;
      const switchName=`${['Reverse','Zero-bias','Open-circuit'][mode]} ${side===0?'anode':'cathode'}`;
      const contact=part(`contact-${mode}-${side}`,`${switchName} contacts`,'The blade must touch both contacts to connect this instrument.',[0,0,0],selector);
      const startObject=sphere(.046,start,'metal',contact),endObject=sphere(.046,end,'metal',contact);
      const lever=part(`blade-${mode}-${side}`,`${switchName} switch blade`,'Paired blades open both terminals of an unused measurement branch.',start,selector);
      rod([0,0,0],[0,-length,0],.026,'gold',lever);const tip=sphere(.045,[0,-length,0],'gold',lever);
      wire([end,[sx,-.67,.18]],contact);ends.push({start,end});switches.push({mode,side,lever,tip,startObject,endObject,length,start,end});
    }
    branches.push({mode,object:branch,body,text,stateText,pins,ends});
  }
  const modeText=excluded(label(bench,'',0,-1.89,6.5,.23,.4));
  const heading=excluded(label(bench,'LIGHT → CHARGE → MEASUREMENT',0,2.6,6.5,.25,.4));
  const status=excluded(label(bench,'',0,-2.28,6.5,.2,.4));

  const opticalRoot=excluded(new THREE.Group());bench.add(opticalRoot);
  const sourcePoint=vector([-2.5,1.1,1.4]),detectorPoint=detector.localToWorld(vector([0,0,.33])),shutterPoint=vector([-.7,1.1,.8343]);
  const beamMaterial=new THREE.MeshBasicMaterial({color:C.ir,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.2,.13,1,24,1,true),beamMaterial);opticalRoot.add(beam);
  const photons=Array.from({length:9},()=>own(sphere(.034,[0,0,0],C.ir,opticalRoot)));
  const backgroundStart=detectorPoint.clone().add(vector([.5,.8,.8]));const backgroundPhotons=Array.from({length:5},()=>sphere(.027,[0,0,0],C.gold,opticalRoot));
  const flowRoot=excluded(new THREE.Group());bench.add(flowRoot);const flow=Array.from({length:16},()=>sphere(.028,[0,0,0],'gold',flowRoot));

  const junction=part('junction','From absorption to separated charge','An enlarged schematic of a silicon PIN detector. Layer widths and carrier counts are illustrative.',[0,0,0],bench);junction.userData.inspectionOnly='junction';junction.userData.explosionExcluded=true;
  label(junction,'LIGHT FREES CHARGE; THE FIELD SEPARATES IT',0,2.19,5.3,.24);const junctionText=label(junction,'',0,1.82,5.1,.2);
  const pLayer=box([1.05,1.45,.15],[-1.55,.55,0],C.p,junction),depletedLayer=box([2.05,1.45,.15],[0,.55,0],'cream',junction),nLayer=box([1.05,1.45,.15],[1.55,.55,0],C.n,junction);
  label(junction,'p side · anode',-1.65,1.51,1.85,.19);label(junction,'depleted region',0,1.51,1.95,.19);label(junction,'n side · cathode',1.65,1.51,1.85,.19);
  const field=solidArrow(kit,'#617b58',junction,.035);field.position.set(.8,.03,.2);field.userData.setDirection(vector([-1,0,0]));field.userData.setLength(1.6);
  label(junction,'Electric field',0,-.31,2,.19);const pairs=Array.from({length:4},(_,i)=>({index:i,electron:sphere(.055,[0,0,.22],C.blue,junction),hole:ring(.061,.012,[0,0,.22],C.red,junction),photon:sphere(.04,[0,0,.22],C.ir,junction)}));
  const storedCharge=Array.from({length:4},(_,i)=>[ring(.075,.013,[-1.87,.35+i*.23,.28],C.red,junction),sphere(.066,[1.87,.35+i*.23,.28],C.blue,junction)]).flat();
  const junctionResult=label(junction,'',0,-.7,5.1,.22),junctionVoltage=label(junction,'',0,-1.06,5.1,.21);
  label(junction,'Electrons collect on n; holes collect on p',0,-1.42,5.1,.2);label(junction,'Carriers outside this region can also diffuse into it',0,-1.76,5.1,.18);
  const junctionFooter=label(junction,'',0,-2.1,5.1,.18);

  const response=part('response','Light and electrical response','Compare incoming light with measured current or the time-dependent open-circuit voltage.',[0,0,0],bench);response.userData.inspectionOnly='response';response.userData.explosionExcluded=true;
  label(response,'SAME LIGHT, DIFFERENT MEASUREMENT',0,2.18,5.2,.25);const responseTitle=label(response,'',0,1.8,5.1,.2);
  line(response,[[-2.1,1.42,.1],[-2.1,.68,.1],[2.1,.68,.1]]);line(response,[[-2.1,.3,.1],[-2.1,-.7,.1],[2.1,-.7,.1]]);
  label(response,'LIGHT',-2.38,1.17,.55,.14);const yAxis=label(response,'',-2.39,-.17,.54,.14);
  const lightTrace=lineObject(241,C.ir,response),responseTrace=lineObject(241,C.blue,response),cursor=lineObject(2,C.ink,response);
  label(response,'0',-2.1,-.95,.6,.16);label(response,'631.58 μs real',1.7,-.95,1.4,.16);
  const responseNow=label(response,'',0,-1.31,5.1,.22),responseCharge=label(response,'',0,-1.67,5.1,.2),responseFooter=label(response,'',0,-2.07,5.1,.18);

  const noise=part('noise','Signal, baseline and noise','A steady dark current is not the same quantity as fluctuating shot noise. No receiver decode threshold is imposed.',[0,0,0],bench);noise.userData.inspectionOnly='noise';noise.userData.explosionExcluded=true;
  label(noise,'SMALL SIGNAL DOES NOT MEAN ZERO SIGNAL',0,2.18,5.2,.24);const noiseTitle=label(noise,'',0,1.79,5.1,.2);
  const bars=[];for(let i=0;i<3;i++){const y=1.05-i*.52;label(noise,['Direct ON','Background','Dark baseline'][i],-1.49,y,1.7,.18);line(noise,[[-.45,y-.1,.1],[2.1,y-.1,.1]],C.ink);const bar=own(box([1,.15,.04],[0,y,.14],['blue','gold','red'][i],noise));const text=label(noise,'',.85,y+.18,2.5,.17);bars.push({bar,text});}
  const noiseValue=label(noise,'',0,-.66,5.1,.23);label(noise,'Shot density: √[2q(Idark + Iphoto)]',0,-1.02,5.1,.21);
  label(noise,'Shunt resistance and amplifier add other noise',0,-1.39,5.1,.19);label(noise,'A TV also needs filtering, timing and decoding',0,-1.76,5.1,.19);const noiseFooter=label(noise,'',0,-2.1,5.1,.18);
  return {bench,board,source,sourceWindow,sourceSupport,sourceText,sourceTiming,rail,detector,cover,coverMesh,cathode,cathodePoints,die,surface,anode,anodePoints,pad,bond,bondPoints,cathodeMark,cradle,terminals,sockets,socketObjects,detectorText,distanceText,shutter,blade,shutterSupport,shutterText,wiring,paths,wires,selector,branches,switches,modeText,heading,status,opticalRoot,sourcePoint,detectorPoint,shutterPoint,beam,photons,backgroundStart,backgroundPhotons,flowRoot,flow,junction,junctionText,pLayer,depletedLayer,nLayer,storedCharge,field,pairs,junctionResult,junctionVoltage,junctionFooter,response,responseTitle,yAxis,lightTrace,responseTrace,cursor,responseNow,responseCharge,responseFooter,noise,noiseTitle,bars,noiseValue,noiseFooter};
}

function placeAlong(object,points,phase){
  const lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),total=lengths.reduce((a,b)=>a+b,0);
  let distance=phase*total,i=0;while(i<lengths.length-1&&distance>lengths[i]){distance-=lengths[i];i++;}
  object.position.copy(points[i]).lerp(points[i+1],lengths[i]?distance/lengths[i]:0);object.position.z+=.035;
}

export function updatePhotodiodeGeometry(g,s){
  const v=s.values,open=v.mode===2,active=s.gate&&v.intensity>0;
  const sourceX=-1.8-(v.distance-1)*1.2/29,sourceZ=.3+(1-sourceX)*1.1/3.5;
  g.sourcePoint.set(sourceX,1.1,sourceZ);g.source.position.copy(g.sourcePoint);g.sourceSupport.position.set(sourceX+2.5,0,sourceZ-1.4);g.sourceText.position.x=sourceX;g.sourceTiming.position.x=sourceX;
  g.sourceText.userData.setText(`${v.intensity} mW/sr · 950 nm`);g.sourceTiming.userData.setText(v.drive?(s.gate?'PULSE ON':'PULSE OFF'):'STEADY LIGHT');
  g.sourceWindow.material.color.setHex(active?C.ir:0x66546e);g.blade.position.y=v.blocked?0:.67;g.shutterText.userData.setText(v.blocked?'BEAM BLOCKED':'SHUTTER CLEAR');
  g.detectorText.userData.setText('2 leads · 7.5 mm²');g.distanceText.userData.setText(`${v.distance} m · compressed`);
  g.surface.material.color.setHex(s.photoCurrent>0?0xd4a184:C.p);
  for(const item of g.switches)item.lever.rotation.z=item.mode===v.mode?0:(item.side===0?-.78:.78);
  for(const branch of g.branches){const selected=branch.mode===v.mode;branch.body.material.color.setHex(selected?0x83b4c1:0xb8bfb1);branch.text.userData.setText(selected?fmt(open?s.voltage:s.meanExternalCurrent,open?'V':'A'):'Disconnected');branch.stateText.userData.setText(selected?(open?'A positive · no external current':v.mode===0?'C +5 V · cycle-mean current':'0 V · cycle-mean current'):'Both switches open');}
  g.modeText.userData.setText(['REVERSE CURRENT · cathode held 5 V above anode','ZERO-BIAS CURRENT · leads joined by ideal ammeter','OPEN-CIRCUIT VOLTAGE · no external current'][v.mode]);
  g.status.userData.setText(`${s.complete?'Complete':s.time===0?'Ready':'Measuring'} · ${open?`${(s.voltage*1000).toFixed(1)} mV now`:`${fmt(s.photoCurrent,'A')} photocurrent now`} · ${(s.realTime*1e6).toFixed(1)} μs real`);
  const end=v.blocked?g.shutterPoint:g.detectorPoint,delta=end.clone().sub(g.sourcePoint),length=delta.length();
  g.beam.position.copy(g.sourcePoint).lerp(end,.5);g.beam.quaternion.setFromUnitVectors(vector([0,1,0]),delta.normalize());g.beam.scale.y=length;g.beam.visible=active;g.beam.material.opacity=.025+.09*Math.sqrt(v.intensity/150);
  for(let i=0;i<g.photons.length;i++){const p=g.photons[i];p.visible=active;p.position.copy(g.sourcePoint).lerp(end,(i/g.photons.length+s.time*1.7)%1);p.scale.setScalar(.6+.8*Math.sqrt(v.intensity/150));}
  for(let i=0;i<g.backgroundPhotons.length;i++){const p=g.backgroundPhotons[i];p.visible=v.background>0;p.position.copy(g.backgroundStart).lerp(g.detectorPoint,(i/g.backgroundPhotons.length+s.time*.9)%1);p.scale.setScalar(.6+v.background*.3);}
  const branch=g.branches[v.mode],a=branch.ends[0],c=branch.ends[1];
  const flowPath=[g.terminals[0],vector([2.94,g.terminals[0].y,g.terminals[0].z]),vector([2.94,0,.3]),vector(a.start),vector(a.end),vector([a.end[0],-1.18,.18]),vector([c.end[0],-1.18,.18]),vector(c.end),vector(c.start),vector([2.98,-.2,.16]),vector([2.98,.3,.16]),vector([1.25,.3,.16]),g.terminals[1],g.detectorPoint,g.terminals[0]];
  const speed=.1+Math.log1p(s.externalCurrent/1e-9)*.08;
  for(let i=0;i<g.flow.length;i++){const p=g.flow[i];p.visible=!open&&s.externalCurrent>0;placeAlong(p,flowPath,(i/g.flow.length+s.time*speed)%1);}
  g.junctionText.userData.setText(open?'Open terminals: separated charge develops a voltage':v.mode===1?'Built-in field collects charge without applied bias':'Reverse bias aids collection and reduces capacitance');
  const depletedWidth=v.mode===0?2.05:1.55-(open?Math.min(.35,s.voltage)*1.3:0),sideWidth=(4.15-depletedWidth)/2;
  g.depletedLayer.scale.x=depletedWidth/2.05;g.pLayer.scale.x=g.nLayer.scale.x=sideWidth/1.05;g.pLayer.position.x=-(depletedWidth+sideWidth)/2;g.nLayer.position.x=(depletedWidth+sideWidth)/2;
  g.field.position.x=depletedWidth/2-.15;g.field.userData.setLength(depletedWidth-.3);
  for(const charge of g.storedCharge){charge.visible=open&&s.voltage>0;charge.scale.setScalar(Math.min(1.6,Math.sqrt(s.voltage>0?s.voltage/.1:0)));}
  const rate=.3+Math.log1p(s.photoCurrent/1e-9)*.13;
  for(const pair of g.pairs){const phase=(s.time*rate+pair.index/4)%1,absorbed=phase>.25,u=Math.max(0,(phase-.25)/.75),y=.38+pair.index*.2;
    pair.photon.visible=s.photoCurrent>0&&!absorbed;pair.photon.position.set(-2.15+phase*8,y,.23);
    pair.electron.visible=pair.hole.visible=s.photoCurrent>0&&absorbed;pair.electron.position.set(u*1.98,y,.23);pair.hole.position.set(-u*1.98,y,.23);
  }
  g.junctionResult.userData.setText(`${fmt(s.photoCurrent,'A')} collected photocurrent · ${(s.quantumEfficiency*100).toFixed(1)}% nominal QE`);
  g.junctionVoltage.userData.setText(`Anode − cathode: ${fmt(s.voltage,'V')}`);g.junctionFooter.userData.setText(open?'Stored-charge dots grow with voltage; counts are schematic':'Depletion width and carrier paths are qualitative sketches');
  g.responseTitle.userData.setText(open?'Open voltage charges and relaxes over time':v.mode===1?'Ideal zero-bias current follows the light':'Ideal reverse current follows light above a dark baseline');
  const traceKey=JSON.stringify([v,s.initialVoltage]);
  if(g.traceKey!==traceKey){
    const lightPoints=[],responsePoints=[],maxCurrent=Math.max(2e-9,s.onPhotoCurrent+s.darkCurrent),maxVoltage=Math.max(.02,s.steadyOpenVoltage,s.initialVoltage),maxLight=Math.max(.00012,s.directIrradiance+s.backgroundIrradiance);
    for(let i=0;i<=240;i++){const time=i/20,point=photodiodeSample(s,time,s.initialVoltage),x=-2.1+4.2*i/240;
      const irradiance=s.backgroundIrradiance+(point.gate?s.directIrradiance:0);lightPoints.push([x,.7+.65*irradiance/maxLight,.18]);responsePoints.push([x,-.68+.9*(open?point.voltage/maxVoltage:point.externalCurrent/maxCurrent),.18]);}
    fillLine(g.lightTrace,lightPoints);fillLine(g.responseTrace,responsePoints);g.traceKey=traceKey;
  }
  const cx=-2.1+4.2*s.time/12;fillLine(g.cursor,[[cx,-.77,.23],[cx,1.42,.23]]);
  g.yAxis.userData.setText(open?'VOLTS':'AMPS');g.responseNow.userData.setText(open?`Voltage now ${fmt(s.voltage,'V')} · external current 0 A`:`Current now ${fmt(s.externalCurrent,'A')} · cycle mean ${fmt(s.meanExternalCurrent,'A')}`);
  g.responseCharge.userData.setText(open?`Stored charge change ${fmt(s.capacitorChargeChange,'C')}`:`Charge through meter ${fmt(s.externalCharge,'C')}`);g.responseFooter.userData.setText(open?'Assigned 70 pF and fitted diode curve; vertical axis rescales':'24 carrier periods · ideal clamp omits response transients');
  g.noiseTitle.userData.setText(`Direct signal ${fmt(s.signalCurrent,'A')} · ${v.distance} m from source`);
  const barValues=[s.signalCurrent,s.backgroundCurrent,s.darkCurrent],barMax=Math.max(...barValues,2e-9);
  for(let i=0;i<3;i++){const {bar,text}=g.bars[i],width=2.5*barValues[i]/barMax;bar.visible=width>0;bar.scale.x=width;bar.position.x=-.45+width/2;text.userData.setText(fmt(barValues[i],'A'));}
  g.noiseValue.userData.setText(s.shotNoiseDensity===null?'Reverse shot-noise estimate does not apply':`${fmt(s.shotNoiseDensity,'A/√Hz')} · shot component only`);
  g.noiseFooter.userData.setText(s.shotNoiseDensity===null?'Zero net dark current does not mean zero total noise':'Density alone gives neither total noise nor decode success');
}
