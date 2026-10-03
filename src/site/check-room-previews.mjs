import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Run against a development server so the actual rendering modules can be imported.
const base=process.env.SITE_URL||'http://127.0.0.1:5195/';
const output=process.env.EVIDENCE_DIR||'documentation/room-previews';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:600}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  const report=await page.evaluate(async()=>{
    const [{renderRoomMachines},{createGeneratorModel},{previewOf},{houseComponents}]=await Promise.all([
      import('/src/site/machine-viewer.js'),import('/src/site/grid-generator-model.js'),
      import('/src/site/catalog-hierarchy.js'),import('/src/site/house-components.js'),
    ]);
    const entries=[{id:'dc-generator',name:'DC generator'},{id:'electric-generator',name:'Electric generator'},{id:'ac-generator',name:'AC generator'}];
    const previews=entries.map(entry=>previewOf(entry,houseComponents));
    const panel=document.createElement('section');panel.id='preview-check';
    panel.style.cssText='position:fixed;inset:0;z-index:99999;background:#fbf8eb;display:flex;align-items:center;justify-content:center;gap:12px';
    const populate=()=>{
      panel.replaceChildren();
      for(const entry of entries){
        const button=document.createElement('button');button.dataset.machine=entry.id;
        button.style.cssText='width:360px;background:none;border:0;color:#394233;font:18px sans-serif';
        const placeholder=document.createElementNS('http://www.w3.org/2000/svg','svg');
        const label=document.createElement('span');label.textContent=entry.name;
        button.append(placeholder,label);panel.append(button);
      }
    };
    populate();document.body.append(panel);
    let builds=0,disposals=0;const updates=[];
    const factory=()=>{
      builds++;const model=createGeneratorModel(),update=model.update,dispose=model.dispose;
      model.update=values=>{const result=update(values);updates.push(model.getState().values.output);return result;};
      model.dispose=()=>{disposals++;dispose();};return model;
    };
    renderRoomMachines(panel,previews,factory);
    const sources=Object.fromEntries(entries.map(entry=>[entry.id,panel.querySelector(`[data-machine="${entry.id}"] img`)?.src]));
    populate();renderRoomMachines(panel,[...previews].reverse(),factory);
    const cached=entries.every(entry=>panel.querySelector(`[data-machine="${entry.id}"] img`)?.src===sources[entry.id]);
    const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text||'')))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
    return {values:previews.map(entry=>entry.values?.output??null),builds,disposals,updates,cached,
      hashes:Object.fromEntries(await Promise.all(Object.entries(sources).map(async([id,src])=>[id,await hash(src)]))),
      imagesPresent:Object.values(sources).every(Boolean),
      dcDiffers:sources['dc-generator']!==sources['ac-generator'],acMatchesParent:sources['ac-generator']===sources['electric-generator']};
  });
  await page.locator('#preview-check').screenshot({path:output+'/variants.png'});
  await writeFile(output+'/report.json',JSON.stringify({...report,errors},null,2)+'\n');
  assert.deepEqual(report.values,[1,null,0]);
  assert.deepEqual(report.updates,[1,0,0],'each preview receives its own settings without leaking the previous variant');
  assert.equal(report.builds,1,'one shared model construction');assert.equal(report.disposals,1);
  assert.ok(report.imagesPresent&&report.dcDiffers&&report.acMatchesParent&&report.cached);
  assert.deepEqual(errors,[]);
  console.log('PASS: DC/AC thumbnails use distinct settings and cache keys; default state restored; cached images stable; one model created and disposed.');
} finally {await browser.close();}
