import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {houseComponents} from './house-components.js';
const base=process.env.SITE_URL||'http://127.0.0.1:5175/';
const output=process.env.QA_OUTPUT||process.env.EVIDENCE_DIR||'/tmp/howthingswork-house-qa';
await mkdir(output,{recursive:true});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const groups=catalog.groups.filter(g=>g.place==='home');
async function visit(route,heading){
 await page.goto(new URL('#'+route,base).href);
 await page.waitForFunction(expected=>document.querySelector('h1')?.textContent===expected,heading);
 if(route.startsWith('machine/'))await page.locator('.daily-readings dd').first().waitFor();
}
try{
 const rooms=[...new Set(groups.map(g=>g.room))];
 for(const room of rooms){await visit('room/'+slug(room),room);assert.ok(await page.locator('.house-object').count()>0);}
 const names=[...new Set(groups.flatMap(g=>g.items))];
 for(const name of names){
  const entry=catalog.entries.find(e=>e.name===name),target=catalog.entries.find(e=>e.id===(houseComponents[name]?.redirectTo||entry.id));
  await visit('machine/'+entry.id,target.name);assert.equal(await page.locator('.daily-canvas-wrap canvas').count(),1,name);
 }
 // Typing a multi-digit value must not clamp its unfinished prefix.
 await visit('machine/bathroom-scale','Bathroom scale');
 const stiffness=page.getByRole('spinbutton',{name:'Main spring stiffness value',exact:true});
 await stiffness.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('Backspace');await page.keyboard.type('25000');
 assert.equal(await stiffness.inputValue(),'25000');await page.keyboard.press('Tab');
 assert.equal(await page.locator('input[data-control="stiffness"]').inputValue(),'25000');
 await stiffness.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('Backspace');await page.keyboard.type('99999');await page.keyboard.press('Tab');
 assert.equal(await stiffness.inputValue(),'40000','clamp only after leaving the input');
 await visit('machine/cylinder-lock','Cylinder lock');
 for(const step of ['Door and cylinder lock','Hinged door','Enlarged latch assembly','Five spring-loaded pin stacks','Pin stack 1'])await page.locator('.daily-part-buttons').getByRole('button',{name:step,exact:true}).click();
 assert.match(await page.locator('.daily-part-detail').textContent(),/Pin stack 1/);
 assert.equal(await page.locator('.daily-part-path button').count(),6);
 await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();
 await page.getByRole('button',{name:'Whole machine',exact:true}).click();
 assert.ok(await page.locator('.daily-part-buttons button').count());
 await page.locator('.daily-part-buttons button').first().click();await page.locator('.daily-heading').click();
 assert.equal(await page.locator('.daily-part-path button').count(),1,'outside click clears selection');
 await page.setViewportSize({width:390,height:844});
 for(const [route,heading] of [['place/home','The house'],['room/kitchen','Kitchen'],['machine/bathroom-scale','Bathroom scale'],['machine/cylinder-lock','Cylinder lock']]){
  await visit(route,heading);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+route);
  assert.equal(await page.locator('.house-breadcrumbs a').first().isVisible(),true);
  await page.screenshot({path:output+'/'+route.replaceAll('/','-')+'-mobile.png'});
 }
 assert.deepEqual(errors,[]);
 const report={base,result:'PASS',rooms:rooms.length,routes:names.length,typedInput:true,nestedParts:true,outsideDismissal:true,mobileLayouts:4,errors};
 await writeFile(output+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
