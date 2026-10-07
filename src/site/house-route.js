import {housePresentationMetadata,houseRouteLoaders,housePreviewLoaders} from './house-route-data.js';
import {mountHousePresentation} from './house-presentation.js';
import {previewOf} from './catalog-hierarchy.js';
import {renderRoomMachines} from './machine-viewer.js';

const loadedRoutes=new Map(),loadedPreviews=new Map();

export function loadHouseRoute(id){
 if(!Object.hasOwn(houseRouteLoaders,id))return Promise.reject(new Error('Unknown house lesson: '+id));
 if(!loadedRoutes.has(id))loadedRoutes.set(id,houseRouteLoaders[id]().catch(error=>{loadedRoutes.delete(id);throw error;}));
 return loadedRoutes.get(id);
}

function loadHousePreview(id){
 if(loadedRoutes.has(id))return loadedRoutes.get(id);
 if(!Object.hasOwn(housePreviewLoaders,id))return Promise.reject(new Error('Unknown house preview: '+id));
 if(!loadedPreviews.has(id))loadedPreviews.set(id,housePreviewLoaders[id]().catch(error=>{loadedPreviews.delete(id);throw error;}));
 return loadedPreviews.get(id);
}

function previewMessage(targets,lines){
 for(const target of targets){
  const placeholder=target.querySelector('svg');
  if(!placeholder)continue;
  placeholder.replaceChildren(...lines.map((line,index)=>{
   const text=document.createElementNS('http://www.w3.org/2000/svg','text');
   text.setAttribute('x','180');text.setAttribute('y',String(130+index*48));text.setAttribute('text-anchor','middle');
   text.setAttribute('font-size','40');text.setAttribute('fill','currentColor');text.textContent=line;
   return text;
  }));
 }
}

export function renderVisibleRoomPreviews(host,entries){
 let disposed=false,observer;
 const pending=new Set(),targets=new Map();
 for(const entry of entries){
  const elements=[...host.querySelectorAll(`[data-machine="${entry.id}"]`)];
  if(elements.length)targets.set(entry.id,elements);
 }
 async function load(id){
  if(disposed||pending.has(id))return;
  pending.add(id);
  const elements=targets.get(id);
  for(const element of elements){observer?.unobserve(element);element.setAttribute('aria-busy','true');}
  previewMessage(elements,['Loading','preview…']);
  try{
   const route=await loadHousePreview(id);
   if(disposed||!host.isConnected)return;
   const components={[route.name]:route.component};
   renderRoomMachines(host,[previewOf({id,name:route.name},components)],route.createHouseModel);
   if(!elements.some(element=>element.querySelector('.machine-thumbnail')))throw new Error('Preview unavailable');
   for(const element of elements)element.dataset.previewState='ready';
  }catch{
   if(disposed||!host.isConnected)return;
   previewMessage(elements,['Preview','unavailable']);
   for(const element of elements){element.dataset.previewState='failed';element.title='Preview unavailable. Reload this page to try again.';}
  }finally{
   if(!disposed)for(const element of elements)element.removeAttribute('aria-busy');
  }
 }
 if(typeof IntersectionObserver==='undefined'){
  for(const id of targets.keys())void load(id);
 }else{
  observer=new IntersectionObserver(changes=>{
   for(const change of changes)if(change.isIntersecting)void load(change.target.dataset.machine);
  },{rootMargin:'100px'});
  for(const elements of targets.values())for(const element of elements)observer.observe(element);
 }
 return()=>{disposed=true;observer?.disconnect();};
}

const navigationRuntime={...housePresentationMetadata,createHouseModel:()=>null,renderRoomPreviews:renderVisibleRoomPreviews};

export async function prepareRoomPreviews(catalog){
 if(import.meta.env?.DEV&&catalog.entries.some(entry=>!Object.hasOwn(houseRouteLoaders,entry.id))){
  const [house,{houseComponents}]=await Promise.all([import('./house.js'),import('./house-components.js')]);
  return(host,entries)=>renderRoomMachines(host,entries.map(entry=>previewOf(entry,houseComponents)),house.createHouseModel);
 }
 return renderVisibleRoomPreviews;
}

export async function prepareHouseRoute(route,catalog){
 if(import.meta.env?.DEV&&catalog.entries.some(entry=>!Object.hasOwn(houseRouteLoaders,entry.id))){
  return {legacy:await import('./house.js')};
 }
 if(!route.startsWith('machine/'))return navigationRuntime;
 const loaded=await loadHouseRoute(route.slice(8));
 return {
  ...navigationRuntime,
  allLessons:{...housePresentationMetadata.allLessons,[loaded.canonicalName]:loaded.canonicalLesson},
  houseComponents:{...housePresentationMetadata.houseComponents,[loaded.name]:loaded.component},
  createHouseModel:loaded.createHouseModel,
 };
}

export function mountHouse(host,route,catalog,options={},runtime=navigationRuntime){
 if(runtime.legacy)return runtime.legacy.mountHouse(host,route,catalog,options);
 return mountHousePresentation(host,route,catalog,options,runtime);
}
