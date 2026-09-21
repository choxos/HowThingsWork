import {writeFileSync} from 'node:fs';
import {neighborhoodCatalog} from '../src/site/published-catalog.js';
import {houseComponents} from '../src/site/house-components.js';

const families = [['electronic','createElectronicModel'],['daily-life','createDailyLifeMachine'],['kitchen','createKitchenModel'],['time','createTimeModel'],['utility','createUtilityModel'],['safety','createSafetyModel'],['cleaning','createCleaningModel'],['heating','createHeatingModel'],['study','createStudyModel'],['play','createPlayModel']];
const factories = await Promise.all(families.map(async ([file, name]) => (await import(`../src/site/${file}-models.js`))[name]));
const catalogParts = {};
for (const entry of neighborhoodCatalog.entries) {
  const component = houseComponents[entry.name];
  let model = component?.createModel?.();
  for (const factory of factories) {
    if (model) break;
    model = factory(component?.machine || entry.name);
  }
  if (!model) throw Error(`No model for ${entry.name}`);
  try {
    if (component?.initialState) model.reset?.(component.initialState);
    model.update(component?.values || {});
    const visibleParts = model.parts.filter(part => {
      let visible = false;
      part.object.traverse(object => {
        if (!object.geometry?.attributes.position?.count || object.geometry.drawRange.count === 0 || object.isInstancedMesh && !object.count) return;
        if (object.material && (Array.isArray(object.material) ? object.material : [object.material]).every(material => !material.visible)) return;
        for (let node = object; node; node = node.parent) {
          if (!node.visible || node.scale.x * node.scale.y * node.scale.z === 0 || model.covers.includes(node)) return;
        }
        visible = true;
      });
      return visible;
    });
    const visibleIds = new Set(visibleParts.map(part => part.id));
    let major = visibleParts.filter(part => !visibleIds.has(part.parentId));
    while (major.length === 1) {
      const children = visibleParts.filter(part => part.parentId === major[0].id);
      if (!children.length) break;
      major = children;
    }
    catalogParts[entry.id] = (model.catalogParts || major).map(part => ({id: part.id, name: part.name, ...(part.parentId ? {parentId: part.parentId} : {})}));
  } finally { model.dispose(); }
}
writeFileSync(new URL('../src/site/catalog-parts.json', import.meta.url), JSON.stringify(catalogParts, null, 2) + '\n');
console.log(`Catalog parts: ${Object.keys(catalogParts).length} published lessons, ${Object.values(catalogParts).reduce((n, parts) => n + parts.length, 0)} inspectable parts.`);
