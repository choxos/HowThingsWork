import assert from 'node:assert/strict';
import {createFuseModel} from './fuse-model.js';
import {chromium} from 'playwright';
const model=createFuseModel();
model.advance(60);assert.ok(!model.getState().melted);assert.ok(model.getState().heat<.25);
model.reset();model.update({resistance:6});model.advance(1);assert.ok(!model.getState().melted);const hot=model.getState().heat;
model.update({power:0});model.advance(1);assert.ok(model.getState().heat<hot);assert.ok(!model.getState().melted);
model.reset();model.update({power:1,resistance:6});model.advance(5);assert.ok(model.getState().melted);assert.equal(model.getState().current,0);assert.ok(Math.abs(model.getState().elapsed-1.1731055809582893)<1e-10);
model.update({resistance:24});assert.equal(model.getState().current,0);model.actions[0].run();assert.ok(model.getState().current>0);
model.reset();model.update({resistance:6});for(let i=0;i<20;i++)if(!model.getState().melted)model.advance(.1);assert.ok(Math.abs(model.getState().elapsed-1.1731055809582893)<1e-10);model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/fuse`);
 await page.getByRole('button',{name:'Run the circuit',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Lamp resistance value',exact:true}).fill('6');
 await page.getByRole('button',{name:'Run the circuit',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Fuse melted'));
 assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Inspect the fuse element',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-fuse-melted.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Lamp resistance value',exact:true}).fill('24');assert.match(await page.locator('.daily-readings').textContent(),/Fuse melted/);
 await page.getByRole('button',{name:'Replace the fuse',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Element intact · lamp lit/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS fuse: normal load, timed heating, cooling, analytic trip time, split steps, persistent gap, replacement, browser autoplay/result and mobile.');
}finally{await browser.close();}
