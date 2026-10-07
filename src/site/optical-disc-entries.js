import {cdRomLesson} from './cdrom-lesson.js';
import {createCdromModel} from './cdrom-model.js';
import {cdrLesson} from './cdr-lesson.js';
import {createCdrModel} from './cdr-model.js';
import {dvdrLesson} from './dvdr-lesson.js';
import {createDvdrModel} from './dvdr-model.js';
import {dvdLesson} from './dvd-lesson.js';
import {createDvdModel} from './dvd-model.js';
import {reviewedCdLesson as cdLesson} from './cd-lesson.js';
import {createCdModel} from './cd-model.js';

export const opticalDiscEntries={
 'CD':{machine:'Blu-ray player',createModel:createCdModel,part:'player',isolate:true,view:'front',lesson:cdLesson,intro:cdLesson.simple},
 'DVD':{machine:'Blu-ray player',createModel:createDvdModel,part:'player',isolate:true,view:'front',lesson:dvdLesson,intro:dvdLesson.simple},
 'CD-ROM':{machine:'Blu-ray player',createModel:createCdromModel,part:'player',isolate:true,view:'front',lesson:cdRomLesson,intro:cdRomLesson.simple},
 'CD-R':{machine:'Blu-ray player',createModel:createCdrModel,part:'player',isolate:true,view:'front',lesson:cdrLesson,intro:cdrLesson.simple},
 'DVD-R':{machine:'Blu-ray player',createModel:createDvdrModel,part:'player',isolate:true,view:'front',lesson:dvdrLesson,intro:dvdrLesson.simple},
};
