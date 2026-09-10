import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base=process.env.SITE_URL||'http://127.0.0.1:5175/';
const near=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<1e-7);
try{
 await page.goto(base+'#machine/nail-clippers');
 await page.locator('.daily-canvas-wrap canvas').waitFor();
 await page.evaluate(async()=>{
  const source=await (await fetch('/src/site/daily-life-viewer.js')).text();
  const moduleUrl=source.match(/import \* as THREE from ["']([^"']+)["']/)[1];
  const THREE=await import(moduleUrl);
  THREE.Object3D.prototype.onBeforeRender=function(renderer,scene,camera){window.panCamera=camera;window.panScene=scene;window.panTHREE=THREE;};
 });
 for(const kind of ['daily','legacy']){
  if(kind==='legacy')await page.evaluate(async()=>{const {mountMachine}=await import('/src/site/machine-viewer.js');const host=document.createElement('div');host.id='pan-legacy';host.style.cssText='position:fixed;inset:0;z-index:99999;background:white;overflow:auto';document.body.append(host);window.panLegacy=mountMachine(host,'Toaster');});
  const host=kind==='daily'?page.locator('.daily-viewer'):page.locator('#pan-legacy'),canvas=host.locator('canvas'),reset=host.getByRole('button',{name:'Reset view',exact:true});
  await reset.click();
  const snapshot=()=>page.evaluate(()=>({position:window.panCamera.position.toArray(),quaternion:window.panCamera.quaternion.toArray(),zoom:window.panCamera.zoom}));
  const original=await snapshot();
  async function drag(dx,dy,onObject=true,modifier,returnToStart=false){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();const start=await page.evaluate(({onObject})=>{const T=window.panTHREE,ray=new T.Raycaster(),root=window.panScene.children.find(o=>o.isGroup);for(let radius=0;radius<.95;radius+=.08)for(let a=0;a<Math.PI*2;a+=.3){const x=radius*Math.cos(a),y=radius*Math.sin(a);ray.setFromCamera(new T.Vector2(x,y),window.panCamera);const hit=ray.intersectObject(root,true).some(h=>{if(!h.object.isMesh)return false;for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hit===onObject)return {x:(x+1)/2,y:(1-y)/2};}throw Error('No suitable drag start');},{onObject});const x=b.x+b.width*start.x,y=b.y+b.height*start.y;await page.mouse.move(x,y);if(modifier)await page.keyboard.down(modifier);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});if(returnToStart)await page.mouse.move(x,y,{steps:8});await page.mouse.up();if(modifier)await page.keyboard.up(modifier);}
  assert.equal(await host.locator('[data-drag]').count(),0);
  await drag(65,-45);const moved=await snapshot();assert.ok(!near(moved.position,original.position),kind+' pans');assert.ok(near(moved.quaternion,original.quaternion),kind+' preserves orientation');assert.equal(moved.zoom,original.zoom);
  if(kind==='daily')assert.equal(await host.locator('.daily-part-path [data-parent]').count(),1,'drag does not select a part');
  await reset.click();assert.ok(near((await snapshot()).position,original.position),kind+' recenters');
  await drag(65,-45,false);assert.ok(!near((await snapshot()).quaternion,original.quaternion),kind+' rotates');

  for(const modifier of ['Shift','Control','Meta'])for(const onObject of [true,false]){await reset.click();await drag(65,-45,onObject,modifier);const state=await snapshot();assert.equal(near(state.quaternion,original.quaternion),onObject,kind+' '+modifier+' preserves object/background rule');if(onObject)assert.ok(!near(state.position,original.position));}
  await reset.click();await canvas.focus();await page.keyboard.press('Shift+ArrowRight');assert.ok(!near((await snapshot()).position,original.position),kind+' keyboard pans');assert.ok(near((await snapshot()).quaternion,original.quaternion));
  await reset.click();assert.ok(near((await snapshot()).position,original.position));
  if(kind==='daily'){await drag(65,-45,true,undefined,true);assert.equal(await host.locator('.daily-part-path [data-parent]').count(),1,'out-and-back drag does not select a part');await drag(0,0);assert.ok(await host.locator('.daily-part-path [data-parent]').count()>1,'stationary click still selects a part');await reset.click();}
  await page.screenshot({path:'/tmp/htw-panning-'+kind+'.png'});
 }
 await page.evaluate(()=>{window.panLegacy.dispose();document.querySelector('#pan-legacy').remove();});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: both 3D viewers object drag moves, background drag rotates, no mode buttons, keyboard panning, fixed angle and scale, recentering, no accidental part selection, mobile width.');
}finally{await browser.close();}
