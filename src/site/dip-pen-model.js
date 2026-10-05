import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {surface} from './scene-kit.js';
import {fixed} from './format.js';
import {DIP_WRITE as W, DIP_WRITE_DEFAULTS, DIP_WRITE_DOMAINS, DIP_LOAD_OPTIONS, dipWritingPlan, dipWritingAt, dipGap} from './dip-pen-physics.js';

export const MM = .01;
export const DETAIL = 40;
export const TIP_WINDOW = 1.5;
export const HOLDER = Object.freeze({radius: 4, socketFrom: 22, socketTo: 31, top: 90});
export const WELL = Object.freeze({inner: 11.5, outer: 12, floor: -20, innerFloor: -19.5, rim: 8});
export const PAPER = Object.freeze({x0: 40, x1: 80, z0: -10, z1: 55, thick: .2});
export const INK_COLOR = 0x2b5d9c;
export const outerTine = (force, s) => W.hairline / 2 + (W.nibWidth - W.hairline) / 2 * s / 20 + W.compliance * force / 2 * Math.max(0, 1 - s / W.slit);

/** One connected sheet, including both tines and the vent that ends the slit. */
export function nibOutline(force) {
  const shape = new THREE.Shape(), outer = y => outerTine(force, y), inner = y => dipGap(force, y) / 2;
  shape.moveTo(-outer(0), 0); shape.lineTo(-outer(W.slit), W.slit); shape.lineTo(-3.5, 20); shape.lineTo(-3.5, 30);
  shape.lineTo(3.5, 30); shape.lineTo(3.5, 20); shape.lineTo(outer(W.slit), W.slit); shape.lineTo(outer(0), 0);
  shape.lineTo(inner(0), 0); shape.lineTo(W.gap / 2, W.slit);
  const a = Math.asin(W.gap / (2 * W.ventRadius));
  shape.absarc(0, W.ventAt, W.ventRadius, -Math.PI / 2 + a, Math.PI * 1.5 - a, false);
  shape.lineTo(-W.gap / 2, W.slit); shape.lineTo(-inner(0), 0); shape.closePath();
  return shape;
}
const polygon = points => {const s = new THREE.Shape(); points.forEach(([x,y],i) => i ? s.lineTo(x,y) : s.moveTo(x,y)); s.closePath(); return s;};
const steelGeometry = shape => {const g = new THREE.ExtrudeGeometry(shape, {depth: W.thickness, bevelEnabled: false, curveSegments: 32}); g.translate(0, 0, -W.thickness / 2); g.scale(MM, MM, MM); return g;};

export function createDipPenModel() {
  const kit = houseModel('Dip pen'), {part, control, finish} = kit;
  const box = (parent, color = 'cream') => surface(kit, new THREE.BoxGeometry(1,1,1), color, parent);
  const setBox = (mesh, x0, x1, y0, y1, z0, z1) => {mesh.position.set((x0+x1)*MM/2,(y0+y1)*MM/2,(z0+z1)*MM/2);mesh.scale.set((x1-x0)*MM,(y1-y0)*MM,(z1-z0)*MM);};
  const cylinder = (parent, radius, y0, y1, color) => {const mesh=surface(kit,new THREE.CylinderGeometry(radius*MM,radius*MM,(y1-y0)*MM,48),color,parent);mesh.position.y=(y0+y1)*MM/2;return mesh;};
  const system = part('system', 'Dip pen, inkwell and paper', 'Follow a chosen ink load from the inkwell to a 40 mm stroke. The holder supports a connected steel nib. Writing force spreads its tines; retained ink decreases by exactly the volume deposited. Loading and motion are illustrative, not measured wetting rates.', [0,0,0]);
  const well = part('well', 'Inkwell', 'The nib dips below the ink surface; the holder stays clear. Look inside removes the front half of the well and liquid. The dry experiment keeps the tip above the ink. The reservoir level is treated as constant during this tiny transfer.', [0,0,0], system);
  const profile = [[0,WELL.floor],[WELL.outer,WELL.floor],[WELL.outer,WELL.rim],[WELL.inner,WELL.rim],[WELL.inner,WELL.innerFloor],[0,WELL.innerFloor],[0,WELL.floor]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  const wellBack = surface(kit,new THREE.LatheGeometry(profile,48,Math.PI/2,Math.PI),'metal',well,true);
  const wellFront = surface(kit,new THREE.LatheGeometry(profile,48,-Math.PI/2,Math.PI),'metal',well,true);
  const liquidProfile = [[WELL.inner-.02,WELL.innerFloor],[WELL.inner-.02,0],[0,0]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  const liquidBack = surface(kit,new THREE.LatheGeometry(liquidProfile,48,Math.PI/2,Math.PI),'blue',well);
  const liquidFront = surface(kit,new THREE.LatheGeometry(liquidProfile,48,-Math.PI/2,Math.PI),'blue',well);
  const inkMaterial = liquidBack.material.clone(); inkMaterial.color.set(INK_COLOR); inkMaterial.side=THREE.DoubleSide;
  liquidBack.material=inkMaterial;liquidFront.material=inkMaterial;
  const paper = part('paper', 'Paper and written stroke', 'The line begins only when the loaded tip moves on the paper. Assigned width equals the span of the two tips; assigned wet-film thickness is 10 μm. Ink left in the nib plus ink on paper stays equal to the chosen load. Blotting and absorption are outside this line-only example.', [0,0,0],system);
  const sheet=box(paper);setBox(sheet,PAPER.x0,PAPER.x1,-PAPER.thick,0,PAPER.z0,PAPER.z1);
  const line=box(paper,'blue');line.material=inkMaterial;

  const carriage=new THREE.Group();system.add(carriage);carriage.rotation.x=W.tilt;
  const holder=part('holder','Wooden holder and nib socket','The steel shank slides into a narrow socket. Its rectangular opening matches the flat teaching nib; the surrounding holder supports the shank. The pen has no internal ink reservoir.',[0,0,0],carriage);
  const socketShape=new THREE.Shape();socketShape.absarc(0,0,HOLDER.radius,0,Math.PI*2,false);
  const hole=polygon([[-3.5,-W.thickness/2],[-3.5,W.thickness/2],[3.5,W.thickness/2],[3.5,-W.thickness/2]]);socketShape.holes.push(hole);
  const socketGeometry=new THREE.ExtrudeGeometry(socketShape,{depth:HOLDER.socketTo-HOLDER.socketFrom,bevelEnabled:false,curveSegments:40});socketGeometry.scale(MM,MM,MM);
  const socket=surface(kit,socketGeometry,'wood',holder);socket.rotation.x=Math.PI/2;socket.position.y=HOLDER.socketTo*MM;
  const handle=cylinder(holder,HOLDER.radius,HOLDER.socketTo,HOLDER.top,'wood');
  const nib=part('nib','Steel nib and flexing tines','One connected 0.25 mm steel sheet carries two tines. A 9 mm narrow slit reaches the lower edge of a 2 mm vent centered 10 mm above the tip. Extra force spreads both tines; the assigned compliance is 0.1 mm per newton. This flat teaching nib omits real shell curvature and elastic stress.',[0,0,0],carriage);
  const plate=surface(kit,new THREE.BufferGeometry(),'metal',nib,true);
  const retained=part('retained','Ink retained in the slit','The blue volume remains connected to the tip. As the tines spread, the same volume fills less length of the wider slot. Writing consumes it; the tip leaves dry travel once it is gone. A real nib can also hold ink on its underside and around the vent.',[0,0,0],nib);
  const slotInk=surface(kit,new THREE.BufferGeometry(),'blue',retained);slotInk.material=inkMaterial;

  const detail=part('detail','Writing tip, enlarged','A 40× view of the last 1.5 mm of the same tines and retained ink. The paper appears once the pen touches it. Its short trail shows whether the moving tip still supplies ink. All force, gap and ink-volume states match the complete pen.',[1.7,.5,0],system);
  detail.scale.setScalar(DETAIL);
  const detailPen=new THREE.Group();detail.add(detailPen);detailPen.rotation.x=W.tilt;
  detailPen.position.set(0,W.thickness/2*Math.sin(W.tilt)*MM,-W.thickness/2*Math.cos(W.tilt)*MM);
  const detailTines=[0,1].map(()=>surface(kit,new THREE.BufferGeometry(),'metal',detailPen,true));
  const detailInk=surface(kit,new THREE.BufferGeometry(),'blue',detailPen);detailInk.material=inkMaterial;
  const detailPaper=box(detail);setBox(detailPaper,-.75,.75,-.15,0,-1.5,1);
  const detailLine=box(detail,'blue');detailLine.material=inkMaterial;

  control('press','Extra writing force',...DIP_WRITE_DOMAINS.press,DIP_WRITE_DEFAULTS.press,'N','Extra force beyond light contact. Assigned flex widens the tine span and the deposited line.');
  control('load','Retained ink load',...DIP_WRITE_DOMAINS.load,DIP_WRITE_DEFAULTS.load,'','Choose an assigned load, or skip dipping to compare a dry nib. Loading time is illustrative.',DIP_LOAD_OPTIONS.map(x=>({...x})));
  let clock=0,lastClock=0,disposed=false,lastForce=null,lastInkKey='';
  const result=finish(values=>{
    const plan=dipWritingPlan(values),now=dipWritingAt(plan,clock);
    carriage.position.set(now.x*MM,(now.height+W.thickness/2*Math.sin(W.tilt))*MM,(now.z-W.thickness/2*Math.cos(W.tilt))*MM);
    if(now.force!==lastForce){
      plate.geometry.dispose();plate.geometry=steelGeometry(nibOutline(now.force));
      detailTines.forEach((mesh,i)=>{const side=i?1:-1;mesh.geometry.dispose();mesh.geometry=steelGeometry(polygon([[side*dipGap(now.force,0)/2,0],[side*outerTine(now.force,0),0],[side*outerTine(now.force,TIP_WINDOW),TIP_WINDOW],[side*dipGap(now.force,TIP_WINDOW)/2,TIP_WINDOW]]));});
      lastForce=now.force;
    }
    const inkKey=now.force+':'+now.inkLength;
    if(inkKey!==lastInkKey){
      for(const [mesh,length] of [[slotInk,now.inkLength],[detailInk,Math.min(TIP_WINDOW,now.inkLength)]]){
        const L=Math.max(1e-8,length),bottom=dipGap(now.force,0)/2,top=dipGap(now.force,L)/2;
        mesh.geometry.dispose();mesh.geometry=steelGeometry(polygon([[-bottom,0],[bottom,0],[top,L],[-top,L]]));mesh.visible=length>1e-10;
      }
      lastInkKey=inkKey;
    }
    setBox(line,W.paperX-plan.lineWidth/2,W.paperX+plan.lineWidth/2,0,W.film,0,Math.max(1e-8,now.inked));line.visible=now.inked>0;
    retained.visible=now.remaining>1e-12;
    detailPaper.visible=now.touching;
    const trailStart=Math.max(-1.5,-now.travel),trailEnd=Math.min(0,now.inked-now.travel);
    setBox(detailLine,-plan.lineWidth/2,plan.lineWidth/2,0,W.film,trailStart,Math.max(trailStart+1e-8,trailEnd));detailLine.visible=now.touching&&trailEnd>trailStart&&now.inked>0;
    const phaseText={loading:'Loading the chosen amount', 'dry-start':'Dry nib held above the ink', lifting:'Lifting clear of the inkwell', 'moving-to-paper':'Moving to the paper', lowering:'Lowering the nib', 'applying-force':'Applying extra writing force', 'light-contact':'Light contact: ready to write', writing:now.exhausted?'Moving dry: retained ink exhausted':'Writing', complete:now.inked===W.stroke?'Complete: full stroke written':'Complete: part or all of the travel is dry'};
    return {state:{...plan,now,clock},readings:[
      r('Your result',clock===0?'Ready · press Play to follow the pen':phaseText[now.phase]),
      r('Ink on paper',`${fixed(now.inked,2)} mm of a 40 mm stroke`,`Tip travel: ${fixed(now.travel,2)} mm. The selected load can supply ${fixed(plan.inkedLength,2)} mm at the assigned width and wet-film thickness.`),
      r('Ink balance',`${fixed(now.remaining,4)} μL retained · ${fixed(now.deposited,4)} μL deposited`,`Loaded so far: ${fixed(now.loaded,4)} μL. One cubic millimeter is one microliter. The two visible ink volumes sum to the loaded amount; none is created when the slot opens.`),
      r('Writing width',`${fixed(plan.lineWidth,2)} mm`,`Selected extra force: ${fixed(values.press,1)} N. Current extra force: ${fixed(now.force,2)} N. The actual and enlarged tines share the same assigned 0.1 mm/N flex. Width is their tip span, not a measured commercial line-width prediction.`),
      r('Current slit opening',`${fixed(dipGap(now.force,0),3)} mm at the tip`,`The slit returns to 0.020 mm at its root. Remaining ink reaches ${fixed(now.inkLength,3)} mm up the tapered slot. Its volume includes the actual varying gap.`),
      r('Capillary comparison',`${fixed(plan.capillaryPressure/1000,2)} kPa at the selected tip gap`,`Ideal fully wetting parallel faces give 2γ/g with assigned water-like surface tension. Gravity contributes about ${fixed(plan.gravityHead,1)} Pa along a 9 mm slit tilted 45°. These local comparisons do not calculate net flow or prove that a real nib cannot leak.`),
    ]};
  });
  const render=result.update;
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)clock=Math.min(W.duration,Number((clock+dt).toFixed(12)));return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  result.reset=(initial={})=>{clock=Number.isFinite(initial.time)?Math.max(0,Math.min(W.duration,initial.time)):0;lastClock=0;return render({...result.defaults,...(initial.settings||{})});};
  result.replayState=()=>({settings:result.getState().values,time:0});
  result.actions=[['Inspect: complete pen','system'],['Inspect: holder and socket','holder'],['Inspect: steel nib and ink','nib'],['Inspect: enlarged writing tip','detail'],['Inspect: inkwell','well'],['Inspect: written stroke','paper']].map(([label,part])=>({label,part,view:part==='paper'?'top':'front',isolate:true,replay:false,run:()=>render()}));
  result.playback={label:'Dip and write',description:'Load, lift, move to the page, apply force and write a 40 mm stroke. The motion and loading schedule are assigned teaching timings.',stepLabel:'Advance 0.1 s',advance:result.advance,step:()=>result.advance(.1),complete:()=>clock>=W.duration,blocked:()=>false};
  result.resultPart={id:'paper',label:'Inspect the written stroke',view:'top',focusOnComplete:false,available:()=>clock>=W.duration};
  result.covers.push(wellFront,liquidFront);result.initialCutaway=true;
  detail.userData.inspectionOnly='detail';
  for(const o of [well,paper,detail])o.userData.explosionExcluded=true;
  for(const o of [holder,nib])o.userData.explosionCategory=true;
  nib.userData.explosionRigid=true;
  result.thumbnailOmit=[well,paper,detail];result.followParts=['holder','nib','retained'];
  result.catalogParts=result.parts.filter(p=>p.id!=='system');
  result.parts.find(p=>p.id==='well').framePadding=.85;
  result.controls.find(c=>c.key==='load').primary=true;
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:[1.4,1.9,3]}]));
  result.partViewDirections.nib.front=[0,1,3];result.partViewDirections.retained.front=[0,1,3];result.partViewDirections.detail.front=[0,1.7,3];
  for(const p of result.parts)if(['nib','retained','detail'].includes(p.id))p.maxZoom=250;
  result.frameBoundsForPart = id => {
    if (id === 'detail') return new THREE.Box3().setFromObject(detail);
    if (id === 'system') return new THREE.Box3(new THREE.Vector3(-.125, -.205, -.125), new THREE.Vector3(.805, .93, 1.08)).applyMatrix4(kit.root.matrixWorld);
    return null;
  };
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.62;result.selectionOutline=false;result.transparentBackground=true;
  result.topology={system,well,wellBack,wellFront,liquidBack,liquidFront,inkMaterial,paper,sheet,line,carriage,holder,socket,handle,nib,plate,retained,slotInk,detail,detailPen,detailTines,detailInk,detailPaper,detailLine};
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
