import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {REMOTE_CONTROL_DEFAULTS as D,REMOTE_CONTROL_DOMAINS,REMOTE_KEYS,IR_TIMING,createRemoteControlController,commandName} from './remote-control-physics.js';
import {createRemoteControlGeometry,updateRemoteControlGeometry} from './remote-control-geometry.js';
import {LEDS,photonEv} from './remote-physics.js';

export function createInfraredRemoteModel(){
  const kit=houseModel('Remote control'),geometry=createRemoteControlGeometry(kit),controller=createRemoteControlController();
  let plan=controller.getPlan();
  const specs={
    command:['Button','','Select a key, then press Play. Example codes are assigned for this lesson; they are not a brand code list.',REMOTE_KEYS],
    address:['Device address','','The TV accepts address 55. Address 56 represents another device.',[{value:55,label:'55: this television'},{value:56,label:'56: another device'}]],
    distance:['Distance','m','The aligned model uses intensity divided by distance squared. Drawing compresses the spacing.'],
    battery:['Two cells','V','Lower open-circuit voltage reduces peak LED current. Two assigned 0.225 ohm cell resistances supply both LED branches.'],
    blocked:['Light path','','Compare an unobstructed direct beam with an opaque hand.',[{value:0,label:'Clear path'},{value:1,label:'Hand in the beam'}]],
    emitter:['LED close-up','','Choose the infrared emitter or visible indicator for the junction diagram. Yellow replaces the red indicator and changes its branch load.',[{value:0,label:'Infrared emitter'},{value:1,label:'Red indicator'},{value:2,label:'Yellow indicator'}]],
    probe:['Diagnostic diode bias','V','A separate 1N4148 probe compares forward current and reverse leakage. It is not in the transmitter circuit.'],
    fault:['Frame integrity','','Alter the first bit in the inverted command byte. The decoder should reject the mismatch.',[{value:0,label:'Correct inverse bytes'},{value:1,label:'Corrupt one inverse bit'}]],
    carrier:['Carrier','kHz','This assigned receiver accepts the 38 kHz case and rejects the 56 kHz case. It does not model a continuous filter response.',[{value:38,label:'38 kHz: matched'},{value:56,label:'56 kHz: wrong carrier'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];const domain=key==='address'?[55,56,1]:REMOTE_CONTROL_DOMAINS[key];kit.control(key,name,...domain,D[key],unit,help,options);}
  const validateOptions=values=>{for(const [key,value] of Object.entries(values??{})){const options=specs[key]?.[3];if(options&&!options.some(option=>option.value===value))throw new RangeError(`Unsupported remote ${key} option`);}};
  const result=kit.finish(()=>{
    const s=controller.getState();updateRemoteControlGeometry(geometry,s,plan);
    const tv=s.tv.on?`Channel ${s.tv.channel} · ${s.tv.muted?'muted':`volume ${s.tv.volume}/10`}`:'Power off';
    const selectedLED=LEDS[s.values.emitter],selectedBranch=s.values.emitter===0?plan.on.infrared:plan.on.indicator;
    return {state:{...s,time:s.clock,physicalTime:s.time},readings:[
      reading('Your result',s.phase,'A complete accepted frame changes the television. Blocked, weak, mistuned, corrupted, wrong-address and unassigned messages leave it unchanged.'),
      reading('Television',tv,'Every prepared trial starts on channel 2, volume 4/10, unmuted. Watch the screen picture and volume bars change after validation.'),
      reading('Decoded bits',`${s.decodedCount} / 32`,s.validated?`${plan.decoded.reason}. Address ${plan.decoded.address}; command ${plan.decoded.command}.`:'The decoder observes intervals between received low pulses. It waits for the closing mark before acting.'),
      reading('Selected message',`${commandName(s.values.command)} · code ${s.values.command}`,`Numeric address ${s.values.address}. Each byte leaves least-significant bit first, followed by its bitwise inverse. These key mappings are illustrative.`),
      reading('Carrier',`${s.values.carrier} kHz`,`${plan.tuned?'Matched to':'Rejected by'} this model’s 38 kHz receiver rule. The magnified trace shows one-third-duty pulses inside a 562.5 microsecond mark.`),
      reading('Selected LED',`${selectedLED.sheet.name} · ${(selectedBranch.current*1000).toFixed(2)} mA`,`${selectedBranch.voltage.toFixed(3)} V during a carrier on-pulse; ${selectedLED.sheet.peak} nm light carries ${photonEv(selectedLED.sheet.peak).toFixed(2)} eV per photon. Inspect the light-from-a-diode view for its operating point.`),
      reading('Peak emitter current',`${(plan.on.infrared.current*1000).toFixed(2)} mA`,`The common loaded rail is ${plan.on.rail.toFixed(3)} V when the infrared branch conducts. The assigned LED fit, 15 ohm resistor and ideal switching transistor form this branch.`),
      reading('At the receiver',`${plan.irradiance.toFixed(3)} mW/m²`,`${plan.intensity.toFixed(2)} mW/sr divided by ${s.values.distance}² m²${s.values.blocked?', then blocked by the hand':''}. The assigned sharp cutoff is 0.12 mW/m². This is a comparison model, not a measured operating range.`),
      reading('Diagnostic photocurrent',`${(plan.light*1e9).toFixed(2)} nA`,`Light-only current during a carrier pulse in a BPW34-like diagnostic element, plus an assigned 2 nA dark current. The actual PIN element inside a commercial receiver is not specified by those values.`),
      reading('Frame duration',`${(plan.frameEnd*1000).toFixed(4)} ms`,`A normal frame has a 9 ms leader, 4.5 ms space, 32 pulse-distance bits and a final 562.5 microsecond mark. ${s.values.fault?'The corrupted inverse byte changes the number of long gaps.':'Sixteen ones and sixteen zeros make every normal frame the same duration.'}`),
      reading('Cell charge used',`${(s.charge*1000).toFixed(3)} mC`,`Cumulative charge in both LED branches. A complete frame uses ${(plan.charge*1000).toFixed(3)} mC; logic current and cell transients are excluded.`),
      reading('Cell energy used',`${(s.energy*1000).toFixed(3)} mJ`,`LEDs ${(s.ledEnergy*1000).toFixed(3)}, resistors ${(s.resistorEnergy*1000).toFixed(3)}, and cell resistance ${(s.cellEnergy*1000).toFixed(3)} mJ. Energy balances within the assigned quasi-static circuit.`),
      reading('Diagnostic diode',`${(plan.diagnosticDiode.current*(Math.abs(plan.diagnosticDiode.current)<1e-6?1e9:1e3)).toFixed(3)} ${Math.abs(plan.diagnosticDiode.current)<1e-6?'nA':'mA'}`,`At ${s.values.probe.toFixed(2)} V, the separate 1N4148 fit shows ${s.values.probe<0?'small reverse leakage':s.values.probe>0?'forward conduction':'zero net applied-bias current'}. The junction drawing and carrier speeds are illustrative.`),
      reading('Signal clock',`${(s.time*1000).toFixed(3)} ms`,`After a ${IR_TIMING.press} second illustrative key press, the signal runs ${IR_TIMING.slow} times slower. Carrier pulses are expanded separately in the code diagram. Inspection preserves this clock.`),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  const sync=()=>{const values=controller.getState().values;if(Object.keys(values).some(key=>values[key]!==plan.values[key]))plan=controller.getPlan();return render(values);};
  result.update=(values={})=>{validateOptions(values);controller.update(values);return sync();};
  result.reset=(initial={})=>{validateOptions(initial.settings);controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Press the selected key',description:'Follow one complete message from the selected key to the television.',stepLabel:'Advance the signal clock',advance:result.advance,step:()=>result.advance(.5),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: handset and television','system'],['Inspect: code and carrier','signal'],['Inspect: light from a diode','led'],['Inspect: detecting the infrared','photo'],['Inspect: diode bias','junction']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'system',label:'Inspect the television result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=false;result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.50;result.overviewZoom=1.4;result.selectionOutline=false;result.transparentBackground=true;result.viewDirections={front:[1.4,1.4,6],iso:[2.4,1.8,6]};
  const details=['signal','led','photo','junction'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:[1.4,1.4,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)?.49:.50;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.68,-2.48,-.25),new THREE.Vector3(2.68,2.56,.6)).applyMatrix4(kit.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[geometry.signal,geometry.led,geometry.photo,geometry.diode,geometry.guides];
  result.catalogParts=result.parts.filter(p=>!['system','handset','television','tv-stand'].includes(p.id));
  result.topology=geometry;result.physicalPlan=controller.getPlan;result.duration=()=>controller.getPlan().run;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
