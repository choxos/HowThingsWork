import {createGasBoilerModel} from './boiler-model.js';
import {createAirConditionerModel} from './aircon-model.js';
import {createElectricHeatingModel} from './electric-heating-model.js';
import {createElectricKettleModel} from './electric-kettle-model.js';
import {createHairDryerModel} from './hair-dryer-model.js';
import {createBimetalThermostatModel} from './bimetal-thermostat-model.js';
import {createRodThermostatModel} from './rod-thermostat-model.js';
import {createWaxThermostatModel} from './wax-thermostat-model.js';
export function createHeatingModel(name){
 if(name==='Gas boiler')return createGasBoilerModel();
 if(name==='Air conditioner')return createAirConditionerModel();
 if(name==='Electric heating')return createElectricHeatingModel();
 if(name==='Electric kettle')return createElectricKettleModel();
 if(name==='Hair dryer')return createHairDryerModel();
 if(name==='Bimetal thermostat')return createBimetalThermostatModel();
 if(name==='Rod thermostat')return createRodThermostatModel();
 if(name==='Wax thermostat')return createWaxThermostatModel();
 return null;
}
