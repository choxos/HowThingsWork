import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
const near=(actual,expected)=>actual.every((value,i)=>Math.abs(value-expected[i])<1e-7);
let cases=0;
try{
  await page.route('**/view-reset-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="fixture" style="width:min(900px,100%)"></div>'}));
  await page.goto(new URL('view-reset-fixture',base).href);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    const observations=await page.evaluate(async()=>{
      const [{mountDailyLifeViewer},{houseModel}]=await Promise.all([import('/src/site/daily-life-viewer.js'),import('/src/site/house-model-kit.js')]);
      const observations=[];
      for(const [initialView,override] of [[undefined,undefined],['front'],['side'],['back'],['top'],['bottom'],['front','back']]){
        const kit=houseModel('View reset fixture');
        for(const [id,x] of [['left',-.7],['right',.7]]){
          const part=kit.part(id,id,'Camera framing fixture');
          kit.box([.5,1,.5],[x,0,0],'leaf',part);
        }
        kit.control('setting','Setting',0,10,1,0);
        const model=kit.finish(()=>({readings:[]}));
        model.initialView=initialView;
        let camera;
        model.root.traverse(object=>{if(object.isMesh)object.onBeforeRender=(renderer,scene,current)=>{camera=current;};});
        const host=document.querySelector('#fixture');
        const viewer=mountDailyLifeViewer(host,'View reset fixture',model,{initialView:override});
        if(!camera)throw new Error('WebGL must render before checking camera behavior');
        const snapshot=()=>({position:camera.position.toArray(),rotation:camera.quaternion.toArray(),zoom:camera.zoom});
        const opening=snapshot();
        host.querySelector(`[data-view="${override||initialView||'iso'}"]`).click();
        const intended=snapshot();
        const changed=[];
        for(const home of ['button','keyboard']){
          viewer.apply({setting:7});
          viewer.selectPart('left');
          host.querySelector('[data-view="side"]').click();
          host.querySelector('[data-view="in"]').click();
          const canvas=host.querySelector('canvas');
          canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
          canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',shiftKey:true,bubbles:true}));
          const separation=host.querySelector('[data-separation]');
          separation.value=100;
          separation.dispatchEvent(new Event('input',{bubbles:true}));
          const separated=Number(separation.value);
          if(home==='button')host.querySelector('[data-view="reset"]').click();
          else canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
          changed.push({home,separated,after:snapshot(),separation:Number(separation.value),selected:host.querySelectorAll('[data-parent]').length,setting:model.getState().values.setting});
        }
        observations.push({view:initialView||'iso',override,opening,intended,changed});
        viewer.dispose();
      }
      return observations;
    });
    for(const observation of observations){
      const label=`${width}px ${observation.view}${observation.override?' overridden by '+observation.override:''}`;
      assert.ok(near(observation.opening.rotation,observation.intended.rotation),label+': opens in the intended direction');
      for(const change of observation.changed){
        assert.equal(change.separated,100,label+': separation was exercised');
        assert.ok(near(change.after.rotation,observation.intended.rotation),label+': '+change.home+' restores opening angle');
        assert.ok(near(change.after.position,observation.intended.position),label+': '+change.home+' recenters');
        assert.equal(change.after.zoom,observation.intended.zoom,label+': '+change.home+' restores overview scale');
        assert.equal(change.separation,0);
        assert.equal(change.selected,1);
        assert.equal(change.setting,7,'View reset preserves experiment settings');
      }
      cases++;
    }
  }
  await page.goto(new URL('#machine/commutator',base).href);
  await page.locator('.daily-canvas-wrap canvas').waitFor();
  await page.evaluate(async()=>{
    const source=await (await fetch('/src/site/daily-life-viewer-core.js')).text();
    const moduleUrl=source.match(/import \* as THREE from ["']([^"']+)["']/)[1];
    const THREE=await import(moduleUrl);
    THREE.Object3D.prototype.onBeforeRender=function(renderer,scene,camera){window.resetCamera=camera;};
  });
  await page.locator('[data-view="back"]').click();
  const componentAngle=await page.evaluate(()=>window.resetCamera.quaternion.toArray());
  await page.locator('[data-view="side"]').click();
  await page.locator('[data-view="reset"]').click();
  assert.ok(near(await page.evaluate(()=>window.resetCamera.quaternion.toArray()),componentAngle),'Component route passes its opening-view override to Reset view');
  assert.deepEqual(errors,[]);
  console.log(`PASS ${cases} opening views and live component route: button and Home restore orientation, center and zoom after part inspection, pan, rotation and separation; experiment settings preserved.`);
}finally{await browser.close();}
