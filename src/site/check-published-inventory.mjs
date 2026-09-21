import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {neighborhoodCatalog} from './published-catalog.js';
import {partHref} from './catalog-hierarchy.js';
import {houseComponents} from './house-components.js';
import catalogParts from './catalog-parts.json' with {type:'json'};

const base=process.env.SITE_URL||'http://127.0.0.1:5192/';
const canonical=entry=>neighborhoodCatalog.entries.find(candidate=>candidate.id===(houseComponents[entry.name]?.redirectTo||entry.id));
const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/published-inventory-20260919';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[],layouts=[],links=[];
let current=null;
const report=async()=>writeFile(out+'/results.json',JSON.stringify({base,current,layouts,links,errors},null,2)+'\n');
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});
  page.setDefaultTimeout(60000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'#list');
  for(const entry of neighborhoodCatalog.entries){
   const target=canonical(entry);
   assert.ok(target&&!houseComponents[target.name]?.redirectTo,entry.id+': valid one-hop published target');
   current={id:entry.id,viewport};
   await page.evaluate(id=>{location.hash='machine/'+id;},entry.id);
   await page.waitForFunction(expected=>location.hash==='#machine/'+expected.id&&document.querySelector('.daily-heading h1')?.textContent===expected.name&&document.querySelector('canvas'),target);
   const slider=page.getByRole('slider',{name:'Separate parts',exact:true});
   await slider.fill('100');
   await page.waitForFunction(()=>document.querySelector('.daily-canvas-wrap')?.dataset.explosion==='1');
   await page.locator('.daily-canvas-wrap').scrollIntoViewIfNeeded();
   const observation=await page.evaluate(()=>{
    const wrap=document.querySelector('.daily-canvas-wrap').getBoundingClientRect();
    const boxes=[...document.querySelectorAll('.daily-inventory-labels [data-category]')].map(node=>({name:node.textContent,hidden:node.hidden,...node.getBoundingClientRect().toJSON()}));
    const overlap=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
     const a=boxes[i],b=boxes[j];
     if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlap.push([a.name,b.name]);
    }
    return {canvas:wrap.toJSON(),boxes,overlap,clipped:boxes.filter(b=>b.hidden||b.left<wrap.left-1||b.right>wrap.right+1||b.top<wrap.top-1||b.bottom>wrap.bottom+1).map(b=>b.name),pageOverflow:document.documentElement.scrollWidth>innerWidth};
   });
   const filename=entry.id+'-'+viewport.width+'.png';
   await page.screenshot({path:out+'/'+filename,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
   for(const view of ['out','in']){
    await page.locator('[data-view="'+view+'"]').click();
    assert.equal(await slider.inputValue(),'100',entry.name+': +/- preserves separation');
   }
   await page.locator('[data-reassemble]').click();
   assert.equal(await page.locator('.daily-canvas-wrap').getAttribute('data-explosion'),'0');
   assert.equal(await slider.inputValue(),'0');
   assert.equal(new URL(page.url()).hash,'#machine/'+target.id);
   layouts.push({id:entry.id,viewport,filename,...observation});
   if(observation.overlap.length||observation.clipped.length||observation.pageOverflow)console.log('LAYOUT FINDING',entry.id,viewport.width,JSON.stringify({overlap:observation.overlap,clipped:observation.clipped,overflow:observation.pageOverflow}));
   if(layouts.length%10===0){await report();console.log('Layouts checked:',layouts.length);}
  }
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'#list');
 await page.waitForSelector('.catalog-table tbody tr');
 const shown=await page.locator('[data-part-link]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
 assert.equal(shown.length,0,'Catalog lists machines, not geometry parts');
 for(const [id,parts] of Object.entries(catalogParts))for(const part of parts){
  const target=canonical(neighborhoodCatalog.entries.find(entry=>entry.id===id));
  await page.evaluate(hash=>{location.hash=hash;},partHref(id,part.id));
  await page.waitForFunction(expected=>location.hash===expected.hash&&document.querySelector('.daily-heading h1')?.textContent===expected.machine&&document.querySelector('.daily-part-detail h3')?.textContent===expected.part,{hash:partHref(target.id,part.id),machine:target.name,part:part.name});
  const visible=await page.locator('.daily-part-detail h3').isVisible();
  assert.ok(visible,id+': '+part.name);
  links.push({id,part:part.id,name:part.name});
  if(links.length%25===0){await report();console.log('Part links checked:',links.length);}
 }
 await page.close();
 await report();
 assert.deepEqual(errors,[]);
 assert.deepEqual(layouts.filter(row=>row.overlap.length||row.clipped.length||row.pageOverflow),[],'Every inventory heading fits without collisions');
 console.log(JSON.stringify({result:'PASS',layouts:layouts.length,partLinks:links.length,catalogLinks:shown.length}));
}finally{await report();await browser.close();}
