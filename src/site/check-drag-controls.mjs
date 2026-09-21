import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bindObjectDragging} from './machine-viewer.js';
const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,20);
camera.position.z=10;camera.lookAt(0,0,0);camera.updateProjectionMatrix();
const assembled=new THREE.Group(),separated=new THREE.Group();
const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial();
assembled.add(new THREE.Mesh(geometry,material));
const moved=new THREE.Mesh(geometry,material);moved.position.x=2;separated.add(moved);
let visibleRoot=assembled,down;
const canvas={addEventListener(type,handler){assert.equal(type,'pointerdown');down=handler;},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}};
const controls={mouseButtons:{},touches:{}};
bindObjectDragging(canvas,camera,()=>visibleRoot,controls);
function check(x,onObject){
 down({clientX:x,clientY:50,ctrlKey:false,metaKey:false,shiftKey:false});
 assert.equal(controls.mouseButtons.LEFT,onObject?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE);
 assert.equal(controls.touches.ONE,onObject?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE);
}
check(50,true);check(95,false);
visibleRoot=separated;check(50,false);check(75,true);check(95,false);
visibleRoot=assembled;check(75,false);check(50,true);check(95,false);
geometry.dispose();material.dispose();
console.log('PASS mouse and one-finger drag: visible parts pan, empty space rotates, before/during/after separation.');
