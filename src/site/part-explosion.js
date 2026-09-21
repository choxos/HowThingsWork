import * as THREE from 'three';

// Every part keeps its true size, orientation and depth. Related parts occupy
// adjacent blocks in the viewing plane, with a line back to their assembled seat.

/**
 * Lay `cards` out in the order they are given, left to right and wrapping onto a
 * new row once a row passes `target`, so that no two overlap. Each card keeps
 * its own size; only where it stands is decided here. The block comes back
 * centered on zero, with the first row at the top.
 */
function shelf(cards, target, gap) {
  const rows = [];
  let run = [], x = 0, y = 0, tall = 0, width = 0;
  for (const card of cards) {
    const step = card.w + gap;
    if (x && x + step > target) { rows.push({run, y, tall}); y += tall + gap; run = []; x = 0; tall = 0; }
    card.x = x + step / 2; run.push(card); x += step; width = Math.max(width, x); tall = Math.max(tall, card.h);
  }
  rows.push({run, y, tall});
  const height = y + tall;
  for (const {run: members, y: rowY, tall: rowTall} of rows) for (const card of members) card.y = height / 2 - rowY - rowTall / 2;
  for (const card of cards) card.x -= width / 2;
  return {width: Math.max(width, gap), height: Math.max(height, gap)};
}

/** A block of cards packed to roughly its own natural shape. */
function block(cards, gap, aspect = 1.3) {
  const widest = Math.max(...cards.map(c => c.w)) + gap;
  const total = cards.reduce((sum, card) => sum + card.w + gap, 0);
  let best = widest, score = Infinity;
  // Compare shelf widths against the actual frame, avoiding a tall narrow
  // inventory that leaves most of a landscape canvas unused.
  for (let step = 0; step <= 32; step++) {
    const target = widest + (total - widest) * step / 32;
    const packed = shelf(cards, target, gap);
    const fit = Math.max(packed.width / aspect, packed.height);
    if (fit < score) { score = fit; best = target; }
  }
  return shelf(cards, best, gap);
}

export function createPartExplosion(model, camera, aspect = 1, viewport = {width: 760, height: 760 / aspect}) {
  const root = new THREE.Group(), byObject = new Map(model.parts.map(p => [p.object, p])), byId = new Map(model.parts.map(p => [p.id, p]));
  const units = new Map(), orientation = camera.quaternion.clone();
  model.root.updateMatrixWorld(true);
  // Printed diagrams and textured labels belong to their supporting part.
  const illustrated = new Set();
  model.root.traverse(object => {
    if (!object.userData.labelText && !(object.material?.map || Array.isArray(object.material) && object.material.some(material => material.map))) return;
    let owner = object; while (owner && !byObject.has(owner)) owner = owner.parent;
    if (owner) illustrated.add(owner);
  });
  function ancestry(part) { const path = [], seen = new Set(); while (part && !seen.has(part.id)) { path.unshift(part); seen.add(part.id); part = byId.get(part.parentId); } return path; }
  // Authored ray guides and virtual images can stay in the assembled teaching view.
  const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible || p.userData.explosionExcluded || p.scale.x * p.scale.y * p.scale.z === 0) return false; return true; };
  model.root.traverse(source => {
    if (!source.geometry || !visible(source)) return;
    if (source.material && (Array.isArray(source.material) ? source.material : [source.material]).every(material => !material.visible)) return;
    if (source.geometry.drawRange.count === 0 || source.isInstancedMesh && source.count === 0) return;
    let owner = source; while (owner && !byObject.has(owner)) owner = owner.parent;
    const sourcePart = byObject.get(owner);
    for (let ancestor = owner?.parent; ancestor; ancestor = ancestor.parent)
      if (ancestor.userData.explosionRigid && byObject.has(ancestor)) owner = ancestor;
    const part = byObject.get(owner), id = part?.id || '__structure';
    // A physical part can use several drawing meshes. Only an authored assembly
    // separates its direct branches; a bottle or handle must not break apart.
    let piece = owner || source;
    if (!owner || owner.userData.explosionPieces) {
      piece = source;
      const boundary = owner || model.root;
      while (piece.parent && piece.parent !== boundary) piece = piece.parent;
    }
    if (owner?.userData.explosionRigid || illustrated.has(owner)) piece = owner;
    if (!units.has(piece)) {
      const group = new THREE.Group(); group.userData.partId = part?.id; root.add(group);
      units.set(piece, {id, part, source: piece, path: ancestry(part), partIds: new Set(), group, bounds: new THREE.Box3()});
    }
    const unit = units.get(piece), copy = source.clone(false);
    for (const ancestor of ancestry(sourcePart)) unit.partIds.add(ancestor.id);
    // These frozen drawing copies borrow resources. They never rewrite the
    // operating model's hierarchy, transforms, geometry, materials, or state.
    copy.matrixAutoUpdate = false; copy.matrix.copy(source.matrixWorld); copy.visible = true; copy.userData = {partId: sourcePart?.id}; unit.group.add(copy);
    copy.updateMatrixWorld(true);
    if (!copy.isInstancedMesh && Number.isFinite(copy.geometry.drawRange.count)) {
      const {start, count} = copy.geometry.drawRange, position = copy.geometry.attributes.position, index = copy.geometry.index;
      const drawn = new THREE.Box3();
      for (let i = start; i < Math.min(start + count, index?.count ?? position.count); i++)
        drawn.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i) : i));
      unit.bounds.union(drawn.applyMatrix4(copy.matrixWorld));
    } else unit.bounds.union(new THREE.Box3().setFromObject(copy));
  });
  const items = [...units.values()].filter(u => !u.bounds.isEmpty());

  // The sub-assemblies: the shallowest level of the part tree that actually
  // divides this model, skipping the levels every part shares.
  const named = items.filter(u => u.path.length);
  let common = 0;
  while (named.length && named.some(u => u.path.length > common + 1) && named.every(u => u.path[common]?.id === named[0].path[common]?.id)) common++;
  const groups = new Map();
  const assembled = new THREE.Box3();
  for (const unit of items) {
    const category = unit.path.findLast(part => part.object.userData.explosionCategory) || unit.path[common] || unit.part;
    unit.category = category?.id || '__structure';
    if (!groups.has(unit.category)) groups.set(unit.category, {id: unit.category, name: category?.name || 'Structure and supports', items: []});
    groups.get(unit.category).items.push(unit);
    unit.center = unit.bounds.getCenter(new THREE.Vector3());
    unit.size = unit.bounds.getSize(new THREE.Vector3());
    assembled.union(unit.bounds);
  }
  const middle = assembled.getCenter(new THREE.Vector3()), reach = assembled.getSize(new THREE.Vector3());

  // Pack the projected bounds in the initial camera plane. Translating along
  // world axes can leave parts overlapping in an oblique view even when their
  // world-space boxes do not intersect. Depth and all mesh transforms stay real.
  const inverse=orientation.clone().invert();
  const planeMiddle=middle.clone().applyQuaternion(inverse);
  for(const unit of items){
    const bounds=new THREE.Box3();
    for(const x of [unit.bounds.min.x,unit.bounds.max.x])for(const y of [unit.bounds.min.y,unit.bounds.max.y])for(const z of [unit.bounds.min.z,unit.bounds.max.z])bounds.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(inverse));
    unit.planeCenter=unit.center.clone().applyQuaternion(inverse);
    unit.planeSize=bounds.getSize(new THREE.Vector3());
  }
  const span = Math.max(reach.length(), 1e-6);
  const gap = Math.max(span * 0.02, 1e-4);

  let layout = {width: span, height: span};

  function arrange(nextAspect = aspect, nextViewport = viewport) {
    viewport = nextViewport;
    let worldPerPixel = span / Math.min(viewport.width, viewport.height);
    // Reserve the same space occupied by readable DOM headings in the canvas.
    // Refit because labels change the inventory size, which changes its scale.
    for (let pass = 0; pass < 8; pass++) {
    // Inside a sub-assembly its parts take a block of their own, read the way
    // they stand: top to bottom, then left to right. A sub-assembly of twenty
    // parts becomes a small block rather than a column nobody can read.
    const cards = [];
    for (const category of groups.values()) {
      const members = [...category.items].sort((a, b) =>
        (b.planeCenter.y - a.planeCenter.y) || (a.planeCenter.x - b.planeCenter.x) || String(a.id).localeCompare(String(b.id)));
      const inner = members.map(u => ({w: Math.max(u.planeSize.x, gap), h: Math.max(u.planeSize.y, gap), ref: u}));
      const box = block(inner, gap);
      category.inner = new Map(inner.map(c => [c.ref, c]));
      category.across = Math.max(box.width, 90 * worldPerPixel);
      category.headerHeight = (Math.ceil(category.name.length / 14) * 13 + 10) * worldPerPixel;
      category.down = box.height;
      category.lift = box.height / 2 + gap + category.headerHeight / 2;
      category.seat = category.items.reduce((sum, u) => sum + u.planeCenter.x, 0) / category.items.length;
      category.rank = category.items.reduce((sum, u) => sum + u.planeCenter.y, 0) / category.items.length;
      cards.push({w: category.across + gap, h: box.height + category.headerHeight + gap * 3, ref: category});
    }
    // The sub-assemblies themselves take the same treatment across the frame, in
    // the order they already stand in, so the plate ends up the shape of the
    // viewer rather than one long line or one tall column.
    cards.sort((a, b) => b.ref.rank - a.ref.rank || a.ref.seat - b.ref.seat || String(a.ref.id).localeCompare(String(b.ref.id)));
    const plate = block(cards, gap * 2, Math.max(nextAspect, 0.5));
    for (const card of cards) { card.ref.slotX = card.x; card.ref.slotY = card.y - card.ref.headerHeight / 2; card.ref.width = card.ref.across; }
    for (const category of groups.values()) {
      for (const unit of category.items) {
        const own = category.inner.get(unit);
        unit.destination = new THREE.Vector3(planeMiddle.x+category.slotX+own.x,planeMiddle.y+category.slotY+own.y,unit.planeCenter.z).applyQuaternion(orientation);
        unit.travel = unit.destination.clone().sub(unit.center);
      }
    }
    layout = {width: plate.width, height: plate.height, primary: 'x', secondary: 'y', depth: 'z'};
    const fitted = Math.max(plate.width * 1.1 / viewport.width, plate.height * 1.14 / viewport.height);
    if (fitted <= worldPerPixel * 1.01) break;
    worldPerPixel = fitted;
    }
    return layout;
  }
  arrange(aspect);

  // The leader lines: one segment a part, from the seat it left to where it is
  // now. They fade in with the movement and are never drawn over the assembly.
  const leaderGeometry = new THREE.BufferGeometry();
  leaderGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3));
  const leaderMaterial = new THREE.LineBasicMaterial({color: 0x9aa39a, transparent: true, opacity: 0, depthWrite: false});
  const leaders = new THREE.LineSegments(leaderGeometry, leaderMaterial);
  leaders.frustumCulled = false; leaders.renderOrder = -1; root.add(leaders);

  const exploded = new THREE.Box3();
  function update(amount) {
    const eased = amount * amount * (3 - 2 * amount);
    const array = leaderGeometry.attributes.position.array;
    exploded.makeEmpty();
    let i = 0;
    for (const unit of items) {
      unit.group.position.copy(unit.travel).multiplyScalar(eased);
      const at = unit.center.clone().add(unit.group.position);
      array[i++] = unit.center.x; array[i++] = unit.center.y; array[i++] = unit.center.z;
      array[i++] = at.x; array[i++] = at.y; array[i++] = at.z;
      exploded.union(unit.bounds.clone().translate(unit.group.position));
    }
    leaderGeometry.attributes.position.needsUpdate = true;
    leaderMaterial.opacity = 0.5 * Math.min(1, Math.max(0, (eased - 0.06) / 0.24)) * Math.min(1, (1 - eased) / .2);
    leaders.visible = leaderMaterial.opacity > 0.01;
    for (const category of groups.values()) {
      const depth=category.items.reduce((sum,unit)=>sum+unit.planeCenter.z,0)/category.items.length;
      category.heading=new THREE.Vector3(planeMiddle.x+category.slotX,planeMiddle.y+category.slotY+category.lift,depth).applyQuaternion(orientation);
    }
    root.updateMatrixWorld(true);
  }
  update(0);

  function boundsFor(id) { const bounds = new THREE.Box3(); for (const u of items) if (!id || u.partIds.has(id)) bounds.union(u.bounds.clone().translate(u.group.position)); return bounds; }
  return {
    root, items, categories: [...groups.values()], orientation, arrange, update, boundsFor,
    get layout() { return layout; },
    get bounds() { return exploded.clone(); },
    dispose() { root.removeFromParent(); root.traverse(object=>{if(object.isInstancedMesh)object.dispose();}); root.clear(); leaderGeometry.dispose(); leaderMaterial.dispose(); },
  };
}
