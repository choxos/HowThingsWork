import {neighborhoodCatalog} from './published-catalog.js';
import {groupCatalogEntries,previewOf} from './catalog-hierarchy.js';
import {scenePageSize, sceneSpots} from './scene-locations.js';
import {allEntries, entriesByName, placesById, escapeText, shortName, illustration, renderPlan} from './catalog.js';
import {imageUrl} from './image-url.js';
import {stopContinuousZoom} from './house-zoom.js';
function zoomBlend(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
function nearestZoomTarget(targets, x, y) {
  return targets.reduce((best, item) => Math.hypot(item.x-x,item.y-y) < Math.hypot(best.x-x,best.y-y) ? item : best);
}
function zoomMarkup() {
  return `<div class="plan-art"><div class="zoom-scene" tabindex="0" role="region" aria-label="Zoomable neighborhood. Point at a place and scroll up, or pinch out. Plus and minus keys also zoom."><div class="zoom-layer zoom-exterior"><img src="${imageUrl('neighborhood')}" alt="Painted neighborhood with links to finished discoveries.">${neighborhoodCatalog.places.map(p=>`<a href="#place/${p.id}" data-place="${p.id}" style="left:${p.x}%;top:${p.y}%">${escapeText(p.name)}</a>`).join('')}</div><div class="zoom-layer zoom-interior"></div><section class="zoom-layer zoom-machine" aria-label="Inside the machine"></section><span class="zoom-stage-label"></span></div><div class="zoom-tools"><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="home">Neighborhood</button><output aria-live="polite"></output></div><p class="zoom-help">Point, then scroll up to look closer. Pinch out on touch screens. Scroll down to pull back.</p><div class="zoom-room-picker" hidden><label for="zoom-room">Look around</label><select id="zoom-room"></select></div></div>`;
}
let disposeZoom = () => {};
let previewModules;
function acceptedPreviews(){
  return previewModules ||= Promise.all([import('./machine-viewer.js'),import('./house.js'),import('./house-components.js')]).then(([viewer,house,{houseComponents}])=>({render:(container,entries)=>viewer.renderRoomMachines(container,entries.map(entry=>previewOf(entry,houseComponents)),house.createHouseModel)}));
}
function houseIntroMarkup(place) {
  return `<span class="badge">Look around</span><h1 tabindex="-1">The house</h1><p class="intro">${escapeText(place.description)}</p><p class="intro">Point at a room and zoom closer. Then move toward an object to find the mechanism inside.</p><a class="primary" href="#list">All machines & ideas</a><p class="plan-note">Choose a room in the illustration, or browse the rooms below.</p>`;
}
function interiorDrawing(place) {
  return `<img class="room-background" src="${imageUrl(`${place.id==='home'?'house':place.id}-interior`)}" alt="Illustrated interior of ${escapeText(place.name.toLowerCase())}, with furnishings and space to explore.">`;
}
function bindZoom(initialPlace,initialEntry) {
  const scene=document.querySelector('.zoom-scene');
  if(!scene) return;
  const exterior=scene.querySelector('.zoom-exterior'), interior=scene.querySelector('.zoom-interior'), machine=scene.querySelector('.zoom-machine');
  const picker=document.querySelector('.zoom-room-picker'), select=picker.querySelector('select');
  const navigation=document.createElement('div');navigation.className='zoom-navigation';
  navigation.append(document.querySelector('.zoom-tools'),document.querySelector('.zoom-help'),picker);
  scene.closest('.plan-layout').after(navigation);
  const modulePromise=acceptedPreviews();
  const intro=document.querySelector('.plan-intro'), initialIntro=initialPlace?'<span class="badge">Explore the neighborhood</span><h1 tabindex="-1">A little neighborhood.<br>A world to discover.</h1><p class="intro">Zoom toward a place, look around inside, then move closer to a machine.</p><a class="primary" href="#list">All machines & ideas</a>':intro.innerHTML;
  let houseHandoff=false,machineHandoff=false,disposed=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let depth=initialEntry?2:initialPlace?1:0, place=initialPlace||neighborhoodCatalog.places[0], objects=[], chosen, lastStage='', frame=0;
  const pointers=new Map();
  let pinchDistance=0;
  // Every item, each machine followed by its parts, so a room's pages show all of them.
  const sceneEntries=groupCatalogEntries(allEntries).flatMap(({entry,components})=>[entry,...components]);
  function placeEntries(room='') {
    return place.id==='home'?[]:room?sceneEntries.filter(entry=>entry.place===place.id&&entry.room===room):[...new Map(place.featured.map(name=>groupCatalogEntries(allEntries,[entriesByName.get(name)])[0]?.entry).filter(Boolean).map(entry=>[entry.id,entry])).values()];
  }
  function populate(room='') {
    const entries=placeEntries(room);
    const page=Number(select.selectedOptions[0]?.dataset.page||0);
    const shown=entries.slice(page*scenePageSize,(page+1)*scenePageSize),spots=sceneSpots(place.id,shown.map(entry=>entry.id));
    objects=shown.map((entry,i)=>{
      const [x,y,w,h,painted=false]=spots[i];
      return {...entry,x,y,w,h,painted};
    });
    interior.innerHTML=interiorDrawing(place)+objects.map(entry=>`<button class="zoom-object ${entry.painted?'painted-object':''}" data-machine="${entry.id}" style="left:${entry.x}%;top:${entry.y}%;width:${entry.w}%;height:${entry.h}%" aria-label="Zoom into ${escapeText(entry.name)}">${illustration(entry.name)}<span style="white-space:normal;min-width:4.5rem;max-width:100%;box-sizing:border-box">${escapeText(shortName(entry.name))}</span></button>`).join('');
    const background=interior.querySelector('img');
    background.addEventListener('load',()=>{if(!disposed&&background.isConnected)paint();},{once:true});
    const currentObjects=objects;
    modulePromise.then(module=>{if(!disposed&&interior.isConnected&&objects===currentObjects)module.render(interior,currentObjects);}).catch(()=>{});
    chosen=objects[0];
  }
  function setPlace(next) {
    place=next;
    const rooms=[...new Set(sceneEntries.filter(e=>e.place===place.id).map(e=>e.room))];
    select.innerHTML=['',...rooms].flatMap(room=>Array.from({length:Math.max(1,Math.ceil(placeEntries(room).length/scenePageSize))},(_,page)=>`<option value="${escapeText(room)}" data-page="${page}">${escapeText(room||'Featured machines')}${page?' · continued '+(page+1):''}</option>`)).join('');
    populate();
  }
  function paint() {
    if(disposed)return;
    if(depth>=1.65&&chosen){
      if(!machineHandoff){
        machineHandoff=true;cancelAnimationFrame(frame);stopContinuousZoom();
        scene.dataset.handoffRoute=`#machine/${chosen.id}`;
        if(location.hash===scene.dataset.handoffRoute)renderPlan();else location.hash=scene.dataset.handoffRoute;
      }
      return;
    }
    const home=place.id==='home',background=interior.querySelector('img');
    const roomFade=home&&!(background.complete&&background.naturalWidth)?0:zoomBlend(depth,.35,.9), machineFade=zoomBlend(depth,1.35,1.9);
    exterior.style.opacity=1-roomFade;
    exterior.style.transform=motion.matches?'none':`translate(${(50-place.x)*depth*1.3}%,${(50-place.y)*depth*1.3}%) scale(${1+depth*1.3})`;
    interior.style.opacity=roomFade*(1-machineFade);
    const approach=Math.max(0,depth-1);
    interior.style.transform=motion.matches?'none':`translate(${(50-(chosen?.x||50))*approach*1.5}%,${(50-(chosen?.y||50))*approach*1.5}%) scale(${.86+.14*Math.min(depth,1)+approach*1.5})`;
    machine.style.opacity=machineFade;
    machine.style.transform=`scale(${.9+.1*machineFade})`;
    const stage=depth<.65?'neighborhood':'place';
    exterior.inert=stage!=='neighborhood';interior.inert=stage!=='place';machine.inert=stage!=='machine';
    exterior.style.pointerEvents=stage==='neighborhood'?'auto':'none';interior.style.pointerEvents=stage==='place'?'auto':'none';machine.style.pointerEvents=stage==='machine'?'auto':'none';
    scene.dataset.stage=stage;picker.hidden=home||stage!=='place';
    scene.querySelector('.zoom-stage-label').textContent=stage==='neighborhood'?'The neighborhood':place.name;
    if(stage!==lastStage){
      document.querySelector('.zoom-tools output').textContent=stage==='neighborhood'?'Neighborhood → rooms → machine':`Inside ${place.name.toLowerCase()}`;
      if(stage==='neighborhood')intro.innerHTML=initialIntro;
      if(stage==='place'&&home)intro.innerHTML=houseIntroMarkup(place);
      if(stage==='place'&&!home)intro.innerHTML=`<span class="badge">Look around</span><h1 tabindex="-1">${escapeText(place.name)}</h1><p class="intro">${escapeText(place.description)}</p><p class="intro">Point at a machine and zoom closer to turn it around and look inside.</p><a class="primary" href="#list">All machines & ideas</a><p class="plan-note">Choose a room below the illustration to explore the collection.</p>`;
      const destination=stage==='neighborhood'?'#neighborhood':`#place/${place.id}`;
      if(!(home&&stage==='place')&&location.hash!==destination)history.pushState(null,'',destination);
      document.title=`${stage==='neighborhood'?'The neighborhood':place.name} · How Things Work`;
      lastStage=stage;
    }
    if(home&&depth>=1&&!houseHandoff){
      houseHandoff=true;
      Promise.all([import('./house.js'),background.decode()]).then(()=>{
        requestAnimationFrame(()=>{
          houseHandoff=false;
          if(disposed||!scene.isConnected||place.id!=='home'||depth<1)return;
          scene.dataset.handoffRoute='#place/home';
          if(location.hash==='#place/home')renderPlan();else location.hash='place/home';
        });
      }).catch(()=>{houseHandoff=false;if(!disposed)document.querySelector('.zoom-tools output').textContent='The house could not load. Zoom out and try again.';});
    }
  }
  function change(amount,x=50,y=50) {
    cancelAnimationFrame(frame);
    if(depth<.3&&amount>0){const next=nearestZoomTarget(neighborhoodCatalog.places,x,y);if(next.id!==place.id)setPlace(next);}
    if(objects.length&&depth>=.85&&depth<1.25&&amount>0){const next=nearestZoomTarget(objects,x,y);if(next&&next.id!==chosen?.id){chosen=next;}}
    depth=Math.max(0,Math.min(place.id==='home'||!objects.length?1:2,depth+amount));paint();
  }
  function travel(target) {
    cancelAnimationFrame(frame);
    target=Math.min(place.id==='home'||!objects.length?1:2,target);
    if(motion.matches){depth=target;paint();return;}
    const from=depth,start=performance.now();
    function tick(now){if(disposed)return;const t=Math.min(1,(now-start)/650);depth=from+(target-from)*zoomBlend(t,0,1);paint();if(t<1&&scene.isConnected)frame=requestAnimationFrame(tick);}
    frame=requestAnimationFrame(tick);
  }
  function point(event){const box=scene.getBoundingClientRect();return {x:(event.clientX-box.left)/box.width*100,y:(event.clientY-box.top)/box.height*100};}
  scene.addEventListener('wheel',event=>{if(event.target.closest('input,select'))return;event.preventDefault();const p=point(event);const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?scene.clientHeight:1);change(Math.max(-.16,Math.min(.16,-pixels*.0025)),p.x,p.y);},{passive:false});
  scene.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.target.closest('input'))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);scene.setPointerCapture(event.pointerId);}});
  scene.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size!==2)return;const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);const p=point({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2});change((distance-pinchDistance)*.006,p.x,p.y);pinchDistance=distance;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(type,event=>{pointers.delete(event.pointerId);});
  scene.addEventListener('keydown',event=>{if(event.target!==scene)return;if(['+','=','-','Escape'].includes(event.key)){event.preventDefault();travel(event.key==='Escape'?0:Math.max(0,Math.min(2,depth+(event.key==='-'?-1:1))));}});
  scene.addEventListener('click',event=>{const building=event.target.closest('[data-place]'),object=event.target.closest('[data-machine]');if(building){event.preventDefault();setPlace(placesById.get(building.dataset.place));travel(1);}if(object){chosen=objects.find(e=>e.id===object.dataset.machine);travel(2);}});
  document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>travel(button.dataset.zoom==='home'?0:Math.max(0,Math.min(2,depth+(button.dataset.zoom==='out'?-1:1))))));
  select.addEventListener('change',()=>{populate(select.value);depth=1;paint();});
  setPlace(place);
  if(initialEntry){
    const roomEntries=sceneEntries.filter(e=>e.place===place.id&&e.room===initialEntry.room);
    const page=Math.floor(roomEntries.findIndex(e=>e.id===initialEntry.id)/scenePageSize);
    select.selectedIndex=[...select.options].findIndex(option=>option.value===initialEntry.room&&Number(option.dataset.page)===page);
    populate(initialEntry.room);chosen=objects.find(e=>e.id===initialEntry.id)||initialEntry;
  }
  disposeZoom=()=>{disposed=true;cancelAnimationFrame(frame);pointers.clear();};
  paint();
}

export {zoomMarkup, bindZoom, disposeZoom, houseIntroMarkup};
