import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/motor-rotor/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',error=>errors.push(error.message));
const readings=()=>page.locator('.daily-readings').textContent();
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const speed=async()=>parseFloat(await reading('Shaft speed'));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
async function preset(index){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),false);}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5179/'}#machine/motor-rotor`);await page.getByRole('heading',{name:'Motor rotor',exact:true}).waitFor();
 assert.match(await page.locator('.daily-part-detail').textContent(),/Three-coil laminated rotor/);
 await preset(0);assert.match(await page.locator('.daily-part-detail').textContent(),/Armature branch 0/);
 const signs=new Set();for(let i=0;i<32;i++){await page.locator('[data-step]').click();const text=await reading('Armature branch currents');signs.add(Math.sign(Number(text.match(/^0: (-?[\d.]+)/)[1])));assert.ok(await speed()>=0);}
 assert.ok(signs.has(1)&&signs.has(-1));await run();await finished();const normal=await speed();assert.ok(normal>0);await page.screenshot({path:new URL('winding-running.png',evidence).pathname,fullPage:true});
 console.log('PASS named winding reverses current while the rotor drives the fan forward');
 await preset(1);assert.match(await reading('Commutation'),/shorts branch 1/);await page.locator('[data-step]').click();assert.ok(await speed()>0);assert.match(await reading('Commutation'),/shorts branch 1/);await page.screenshot({path:new URL('brush-overlap.png',evidence).pathname,fullPage:true});await run();await finished();assert.ok(await speed()>0);
 await preset(2);await run();await finished();assert.ok(await speed()>0&&await speed()<normal);
 await run();assert.equal(await page.locator('[data-control="load"]').inputValue(),'2','Replay preserves the selected experiment load');await run();const paused=await readings();await page.waitForTimeout(250);assert.equal(await readings(),paused);
 console.log('PASS overlap, load comparison, replay and pause');
 await preset(3);await run();await finished();assert.ok(await speed()>0);assert.ok(parseFloat(await reading('Series current'))<0);
 await preset(4);assert.ok(await speed()>0);assert.equal(parseFloat(await reading('Series current')),0);await run();await finished();assert.equal(await speed(),0);await page.screenshot({path:new URL('coasted.png',evidence).pathname,fullPage:true});
 await preset(5);await run();await finished();assert.equal(await speed(),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.match(await page.locator('.daily-part-detail').textContent(),/Three-coil laminated rotor/);assert.equal(await speed(),0);await page.locator('[data-step]').click();assert.ok(await speed()>0);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('mobile.png',evidence).pathname,fullPage:true});
 await page.getByRole('link',{name:'Universal motor →',exact:true}).click();await page.getByRole('heading',{name:'Universal motor',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS series reversal, prepared coast to rest, zero voltage, reset component focus, stepping, mobile, parent navigation and no browser errors');
}finally{await browser.close();}
