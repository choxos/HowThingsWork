import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {sampleGrinder, grinderPlan, grinderFlowAtPressure, GRINDER, GRINDER_DEFAULTS as D, GRINDER_DOMAINS} from './meat-grinder-physics.js';
import {createMeatGrinderModel} from './meat-grinder-model.js';
import {createPartExplosion} from './part-explosion.js';
import {meatGrinderLesson as lesson} from './meat-grinder-lesson.js';
import {tally, checkTrialNumbers, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';

const out = process.env.EVIDENCE_DIR || 'documentation/audit/evidence/meat-grinder-20260920';await mkdir(out, {recursive: true});
const t = tally(), TAU = 2 * Math.PI, perTurn = Math.PI * (.025 ** 2 - .010 ** 2) * .025 * .3;
const lead = Math.atan(.025 / (TAU * .0175)), eta = Math.tan(lead) / Math.tan(lead + Math.atan(.3));
// Independent integration of radial Bingham velocity, not the closed-form flow law.
function integratedFlow(pressure, diameter, yieldStress, viscosity, holes) {
  const radius = diameter / 2, plug = Math.min(radius, 2 * .006 * yieldStress / pressure), dr = radius / 4096;
  if (plug >= radius || !pressure) return 0;
  let flow = 0;
  for (let i = 0; i < 4096; i++) {const r = (i + .5) * dr, edge = Math.max(plug, r);const speed = pressure / (4 * viscosity * .006) * (radius ** 2 - edge ** 2) - yieldStress / viscosity * (radius - edge);flow += speed * TAU * r * dr;}
  return flow * holes;
}
let configurations = 0, flowCases = 0;
for (const plate of [0, 1, 2]) for (const meat of [0, 1, 2]) for (const rate of [.25, .5, 1, 2]) {
  const s = grinderPlan({plate, meat, rate}), hole = [.0045, .006, .008][plate], stress = [5000, 10000, 20000][meat], viscosity = [100, 200, 600][meat];
  t.near(integratedFlow(s.requestedPressure, hole, stress, viscosity, s.holes), perTurn * rate, perTurn * rate * 2e-7, 'Radial velocity integral supplies requested flow');
  t.ok(s.requestedPressure > 4 * stress * .006 / hole, 'Flow requires more than yield pressure');flowCases++;
}
for (const plate of [0, 1, 2]) for (const meat of [0, 1, 2]) for (const knife of [0, 1]) for (let rate = .25; rate <= 2; rate += .25) for (let force = 1; force <= 60; force++) {
  const s = sampleGrinder({plate, meat, knife, rate, force}, 8), hole = [.0045, .006, .008][plate], stress = [5000, 10000, 20000][meat];
  t.near(s.perTurn, perTurn, 1e-15, 'Displaced channel volume');t.near(s.eta, eta, 1e-14, 'Drawn lead sets screw efficiency');
  t.near(s.yieldPressure, 4 * stress * .006 / hole, 1e-9, 'Yield threshold');t.near(s.minced, s.rate * 8 * perTurn * 1050, 1e-12, 'Collected mass balance');
  t.near(s.handPower, s.pressure * s.flow / eta + [0.2, .7][knife] * TAU * s.rate, 1e-10, 'Input power matches pressure and knife work');
  t.near(s.work, s.pressureWork + s.screwHeat + s.knifeWork, 1e-9, 'Work conservation');t.ok(s.rate >= 0 && s.rate <= rate + 1e-12, 'Force cannot exceed requested speed');
  t.ok(s.appliedForce <= force + 1e-9, 'Hand never exceeds its force cap');t.ok(s.complete && s.mode === 'complete' && s.rateNow === 0, 'Completion stops the handle');
  if (force <= s.breakawayForce) {t.ok(s.stalled && s.rate === 0 && s.minced === 0 && s.work === 0, 'Below breakaway no displacement or work');}
  else if (force < s.handForce) {t.ok(s.limited && s.rate > 0 && s.rate < rate, 'Intermediate force slows rather than falsely stalling');t.near(s.appliedForce, force, 1e-9, 'Limited run uses force cap');}
  else {t.ok(!s.limited && !s.stalled, 'Enough force sustains target');t.near(s.rate, rate, 1e-12, 'Requested rate achieved');}
  configurations++;
}
const normal = grinderPlan(), stronger = grinderPlan({force:60});t.near(normal.rate, stronger.rate, 0, 'Unused force capacity changes no rate');t.near(normal.handPower, stronger.handPower, 0, 'Unused force capacity supplies no extra power');
for (const factor of [0, .5, 1, 1 + 1e-7, 2, 100]) {const pressure = 40000 * factor, flow = grinderFlowAtPressure(pressure, .006, 10000, 200, 18);t.ok(Number.isFinite(flow) && flow >= 0, 'Near-threshold flow remains finite and nonnegative');if (factor <= 1) t.near(flow, 0, 0, 'No flow at or below yield');}
for(const plate of [0,1,2])for(const meat of [0,1,2])for(const knife of [0,1])for(const force of [1,5,10,12,20]){
 const s=grinderPlan({plate,meat,knife,force,rate:2});
 if(s.stalled)t.near(s.flow,0,0,'No flow below yield');else t.near(integratedFlow(s.pressure,[.0045,.006,.008][plate],[5000,10000,20000][meat],[100,200,600][meat],s.holes),s.flow,Math.max(1e-14,s.flow*3e-7),'Independent integral also verifies force-limited flow');flowCases++;
}
checkRefusals(sampleGrinder, GRINDER_DOMAINS, t);

const model = createMeatGrinderModel(), p = model.topology, point = new THREE.Vector3();
function localVertices(mesh, ancestor) {mesh.updateWorldMatrix(true, false);ancestor.updateWorldMatrix(true, false);const matrix = ancestor.matrixWorld.clone().invert().multiply(mesh.matrixWorld);return Array.from({length:mesh.geometry.attributes.position.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(matrix).multiplyScalar(1 / p.MM));}
// The knife face touches the plate; square drive and round support pin form one shaft.
for (const phase of [0, .031, .12, .37, .73, .99]) {
  model.reset();model.advance(phase);model.root.updateMatrixWorld(true);
  for(const spinning of [p.auger,p.crank,p.knife])t.near(spinning.rotation.x,TAU*phase,1e-12,'One shaft turns auger, crank and knife together');
  t.near(p.grip.rotation.x,-TAU*phase,1e-12,'Grip counter-rotates freely');
  for (const blade of p.blades) {const vertices = localVertices(blade, p.cutter);t.near(Math.max(...vertices.map(v => v.x)), 43, 1e-4, 'Actual flat blade face touches plate');t.ok(vertices.every(v => Math.hypot(v.y, v.z) < 26), 'Knife clears barrel');}
  const shaft = localVertices(p.knifeDrive, p.auger);t.near(Math.max(...shaft.map(v => v.x)), 43, 1e-4, 'Square shaft reaches full knife thickness');t.near(Math.min(...shaft.map(v => v.x)), 38, 1e-4, 'Square shaft joins auger core');
  const pin = localVertices(p.frontPin, p.auger);t.ok(pin.every(v => Math.hypot(v.y, v.z) < 3.1), 'Front pin clears plate bore');
}
// Inspect the actual flight mesh, including triangle winding and every shared edge.
const pos = p.flight.attributes.position, ix = p.flight.index, edgeCounts = new Map();let volume = 0;
for (let i = 0; i < ix.count; i += 3) {
  const ids = [ix.getX(i), ix.getX(i+1), ix.getX(i+2)], vertices = ids.map(id => new THREE.Vector3().fromBufferAttribute(pos, id));
  volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
  for (let j = 0; j < 3; j++) {const a = ids[j], b = ids[(j+1)%3], key = [Math.min(a,b),Math.max(a,b)].join(':');edgeCounts.set(key,(edgeCounts.get(key)||0)+1);}
}
t.ok(volume > 0, 'Flight has outward winding and positive volume');t.ok([...edgeCounts.values()].every(n=>n===2), 'Every flight edge closes exactly twice');
let maxRadius = 0;for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).multiplyScalar(1/p.MM);maxRadius=Math.max(maxRadius,Math.hypot(point.y,point.z));}
t.near(maxRadius,25,1e-4,'Flight tip radius');t.ok(26.5-1-maxRadius>.49,'Fixed ribs clear rotating flight');
// Ray-cast through the actual assembled hopper opening; covers are present here.
model.reset();model.root.rotation.set(0,0,0);model.root.updateMatrixWorld(true);
const ray = new THREE.Raycaster(new THREE.Vector3(-28*p.MM,210*p.MM,0),new THREE.Vector3(0,-1,0));
const bodyHits = ray.intersectObject(p.body,true).filter(hit=>hit.point.y>145*p.MM);t.near(bodyHits.length,0,0,'No wall blocks the hopper throat');
// Spherical feed markers clear both the core and flight at their axial phase.
for(let i=0;i<=240;i++){
 model.reset();model.advance(i/60);const s=model.getState();
 for(const chunk of p.chunks)if(chunk.visible){const x=chunk.position.x/p.MM,y=chunk.position.y/p.MM-120;
  t.ok(y-4>10,'Feed sphere clears shaft');const phase=((x-(-58+25*s.crankTurns/1))%25+25)%25;
  if(y<29)t.ok(Math.min(phase,25-phase)>4+.75+25*Math.asin(4/y)/TAU,'Feed sphere clears both adjacent flight flanks');
  if(y>=26)t.ok(x-4>=-48&&x+4<=-8,'Feed sphere enters inside hopper end walls');
 }
}
model.reset();model.update({rate:2});model.advance(8);
const drawnVolume=4/3*Math.PI*p.pile.scale.x*p.pile.scale.y*p.pile.scale.z/p.MM**3/1e9;
t.near(drawnVolume,model.getState().minced/1050,1e-12,'Pile volume matches illustrative collected volume');
for(const v of localVertices(p.pile,p.collection)){const y=v.y,radius=Math.hypot(v.x-96,v.z);if(y<72){const inner=y<46?21+(y-34)*2:45+(y-46)*6/26;t.ok(radius<=inner+.02,'Collected pile fits the bowl interior');}}
let replaced = 0;p.plateMesh.geometry.addEventListener('dispose',()=>replaced++);
for(const plate of [0,1,2]){
 model.reset();model.update({plate});model.advance(1.13);model.root.updateMatrixWorld(true);const s=model.getState(),holes=p.holes();
 t.near(holes.length,s.holes,0,'Every counted hole is drawn');t.near(p.strands.count,s.holes,0,'Each hole has output');
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(let i=0;i<holes.length;i++){p.strands.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);t.near(position.x/p.MM-scale.y/p.MM/2,49,1e-4,'Strand begins at plate outlet');t.near(position.y/p.MM-120,holes[i].y,1e-4,'Strand aligns with hole height');t.near(position.z/p.MM,holes[i].z,1e-4,'Strand aligns with hole depth');}
 const shape=p.plateMesh.geometry.parameters.shapes;t.near(shape.holes.length,holes.length+1,0,'Actual plate contains output bores plus support bore');
 for(let i=0;i<holes.length;i++){const h=holes[i],radius=s.hole*500;t.ok(Math.hypot(h.y,h.z)+radius<=25+1e-9,'Hole lies clear of collar');t.ok(Math.hypot(h.y,h.z)-radius>=6-1e-9,'Hole clears knife hub');for(let j=i+1;j<holes.length;j++)t.ok(Math.hypot(h.y-holes[j].y,h.z-holes[j].z)>2*radius+.5,'Holes do not overlap');}
 const bounds=new THREE.Box3().setFromBufferAttribute(p.plateMesh.geometry.attributes.position);t.near(bounds.min.x/p.MM,43,1e-4,'Plate upstream face');t.near(bounds.max.x/p.MM,49,1e-4,'Plate thickness');
 checkFinite(model.root,t);
}
t.near(replaced,1,0,'Replaced plate geometry disposed once');
const run=values=>{model.reset();model.update(values);model.advance(8);return model.getState();};
checkTrialNumbers(lesson,{
 'Run the medium plate':s=>({'1':s.rate,'4.83':s.handForce,'77.4':s.pressure/1000,'103.9':s.minced*1000}),
 'Use the fine plate':s=>({'33':s.holes,'4.5':s.hole*1000,'1':s.rate,'6.32':s.handForce,'114.0':s.pressure/1000}),
 'Use the coarse plate':s=>({'10':s.holes,'8':s.hole*1000,'52.9':s.pressure/1000,'3.83':s.handForce}),
 'Increase feed resistance':s=>({'182.2':s.pressure/1000,'9.11':s.handForce}),
 'Reduce feed resistance':s=>({'38.7':s.pressure/1000,'3.25':s.handForce}),
 'Use a dull knife':s=>({'9.00':s.handForce}),
 'Complete a demanding run':s=>({'17.03':s.handForce,'30':s.values.force}),
 'Slow under limited force':s=>({'0.159':s.rate,'1':s.values.rate,'16.5':s.minced*1000}),
 'Stall completely':s=>(t.ok(s.stalled&&s.minced===0&&s.work===0,'Stall claim'),{'10.19':s.breakawayForce}),
 'Turn twice as fast':s=>({'207.8':s.minced*1000,'5.93':s.handForce,'8.94':s.handPower}),
 'Check the work balance':s=>(t.near(s.work,s.pressureWork+s.screwHeat+s.knifeWork,1e-10,'Trial work balance'),{}),
},run,t,model);
for(const experiment of lesson.tryIt){assert(experiment.reset);assert.deepEqual(Object.keys(experiment.values).sort(),Object.keys(D).sort());model.update({force:1});model.advance(8);model.reset();model.update(experiment.values);t.near(model.getState().elapsed,0,0,'Preset starts independently');model.advance(2);const before=model.getState();for(const action of model.actions.filter(a=>a.group==='Look closer')){action.run();t.near(model.getState().elapsed,2,0,'Inspection preserves time');t.near(model.getState().minced,before.minced,0,'Inspection preserves output');}}
for(const hz of [15,60,144]){model.reset();while(!model.playback.complete())model.advance(1/hz);t.near(model.getState().elapsed,8,0,'Exact completion at any frame rate');t.near(model.getState().minced,normal.massFlow*8,1e-12,'Frame-independent output');}
model.reset();model.advance(3);model.update({rate:2});t.near(model.getState().elapsed,0,0,'Changed control starts fresh trial');model.advance(1);model.update({rate:2});t.near(model.getState().elapsed,1,0,'Unchanged control preserves trial');
for(const dt of [0,-1,NaN,Infinity])model.advance(dt);t.near(model.getState().elapsed,1,0,'Invalid steps do not advance');model.update({rate:NaN,force:Infinity});t.ok(Number.isFinite(model.getState().work),'Nonfinite UI controls rejected');
model.reset();model.advance(2);model.covers.forEach(cover=>cover.visible=false);const camera=new THREE.PerspectiveCamera(40,1,.01,100);camera.position.set(0,1.2,7);camera.lookAt(0,1.2,0);camera.updateMatrixWorld();
const explosion=createPartExplosion(model,camera,1.2);explosion.update(1);assert.deepEqual(explosion.categories.map(c=>c.id),['body','auger','cutter','crank','meat','collection']);
for(const id of ['knife','plate','plate-stop','retainer'])assert.equal(explosion.items.find(item=>item.id===id).category,'cutter');
t.ok(explosion.items.every(item=>item.id!=='system'),'Force arrows are excluded from parts inventory');explosion.dispose();
const resources=checkDisposal(model,t);
const report={result:'PASS',configurations,flowCases,checks:t.count,trials:lesson.tryIt.length,resources,flightVolume:volume,limits:'Mesh vertices, analytic clearances and sampled phase checks; not an exhaustive collision proof or appliance calibration.'};
await writeFile(out+'/model.json',JSON.stringify(report,null,2)+'\n');console.log('PASS meat grinder model:',JSON.stringify(report));
