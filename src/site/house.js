import {groupCatalogEntries,partHref,hasCatalogPart,previewOf} from './catalog-hierarchy.js';
import {houseIntroMarkup} from './zoom.js';
import {imageUrl} from './image-url.js';
import {bindHouseZoom} from './house-zoom.js';
import {electronicLessons} from "./electronic-lessons.js";
import {createElectronicModel} from "./electronic-models.js";
import {houseComponents} from "./house-components.js";
import {createDailyLifeMachine} from './daily-life-models.js';
import {renderRoomMachines} from './machine-viewer.js';
import {playLessons} from './play-lessons.js';
import {createPlayModel} from './play-models.js';
import {cleaningLessons} from './cleaning-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {studyLessons} from './study-lessons.js';
import {createCleaningModel} from './cleaning-models.js';
import {createHeatingModel} from './heating-models.js';
import {createStudyModel} from './study-models.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {kitchenLessons} from './kitchen-lessons.js';
import {timeLessons} from './time-lessons.js';
import {utilityLessons} from './utility-lessons.js';
import {safetyLessons} from './safety-lessons.js';
import {createTimeModel} from './time-models.js';
import {createUtilityModel} from './utility-models.js';
import {createSafetyModel} from './safety-models.js';
import {createKitchenModel} from './kitchen-models.js';
const allLessons={...electronicLessons,...dailyLifeLessons,...kitchenLessons,...timeLessons,...utilityLessons,...safetyLessons,...cleaningLessons,...heatingLessons,...studyLessons,...playLessons};
import {mountDailyLifeViewer} from './daily-life-viewer.js';
export function createHouseModel(name){return createElectronicModel(name)||createDailyLifeMachine(name)||createKitchenModel(name)||createTimeModel(name)||createUtilityModel(name)||createSafetyModel(name)||createCleaningModel(name)||createHeatingModel(name)||createStudyModel(name)||createPlayModel(name);}
const roomTiles={'Kitchen':[0,0],'Measuring and time':[50,0],'Sewing corner':[100,0],'Water and plumbing':[0,50],'Cleaning cupboard':[50,50],'Play and everyday objects':[100,50],'Study':[0,100],'Safety corner':[50,100],'Heating and cooling':[100,100]};
// Pin centers in percent of the house picture; on a phone the labels wrap, so neighbors keep at least a label's width apart.
const roomPositions=[[22,68],[79,32],[60,65],[23,32],[57,35],[81,68],[44,78],[44,56],[85,53],[91,43]];
const roomLabels=['Entrance hall','Kitchen','Time & measuring','Sewing','Water & plumbing','Cleaning','Play','Study','Safety','Heating'];
const thumbnail='<svg viewBox="0 0 360 300" aria-hidden="true"></svg>';


const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const roomNotes={
 'Doors and daily life':'Step into the entrance hall. A key, a coat, and a window shade hide little mechanical puzzles.',
 Kitchen:'Follow force, water, and heat through the tools on the counter.',
 'Measuring and time':'Find out how motion becomes a measurement, and how repeating motion keeps time.',
 'Sewing corner':'Follow one stitch from the needle to the bobbin, then watch the cloth move.',
 'Water and plumbing':'Trace the water from the tap through valves, tanks, and meters.',
 'Cleaning cupboard':'Discover how moving air, water, and electric charge carry dirt away.',
 'Play and everyday objects':'Look inside the toys and controllers that turn your actions into movement.',
 Study:'Explore writing, screens, signals, and the machines that work with information.',
 'Safety corner':'Trace household circuits, switching, metering, and electrical protection.',
 'Heating and cooling':'Follow energy through heaters, cooling loops, and temperature controls.',
};
function roomBackdrop(room){
 const tile=roomTiles[room];
 return tile?`<div class="house-room-backdrop" style="--tile-x:${tile[0]}%;--tile-y:${tile[1]}%"></div>`:`<img src="${imageUrl('entrance-hall')}" alt="Entrance hall with a front door, coat, window shade, and a table of small tools">`;
}
export function mountHouse(host,route,catalog,{part:requestedPart}={}) {
 const preview=host.querySelector('.house-room-preview'),homeImage=host.querySelector('.zoom-interior>.room-background');
 const incomingBackdrop=preview?.dataset.route===`#${route}`?preview.firstElementChild:route==='place/home'&&homeImage?.getAttribute('src')===imageUrl('house-interior')?homeImage:null;
 const preserveScroll=host.querySelector('[data-handoff-route]')?.dataset.handoffRoute===`#${route}`;
 const groups=catalog.groups.filter(group=>group.place==='home');
 const allRooms=Object.keys(roomNotes),rooms=allRooms.filter(name=>groups.some(group=>group.room===name));
 const entries=catalog.entries;
 const nameFromId=id=>entries.find(entry=>entry.id===id)?.name;
 const room=route.startsWith('room/')?rooms.find(name=>slug(name)===route.slice(5)):null;
 const machineName=route.startsWith('machine/')?nameFromId(route.slice(8)):null;
 if((route.startsWith('machine/')&&!machineName)||(route.startsWith('room/')&&!room)||route==='assembly/front-door'||(route==='place/home'&&!rooms.length))return null;
 const machineGroup=catalog.groups.find(group=>group.items.includes(machineName));
 const component=houseComponents[machineName];
 if(component?.redirectTo){location.replace(requestedPart?partHref(component.redirectTo,requestedPart):'#machine/'+component.redirectTo);return {dispose(){}};}
 const canonicalName=component?.machine||(allLessons[machineName]?machineName:machineGroup?.items[0]);
 const lesson=component?.lesson||allLessons[canonicalName];
 let viewer,disposeTabs;
 const place=machineGroup?.place||'home',placeName=place==='home'?'House':catalog.places.find(item=>item.id===place)?.name;
 const exitRoute=place==='home'?'#room/'+slug(machineGroup?.room||'Doors and daily life'):'#place/'+place;
 const crumbs=(roomName,name)=>`<nav class="house-breadcrumbs" aria-label="Location"><a href="#neighborhood">Neighborhood</a><span>›</span><a href="#place/${place}">${esc(placeName)}</a>${roomName&&place==='home'?`<span>›</span><a href="#room/${slug(roomName)}">${esc(roomName)}</a>`:''}${name?`<span>›</span><span aria-current="page">${esc(name)}</span>`:''}</nav>`;
 if(route==='place/home'){
 host.innerHTML=`<div class="plan-layout"><section class="plan-intro">${houseIntroMarkup(catalog.places.find(item=>item.id==='home'))}</section><div class="plan-art"><div class="zoom-scene house-zoom-scene house-map"><div class="house-zoom-layer"><img src="${imageUrl('house-interior')}" alt="An illustrated cutaway house with sewing, kitchen, entrance, study, and utility spaces">${rooms.map(name=>`<a class="house-room-pin" data-zoom-target="${esc(name)}" style="--x:${roomPositions[allRooms.indexOf(name)][0]}%;--y:${roomPositions[allRooms.indexOf(name)][1]}%" href="#room/${slug(name)}">${roomLabels[allRooms.indexOf(name)]}</a>`).join('')}</div></div></div></div>${crumbs()}<details class="house-directory"><summary>Browse the rooms</summary><section class="house-rooms" aria-label="Rooms in the house">${rooms.map(name=>`<a class="house-room-card" href="#room/${slug(name)}"><h2>${esc(name)}</h2><p>${esc(roomNotes[name])}</p><span>${groups.filter(g=>g.room===name).length} ${groups.filter(g=>g.room===name).length===1?'discovery':'discoveries'} →</span></a>`).join('')}</section></details>`;
 }else if(room){
 const roomGroups=groups.filter(group=>group.room===room);
 const roomFamilies=groupCatalogEntries(entries.filter(entry=>roomGroups.some(group=>group.id===entry.group)));
 const tile=roomTiles[room],previews=roomFamilies.flatMap(({entry,components})=>[entry,...components]).map(entry=>({id:entry.id,name:entry.name}));
 // Every item in the room sits on a shelf, three to a page; the hall keeps its painted pins and shelves the rest.
 const hallPins=new Set(['cylinder-lock','zipper','electric-bell','window-shade','nail-clippers']),trays=previews=>Array.from({length:Math.ceil(previews.length/3)},(_,page)=>`<div class="house-room-tray" data-spatial-page="${page}" ${page?'hidden':''}>${previews.slice(page*3,page*3+3).map((entry,i)=>`<a class="${['dishwasher','faucet','water-meter','toilet-tank'].includes(entry.id)?'house-installed':''}" style="--slot-left:${4+i*31}%" data-zoom-target="${esc(entry.name)}" data-machine="${entry.id}" href="#machine/${entry.id}">${thumbnail}<span>${esc(entry.name)} →</span></a>`).join('')}</div>`).join('');
 const roomScene=tile?`<section class="zoom-scene house-zoom-scene house-room-frame" aria-label="Illustrated ${esc(room)}"><div class="house-zoom-layer house-room-scene">${roomBackdrop(room)}${trays(previews)}</div></section>`:'';
 host.innerHTML=`<div class="plan-layout"><section class="plan-intro"><span class="badge">Inside the house</span><h1 tabindex="-1">${esc(room)}</h1><p class="intro">${esc(roomNotes[room])}</p><p class="intro">Point at an object and zoom closer to look inside.</p><a class="primary" href="#list">All machines & ideas</a><p class="plan-note">Choose an object in the illustration, or browse every object below.</p></section><div class="plan-art">${room==='Doors and daily life'?`<div class="zoom-scene house-zoom-scene house-room-frame"><div class="house-zoom-layer house-hall">${roomBackdrop(room)}<a data-zoom-target="Cylinder lock" style="--x:55%;--y:47%" href="#machine/cylinder-lock">Cylinder lock</a><a data-zoom-target="Coat zipper" style="--x:17%;--y:39%" href="#machine/zipper">Coat zipper</a><a data-zoom-target="Electric bell" style="--x:48%;--y:12%" href="#machine/electric-bell">Electric bell</a><a data-zoom-target="Window shade" style="--x:80%;--y:15%" href="#machine/window-shade">Window shade</a><a data-zoom-target="Nail clippers" style="--x:79%;--y:59%" href="#machine/nail-clippers">Nail clippers</a>${trays(previews.filter(entry=>!hallPins.has(entry.id)))}</div></div>`:roomScene}</div></div>${crumbs(room)}<details class="house-directory"><summary>Browse every object</summary><section class="house-object-grid" aria-label="Discoveries">${roomFamilies.map(({entry,components})=>`<article class="house-object" data-machine="${entry.id}"><a href="#machine/${entry.id}">${thumbnail}<h2>${esc(entry.name)}</h2></a><p>${esc(allLessons[entry.name]?.simple||'Open this object to follow its mechanism.')}</p>${components.length?`<div class="house-component-links" aria-label="Smaller machines and parts in ${esc(entry.name)}">${components.map(part=>`<a href="#machine/${part.id}">${esc(part.name)}</a>`).join('')}</div>`:''}</article>`).join('')}</section></details>`;
 renderRoomMachines(host,previews.map(entry=>previewOf(entry,houseComponents)),createHouseModel);
 }else if(lesson){
 const group=machineGroup,related=[...new Set([...group.items,...(lesson.related||[])])].filter(name=>name!==machineName&&houseComponents[name]?.redirectTo!==route.slice(8)).map(name=>entries.find(entry=>entry.name===name)).filter(Boolean);
 host.innerHTML=`${crumbs(group.room,machineName)}<div class="house-room-heading daily-heading"><span class="badge">Look closer</span><h1 tabindex="-1">${esc(machineName)}</h1><p class="daily-simple">${esc(component?.lesson?lesson.simple:component?.intro||lesson.simple)}</p></div><div class="daily-layout"><section class="daily-viewer" aria-label="Interactive mechanism"></section><article class="daily-lesson"><p class="daily-overview">${esc(component&&!component.lesson?component.intro+" Explore it in the context of the "+canonicalName.toLowerCase()+" below.":lesson.overview)}</p><section><h2>Follow the movement</h2><ol class="daily-steps">${lesson.steps.map(step=>`<li><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p></li>`).join('')}</ol></section><section><h2>Try it yourself</h2>${lesson.tryIt.map((experiment,i)=>`<div class="daily-experiment"><h3>${esc(experiment.title)}</h3><p>${esc(experiment.instruction)}</p><button data-experiment="${i}">Set up this experiment</button><p class="daily-observe">Watch for: ${esc(experiment.observe)}</p></div>`).join('')}</section><section><h2>Meet the parts</h2><dl class="daily-part-glossary">${lesson.parts.map(part=>`<div><dt>${esc(part.name)}</dt><dd>${esc(part.role)}</dd></div>`).join('')}</dl></section>${lesson.deeper.map(section=>`<details><summary>${esc(section.title)}</summary><p>${esc(section.body)}</p></details>`).join('')}<aside class="daily-misconception"><h2>A useful distinction</h2><p>${esc(lesson.misconception)}</p></aside><section class="daily-quiz"><h2>Make a prediction</h2><p>${esc(lesson.quiz.question)}</p><div>${lesson.quiz.options.map((option,i)=>`<button data-answer="${i}">${esc(option)}</button>`).join('')}</div><p class="daily-answer" role="status"></p></section><details><summary>What this model represents</summary><p>${esc(lesson.limits)}</p></details>${lesson.sources.length?`<details><summary>Learn more</summary><ul>${lesson.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul></details>`:''}${related.length?`<section><h2>Keep looking closer</h2><div class="daily-related">${related.map(entry=>`<a href="#machine/${entry.id}">${esc(entry.name)} →</a>`).join('')}</div></section>`:''}</article></div>`;
 const guide=document.createElement('aside');guide.className='daily-guide';guide.setAttribute('aria-label','How the mechanism works');const article=host.querySelector('.daily-lesson');guide.append(article.querySelector('.daily-overview'),article.querySelector('section'));const assumptions=[...article.querySelectorAll('details')].find(details=>details.querySelector('summary')?.textContent==='What this model represents');if(assumptions)guide.append(assumptions);host.querySelector('.daily-layout').prepend(guide);
 viewer=mountDailyLifeViewer(host.querySelector('.daily-viewer'),canonicalName,component?.createModel?.()||createHouseModel(canonicalName),{onExit:()=>location.hash=exitRoute,exitLabel:place==='home'?'Back to room':'Back to '+placeName});
 const navigation=document.createElement('nav');navigation.className='daily-navigation';navigation.setAttribute('aria-label','Return to location');navigation.append(host.querySelector('.daily-return'));host.querySelector('.daily-layout').prepend(navigation);
 disposeTabs=mountExperimentTabs(host);

 if(component){if(component.initialState)viewer.reset(component.initialState);const startComponent=()=>{if(component.values)viewer.apply(component.values);viewer.selectPart(component.part);if(component.isolate!==undefined)viewer.setIsolated(component.isolate);if(component.view)host.querySelector(`[data-view="${component.view}"]`)?.click();};startComponent();host.querySelector("[data-reset-controls]").addEventListener("click",()=>{if(!viewer.isReplaying())startComponent();});}
 if(requestedPart&&hasCatalogPart(route.slice(8),requestedPart))viewer.selectPart(requestedPart);
 host.querySelectorAll('[data-experiment]').forEach(button=>button.addEventListener('click',()=>{const experiment=lesson.tryIt[Number(button.dataset.experiment)];if(experiment.reset)viewer.reset(experiment.initialState);viewer.apply(experiment.values);if(experiment.part)viewer.selectPart(experiment.part);if(experiment.isolate!==undefined)viewer.setIsolated(experiment.isolate);if(experiment.cutaway!==undefined){const input=host.querySelector('[data-cutaway]');if(input&&input.checked!==experiment.cutaway)input.click();}if(experiment.view)host.querySelector(`[data-view="${experiment.view}"]`)?.click();host.querySelector('.daily-viewer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}));
 host.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{host.querySelectorAll('[data-answer]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));host.querySelector('.daily-answer').textContent=(Number(button.dataset.answer)===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation;}));
 }else return null;
 if(incomingBackdrop){incomingBackdrop.classList.remove('room-background');host.querySelector('.house-map .house-zoom-layer,.house-room-frame .house-zoom-layer').firstElementChild.replaceWith(incomingBackdrop);}
 const title=host.querySelector('h1');document.title=`${machineName||room||'The house'} · How Things Work`;title?.focus({preventScroll:true});if(!preserveScroll)window.scrollTo({top:0,behavior:'instant'});
 const disposeSpatial=bindHouseZoom(host,room?'place/home':'neighborhood',route==='place/home'?name=>({html:roomBackdrop(name),src:roomTiles[name]?imageUrl('house-rooms'):imageUrl('entrance-hall')}):null);
 return {dispose(){disposeSpatial();disposeTabs?.();viewer?.dispose();}};
}

function mountExperimentTabs(host){
 const operation=host.querySelector('.daily-operation'),experiments=host.querySelector('.daily-experiment')?.closest('section');
 const guide=host.querySelector('.daily-guide'),parts=host.querySelector('.daily-part-glossary')?.closest('section');
 function tabs(column,labels,panels,prefix){
  const list=document.createElement('div');list.className='daily-operation-tabs';list.setAttribute('role','tablist');list.setAttribute('aria-label',prefix==='operation'?'Experiment tools':'Learning guide');
  for(const [i,label] of labels.entries()){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.id=`${prefix}-tab-${i}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`${prefix}-panel-${i}`);list.append(button);
   panels[i].id=`${prefix}-panel-${i}`;panels[i].setAttribute('role','tabpanel');panels[i].setAttribute('aria-labelledby',button.id);
  }
  function activate(index){[...list.children].forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});}
  list.addEventListener('click',event=>{const index=[...list.children].indexOf(event.target);if(index>=0)activate(index);});
  list.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?1:1-[...list.children].indexOf(document.activeElement);activate(index);list.children[index].focus();});
  column.append(list,...panels);activate(0);
 }
 if(operation&&experiments){const controls=document.createElement('div');controls.append(...operation.children);tabs(operation,['Controls','Try it yourself'],[controls,experiments],'operation');}
 if(guide&&parts){const explanation=document.createElement('div');explanation.append(...guide.children);tabs(guide,['How it works','Meet the parts'],[explanation,parts],'guide');}
 if(!operation||!experiments||!guide)return;
 const shortcuts=document.createElement('nav');shortcuts.className='daily-mobile-tools';shortcuts.setAttribute('aria-label','Lesson tools');
 for(const [label,id] of [['Controls','operation-tab-0'],['Try it yourself','operation-tab-1'],['How it works','guide-tab-0']]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.jumpTab=id;button.setAttribute('aria-controls',host.querySelector('#'+id).getAttribute('aria-controls'));shortcuts.append(button);
 }
 host.querySelector('.daily-layout').before(shortcuts);
 const measure=()=>host.style.setProperty('--daily-tools-height',shortcuts.offsetHeight+'px');
 const observer=new ResizeObserver(measure);observer.observe(shortcuts);measure();
 shortcuts.addEventListener('click',event=>{
  const id=event.target.closest('button')?.dataset.jumpTab;if(!id)return;
  const tab=host.querySelector('#'+id);tab.click();tab.focus({preventScroll:true});
  const column=tab.closest('.daily-operation,.daily-guide');
  const scene=host.querySelector('.daily-canvas-wrap');
  const sceneHeight=column===operation&&getComputedStyle(scene).position==='sticky'?scene.getBoundingClientRect().height:0;
  const top=column.getBoundingClientRect().top+scrollY-shortcuts.offsetHeight-sceneHeight-12;
  window.scrollTo({top,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });
 return()=>{observer.disconnect();host.style.removeProperty('--daily-tools-height');};
}
