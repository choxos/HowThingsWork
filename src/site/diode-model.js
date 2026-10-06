import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createDiodeGeometry,updateDiodeGeometry} from './diode-geometry.js';
import {createDiodeController,DIODE_DEFAULTS as D,DIODE_DOMAINS,LOAD,formatDiodeCurrent} from './diode-physics.js';

export function createDiodeModel() {
  const kit=houseModel('Diode'),g=createDiodeGeometry(kit),controller=createDiodeController();
  const specs={
    voltage:['Supply voltage','V','Positive makes the upper source terminal positive. Reversing the source changes diode bias. A new run preserves the current load temperature.'],
    resistance:['Load resistance','Ω','The source voltage divides between this fixed-ohmic load and the diode. Resistance controls current and heating.'],
    orientation:['Diode direction','','Compare reversing the diode with reversing the source.',[{value:1,label:'Anode toward upper source terminal'},{value:-1,label:'Cathode toward upper source terminal'}]],
    closed:['Circuit switch','','An open switch stops current; an already warm load cools continuously.',[{value:1,label:'Closed circuit'},{value:0,label:'Open circuit'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];kit.control(key,name,...DIODE_DOMAINS[key],D[key],unit,help,options);}
  const result=kit.finish(()=>{
    const s=controller.getState();updateDiodeGeometry(g,s);
    return {state:s,readings:[
      reading('Your result',s.status,`${s.phase}. The circuit responds immediately; the load temperature follows its stored heat.`),
      reading('Diode bias',`${s.bias} · ${s.diodeVoltage.toFixed(4)} V`,'Voltage from anode to cathode, independent of how the package is turned on the board.'),
      reading('Diode current',formatDiodeCurrent(s.diodeCurrent),'Positive means conventional current from anode to cathode. Nanoamperes are one millionth of milliamperes.'),
      reading('Loop current',formatDiodeCurrent(s.current),'Positive means current leaves the upper source terminal. The meter uses ±100 mA or ±10 nA as labeled.'),
      reading('Load temperature',`${s.temperature.toFixed(2)} °C`,'Assigned thermal mass 0.12 J/K and heat loss 80 K/W, starting at 25 °C unless the experiment says otherwise.'),
      reading('Load power',`${(s.power*1000).toFixed(3)} mW`,'Electrical heating is I²R. The thermometer indicates heat; the resistor does not visibly glow.'),
      reading('Load voltage',`${s.loadVoltage.toFixed(4)} V`,'Signed drop through the resistor along the positive loop direction.'),
      reading('Diode power',`${(s.diodePower*1000).toFixed(6)} mW`,'Diode voltage times anode-to-cathode current. The diode is held at 25 °C in this model.'),
      reading('Source power',`${(s.sourcePower*1000).toFixed(3)} mW`,'Source power equals diode power plus load power; the ideal switch and meter dissipate none.'),
      reading('Heat stored in load',`${s.stored.toFixed(4)} J`,'Heat capacity times temperature rise above the 25 °C surroundings.'),
      reading('Heat released this run',`${Math.max(0,s.energyOut).toFixed(4)} J`,'Initial stored heat plus electrical input minus the heat still stored. It stays positive during cooling.'),
      reading('Experiment clock',`${s.time.toFixed(2)} / ${LOAD.duration} s`,'Control changes begin a new run at the present temperature. Presets and Reset own their initial state; inspections preserve time.'),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  const sync=()=>render(controller.getState().values);
  result.update=(values={})=>{controller.update(values);return sync();};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the diode experiment',description:'Follow current and twelve seconds of load heating or cooling.',stepLabel:'Advance a quarter second',advance:result.advance,step:()=>result.advance(.25),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: complete circuit','circuit'],['Inspect: the junction','junction'],['Inspect: current and voltage','curve'],['Inspect: load and thermometer','load']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'circuit',label:'Inspect the completed comparison',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='circuit';result.initialView='front';result.initialCutaway=false;result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.5;result.overviewZoom=1.25;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[.9,1.3,6],iso:[2.3,1.8,6]};
  const details=['junction','curve'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:[.9,1.3,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)||part.id==='circuit'?.5:.57;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.7,-2.4,-.2),new THREE.Vector3(2.7,2.45,.6)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[g.junction,g.curve,g.flowRoot];result.catalogParts=result.parts.filter(p=>p.id!=='circuit'&&p.id!=='board');result.topology=g;result.duration=()=>LOAD.duration;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
