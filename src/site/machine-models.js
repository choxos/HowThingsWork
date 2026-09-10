import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {add} from '../../src/scene/kit.ts';

const colors = {leaf:0x91aa7e, clay:0xce825f, cream:0xf0dfaf, ink:0x374736, blue:0x83b4c1, wood:0xae8056, metal:0xb4c5b0, gold:0xe3b45e};

export function createMachine(name) {
  const root=new THREE.Group(), covers=[];
  const shades=new THREE.DataTexture(new Uint8Array([90,180,255]),3,1,THREE.RedFormat);
  shades.minFilter=THREE.NearestFilter;shades.magFilter=THREE.NearestFilter;shades.needsUpdate=true;
  const materials=new Map();
  const outline=new THREE.MeshBasicMaterial({color:colors.ink,side:THREE.BackSide});
  function mesh(geometry,tone='leaf',position=[0,0,0],parent=root) {
    if(!materials.has(tone))materials.set(tone,new THREE.MeshToonMaterial({color:colors[tone]??tone,gradientMap:shades}));
    const item=add(parent,geometry,materials.get(tone));item.position.set(...position);
    const edge=new THREE.Mesh(geometry,outline);edge.scale.setScalar(1.025);item.add(edge);
    return item;
  }
  const box=(size,pos,tone='leaf',parent=root)=>mesh(new RoundedBoxGeometry(...size,2,Math.min(...size)*.16),tone,pos,parent);
  const ball=(size,pos,tone='leaf',parent=root)=>{const item=mesh(new THREE.SphereGeometry(1,24,16),tone,pos,parent);item.scale.set(...size);return item;};
  const cylinder=(r,length,pos,tone='metal',parent=root)=>mesh(new THREE.CylinderGeometry(r,r,length,32),tone,pos,parent);
  const disk=(r,length,pos,tone='metal',parent=root)=>{const item=cylinder(r,length,pos,tone,parent);item.rotation.x=Math.PI/2;return item;};
  const ring=(r,tube,pos,tone='ink',parent=root)=>mesh(new THREE.TorusGeometry(r,tube,10,40),tone,pos,parent);
  function rod(a,b,r=.035,tone='metal',parent=root){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);const item=cylinder(r,start.distanceTo(end),start.clone().add(end).multiplyScalar(.5).toArray(),tone,parent);item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return item;}
  function tube(points,r=.025,tone='metal',parent=root){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),64,r,8,false),tone,[0,0,0],parent);}
  function group(pos=[0,0,0],parent=root){const item=new THREE.Group();item.position.set(...pos);parent.add(item);return item;}
  function gear(r,pos,tone='gold',parent=root){const g=group(pos,parent);disk(r*.88,.13,[0,0,0],tone,g);for(let i=0;i<14;i++){const angle=i*Math.PI/7;const tooth=box([r*.21,r*.23,.14],[Math.sin(angle)*r,Math.cos(angle)*r,0],tone,g);tooth.rotation.z=-angle;}disk(r*.2,.16,[0,0,0],'metal',g);return g;}
  function wheel(r,pos,parent=root){const g=group(pos,parent);ring(r,.07,[0,0,0],'ink',g);ring(r*.82,.024,[0,0,0],'metal',g);for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([0,0,0],[r*.85*Math.cos(a),r*.85*Math.sin(a),0],.012,'metal',g);}disk(.08,.15,[0,0,0],'gold',g);return g;}
  function blades(parent,r=1,count=4){for(let i=0;i<count;i++){const angle=i*Math.PI*2/count;const b=ball([r*.45,r*.13,.055],[Math.cos(angle)*r*.48,Math.sin(angle)*r*.48,0],'cream',parent);b.rotation.z=angle;}disk(.12,.16,[0,0,.04],'gold',parent);}
  let animate;
  switch(name) {
    case 'Sewing machine': {
      box([2.7,.2,1.25],[0,.1,0],'wood');
      box([2.4,.17,.96],[0,.28,0]);box([.5,1.48,.7],[.85,1.05,0]);box([2,.48,.7],[.13,1.66,0]);box([.45,.65,.72],[-.68,1.43,0]);
      const handwheel=group([1.24,1.5,0]);const w=disk(.42,.16,[0,0,0],'cream',handwheel);w.rotation.set(0,0,Math.PI/2);rod([0,0,0],[0,.25,.12],.04,'wood',handwheel);
      const needle=group([-.68,.94,.09]);cylinder(.027,.55,[0,0,0],'metal',needle);box([.26,.045,.16],[-.68,.49,.1],'metal');
      const cloth=box([1.2,.025,.85],[-.48,.39,.25],'clay');
      const spool=cylinder(.14,.33,[.38,2.06,0],'clay');cylinder(.035,.47,[.38,2.06,0],'wood');
      tube([[.38,2.23,0],[-.3,1.98,.2],[-.68,1.7,.4],[-.68,.7,.11]],.012,'cream');
      rod([- .68,1.53,0],[1.24,1.53,0],.045,'metal');
      const drive=group([-.68,1.53,0]);const cam=disk(.17,.09,[0,0,0],'gold',drive);cam.rotation.set(0,0,Math.PI/2);
      const link=rod([-.68,1.53,.09],[-.68,1.215,.09],.025,'metal');
      covers.push(root.children[2],root.children[3]);
      animate=t=>{handwheel.rotation.x=t*Math.PI*2;needle.position.y=.94+Math.sin(t*Math.PI*2)*.18;drive.rotation.x=-t*Math.PI*2;link.position.y=1.3725+Math.sin(t*Math.PI*2)*.18;spool.rotation.y=t*4;cloth.position.z=.25+t*.25;};break;
    }
    case 'Refrigerator': {
      for(const x of [-.77,.77])box([.11,2.7,1.3],[x,1.42,0],'cream');
      box([1.55,2.7,.1],[0,1.42,-.62],'cream');for(const y of [.12,2.73])box([1.55,.1,1.3],[0,y,0],'cream');
      box([1.38,2.42,.025],[0,1.43,-.555],'blue');
      for(const y of [.56,1.08,1.61,2.15])box([1.4,.045,.95],[0,y,.22],'cream');
      for(const x of [-.4,0,.4])cylinder(.11,.3,[x,.76,.43],'clay');
      const door=group([-.83,1.4,.69]);box([1.64,2.65,.15],[.83,0,0],'leaf',door);box([.07,.7,.13],[1.43,.07,.15],'cream',door);box([1.56,.026,.025],[.83,.52,.09],'ink',door);covers.push(door);
      for(let i=0;i<7;i++)tube([[-.62,.37+i*.29,-.74],[.63,.37+i*.29,-.74],[.68,.5+i*.29,-.74],[-.62,.51+i*.29,-.74]],.032,i<3?'blue':'clay');
      ball([.36,.27,.27],[0,.3,-.81],'ink');
      animate=t=>door.rotation.y=-t*Math.PI*.64;break;
    }
    case 'Toaster': {
      const body=box([2,1.25,1.25],[0,.77,0],'clay');covers.push(body);
      box([1.83,.12,1.12],[0,.17,0],'cream');
      for(const z of [-.3,.3]){box([1.5,.06,.2],[0,1.42,z],'ink');for(let i=0;i<7;i++)rod([-.66+i*.22,.36,z-.07],[-.66+i*.22,1.21,z-.07],.014,'gold');}
      const rack=group([0,.8,0]);for(const z of [-.3,.3]){box([1.2,.85,.13],[0,.32,z],'cream',rack);ball([.61,.21,.07],[0,.74,z],'gold',rack);}
      box([.08,.65,.15],[1.07,.8,0],'ink');const handle=box([.24,.1,.25],[1.17,1.12,0],'cream');disk(.14,.06,[-.62,.6,.66],'cream');
      animate=t=>{rack.position.y=.8-t*.58;handle.position.y=1.12-t*.55;};break;
    }
    case 'Cylinder lock': {
      const body=cylinder(.58,2.8,[0,.67,0],'gold');body.rotation.z=Math.PI/2;const chambers=box([2.8,.72,.64],[0,1.23,0],'gold');covers.push(body,chambers);
      const plug=mesh(new THREE.CylinderGeometry(.46,.46,2.88,32,1,true,Math.PI/2,Math.PI),'cream',[0,.67,0]);plug.rotation.z=Math.PI/2;
      const pins=[];
      for(let i=0;i<4;i++){const p=group([-.81+i*.54,1.13-(.1+i*.045),0]);const length=.41-i*.0175;cylinder(.085,.35,[0,.175,0],'leaf',p);cylinder(.085,length,[0,-length/2,0],'clay',p);pins.push(p);ring(.075,.015,[-.81+i*.54,1.58,0],'metal').rotation.x=Math.PI/2;}
      const key=group([-2.2,.55,.16]);box([2.8,.12,.19],[0,0,0],'gold',key);ring(.3,.075,[-1.66,0,0],'gold',key);for(let i=0;i<4;i++)box([.18,.14+i*.035,.18],[-.7+i*.54,.1,0],'gold',key);
      animate=t=>{key.position.x=-2.2+t*2.1;pins.forEach((p,i)=>p.position.y=1.13-(1-t)*(.1+i*.045));};break;
    }
    case 'Quartz clock': {
      disk(1.1,.26,[0,1.15,0],'clay');disk(.98,.04,[0,1.15,.16],'cream');
      for(let i=0;i<12;i++){const a=i*Math.PI/6;const mark=box([.045,.12,.018],[Math.sin(a)*.82,1.15+Math.cos(a)*.82,.2],'ink');mark.rotation.z=-a;}
      const minute=group([0,1.15,.24]),hour=group([0,1.15,.22]),second=group([0,1.15,.27]);box([.06,.76,.025],[0,.32,0],'ink',minute);box([.08,.51,.025],[0,.21,0],'ink',hour);box([.025,.85,.02],[0,.3,0],'clay',second);disk(.075,.05,[0,1.15,.28],'gold');
      box([.72,.8,.2],[0,1.15,-.27],'leaf');box([.4,.15,.12],[0,1.33,-.43],'metal');
      animate=t=>{minute.rotation.z=-t*Math.PI*2;hour.rotation.z=-Math.PI/3-t*Math.PI/6;second.rotation.z=-t*Math.PI*24;};break;
    }
    case 'Vacuum cleaner': {
      box([1.55,.36,1.03],[0,.25,0],'clay');for(const x of [-.68,.68]){const w=disk(.21,.16,[x,.22,.22],'ink');w.rotation.set(0,0,Math.PI/2);}
      const body=box([.85,1.5,.64],[0,1.09,-.02],'leaf');body.rotation.x=-.14;covers.push(body);
      rod([0,1.72,-.12],[0,2.7,-.32],.075,'metal');rod([0,2.7,-.32],[.52,2.7,-.32],.075,'cream');
      tube([[.33,1.53,-.13],[.78,1.86,-.08],[.98,1.1,.06],[.55,.42,.17]],.09,'wood');
      const fan=group([0,.69,.36]);blades(fan,.3);box([.5,.74,.4],[0,1.3,0],'cream');
      animate=t=>fan.rotation.z=t*Math.PI*4;break;
    }
    case 'Power drill': {
      const body=box([1.62,.75,.74],[-.26,1.17,0],'leaf');covers.push(body);
      const grip=box([.47,.92,.54],[-.54,.55,0],'clay');grip.rotation.z=-.12;box([.8,.25,.78],[-.51,.12,0],'leaf');
      const chuck=cylinder(.28,.46,[.73,1.18,0],'ink');chuck.rotation.z=Math.PI/2;
      const bit=group([1.05,1.18,0]);rod([0,0,0],[.95,0,0],.055,'metal',bit);for(let i=0;i<8;i++){const r=ring(.075,.018,[i*.11,0,0],'metal',bit);r.rotation.y=Math.PI/2;r.rotation.z=.35;}
      cylinder(.18,.9,[-.22,1.17,0],'gold').rotation.z=Math.PI/2;box([.13,.18,.25],[-.24,.84,.23],'ink');animate=t=>bit.rotation.x=t*Math.PI*6;break;
    }
    case 'Bicycle brake': {
      const rear=wheel(.65,[-1,.67,0]),front=wheel(.65,[1,.67,0]);
      for(const [a,b] of [[[-1,.67,0],[-.38,1.53,0]],[[-.38,1.53,0],[.15,.67,0]],[[.15,.67,0],[-1,.67,0]],[[-.38,1.53,0],[.67,1.43,0]],[[.67,1.43,0],[.15,.67,0]],[[.67,1.43,0],[1,.67,0]]])rod(a,b,.047,'clay');
      rod([.67,1.43,0],[.53,1.8,0],.05,'metal');tube([[.53,1.8,0],[.87,1.83,0],[1.06,1.69,0]],.05,'ink');box([.43,.09,.32],[-.39,1.59,0],'wood');
      const brake=group([1,1.2,.03]);rod([-.2,.07,0],[-.08,-.14,0],.04,'metal',brake);rod([.2,.07,0],[.08,-.14,0],.04,'metal',brake);box([.1,.16,.18],[-.11,-.17,0],'ink',brake);box([.1,.16,.18],[.11,-.17,0],'ink',brake);
      tube([[.93,1.74,.02],[.72,1.4,.08],[1,1.3,.08]],.014,'ink');animate=t=>{front.rotation.z=-t*6;rear.rotation.z=-t*6;};break;
    }
    case 'Tower crane': {
      box([1.2,.17,1.2],[0,.1,0],'wood');
      for(const x of [-.18,.18])for(const z of [-.18,.18])rod([x,.2,z],[x,2.8,z],.045,'gold');
      for(let i=0;i<6;i++)for(const z of [-.18,.18])rod([-.18,.3+i*.4,z],[.18,.65+i*.4,z],.026,'gold');
      box([3.25,.16,.38],[.4,2.73,0],'gold');rod([-1.2,2.75,0],[0,3.2,0],.025,'metal');rod([0,3.2,0],[2,2.75,0],.025,'metal');
      box([.66,.44,.53],[-.9,2.49,0],'clay');box([.43,.42,.45],[.36,2.48,0],'blue');
      const load=group([1.6,.8,0]);box([.65,.45,.56],[0,0,0],'wood',load);const line=rod([1.6,2.7,0],[1.6,1.05,0],.016,'ink');
      animate=t=>{load.position.y=.8+t;line.scale.y=(1.65-t)/1.65;line.position.y=1.875+t*.5;};break;
    }
    case '3D printer': {
      box([2,.24,1.6],[0,.13,0],'leaf');for(const x of [-.88,.88])box([.16,2.05,.17],[x,1.24,-.5],'leaf');box([1.95,.15,.18],[0,2.3,-.5],'leaf');
      box([1.55,.08,1.15],[0,.48,0],'metal');rod([-.84,1.65,-.5],[.84,1.65,-.5],.04,'metal');
      const head=group([0,1.63,-.29]);box([.37,.37,.34],[0,0,0],'clay',head);mesh(new THREE.ConeGeometry(.09,.2,16),'gold',[0,-.27,0],head).rotation.z=Math.PI;
      box([.66,.42,.55],[0,.74,0],'cream');for(let i=0;i<7;i++)box([.68,.017,.56],[0,.54+i*.06,0],'gold');
      const spool=disk(.4,.18,[.9,2.5,-.54],'cream');spool.rotation.set(0,0,Math.PI/2);tube([[.9,2.5,-.54],[.4,2.63,-.3],[0,1.8,-.3]],.014,'clay');animate=t=>head.position.x=Math.sin(t*Math.PI*2)*.6;break;
    }
    case 'Differential': {
      const housing=ball([1.12,.98,.7],[0,1.1,0],'leaf');covers.push(housing);
      rod([-2,1.1,0],[2,1.1,0],.12,'metal');
      const left=gear(.4,[-.55,1.1,.08],'gold'),right=gear(.4,[.55,1.1,.08],'gold'),middle=gear(.24,[0,1.55,.08],'clay');
      left.rotation.y=Math.PI/2;right.rotation.y=Math.PI/2;
      const outputs=[-1.8,1.8].map((x,i)=>{const w=wheel(.62,[x,1.1,0]);w.name=i?'Right output wheel':'Left output wheel';w.rotation.y=Math.PI/2;return w;});
      animate=t=>{left.rotation.x=outputs[0].rotation.x=t*6;right.rotation.x=outputs[1].rotation.x=t*3;middle.rotation.z=-t*6;};break;
    }
    case 'Industrial robot': {
      cylinder(.65,.2,[0,.12,0],'leaf');cylinder(.33,.4,[0,.43,0],'gold');
      const shoulder=group([0,.63,0]);disk(.28,.6,[0,0,0],'cream',shoulder);box([.35,1.08,.37],[0,.58,0],'clay',shoulder);
      const elbow=group([0,1.12,0],shoulder);disk(.24,.48,[0,0,0],'cream',elbow);box([.31,.85,.3],[0,.46,0],'clay',elbow);disk(.19,.4,[0,.9,0],'cream',elbow);
      rod([0,.9,0],[.35,1.15,0],.07,'metal',elbow);rod([.35,1.15,0],[.53,1.05,0],.04,'ink',elbow);rod([.35,1.15,0],[.4,1.4,0],.04,'ink',elbow);
      animate=t=>{shoulder.rotation.z=-.4+Math.sin(t*Math.PI*2)*.3;elbow.rotation.z=1.2+Math.cos(t*Math.PI*2)*.35;};break;
    }
    case 'Computer': {
      box([2.1,1.35,.22],[0,1.48,0],'leaf');box([1.86,1.09,.025],[0,1.5,.13],'blue');
      box([.22,.62,.22],[0,.61,0],'wood');box([1,.1,.65],[0,.27,0],'wood');
      box([1.88,.12,.67],[0,.16,.7],'cream');for(let row=0;row<3;row++)for(let col=0;col<11;col++)box([.115,.025,.12],[-.79+col*.157,.24,.48+row*.18],'leaf');
      for(let i=0;i<4;i++)box([1.1-i*.13,.055,.016],[-.12,1.82-i*.19,.155],i===0?'cream':'leaf');
      ball([.17,.075,.23],[1.2,.17,.68],'clay');box([.34,.52,.12],[0,1.45,-.2],'clay');break;
    }
    case 'Optical microscope': {
      box([1.65,.17,1.12],[0,.12,0],'leaf');
      tube([[.48,.19,0],[.68,.8,0],[.47,1.61,0],[.19,1.8,0]],.12,'leaf');
      box([1.08,.1,.75],[-.22,.85,.03],'ink');box([.5,.025,.2],[-.22,.92,.08],'blue');
      const scope=cylinder(.17,.85,[-.1,1.76,0],'clay');scope.rotation.z=-.42;
      const eyepiece=cylinder(.21,.16,[-.3,2.23,0],'ink');eyepiece.rotation.z=-.42;
      cylinder(.12,.24,[.08,1.21,.02],'metal');disk(.2,.2,[.57,1.17,.18],'cream');
      const mirror=disk(.21,.04,[-.15,.52,0],'blue');mirror.rotation.x=-Math.PI/4;break;
    }
    case 'Nuclear reactor': {
      cylinder(1.07,.18,[0,.14,0],'wood');
      const wall=cylinder(.91,1.7,[0,1.08,0],'cream');const roof=ball([.91,.6,.91],[0,1.93,0],'cream');covers.push(wall,roof);
      mesh(new THREE.CylinderGeometry(.53,.53,1.22,32,1,true,Math.PI/2,Math.PI),'blue',[0,.94,0]);for(const x of [-.25,0,.25])for(const z of [-.22,.03,.28])cylinder(.052,.9,[x,1.03,z],'clay');
      const controls=group([0,1.75,0]);for(const x of [-.2,.2])rod([x,-.3,-.12],[x,.7,-.12],.045,'ink',controls);
      tube([[.54,.72,0],[1.25,.72,0],[1.25,1.65,0],[.54,1.65,0]],.08,'clay');cylinder(.28,1.2,[1.3,1.17,0],'leaf');animate=t=>controls.position.y=1.75-t*.5;break;
    }
    case 'Space probe': {
      box([.9,1,.75],[0,1.25,0],'gold');for(const x of [-1.3,1.3]){box([1.35,.8,.05],[x,1.23,0],'blue');for(let i=0;i<5;i++)box([.016,.79,.012],[x-.53+i*.265,1.23,.036],'cream');box([1.34,.015,.012],[x,1.23,.036],'cream');}
      const dish=mesh(new THREE.ConeGeometry(.57,.26,32,1,true),'cream',[0,1.95,0]);dish.rotation.x=Math.PI;rod([0,1.96,0],[0,2.36,0],.028,'metal');ball([.07,.07,.07],[0,2.36,0],'gold');
      for(const x of [-.3,.3])rod([x,.75,0],[x*2,.27,.3],.035,'metal');box([.15,.15,.28],[0,1.04,.53],'ink');break;
    }
    case 'MRI scanner': {
      const shell=ring(.92,.36,[0,1.3,0],'cream');shell.scale.z=2;covers.push(shell);
      const coils=ring(.93,.06,[0,1.3,-.24],'clay');for(const z of [-.4,-.2,0,.2,.4])ring(.94,.055,[0,1.3,z],'gold');
      box([1.96,.33,1.09],[0,.25,0],'leaf');const bed=group([0,.65,1.15]);box([.77,.13,2.1],[0,0,0],'blue',bed);box([.5,.5,.25],[0,-.28,.7],'cream',bed);
      box([.29,.24,.06],[-.95,1.74,.31],'blue');animate=t=>{bed.position.z=1.15-t*.7;coils.rotation.z=t;};break;
    }
    case 'Airplane': {
      ball([1.7,.28,.28],[0,.89,0],'cream');
      const wing=box([.85,.075,3.3],[.08,.91,0],'clay');wing.rotation.y=.12;
      box([.42,.06,1.36],[-1.16,1.03,0],'leaf');const fin=box([.49,.57,.055],[-1.24,1.29,0],'clay');fin.rotation.z=-.2;
      ball([.55,.17,.25],[.64,1.08,0],'blue');
      for(const z of [-.65,.65]){rod([0,.85,z],[0,.31,z],.035,'metal');disk(.17,.1,[0,.24,z],'ink');}
      const prop=group([1.63,.9,0]);blades(prop,.48,3);prop.rotation.y=Math.PI/2;animate=t=>prop.rotation.x=t*Math.PI*4;break;
    }
    case 'Windmill': {
      mesh(new THREE.CylinderGeometry(.34,.61,1.75,10),'cream',[0,.95,0]);mesh(new THREE.ConeGeometry(.63,.66,8),'clay',[0,2.14,0]);
      box([.28,.58,.03],[0,.4,.53],'wood');const rotor=group([0,1.68,.57]);disk(.15,.18,[0,0,0],'gold',rotor);
      for(let i=0;i<4;i++){const arm=group([0,0,0],rotor);arm.rotation.z=i*Math.PI/2;rod([0,0,0],[0,1.34,0],.035,'wood',arm);box([.31,.94,.045],[.13,.82,0],'cream',arm);for(let j=0;j<5;j++)box([.33,.018,.015],[.13,.45+j*.18,.04],'wood',arm);}
      animate=t=>rotor.rotation.z=t*Math.PI*2;break;
    }
    case 'Hot-air balloon': {
      const balloon=group([0,1.93,0]);for(let i=0;i<8;i++){const a=i*Math.PI/4;ball([.46,1.02,.46],[Math.cos(a)*.48,0,Math.sin(a)*.48],i%2?'cream':'clay',balloon);}
      cylinder(.23,.21,[0,.95,0],'wood');box([.56,.36,.47],[0,.32,0],'wood');for(const x of [-.22,.22])for(const z of [-.18,.18])rod([x,.46,z],[x,.97,z],.018,'ink');
      mesh(new THREE.ConeGeometry(.1,.27,16),'gold',[0,.79,0]);break;
    }
    case 'Quadcopter': {
      box([.64,.2,.57],[0,.5,0],'cream');for(const x of [-.83,.83])for(const z of [-.7,.7]){rod([0,.5,0],[x,.5,z],.07,'clay');cylinder(.13,.19,[x,.6,z],'leaf');const rotor=group([x,.74,z]);box([.97,.035,.14],[0,0,0],'ink',rotor);rotor.userData.rotor=true;}
      for(const x of [-.25,.25])tube([[x,.47,.27],[x,.13,.43],[x,.13,-.43],[x,.47,-.27]],.035,'metal');ball([.12,.1,.12],[0,.31,.24],'blue');
      animate=t=>root.children.filter(c=>c.userData.rotor).forEach((r,i)=>r.rotation.y=t*12*(i%2?-1:1));break;
    }
    case 'Combine harvester': {
      box([2.05,.83,1.16],[-.19,1.05,0],'leaf');box([.7,.7,.8],[.51,1.75,0],'blue');box([.79,.1,.92],[.51,2.14,0],'cream');
      for(const x of [-.9,.66])for(const z of [-.66,.66])disk(x>0?.48:.34,.23,[x,x>0?.49:.36,z],'ink');
      box([.55,.22,2.4],[1.25,.32,0],'clay');const reel=group([1.46,.67,0]);for(const z of [-1,1])disk(.26,.04,[0,0,z],'wood',reel);for(let i=0;i<6;i++){const a=i*Math.PI/3;rod([Math.cos(a)*.25,Math.sin(a)*.25,-1],[Math.cos(a)*.25,Math.sin(a)*.25,1],.035,'gold',reel);}
      tube([[-.6,1.67,0],[-1.16,2.1,0],[-1.5,2.1,.9]],.1,'leaf');animate=t=>reel.rotation.z=t*Math.PI*2;break;
    }
    case 'Lawn sprinkler': {
      box([2.3,.16,.9],[0,.13,0],'leaf');const arch=group([0,.38,0]);rod([-1,0,0],[1,0,0],.12,'metal',arch);for(let i=0;i<9;i++){const x=-.85+i*.21;ball([.027,.027,.027],[x,.13,0],'ink',arch);tube([[x,.15,0],[x,1.2,.26],[x,1.65,1.1],[x,1,1.8]],.011,'blue',arch);}
      cylinder(.18,.12,[-1.23,.24,0],'gold').rotation.z=Math.PI/2;animate=t=>arch.rotation.x=Math.sin(t*Math.PI*2)*.55;break;
    }
    case 'Binoculars': {
      for(const x of [-.44,.44]){cylinder(.34,1.18,[x,.78,0],'leaf').rotation.x=Math.PI/2;disk(.29,.035,[x,.78,.61],'blue');disk(.2,.16,[x,.78,-.65],'ink');ring(.35,.045,[x,.78,.55],'ink');}
      box([.56,.19,.55],[0,.82,0],'clay');cylinder(.12,.35,[0,.96,-.03],'wood').rotation.x=Math.PI/2;
      tube([[-.69,.8,-.12],[-.94,.25,-.75],[.87,.27,-.74],[.68,.8,-.12]],.025,'wood');break;
    }
    case 'Grand piano': {
      const shape=new THREE.Shape();shape.moveTo(-1,-.8);shape.lineTo(1,-.8);shape.lineTo(1,.4);shape.bezierCurveTo(.9,1.9,-.75,1.7,-1,.4);shape.closePath();
      const body=mesh(new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.045}),'wood',[0,1.1,0]);body.rotation.x=-Math.PI/2;
      const lid=body.clone();lid.position.y=1.46;lid.rotation.z=.18;root.add(lid);covers.push(lid);
      for(const x of [-.84,.84])box([.12,1.09,.12],[x,.55,.7],'wood');box([.12,1.09,.12],[.23,.55,-1.18],'wood');
      box([1.86,.13,.56],[0,1.13,1.02],'cream');for(let i=0;i<15;i++){box([.011,.022,.51],[-.87+i*.125,1.21,1.02],'ink');if(i%7!==2&&i%7!==6)box([.063,.08,.27],[-.82+i*.125,1.24,.89],'ink');}
      for(let i=0;i<12;i++)rod([-.75+i*.13,1.4,.59],[-.6+i*.1,1.4,-1.15],.009,'gold');break;
    }
    case 'Digital single-lens reflex camera': {
      const body=box([1.95,1.18,.76],[0,.77,0],'leaf');covers.push(body);box([.62,.24,.64],[-.02,1.48,0],'ink');
      disk(.45,.66,[.08,.8,.61],'ink');disk(.37,.06,[.08,.8,.98],'blue');ring(.42,.028,[.08,.8,.99],'gold');box([.3,1.13,.22],[.77,.76,.48],'wood');cylinder(.14,.08,[.68,1.43,0],'clay');
      box([1.04,.65,.026],[-.1,.77,-.4],'blue');box([.64,.54,.018],[0,.79,0],'clay');const mirror=box([.5,.5,.028],[0,.78,.31],'metal');mirror.rotation.x=-.65;animate=t=>mirror.rotation.x=-.65-t*1.1;break;
    }
    case 'Printing press': {
      for(const x of [-1.04,1.04])box([.18,1.57,1.15],[x,.88,0],'leaf');
      const rollers=[];for(const y of [.73,1.28]){const roller=cylinder(.29,1.95,[0,y,0],y>1?'clay':'gold');roller.rotation.z=Math.PI/2;rollers.push(roller);}
      box([1.9,.035,1.7],[0,.99,.61],'cream');for(let i=0;i<4;i++)box([.65,.008,.035],[-.34,.013+.99,.68+i*.14],'leaf');
      const crank=group([1.21,1.27,0]);ring(.34,.05,[0,0,0],'wood',crank).rotation.y=Math.PI/2;rod([0,0,0],[0,.27,.14],.04,'wood',crank);
      animate=t=>{crank.rotation.x=t*6;rollers.forEach((r,i)=>r.rotation.y=t*6*(i?-1:1));};break;
    }
    case 'Condenser microphone': {
      cylinder(.57,.12,[0,.08,0],'wood');rod([0,.1,0],[0,1.45,0],.045,'metal');
      const body=box([.6,.96,.45],[0,1.72,0],'leaf');covers.push(body);
      for(let i=0;i<8;i++)box([.48,.025,.03],[0,1.35+i*.11,.25],'cream');
      disk(.22,.02,[0,1.79,.14],'gold');disk(.22,.02,[0,1.79,.08],'metal');tube([[.22,1.29,0],[.35,.74,0],[.55,.13,.3],[1,.07,.56]],.027,'ink');break;
    }
    case 'Violin': {
      const body=group([0,1.04,0]);ball([.46,.53,.16],[0,-.21,0],'clay',body);ball([.35,.36,.15],[0,.34,0],'clay',body);
      box([.14,1.05,.12],[0,1.91,0],'wood');ball([.18,.2,.13],[0,2.53,0],'wood');box([.17,1.24,.035],[0,1.67,.17],'ink');
      box([.26,.075,.08],[0,.89,.21],'cream');for(let i=0;i<4;i++)rod([-.048+i*.032,.49,.24],[-.048+i*.032,2.43,.2],.008,'cream');
      for(const x of [-.23,.23])tube([[x,.89,.16],[x-.025,1.08,.18],[x+.018,1.25,.16]],.016,'ink');
      const bow=group([.77,1.4,.32]);rod([0,-1.1,0],[0,1.1,0],.025,'wood',bow);rod([.08,-1.02,0],[.08,1.01,0],.011,'cream',bow);bow.rotation.z=-.55;animate=t=>bow.position.x=.67+Math.sin(t*6)*.33;break;
    }
    case 'Video projector': {
      const body=box([1.88,.63,1.48],[0,.59,0],'cream');covers.push(body);disk(.34,.17,[-.5,.58,.8],'ink');disk(.27,.024,[-.5,.58,.9],'blue');
      for(let i=0;i<6;i++)box([.045,.24,.03],[.19+i*.11,.61,.77],'leaf');for(const x of [-.7,.7])for(const z of [-.5,.5])cylinder(.09,.12,[x,.23,z],'wood');
      box([1,.04,.81],[.1,.47,0],'leaf');disk(.17,.15,[-.5,.57,.26],'gold');box([.24,.24,.03],[-.5,.57,.07],'metal');break;
    }
    case 'Passenger boat':
    case 'Yacht':
    case 'Hydrofoil': {
      const shape=new THREE.Shape();shape.moveTo(-1.6,.61);shape.lineTo(1.62,.61);shape.lineTo(1.21,0);shape.lineTo(-1.13,0);shape.closePath();
      mesh(new THREE.ExtrudeGeometry(shape,{depth:.88,bevelEnabled:true,bevelSize:.08,bevelThickness:.07,bevelSegments:2,steps:1}),'clay',[0,.34,-.44]);box([2.77,.09,.93],[0,.99,0],'cream');
      if(name==='Yacht') {rod([.1,.99,0],[.1,3.1,0],.038,'wood');const sail=new THREE.Shape();sail.moveTo(.03,0);sail.lineTo(.03,1.78);sail.lineTo(1.1,0);sail.closePath();mesh(new THREE.ExtrudeGeometry(sail,{depth:.014,bevelEnabled:false}),'cream',[.12,1.23,0]);rod([.1,1.23,0],[1.28,1.23,0],.025,'wood');}
      else {box([1.52,.59,.79],[-.15,1.32,0],'cream');box([1.69,.065,.93],[-.15,1.65,0],'leaf');for(const x of [-.65,-.19,.27])for(const z of [-.411,.411])box([.29,.28,.018],[x,1.37,z],'blue');}
      if(name==='Hydrofoil')for(const x of [-.9,.9]){rod([x,.4,0],[x,-.24,0],.05,'metal');box([.32,.045,1.8],[x,-.24,0],'leaf');}
      else {for(const x of [-1.26,1.26])rod([x,1.01,-.4],[x,1.3,-.4],.018,'metal');rod([-1.26,1.3,-.4],[1.26,1.3,-.4],.018,'metal');}
      const prop=group([-1.58,.51,0]);blades(prop,.23,3);prop.rotation.y=Math.PI/2;animate=t=>prop.rotation.x=t*9;break;
    }
    case 'Submarine': {
      ball([1.74,.47,.5],[0,.76,0],'gold');box([.64,.48,.45],[-.12,1.33,0],'leaf');tube([[0,1.5,0],[0,2.03,0],[.34,2.03,0]],.04,'metal');
      box([.59,.06,1.4],[.74,.79,0],'clay');box([.48,.64,.06],[-1.24,.99,0],'clay');for(let i=0;i<5;i++)disk(.075,.032,[-.87+i*.39,.81,.48],'blue');
      const prop=group([-1.76,.76,0]);blades(prop,.34,4);prop.rotation.y=Math.PI/2;animate=t=>prop.rotation.x=t*9;break;
    }
    case 'Waterwheel': {
      const rotor=group([0,1.2,0]);for(const z of [-.38,.38]){ring(1.01,.08,[0,0,z],'wood',rotor);for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([0,0,z],[Math.sin(a),Math.cos(a),z],.048,'wood',rotor);}}
      for(let i=0;i<12;i++){const a=i*Math.PI/6;const paddle=box([.32,.12,.91],[Math.sin(a)*.99,Math.cos(a)*.99,0],'clay',rotor);paddle.rotation.z=-a;}
      disk(.14,1.4,[0,1.2,0],'metal');for(const z of [-.67,.67])rod([0,1.2,z],[0,.12,z],.11,'wood');animate=t=>rotor.rotation.z=-t*Math.PI*2;break;
    }
    case 'Piston pump': {
      cylinder(.29,.15,[0,.13,0],'wood');const body=cylinder(.23,1.12,[0,.76,0],'leaf');covers.push(body);
      tube([[.14,1.03,0],[.64,1.03,0],[.64,.84,0]],.08,'leaf');
      const piston=group([0,1.12,0]);cylinder(.045,.86,[0,0,0],'metal',piston);cylinder(.18,.12,[0,-.31,0],'gold',piston);
      const lever=group([0,1.67,0]);rod([-.27,0,0],[1.03,0,0],.058,'wood',lever);rod([.04,1.55,0],[.04,1.25,0],.035,'metal');
      animate=t=>{lever.rotation.z=Math.sin(t*6)*.3;piston.position.y=1.12+Math.sin(t*6)*.16;};break;
    }
    default:shades.dispose();outline.dispose();return null;
  }
  animate?.(.12);
  root.userData.machine=name;
  function dispose(){const geometries=new Set();root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());outline.dispose();shades.dispose();}
  return {root,covers,animate,dispose};
}
