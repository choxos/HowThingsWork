import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPartExplosion} from './part-explosion.js';
import {neighborhoodCatalog} from './published-catalog.js';
import {houseComponents} from './house-components.js';
const families=[['electronic','createElectronicModel'],['daily-life','createDailyLifeMachine'],['kitchen','createKitchenModel'],['time','createTimeModel'],['utility','createUtilityModel'],['safety','createSafetyModel'],['cleaning','createCleaningModel'],['heating','createHeatingModel'],['study','createStudyModel'],['play','createPlayModel']];
const factories=[];for(const [file,name] of families)factories.push((await import(`./${file}-models.js`))[name]);
const create=name=>{for(const f of factories){const model=f(name);if(model)return model;}throw Error(name);};
const snapshot=root=>{const rows=[];root.updateMatrixWorld(true);root.traverse(o=>rows.push([o.uuid,o.parent?.uuid,o.visible,...o.matrixWorld.elements]));return rows;};
// Root-owned arrows and contact meshes must not merge unrelated assemblies.
{
 const model=create('Platform scale'),camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,100);
 model.root.add(new THREE.Mesh(new THREE.BoxGeometry(.01,.01,.01),new THREE.MeshBasicMaterial()));
 const view=createPartExplosion(model,camera);
 const category=id=>view.items.find(unit=>unit.id===id)?.category;
 try{
  assert.equal(category('__structure'),'__structure','Unowned geometry retains its own structural category');
  assert.notEqual(category('beam'),category('system'),'Root helpers do not collapse the beam category');
  assert.notEqual(category('beam'),category('platform'),'Separate mechanisms keep distinct categories');
  assert.equal(category('poise'),category('beam'),'Poise stays with its calibrated beam');
  assert.equal(category('graduations'),category('beam'),'Graduations stay with the beam');
  assert.equal(category('load'),category('platform'),'Payload stays with the platform');
  assert.equal(category('flywheel'),category('lower'),'Flywheel stays with the lower shaft');
 }finally{view.dispose();model.dispose();}
}
// Unused line-buffer coordinates and invisible materials are not drawn parts.
{
 const root=new THREE.Group(),geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1,1,0),new THREE.Vector3(2,2,0),new THREE.Vector3(100,100,0)]);
 geometry.setDrawRange(0,2);
 root.add(new THREE.Line(geometry,new THREE.LineBasicMaterial()));
 const hidden=new THREE.Mesh(new THREE.BoxGeometry(99,99,99),new THREE.MeshBasicMaterial());hidden.material.visible=false;root.add(hidden);
 const view=createPartExplosion({root,parts:[]},new THREE.OrthographicCamera());
 assert.equal(view.items.length,1);assert.equal(view.bounds.max.x,2);assert.equal(view.bounds.max.y,2);
 view.dispose();root.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
}
// Solid conceptual subregions remain attached; real paired handles come apart.
for(const [name,id,count] of [['Bottle opener','bottle',1],['Bottle opener','opener',1],['Tweezers','tool',1],['Nutcracker','handles',2],['Nutcracker','jaws',2],['Zipper','tooth-1',1]]){
 const model=create(name),view=createPartExplosion(model,new THREE.OrthographicCamera());
 assert.equal(view.items.filter(unit=>unit.id===id).length,count,name+': physical unit '+id);
 if(name==='Bottle opener')assert.ok(view.boundsFor('neck').getSize(new THREE.Vector3()).y>1,'Nested part remains inspectable inside its solid object');
 view.dispose();model.dispose();
}
let routes=0,layouts=0,meshes=0;
// Separate physical pieces without tearing a bent conductor or printed marks apart.
{
 const model=create('Circuit breaker'),camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,100);
 const view=createPartExplosion(model,camera);
 try{
  for(const [id,count] of Object.entries({'arc-chute':5,frame:2,magnet:3,wiring:4,plunger:1,supply:1}))
   assert.equal(view.items.filter(unit=>unit.id===id).length,count,'Circuit breaker: '+id+' physical pieces');
  view.update(1);
  assert.equal(view.root.children.find(child=>child.isLineSegments).visible,false,'Full separation removes overlapping seat guides');
 }finally{view.dispose();model.dispose();}
}
for(const entry of neighborhoodCatalog.entries){
 const component=houseComponents[entry.name],model=component?.createModel?.()||create(component?.machine||entry.name);
 if(component?.values)model.update(component.values);
 const initial=snapshot(model.root),state=JSON.stringify(model.getState?.());
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,100);camera.position.set(8,5,12);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const originalResources=new Set();model.root.traverse(o=>{if(o.geometry)originalResources.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])originalResources.add(m);});
 let disposed=0;for(const r of originalResources)r.addEventListener('dispose',()=>disposed++);
 for(const aspect of [.7,1,1.5,2]){
  const view=createPartExplosion(model,camera,aspect);
  assert.ok(view.items.length,entry.name+' visible parts');
  const cells=view.categories.map(c=>({x:c.slotX,y:c.slotY,width:c.across,height:c.down}));
  for(const c of cells){assert.ok([c.x,c.y,c.width,c.height].every(Number.isFinite));assert.ok(c.width>0&&c.height>0);}
  for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){
   const a=cells[i],b=cells[j];assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-8||Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-8,entry.name+' category blocks do not overlap');
  }
  for(const amount of [0,.2,.4,.75,1,.5,0]){
   view.update(amount);view.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),entry.name+' finite view'));
   assert.deepEqual(snapshot(model.root),initial,entry.name+' original transforms and visibility preserved');
   assert.equal(JSON.stringify(model.getState?.()),state,entry.name+' simulation state preserved');
   if(amount===0)for(const unit of view.items)assert.ok(unit.group.position.length()<1e-10,entry.name+' exact reassembly');
  }
  const again=createPartExplosion(model,camera,aspect);assert.deepEqual(again.items.map(u=>[u.id,u.destination.toArray()]),view.items.map(u=>[u.id,u.destination.toArray()]),entry.name+' deterministic layout');again.dispose();
  for(const unit of view.items)assert.ok(Math.abs(unit.destination.clone().sub(unit.center).applyQuaternion(view.orientation.clone().invert()).z)<1e-8,entry.name+' keeps real depth');
  for(const category of view.categories){const units=category.items;for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){const a=category.inner.get(units[i]),b=category.inner.get(units[j]);assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2-1e-8||Math.abs(a.y-b.y)>=(a.h+b.h)/2-1e-8,entry.name+' projected parts do not overlap');}}
  for(const unit of view.items){assert.ok(unit.path.every(p=>model.parts.includes(p)));meshes+=unit.group.children.length;for(const copy of unit.group.children)assert.ok(originalResources.has(copy.geometry));}
  view.dispose();assert.equal(disposed,0,entry.name+' borrowed resources retained');layouts++;
 }
 model.dispose();routes++;
}
console.log(JSON.stringify({result:'PASS',routes,layouts,meshes,checks:'finite transforms, separate category blocks, deterministic placement, exact reassembly, unchanged simulation, borrowed resource ownership'},null,2));
