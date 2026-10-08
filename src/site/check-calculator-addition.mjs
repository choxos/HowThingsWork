import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createCalculatorAdditionModel} from './calculator-addition-model.js';
import {calculatorAdditionLesson as lesson} from './calculator-addition-lesson.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5215/',output=process.env.EVIDENCE_DIR||'documentation/calculator-browser';
await mkdir(output,{recursive:true});const expected=createCalculatorAdditionModel();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(25000);
const errors=[],consoleErrors=[],presets=[],controls=[],combinations=[],parts=[],frames=[],histories=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
await page.addInitScript(()=>{
  window.calculatorMatrices={};
  for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){
    const proto=window[name]?.prototype;if(!proto)continue;const names=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)names.set(location,name);return location;};
    proto.uniformMatrix4fv=function(location,transpose,data,...rest){const name=names.get(location);if(name==='modelViewMatrix')window.calculatorMatrices.modelView=Array.from(data);return write.call(this,location,transpose,data,...rest);};
  }
});
const canvas=page.locator('canvas'),action=name=>page.getByRole('button',{name,exact:true}).click();
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const values=()=>page.locator('.daily-readings > div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])));
async function compare(){const actual=await values();assert.deepEqual(actual,Object.fromEntries(expected.getState().readings.map(r=>[r.label,r.value])));return actual;}
async function reset(){await action('Reset experiment');expected.reset();await compare();}
async function steps(n){await page.locator('[data-step]').evaluate((button,count)=>{for(let i=0;i<count;i++)button.click();},n);for(let i=0;i<n;i++)expected.playback.step();await compare();}
async function edit(key,value){const control=page.locator(`[data-control="${key}"]`);if(await control.evaluate(e=>e.tagName==='SELECT'))await control.selectOption(String(value));else{const input=page.locator(`[data-number="${key}"]`);await input.fill(String(value));await input.press('Tab');}expected.update({[key]:value});await compare();}
async function preset(i,mobile=false){if(mobile)await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Try it yourself',exact:true}).click();else await tab('Try it yourself');await page.locator('[data-experiment]').nth(i).click();expected.reset(lesson.tryIt[i].initialState);await compare();if(mobile)await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Controls',exact:true}).click();else await tab('Controls');}
async function focus(id){
  await action('Whole machine');const chain=[];let p=expected.parts.find(p=>p.id===id);while(p){chain.unshift(p.id);p=expected.parts.find(x=>x.id===p.parentId);}
  for(const id of chain)await page.locator(`[data-part="${id}"]`).click();await page.locator('[data-isolate]').check();await action('Front');
}
async function capture(name){
  await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.mouse.move(4,4);
  const png=await canvas.screenshot({path:`${output}/${name}.png`});
  const bounds=await page.evaluate(async encoded=>{
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),x=>x.charCodeAt(0))],{type:'image/png'}));const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
    const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const {data}=ctx.getImageData(0,0,c.width,c.height),origin=(5*c.width+5)*4;
    let left=c.width,top=c.height,right=-1,bottom=-1;const rgbPixels=[0,0,0];
    for(let y=8;y<c.height-8;y++)for(let x=8;x<c.width-8;x++){
      const i=(y*c.width+x)*4;
      if(Math.abs(data[i]-data[origin])+Math.abs(data[i+1]-data[origin+1])+Math.abs(data[i+2]-data[origin+2])>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      for(let channel=0;channel<3;channel++)if(data[i+channel]>150&&data[i+(channel+1)%3]<70&&data[i+(channel+2)%3]<70)rgbPixels[channel]++;
    }
    return {width:c.width,height:c.height,left,top,right,bottom,rgbPixels};
  },png.toString('base64'));
  assert(bounds.right>bounds.left&&bounds.bottom>bounds.top,name+': drawn model');
  assert(bounds.left>8&&bounds.top>8&&bounds.right<bounds.width-9&&bounds.bottom<bounds.height-9,name+': clear canvas margins '+JSON.stringify(bounds));
  frames.push({name,...bounds});assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
}
async function hit(name){
  await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),popup=page.locator('.daily-part-popup');
  for(let y=1;y<20;y++)for(let x=1;x<20;x++){const point=[b.x+b.width*x/20,b.y+b.height*y/20];await page.mouse.move(...point);if(await popup.isVisible()&&await popup.innerText()===name)return point;}
  assert.fail('No physical pointer target for '+name);
}
try{
  await page.goto(new URL('#machine/calculator',base).href);await canvas.waitFor();await page.getByRole('heading',{name:'Calculator',exact:true,level:1}).waitFor();
  assert(await canvas.evaluate(c=>!!c.getContext('webgl2')));assert.equal(await page.locator('[data-control]').count(),4);await compare();await capture('opening');await page.screenshot({path:output+'/opening-page.png'});
  await steps(1);await reset();
  for(const [i,e] of lesson.tryIt.entries()){
    await preset(i);for(const [key,v] of Object.entries(e.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),v);
    await capture('preset-'+i);await steps(5);await capture('moving-'+i);await preset(i);
    let completedReadings,restarted;
    if(e.values.power){
      await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:15000});expected.advance(100);await compare();await capture('completed-'+i);
      completedReadings=await values();await page.locator('[data-play]').click();await page.waitForTimeout(180);await page.locator('[data-play]').click();restarted=await values();
      assert.notDeepEqual(restarted,completedReadings,'Replay restarts key entry');assert.equal(restarted['Display register'],'0');
    }else{
      assert(await page.locator('[data-play]').isDisabled(),'An unpowered calculator cannot start');await steps(60);await capture('completed-'+i);completedReadings=await values();restarted=completedReadings;
    }
    for(const [key,v] of Object.entries(e.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),v,'Replay retains '+key);
    presets.push({title:e.title,readings:completedReadings,replay:restarted});console.log(`Preset ${i+1}/${lesson.tryIt.length} autoplay and replay passed: ${e.title}`);
  }
  await preset(0);await page.locator('[data-play]').click();await page.waitForTimeout(550);await page.locator('[data-play]').click();const held=await values();await page.waitForTimeout(200);assert.deepEqual(await values(),held,'Pause freezes readings');
  await reset();await steps(60);await page.locator('[data-play]').click();await page.waitForTimeout(160);await page.locator('[data-play]').click();
  assert.notEqual((await values())['Calculator operation'],'Result displayed','Complete replay restarts');
  assert.equal(await page.locator('[data-control="power"]').inputValue(),'1');
  for(const control of expected.controls){
    const choices=control.options?.map(o=>o.value)??Array.from({length:(control.max-control.min)/control.step+1},(_,i)=>control.min+i*control.step);
    for(const value of choices){await reset();await edit(control.key,value);await steps(2);await steps(60);controls.push({key:control.key,value,readings:await values()});}
    console.log('Control values passed: '+control.key);
  }
  for(let digit=0;digit<10;digit++){await reset();await edit('first',0);await edit('second',digit);await steps(60);await action('Read the current digits');await capture('glyph-'+digit);}
  await preset(0);await steps(41);await action('Inspect: decimal carry');await capture('ones-carried');await steps(5);await capture('tens-completed');await steps(14);
  assert.equal((await values())['Display register'],'34');const done=await values();
  for(const a of expected.actions){await action(a.label);assert.deepEqual(await values(),done,'Inspection preserves completed state');}
  histories.push({name:'Every inspection preserves the completed calculation',readings:await values()});
  await action('Read the current digits');const lit=await canvas.screenshot();await edit('ambient',0);const dark=await canvas.screenshot();assert(!lit.equals(dark));await capture('result-dark');
  assert.equal((await values())['Display register'],'34');await edit('ambient',1);assert(lit.equals(await canvas.screenshot()));await capture('light-restores-result');
  histories.push({name:'Light changes visibility without recomputing',readings:await values()});
  await edit('first',9);assert.equal((await values())['Display register'],'0');assert.equal((await values())['Accepted keys'],'None');await capture('operand-change-clears');await steps(60);assert.equal((await values())['Display register'],'18');
  histories.push({name:'Operand change starts actual new key entry',readings:await values()});
  await edit('power',0);assert.equal((await values())['Display register'],'Blank');await capture('power-clears-result');assert(await page.locator('[data-play]').isDisabled());await edit('second',8);await steps(60);assert.equal((await values())['Display register'],'Blank');
  await edit('power',1);assert.equal((await values())['Display register'],'0');await steps(60);assert.equal((await values())['Display register'],'17');await capture('power-restored-new-entry');
  histories.push({name:'Power loss clears registers; restore starts fresh entry',readings:await values()});
  await preset(7);await steps(60);await action('Read the current digits');await capture('calculated-in-dark');await edit('ambient',1);assert.equal((await values())['Your result'],'34 · result');await capture('reveal-dark-calculation');
  histories.push({name:'A powered calculation completes unseen and is revealed by light',readings:await values()});
  await preset(5);await steps(60);await action('Inspect: reflected light');await capture('segment-on-blocks-light');await edit('ambient',0);await capture('optics-no-light');await edit('ambient',1);await edit('power',0);await capture('optics-no-drive');
  await page.locator('[data-result]').click();await reset();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Reflective three-digit result','Reset clears the calculation while preserving display inspection');
  await capture('result-reset');
  await reset();await steps(7);for(const a of expected.actions){const before=await values();await action(a.label);assert.deepEqual(await values(),before);await capture('action-'+a.part);}
  for(const p of expected.parts){await focus(p.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),p.name);await compare();await capture('part-'+p.id);parts.push(p.id);}
  await action('Inspect: complete calculator');for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await action(view);await capture('view-'+view.toLowerCase());}
  await action('Inspect: complete calculator');const exterior=await canvas.screenshot();await page.locator('[data-cutaway]').check();
  await compare();assert(!exterior.equals(await canvas.screenshot()),'Look inside exposes the connected calculator electronics');await capture('cutaway');
  await page.locator('[data-cutaway]').uncheck();await compare();assert(exterior.equals(await canvas.screenshot()),'Closing the cutaway restores the display stack');
  await action('Inspect: complete calculator');await page.locator('[data-separation]').fill('100');await capture('separated');await page.locator('[data-reassemble]').click();
  await focus('display');const point=await hit('Reflective three-digit result');await page.mouse.click(...point);assert.equal(await page.locator('.daily-part-popup').innerText(),'Reflective three-digit result');
  await page.mouse.move(4,4);await canvas.screenshot();const before=await page.evaluate(()=>window.calculatorMatrices.modelView);
  await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+30,point[1]+18,{steps:8});await page.mouse.up();await page.mouse.move(4,4);await canvas.screenshot();const after=await page.evaluate(()=>window.calculatorMatrices.modelView);
  for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(before[i]-after[i])<1e-7,'Object drag preserves rotation');assert(Math.hypot(...[12,13,14].map(i=>after[i]-before[i]))>.01,'Object drag translates');
  await action('Inspect: complete calculator');await canvas.scrollIntoViewIfNeeded();let b=await canvas.boundingBox();await page.mouse.move(b.x+15,b.y+15);assert.equal(await page.locator('.daily-part-popup').isVisible(),false);const beforeRotate=await canvas.screenshot();
  await page.mouse.down();await page.mouse.move(b.x+90,b.y+55,{steps:8});await page.mouse.up();assert(!beforeRotate.equals(await canvas.screenshot()),'Outside drag rotates');
  await action('Inspect: complete calculator');const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!beforeZoom.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
  await canvas.scrollIntoViewIfNeeded();b=await canvas.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  for(let i=0;i<8&&Number(await page.locator('[data-separation]').inputValue())===0;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(50);}
  assert(Number(await page.locator('[data-separation]').inputValue())>0,'Wheel outward separates parts');await capture('wheel-separated');
  b=await canvas.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  for(let i=0;i<16&&Number(await page.locator('[data-separation]').inputValue())>0;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(50);}
  assert.equal(await page.locator('[data-separation]').inputValue(),'0','Wheel inward reassembles');
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="display"]').click();await page.locator('[data-isolate]').check();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Reflective three-digit result');await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('button[data-label-part="display"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-labels]').uncheck();
  await reset();await page.locator('[data-number="first"]').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('Tab');expected.update({first:26});await compare();assert.equal(await page.locator('[data-number="first"]').inputValue(),'26','Number input supports keyboard increment');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor();expected.reset();await compare();await capture('mobile-opening-'+width);
    for(const [i] of lesson.tryIt.entries()){await preset(i,true);await steps(60);await capture(`mobile-completed-${i}-${width}`);}
    await action('Inspect: complete calculator');await page.screenshot({path:`${output}/mobile-page-${width}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log(`Mobile ${width}px: all prepared results passed.`);
  }
  await action('Inspect: complete calculator');const touch=await page.context().newCDPSession(page);
  async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  try{await pinch(100,15);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('pinch-separated');await pinch(15,100);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await touch.detach();}
  await page.setViewportSize({width:1440,height:1000});for(const [i] of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(i).click();assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
  await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
  await writeFile(output+'/interaction-progress.json',JSON.stringify({passed:true,presets:presets.length,controls:controls.length,parts:parts.length,frames:frames.length,histories,errors,consoleErrors}));
  console.log('All visual interaction checks passed; starting exhaustive browser combinations.');
  await compare();
  await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/calculator'));assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await browser.close();
  const combinationSessions=[];
  let combinationFailure,progressWrite=Promise.resolve();
  await Promise.all([0,1].map(async shard=>{
    let combinationBrowser,combinationPage,lastFirst,session=0;
    try{
      for(let start=shard*50;start<(shard+1)*50&&!combinationFailure;start+=4,session++){
        const end=Math.min(start+4,(shard+1)*50);
        let rejectCrash;
        const crashed=new Promise((_,reject)=>{rejectCrash=reject;});
        crashed.catch(()=>{});
        combinationBrowser=await chromium.launch({channel:'chrome',headless:true});
        combinationPage=await combinationBrowser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
        combinationPage.setDefaultTimeout(25000);
        combinationPage.on('crash',()=>rejectCrash(new Error(`Combination worker ${shard}, session ${session} crashed`)));
        combinationPage.on('pageerror',error=>errors.push(`Combination worker ${shard}, session ${session}: ${error.message}`));
        combinationPage.on('console',message=>{if(message.type()==='error')consoleErrors.push(`Combination worker ${shard}, session ${session}: ${message.text()}`);});
        await combinationPage.goto(new URL('#machine/calculator',base).href);await combinationPage.locator('canvas').waitFor({timeout:120000});
        await combinationPage.getByRole('heading',{name:'Calculator',exact:true,level:1}).waitFor();
        assert.equal(await combinationPage.locator('[data-control]').count(),4);assert(await combinationPage.locator('canvas').evaluate(canvas=>!!canvas.getContext('webgl2')));
        let sessionCombinations=0;
        for(let first=start;first<end&&!combinationFailure;first++){
          lastFirst=first;
          let timer,batch;
          try{
            batch=await Promise.race([combinationPage.evaluate(async first=>{
              const out=[],read=()=>Object.fromEntries([...document.querySelectorAll('.daily-readings > div')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]));
              const change=(key,value)=>{const input=document.querySelector(`[data-control="${key}"]`);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
              for(let second=0;second<100;second++){
                document.querySelector('[data-reset-controls]').click();for(const [key,value] of Object.entries({first,second,power:1,ambient:0}))change(key,value);
                for(let step=0;step<60;step++)document.querySelector('[data-step]').click();
                for(const power of [1,0]){
                  change('power',power);
                  for(const ambient of [0,1]){
                    change('ambient',ambient);const settings={first,second,power,ambient};
                    const selected=Object.fromEntries(Object.keys(settings).map(key=>[key,Number(document.querySelector(`[data-control="${key}"]`).value)]));
                    if(JSON.stringify(selected)!==JSON.stringify(settings))throw Error('Settings not retained: '+JSON.stringify({selected,settings}));
                    const readings=read(),sum=first+second,expectedRegister=power?String(sum):'Blank',visible=!ambient?'Screen dark':!power?'Blank display':sum+' · result';
                    const accepted=power?[...String(first),'+',...String(second),'='].join(' '):'None';
                    if(readings['Display register']!==expectedRegister||readings['Your result']!==visible||readings['Accepted keys']!==accepted||readings['Calculator operation']!==(power?'Result displayed':'Power off'))throw Error('Combination failed: '+JSON.stringify({settings,readings}));
                    out.push({settings,display:expectedRegister,visible,accepted});
                  }
                }
                await new Promise(requestAnimationFrame);
              }
              return out;
            },first),crashed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Combination worker ${shard}, session ${session}, first ${first}: batch exceeded 120 seconds`)),120000);})]);
          }finally{clearTimeout(timer);}
          combinations.push(...batch);
          sessionCombinations+=batch.length;
          const progress={passed:combinations.length,total:40000,worker:shard,session,lastFirst:first};
          progressWrite=progressWrite.then(()=>writeFile(output+'/combination-progress.json',JSON.stringify(progress)));await progressWrite;
          console.log('Browser combinations passed: '+progress.passed+'/40000');
        }
        await combinationBrowser.close();combinationBrowser=undefined;combinationPage=undefined;
        if(!combinationFailure){assert.equal(sessionCombinations,(end-start)*400);combinationSessions.push({worker:shard,session,firstStart:start,firstEnd:end-1,combinations:sessionCombinations});}
      }
    }catch(error){
      combinationFailure??=error;
      const body=await combinationPage?.locator('body').innerText({timeout:2000}).catch(()=> '');
      await writeFile(`${output}/combination-failure-${shard}.json`,JSON.stringify({worker:shard,session,lastFirst,message:error.message,body,errors,consoleErrors},null,2));
      await combinationPage?.screenshot({path:`${output}/combination-failure-${shard}.png`,timeout:2000}).catch(()=>{});
    }
    finally{await combinationBrowser?.close();}
  }));
  if(combinationFailure)throw combinationFailure;
  combinations.sort((a,b)=>a.settings.first-b.settings.first||a.settings.second-b.settings.second||a.settings.power-b.settings.power||a.settings.ambient-b.settings.ambient);
  assert.equal(new Set(combinations.map(row=>Object.values(row.settings).join(','))).size,40000,'Every distinct setting combination is checked once');
  assert.equal(combinationSessions.length,26);assert(combinationSessions.every(session=>session.combinations<=1600));assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await writeFile(output+'/browser.json',JSON.stringify({passed:true,presets,controls,combinations,parts,frames,histories,combinationWorkers:2,combinationBrowserSessions:combinationSessions,maximumPairsPerSession:400,errors,consoleErrors,pause:true,replay:true,objectDrag:true,backgroundRotation:true,keyboard:true,wheel:true,labels:true,dismissal:true,pinch:true,mobileWidths:[390,320]},null,2));console.log(JSON.stringify({passed:true,presets:presets.length,controls:controls.length,combinations:combinations.length,parts:parts.length,frames:frames.length}));
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({message:error.message,errors,consoleErrors,url:page.url(),presets,controls,combinations,parts,frames,body:page.isClosed()?'':await page.locator('body').innerText().catch(()=> '')},null,2));if(!page.isClosed())await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{expected.dispose();await browser.close();}
