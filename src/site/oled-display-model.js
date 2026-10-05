import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {OLED,OLED_DURATION,OLED_PLAYBACK_DURATION,OLED_DEFAULTS as D,OLED_DOMAINS,createOledDisplayController} from './oled-display-physics.js';
import {createOledDisplayGeometry,updateOledDisplayGeometry} from './oled-display-geometry.js';

export function createOledDisplayModel(){
  const kit=houseModel('OLED display'),geometry=createOledDisplayGeometry(kit),controller=createOledDisplayController();
  const options={pattern:['Center pixel','All nine pixels','Checkerboard'],addressing:['Write every frame','Write once, then hold','Disable row writes','Write, then erase'],circuit:['Connected throughout','Open from the start','Open after one frame'],retention:['Ideal storage','Demonstrate 50 ms leakage']};
  const names={red:'Red target',green:'Green target',blue:'Blue target',pattern:'Picture pattern',addressing:'Row writing',circuit:'Emitter return',retention:'Signal retention'};
  const hints={red:'Linear fraction of the assigned 2 μA maximum red-emitter current. These percentages are not encoded sRGB codes.',green:'The green emitter has its own stored signal and current. Changing its target changes green emission.',blue:'The blue emitter is controlled independently. Equal target percentages mean equal assigned currents, not equal visual brightness.',pattern:'Program one center pixel, all nine pixels, or five checkerboard pixels. Compare whole-panel current and power at the same target.',addressing:'Row switches write the drive gates. One-frame writing then holds them; disabled writing keeps the initial black state; write-then-erase sends zero targets after the first frame.',circuit:'A separate switch opens the common cathode return. Row writing and the assigned electronics load continue, but an open emitter loop cannot supply sustained light.',retention:'Ideal storage retains the signal. The deliberately leaky option discharges source-to-gate voltage with a 50 ms time constant between row writes. Every settings edit restarts the record.'};
  for(const key of Object.keys(D))kit.control(key,names[key],...OLED_DOMAINS[key],D[key],['red','green','blue'].includes(key)?'%':'',hints[key],options[key]?.map((label,value)=>({label,value})));
  const result=kit.finish(()=>{
    const s=controller.getState(),c=s.center.channels,pixelCount=s.pixels.filter(p=>p.active).length;updateOledDisplayGeometry(geometry,s);
    const emitting=s.total.current>0;
    const phase=!s.circuitClosed?'Emitter return open':s.values.addressing===2?'No signal has been written':emitting?'The OLED is making light':s.values.addressing===3&&s.time>OLED.frame?'A black signal erased the light':s.values.retention&&s.values.addressing===1&&s.time>.07?'The held signal has leaked away':s.time===0?'Ready to write a picture':'The emitters are dark';
    const why=!s.circuitClosed?'Stored signals and row writing can remain, but no sustained current crosses an open emitter loop. The assigned electronics load still consumes power.':s.values.addressing===2?'Choosing target values does not write them. With every row switch disabled, all drive gates remain in the initial off state.':emitting?'Current from the supply brings electrons and holes into the organic stack. Light originates there; no backlight passes through this panel.':'Zero emitter current gives zero emitted light in this ideal model. It does not imply zero electronics consumption or zero reflected room light.';
    return {state:{...s,time:s.clock,physicalTime:s.time,complete:s.done,blocked:false,phase},readings:[
      reading('Your result',`${s.done?'Record complete · ':''}${phase}`,why),
      reading('Center RGB targets',`${s.values.red}% / ${s.values.green}% / ${s.values.blue}%`,'Linear fractions of the assigned per-emitter maximum. The displayed colors are normalized illustrative RGB, not calibrated spectra or absolute luminance.'),
      reading('Center row switch',`${s.center.selected?'On':'Off'} · ${s.center.writes} writes`,s.selectedRow===null?'No row is selected now. The drive transistors can continue supplying OLED current from held control signals.':`Row ${s.selectedRow+1} is selected. Three illustrative rows are scanned at 60 Hz; each selected interval lasts 120 μs.`),
      reading('Held source-to-gate voltages',c.map(v=>`${v.voltage.toFixed(3)} V`).join(' / '),'The capacitor stores VSG, with the drive source at +8 V. In the assigned P-type square-law model, current begins above |Vth| = 1 V. This stored signal controls a separate current path.'),
      reading('Center OLED currents',c.map(v=>`${(v.current*1e6).toFixed(3)} μA`).join(' / '),'Red / green / blue. The current-setting law is I = K max(VSG − |Vth|, 0)² while the emitter return is connected. K = 0.5 μA/V²; all conducting states have saturation headroom.'),
      reading('Center escaped photons',c.map(v=>(v.photonRate/1e12).toFixed(3)).join(' / ')+' × 10¹²/s','Assigned external yield: 0.20 escaped photons per injected electron. Carrier icons only trace directions. Their size, count and travel speed are not a microscopic transport simulation.'),
      reading('Center relative emission',c.map(v=>`${(100*v.light).toFixed(2)}%`).join(' / '),'Each channel is normalized to its own assigned full current. Hole/electron flow, photon symbols and the visible apertures use these actual currents, including charging or leakage.'),
      reading('Nine-pixel supply current',`${(s.total.current*1e6).toFixed(3)} μA`,`${pixelCount} ${pixelCount===1?'pixel':'pixels'} programmed by the chosen pattern. The supply current sums all 27 emitter channels, not only the center pixel.`),
      reading('Total circuit power',`${(s.total.power*1e6).toFixed(3)} μW`,`Emitter rail: ${(s.total.supplyPower*1e6).toFixed(3)} μW. Assigned other electronics: 50.000 μW. Inspect the energy budget for optical output, OLED heat and drive-TFT heat. This is not a product power estimate.`),
      reading('Recorded energy',`${(s.total.energy*1e6).toFixed(3)} μJ`,`${(s.time*1000).toFixed(2)} of 200.00 ms, played 100 times slower. This integrates emitter supply and the fixed electronics load. Gate-charging and switching losses are excluded.`),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return render(controller.getState().values);};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Write the OLED picture',description:'Twelve frames of the nine-pixel circuit, shown 100 times slower.',stepLabel:'Advance one frame',advance:result.advance,step:()=>result.advance(OLED.frame*OLED.slow),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: connected OLED display','system'],['Inspect: stored signal and current','circuit-detail'],['Inspect: charges becoming light','carriers-detail'],['Inspect: picture and energy','energy-detail']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'system',label:'Inspect the complete OLED display',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.57;result.selectionOutline=false;result.transparentBackground=true;result.viewDirections={front:[.55,.30,6]};
  const details=['circuit-detail','carriers-detail','energy-detail'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:[.55,.30,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)?.47:.57;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.60,-2.40,-.25),new THREE.Vector3(2.60,2.34,.65)).applyMatrix4(kit.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[geometry.circuit,geometry.carriers,geometry.energy,geometry.guides];
  result.catalogParts=result.parts.filter(p=>!['system','housing','panel-stack','electronics','emissive-layer'].includes(p.id));
  result.topology=geometry;result.physicalPlan=controller.getPlan;result.duration=OLED_PLAYBACK_DURATION;result.physicalDuration=OLED_DURATION;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
