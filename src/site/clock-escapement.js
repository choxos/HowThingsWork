// Original 30-tooth Graham (deadbeat anchor) teaching geometry, in millimeters.
// Locking faces are concentric with the anchor arbor. Straight impulse faces
// join tooth positions at the two ends of a 2-degree anchor lift. Each beat
// advances 4 degrees in contact and 2 degrees during drop, totaling half a tooth.
// Motion is a quasistatic contact construction, not an impact/friction solver.
const DEG=Math.PI/180,TAU=2*Math.PI;
export const ESCAPEMENT=Object.freeze({radius:28,root:20,teeth:30,pivotHeight:28*Math.SQRT2,lift:DEG,impulse:4*DEG,drop:2*DEG,dropTravel:.12*DEG,lockExtent:2.4*DEG,maxAmplitude:3.2*DEG});
export const rotate2=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
export const toothTip=phi=>[ESCAPEMENT.radius*Math.sin(phi),ESCAPEMENT.radius*Math.cos(phi)];
export function toAnchor(point,angle){return rotate2([point[0],point[1]-ESCAPEMENT.pivotHeight],-angle);}
export function toWheel(point,angle){const p=rotate2(point,angle);return [p[0],p[1]+ESCAPEMENT.pivotHeight];}
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
const angle=p=>Math.atan2(p[1],p[0]);
const arc=(r,from,to,count=32)=>Array.from({length:count+1},(_,i)=>polar(r,from+(to-from)*i/count));
function pallet(side){
 // Entry drives the anchor clockwise; exit drives it counterclockwise.
 // Centering each impulse about its tangent point makes the two pallets
 // share the same inner and outer radii, with opposite locking faces.
 const entry=side==='entry',direction=entry?-1:1,start=(entry?-45:45)*DEG-ESCAPEMENT.impulse/2;
 const a=toAnchor(toothTip(start),-direction*ESCAPEMENT.lift),b=toAnchor(toothTip(start+ESCAPEMENT.impulse),direction*ESCAPEMENT.lift);
 const lockRadius=Math.hypot(...a),backRadius=Math.hypot(...b),end=angle(a)+direction*ESCAPEMENT.lockExtent;
 const outline=[...arc(lockRadius,end,angle(a)),...arc(backRadius,angle(b),end)];
 return Object.freeze({side,direction,start,a,b,lockRadius,backRadius,outline});
}
export const PALLETS=Object.freeze([pallet('entry'),pallet('exit')]);

/** Intersection of the moving straight impulse face with the tooth-tip circle. */
export function impulseContact(side,anchorAngle){
 const p=PALLETS[side],a=toWheel(p.a,anchorAngle),b=toWheel(p.b,anchorAngle),v=[b[0]-a[0],b[1]-a[1]];
 const A=v[0]**2+v[1]**2,B=2*(a[0]*v[0]+a[1]*v[1]),C=a[0]**2+a[1]**2-ESCAPEMENT.radius**2;
 const disc=B*B-4*A*C;
 if(disc<0)throw new RangeError('Impulse face does not intersect the escape-wheel circle');
 const roots=[(-B+Math.sqrt(disc))/(2*A),(-B-Math.sqrt(disc))/(2*A)];
 const fraction=roots.find(t=>t>=-1e-8&&t<=1+1e-8);
 if(fraction===undefined)throw new RangeError('Contact lies beyond the impulse face');
 const point=[a[0]+fraction*v[0],a[1]+fraction*v[1]];
 return {point,fraction,turn:Math.atan2(point[0],point[1])-p.start};
}

/** Contact-constrained wheel phase for one full settled pendulum period. */
export function sampleEscapement(phase,amplitude){
 if(!Number.isFinite(phase)||phase<0||!Number.isFinite(amplitude)||amplitude<=ESCAPEMENT.lift+ESCAPEMENT.dropTravel||amplitude>ESCAPEMENT.maxAmplitude)throw new RangeError('Escapement requires nonnegative phase and swing within its working range');
 const half=Math.floor(phase*2),side=half%2,local=phase*2-half,p=PALLETS[side];
 const anchor=-p.direction*amplitude*Math.cos(Math.PI*local),toward=p.direction*anchor;
 const base=half*Math.PI/30;
 let turn=0,stage='Locked',contactSide=side,contact;
 if(toward<=-ESCAPEMENT.lift){contact=toothTip(p.start);}
 else if(toward<ESCAPEMENT.lift){const hit=impulseContact(side,anchor);turn=hit.turn;contact=hit.point;stage='Impulse';}
 else if(toward<ESCAPEMENT.lift+ESCAPEMENT.dropTravel){
  const u=(toward-ESCAPEMENT.lift)/ESCAPEMENT.dropTravel;turn=ESCAPEMENT.impulse+u*ESCAPEMENT.drop;stage='Drop';contactSide=null;
 }else{turn=Math.PI/30;contactSide=1-side;contact=toothTip(PALLETS[contactSide].start);}
 return {anchor,escape:base+turn,stage,contactSide,contact,beats:half+(turn>=Math.PI/30-1e-12?1:0)};
}

/** Back-raked teeth clear both pallet bodies during locking and release. */
export function escapeOutline(){
 const points=[],pitch=TAU/ESCAPEMENT.teeth;
 for(let i=0;i<ESCAPEMENT.teeth;i++){
  const tip=PALLETS[0].start+i*pitch;points.push(toothTip(tip));
  for(const offset of [-4,2])points.push([ESCAPEMENT.root*Math.sin(tip+offset*DEG),ESCAPEMENT.root*Math.cos(tip+offset*DEG)]);
 }
 return points;
}
