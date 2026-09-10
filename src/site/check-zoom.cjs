const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(`${__dirname}/zoom.js`, 'utf8').replace(/^import .*;$/gm, '').replace(/^export .*;$/gm, ''), context);
assert.equal(context.zoomBlend(0, .35, .9), 0);
assert.equal(context.zoomBlend(1, .35, .9), 1);
assert.ok(Math.abs(context.zoomBlend(.625, .35, .9) - .5) < 1e-12);
assert.equal(context.zoomBlend(1, 1.35, 1.9), 0);
assert.equal(context.zoomBlend(2, 1.35, 1.9), 1);
const house = {id:'house', x:22, y:28}, river = {id:'river', x:83, y:65};
assert.equal(context.nearestZoomTarget([house, river], 25, 30), house);
assert.equal(context.nearestZoomTarget([house, river], 80, 70), river);
console.log('Zoom fade boundaries and spatial target selection passed.');

(async () => {
  const {createMachine} = await import('./machine-models.js');
  const source = fs.readFileSync(`${__dirname}/catalog-data.js`, 'utf8').replace(/export \{neighborhoodCatalog\};/, '');
  const catalog = vm.runInNewContext(source + '\nneighborhoodCatalog');
  assert.ok(!/the book|way things work|macaulay|ardley|epub|sourceFiles|pageNumbers|glossary|"pages"|"source"/i.test(source));
  const names = catalog.places.flatMap(place => place.featured);
  assert.equal(new Set(names).size, 36);
  for (const name of names) {
    const model = createMachine(name);
    assert.ok(model, `${name} needs a 3D preview`);
    for (const phase of [0, .25, .5, 1]) {
      model.animate?.(phase);
      model.root.updateMatrixWorld(true);
      model.root.traverse(object => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${name}: invalid transform`);
        const positions = object.geometry?.getAttribute('position');
        if (positions) assert.ok(positions.array.every(Number.isFinite), `${name}: invalid geometry`);
      });
    }
    model.dispose();
  }
  assert.equal(createMachine('Unmodeled inventory entry'), null);
  console.log('All 36 cartoon models and their movement ranges passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
