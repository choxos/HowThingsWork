// Checks the contract between a lesson and the model it drives. A lesson names
// controls, parts and views that the viewer looks up by key; a name that no
// longer resolves fails silently in the browser, so it is checked here instead.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const families = [
 ['electronic', 'electronicLessons', 'createElectronicModel'],
 ['daily-life', 'dailyLifeLessons', 'createDailyLifeMachine'],
 ['kitchen', 'kitchenLessons', 'createKitchenModel'],
 ['time', 'timeLessons', 'createTimeModel'],
 ['utility', 'utilityLessons', 'createUtilityModel'],
 ['safety', 'safetyLessons', 'createSafetyModel'],
 ['cleaning', 'cleaningLessons', 'createCleaningModel'],
 ['heating', 'heatingLessons', 'createHeatingModel'],
 ['study', 'studyLessons', 'createStudyModel'],
 ['play', 'playLessons', 'createPlayModel'],
];
const {houseComponents} = await import('./house-components.js');
const lessons = {}, factories = [];
for (const [file, dataName, factoryName] of families) {
 Object.assign(lessons, (await import(`./${file}-lessons.js`))[dataName]);
 factories.push((await import(`./${file}-models.js`))[factoryName]);
}
const create = name => {
 for (const factory of factories) { const model = factory(name); if (model) return model; }
 return null;
};

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./catalog-data.js', import.meta.url), 'utf8')
 .replace(/export \{neighborhoodCatalog\};/, '') + ';globalThis.data=neighborhoodCatalog', context);
const catalog = context.data;
const entryNames = new Set(catalog.entries.map(entry => entry.name));
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The viewer resolves a view name against the buttons it renders in
// `.daily-camera`; anything else is a click on nothing.
const views = new Set(['front', 'side', 'back', 'top', 'bottom', 'in', 'out', 'reset']);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

function checkControlValues(where, model, values) {
 const byKey = new Map(model.controls.map(control => [control.key, control]));
 for (const [key, value] of Object.entries(values || {})) {
  const control = byKey.get(key);
  if (!control) { check(false, `${where}: no control "${key}"`); continue; }
  check(Number.isFinite(Number(value)), `${where}: control "${key}" value ${value} is not a number`);
  check(Number(value) >= control.min && Number(value) <= control.max,
   `${where}: control "${key}" value ${value} outside [${control.min}, ${control.max}]`);
  if (control.options) {
   check(control.options.some(option => Number(option.value) === Number(value)),
    `${where}: control "${key}" value ${value} matches no option`);
  }
 }
}

for (const [name, lesson] of Object.entries(lessons)) {
 // A lesson with no model leaves mountDailyLifeViewer throwing and the route blank.
 const model = create(name);
 check(model, `${name}: no model`);
 if (!model) continue;
 const partIds = new Set(model.parts.map(part => part.id));

 for (const [index, experiment] of lesson.tryIt.entries()) {
  const where = `${name}: tryIt[${index}] "${experiment.title}"`;
  checkControlValues(where, model, experiment.values);
  if (experiment.part !== undefined) check(partIds.has(experiment.part), `${where}: no part "${experiment.part}"`);
  if (experiment.view !== undefined) check(views.has(experiment.view), `${where}: no view "${experiment.view}"`);
 }

 // Every parent in the part tree must exist, or the breadcrumb walk stops early.
 for (const part of model.parts) {
  if (part.parentId) check(partIds.has(part.parentId), `${name}: part "${part.id}" has unknown parent "${part.parentId}"`);
  // A part route is rendered as a link; a dead one is a broken navigation.
  if (part.route?.startsWith('#machine/')) {
   const target = part.route.slice(9);
   check([...entryNames].some(entry => slug(entry) === target), `${name}: part "${part.id}" links to missing route ${part.route}`);
  }
 }

 // readings() calls resultPart.available() and reads .id/.context unguarded.
 if (model.resultPart) {
  check(partIds.has(model.resultPart.id), `${name}: resultPart "${model.resultPart.id}" is not a part`);
  check(typeof model.resultPart.available === 'function', `${name}: resultPart has no available()`);
  if (model.resultPart.context !== undefined) check(partIds.has(model.resultPart.context), `${name}: resultPart context "${model.resultPart.context}" is not a part`);
  if (model.resultPart.view !== undefined) check(views.has(model.resultPart.view), `${name}: resultPart view "${model.resultPart.view}" is unknown`);
 }
 for (const id of model.followParts || []) check(partIds.has(id), `${name}: followParts names "${id}", which is not a part`);

 // The quiz answer indexes into the options the lesson renders.
 check(Number.isInteger(lesson.quiz.answer) && lesson.quiz.answer >= 0 && lesson.quiz.answer < lesson.quiz.options.length,
  `${name}: quiz answer ${lesson.quiz.answer} is outside 0..${lesson.quiz.options.length - 1}`);

 // Related names become #machine/ links in "Keep looking closer".
 for (const related of lesson.related || []) check(entryNames.has(related), `${name}: related "${related}" is not a catalog entry`);

 // A model with playback drives the transport buttons.
 if (model.playback) {
  for (const method of ['advance', 'step', 'complete', 'blocked']) {
   check(typeof model.playback[method] === 'function', `${name}: playback has no ${method}()`);
  }
  check(typeof model.playback.stepLabel === 'string' && model.playback.stepLabel, `${name}: playback has no stepLabel`);
 }
 // The transport row is only rendered when the model animates.
 if (model.playback || model.resultPart) check(typeof model.animate === 'function', `${name}: playback or resultPart needs animate()`);

 for (const [index, action] of (model.actions || []).entries()) {
  check(typeof action.run === 'function', `${name}: action[${index}] has no run()`);
  if (action.part !== undefined) check(partIds.has(action.part), `${name}: action[${index}] names part "${action.part}"`);
  if (action.view !== undefined) check(views.has(action.view), `${name}: action[${index}] names view "${action.view}"`);
 }

 // Every control must have the fields the viewer reads when it builds the input.
 for (const control of model.controls) {
  check(Number.isFinite(control.min) && Number.isFinite(control.max) && control.min < control.max,
   `${name}: control "${control.key}" has no usable range`);
  check(Number.isFinite(control.step) && control.step > 0, `${name}: control "${control.key}" has no step`);
  check(control.initial >= control.min && control.initial <= control.max,
   `${name}: control "${control.key}" starts at ${control.initial}, outside its range`);
  check(typeof control.label === 'string' && control.label, `${name}: control "${control.key}" has no label`);
 }
 model.dispose();
}

// A component route reuses another machine's model and selects one part in it.
for (const [name, component] of Object.entries(houseComponents)) {
 const model = create(component.machine);
 check(model, `${name}: machine "${component.machine}" has no model`);
 if (!model) continue;
 const partIds = new Set(model.parts.map(part => part.id));
 check(partIds.has(component.part), `${name}: no part "${component.part}" in ${component.machine}`);
 if (component.view !== undefined) check(views.has(component.view), `${name}: no view "${component.view}"`);
 checkControlValues(name, model, component.values);
 check(entryNames.has(component.machine), `${name}: machine "${component.machine}" is not a catalog entry`);
 if (component.lesson) {
  check(Number.isInteger(component.lesson.quiz.answer) && component.lesson.quiz.answer < component.lesson.quiz.options.length,
   `${name}: component quiz answer is outside its options`);
  for (const [index, experiment] of component.lesson.tryIt.entries()) {
   const where = `${name}: tryIt[${index}] "${experiment.title}"`;
   checkControlValues(where, model, experiment.values);
   if (experiment.part !== undefined) check(partIds.has(experiment.part), `${where}: no part "${experiment.part}"`);
   if (experiment.view !== undefined) check(views.has(experiment.view), `${where}: no view "${experiment.view}"`);
  }
 }
 model.dispose();
}

// Every machine the house links to must resolve to a lesson or a component.
for (const group of catalog.groups.filter(group => group.place === 'home')) {
 for (const name of group.items) {
  check(lessons[name] || houseComponents[name], `${name}: house route has no lesson`);
 }
}

if (failures.length) {
 console.error(`FAIL: ${failures.length} lesson contract problems`);
 for (const failure of failures) console.error(`  ${failure}`);
 process.exit(1);
}
assert.ok(Object.keys(lessons).length > 0);
console.log(`PASS lessons: ${Object.keys(lessons).length} lessons and ${Object.keys(houseComponents).length} components name only controls, parts, views and routes that exist.`);
