import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sceneLocations, scenePageSize} from './scene-locations.js';
import {houseComponents} from './house-components.js';

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function checkScenePlacements(page, {base,dir,prefix='local',widths=[1440,390],navigation=true,catalog,families}) {
  const groups = new Map(catalog.groups.map(group => [group.id, group]));
  const external = families.map(family => family.entry).filter(entry => groups.get(entry.group).place !== 'home');
  // Every item stands in its room's scene: whole items on reviewed spots, their parts on free painted surfaces.
  const shown = families.flatMap(family => [family.entry, ...family.components]).filter(entry => groups.get(entry.group).place !== 'home');
  const opens = id => '#machine/' + (houseComponents[catalog.entries.find(entry => entry.id === id).name]?.redirectTo || id);
  for (const entry of external) {
    assert.ok(sceneLocations[entry.id], entry.id + ': published object needs reviewed coordinates');
    const [x,y,w,h] = sceneLocations[entry.id];
    assert.ok(x-w/2>=0 && x+w/2<=100 && y-h/2>=0 && y+h/2<=100, entry.id + ': within illustration');
  }
  assert.deepEqual(sceneLocations.binoculars, [57,67,12,12,true], 'Binocular hotspot follows the painted object on the picnic table');
  assert.equal(groups.get('binoculars').room, 'Nature watching');
  assert.equal(groups.get('seismograph').room, 'Earth science gallery');
  assert.equal(groups.get('3d-printer').room, 'Tools and making');
  await mkdir(dir,{recursive:true});
  const observations=[];
  const visit=async route=>{
    await page.goto(base+'#'+route);
    await page.waitForFunction(route=>location.hash==='#'+route && document.querySelector('h1'),route);
    await page.evaluate(()=>document.fonts.ready);
  };
  async function bounds(selector, sceneSelector) {
    // The house and room scenes render after their module loads; wait for the scene being measured.
    await page.locator(sceneSelector).first().waitFor();
    await page.evaluate(async sceneSelector=>{
      const scene=document.querySelector(sceneSelector);
      await Promise.all([...scene.querySelectorAll('img')].map(image=>image.decode()));
      await Promise.all([...scene.querySelectorAll('.house-room-backdrop')].map(async element=>{
        const url=getComputedStyle(element).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)[1];
        const image=new Image();image.src=url;await image.decode();
      }));
    },sceneSelector);
    await page.locator(sceneSelector).scrollIntoViewIfNeeded();
    const result=await page.locator(selector).evaluateAll((nodes, sceneSelector)=>{
      const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};
      const scene=rect(document.querySelector(sceneSelector));
      return nodes.filter(node=>!node.closest('[hidden]')).map(node=>{
        const box=rect(node),label=rect(node.querySelector('span')||node);
        const hit=document.elementFromPoint(box.x+box.w/2,box.y+box.h/2);
        return {id:node.dataset.machine||node.dataset.zoomTarget||node.dataset.place,box,label,scene,hit:node.contains(hit),painted:node.classList.contains('painted-object'),image:!!node.querySelector('img.machine-thumbnail')?.naturalWidth};
      });
    },sceneSelector);
    for(const item of result){
      for(const r of [item.box,item.label])assert.ok(r.x>=item.scene.x-1&&r.y>=item.scene.y-1&&r.x+r.w<=item.scene.x+item.scene.w+1&&r.y+r.h<=item.scene.y+item.scene.h+1,item.id+': target and label stay in scene');
      assert.equal(item.hit,true,item.id+': center is clickable');
    }
    for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++){
      const a=result[i].label,b=result[j].label;
      assert.ok(Math.min(a.x+a.w,b.x+b.w)<=Math.max(a.x,b.x)+1||Math.min(a.y+a.h,b.y+b.h)<=Math.max(a.y,b.y)+1,result[i].id+' / '+result[j].id+': labels overlap');
    }
    return result;
  }
  for(const width of widths){
    await page.setViewportSize({width,height:width<700?844:1000});
    await visit('neighborhood');
    await page.locator('.zoom-exterior img').evaluate(image=>image.decode());
    const neighborhood=await bounds('.zoom-exterior [data-place]','.zoom-scene');
    await page.locator('.plan-art').screenshot({path:dir+'/'+prefix+'-neighborhood-'+width+'.png'});
    observations.push({width,route:'neighborhood',targets:neighborhood});
    for(const place of catalog.places.filter(place=>place.id!=='home')){
      await visit('place/'+place.id);
      await page.locator('#zoom-room').waitFor();
      const options=await page.locator('#zoom-room option').evaluateAll(nodes=>nodes.map((node,index)=>({index,room:node.value,page:Number(node.dataset.page||0),name:node.textContent})));
      const seen=new Set();
      for(const option of options){
        await page.locator('#zoom-room').selectOption({index:option.index});
        const selector='.zoom-interior .zoom-object';
        await page.waitForFunction(()=>[...document.querySelectorAll('.zoom-object')].every(node=>node.querySelector('img.machine-thumbnail')?.naturalWidth));
        await page.locator('.room-background').evaluate(image=>image.decode());
        const targets=await bounds(selector,'.zoom-scene');
        assert.ok(targets.length>0&&targets.length<=scenePageSize);
        for(const item of targets){
          assert.ok(shown.some(entry=>entry.id===item.id&&groups.get(entry.group).place===place.id),'Only this place\'s items in scene: '+item.id);
          assert.equal(item.painted,item.id==='binoculars','Only actual painted binoculars suppress the model preview');
          const wanted=sceneLocations[item.id];
          if(wanted){
          assert.ok(Math.abs((item.box.x+item.box.w/2-item.scene.x)/item.scene.w*100-wanted[0])<.2,item.id+': stable horizontal anchor');
          assert.ok(Math.abs((item.box.y+item.box.h/2-item.scene.y)/item.scene.h*100-wanted[1])<.2,item.id+': stable vertical anchor');
          }
          if(option.room){seen.add(item.id);assert.equal(groups.get(catalog.entries.find(entry=>entry.id===item.id).group).room,option.room);}
        }
        const name=place.id+'-'+option.index+'-'+width;
        await page.locator('.plan-art').screenshot({path:dir+'/'+prefix+'-'+name+'.png'});
        observations.push({width,route:'place/'+place.id,option,targets});
        if(navigation){
          const entry=targets[0];
          await page.locator(selector+'[data-machine="'+entry.id+'"]').click();
          await page.waitForURL('**'+opens(entry.id));
          await page.locator('.daily-return').click();
          await page.waitForURL('**#place/'+place.id);
          await page.locator('#zoom-room').waitFor();
        }
      }
      assert.deepEqual(seen,new Set(shown.filter(entry=>groups.get(entry.group).place===place.id).map(entry=>entry.id)),place.id+': every item has a room scene');
    }
    await visit('place/home');
    const homeTargets=await bounds('.house-room-pin','.house-map');
    await page.locator('.plan-art').screenshot({path:dir+'/'+prefix+'-home-'+width+'.png'});
    observations.push({width,route:'place/home',targets:homeTargets});
    for(const room of new Set(catalog.groups.filter(group=>group.place==='home').map(group=>group.room))){
      await visit('room/'+slug(room));
      await page.locator('.house-zoom-controls select').waitFor();
      const options=await page.locator('.house-zoom-controls select option').evaluateAll(nodes=>nodes.map(node=>({value:node.value,name:node.textContent})));
      const pages=new Set();
      for(const option of options){
        await page.locator('.house-zoom-controls select').selectOption(option.value);
        const selected=page.locator('[data-zoom-target][data-selected]');
        const spatial=await selected.evaluate(node=>node.closest('[data-spatial-page]')?.dataset.spatialPage||'hall');
        if(pages.has(spatial))continue;
        pages.add(spatial);
        await page.waitForFunction(()=>[...document.querySelectorAll('.house-room-tray:not([hidden]) img')].every(image=>image.complete&&image.naturalWidth));
        const targets=await bounds('.house-zoom-scene [data-zoom-target]','.house-zoom-scene');
        await page.locator('.plan-art').screenshot({path:dir+'/'+prefix+'-'+slug(room)+'-'+spatial+'-'+width+'.png'});
        observations.push({width,route:'room/'+slug(room),spatial,targets});
      }
      const expected=families.filter(family=>groups.get(family.entry.group).room===room).flatMap(family=>[family.entry,...family.components]).map(entry=>'#machine/'+entry.id);
      assert.deepEqual(new Set(await page.locator('.house-object a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))),new Set(expected),room+': directory lists every item of the room');
      assert.deepEqual(new Set(await page.locator('.house-zoom-scene a[href^="#machine/"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))),new Set(expected),room+': every item stands in the room scene');
    }
    await visit('list');
    const rows=await page.locator('.catalog-table tbody tr').evaluateAll(nodes=>nodes.map(node=>({ids:[...node.querySelectorAll('[data-entry]')].map(button=>button.dataset.entry),place:node.children[1].querySelector('a').getAttribute('href'),room:node.children[1].querySelector('small').textContent})));
    for(const row of rows)for(const id of row.ids){const entry=catalog.entries.find(entry=>entry.id===id),group=groups.get(entry.group);assert.equal(row.place,'#place/'+group.place);assert.equal(row.room,group.room);}
    assert.equal(rows.length,families.length);
    if(navigation)for(const row of rows)for(const id of row.ids){
      await page.locator('[data-entry="'+id+'"]').click();
      await page.waitForURL('**'+opens(id));
      await page.locator('.daily-return').waitFor();
      await page.locator('.daily-return').click();
      const expected=row.place==='#place/home'?'#room/'+slug(row.room):row.place;
      await page.waitForURL('**'+expected);
      await visit('list');
    }
    observations.push({width,route:'list',rows,navigation});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  }
  await writeFile(dir+'/'+prefix+'-placements.json',JSON.stringify({passed:true,wholeItems:families.length,externalItems:external.length,observations},null,2)+'\n');
  return observations;
}

if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {neighborhoodCatalog:catalog}=await import('./published-catalog.js');
  const {groupCatalogEntries}=await import('./catalog-hierarchy.js');
  const families=groupCatalogEntries(catalog.entries);
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const observations=await checkScenePlacements(page,{catalog,families,base:process.env.SITE_URL||'http://127.0.0.1:5193/',dir:process.env.EVIDENCE_DIR||'documentation/audit/evidence/placements',prefix:process.env.EVIDENCE_PREFIX||'local'});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,observations:observations.length,errors}));
  }finally{await browser.close();}
}
