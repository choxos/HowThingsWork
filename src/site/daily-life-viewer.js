import {PointerTap} from '../../src/scene/pointer-tap.ts';
import {allowContinuousZoom,stopContinuousZoom,beginPinchZoom} from './house-zoom.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createDailyLifeMachine} from './daily-life-models.js';
import {lighting,frameModel,bindObjectDragging} from './machine-viewer.js';

const text = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playbackIcons={
 play:'<path d="M8 5v14l11-7z"/>',
 pause:'<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
 reset:'<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
 home:'<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
 inspect:'<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 step:'<path d="M5 5v14l10-7zM17 5h3v14h-3z"/>',
};
const playbackIcon=kind=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false">${playbackIcons[kind]}</svg>`;
const within = (value,min,max) => Math.max(min,Math.min(max,value));

export function mountDailyLifeViewer(host,name,providedModel,{onExit}={}) {
  const model=providedModel||createDailyLifeMachine(name);
  if(!model)throw new Error('This lesson has no model.');
  const values=Object.fromEntries(model.controls.map(control=>[control.key,control.initial]));
  model.update(values);
  const scene=new THREE.Scene();lighting(scene);scene.add(model.root);
  const {camera,radius}=frameModel(model,1);
  let renderer=null;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;} catch { /* The controls and explanations also work without WebGL. */ }
  host.innerHTML='<div class="daily-canvas-wrap"></div><div class="daily-camera" role="group" aria-label="View controls"><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="top">Top</button><button data-view="bottom">Underneath</button><button data-view="in" aria-label="Enlarge the model">+</button><button data-view="out" aria-label="Make the model smaller">−</button><button data-view="reset">Reset view</button></div><p class="daily-view-hint">Drag the object to move it; drag outside it to rotate. Pinch or scroll to zoom. Shift + arrows move; Home recenters.</p><div class="daily-view-options"></div><section class="daily-mechanism-controls" aria-label="Machine controls"></section><dl class="daily-readings" aria-label="What changes"></dl><section class="daily-parts" aria-label="Explore the parts"><h2>Explore the parts</h2><nav class="daily-part-path" aria-label="Part hierarchy"></nav><div class="daily-part-buttons"></div><div class="daily-part-detail" aria-live="polite"></div></section>';
  const stage=document.createElement('div');stage.className='daily-stage';
  for(const selector of ['.daily-canvas-wrap','.daily-camera','.daily-view-hint','.daily-view-options','.daily-readings','.daily-parts'])stage.append(host.querySelector(selector));
  const operation=document.createElement('aside');operation.className='daily-operation';operation.setAttribute('aria-label','Adjust the mechanism');operation.append(host.querySelector('.daily-mechanism-controls'));host.append(stage,operation);
  const wrap=host.querySelector('.daily-canvas-wrap');
  const canvas=renderer?.domElement;
  if(canvas){canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Interactive 3D ${name}. Drag the object to move it; drag outside it to rotate. Shift and arrow keys move. Arrow keys rotate. Plus and minus zoom. Home resets the view.`);wrap.append(canvas);}else{wrap.innerHTML='<p class="daily-no-3d">3D is unavailable in this browser. You can still use the controls, read what changes, and explore every part below.</p>';host.querySelector('.daily-camera').hidden=true;host.querySelector('.daily-view-hint').hidden=true;}
  const orbit=canvas?new OrbitControls(camera,canvas):null;
  if(orbit){orbit.enableDamping=false;orbit.enablePan=true;orbit.screenSpacePanning=true;orbit.enableZoom=false;orbit.minZoom=1.15;orbit.maxZoom=3;orbit.minPolarAngle=.05;orbit.maxPolarAngle=Math.PI-.05;}
  if(orbit)bindObjectDragging(canvas,camera,model.root,orbit);
  let resultWasComplete=false,selected=null,cutaway=model.covers.length>0,isolated=false,labels=false,playing=false,speed=.25,phase=0,frame=0,lastTime=0,lastReading=0,disposed=false,active=true;
  let overviewZoom=1.15,followPosition=null,tallestReadings=0,lastReadingsWidth=0;
  const overrides=new Map();
  const highlight=new THREE.Box3Helper(new THREE.Box3(),0xb55830);scene.add(highlight);
  const labelNodes=new Map();
  for(const part of model.parts){const node=document.createElement('button');node.className='daily-model-label';node.textContent=part.name;node.addEventListener('click',()=>selectPart(part.id));wrap.append(node);labelNodes.set(part.id,node);}
  const options=host.querySelector('.daily-view-options');
  options.innerHTML=`${model.covers.length?'<label><input type="checkbox" data-cutaway checked> Look inside</label>':''}<label><input type="checkbox" data-labels> Show labels</label><label><input type="checkbox" data-isolate> Isolate selected part</label>`;
  const controlsHost=host.querySelector('.daily-mechanism-controls');
  const controlsByKey=new Map(model.controls.map(control=>[control.key,control]));
  controlsHost.innerHTML='<div class="daily-controls-heading"><h2>Try the controls</h2><button data-reset-controls>Reset experiment</button></div>'+model.controls.map(control=>{
    const id=`daily-control-${control.key}`;
    return `<div class="daily-control"><label for="${id}">${text(control.label)}</label>${control.options?`<select id="${id}" data-control="${control.key}">${control.options.map(option=>`<option value="${option.value}" ${Number(option.value)===control.initial?'selected':''}>${text(option.label)}</option>`).join('')}</select>`:`<div class="daily-control-pair"><input id="${id}" data-control="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.initial}" aria-describedby="${id}-help"><input type="number" data-number="${control.key}" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.initial}" aria-label="${text(control.label)} value">${control.unit?`<span>${text(control.unit)}</span>`:''}</div>`}<p id="${id}-help">${text(control.help||'')}</p></div>`;
  }).join('');
  if(model.actions)controlsHost.insertAdjacentHTML('beforeend',model.actions.map((action,i)=>`<button data-action="${i}">${text(action.label)}</button>`).join(''));
  if(model.playback)controlsHost.insertAdjacentHTML('beforeend',`<button data-step class="daily-transport-button" aria-label="${text(model.playback.stepLabel)}" title="Step forward: ${text(model.playback.stepLabel)}">${playbackIcon('step')}</button>`);
  if(model.animate){controlsHost.insertAdjacentHTML('beforeend','<div class="daily-playback"><button data-play class="daily-transport-button" aria-pressed="false"></button><label>Playback speed<select data-speed><option value=".1">Very slow</option><option value=".25" selected>Slow</option><option value=".6">Steady</option></select></label><p>Motion is slowed so you can follow the sequence.</p></div>');}
  if(model.resultPart)controlsHost.querySelector('.daily-playback').insertAdjacentHTML('beforeend',`<button data-result>${text(model.resultPart.label)}</button>`);
  for(const [selector,kind,label] of [['[data-reset-controls]','reset','Reset experiment'],['[data-view="reset"]','home','Reset view'],['[data-result]','inspect',model.resultPart?.label]]){const button=host.querySelector(selector);if(button){button.innerHTML=playbackIcon(kind);button.classList.add('daily-transport-button');button.setAttribute('aria-label',label);button.title=label;}}
  host.querySelector('.daily-part-buttons').innerHTML=model.parts.map(part=>`<button data-part="${text(part.id)}" aria-pressed="false">${text(part.name)}</button>`).join('');
  function restoreVisibility(){for(const [object,visible] of overrides)object.visible=visible;overrides.clear();}
  function isWithin(object,parent){for(let current=object;current;current=current.parent)if(current===parent)return true;return false;}
  function filterVisibility(){
    const context=selected===model.resultPart?.id?model.resultPart.context:undefined;
    const part=model.parts.find(part=>part.id===(context||selected));
    model.root.traverse(object=>{
      if((cutaway&&model.covers.includes(object))||(isolated&&part&&!isWithin(object,part.object)&&!isWithin(part.object,object))){overrides.set(object,object.visible);object.visible=false;}
    });
  }
  function shown(object){for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;}
  function draw(){
    if(disposed||!active||!renderer)return;
    model.root.updateMatrixWorld(true);
    const chosen=model.parts.find(part=>part.id===selected);
    if(orbit&&chosen&&model.followParts?.includes(selected)){
      const position=new THREE.Box3().setFromObject(chosen.object).getCenter(new THREE.Vector3());
      if(followPosition){const delta=position.clone().sub(followPosition);camera.position.add(delta);orbit.target.add(delta);camera.updateMatrixWorld();}
      followPosition=position;
    }else followPosition=null;
    highlight.visible=Boolean(chosen&&shown(chosen.object));
    if(highlight.visible)highlight.box.setFromObject(chosen.object);
    for(const part of model.parts){const node=labelNodes.get(part.id);node.hidden=!labels||!shown(part.object);if(node.hidden)continue;const point=new THREE.Box3().setFromObject(part.object).getCenter(new THREE.Vector3()).project(camera);node.hidden=point.z< -1||point.z>1;node.style.left=`${within((point.x*.5+.5)*100,8,92)}%`;node.style.top=`${within((-.5*point.y+.5)*100,8,92)}%`;}
    renderer.render(scene,camera);
  }
  function readings(items){Object.assign(values,model.getState?.().values);syncControls();syncPlaybackButton();const complete=Boolean(model.playback?.complete()),focusResult=model.resultPart?.focusOnComplete&&complete&&!resultWasComplete;resultWasComplete=complete;if(focusResult&&selected!==model.resultPart.id){selectResult();return;}const resultButton=host.querySelector('[data-result]');if(resultButton)resultButton.disabled=!model.resultPart.available();const readingsHost=host.querySelector('.daily-readings');readingsHost.innerHTML=(items||[]).map(item=>`<div><dt>${text(item.label)}</dt><dd>${text(item.value)}</dd>${item.hint?`<p>${text(item.hint)}</p>`:''}</div>`).join('');
    // Running a mechanism rewrites these values several times a second, and a
    // value that wraps onto a second line used to jog the parts below it. Hold
    // the tallest height reached at this width instead.
    tallestReadings=Math.max(tallestReadings,readingsHost.offsetHeight);readingsHost.style.minHeight=`${tallestReadings}px`;}
  function update(showReadings=true){restoreVisibility();const result=model.update(values);filterVisibility();if(showReadings)readings(result);draw();}
  function syncControls(){for(const control of model.controls){const input=host.querySelector(`[data-control="${control.key}"]`),number=host.querySelector(`[data-number="${control.key}"]`);input.value=values[control.key];input.disabled=control.enabledWhen?!control.enabledWhen(values):false;if(number){if(document.activeElement!==number)number.value=values[control.key];number.disabled=input.disabled;}input.setAttribute('aria-valuetext',`${values[control.key]}${control.unit?' '+control.unit:''}`);}}
  function syncPlaybackButton(){const button=host.querySelector('[data-play]');if(!button)return;button.innerHTML=playbackIcon(playing?'pause':'play');button.setAttribute('aria-label',playing?'Pause':model.playback?.label||'Play slowly');button.title=playing?'Pause':model.playback?.complete()?'Play again: reset and restart the experiment':model.playback?'Play: '+model.playback.label:'Play slowly';button.setAttribute('aria-pressed',String(playing));}
  function releaseReadingsHeight(){tallestReadings=0;host.querySelector('.daily-readings').style.minHeight='';}
  function stop(){playing=false;model.playback?.setPlaying?.(false);cancelAnimationFrame(frame);syncPlaybackButton();releaseReadingsHeight();}
  function apply(next){const resume=playing;stop();for(const [key,value] of Object.entries(next)){const control=controlsByKey.get(key);if(!control||!Number.isFinite(Number(value)))continue;const bounded=within(Number(value),control.min,control.max);if(control.options&&!control.options.some(option=>Number(option.value)===bounded))continue;values[key]=control.step?Number(within(control.min+Math.round((bounded-control.min)/control.step)*control.step,control.min,control.max).toPrecision(12)):bounded;}syncControls();update();if(resume)start();}
  function selectPart(id,focus=true){
    if(focus)host.scrollTop=0;
    followPosition=null;selected=id;const part=model.parts.find(part=>part.id===id);
    const ancestry=[];let current=part;const seen=new Set();
    while(current&&!seen.has(current.id)){ancestry.unshift(current);seen.add(current.id);current=model.parts.find(candidate=>candidate.id===current.parentId);}
    host.querySelector('.daily-part-path').innerHTML='<button data-parent="">Whole machine</button>'+ancestry.map(item=>`<span aria-hidden="true">›</span><button data-parent="${text(item.id)}">${text(item.name)}</button>`).join('');
    const children=model.parts.filter(candidate=>candidate.parentId===(part?.id||null)||(!part&&!candidate.parentId));
    host.querySelector('.daily-part-buttons').innerHTML=children.map(item=>`<button data-part="${text(item.id)}">${text(item.name)}</button>`).join('');
    host.querySelector('.daily-part-detail').innerHTML=part?`<h3>${text(part.name)}</h3><p>${text(part.description||'')}</p>${part.route?`<a class="primary" href="${text(part.route)}">Open ${text(part.name)}</a>`:''}`:'<p>Select a part to move closer. Follow the breadcrumbs to move back out.</p>';
    if(focus&&part&&orbit){model.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(part.object),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());const direction=camera.position.clone().sub(orbit.target);orbit.target.copy(center);camera.position.copy(center).add(direction);camera.zoom=within(radius/(Math.max(size.x,size.y,size.z)*.75),.55,12);overviewZoom=camera.zoom;orbit.minZoom=overviewZoom;orbit.maxZoom=Math.max(12,overviewZoom*3);camera.updateProjectionMatrix();orbit.update();}else if(!part)resetView();
    update();
  }
  host.querySelector('.daily-part-path').addEventListener('click',event=>{const button=event.target.closest('[data-parent]');if(button)selectPart(button.dataset.parent||null);});
  function resetView(){overviewZoom=1.15;if(orbit){orbit.minZoom=overviewZoom;orbit.maxZoom=3;}camera.zoom=overviewZoom;camera.position.set(radius*1.3,radius*.85,radius*2);orbit?.target.set(0,0,0);camera.updateProjectionMatrix();orbit?.update();draw();}
  function zoom(factor){
    if(factor<1&&camera.zoom<=overviewZoom+1e-6){
      stopContinuousZoom();
      if(selected)selectPart(model.parts.find(part=>part.id===selected)?.parentId||null);
      else onExit?.();
      return;
    }
    camera.zoom=within(camera.zoom*factor,overviewZoom,orbit?.maxZoom||3);
    if(factor<1&&camera.zoom===overviewZoom)stopContinuousZoom();
    camera.updateProjectionMatrix();orbit?.update();draw();
  }
  host.querySelector('.daily-camera').addEventListener('click',event=>{
    const view=event.target.closest('[data-view]')?.dataset.view;if(!view)return;
    if(view==='reset'){selectPart(null);return;}if(view==='in'||view==='out'){zoom(view==='in'?1.2:1/1.2);return;}else{const distance=radius*2.7;camera.position.copy(orbit?.target||new THREE.Vector3()).add(new THREE.Vector3(...({front:[0,radius*.15,distance],side:[distance,radius*.15,0],back:[0,radius*.15,-distance],top:[0,distance,.001],bottom:[0,-distance,.001]}[view])));}orbit?.update();draw();
  });
  options.addEventListener('change',event=>{if(event.target.matches('[data-cutaway]'))cutaway=event.target.checked;if(event.target.matches('[data-labels]'))labels=event.target.checked;if(event.target.matches('[data-isolate]'))isolated=event.target.checked;update();});
  controlsHost.addEventListener('input',event=>{const key=event.target.dataset.control||event.target.dataset.number;if(!key||event.target.value==='')return;apply({[key]:Number(event.target.value)});});
  // A half typed number is below its minimum, so the field keeps what is being
  // typed and only shows the bounded value once the box is left.
  controlsHost.addEventListener('change',()=>syncControls());
  function reset(initialState){stop();releaseReadingsHeight();phase=0;model.reset?.(initialState);model.animate?.(0);apply(Object.fromEntries(model.controls.map(control=>[control.key,control.initial])));if(selected===model.resultPart?.id){isolated=false;options.querySelector('[data-isolate]').checked=false;selectPart(null);}}
  host.querySelector('[data-reset-controls]').addEventListener('click',()=>reset());
  controlsHost.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
    stop();const action=model.actions[Number(button.dataset.action)];action.run();Object.assign(values,model.getState?.().values);
    if(action.part){isolated=false;options.querySelector('[data-isolate]').checked=false;selectPart(action.part);}else update();
    if(action.view)host.querySelector(`[data-view="${action.view}"]`)?.click();
  }));
  host.querySelector('.daily-part-buttons').addEventListener('click',event=>{const id=event.target.closest('[data-part]')?.dataset.part;if(id)selectPart(id);});
  function tick(now){if(!playing||disposed||!active)return;const elapsed=Math.min((now-lastTime)/1000,.1);lastTime=now;phase+=elapsed*speed;restoreVisibility();if(model.playback)model.playback.advance(elapsed);else model.animate(phase);Object.assign(values,model.getState?.().values);filterVisibility();if(now-lastReading>200){readings(model.getState?.().readings);lastReading=now;}draw();if(model.playback?.complete()||model.playback?.blocked()){readings(model.getState().readings);stop();return;}frame=requestAnimationFrame(tick);}
  function start(){if(!model.animate||disposed||!active||model.playback?.complete()||model.playback?.blocked())return;playing=true;model.playback?.setPlaying?.(true);syncPlaybackButton();lastTime=performance.now();frame=requestAnimationFrame(tick);}
  function selectResult(){selectPart(model.resultPart.id);if(model.resultPart.view)host.querySelector(`[data-view="${model.resultPart.view}"]`)?.click();}
  host.querySelector('[data-result]')?.addEventListener('click',()=>{stop();isolated=true;options.querySelector('[data-isolate]').checked=true;selectResult();});
  host.querySelector('[data-step]')?.addEventListener('click',()=>{stop();restoreVisibility();model.playback.step();filterVisibility();readings(model.getState().readings);draw();});
  if(model.playback){host.querySelector('[data-speed]').closest('label').hidden=true;const playback=host.querySelector('.daily-playback');if(model.playback.description)playback.querySelector('p').textContent=model.playback.description;playback.prepend(host.querySelector('[data-play]'),host.querySelector('[data-step]'),...controlsHost.querySelectorAll('[data-action]'));controlsHost.querySelector('.daily-controls-heading').after(playback);}
  syncPlaybackButton();
  host.querySelector('[data-play]')?.addEventListener('click',()=>{if(playing)stop();else{if(model.playback?.complete())host.querySelector('[data-reset-controls]').click();start();}});
  host.querySelector('[data-speed]')?.addEventListener('change',event=>speed=Number(event.target.value));
  if(canvas){
    orbit.addEventListener('change',draw);
    canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home'){selectPart(null);return;}if(['+','=','-'].includes(event.key)){zoom(event.key==='-'?1/1.2:1.2);return;}else if(event.shiftKey){const amount=radius*.08/camera.zoom,delta=new THREE.Vector3().setFromMatrixColumn(camera.matrix,event.key==='ArrowLeft'||event.key==='ArrowRight'?0:1).multiplyScalar(amount*(event.key==='ArrowLeft'||event.key==='ArrowDown'?1:-1));camera.position.add(delta);orbit.target.add(delta);}else{const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));if(event.key==='ArrowLeft')spherical.theta-=.2;if(event.key==='ArrowRight')spherical.theta+=.2;if(event.key==='ArrowUp')spherical.phi=Math.max(.05,spherical.phi-.15);if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.05,spherical.phi+.15);camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical));}orbit.update();draw();});
    canvas.addEventListener('wheel',event=>{event.preventDefault();if(!orbit.enabled||!allowContinuousZoom())return;const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?wrap.clientHeight:1);if(pixels)zoom(Math.exp(within(-pixels*.002,-.25,.25)));},{passive:false});
    const fingers=new Map();let pinchDistance=0,pinching=false;
    canvas.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')return;fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(fingers.size===2){pinching=true;beginPinchZoom();const [a,b]=[...fingers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
    canvas.addEventListener('pointermove',event=>{if(!fingers.has(event.pointerId))return;fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(fingers.size!==2)return;const [a,b]=[...fingers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(orbit.enabled&&pinchDistance>0&&distance>0&&allowContinuousZoom(true))zoom(distance/pinchDistance);pinchDistance=distance;});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{fingers.delete(event.pointerId);});
    const tap=new PointerTap();
    canvas.addEventListener('pointerdown',event=>{if(fingers.size<2)pinching=false;tap.down(event.pointerId,event.clientX,event.clientY,5);});
    canvas.addEventListener('pointermove',event=>tap.move(event.pointerId,event.clientX,event.clientY));
    canvas.addEventListener('pointercancel',event=>tap.cancel(event.pointerId));
    canvas.addEventListener('pointerup',event=>{if(!tap.up(event.pointerId,event.clientX,event.clientY)||pinching)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);for(const hit of ray.intersectObject(model.root,true)){if(!shown(hit.object))continue;let object=hit.object;while(object){const part=model.parts.find(part=>part.object===object);if(part){selectPart(part.id);return;}object=object.parent;}}});
  }
  const resize=new ResizeObserver(()=>{if(!renderer)return;const width=Math.max(1,wrap.clientWidth),height=matchMedia('(max-width: 650px)').matches?Math.max(220,Math.min(innerHeight*.45,width*.95)):Math.max(320,Math.min(620,width*.86));renderer.setSize(width,height);const aspect=width/height;camera.left=-radius*aspect;camera.right=radius*aspect;camera.updateProjectionMatrix();if(width!==lastReadingsWidth){lastReadingsWidth=width;releaseReadingsHeight();}draw();});resize.observe(wrap);
  const onVisibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',onVisibility);
  syncControls();selectPart(selected);if(model.animate&&!model.playback&&!matchMedia('(prefers-reduced-motion: reduce)').matches)start();
  return {apply,reset,selectPart,setIsolated(value){isolated=Boolean(value);options.querySelector('[data-isolate]').checked=isolated;update();},setActive(value){active=value;if(!value)stop();else draw();},setInteractionEnabled(value){if(orbit)orbit.enabled=value;},dispose(){disposed=true;stop();resize.disconnect();document.removeEventListener('visibilitychange',onVisibility);orbit?.dispose();highlight.geometry.dispose();highlight.material.dispose();model.dispose();renderer?.dispose();renderer?.forceContextLoss();}};
}
