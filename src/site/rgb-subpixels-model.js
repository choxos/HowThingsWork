import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {TFT,TFT_DURATION,TFT_FRAME} from './tft-screen-physics.js';
import {RGB_DEFAULTS as D,RGB_DOMAINS,createRgbSubpixelsController} from './rgb-subpixels-physics.js';
import {createRgbSubpixelsGeometry,updateRgbSubpixelsGeometry} from './rgb-subpixels-geometry.js';

export function createRgbSubpixelsModel(){
  const kit=houseModel('RGB subpixels'),geometry=createRgbSubpixelsGeometry(kit),controller=createRgbSubpixelsController();
  const names={red:'Red target code',green:'Green target code',blue:'Blue target code',gap:'Liquid-crystal gap',backlight:'Backlight level',addressing:'Row addressing'};
  const hints={red:'An 8-bit sRGB code. A value of 128 asks for about 21.6% of the channel’s white-minus-black light range, not half.',green:'The green channel has its own voltage target. Equal linear fractions of red, green and blue do not contribute equal luminance.',blue:'The blue filtered aperture shares the row pulse but has a separate voltage. Code zero still leaves finite LCD black leakage when illuminated.',gap:'Assigned TN cell gap. Changing it alters optical retardation, the voltage needed for a target, and the response time; the main construction is enlarged.',backlight:'Normalized illumination common to all three apertures. Dimming scales light but leaves pixel voltages and molecular orientation unchanged.',addressing:'Every-frame writing reverses polarity. One-frame writing retains voltage ideally. Disabled gates keep the prepared −5 V black state. Any settings change starts a new record.'};
  for(const key of Object.keys(D))kit.control(key,names[key],...RGB_DOMAINS[key],D[key],key==='gap'?'μm':key==='backlight'?'%':'',hints[key],key==='addressing'?['Write every frame','Write once, then hold','Disable gate pulses'].map((label,value)=>({label,value})):undefined);
  const result=kit.finish(()=>{
    const s=controller.getState(),c=s.center;updateRgbSubpixelsGeometry(geometry,s);
    const phase=!s.values.backlight?'No light to combine':s.values.addressing===2?'The new color has not been written':s.done?'Color record complete':c.writes?'Three shutters are responding':'Waiting to write the pixel';
    return {state:{...s,time:s.clock,physicalTime:s.time,complete:s.done,blocked:false,phase},readings:[
      reading('Your result',phase,!s.values.backlight?'The pixel circuit can still work, but no illumination leaves the three apertures.':s.values.addressing===2?'Target codes alone cannot change the stored pixel voltage. With every gate disabled, the prepared black state remains.':'The enlarged stripes remain separate physical apertures. The swatch shows their combined color under an ideal sRGB colorimetric model.'),
      reading('Requested codes',c.codes.join(' / '),'Red, green and blue encoded values, each from 0 to 255. Every chosen trial starts from the same prepared black state unless its description specifies a write pulse.'),
      reading('Requested linear range',s.targetLinear.map(v=>`${(100*v).toFixed(2)}%`).join(' / '),'Decoded sRGB fractions of each channel’s white-minus-black range. These are requested targets; actual light also includes finite black leakage and transient response.'),
      reading('Current RGB light',c.illuminated.map(v=>`${(100*v).toFixed(2)}%`).join(' / '),'Linear light relative to each channel’s assigned steady white at full backlight. Actual aperture materials and the mixed swatch use these values.'),
      reading('Relative luminance',`${(100*s.color.luminance).toFixed(2)}% of assigned white`,'The CIE Y value is a weighted sum of linear channels: approximately 21.26% red, 71.52% green and 7.22% blue. This is relative luminance, not measured cd/m² or subjective brightness.'),
      reading('Current chromaticity',s.color.xy?`x ${s.color.xy[0].toFixed(4)}, y ${s.color.xy[1].toFixed(4)}`:'Undefined: no light','X, Y and Z add first; x = X/(X+Y+Z), y = Y/(X+Y+Z). Chromaticity omits light level. The triangle represents assigned sRGB primaries, not the full human color range.'),
      reading('Held RGB voltages',c.held.map(v=>`${v.toFixed(3)} V`).join(' / '),`${c.writes} row writes. All three transistors select together. The ideal storage model retains voltage between writes; equal positive and negative magnitudes have the same optical target.`),
      reading('Steady RGB light',s.targetLight.map(v=>`${(100*v*s.backlight).toFixed(2)}%`).join(' / '),'The equilibrium target under the chosen backlight. Finishing this short record need not mean that all channels have reached it.'),
      reading('Physical record',`${(1000*s.time).toFixed(2)} of 199.50 ms`,'The same 480 × 272 assigned LCD timing as the parent screen: 9 MHz clock, 525 clocks per line and 285 lines per frame. This center-row pixel is shown 100 times slower.'),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return render(controller.getState().values);};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Write the RGB pixel',description:'One center-row pixel followed over twelve frames, shown 100 times slower.',stepLabel:'Advance one frame',advance:result.advance,step:()=>result.advance(TFT_FRAME*TFT.slow),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: connected RGB pixel','system'],['Inspect: three optical paths','optics-detail'],['Inspect: codes and linear light','encoding-detail'],['Inspect: additive color and gamut','color-detail']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'system',label:'Inspect the complete pixel',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.63;result.selectionOutline=false;result.transparentBackground=true;result.viewDirections={front:[.9,.4,6]};
  const details=['optics-detail','encoding-detail','color-detail'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:p.id==='optics-detail'?[1,.55,4.5]:details.includes(p.id)?[0,0,4]:[.9,.4,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)?.60:.63;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.55,-2.23,-.65),new THREE.Vector3(2.55,2.21,.65)).applyMatrix4(kit.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[geometry.optics,geometry.encoding,geometry.color,geometry.guides];result.catalogParts=result.parts.filter(p=>!['system','support','optical-stack','electronics'].includes(p.id));
  result.topology=geometry;result.physicalPlan=controller.getPlan;result.duration=TFT_DURATION;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
