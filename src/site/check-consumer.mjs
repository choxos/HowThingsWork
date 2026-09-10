import assert from 'node:assert/strict';
import {createConsumerModel} from './consumer-model.js';
import {chromium} from 'playwright';
const model=createConsumerModel();model.advance(10);assert.deepEqual(model.getState().blown,[false,false]);assert.equal(model.getState().total,model.getState().currents.reduce((a,b)=>a+b,0));
model.reset();model.update({kitchen:4});model.advance(10);assert.deepEqual(model.getState().blown,[true,false]);assert.equal(model.getState().currents[0],0);assert.ok(model.getState().currents[1]>0);
model.update({kitchen:1});assert.equal(model.getState().currents[0],0);model.actions[0].run();assert.ok(model.getState().currents[0]>0);
model.update({main:0});assert.equal(model.getState().total,0);assert.ok(model.parts.find(p=>p.id==='main-pole-0.62').object.rotation.z>0);
model.reset();model.update({main:1,kitchen:1,study:4});model.advance(10);assert.deepEqual(model.getState().blown,[false,true]);model.reset();model.update({kitchen:4,study:4});model.advance(10);assert.deepEqual(model.getState().blown,[true,true]);assert.equal(model.getState().total,0);model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/consumer-unit`);await page.getByRole('button',{name:'Run the circuit check',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Kitchen lamps value',exact:true}).fill('4');await page.getByRole('button',{name:'Run the circuit check',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Kitchen off · study still lit'));
 await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('10.00 / 10 s'));assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Inspect both circuits',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-consumer-independent-branches.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Kitchen lamps value',exact:true}).fill('1');await page.getByRole('button',{name:'Replace blown fuses',exact:true}).click();assert.doesNotMatch(await page.locator('.daily-readings').textContent(),/Fuse melted/);
 await page.getByRole('combobox',{name:'Main isolator',exact:true}).selectOption('0');assert.match(await page.locator('.daily-readings').textContent(),/both branches off/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS consumer unit: independent branch opening, current sum, persistent fuse gaps, restoration, linked main isolation, browser result and mobile.');
}finally{await browser.close();}
