import * as THREE from 'three';
import {surface, solidArrow} from './scene-kit.js';
import {GEARS, RATIOS, TOY} from './friction-drive-toy-physics.js';

export const MM = 0.02;
export const MODULE = 0.5;
export const PRESSURE_ANGLE = Math.PI / 6;
export const AXLE = Object.freeze({rear: -35, front: 35, height: 15, track: 29});
export const LAYOUT = Object.freeze({first: Math.PI / 3, second: 0, frontZ: 0, backZ: -4.5, flywheelZ: 4, thickness: 3});
export const FLOOR = Object.freeze({half: 125, spacing: 50, width: 100, mark: 500});
export const FLOOR_COLORS = Object.freeze([0xd9d4c7, 0xb98b5a, 0x7f8f6a]);
const TAU = 2 * Math.PI, point = p => p.map(v => v * MM);
export const pitchRadius = teeth => teeth * MODULE / 2;

export function shafts(ratio) {
  const [[a, b], [c, d]] = GEARS[ratio], axle = [AXLE.rear, AXLE.height];
  const d1 = pitchRadius(a + b), d2 = pitchRadius(c + d);
  const middle = [axle[0] + d1 * Math.cos(LAYOUT.first), axle[1] + d1 * Math.sin(LAYOUT.first)];
  return {axle, middle, flywheel: [middle[0] + d2, middle[1]], d1, d2};
}
export function trainAngles(ratio, wheel) {
  const [[a, b], [c, d]] = GEARS[ratio], phase = LAYOUT.first + Math.PI - Math.PI / b;
  return {axleGear: wheel + LAYOUT.first, pinion: -a / b * wheel + phase, second: -a / b * wheel, flywheel: a / b * c / d * wheel + Math.PI - Math.PI / d};
}
export function contactRatio(a, b) {
  const radii = [a, b].map(pitchRadius), basePitch = Math.PI * MODULE * Math.cos(PRESSURE_ANGLE);
  return (radii.reduce((sum, r) => sum + Math.sqrt((r + MODULE) ** 2 - (r * Math.cos(PRESSURE_ANGLE)) ** 2), 0) - (radii[0] + radii[1]) * Math.sin(PRESSURE_ANGLE)) / basePitch;
}

/** Involute flanks with small backlash and radial root clearance; dimensions in mm. */
export function toothOutline(teeth) {
  const r = pitchRadius(teeth), base = r * Math.cos(PRESSURE_ANGLE), tip = r + MODULE, root = r - 1.25 * MODULE;
  const inv = radius => {const a = Math.acos(Math.min(1, base / radius)); return Math.tan(a) - a;};
  const half = Math.PI / (2 * teeth) - 0.004 / r, reference = inv(r), outline = [];
  const put = (radius, angle) => outline.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  for (let tooth = 0; tooth < teeth; tooth++) {
    const center = tooth * TAU / teeth, start = Math.max(root, base), halfRoot = half + reference - inv(start);
    put(root, center - TAU / (2 * teeth)); put(root, center - halfRoot);
    for (let i = 0; i <= 18; i++) {const radius = start + (tip - start) * i / 18; put(radius, center - half - reference + inv(radius));}
    const halfTip = half + reference - inv(tip);
    for (let i = 1; i <= 6; i++) put(tip, center - halfTip + 2 * halfTip * i / 6);
    for (let i = 17; i >= 0; i--) {const radius = start + (tip - start) * i / 18; put(radius, center + half + reference - inv(radius));}
    put(root, center + halfRoot);
  }
  return outline;
}
function extrusion(outline, depth, holes = []) {
  const shape = new THREE.Shape(); outline.forEach(([x, y], i) => shape[i ? 'lineTo' : 'moveTo'](x * MM, y * MM)); shape.closePath();
  for (const [x, y, r] of holes) {const hole = new THREE.Path(); hole.absarc(x * MM, y * MM, r * MM, 0, TAU, true); shape.holes.push(hole);}
  return new THREE.ExtrudeGeometry(shape, {depth: depth * MM, bevelEnabled: false, curveSegments: 48});
}
export function toyGeometry(kit, system) {
  const {part, covers} = kit, box = (size, p, color, parent) => kit.box(point(size), point(p), color, parent);
  const rod = (a, b, r, color, parent) => kit.rod(point(a), point(b), r * MM, color, parent);
  const disk = (r, h, p, color, parent) => kit.disk(r * MM, h * MM, point(p), color, parent);
  const ring = (inner, outer, h, p, color, parent) => {
    const outline = Array.from({length:64}, (_, i) => [outer * Math.cos(i * TAU / 64), outer * Math.sin(i * TAU / 64)]);
    const mesh = surface(kit, extrusion(outline, h, [[0, 0, inner]]), color, parent); mesh.position.set(...point(p)); return mesh;
  };
  const experiment = part('experiment', 'Toy, hand and floor', 'Push, carry back, release and coast. The view follows the toy while floor markings slide underneath.', [0, 0, 0], system);
  const machine = part('machine', 'Flywheel toy car', 'A hollow toy body supports two axles and a two-stage parallel-shaft gear train.', [0, 0, 0], experiment);
  const category = (id, name, description) => {const g = part(id, name, description, [0,0,0], machine); g.userData.explosionCategory = true; return g;};
  const structure = category('structure', 'Body and chassis', 'A hollow shell and fixed chassis carry the bearing mounts.');
  const chassis = part('chassis', 'Chassis rails and crossmembers', 'Rails connect the axle mounts and gearbox feet; bumpers close their ends.', [0,0,0], structure);
  for (const z of [-21, 21]) box([116,3,4], [0,9.5,z], 'wood', chassis);
  for (const x of [-56, 0, 56]) box([4,3,44], [x,9.5,0], 'wood', chassis);
  for (const x of [-59,59]) box([2,7,50], [x,12,0], 'metal', chassis);
  const shell = part('shell', 'Hollow body and wheel arches', 'Thin side panels leave real openings for the wheels. Look inside removes the near side and rear hood, leaving the far side and front body for context.', [0,0,0], structure);
  const outline = [[-60,8]], alpha = Math.asin(7 / 16);
  for (const x of [-35,35]) for (let i=0;i<=40;i++) {const a=Math.PI+alpha-(Math.PI+2*alpha)*i/40;outline.push([x+16*Math.cos(a),15+16*Math.sin(a)]);}
  outline.push([60,8],[60,44],[-60,44]);
  const bodyPanels = [];
  for (const z of [-25,23.5]) {const mesh=surface(kit,extrusion(outline,1.5),'clay',shell);mesh.position.z=z*MM;if(z>0)covers.push(mesh);bodyPanels.push(mesh);}
  for(const x of [-59,59]) box([2,28,47],[x,30,0],'clay',shell);
  const hoodPanels=[box([34,2,47],[42,44,0],'clay',shell),box([34,2,47],[-42,44,0],'clay',shell)];covers.push(hoodPanels[1]);
  const cabin = part('cabin', 'Roof, pillars and windows', 'The supported roof gives the hand a real contact surface; clear windows keep the toy recognizable.', [0,0,0],structure);
  const roof=box([50,2,44],[-5,54,0],'clay',cabin);
  for(const z of [-21,21]) for(const side of [-1,1]) rod([side*24-5,44,z],[side*20-5,53,z],1.4,'clay',cabin);
  for(const z of [-21.5,21.5]) {
    const glass=box([42,8,0.5],[-5,49,z],'blue',cabin);glass.material=glass.material.clone();
    Object.assign(glass.material,{transparent:true,opacity:.2,depthWrite:false});covers.push(glass);
  }
  for(const x of [-60,60])for(const z of [-16,16])box([1,4,7],[x,35,z],x>0?'gold':'red',shell);

  const running = category('running-gear','Wheels and axles','Rear wheels drive the flywheel. Front wheels roll independently, including during a rear-wheel skid.');
  const rearAxle=part('rear-axle','Driven rear axle','One continuous axle connects the rear tires to the large input gear.',[0,0,0],running);
  const frontAxle=part('front-axle','Free front axle','This axle has no connection to the flywheel train.',[0,0,0],running);
  const wheelBearings=part('wheel-bearings','Axle bearings and mounts','Four bored mounts carry the two axles on the chassis rails.',[0,0,0],running);
  const wheels=[],axles=[];
  for(const [index,x] of [-35,35].entries()){
    const group=index?frontAxle:rearAxle;axles.push(rod([x,15,-29],[x,15,29],1.5,'metal',group));
    for(const side of [-1,1]){
      const p=part((index?'front':'rear')+'-wheel-'+(side<0?'far':'near'),(index?'Front':'Rear')+' tire and hub '+(side<0?'far':'near'),'A 30 mm tire fixed to its axle; the light spoke reveals rotation.',[x*MM,15*MM,side*29*MM],group);
      const tire=disk(15,8,[0,0,0],'ink',p);disk(7,8.6,[0,0,0],'gold',p);box([2,12,9],[0,6,0],'cream',p);
      wheels.push({group:p,tire,front:index===1});ring(1.5,2.4,1,[x,15,side<0?-24.5:23.5],'gold',group);
      ring(1.6,3.8,4,[x,15,side<0?-23:19],'metal',wheelBearings);
      box([7,4,4],[x,10.5,side*21],'wood',wheelBearings);
    }
  }
  const transmission=category('transmission','Supported gear train','Two external spur meshes increase speed. Their power flow reverses after release.');
  const gearbox=part('gearbox','Gearbox plates and mounting feet','Bored plates hold the shafts at the required gear-center distances.',[0,0,0],transmission);
  const inputGear=part('input-gear','Rear-axle drive gear','This large gear is fixed to the driven axle.',[0,0,0],transmission);
  const compound=part('compound','Compound gear and pinion','The first pinion and second large gear rotate together on a fixed middle pin.',[0,0,0],transmission);
  const middlePin=part('middle-pin','Fixed middle pin','A fixed pin supported at both ends carries the compound gear.',[0,0,0],transmission);
  const finalPinion=part('flywheel-pinion','Flywheel pinion','The second mesh drives this small pinion, fixed to the flywheel shaft.',[0,0,0],transmission);
  const storage=category('storage','Flywheel and bearings','The metal disk stores rotational energy and returns it through the same gear train.');
  const flywheelPart=part('flywheel','Steel flywheel','A 20 mm solid steel disk, 4 mm thick. The assigned inertia follows its dimensions and density.',[0,0,0],storage);
  const shaftPart=part('flywheel-shaft','Flywheel shaft and collars','The shaft connects the disk and final pinion, with collars retaining them between the plates.',[0,0,0],storage);
  const bearingPart=part('flywheel-bearings','Flywheel bearing bushes','Two bushes support the fast shaft in the gearbox plates.',[0,0,0],storage);
  const sets={};
  for(const ratio of RATIOS){
    const centers=shafts(ratio),[[a,b],[c,d]]=GEARS[ratio],nodes=[];
    const sub=parent=>{const g=new THREE.Group();parent.add(g);nodes.push(g);return g;};
    const gear=(teeth,center,z,parent,color)=>{
      const container=sub(parent),g=new THREE.Group();g.position.set(...point([...center,z]));container.add(g);
      const geometry=extrusion(toothOutline(teeth),3,[[0,0,parent===inputGear?1.5:.85]]);geometry.translate(0,0,-1.5*MM);
      const sharp=surface(kit,geometry,color,g),blur=disk(pitchRadius(teeth)+MODULE,3,[0,0,0],color,g);
      blur.material=blur.material.clone();Object.assign(blur.material,{transparent:true,opacity:.45,depthWrite:false});
      return {group:g,sharp,blur,teeth};
    };
    const axleGear=gear(a,centers.axle,0,inputGear,'gold'),pinion=gear(b,centers.middle,0,compound,'metal');
    const second=gear(c,centers.middle,-4.5,compound,'gold'),flywheelPinion=gear(d,centers.flywheel,-4.5,finalPinion,'metal');
    const hub=sub(compound),compoundHub=ring(.85,1.25,7.5,[...centers.middle,-6],'metal',hub);
    const fixed=sub(middlePin),fixedPinMesh=rod([...centers.middle,-12],[...centers.middle,12],.8,'ink',fixed);for(const z of [-11.7,11.7])disk(1.3,.8,[...centers.middle,z],'gold',fixed);
    const casing=sub(gearbox),plates=[],posts=[],feet=[];
    for(const z of [-11,9]){
      const plate=surface(kit,extrusion([[-51,8],[-6,8],[-6,42],[-51,42]],2,[[...centers.axle,1.65],[...centers.middle,.9],[...centers.flywheel,.9]]),'wood',casing);
      plate.position.z=z*MM;plates.push(plate);if(z>0)covers.push(plate);
    }
    for(const x of [-49,-8])for(const y of [11,39]){posts.push(rod([x,y,-11],[x,y,11],1.2,'metal',casing));disk(2.1,1,[x,y,11],'ink',casing);}
    for(const x of [-49,-8])feet.push(box([4,3,44],[x,8.5,0],'metal',casing));
    const shaft=sub(shaftPart),flywheelShaftMesh=rod([...centers.flywheel,-12],[...centers.flywheel,12],.8,'metal',shaft);
    for(const z of [-7,7])ring(.8,1.5,1,[...centers.flywheel,z],'gold',shaft);
    const bearings=sub(bearingPart);for(const z of [-12,9])ring(.85,2.4,3,[...centers.flywheel,z],'metal',bearings);
    const wheelRoot=sub(flywheelPart),flywheel=new THREE.Group();wheelRoot.add(flywheel);flywheel.position.set(...point([...centers.flywheel,4]));
    const diskMesh=disk(10,4,[0,0,0],'metal',flywheel),marks=[-1,1].map(sign=>box([3,3,4.2],[sign*6,0,0],'ink',flywheel));
    const blur=disk(10,4.2,[0,0,0],'metal',flywheel);blur.material=blur.material.clone();Object.assign(blur.material,{transparent:true,opacity:.45,depthWrite:false});
    sets[ratio]={nodes,centers,axleGear,pinion,second,flywheelPinion,flywheel,disk:diskMesh,marks,blur,plates,posts,feet,compoundHub,fixedPinMesh,flywheelShaftMesh};
  }
  const hand=part('hand','Hand and downward press','The hand touches the roof while pushing and carries the toy above the floor between strokes.',[0,0,0],experiment);
  hand.userData.explosionExcluded=true;
  const palm=box([42,9,32],[-5,59.5,0],'cream',hand);
  const fingers=[];
  for(const x of [-18,-10,-2,6]){fingers.push(box([5,6,16],[x,58,17],'cream',hand),kit.sphere(2.5*MM,point([x,55.5,24.5]),'cream',hand));}
  const press=solidArrow(kit,0xd9822b,hand,1.1*MM);press.userData.setDirection(new THREE.Vector3(0,-1,0));
  const floor=part('floor','Floor and distance markers','The floor slides past the following camera. Seams are 50 mm apart; a gold line marks each half meter.',[0,0,0],experiment);floor.userData.explosionExcluded=true;
  const base=box([250,2,100],[0,-1,0],'cream',floor);base.material=base.material.clone();
  const seams=Array.from({length:5},()=>box([.8,.15,100],[0,.075,0],'ink',floor));
  const mark=box([2,.2,100],[0,.1,0],'gold',floor);
  return {experiment,machine,structure,chassis,shell,cabin,roof,bodyPanels,hoodPanels,running,rearAxle,frontAxle,wheelBearings,wheels,axles,transmission,gearbox,inputGear,compound,middlePin,finalPinion,storage,flywheelPart,shaftPart,bearingPart,sets,hand,palm,fingers,press,floor,base,seams,mark};
}
