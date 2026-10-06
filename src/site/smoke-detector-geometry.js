import * as THREE from 'three';
import {textLabel,lineObject,fillLine} from './scene-kit.js';
import {SMOKE_SCIENCE as C,smokeAlphaTrack,smokeChambers,smokeIonDensity,smokeSweep,smokeNode,smokeAfterGold,smokeAirRange,smokePairsPerMillimeter,smokeAirEnergy} from './smoke-detector-science.js';
import {SMOKE_DETECTOR_RUN as R,SMOKE_PHOTO_THRESHOLD,SMOKE_PHOTO_CLEAR} from './smoke-detector-physics.js';

const P={ink:0x374736,cream:0xf0dfaf,metal:0xb4c5b0,blue:0x2b5d9c,red:0xc14f39,gold:0xe3b45e,smoke:0x666962,ir:0xb47fc7,leaf:0x91aa7e};
const label=(parent,text,x,y,width=5,height=.2,z=.2,color='#374736')=>textLabel(parent,text,{position:[x,y,z],width,height,color});
const own=(mesh,opacity=1)=>{mesh.material=mesh.material.clone();mesh.material.transparent=opacity<1;mesh.material.opacity=opacity;mesh.material.depthWrite=opacity===1;return mesh;};
const visual=object=>{object.userData.explosionExcluded=true;object.userData.selectionExcluded=true;return object;};
const line=(parent,points,color=P.ink)=>{const l=lineObject(points.length,color,parent);fillLine(l,points);return l;};
const polyline=(kit,parent,points,radius=.026,color='gold')=>points.slice(1).map((b,i)=>kit.rod(points[i],b,radius,color,parent));
const vector=p=>new THREE.Vector3(...p);
const at=(parent,p)=>parent.localToWorld(vector(p));
const setText=(object,text)=>object.userData.setText(text);
const halfDisk=(kit,radius,depth,position,color,parent,side)=>{const d=kit.disk(radius,depth,position,color,parent);d.geometry.dispose();d.geometry=new THREE.CylinderGeometry(radius,radius,depth,40,1,false,side>0?0:Math.PI,Math.PI);return d;};

export function createSmokeDetectorGeometry(kit){
  const {part,box,disk,ring,rod,sphere}=kit;
  const system=part('system','Complete smoke alarm','Smoke reaches two sensing stages. Their signals reach a common controller, which connects battery power to a piezoelectric sounder. This is an enlarged teaching design.');
  const body=part('body','Vented enclosure','Slots admit air. A removable outer cover protects the circuit.',[0,0,-.18],system);
  disk(3.18,.2,[0,0,0],'cream',body);ring(3.14,.09,[0,0,.14],'wood',body);
  for(let i=0;i<30;i++){
    const a=Math.PI*2*i/30,post=box([.12,.28,.48],[3.02*Math.cos(a),3.02*Math.sin(a),.3],'cream',body);post.rotation.z=a-Math.PI/2;
  }
  const cover=part('cover','Outer cover','The cover opens in the cutaway view so the connected components remain visible.',[0,0,2.04],system);
  disk(3.14,.12,[0,0,0],'cream',cover);ring(2.94,.055,[0,0,.08],'wood',cover);
  for(let i=0;i<30;i++){const a=Math.PI*2*i/30,post=box([.12,.28,1.86],[3.02*Math.cos(a),3.02*Math.sin(a),-.99],'cream',cover);post.rotation.z=a-Math.PI/2;}
  for(let i=0;i<12;i++){const a=Math.PI*2*i/12;const slot=box([.46,.055,.03],[2.63*Math.cos(a),2.63*Math.sin(a),.076],'ink',cover);slot.rotation.z=a;}
  kit.covers.push(cover);
  const board=part('board','Circuit board','Copper paths connect supply, sensors, controller and sounder.',[0,0,-.035],system);disk(2.89,.085,[0,0,0],'leaf',board);
  const battery=part('battery','Battery and terminals','Provides the adjustable supply. A separate regulator powers the optical stage at 3 V.',[-.92,-1.86,.2],system);
  box([1.66,.7,.46],[0,0,0],'ink',battery);box([.29,.7,.47],[-.69,0,0],'gold',battery);
  const positive=sphere(.065,[.45,.42,0],'red',battery),negative=sphere(.065,[-.45,.42,0],'metal',battery);
  const batteryText=label(battery,'',0,0,1.32,.21,.255,'#f0dfaf');
  const powerSwitch=part('power-switch','Battery contact','Disconnecting the battery opens the electrical supply. Radioactive ionization continues without the battery.',[0,0,0],system);
  const powerStart=[-.47,-1.44,.2],powerEnd=[.05,-1.44,.2],switchBlade=rod(powerStart,powerEnd,.035,'gold',powerSwitch);sphere(.065,powerStart,'metal',powerSwitch);sphere(.065,powerEnd,'metal',powerSwitch);
  const regulator=part('regulator','3 V regulator','An ideal regulated supply separates the optical electronics from the 6.5–9.5 V battery.',[.66,-1.86,.16],system);box([.7,.57,.2],[0,0,0],'blue',regulator);label(regulator,'3 V',0,0,.56,.17,.12);
  const controller=part('controller','Signal comparison and horn driver','The controller compares both sensor signals. Either confirmed request activates the common horn.',[.1,-.73,.18],system);
  box([.9,.7,.2],[0,0,0],'ink',controller);for(let i=0;i<4;i++)for(const side of [-1,1])rod([side*.44,-.25+i*.17,0],[side*.57,-.25+i*.17,0],.028,'metal',controller);
  label(controller,'COMPARE',0,.04,.79,.125,.13,'#f0dfaf');label(controller,'+ DRIVE',0,-.16,.75,.12,.13,'#f0dfaf');
  const alarmLamp=own(sphere(.09,[0,.43,.06],'red',controller));
  const horn=part('horn','Piezoelectric sounder','An alternating drive bends the ceramic and metal diaphragm. Its vibration moves air and produces sound.',[.28,1.81,.21],system);
  const hornMetal=disk(.62,.045,[0,0,0],'gold',horn),hornCeramic=disk(.44,.035,[0,0,.042],'cream',horn);
  const hornContact=sphere(.07,[.15,-.25,.075],'metal',horn);ring(.63,.05,[0,0,.035],'wood',horn);
  rod([.15,-.25,.075],[.15,-.55,.075],.022,'red',horn);rod([0,-.49,0],[0,-.6,0],.024,'blue',horn);
  const hornRest=hornCeramic.geometry.attributes.position.array.slice();
  const hornLabel=visual(label(horn,'Piezoelectric diaphragm',0,.97,1.9,.1,.1));
  const hornNote=visual(label(horn,'Motion enlarged and slowed',0,-.85,1.9,.095,.1));
  const hornWaves=Array.from({length:3},(_,i)=>{const arc=new THREE.Mesh(new THREE.TorusGeometry(.72+i*.18,.016,6,30,1.45),new THREE.MeshBasicMaterial({color:P.red}));arc.rotation.z=-.7;arc.position.z=.1;horn.add(arc);return arc;});

  const ions=part('ions','Ionization chambers','An open sensing half and a smoke-free reference half share a source plate. Smoke captures mobile ions in the open half, changing the voltage at that plate.',[-1.46,.55,.08],system);
  const ionScale=.068,gasBase=.42;ions.scale.setScalar(ionScale);
  const common=part('common-electrode','Shared source electrode','This lower plate joins both chambers and feeds the high-impedance detect input.',[0,0,0],ions);disk(C.radius,.6,[0,0,0],'metal',common);
  const foil=part('source-foil','Sealed americium source','A sealed foil supplies alpha particles. The divider separates the two foil halves in this assigned chamber geometry.',[0,0,.34],ions);disk(C.sourceRadius,.16,[0,0,0],'gold',foil);
  const divider=part('divider','Absorbing divider','The partition keeps smoke out of the reference half. Alpha tracks that strike it stop depositing energy in the air. It is transparent in this cutaway.',[0,0,0],ions);own(box([.2,2*C.radius,C.referenceGap],[0,0,gasBase+C.referenceGap/2],'wood',divider),.15);
  line(divider,[[0,-C.radius,gasBase],[0,-C.radius,gasBase+C.referenceGap],[0,C.radius,gasBase+C.referenceGap],[0,C.radius,gasBase]],P.ink);
  const ionTitle=visual(label(ions,'SMOKE CAPTURES MOBILE IONS',0,15,38,2.2,gasBase+C.referenceGap));
  const referenceLabel=visual(label(ions,'Smoke-free reference',-10,11.5,21,1.65,gasBase+C.referenceGap));
  const sensingLabel=visual(label(ions,'Open sensing half',10,11.5,20,1.65,gasBase+C.sensingGap));
  const ionReading=visual(label(ions,'',0,-14,36,1.8,gasBase));
  const ionLegend=visual(label(ions,'Gold: alpha · red: positive ion · blue: negative ion',0,-18,43,1.5,gasBase));
  const ionHalves=[];
  for(const side of [-1,1]){
    const gap=side>0?C.sensingGap:C.referenceGap,id=side>0?'sensing':'reference';
    const half=part(id,side>0?'Open sensing chamber':'Smoke-free reference chamber',side>0?'Smoke enters through the open side. Captured ions move much more slowly than free ions.':'This example holds the reference half free of smoke.',[0,0,0],ions);
    const electrode=part(`${id}-electrode`,side>0?'Sensing electrode: battery negative':'Reference electrode: battery positive','The upper electrode connects this half of the gas path to the supply. Translucency exposes the cutaway.',[0,0,0],half);
    const plate=own(halfDisk(kit,C.radius,.55,[0,0,gasBase+gap],'metal',electrode,side),.2);
    const outline=[];for(let j=0;j<=32;j++){const a=(side>0?0:Math.PI)+Math.PI*j/32;outline.push([C.radius*Math.sin(a),-C.radius*Math.cos(a),gasBase+gap+.32]);}line(electrode,outline,P.metal);rod([0,-C.radius,gasBase+gap],[0,C.radius,gasBase+gap],.18,'metal',electrode);
    for(let j=0;j<9;j++){const a=(side>0?0:Math.PI)+Math.PI*(j+.5)/9;rod([C.radius*Math.sin(a),-C.radius*Math.cos(a),gasBase],[C.radius*Math.sin(a),-C.radius*Math.cos(a),gasBase+gap],.15,'metal',half);}
    if(side<0){const wall=new THREE.Mesh(new THREE.CylinderGeometry(C.radius,C.radius,gap,32,1,true,Math.PI,Math.PI),plate.material.clone());wall.rotation.x=Math.PI/2;wall.position.z=gasBase+gap/2;wall.material.opacity=.1;half.add(wall);}
    const trackRoot=visual(new THREE.Group());half.add(trackRoot);const tracks=[];
    for(let i=0;i<8;i++){
      const rr=C.sourceRadius*Math.sqrt((i+.5)/8),phi=-Math.PI/2+Math.PI*((i*3)%8+.5)/8,mu=.27+.7*((i*5)%8+.5)/8,azimuth=Math.PI*2*(i+.5)/8;
      const path=smokeAlphaTrack(5.48556,[rr*Math.cos(phi),rr*Math.sin(phi)],mu,azimuth,gap);
      const mirror=p=>[side*p[0],p[1],p[2]+gasBase];const start=mirror(path.source),end=mirror(path.end);
      const trace=line(trackRoot,[start,end],P.gold),alpha=sphere(.28,start,'gold',trackRoot);
      const plus=sphere(.27,start,'red',trackRoot),minus=sphere(.27,start,'blue',trackRoot),smoke=sphere(.58,start,P.smoke,trackRoot);
      tracks.push({path,start,end,trace,alpha,plus,minus,smoke,index:i});
    }
    ionHalves.push({side,gap,half,plate,electrode,trackRoot,tracks});
  }
  const ionLabel=visual(label(system,'IONIZATION',-1.5,-.54,1.45,.19,.22));

  const chamber=part('chamber','Optical smoke chamber','A hooded infrared source illuminates air. The receiver looks through a narrow field of view that excludes a direct view of the source.',[1.5,.38,1],system);
  const opticalScale=.041;chamber.scale.setScalar(opticalScale);
  const bowlPart=part('optical-shell','Dark optical enclosure','The spherical cavity is an assigned teaching geometry. The front half is cut away.',[0,0,0],chamber);
  const bowl=new THREE.Mesh(new THREE.SphereGeometry(C.chamberRadius*1000,48,24,Math.PI,Math.PI),new THREE.MeshToonMaterial({color:0x43504a,side:THREE.DoubleSide}));bowlPart.add(bowl);ring(23,.65,[0,0,0],'ink',bowlPart);
  const emitter=part('emitter','Infrared emitter and hood','The 940 nm source pulses for 100 μs. Purple makes invisible infrared visible.',[-12,0,0],chamber);
  const emitterBody=rod([-4,0,0],[0,0,0],2.2,'ink',emitter);const emitterLens=own(sphere(.65,[0,0,0],P.ir,emitter));
  const emitterLeads=[1,-1].map(side=>rod([-4,side,0],[-6,side,0],.22,'metal',emitter));
  const emitterHood=new THREE.Mesh(new THREE.CylinderGeometry(2*Math.tan(C.sourceStopAngle*Math.PI/180),2*Math.tan(C.sourceStopAngle*Math.PI/180),2,32,1,true),new THREE.MeshToonMaterial({color:P.ink,side:THREE.DoubleSide}));
  emitterHood.rotation.z=-Math.PI/2;emitterHood.position.x=1;emitter.add(emitterHood);
  const receiver=part('receiver','Photodiode and viewing tube','The effective pupil is 12 mm from the center and admits directions within 5°. The photodiode sits behind it.',[0,0,0],chamber);
  const receiverBody=rod([0,0,0],[4,0,0],1.5,'ink',receiver),receiverFace=disk(.75,.16,[0,0,0],'blue',receiver);receiverFace.rotation.y=Math.PI/2;
  const receiverDie=box([.32,1.25,1.25],[3.85,0,0],'blue',receiver);
  const receiverLeads=[1,-1].map(side=>rod([4,side,0],[6,side,0],.22,'metal',receiver));
  const viewingCone=visual(new THREE.Mesh(new THREE.ConeGeometry(35*Math.tan(C.receiverHalfAngle*Math.PI/180),35,32,1,true),new THREE.MeshBasicMaterial({color:P.blue,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide})));
  viewingCone.rotation.z=-Math.PI/2;viewingCone.position.x=-17.5;receiver.add(viewingCone);
  viewingCone.userData.inspectionOnly='chamber';
  const opticalTitle=visual(label(chamber,'SCATTER INTO THE VIEWING CONE',0,29,61,3,1));
  const opticalReading=visual(label(chamber,'',0,-28,60,2.7,1));
  const opticalNote=visual(label(chamber,'Purple: pulse paths · blue: receiver field of view',0,-33,64,2.3,1));
  const beamRoot=visual(new THREE.Group());chamber.add(beamRoot);
  const coneAngle=C.sourceStopAngle*Math.PI/180,coneLength=12*Math.cos(coneAngle)+Math.sqrt(23**2-12**2*Math.sin(coneAngle)**2),coneAxial=coneLength*Math.cos(coneAngle);
  const beam=new THREE.Mesh(new THREE.ConeGeometry(coneLength*Math.sin(coneAngle),coneAxial,36,1,true),new THREE.MeshBasicMaterial({color:P.ir,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide}));beam.rotation.z=Math.PI/2;beam.position.set(-12+coneAxial/2,0,0);beamRoot.add(beam);
  const scatterRays=Array.from({length:6},()=>lineObject(3,P.gold,beamRoot)),opticalSmoke=Array.from({length:20},()=>sphere(.7,[0,0,0],P.smoke,beamRoot));
  const opticalLabel=visual(label(system,'SCATTERED LIGHT',1.52,-.74,1.78,.18,.25));

  system.updateMatrixWorld(true);
  const wires=part('wiring','Power, return and sensor connections','Separate signal leads enter the controller. Power comes from the battery; the weak sensing currents do not supply horn energy.',[0,0,0],system);
  const paths=[];const wire=(points,color='gold')=>{paths.push({points,color,objects:polyline(kit,wires,points,.022,color)});};
  const ionCommon=at(ions,[9,0,0]).toArray(),ionPositive=at(ions,[-7,0,gasBase+C.referenceGap]).toArray(),ionNegative=at(ions,[7,0,gasBase+C.sensingGap]).toArray();
  wire([[.05,-1.44,.2],[.4,-1.44,.2],[.4,-.97,.18]],'red');
  wire([[.4,-1.44,.2],[.66,-1.44,.2],[.66,-1.58,.16]],'red');
  wire([[.4,-1.44,.2],[-2.47,-1.44,.2],[-2.47,.55,.2],ionPositive],'red');
  wire([ionCommon,[-.69,.55,.15],[-.69,-.48,.15],[-.47,-.48,.18]],'gold');
  wire([[-1.37,-1.44,.2],[-2.69,-1.44,.2],[-2.69,-.96,.11],[2.53,-.96,.11],[2.53,.7,.11]],'blue');
  wire([ionNegative,[ionNegative[0],.02,.11],[-2.69,.02,.11],[-2.69,-.96,.11]],'blue');
  wire([[.1,-1.08,.18],[.1,-.96,.11]],'blue');
  wire([[.94,-1.86,.16],[1.19,-1.86,.16],[1.19,-.96,.11]],'blue');
  const emitterPins=[1,-1].map(side=>at(emitter,[-6,side,0]).toArray());
  wire([[.97,-1.7,.16],[2.67,-1.7,.16],[2.67,.16,.15],[emitterPins[0][0],.16,.15],emitterPins[0]],'red');
  wire([emitterPins[1],[emitterPins[1][0],-.1,.11],[2.53,-.1,.11]],'blue');
  const receiverWires=[lineObject(3,P.gold,wires),lineObject(3,P.blue,wires)];
  wire([[.67,-.66,.18],[.76,-.66,.18],[.76,1.45,.19],[.43,1.56,.285]],'red');
  wire([[.28,1.21,.21],[.87,1.21,.11],[.87,-.96,.11]],'blue');
  const flowRoot=visual(new THREE.Group());system.add(flowRoot);const flow=Array.from({length:18},()=>sphere(.027,[0,0,0],'gold',flowRoot));
  const heading=visual(label(system,'SMOKE → SIGNAL → SOUND',0,4,6.2,.27,.3));
  const status=visual(label(system,'',0,-3.45,6.2,.25,.3));
  const footer=visual(label(system,'',0,-3.82,6.2,.19,.3));

  const source=part('source','Inside the sealed source','A magnified source cross-section and one normal alpha track. Thickness is exaggerated.',[0,0,0],system);source.userData.inspectionOnly='source';source.userData.explosionExcluded=true;
  label(source,'ALPHA ENERGY BECOMES ION PAIRS',0,2.28,5.3,.24);
  box([3.55,.46,.4],[0,1.3,0],'metal',source);box([3.08,.15,.42],[0,1.54,0],'gold',source);box([3.08,.12,.42],[0,1.68,0],'gold',source);
  label(source,'Backing',-2.14,1.26,1.1,.18);label(source,'Active foil',2.08,1.52,1.12,.16);label(source,'2 μm gold cover',0,1.99,3.8,.19);
  const sourceEnergy=label(source,'',0,.92,5.15,.19),sourceRange=label(source,'',0,.58,5.15,.19);
  const sourceChart=lineObject(161,P.gold,source);line(source,[[-2,-1.28,.2],[-2,.19,.2],[2.1,.19,.2]],P.ink);line(source,[[-2,-1.28,.2],[2.1,-1.28,.2]],P.ink);
  label(source,'Ion pairs per mm · approximate yield',0,.31,4.8,.18);label(source,'0',-2,-1.49,.5,.16);label(source,'40 mm through air',1.2,-1.49,2.4,.16);
  const normalEnergy=smokeAfterGold(5.48556,C.coverMicrons),normalRange=smokeAirRange(normalEnergy);
  setText(sourceEnergy,`5.486 MeV before cover → ${normalEnergy.toFixed(3)} MeV after it`);setText(sourceRange,`Normal range in air: ${normalRange.toFixed(1)} mm · roughly ${Math.round(normalEnergy*1e6/C.pairEnergy/1000)} thousand pairs`);
  fillLine(sourceChart,Array.from({length:161},(_,i)=>{const distance=i/4,energy=smokeAirEnergy(Math.max(0,normalRange-distance));return [-2+4.1*distance/40,-1.28+1.35*Math.min(1,smokePairsPerMillimeter(energy)/8000),.24];}));
  label(source,'Oblique tracks cross more gold and lose more energy',0,-1.87,5.15,.18);label(source,'Walls and electrodes stop tracks sooner than free air',0,-2.19,5.15,.18);

  const circuit=part('circuit','From signal to alarm request','Live thresholds, optical confirmation and common horn drive. Inspection preserves the current state.',[0,0,0],system);circuit.userData.inspectionOnly='circuit';circuit.userData.explosionExcluded=true;
  label(circuit,'COMPARE THE SIGNAL, THEN DRIVE THE HORN',0,2.28,5.3,.235);
  const circuitTime=label(circuit,'',0,1.94,5.1,.19),gauges=[];
  for(let i=0;i<2;i++){
    const y=1.15-i*.91;label(circuit,i?'Optical current':'Ion detect voltage',-1.6,y+.25,1.9,.19);
    line(circuit,[[-.54,y-.06,.15],[2.08,y-.06,.15]],P.ink);
    const bar=own(box([1,.2,.08],[0,y+.06,.2],i?'red':'blue',circuit)),threshold=lineObject(2,P.ink,circuit),text=label(circuit,'',.83,y+.34,2.7,.18);
    gauges.push({bar,threshold,text,y});
  }
  label(circuit,'Consecutive optical checks',-1.32,-.57,2.55,.18);const checks=Array.from({length:3},(_,i)=>own(sphere(.15,[.43+i*.52,-.57,.2],'metal',circuit)));
  const checkText=label(circuit,'',0,-1.03,5.1,.19),circuitResult=label(circuit,'',0,-1.46,5.1,.21),batteryState=label(circuit,'',0,-1.82,5.1,.18);
  label(circuit,'Sensor signals control the horn; battery supplies its power',0,-2.21,5.1,.17);

  const chart=part('chart','Observation record','The blue curve is ion voltage rise toward its threshold; the red curve is optical current toward its threshold. Only elapsed samples and events are shown.',[0,0,0],system);chart.userData.inspectionOnly='chart';chart.userData.explosionExcluded=true;
  label(chart,'WHEN DID EACH SENSOR REQUEST AN ALARM?',0,2.3,5.35,.225);const chartTitle=label(chart,'',0,1.95,5.15,.19);
  line(chart,[[-2.15,1.5,.1],[-2.15,-.65,.1],[2.12,-.65,.1]],P.ink);
  const thresholdY=-.65+2.15/1.5;line(chart,[[-2.15,thresholdY,.1],[2.12,thresholdY,.1]],P.ink);label(chart,'Trigger',-1.76,thresholdY+.17,.77,.15);
  const ionCurve=lineObject(122,P.blue,chart),photoCurve=lineObject(122,P.red,chart),chartCursor=lineObject(2,P.ink,chart),eventTemplate=lineObject(40,P.gold,chart);
  const eventMarks=new THREE.LineSegments(eventTemplate.geometry,eventTemplate.material);chart.remove(eventTemplate);chart.add(eventMarks);eventMarks.frustumCulled=false;
  for(let i=0;i<=4;i++)label(chart,`${i*150}`, -2.15+4.27*i/4,-.87,.65,.16);label(chart,'Seconds in this assigned smoke experiment',0,-1.19,5.1,.18);
  const chartIon=label(chart,'',0,-1.56,5.1,.2),chartPhoto=label(chart,'',0,-1.91,5.1,.2);label(chart,'These times do not predict warning time in a real fire',0,-2.25,5.1,.17);

  const beamComparison=part('beam-comparison','Short and long optical paths','Two ideal equal input beams cross the same uniform smoke. Only the path length changes; drawn distances are compressed.',[0,0,0],system);beamComparison.userData.inspectionOnly='beam-comparison';beamComparison.userData.explosionExcluded=true;
  label(beamComparison,'SMOKE SCATTERS LIGHT OUT OF A BEAM',0,2.29,5.35,.24);label(beamComparison,'Equal input beams; same smoke; different path lengths',0,1.94,5.1,.18);
  const beamRows=[];for(let i=0;i<2;i++){
    const y=.96-i*1.39;box([.35,.5,.35],[-2.18,y,0],'ink',beamComparison);box([.35,.7,.35],[2.18,y,0],'metal',beamComparison);
    const light=own(box([4,.13,.1],[0,y,.02],P.ir,beamComparison),.5),screen=own(box([.07,.53,.12],[1.97,y,.08],P.gold,beamComparison));
    label(beamComparison,i?'10 m across a room':'30 mm inside a chamber',0,y+.41,4.8,.19);const text=label(beamComparison,'',0,y-.39,4.8,.21);beamRows.push({light,screen,text});
  }
  const beamNote=label(beamComparison,'',0,-1.68,5.1,.19);label(beamComparison,'Scattering sends some of that lost light toward an off-axis sensor',0,-2.12,5.15,.17);
  const detailParts=[source,circuit,chart,beamComparison];
  for(const object of [ionTitle,referenceLabel,sensingLabel,ionReading,ionLegend])object.userData.inspectionOnly='ions';
  for(const object of [opticalTitle,opticalReading,opticalNote])object.userData.inspectionOnly='chamber';
  for(const object of [hornLabel,hornNote])object.userData.inspectionOnly='horn';
  return {system,body,cover,board,battery,positive,negative,batteryText,powerSwitch,powerStart,powerEnd,switchBlade,regulator,controller,alarmLamp,horn,hornMetal,hornCeramic,hornContact,hornWaves,
    hornRest,hornLabel,hornNote,ions,ionScale,gasBase,common,foil,divider,ionHalves,ionLabel,ionTitle,referenceLabel,sensingLabel,ionReading,ionLegend,chamber,opticalScale,bowl,emitter,emitterBody,emitterLens,emitterHood,emitterLeads,emitterPins,receiver,receiverBody,receiverFace,receiverDie,receiverLeads,viewingCone,opticalTitle,opticalReading,opticalNote,beamRoot,beam,scatterRays,opticalSmoke,opticalLabel,
    wires,paths,receiverWires,flowRoot,flow,heading,status,footer,source,sourceChart,sourceEnergy,sourceRange,circuit,circuitTime,gauges,checks,checkText,circuitResult,batteryState,chart,chartTitle,ionCurve,photoCurve,chartCursor,eventMarks,chartIon,chartPhoto,beamComparison,beamRows,beamNote,detailParts};
}

function placeOnPath(object,points,phase){const vs=points.map(vector),lengths=vs.slice(1).map((p,i)=>p.distanceTo(vs[i])),total=lengths.reduce((a,b)=>a+b,0);let length=phase*total,i=0;while(i<lengths.length-1&&length>lengths[i])length-=lengths[i++];object.position.copy(vs[i]).lerp(vs[i+1],length/lengths[i]);}

export function updateSmokeDetectorGeometry(g,s,plan){
  const v=s.values,phase=s.displayTime,angle=v.angle*Math.PI/180;
  setText(g.batteryText,v.power?`${v.battery.toFixed(1)} V`:'DISCONNECTED');
  const end=vector(v.power?g.powerEnd:[g.powerStart[0]+.52*Math.cos(.65),g.powerStart[1]+.52*Math.sin(.65),g.powerStart[2]]),start=vector(g.powerStart);
  g.switchBlade.position.copy(start.clone().add(end).multiplyScalar(.5));g.switchBlade.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
  g.alarmLamp.material.color.setHex(s.active?0xef482e:0x694d43);
  const hornPositions=g.hornCeramic.geometry.attributes.position;
  for(let i=0;i<hornPositions.count;i++){
    const x=g.hornRest[i*3],y=g.hornRest[i*3+1],z=g.hornRest[i*3+2];
    hornPositions.setXYZ(i,x,y+(s.hornPulse?.045*Math.sin(phase*23)*(1-(x*x+z*z)/(.44*.44)):0),z);
  }
  hornPositions.needsUpdate=true;g.hornCeramic.geometry.computeVertexNormals();g.hornWaves.forEach((w,i)=>{w.visible=s.hornPulse;w.scale.setScalar(1+.06*Math.sin(phase*5-i));});
  setText(g.hornNote,s.hornPulse?'DRIVE ON · motion enlarged and slowed':s.active?'Silent gap in the three-beep pattern':'No alarm drive');
  setText(g.status,!v.power?'NO POWER':s.active?`ALARM · ${s.ionActive&&s.photoActive?'BOTH SENSORS':s.ionActive?'IONIZATION':'OPTICAL'}`:s.clearing?'SMOKE CLEARING':s.mass>1e-12?'SMOKE ENTERING':'CLEAN AIR');
  setText(g.footer,`${s.time.toFixed(1)} / 600 s · ${s.mass*1e6<.1?'0.0':(s.mass*1e6).toFixed(1)} mg/m³ · ${v.pace}× pace · ${v.sound?'sound on':'sound off'}`);
  const chambers=smokeChambers();
  setText(g.ionReading,`${(s.current*1e12).toFixed(1)} pA · shared electrode ${s.node.toFixed(2)} V`);
  for(const half of g.ionHalves){
    const sensing=half.side>0,ch=sensing?chambers.sensing:chambers.reference,volts=sensing?s.node:s.supply-s.node,capture=sensing?s.capture:0;
    const density=smokeIonDensity(ch,volts,capture),sweep=smokeSweep(ch,volts),total=sweep+capture+C.recombination*density,collect=sweep/total,caught=capture/total;
    for(const track of half.tracks){
      const p=(phase*.3+track.index*.121)%1,rank=(track.index+.5)/half.tracks.length;track.alpha.position.fromArray(track.start).lerp(vector(track.end),Math.min(1,p/.2));track.alpha.visible=p<.2;
      const born=vector(track.start).lerp(vector(track.end),.3+.5*(track.index%3)/2),motion=Math.max(0,(p-.2)/.8),positiveEnd=sensing?half.gap+g.gasBase:g.gasBase,negativeEnd=sensing?g.gasBase:half.gap+g.gasBase;
      track.plus.visible=track.minus.visible=p>=.2;track.smoke.visible=false;
      track.plus.position.copy(born);track.minus.position.copy(born);track.plus.position.y+=.4;track.minus.position.y-=.4;
      if(rank<collect){track.plus.position.z+=(positiveEnd-born.z)*motion;track.minus.position.z+=(negativeEnd-born.z)*motion;}
      else if(rank<collect+caught){track.smoke.visible=p>=.2;track.smoke.position.copy(born);track.smoke.position.x+=half.side*1.5*motion;track.plus.position.copy(track.smoke.position).add(new THREE.Vector3(0,.42,.2));track.minus.visible=false;}
      else{track.plus.position.y-=.4*Math.min(1,motion*2);track.minus.position.y+=.4*Math.min(1,motion*2);if(motion>.5)track.plus.visible=track.minus.visible=false;}
    }
  }
  g.receiver.position.set(12*Math.cos(angle),12*Math.sin(angle),0);g.receiver.rotation.z=angle;
  const optical=plan.optical;g.emitterLens.material.color.setHex(v.power?P.ir:0x63576c);g.beam.visible=!!v.power;
  setText(g.opticalReading,v.power?`${(s.scattered*1e9).toFixed(2)} nA during each 100 μs pulse`:'No pulse or photocurrent without power');
  setText(g.opticalNote,v.power?'Pulse paths held visible · blue: receiver field of view':'Emitter off · blue: passive receiver field of view');
  for(let i=0;i<g.opticalSmoke.length;i++){
    const p=optical.positions[Math.floor(i*(optical.positions.length-1)/(g.opticalSmoke.length-1))],dot=g.opticalSmoke[i];dot.position.fromArray(p.map(x=>x*1000));dot.position.z+=Math.sin(phase*.7+i)*.35;
    dot.visible=s.mass>1e-10&&i<Math.min(g.opticalSmoke.length,Math.ceil(s.mass*1e6/6));dot.scale.setScalar(.65+.24*Math.log10(v.size/.1+1));
  }
  for(let i=0;i<g.scatterRays.length;i++){
    const p=optical.positions[Math.floor((i+.5)*optical.positions.length/g.scatterRays.length)].map(x=>x*1000);
    fillLine(g.scatterRays[i],v.power&&s.scattered>0?[[-12,0,0],p,[12*Math.cos(angle),12*Math.sin(angle),0]]:[]);
  }
  g.system.updateMatrixWorld(true);
  const receiverPoints=[1,-1].map(side=>g.system.worldToLocal(g.receiver.localToWorld(vector([6,side,0]))).toArray());
  fillLine(g.receiverWires[0],[receiverPoints[0],[.94,-.31,.24],[.67,-.48,.18]]);fillLine(g.receiverWires[1],[receiverPoints[1],[2.53,receiverPoints[1][1],.11],[2.53,-.96,.11]]);
  for(let i=0;i<g.flow.length;i++){const index=i%g.paths.length,path=g.paths[index];g.flow[i].visible=!!v.power&&(index<10||s.active);placeOnPath(g.flow[i],path.points,(phase*.25+i/g.flow.length)%1);}
  setText(g.circuitTime,`${s.time.toFixed(1)} s · ${s.mass*1e6<.001?'0.000':(s.mass*1e6).toFixed(3)} mg/m³ inside`);
  const shares=[s.supply?s.node/s.supply:0,Math.min(1,s.scattered/(2*SMOKE_PHOTO_THRESHOLD))],marks=[s.supply?s.ionThreshold/s.supply:.5,s.photoThreshold/(2*SMOKE_PHOTO_THRESHOLD)];
  g.gauges.forEach((gauge,i)=>{const width=Math.max(.002,2.62*shares[i]);gauge.bar.scale.x=width;gauge.bar.position.x=-.54+width/2;fillLine(gauge.threshold,[[-.54+2.62*marks[i],gauge.y-.13,.26],[-.54+2.62*marks[i],gauge.y+.24,.26]]);setText(gauge.text,i?`${(s.scattered*1e9).toFixed(2)} / ${(s.photoThreshold*1e9).toFixed(2)} nA`:`${s.node.toFixed(2)} / ${s.ionThreshold.toFixed(2)} V`);});
  g.checks.forEach((check,i)=>check.material.color.setHex(v.power&&i<s.photoCount?P.red:P.metal));
  setText(g.checkText,!v.power?'No samples without power':s.photoActive?'Confirmed: three consecutive checks':`Last optical check: ${s.photoLast?s.photoLast.time.toFixed(1)+' s':'none'} · ${s.photoCount} of 3`);
  setText(g.circuitResult,s.active?'CONFIRMED REQUEST → HORN DRIVE':!v.power?'BATTERY CONTACT OPEN':'No horn request now');
  setText(g.batteryState,`${v.battery.toFixed(1)} V battery · ${s.opticalSupply} V optical rail · ${s.chirps.length} low-battery chirps recorded`);
  setText(g.chartTitle,`${s.time.toFixed(1)} s elapsed · blue: ionization · red: optical`);
  const samples=plan.chart.filter(sample=>sample.time<s.time);samples.push({time:s.time,node:s.node,scattered:s.scattered});
  const x=t=>-2.15+4.27*t/600,y=share=>-.65+2.15*Math.max(0,Math.min(1.5,share))/1.5;
  const ionPoints=[],photoPoints=[];
  for(const sample of samples){ionPoints.push([x(sample.time),y(v.power?(sample.node-s.cleanNode)/(plan.ionThreshold-s.cleanNode):0),.21]);photoPoints.push([x(sample.time),y(sample.scattered/SMOKE_PHOTO_THRESHOLD),.22]);}
  fillLine(g.ionCurve,ionPoints);fillLine(g.photoCurve,photoPoints);fillLine(g.chartCursor,[[x(s.time),-.65,.25],[x(s.time),1.5,.25]]);
  fillLine(g.eventMarks,s.events.slice(0,20).flatMap(e=>[[x(e.time),-.65,.24],[x(e.time),e.active?1.5:-.4,.24]]));
  const format=time=>time===null?'No alarm recorded':`First alarm at ${time.toFixed(1)} s`;
  setText(g.chartIon,`Ionization: ${format(s.ionSeen)}`);setText(g.chartPhoto,`Optical: ${format(s.photoSeen)}`);
  for(let i=0;i<2;i++){const share=i?s.roomShare:s.beamShare,row=g.beamRows[i];row.light.material.opacity=.06+.6*share;row.screen.material.color.setHex(P.ink).lerp(new THREE.Color(P.gold),share);setText(row.text,`${(share*100).toFixed(i?1:2)}% of entering light remains`);}
  setText(g.beamNote,`${s.obscuration.toFixed(2)}% obscuration per meter in this sphere model`);
}
