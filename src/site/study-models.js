import {createStaplerModel} from './stapler-model.js';
import {createBallpointModel} from './ballpoint-model.js';
import {createFeltTipModel} from './felt-tip-model.js';
import {createDipPenModel} from './dip-pen-model.js';
import {createBluRayPlayerModel} from './blu-ray-player-model.js';
import {createElectronicPaperDisplayModel} from './electronic-paper-model.js';
import {createSmartphoneLearningModel} from './smartphone-model.js';
import {createSpeechModel} from './speech-model.js';
import {createCalculatorModel} from './calculator-model.js';
import {createTftScreenModel} from './tft-screen-model.js';
import {createOledDisplayModel} from './oled-display-model.js';
import {createRemoteControlModel} from './remote-model.js';
export function createStudyModel(name){
 if(name==='Stapler')return createStaplerModel();
 if(name==='Ballpoint pen')return createBallpointModel();
 if(name==='Felt-tip pen')return createFeltTipModel();
 if(name==='Dip pen')return createDipPenModel();
 if(name==='Blu-ray player')return createBluRayPlayerModel();
 if(name==='Electronic paper')return createElectronicPaperDisplayModel();
 if(name==='Smartphone')return createSmartphoneLearningModel();
 if(name==='Speech recognition')return createSpeechModel();
 if(name==='Calculator')return createCalculatorModel();
 if(name==='LCD screen')return createTftScreenModel();
 if(name==='OLED display')return createOledDisplayModel();
 if(name==='Remote control')return createRemoteControlModel();
 return null;
}
