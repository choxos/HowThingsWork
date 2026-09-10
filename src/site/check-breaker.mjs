import assert from 'node:assert/strict';
import {createBreakerModel} from './breaker-model.js';
import {chromium} from 'playwright';
const model=createBreakerModel();model.advance(3);assert.equal(model.getState().tripped,false);assert.ok(model.getState().current>0);
model.update({resistance:6});model.advance(.2);assert.ok(model.getState().pull>0);assert.equal(model.getState().angle,0);assert.ok(model.getState().current>0);
model.advance(.4);assert.ok(model.getState().tripped);assert.ok(model.getState().angle>0);assert.equal(model.getState().current,0);
model.advance(1);assert.ok(model.getState().complete);assert.equal(model.getState().pull,0);
model.update({resistance:24});assert.equal(model.getState().current,0);model.actions[0].run();assert.ok(model.getState().current>0);
model.update({resistance:6});model.advance(2);assert.ok(model.getState().complete);model.actions[0].run();model.advance(2);assert.ok(model.getState().complete);
model.reset();model.update({supply:0});model.advance(2);assert.equal(model.getState().pull,0);assert.equal(model.getState().tripped,false);model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/circuit-breaker`);await page.getByRole('button',{name:'Run the circuit',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Lamp resistance value',exact:true}).fill('6');await page.getByRole('button',{name:'Advance the trip mechanism',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Core withdraws/);
 await page.getByRole('button',{name:'Run the circuit',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Open and latched off'));assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Inspect the open contact',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-breaker-open.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Lamp resistance value',exact:true}).fill('24');await page.getByRole('button',{name:'Reset the breaker',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Contacts closed · lamp lit/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS breaker: normal current, magnetic pull before release, spring opening, current interruption, core return, persistent open contact, reset/retrip, browser result and mobile.');
}finally{await browser.close();}
