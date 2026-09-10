import assert from 'node:assert/strict';
import {createMeterModel} from './meter-model.js';
import {chromium} from 'playwright';
const model=createMeterModel();model.advance(60);assert.equal(model.getState().energy,10);assert.equal(model.getState().registered,10);assert.equal(model.getState().turns,10);
model.advance(100);assert.equal(model.getState().registered,10);
model.reset();model.update({factor:.5});model.advance(60);assert.equal(model.getState().current,10);assert.equal(model.getState().registered,10);
model.reset();model.update({brake:.5});model.advance(60);assert.equal(model.getState().registered,40);assert.equal(model.getState().energy,10);
model.reset();model.update({brake:1,factor:1});model.advance(30);model.update({power:1200});model.advance(30);assert.equal(model.getState().registered,15);
model.reset();model.update({power:600});model.advance(10);const saved=model.getState().registered;model.update({power:0});model.advance(20);assert.equal(model.getState().registered,saved);
model.reset();model.update({power:600,pace:10});model.playback.advance(6);assert.equal(model.getState().registered,10);model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/electricity-meter`);await page.getByRole('button',{name:'Measure the appliance',exact:true}).waitFor();
 await page.getByRole('button',{name:'Measure the appliance',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Observation complete'));
 assert.match(await page.locator('.daily-readings').textContent(),/10.000 Wh recorded/);assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Inspect the energy dial',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-meter-result.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/0.000 Wh recorded/);
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(4).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 await page.getByRole('button',{name:'Measure the appliance',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Observation complete'));assert.match(await page.locator('.daily-readings').textContent(),/40.000 Wh recorded/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS meter: integrated real power, persistent energy, full observation boundary, power-factor comparison, brake calibration, clock pace, browser dial and mobile.');
}finally{await browser.close();}
