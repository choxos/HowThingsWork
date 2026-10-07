import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {houseComponents} from './house-components.js';
import {housePresentationMetadata,houseRouteLoaders,housePreviewLoaders} from './house-route-data.js';

const families=[['electronic','electronicLessons','createElectronicModel'],['daily-life','dailyLifeLessons','createDailyLifeMachine'],['kitchen','kitchenLessons','createKitchenModel'],['time','timeLessons','createTimeModel'],['utility','utilityLessons','createUtilityModel'],['safety','safetyLessons','createSafetyModel'],['cleaning','cleaningLessons','createCleaningModel'],['heating','heatingLessons','createHeatingModel'],['study','studyLessons','createStudyModel'],['play','playLessons','createPlayModel']];
const lessons={},factories=[];
for(const [file,name,factory] of families){
 Object.assign(lessons,(await import(`./${file}-lessons.js`))[name]);
 factories.push((await import(`./${file}-models.js`))[factory]);
}
const createHouseModel=name=>{for(const factory of factories){const model=factory(name);if(model)return model;}return null;};
const stringify=value=>JSON.stringify(value,(_,value)=>typeof value==='function'?value.toString():value&&Object.getPrototypeOf(value)===Object.prototype?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
const digest=value=>createHash('sha256').update(value).digest('hex');
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);

function modelSnapshot(model){
 model.root.updateMatrixWorld(true);
 const graph=[];
 model.root.traverse(object=>{
  const geometry=object.geometry;
  const attributes=geometry?Object.fromEntries(Object.entries(geometry.attributes).map(([key,attribute])=>[key,{
   itemSize:attribute.itemSize,normalized:attribute.normalized,offset:attribute.offset??null,
   stride:attribute.data?.stride??null,data:digest(bytes(attribute.array||attribute.data.array)),
  }])):null;
  const materials=(Array.isArray(object.material)?object.material:[object.material]).filter(Boolean).map(material=>({
   type:material.type,color:material.color?.getHex(),emissive:material.emissive?.getHex(),opacity:material.opacity,
   transparent:material.transparent,side:material.side,roughness:material.roughness,metalness:material.metalness,
  }));
  graph.push({type:object.type,name:object.name,visible:object.visible,position:object.position.toArray(),
   quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),children:object.children.length,
   attributes,index:geometry?.index?digest(bytes(geometry.index.array)):null,materials});
 });
 return {
  name:model.root.userData.machine,defaults:model.defaults,controls:JSON.parse(stringify(model.controls)),
  values:model.getState?.().values,parts:model.parts.map(part=>({id:part.id,name:part.name,framePadding:part.framePadding})),
  graphHash:digest(JSON.stringify(graph)),objects:graph.length,
 };
}

assert.deepEqual(Object.keys(houseRouteLoaders).sort(),catalog.entries.map(entry=>entry.id).sort(),'Only published routes have runtime loaders');
assert.deepEqual(Object.keys(housePreviewLoaders).sort(),Object.keys(houseRouteLoaders).sort(),'Every route retains its preview');
const cases=[];
for(const entry of catalog.entries){
 const expectedComponent=houseComponents[entry.name],group=catalog.groups.find(group=>group.items.includes(entry.name));
 const canonicalName=expectedComponent?.machine||(lessons[entry.name]?entry.name:group?.items[0]);
 const loaded=await houseRouteLoaders[entry.id]();
 assert.equal(loaded.name,entry.name);assert.equal(loaded.canonicalName,canonicalName);
 assert.equal(loaded.canonicalLesson,lessons[canonicalName],entry.id+': same original lesson object');
 assert.equal(stringify(loaded.component),stringify(expectedComponent),entry.id+': exact descriptor and factory wrapper source');
 if(expectedComponent?.lesson)assert.equal(loaded.component.lesson,expectedComponent.lesson,entry.id+': same component lesson object');
 assert.deepEqual(housePresentationMetadata.allLessons[entry.name],lessons[entry.name]?{simple:lessons[entry.name].simple}:undefined);
 assert.deepEqual(housePresentationMetadata.houseComponents[entry.name],expectedComponent?Object.fromEntries(['machine','intro','redirectTo'].filter(key=>expectedComponent[key]!==undefined).map(key=>[key,expectedComponent[key]])):undefined);
 const preview=await housePreviewLoaders[entry.id]();
 const previewComponent=expectedComponent?Object.fromEntries(['machine','createModel','part','values','initialState'].filter(key=>expectedComponent[key]!==undefined).map(key=>[key,expectedComponent[key]])):undefined;
 assert.equal(preview.name,entry.name);
 assert.equal(stringify(preview.component),stringify(previewComponent),entry.id+': preview descriptor retains model, part, values and initial state');
 const row={id:entry.id,canonicalName,metadataMatches:true,previewMatches:true};
 if(process.argv.includes('--models')&&!expectedComponent?.redirectTo){
  const expected=expectedComponent?.createModel?.()||createHouseModel(canonicalName);
  const actual=loaded.component?.createModel?.()||loaded.createHouseModel(canonicalName);
  assert(expected&&actual,entry.id+': model exists');
  try{
   for(const model of [expected,actual]){
    if(expectedComponent?.initialState)model.reset(structuredClone(expectedComponent.initialState));
    if(expectedComponent?.values)model.update({...model.defaults,...expectedComponent.values});
   }
   const reference=modelSnapshot(expected),candidate=modelSnapshot(actual);
   assert.deepEqual(candidate,reference,entry.id+': same defaults, controls, initial values and complete geometry');
   row.modelMatches=true;row.objects=candidate.objects;row.graphHash=candidate.graphHash;
  }finally{expected.dispose();actual.dispose();}
 }
 cases.push(row);
 console.log('PASS house route '+entry.id+(row.modelMatches?' with model parity':''));
}
const report={passed:true,routes:cases.length,modelComparisons:cases.filter(row=>row.modelMatches).length,cases};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/report.json',JSON.stringify(report,null,2));}
console.log('PASS '+report.routes+' published route descriptors; '+report.modelComparisons+' native model comparisons');
