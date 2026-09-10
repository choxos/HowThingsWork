import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/electric-motor/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',error=>errors.push(error.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
async function preset(index){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),false);}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5179/'}#machine/electric-motor`);await page.getByRole('heading',{name:'Electric motor',exact:true}).waitFor();await page.locator('canvas').waitFor();
 await preset(0);await run();await finished();const normal=await value('Shaft speed');assert.ok(normal>0);assert.ok(await value('Fan power')>0);assert.ok(await value('Stored rotational energy')>0);await page.screenshot({path:new URL('powered.png',evidence).pathname,fullPage:true});
 await preset(1);await run();await finished();assert.equal(await value('Shaft speed'),0);assert.equal(await value('Source electrical power'),0);assert.equal(await value('Driving torque'),0);
 await preset(2);await run();await finished();assert.equal(await value('Shaft speed'),0);assert.ok(Math.abs(await value('Coil current'))>0);assert.ok(await value('Winding heating')>0);assert.equal(await value('Source electrical power'),await value('Winding heating'));assert.equal(await value('Mechanical conversion power'),0);await page.screenshot({path:new URL('heating-without-motion.png',evidence).pathname,fullPage:true});
 console.log('PASS electrical source drives fan; zero voltage blocks; current without field heats winding without mechanical conversion');
 await preset(3);await run();await finished();assert.ok(await value('Shaft speed')>0&&await value('Shaft speed')<normal);
 await preset(4);await run();await finished();assert.ok(await value('Shaft speed')>0&&await value('Shaft speed')<normal);await run();assert.equal(await page.locator('[data-control="load"]').inputValue(),'2');await run();const paused=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await preset(5);const initialEnergy=await value('Stored rotational energy');assert.ok(initialEnergy>0);assert.ok(await value('Shaft speed')>0);assert.equal(await value('Source electrical power'),0);assert.equal(await value('Mechanical conversion power'),0);await page.locator('[data-step]').click();assert.ok(await value('Stored rotational energy')<initialEnergy);await run();await finished();assert.equal(await value('Shaft speed'),0);assert.equal(await value('Stored rotational energy'),0);await page.screenshot({path:new URL('coasted.png',evidence).pathname,fullPage:true});await run();await run();assert.ok(await value('Stored rotational energy')>0);assert.equal(await page.locator('[data-control="operation"]').inputValue(),'1');
 console.log('PASS lower voltage and heavier load change shaft speed; configured replay/pause; prepared coast consumes stored energy and replays');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await value('Shaft speed'),0);assert.equal(await page.locator('[data-control="operation"]').inputValue(),'0');await page.locator('[data-step]').click();assert.ok(await value('Shaft speed')>0);
 await page.getByRole('button',{name:'Into winding heating, with no mechanical conversion.',exact:true}).click();await page.getByText(/That’s right/).waitFor();
 assert.equal(await page.getByRole('checkbox',{name:'Look inside',exact:true}).count(),0,'The exposed DC teaching motor has no removable cover');await page.getByRole('button',{name:'Back',exact:true}).click();await page.screenshot({path:new URL('exposed-rear.png',evidence).pathname,fullPage:true});await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('mobile.png',evidence).pathname,fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS reset, step, prediction feedback, exposed rear view, view reset, mobile and no browser errors');
}finally{await browser.close();}
