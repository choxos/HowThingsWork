import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';
import {houseModel,reading as r} from './house-model-kit.js';
import {createFaucetModel} from './faucet-model.js';
import {createWaterMeterModel} from './water-meter-model.js';
import {createToiletTankModel} from './toilet-tank-model.js';
import {createDoorCloserModel} from './door-closer-model.js';
import {createWashingMachineModel} from './washing-machine-model.js';
const TAU=Math.PI*2;
export function createUtilityModel(name){
 if(name==='Sewing machine')return createSewingModel();
 if(name==='Faucet')return createFaucetModel();
 if(name==='Water meter')return createWaterMeterModel();
 if(name==='Toilet tank')return createToiletTankModel();
 if(name==='Door closer')return createDoorCloserModel();
 if(!['Faucet','Toilet tank','Water meter','Sewing machine','Washing machine'].includes(name))return null;
 if(name==='Washing machine')return createWashingMachineModel();
 const m=houseModel(name),{root,part,box,cylinder,disk,sphere,ring,rod,tube,gear,control,finish,covers}=m;
 return null;
}
