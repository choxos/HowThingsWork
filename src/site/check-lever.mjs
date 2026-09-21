import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createLeverModel} from './lever-model.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {mkdir,writeFile} from 'node:fs/promises';

const m=createLeverModel(),object=id=>m.parts.find(p=>p.id===id).object;
for(const hz of [30,60,144]){
 m.reset();for(let i=0;i<12*hz;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().doorAngle,65);assert.equal(m.getState().values.insertion,0);
 m.update({operation:1});for(let i=0;i<12*hz;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().boltTravel,0);assert.equal(m.getState().values.insertion,0);
}
for(const keyPattern of [1,2]){m.reset();m.update({keyPattern});m.advance(12);assert.equal(m.getState().blocked,true);assert.equal(m.getState().boltTravel,0);assert.equal(m.getState().doorAngle,0);assert.ok(m.getState().leverAngles.every(a=>a>=0));}
m.reset();m.update({door:65,turn:360});assert.equal(m.getState().doorAngle,0);assert.equal(m.getState().turn,0);m.update({insertion:.8,turn:360});assert.equal(m.getState().turn,0);
m.reset();m.update({insertion:1,turn:135});assert.equal(m.getState().gatesClear,true);assert.equal(m.getState().boltTravel,0);m.update({insertion:0,keyPattern:1});assert.equal(m.getState().values.insertion,1);assert.equal(m.getState().values.keyPattern,0);
m.update({turn:270});assert.equal(m.getState().boltTravel,.6);assert.ok(m.getState().leverAngles.every(a=>a>0));m.update({turn:360});assert.deepEqual(m.getState().leverAngles,[0,0,0]);assert.equal(m.getState().boltTravel,.6);m.update({insertion:0});assert.equal(m.getState().values.insertion,0);
m.update({door:65,operation:1,keyPattern:1});m.advance(12);assert.equal(m.getState().blocked,true);assert.equal(m.getState().boltTravel,.6);assert.equal(m.getState().doorAngle,0);
m.update({turn:360});m.update({insertion:0});m.update({keyPattern:0});m.advance(12);assert.equal(m.getState().complete,true);
m.reset();m.advance(12);m.update({insertion:1});m.update({turn:0});m.update({insertion:0});assert.equal(m.getState().doorAngle,65);assert.equal(m.getState().boltTravel,0);m.update({operation:1});m.advance(20);assert.equal(m.getState().complete,true);assert.equal(m.getState().doorAngle,0);
function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
for(const keyPattern of [0,1,2]){
 m.reset();m.update({keyPattern});m.update({insertion:1});
 for(let turn=0;turn<=360;turn++){
  m.update({turn});m.root.updateMatrixWorld(true);const state=m.getState(),lock=object('lock'),stump=object('stump').getWorldPosition(new THREE.Vector3());lock.worldToLocal(stump);assert.ok(Math.abs(stump.x-(.45-state.boltTravel))<1e-7&&Math.abs(stump.y-.9)<1e-7,'named stump moves with the tested bolt peg');
  for(let i=1;i<=3;i++){
   const lever=object('tumbler-'+i),solid=lever.children.find(o=>o.isMesh&&o.geometry.type==='ExtrudeGeometry'),hole=solid.geometry.parameters.shapes.holes[0].getPoints();
   for(let n=0;n<32;n++){const a=n*Math.PI/16,p=lock.localToWorld(new THREE.Vector3(.45-state.boltTravel+.035*Math.cos(a),.9+.035*Math.sin(a),0));lever.worldToLocal(p);assert.ok(inside(p,hole),'stump stays in actual lever opening at '+keyPattern+'/'+turn+'/'+i);}
   const marker=object('bolt-path-'+i).children[1].getWorldPosition(new THREE.Vector3());lock.worldToLocal(marker);assert.ok(Math.abs(marker.x-(.45-state.boltTravel))<1e-7&&Math.abs(marker.y-.9)<1e-7,'isolated path reference remains at actual stump position');
   const cam=object('key-shoulder-'+i).children[0],vertices=cam.geometry.attributes.position;let top=-Infinity;
   for(let n=0;n<vertices.count;n++){const p=cam.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices,n));lever.worldToLocal(p);top=Math.max(top,p.y);}
   assert.ok(top<=-.32+1e-6,'key never passes through the lever land');if(state.leverAngles[i-1]>0)assert.ok(-.32-top<.0002,'raised lever retains actual key contact');
   const spring=object('spring-'+i).children[0].geometry.parameters.path.points;assert.deepEqual(spring[0].toArray(),[-.9,1.25,-.08+(i-1)*.2+.03]);
   const tip=lever.localToWorld(new THREE.Vector3(.95,.34,.03));lock.worldToLocal(tip);assert.ok(tip.distanceTo(spring.at(-1))<1e-7,'spring bears on its attached lever');
   const curve=object('spring-'+i).children[0].geometry.parameters.path;for(const brace of object('bolt-bracket').children){const h=brace.geometry.parameters.height/2,a=lock.worldToLocal(brace.localToWorld(new THREE.Vector3(0,-h,0))),b=lock.worldToLocal(brace.localToWorld(new THREE.Vector3(0,h,0))),segment=new THREE.Line3(a,b);for(const point of curve.getPoints(64))assert.ok(segment.closestPointToPoint(point,true,new THREE.Vector3()).distanceTo(point)>.047,'moving bracket clears actual spring wire');}
  }
  const roller=object('key-drive').children[1].getWorldPosition(new THREE.Vector3());lock.worldToLocal(roller);
  if(roller.y>=0){const left=-state.boltTravel,right=.6-state.boltTravel;assert.ok(roller.x>=left-1e-7&&roller.x<=right+1e-7,'drive roller stays inside actual slot');}
 }
}
for(const [index,preset] of dailyLifeLessons['Lever lock'].tryIt.entries()){
 m.reset();m.update(preset.values);const state=m.getState();assert.deepEqual(state.values,preset.values,'preset '+index+' establishes its named state');assert.ok(state.readings.every(row=>row.hint),'every reading explains its meaning');
 m.advance(20);assert.equal(m.getState().blocked,[0,4].includes(index));assert.equal(m.getState().complete,![0,4].includes(index));
}
m.reset();assert.equal(object('key').position.z,.8);m.root.updateMatrixWorld(true);
const withdrawn=new THREE.Box3().setFromObject(object('key')),plates=new THREE.Box3().setFromObject(object('lever-pack'));assert.ok(withdrawn.min.z>plates.max.z,'withdrawn key clears the plate pack');
m.update({insertion:1,turn:135});assert.match(m.getState().readings.find(row=>row.label==='Next action').value,/roller must reach/);m.update({turn:360});assert.match(m.getState().readings.find(row=>row.label==='Lever gates').value,/hold the retracted bolt/);m.update({insertion:0});assert.match(m.getState().readings.find(row=>row.label==='Next action').value,/Open the door/);
m.reset();m.root.updateMatrixWorld(true);const fixed=object('frame').matrixWorld.clone();m.advance(12);m.root.updateMatrixWorld(true);assert.ok(object('frame').matrixWorld.equals(fixed));assert.notEqual(object('door').rotation.y,0);m.dispose();

console.log('PASS lever model: original contact/gate/spring/slot checks and three frame rates, six independent valid presets, reading hints and withdrawn-key clearance.');
if(process.env.MODEL_ONLY==='1')process.exit(0);
const evidence=process.env.EVIDENCE_DIR||'/tmp/howthingswork-lever';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/lever-lock`);await page.getByRole('button',{name:'Run selected action',exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Key pattern',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="turn"]').value==='180');assert.match(await page.locator('.daily-readings').textContent(),/Door held closed/);await page.screenshot({path:'/tmp/howthingswork-lever-wrong-key.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="door"]').value==='65');assert.equal(await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).inputValue(),'0');assert.match(await page.locator('.daily-readings').textContent(),/Door open · passage clear/);await page.screenshot({path:'/tmp/howthingswork-lever-open.png',fullPage:true});
 await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Door secured · key removed'));await page.screenshot({path:'/tmp/howthingswork-lever-secured.png',fullPage:true});
 const cases=[];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  const capture=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(100);await page.screenshot({path:`${evidence}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
  for(const [index,preset] of dailyLifeLessons['Lever lock'].tryIt.entries()){
   await page.locator('[data-cutaway]').uncheck();await page.locator('[data-labels]').check();await page.locator('button[data-label-part="door"]').click();await page.locator('[data-isolate]').check();await page.locator('[data-labels]').uncheck();
   await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
   for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value),'preset '+index+' '+key);
   assert.equal(await page.locator('[data-cutaway]').isChecked(),true);assert.equal(await page.locator('[data-isolate]').isChecked(),false);assert.equal(await page.locator('.daily-part-detail h3').textContent(),index===5?'Door and lever lock':'Enlarged lever-lock assembly');assert.equal(await page.locator('.daily-readings>div>p').count(),7);await capture('initial-'+index);
   await page.locator('[data-step]').click();assert.notEqual(await page.locator(index===5?'[data-number="door"]':preset.values.insertion?'[data-number="turn"]':'[data-number="insertion"]').inputValue(),String(index===5?preset.values.door:preset.values.insertion?preset.values.turn:preset.values.insertion),'Advance changes the current stage');
   await page.locator('[data-play]').click();await page.waitForTimeout(200);await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.locator('.daily-readings').textContent();await page.waitForTimeout(150);assert.equal(await page.locator('.daily-readings').textContent(),paused,'pause preserves state');await page.locator('[data-play]').click();
   const wrong=[0,4].includes(index);await page.waitForFunction(({wrong,closing})=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false'&&(wrong?document.querySelector('[data-number="turn"]').value==='180':document.querySelector('.daily-readings').textContent.includes(closing?'Door secured · key removed':'Door open · passage clear')),{wrong,closing:index===5},{timeout:30000});
   assert.match(await page.locator('.daily-readings').textContent(),wrong?/Wrong key: gate obstructed/:index===5?/Door secured · key removed/:/Door open · passage clear/);assert.equal(await page.locator('[data-number="door"]').inputValue(),wrong||index===5?'0':'65');await capture('complete-'+index);
   if(wrong){
    assert.equal(await page.locator('[data-number="insertion"]').isDisabled(),true);assert.equal(await page.locator('[data-control="keyPattern"]').isDisabled(),true);await page.locator('[data-number="turn"]').fill('0');await page.locator('[data-number="insertion"]').fill('0');await page.locator('[data-control="keyPattern"]').selectOption('0');await page.locator('[data-play]').click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});assert.equal(await page.locator('[data-number="door"]').inputValue(),'65');await capture('recovered-'+index);
   }else{
    const started=await page.locator('[data-play]').evaluate(button=>{button.click();const playing=button.getAttribute('aria-pressed')==='true';button.click();return playing;});assert.equal(started,true);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value),'replay restores '+key);if(index===5)assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Door and lever lock','replay retains and reframes a directly selected result');await capture('replay-'+index);
   }
   cases.push({width,preset:index,title:preset.title,independent:true,result:wrong?'Blocked and recovered':index===5?'Secured':'Open',replay:!wrong});
  }
  await page.locator('[data-reset-controls]').click();await page.locator('[data-number="door"]').fill('65');await page.locator('[data-number="door"]').blur();assert.equal(await page.locator('[data-number="door"]').inputValue(),'0');await page.locator('[data-number="insertion"]').fill('0.8');await page.locator('[data-number="turn"]').fill('360');await page.locator('[data-number="turn"]').blur();assert.equal(await page.locator('[data-number="turn"]').inputValue(),'0');
  await page.locator('[data-reset-controls]').click();await page.locator('[data-labels]').check();await page.locator('button[data-label-part="stump"]').click();await page.getByRole('heading',{name:'Lever lock',exact:true}).click();assert.match(await page.locator('.daily-part-detail').textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();assert.ok(await page.locator('.daily-inventory-labels [data-category]:visible').count()>=4);await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.getByRole('button',{name:'Reassemble',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await writeFile(`${evidence}/browser.json`,JSON.stringify({cases,errors},null,2));assert.equal(cases.length,12);
 await page.getByRole('button',{name:'The stump rests in the other end pockets while the springs lower the levers.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS lever lock: contact, actual gate openings, spring attachment, wrong-key obstruction, full opening and relocking at three frame rates, browser presets, quiz and mobile.');
}catch(error){console.error(await page.locator('.daily-readings').textContent());throw error;}finally{await browser.close();}
