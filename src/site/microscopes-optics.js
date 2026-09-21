import {thinLens} from '../physics.ts';
import {lensTrainMatrix} from './lenses-model.js';

export const MICROSCOPES_DEFAULTS=Object.freeze({mode:0,source:1,stage:4.4,eyepiece:25,aperture:.4,illumination:0,power:1,thickness:1,detector:0,scanWidth:2});
export const MICROSCOPE_DOMAINS={mode:[0,2,1],source:[0,1,1],stage:[4.4,5.2,.2],eyepiece:[25,50,25],aperture:[.2,.6,.2],illumination:[0,1,1],power:[.9,1.1,.05],thickness:[.5,2,.5],detector:[0,1,1],scanWidth:[1,2,1]};
export const microscopeControlEnabled=(key,v)=>key==='mode'||key==='source'||(v.mode===0?['stage','eyepiece','aperture','illumination'].includes(key):v.mode===1?['power','thickness'].includes(key):['detector','scanWidth'].includes(key));

// An asymmetric, dimensionless teaching specimen, not measured tissue or material data.
export function microscopeSpecimen(x,y){
 const hill=Math.exp(-((x+.35)**2+(y-.15)**2)/.12),ridge=Math.exp(-((x-.3)**2/.025+(y+.25)**2/.3));
 const dense=x>.05&&y>.05&&x<.7&&y<.65?1:0;
 return {height:.3*hill+.18*ridge,density:.3+.8*hill+.5*ridge+.7*dense,composition:dense};
}
export function microscopeSignal(x,y,v){
 const s=microscopeSpecimen(x,y);if(!v.source)return 0;
 if(v.mode===1)return Math.exp(-v.thickness*s.density);
 if(v.mode===0)return v.illumination?0:Math.exp(-s.density);
 if(v.detector===1)return .2+.6*s.composition;
 const dx=(microscopeSpecimen(x+.002,y).height-microscopeSpecimen(x-.002,y).height)/.004;
 return Math.max(.05,Math.min(.95,.25+.5*Math.abs(dx)+s.height));
}
export function sampleMicroscopes(input={},progress=1){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected microscope controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(MICROSCOPE_DOMAINS,key))throw new RangeError('Unknown '+key);
 const v={...MICROSCOPES_DEFAULTS,...input};
 for(const [key,[lo,hi,step]] of Object.entries(MICROSCOPE_DOMAINS)){const n=v[key];if(!Number.isFinite(n)||n<lo-1e-8||n>hi+1e-8||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-7)throw new RangeError('Invalid '+key);v[key]=Number(n.toFixed(10));}
 if(!Number.isFinite(progress)||progress<0||progress>1)throw new RangeError('Invalid progress');
 const optical=v.mode===0,objectDistance=optical?v.stage:1.2,focal=optical?4:1/v.power,objective=thinLens(focal,objectDistance),secondX=optical?44+v.eyepiece:8,secondF=optical?v.eyepiece:4/3,endX=optical?secondX+16:12;
 const matrix=lensTrainMatrix([{x:0,f:focal},{x:secondX,f:secondF}],-objectDistance,endX),rays=[],radius=optical?v.aperture:.15;
 for(const height of [-.1,0,.1])for(const pupil of [-radius,0,radius]){
  const incoming=(pupil-height)/objectDistance,afterObjective=incoming-pupil/focal,atSecond=pupil+secondX*afterObjective,output=afterObjective-atSecond/secondF;
  rays.push({height,pupil,incoming,afterObjective,output,points:[[-objectDistance,height],[0,pupil],[secondX,atSecond],[endX,atSecond+(endX-secondX)*output]],image:[objective.distance,objective.magnification*height]});
 }
 const middle=rays.filter(r=>r.height===0),outputSpread=Math.max(...middle.map(r=>r.output))-Math.min(...middle.map(r=>r.output)),screenSpan=Math.max(...middle.map(r=>r.points[3][1]))-Math.min(...middle.map(r=>r.points[3][1]));
 const illuminated=Boolean(v.source&&(v.mode!==0||!v.illumination)),focused=optical?outputSpread<1e-9:Math.abs(matrix[1])<1e-9;
 const na=Math.sin(Math.atan(v.aperture/v.stage)),acquired=v.mode===2&&v.source?Math.floor(progress*1024):0,index=Math.min(1023,acquired),column=index%32,row=Math.floor(index/32),scan=[((column+.5)/32-.5)*v.scanWidth,(.5-(row+.5)/32)*v.scanWidth];
 return {values:v,progress,objectDistance,focal,objective,secondX,secondF,endX,matrix,rays,radius,outputSpread,screenSpan,illuminated,focused,na,resolution:.61*.55/na,angularMagnification:objective.magnification*250/v.eyepiece,screenMagnification:matrix[0],acquired,scan,signal:microscopeSignal(...scan,v)};
}
