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
import {createDailyLifeAssembly} from './daily-life-assemblies.js';
export function createHouseModel(name){return createElectronicModel(name)||createDailyLifeMachine(name)||createKitchenModel(name)||createTimeModel(name)||createUtilityModel(name)||createSafetyModel(name)||createCleaningModel(name)||createHeatingModel(name)||createStudyModel(name)||createPlayModel(name);}
const roomTiles={'Kitchen':[0,0],'Measuring and time':[50,0],'Sewing corner':[100,0],'Water and plumbing':[0,50],'Cleaning cupboard':[50,50],'Play and everyday objects':[100,50],'Study':[0,100],'Safety corner':[50,100],'Heating and cooling':[100,100]};
const roomPositions=[[22,68],[79,32],[48,20],[23,32],[62,35],[81,68],[46,72],[61,65],[32,53],[91,43]];
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
 'Safety corner':'See how sensors and protective devices notice a change and respond.',
 'Heating and cooling':'Follow energy through heaters, cooling loops, and temperature controls.',
};
function roomBackdrop(room){
 const tile=roomTiles[room];
 return tile?`<div class="house-room-backdrop" style="--tile-x:${tile[0]}%;--tile-y:${tile[1]}%"></div>`:`<img src="${imageUrl('entrance-hall')}" alt="Entrance hall with a front door, coat, window shade, and a table of small tools">`;
}
export function mountHouse(host,route,catalog) {
 const preview=host.querySelector('.house-room-preview'),homeImage=host.querySelector('.zoom-interior>.room-background');
 const incomingBackdrop=preview?.dataset.route===`#${route}`?preview.firstElementChild:route==='place/home'&&homeImage?.getAttribute('src')===imageUrl('house-interior')?homeImage:null;
 const preserveScroll=host.querySelector('[data-handoff-route]')?.dataset.handoffRoute===`#${route}`;
 const groups=catalog.groups.filter(group=>group.place==='home');
 const rooms=Object.keys(roomNotes);
 const entries=catalog.entries;
 const nameFromId=id=>entries.find(entry=>entry.id===id)?.name;
 const room=rooms.find(name=>slug(name)===route.split('/')[1]);
 const machineName=route.startsWith('machine/')?nameFromId(route.split('/')[1]):null;
 const machineGroup=catalog.groups.find(group=>group.items.includes(machineName));
 const component=houseComponents[machineName];
 const canonicalName=component?.machine||(allLessons[machineName]?machineName:machineGroup?.items[0]);
 const lesson=component?.lesson||allLessons[canonicalName];
 let viewer;
 const place=machineGroup?.place||'home',placeName=place==='home'?'House':catalog.places.find(item=>item.id===place)?.name;
 const exitRoute=place==='home'?'#room/'+slug(machineGroup?.room||'Doors and daily life'):'#place/'+place;
 const crumbs=(roomName,name)=>`<nav class="house-breadcrumbs" aria-label="Location"><a href="#neighborhood">Neighborhood</a><span>›</span><a href="#place/${place}">${esc(placeName)}</a>${roomName&&place==='home'?`<span>›</span><a href="#room/${slug(roomName)}">${esc(roomName)}</a>`:''}${name?`<span>›</span><span aria-current="page">${esc(name)}</span>`:''}</nav>`;
 if(route==='place/home'){
 host.innerHTML=`<div class="plan-layout"><section class="plan-intro">${houseIntroMarkup(catalog.places.find(item=>item.id==='home'))}</section><div class="plan-art"><div class="zoom-scene house-zoom-scene house-map"><div class="house-zoom-layer"><img src="${imageUrl('house-interior')}" alt="An illustrated cutaway house with sewing, kitchen, entrance, study, and utility spaces">${rooms.map((name,i)=>`<a class="house-room-pin" data-zoom-target="${esc(name)}" style="--x:${roomPositions[i][0]}%;--y:${roomPositions[i][1]}%" href="#room/${slug(name)}">${roomLabels[i]}</a>`).join('')}</div></div></div></div>${crumbs()}<details class="house-directory"><summary>Browse the rooms</summary><section class="house-rooms" aria-label="Rooms in the house">${rooms.map((name,i)=>`<a class="house-room-card" href="#room/${slug(name)}"><h2>${esc(name)}</h2><p>${esc(roomNotes[name])}</p><span>${groups.filter(g=>g.room===name).length} discoveries →</span></a>`).join('')}</section></details>`;
 }else if(room){
 const roomGroups=groups.filter(group=>group.room===room);
 const tile=roomTiles[room],previews=roomGroups.map(group=>({id:slug(group.items[0]),name:group.items[0]}));
 const roomScene=tile?`<section class="zoom-scene house-zoom-scene house-room-frame" aria-label="Illustrated ${esc(room)}"><div class="house-zoom-layer house-room-scene">${roomBackdrop(room)}${Array.from({length:Math.ceil(previews.length/3)},(_,page)=>`<div class="house-room-tray" data-spatial-page="${page}" ${page?'hidden':''}>${previews.slice(page*3,page*3+3).map(entry=>`<a data-zoom-target="${esc(entry.name)}" data-machine="${entry.id}" href="#machine/${entry.id}">${thumbnail}<span>${esc(entry.name)} →</span></a>`).join('')}</div>`).join('')}</div></section>`:'';
 host.innerHTML=`<div class="plan-layout"><section class="plan-intro"><span class="badge">Inside the house</span><h1 tabindex="-1">${esc(room)}</h1><p class="intro">${esc(roomNotes[room])}</p><p class="intro">Point at an object and zoom closer to look inside.</p><a class="primary" href="#list">All machines & ideas</a><p class="plan-note">Choose an object in the illustration, or browse every object below.</p></section><div class="plan-art">${room==='Doors and daily life'?`<div class="zoom-scene house-zoom-scene house-room-frame"><div class="house-zoom-layer house-hall">${roomBackdrop(room)}<a data-zoom-target="Front door" style="--x:42%;--y:42%" href="#assembly/front-door">Front door</a><a data-zoom-target="Coat zipper" style="--x:17%;--y:39%" href="#machine/zipper">Coat zipper</a><a data-zoom-target="Window shade" style="--x:72%;--y:15%" href="#machine/window-shade">Window shade</a><a data-zoom-target="Small tools" style="--x:77%;--y:60%" href="#machine/nail-clippers">Small tools</a></div></div>`:roomScene}</div></div>${crumbs(room)}<details class="house-directory"><summary>Browse every object</summary><section class="house-object-grid" aria-label="Discoveries">${roomGroups.map(group=>`<a class="house-object" data-machine="${slug(group.items[0])}" href="#machine/${slug(group.items[0])}">${thumbnail}<h2>${esc(group.items[0])}</h2><p>${esc(allLessons[group.items[0]]?.simple||'Open this object to follow its mechanism.')}</p>${group.items.length>1?`<small>Inside: ${group.items.slice(1).map(esc).join(' · ')}</small>`:''}<span>Look closer →</span></a>`).join('')}</section></details>`;
 renderRoomMachines(host,previews,createHouseModel);
 }else if(route==='assembly/front-door'){
 host.innerHTML=`${crumbs('Doors and daily life','Front door')}<div class="house-room-heading"><h1 tabindex="-1">A door is a team of parts.</h1><p>Open the door, select a lock or the bell, then follow its mechanism inside.</p></div><section class="daily-viewer"></section>`;
 viewer=mountDailyLifeViewer(host.querySelector('.daily-viewer'),'Front door',createDailyLifeAssembly('front-door'),{onExit:()=>location.hash='#room/doors-and-daily-life'});
 }else if(lesson){
 const group=machineGroup,related=[...new Set([...group.items,...(lesson.related||[])])].filter(name=>name!==machineName);
 host.innerHTML=`${crumbs(group.room,machineName)}<div class="house-room-heading daily-heading"><span class="badge">Look closer</span><h1 tabindex="-1">${esc(machineName)}</h1><p class="daily-simple">${esc(component?.lesson?lesson.simple:component?.intro||lesson.simple)}</p></div><div class="daily-layout"><section class="daily-viewer" aria-label="Interactive mechanism"></section><article class="daily-lesson"><p class="daily-overview">${esc(component&&!component.lesson?component.intro+" Explore it in the context of the "+canonicalName.toLowerCase()+" below.":lesson.overview)}</p><section><h2>Follow the movement</h2><ol class="daily-steps">${lesson.steps.map(step=>`<li><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p></li>`).join('')}</ol></section><section><h2>Try it yourself</h2>${lesson.tryIt.map((experiment,i)=>`<div class="daily-experiment"><h3>${esc(experiment.title)}</h3><p>${esc(experiment.instruction)}</p><button data-experiment="${i}">Set up this experiment</button><p class="daily-observe">Watch for: ${esc(experiment.observe)}</p></div>`).join('')}</section><section><h2>Meet the parts</h2><dl class="daily-part-glossary">${lesson.parts.map(part=>`<div><dt>${esc(part.name)}</dt><dd>${esc(part.role)}</dd></div>`).join('')}</dl></section>${lesson.deeper.map(section=>`<details><summary>${esc(section.title)}</summary><p>${esc(section.body)}</p></details>`).join('')}<aside class="daily-misconception"><h2>A useful distinction</h2><p>${esc(lesson.misconception)}</p></aside><section class="daily-quiz"><h2>Make a prediction</h2><p>${esc(lesson.quiz.question)}</p><div>${lesson.quiz.options.map((option,i)=>`<button data-answer="${i}">${esc(option)}</button>`).join('')}</div><p class="daily-answer" role="status"></p></section><details><summary>What this model represents</summary><p>${esc(lesson.limits)}</p></details>${lesson.sources.length?`<details><summary>Learn more</summary><ul>${lesson.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul></details>`:''}${related.length?`<section><h2>Keep looking closer</h2><div class="daily-related">${related.map(name=>`<a href="#machine/${slug(name)}">${esc(name)} →</a>`).join('')}</div></section>`:''}</article></div>`;
 const guide=document.createElement('aside');guide.className='daily-guide';guide.setAttribute('aria-label','How the mechanism works');const article=host.querySelector('.daily-lesson');guide.append(article.querySelector('.daily-overview'),article.querySelector('section'));const assumptions=[...article.querySelectorAll('details')].find(details=>details.querySelector('summary')?.textContent==='What this model represents');if(assumptions)guide.append(assumptions);host.querySelector('.daily-layout').prepend(guide);
 viewer=mountDailyLifeViewer(host.querySelector('.daily-viewer'),canonicalName,createHouseModel(canonicalName),{onExit:()=>location.hash=exitRoute});
 mountExperimentTabs(host);
 if(component){const startComponent=()=>{if(component.values)viewer.apply(component.values);viewer.selectPart(component.part);if(component.isolate!==undefined)viewer.setIsolated(component.isolate);if(component.view)host.querySelector(`[data-view="${component.view}"]`)?.click();};startComponent();host.querySelector("[data-reset-controls]").addEventListener("click",startComponent);}
 host.querySelectorAll('[data-experiment]').forEach(button=>button.addEventListener('click',()=>{const experiment=lesson.tryIt[Number(button.dataset.experiment)];if(experiment.reset)viewer.reset(experiment.initialState);viewer.apply(experiment.values);if(experiment.part)viewer.selectPart(experiment.part);if(experiment.isolate!==undefined)viewer.setIsolated(experiment.isolate);if(experiment.view)host.querySelector(`[data-view="${experiment.view}"]`)?.click();host.querySelector('.daily-viewer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}));
 host.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{host.querySelectorAll('[data-answer]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));host.querySelector('.daily-answer').textContent=(Number(button.dataset.answer)===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation;}));
 }else return null;
 if(incomingBackdrop){incomingBackdrop.classList.remove('room-background');host.querySelector('.house-map .house-zoom-layer,.house-room-frame .house-zoom-layer').firstElementChild.replaceWith(incomingBackdrop);}
 const title=host.querySelector('h1');document.title=`${machineName||room||'The house'} · How Things Work`;title?.focus({preventScroll:true});if(!preserveScroll)window.scrollTo({top:0,behavior:'instant'});
 const disposeSpatial=bindHouseZoom(host,room?'place/home':'neighborhood',route==='place/home'?name=>({html:roomBackdrop(name),src:roomTiles[name]?imageUrl('house-rooms'):imageUrl('entrance-hall')}):null);
 return {dispose(){disposeSpatial();viewer?.dispose();}};
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
}
