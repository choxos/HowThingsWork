import * as THREE from 'three';
import {textLabel,lineObject,fillLine,solidArrow} from './scene-kit.js';
import {diodeCurve,formatDiodeCurrent,LOAD} from './diode-physics.js';

const C={ink:0x374736,wire:0xb78b46,metal:0xb4c5b0,red:0xc14f39,blue:0x2b5d9c,p:0xeccdc6,n:0xc6d8ea,cream:0xf0dfaf,gold:0xe3b45e};
const label=(parent,text,x,y,width=4.9,height=.2,z=.25)=>textLabel(parent,text,{position:[x,y,z],width,height,color:'#374736'});
const polyline=(parent,points,color=C.ink)=>{const line=lineObject(points.length,color,parent);fillLine(line,points);return line;};
const cross=(parent,color)=>lineObject(5,color,parent);
const drawCross=(line,x,y,size=.065)=>fillLine(line,[[x-size,y-size,.3],[x+size,y+size,.3],[x,y,.3],[x-size,y+size,.3],[x+size,y-size,.3]]);
const fx=v=>.42+1.86*v,rx=v=>-2.3+1.8*(v+20)/20,cy=i=>-1.35+2.55*(Math.log10(Math.max(1e-12,Math.abs(i)))+12)/12;

export function createDiodeGeometry(kit) {
  const {part,box,rod,sphere,disk,cylinder,ring}=kit;
  const circuit=part('circuit','Diode test circuit','A source drives a diode and a resistive load through a switch and current meter. Reverse either the source or the diode to compare conduction and leakage.');
  const board=part('board','Mounting board','The board holds the test circuit; the visible leads form its electrical connections.',[0,0,-.22],circuit);box([6.2,3.9,.14],[0,0,0],'cream',board);
  const source=part('source','Adjustable source','An ideal signed voltage source. Its upper terminal is positive when the selected voltage is positive.',[-2.25,0,0],circuit);box([1.35,2.05,.58],[0,0,0],'blue',source);
  const sourceText=label(source,'',0,.5,1.18,.23,.31);label(source,'SUPPLY',0,.82,1.1,.18,.31);disk(.23,.13,[0,-.25,.35],'ink',source);rod([0,-.25,.43],[.15,-.1,.43],.015,'cream',source);
  const upper=part('upper-terminal','Upper source terminal','Current leaves this terminal in the positive forward-current example.',[-1.54,.65,.35],circuit);sphere(.07,[0,0,0],'red',upper);
  const lower=part('return-terminal','Return source terminal','The return conductor closes the electrical circuit.',[-1.54,-.65,.35],circuit);sphere(.07,[0,0,0],'ink',lower);
  const plus=label(upper,'',-.19,.02,.18,.2,.12),minus=label(lower,'',-.19,.02,.18,.2,.12);
  const switchBase=part('switch','Switch contacts','A closed switch completes the path. Opening it stops circuit current while an already warm load cools.',[-.775,1.1,.14],circuit);box([.86,.34,.15],[0,0,0],'wood',switchBase);
  const switchEnds=[[-.325,0,.21],[.325,0,.21]].map(p=>sphere(.06,p,'metal',switchBase));
  const lever=part('switch-blade','Switch blade','The blade makes physical contact with both switch posts only in the closed state.',[-1.1,1.1,.35],circuit);const blade=rod([0,0,0],[.65,0,0],.035,'gold',lever);sphere(.055,[.65,0,0],'gold',lever);
  const diode=part('diode','Signal diode','A silicon 1N4148 example. The black band marks its cathode; forward conventional current enters the opposite anode.',[.7,1.1,.35],circuit);
  const glass=part('diode-case','Glass package and cathode band','The cathode band identifies one terminal. Look inside to expose the enlarged die.',[0,0,0],diode);
  const outer=cylinder(.205,.95,[0,0,0],0xd09265,glass);outer.rotation.z=Math.PI/2;outer.material=outer.material.clone();outer.material.transparent=true;outer.material.opacity=.58;outer.material.depthWrite=false;
  const band=cylinder(.21,.105,[.34,0,0],'ink',glass);band.rotation.z=Math.PI/2;kit.covers.push(glass);
  const anode=part('anode-lead','Anode lead','This lead connects to the p-type side of the junction.',[0,0,0],diode);rod([-.95,0,0],[-.16,0,0],.035,'metal',anode);
  const cathode=part('cathode-lead','Cathode lead','This lead connects to the n-type side; the package band marks it.',[0,0,0],diode);rod([.16,0,0],[.95,0,0],.035,'metal',cathode);
  const die=part('die','Silicon die','Two doped regions form a junction in one semiconductor crystal. This enlarged die is schematic.',[0,0,0],diode);box([.17,.22,.2],[-.085,0,0],C.p,die);box([.17,.22,.2],[.085,0,0],C.n,die);
  const sockets=part('sockets','Diode sockets','Both leads stay connected when the diode is turned around.',[0,0,0],circuit);const socketEnds=[[-.25,1.1,.35],[1.65,1.1,.35]].map(p=>sphere(.065,p,'metal',sockets));
  label(circuit,'DIODE',.7,1.63,1.3,.19,.36).userData.explosionExcluded=true;
  const load=part('load','Resistive load','A fixed-ohmic load receives I²R power. Its assigned thermal mass and heat loss determine its temperature.',[2.1,0,.35],circuit);box([.5,1.13,.42],[0,0,0],'cream',load);rod([0,.565,0],[0,.8,0],.035,'metal',load);rod([0,-.565,0],[0,-.8,0],.035,'metal',load);
  const loadText=label(load,'',0,0,1,.16,.23);loadText.rotation.z=Math.PI/2;
  const thermometer=part('thermometer','Load thermometer','The column shows load temperature. Its color is an indicator, not visible incandescence.',[.62,-.12,0],load);box([.18,1.48,.12],[0,0,0],'cream',thermometer);sphere(.115,[0,-.73,.04],'red',thermometer);const mercury=box([.08,1,.04],[0,-.7,.085],'red',thermometer);const temperatureText=label(load,'',.25,-1.68,1.45,.22,.01);
  const meter=part('meter','Current meter','An ideal ammeter. Positive loop current flows left to right across the upper branch. The meter changes range to make nanoampere leakage readable.',[.03,-1.23,.17],circuit);box([1.45,.91,.33],[0,0,0],'leaf',meter);box([1.25,.7,.025],[0,0,.18],'cream',meter);
  const needle=new THREE.Group();needle.position.set(0,-.04,.205);meter.add(needle);rod([0,0,0],[0,.29,0],.014,'red',needle);const meterText=label(meter,'',0,-.23,1.28,.17,.22),rangeText=label(meter,'',0,.29,1.28,.13,.23);
  const meterEnds=[[-.725,0,0],[.725,0,0]].map(p=>sphere(.055,p,'metal',meter));
  const wiring=part('wiring','Complete conducting path','The wire path includes both outgoing and return connections. Markers show conventional current; electron motion in metals is opposite.',[0,0,0],circuit);
  const paths=[
    [[-1.54,.65,.35],[-1.25,.65,.35],[-1.25,1.1,.35],[-1.1,1.1,.35]],
    [[-.45,1.1,.35],[-.25,1.1,.35]],
    [[1.65,1.1,.35],[2.1,1.1,.35],[2.1,.8,.35]],
    [[2.1,-.8,.35],[2.1,-1.23,.35],[.755,-1.23,.17]],
    [[-.695,-1.23,.17],[-1.25,-1.23,.35],[-1.25,-.65,.35],[-1.54,-.65,.35]],
  ];
  const wires=[];for(const path of paths)for(let i=1;i<path.length;i++)wires.push({a:path[i-1],b:path[i],object:rod(path[i-1],path[i],.028,C.wire,wiring)});
  const flowRoot=new THREE.Group();circuit.add(flowRoot);flowRoot.userData.explosionExcluded=true;flowRoot.userData.selectionExcluded=true;
  const flowPath=[...paths[0],[-.45,1.1,.35],[-.25,1.1,.35],[1.65,1.1,.35],[2.1,1.1,.35],[2.1,.8,.35],[2.1,-.8,.35],[2.1,-1.23,.35],[.755,-1.23,.17],[-.695,-1.23,.17],[-1.25,-1.23,.35],[-1.25,-.65,.35],[-1.54,-.65,.35],[-1.54,.65,.35]].map(p=>new THREE.Vector3(...p));
  const lengths=flowPath.slice(1).map((p,i)=>p.distanceTo(flowPath[i])),length=lengths.reduce((a,b)=>a+b,0);
  const flow=Array.from({length:14},()=>sphere(.038,[0,0,0],'gold',flowRoot));
  const arrow=solidArrow(kit,'#b47e26',flowRoot,.028);arrow.position.set(.7,.66,.5);arrow.userData.setLength(.8);
  const status=label(circuit,'',0,-2.08,6.1,.24,.4);status.userData.explosionExcluded=true;

  const junction=part('junction','Inside the p–n junction','Fixed ionized dopants and mobile carriers play different roles. Forward bias favors carrier injection; reverse bias leaves a small leakage current.',[0,0,0],circuit);junction.userData.inspectionOnly='junction';junction.userData.explosionExcluded=true;
  label(junction,'INSIDE THE JUNCTION',0,2.17,5,.27);const junctionHeading=label(junction,'',0,1.82,5,.21);
  box([2.1,1.2,.15],[-1.05,.49,0],C.p,junction);box([2.1,1.2,.15],[1.05,.49,0],C.n,junction);
  label(junction,'p type · anode',-1.18,1.29,2.1,.21);label(junction,'n type · cathode',1.18,1.29,2.1,.21);
  const depleted=box([1,1.2,.04],[0,.49,.1],'cream',junction),ions=[];
  for(const side of [-1,1])for(let column=0;column<11;column++)for(let row=0;row<3;row++){
    const x=side*(.03+column*.07),y=.16+row*.32,group=new THREE.Group();group.position.set(x,y,.15);junction.add(group);rod([-.017,0,0],[.017,0,0],.004,C.ink,group);if(side>0)rod([0,-.017,0],[0,.017,0],.004,C.ink,group);ions.push({object:group,x});
  }
  const majority=[];
  for(const side of [-1,1])for(let column=0;column<4;column++)for(let row=0;row<3;row++){
    const x=side*(.98+column*.25),y=.11+row*.34,object=side<0?ring(.043,.009,[x,y,.2],C.red,junction):sphere(.035,[x,y,.2],C.blue,junction);majority.push({object,x,y});
  }
  const particles=Array.from({length:8},(_,i)=>{
    const hole=i%2===0,object=hole?ring(.043,.009,[0,0,.21],C.red,junction):sphere(.035,[0,0,.21],C.blue,junction);return {object,hole,index:i};
  });
  const carrierText=label(junction,'',0,-.43,5,.2),widthText=label(junction,'',0,-.75,5,.19);
  label(junction,'− fixed acceptor ions     + fixed donor ions',0,-1.09,5,.19);
  label(junction,'Red rings: holes · blue dots: electrons',0,-1.41,5,.19);
  label(junction,'Motion and depletion width are schematic',0,-1.73,5,.18);
  const equilibrium=label(junction,'',0,-2.07,5,.19);

  const curve=part('curve','Current against diode voltage','The current scale is logarithmic. Reverse and forward voltages use different horizontal scales. The moving cross is the actual circuit operating point.',[0,0,0],circuit);curve.userData.inspectionOnly='curve';curve.userData.explosionExcluded=true;
  label(curve,'CURRENT THROUGH THE DIODE',0,2.18,5,.25);const curveText=label(curve,'',0,1.84,5,.2);
  label(curve,'Reverse · current backward',-1.4,1.51,2.4,.18);label(curve,'Forward · current ahead',1.35,1.51,2.4,.18);
  for(const [lo,hi] of [[rx(-20),rx(0)],[fx(0),fx(1)]])polyline(curve,[[lo,1.2,.12],[lo,-1.35,.12],[hi,-1.35,.12]],C.ink);
  for(const [amps,text] of [[1e-12,'1 pA'],[1e-9,'1 nA'],[1e-6,'1 μA'],[1e-3,'1 mA'],[1,'1 A']]){
    label(curve,text,-.01,cy(amps),.68,.145);for(const [lo,hi] of [[rx(-20),rx(0)],[fx(0),fx(1)]])polyline(curve,[[lo,cy(amps),.08],[hi,cy(amps),.08]],0xc3c7b8);
  }
  for(const v of [-20,-10,0])label(curve,String(v),rx(v),-1.58,.55,.16);
  for(const v of [0,.5,1])label(curve,String(v),fx(v),-1.58,.55,.16);
  label(curve,'Diode voltage (V) · |current| uses equal decades',0,-1.87,5,.18);
  const reversePoints=[],forwardPoints=[];
  for(let i=1;i<=160;i++){const v=-20*(i/160)**4,ri=diodeCurve(v).current;if(Math.abs(ri)>=1e-12)reversePoints.push([rx(v),cy(ri),.16]);const f=(i/160)**3,fi=diodeCurve(f).current;if(fi>=1e-12)forwardPoints.push([fx(f),cy(fi),.16]);}
  polyline(curve,reversePoints,C.blue);polyline(curve,forwardPoints,C.red);polyline(curve,[[fx(.7),-1.35,.1],[fx(.7),1.2,.1]],0xa6ac9c);
  const limitForward=cross(curve,C.red),limitReverse=cross(curve,C.red);drawCross(limitForward,fx(1),cy(.01),.045);drawCross(limitReverse,rx(-20),cy(25e-9),.045);
  const cursor=cross(curve,C.ink);label(curve,'Red ×: sheet limits · gray: fixed 0.7 V shortcut',0,-2.16,5,.17);
  return {circuit,board,source,upper,lower,sourceText,plus,minus,switchBase,switchEnds,lever,blade,diode,glass,outer,band,anode,cathode,die,sockets,socketEnds,load,loadText,thermometer,mercury,temperatureText,meter,meterEnds,needle,meterText,rangeText,wiring,wires,paths,flowRoot,flowPath,lengths,length,flow,arrow,status,junction,junctionHeading,depleted,ions,majority,particles,carrierText,widthText,equilibrium,curve,curveText,cursor};
}

export function updateDiodeGeometry(g,s) {
  const v=s.values;
  g.sourceText.userData.setText(`${v.voltage.toFixed(2)} V`);g.plus.userData.setText(v.voltage>0?'+':v.voltage<0?'−':'0');g.minus.userData.setText(v.voltage>0?'−':v.voltage<0?'+':'0');
  g.lever.rotation.z=v.closed?0:.65;g.diode.rotation.z=v.orientation===1?0:Math.PI;g.loadText.userData.setText(`${v.resistance} Ω`);
  const height=.05+1.28*Math.min(1,(s.temperature-LOAD.ambient)/125);g.mercury.scale.y=height;g.mercury.position.y=-.7+height/2;g.temperatureText.userData.setText(`${s.temperature.toFixed(1)} °C`);
  const scale=Math.abs(s.current)<1e-6?1e-8:.1,ratio=Math.max(-1,Math.min(1,s.current/scale));g.needle.rotation.z=-ratio*1.15;g.meterText.userData.setText(formatDiodeCurrent(s.current));g.rangeText.userData.setText(scale===1e-8?'Range ±10 nA':'Range ±100 mA');
  const active=v.closed&&s.current!==0,speed=active?.17+.16*Math.max(0,Math.log10(Math.abs(s.current)/1e-9)):0;
  for(let i=0;i<g.flow.length;i++){
    let distance=((i/g.flow.length+(s.current<0?-1:1)*s.time*speed/g.length)%1+1)%1*g.length;let segment=0;
    while(segment<g.lengths.length-1&&distance>g.lengths[segment]){distance-=g.lengths[segment];segment++;}
    const object=g.flow[i];object.visible=active;object.position.copy(g.flowPath[segment]).lerp(g.flowPath[segment+1],distance/g.lengths[segment]);object.position.z+=.045;
  }
  g.arrow.userData.setDirection(new THREE.Vector3(s.current<0?-1:1,0,0));g.arrow.visible=active;
  g.status.userData.setText(`${s.bias} · ${formatDiodeCurrent(s.diodeCurrent)} · load ${s.temperature.toFixed(1)} °C`);
  const width=.32*s.depletionCue;g.depleted.scale.x=width;g.ions.forEach(ion=>{ion.object.visible=Math.abs(ion.x)<width/2;});
  g.junctionHeading.userData.setText(`${s.bias} · anode minus cathode ${s.diodeVoltage.toFixed(4)} V`);
  g.majority.forEach((p,i)=>p.object.position.set(p.x+.013*Math.sin(s.time*5+i),p.y+.013*Math.cos(s.time*4+i),.2));
  for(const particle of g.particles){
    const zero=s.diodeCurrent===0,direction=(particle.hole?1:-1)*(s.diodeCurrent<0?-1:1)*(zero&&particle.index%4<2?-1:1),rate=zero?.21:.16+.09*Math.max(0,Math.log10(Math.abs(s.diodeCurrent)/1e-9));
    const fraction=((particle.index/g.particles.length+direction*s.time*rate)%1+1)%1;particle.object.position.set(-1.98+3.96*fraction,.07+(particle.index%4)*.27,.22);
  }
  g.carrierText.userData.setText(s.diodeCurrent===0?'Opposing carrier flows balance':s.diodeCurrent>0?'Holes →     conventional current →     electrons ←':'Holes ←     reverse leakage ←     electrons →');
  g.widthText.userData.setText(s.bias==='Reverse bias'?'Wider depleted region; few mobile carriers':s.bias==='Forward bias'?'Lower barrier; carrier injection increases':'Built-in field remains at zero applied voltage');
  g.equilibrium.userData.setText(s.diodeCurrent===0?'Zero net current does not mean motion stops':`${formatDiodeCurrent(s.diodeCurrent)}; marker speed is not a physical carrier speed`);
  g.curveText.userData.setText(s.diodeCurrent===0?'Zero current lies below this logarithmic axis':`${s.diodeVoltage.toFixed(4)} V → ${formatDiodeCurrent(s.diodeCurrent)}`);
  drawCross(g.cursor,s.diodeVoltage<0?rx(s.diodeVoltage):fx(s.diodeVoltage),cy(s.diodeCurrent));g.cursor.visible=s.diodeCurrent!==0;
}
