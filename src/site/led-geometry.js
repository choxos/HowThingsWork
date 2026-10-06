import * as THREE from 'three';
import {textLabel,lineObject,fillLine,solidArrow} from './scene-kit.js';
import {formatLedQuantity as fmt,LED_EXPERIMENT as E} from './led-physics.js';

const C={ink:0x374736,wire:0xb78b46,metal:0xb4c5b0,red:0xc14f39,blue:0x2b5d9c,p:0xeccdc6,n:0xc6d8ea,gold:0xe3b45e};
const label=(parent,text,x,y,width=5,height=.2,z=.3)=>textLabel(parent,text,{position:[x,y,z],width,height,color:'#374736'});
const polyline=(parent,points,color=C.ink)=>{const line=lineObject(points.length,color,parent);fillLine(line,points);return line;};
const excluded=object=>{object.userData.explosionExcluded=true;object.userData.selectionExcluded=true;return object;};
const ownMaterial=(object,opacity=1)=>{object.material=object.material.clone();object.material.transparent=opacity<1;object.material.opacity=opacity;object.material.depthWrite=opacity===1;return object;};

export function createLedGeometry(kit){
  const {part,box,rod,sphere,disk,cylinder,ring}=kit;
  const circuit=part('circuit','LED light experiment','A complete electrical path powers the LED. Light leaves its dome and reaches a separate target.');
  const board=part('board','Bench board','The board supports the experiment. Distances on it are compressed.',[0,0,-.28],circuit);box([6.6,3.8,.13],[0,0,0],'cream',board);
  const source=part('source','Adjustable source','The source has an assigned internal resistance of 0.45 ohm.',[-2.5,-.05,.05],circuit);box([1.12,1.72,.5],[0,0,0],'blue',source);
  label(source,'SUPPLY',0,.56,.95,.17,.27);const sourceText=label(source,'',0,.26,.94,.23,.27);disk(.18,.1,[0,-.24,.3],'ink',source);
  label(source,'+ ',.48,.68,.24,.2,.28);label(source,'−',.48,-.66,.24,.2,.28);
  const upper=part('positive-terminal','Positive terminal','Conventional current leaves here when the circuit conducts.',[-1.92,.6,.3],circuit);sphere(.06,[0,0,0],'red',upper);
  const lower=part('return-terminal','Return terminal','The return conductor completes the circuit.',[-1.92,-.7,.3],circuit);sphere(.06,[0,0,0],'ink',lower);
  const switchBase=part('switch','Circuit switch','This manual switch opens or closes the whole circuit.',[-1.95,1.25,.14],circuit);box([.75,.3,.15],[0,0,0],'wood',switchBase);
  const switchEnds=[[-.28,0,.16],[.28,0,.16]].map(p=>sphere(.055,p,'metal',switchBase));
  const lever=part('switch-blade','Switch blade','The blade touches the second contact only when the manual switch is closed.',[-2.23,1.25,.3],circuit);rod([0,0,0],[.56,0,0],.028,'gold',lever);sphere(.045,[.56,0,0],'gold',lever);
  const resistor=part('resistor','Current-limiting resistor','It takes up the remaining source voltage and limits LED current.',[-1.05,1.25,.3],circuit);
  const resistorBody=cylinder(.13,.48,[0,0,0],'cream',resistor);resistorBody.rotation.z=Math.PI/2;
  rod([-.38,0,0],[-.24,0,0],.025,'metal',resistor);rod([.24,0,0],[.38,0,0],.025,'metal',resistor);
  const resistorBands=[-.18,-.105,-.03,.045,.17].map(x=>{const stripe=ownMaterial(cylinder(.133,.027,[x,0,0],'ink',resistor));stripe.rotation.z=Math.PI/2;return stripe;});
  const resistorText=label(resistor,'',0,.31,1.1,.2,.05);

  const led=part('led','Light-emitting diode','A semiconductor die sits in a lead-frame cup under a domed resin package.',[-.15,.3,.3],circuit);led.rotation.z=-Math.PI/2;
  const lens=part('lens','Domed package','The resin package protects the die and helps light escape. The semiconductor sets the emitted wavelength.',[0,0,0],led);
  const barrel=ownMaterial(cylinder(.34,.66,[0,.39,0],'blue',lens),.27),flange=ownMaterial(cylinder(.39,.08,[0,.04,0],'blue',lens),.38);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.34,32,16,0,Math.PI*2,0,Math.PI/2),barrel.material);dome.position.set(0,.72,0);lens.add(dome);kit.covers.push(lens);
  const anode=part('anode','Anode lead','The anode lead connects through a fine bond wire to the top contact on the die.',[0,0,0],led);const anodeRod=rod([-.2,-.85,0],[-.2,.32,0],.028,'metal',anode);
  const cathode=part('cathode','Cathode lead and cup','The other lead supports the die in a reflecting cup and returns current to the source.',[0,0,0],led);const cathodeRod=rod([.2,-.85,0],[.2,.24,0],.035,'metal',cathode);
  const cup=kit.box([.32,.08,.29],[.1,.27,0],'metal',cathode);
  for(const [size,pos] of [[[.035,.12,.29],[-.0775,.32,0]],[[.035,.12,.29],[.2775,.32,0]],[[.32,.12,.035],[.1,.32,-.1625]],[[.32,.12,.035],[.1,.32,.1625]]])box(size,pos,'metal',cathode);
  const die=part('die','Semiconductor die','Carriers recombine in the active semiconductor region. The layers are enlarged and schematic.',[.1,.35,0],led);box([.17,.06,.16],[0,-.03,0],C.n,die);const dieTop=ownMaterial(box([.17,.04,.16],[0,.02,0],C.p,die));
  const bond=part('bond-wire','Bond wire','A fine wire joins the anode lead to the die top contact.',[0,0,0],led);const bondPoints=[[-.2,.32,0],[-.19,.5,0],[-.02,.54,0],[.1,.39,0]],bondWire=kit.tube(bondPoints,.009,'gold',bond);
  const sockets=part('sockets','LED sockets','Both leads meet the circuit here.',[0,0,0],circuit);const socketEnds=[[-1,.5,.3],[-1,.1,.3]].map(p=>sphere(.055,p,'metal',sockets));
  const ledText=excluded(label(circuit,'',.25,-.35,1.9,.2,.55));

  const driver=part('driver','Pulse switch','An ideal electronic switch either passes steady current or pulses it at 38 kHz with one-third duty.',[-.7,-.9,.15],circuit);box([.85,.48,.3],[0,0,0],'ink',driver);
  const driverLamp=ownMaterial(sphere(.065,[-.24,0,.18],'gold',driver));const driverText=textLabel(driver,'',{position:[.1,0,.31],width:.53,height:.12,color:'#f6f1df'});
  const meter=part('meter','Current meter','This meter shows cycle-average current, so it stays readable while the LED pulses.',[.47,-1.2,.15],circuit);box([1.27,.68,.3],[0,0,0],'leaf',meter);box([1.1,.5,.02],[0,0,.16],'cream',meter);
  const meterText=label(meter,'',0,-.1,1.06,.18,.19);label(meter,'MEAN CURRENT',0,.16,1.05,.12,.2);
  const meterEnds=[[-.635,0,0],[.635,0,0]].map(p=>sphere(.05,p,'metal',meter));
  const wiring=part('wiring','Outgoing and return wires','Current passes through the source, switch, resistor, LED, pulse switch and meter in one loop.',[0,0,0],circuit);
  const paths=[
    [[-1.92,.6,.3],[-2.35,.6,.3],[-2.35,1.25,.3],[-2.23,1.25,.3]],
    [[-1.67,1.25,.3],[-1.43,1.25,.3]],
    [[-.67,1.25,.3],[-.45,1.25,.3],[-.45,.82,.3],[-1,.82,.3],[-1,.5,.3]],
    [[-1,.1,.3],[-1,-.45,.3],[-1.125,-.45,.3],[-1.125,-.9,.15]],
    [[-.275,-.9,.15],[-.165,-.9,.15],[-.165,-1.2,.15]],
    [[1.105,-1.2,.15],[1.3,-1.2,.15],[1.3,-1.65,.3],[-1.6,-1.65,.3],[-1.6,-.7,.3],[-1.92,-.7,.3]],
  ];
  const wires=[];for(const path of paths)for(let i=1;i<path.length;i++)wires.push({a:path[i-1],b:path[i],object:rod(path[i-1],path[i],.023,C.wire,wiring)});
  const driverEnds=[[-.425,0,0],[.425,0,0]].map(p=>sphere(.05,p,'metal',driver));
  const flowRoot=excluded(new THREE.Group());circuit.add(flowRoot);
  const flowPath=[...paths[0],...paths[1],...paths[2],[.17,.5,.3],[.35,.49,.3],[.39,.32,.3],[.24,.2,.3],[.14,.2,.3],[.12,.2,.3],[.09,.1,.3],...paths[3],...paths[4],...paths[5],[-1.92,.6,.3]].map(p=>new THREE.Vector3(...p));
  const lengths=flowPath.slice(1).map((p,i)=>p.distanceTo(flowPath[i])),length=lengths.reduce((a,b)=>a+b,0),flow=Array.from({length:15},()=>sphere(.033,[0,0,0],'gold',flowRoot));

  const rail=part('rail','Target rail','Moving the target changes its physical distance from the emitter. The drawing compresses this distance.',[0,0,0],circuit);rod([1.35,-.9,.15],[2.95,-.9,.15],.035,'metal',rail);
  const target=part('target','On-axis light target','Read irradiance for infrared or illuminance for visible light. Moving twice as far away gives one quarter as much at the target.',[2.15,.3,.3],circuit);
  box([.12,1.15,1.05],[0,0,0],'leaf',target);box([.1,.63,.1],[0,-.88,-.15],'metal',target);box([.4,.1,.45],[0,-1.2,-.15],'ink',target);
  const spot=ownMaterial(disk(.37,.01,[-.067,0,0],'gold',target),.8);spot.rotation.set(0,0,Math.PI/2);
  const targetText=label(target,'',-.05,-1.53,1.6,.2,.55),targetUnit=label(target,'',-.05,-1.8,1.6,.15,.55),distanceText=label(target,'',-.04,.85,1.1,.19,.55);
  const beamRoot=excluded(new THREE.Group());circuit.add(beamRoot);
  const beamMaterial=new THREE.MeshBasicMaterial({color:C.gold,transparent:true,opacity:.09,depthWrite:false,side:THREE.DoubleSide});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.48,.1,1,32,1,true),beamMaterial);beam.rotation.z=-Math.PI/2;beamRoot.add(beam);
  const photons=Array.from({length:8},()=>ownMaterial(sphere(.025,[0,0,0],'gold',beamRoot)));
  const exposureFrame=excluded(new THREE.Group());circuit.add(exposureFrame);exposureFrame.position.set(1.5,1.48,.35);
  box([2.38,.13,.055],[0,0,0],'ink',exposureFrame);const exposureBar=ownMaterial(box([1,.07,.03],[-1.16,0,.04],'gold',exposureFrame)),exposureText=label(exposureFrame,'',0,.26,2.7,.18,.05);
  const heading=excluded(label(circuit,'',0,2.06,6.4,.24,.4)),status=excluded(label(circuit,'',0,-2.14,6.4,.22,.4));

  const junction=part('junction','Carrier recombination','An enlarged schematic of carrier injection and radiative or nonradiative recombination.',[0,0,0],circuit);junction.userData.inspectionOnly='junction';junction.userData.explosionExcluded=true;
  label(junction,'FROM ELECTRICAL CURRENT TO LIGHT',0,2.18,5,.25);const junctionText=label(junction,'',0,1.82,5,.2);
  box([2.05,1.1,.16],[-1.025,.5,0],C.p,junction);box([2.05,1.1,.16],[1.025,.5,0],C.n,junction);box([.28,1.1,.03],[0,.5,.1],'cream',junction);
  label(junction,'p side · holes',-1.12,1.28,2.15,.2);label(junction,'n side · electrons',1.12,1.28,2.15,.2);
  const majority=[];for(const side of [-1,1])for(let i=0;i<9;i++){const x=side*(.55+(i%3)*.53),y=.16+Math.floor(i/3)*.3,object=side<0?ring(.044,.009,[x,y,.2],C.red,junction):sphere(.037,[x,y,.2],C.blue,junction);majority.push({object,x,y});}
  const pairs=Array.from({length:3},(_,i)=>({electron:sphere(.055,[0,0,.24],C.blue,junction),hole:ring(.062,.012,[0,0,.24],C.red,junction),photon:ownMaterial(sphere(.045,[0,0,.24],'gold',junction)),vibration:ring(.13,.012,[0,0,.23],'gold',junction),index:i}));
  const recombinationText=label(junction,'',0,-.36,5,.2);label(junction,'Electrons and holes recombine in the active region',0,-.72,5,.19);
  label(junction,'Some energy leaves as photons; some heats the lattice',0,-1.06,5,.19);label(junction,'Some generated photons are trapped or reabsorbed',0,-1.4,5,.19);
  label(junction,'Dots, rings, paths and rates are schematic',0,-1.76,5,.18);const junctionFooter=label(junction,'',0,-2.1,5,.19);

  const power=part('power','Photon energy and conversion','Compare electrical input, radiant output and photon energy. Visible candelas do not determine total radiant watts.',[0,0,0],circuit);power.userData.inspectionOnly='power';power.userData.explosionExcluded=true;
  label(power,'ENERGY PER PHOTON',0,2.18,5,.26);const energyText=label(power,'',0,1.82,5,.22);
  const upperLevel=polyline(power,[[-2,1.2,.1],[-.3,1.2,.1]],C.blue);polyline(power,[[-2,.1,.1],[-.3,.1,.1]],C.red);
  const energyArrow=solidArrow(kit,'#b47e26',power,.035);energyArrow.position.set(-1.13,1.2,.2);energyArrow.userData.setDirection(new THREE.Vector3(0,-1,0));energyArrow.userData.setLength(1.1);
  label(power,'Higher energy',-1.13,1.45,1.85,.18);label(power,'Lower energy',-1.13,-.15,1.85,.18);label(power,'Transition sketch',-1.13,-.45,1.85,.17);
  const energyValue=label(power,'',1.2,.85,2.1,.33),waveValue=label(power,'',1.2,.44,2.1,.21);label(power,'E = hc / λ',1.2,.06,2.1,.22);
  const conversionText=label(power,'',0,-.82,5,.2),powerText=label(power,'',0,-1.2,5,.2),efficiencyText=label(power,'',0,-1.58,5,.2),powerFooter=label(power,'',0,-1.98,5,.18);

  const pulses=part('pulses','Pulse timing and accumulated light','Compare on-state current with cycle average and integrate the light reaching the target.',[0,0,0],circuit);pulses.userData.inspectionOnly='pulses';pulses.userData.explosionExcluded=true;
  label(pulses,'FAST PULSES, SLOW VIEW',0,2.18,5,.26);const pulseText=label(pulses,'',0,1.79,5,.2);
  polyline(pulses,[[-2.1,1.24,.1],[-2.1,.2,.1],[2.1,.2,.1]],C.ink);label(pulses,'ON',-2.36,1.14,.42,.15);label(pulses,'OFF',-2.36,.2,.42,.15);
  const trace=lineObject(42,C.red,pulses),cursor=lineObject(2,C.ink,pulses);label(pulses,'Four cycles · 105.26 μs real · 2 s on screen',0,-.13,5,.18);
  const instantaneousText=label(pulses,'',0,-.55,5,.21),meanText=label(pulses,'',0,-.92,5,.21),timeText=label(pulses,'',0,-1.28,5,.2),integralText=label(pulses,'',0,-1.65,5,.21);
  label(pulses,'Light and current share the ideal switch timing',0,-2.05,5,.18);
  return {circuit,board,source,sourceText,upper,lower,switchBase,switchEnds,lever,resistor,resistorBands,resistorText,led,lens,barrel,flange,dome,anode,anodeRod,cathode,cathodeRod,cup,die,dieTop,bond,bondPoints,bondWire,sockets,socketEnds,ledText,driver,driverLamp,driverText,driverEnds,meter,meterText,meterEnds,wiring,wires,paths,flowRoot,flowPath,lengths,length,flow,rail,target,spot,targetText,targetUnit,distanceText,beamRoot,beam,photons,exposureFrame,exposureBar,exposureText,heading,status,junction,junctionText,majority,pairs,recombinationText,junctionFooter,power,upperLevel,energyArrow,energyText,energyValue,waveValue,conversionText,powerText,efficiencyText,powerFooter,pulses,pulseText,trace,cursor,instantaneousText,meanText,timeText,integralText};
}

export function updateLedGeometry(g,s){
  const v=s.values,color=[0xb47fc7,0xe14a31,0xf2c128][v.emitter],active=s.instantaneousCurrent>0;
  const brightness=active?Math.min(1,Math.log1p(s.instantaneousTarget/(s.infrared?.001:.0002))/Math.log(101)):0;
  g.sourceText.userData.setText(`${v.voltage.toFixed(1)} V`);g.resistorText.userData.setText(`${v.resistance} Ω`);g.lever.rotation.z=v.closed?0:.7;
  g.driverLamp.material.color.setHex(active?C.gold:C.ink);g.driverText.userData.setText(v.drive?'38 kHz':'STEADY');g.meterText.userData.setText(fmt(s.meanCurrent,'A'));
  const digits=String(v.resistance<100?v.resistance*10:v.resistance).split('').map(Number),bandColors=[0x252821,0x805b3b,0xc14f39,0xe17c32,0xe7c44b,0x54884e,0x426caf,0x8e62a3,0x858b83,0xf1f0df];
  [...digits.map(d=>bandColors[d]),v.resistance<100?C.gold:bandColors[0],C.gold].forEach((tone,i)=>g.resistorBands[i].material.color.setHex(tone));
  for(const object of [g.barrel,g.flange])object.material.color.setHex(s.infrared?0x8494a6:color);
  g.dieTop.material.color.setHex(color);
  g.ledText.userData.setText(`${s.device} · ${s.wavelength} nm`);
  g.target.position.x=1.55+.6*v.distance;g.spot.material.color.setHex(color);g.spot.material.opacity=brightness*.9;g.spot.visible=active;
  g.targetText.userData.setText(fmt(s.meanTarget,s.infrared?'W/m²':'lx'));g.targetUnit.userData.setText(s.infrared?'MEAN IRRADIANCE':'MEAN ILLUMINANCE');g.distanceText.userData.setText(`${v.distance.toFixed(1)} m`);
  const start=.91,end=g.target.position.x-.075,beamLength=end-start;
  g.beam.position.set((start+end)/2,.3,.3);g.beam.scale.set(1,beamLength,1);g.beam.material.color.setHex(color);g.beam.material.opacity=.02+.1*brightness;g.beamRoot.visible=active;
  for(let i=0;i<g.photons.length;i++){const u=(i/g.photons.length+s.time*.8)%1;g.photons[i].position.set(start+u*beamLength,.3+.12*Math.sin(i*2),.3+.12*Math.cos(i*2));g.photons[i].material.color.setHex(color);}
  const fraction=Math.min(1,s.exposure/(s.infrared?.0001:.00002)),barWidth=Math.max(.001,2.32*fraction);g.exposureBar.scale.x=barWidth;g.exposureBar.position.x=-1.16+barWidth/2;
  g.exposureBar.material.color.setHex(color);g.exposureText.userData.setText(`Exposure ${fmt(s.exposure,s.infrared?'J/m²':'lx·s')}`);
  g.heading.userData.setText(s.infrared?'INFRARED LED · purple light is a false-color cue':'VISIBLE LED · light comes from the semiconductor');
  g.status.userData.setText(`${s.complete?'Complete':v.drive?(active?'Pulse ON':'Pulse OFF'):'Steady drive'} · ${s.aboveDcRating?'peak exceeds DC current rating':'within DC current reference'} · ${(s.realTime*1e6).toFixed(1)} μs real`);
  const carrierRate=.08+Math.log1p(s.current/1e-6)/Math.log1p(.1/1e-6);
  for(let i=0;i<g.flow.length;i++){
    let distance=((i/g.flow.length+s.onTime*E.slowdown*carrierRate/g.length)%1)*g.length,segment=0;
    while(segment<g.lengths.length-1&&distance>g.lengths[segment]){distance-=g.lengths[segment];segment++;}
    const object=g.flow[i];object.visible=active;object.position.copy(g.flowPath[segment]).lerp(g.flowPath[segment+1],distance/g.lengths[segment]);object.position.z+=.04;
  }
  g.junctionText.userData.setText(`${s.device} · forward current ${fmt(s.instantaneousCurrent,'A')}`);
  for(let i=0;i<g.majority.length;i++){const p=g.majority[i];p.object.position.set(p.x+.012*Math.sin(s.time*4+i),p.y+.012*Math.cos(s.time*3+i),.2);}
  for(const pair of g.pairs){
    const phase=(s.onTime*E.slowdown*carrierRate+pair.index/3)%1,approach=phase<.6,u=Math.min(1,phase/.6),y=.16+pair.index*.32;
    pair.electron.visible=pair.hole.visible=active&&approach;pair.electron.position.set(1.9*(1-u),y,.24);pair.hole.position.set(-1.9*(1-u),y,.24);
    pair.photon.visible=active&&!approach&&pair.index!==1;pair.photon.position.set((phase-.6)*4.8,y+(phase-.6)*1.2,.25);pair.photon.material.color.setHex(color);
    pair.vibration.visible=active&&!approach&&pair.index===1;pair.vibration.position.set(0,y,.23);pair.vibration.scale.setScalar(1+(phase-.6)*3);
  }
  g.recombinationText.userData.setText(active?'Carrier injection supplies recombination':'No driven injection during this interval');
  g.junctionFooter.userData.setText(s.infrared?'Purple photon markers represent invisible infrared':'Light color changes with semiconductor transition energy');
  g.energyText.userData.setText(`${s.device} · representative photon at the peak wavelength`);g.energyValue.userData.setText(`${s.photonEv.toFixed(3)} eV`);g.waveValue.userData.setText(`${s.wavelength} nm`);
  g.conversionText.userData.setText(`On-state electrical input: ${fmt(s.ledPower,'W')}`);
  g.powerText.userData.setText(s.infrared?`Radiant output ${fmt(s.radiantPower,'W')} · other loss ${fmt(s.nonRadiantPower,'W')}`:`On-axis intensity ${fmt(s.intensity,'cd')} · radiant watts not inferred`);
  g.efficiencyText.userData.setText(s.infrared?`Assigned conversion 29.6% · ${s.externalQuantumEfficiency===null?'0':s.externalQuantumEfficiency.toFixed(3)} photons per electron`:'Candelas include human visual sensitivity');
  g.powerFooter.userData.setText('Photon energy divided by q is not a rigid voltage threshold');
  g.pulseText.userData.setText(v.drive?'38,000 cycles/s · duty 1/3 · view slowed 19,000×':'Steady current · same measurement duration');
  const points=[];for(let cycle=0;cycle<4;cycle++){const x=-2.1+cycle*1.05,h=v.closed&&s.current>0?1.14:.2;points.push([x,h,.17],[x+1.05/3,h,.17],[x+1.05/3,v.drive?.2:h,.17],[x+1.05,v.drive?.2:h,.17]);}
  while(points.length<42)points.push(points.at(-1));fillLine(g.trace,points);
  const x=-2.1+4.2*((s.time%2)/2);fillLine(g.cursor,[[x,.12,.22],[x,1.27,.22]]);
  g.instantaneousText.userData.setText(`Current now ${fmt(s.instantaneousCurrent,'A')} · on-state ${fmt(s.current,'A')}`);g.meanText.userData.setText(`Cycle mean ${fmt(s.meanCurrent,'A')} · ${Math.round(s.duty*1000)/10}% duty`);
  g.timeText.userData.setText(`${(s.realTime*1e6).toFixed(2)} μs elapsed · ${(s.onTime*1e6).toFixed(2)} μs on`);g.integralText.userData.setText(`Target exposure ${fmt(s.exposure,s.infrared?'J/m²':'lx·s')}`);
}
