import {neighborhoodCatalog} from './catalog-data.js';
import {allEntries, entriesByName, placesById, principlesById, escapeText, shortName, illustration, sampleDescriptions, renderPlan} from './catalog.js';
import {imageUrl} from './image-url.js';
function zoomBlend(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
function nearestZoomTarget(targets, x, y) {
  return targets.reduce((best, item) => Math.hypot(item.x-x,item.y-y) < Math.hypot(best.x-x,best.y-y) ? item : best);
}
function zoomMarkup() {
  return `<div class="plan-art"><div class="zoom-scene" tabindex="0" role="region" aria-label="Zoomable neighborhood. Point at a place and scroll up, or pinch out. Plus and minus keys also zoom."><div class="zoom-layer zoom-exterior"><img src="${imageUrl('neighborhood')}" alt="Painted neighborhood with six places to explore.">${neighborhoodCatalog.places.map(p=>`<a href="#place/${p.id}" data-place="${p.id}" style="left:${p.x}%;top:${p.y}%">${escapeText(p.name)}</a>`).join('')}</div><div class="zoom-layer zoom-interior"></div><section class="zoom-layer zoom-machine" aria-label="Inside the machine"></section><span class="zoom-stage-label"></span></div><div class="zoom-tools"><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="home">Neighborhood</button><output aria-live="polite"></output></div><p class="zoom-help">Point, then scroll up to look closer. Pinch out on touch screens. Scroll down to pull back.</p><div class="zoom-room-picker" hidden><label for="zoom-room">Look around</label><select id="zoom-room"></select></div></div>`;
}
let disposeZoom = () => {};
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
  const modulePromise=import('./machine-viewer.js');
  const intro=document.querySelector('.plan-intro'), initialIntro=initialPlace?'<span class="badge">Explore the neighborhood</span><h1 tabindex="-1">A little neighborhood.<br>A world to discover.</h1><p class="intro">Zoom toward a place, look around inside, then move closer to a machine.</p><a class="primary" href="#list">All machines & ideas</a>':intro.innerHTML;
  let viewer=null,houseHandoff=false,disposed=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let depth=initialEntry?2:initialPlace?1:0, place=initialPlace||neighborhoodCatalog.places[0], objects=[], chosen, lastStage='', frame=0;
  const pointers=new Map();
  let pinchDistance=0;
  function populate(room='') {
    const entries=place.id==='home'?[]:room?allEntries.filter(e=>e.place===place.id&&e.room===room):place.featured.map(name=>entriesByName.get(name));
    const page=Number(select.selectedOptions[0]?.dataset.page||0);
    const locations={
      home:[[23,26,18,24],[51,32,18,30],[80,26,17,21],[24,63,12,19],[51,56,13,19],[81,68,17,26]],
      workshop:[[26,47,18,22],[37,37,16,24,1],[43,67,23,36],[51,42,21,23],[83,55,21,22],[76,41,22,31]],
      discovery:[[21,53,17,20],[15,27,13,20],[46,40,20,28],[66,16,20,25],[71,46,21,28],[43,13,25,25,1]],
      studio:[[25,53,34,36],[49,27,11,20,1],[34,24,19,20,1],[73,27,16,29],[58,65,19,33],[81,59,17,18]],
      river:[[50,89,32,20],[46,36,22,20],[8,24,14,28,1],[23,62,25,47,1],[83,40,15,24,1],[62,42,22,20]],
      park:[[26,25,23,34],[64,14,20,26],[45,48,25,23],[83,31,23,21],[25,59,23,22],[57,66,13,13,1]]
    }[place.id];
    objects=entries.slice(page*6,page*6+6).map((entry,i)=>{const [x,y,w,h,painted]=locations[i];return {...entry,x,y,w,h,painted:!room&&painted};});
    interior.innerHTML=interiorDrawing(place)+objects.map(entry=>`<button class="zoom-object ${entry.painted?'painted-object':''}" data-machine="${entry.id}" style="left:${entry.x}%;top:${entry.y}%;width:${entry.w}%;height:${entry.h}%" aria-label="Zoom into ${escapeText(entry.name)}">${illustration(entry.name)}<span>${escapeText(shortName(entry.name))}</span></button>`).join('');
    const background=interior.querySelector('img');
    background.addEventListener('load',()=>{if(!disposed&&background.isConnected)paint();},{once:true});
    const currentObjects=objects;
    modulePromise.then(module=>{if(!disposed&&interior.isConnected&&objects===currentObjects)module.renderRoomMachines(interior,currentObjects);}).catch(()=>{});
    chosen=objects[0];
    showMachine();
  }
  function setPlace(next) {
    place=next;
    const rooms=[...new Set(allEntries.filter(e=>e.place===place.id).map(e=>e.room))];
    select.innerHTML='<option value="">Featured machines</option>'+rooms.flatMap(room=>Array.from({length:Math.ceil(allEntries.filter(e=>e.place===place.id&&e.room===room).length/6)},(_,page)=>`<option value="${escapeText(room)}" data-page="${page}">${escapeText(room)}${page?' · continued '+(page+1):''}</option>`)).join('');
    populate();
  }
  function showMachine() {
    viewer?.dispose();viewer=null;
    if(!chosen) return;
    const study=chosen.relatedStudies[0], current=chosen;
    machine.innerHTML=`<div class="machine-host">${illustration(chosen.name)}</div><div class="machine-footnote"><p class="zoom-reference">${escapeText(principlesById.get(chosen.principle)?.name||'General ideas')}</p>${study?`<a href="studies.html#/topic/${study}">Explore the related principle study</a>`:''}</div>`;
    const host=machine.querySelector('.machine-host');
    modulePromise.then(module=>{if(!disposed&&host.isConnected&&chosen===current){viewer=module.mountMachine(host,current.name);viewer?.setActive(depth>1.35);if(!viewer)host.insertAdjacentHTML('beforeend','<p class="zoom-reference">This entry is catalogued; its 3D model is still to be built.</p>');}}).catch(()=>{if(!disposed&&host.isConnected)host.insertAdjacentHTML('beforeend','<p class="zoom-reference">The 3D model could not load. The illustration and explanation remain available.</p>');});
  }
  function paint() {
    if(disposed)return;
    const home=place.id==='home',background=interior.querySelector('img');
    const roomFade=home&&!(background.complete&&background.naturalWidth)?0:zoomBlend(depth,.35,.9), machineFade=zoomBlend(depth,1.35,1.9);
    exterior.style.opacity=1-roomFade;
    exterior.style.transform=motion.matches?'none':`translate(${(50-place.x)*depth*1.3}%,${(50-place.y)*depth*1.3}%) scale(${1+depth*1.3})`;
    interior.style.opacity=roomFade*(1-machineFade);
    const approach=Math.max(0,depth-1);
    interior.style.transform=motion.matches?'none':`translate(${(50-(chosen?.x||50))*approach*1.5}%,${(50-(chosen?.y||50))*approach*1.5}%) scale(${.86+.14*Math.min(depth,1)+approach*1.5})`;
    machine.style.opacity=machineFade;
    machine.style.transform=`scale(${.9+.1*machineFade})`;
    const stage=depth<.65?'neighborhood':depth<1.65?'place':'machine';
    exterior.inert=stage!=='neighborhood';interior.inert=stage!=='place';machine.inert=stage!=='machine';
    exterior.style.pointerEvents=stage==='neighborhood'?'auto':'none';interior.style.pointerEvents=stage==='place'?'auto':'none';machine.style.pointerEvents=stage==='machine'?'auto':'none';
    scene.dataset.stage=stage;picker.hidden=home||stage!=='place';
    scene.querySelector('.zoom-stage-label').textContent=stage==='neighborhood'?'The neighborhood':stage==='place'?place.name:chosen?.name||'';
    if(stage!==lastStage){
      document.querySelector('.zoom-tools output').textContent=stage==='neighborhood'?'Neighborhood → rooms → machine':stage==='place'?`Inside ${place.name.toLowerCase()}`:'Inside the machine';
      viewer?.setActive(stage==='machine');
      if(stage==='neighborhood')intro.innerHTML=initialIntro;
      if(stage==='place'&&home)intro.innerHTML=houseIntroMarkup(place);
      if(stage==='place'&&!home)intro.innerHTML=`<span class="badge">Look around</span><h1 tabindex="-1">${escapeText(place.name)}</h1><p class="intro">${escapeText(place.description)}</p><p class="intro">Point at a machine and zoom closer to turn it around and look inside.</p><a class="primary" href="#list">All machines & ideas</a><p class="plan-note">Choose a room below the illustration to explore the collection.</p>`;
      if(stage==='machine')intro.innerHTML=`<button class="back" data-return-room>← Back to ${escapeText(place.name.toLowerCase())}</button><span class="badge">Look closer</span><h1 tabindex="-1">${escapeText(chosen.name)}</h1><p class="intro">${escapeText(sampleDescriptions[chosen.name]||'An entry from the collection. Its dedicated illustrated explanation is still to be built.')}</p><p class="plan-note">Cartoon model for exploring the shape and main parts. The moving parts are simplified, not a complete simulation.</p><a class="page-link" href="#list">See the full list</a>`;
      const destination=stage==='neighborhood'?'#neighborhood':stage==='place'?`#place/${place.id}`:`#machine/${chosen.id}`;
      if(!(home&&stage==='place')&&location.hash!==destination)history.pushState(null,'',destination);
      document.title=`${stage==='neighborhood'?'The neighborhood':stage==='place'?place.name:chosen.name} · How Things Work`;
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
    if(objects.length&&depth>=.85&&depth<1.25&&amount>0){const next=nearestZoomTarget(objects,x,y);if(next&&next.id!==chosen?.id){chosen=next;showMachine();}}
    depth=Math.max(0,Math.min(place.id==='home'?1:2,depth+amount));paint();
  }
  function travel(target) {
    cancelAnimationFrame(frame);
    target=Math.min(place.id==='home'?1:2,target);
    if(motion.matches){depth=target;paint();return;}
    const from=depth,start=performance.now();
    function tick(now){if(disposed)return;const t=Math.min(1,(now-start)/650);depth=from+(target-from)*zoomBlend(t,0,1);paint();if(t<1&&scene.isConnected)frame=requestAnimationFrame(tick);}
    frame=requestAnimationFrame(tick);
  }
  function point(event){const box=scene.getBoundingClientRect();return {x:(event.clientX-box.left)/box.width*100,y:(event.clientY-box.top)/box.height*100};}
  scene.addEventListener('wheel',event=>{if(event.target.closest('input,select'))return;event.preventDefault();const p=point(event);const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?scene.clientHeight:1);change(Math.max(-.16,Math.min(.16,-pixels*.0025)),p.x,p.y);},{passive:false});
  scene.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.target.closest('input'))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);viewer?.setInteractionEnabled(false);scene.setPointerCapture(event.pointerId);}});
  scene.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size!==2)return;const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);const p=point({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2});change((distance-pinchDistance)*.006,p.x,p.y);pinchDistance=distance;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(type,event=>{pointers.delete(event.pointerId);if(pointers.size<2)viewer?.setInteractionEnabled(true);});
  scene.addEventListener('keydown',event=>{if(event.target!==scene)return;if(['+','=','-','Escape'].includes(event.key)){event.preventDefault();travel(event.key==='Escape'?0:Math.max(0,Math.min(2,depth+(event.key==='-'?-1:1))));}});
  scene.addEventListener('click',event=>{const building=event.target.closest('[data-place]'),object=event.target.closest('[data-machine]');if(building){event.preventDefault();setPlace(placesById.get(building.dataset.place));travel(1);}if(object){chosen=objects.find(e=>e.id===object.dataset.machine);showMachine();travel(2);}});
  document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>travel(button.dataset.zoom==='home'?0:Math.max(0,Math.min(2,depth+(button.dataset.zoom==='out'?-1:1))))));
  select.addEventListener('change',()=>{populate(select.value);depth=1;paint();});
  intro.addEventListener('click',event=>{if(event.target.closest('[data-return-room]'))travel(1);});
  setPlace(place);
  if(initialEntry){
    const roomEntries=allEntries.filter(e=>e.place===place.id&&e.room===initialEntry.room);
    const page=Math.floor(roomEntries.findIndex(e=>e.id===initialEntry.id)/6);
    select.selectedIndex=[...select.options].findIndex(option=>option.value===initialEntry.room&&Number(option.dataset.page)===page);
    populate(initialEntry.room);chosen=objects.find(e=>e.id===initialEntry.id)||initialEntry;showMachine();
  }
  paint();
  disposeZoom=()=>{disposed=true;cancelAnimationFrame(frame);viewer?.dispose();};
}

export {zoomMarkup, bindZoom, disposeZoom, houseIntroMarkup};
