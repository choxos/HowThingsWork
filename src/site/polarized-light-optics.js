const rad=Math.PI/180;
export const POLARIZED_LIGHT_DEFAULTS=Object.freeze({mode:0,power:100,input:0,inputAngle:0,first:0,analyzer:90,middle:45,insert:0,incidence:55,brewster:0,material:0,glasses:1,magnetic:0});
export const POLARIZED_LIGHT_DOMAINS={mode:[0,1,1],power:[0,100,10],input:[0,1,1],inputAngle:[0,180,15],first:[0,180,15],analyzer:[0,180,15],middle:[0,180,15],insert:[0,1,1],incidence:[0,80,5],brewster:[0,1,1],material:[0,1,1],glasses:[0,1,1],magnetic:[0,1,1]};
export const polarizedControlEnabled=(key,v)=>['mode','power','magnetic'].includes(key)||key==='analyzer'&&(v.mode===0||v.glasses===1)||(v.mode===0?['input','first','insert'].includes(key)||key==='inputAngle'&&v.input===1||key==='middle'&&v.insert===1:['brewster','material','glasses'].includes(key)||key==='incidence'&&!v.brewster);
export function polarizerProjection(vector,angle){const axis=[Math.cos(angle*rad),Math.sin(angle*rad)],dot=vector[0]*axis[0]+vector[1]*axis[1];return axis.map(n=>n*dot);}
export function dielectricReflection(index,angle){
 if(!Number.isFinite(index)||index<=1||!Number.isFinite(angle)||angle<0||angle>=90)throw new RangeError('Expected air-to-dielectric incidence');
 const t=angle*rad,refracted=Math.asin(Math.sin(t)/index),c=Math.cos(t),ct=Math.cos(refracted),rs=(c-index*ct)/(c+index*ct),rp=(index*c-ct)/(index*c+ct),Rs=rs*rs,Rp=rp*rp;
 return {angle,refracted:refracted/rad,rs,rp,Rs,Rp,Ts:1-Rs,Tp:1-Rp,brewster:Math.atan(index)/rad,incident:[Math.sin(t),-Math.cos(t),0],reflected:[Math.sin(t),Math.cos(t),0],transmitted:[Math.sin(refracted),-Math.cos(refracted),0],sAxis:[0,0,1],pAxis:[-Math.cos(t),Math.sin(t),0]};
}
export function samplePolarizedLight(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected polarization controls');for(const key of Object.keys(input))if(!Object.hasOwn(POLARIZED_LIGHT_DOMAINS,key))throw new RangeError('Unknown '+key);
 const v={...POLARIZED_LIGHT_DEFAULTS,...input};for(const [key,[lo,hi,step]] of Object.entries(POLARIZED_LIGHT_DOMAINS)){const n=v[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);}
 const power=v.power/100,count=v.input?1:8,ensemble=Array.from({length:count},(_,i)=>{const a=(v.input?v.inputAngle:i*180/count)*rad;return [Math.cos(a)*Math.sqrt(power/count),Math.sin(a)*Math.sqrt(power/count)];}),norm=es=>es.reduce((sum,e)=>sum+e[0]**2+e[1]**2,0),stages=[{x:-3,angle:null,ensemble,power:norm(ensemble)}],filters=[{x:-1.5,angle:v.first,key:'first'},...(v.insert?[{x:0,angle:v.middle,key:'middle'}]:[]),{x:1.5,angle:v.analyzer,key:'analyzer'}];
 for(const f of filters){const previous=stages.at(-1),es=previous.ensemble.map(e=>polarizerProjection(e,f.angle));stages.push({...f,ensemble:es,power:norm(es),absorbed:Math.max(0,previous.power-norm(es))});}
 const index=v.material?1.5:1.33,angle=v.brewster?Math.atan(index)/rad:v.incidence,reflection=dielectricReflection(index,angle),sPower=power*reflection.Rs/2,pPower=power*reflection.Rp/2,reflectedPower=sPower+pPower,a=v.analyzer*rad,glareOutput=v.glasses?pPower*Math.cos(a)**2+sPower*Math.sin(a)**2:reflectedPower;
 return {values:v,stages,filters,output:stages.at(-1).power,absorbed:power-stages.at(-1).power,index,reflection,sPower,pPower,reflectedPower,glareOutput,degree:reflectedPower?(sPower-pPower)/reflectedPower:0,glareRejected:reflectedPower?1-glareOutput/reflectedPower:0};
}
