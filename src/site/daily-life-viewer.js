import {createDailyLifeMachine} from './daily-life-models.js';
import {mountDailyLifeViewer as mountProvidedModel} from './daily-life-viewer-core.js';

export function mountDailyLifeViewer(host,name,providedModel,options) {
 return mountProvidedModel(host,name,providedModel||createDailyLifeMachine(name),options);
}
