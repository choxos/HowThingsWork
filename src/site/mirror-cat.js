import * as THREE from 'three';

// One geometric description drives both the visible cat and its specular image.
// The local +X axis is the cat's gaze; Y is vertical, Z is across its face.
export const CAT_SHAPES = Object.freeze([
 [[0,-.12,0],[.18,.30,.22],0xd87926],
 [[.015,.24,0],[.19,.18,.22],0xe28b36],
 [[0,.405,-.145],[.09,.095,.07],0xd87926],
 [[0,.405,.145],[.09,.095,.07],0xd87926],
 [[.12,.408,-.145],[.012,.055,.035],0xf0b19a],
 [[.12,.408,.145],[.012,.055,.035],0xf0b19a],
 [[.19,.255,-.09],[.025,.052,.045],0xdee9ae],
 [[.19,.255,.09],[.025,.052,.045],0xdee9ae],
 [[.213,.255,-.09],[.009,.038,.012],0x172e29],
 [[.213,.255,.09],[.009,.038,.012],0x172e29],
 [[.187,.16,-.055],[.052,.045,.062],0xf6d6a1],
 [[.187,.16,.055],[.052,.045,.062],0xf6d6a1],
 [[.237,.182,0],[.02,.019,.03],0x93484a],
 [[.1,-.35,-.13],[.07,.15,.075],0xe28b36],
 [[.1,-.35,.13],[.07,.15,.075],0xe28b36],
 [[-.045,-.38,-.18],[.13,.12,.10],0xc96b24],
 [[-.045,-.38,.18],[.13,.12,.10],0xc96b24],
 [[-.14,-.34,.23],[.065,.07,.10],0xd87926],
 [[-.19,-.27,.29],[.055,.10,.055],0xd87926],
 [[-.20,-.12,.30],[.05,.10,.05],0xd87926],
 [[-.19,.025,.28],[.05,.075,.055],0xd87926],
 [[-.15,.08,.25],[.06,.045,.05],0xd87926],
]);

export function createMirrorCat(parent,ghost=false){
 const group=new THREE.Group();parent.add(group);
 for(const [center,radius,color] of CAT_SHAPES){
  const material=new THREE.MeshLambertMaterial({color:ghost?0x997ac5:color,transparent:ghost,opacity:ghost?.28:1,depthWrite:!ghost});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material);mesh.position.set(...center);mesh.scale.set(...radius);group.add(mesh);
 }
 return group;
}

export function mirrorCatPose(values){
 const {mode,distance,height,bearing,focus,offset}=values;
 if(mode===0)return {position:[-distance,0,0],height,direction:[1,0,0]};
 if(mode===1){const a=bearing*Math.PI/180;return {position:[-2.8*Math.cos(a),2.8*Math.sin(a),0],height:.6,direction:[Math.cos(a),-Math.sin(a),0]};}
 if(mode===2)return {position:[-focus+offset,0,0],height:.45,direction:[1,0,0]};
 return {position:[-3,1.2,0],height:.3,direction:[1,0,0]};
}

export function applyMirrorCatPose(cat,pose){
 cat.position.set(...pose.position);cat.scale.setScalar(pose.height);
 cat.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(...pose.direction));
}

// Exact ray/ellipsoid intersection, also used by the independent renderer check.
export function intersectCatEllipsoid(origin,direction,center,radius){
 const o=origin.map((x,i)=>(x-center[i])/radius[i]),d=direction.map((x,i)=>x/radius[i]);
 const a=d.reduce((s,x)=>s+x*x,0),b=o.reduce((s,x,i)=>s+x*d[i],0),c=o.reduce((s,x)=>s+x*x,0)-1,discriminant=b*b-a*c;
 if(discriminant<0||a===0)return null;
 const near=(-b-Math.sqrt(discriminant))/a,far=(-b+Math.sqrt(discriminant))/a;
 return near>1e-5?near:far>1e-5?far:null;
}

export function catMirrorMaterial(root,cat,reflectors,index){
 const uniforms={catInverse:{value:new THREE.Matrix4()},cameraOrigin:{value:new THREE.Vector3()},cameraDirection:{value:new THREE.Vector3()},orthographic:{value:1},kind:{value:0},curvature:{value:1},surfaceCenter:{value:new THREE.Vector3()},surfaceNormal:{value:new THREE.Vector3(-1,0,0)},otherCenter:{value:new THREE.Vector3()},otherNormal:{value:new THREE.Vector3()},otherTangent:{value:new THREE.Vector3()},otherPresent:{value:0},otherCutaway:{value:0},catCenter:{value:CAT_SHAPES.map(s=>new THREE.Vector3(...s[0]))},catRadius:{value:CAT_SHAPES.map(s=>new THREE.Vector3(...s[1]))},catColor:{value:CAT_SHAPES.map(s=>new THREE.Color(s[2]))}};
 const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms,
 vertexShader:`varying vec3 surfacePoint; varying vec3 meshNormal;
 void main(){surfacePoint=position;meshNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`
 precision highp float;
 varying vec3 surfacePoint; varying vec3 meshNormal;
 uniform mat4 catInverse;
 uniform vec3 cameraOrigin,cameraDirection,surfaceCenter,surfaceNormal,otherCenter,otherNormal,otherTangent;
 uniform float orthographic,kind,curvature,otherPresent,otherCutaway;
 uniform vec3 catCenter[${CAT_SHAPES.length}],catRadius[${CAT_SHAPES.length}],catColor[${CAT_SHAPES.length}];
 float catHit(vec3 origin,vec3 direction,out vec3 color){
  vec3 o=(catInverse*vec4(origin,1.)).xyz,d=(catInverse*vec4(direction,0.)).xyz;
  float nearest=1.e8;color=vec3(.75,.79,.80);
  for(int i=0;i<${CAT_SHAPES.length};i++){
   vec3 q=(o-catCenter[i])/catRadius[i],v=d/catRadius[i];
   float a=dot(v,v),b=dot(q,v),c=dot(q,q)-1.,disc=b*b-a*c;
   if(disc<0.)continue;
   float t=(-b-sqrt(disc))/a;if(t<.00001)t=(-b+sqrt(disc))/a;
   if(t>.00001&&t<nearest){nearest=t;vec3 normal=normalize((o+t*d-catCenter[i])/(catRadius[i]*catRadius[i]));float light=.65+.35*max(0.,dot(normal,normalize(vec3(.8,1.,1.))));color=catColor[i]*light;}
  }
  return nearest;
 }
 void main(){
  vec3 p=surfacePoint,n=surfaceNormal;
  float residual=dot(p-surfaceCenter,n);
  if(kind==1.){n=normalize(p-vec3(curvature,0.,0.));residual=abs(length(p-vec3(curvature,0.,0.))-curvature);}
  if(kind==2.){n=normalize(vec3(-1.,-p.y/(2.*curvature),-p.z/(2.*curvature)));residual=abs(p.x+dot(p.yz,p.yz)/(4.*curvature));}
  vec3 incoming=orthographic>.5?cameraDirection:normalize(p-cameraOrigin);
  // Backing and the narrow edge do not reflect through the opaque surface.
  if(abs(residual)>.002||dot(incoming,n)>=0.||abs(dot(normalize(meshNormal),n))<.8){gl_FragColor=vec4(.22,.26,.27,1.);return;}
  vec3 d=reflect(incoming,n),color;float nearest=catHit(p+n*.0001,d,color);
  if(otherPresent>.5){
   float den=dot(d,otherNormal),t=abs(den)>.000001?dot(otherCenter-p,otherNormal)/den:-1.;
   vec3 q=p+t*d;
   if(t>.0001&&t<nearest&&abs(dot(q-otherCenter,otherTangent))<=.65&&abs(q.z)<=.65&&(otherCutaway<.5||q.z<=0.)){
    if(den<0.){d=reflect(d,otherNormal);nearest=catHit(q+otherNormal*.0001,d,color);}
    else {nearest=1.e8;color=vec3(.22,.26,.27);}
   }
  }
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const inverseRoot=new THREE.Matrix4(),worldDirection=new THREE.Vector3();
 material.userData.update=(camera)=>{
  const surface=reflectors[index].surface,other=reflectors[1-index];if(!surface)return;
  inverseRoot.copy(root.matrixWorld).invert();cat.updateWorldMatrix(true,false);
  uniforms.catInverse.value.copy(cat.matrixWorld).invert().multiply(root.matrixWorld);
  camera.getWorldPosition(uniforms.cameraOrigin.value).applyMatrix4(inverseRoot);
  camera.getWorldDirection(worldDirection);uniforms.cameraDirection.value.copy(worldDirection).transformDirection(inverseRoot);
  uniforms.orthographic.value=camera.isOrthographicCamera?1:0;
  uniforms.kind.value=surface.kind==='convex'?1:surface.kind==='parabola'?2:0;
  uniforms.curvature.value=surface.radius??surface.focus??1;
  uniforms.surfaceCenter.value.set(...(surface.center||[0,0]),0);
  uniforms.surfaceNormal.value.set(...(surface.normal||[-1,0]),0);
  uniforms.otherCutaway.value=other?.cutaway?1:0;
  uniforms.otherPresent.value=surface.kind==='segment'&&other?.mesh.visible?1:0;
  if(uniforms.otherPresent.value){uniforms.otherCenter.value.set(...other.surface.center,0);uniforms.otherNormal.value.set(...other.surface.normal,0);uniforms.otherTangent.value.set(...other.surface.tangent,0);}
 };
 return material;
}
