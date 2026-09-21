import {createStaplerModel} from './stapler-model.js';
import {createBallpointModel} from './ballpoint-model.js';
import {createFeltTipModel} from './felt-tip-model.js';
import {createDipPenModel} from './dip-pen-model.js';
import {createBluRayModel} from './blu-ray-model.js';
import {createElectronicPaperModel} from './epaper-model.js';
import {createSmartphoneModel} from './phone-model.js';
import {createSpeechModel} from './speech-model.js';
import {createCalculatorModel} from './calculator-model.js';
import {createLcdScreenModel} from './lcd-screen-model.js';
import {createRemoteControlModel} from './remote-model.js';
export function createStudyModel(name){
 if(name==='Stapler')return createStaplerModel();
 if(name==='Ballpoint pen')return createBallpointModel();
 if(name==='Felt-tip pen')return createFeltTipModel();
 if(name==='Dip pen')return createDipPenModel();
 if(name==='Blu-ray player')return createBluRayModel();
 if(name==='Electronic paper')return createElectronicPaperModel();
 if(name==='Smartphone')return createSmartphoneModel();
 if(name==='Speech recognition')return createSpeechModel();
 if(name==='Calculator')return createCalculatorModel();
 if(name==='LCD screen')return createLcdScreenModel();
 if(name==='Remote control')return createRemoteControlModel();
 return null;
}
