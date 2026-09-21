import {createVoltageMultiplierModel} from './voltage-multiplier-model.js';

export function createElectronicModel(name){
 if(name==='Voltage multiplier')return createVoltageMultiplierModel();
 return null;
}
