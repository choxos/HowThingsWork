import assert from 'node:assert/strict';
import {ADD_DEFAULTS, ADD_DOMAINS, ADD_KEYS, ADD_SEGMENTS, ADD_TIMING, additionSettings, additionSegments, additionReadback, additionPlan, additionAt, createAdditionController} from './calculator-addition-physics.js';

let checks = 0, combinations = 0, sampledStates = 0;
const eq = (actual, expected, message) => {checks++;assert.deepEqual(actual, expected, message);};
const ok = (value, message) => {checks++;assert.ok(value, message);};
const rejects = operation => {checks++;assert.throws(operation);};
const oracleMasks = ['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
function checkDisplay(now, expected) {
  const padded = expected === null ? '   ' : String(expected).padStart(3, ' ');
  eq(now.readback, expected === null ? 'Blank' : String(expected));eq(now.displayRegister, expected);
  for (let digit = 0; digit < 3; digit++) {
    const character = padded[digit], blank = character === ' ', expectedMask = blank ? '0000000' : oracleMasks[Number(character)];
    eq([...'abcdefg'].map(segment => +now.digits[digit].mask.includes(segment)).join(''), expectedMask);
    eq(now.digits[digit].bcd, blank ? null : Number(character).toString(2).padStart(4, '0'));
    for (const [index, segment] of [...'abcdefg'].entries()) {
      const drive = now.drive[digit][segment], on = expectedMask[index] === '1';
      eq(drive.on, on);eq(drive.difference, on ? [1,-1] : [0,0]);
      eq(drive.difference, drive.electrode.map((value, phase) => value - drive.common[phase]));
      eq((drive.difference[0] + drive.difference[1]) / 2, 0);eq(drive.mean, 0);eq(drive.rms, on ? 1 : 0);
    }
  }
}
eq(ADD_KEYS, ['7','8','9','4','5','6','1','2','3','+','0','=']);
for (let digit = 0; digit < 10; digit++) eq([...'abcdefg'].map(segment => +ADD_SEGMENTS[digit].includes(segment)).join(''), oracleMasks[digit]);
for (let value = 0; value <= 198; value++) eq(additionReadback(additionSegments(value).map(digit => digit.mask)), String(value));
eq(additionReadback(['','','']), 'Blank');eq(additionReadback(['bc','','bc']), 'Invalid segments');eq(additionReadback(['','','bad']), 'Invalid segments');
for (const bad of [-1,199,.5,NaN,Infinity,undefined,'3']) rejects(()=>additionSegments(bad));
for (const bad of [null,[],[''],['','','', ''],[0,0,0]]) rejects(()=>additionReadback(bad));

const observedKeys = new Set(), observedStages = new Set();
for (let first = 0; first < 100; first++) for (let second = 0; second < 100; second++) {
  const sequence = [...String(first), '+', ...String(second), '='], plan = additionPlan({first,second});
  eq(plan.keys.map(key => key.key), sequence);eq(plan.keys.length, String(first).length + String(second).length + 2);
  const initial = additionAt(plan,0);eq(initial.acceptedKeys,[]);eq(initial.first,null);eq(initial.second,null);eq(initial.result,null);eq(initial.readback,'0');
  let expectedEntry = '', secondEntry = false, expectedFirst = null;
  for (const [index,key] of plan.keys.entries()) {
    observedKeys.add(key.key);const before = additionAt(plan,key.accept - .00001), after = additionAt(plan,key.accept);
    sampledStates += 2;observedStages.add(before.stage);observedStages.add(after.stage);
    eq(before.acceptedKeys, sequence.slice(0,index));eq(after.acceptedKeys,sequence.slice(0,index+1));eq(before.result,null);eq(after.result,null);
    eq(before.pressed,key.key);eq(before.scanRow,key.row);eq(before.columnLow,key.column);eq(after.pressed,null);eq(after.scanRow,-1);
    if (key.key === '+') {expectedFirst = Number(expectedEntry);expectedEntry = '';secondEntry = true;}
    else if (key.key === '=') eq(after.second, second);
    else {expectedEntry += key.key;eq(after.readback,String(Number(expectedEntry)));}
    eq(after.entry,expectedEntry);eq(after.first,expectedFirst);eq(after.enteringSecond,secondEntry);
    eq(ADD_KEYS[key.row * 3 + key.column],key.key);
  }
  const preTransfer = additionAt(plan,plan.duration - .00001);eq(preTransfer.readback,String(second));eq(preTransfer.result,null);eq(preTransfer.written,false);
  let carry = 0;
  for (let column = 0; column < 3; column++) {
    const time = Math.round((plan.calculate + (column+1)*ADD_TIMING.column) * 1e9) / 1e9;
    const before = additionAt(plan,time - .00001), after = additionAt(plan,time);sampledStates += 2;
    observedStages.add(before.stage);observedStages.add(after.stage);
    eq(before.columns[column].complete,false);eq(before.columns[column].total,null);eq(after.columns[column].complete,true);
    const place = [1,10,100][column], a = Math.floor(first/place)%10, b = Math.floor(second/place)%10, total = a+b+carry;
    eq(after.columns[column],{place,a,b,carryIn:carry,total,digit:total%10,carryOut:+(total>=10),active:false,complete:true});
    carry=+(total>=10);
  }
  for (const power of [0,1]) for (const ambient of [0,1]) {
    combinations++;const current = additionPlan({first,second,power,ambient}), done = additionAt(current,current.duration);
    sampledStates++;observedStages.add(done.stage);eq(done.complete,Boolean(power));eq(done.result,power?first+second:null);eq(done.visible,Boolean(ambient));
    checkDisplay(done,power?first+second:null);
    if (!power) {eq(done.acceptedKeys,[]);eq(done.first,null);eq(done.second,null);eq(done.progress,0);eq(done.columns.every(column=>!column.complete),true);}
  }
}
eq([...observedKeys].sort(),[...ADD_KEYS].sort());
for (const key of ADD_KEYS) {
  const first = /^\d$/.test(key) ? Number(key) : 0, plan = additionPlan({first,second:0}), event = plan.keys.find(event=>event.key===key);
  for (let row = 0; row < 4; row++) {
    const state = additionAt(plan,event.start + (row+.5)*ADD_TIMING.row);sampledStates++;observedStages.add(state.stage);
    eq(state.scanRow,row);eq(state.columnLow,row===event.row?event.column:-1);eq(state.pressed,key);eq(state.confirming,false);
  }
}

const controller = createAdditionController();controller.advance(2.1);
const beforeLight = controller.getState();controller.update({ambient:0});const dark = controller.getState();
eq(dark.clock,beforeLight.clock);eq({...dark.now,visible:true,illuminated:true},beforeLight.now);controller.advance(100);eq(controller.getState().now.result,34);eq(controller.getState().now.visible,false);
const darkDone = controller.getState();controller.update({ambient:1});eq(controller.getState().clock,darkDone.clock);eq(controller.getState().now.result,34);eq(controller.getState().now.visible,true);
const beforeSame = controller.getState();controller.update({...beforeSame.values});eq(controller.getState(),beforeSame);
const exposed = controller.getState();exposed.values.first=99;exposed.now.digits[0].mask='abcdefg';exposed.now.drive[0].a.difference[0]=99;exposed.now.columns[0].digit=99;eq(controller.getState(),beforeSame);
controller.update({first:9});eq(controller.getState().clock,0);eq(controller.getState().now.readback,'0');eq(controller.getState().now.result,null);controller.advance(100);eq(controller.getState().now.result,18);
controller.update({power:0});eq(controller.getState().clock,0);eq(controller.getState().now.readback,'Blank');eq(controller.getState().now.result,null);controller.advance(100);eq(controller.getState().clock,0);
controller.update({second:8});eq(controller.getState().now.readback,'Blank');controller.update({power:1});eq(controller.getState().now.readback,'0');eq(controller.getState().now.acceptedKeys,[]);controller.advance(100);eq(controller.getState().now.result,17);
const replay = controller.replayState();eq(replay,{settings:{first:9,second:8,power:1,ambient:1},time:0});controller.reset(replay);eq(controller.getState().now.readback,'0');eq(controller.getState().clock,0);

for (const time of [0,.25,.4,.93,2.1,4.9,100]) for (const power of [0,1]) {
  controller.reset({settings:{power},time});controller.update({power:0});const off=controller.getState();checkDisplay(off.now,null);eq(off.clock,0);controller.update({power:1});eq(controller.getState().now.readback,'0');eq(controller.getState().now.acceptedKeys,[]);
}
for (const hz of [24,30,60,120]) {
  controller.reset();for(let index=0;index<hz*4;index++)controller.advance(1/hz);
  const now=controller.getState();ok(Math.abs(now.clock-4)<1e-6);eq(now.now.readback,'9');eq(now.now.acceptedKeys,['2','5','+','9']);controller.advance(100);eq(controller.getState().now.result,34);
}
const invalidControls = [null,[],true,'first',1,{unknown:1},{first:-1},{first:100},{first:.1},{first:NaN},{first:Infinity},{second:undefined},{power:2},{ambient:.5}];
for(const input of invalidControls){const saved=controller.getState();rejects(()=>controller.update(input));eq(controller.getState(),saved);rejects(()=>additionSettings(input));}
for(const input of [null,[],false,{unknown:0},{settings:null},{settings:{first:-1}},{time:null},{time:-1},{time:NaN},{time:Infinity}]){const saved=controller.getState();rejects(()=>controller.reset(input));eq(controller.getState(),saved);}
for(const seconds of [-1,NaN,Infinity,null,'1']){const saved=controller.getState();rejects(()=>controller.advance(seconds));eq(controller.getState(),saved);rejects(()=>additionAt(additionPlan(),seconds));}
for(const object of [ADD_DEFAULTS,ADD_DOMAINS,ADD_DOMAINS.first,ADD_KEYS,ADD_SEGMENTS,ADD_TIMING,additionPlan(),additionPlan().keys,additionPlan().keys[0]])ok(Object.isFrozen(object));
eq(combinations,40000);observedStages.add(additionAt(additionPlan(),0).stage);
eq([...observedStages].sort(),['Ready to enter','Scan key matrix','Confirm stable key','Release key','Add ones','Add tens','Add hundreds','Transfer result to display','Result displayed','Power off'].sort());
console.log(JSON.stringify({status:'PASS',checks,combinations,arithmeticPairs:10000,sampledStates,keys:observedKeys.size,stages:observedStages.size}));
