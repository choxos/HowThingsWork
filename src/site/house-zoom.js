// Keep a wheel burst or pinch from carrying through multiple scene boundaries.
let lastZoomInput=0,zoomStopped=false;
export function allowContinuousZoom(pinching=false){const now=performance.now();if(!pinching&&now-lastZoomInput>240)zoomStopped=false;lastZoomInput=now;return !zoomStopped;}
export function stopContinuousZoom(){zoomStopped=true;lastZoomInput=performance.now();}
export function beginPinchZoom(){zoomStopped=false;lastZoomInput=performance.now();}

export function bindHouseZoom(host,parentRoute,roomPreview=null){
 const scene=host.querySelector('.house-zoom-scene');
 if(!scene)return ()=>{};
 const layer=scene.querySelector('.house-zoom-layer'),targets=[...scene.querySelectorAll('[data-zoom-target]')];
 const controls=document.createElement('div');controls.className='house-zoom-controls';
 controls.innerHTML='<label>Look toward <select aria-label="Look toward"></select></label><button type="button" data-house-zoom="out" aria-label="Zoom out">−</button><button type="button" data-house-zoom="in" aria-label="Zoom in">+</button><output aria-live="polite"></output><p>Point at a room or object, then scroll up to enter. Pinch out or press + to move closer; − pulls back.</p>';
 (scene.closest('.plan-layout')||scene).after(controls);
 const select=controls.querySelector('select'),status=controls.querySelector('output');
 targets.forEach((target,i)=>select.add(new Option(target.dataset.zoomTarget,String(i))));
 let selected=targets[0],depth=0,frame=0,disposed=false,pinch=0,selectionPinned=false;
 let preview=null,previewReady=Promise.resolve(),animation=null,approachAnimation=null,action=0;
 const pointers=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 scene.tabIndex=0;scene.setAttribute('role','region');scene.setAttribute('aria-label','Zoomable scene. Point at a destination and scroll up, or use the zoom controls.');
 function cancelTravel(){
  action++;cancelAnimationFrame(frame);
  if(animation){depth=Number(getComputedStyle(preview).opacity);animation.cancel();animation=null;}
  approachAnimation?.cancel();approachAnimation=null;
 }
 function choose(target){
  if(roomPreview&&(target!==selected||!preview)){
   cancelTravel();depth=0;preview?.remove();
   const destination=roomPreview(target.dataset.zoomTarget),next=document.createElement('div');
   next.className='house-room-preview';next.dataset.route=target.hash;next.innerHTML=destination.html;next.style.opacity='0';next.setAttribute('aria-hidden','true');scene.append(next);preview=next;
   const image=next.querySelector('img')||new Image();if(!image.src)image.src=destination.src;
   previewReady=image.decode().then(()=>{if(!disposed&&preview===next){next.dataset.ready='true';paint();if(depth>=1)enter();}}).catch(()=>{if(!disposed&&preview===next)status.textContent='The room image could not load. Choose another room to try again.';return false;});
  }
  selected=target;select.value=String(targets.indexOf(target));
  const page=target.closest('[data-spatial-page]');
  scene.querySelectorAll('[data-spatial-page]').forEach(item=>item.hidden=item!==page);
  targets.forEach(item=>item.toggleAttribute('data-selected',item===target));
  status.textContent=`Zoom toward ${target.dataset.zoomTarget}`;
 }
 function paint(){
  if(depth===0){layer.style.transform='';const bounds=scene.getBoundingClientRect(),target=selected.getBoundingClientRect();layer.style.transformOrigin=`${(target.left+target.width/2-bounds.left)/bounds.width*100}% ${(target.top+target.height/2-bounds.top)/bounds.height*100}%`;}
  layer.style.transform=`scale(${roomPreview?(motion.matches?1:1+depth*.08):1+depth*2.3})`;if(preview)preview.style.opacity=preview.dataset.ready?String(depth):'0';scene.dataset.zoomDepth=String(depth);
 }
 function enter(){
  const current=action,target=selected;
  previewReady.then(ready=>{if(ready!==false&&!disposed&&current===action&&target===selected){stopContinuousZoom();scene.dataset.handoffRoute=target.hash;location.hash=target.hash;}});
 }
 function change(amount){
  cancelTravel();
  if(amount<0&&depth===0){stopContinuousZoom();location.hash=parentRoute;return;}
  if(depth===0)paint();
  depth=Math.max(0,Math.min(1,depth+amount));paint();
  if(depth>=1)enter();else if(depth===0&&amount<0)stopContinuousZoom();
 }
 function travel(inward){
  cancelTravel();
  if(!inward){if(depth===0){location.hash=parentRoute;return;}depth=0;paint();return;}
  if(roomPreview)selectionPinned=true;
  if(motion.matches){enter();return;}
  if(roomPreview){
   const current=action;
   previewReady.then(ready=>{
    if(ready===false||disposed||current!==action)return;
    approachAnimation=layer.animate([{transform:`scale(${1+depth*.08})`},{transform:'scale(1.08)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
    animation=preview.animate([{opacity:depth},{opacity:1}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
    animation.finished.then(()=>{if(disposed||current!==action)return;animation.cancel();animation=null;approachAnimation.cancel();approachAnimation=null;depth=1;paint();enter();}).catch(()=>{});
   });return;
  }
  if(depth===0)paint();
  const initial=depth,start=performance.now();
  function tick(now){if(disposed)return;const t=Math.min(1,(now-start)/450);depth=initial+(1-initial)*t*t*(3-2*t);paint();if(t===1)enter();else frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);
 }
 function point(x,y){
  if(depth>0||selectionPinned)return;
  const visible=targets.filter(item=>!item.closest('[hidden]'));
  const distance=item=>{const b=item.getBoundingClientRect();return Math.hypot(x-b.left-b.width/2,y-b.top-b.height/2);};
  choose(visible.reduce((best,item)=>distance(item)<distance(best)?item:best,visible[0]));
 }
 scene.addEventListener('wheel',event=>{event.preventDefault();if(!allowContinuousZoom())return;selectionPinned=false;point(event.clientX,event.clientY);const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?scene.clientHeight:1);change(Math.max(-.2,Math.min(.2,-pixels*.0025)));},{passive:false});
 scene.addEventListener('pointermove',event=>{
  if(event.pointerType==='mouse'&&!pointers.size)point(event.clientX,event.clientY);
  if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);point((a.x+b.x)/2,(a.y+b.y)/2);if(allowContinuousZoom(true))change((distance-pinch)*.008);pinch=distance;}
 });
 scene.addEventListener('pointerdown',event=>{selectionPinned=false;if(event.pointerType==='mouse')return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});scene.setPointerCapture(event.pointerId);if(pointers.size===2){beginPinchZoom();const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(type,event=>pointers.delete(event.pointerId));
 scene.addEventListener('click',event=>{const target=event.target.closest('[data-zoom-target]');if(!target||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();choose(target);travel(true);});
 scene.addEventListener('focusin',event=>{const target=event.target.closest('[data-zoom-target]');if(target)choose(target);});
 scene.addEventListener('keydown',event=>{if(!['+','=','-','Escape'].includes(event.key))return;event.preventDefault();travel(event.key==='+'||event.key==='=');});
 controls.addEventListener('click',event=>{const button=event.target.closest('[data-house-zoom]');if(button)travel(button.dataset.houseZoom==='in');});
 select.addEventListener('change',()=>{selectionPinned=true;cancelTravel();depth=0;layer.style.transform='';choose(targets[Number(select.value)]);paint();});
 choose(selected);paint();
 return ()=>{disposed=true;cancelTravel();pointers.clear();};
}
