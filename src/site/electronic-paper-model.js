import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {surface, textLabel, solidArrow} from './scene-kit.js';
import {DISPLAY_DEFAULTS, DISPLAY_DOMAINS, DISPLAY_PATTERNS, createDisplayController} from './electronic-paper-physics.js';

const DARK=0x394233, WHITE=0xf5f1dc, GOLD=0xc29243, BLUE=0x83b4c1;
const box=(kit,parent,size,position,color)=>{const mesh=surface(kit,new THREE.BoxGeometry(...size),color,parent);mesh.position.set(...position);return mesh;};
const label=(parent,text,x,y,width=3,height=.22,z=.20)=>textLabel(parent,text,{height,width,position:[x,y,z]});
const arrow=(kit,parent,color,a,b)=>{const mesh=solidArrow(kit,color,parent,.014),v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));mesh.position.set(...a);mesh.userData.setDirection(v);mesh.userData.setLength(v.length());return mesh;};
const glass=(mesh,opacity)=>{mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=opacity;mesh.material.depthWrite=false;return mesh;};
const independentColor=mesh=>{mesh.material=mesh.material.clone();return mesh;};

function readerAssembly(kit){
  const system=kit.part('system','Electronic paper','A reflective display, its drive electronics and a front light. Switch technologies to compare moving charged pigments with oil displaced by water. Packaging and layer thicknesses are illustrative.');
  const reader=kit.part('reader','Complete reader','A connected reader with an enlarged 5 × 7 teaching patch on its page. Real screens contain many more pixels. Ordinary page marks around the patch stay unchanged during a local update.',[0,0,0],system);
  const casing=kit.part('case','Case and mounting frame','A rear shell and open bezel hold the display and electronics. Look inside removes the front stack to expose the battery and controller.',[0,0,0],reader);
  const rear=box(kit,casing,[2.6,3.6,.08],[0,0,-.15],'ink');
  const bezel=new THREE.Group();casing.add(bezel);
  for(const [size,position] of [[[.20,3.6,.30],[-1.20,0,.04]],[[.20,3.6,.30],[1.20,0,.04]],[[2.2,.22,.30],[0,1.69,.04]],[[2.2,.34,.30],[0,-1.63,.04]]])box(kit,bezel,size,position,'ink');
  const ledges=[-1.08,1.08].map(x=>box(kit,casing,[.08,3.04,.025],[x,0,.0275],'ink'));
  textLabel(casing,'Reflective display',{position:[0,-1.62,.198],width:1.8,height:.15,color:'#f5f1dc'});
  const battery=kit.part('battery','Battery and leads','The battery powers page updates, control electronics and front-light LEDs. A retained electrophoretic image needs no continuing pixel drive. That does not mean an entire powered reader consumes no energy.',[0,0,0],reader);
  const batteryCell=box(kit,battery,[1.28,2.45,.12],[-.40,.04,-.05],'metal');
  const controller=kit.part('controller','Controller and power board','The controller stores the requested image. A power circuit provides display drive voltages; driver connections select rows and pixel data. This lesson does not simulate real temperature-dependent multiphase waveforms.',[0,0,0],reader);
  const board=box(kit,controller,[.61,2.45,.06],[.66,.04,-.07],'leaf');
  const chip=box(kit,controller,[.36,.48,.065],[.66,.35,-.0075],'ink');
  const pmic=box(kit,controller,[.30,.30,.065],[.66,-.40,-.0075],'ink');
  const batteryLeads=[kit.rod([.24,-.78,-.045],[.39,-.78,-.045],.012,'red',battery),kit.rod([.24,-.94,-.045],[.39,-.94,-.045],.012,'ink',battery)];
  for(const [x,y] of [[-.98,-1.1],[-.98,1.13],[.88,-1.1],[.88,1.13]])box(kit,casing,[.08,.08,.06],[x,y,-.08],'cream');
  const driver=kit.part('driver','Display driver and flexible connection','A flexible connection joins the board to the TFT backplane. Row and column drivers address individual pixels; the enlarged view shows a simple teaching schedule.',[0,0,0],reader);
  const driverChip=box(kit,driver,[.8,.13,.075],[.4,-1.35,-.0325],'ink');
  const ribbon=[box(kit,driver,[.21,.095,.015],[.66,-1.2325,-.03],'gold'),box(kit,driver,[.62,.12,.015],[.4,-1.475,-.03],'gold'),box(kit,driver,[.62,.015,.10],[.4,-1.5275,.0125],'gold')];
  const backplane=kit.part('backplane','TFT backplane','Each pixel has a switching transistor and electrode. A selected row admits column data. Stored charge and refresh details differ between display technologies; the inspection diagram omits those circuit details.',[0,0,0],reader);
  const substrate=box(kit,backplane,[2.18,3.04,.025],[0,0,.0525],'metal');
  const ink=kit.part('ink','Reflective display layer','The two-pigment mode moves positive black and negative white particles according to the labeled Carta convention. The electrowetting comparison changes the area covered by black oil. Appearance is illustrative, not a reflectance calculation.',[0,0,0],reader);
  const page=independentColor(box(kit,ink,[2.14,3,.018],[0,0,.074],WHITE));
  const pageMarks=[];
  for(const [w,x,y] of [[1.3,0,1.16],[.96,-.17,.94],[1.48,0,-.95],[1.27,-.105,-1.08],[.9,-.29,-1.21]])pageMarks.push(independentColor(box(kit,ink,[w,.027,.006],[x,y,.087],DARK)));
  const pixelMeshes=Array.from({length:35},(_,i)=>independentColor(box(kit,ink,[.19,.19,.006],[(i%5-2)*.205,.615-Math.floor(i/5)*.205,.087],WHITE)));
  const patchCaption=label(ink,'35 enlarged cells',0,-.82,1.7,.14,.095);
  const frontlight=kit.part('frontlight','Front light and protective sheet','LEDs along one edge feed a transparent light guide above the reflective display. Light travels across the guide, down to the ink and back toward the reader. Ink is not self-emitting.',[0,0,0],reader);
  const guide=glass(box(kit,frontlight,[2.08,3,.02],[0,0,.093],BLUE),.045);
  const protective=glass(box(kit,frontlight,[2.18,3.04,.018],[0,0,.112],WHITE),.045);
  const ledStrip=box(kit,frontlight,[.045,2.6,.02],[1.0875,0,.093],'metal');
  const leds=Array.from({length:6},(_,i)=>independentColor(box(kit,frontlight,[.025,.055,.02],[1.0525,-1.10+i*.44,.093],WHITE)));
  const lightFeed=[kit.rod([1.0875,-1.3,.093],[1.0875,-1.3,-.045],.009,'gold',frontlight),kit.rod([1.0875,-1.3,-.045],[.66,-1.3,-.045],.009,'gold',frontlight)];
  const powerIndicator=independentColor(box(kit,casing,[.055,.055,.012],[.94,-1.63,.198],'leaf'));
  return {system,reader,casing,rear,bezel,ledges,battery,batteryCell,batteryLeads,controller,board,chip,pmic,driver,driverChip,ribbon,backplane,substrate,ink,page,pageMarks,pixelMeshes,patchCaption,frontlight,guide,protective,ledStrip,leds,lightFeed,powerIndicator};
}

function displayDetails(kit,system){
  const make=(id,name,description)=>{const group=kit.part(id,name,description,[0,0,0],system);group.userData.inspectionOnly=id;group.userData.explosionExcluded=true;return group;};
  const addressing=make('addressing','Pixel addressing, enlarged','An enlarged 5 × 7 patch. A selected row receives column commands only where its pixels differ from the requested page. Row order and animation timing are teaching choices, not commercial waveforms or refresh speed.');
  label(addressing,'Write only changed pixels',0,1.49);
  const addressCells=Array.from({length:35},(_,i)=>independentColor(box(kit,addressing,[.22,.22,.025],[(i%5-2)*.28,.89-Math.floor(i/5)*.28,.025],WHITE)));
  const rows=Array.from({length:7},(_,i)=>{const mesh=independentColor(box(kit,addressing,[1.66,.018,.018],[-.14,.89-i*.28,-.008],'metal'));label(addressing,String(i+1),-1.20,.89-i*.28,.24,.19);return mesh;});
  const columns=Array.from({length:5},(_,i)=>box(kit,addressing,[.018,2.22,.018],[(i-2)*.28,-.08,-.035],'gold'));
  const switches=addressCells.map((cell,i)=>independentColor(box(kit,addressing,[.055,.055,.035],[cell.position.x-.09,cell.position.y-.09,.041],'ink')));
  const rowDriver=box(kit,addressing,[.16,2.0,.09],[-1.05,.05,-.015],'ink');
  const columnDriver=box(kit,addressing,[1.4,.13,.09],[0,-1.16,-.025],'ink');
  label(addressing,'Columns carry pixel commands',0,1.20,3.1,.20);
  const addressStatus=label(addressing,'',0,-1.44,3.1,.21);

  const capsule=make('capsule','Charged pigments, enlarged','A section through a two-pigment microcapsule. This illustration follows current Carta labels: black positive, white negative. The top common electrode is zero; reversing the bottom potential reverses the field and pigment forces. Separated lanes keep the motion visible; this is not a particle packing or transport calculation.');
  label(capsule,'Opposite charges, opposite forces',0,1.49,3.2);
  const capsuleTop=box(kit,capsule,[1.55,.05,.48],[0,.81,0],'blue');
  const capsuleBottom=box(kit,capsule,[1.55,.05,.48],[0,-.81,0],'gold');
  const capsuleShell=glass(surface(kit,new THREE.SphereGeometry(.785,40,24,Math.PI,Math.PI),'blue',capsule,true),.18);
  const capsuleRim=kit.ring(.785,.012,[0,0,0],'blue',capsule);
  const capsuleSides=[capsuleShell,capsuleRim];
  label(capsule,'Common electrode · 0 V',0,1.08,2.5,.20);
  const bottomLabel=label(capsule,'',0,-1.07,2.8,.20);
  const pigmentBlack=Array.from({length:3},(_,i)=>kit.sphere(.075,[-.5+i*.4,0,-.13],'ink',capsule));
  const pigmentWhite=Array.from({length:3},(_,i)=>kit.sphere(.075,[-.3+i*.4,0,.13],'cream',capsule));
  const fieldArrow=arrow(kit,capsule,GOLD,[1.0,-.60,0],[1.0,.60,0]);
  const blackArrow=arrow(kit,capsule,DARK,[-.26,-.24,.28],[-.26,.24,.28]);
  const whiteArrow=arrow(kit,capsule,BLUE,[.26,.24,.28],[.26,-.24,.28]);
  label(capsule,'E',1.24,0,.25,.22);
  label(capsule,'Black +     White −',0,-1.34,2.9,.22);
  const capsuleStatus=label(capsule,'',0,-1.60,3.2,.19);

  const wetting=make('wetting','Water displacing oil, enlarged','A simplified monostable electrowetting cell. Conductive water wets the insulating hydrophobic surface under voltage, displacing dark oil to reveal a white reflector. With no field, capillary forces spread the oil again. Rectangular volumes conserve oil and water; they are not solved liquid surfaces or a voltage-to-coverage law.');
  label(wetting,'Water uncovers the white floor',0,1.49,3.2);
  const common=box(kit,wetting,[1.62,.04,.6],[0,.30,0],'metal');
  const dielectric=box(kit,wetting,[1.62,.055,.6],[0,-.6475,0],'cream');
  const electrode=box(kit,wetting,[1.62,.025,.6],[0,-.6875,0],'gold');
  const reflector=box(kit,wetting,[1.62,.07,.6],[0,-.735,0],WHITE);
  const oil=box(kit,wetting,[1,1,.5],[0,0,0],'ink');
  const waterLeft=glass(box(kit,wetting,[1,1,.5],[0,0,0],BLUE),.34);
  const waterAbove=glass(box(kit,wetting,[1,1,.5],[0,0,0],BLUE),.34);
  const wettingWalls=[-.775,.775].map(x=>glass(box(kit,wetting,[.05,.92,.5],[x,-.16,0],'metal'),.4));
  label(wetting,'Top common electrode · 0 V',0,.65,3,.20);
  label(wetting,'Blue water · dark oil',0,.99,3,.21);
  label(wetting,'Insulator over bottom electrode',0,-.99,3.25,.19);
  const oilStatus=label(wetting,'',0,-1.30,3.2,.20);
  label(wetting,'Shape simplified; oil volume fixed',0,-1.59,3.25,.18);

  const lighting=make('lighting','Front light path, enlarged','A side LED sends light along a guide above the reflective image. Extraction features redirect some light down to the image and reflected light leaves toward the viewer. Arrows trace illustrative directions, not travel time or a photometric calculation.');
  label(lighting,'Light reaches ink from the front',0,1.49,3.3);
  const lightGuide=glass(box(kit,lighting,[1.80,.17,.42],[0,.23,0],BLUE),.50);
  const lightInk=box(kit,lighting,[1.8,.08,.42],[0,-.46,0],WHITE);
  const lightBack=box(kit,lighting,[1.8,.08,.42],[0,-.54,0],'metal');
  const lightLed=independentColor(box(kit,lighting,[.16,.17,.35],[-.98,.23,0],WHITE));
  const lightWire=kit.rod([-1.06,.23,0],[-1.31,.23,0],.012,'gold',lighting);
  const guided=[arrow(kit,lighting,GOLD,[-.90,.23,.26],[.12,.23,.26]),arrow(kit,lighting,GOLD,[.12,.23,.26],[.12,-.418,.26]),arrow(kit,lighting,GOLD,[.12,-.418,.26],[.67,1.0,.26])];
  const ambientRays=[arrow(kit,lighting,BLUE,[-.55,1.0,.27],[-.18,-.418,.27]),arrow(kit,lighting,BLUE,[-.18,-.418,.27],[.08,1.0,.27])];
  label(lighting,'Viewer',.47,1.18,1.6,.21);
  label(lighting,'LED',-1.13,.53,.6,.20);
  label(lighting,'Reflective image',0,-.79,3,.22);
  label(lighting,'Guide above the ink',0,-1.07,3,.21);
  const lightingStatus=label(lighting,'',0,-1.43,3.3,.20);

  const filters=make('filters','Color filters, enlarged','One book-style color concept places red, green and blue filters over separately addressed oil cells. Each filter absorbs other wavelengths. This is a comparison diagram, not a color e-reader product specification. The cited 2003 Nature prototype instead combined two colored oil layers and a filter.');
  label(filters,'One color pixel: three subpixels',0,1.49,3.3);
  const filterCells=[],filterOil=[];
  for(const [i,color] of [0xd6604e,0x74a471,0x729abd].entries()){
    const x=(i-1)*.78;
    box(kit,filters,[.69,1.32,.08],[x,0,-.06],WHITE);
    filterCells.push(glass(box(kit,filters,[.69,1.32,.02],[x,0,.13],color),.7));
    filterOil.push(box(kit,filters,[.13,1.32,.07],[x+.28,0,.015],'ink'));
    label(filters,['Red','Green','Blue'][i],x,.91,.73,.21);
  }
  label(filters,'Filters select reflected colors',0,-.98,3.25,.21);
  label(filters,'Each oil cell is addressed separately',0,-1.29,3.25,.19);
  label(filters,'Comparison view; not a product model',0,-1.59,3.25,.18);
  return {addressing,addressCells,rows,columns,switches,rowDriver,columnDriver,addressStatus,capsule,capsuleTop,capsuleBottom,capsuleSides,pigmentBlack,pigmentWhite,fieldArrow,blackArrow,whiteArrow,bottomLabel,capsuleStatus,wetting,common,dielectric,electrode,reflector,oil,waterLeft,waterAbove,wettingWalls,oilStatus,lighting,lightGuide,lightInk,lightBack,lightLed,lightWire,guided,ambientRays,lightingStatus,filters,filterCells,filterOil};
}

function updateDisplayGeometry(p,d,state){
  const {values,now}=state;
  const shade=value=>new THREE.Color(WHITE).lerp(new THREE.Color(DARK),value);
  p.page.material.color.set(now.visible?WHITE:0x343934);
  p.pageMarks.forEach(mesh=>mesh.visible=now.visible);p.patchCaption.visible=now.visible;
  p.pixelMeshes.forEach((mesh,i)=>{mesh.material.color.copy(now.visible?shade(now.pixels[i]):new THREE.Color(0x343934));});
  p.powerIndicator.material.color.set(values.power?0x91aa7e:DARK);
  p.leds.forEach(mesh=>{mesh.material.color.set(now.frontLightOn?0xffdc8b:WHITE);mesh.material.emissive.set(now.frontLightOn?0x70521b:0);});
  d.addressCells.forEach((mesh,i)=>mesh.material.color.copy(shade(now.pixels[i])));
  d.rows.forEach((mesh,i)=>mesh.material.color.set(i===now.activeRow?GOLD:0x9caa93));
  d.switches.forEach((mesh,i)=>mesh.material.color.set(now.voltages[i]!==0?GOLD:DARK));
  d.addressStatus.userData.setText(now.activeRow>=0?`Row ${now.activeRow+1} · ${now.writtenCells}/${now.changedCells} changed cells written`:now.passiveReturn?'No row selected · passive oil return':values.power?'Row scan complete':'Drive disconnected');
  const value=values.technology===0?now.pixels[now.selected]:0,voltage=values.technology===0?now.voltage:0,sign=Math.sign(voltage);
  d.pigmentBlack.forEach(mesh=>mesh.position.y=-.46+.92*value);
  d.pigmentWhite.forEach(mesh=>mesh.position.y=.46-.92*value);
  for(const [mesh,force,x,length] of [[d.fieldArrow,sign,1,1.2],[d.blackArrow,sign,-.2,.48],[d.whiteArrow,-sign,.2,.48]]){mesh.userData.setLength(length);mesh.visible=force!==0;mesh.position.y=-Math.sign(force)*length/2;mesh.position.x=x;mesh.userData.setDirection(new THREE.Vector3(0,force||1,0));}
  d.bottomLabel.userData.setText(`Bottom electrode · ${voltage>0?'+':''}${voltage} V`);
  d.capsuleStatus.userData.setText(values.technology===1?'Select two-pigment ink to drive this view':voltage?'E goes from higher to lower potential':'No drive; ink retains its current state');
  const dark=values.technology===1?now.pixels[now.selected]:1;
  const oilWidth=.30+1.20*dark,oilHeight=.18/oilWidth,leftWidth=1.5-oilWidth,aboveHeight=.9-oilHeight;
  d.oil.scale.set(oilWidth,oilHeight,1);d.oil.position.set(.75-oilWidth/2,-.62+oilHeight/2,0);
  d.waterLeft.scale.set(Math.max(1e-8,leftWidth),.9,1);d.waterLeft.position.set(-.75+leftWidth/2,-.17,0);d.waterLeft.visible=leftWidth>1e-8;
  d.waterAbove.scale.set(oilWidth,aboveHeight,1);d.waterAbove.position.set(.75-oilWidth/2,-.62+oilHeight+aboveHeight/2,0);
  d.oilStatus.userData.setText(values.technology===0?'Select electrowetting to move the oil':now.passiveReturn?'0 V · capillary forces spread oil':`${now.voltage>0?'+':''}${now.voltage} V · ${now.voltage?'water displaces oil':dark<1-1e-10?'oil spreading':'oil covers the floor'}`);
  d.guided.forEach(mesh=>mesh.visible=now.frontLightOn);d.ambientRays.forEach(mesh=>mesh.visible=Boolean(values.ambient));
  d.lightLed.material.color.set(now.frontLightOn?0xffdc8b:WHITE);
  d.lightingStatus.userData.setText(now.frontLightOn?'LED → guide → ink → viewer':values.ambient?'Room light → ink → viewer':'No incident light; image is not visible');
}

export function createElectronicPaperDisplayModel(){
  const kit=houseModel('Electronic paper'),p=readerAssembly(kit),d=displayDetails(kit,p.system),controller=createDisplayController();
  const options={technology:['Two-pigment ink','Electrowetting'],pattern:DISPLAY_PATTERNS.map(p=>p.name),power:['Disconnected','Connected'],reverse:['Normal drive','Reverse polarity'],ambient:['Dark room','Room light'],frontlight:['Off','On']};
  const help={technology:'Compare bistable charged pigments with a monostable oil-and-water cell.',pattern:'Select a requested page. Only changed cells are addressed in the enlarged 5 × 7 patch.',power:'Ink retains its image without drive. Oil returns under capillary forces; press Play to watch even with power disconnected.',reverse:'Reverse the labeled drive: charged pigments swap direction. Ideal capacitive electrowetting is unchanged by voltage sign.',ambient:'A reflective screen needs incident light. This changes visibility, not the stored image.',frontlight:'LEDs illuminate the display from its front. The front light needs connected power.'};
  const names={technology:'Display technology',pattern:'Requested pattern',power:'Battery power',reverse:'Drive polarity',ambient:'Ambient light',frontlight:'Front light'};
  for(const key of Object.keys(DISPLAY_DEFAULTS))kit.control(key,names[key],...DISPLAY_DOMAINS[key],DISPLAY_DEFAULTS[key],'',help[key],options[key].map((label,value)=>({label,value})),{primary:key==='technology'});
  const result=kit.finish(()=>{
    const state=controller.getState(),{values,now}=state;updateDisplayGeometry(p,d,state);
    const status=now.passiveReturn?'Oil returning without power':!values.power?values.technology?'Oil-covered display':'Ink image retained':!now.complete?'Writing the requested patch':values.technology?now.voltages.some(v=>v!==0)?'Image held by pixel voltages':'Oil-covered display; no holding drive':'Ink image retained; drive off';
    return {state:{...state,time:state.clock},readings:[
      r('Your result',status,now.visible?`${now.matchedCells} of 35 cells match the requested ${DISPLAY_PATTERNS[values.pattern].name} pattern${values.technology===0&&values.reverse?' with reversed contrast':''}. Intermediate shades indicate illustrative motion, not measured gray reflectance.`:'No incident light reaches the page. Its physical pixel state still exists; restore room light or a powered front light to see it.'),
      r('Addressing',now.activeRow>=0?`Row ${now.activeRow+1} of 7`:'No active row',`${now.writtenCells} of ${now.changedCells} changed cells reached this operation’s target. Unchanged cells stay in place. Row timing is a slow teaching schedule, not real refresh speed.`),
      r('Selected pixel',`Row ${Math.floor(now.selected/5)+1}, column ${now.selected%5+1} · ${now.voltage>0?'+':''}${now.voltage} V`,values.technology?'The simple electrowetting example needs holding voltage for uncovered areas. Its polarity can reverse without changing the ideal capacitive effect.':'Top common electrode: 0 V. Black pigment is positive and white is negative in the labeled Carta convention. Reference ±15 V is illustrative; real drive waveforms have multiple phases.'),
      r('Light reaching the page',now.frontLightOn?values.ambient?'Room light and front light':'Front light':values.ambient?'Room light':'None','The display reflects incident light. LEDs and reader electronics require power even though a retained ink image needs no continuing pixel drive.'),
    ]};
  });
  const render=result.update;let lastClock=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);lastClock=0;return render(controller.getState().values);};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)controller.advance(dt);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastClock):0;if(Number.isFinite(time))lastClock=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Write the display',description:'A slowed teaching sequence. Row order, motion and time are illustrative; this does not reproduce a commercial driving waveform.',stepLabel:'Advance one quarter row',advance:result.advance,step:()=>result.advance(.2),complete:()=>result.getState().now.complete,blocked:()=>false};
  result.actions=[['Inspect: complete reader','reader'],['Inspect: controller and power','controller'],['Inspect: pixel addressing','addressing'],['Inspect: charged pigments','capsule'],['Inspect: water and oil','wetting'],['Inspect: front light','lighting'],['Inspect: color filters','filters']].map(([label,part])=>({label,part,view:'front',isolate:true,replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'reader',label:'Inspect the display result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.covers.push(p.bezel,p.backplane,p.ink,p.frontlight);result.initialCutaway=false;
  const detailIds=['addressing','capsule','wetting','lighting','filters'];result.thumbnailOmit=detailIds.map(id=>d[id]);
  result.catalogParts=result.parts.filter(part=>!['system','reader'].includes(part.id));
  result.partViewDirections=Object.fromEntries(result.parts.map(part=>[part.id,{front:detailIds.includes(part.id)?[0,0,3]:[.35,.16,3]}]));
  for(const part of result.parts)part.framePadding=detailIds.includes(part.id)?.66:.72;
  result.initialPart='reader';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.72;result.selectionOutline=false;result.transparentBackground=true;
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-1.72,-1.74,-.40),new THREE.Vector3(1.72,1.65,.45)).applyMatrix4(d[id].matrixWorld):null;
  result.topology={...p,details:d};const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
