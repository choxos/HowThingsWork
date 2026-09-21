import {staplerLesson} from './stapler-lessons.js';
import {ballpointLesson, feltTipLesson, dipPenLesson} from './pens-lessons.js';
import {bluRayLesson} from './optical-lessons.js';
import {electronicPaperLesson} from './epaper-lessons.js';
import {smartphoneLesson} from './phone-lessons.js';
import {speechRecognitionLesson} from './speech-lessons.js';
import {calculatorLesson} from './calculator-lessons.js';
import {lcdScreenLesson} from './lcd-lessons.js';
import {remoteControlLesson} from './remote-lessons.js';
export const studyLessons={
 'Ballpoint pen':ballpointLesson,
 'Felt-tip pen':feltTipLesson,
 'Dip pen':dipPenLesson,
 'Stapler':staplerLesson,
 'Blu-ray player':bluRayLesson,
 'Electronic paper':electronicPaperLesson,
 'Smartphone':smartphoneLesson,
 'LCD screen':lcdScreenLesson,
 'Remote control':remoteControlLesson,
 'Speech recognition':speechRecognitionLesson,
 'Calculator':calculatorLesson,
};

studyLessons['Smartphone'].sources.push({title:'Analog Devices: MEMS accelerometers and gyroscopes',url:'https://www.analog.com/en/resources/technical-articles/accelerometer-and-gyroscopes-sensors-operation-sensing-and-applications.html'});
