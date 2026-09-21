import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const typeSelectorItems = [
  ['mirrors', 4], ['lenses', 3], ['telescopes', 5], ['binoculars', 3],
  ['microscopes', 3], ['polarized-light', 2], ['liquid-crystal-display', 2],
];

// Accept the existing QA page so manual checks reuse one visible browser tab.
export async function checkTypeSelectors(page, {base, dir, prefix, items=typeSelectorItems}) {
  await mkdir(dir, {recursive:true});
  const observations=[];
  for (const [route,count] of items) for (const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.goto('about:blank');
    await page.goto(base+'#machine/'+route,{waitUntil:'domcontentloaded'});
    const selector=page.locator('.daily-primary-controls select');
    await selector.waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('[data-control="mode"]').count(),1,'One real selector, no duplicate state');
    const opening=await selector.evaluate(e=>{
      const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,
        viewportHeight:innerHeight,viewportWidth:innerWidth,scroll:scrollY,
        clickable:hit===e,sidebarScroll:document.querySelector('.daily-operation').scrollTop};
    });
    assert.equal(opening.scroll,0,route+': first page view');
    assert.equal(opening.sidebarScroll,0);
    assert.ok(opening.top>=0&&opening.bottom<=opening.viewportHeight,route+': selector visible immediately');
    assert.ok(opening.left>=0&&opening.right<=opening.viewportWidth&&opening.height>=44);
    assert.equal(opening.clickable,true,route+': no overlay obscures selector');
    await page.screenshot({path:dir+'/'+prefix+'-'+route+'-'+width+'-initial.png'});
    const options=await selector.locator('option').evaluateAll(ns=>ns.map(n=>({value:n.value,label:n.textContent})));
    assert.equal(options.length,count);
    const scenes=[],readings=[];
    for (const option of options) {
      await selector.selectOption(option.value);
      assert.equal(await selector.inputValue(),option.value);
      readings.push(await page.locator('.daily-readings').innerText());
      await page.mouse.move(0,0);
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const shot=await page.locator('canvas').screenshot({path:dir+'/'+prefix+'-'+route+'-'+width+'-mode-'+option.value+'.png'});
      assert.ok(scenes.every(previous=>!previous.equals(shot)),route+': type changes rendered geometry');
      scenes.push(shot);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
    }
    assert.equal(new Set(readings).size,count,route+': each type updates its result');
    // Changing type remains available while the experiments tab is selected.
    await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
    assert.equal(await selector.isVisible(),true);
    const experiments=await page.locator('[data-experiment]').count();
    const presetModes=[];
    for(let i=0;i<experiments;i++) {
      await page.locator('[data-experiment="'+i+'"]').click();
      const mode=await selector.inputValue();
      assert.ok(options.some(option=>option.value===mode));
      presetModes.push(mode);
    }
    assert.equal(new Set(presetModes).size,count,route+': presets synchronize every type');
    await selector.selectOption(options.at(-1).value);
    await page.getByRole('tab',{name:'Controls',exact:true}).click();
    await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
    assert.equal(await selector.inputValue(),options[0].value,'Reset synchronizes promoted control');
    // Keyboard selection uses the same input path as pointer/touch selection.
    await selector.focus();await page.keyboard.type(options[1].label,{delay:20});await page.keyboard.press('Enter');
    assert.equal(await selector.inputValue(),options[1].value,'Keyboard can select a type');
    observations.push({route,width,opening,options,experiments,presetModes});
  }
  await writeFile(dir+'/'+prefix+'-type-selectors.json',JSON.stringify({passed:true,observations},null,2)+'\n');
  return observations;
}

if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const observations=await checkTypeSelectors(page,{base:process.env.SITE_URL||'http://127.0.0.1:5193/',dir:process.env.EVIDENCE_DIR||'documentation/audit/evidence/type-selectors',prefix:process.env.EVIDENCE_PREFIX||'local'});
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,layouts:observations.length,types:observations.reduce((n,x)=>n+x.options.length,0),presets:observations.reduce((n,x)=>n+x.experiments,0),errors}));
  }finally{await browser.close();}
}
