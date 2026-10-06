import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {SIGNAL_DEFAULTS as D,SIGNAL_DOMAINS,createSignalingController} from './infrared-signaling-physics.js';
import {IR_TIMING,REMOTE_KEYS,commandName} from './remote-control-physics.js';
import {createRemoteControlGeometry,updateRemoteControlGeometry} from './remote-control-geometry.js';
import {createSignalBitGeometry,updateSignalBitGeometry} from './infrared-signaling-geometry.js';

export function createInfraredSignalingModel(){
  const kit=houseModel('Infrared signaling'),geometry=createRemoteControlGeometry(kit),bitGeometry=createSignalBitGeometry(kit,geometry.system);
  geometry.signal.add(bitGeometry.selected);
  const controller=createSignalingController();let plan=controller.getPlan();
  const specs={
    command:['Command code','','Send any byte. Example actions: 26 changes channel, 18 raises volume, 0 switches power. Other codes can be decoded without a TV action.'],
    address:['Device address','','The assigned TV accepts 55. A different address produces a valid message for another device.'],
    bit:['Inspect frame bit','','Index 0–7 is address, 8–15 inverse address, 16–23 command, 24–31 inverse command. Inspection keeps the clock and television state.'],
    distance:['Distance','m','The aligned light estimate falls with distance squared; the drawing compresses the spacing.'],
    battery:['Two cells','V','Lower voltage reduces peak light output. Both LED branches load the same assigned 0.45 ohm cell resistance.'],
    blocked:['Light path','','A hand blocks the direct optical path.',[{value:0,label:'Clear path'},{value:1,label:'Hand in the beam'}]],
    fault:['Frame integrity','','Flip the first bit of the inverted command byte. The frame should fail the complement check.',[{value:0,label:'Correct inverse bytes'},{value:1,label:'Corrupt one inverse bit'}]],
    carrier:['Carrier','kHz','Compare the matched and mismatched cases. This is a discrete receiver rule.',[{value:38,label:'38 kHz: matched'},{value:56,label:'56 kHz: wrong carrier'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];kit.control(key,name,...SIGNAL_DOMAINS[key],D[key],unit,help,options);}
  const result=kit.finish(()=>{
    const s=controller.getState(),b=s.inspected;
    updateRemoteControlGeometry(geometry,{...s,values:plan.values},plan);updateSignalBitGeometry(bitGeometry,s,plan);
    if(!REMOTE_KEYS.some(key=>key.value===s.values.command)){
      const key=geometry.keys.find(key=>key.code===255);key.cap.material.color.setHex(0xe3b45e);key.body.position.z=key.rest.z-(s.keyDown?.09:0);
    }
    const tv=s.tv.on?`Channel ${s.tv.channel} · ${s.tv.muted?'muted':`volume ${s.tv.volume}/10`}`:'Power off';
    return {state:{...s,time:s.clock,physicalTime:s.time},readings:[
      reading('Your result',s.phase,'The receiver must recover the complete frame. Timing, inverse bytes, address and assigned command decide whether the television changes.'),
      reading('Television',tv,'Each trial starts on channel 2 at volume 4, unmuted. The screen picture and bars show accepted changes.'),
      reading('Selected bit',`${b.byteName} · bit ${b.bitIndex} = ${b.value}`,`Frame index ${b.index}; weight ${b.weight}. The selected byte is numeric ${b.byte}, sent ${b.byteBits.join('')} from left to right, least-significant bit first.`),
      reading('Burst and quiet',`562.5 μs + ${(b.gap*1e6).toFixed(1)} μs`,`Start-to-start distance ${(b.distance*1000).toFixed(3)} ms encodes ${b.value}. ${b.closing?'The next burst is the closing mark.':'The next data mark ends this timing interval.'}`),
      reading('Selected bit received',b.decoded?String(b.value):b.received?'Waiting for next edge':'No receiver pulses',b.received?`The next falling edge arrives at ${(b.readAt*1000).toFixed(4)} ms. Reading one bit is not the same as validating the whole frame.`:'The transmitted pattern still exists, but obstruction, weak light or the wrong carrier prevents the output edges.'),
      reading('Decoded bits',`${s.decodedCount} / 32`,s.validated?`${plan.decoded.reason}. Address ${plan.decoded.address}; command ${plan.decoded.command}.`:'The decoder observes received intervals. It waits until the closing mark ends before allowing a TV action.'),
      reading('Selected message',`Address ${s.values.address} · command ${s.values.command}`,`${commandName(s.values.command)}. The question-mark key represents a programmable code when no named key is assigned.`),
      reading('Carrier',`${s.values.carrier} kHz · ${b.pulses} on-pulses`,`One 562.5 μs mark spans ${b.periods.toFixed(3)} carrier periods. One-third duty, restarted at each mark. ${plan.tuned?'Matched':'Rejected'} by this assigned 38 kHz receiver.`),
      reading('At the receiver',`${plan.irradiance.toFixed(3)} mW/m²`,`${plan.intensity.toFixed(2)} mW/sr divided by distance squared${s.values.blocked?', then blocked by the hand':''}. The assigned sharp cutoff is 0.12 mW/m², not a measured operating range.`),
      reading('Peak emitter current',`${(plan.on.infrared.current*1000).toFixed(2)} mA`,'The assigned LED and shared cell circuit determine burst brightness. Brightness does not encode the bit value.'),
      reading('Frame duration',`${(plan.frameEnd*1000).toFixed(4)} ms`,'Two correct byte/inverse pairs contain sixteen ones and sixteen zeros. The final 562.5 μs mark is included.'),
      reading('Signal clock',`${(s.time*1000).toFixed(3)} ms`,`Envelope time runs ${IR_TIMING.slow} times slower after a ${IR_TIMING.press} second key press. Bit inspection preserves this clock; message and light-path changes restart it.`),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  const sync=()=>{const s=controller.getState();if(Object.keys(plan.values).some(key=>key in s.values&&s.values[key]!==plan.values[key]))plan=controller.getPlan();return render(s.values);};
  result.update=(values={})=>{controller.update(values);return sync();};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Send the selected message',description:'Follow one complete NEC example from the handset to the television.',stepLabel:'Advance the signal clock',advance:result.advance,step:()=>result.advance(.05),complete:()=>result.getState().complete,blocked:()=>false};
  result.parts=result.parts.filter(p=>!['led','junction'].includes(p.id));
  result.actions=[['Inspect: handset and television','system'],['Inspect: complete frame','signal'],['Inspect: selected bit','bit'],['Inspect: receiving the light','photo']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'system',label:'Inspect the television result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=false;result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.50;result.overviewZoom=1.4;result.selectionOutline=false;result.transparentBackground=true;result.viewDirections={front:[1.4,1.4,6],iso:[2.4,1.8,6]};
  const details=['signal','bit','photo'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:[1.4,1.4,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)?.49:.50;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.68,-2.48,-.25),new THREE.Vector3(2.68,2.56,.6)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[geometry.signal,bitGeometry.root,geometry.led,geometry.photo,geometry.diode,geometry.guides];
  result.catalogParts=result.parts.filter(p=>!['system','handset','television','tv-stand'].includes(p.id));
  result.topology={...geometry,bit:bitGeometry};result.physicalPlan=controller.getPlan;result.duration=()=>plan.run;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
