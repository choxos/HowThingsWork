import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText} from './scene-kit.js';
import {sampleAirCleaner, airCleanerPlan, fiberCapture, plateCatch, SIZES, FLOWS, METHOD_OPTIONS, FILTER, PRECIPITATOR as P, ROOM, AIR_CLEANER_DEFAULTS, AIR_CLEANER_DOMAINS} from './air-cleaner-physics.js';
import {MM, point, PANEL, PLEAT_DEPTH, CELL, PARTICLES, plateY, pleatGeometry, reducerGeometry, annulusGeometry, bladeGeometry, particleSample} from './air-cleaner-geometry.js';
export const roomPoint = (seconds,fraction) => point([-140+seconds/3600*280,-95+fraction*190,2]);
export const sizePoint = (size,fraction) => point([-140+Math.log(size/1e-8)/Math.log(300)*280,-95+fraction*190,2]);
export function createAirCleanerModel() {
  const kit=houseModel('Air cleaner'),{root,part,control,finish}=kit;
  const box=(size,pos,color,parent)=>kit.box(point(size),point(pos),color,parent);
  const rod=(a,b,radius,color,parent)=>kit.rod(point(a),point(b),radius*MM,color,parent);
  const mesh=(geometry,pos,color,parent,opacity=1)=>{const object=box([1,1,1],pos,color,parent);object.geometry.dispose();object.geometry=geometry;object.material=object.material.clone();Object.assign(object.material,{side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity===1});return object;};
  const cylinder=(radius,length,pos,color,parent)=>{const o=kit.cylinder(radius*MM,length*MM,point(pos),color,parent);o.rotation.z=Math.PI/2;return o;};
  const ring=(inside,outside,length,pos,color,parent,opacity=1)=>mesh(annulusGeometry(inside,outside,length),pos,color,parent,opacity);
  const frame=(x,depth,parent,color='cream')=>{const pieces=[
    box([depth,8,216],[x,76,0],color,parent),box([depth,8,216],[x,384,0],color,parent),
    box([depth,300,8],[x,230,-104],color,parent),box([depth,300,8],[x,230,104],color,parent),
  ];pieces[3].material=pieces[3].material.clone();Object.assign(pieces[3].material,{transparent:true,opacity:0,depthWrite:false});return pieces;};
  const system=part('system','Air cleaner','An original cabinet cutaway. Room air travels left to right through a coarse screen, a selected particle stage, carbon and an axial fan. The front wall is removed for inspection.',[0,0,0]);
  const casing=part('body','Cabinet and sealed air channel','The bottom, rear and top enclose a 300 by 200 mm air channel. Cartridge frames meet its edges. The front wall and cartridge front seals are removed for inspection; these cutaways are not operating leaks.',[0,0,0],system);
  box([468,8,224],[4,68,0],'cream',casing);box([468,8,224],[4,392,0],'cream',casing);box([468,316,8],[4,230,-108],'cream',casing);
  const top=box([468,4,216],[4,382,0],'cream',casing);top.material=top.material.clone();Object.assign(top.material,{transparent:true,opacity:.22,depthWrite:false});
  box([468,4,216],[4,78,0],'cream',casing);
  for(const x of [-190,200])box([35,16,180],[x,56,0],'ink',casing);
  const prefilter=part('prefilter','Coarse inlet screen','Open mesh catches hair and lint. The selected 0.01 to 3 micrometer particles are much smaller than these openings; this lesson assigns the screen no fine-particle capture.',[0,0,0],system);
  const preFrame=frame(-200,8,prefilter),preMesh=[];
  for(let i=0;i<=12;i++)preMesh.push(rod([-200,80+25*i,-100],[-200,80+25*i,100],.45,'metal',prefilter));
  for(let i=0;i<=8;i++)preMesh.push(rod([-200,80,-100+25*i],[-200,380,-100+25*i],.45,'metal',prefilter));
  const stage=part('stage','Particle-removal stage','Compare an electrostatic cell with a pleated fibrous cartridge. Charging-only mode removes both collectors and places a needle at the outlet. These are controlled comparisons, not three certified products.',[0,0,0],system);
  const rails=[box([150,5,10],[-85,81,-104],'metal',stage),box([150,5,10],[-85,379,-104],'metal',stage),box([150,5,10],[-85,81,104],'metal',stage),box([150,5,10],[-85,379,104],'metal',stage)];
  const filter=part('filter','Pleated fibrous cartridge','Thirty pleats provide 1.2 square meters of mat area. Fibers catch particles by diffusion, interception and impaction. The assigned uncharged mat is not labeled or certified as HEPA.',[0,0,0],stage);
  frame(PANEL.front+PLEAT_DEPTH/2,PLEAT_DEPTH,filter);
  const pleats=mesh(pleatGeometry(),[0,0,0],'leaf',filter,.66);
  const charger=part('charger','Charging electrodes','Positive wires charge particles before the collector. In charging-only mode a sharp negative outlet needle replaces them. Wires and dust are enlarged; corona and ion motion are not resolved.',[0,0,0],stage);
  const wires=new THREE.Group();charger.add(wires);frame(CELL.charger,25,wires);
  const chargingWires=[],returnGrid=[];
  for(let i=0;i<12;i++)chargingWires.push(rod([CELL.charger,92.5+25*i,-100],[CELL.charger,92.5+25*i,100],.35,'gold',wires));
  for(let i=0;i<=12;i++)returnGrid.push(box([25,.8,200],[CELL.charger,80+25*i,0],'metal',wires));
  rod([CELL.charger,92.5,-112],[CELL.charger,367.5,-112],1.2,'gold',wires);
  rod([CELL.charger,80,112],[CELL.charger,380,112],1.2,'metal',wires);
  returnGrid.forEach((_,i)=>rod([CELL.charger,80+25*i,100],[CELL.charger,80+25*i,112],.5,'metal',wires));
  chargingWires.forEach((_,i)=>rod([CELL.charger,92.5+25*i,-100],[CELL.charger,92.5+25*i,-112],.5,'gold',wires));
  const needle=new THREE.Group();charger.add(needle);
  rod([225,329,0],[260,329,0],3,'cream',needle);rod([260,329,0],[275,300,0],1.1,'metal',needle);
  const tip=mesh(new THREE.ConeGeometry(1.1*MM,2*Math.sqrt(41)*MM,24),[279,295,0],'metal',needle);tip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(4,-5,0).normalize());
  const collector=part('collector','Electrostatic collecting cell','Forty-five plates make 44 clear channels, each 6 mm high and 200 mm wide. Their clear flow area is 0.0528 square meters. Positive particles drift toward the grounded surfaces.',[0,0,0],stage);
  frame(-62,100,collector);
  const positive=part('positive-plates','Positive deflecting plates','Alternate plates are held 3 kV above ground. They repel positive particles into neighboring grounded collecting surfaces. Turning high voltage off removes the modeled electric force.',[0,0,0],collector);
  const grounded=part('grounded-plates','Grounded collecting plates','These plates are at lower potential than the positive plates. Captured particles remain on their channel-facing surfaces throughout the trial.',[0,0,0],collector);
  const plates=Array.from({length:P.plates},(_,i)=>mesh(new THREE.BoxGeometry(...point([100,.8,200])),[-62,plateY(i),0],i%2?'gold':'metal',i%2?positive:grounded));
  for(const [parity,parent,z]of[[1,positive,-114],[0,grounded,114]]){
    rod([-62,80,z],[-62,380,z],1.2,parity?'gold':'metal',parent);
    for(let i=parity;i<P.plates;i+=2)rod([-62,plateY(i),Math.sign(z)*100],[-62,plateY(i),z],.5,parity?'gold':'metal',parent);
    for(const y of[75,385])box([10,8,12],[-62,y,z],'cream',parent);
  }
  const carbon=part('carbon','Porous carbon cartridge','Air can pass through the supported carbon granules. Carbon can adsorb some gases; gas capacity and fine-particle capture by this cartridge are not calculated in this particle-only experiment.',[0,0,0],system);
  const carbonFrame=frame(30,20,carbon),carbonMesh=[];
  for(let i=0;i<=12;i++)carbonMesh.push(rod([30,80+25*i,-100],[30,80+25*i,100],1.2,'ink',carbon));
  for(let i=0;i<=8;i++)carbonMesh.push(rod([30,80,-100+25*i],[30,380,-100+25*i],1.2,'ink',carbon));
  for(let i=0;i<12;i++)for(let j=0;j<8;j++)kit.sphere(3*MM,point([30,83+25*i,-97+25*j]),'ink',carbon);
  const fan=part('fan','Axial fan and outlet','The fan draws air through the cartridge and discharges it along its shaft. Regulated airflow is prescribed for comparison; this lesson does not solve a fan curve, filter pressure loss or motor power.',[0,0,0],system);
  const duct=part('duct','Open transition duct','The rectangular channel joins a round 200 mm fan bore through an open reducer. The translucent wall reveals the connected passage.',[0,0,0],fan);
  const reducer=mesh(reducerGeometry(),[0,0,0],'blue',duct,.18);
  const shroud=ring(100,104,65,[202.5,230,0],'cream',duct,.45);
  const motor=part('motor','Fan motor and support','A central motor housing is held by three struts behind the impeller. Its shaft supports the rotating hub. The motor is schematic; winding currents and torque are not calculated.',[0,0,0],fan);
  const motorBody=cylinder(24,26,[216,230,0],'ink',motor),shaft=cylinder(5,22,[192,230,0],'metal',motor);
  for(let i=0;i<3;i++){const a=.1+i*2*Math.PI/3;rod([220,230+24*Math.cos(a),24*Math.sin(a)],[220,230+102*Math.cos(a),102*Math.sin(a)],2,'ink',motor);}
  const impeller=part('impeller','Pitched fan blades','Six pitched blades rotate around the supported hub. Rotation is shown slowly so the blades can be followed; it does not display a specified motor RPM.',point([188,230,0]),fan);
  const hub=cylinder(27,20,[0,0,0],'metal',impeller),blades=Array.from({length:6},(_,i)=>mesh(bladeGeometry(i*Math.PI/3),[0,0,0],'leaf',impeller));
  const outlet=part('outlet','Open outlet guard','Three open rings and radial supports keep the outlet visibly connected to the fan passage. Returning particles leave the cabinet here.',[0,0,0],fan);
  const outletRings=[35,68,98].map(radius=>{const o=kit.ring(radius*MM,.7*MM,point([236,230,0]),'metal',outlet);o.rotation.y=Math.PI/2;return o;});
  for(let i=0;i<3;i++){const a=.1+i*2*Math.PI/3;rod([236,230+24*Math.cos(a),24*Math.sin(a)],[236,230+101*Math.cos(a),101*Math.sin(a)],.7,'metal',outlet);}
  const power=part('power','High-voltage supply and connections','The insulated supply provides a positive charging output, a 3 kV plate output and a common ground. The charging-only comparison instead uses a negative needle output. Internal conversion circuitry is not shown.',[0,0,0],system);
  box([160,30,100],[-90,42,-45],'leaf',power);for(const x of[-150,-90,-30])cylinder(3,8,[x,60,-45],'metal',power);
  const positiveLead=new THREE.Group(),groundLead=new THREE.Group(),needleLead=new THREE.Group();power.add(positiveLead,groundLead,needleLead);
  const wirePath=(points,color,parent)=>points.slice(1).forEach((p,i)=>rod(points[i],p,1.1,color,parent));
  wirePath([[-150,55,-45],[-150,55,-114],[CELL.charger,55,-114],[CELL.charger,92.5,-114]],'gold',positiveLead);
  wirePath([[-90,55,-45],[-90,55,-114],[-62,55,-114],[-62,80,-114]],'gold',positiveLead);
  wirePath([[-30,55,-45],[-30,55,114],[-62,55,114],[-62,80,114]],'metal',groundLead);
  wirePath([[-30,55,-45],[-170,55,-45],[-170,55,112],[CELL.charger,55,112],[CELL.charger,80,112],[CELL.charger,80,100]],'metal',groundLead);
  wirePath([[-150,55,-45],[245,55,-45],[245,329,-45],[260,329,-45],[260,329,0]],'blue',needleLead);
  const indicator=kit.sphere(4*MM,point([-170,43,8]),'gold',power);indicator.material=indicator.material.clone();
  const particles=part('particles','Single-pass particle cohort','Thirty-two enlarged markers trace one passage. Gold indicates positive charge; blue indicates negative charge. Captured markers stay on the stage; returned markers leave once. Counts illustrate individual paths and do not estimate exact CADR.',[0,0,0],system);particles.userData.explosionExcluded=true;
  const dots=Array.from({length:PARTICLES},()=>{const dot=kit.sphere(1.8*MM,[0,0,0],'clay',particles);dot.material=dot.material.clone();return dot;});
  const flow=part('flow','Airflow direction','Air enters through the left screen and leaves through the right outlet. Arrows show direction, not measured particle speed.',[0,0,0],system);flow.userData.explosionExcluded=true;
  for(const x of[-260,285]){rod([x-12,230,0],[x+12,230,0],1.2,'blue',flow);const head=mesh(new THREE.ConeGeometry(5*MM,12*MM,16),[x+15,230,0],'blue',flow);head.rotation.z=-Math.PI/2;}
  const roomChart=part('charts','Room particle account','Airborne concentration over one hour, compared with the same room without cleaning. Separate readings account for retained particles, deposition and ventilation.',point([0,240,0]),system);
  const sizeChart=part('size-chart','Single-pass capture by size','The calculated share retained inside the cabinet at the selected airflow and voltage. Charging-only mode has no internal collector. Curves describe assigned idealizations, not certified filter grades.',point([0,240,0]),system);
  for(const [chart,id,map,title,x]of[[roomChart,'charts',roomPoint,'Airborne particles',{min:0,max:3600,title:'Time (minutes)',ticks:[[0,'0'],[1800,'30'],[3600,'60']]}],[sizeChart,'size-chart',sizePoint,'Particle capture',{min:1e-8,max:3e-6,title:'Particle diameter (µm)',ticks:[[1e-8,'0.01'],[1e-7,'0.1'],[1e-6,'1'],[3e-6,'3']]}]]){
    chart.userData.inspectionOnly=id;chart.userData.explosionExcluded=true;
    box([390,340,1],[0,0,-5],'cream',chart).material=new THREE.MeshBasicMaterial({color:0xf8f5e9});
    rod([-140,-95,0],[140,-95,0],.35,'ink',chart);rod([-140,-95,0],[-140,95,0],.35,'ink',chart);
    chartText(chart,map,{title,size:20*MM,x,y:{min:0,max:1,title:chart===roomChart?'Still airborne (%)':'Retained (%)',ticks:[[0,'0'],[.5,'50'],[1,'100']]},legend:chart===roomChart?[['Selected trial',0xc14f39],['Without cleaner',0x7d837b]]:[]});
  }
  const roomLine=lineObject(61,0xc14f39,roomChart),bareLine=lineObject(61,0x7d837b,roomChart),sizeLine=lineObject(61,0x2f6690,sizeChart),cursor=lineObject(2,0x374736,roomChart),sizeDot=kit.sphere(2*MM,[0,0,0],'clay',sizeChart);
  const specs={mode:['Cleaning method',METHOD_OPTIONS,'','Compare particle retention with charging alone. Changing a setting starts a fresh room trial.'],size:['Particle diameter',SIZES.map((d,i)=>({value:i,label:`${fixed(d*1e6,d<1e-7?2:1)} µm`})),'','Identical unit-density spheres. Markers are enlarged for visibility.'],fan:['Regulated airflow',FLOWS.map((q,i)=>({value:i,label:q?`${q} m³/h`:'Fan off'})),'','An assigned flow, maintained across each cartridge. Fan off also disables high voltage in this comparison. Motor speed and power are not predicted.'],voltage:['High voltage',[{value:0,label:'Off'},{value:1,label:'On'}],'','Turn charging and electric collection off while air can still flow. The fibrous cartridge does not need high voltage.'],room:['Room volume',null,'m³','Square floor plan with 2.5 m ceiling. Each trial starts with the same airborne fraction; ventilation remains 0.5 air changes per hour.']};
  for(const [key,[min,max,step]]of Object.entries(AIR_CLEANER_DOMAINS)){const[label,options,unit,help]=specs[key];control(key,label,min,max,step,AIR_CLEANER_DEFAULTS[key],unit,help,options,{primary:key==='mode',...(key==='voltage'?{enabledWhen:values=>values.mode!==0}:{})});}
  let clock=0,lastClock=0,key='',initialTime=null,preparedSettings=null,disposed=false;
  const result=finish(values=>{
    const next=JSON.stringify(values);if(next!==key){key=next;clock=initialTime??0;lastClock=0;
      for(let i=0;i<=60;i++){const s=sampleAirCleaner(values,i*60);roomLine.geometry.attributes.position.array.set(roomPoint(i*60,s.remaining),i*3);bareLine.geometry.attributes.position.array.set(roomPoint(i*60,s.withoutCleaner),i*3);const d=1e-8*300**(i/60),p=s;const efficiency=p.Q===0?0:values.mode===0?fiberCapture(Math.min(d,3e-6),p.U).efficiency:values.mode===1?plateCatch(d,p.U,p.enabled):0;sizeLine.geometry.attributes.position.array.set(sizePoint(d,efficiency),i*3);}
      for(const line of[roomLine,bareLine,sizeLine]){line.geometry.attributes.position.needsUpdate=true;line.geometry.computeBoundingSphere();}
    }
    const s=sampleAirCleaner(values,clock),cohort=Array.from({length:PARTICLES},(_,i)=>particleSample(i,s,clock));
    filter.visible=values.mode===0;collector.visible=wires.visible=values.mode===1;needle.visible=values.mode===2;charger.visible=values.mode!==0;
    positiveLead.visible=groundLead.visible=values.mode===1;needleLead.visible=values.mode===2;indicator.material.color.setHex(s.enabled&&values.mode!==0?0xe3b45e:0x7d837b);
    impeller.rotation.x=-clock/60*s.hourly/60*2*Math.PI;flow.visible=s.Q>0;
    dots.forEach((dot,i)=>{const p=cohort[i];dot.position.set(...point(p.position));dot.visible=p.visible;dot.material.color.setHex(p.charged?(values.mode===2?0x2f6690:0xb8862f):0xc14f39);});
    cursor.geometry.attributes.position.array.set([...roomPoint(clock,0),...roomPoint(clock,1)]);cursor.geometry.attributes.position.needsUpdate=true;sizeDot.position.set(...sizePoint(s.d,s.efficiency));
    const retained=cohort.filter(p=>p.status==='captured').length,returned=cohort.filter(p=>p.status==='returned').length,inTransit=PARTICLES-retained-returned,pct=x=>`${fixed(x*100,2)}%`;
    const outcome=s.Q===0?'Fan off':values.mode===0?'Fibers retain particles':values.mode===2?(s.enabled?'Charging without a collector':'Needle unpowered'):(s.enabled?'Charged particles reach collecting plates':'Air passes unpowered plates');
    return {state:{...s,cohort,retained,returned,inTransit},readings:[
      r('Your result',`${outcome} · ${pct(s.remaining)} still airborne`,`${fixed(clock/60,1)} of 60 minutes. Changing settings begins a fresh trial; inspections preserve it.`),
      r('Room particle account',`${pct(s.remaining)} air + ${pct(s.collected)} collected + ${pct(s.deposited)} deposited + ${pct(s.ventilated)} ventilated`,'All four fractions sum to 100% before rounding. Deposition is on room surfaces, not inside the cleaner.'),
      r('Clean air delivery',`${fixed(s.cadr*3600,1)} m³/h`,`${fixed(s.hourly,0)} m³/h airflow × ${pct(s.efficiency)} single-pass retention. Calculated for the chosen size, not a certified product CADR.`),
      r('Single-pass markers',`${retained} captured · ${returned} returned · ${inTransit} in transit`,'One cohort of 32 enlarged markers. Captured particles stay put; returned particles do not loop back. Their passage is slowed independently of the room clock.'),
      r('Particle charging',values.mode===0?'Uncharged fibrous mat':`${fixed(s.charge.total,2)} mean charges per pass`,s.enabled&&values.mode!==0?`${pct(s.chargedFraction)} receive at least one charge in the assigned Poisson approximation. ${values.mode===2?'Needle charge is negative.':'Wire charge is positive.'}`:'No electrical charging. A mechanical filter still works with high voltage off.'),
      r('Where particles went',`${pct(s.settled)} settled · ${pct(s.electricalDeposit)} electrical deposition`,`${pct(s.withoutCleaner)} would remain airborne without cleaning. Baseline ventilation and gravity are unchanged.`),
      r('Room and repeated passes',`${fixed(s.volume,0)} m³ · ${fixed(s.changes,2)} room volumes/h`,values.mode===2?`${pct(s.charged)} of the original particles are charged and still airborne. Successive passes add charge; relaxation removes charge without removing particles.`:'The plate and filter comparisons use a fixed single-pass efficiency. Residual particle charge between electrostatic passes is not tracked.'),
      r('Selected mechanism',values.mode===0?'Diffusion, interception and impaction':values.mode===1?'Charging, drift and retention':'Charging followed by room deposition',values.mode===0?`${fixed(FILTER.area,1)} m² assigned mat area; no HEPA certification is implied.`:values.mode===1?'44 clear channels, each 6 mm × 200 mm; 100 mm collection length.':'Fan-assisted comparison. Many real ionizers have no fan. Gas removal, ozone and health effects are not calculated.'),
    ]};
  });
  const render=result.update;
  result.update=values=>{const readings=render(values);if(preparedSettings&&Object.entries(preparedSettings).every(([k,v])=>result.getState().values[k]===v)){initialTime=null;preparedSettings=null;}return readings;};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0){initialTime=null;preparedSettings=null;clock=Math.min(ROOM.duration,clock+dt*ROOM.speed);}return render();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastClock):0;if(Number.isFinite(time))lastClock=time;return result.advance(dt);};
  result.reset=({time=0,settings}={})=>{preparedSettings={...(settings??result.defaults)};airCleanerPlan(preparedSettings);if(!Number.isFinite(time)||time<0||time>ROOM.duration)throw new RangeError('Invalid air-cleaner checkpoint');initialTime=time;key='';clock=lastClock=0;return render(preparedSettings);};
  result.replayState=()=>({time:0,settings:result.getState().values});
  const inspect=(label,id,isolate=false)=>({label,part:id,isolate,view:'front',replay:false,run:()=>render()});
  result.actions=[inspect('Inspect: complete cleaner','system'),inspect('Inspect: inlet screen','prefilter'),inspect('Inspect: selected particle stage','stage'),inspect('Inspect: carbon cartridge','carbon'),inspect('Inspect: fan and open passage','fan'),inspect('Inspect: fan motor','motor',true),inspect('Inspect: electrical connections','power'),inspect('Compare the room over one hour','charts',true),inspect('Compare capture by particle size','size-chart',true)];
  result.playback={label:'Run the room trial',description:'One second of playback advances one simulated minute. The finite marker cohort moves at a separate, slowed teaching pace.',stepLabel:'Advance five minutes',advance:result.advance,step:()=>result.advance(300/ROOM.speed),complete:()=>clock>=ROOM.duration,blocked:()=>false};
  result.initialPart=result.autoFramePart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.64;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[.9,.45,3],iso:[1.4,.7,2.7],back:[0,.2,-3],side:[3,.2,.15]};result.partViewDirections={charts:{front:[0,0,3]},'size-chart':{front:[0,0,3]},motor:{front:[2,.4,3]}};
  result.thumbnailOmit=[particles,flow,roomChart,sizeChart];for(const item of result.parts){item.maxZoom=150;item.framePadding=item.id.includes('chart')?.58:.64;}
  result.topology={system,casing,top,prefilter,preFrame,preMesh,stage,rails,filter,pleats,charger,wires,chargingWires,returnGrid,needle,tip,collector,positive,grounded,plates,carbon,carbonFrame,carbonMesh,fan,duct,reducer,shroud,motor,motorBody,shaft,impeller,hub,blades,outlet,outletRings,power,positiveLead,groundLead,needleLead,indicator,particles,dots,flow,roomChart,sizeChart,roomLine,bareLine,sizeLine,cursor,sizeDot,MM};
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;dispose();};return result;
}
