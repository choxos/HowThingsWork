import assert from 'node:assert/strict';
import {createTelescopesModel,sampleTelescopes,telescopeSky,TELESCOPES_DEFAULTS as D} from './telescopes-model.js';
import {telescopesLesson as lesson} from './telescopes-lesson.js';
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<t,`${a} != ${b}`);
let configurations=0,rays=0,folds=0;
for(const mode of [0,1,2,3])for(const eyepiece of [.25,.5,.75,1])for(const aperture of [.6,.9,1.2])for(const field of [.5,1,1.5,2])for(const focus of [-.1,-.05,0,.05,.1]){
 const s=sampleTelescopes({mode,eyepiece,aperture,field,focus});configurations++;near(s.area,Math.PI*(aperture*10)**2*(mode>=2?.75:1));near(s.magnification,(mode===1?1:-1)*(mode>=2?18:3)/eyepiece);
 if(focus===0)near(s.divergence,0);else assert.ok(s.divergence>0);
 for(const r of s.rays){rays++;for(const p of r.points)assert.ok(p.every(Number.isFinite));for(const t of r.turns)near(t.outgoing,t.incoming-t.height/t.f);
  if(mode>=2){const shadow=r.h-2*r.theta;if(Math.abs(shadow)<aperture*.5-1e-9){assert.equal(r.blocked,'Secondary shadow');assert.equal(r.points.length,2);continue;}
   near(r.points[2][1],r.h/3+2*r.theta);if(r.points.length>3)near(r.points[3][1],2*r.h/9+22*r.theta/3);
   if(r.blocked==='Primary-hole edge'){assert.ok(Math.abs(r.points.at(-1)[1])>aperture*.4);continue;}
  }
  if(r.received){const image=r.points.at(-3),F=mode>=2?18:3;near(image[0],mode===3?3:mode===2?4:mode===1?5:3);near(image[1],(mode===3?-1:0)+(mode===1?-1:1)*F*r.theta);
   if(focus===0)near(r.outputSlope,(mode===1?1:-1)*F*r.theta/eyepiece);
   if(mode===3){for(const j of [4,5]){const a=r.points[j-1],b=r.points[j],c=r.points[j+1],u=[b[0]-a[0],b[1]-a[1]],w=[c[0]-b[0],c[1]-b[1]],ul=Math.hypot(...u),wl=Math.hypot(...w);near(b[0]+b[1],j===4?1:0);near(w[0]/wl,-u[1]/ul);near(w[1]/wl,-u[0]/ul);folds++;assert.ok(Math.hypot(b[0]-1,b[1]-(j===4?0:-1))<.75);}}
  }
 }
}
const anchors=[54.81408936118582,125.37525580406748,62.08789606128044,148.697868903685];const start=telescopeSky(45,20,-30),end=telescopeSky(45,20,-15);[start.altitude,start.azimuth,end.altitude,end.azimuth].forEach((x,i)=>near(x,anchors[i]));
for(const latitude of [30,45,60])for(const declination of [0,20,40,60])for(const tracking of [0,1,2,3])for(const field of [.5,1,1.5,2])for(let i=0;i<=100;i++){
 const s=sampleTelescopes({mode:4,latitude,declination,tracking,field},i/100),k=s.sky;configurations++;near(Math.hypot(...k.target.vector),1);near(Math.hypot(...k.aim),1);assert.ok(k.target.altitude>0&&k.target.altitude<89);if(tracking===1||i===0)near(k.error,0,2e-6);near(k.altitude,[1,3].includes(tracking)?k.target.altitude:k.initial.altitude);near(k.azimuth,[1,2].includes(tracking)?k.target.azimuth:k.initial.azimuth);assert.equal(k.inField,k.error<=field/2+1e-9);
}
[14.0906523663,0,7.2738067001,10.8587244318].forEach((error,tracking)=>near(sampleTelescopes({mode:4,tracking}).sky.error,error,1e-7));
const model=createTelescopesModel(),resources=new Set();model.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
assert.ok(model.getState().readings.every(r=>r.hint),'Every telescope reading has an explanation');
assert.equal(model.resultPart.view,'side');assert.equal(model.resultPart.context,undefined);assert.equal(model.parts.find(p=>p.id==='image').maxZoom,1000);
for(const preset of lesson.tryIt){assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(D).sort());model.reset();model.update(preset.values);assert.deepEqual(model.getState().values,preset.values);for(const action of model.actions){action.run();const s=model.getState();assert.equal(s.readings.length,s.values.mode===4?11:13);assert.ok(s.readings.every(r=>r.hint&&r.value!=='Not applicable'));for(const c of model.controls)assert.equal(c.visibleWhen(s.values),c.enabledWhen(s.values));assert.equal(model.topology.mount.visible,s.values.mode===4);assert.equal(model.topology.optical.visible,s.values.mode!==4);if(s.values.mode!==4){near(model.topology.imageCat.position.x,s.focusPoint[0]);near(model.topology.imageCat.scale.y,s.imageSign*s.imageHeight);}model.root.traverse(o=>{if(o.geometry){assert.ok(resources.has(o.geometry));for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});}}
// The housing stays outside the modeled entrance aperture; its cutaway faces the diagram viewer.
for(const mode of [0,1,2,3])for(const aperture of [.6,.9,1.2])for(const eyepiece of [.25,1]){
 model.update({...D,mode,aperture,eyepiece});const {shell,collars,rail,supports}=model.topology,s=model.getState();assert.ok(shell.scale.x>aperture&&shell.scale.y>0);near(shell.scale.z,shell.scale.x);assert.ok(collars[0].position.x<collars[1].position.x);near(shell.position.x,(collars[0].position.x+collars[1].position.x)/2);near(shell.scale.y,collars[1].position.x-collars[0].position.x);assert.ok(rail.scale.x>shell.scale.y);for(const post of supports){assert.ok(post.scale.y>0);near(post.position.y-post.scale.y/2,rail.position.y+.065);}
 near(supports[2].position.x,s.eyeX);near(supports[2].position.y+supports[2].scale.y/2,s.eyeY-.65);
}
model.update({mode:2});const secondary=model.topology.secondary;assert.ok(secondary.scale.x>0);const surface=secondary.geometry.attributes.position;near(surface.getX(0),0);assert.ok(Math.min(...Array.from({length:surface.count},(_,i)=>surface.getX(i)))<0);
model.reset();model.playback.step();near(model.getState().elapsed,.08);model.advance(100);assert.ok(model.playback.complete());model.reset();assert.ok(!model.playback.complete());
const counts=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));model.dispose();model.dispose();for(const n of counts.values())assert.equal(n,1);
for(const v of [{mode:5},{eyepiece:0},{field:NaN},{tracking:4},{latitude:31},{extra:0}])assert.throws(()=>sampleTelescopes(v));assert.throws(()=>sampleTelescopes({},-1));console.log(JSON.stringify({passed:true,configurations,rays,planeReflections:folds,presets:lesson.tryIt.length,resources:resources.size}));
