import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/commutator/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',error=>errors.push(error.message));
const readings=()=>page.locator('.daily-readings').textContent();
const speed=async()=>Number((await readings()).match(/Shaft speed(-?[\d.]+) rpm/)[1]);
const run=()=>page.getByRole('button',{name:'Run selected action',exact:true}).click();
const finished=text=>page.waitForFunction(expected=>document.querySelector('.daily-readings')?.textContent.includes(expected)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',text,{timeout:90000});
async function focused(){assert.match(await page.locator('.daily-part-detail').textContent(),/Insulated split-ring commutator/);assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),false);}
async function preset(index){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await focused();}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/commutator`);await page.getByRole('heading',{name:'Commutator',exact:true}).waitFor();await focused();
 await preset(0);const assignments=new Set(),directions=new Set();
 for(let i=0;i<45;i++){
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();const text=await readings();
  if(text.includes('+x: A'))assignments.add('A');if(text.includes('+x: B'))assignments.add('B');
  const current=Number(text.match(/Coil current(-?[\d.]+) A/)[1]);if(Math.abs(current)>.001)directions.add(Math.sign(current));
 }
 assert.equal(assignments.size,2,'Fixed brush must meet both segments');assert.equal(directions.size,2,'Winding current must reverse');
 await run();await finished('Running snapshot');assert.ok(await speed()>0);await focused();
 await page.screenshot({path:new URL('commutating-back-view.png',evidence).pathname,fullPage:true});
 console.log('PASS brush exchanges, winding-current reversal and preserved component focus');

 await preset(1);await run();await finished('No start · brushes are in the insulating gaps');assert.equal(await speed(),0);assert.match(await readings(),/Both on insulation/);
 await page.screenshot({path:new URL('resting-gap.png',evidence).pathname,fullPage:true});
 await page.getByRole('button',{name:'Give the rotor a small push',exact:true}).click();await run();await finished('Running snapshot');assert.ok(await speed()>0);await focused();
 console.log('PASS resting gap and explicit nudge');

 await preset(2);await run();await finished('Running snapshot');assert.ok(await speed()<0);await focused();
 console.log('PASS reverse supply with the same commutator');

 await preset(3);await run();await finished('Running snapshot');await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');assert.ok(await speed()>0);assert.match(await readings(),/Coil current-?0\.000 A/);
 await run();await finished('Stopped · fan has coasted to rest');assert.equal(await speed(),0);await focused();
 console.log('PASS moving contacts provide no drive after disconnection');

 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await focused();assert.equal(await speed(),0);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('mobile.png',evidence).pathname,fullPage:true});
 await page.getByRole('link',{name:'Direct-current motor →',exact:true}).click();await page.getByRole('heading',{name:'Direct-current motor',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS reset focus, mobile, parent navigation and no browser errors');
}finally{await browser.close();}
