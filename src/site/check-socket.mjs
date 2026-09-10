import assert from 'node:assert/strict';
import {createSocketModel} from './socket-model.js';
import {chromium} from 'playwright';
const model=createSocketModel();assert.equal(model.getState().powered,false);assert.equal(model.getState().travel,0);
model.update({insertion:.4});assert.ok(model.getState().travel>0);assert.equal(model.getState().earthContact,false);assert.equal(model.getState().powerContacts,false);
model.update({insertion:.6});assert.equal(model.getState().travel,.28);assert.equal(model.getState().earthContact,true);assert.equal(model.getState().powerContacts,false);
model.update({insertion:.81});assert.equal(model.getState().powered,true);assert.equal(model.getState().current,.5);model.update({switch:0});assert.equal(model.getState().powered,false);assert.equal(model.getState().powerContacts,true);
model.update({switch:1,insertion:1});assert.equal(model.getState().powered,true);assert.ok(model.getState().position-1.1> -1.04);assert.ok(model.getState().position-.8>-.72);model.update({insertion:.6});assert.equal(model.getState().powered,false);assert.equal(model.getState().earthContact,true);
model.actions[0].run();assert.equal(model.getState().travel,0);assert.equal(model.getState().earthContact,false);
for(const hz of [30,60,144]){model.reset();model.update({insertion:0});for(let i=0;i<hz*3;i++)model.advance(1/hz);assert.equal(model.getState().values.insertion,1);assert.equal(model.getState().powered,true);}
model.actions[0].run();model.advance(1.5);assert.equal(model.getState().values.insertion,.5);model.update({insertion:.25});model.advance(.15);assert.equal(model.getState().values.insertion,.3);model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/power-socket`);await page.getByRole('button',{name:'Insert the plug',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Plug insertion value',exact:true}).fill('.6');assert.match(await page.locator('.daily-readings').textContent(),/Lamp off/);await page.getByRole('button',{name:'Side',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-socket-shutter-open.png',fullPage:true});
 await page.getByRole('button',{name:'Insert the plug',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Insertion100%'));assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');assert.match(await page.locator('.daily-readings').textContent(),/Connected lamp illuminates the page/);await page.screenshot({path:'/tmp/howthingswork-socket-powered.png',fullPage:true});
 assert.equal(await page.getByRole('spinbutton',{name:'Plug insertion value',exact:true}).inputValue(),'1');await page.getByRole('combobox',{name:'Socket switch',exact:true}).selectOption('0');assert.match(await page.locator('.daily-readings').textContent(),/socket switch off/);await page.getByRole('button',{name:'Withdraw the plug',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/ShutterClosed/);assert.equal(await page.getByRole('spinbutton',{name:'Plug insertion value',exact:true}).inputValue(),'0');
 await page.getByRole('combobox',{name:'Socket switch',exact:true}).selectOption('1');await page.getByRole('button',{name:'Insert the plug',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Insertion100%'));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS power socket: shutter/contact sequence, reversible insertion, switching, pin clearances, frame-rate independence, live lamp outcome and mobile.');
}finally{await browser.close();}
