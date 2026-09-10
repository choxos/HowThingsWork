import assert from 'node:assert/strict';
import {createLightingModel} from './lighting-model.js';
import {chromium} from 'playwright';
const model=createLightingModel();
const pagePart=model.parts.find(part=>part.id==='illuminated-page').object;
const paper=pagePart.children.find(child=>child.material?.isMeshStandardMaterial);
for(const first of [0,1])for(const second of [0,1]){
 model.update({first,second});assert.equal(model.getState().current,first===second?1:0);
 assert.equal(model.root.getObjectByProperty('isPointLight',true).intensity>0,first===second);
}
model.update({first:0,second:0,resistance:36});assert.equal(model.getState().current,.25);const dim=paper.material.color.r;
model.update({resistance:0});assert.ok(paper.material.color.r>dim);
model.update({protect:2,rating:1,voltage:24});assert.equal(model.getState().current,0);assert.ok(model.getState().tripped);
assert.ok(model.parts.find(part=>part.id==='protection-contact').object.rotation.z<0);
model.update({voltage:12});assert.equal(model.getState().current,0);model.actions[0].run();model.update();assert.equal(model.getState().current,1);
model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/two-way-light-switch`);
 const output=page.locator('.daily-readings');await page.getByRole('button',{name:'Inspect the reading light',exact:true}).waitFor();
 for(const first of [0,1])for(const second of [0,1]){
  await page.getByRole('combobox',{name:'First switch',exact:true}).selectOption(String(first));
  await page.getByRole('combobox',{name:'Second switch',exact:true}).selectOption(String(second));
  assert.match(await output.textContent(),first===second?/Page illuminated/:/Page unlit/);
 }
 await page.getByRole('button',{name:'Inspect the reading light',exact:true}).click();
 await page.screenshot({path:'/tmp/howthingswork-reading-light-on.png',fullPage:true});
 await page.getByRole('combobox',{name:'First switch',exact:true}).selectOption('0');
 await page.screenshot({path:'/tmp/howthingswork-reading-light-off.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('PASS lighting: four switch combinations, dimming, protective latch/reset, visible output, inspection and mobile overflow.');
}finally{await browser.close();}
