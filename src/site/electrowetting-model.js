import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {solidArrow, textLabel} from './scene-kit.js';
import {WET_CELL, WET_DEFAULTS, WET_DOMAINS, WET_CHANNELS, wetProfile, createWettingController} from './electrowetting-physics.js';

const XS = [-1.55, 0, 1.55], CY = .60, BASE = .10, COLORS = [0xff0000, 0x00ff00, 0x0000ff];
const label = (parent, text, x, y, width = 2, height = .20, z = .15) => textLabel(parent, text, {width, height, position: [x, y, z]});
const basicBox = (kit, size, position, color, parent, opacity = 1) => {
  const mesh = kit.box(size, position, color, parent);
  mesh.material = new THREE.MeshBasicMaterial({color, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity === 1});return mesh;
};

function outlineBox(mesh,color) {
  mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3()),box=new THREE.BoxGeometry(...size.toArray());
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color,toneMapped:false}));box.dispose();edges.raycast=()=>{};mesh.add(edges);
}

function liquidMesh(parent, water = false) {
  const count = WET_CELL.segments + (water ? 3 : 2), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(((count - 1) * 4 + 2) * 18), 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.MeshBasicMaterial({color: water ? 0x83b4c1 : 0x070907, transparent: water, opacity: water ? .08 : 1, depthWrite: !water, toneMapped: false});
  const mesh = new THREE.Mesh(geometry, material), edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(((count-1)*4+4)*6),3).setUsage(THREE.DynamicDrawUsage));
  const edges=new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color:water?0x5f8c9c:0x374736,transparent:true,opacity:.7,depthWrite:false,toneMapped:false}));
  edges.raycast=()=>{};
  mesh.add(edges);mesh.userData.profileEdges=edges;parent.add(mesh);return mesh;
}

/** Closed extrusions share their oil/water interface and reuse vertex buffers. */
function setLiquid(mesh, profile, water = false) {
  const points = water ? profile.water : profile.oil, y0 = -WET_CELL.length / 2, y1 = -y0;
  const vertices = mesh.geometry.attributes.position.array;let cursor = 0;
  const quad = (a, b, c, d) => {for (const point of [a, b, c, a, c, d]) for (const value of point) vertices[cursor++] = value;};
  const bottom = i => water ? points[i][1] : 0, top = i => water ? WET_CELL.waterHeight : points[i][1];
  for (let i = 0; i < points.length - 1; i++) {
    const x = points[i][0], next = points[i + 1][0];
    quad([x,y0,top(i)], [next,y0,top(i+1)], [next,y1,top(i+1)], [x,y1,top(i)]);
    quad([x,y0,bottom(i)], [x,y1,bottom(i)], [next,y1,bottom(i+1)], [next,y0,bottom(i+1)]);
    quad([x,y0,bottom(i)], [next,y0,bottom(i+1)], [next,y0,top(i+1)], [x,y0,top(i)]);
    quad([x,y1,bottom(i)], [x,y1,top(i)], [next,y1,top(i+1)], [next,y1,bottom(i+1)]);
  }
  const first = 0, last = points.length - 1;
  quad([points[first][0],y0,bottom(first)], [points[first][0],y0,top(first)], [points[first][0],y1,top(first)], [points[first][0],y1,bottom(first)]);
  quad([points[last][0],y0,bottom(last)], [points[last][0],y1,bottom(last)], [points[last][0],y1,top(last)], [points[last][0],y0,top(last)]);
  mesh.geometry.attributes.position.needsUpdate = true;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  const edges=mesh.userData.profileEdges.geometry,edgeVertices=edges.attributes.position.array;let edgeCursor=0;
  const edge=(a,b)=>{for(const point of [a,b])for(const value of point)edgeVertices[edgeCursor++]=value;};
  for(let i=0;i<points.length-1;i++)for(const y of [y0,y1]){
    edge([points[i][0],y,bottom(i)],[points[i+1][0],y,bottom(i+1)]);
    edge([points[i][0],y,top(i)],[points[i+1][0],y,top(i+1)]);
  }
  for(const i of [first,last])for(const y of [y0,y1])edge([points[i][0],y,bottom(i)],[points[i][0],y,top(i)]);
  edges.attributes.position.needsUpdate=true;edges.computeBoundingBox();edges.computeBoundingSphere();
}

function buildWettingModule(kit) {
  const system = kit.part('system', 'Electrowetting display', 'Three reflective, filtered subpixels controlled by the motion of black oil.');
  const assembly = kit.part('assembly', 'Connected RGB module', 'A source, switch and channel drivers connect to insulated pixel electrodes and a common contact in conducting water. Geometry and wiring are enlarged teaching arrangements.', [0,0,0], system);
  const frame = kit.part('frame', 'Board and cell walls', 'The board supports three enclosed cells. Walls keep each cell’s oil and conducting water within its own compartment.', [0,0,0], assembly);
  const board = kit.box([7.1, 4.1, .16], [0,0,-.12], 'leaf', frame), walls = [];
  for (const x of XS) {
    walls.push(kit.box([.04,1.58,.52], [x-.67,CY,.30], 'ink', frame), kit.box([.04,1.58,.52], [x+.67,CY,.30], 'ink', frame));
    walls.push(kit.box([1.30,.04,.52], [x,CY-.77,.30], 'ink', frame), kit.box([1.30,.04,.52], [x,CY+.77,.30], 'ink', frame));
  }
  label(frame, 'Reflective RGB subpixels', 0, 1.86, 4.2, .25, -.025);
  label(frame, 'Oil blocks light · water moves oil', -.2, -1.88, 4.7, .20, -.025);

  const power = kit.part('power', 'Power supply and switch', 'The supply applies voltage through the drivers. Opening the switch removes drive and prepares the oil to spread back over each reflector.', [0,0,0], assembly);
  const battery = kit.box([.4,1.4,.16], [-3,-.10,.04], 'metal', power);
  const terminals = [kit.box([.24,.08,.08], [-3,.64,.07], 'gold', power), kit.box([.24,.08,.08], [-3,-.84,.07], 'ink', power)];
  label(power, '+', -3, .40, .26, .22, .13);label(power, '−', -3, -.60, .26, .22, .13);label(power, 'Supply', -3, -.10, .38, .17, .13);
  const switchBase = kit.box([.50,.26,.12], [-2.92,-1.20,.02], 'cream', power);
  const switchContacts = [-3.09,-2.75].map(x => kit.sphere(.033,[x,-1.20,.11],'gold',power));
  const switchPivot = new THREE.Group();switchPivot.position.set(-3.09,-1.20,.11);power.add(switchPivot);
  const switchBlade = kit.rod([0,0,0],[.34,0,0],.021,'gold',switchPivot);
  const switchText = label(power, '', -2.94, -1.51, 1.08, .17, .13);
  const wires = [];
  const wire = (a,b,color,parent) => {const mesh = kit.rod(a,b,.014,color,parent);mesh.userData.explosionExcluded = true;wires.push({mesh,a:[...a],b:[...b]});return mesh;};
  wire([-3,.68,.07],[-3.37,.68,.07],'red',power);wire([-3.37,.68,.07],[-3.37,-1.20,.11],'red',power);wire([-3.37,-1.20,.11],[-3.09,-1.20,.11],'red',power);
  wire([-2.75,-1.20,.11],[-2.5,-1.20,.11],'red',power);wire([-2.5,-1.20,.11],[-2.5,-1.5,.02],'red',power);wire([-2.5,-1.5,.02],[-.70,-1.5,.02],'red',power);

  const drivers = kit.part('drivers', 'Controller and three channel drivers', 'Separate channel commands apply voltage to the three pixel electrodes. Off, Intermediate and Full are illustrative commands, not measured voltages.', [0,0,0], assembly);
  const controller = kit.box([1.4,.4,.12], [0,-1.50,.02], 'blue', drivers);
  label(drivers, 'RGB controller', 0, -1.50, 1.28, .17, .089);
  const chips = XS.map(x => kit.box([.82,.29,.12],[x,-.77,.02],'ink',drivers));
  const chipTexts = XS.map(x => textLabel(drivers, '', {width:.77,height:.16,position:[x,-.77,.089],color:'#f5f1dc'}));
  wire([0,-1.30,.02],[0,-1.08,.02],'gold',drivers);
  wire([XS[0],-1.08,.02],[XS[2],-1.08,.02],'gold',drivers);
  XS.forEach(x => {wire([x,-1.08,.02],[x,-.915,.02],'gold',drivers);wire([x,-.625,.02],[x,CY-.75,.05],'gold',drivers);});

  const reflectors = kit.part('reflectors', 'White reflecting bases', 'Uncovered areas return incident light through the filters. Oil-covered areas remain dark. Light off darkens these bases without changing liquid positions.', [0,0,0], assembly);
  const bases = XS.map(x => basicBox(kit,[1.30,1.5,.08],[x,CY,0],0xffffff,reflectors));
  bases.forEach(mesh=>outlineBox(mesh,0x68725f));
  const electrodes = kit.part('electrodes', 'Transparent pixel electrodes', 'Each transparent bottom electrode connects to its channel driver. It sits between the reflecting base and insulating coating.', [0,0,0], assembly);
  const electrodeSheets = XS.map(x => basicBox(kit,[1.30,1.5,.02],[x,CY,.05],0xe3b45e,electrodes,.035));
  electrodeSheets.forEach(mesh=>outlineBox(mesh,0xa47d35));
  const coating = kit.part('coating', 'Water-repellent insulating coating', 'A thin hydrophobic insulator separates the electrode from the liquids. Applied voltage changes the wetting balance at this coated surface.', [0,0,0], assembly);
  const coatings = XS.map(x => basicBox(kit,[1.30,1.5,.04],[x,CY,.08],0xf0dfaf,coating,.025));
  coatings.forEach(mesh=>outlineBox(mesh,0xa89c6f));
  const oil = kit.part('oil', 'Black oil films and side beads', 'The same amount of oil covers the base as a film or gathers into a taller side bead. Its actual footprint determines uncovered reflecting area.', [0,0,0], assembly);
  const oils = XS.map(x => {const mesh = liquidMesh(oil);mesh.position.set(x,CY,BASE);return mesh;});
  const water = kit.part('water', 'Conducting water', 'Water fills the complementary space above the oil. With voltage applied it advances over the coated base while oil gathers to one side.', [0,0,0], assembly);
  const waters = XS.map(x => {const mesh = liquidMesh(water,true);mesh.position.set(x,CY,BASE);return mesh;});
  const contacts = kit.part('contacts', 'Common contacts in water', 'The blue return lead connects the supply to a metal contact in each conducting-water region. Wall crossings represent sealed feedthroughs; detailed seals are omitted.', [0,0,0], assembly);
  const commonContacts = XS.map(x => kit.box([.07,.10,.16],[x+.58,1.24,.43],'metal',contacts));
  wire([-3,-.88,.07],[-2.56,-.88,.07],'blue',contacts);wire([-2.56,-.88,.07],[-2.56,1.62,.43],'blue',contacts);wire([-2.56,1.62,.43],[2.13,1.62,.43],'blue',contacts);
  XS.forEach(x => wire([x+.58,1.62,.43],[x+.58,1.29,.43],'blue',contacts));
  label(contacts, 'Common', 2.85, 1.62, 1.08, .17, .43);

  const filters = kit.part('filters', 'Electrowetting color filters', 'Ideal red, green and blue filters sit on clear covers at the viewing side. They select returning light, while covered areas remain dark. Look inside removes this cover group and the transparent water for a clearer view of oil motion.', [0,0,0], assembly);
  const lids = XS.map(x => basicBox(kit,[1.30,1.5,.02],[x,CY,.55],0xffffff,filters,.025));
  const filterSheets = XS.map((x,i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.30,1.50),new THREE.MeshBasicMaterial({color:COLORS[i],transparent:true,premultipliedAlpha:true,blending:THREE.MultiplyBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    mesh.position.set(x,CY,.57);mesh.renderOrder = 4;filters.add(mesh);return mesh;
  });
  const filterEdges = XS.flatMap((x,i) => [
    basicBox(kit,[.014,1.5,.014],[x-.643,CY,.578],COLORS[i],filters),
    basicBox(kit,[.014,1.5,.014],[x+.643,CY,.578],COLORS[i],filters),
    basicBox(kit,[1.3,.014,.014],[x,CY-.743,.578],COLORS[i],filters),
    basicBox(kit,[1.3,.014,.014],[x,CY+.743,.578],COLORS[i],filters),
  ]);
  XS.forEach((x,i) => label(filters,`${'RGB'[i]} filter`,x,1.50,1.15,.17,.60));
  const light = kit.part('light', 'Incident and reflected light paths', 'Selected arrows pass through an uncovered area to the white base. Reflected arrows disappear when oil covers the whole base or incident light is off. These are optical teaching paths, not a ray-tracing calculation.', [0,0,0], assembly);
  const incident = XS.map(() => solidArrow(kit,0xf0dfaf,light,.010)), reflected = XS.map((_,i) => solidArrow(kit,COLORS[i],light,.010));
  const result = kit.part('result', 'Combined-color sample', 'A separate viewing aid represents the ideal RGB mixture of the current uncovered subpixel areas. It stands for unresolved neighboring subpixels, not an extra emitting device.', [0,0,0], assembly);
  const resultFrame = kit.box([.98,.88,.10],[2.76,-1.02,.01],'cream',result);
  const swatch = basicBox(kit,[.83,.61,.012],[2.76,-.98,.068],0x000000,result);
  label(result,'Seen together',2.76,-1.62,1.31,.18,.075);
  const colorText = label(result,'',2.76,-1.40,1.31,.18,.075);
  for (const part of [power,drivers,reflectors,electrodes,coating,oil,water,contacts,filters,result]) {part.userData.explosionCategory = true;part.userData.explosionRigid = true;}
  light.userData.explosionExcluded = true;
  return {system,assembly,frame,board,walls,power,battery,terminals,switchBase,switchContacts,switchPivot,switchBlade,switchText,wires,drivers,controller,chips,chipTexts,reflectors,bases,electrodes,electrodeSheets,coating,coatings,oil,oils,water,waters,contacts,commonContacts,filters,lids,filterSheets,filterEdges,light,incident,reflected,result,resultFrame,swatch,colorText};
}

function updateWettingGeometry(g,state) {
  const {values,now} = state;
  now.open.forEach((opening,i) => {
    const profile = wetProfile(opening);setLiquid(g.oils[i],profile);setLiquid(g.waters[i],profile,true);
    g.bases[i].material.color.set(values.light ? 0xffffff : 0x000000);
    g.filterSheets[i].material.color.set(values.light ? COLORS[i] : 0x000000);
    g.chipTexts[i].userData.setText(`${'RGB'[i]} ${['off','mid','full'][now.drive[i]]}`);
    const open = opening > 1e-9, x = XS[i] + (open ? profile.front + (WET_CELL.width/2-profile.front)*.62 : 0), endZ = open ? .041 : BASE+WET_CELL.film;
    const incoming = new THREE.Vector3(x,CY+.29,1.10), hit = new THREE.Vector3(x,CY-.07,endZ), outgoing = new THREE.Vector3(x,CY-.44,1.10);
    g.incident[i].position.copy(incoming);g.incident[i].userData.setDirection(hit.clone().sub(incoming));g.incident[i].userData.setLength(values.light ? incoming.distanceTo(hit) : 0);
    g.reflected[i].position.copy(hit);g.reflected[i].userData.setDirection(outgoing.clone().sub(hit));g.reflected[i].userData.setLength(values.light && open ? hit.distanceTo(outgoing) : 0);
  });
  g.switchPivot.rotation.z = values.power ? 0 : .75;g.switchText.userData.setText(values.power ? 'Connected' : 'Disconnected');
  g.swatch.material.color.setRGB(...now.color.rgb);g.colorText.userData.setText(values.light ? now.color.name : 'No light');
}

export function createElectrowettingModel() {
  const kit = houseModel('Electrowetting display'), g = buildWettingModule(kit), controller = createWettingController();
  const options = labels => labels.map((label,value) => ({label,value}));
  for (const key of WET_CHANNELS) kit.control(key,`${key[0].toUpperCase()+key.slice(1)} channel`,...WET_DOMAINS[key],WET_DEFAULTS[key],'','Choose an illustrative voltage command. Oil moves from its current position when you press Play; Full exposes 80% of this teaching cell.',options(['Off','Intermediate','Full']),{primary:key==='red'});
  kit.control('power','Supply',...WET_DOMAINS.power,1,'','Disconnect voltage, then press Play to let oil spread back over the reflectors. Open cells need maintained voltage.',options(['Disconnected','Connected']));
  kit.control('light','Light on display',...WET_DOMAINS.light,1,'','Incident light reveals the current oil state. Changing light does not move oil or restart the experiment. Hardware remains lit for inspection.',options(['Off','On']));
  const result = kit.finish(() => {
    const state = controller.getState(), {values,now} = state;updateWettingGeometry(g,state);
    const areas = now.open.map((value,i) => `${'RGB'[i]} ${Math.round(value*100)}%`).join(' · ');
    return {state:{...state,time:state.clock},readings:[
      reading('Your result',values.light ? now.color.name : 'No reflected color; light is off',now.complete ? now.drive.some(Boolean) ? 'Oil has reached the commanded shape. Voltage remains applied to hold open areas.' : 'Oil covers the reflectors; no channel voltage is applied.' : values.power ? 'Oil is moving toward the requested openings. Watch both the cells and the combined-color sample.' : 'Drive is zero. Oil is spreading back toward the covered state.'),
      reading('Reflector uncovered',areas,'Current oil footprints determine these areas. The values describe enlarged teaching geometry, not measured device performance.'),
      reading('Applied commands',now.drive.map((value,i) => `${'RGB'[i]} ${['off','intermediate','full'][value]}`).join(' · '),'Commands remain applied after opening. They are not calibrated voltage or electrical power measurements.'),
      reading('Liquid motion',now.complete ? 'At the current target' : `${Math.round(now.progress*100)}% through this transition`,'A 1.6 scene-second geometric transition conserves oil and water volume. It does not predict real switching time.'),
      reading('Combined-color sample',values.light ? now.color.name : 'Dark without incident light','An ideal RGB mixture derived from the current uncovered fractions. No calibrated spectrum, luminance or human color matching is calculated.'),
    ]};
  });
  const render = result.update;let previousTime = 0,disposed = false;const sync = () => render(controller.getState().values);
  result.update = (input={}) => {controller.update(input);return sync();};
  result.reset = (initial={}) => {controller.reset(initial);previousTime=0;return sync();};
  result.advance = seconds => {if (Number.isFinite(seconds) && seconds>0) controller.advance(seconds);return sync();};
  result.animate = time => {const delta=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(delta);};
  result.replayState = controller.replayState;
  result.playback = {label:'Move the oil',description:'Follow the oil opening or covering each reflector.',stepLabel:'Advance oil motion',advance:result.advance,step:()=>result.advance(.2),complete:()=>result.getState().now.complete,blocked:()=>false};
  result.actions = [['Inspect: connected module','assembly'],['Inspect: power and switch','power'],['Inspect: moving oil','oil'],['Inspect: RGB filters','filters'],['Inspect: combined color','result']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart = {id:'result',label:'Inspect the combined color',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.covers.push(g.filters,g.water);result.initialCutaway=false;
  result.initialPart='assembly';result.initialView='front';result.initialIsolated=true;result.frameVisibleOnly=true;result.framePadding=.56;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[.35,.5,8],iso:[3,2.8,6]};result.partViewDirections=Object.fromEntries(result.parts.map(part=>[part.id,{front:['oil','water','coating','electrodes','reflectors'].includes(part.id)?[1.2,-2.5,6]:[.35,.5,8]}]));
  for(const part of result.parts)part.framePadding=part.id==='assembly'?.52:.60;
  kit.root.updateMatrixWorld(true);
  const sceneSize=new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()),assemblySize=new THREE.Box3().setFromObject(g.assembly).getSize(new THREE.Vector3());
  result.overviewZoom=Math.max(sceneSize.x,sceneSize.y,sceneSize.z)*.7/(Math.max(assemblySize.x,assemblySize.y,assemblySize.z)*.52);
  result.catalogParts=result.parts.filter(part=>!['system','assembly'].includes(part.id));result.topology=g;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}
