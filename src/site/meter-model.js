import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
const TAU=Math.PI*2;
export function createMeterModel(){
 const m=houseModel('Electricity meter'),{part,box,cylinder,disk,rod,tube,ring,control,finish}=m;
 const meter=part('meter','Induction electricity meter','Two alternating fluxes drive an aluminum disk; a permanent magnet brakes it and a worm drives the energy dial.');
 const frame=part('frame','Frame and spindle bearings','The bearings align the disk spindle with the counting worm.',[0,0,0],meter);box([2.25,.12,1.8],[0,.15,0],'cream',frame);box([.15,.7,.15],[0,.57,0],'ink',frame);box([.17,.12,.17],[0,2.73,0],'ink',frame);box([2.25,2.75,.1],[0,1.52,-.98],'cream',frame);rod([0,2.73,-.93],[0,2.73,0],.035,'metal',frame);rod([.47,2.42,-.93],[.47,2.42,-.12],.03,'metal',frame);box([.12,.7,.16],[1,.56,.18],'ink',frame);for(const x of [-.8,.8])rod([x,1,-.93],[x,1,-.5],.04,'metal',frame);
 const rotor=part('rotor','Aluminum disk and spindle','Induced currents in this conducting disk interact with the alternating magnetic fields.',[0,1.2,0],meter);cylinder(.8,.035,[0,0,0],'metal',rotor);cylinder(.035,2.15,[0,.45,0],'gold',rotor);box([.1,.008,.16],[.7,.022,0],'ink',rotor);
 const voltage=part('voltage-coil','Voltage coil and magnetic return','The many-turn voltage winding is connected across the supply. Its flux is approximately a quarter-cycle behind the voltage.',[0,0,0],meter);
 box([1.7,.12,.17],[0,1.95,-.5],'metal',voltage);for(const x of [-.8,.8])box([.12,1.08,.17],[x,1.44,-.5],'metal',voltage);box([1.7,.12,.17],[0,.9,-.5],'metal',voltage);box([.14,.64,.14],[0,1.6,-.5],'metal',voltage);
 const vPoints=Array.from({length:401},(_,i)=>[.16*Math.cos(i*TAU/20),1.48+.36*i/400,-.5+.16*Math.sin(i*TAU/20)]);tube(vPoints,.014,'clay',voltage);
 const currentCoil=part('current-coil','Series current coils','These few thick turns carry the load current. Their field phase follows that current.',[0,0,0],meter);box([.8,.1,.15],[0,1.0,-.5],'metal',currentCoil);
 const cPoints=[];for(const x of [-.3,.3]){box([.12,.16,.12],[x,1.07,-.5],'metal',currentCoil);const points=Array.from({length:61},(_,i)=>[x+.12*Math.cos(i*TAU/20),.94+.18*i/60,-.5+.12*Math.sin(i*TAU/20)]);tube(points,.025,'gold',currentCoil);cPoints.push(points);}
 const brake=part('brake','Permanent braking magnet','The moving disk induces eddy currents in this fixed field, creating a torque opposing rotation.',[0,0,0],meter);box([.16,.52,.28],[1.0,1.2,.18],'metal',brake);box([.5,.12,.28],[.83,1.42,.18],'red',brake);box([.5,.12,.28],[.83,.98,.18],'blue',brake);
 const eddies=part('eddy-paths','Schematic eddy-current loops','Alternating flux induces circulating currents within the disk. These outlines show possible paths, not wires or a solved field.',[0,1.225,0],meter);for(const [x,z] of [[-.3,-.5],[.3,-.5],[.65,.18]]){const loop=ring(.12,.008,[x,0,z],'blue',eddies);loop.rotation.x=Math.PI/2;}
 const worm=part('worm','Single-start counting worm','One spindle turn advances the 100-tooth wheel by one tooth.',[0,2.42,0],meter);const pitch=TAU*.4/100;const wormPoints=Array.from({length:281},(_,i)=>[.06*Math.cos(i*TAU/20),-.176+pitch*i/20,.06*Math.sin(i*TAU/20)]);tube(wormPoints,.008,'gold',worm);
 const register=part('register','Energy register','The pointer follows the worm wheel. One full dial turn represents 100 Wh in this teaching meter.',[.47,2.42,0],meter);
 const wheel=part('wheel','100-tooth worm wheel','A 100:1 reduction turns accumulated disk revolutions into a slower dial movement.',[0,0,0],register);disk(.392,.07,[0,0,0],'clay',wheel);for(let i=0;i<100;i++){const a=i*TAU/100,tooth=box([.014,.03,.08],[Math.sin(a)*.4,Math.cos(a)*.4,0],'gold',wheel);tooth.rotation.z=-a;}rod([0,0,-.12],[0,0,.3],.025,'metal',register);
 const face=disk(.35,.025,[0,0,.16],'cream',register);
 for(let i=0;i<10;i++){const a=i*TAU/10;const tick=part('tick-'+i,i*10+' Wh mark','Ten equal intervals divide one 100 Wh dial turn.',[Math.sin(a)*.29,Math.cos(a)*.29,.18],register);const mark=box([.015,.05,.012],[0,0,0],'ink',tick);mark.rotation.z=-a;}
 const pointer=part('pointer','Accumulating energy pointer','This pointer stays at the recorded position when the appliance is switched off.',[0,0,.21],register);rod([0,0,0],[0,.25,0],.012,'ink',pointer);disk(.035,.025,[0,0,.01],'gold',pointer);
 const terminals=part('terminals','Supply and load connections','The current coils are in series with the load; the voltage winding is a separate branch across the supply.',[0,0,0],meter);
 const wire=(points,color='clay')=>points.slice(1).forEach((p,i)=>rod(points[i],p,.018,color,terminals));
 wire([[-1.2,.4,0],[-1.2,.75,-.75],cPoints[0][0]]);wire([cPoints[0].at(-1),[-.18,.8,-.8],[.42,.8,-.8],cPoints[1][0]]);wire([cPoints[1].at(-1),[1.2,.75,-.75],[1.2,.4,0]]);
 wire([[-1.2,.26,0],[1.2,.26,0]],'blue');wire([[-1.2,.4,0],[-1.25,1.85,-.9],vPoints.at(-1)]);wire([vPoints[0],[-1.1,1.48,-.9],[-1.1,.26,0]],'blue');
 for(const x of [-1.2,1.2])for(const y of [.26,.4])disk(.04,.06,[x,y,0],'metal',terminals);
 control('power','Appliance real power',0,2000,100,600,'W','The appliance transfers this much energy per second while operating. Zero switches the load off.');
 control('duration','Observation duration',1,10,1,1,'min','Run until this simulated time is reached. Earlier energy remains when you change the load.');
 control('pace','Clock pace',1,30,1,10,'s/s','Simulated seconds per real second. Disk and register follow this same clock.');
 control('factor','Load power factor',.2,1,.1,1,'','At the same real power, a lower power factor requires more RMS current.');
 control('brake','Relative brake field',.5,1.5,.1,1,'','Calibration experiment: braking torque grows with field squared. The correct reference setting is 1.');
 let elapsed=0,energy=0,registered=0,lastClock=0;
 const result=finish(v=>{const current=v.power/(120*v.factor),speed=v.power/(3600*v.brake*v.brake),turns=registered;rotor.rotation.y=turns*TAU;worm.rotation.y=turns*TAU;wheel.rotation.z=-turns*TAU/100;pointer.rotation.z=wheel.rotation.z;
 return {state:{elapsed,energy,registered,current,speed,turns,complete:elapsed>=v.duration*60},readings:[r('Your result',registered.toFixed(3)+' Wh recorded',(elapsed>=v.duration*60?'Observation complete. ':'')+'The total persists when power changes.'),r('Actual appliance energy',energy.toFixed(3)+' Wh'),r('Observed time',elapsed.toFixed(1)+' / '+(v.duration*60)+' s'),r('Disk speed',(speed*60).toFixed(2)+' rpm','1000 disk revolutions represent 1 kWh at reference calibration.'),r('RMS current',current.toFixed(3)+' A','120 V RMS; P = V × I × power factor.'),r('Dial',((registered%100)/10).toFixed(2)+' divisions','Each marked division is 10 Wh. The total readout retains full turns.')]};},{animated:true});
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return result.update();const v=result.getState().values,dt=Math.min(seconds,Math.max(0,v.duration*60-elapsed));elapsed+=dt;energy+=v.power*dt/3600;registered+=v.power*dt/(3600*v.brake*v.brake);return result.update();}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{elapsed=0;energy=0;registered=0;lastClock=0;};
 result.playback={description:'The disk and dial advance with the selected clock pace. One simulated minute takes six seconds at the default pace.',label:'Measure the appliance',stepLabel:'Observe ten seconds',advance:dt=>advance(dt*result.getState().values.pace),step:()=>advance(10),complete:()=>result.getState().complete,blocked:()=>false};
 result.resultPart={id:'register',context:'meter',label:'Inspect the energy dial',available:()=>true};return result;
}
