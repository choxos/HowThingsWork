import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';
import {DECLARED,CORONA} from './lightning-physics.js';

const ink=0x374736,copper=0xae8056,blue=0x357386,gold=0xe3b45e;
const label=(p,text,x,y,w=5,h=.22,z=.16)=>textLabel(p,text,{width:w,height:h,position:[x,y,z],color:'#374736'});
function line(parent,points,color=ink){const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(m);return m;}
function dynamicLine(parent,count,color){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));const m=new THREE.Line(g,new THREE.LineBasicMaterial({color}));m.frustumCulled=false;parent.add(m);return m;}
function setLine(m,points){const a=m.geometry.attributes.position;points.forEach((p,i)=>a.setXYZ(i,...p));a.needsUpdate=true;m.geometry.setDrawRange(0,points.length);if(m.material.isLineDashedMaterial)m.computeLineDistances();}
function arrow(kit,p,start,end,color=blue){const a=solidArrow(kit,color,p,.022),v=new THREE.Vector3(...end).sub(new THREE.Vector3(...start));a.position.set(...start);a.userData.setDirection(v);a.userData.setLength(v.length());return a;}
function glow(kit,p,pos,r=.045){const m=kit.sphere(r,pos,gold,p);m.material=new THREE.MeshBasicMaterial({color:gold,toneMapped:false});return m;}
function route(kit,parent,points,r=.028,color=copper){return points.slice(1).map((point,i)=>kit.rod(points[i],point,r,color,parent));}
function pointOnRoute(points,f){const segments=points.slice(1).map((p,i)=>new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...points[i]))),total=segments.reduce((a,b)=>a+b,0);let d=Math.max(0,Math.min(1,f))*total;for(let i=0;i<segments.length;i++){if(d<=segments[i]||i===segments.length-1)return new THREE.Vector3(...points[i]).lerp(new THREE.Vector3(...points[i+1]),d/segments[i]);d-=segments[i];}return new THREE.Vector3(...points[0]);}
function tintByVoltage(mesh,volts){const q=Math.min(1,Math.log10(1+Math.abs(volts)/1e4)/3.5);mesh.material.color.setRGB(.42+.50*q,.65-.34*q,.57-.33*q);}

export function createLightningGeometry(kit){
  const system=kit.part('system','Connected lightning conductor','An illustrative external current path, a separate bottom-bonded pipe, and a common earth termination. This is not an installation design.');
  const part=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const house=part('house','House structure','The building is protected by providing an external conducting path. Only selected walls are opened for inspection.');house.userData.explosionCategory=true;
  const walls=part('walls','Walls and front cover','Supports the roof. Remove this cover to see the routing in context.',house);
  kit.box([3.05,1.83,1.40],[0,-.14,-.13],'cream',walls);kit.covers.push(walls);
  const door=kit.box([.51,1.0,.04],[.40,-.53,.59],'wood',walls);kit.sphere(.026,[.57,-.57,.625],'gold',walls);
  for(const x of [-.65,1.08]){kit.box([.48,.54,.06],[x,.12,.61],'blue',walls);kit.box([.027,.55,.025],[x,.12,.66],'cream',walls);kit.box([.49,.027,.025],[x,.12,.66],'cream',walls);}
  const roof=part('roof','Roof and ridge','The air terminal and roof conductors stand above the roof surface.',house);
  for(const side of [-1,1]){const m=kit.box([1.88,.14,1.69],[side*.79,1.03,-.13],'clay',roof);m.rotation.z=-side*.43;}kit.covers.push(roof);
  const foundation=part('foundation','Foundation','A reference for the ground surface, not part of the assigned pulse circuit.',house);kit.box([3.18,.17,1.61],[0,-1.14,-.10],'metal',foundation);
  const terminal=part('air-terminal','Air terminal','The assumed attachment point. A separate close-up studies ideal field concentration before discharge.');
  kit.rod([0,1.39,.05],[0,2.13,.05],.035,'metal',terminal);
  kit.sphere(.04,[0,2.13,.05],'metal',terminal);kit.box([.19,.10,.22],[0,1.43,.05],'metal',terminal);
  const left=part('left-route','Left roof and down conductor','One assigned 10 m wall route connects the ideal roof node to the common bottom node. Conventional current points upward for the illustrated negative strike.');
  const right=part('right-route','Right roof and down conductor','A second equal route shares current when connected. Its open connection is set before the pulse; induced and capacitive currents are excluded.');
  const paths=[[[0,1.43,.05],[-1.63,.84,.86],[-1.63,-1.03,.86],[0,-1.03,.86]],[[0,1.43,.05],[1.63,.84,.86],[1.63,-1.03,.86],[0,-1.03,.86]]];
  const wires=[route(kit,left,paths[0]),route(kit,right,paths[1].slice(1))];
  const contact=part('right-connection','Second-route connection','A removable roof connection determines whether one or two assigned equal routes carry the pulse.',right);
  const contactRod=kit.rod(paths[1][0],paths[1][1],.028,copper,contact),contactPivot=new THREE.Group();right.add(contactPivot);contactPivot.position.set(...paths[1][0]);contactRod.position.sub(contactPivot.position);contactPivot.add(contactRod);
  // Keep the contact mesh under its selectable part while the pivot opens it.
  contactPivot.remove(contactRod);contactPivot.add(contact);contact.add(contactRod);
  const bar=part('bonding-bar','Common bonding bar','Both route bottoms and the pipe share this ideal electrical node. It does not force the upper pipe and conductor to have equal potential.');
  kit.box([.48,.11,.17],[0,-1.03,.86],'gold',bar);
  const pipe=part('bonded-pipe','Bottom-bonded metal pipe','This separate pipe is bonded only at its bottom. Its assigned current is zero; its potential follows the common earth node.');
  const pipeAssembly=new THREE.Group();pipe.add(pipeAssembly);kit.rod([0,-1.03,1.035],[0,.84,1.035],.041,'blue',pipeAssembly);kit.ring(.071,.025,[0,.82,1.035],'metal',pipeAssembly);
  const pipeBond=dynamicLine(pipe,2,copper),gapCue=dynamicLine(system,2,blue);gapCue.userData.explosionExcluded=true;gapCue.material.dispose();gapCue.material=new THREE.LineDashedMaterial({color:blue,dashSize:.045,gapSize:.025});
  const earth=part('earth-termination','Earth termination and soil contact','A common buried conductor and rods disperse charge. Numbers use an assigned equivalent hemispherical contact, not a resistance calculated from these illustrative rods.');
  route(kit,earth,[[0,-1.03,.86],[0,-1.39,.86],[-.75,-1.39,.86],[-.75,-1.92,.86]],.034);
  route(kit,earth,[[0,-1.39,.86],[.75,-1.39,.86],[.75,-1.92,.86]],.034);
  const soil=part('soil','Soil and spreading potential','Resistive soil reaches a different potential from remote earth. The translucent shells illustrate the assigned half-space approximation.');
  const soilBase=kit.box([5.9,.11,2.32],[0,-1.31,-.08],'leaf',soil);
  const earthShells=[1,1.8,2.7].map(r=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r*.24,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),new THREE.MeshBasicMaterial({color:0x83b4c1,transparent:true,opacity:.21,depthWrite:false,side:THREE.DoubleSide}));m.position.set(0,-1.36,.40);soil.add(m);return m;});
  const probes=part('step-probes','One-meter ground probes','Two contact probes sample ground potential one physical meter apart at the selected distance. They are not a person or a safety test.');
  const probeGroup=new THREE.Group();probes.add(probeGroup);
  for(const x of [0,.18]){kit.rod([x,-1.34,1.06],[x,-.94,1.06],.023,'metal',probeGroup);kit.sphere(.052,[x,-.94,1.06],'blue',probeGroup);}line(probeGroup,[[0,-.92,1.06],[.18,-.92,1.06]],blue);
  const sky=part('storm','Assumed strike and connecting streamer','For this negative-strike illustration, the leader descends and the connecting streamer grows upward. The return-front highlight moves upward, while negative charge transfers downward.');sky.userData.explosionExcluded=true;
  for(const [x,y,r] of [[-.4,2.98,.27],[0,3.06,.34],[.41,3.01,.28]])kit.sphere(r,[x,y-.30,-.2],'metal',sky);
  const leaderPoints=[[.25,2.91,.08],[.12,2.72,.12],[.30,2.59,.13],[.08,2.41,.10],[.11,2.25,.10],[0,2.13,.05]];
  const leader=dynamicLine(sky,6,gold),streamer=dynamicLine(sky,3,0xe3b45e),front=glow(kit,sky,[0,2.13,.10],.07);
  const terminalBeads=Array.from({length:3},()=>glow(kit,terminal,[0,0,0],.032));
  const earthPaths=[[[0,-1.03,.86],[0,-1.39,.86],[-.75,-1.39,.86],[-.75,-1.92,.86]],[[0,-1.03,.86],[0,-1.39,.86],[.75,-1.39,.86],[.75,-1.92,.86]]];
  const earthBeads=earthPaths.map(()=>Array.from({length:3},()=>glow(kit,earth,[0,0,0],.032)));
  const beads=paths.map((path,i)=>Array.from({length:6},()=>glow(kit,i?right:left,[0,0,0],.036)));
  const arrows=[arrow(kit,left,[-1.84,-.35,1.06],[-1.84,.18,1.06]),arrow(kit,right,[1.87,-.35,1.06],[1.87,.18,1.06])];
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  label(guides,'LIGHTNING CONDUCTOR',0,3.64,5.8,.30,1.1);label(guides,'Assumed negative strike · illustrative geometry',0,3.31,5.8,.21,1.1);
  const status=label(guides,'',0,-2.22,6,.23,1.1),branchLabel=label(guides,'',0,-2.52,6,.22,1.1);
  label(guides,'Blue arrows: conventional current ↑',0,-2.80,6,.20,1.1);
  label(guides,'Gold dots: negative charge ↓ · motion slowed',0,-3.04,6,.20,1.1);
  for(const child of guides.children)if(child.material)child.material.side=THREE.FrontSide;
  function detail(id,name,description){const p=part(id,name,description);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;return p;}
  const tip=detail('tip-detail','Field at the terminal tip','A 6 cm by 6 cm window around an ideal grounded semiellipsoid. Equipotentials are 5 kV apart. Space charge and discharge dynamics are excluded.');
  label(tip,'A POINT CONCENTRATES THE FIELD',0,2.38,5.1,.27);label(tip,'Ideal grounded tip · equipotentials 5 kV apart',0,2.07,5.1,.20);
  const tipSurface=dynamicLine(tip,129,copper),contours=Array.from({length:DECLARED.contours},()=>dynamicLine(tip,DECLARED.points*2+1,blue));
  const tipFill=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xae8056,side:THREE.DoubleSide}));tip.add(tipFill);
  const tipValue=label(tip,'',0,-1.57,5.1,.23),tipStatus=label(tip,'',0,-1.90,5.1,.21);
  label(tip,'Before space charge · no strike probability calculated',0,-2.22,5.1,.20);
  const tipScale=45;
  const gap=detail('gap-detail','Voltage beside the bonded pipe','Upper conductor-minus-pipe voltage follows the assigned R–L route. Dividing its magnitude by the selected air gap gives average field stress, not a spark criterion.');
  label(gap,'BONDED BELOW, DIFFERENT ABOVE',0,2.32,5.1,.27);
  kit.rod([-1.30,-1.20,.05],[-1.30,1.30,.05],.045,copper,gap);
  const gapPipe=new THREE.Group();gap.add(gapPipe);kit.rod([0,-1.20,.05],[0,1.30,.05],.045,'blue',gapPipe);
  const gapBond=dynamicLine(gap,2,copper),gapMeasure=dynamicLine(gap,2,blue),pipeLeader=dynamicLine(gap,2,ink);
  gapMeasure.material.dispose();gapMeasure.material=new THREE.LineDashedMaterial({color:blue,dashSize:.07,gapSize:.045});
  const gapArrow=arrow(kit,gap,[-1.67,-.12,.12],[-1.67,.49,.12]);
  label(gap,'Conductor',-1.30,1.60,1.50,.22);const pipeName=label(gap,'Pipe',1.40,1.60,1.20,.22);
  const gapDistance=label(gap,'',0,1.99,4.5,.22),gapVoltage=label(gap,'',0,-1.58,5.1,.23),gapField=label(gap,'',0,-1.89,5.1,.23);
  label(gap,'No exact spark threshold is inferred',0,-2.21,5.1,.21);
  const earthView=detail('earth-detail','Ground potential and probe spacing','An assigned equivalent hemisphere in uniform resistive soil. Potential approaches remote-earth zero with distance; the model excludes soil ionization and wave propagation.');
  label(earthView,'EARTH IS NOT ALL AT ZERO VOLTS',0,2.36,5.1,.27);
  label(earthView,'Assigned hemisphere · uniform soil · remote earth = 0',0,2.03,5.1,.20);
  const earthParameters=label(earthView,'',0,1.68,5.1,.21),earthValue=label(earthView,'',0,-1.15,5.1,.22);
  const earthOrigin=[0,.82,.12],groundLine=line(earthView,[[-2.1,.82,.12],[2.12,.82,.12]],ink);
  const earthRings=[.5,1,2,4,8,12].map(r=>{const mesh=dynamicLine(earthView,65,blue);return {r,mesh};});
  const contactShape=new THREE.Mesh(new THREE.CircleGeometry(1,48,Math.PI,Math.PI),new THREE.MeshBasicMaterial({color:copper,side:THREE.DoubleSide}));contactShape.position.set(...earthOrigin);earthView.add(contactShape);
  const detailProbes=[0,1].map(()=>{const p=new THREE.Group();earthView.add(p);kit.rod([0,.82,.15],[0,1.18,.15],.022,'metal',p);kit.sphere(.045,[0,1.18,.15],'blue',p);return p;});
  const probeReadings=label(earthView,'',0,-1.52,5.1,.22),stepReading=label(earthView,'',0,-1.86,5.1,.23);
  label(earthView,'Model volts only · not a ground-safety assessment',0,-2.19,5.1,.20);
  const earthScale=.13;
  const pulse=detail('pulse-detail','Pulse and conductor voltage','A logarithmic time plot of current magnitude and signed conductor-minus-pipe voltage. The negative-strike convention makes rising-front voltage negative and falling-tail inductive voltage positive.');
  label(pulse,'FAST CHANGE MAKES LARGE VOLTAGE',0,2.35,5.1,.27);
  const currentTitle=label(pulse,'',0,2.04,5.1,.21),voltageTitle=label(pulse,'',0,.13,5.1,.21);
  line(pulse,[[-2,1.76,.04],[-2,.42,.04],[2,.42,.04]],ink);line(pulse,[[-2,-.10,.04],[-2,-1.30,.04],[2,-1.30,.04]],ink);line(pulse,[[-2,-.70,.04],[2,-.70,.04]],0xaaaa95);label(pulse,'0',-2.20,-.70,.25,.18);
  const currentCurve=dynamicLine(pulse,DECLARED.samples,copper),voltageCurve=dynamicLine(pulse,DECLARED.samples,blue),cursor=dynamicLine(pulse,2,gold);
  for(const [t,text] of [[1e-7,'0.1 μs'],[1e-6,'1 μs'],[1e-5,'10 μs'],[1e-4,'100 μs'],[1e-3,'1 ms']]){const x=-2+4*Math.log10(t/DECLARED.clock.start)/Math.log10(DECLARED.clock.end/DECLARED.clock.start);label(pulse,text,x,-1.52,.94,.18);}
  const pulseTime=label(pulse,'',0,-1.85,5.1,.23);label(pulse,'Equal horizontal steps mean tenfold time changes',0,-2.19,5.1,.20);
  return {system,house,walls,roof,foundation,door,terminal,left,right,paths,wires,contact,contactPivot,bar,pipe,pipeAssembly,pipeBond,gapCue,earth,soil,soilBase,earthShells,probes,probeGroup,sky,leaderPoints,leader,streamer,front,terminalBeads,earthPaths,earthBeads,beads,arrows,guides,status,branchLabel,tip,tipSurface,tipFill,contours,tipValue,tipStatus,tipScale,gap,gapPipe,gapBond,gapMeasure,pipeLeader,gapArrow,pipeName,gapDistance,gapVoltage,gapField,earthView,earthParameters,earthValue,earthOrigin,earthRings,groundLine,contactShape,detailProbes,probeReadings,stepReading,earthScale,pulse,currentTitle,voltageTitle,currentCurve,voltageCurve,cursor,pulseTime};
}

export function updateLightningGeometry(g,s,plan){
  const v=s.values,currentActive=s.current>plan.top*1e-6,shownCurrent=s.complete?plan.top:s.current;
  g.contactPivot.rotation.z=v.paths===2?0:.45;
  g.pipeAssembly.position.x=-1.63+v.gap*.65;
  setLine(g.pipeBond,[[g.pipeAssembly.position.x,-1.03,1.035],[0,-1.03,.86]]);
  setLine(g.gapCue,[[-1.63,.84,1.11],[g.pipeAssembly.position.x,.84,1.11]]);
  g.probeGroup.position.x=.64+.16*v.distance;
  g.earthShells.forEach((m,i)=>{m.scale.setScalar(v.radius);tintByVoltage(m,-v.soil*s.current/(2*Math.PI*v.radius*(i+1)));});
  const leadFraction=Math.min(1,s.clock/1.8),leaderCount=Math.max(1,Math.ceil(leadFraction*g.leaderPoints.length));setLine(g.leader,g.leaderPoints.slice(0,leaderCount));g.leader.visible=s.clock>0;
  setLine(g.streamer,[[0,2.13,.05],[.06,2.13+.12*Math.min(1,Math.max(0,s.clock-1)),.09],[.11,2.13+.22*Math.min(1,Math.max(0,s.clock-1)),.10]]);g.streamer.visible=s.clock>1;
  g.front.visible=s.clock>=DECLARED.attachment&&s.clock<DECLARED.attachment+.65;g.front.position.copy(pointOnRoute([...g.leaderPoints].reverse(),Math.max(0,(s.clock-DECLARED.attachment)/.65)));
  g.terminalBeads.forEach((m,j)=>{m.visible=currentActive;m.position.copy(pointOnRoute([[0,2.13,.05],[0,1.43,.05]],(s.clock*.8+j/3)%1));});
  g.earthBeads.forEach((beads,i)=>beads.forEach((m,j)=>{m.visible=currentActive;m.position.copy(pointOnRoute(g.earthPaths[i],(s.clock*.8+j/3)%1));}));
  g.beads.forEach((beads,i)=>beads.forEach((m,j)=>{m.visible=currentActive&&(i===0||v.paths===2);m.position.copy(pointOnRoute(g.paths[i],((s.clock*.8+j/beads.length)%1)));m.scale.setScalar(.60+.65*Math.sqrt(s.share/v.paths));}));
  g.arrows.forEach((m,i)=>{m.visible=currentActive&&(i===0||v.paths===2);});
  g.status.userData.setText(s.phase);
  g.branchLabel.userData.setText(s.complete?`Recorded peak ${(plan.top/1000).toFixed(0)} kA · ${v.paths} route${v.paths===1?'':'s'} · ${(plan.top/v.paths/1000).toFixed(0)} kA each`:`Now ${(s.current/1000).toFixed(1)} kA total · left ${(s.leftCurrent/1000).toFixed(1)} · right ${(s.rightCurrent/1000).toFixed(1)} kA`);
  const surfaceHalf=Math.min(DECLARED.window.half,plan.spheroid.b*Math.sqrt(1-(1-DECLARED.window.below/plan.spheroid.c)**2));const tipPoints=[];for(let j=0;j<=128;j++){const x=(j/128-.5)*2*surfaceHalf,z=plan.spheroid.c*Math.sqrt(Math.max(0,1-x*x/(plan.spheroid.b**2)))-plan.spheroid.c;tipPoints.push([x*g.tipScale,z*g.tipScale-.20,.11]);}setLine(g.tipSurface,tipPoints);
  if(g.tipRadius!==v.tip){const shape=new THREE.Shape();shape.moveTo(tipPoints[0][0],tipPoints[0][1]);for(const [x,y]of tipPoints.slice(1))shape.lineTo(x,y);shape.closePath();g.tipFill.geometry.dispose();g.tipFill.geometry=new THREE.ShapeGeometry(shape);g.tipFill.position.z=.09;g.tipRadius=v.tip;}
  g.contours.forEach((m,i)=>{const c=plan.contours[i];m.visible=Boolean(c);if(c)setLine(m,c.points.map(([x,y])=>[x*g.tipScale,y*g.tipScale-.20,.08]));});
  g.tipValue.userData.setText(`${v.tip.toFixed(1)} mm tip · ideal ${(plan.tipField/1e6).toFixed(2)} MV/m · ${plan.enhancement.toFixed(0)}× field`);
  g.tipStatus.userData.setText(plan.tipField>=CORONA.onset?'Past onset reference: space charge would alter this field':'Below 6.79 MV/m historical corona-onset reference');
  const px=-1.30+1.50*v.gap;g.gapPipe.position.x=px;setLine(g.pipeLeader,[[px,1.31,.06],[1.40,1.43,.06]]);
  setLine(g.gapBond,[[-1.30,-1.20,.05],[px,-1.20,.05]]);setLine(g.gapMeasure,[[-1.30,1.30,.13],[px,1.30,.13]]);g.gapDistance.userData.setText(`${v.gap.toFixed(2)} m air gap`);g.gapArrow.visible=currentActive;
  g.gapVoltage.userData.setText(s.complete?`Peak |conductor − pipe| ${(plan.gapMax/1e6).toFixed(3)} MV`:`Conductor − pipe ${(s.gap/1e6).toFixed(3)} MV`);
  g.gapField.userData.setText(`${s.complete?'Peak':'Now'} average field ${((s.complete?plan.gapField:s.field)/1e6).toFixed(3)} MV/m`);
  g.contactShape.scale.setScalar(v.radius*g.earthScale);
  g.earthParameters.userData.setText(`ρ ${v.soil} Ω·m · radius ${v.radius.toFixed(1)} m · R ${plan.earthResistance.toFixed(2)} Ω`);
  g.earthValue.userData.setText(`${s.complete?'Peak':'Now'} contact potential: ${(-plan.earthResistance*shownCurrent/1e6).toFixed(3)} MV`);
  g.earthRings.forEach(({r,mesh})=>{mesh.visible=r>=v.radius;const points=Array.from({length:65},(_,j)=>{const a=Math.PI*j/64;return [g.earthOrigin[0]+r*g.earthScale*Math.cos(a),g.earthOrigin[1]-r*g.earthScale*Math.sin(a),.07];});setLine(mesh,points);tintByVoltage(mesh,-v.soil*shownCurrent/(2*Math.PI*r));});
  g.detailProbes.forEach((p,i)=>{p.position.x=g.earthOrigin[0]+(v.distance+i)*g.earthScale;});

  const near=-v.soil*shownCurrent/(2*Math.PI*v.distance),far=-v.soil*shownCurrent/(2*Math.PI*(v.distance+1));
  g.probeReadings.userData.setText(`${s.complete?'At peak':'Now'} · ${v.distance} m: ${(near/1000).toFixed(1)} kV · ${v.distance+1} m: ${(far/1000).toFixed(1)} kV`);
  g.stepReading.userData.setText(`1 m probe difference: ${(Math.abs(near-far)/1000).toFixed(1)} kV`);
  const xOf=t=>-2+4*Math.log10(t/DECLARED.clock.start)/Math.log10(DECLARED.clock.end/DECLARED.clock.start);
  setLine(g.currentCurve,plan.samples.map(q=>[xOf(q.t),.42+1.30*q.current/200000,.10]));
  setLine(g.voltageCurve,plan.samples.map(q=>[xOf(q.t),-.70+.56*q.gap/plan.gapMax,.10]));
  g.currentTitle.userData.setText(`Current magnitude · fixed full height 200 kA · selected peak ${v.peak} kA`);
  g.voltageTitle.userData.setText(`Conductor − pipe · lower/upper extent ±${(plan.gapMax/1e6).toFixed(3)} MV`);
  const cx=xOf(Math.max(DECLARED.clock.start,s.physicalTime));setLine(g.cursor,[[cx,1.76,.15],[cx,-1.30,.15]]);g.cursor.visible=s.attached;
  g.pulseTime.userData.setText(s.attached?`${(s.physicalTime*1e6).toFixed(s.physicalTime<1e-5?2:0)} μs since connection · ${s.complete?'record complete':s.phase.toLowerCase()}`:'Press Play to connect the assumed strike');
}
