import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createLedGeometry,updateLedGeometry} from './led-geometry.js';
import {createLedController,LED_DEFAULTS as D,LED_DOMAINS,LED_EXPERIMENT as E,formatLedQuantity as fmt} from './led-physics.js';

export function createLedModel(){
  const kit=houseModel('Light-emitting diode'),g=createLedGeometry(kit),controller=createLedController();
  const specs={
    voltage:['Supply voltage','V','The selected voltage divides between source resistance, the current-limiting resistor and the LED. Changing a control starts a fresh measurement.'],
    resistance:['Series resistance','Ω','More series resistance reduces current, light output and accumulated target exposure at the same source voltage.'],
    emitter:['LED material','','Select a device with a different semiconductor transition and current-voltage curve.',[{value:0,label:'Infrared · TSAL6200 · 940 nm'},{value:1,label:'Red · TLHR5400 · 635 nm'},{value:2,label:'Yellow · TLHY5400 · 585 nm'}]],
    drive:['Drive timing','','Pulses retain the same on-state current but reduce cycle-average current and accumulated light to one third over complete cycles.',[{value:1,label:'38 kHz pulses · one-third duty'},{value:0,label:'Steady current'}]],
    distance:['Target distance','m','On-axis light per area falls with distance squared. This changes the target, not LED current. The drawing compresses distances.'],
    closed:['Circuit switch','','Open the manual switch to break the complete electrical path.',[{value:1,label:'Closed circuit'},{value:0,label:'Open circuit'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];kit.control(key,name,...LED_DOMAINS[key],D[key],unit,help,options);}
  const result=kit.finish(()=>{
    const s=controller.getState();updateLedGeometry(g,s);
    return {state:s,readings:[
      reading('Your result',s.status,s.complete?'Measurement complete. Replay restores this experiment’s starting settings and clock.':'Play follows a short light measurement. Infrared is shown with a labeled false-color cue.'),
      reading('Current now',fmt(s.instantaneousCurrent,'A'),`On-state ${fmt(s.current,'A')}; cycle mean ${fmt(s.meanCurrent,'A')}. The physical meter shows the mean.`),
      reading('LED voltage',`${s.voltage.toFixed(4)} V`,'On-state anode-to-cathode voltage, from a nominal 25 °C diode curve.'),
      reading('Photon energy',`${s.photonEv.toFixed(3)} eV · ${s.wavelength} nm`,'Energy hc/λ at the peak wavelength. This does not impose a rigid minimum forward voltage.'),
      reading('LED electrical input',fmt(s.ledPower,'W'),'On-state LED voltage times current. It excludes heating in the series resistor and source resistance.'),
      reading(s.infrared?'Radiant output':'Luminous intensity',fmt(s.infrared?s.radiantPower:s.intensity,s.infrared?'W':'cd'),s.infrared?'Assigned 29.6% conversion, matched to the 40 mW typical reference at 100 mA and 1.35 V.':'Assigned linear scaling from 10 mcd at 10 mA. Candelas weight light by human visual sensitivity; total radiant watts are not inferred.'),
      reading('Mean light at target',fmt(s.meanTarget,s.infrared?'W/m²':'lx'),`On-axis ${s.infrared?'irradiance':'illuminance'} at ${s.values.distance.toFixed(1)} m. Doubling distance divides this value by four.`),
      reading('Accumulated exposure',fmt(s.exposure,s.infrared?'J/m²':'lx·s'),'Light per area integrated over actual on-time. The scene bar saturates at 100 μJ/m² for infrared or 20 μlx·s for visible light; the number continues.'),
      reading('Conversion',s.infrared?`${s.externalQuantumEfficiency===null?'0':s.externalQuantumEfficiency.toFixed(3)} photons/electron`:'Radiant efficiency not inferred',s.infrared?`${fmt(s.nonRadiantPower,'W')} remains as nonradiative loss in this assigned on-state model. The marker counts are schematic.`:'Neither total photons nor heat split can be recovered from one candela value without spectrum and angular distribution.'),
      reading('Series resistor',`${fmt(s.resistorPower,'W')} · ${s.resistorVoltage.toFixed(3)} V`,'On-state I²R heating and voltage drop. The source also has 0.45 Ω of assigned internal resistance.'),
      reading('Current reference',s.aboveDcRating?`Peak exceeds ${fmt(s.dcLimit,'A')} DC rating`:`Peak within ${fmt(s.dcLimit,'A')} DC reference`,'DC current alone is not pulse or thermal qualification. The infrared and visible devices have different ratings; this model does not predict overheating or failure.'),
      reading('Measurement clock',`${(s.realTime*1e6).toFixed(2)} μs real · ${s.time.toFixed(2)} / ${E.duration} s view`,`View slowed ${E.slowdown.toLocaleString('en-US')} times. Integrated on-time ${(s.onTime*1e6).toFixed(2)} μs. Presets and Reset own all settings and time.`),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  const sync=()=>render(controller.getState().values);
  result.update=(values={})=>{controller.update(values);return sync();};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the LED light measurement',description:'Compare current, recombination and light accumulated over 24 carrier periods.',stepLabel:'Advance one-sixth of a cycle',advance:result.advance,step:()=>result.advance(1/12),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: complete experiment','circuit'],['Inspect: LED package','led'],['Inspect: carrier recombination','junction'],['Inspect: photon energy and conversion','power'],['Inspect: pulse timing','pulses']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'circuit',label:'Inspect the measured light',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='circuit';result.initialView='front';result.initialCutaway=false;result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.5;result.overviewZoom=1.35;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[-1.8,1.3,6],iso:[-2.8,1.9,6]};
  const details=['junction','power','pulses'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:p.id==='led'?[.4,1,6]:[-1.8,1.3,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)||part.id==='circuit'?.5:.6;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.75,-2.4,-.2),new THREE.Vector3(2.75,2.5,.6)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[g.junction,g.power,g.pulses,g.flowRoot,g.beamRoot];result.catalogParts=result.parts.filter(p=>!['circuit','board'].includes(p.id));result.topology=g;result.duration=()=>E.duration;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
