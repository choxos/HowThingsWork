import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {TFT,TFT_DEFAULTS as D,TFT_DOMAINS,TFT_DURATION,TFT_FRAME,createTftScreenController,tftControlEnabled} from './tft-screen-physics.js';
import {createTftScreenGeometry,updateTftScreenGeometry} from './tft-screen-geometry.js';

export function createTftScreenModel(){
  const kit=houseModel('LCD screen'),geometry=createTftScreenGeometry(kit),controller=createTftScreenController();
  const names={pattern:'Picture pattern',red:'Red target code',green:'Green target code',blue:'Blue target code',background:'Patch background',gap:'Liquid-crystal gap',backlight:'Backlight level',addressing:'Row addressing'};
  const options={pattern:['Center patch','Solid color','RGB bands','Checkerboard'],background:['Black','White'],addressing:['Write every frame','Write once, then hold','Disable gate pulses']};
  const hints={pattern:'Choose a picture to write from a prepared black screen. Every settings change starts a new record. Inspections preserve the current record.',red:'8-bit sRGB code. Code 128 represents about 21.6% linear light above the modeled black floor; code 188 is about half.',green:'8-bit sRGB code, not a light percentage. The source driver chooses a calibrated voltage for this assigned optical cell.',blue:'8-bit sRGB code. All three subpixels in a pixel have separate data voltages but share the row gate pulse.',background:'Only the center-patch pattern has a separate background. Its pixels are written using the same row timing.',gap:'Assigned physical gap. A thicker cell can respond more slowly; optics and target voltages also change. Drawn layer thickness is enlarged and does not set physical dimensions.',backlight:'Normalized white-LED illumination. Pixel voltage and liquid-crystal orientation do not change when the backlight level changes.',addressing:'Every-frame mode reverses voltage polarity each frame. The one-frame experiment holds voltage ideally afterward. Disabled gates leave the initial −5 V black charge unwritten. Leakage and long-term DC damage are outside this short model.'};
  for(const key of Object.keys(D))kit.control(key,names[key],...TFT_DOMAINS[key],D[key],key==='gap'?'μm':key==='backlight'?'%':'',hints[key],options[key]?.map((label,value)=>({label,value})),{primary:key==='pattern',visibleWhen:values=>tftControlEnabled(key,values)});
  const result=kit.finish(()=>{
    const s=controller.getState(),c=s.center,plan=controller.getPlan();updateTftScreenGeometry(geometry,s,plan);
    const phase=!s.values.backlight?'Backlight off':s.values.addressing===2?'Target has not been written':s.done?'Record complete':c.writes?'Liquid crystal responding':'Waiting for the center row';
    return {state:{...s,time:s.clock,physicalTime:s.time,complete:s.done,blocked:false,phase},readings:[
      reading('Your result',phase,!s.values.backlight?'No illumination reaches the viewer, even when pixel voltage has been written.':s.values.addressing===2?'Gate pulses are disabled. The prepared black voltage remains stored; changing target data alone cannot write the screen.':s.done?'The 199.5 ms record has finished. A liquid-crystal transient can still be approaching equilibrium.':'Gate pulses write a row in parallel. The stored voltage continues controlling light after the gate closes.'),
      reading('Physical record',`${(s.time*1000).toFixed(2)} of 199.50 ms`,'Twelve frames shown 100 times slower. The target is constant throughout a record. Changing a setting restarts from prepared black.'),
      reading('Row scan',s.scanRow===null?'No row selected':`Row ${s.scanRow+1} of 272`,`${s.frameRate.toFixed(2)} frames/s; ${(s.line*1e6).toFixed(2)} μs per line. The assigned matrix is 480 × 272 pixels with 525 clocks per line, 285 lines per frame and a 9 MHz clock.`),
      reading('Center pixel data',c.codes.join(' / '),'Red, green and blue 8-bit sRGB codes. Bands and checkerboard can give the center pixel a different target from nearby pixels.'),
      reading('Center held voltage',c.held.map(v=>`${v.toFixed(3)} V`).join(' / '),`${c.writes} writes. Voltages are measured relative to the common electrode. The ideal storage model holds voltage between writes; frame inversion changes sign, not the target magnitude.`),
      reading('Center RGB light',c.illuminated.map(v=>`${(v*100).toFixed(2)}%`).join(' / '),'Linear light normalized to each channel’s assigned steady white at full backlight. Finite black leakage remains. The screen uses sRGB encoding to display these intensities.'),
      reading('Steady RGB target',s.targetLight.map(v=>`${(v*100*s.backlight).toFixed(2)}%`).join(' / '),'This is the optical equilibrium target, not a claim that the cell has already reached it.'),
      reading('Backlight',`${s.values.backlight}%`,'An independent light source behind the liquid-crystal shutter. No electrical-power or commercial-panel efficiency claim is made.'),
      reading('Liquid-crystal gap',`${s.values.gap.toFixed(1)} μm`,'The director calculation uses 80 layers, strong surface anchoring, a 90-degree twist and a 2-degree pretilt. Material constants come from a declared Merck example; this is not a fitted commercial screen.'),
    ]};
  });
  const render=result.update;let lastTime=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);lastTime=0;return render(controller.getState().values);};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastTime):0;if(Number.isFinite(time))lastTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Write the LCD picture',description:'Twelve physical frames shown 100 times slower. Inspection preserves time and settings.',stepLabel:'Advance one frame',advance:result.advance,step:()=>result.advance(TFT_FRAME*TFT.slow),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: connected screen','system'],['Inspect: polarization and liquid crystal','optics-detail'],['Inspect: row selection and storage','matrix-detail'],['Inspect: RGB apertures','rgb-detail'],['Inspect: response and polarity','response-detail']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'system',label:'Inspect the complete screen',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.63;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[1.25,.6,6]};
  const detailIds=['optics-detail','matrix-detail','rgb-detail','response-detail'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:p.id==='optics-detail'?[1.8,.65,4]:detailIds.includes(p.id)?[0,0,4]:[1.25,.6,6]}]));
  for(const part of result.parts)part.framePadding=detailIds.includes(part.id)?.59:.63;
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-2.51,-1.96,-.45),new THREE.Vector3(2.51,1.96,.55)).applyMatrix4(kit.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[geometry.optics,geometry.matrix,geometry.rgb,geometry.response,geometry.guides];result.catalogParts=result.parts.filter(p=>!['system','enclosure','backlight','cell','electronics'].includes(p.id));
  result.topology=geometry;result.physicalPlan=controller.getPlan;result.duration=TFT_DURATION;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
