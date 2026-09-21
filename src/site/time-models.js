import {createBathroomScaleModel} from './bathroom-scale-model.js';
import {createPlatformScaleModel} from './platform-scale-model.js';
import {createRobervalBalanceModel} from './roberval-balance-model.js';
import {createPendulumClockModel} from './pendulum-clock-model.js';
import {createWatchModel} from './watch-model.js';
import {createLiquidThermometerModel, createSixThermometerModel} from './thermometer-models.js';
import {createQuartzClockModel, createKineticWatchModel} from './quartz-models.js';
import {createWaterClockModel} from './water-clock-model.js';
const names=['Bathroom scale','Platform scale','Roberval balance','Mechanical clock','Mechanical watch','Liquid-in-glass thermometer','Maximum-minimum thermometer','Kinetic quartz watch','Quartz clock','Water clock'];
export function createTimeModel(name){
 if(!names.includes(name))return null;
 if(name==='Bathroom scale')return createBathroomScaleModel();
 if(name==='Platform scale')return createPlatformScaleModel();
 if(name==='Roberval balance')return createRobervalBalanceModel();
 if(name==='Mechanical clock')return createPendulumClockModel();
 if(name==='Mechanical watch')return createWatchModel();
 if(name==='Liquid-in-glass thermometer')return createLiquidThermometerModel();
 if(name==='Maximum-minimum thermometer')return createSixThermometerModel();
 if(name==='Kinetic quartz watch')return createKineticWatchModel();
 if(name==='Quartz clock')return createQuartzClockModel();
 if(name==='Water clock')return createWaterClockModel();
 return null;
}
