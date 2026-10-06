import * as THREE from 'three';
import {textLabel,lineObject,fillLine} from './scene-kit.js';
import {SMOKE_SCIENCE as C,smokeAlphaTrack,smokeChambers,smokeAfterGold,smokeAirRange,smokeAirEnergy,smokePairsPerMillimeter} from './smoke-detector-science.js';
import {ION_SMOKE_RUN as R} from './ionization-smoke-physics.js';

const P={ink:0x374736,blue:0x2b5d9c,red:0xc14f39,gold:0xe3b45e,smoke:0x666962,leaf:0x91aa7e};
const label=(parent,text,x,y,width=5,height=.2,z=.2,color='#374736')=>textLabel(parent,text,{position:[x,y,z],width,height,color});
const own=mesh=>{mesh.material=mesh.material.clone();return mesh;};
const visual=object=>{object.userData.explosionExcluded=true;object.userData.selectionExcluded=true;return object;};
const line=(parent,points,color=P.ink)=>{const object=lineObject(points.length,color,parent);fillLine(object,points);return object;};
const setText=(object,text)=>object.userData.setText(text);
const v3=p=>new THREE.Vector3(...p);

export function createIonSmokeGeometry(kit){
  const {part,box,disk,ring,rod,sphere}=kit;
  const system=part('system','Ionization sensing assembly','Follow a sealed source, two gas paths in series, a voltage comparison and a powered sounder. This enlarged layout exposes their connections.');
  const base=part('base','Insulating support','Supports the chamber and circuit. Component positions are arranged for inspection.',[0,0,-.18],system);
  box([6.4,5.5,.24],[0,0,0],'cream',base);
  const board=part('board','Circuit board','Separate conductors carry supply, return and the high-impedance detect signal.',[0,0,-.02],system);box([6.06,5.16,.08],[0,0,0],'leaf',board);
  const battery=part('battery','Battery and terminals','Provides collection voltage and the much larger power needed by the sounder. It does not power radioactive decay.',[-1.8,-2,.22],system);
  box([1.65,.66,.42],[0,0,0],'ink',battery);box([.28,.67,.43],[-.69,0,0],'gold',battery);
  const batteryText=label(battery,'',0,-.01,1.3,.2,.24,'#f0dfaf');
  const positive=sphere(.07,[.48,.39,0],'red',battery),negative=sphere(.07,[-.48,.39,0],'metal',battery);
  const contact=part('contact','Battery contact','Opening this contact removes voltage from the chambers and power from the electronics.',[0,0,0],system);
  const powerStart=[-1.32,-1.61,.22],powerEnd=[-.74,-1.61,.22];
  const blade=rod(powerStart,powerEnd,.035,'gold',contact);sphere(.065,powerEnd,'metal',contact);
  const comparator=part('comparator','Comparator and horn driver','The shared electrode feeds a high-impedance input. A sampled voltage above half the supply requests the horn.',[.86,-1.8,.18],system);
  box([1.12,.72,.25],[0,0,0],'ink',comparator);for(let i=0;i<4;i++)for(const side of [-1,1])rod([side*.55,-.27+i*.18,0],[side*.7,-.27+i*.18,0],.024,'metal',comparator);
  label(comparator,'COMPARE',0,.12,.99,.15,.15,'#f0dfaf');label(comparator,'THEN DRIVE',0,-.13,.99,.14,.15,'#f0dfaf');
  const lamp=own(sphere(.09,[.02,.48,.1],'red',comparator));
  const guard=part('guard','Guard around detect input','A conductor close to the input voltage reduces unwanted leakage into a picoampere signal. Leakage is omitted from the calculation.',[0,0,0],system);
  const guardPath=[[.52,-1.39,.23],[.52,-1.08,.23],[1.2,-1.08,.23],[1.2,-1.39,.23]];
  for(let i=1;i<guardPath.length;i++)rod(guardPath[i-1],guardPath[i],.025,'gold',guard);
  const horn=part('horn','Piezoelectric sounder','Electrical drive bends a ceramic and metal diaphragm. The motion and pressure arcs are enlarged and slowed.',[2.18,.83,.25],system);
  const metal=disk(.72,.045,[0,0,0],'gold',horn),ceramic=disk(.5,.035,[0,0,.044],'cream',horn);ring(.73,.045,[0,0,.04],'wood',horn);
  rod([.18,-.25,.077],[.18,-.63,.077],.022,'red',horn);rod([0,-.55,0],[0,-.7,0],.022,'blue',horn);
  const ceramicRest=ceramic.geometry.attributes.position.array.slice();
  const waves=Array.from({length:3},(_,i)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(.85+i*.16,.017,6,30,1.45),new THREE.MeshBasicMaterial({color:P.red}));o.rotation.z=-.72;o.position.z=.1;horn.add(visual(o));return o;});
  const hornText=visual(label(horn,'Powered sounder',0,1.13,2,.16,.1));

  const ions=part('ions','Two ionization chambers','The reference half stays smoke-free. The sensing half admits smoke. Their currents are equal at every steady state.',[-.65,.6,.12],system);
  const scale=.118,gasBase=.42;ions.scale.setScalar(scale);
  const common=part('common','Shared electrode and detect node','Both lower gas boundaries share this conductor. Its voltage is measured without drawing appreciable input current.',[0,0,0],ions);disk(C.radius,.6,[0,0,0],'metal',common);
  const foil=part('foil','Sealed source foil','An assigned 5.1 mm foil emits alpha particles into the two halves. A thin cover contains the radioactive material.',[0,0,.34],ions);disk(C.sourceRadius,.16,[0,0,0],'gold',foil);
  const divider=part('divider','Smoke barrier and alpha stop','Separates the reference and sensing air. An alpha hitting the partition deposits its remaining energy in the wall, outside the modeled air.',[0,0,0],ions);
  const partition=own(box([.2,2*C.radius,C.referenceGap],[0,0,gasBase+C.referenceGap/2],'wood',divider));partition.material.transparent=true;partition.material.opacity=.12;partition.material.depthWrite=false;
  line(divider,[[0,-C.radius,gasBase],[0,-C.radius,gasBase+C.referenceGap],[0,C.radius,gasBase+C.referenceGap],[0,C.radius,gasBase]],P.ink);
  const halves=[];
  for(const side of [-1,1]){
    const gap=side<0?C.referenceGap:C.sensingGap,id=side<0?'reference':'sensing';
    const half=part(id,side<0?'Smoke-free reference gas':'Smoke-sensing gas',side<0?'No smoke capture here. Its voltage and collection current still change when the shared node moves.':'Smoke captures small mobile ions. The battery field collects fewer of them despite the rising voltage across this half.',[0,0,0],ions);
    const electrode=part(id+'-electrode',side<0?'Reference electrode: positive supply':'Sensing electrode: return',side<0?'Connects the reference gas to battery positive.':'Connects the sensing gas to battery negative.',[0,0,gasBase+gap],half);
    const plate=disk(C.radius,.5,[0,0,0],'metal',electrode);plate.geometry.dispose();plate.geometry=new THREE.CylinderGeometry(C.radius,C.radius,.5,40,1,false,side>0?0:Math.PI,Math.PI);
    own(plate);plate.material.transparent=true;plate.material.opacity=.2;plate.material.depthWrite=false;
    const outline=[];for(let i=0;i<=32;i++){const a=(side>0?0:Math.PI)+Math.PI*i/32;outline.push([C.radius*Math.sin(a),-C.radius*Math.cos(a),.3]);}line(electrode,outline,P.ink);rod([0,-C.radius,0],[0,C.radius,0],.16,'metal',electrode);
    const shell=part(id+'-shell',side<0?'Reference shell':'Sensing inlet screen',side<0?'This assigned reference keeps smoke outside. Cutaway removes its wall for inspection.':'Openings admit air and smoke while a screen surrounds the electrode gap.',[0,0,0],half);
    if(side<0){const wall=new THREE.Mesh(new THREE.CylinderGeometry(C.radius,C.radius,gap,40,1,true,Math.PI,Math.PI),plate.material.clone());wall.rotation.x=Math.PI/2;wall.position.z=gasBase+gap/2;wall.material.opacity=1;wall.material.transparent=false;wall.material.depthWrite=true;shell.add(wall);}
    for(let i=0;i<11;i++){const a=(side>0?0:Math.PI)+Math.PI*(i+.5)/11;rod([C.radius*Math.sin(a),-C.radius*Math.cos(a),gasBase],[C.radius*Math.sin(a),-C.radius*Math.cos(a),gasBase+gap],.2,'metal',shell);}
    kit.covers.push(shell);
    const tracksRoot=visual(new THREE.Group());half.add(tracksRoot);const tracks=[];
    for(let i=0;i<9;i++){
      const rr=C.sourceRadius*Math.sqrt((i+.5)/9),phi=-Math.PI/2+Math.PI*((i*4)%9+.5)/9,mu=.22+.75*((i*5)%9+.5)/9,azimuth=Math.PI*2*(i+.5)/9;
      const path=smokeAlphaTrack(5.48556,[rr*Math.cos(phi),rr*Math.sin(phi)],mu,azimuth,gap),mirror=p=>[side*p[0],p[1],p[2]+gasBase];
      const start=mirror(path.source),end=mirror(path.end),trace=line(tracksRoot,[start,end],P.gold),alpha=sphere(.22,start,'gold',tracksRoot);
      tracks.push({path,start,end,trace,alpha,index:i});
    }
    const chargeRoot=visual(new THREE.Group());half.add(chargeRoot);const charges=[];
    for(let i=0;i<40;i++){
      const rr=C.radius*Math.sqrt(.06+.79*((i*17)%40+.5)/40),phi=-Math.PI/2+Math.PI*((i*13)%40+.5)/40,x=side*rr*Math.cos(phi),y=rr*Math.sin(phi);
      const plus=sphere(.27,[x,y,0],'red',chargeRoot),minus=sphere(.27,[x,y,0],P.blue,chargeRoot);
      charges.push({x,y,plus,minus,index:i});
    }
    const smokeRoot=visual(new THREE.Group());half.add(smokeRoot);const particles=side>0?Array.from({length:24},(_,i)=>{const rr=C.radius*Math.sqrt(.06+.82*((i*7)%24+.5)/24),phi=-Math.PI/2+Math.PI*((i*11)%24+.5)/24;return {object:sphere(.55,[rr*Math.cos(phi),rr*Math.sin(phi),gasBase+gap*(i+.5)/24],P.smoke,smokeRoot),index:i};}):[];
    const captures=side>0?Array.from({length:6},(_,i)=>{const sign=i%2?1:-1,x=2.2+1.8*Math.floor(i/2),y=-4.8+1.7*(i%2);return {sign,x,y,ion:sphere(.32,[x,y,0],sign>0?'red':P.blue,smokeRoot),particle:sphere(.68,[x,y,0],P.smoke,smokeRoot)};}):[];
    const tag=visual(label(half,side<0?'SMOKE-FREE':'SMOKE ENTERS',side*6.2,12.7,15,1.45,gasBase+gap));
    const voltage=visual(label(half,'',side*6.2,10.5,15,1.35,gasBase+gap));
    tag.userData.inspectionOnly=voltage.userData.inspectionOnly='ions';
    halves.push({side,gap,half,electrode,plate,shell,tracksRoot,tracks,charges,particles,captures,tag,voltage});
  }
  const ionLegend=visual(label(ions,'Gold: alpha · red: + ion · blue: − ion',0,-14,38,1.35,gasBase));ionLegend.userData.inspectionOnly='ions';
  const wires=part('wires','Supply, sense and return conductors','The gas path is battery positive → reference → shared node → sensing → battery return. The controller has separate supply wires for horn power.',[0,0,0],system);
  const pos=p=>ions.localToWorld(v3(p)).toArray();kit.root.updateMatrixWorld(true);
  const referencePin=pos([-7,0,gasBase+C.referenceGap]),sensePin=pos([7,0,gasBase+C.sensingGap]),nodePin=pos([0,-10,0]);
  const paths=[];
  const route=(id,points,color)=>{const objects=points.slice(1).map((p,i)=>rod(points[i],p,.025,color,wires));paths.push({id,points,objects});};
  route('reference-supply',[powerEnd,[-.74,-1.12,.22],[-2.74,-1.12,.22],[-2.74,1.87,.22],[-2.74,1.87,referencePin[2]],referencePin],'red');
  route('sensing-return',[sensePin,[.75,.6,sensePin[2]],[.75,-.8,.3],[2.78,-.8,.3],[2.78,-2.38,.22],[-2.28,-2.38,.22],[-2.28,-1.61,.22]],'blue');
  route('detect',[nodePin,[nodePin[0],-.93,.2],[.86,-.93,.2],[.86,-1.44,.18]],'gold');
  route('controller-supply',[powerEnd,[-.33,-1.61,.22],[-.33,-1.89,.18],[.16,-1.89,.18]],'red');
  route('controller-return',[[1.56,-2.07,.18],[1.85,-2.07,.22],[1.85,-2.38,.22]],'blue');
  route('horn-drive',[[1.56,-1.53,.18],[2.36,-1.53,.327],[2.36,.2,.327]],'red');
  route('horn-return',[[2.18,.13,.25],[2.18,-.8,.3]],'blue');
  const flowRoot=visual(new THREE.Group());system.add(flowRoot);
  const flow=Array.from({length:12},()=>sphere(.04,[0,0,0],'gold',flowRoot));
  const heading=visual(label(system,'SMOKE TAKES CHARGE OFF THE FAST PATH',0,3.6,6.35,.28,.3));
  const status=visual(label(system,'',0,-3.45,6.25,.24,.3));
  const footer=visual(label(system,'',0,-3.82,6.25,.19,.3));

  const details=[];
  const detail=(id,name,description)=>{const p=part(id,name,description,[0,0,0],system);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;details.push(p);return p;};
  const balance=detail('balance','Where the mobile ions go','Each bar partitions a steady small-ion balance into collection, recombination and attachment. Attached charge is not destroyed.');
  label(balance,'THREE WAYS OUT OF THE MOBILE-ION POPULATION',0,2.3,5.35,.21);
  label(balance,'Same continuous source; different fates for its ions',0,1.96,5.15,.18);
  const balanceRows=[];
  for(let i=0;i<2;i++){
    const y=1.28-i*1.4;label(balance,i?'Smoke-free reference':'Open sensing half',0,y+.28,5,.21);
    const bars=['blue','clay','gold'].map(color=>box([1,.3,.12],[0,y-.08,.15],color,balance));
    const text=label(balance,'',0,y-.47,5.1,.18);balanceRows.push({bars,text,y});
  }
  label(balance,'Blue: collected · clay: recombined · gold: attached',0,-1.2,5.2,.18);
  const balanceResult=label(balance,'',0,-1.58,5.2,.2);
  label(balance,'Attachment moves charge onto slow smoke particles',0,-1.94,5.2,.18);
  label(balance,'Heavy-particle current and removal are omitted here',0,-2.25,5.2,.17);

  const circuit=detail('circuit','Two series currents, one moving voltage','The currents in both gas paths match. More voltage appears across the smoky sensing half, less across the clean reference.');
  label(circuit,'SAME CURRENT THROUGH BOTH GAS PATHS',0,2.3,5.3,.23);
  const circuitTop=label(circuit,'',0,1.95,5.1,.19);
  const gauges=[];
  for(let i=0;i<2;i++){
    const y=1.13-i*1.05;label(circuit,i?'Sensing voltage':'Reference voltage',-1.58,y+.24,1.9,.18);
    line(circuit,[[-.51,y-.06,.1],[2.11,y-.06,.1]],P.ink);
    const bar=box([1,.2,.08],[0,y+.07,.18],i?'gold':'blue',circuit),text=label(circuit,'',.8,y+.33,2.7,.18),mark=lineObject(2,P.red,circuit);
    gauges.push({y,bar,text,mark});
  }
  const circuitCurrent=label(circuit,'',0,-.65,5.1,.21),circuitSample=label(circuit,'',0,-1.04,5.1,.19),circuitResult=label(circuit,'',0,-1.43,5.1,.2);
  label(circuit,'Reference stays smoke-free, but its current also falls',0,-1.84,5.15,.18);
  label(circuit,'Comparator reads voltage; battery supplies horn power',0,-2.2,5.15,.17);

  const source=detail('source','One alpha and its ion pairs','A normal track crosses the assigned gold cover and deposits some energy in 15 mm of air before striking an electrode. Free-air range is longer.');
  label(source,'ONE ALPHA LOSES ENERGY ALONG ITS TRACK',0,2.3,5.3,.22);
  box([.54,1.12,.23],[-2.24,1.18,0],'metal',source);box([.12,1.12,.26],[-1.93,1.18,0],'gold',source);
  label(source,'Sealed foil',-1.84,1.96,1.65,.18);label(source,'15 mm gas gap',.15,1.72,2.4,.19);box([.12,.8,.25],[1.25,1.18,0],'metal',source);
  line(source,[[-1.85,1.18,.2],[1.19,1.18,.2]],P.gold);const alphaDot=visual(sphere(.065,[-1.85,1.18,.25],'gold',source));
  const alphaPairs=Array.from({length:20},(_,i)=>[sphere(.027,[-1.74+2.84*i/19,1.08,.24],'red',source),sphere(.027,[-1.74+2.84*i/19,1.28,.24],P.blue,source)]);
  const energyText=label(source,'',0,.57,5.2,.18),pairText=label(source,'',0,.23,5.2,.18);
  line(source,[[-2.13,-.12,.1],[-2.13,-1.39,.1],[2.13,-1.39,.1]],P.ink);
  const sourceCurve=lineObject(61,P.gold,source),sourceGhost=lineObject(101,0xbcc4b4,source),normalEnergy=smokeAfterGold(5.48556,C.coverMicrons),range=smokeAirRange(normalEnergy);
  const yields=Array.from({length:161},(_,i)=>smokePairsPerMillimeter(smokeAirEnergy(Math.max(0,range-i/4)))),ceiling=Math.ceil(Math.max(...yields)/1000)*1000;
  const sourcePoints=yields.map((pairs,i)=>[-2.13+4.26*(i/4)/40,-1.39+1.18*pairs/ceiling,.17]);
  fillLine(sourceCurve,sourcePoints.slice(0,61));fillLine(sourceGhost,sourcePoints.slice(60));
  label(source,`${ceiling.toLocaleString('en-US')} pairs/mm`,-1.42,-.26,1.35,.13);
  const plateX=-2.13+4.26*C.sensingGap/40;line(source,[[plateX,-1.39,.2],[plateX,-.1,.2]],P.blue);
  label(source,'Plate stops this track',plateX+.63,-.06,2.1,.16);label(source,'0',-2.13,-1.61,.4,.15);label(source,'40 mm of free air',1.2,-1.61,2.45,.16);
  label(source,'Curve: ion pairs per mm · ghost portion is free-air continuation',0,-1.92,5.2,.16);
  label(source,'Foil thickness, individual charges and alpha speed exaggerated',0,-2.24,5.2,.16);

  const chart=detail('chart','Observation record','Voltage history and recorded alarm transitions for the selected smoke input. Only elapsed data are drawn.');
  label(chart,'WATCH THE NODE REACH THE COMPARISON LEVEL',0,2.3,5.3,.215);
  const chartText=label(chart,'',0,1.95,5.1,.19);
  line(chart,[[-2.12,1.49,.1],[-2.12,-.72,.1],[2.12,-.72,.1]],P.ink);
  const chartSupply=label(chart,'',-2.42,1.5,.64,.14);label(chart,'0 V',-2.42,-.72,.64,.14);
  const curve=lineObject(122,P.blue,chart),thresholdLine=lineObject(2,P.red,chart),cursor=lineObject(2,P.ink,chart);
  const eventTemplate=lineObject(40,P.gold,chart);const eventMarks=new THREE.LineSegments(eventTemplate.geometry,eventTemplate.material);chart.remove(eventTemplate);chart.add(eventMarks);eventMarks.frustumCulled=false;
  for(let i=0;i<=4;i++)label(chart,`${i*150}`,-2.12+4.24*i/4,-.94,.64,.16);
  label(chart,'Seconds in this assigned smoke input',0,-1.25,5.1,.18);
  const chartEvent=label(chart,'',0,-1.62,5.1,.2),chartResult=label(chart,'',0,-1.97,5.1,.19);
  label(chart,'This observation is not a prediction of fire warning time',0,-2.27,5.15,.16);
  return {system,base,board,battery,batteryText,positive,negative,contact,blade,powerStart,powerEnd,comparator,guard,lamp,horn,metal,ceramic,ceramicRest,waves,hornText,
    ions,scale,gasBase,common,foil,divider,partition,halves,wires,paths,flowRoot,flow,heading,status,footer,details,balance,balanceRows,balanceResult,circuit,circuitTop,gauges,circuitCurrent,circuitSample,circuitResult,
    source,alphaDot,alphaPairs,energyText,pairText,sourceCurve,sourceGhost,chart,chartText,chartSupply,curve,thresholdLine,cursor,eventMarks,chartEvent,chartResult};
}

export function updateIonSmokeGeometry(g,s,plan){
  const phase=s.displayTime,v=s.values;
  setText(g.batteryText,`${v.battery.toFixed(1)} V`);
  const start=v3(g.powerStart),end=v3(g.powerEnd);if(!v.power)end.set(start.x+.58*Math.cos(.8),start.y+.58*Math.sin(.8),start.z);
  g.blade.position.copy(start.clone().add(end).multiplyScalar(.5));g.blade.quaternion.setFromUnitVectors(v3([0,1,0]),end.clone().sub(start).normalize());
  g.lamp.material.color.setHex(s.active?P.red:P.ink);
  const positions=g.ceramic.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){const x=g.ceramicRest[3*i],y=g.ceramicRest[3*i+1],z=g.ceramicRest[3*i+2],r2=(x*x+z*z)/(.5*.5);positions.setXYZ(i,x,y+(s.hornPulse?.035*Math.sin(phase*15)*Math.max(0,1-r2):0),z);}
  positions.needsUpdate=true;g.ceramic.geometry.computeVertexNormals();g.ceramic.geometry.computeBoundingSphere();g.waves.forEach(w=>w.visible=s.hornPulse);
  const chambers=smokeChambers();
  for(const half of g.halves){
    const budget=half.side>0?s.open:s.closed,chamber=half.side>0?chambers.sensing:chambers.reference,maxDensity=Math.sqrt(chamber.q/C.recombination);
    const count=Math.max(1,Math.min(40,Math.round(40*budget.density/maxDensity)));
    setText(half.voltage,`${budget.volts.toFixed(2)} V · ${(budget.current*1e12).toFixed(2)} pA`);
    for(const track of half.tracks){const t=(phase*.7+track.index/9)%1;track.alpha.position.lerpVectors(v3(track.start),v3(track.end),t);}
    for(const charge of half.charges){
      charge.plus.visible=charge.minus.visible=charge.index<count;
      const t=v.power?(phase*(.08+.22*budget.collectionShare)+charge.index*.618)%1:(charge.index+.5)/40;
      const upward=half.side>0?t:1-t,margin=.45,span=half.gap-2*margin;
      charge.plus.position.set(charge.x,charge.y,g.gasBase+margin+span*upward);
      charge.minus.position.set(charge.x+.35*half.side,charge.y,g.gasBase+margin+span*(1-upward));
    }
    for(const particle of half.particles){particle.object.visible=particle.index<Math.round(24*Math.min(1,s.mass*1e6/100));particle.object.scale.setScalar(.65+.6*Math.log10(v.size/.1+1));}
    for(const [i,capture]of half.captures.entries()){
      const shown=v.power&&i<Math.round(6*budget.attachmentShare),t=(phase*.5+i/6)%1,direction=capture.sign,center=g.gasBase+half.gap*.5;
      const slowly=direction*Math.max(0,t-.5)*.35,z=center+slowly,ionZ=t<.5?center-direction*4*(1-t*2):z;
      capture.ion.visible=capture.particle.visible=shown;capture.particle.position.set(capture.x,capture.y,z);capture.ion.position.set(capture.x,capture.y-.62,ionZ);
    }
  }
  const conductorRoutes=g.paths.filter(p=>['reference-supply','sensing-return'].includes(p.id));
  for(const [i,dot]of g.flow.entries()){
    dot.visible=!!v.power;const route=conductorRoutes[i%2],n=route.points.length-1,t=((phase*(.08+.3*(s.currentShare??0))+Math.floor(i/2)/6)%1)*n,index=Math.min(n-1,Math.floor(t));
    dot.position.lerpVectors(v3(route.points[index]),v3(route.points[index+1]),t-index);
  }
  setText(g.status,`${s.active?'ALARM':!v.power?'NO POWER':s.time===0?'READY':s.clearing?'CLEARING':'SAMPLING'} · ${(s.current*1e12).toFixed(2)} pA through both halves`);
  setText(g.footer,`${s.time.toFixed(0)} / 600 s · ${(s.mass*1e6).toFixed(1)} mg/m³ inside · sound ${v.sound?'on':'off'}`);
  [s.open,s.closed].forEach((budget,i)=>{
    const row=g.balanceRows[i],shares=[budget.collectionShare,budget.recombinationShare,budget.attachmentShare];let x=-2.25;
    row.bars.forEach((bar,j)=>{const width=4.5*shares[j];bar.visible=width>1e-8;bar.scale.x=Math.max(1e-8,width);bar.position.set(x+width/2,row.y-.08,.15);x+=width;});
    setText(row.text,`Collect ${(100*shares[0]).toFixed(1)}% · recombine ${(100*shares[1]).toFixed(1)}% · attach ${(100*shares[2]).toFixed(1)}%`);
  });
  setText(g.balanceResult,`Sensing current: ${(100*s.open.collectionShare).toFixed(1)}% of source ceiling`);
  setText(g.circuitTop,`Supply ${s.supply.toFixed(2)} V = reference + sensing voltage`);
  [s.closed.volts,s.open.volts].forEach((volts,i)=>{
    const gauge=g.gauges[i],share=s.supply?volts/s.supply:0,width=2.62*share;gauge.bar.visible=share>0;gauge.bar.scale.x=Math.max(1e-8,width);gauge.bar.position.x=-.51+width/2;
    setText(gauge.text,`${volts.toFixed(3)} V${i?` · threshold ${s.threshold.toFixed(3)} V`:''}`);
    const x=-.51+2.62*(s.supply?s.threshold/s.supply:.5);fillLine(gauge.mark,i&&v.power?[[x,gauge.y-.15,.22],[x,gauge.y+.21,.22]]:[]);
  });
  setText(g.circuitCurrent,`${(s.closed.current*1e12).toFixed(3)} pA reference = ${(s.current*1e12).toFixed(3)} pA sensing`);
  setText(g.circuitSample,`Last sample: ${s.sample?s.sample.time.toFixed(2)+' s':'none'} · next: ${s.nextSample===null?'none':s.nextSample.toFixed(2)+' s'}`);
  setText(g.circuitResult,!v.power?'No powered comparison or horn':s.active?'Sample over threshold → horn requested':'Sample below threshold → no smoke alarm');
  const travel=(phase*.5)%1;g.alphaDot.position.x=-1.85+3.04*travel;g.alphaPairs.forEach((pair,i)=>pair.forEach(dot=>dot.visible=(i+.5)/20<travel));
  setText(g.energyText,`${s.alpha.energy.toFixed(3)} MeV enters air · ${s.alpha.after.toFixed(3)} MeV reaches electrode`);
  setText(g.pairText,`${Math.round(s.alpha.pairs).toLocaleString('en-US')} pairs along this path · ${Math.round(s.alpha.freePairs).toLocaleString('en-US')} if stopped in air`);
  const xy=(time,node)=>[-2.12+4.24*time/R.duration,-.72+2.21*node/v.battery,.2];
  const elapsed=plan.chart.filter(point=>point.time<s.time);fillLine(g.curve,[...elapsed.map(point=>xy(point.time,point.node)),xy(s.time,s.node)]);
  fillLine(g.thresholdLine,v.power?[xy(0,plan.threshold),xy(R.duration,plan.threshold)]:[]);fillLine(g.cursor,[[-2.12+4.24*s.time/R.duration,-.72,.15],[-2.12+4.24*s.time/R.duration,1.49,.15]]);
  fillLine(g.eventMarks,s.events.flatMap(event=>{const x=-2.12+4.24*event.time/R.duration;return [[x,-.72,.24],[x,1.49,.24]];}));
  setText(g.chartText,`${s.time.toFixed(1)} s · blue: shared-node voltage · red: trigger`);
  setText(g.chartSupply,`${v.battery.toFixed(1)} V`);
  setText(g.chartEvent,s.onset===null?'No smoke alarm recorded':`First smoke alarm at ${s.onset.toFixed(2)} s`);
  setText(g.chartResult,s.active?'Horn requested now':s.events.some(e=>!e.active)?'Smoke alarm released; history remains visible':`${s.chirps.length} low-battery chirps recorded`);
}
