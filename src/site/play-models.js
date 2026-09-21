import {createFrictionDriveToyModel} from './friction-drive-toy-model.js';
import {createGamesControllerModel} from './games-controller-model.js';
import {createVrHeadsetModel} from './vr-headset-model.js';
import {createUnicycleModel} from './unicycle-model.js';
export function createPlayModel(name){
 if(name==='Friction-drive toy')return createFrictionDriveToyModel();
 if(name==='Games controller')return createGamesControllerModel();
 if(name==='Virtual reality headset')return createVrHeadsetModel();
 if(name==='Unicycle')return createUnicycleModel();
 return null;
}
