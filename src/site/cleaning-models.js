import {createSpinDryerModel} from './spin-dryer-model.js';
import {createVacuumCleanerModel, createUprightVacuumModel} from './vacuum-models.js';
import {createAerosolCanModel} from './aerosol-model.js';
import {createAirCleanerModel} from './air-cleaner-model.js';
import {createRobotVacuumModel} from './robot-vacuum-model.js';
export function createCleaningModel(name){
 if(!['Spin dryer','Vacuum cleaner','Upright vacuum cleaner','Aerosol spray can','Air cleaner','Robot vacuum cleaner'].includes(name))return null;
 if(name==='Spin dryer')return createSpinDryerModel();
 if(name==='Vacuum cleaner')return createVacuumCleanerModel();
 if(name==='Upright vacuum cleaner')return createUprightVacuumModel();
 if(name==='Aerosol spray can')return createAerosolCanModel();
 if(name==='Air cleaner')return createAirCleanerModel();
 if(name==='Robot vacuum cleaner')return createRobotVacuumModel();

 return null;
}
