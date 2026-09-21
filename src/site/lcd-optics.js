import {polarizerProjection} from './polarized-light-optics.js';
export const LCD_DEFAULTS=Object.freeze({mode:0,lighting:0,power:100,battery:1,drive:0,digit:3,segment:0,analyzer:0,polarity:0});
export const LCD_DOMAINS={mode:[0,1,1],lighting:[0,1,1],power:[0,100,10],battery:[0,1,1],drive:[0,1,1],digit:[0,9,1],segment:[0,6,1],analyzer:[0,2,1],polarity:[0,1,1]};
export const LCD_DIGITS=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
export const lcdControlEnabled=(key,v)=>key==='drive'?v.mode===0:key==='digit'||key==='segment'?v.mode===1:true;
export const rotateLCDField=(e,angle)=>{const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [c*e[0]-s*e[1],s*e[0]+c*e[1]];};
const powerOf=es=>es.reduce((sum,e)=>sum+e[0]**2+e[1]**2,0);
function cellPath(v,driven){
 const twist=driven?0:90,axis=v.analyzer===0?90:0,ensemble=Array.from({length:8},(_,i)=>{const a=i*Math.PI/8,r=Math.sqrt(v.power/800);return [r*Math.cos(a),r*Math.sin(a)];});
 const steps=v.lighting===0?[['Ambient light',-3.1],['Front polarizer',-1.8,0],['Front electrode',-1.25],['Twisted layer',1.25,null,twist],['Rear polarizer',1.8,v.analyzer===2?null:axis],['Mirror',2.5],['Rear polarizer on return',1.8,v.analyzer===2?null:axis],['Rear electrode on return',1.25],['Layer on return',-1.25,null,-twist],['Front polarizer on return',-1.8,0],['Observer',-3.1]]:[['Backlight',2.5],['Rear polarizer',1.8,v.analyzer===2?null:axis],['Rear electrode',1.25],['Layer toward observer',-1.25,null,-twist],['Front polarizer',-1.8,0],['Observer',-3.1]];
 const stages=[];let es=ensemble;
 for(const [name,x,polarizer,rotation=0] of steps){if(rotation)es=es.map(e=>rotateLCDField(e,rotation));if(polarizer!==undefined&&polarizer!==null)es=es.map(e=>polarizerProjection(e,polarizer));stages.push({name,x,rotation,polarizer,ensemble:es,power:powerOf(es)});}
 return {twist,stages,output:stages.at(-1).power};
}
export function sampleLCD(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected LCD controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(LCD_DOMAINS,key))throw new RangeError('Unknown '+key);
 const v={...LCD_DEFAULTS,...input};for(const [key,[lo,hi,step]] of Object.entries(LCD_DOMAINS)){const n=v[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);}
 const addressed=Array.from({length:7},(_,i)=>LCD_DIGITS[v.digit].includes('abcdefg'[i])),selectedAddress=v.mode?addressed[v.segment]:Boolean(v.drive),driven=Boolean(v.battery&&selectedAddress),path=cellPath(v,driven),background=cellPath(v,false),active=cellPath(v,true),common=v.battery?v.polarity:0,segmentVoltage=v.battery?(driven?1-v.polarity:v.polarity):0,difference=segmentVoltage-common;
 const segmentPowers=addressed.map(on=>on&&v.battery?active.output:background.output),contrast=v.power?Math.abs(active.output-background.output)/(v.power/100):0;
 return {values:v,driven,addressed,path,background,active,segmentPowers,common,segmentVoltage,difference,rms:driven?1:0,mean:0,contrast,output:path.output,darkSegments:v.mode&&v.battery&&v.analyzer===0&&v.power?addressed.filter(Boolean).length:0};
}
