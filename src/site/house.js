import {electronicLessons} from "./electronic-lessons.js";
import {createElectronicModel} from "./electronic-models.js";
import {houseComponents} from "./house-components.js";
import {createDailyLifeMachine} from './daily-life-models.js';
import {playLessons} from './play-lessons.js';
import {createPlayModel} from './play-models.js';
import {cleaningLessons} from './cleaning-lessons.js';
import {heatingLessons} from './heating-lessons.js';
import {studyLessons} from './study-lessons.js';
import {createCleaningModel} from './cleaning-models.js';
import {createHeatingModel} from './heating-models.js';
import {createStudyModel} from './study-models.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {kitchenLessons} from './kitchen-lessons.js';
import {timeLessons} from './time-lessons.js';
import {utilityLessons} from './utility-lessons.js';
import {safetyLessons} from './safety-lessons.js';
import {createTimeModel} from './time-models.js';
import {createUtilityModel} from './utility-models.js';
import {createSafetyModel} from './safety-models.js';
import {createKitchenModel} from './kitchen-models.js';
const allLessons={...electronicLessons,...dailyLifeLessons,...kitchenLessons,...timeLessons,...utilityLessons,...safetyLessons,...cleaningLessons,...heatingLessons,...studyLessons,...playLessons};
export function createHouseModel(name){return createElectronicModel(name)||createDailyLifeMachine(name)||createKitchenModel(name)||createTimeModel(name)||createUtilityModel(name)||createSafetyModel(name)||createCleaningModel(name)||createHeatingModel(name)||createStudyModel(name)||createPlayModel(name);}
import {mountHousePresentation} from './house-presentation.js';
export {slug} from './house-presentation.js';

export function mountHouse(host,route,catalog,options={}) {
 return mountHousePresentation(host,route,catalog,options,{allLessons,houseComponents,createHouseModel});
}
