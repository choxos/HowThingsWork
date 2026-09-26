import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {utilityComponentLessons} from './utility-lessons.js';
import {neighborhoodCatalog} from './published-catalog.js';
import {groupCatalogEntries} from './catalog-hierarchy.js';

const alias=houseComponents['Rotary shuttle'],target=neighborhoodCatalog.entries.find(e=>e.id===alias.redirectTo),lesson=utilityComponentLessons['Rotary sewing hook'];
assert.equal(target.name,'Rotary sewing hook');assert.equal(houseComponents[target.name].redirectTo,undefined);assert.equal(alias.lesson,lesson);assert.equal(utilityComponentLessons['Rotary shuttle'],undefined);assert.match(lesson.overview,/book calls this lower assembly the rotary shuttle/);assert.ok(lesson.deeper.some(d=>d.title==='Rotary shuttle names the assembly'));assert.equal(lesson.tryIt.length,5);
console.log('PASS Rotary shuttle: published one-hop alias, preserved book term and one combined lesson.');
if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),base=process.env.SITE_URL||'http://127.0.0.1:5193/',out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-rotary-shuttle',cases=[],errors=[];await mkdir(out,{recursive:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
   const landed=async()=>{await page.waitForURL('**/#machine/rotary-sewing-hook');await page.getByRole('heading',{name:'Rotary sewing hook',exact:true}).waitFor();assert.match(await page.locator('.daily-overview').innerText(),/book calls this lower assembly the rotary shuttle/);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'stitch-formation');assert.equal(await page.locator('.daily-related a[href="#machine/rotary-shuttle"]').count(),0);assert.equal(await page.locator('[data-experiment]').count(),5);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:`${out}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
   await page.goto(base+'#machine/rotary-shuttle');await landed();await capture('direct-opening');await page.getByText('Rotary shuttle names the assembly',{exact:true}).click();assert.match(await page.locator('body').innerText(),/not two separate machines/);await page.getByText('What this model represents',{exact:true}).click();assert.match(await page.locator('body').innerText(),/enlarged open arc/);cases.push({width,entry:'direct',naming:true,limits:true});
   await page.getByRole('button',{name:'Back to room',exact:true}).click();await page.getByRole('heading',{name:'Sewing corner',exact:true}).waitFor();await page.getByText('Browse every object',{exact:true}).click();// The alternate name is listed once in the room's directory, and it opens the rotary hook.
   assert.equal(await page.getByRole('link',{name:'Rotary shuttle',exact:true}).count(),1);await page.getByRole('link',{name:'Rotary sewing hook',exact:true}).click();await landed();await capture('room-opening');await page.goBack();await page.getByRole('heading',{name:'Sewing corner',exact:true}).waitFor();await page.goForward();await landed();cases.push({width,entry:'room',backForward:true});
   await page.goto(base+'#list');await page.getByRole('heading',{name:'Explore the finished collection.',exact:true}).waitFor();const row=page.locator('tr').filter({has:page.locator('[data-entry="sewing-machine"]')});// The row lists the sewing machine and every part beneath it, the alternate name once.
   const sewing=groupCatalogEntries(neighborhoodCatalog.entries).find(family=>family.entry.id==='sewing-machine');assert.equal(await row.locator('button[data-entry]').count(),1+sewing.components.length);assert.equal(await row.locator('[data-part-link]').count(),0);assert.equal(await row.locator('[data-entry="rotary-shuttle"]').count(),1);await row.locator('[data-entry="rotary-sewing-hook"]').click();await landed();await capture('catalog-opening');await page.goBack();await page.getByRole('heading',{name:'Explore the finished collection.',exact:true}).waitFor();cases.push({width,entry:'catalog',nested:true,back:true});
   await page.goto(base+'#machine/needle-and-needle-thread');await page.getByRole('heading',{name:'Needle and needle thread',exact:true}).waitFor();await page.locator('.daily-related a[href="#machine/rotary-shuttle"]').click();await landed();await capture('related-opening');await page.goBack();await page.getByRole('heading',{name:'Needle and needle thread',exact:true}).waitFor();cases.push({width,entry:'related',back:true});await page.close();
  }
  assert.equal(cases.length,8);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS Rotary shuttle: eight desktop/phone direct, room, catalog and related-link paths; history, naming, limits and no self-link.');
 }finally{await browser.close();}
}
