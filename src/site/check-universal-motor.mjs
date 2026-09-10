import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/universal-motor/',import.meta.url);
await mkdir(evidence,{recursive:true});
page.on('pageerror',error=>errors.push(error.message));
const readings=()=>page.locator('.daily-readings').textContent();
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const speed=async()=>parseFloat(await reading('Shaft speed'));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
async function preset(index){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
 await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
 await page.getByRole('tab',{name:'Controls',exact:true}).click();
 assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5179/'}#machine/universal-motor`);
 await page.getByRole('heading',{name:'Universal motor',exact:true}).waitFor();
 await page.locator('.daily-canvas-wrap canvas').waitFor();
 await preset(0);assert.equal(await speed(),0);
 await run();await finished();const normal=await speed();assert.ok(normal>0);
 const snapshot=await readings();await page.waitForTimeout(250);assert.equal(await readings(),snapshot);
 await page.screenshot({path:new URL('powered-desktop.png',evidence).pathname,fullPage:true});
 await run();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'true');await run();
 const paused=await readings();await page.waitForTimeout(250);assert.equal(await readings(),paused);
 console.log('PASS powered result, completion replay and pause',normal);
 await preset(1);await run();await finished();assert.ok(await speed()>0);assert.ok(Math.abs(await speed()-normal)<.1);
 console.log('PASS supply reversal preserves the driving direction and speed');
 await preset(2);const signs=new Set(),contacts=new Set();
 for(let step=0;step<42;step++){
  await page.locator('[data-step]').click();const current=parseFloat(await reading('Series current'));
  if(Math.abs(current)>.01){signs.add(Math.sign(current));assert.match(await reading('Field direction'),current>0?/Left N/:/Left S/);}
  contacts.add(await reading('Brush contacts'));assert.ok(await speed()>=0);
 }
 assert.equal(signs.size,2);assert.ok(contacts.size>2);console.log('PASS stepped AC reverses current and poles while the forward fan keeps moving; brushes exchange contacts');
 for(const index of [2,3]){await preset(index);assert.equal(await page.locator('[data-control="frequency"]').isDisabled(),false);await run();await finished();assert.ok(await speed()>0);}
 console.log('PASS both slow AC presets drive the fan forward');
 await preset(4);await run();await finished();assert.ok(await speed()>0&&await speed()<normal);
 console.log('PASS increased fan drag lowers speed');
 await preset(5);await run();await finished();assert.equal(await speed(),0);
 console.log('PASS zero-voltage preset cannot start');
 await preset(6);assert.equal(parseFloat(await reading('Series current')),0);assert.equal(parseFloat(await reading('Driving torque')),0);assert.ok(await speed()>0,'Coast preset must prepare actual moving state');await run();await finished();assert.equal(await speed(),0);
 await page.screenshot({path:new URL('coasted-to-rest.png',evidence).pathname,fullPage:true});
 console.log('PASS prepared running fan coasts to actual rest');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await speed(),0);
 assert.equal(await page.locator('[data-control="frequency"]').isDisabled(),true);
 await page.locator('[data-step]').click();assert.ok(await speed()>0);
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();
 await page.screenshot({path:new URL('exterior.png',evidence).pathname,fullPage:true});
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.screenshot({path:new URL('commutator-back.png',evidence).pathname,fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:new URL('mobile.png',evidence).pathname,fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS reset, step, dependent controls, cutaway, views, mobile and no browser errors');
}finally{await browser.close();}
