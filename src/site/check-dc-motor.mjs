import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/dc-motor/',import.meta.url);
await mkdir(evidence,{recursive:true});
page.on('pageerror',error=>errors.push(error.message));
const readings=()=>page.locator('.daily-readings').textContent();
const speed=async()=>Number((await readings()).match(/Shaft speed(-?[\d.]+) rpm/)[1]);
const run=()=>page.getByRole('button',{name:'Run selected action',exact:true}).click();
const finished=text=>page.waitForFunction(expected=>document.querySelector('.daily-readings')?.textContent.includes(expected)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',text,{timeout:90000});
async function preset(index){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
 await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
 await page.getByRole('tab',{name:'Controls',exact:true}).click();
 assert.match(await readings(),/Ready · rotor at starting angle/);
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/direct-current-motor`);
 await page.getByRole('heading',{name:'Direct-current motor',exact:true}).waitFor();
 await preset(0);await run();await finished('Running snapshot');
 const normalSpeed=await speed();assert.ok(normalSpeed>0);
 const snapshot=await readings();await page.waitForTimeout(200);assert.equal(await readings(),snapshot,'Paused snapshot must preserve state');
 await page.screenshot({path:new URL('powered-desktop.png',evidence).pathname,fullPage:true});
 console.log('PASS normal powered result, positive speed and paused state',normalSpeed);

 await preset(1);await run();await finished('Running snapshot');assert.ok(await speed()<0);
 console.log('PASS reversed supply produces reversed shaft speed');

 await preset(2);await run();await finished('No start · brushes are in the insulating gaps');assert.equal(await speed(),0);
 await page.screenshot({path:new URL('dead-center.png',evidence).pathname,fullPage:true});
 await page.getByRole('button',{name:'Give the rotor a small push',exact:true}).click();await run();await finished('Running snapshot');assert.ok(await speed()>0);
 console.log('PASS dead center remains still; explicit push enables motion');

 await preset(3);await run();await finished('No start');assert.equal(await speed(),0);assert.match(await readings(),/Driving torque0\.000 mN/);
 console.log('PASS zero field supplies no torque or movement');

 await preset(4);await run();await finished('Running snapshot');const heavySpeed=await speed();assert.ok(heavySpeed>0&&heavySpeed<normalSpeed);
 console.log('PASS greater fan drag reduces running speed',heavySpeed);

 await preset(5);await run();await finished('Running snapshot');
 await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');
 assert.match(await readings(),/Coil current-?0\.000 A/);assert.ok(await speed()>0,'Opening the circuit must preserve momentum');
 await run();await finished('Stopped · fan has coasted to rest');assert.equal(await speed(),0);
 await page.screenshot({path:new URL('coasted-to-rest.png',evidence).pathname,fullPage:true});
 console.log('PASS disconnect removes current immediately and coasts to actual rest');

 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await speed(),0);
 await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.ok(await speed()>0);
 await page.getByRole('button',{name:'Restart rotor at selected angle',exact:true}).click();assert.equal(await speed(),0);
 await page.getByRole('button',{name:'Its inertia carries it through the short gap.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:new URL('mobile.png',evidence).pathname,fullPage:true});
 console.log('PASS reset, manual step, restart, quiz and mobile width');

 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/universal-motor`);
 await page.getByRole('heading',{name:'Universal motor',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Give the rotor a small push',exact:true}).count(),0,'Universal motor must not inherit the DC mechanism');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/direct-current-motor`);
 await page.getByRole('heading',{name:'Direct-current motor',exact:true}).waitFor();
 assert.equal(await speed(),0);assert.match(await readings(),/Ready/);
 await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.ok(await speed()>0,'Explicit stepping remains available with reduced motion');
 assert.deepEqual(errors,[]);
 console.log('PASS exact DC dispatch, separate universal route, fresh reopen, reduced-motion stepping and no browser errors');
}finally{await browser.close();}
