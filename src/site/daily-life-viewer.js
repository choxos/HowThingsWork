import {PointerTap} from '../../src/scene/pointer-tap.ts';
import {allowContinuousZoom,beginPinchZoom} from './house-zoom.js';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createPartExplosion} from './part-explosion.js';
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

export function mountDailyLifeViewer(host,name,providedModel,{onExit,exitLabel='Back to room'}={}) {
  const model=providedModel||createDailyLifeMachine(name);
  if(!model)throw new Error('This lesson has no model.');
  const values=Object.fromEntries(model.controls.map(control=>[control.key,control.initial]));
  model.update(values);
  const scene=new THREE.Scene();lighting(scene);scene.add(model.root);
  const {camera,radius}=frameModel(model,1);
  let renderer=null;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;} catch { /* The controls and explanations also work without WebGL. */ }
  let reflectionTarget=null;
  if(renderer&&model.reflectionLighting){const environment=new RoomEnvironment(),generator=new THREE.PMREMGenerator(renderer);reflectionTarget=generator.fromScene(environment);scene.environment=reflectionTarget.texture;environment.dispose();generator.dispose();}
  host.innerHTML='<div class="daily-canvas-wrap"></div><div class="daily-camera" role="group" aria-label="View controls"><button data-view="iso">Angled</button><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="top">Top</button><button data-view="bottom">Underneath</button><button data-view="in" aria-label="Enlarge the model">+</button><button data-view="out" aria-label="Zoom out">−</button><button data-view="reset">Reset view</button></div><p class="daily-view-hint">Hover over or tap a part to see its name. Drag the object to move it; drag outside it to rotate. Pinch or scroll out to separate parts into groups. Pinch or scroll in to reassemble. + and − only zoom. Shift + arrows move; Home recenters.</p><div class="daily-view-options"></div><section class="daily-mechanism-controls" aria-label="Machine controls"></section><dl class="daily-readings" aria-label="What changes"></dl><section class="daily-parts" aria-label="Explore the parts"><h2>Explore the parts</h2><nav class="daily-part-path" aria-label="Part hierarchy"></nav><div class="daily-part-buttons"></div><div class="daily-part-detail" aria-live="polite"></div></section>';
  const stage=document.createElement('div');stage.className='daily-stage';
  for(const selector of ['.daily-canvas-wrap','.daily-camera','.daily-view-hint','.daily-view-options','.daily-readings','.daily-parts'])stage.append(host.querySelector(selector));
  const operation=document.createElement('aside');operation.className='daily-operation';operation.setAttribute('aria-label','Adjust the mechanism');operation.append(host.querySelector('.daily-mechanism-controls'));host.append(stage,operation);
  const wrap=host.querySelector('.daily-canvas-wrap');
  if(model.transparentBackground){wrap.classList.add('daily-clear-scene');wrap.style.background='transparent';wrap.style.border='0';}
  const separation=document.createElement('div');separation.className='daily-separation';
  separation.innerHTML='<label>Separate parts <input type="range" min="0" max="100" step="1" value="0" data-separation aria-label="Separate parts"></label><output data-separation-status aria-live="polite">Assembled</output><button data-reassemble>Reassemble</button>';
  host.querySelector('.daily-camera').after(separation);
  if(onExit){const back=document.createElement('button');back.type='button';back.className='daily-return';back.innerHTML=`<span aria-hidden="true">←</span><span>${text(exitLabel)}</span>`;back.addEventListener('click',onExit);stage.prepend(back);}
  const inventoryLabels=document.createElement('div');inventoryLabels.className='daily-inventory-labels';wrap.append(inventoryLabels);
  const partPopup=document.createElement('div');partPopup.className='daily-part-popup';partPopup.setAttribute('role','status');partPopup.setAttribute('aria-atomic','true');partPopup.hidden=true;wrap.append(partPopup);
  let popupHit=null,popupPinned=false;
  const partsByObject=new Map(model.parts.map(part=>[part.object,part]));
  const pointerRay=new THREE.Raycaster(),popupPoint=new THREE.Vector3(),instanceMatrix=new THREE.Matrix4();
  const canvas=renderer?.domElement;
  if(canvas){canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Interactive 3D ${name}. Drag the object to move it; drag outside it to rotate. Shift and arrow keys move. Arrow keys rotate. Plus and minus zoom without separating parts. Pinch or scroll out to separate parts; pinch or scroll in to reassemble. Home resets the view.`);wrap.append(canvas);}else{wrap.innerHTML='<p class="daily-no-3d">3D is unavailable in this browser. You can still use the controls, read what changes, and explore every part below.</p>';host.querySelector('.daily-camera').hidden=true;host.querySelector('.daily-view-hint').hidden=true;separation.hidden=true;}
  const orbit=canvas?new OrbitControls(camera,canvas):null;
  if(orbit){orbit.enableDamping=false;orbit.enablePan=true;orbit.screenSpacePanning=true;orbit.enableZoom=false;orbit.minZoom=1.15;orbit.maxZoom=3;orbit.minPolarAngle=.05;orbit.maxPolarAngle=Math.PI-.05;}
  if(orbit)bindObjectDragging(canvas,camera,()=>explosion?.root||model.root,orbit);
  let resultWasComplete=false,selected=model.initialPart||null,cutaway=model.initialCutaway??model.covers.length>0,isolated=Boolean(model.initialIsolated),labels=false,playing=false,speed=.25,phase=0,frame=0,lastTime=0,lastReading=0,disposed=false,active=true;
  // Playback can rewrite the displayed controls; replay has to hand back the
  // numbers the learner actually dialed in, so they are kept alongside.
  const configuredValues={...values};
  let initialStateForReplay,pendingReplay,inspectionBeforeResult,setupActions=[];
  let overviewZoom=1.15,followPosition=null,tallestReadings=0,lastReadingsWidth=0;
  let explosion=null,explosionAmount=0,explosionTarget=0,explosionFrame=0,explosionTime=0,assembledCamera=null,separationZoom=1;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const overrides=new Map();
  const highlight=new THREE.Box3Helper(new THREE.Box3(),0xb55830);scene.add(highlight);
  const labelNodes=new Map(),labelAnchors=new Map(),labelLeaders=new Map();
  let denseLabels=false,hoveredLabel=null,focusedLabel=null;
  const svgNS='http://www.w3.org/2000/svg',leaderLayer=document.createElementNS(svgNS,'svg');
  leaderLayer.setAttribute('aria-hidden','true');leaderLayer.setAttribute('focusable','false');leaderLayer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:hidden';wrap.append(leaderLayer);
  const labelPanel=document.createElement('div');labelPanel.dataset.labelList='';labelPanel.setAttribute('role','group');labelPanel.setAttribute('aria-label','Visible part labels');labelPanel.style.cssText='position:absolute;right:8px;top:8px;width:42%;max-width:160px;max-height:calc(100% - 16px);box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;gap:6px;padding:6px;border:1px solid #bfc2a5;border-radius:8px;background:#fff9e6f2;z-index:2;flex-direction:column;display:none';wrap.append(labelPanel);
  labelPanel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});labelPanel.addEventListener('pointerdown',event=>event.stopPropagation());labelPanel.addEventListener('scroll',drawLabelLeaders,{passive:true});
  for(const part of model.parts){
    const node=document.createElement('button');node.className='daily-model-label';node.dataset.labelPart=part.id;node.textContent=part.name;node.addEventListener('click',()=>selectPart(part.id));
    node.addEventListener('mouseenter',()=>{hoveredLabel=part.id;drawLabelLeaders();});node.addEventListener('mouseleave',()=>{hoveredLabel=null;drawLabelLeaders();});node.addEventListener('focus',()=>{hoveredLabel=null;focusedLabel=part.id;drawLabelLeaders();});node.addEventListener('blur',()=>{focusedLabel=null;drawLabelLeaders();});wrap.append(node);labelNodes.set(part.id,node);
    const group=document.createElementNS(svgNS,'g'),line=document.createElementNS(svgNS,'line'),dot=document.createElementNS(svgNS,'circle');group.dataset.labelPart=part.id;line.setAttribute('stroke','#b55830');line.setAttribute('stroke-width','1.5');dot.setAttribute('r','3');dot.setAttribute('fill','#b55830');group.append(line,dot);leaderLayer.append(group);labelLeaders.set(part.id,{group,line,dot});
  }
  function setLabelMode(dense){
    denseLabels=dense;wrap.dataset.labelMode=dense?'list':'spatial';
    for(const node of labelNodes.values()){node.style.cssText=dense?'position:static;transform:none;max-width:none;width:100%;box-sizing:border-box;flex:none;text-align:left;overflow-wrap:anywhere':'';if(dense){node.style.setProperty('font-size','.8rem','important');if(node.dataset.labelPart===selected)node.style.boxShadow='0 0 0 2px #b55830';}(dense?labelPanel:wrap).append(node);}
  }
  function drawLabelLeaders(){
    if(disposed||!active)return;
    const bounds=wrap.getBoundingClientRect(),panelBounds=labelPanel.getBoundingClientRect(),activeLabel=hoveredLabel||focusedLabel||selected;
    for(const [id,leader] of labelLeaders){const node=labelNodes.get(id),anchor=labelAnchors.get(id);let show=labels&&anchor&&!node.hidden;const rect=show?node.getBoundingClientRect():null;
      if(denseLabels)show=show&&id===activeLabel&&rect.top>=panelBounds.top&&rect.bottom<=panelBounds.bottom;
      else if(show)show=Math.hypot(rect.left+rect.width/2-bounds.left-anchor.x,rect.top+rect.height/2-bounds.top-anchor.y)>2;
      leader.group.style.display=show?'':'none';if(!show)continue;
      const x=denseLabels?rect.left-bounds.left:within(anchor.x,rect.left-bounds.left,rect.right-bounds.left),y=denseLabels?rect.top+rect.height/2-bounds.top:within(anchor.y,rect.top-bounds.top,rect.bottom-bounds.top);
      leader.line.setAttribute('x1',String(x));leader.line.setAttribute('y1',String(y));leader.line.setAttribute('x2',String(anchor.x));leader.line.setAttribute('y2',String(anchor.y));leader.dot.setAttribute('cx',String(anchor.x));leader.dot.setAttribute('cy',String(anchor.y));
    }
  }
  function drawLabels(){
    labelAnchors.clear();if(!labels){if(denseLabels)setLabelMode(false);hoveredLabel=focusedLabel=null;for(const node of labelNodes.values())node.hidden=true;for(const leader of labelLeaders.values())leader.group.style.display='none';labelPanel.style.display='none';return;}
    const width=wrap.clientWidth,height=wrap.clientHeight,rectangles=[],spatialLabels=[];let collision=false;
    for(const part of model.parts){const node=labelNodes.get(part.id);node.hidden=!shown(part.object)||(part.object.userData.labelHidden&&part.id!==selected);node.setAttribute('aria-pressed',String(part.id===selected));node.style.boxShadow=denseLabels&&part.id===selected?'0 0 0 2px #b55830':'';if(node.hidden)continue;
      const bounds=explosion?explosion.boundsFor(part.id):new THREE.Box3().setFromObject(part.object);if(bounds.isEmpty()){node.hidden=true;continue;}const point=bounds.getCenter(new THREE.Vector3()).project(camera);node.hidden=point.z< -1||point.z>1;if(node.hidden)continue;labelAnchors.set(part.id,{x:(point.x*.5+.5)*width,y:(-.5*point.y+.5)*height});
      if(!denseLabels){const left=within((point.x*.5+.5)*100,8,92),top=within((-.5*point.y+.5)*100,8,92);node.style.left=`${left}%`;node.style.top=`${top}%`;spatialLabels.push({node,left,top});}
    }
    // Measure current text after all position writes, so resize and font changes
    // are included without cached dimensions or external font listeners.
    for(const {node,left,top} of spatialLabels){const rect={left:left/100*width-node.offsetWidth/2,top:top/100*height-node.offsetHeight/2,right:left/100*width+node.offsetWidth/2,bottom:top/100*height+node.offsetHeight/2};if(rect.left<4||rect.top<4||rect.right>width-4||rect.bottom>height-4||rectangles.some(other=>rect.left<other.right+4&&rect.right+4>other.left&&rect.top<other.bottom+4&&rect.bottom+4>other.top))collision=true;rectangles.push(rect);}
    // Once crowded, retain the independently scrollable list until labels are
    // turned off. Animation and selection cannot make labels oscillate layouts.
    if(collision&&!denseLabels)setLabelMode(true);labelPanel.style.display=labels&&denseLabels&&labelAnchors.size?'flex':'none';drawLabelLeaders();
  }
  const options=host.querySelector('.daily-view-options');
  options.innerHTML=`${model.covers.length?`<label><input type="checkbox" data-cutaway ${cutaway?'checked':''}> Look inside</label>`:''}<label><input type="checkbox" data-labels> Show labels</label><label><input type="checkbox" data-isolate ${isolated?'checked':''}> Isolate selected part</label>`;
  const controlsHost=host.querySelector('.daily-mechanism-controls');
  const controlsByKey=new Map(model.controls.map(control=>[control.key,control]));
  controlsHost.innerHTML='<div class="daily-controls-heading"><h2>Try the controls</h2><button data-reset-controls>Reset experiment</button></div>'+model.controls.map(control=>{
    const id=`daily-control-${control.key}`;
    return `<div class="daily-control"><label for="${id}">${text(control.label)}</label>${control.options?`<select id="${id}" data-control="${control.key}">${control.options.map(option=>`<option value="${option.value}" ${Number(option.value)===control.initial?'selected':''}>${text(option.label)}</option>`).join('')}</select>`:`<div class="daily-control-pair"><input id="${id}" data-control="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.initial}" aria-describedby="${id}-help"><input type="number" data-number="${control.key}" min="${control.min}" max="${control.max}" step="${control.step}" value="${control.initial}" aria-label="${text(control.label)} value">${control.unit?`<span>${text(control.unit)}</span>`:''}</div>`}<p id="${id}-help">${text(control.help||'')}</p></div>`;
  }).join('');
  const primaryControls=model.controls.filter(control=>control.primary);
  if(primaryControls.length){
    const heading=document.createElement('div');heading.className='daily-scene-heading';
    const back=stage.querySelector('.daily-return');if(back)heading.append(back);
    const choices=document.createElement('div');choices.className='daily-primary-controls';choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose a type or arrangement');
    for(const control of primaryControls)choices.append(controlsHost.querySelector(`[data-control="${control.key}"]`).closest('.daily-control'));
    heading.append(choices);stage.prepend(heading);
  }
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
      if((object.userData.inspectionOnly&&selected!==object.userData.inspectionOnly)||(cutaway&&model.covers.includes(object))||(isolated&&part&&!isWithin(object,part.object)&&!isWithin(part.object,object))){overrides.set(object,object.visible);object.visible=false;}
    });
  }
  function shown(object){for(let current=object;current;current=current.parent)if(!current.visible)return false;return true;}
  function partAt(event){
    const rect=canvas.getBoundingClientRect(),root=explosion?.root||model.root;
    root.updateMatrixWorld(true);camera.updateMatrixWorld();
    pointerRay.params.Line.threshold=3*(camera.top-camera.bottom)/(camera.zoom*rect.height);
    pointerRay.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    for(const hit of pointerRay.intersectObject(root,true)){
      if(!shown(hit.object))continue;
      const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex||0]:hit.object.material;
      if(material&&(!material.visible||(material.transparent&&material.opacity===0)))continue;
      let part=explosion?model.parts.find(part=>part.id===hit.object.userData.partId):null;
      if(!explosion)for(let object=hit.object;object&&!part;object=object.parent)part=partsByObject.get(object);
      if(!part)continue;
      const point=hit.object.worldToLocal(hit.point.clone());
      if(hit.instanceId!==undefined){hit.object.getMatrixAt(hit.instanceId,instanceMatrix);point.applyMatrix4(instanceMatrix.invert());}
      return {part,object:hit.object,point,instanceId:hit.instanceId};
    }
    return null;
  }
  function hidePartPopup(){popupHit=null;popupPinned=false;partPopup.hidden=true;}
  function showPartPopup(hit,pinned=false){
    popupHit=hit;popupPinned=pinned;
    if(!hit){partPopup.hidden=true;return;}
    if(partPopup.textContent!==hit.part.name)partPopup.textContent=hit.part.name;
    positionPartPopup();
  }
  function positionPartPopup(){
    if(!popupHit||!shown(popupHit.object)){partPopup.hidden=true;return;}
    popupPoint.copy(popupHit.point);
    if(popupHit.instanceId!==undefined){popupHit.object.getMatrixAt(popupHit.instanceId,instanceMatrix);popupPoint.applyMatrix4(instanceMatrix);}
    popupHit.object.updateWorldMatrix(true,false);popupHit.object.localToWorld(popupPoint).project(camera);
    if(!Number.isFinite(popupPoint.x+popupPoint.y+popupPoint.z)||Math.abs(popupPoint.x)>1||Math.abs(popupPoint.y)>1||Math.abs(popupPoint.z)>1){partPopup.hidden=true;return;}
    partPopup.hidden=false;
    const x=(popupPoint.x*.5+.5)*wrap.clientWidth,y=(-popupPoint.y*.5+.5)*wrap.clientHeight;
    partPopup.style.left=within(x+12,8,Math.max(8,wrap.clientWidth-partPopup.offsetWidth-8))+'px';
    partPopup.style.top=within(y-partPopup.offsetHeight-12,8,Math.max(8,wrap.clientHeight-partPopup.offsetHeight-8))+'px';
  }
  function draw(){
    if(disposed||!active||!renderer)return;
    model.root.updateMatrixWorld(true);
    const chosen=model.parts.find(part=>part.id===selected);
    if(!explosion&&orbit&&chosen&&model.followParts?.includes(selected)){
      const bounds=new THREE.Box3().setFromObject(chosen.object),motionBounds=model.frameBoundsForPart?.(selected);
      if(motionBounds)bounds.union(motionBounds);
      const position=bounds.getCenter(new THREE.Vector3());
      if(followPosition){const delta=position.clone().sub(followPosition);camera.position.add(delta);orbit.target.add(delta);camera.updateMatrixWorld();}
      followPosition=position;
    }else followPosition=null;
    highlight.visible=!explosion&&model.selectionOutline!==false&&Boolean(chosen&&shown(chosen.object));
    if(highlight.visible)highlight.box.setFromObject(chosen.object);
    drawLabels();
    inventoryLabels.hidden=!explosion||explosionAmount<.98;
    if(explosion){
      for(const category of explosion.categories){
        const node=inventoryLabels.querySelector(`[data-category="${category.id}"]`);
        if(!node)continue;
        const point=category.heading.clone().project(camera);
        node.hidden=false;
        node.style.left=`${(point.x*.5+.5)*100}%`;node.style.top=`${(-point.y*.5+.5)*100}%`;
        node.style.width=`${category.width/(camera.right-camera.left)*camera.zoom*wrap.clientWidth}px`;
      }
      model.root.visible=false;
    }
    renderer.render(scene,camera);
    if(explosion)model.root.visible=true;
    positionPartPopup();
  }
  function readings(items){Object.assign(values,model.getState?.().values);syncControls();syncPlaybackButton();const complete=Boolean(model.playback?.complete()),focusResult=model.resultPart?.focusOnComplete&&complete&&!resultWasComplete;resultWasComplete=complete;if(focusResult&&selected!==model.resultPart.id){selectResult();return;}const resultButton=host.querySelector('[data-result]');if(resultButton)resultButton.disabled=!model.resultPart.available();const readingsHost=host.querySelector('.daily-readings');readingsHost.classList.toggle('daily-grouped-readings',(items||[]).some(item=>item.group));let group;readingsHost.innerHTML=(items||[]).map(item=>{const heading=item.group&&item.group!==group?`<div class="daily-reading-group"><dt>${text(item.group)}</dt><dd>${text(item.groupHint||'')}</dd></div>`:'';group=item.group;return heading+`<div><dt>${text(item.label)}</dt><dd>${text(item.value)}</dd>${item.hint?`<p>${text(item.hint)}</p>`:''}</div>`;}).join('');
    // Running a mechanism rewrites these values several times a second, and a
    // value that wraps onto a second line used to jog the parts below it. Hold
    // the tallest height reached at this width instead.
    tallestReadings=Math.max(tallestReadings,readingsHost.offsetHeight);readingsHost.style.minHeight=`${tallestReadings}px`;}
  function restoreAssembly(){
    hidePartPopup();
    cancelAnimationFrame(explosionFrame);explosionFrame=0;
    if(explosion){explosion.dispose();explosion=null;camera.position.copy(assembledCamera.position);camera.zoom=assembledCamera.zoom;orbit?.target.copy(assembledCamera.target);if(orbit){orbit.minZoom=assembledCamera.minZoom;orbit.maxZoom=assembledCamera.maxZoom;orbit.enableRotate=true;}camera.updateProjectionMatrix();orbit?.update();}
    explosionAmount=explosionTarget=0;assembledCamera=null;separationZoom=1;inventoryLabels.replaceChildren();inventoryLabels.hidden=true;
    separation.querySelector('input').value='0';separation.querySelector('output').textContent='Assembled';wrap.dataset.explosion='0';
    resizeViewer();
  }
  function paintSeparation(){
    if(!explosion)return;
    explosion.update(explosionAmount);
    // The parts stay where they are in the world and the camera pulls back to
    // hold them, so the exploded view can still be turned around. What has to be
    // held is the spread measured across the screen, which changes as it turns.
    const inverse=camera.quaternion.clone().invert(),flat=new THREE.Box3();
    for(const unit of explosion.items)for(const x of [unit.bounds.min.x,unit.bounds.max.x])for(const y of [unit.bounds.min.y,unit.bounds.max.y])for(const z of [unit.bounds.min.z,unit.bounds.max.z])flat.expandByPoint(new THREE.Vector3(x,y,z).add(unit.group.position).applyQuaternion(inverse));
    for(const category of explosion.categories){
      const heading=category.heading.clone().applyQuaternion(inverse);
      flat.expandByPoint(heading.clone().add(new THREE.Vector3(-category.width/2,-category.headerHeight/2,0)));
      flat.expandByPoint(heading.clone().add(new THREE.Vector3(category.width/2,category.headerHeight/2,0)));
    }
    const across=flat.getSize(new THREE.Vector3());
    const fit=Math.min((camera.right-camera.left)/Math.max(across.x*1.1,1e-6),(camera.top-camera.bottom)/Math.max(across.y*1.14,1e-6));
    const smooth=explosionAmount*explosionAmount*(3-2*explosionAmount);
    const target=assembledCamera.target.clone().lerp(flat.getCenter(new THREE.Vector3()).applyQuaternion(camera.quaternion),smooth);
    const offset=camera.position.clone().sub(orbit?.target||assembledCamera.target);
    camera.position.copy(target).add(offset);orbit?.target.copy(target);camera.lookAt(target);
    camera.zoom=separationZoom/((1-smooth)/assembledCamera.zoom+smooth/fit);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    separation.querySelector('input').value=String(Math.round(explosionTarget*100));
    separation.querySelector('output').textContent=explosionAmount>=.995?'Fully separated':`${Math.round(explosionAmount*100)}% separated`;
    wrap.dataset.explosion=String(explosionAmount);draw();
  }
  function animateSeparation(now){
    if(disposed||!active)return;
    const dt=Math.min(.05,(now-explosionTime)/1000);explosionTime=now;
    explosionAmount=THREE.MathUtils.damp(explosionAmount,explosionTarget,10,dt);
    if(Math.abs(explosionAmount-explosionTarget)<.001)explosionAmount=explosionTarget;
    paintSeparation();
    if(explosionAmount!==explosionTarget)explosionFrame=requestAnimationFrame(animateSeparation);
    else{explosionFrame=0;if(explosionAmount===0){restoreAssembly();draw();}}
  }
  function separate(next){
    hidePartPopup();
    if(!renderer)return;
    explosionTarget=within(next,0,1);
    if(!explosion&&next>0){
      stop();followPosition=null;assembledCamera={position:camera.position.clone(),target:orbit.target.clone(),zoom:camera.zoom,minZoom:orbit.minZoom,maxZoom:orbit.maxZoom};
      explosion=createPartExplosion(model,camera,wrap.clientWidth/wrap.clientHeight,{width:wrap.clientWidth,height:wrap.clientHeight});
      if(!explosion.items.length){restoreAssembly();separation.querySelector('output').textContent='No parts to separate in this view';return false;}
      scene.add(explosion.root);
      orbit.minZoom=.001;
      inventoryLabels.innerHTML=explosion.categories.map(category=>`<button data-category="${text(category.id)}" title="${text(category.name)}">${text(category.name)}</button>`).join('');
      resizeViewer();
    }
    if(!explosion)return;
    cancelAnimationFrame(explosionFrame);
    if(reducedMotion.matches){explosionAmount=explosionTarget;paintSeparation();if(!explosionAmount){restoreAssembly();draw();}}
    else{explosionTime=performance.now();explosionFrame=requestAnimationFrame(animateSeparation);}
  }
  separation.querySelector('input').addEventListener('input',event=>separate(Number(event.target.value)/100));
  separation.querySelector('button').addEventListener('click',()=>separate(0));
  inventoryLabels.addEventListener('click',event=>{const id=event.target.closest('[data-category]')?.dataset.category;if(id&&id!=='__structure')selectPart(id,false);});
  function update(showReadings=true){restoreVisibility();const result=model.update(values);filterVisibility();if(showReadings)readings(result);draw();}
  function syncControls(){for(const control of model.controls){const input=host.querySelector(`[data-control="${control.key}"]`),number=host.querySelector(`[data-number="${control.key}"]`);input.value=values[control.key];input.disabled=control.enabledWhen?!control.enabledWhen(values):false;input.closest('.daily-control').hidden=control.visibleWhen?!control.visibleWhen(values):false;if(number){if(document.activeElement!==number)number.value=values[control.key];number.disabled=input.disabled;}input.setAttribute('aria-valuetext',`${values[control.key]}${control.unit?' '+control.unit:''}`);}if(model.frameVisibleOnly)for(const button of host.querySelectorAll('[data-part]')){const part=model.parts.find(part=>part.id===button.dataset.part);button.disabled=Boolean(part&&!shown(part.object));button.title=button.disabled?'Not visible at this stage or in this arrangement':'';}}
  function syncPlaybackButton(){
    const button=host.querySelector('[data-play]');if(!button)return;
    const complete=Boolean(model.playback?.complete()),blocked=Boolean(model.playback?.blocked());
    button.disabled=!playing&&!complete&&blocked;
    button.innerHTML=playbackIcon(playing?'pause':'play');
    button.setAttribute('aria-label',playing?'Pause':model.playback?.label||'Play slowly');
    button.title=button.disabled?(model.playback.blockedReason||'The current setup blocks this action. Check the result for the cause.'):playing?'Pause':complete?'Play again: reset and restart the experiment':model.playback?'Play: '+model.playback.label:'Play slowly';
    button.setAttribute('aria-pressed',String(playing));
  }
  function releaseReadingsHeight(){tallestReadings=0;host.querySelector('.daily-readings').style.minHeight='';}
  function stop(){const wasPlaying=playing;playing=false;model.playback?.setPlaying?.(false);cancelAnimationFrame(frame);if(wasPlaying&&!disposed)readings(model.getState?.().readings);else syncPlaybackButton();releaseReadingsHeight();}
  function apply(next){restoreAssembly();const resume=playing;stop();for(const [key,value] of Object.entries(next)){const control=controlsByKey.get(key);if(!control||!Number.isFinite(Number(value)))continue;const bounded=within(Number(value),control.min,control.max);if(control.options&&!control.options.some(option=>Number(option.value)===bounded))continue;values[key]=control.step?Number(within(control.min+Math.round((bounded-control.min)/control.step)*control.step,control.min,control.max).toPrecision(12)):bounded;if(control.replay!==false)configuredValues[key]=values[key];}syncControls();update();if(model.autoFramePart)selectPart(model.autoFramePart);if(resume)start();}
  function selectPart(id,focus=true){
    hidePartPopup();
    if(focus){restoreAssembly();host.scrollTop=0;}
    followPosition=null;selected=id;const part=model.parts.find(part=>part.id===id);
    if(part&&cutaway&&model.covers.some(cover=>isWithin(part.object,cover))){cutaway=false;options.querySelector('[data-cutaway]').checked=false;restoreVisibility();}
    const ancestry=[];let current=part;const seen=new Set();
    while(current&&!seen.has(current.id)){ancestry.unshift(current);seen.add(current.id);current=model.parts.find(candidate=>candidate.id===current.parentId);}
    host.querySelector('.daily-part-path').innerHTML='<button data-parent="">Whole machine</button>'+ancestry.map(item=>`<span aria-hidden="true">›</span><button data-parent="${text(item.id)}">${text(item.name)}</button>`).join('');
    const children=model.parts.filter(candidate=>candidate.parentId===(part?.id||null)||(!part&&!candidate.parentId));
    host.querySelector('.daily-part-buttons').innerHTML=children.map(item=>`<button data-part="${text(item.id)}">${text(item.name)}</button>`).join('');
    host.querySelector('.daily-part-detail').innerHTML=part?`<h3>${text(part.name)}</h3><p>${text(part.description||'')}</p>${part.route?`<a class="primary" href="${text(part.route)}">Open ${text(part.name)}</a>`:''}`:'<p>Select a part to move closer. Follow the breadcrumbs to move back out.</p>';
    if(focus&&part&&orbit){model.root.updateMatrixWorld(true);const bounds=new THREE.Box3();if(model.frameVisibleOnly){part.object.traverse(object=>{if(shown(object)&&object.geometry){object.geometry.computeBoundingBox();bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));}});}else bounds.setFromObject(part.object);const motionBounds=model.frameBoundsForPart?.(id);if(motionBounds)bounds.union(motionBounds);if(!bounds.isEmpty()){const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());const direction=camera.position.clone().sub(orbit.target);orbit.target.copy(center);camera.position.copy(center).add(direction);camera.zoom=within(radius/(Math.max(size.x,size.y,size.z)*(part.framePadding??model.framePadding??(model.frameVisibleOnly?.55:.75))),.55,part.maxZoom??12);overviewZoom=camera.zoom;orbit.minZoom=overviewZoom;orbit.maxZoom=Math.max(12,overviewZoom*3);camera.updateProjectionMatrix();orbit.update();}}else if(!part&&focus)resetView();
    if(explosion){syncControls();draw();}else update();
  }
  function clearSelection(){
    if(!selected&&!popupHit)return;
    hoveredLabel=focusedLabel=null;isolated=false;options.querySelector('[data-isolate]').checked=false;
    selectPart(null,false);
  }
  function onOutsideClick(event){
    if(disposed||!active||event.button>0||event.target===canvas)return;
    if(host.contains(event.target)&&event.target.closest('button,input,select,label,a'))return;
    clearSelection();
  }
  function onEscape(event){if(event.key==='Escape'&&active&&!disposed)clearSelection();}
  // Wait for the click target to be resolved before collapsing part details.
  // Clearing on pointerdown can move a quiz button before pointerup and lose its click.
  document.addEventListener('click',onOutsideClick,true);
  document.addEventListener('keydown',onEscape);
  host.querySelector('.daily-part-path').addEventListener('click',event=>{const button=event.target.closest('[data-parent]');if(button)selectPart(button.dataset.parent||null);});
  function resetView(){restoreAssembly();overviewZoom=1.15;if(orbit){orbit.minZoom=overviewZoom;orbit.maxZoom=3;}camera.zoom=overviewZoom;camera.position.set(radius*1.3,radius*.85,radius*2);orbit?.target.set(0,0,0);camera.updateProjectionMatrix();orbit?.update();draw();}
  function zoom(factor,gesture=false){
    if(gesture&&(explosion||(factor<1&&camera.zoom<=overviewZoom+1e-6))&&separate(explosionTarget-Math.log(factor)*.65)!==false)return;
    const previous=camera.zoom;
    const minimum=explosion ? .001 : overviewZoom*.05;
    if(orbit)orbit.minZoom=minimum;
    camera.zoom=within(previous*factor,minimum,orbit?.maxZoom||3);
    if(explosion)separationZoom*=camera.zoom/previous;
    camera.updateProjectionMatrix();orbit?.update();draw();
  }
  host.querySelector('.daily-camera').addEventListener('click',event=>{
    const view=event.target.closest('[data-view]')?.dataset.view;if(!view)return;
    if(view==='reset'){selectPart(null);return;}if(view==='in'||view==='out'){zoom(view==='in'?1.2:1/1.2);return;}else{restoreAssembly();const distance=radius*2.7;camera.position.copy(orbit?.target||new THREE.Vector3()).add(new THREE.Vector3(...({iso:[radius*1.3,radius*.85,radius*2],front:[0,radius*.15,distance],side:[distance,radius*.15,0],back:[0,radius*.15,-distance],top:[0,distance,.001],bottom:[0,-distance,.001]}[view])));}orbit?.update();draw();
  });
  options.addEventListener('change',event=>{if(!event.target.matches('[data-labels]'))restoreAssembly();if(event.target.matches('[data-cutaway]'))cutaway=event.target.checked;if(event.target.matches('[data-labels]'))labels=event.target.checked;if(event.target.matches('[data-isolate]'))isolated=event.target.checked;if(explosion)draw();else update();});
  host.addEventListener('input',event=>{const key=event.target.dataset.control||event.target.dataset.number;if(!key||event.target.value==='')return;apply({[key]:Number(event.target.value)});});
  // A half typed number is below its minimum, so while the box is being typed
  // into it keeps what is there. Committing the number is the other case: the
  // machine may have refused it outright, and a box still showing a setting the
  // machine never took is a box telling the reader something untrue, so the
  // committed value is written back whether the box still has focus or not.
  host.addEventListener('change',event=>{
    const key=event.target.dataset.number;
    if(key&&Object.hasOwn(values,key))event.target.value=values[key];
    syncControls();
  });
  function reset(initialState){restoreAssembly();stop();restoreVisibility();releaseReadingsHeight();phase=0;setupActions=[];inspectionBeforeResult=undefined;initialStateForReplay=structuredClone(initialState);model.reset?.(initialState);model.animate?.(0);apply(Object.fromEntries(model.controls.map(control=>[control.key,control.initial])));if(selected===model.resultPart?.id){isolated=false;options.querySelector('[data-isolate]').checked=false;selectPart(null);}}
  host.querySelector('[data-reset-controls]').addEventListener('click',()=>reset(pendingReplay?.initialState));
  function replay(){
    const experiment={values:{...configuredValues},initialState:model.replayState?.()??initialStateForReplay,actions:[...setupActions],inspection:selected===model.resultPart?.id?(inspectionBeforeResult??{selected,isolated,direction:camera.position.clone().sub(orbit?.target||new THREE.Vector3())}):undefined};
    pendingReplay=experiment;
    try{host.querySelector('[data-reset-controls]').click();}finally{pendingReplay=undefined;}
    apply(experiment.values);
    if(experiment.actions.length){
      for(const index of experiment.actions)host.querySelector(`[data-action="${index}"]`).click();
      apply(experiment.values);
    }
    if(experiment.inspection){isolated=experiment.inspection.isolated;options.querySelector('[data-isolate]').checked=isolated;camera.position.copy(orbit?.target||new THREE.Vector3()).add(experiment.inspection.direction);orbit?.update();selectPart(experiment.inspection.selected);}
  }
  controlsHost.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
    restoreAssembly();stop();const index=Number(button.dataset.action),action=model.actions[index],before={...model.getState?.().values};
    restoreVisibility();action.run();Object.assign(values,model.getState?.().values);if(action.replay!==false)setupActions.push(index);
    for(const control of model.controls)if(control.replay!==false&&before[control.key]!==values[control.key])configuredValues[control.key]=values[control.key];
    if(action.part){isolated=Boolean(action.isolate);options.querySelector('[data-isolate]').checked=isolated;selectPart(action.part);}else update();
    if(action.view)host.querySelector(`[data-view="${action.view}"]`)?.click();
  }));
  host.querySelector('.daily-part-buttons').addEventListener('click',event=>{const id=event.target.closest('[data-part]')?.dataset.part;if(id)selectPart(id);});
  function tick(now){if(!playing||disposed||!active)return;const elapsed=Math.min((now-lastTime)/1000,.1);lastTime=now;phase+=elapsed*speed;restoreVisibility();if(model.playback)model.playback.advance(elapsed);else model.animate(phase);Object.assign(values,model.getState?.().values);filterVisibility();if(now-lastReading>200){readings(model.getState?.().readings);lastReading=now;}draw();if(model.playback?.complete()||model.playback?.blocked()){readings(model.getState().readings);stop();return;}frame=requestAnimationFrame(tick);}
  function start(){restoreAssembly();if(!model.animate||disposed||!active||model.playback?.complete()||model.playback?.blocked())return;playing=true;model.playback?.setPlaying?.(true);syncPlaybackButton();lastTime=performance.now();frame=requestAnimationFrame(tick);}
  function selectResult(isolate=false){if(selected!==model.resultPart.id)inspectionBeforeResult={selected,isolated,direction:camera.position.clone().sub(orbit?.target||new THREE.Vector3())};if(isolate){isolated=true;options.querySelector('[data-isolate]').checked=true;}selectPart(model.resultPart.id);if(model.resultPart.view)host.querySelector(`[data-view="${model.resultPart.view}"]`)?.click();}
  host.querySelector('[data-result]')?.addEventListener('click',()=>{stop();selectResult(true);});
  host.querySelector('[data-step]')?.addEventListener('click',()=>{restoreAssembly();stop();restoreVisibility();model.playback.step();filterVisibility();readings(model.getState().readings);draw();});
  if(model.playback){host.querySelector('[data-speed]').closest('label').hidden=true;const playback=host.querySelector('.daily-playback');if(model.playback.description)playback.querySelector('p').textContent=model.playback.description;playback.prepend(host.querySelector('[data-play]'),host.querySelector('[data-step]'),...controlsHost.querySelectorAll('[data-action]'));controlsHost.querySelector('.daily-controls-heading').after(playback);}
  const actionGroups=new Map();
  for(const [index,action] of (model.actions||[]).entries()){
    if(!action.group)continue;
    const button=controlsHost.querySelector(`[data-action="${index}"]`);
    let group=actionGroups.get(action.group);
    if(!group){group=document.createElement('fieldset');group.className='daily-action-group';const legend=document.createElement('legend');legend.textContent=action.group;group.append(legend);button.before(group);actionGroups.set(action.group,group);}
    group.append(button);
  }
  syncPlaybackButton();
  host.querySelector('[data-play]')?.addEventListener('click',()=>{if(playing)stop();else{if(model.playback?.complete())replay();start();}});
  host.querySelector('[data-speed]')?.addEventListener('change',event=>speed=Number(event.target.value));
  if(canvas){
    orbit.addEventListener('change',draw);
    canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home'){selectPart(null);return;}if(['+','=','-'].includes(event.key)){zoom(event.key==='-'?1/1.2:1.2);return;}else if(event.shiftKey){const amount=radius*.08/camera.zoom,delta=new THREE.Vector3().setFromMatrixColumn(camera.matrix,event.key==='ArrowLeft'||event.key==='ArrowRight'?0:1).multiplyScalar(amount*(event.key==='ArrowLeft'||event.key==='ArrowDown'?1:-1));camera.position.add(delta);orbit.target.add(delta);}else{const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));if(event.key==='ArrowLeft')spherical.theta-=.2;if(event.key==='ArrowRight')spherical.theta+=.2;if(event.key==='ArrowUp')spherical.phi=Math.max(.05,spherical.phi-.15);if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.05,spherical.phi+.15);camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(spherical));}orbit.update();draw();});
    wrap.addEventListener('wheel',event=>{event.preventDefault();if(!orbit.enabled||!allowContinuousZoom())return;const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?wrap.clientHeight:1);if(pixels)zoom(Math.exp(within(-pixels*.002,-.25,.25)),true);},{passive:false});
    const fingers=new Map();let pinchDistance=0,pinching=false;
    wrap.addEventListener('pointerdown',event=>{if(!fingers.size)pinching=false;if(event.pointerType!=='touch')return;if(event.target!==canvas)wrap.setPointerCapture(event.pointerId);fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(fingers.size===2){pinching=true;beginPinchZoom();const [a,b]=[...fingers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
    wrap.addEventListener('pointermove',event=>{if(!fingers.has(event.pointerId))return;fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(fingers.size!==2)return;const [a,b]=[...fingers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(orbit.enabled&&pinchDistance>0&&distance>0&&allowContinuousZoom(true))zoom(distance/pinchDistance,true);pinchDistance=distance;});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])wrap.addEventListener(type,event=>{fingers.delete(event.pointerId);});
    wrap.addEventListener('click',event=>{if(event.target===canvas&&pinching&&event.detail){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
    const tap=new PointerTap();
    canvas.addEventListener('pointerdown',event=>{hidePartPopup();if(fingers.size<2)pinching=false;tap.down(event.pointerId,event.clientX,event.clientY,5);});
    canvas.addEventListener('pointermove',event=>{tap.move(event.pointerId,event.clientX,event.clientY);if(event.pointerType==='mouse'&&!event.buttons&&orbit.enabled)showPartPopup(partAt(event));});
    canvas.addEventListener('pointerleave',()=>{if(!popupPinned)hidePartPopup();});
    canvas.addEventListener('pointercancel',event=>{tap.cancel(event.pointerId);hidePartPopup();});
    canvas.addEventListener('pointerup',event=>{if(!tap.up(event.pointerId,event.clientX,event.clientY)||pinching)return;const hit=partAt(event);if(!hit){clearSelection();return;}selectPart(hit.part.id,!explosion);showPartPopup(hit,true);});
  }
  function resizeViewer(){
    if(!renderer||disposed)return;
    const width=Math.max(1,wrap.clientWidth),mobile=matchMedia('(max-width: 650px)').matches;
    let height=mobile?Math.max(220,Math.min(innerHeight*.45,width*.95)):Math.max(320,Math.min(620,width*.86));
    // Readable headings consume fixed pixels. Give a phone inventory room for
    // the parts beneath them instead of fitting only its labels into the frame.
    if(mobile&&explosion){const columns=Math.max(1,Math.floor(width/130));height=Math.max(height,Math.min(innerHeight*.7,Math.ceil(explosion.categories.length/columns)*100));}
    renderer.setSize(width,height);const aspect=width/height;camera.left=-radius*aspect;camera.right=radius*aspect;camera.updateProjectionMatrix();
    if(explosion){explosion.arrange(aspect,{width,height});paintSeparation();}
    if(width!==lastReadingsWidth){lastReadingsWidth=width;releaseReadingsHeight();}draw();
  }
  const resize=new ResizeObserver(resizeViewer);resize.observe(wrap);
  const onVisibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',onVisibility);
  syncControls();selectPart(selected);if(model.initialView)host.querySelector(`[data-view="${model.initialView}"]`)?.click();if(model.animate&&!model.playback&&!matchMedia('(prefers-reduced-motion: reduce)').matches)start();
  return {apply,reset,selectPart,isReplaying:()=>Boolean(pendingReplay),setIsolated(value){isolated=Boolean(value);options.querySelector('[data-isolate]').checked=isolated;update();},setActive(value){active=value;if(!value){stop();restoreAssembly();}else draw();},setInteractionEnabled(value){if(orbit)orbit.enabled=value;},dispose(){disposed=true;restoreAssembly();stop();resize.disconnect();document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('click',onOutsideClick,true);document.removeEventListener('keydown',onEscape);orbit?.dispose();highlight.geometry.dispose();highlight.material.dispose();model.dispose();reflectionTarget?.dispose();renderer?.dispose();renderer?.forceContextLoss();}};
}
