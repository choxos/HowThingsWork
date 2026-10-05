import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {componentParentIds,catalogMachineComponents} from './catalog-hierarchy.js';

const base=process.env.SITE_URL||'http://127.0.0.1:4173/',out=process.env.EVIDENCE_DIR||'documentation/room-catalog-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],rooms=[],parentLinks=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.stack));
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const smallIds=new Set(catalogMachineComponents(catalog.entries).map(entry=>entry.id));
const wholeIds=new Set(catalog.entries.filter(entry=>!componentParentIds[entry.id]).map(entry=>entry.id));
const ordered=items=>[...items].sort();
try{
 for(const room of new Set(catalog.groups.filter(group=>group.place==='home').map(group=>group.room))){
  const groupIds=new Set(catalog.groups.filter(group=>group.place==='home'&&group.room===room).map(group=>group.id));
  const entries=catalog.entries.filter(entry=>groupIds.has(entry.group));
  const whole=entries.filter(entry=>wholeIds.has(entry.id)),small=entries.filter(entry=>smallIds.has(entry.id));
  const ordinary=entries.filter(entry=>componentParentIds[entry.id]&&!smallIds.has(entry.id));
  await page.goto(new URL('#room/'+slug(room),base).href);await page.getByRole('heading',{name:room,level:1,exact:true}).waitFor();
  const scene=await page.locator('.house-room-frame a[href^="#machine/"]').evaluateAll(links=>links.map(link=>link.getAttribute('href').slice(9)));
  assert.deepEqual(ordered(scene),ordered([...whole,...small].map(entry=>entry.id)),room+': room illustration contains only whole and smaller machines');
  const cards=await page.locator('article.house-object').evaluateAll(elements=>elements.map(element=>element.dataset.machine));
  assert.deepEqual(ordered(cards),ordered(whole.map(entry=>entry.id)),room+': each whole item has one directory card');
  const nested=await page.locator('.house-component-links a').evaluateAll(links=>links.map(link=>link.getAttribute('href').slice(9)));
  assert.deepEqual(ordered(nested),ordered(small.map(entry=>entry.id)),room+': only smaller machines appear beneath parent');
  for(const part of ordinary)assert(!scene.includes(part.id)&&!cards.includes(part.id)&&!nested.includes(part.id),part.id+': ordinary part stays inside parent lesson');
  const intro=await page.locator('.plan-layout>.plan-intro').boundingBox(),art=await page.locator('.plan-layout>.plan-art').boundingBox();
  assert(intro&&art&&intro.x+intro.width<=art.x+2&&Math.abs(intro.y-art.y)<100,room+': two-column room frame is retained');
  await page.screenshot({path:out+'/'+slug(room)+'.png'});
  rooms.push({room,whole:whole.map(entry=>entry.id),smaller:small.map(entry=>entry.id),ordinary:ordinary.map(entry=>entry.id),scene,cards,nested});
 }
 assert(rooms.some(room=>room.ordinary.includes('hairspring')),'Regression includes passive watch spring');
 assert(rooms.some(room=>room.ordinary.includes('rgb-subpixels')),'Regression includes RGB apertures under LCD screen');
 const ordinaryIds=new Set(rooms.flatMap(room=>room.ordinary));
 for(const parentId of new Set([...ordinaryIds].map(id=>componentParentIds[id]))){
  const parent=catalog.entries.find(entry=>entry.id===parentId),children=[...ordinaryIds].filter(id=>componentParentIds[id]===parentId);
  assert(parent,parentId+': published parent exists');
  await page.goto(new URL('#machine/'+parentId,base).href);await page.getByRole('heading',{name:parent.name,exact:true,level:1}).waitFor();
  for(const id of children)assert.equal(await page.locator(`.daily-related a[href="#machine/${id}"]`).count(),1,parentId+': ordinary component remains reachable: '+id);
  parentLinks.push({parent:parentId,children});
 }
 await page.goto(new URL('#machine/mechanical-watch',base).href);await page.getByRole('heading',{name:'Mechanical watch',exact:true,level:1}).waitFor();
 const spring=page.locator('.daily-related a[href="#machine/hairspring"]');assert.equal(await spring.count(),1);await spring.click();await page.getByRole('heading',{name:'Hairspring',exact:true,level:1}).waitFor();
 await page.screenshot({path:out+'/hairspring.png'});
 const watch=page.locator('.daily-related a[href="#machine/mechanical-watch"]');assert.equal(await watch.count(),1);await watch.click();await page.getByRole('heading',{name:'Mechanical watch',exact:true,level:1}).waitFor();await page.screenshot({path:out+'/watch-return.png'});
 assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,rooms,ordinaryPartsOmitted:rooms.reduce((sum,room)=>sum+room.ordinary.length,0),hairspringStillReachable:true,parentLinks,watchRoundTrip:true,errors},null,2));
 console.log('PASS room catalog: '+rooms.length+' rooms; whole items and smaller machines only; ordinary component lessons remain reachable');
}catch(error){await writeFile(out+'/failure.json',JSON.stringify({message:error.message,errors,url:page.url()},null,2));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
