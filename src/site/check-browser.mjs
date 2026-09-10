import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=process.env.SITE_URL||'http://127.0.0.1:5175/';
const output=process.env.QA_OUTPUT||'/tmp/howthingswork-house-qa';
fs.mkdirSync(output,{recursive:true});
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('./catalog-data.js',import.meta.url),'utf8').replace(/export \{neighborhoodCatalog\};/, '')+';globalThis.data=neighborhoodCatalog',context);
const catalog=context.data,slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const groups=catalog.groups.filter(g=>g.place==='home');
async function visit(route){await page.goto(`${base}#${route}`);await page.locator('h1').waitFor();await page.waitForFunction(()=>!document.querySelector('.daily-viewer')||document.querySelector('.daily-readings dd'));}
try{
 for(const room of new Set(groups.map(g=>g.room))){await visit(`room/${slug(room)}`);assert.equal(await page.locator('h1').textContent(),room);assert.ok(await page.locator('.house-object').count()>0);}
 const names=[...new Set(groups.flatMap(g=>g.items))];
 for(const name of names){await visit(`machine/${slug(name)}`);assert.equal(await page.locator('h1').textContent(),name);assert.equal(await page.locator('.daily-canvas-wrap canvas').count(),1,name);assert.ok(await page.locator('.daily-readings dd').count()>0,name);}
 await visit('machine/calculator');await page.getByRole('spinbutton',{name:'First number value',exact:true}).fill('15');await page.getByRole('spinbutton',{name:'Second number value',exact:true}).fill('15');await page.getByLabel('Operation',{exact:true}).selectOption('1');assert.match(await page.locator('.daily-readings').textContent(),/225/);
 // Typed entry, one key at a time: a value below the minimum must survive being
 // half typed. fill() sets the whole value at once and cannot catch this.
 await visit('machine/bathroom-scale');
 const stiffness=page.getByRole('spinbutton',{name:'Effective spring stiffness value',exact:true});
 await stiffness.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('Backspace');
 await page.keyboard.type('20000');
 assert.equal(await stiffness.inputValue(),'20000','typing a value with a multi-digit minimum');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('input[data-control="stiffness"]').inputValue(),'20000','slider follows the typed value');
 await stiffness.click();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('Backspace');
 await page.keyboard.type('99999');await page.keyboard.press('Tab');
 assert.equal(await stiffness.inputValue(),'30000','an out of range entry is bounded once the box is left');
 // A pin stack sits four levels down, so walk in the way a reader has to.
 await visit('machine/cylinder-lock');
 for(const step of ['Door and cylinder lock','Hinged door','Enlarged latch assembly','Five spring-loaded pin stacks','Pin stack 1'])
  await page.locator('.daily-part-buttons').getByRole('button',{name:step,exact:true}).click();
 assert.match(await page.locator('.daily-part-detail').textContent(),/Pin stack 1/);
 assert.equal(await page.locator('.daily-part-path button').count(),6,'breadcrumbs name the whole machine and each step down');
 await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();
 await page.getByRole('button',{name:'Whole machine',exact:true}).click();
 assert.ok(await page.locator('.daily-part-buttons button').count()>=1,'the whole machine is reachable again');
 await visit('machine/washing-machine');await page.getByLabel('Cycle stage',{exact:true}).selectOption('3');await page.getByRole('spinbutton',{name:'Unbalanced load mass value',exact:true}).fill('.2');assert.match(await page.locator('.daily-readings').textContent(),/1.25 mm/);assert.equal(await page.getByRole('spinbutton',{name:'Wash / rinse speed value',exact:true}).isDisabled(),true);await page.screenshot({path:`${output}/washing-desktop.png`});
 await page.setViewportSize({width:390,height:844});
 for(const route of ['place/home','room/kitchen','machine/washing-machine','machine/cylinder-lock']){await visit(route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow: ${route}`);assert.equal(await page.locator(".house-breadcrumbs a").first().isVisible(),true);await page.screenshot({path:`${output}/${route.replaceAll('/','-')}-mobile.png`});}
 assert.deepEqual(errors,[]);console.log(`PASS: 10 rooms, ${names.length} machine/component routes, calculator input, nested parts, washer controls, four mobile layouts, no browser errors. Screenshots: ${output}`);
}finally{await browser.close();}
