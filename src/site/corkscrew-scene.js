import * as THREE from 'three';
import {surface, lineObject} from './scene-kit.js';
import {CORK, WORMS} from './corkscrew-physics.js';

// Pieces both corkscrews draw: the bottle neck, the cork, the worm and a force
// chart. One millimeter is 0.02 scene units.

export const MM = 0.02;
export const NECK = Object.freeze({outer: 14.5, bore: CORK.bore / 2, lip: 17, top: 92, springBack: 12});
const TAU = Math.PI * 2;
const RADIUS = [3.5, 2.25];
const WIRE = [1, 0.75];

/**
 * A point at angle phi on the worm's helix, in worm coordinates with the tip at
 * y = 0. The helix is right-handed with one 7 mm pitch a turn, so turning the
 * worm clockwise seen from above by one turn lowers it along its own track.
 */
export function wormTrack(worm) {
  return phi => new THREE.Vector3(RADIUS[worm] * Math.cos(phi) * MM, CORK.pitch * phi / TAU * MM, -RADIUS[worm] * Math.sin(phi) * MM);
}

export function bottleAndCork(kit, parent, covers, {section=false}={}) {
  const bottle = kit.part('bottle', 'Bottle neck', 'The glass squeezes the cork from 24 mm down to its 18.5 mm bore. The front half is cut away so the cork shows.', [0, 0, 0], parent);
  const profile = [[NECK.bore, 0], [NECK.outer, 0], [NECK.outer, NECK.top - 8], [NECK.lip, NECK.top - 6], [NECK.lip, NECK.top], [NECK.bore, NECK.top]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM));
  surface(kit, new THREE.LatheGeometry(profile, 48, Math.PI / 2, Math.PI), 'leaf', bottle, true);
  covers.push(surface(kit, new THREE.LatheGeometry(profile, 48, -Math.PI / 2, Math.PI), 'leaf', bottle, true));
  const cork = kit.part('cork', 'Cork', 'Squeezed to 18.5 mm inside the neck, springing back to 24 mm as it comes out. Friction on the length still inside is what holds it.', [0, 0, 0], parent);
  const inside = kit.cylinder(1, 1, [0, 0, 0], 'wood', cork);
  const outside = kit.cylinder(1, 1, [0, 0, 0], 'wood', cork);
  if(section)for(const mesh of [inside,outside]){
    mesh.geometry.dispose();mesh.geometry=new THREE.CylinderGeometry(1,1,1,48,1,false,Math.PI/2,Math.PI);
    const front=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,48,1,false,-Math.PI/2,Math.PI),mesh.material);mesh.add(front);covers.push(front);
    mesh.add(new THREE.Mesh(new THREE.PlaneGeometry(2,1),mesh.material));
    mesh.material=mesh.material.clone();mesh.material.vertexColors=true;front.material=mesh.material;
  }
  const hole = kit.cylinder(1, 0.4 * MM, [0, 0, 0], 'ink', cork);
  const crumbs = [0, 1, 2, 3, 4].map(i => kit.sphere((0.9 + 0.2 * i) * MM, [0, 0, 0], 'wood', cork));
  let sectionKey='';
  /** Draw the cork `out` millimeters out; a torn cork shows the worm's hole; a pierced one drops crumbs. */
  const set = ({out, torn, worm, pierced, depth=CORK.length, crumbFall}) => {
    const remaining = CORK.length - out;
    inside.scale.set(NECK.bore * MM, Math.max(1e-6, remaining) * MM, NECK.bore * MM);
    inside.position.y = (NECK.top - remaining / 2) * MM;
    inside.visible = remaining > 1e-6;
    outside.scale.set(NECK.springBack * MM, Math.max(1e-6, out) * MM, NECK.springBack * MM);
    outside.position.y = (NECK.top + out / 2) * MM;
    outside.visible = out > 1e-6;
    const radius = WORMS[worm].diameter / 2;
    if(section){
      const key=torn?`${worm}:${depth}`:'solid';
      if(sectionKey!==key){
        sectionKey=key;const r=torn?radius/NECK.bore:0,d=torn?Math.min(depth,CORK.length)/CORK.length:0;
        const profile=[[0,-.5],[1,-.5],[1,.5],[r,.5],[r,.5-d],[0,.5-d]].map(([x,y])=>new THREE.Vector2(x,y));
        const shape=new THREE.Shape();[[-1,-.5],[1,-.5],[1,.5],[r,.5],[r,.5-d],[-r,.5-d],[-r,.5],[-1,.5]].forEach(([x,y],i)=>shape[i?'lineTo':'moveTo'](x,y));shape.closePath();
        for(const [mesh,geometry] of [[inside,new THREE.LatheGeometry(profile,48,Math.PI/2,Math.PI)],[inside.children[0],new THREE.LatheGeometry(profile,48,-Math.PI/2,Math.PI)],[inside.children[1],new THREE.ShapeGeometry(shape)]]){
          if(torn&&mesh!==inside.children[1]){
            const positions=geometry.attributes.position,colors=new Float32Array(positions.count*3);
            for(let i=0;i<positions.count;i++){const cavity=Math.hypot(positions.getX(i),positions.getZ(i))<=r+1e-6&&positions.getY(i)>=.5-d-1e-6;colors.fill(cavity?.55:1,i*3,i*3+3);}
            geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
          }
          mesh.geometry.dispose();mesh.geometry=geometry;
        }
      }
    }
    hole.scale.set(radius * MM, 1, radius * MM);
    hole.position.y = (NECK.top + out + 0.25) * MM;
    hole.visible = torn&&!section;
    crumbs.forEach((crumb, i) => {
      const y=NECK.top-CORK.length-4-i*5+(crumbFall===undefined?out:-crumbFall);
      crumb.visible = pierced&&(crumbFall===undefined||y>0.9+0.2*i);
      crumb.position.set((i - 2) * 2.5 * MM, y * MM, (i % 2 ? 2 : -2) * MM);
    });
  };
  return {bottle, cork, inside, outside, hole, crumbs, set};
}

export function wormPart(kit, parent, description) {
  const worm = kit.part('worm', 'Worm', description, [0, 0, 0], parent);
  const helix = surface(kit, new THREE.BufferGeometry(), 'metal', worm);
  const core = kit.cylinder(1, 1, [0, 0, 0], 'metal', worm);
  const plug = kit.cylinder(1, 1, [0, 0, 0], 'wood', worm);
  let kind = null;
  /** Rebuild for the worm type; a torn cork leaves a plug of cork on the worm. */
  const set = ({type, torn, depth}) => {
    if (kind !== type) {
      kind = type;
      const track = wormTrack(type), points = Array.from({length: Math.ceil(CORK.wormLength / CORK.pitch * 48) + 1}, (_, i) => track(i / 48 * TAU));
      helix.geometry.dispose();
      helix.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 2, WIRE[type] * MM, 8, false);
      core.visible = type === 1;
      core.scale.set(1.5 * MM, CORK.wormLength * MM, 1.5 * MM);
      core.position.y = CORK.wormLength / 2 * MM;
    }
    const plugDepth = Math.min(depth, CORK.length), radius = WORMS[type].diameter / 2;
    plug.visible = torn;
    plug.scale.set(radius * MM, Math.max(1e-6, plugDepth) * MM, radius * MM);
    plug.position.y = plugDepth / 2 * MM;
  };
  return {worm, helix, core, plug, set};
}

/** A small chart of force against how far the cork is out, standing behind the bottle. */
export function forceChart(kit, parent, {id, label, description, width, height, x = 0, y, z, maxForce, labels=false, forceLabel='Push on each wing (N)'}) {
  const chart = kit.part(id, label, description, [(x - width / 2) * MM, y * MM, z * MM], parent);
  kit.box([(width + (labels?36:8)) * MM, (height + (labels?72:8)) * MM, 0.8 * MM], [(width/2-(labels?5:0))*MM, (height/2-(labels?10:0))*MM, -MM], 'cream', chart);
  const textures=[],captions=[];
  const caption=(text,x,y,size=5,color=0x374736)=>{
    const canvas=typeof document==='undefined'?null:document.createElement('canvas');
    const w=Math.max(size,text.length*size*.65)*MM,h=size*2*MM;
    let texture;
    if(canvas){canvas.height=128;canvas.width=Math.ceil(128*w/h);texture=new THREE.CanvasTexture(canvas);}else texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);
    texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));mesh.position.set(x*MM,y*MM,1.2*MM);chart.add(mesh);captions.push(mesh);
    const write=value=>{mesh.userData.labelText=value;if(canvas){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,128);c.font='600 80px sans-serif';c.fillStyle='#'+color.toString(16).padStart(6,'0');c.textAlign='center';c.textBaseline='middle';c.fillText(value,canvas.width/2,64,canvas.width*.96);}texture.needsUpdate=true;};write(text);return write;
  };
  const ticks=[];
  if(labels){
    chart.userData.explosionExcluded=true;
    caption(forceLabel,width/2,height+12,6);
    caption('Cork lift (mm)',width/2,-18,5);
    for(const value of [0,22,44])caption(String(value),value/44*width,-7,5);
    for(const fraction of [0,.5,1])ticks.push({fraction,write:caption('000',-12,fraction*height,5)});
    caption('Blue: needed',width*.22,-29,4.5);caption('Orange: limit',width*.78,-29,4.5);
    caption('Green: tear-out',width*.22,-39,4.5);caption('Dot: actual',width*.78,-39,4.5);
  }
  const setMaxForce=value=>{maxForce=value;ticks.forEach(({fraction,write})=>write(String(fraction*value)));};setMaxForce(maxForce);
  kit.rod([0, 0, 0], [width * MM, 0, 0], 0.4 * MM, 'ink', chart);
  kit.rod([0, 0, 0], [0, height * MM, 0], 0.4 * MM, 'ink', chart);
  const toY = force => Math.min(force, maxForce) / maxForce * height * MM;
  const line = color => lineObject(2, color, chart);
  const setLine = (object, from, to) => {
    object.geometry.attributes.position.array.set([from[0] * width * MM, toY(from[1]), 0.3 * MM, to[0] * width * MM, toY(to[1]), 0.3 * MM]);
    object.geometry.attributes.position.needsUpdate = true;
    object.geometry.computeBoundingSphere();
  };
  const dot = kit.sphere(1.6 * MM, [0, 0, 0], 'red', chart);
  const place = (fraction, force) => dot.position.set(fraction * width * MM, toY(force), 0.6 * MM);
  return {chart, line, setLine, dot, place, toY, setMaxForce, captions, dispose:()=>textures.forEach(t=>t.dispose())};
}
