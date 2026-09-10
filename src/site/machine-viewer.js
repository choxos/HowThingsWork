import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMachine} from './machine-models.js';

export function lighting(scene) {
  scene.add(new THREE.HemisphereLight(0xfff5d6,0x74836a,1.1));
  const sun=new THREE.DirectionalLight(0xffffff,1.35);sun.position.set(-3,6,5);scene.add(sun);
}

export function frameModel(model,aspect) {
  model.root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model.root);if(model.framingBounds)bounds.union(model.framingBounds);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const radius=Math.max(size.x,size.y,size.z)*.7;
  model.root.position.sub(center);
  const camera=new THREE.OrthographicCamera(-radius*aspect,radius*aspect,radius,-radius,.01,100);
  camera.position.set(radius*1.3,radius*.85,radius*2);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  return {camera,radius};
}

export function bindObjectDragging(canvas,camera,root,controls){
  const ray=new THREE.Raycaster(),point=new THREE.Vector2();
  canvas.addEventListener('pointerdown',event=>{
    const rect=canvas.getBoundingClientRect();
    point.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    root.updateMatrixWorld(true);camera.updateMatrixWorld();ray.setFromCamera(point,camera);
    const onObject=ray.intersectObject(root,true).some(hit=>{if(!hit.object.isMesh)return false;for(let object=hit.object;object;object=object.parent)if(!object.visible)return false;return true;});
    // OrbitControls swaps pan and rotate for modifiers; compensate to preserve the hit rule.
    const modified=event.ctrlKey||event.metaKey||event.shiftKey;
    controls.mouseButtons.LEFT=onObject!==modified?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
    controls.touches.ONE=onObject?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
  },{capture:true});
}

const thumbnailCaches=new WeakMap();
export function renderRoomMachines(container,entries,factory=createMachine) {
  if(!thumbnailCaches.has(factory))thumbnailCaches.set(factory,new Map());
  const thumbnails=thumbnailCaches.get(factory);
  const pending=entries.filter(entry=>!thumbnails.has(entry.name));
  if(pending.length) {
    let renderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{return;}
    renderer.setSize(360,300);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    for(const entry of pending) {
      const model=factory(entry.name);
      if(!model){thumbnails.set(entry.name,null);continue;}
      const scene=new THREE.Scene();lighting(scene);scene.add(model.root);
      const {camera}=frameModel(model,1.2);renderer.render(scene,camera);
      thumbnails.set(entry.name,renderer.domElement.toDataURL('image/png'));model.dispose();
    }
    renderer.dispose();renderer.forceContextLoss();
  }
  for(const entry of entries) {
    const source=thumbnails.get(entry.name);
    if(source)for(const button of container.querySelectorAll(`[data-machine="${entry.id}"]`)){const image=document.createElement('img');image.src=source;image.alt='';image.className='machine-thumbnail';button.querySelector('svg')?.replaceWith(image);}
  }
}

export function mountMachine(container,name) {
  const model=createMachine(name);
  if(!model)return null;
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{model.dispose();throw new Error('3D rendering is unavailable in this browser.');}
  const scene=new THREE.Scene();lighting(scene);scene.add(model.root);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const {camera,radius}=frameModel(model,1);
  const wrapper=document.createElement('div');wrapper.className='machine-3d';
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`3D ${name}. Drag the object to move it; drag outside it to rotate. Shift and arrow keys move. Arrow keys rotate the view.`);
  wrapper.append(canvas);
  const toolbar=document.createElement('div');toolbar.className='machine-view-tools';toolbar.innerHTML='<button data-angle="front">Front</button><button data-angle="side">Side</button><button data-angle="back">Back</button><button data-angle="reset">Reset view</button>';
  wrapper.append(toolbar);
  const hint=document.createElement('p');hint.className='rotate-hint';hint.textContent='Drag the object to move it; drag outside it to rotate. Shift + arrows move; Reset view recenters.';wrapper.append(hint);
  if(model.covers.length){const button=document.createElement('button');button.className='cover-toggle';button.textContent='Look inside';button.setAttribute('aria-pressed','false');wrapper.append(button);button.addEventListener('click',()=>{const open=button.getAttribute('aria-pressed')!=='true';model.covers.forEach(cover=>cover.visible=!open);button.setAttribute('aria-pressed',String(open));button.textContent=open?'Put the cover back':'Look inside';if(name==='Refrigerator')wrapper.querySelector('input').disabled=open;draw();});}
  const controlLabel=({'Sewing machine':'Turn the handwheel','Refrigerator':'Open the door','Toaster':'Lower the bread','Cylinder lock':'Insert the key','Quartz clock':'Advance the clock','Vacuum cleaner':'Spin the fan','Power drill':'Turn the drill bit','Bicycle brake':'Turn the wheels','Tower crane':'Raise the load','3D printer':'Move the print head','Differential':'Turn the wheels','Industrial robot':'Move the arm','Nuclear reactor':'Lower control rods','MRI scanner':'Move the bed','Airplane':'Turn the propeller','Windmill':'Turn the sails','Quadcopter':'Turn the rotors','Combine harvester':'Turn the reel','Lawn sprinkler':'Sweep the spray','Digital single-lens reflex camera':'Lift the mirror','Printing press':'Turn the rollers','Violin':'Draw the bow','Passenger boat':'Turn the propeller','Yacht':'Turn the propeller','Hydrofoil':'Turn the propeller','Submarine':'Turn the propeller','Waterwheel':'Turn the wheel','Piston pump':'Pump the handle'})[name]||'Move the mechanism';
  if(model.animate){const label=document.createElement('label');label.className='mechanism-control';label.innerHTML=`${controlLabel}<input type="range" min="0" max="100" value="12" aria-label="${controlLabel}">`;wrapper.append(label);label.querySelector('input').addEventListener('input',event=>{model.animate(Number(event.target.value)/100);draw();});}
  container.replaceChildren(wrapper);
  const controls=new OrbitControls(camera,canvas);controls.enableZoom=false;controls.enablePan=true;controls.screenSpacePanning=true;controls.enableDamping=false;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI-.08;
  bindObjectDragging(canvas,camera,model.root,controls);
  let active=true,disposed=false;
  function draw(){if(active&&!disposed)renderer.render(scene,camera);}
  controls.addEventListener('change',draw);
  function setAngle(angle){const distance=radius*2.7;camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(angle)*distance,radius*.35,Math.cos(angle)*distance));controls.update();draw();}
  toolbar.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.angle==='reset'){controls.target.set(0,0,0);camera.position.set(radius*1.3,radius*.85,radius*2);controls.update();draw();}else setAngle({front:0,side:Math.PI/2,back:Math.PI}[button.dataset.angle]);});
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(event.shiftKey){const delta=new THREE.Vector3().setFromMatrixColumn(camera.matrix,event.key==='ArrowLeft'||event.key==='ArrowRight'?0:1).multiplyScalar(radius*.08/camera.zoom*(event.key==='ArrowLeft'||event.key==='ArrowDown'?1:-1));camera.position.add(delta);controls.target.add(delta);controls.update();draw();return;}const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);if(event.key==='ArrowLeft')spherical.theta-=.2;if(event.key==='ArrowRight')spherical.theta+=.2;if(event.key==='ArrowUp')spherical.phi=Math.max(.1,spherical.phi-.15);if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.1,spherical.phi+.15);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();draw();});
  const resize=new ResizeObserver(()=>{const width=Math.max(1,container.clientWidth),height=Math.max(200,Math.min(440,width*1.04));renderer.setSize(width,height);const aspect=width/height;camera.left=-radius*aspect;camera.right=radius*aspect;camera.updateProjectionMatrix();draw();});resize.observe(container);
  draw();
  return {setInteractionEnabled(value){controls.enabled=value;},setActive(value){active=value;if(value)draw();},dispose(){disposed=true;resize.disconnect();controls.dispose();model.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
