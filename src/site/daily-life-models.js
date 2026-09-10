import {createDCMotorModel} from './dc-motor-model.js';
import {createElectromagnetModel} from './electromagnet-model.js';
import {createBellModel} from './bell-model.js';
import {createHornModel} from './horn-model.js';
import {createRatchetModel} from './ratchet-model.js';
import {createWindowShadeModel} from './window-shade-model.js';
import {createTweezersModel} from './tweezers-model.js';
import {createClipperModel} from './clipper-model.js';
import {createCylinderModel} from './cylinder-model.js';
import {createLeverModel} from './lever-model.js';
import {createZipperModel} from './zipper-model.js';

export function createDailyLifeMachine(name) {
  if(name==='Direct-current motor')return createDCMotorModel();
  if(name==='Electromagnet')return createElectromagnetModel();
  if(name==='Cylinder lock')return createCylinderModel();
  if(name==='Keys')return createCylinderModel({editableKey:true});
  if(name==='Lever lock')return createLeverModel();
  if(name==='Zipper')return createZipperModel();
  if(name==='Nail clippers')return createClipperModel();
  if(name==='Tweezers')return createTweezersModel();
  if(name==='Window shade')return createWindowShadeModel();
  if(name==='Ratchet')return createRatchetModel();
  if(name==='Electric bell')return createBellModel();
  if(name==='Electric horn')return createHornModel();
  return null;
}
