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
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  const report=await page.evaluate(async()=>{
    const [{renderRoomMachines},{createGeneratorModel},{previewOf},{houseComponents}]=await Promise.all([
      import('/src/site/machine-viewer.js'),import('/src/site/grid-generator-model.js'),
      import('/src/site/catalog-hierarchy.js'),import('/src/site/house-components.js'),
    ]);
    const entries=[{id:'dc-generator',name:'DC generator'},{id:'electric-generator',name:'Electric generator'},{id:'ac-generator',name:'AC generator'}];
    // Exercise shared-factory variants independently of dedicated lesson factories.
    const previews=entries.map(entry=>{const {createModel,...preview}=previewOf(entry,houseComponents);return preview;});
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
  const components=await page.evaluate(async()=>{
    const [{renderRoomMachines},{previewOf},{houseComponents},{createHouseModel}]=await Promise.all([
      import('/src/site/machine-viewer.js'),import('/src/site/catalog-hierarchy.js'),
      import('/src/site/house-components.js'),import('/src/site/house.js'),
    ]);
    const entries=[{id:'refrigerant-compressor',name:'Refrigerant compressor'},{id:'refrigerator',name:'Refrigerator'}];
    const builds=[],disposals=[];
    const tracked=(name,create)=>()=>{builds.push(name);const model=create(),dispose=model.dispose;model.dispose=()=>{disposals.push(name);dispose();};return model;};
    const compressor=tracked('compressor',houseComponents['Refrigerant compressor'].createModel);
    const definitions={...houseComponents,'Refrigerant compressor':{...houseComponents['Refrigerant compressor'],createModel:compressor}};
    const previews=entries.map(entry=>previewOf(entry,definitions));
    const panel=document.querySelector('#preview-check');panel.replaceChildren();
    for(const entry of entries){const button=document.createElement('button');button.dataset.machine=entry.id;button.style.cssText='width:360px;background:none;border:0;color:#394233;font:18px sans-serif';button.innerHTML='<svg></svg><span></span>';button.querySelector('span').textContent=entry.name;panel.append(button);}
    const factory=tracked('refrigerator',()=>createHouseModel('Refrigerator'));
    renderRoomMachines(panel,previews,factory);
    const sources=previews.map(entry=>panel.querySelector(`[data-machine="${entry.id}"] img`)?.src);
    for(const image of panel.querySelectorAll('img'))image.replaceWith(document.createElementNS('http://www.w3.org/2000/svg','svg'));
    renderRoomMachines(panel,[...previews].reverse(),factory);
    return {dedicatedFactory:previews[0].createModel===compressor,builds,disposals,imagesPresent:sources.every(Boolean),
      differs:sources[0]!==sources[1],cached:previews.every((entry,i)=>panel.querySelector(`[data-machine="${entry.id}"] img`)?.src===sources[i])};
  });
  await page.locator('#preview-check').screenshot({path:output+'/components.png'});
  const states=await page.evaluate(async()=>{
    const [{renderRoomMachines},{previewOf},{houseComponents}]=await Promise.all([
      import('/src/site/machine-viewer.js'),import('/src/site/catalog-hierarchy.js'),import('/src/site/house-components.js'),
    ]);
    const component=houseComponents['Rotary sewing hook'],phases=[],resets=[];
    let builds=0,disposals=0;
    const factory=()=>{builds++;const model=component.createModel(),reset=model.reset,update=model.update,dispose=model.dispose;
      model.reset=state=>{resets.push(state?.phase??null);return reset(state);};
      model.update=values=>{const result=update(values);phases.push(model.getState().phase);return result;};
      model.dispose=()=>{disposals++;dispose();};return model;};
    const descriptor=previewOf({id:'rotary-sewing-hook',name:'Rotary sewing hook'},{...houseComponents,'Rotary sewing hook':{...component,createModel:factory}});
    const previews=[descriptor,{...descriptor,id:'hook-start',initialState:{phase:0}},{...descriptor,id:'hook-default',initialState:undefined}];
    const panel=document.querySelector('#preview-check');panel.replaceChildren();
    for(const [i,entry] of previews.entries()){const button=document.createElement('button');button.dataset.machine=entry.id;button.style.cssText='width:360px;background:none;border:0;color:#394233;font:18px sans-serif';button.innerHTML='<svg></svg><span></span>';button.querySelector('span').textContent=['Hook catches loop','Start of cycle','Default state'][i];panel.append(button);}
    renderRoomMachines(panel,previews,factory);
    const sources=previews.map(entry=>panel.querySelector(`[data-machine="${entry.id}"] img`)?.src);
    for(const image of panel.querySelectorAll('img'))image.replaceWith(document.createElementNS('http://www.w3.org/2000/svg','svg'));
    renderRoomMachines(panel,[...previews].reverse(),factory);
    return {initialState:descriptor.initialState,builds,disposals,resets,phases,imagesPresent:sources.every(Boolean),
      phaseDiffers:sources[0]!==sources[1],defaultRestored:sources[1]===sources[2],
      cached:previews.every((entry,i)=>panel.querySelector(`[data-machine="${entry.id}"] img`)?.src===sources[i])};
  });
  await page.locator('#preview-check').screenshot({path:output+'/states.png'});
  await writeFile(output+'/report.json',JSON.stringify({...report,components,states,errors},null,2)+'\n');
  assert.deepEqual(report.values,[1,null,0]);
  assert.deepEqual(report.updates,[1,0,0],'each preview receives its own settings without leaking the previous variant');
  assert.equal(report.builds,1,'one shared model construction');assert.equal(report.disposals,1);
  assert.ok(report.imagesPresent&&report.dcDiffers&&report.acMatchesParent&&report.cached);
  assert.ok(components.dedicatedFactory,'component preview retains its dedicated factory');
  assert.deepEqual(components.builds,['compressor','refrigerator']);assert.deepEqual(components.disposals,components.builds);
  assert.ok(components.imagesPresent&&components.differs&&components.cached,'compressor preview must differ from the refrigerator');
  assert.deepEqual(states.initialState,{phase:.55});
  assert.deepEqual(states.resets,[.55,0,null]);
  assert.ok(states.phases.includes(.55),'the hook reaches its declared opening phase');
  assert.equal(states.phases.at(-1),0,'the final default preview returns to the start');
  assert.equal(states.builds,1);assert.equal(states.disposals,1);
  assert.ok(states.imagesPresent&&states.phaseDiffers&&states.defaultRestored&&states.cached);
  assert.deepEqual(errors,[]);
  console.log('PASS: DC/AC settings, dedicated compressor model, sewing-hook initial states, default restoration, reverse-order cache reuse and model disposal.');
} finally {await browser.close();}
