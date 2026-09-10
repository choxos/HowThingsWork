import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {buildFlying} from './mechanisms/flying.ts';

function segments(model: ReturnType<typeof buildFlying>) {
  return model.parts.flow.children.filter((node): node is THREE.Mesh =>
    node instanceof THREE.Mesh && node.geometry instanceof THREE.BoxGeometry &&
    node.geometry.parameters.height === 0.05);
}

test('airflow segments clear the actual wing and flap over the slider range', () => {
  const model = buildFlying();
  const ray = new THREE.Raycaster();
  for (const variant of ['clean', 'flaps']) {
    for (let value = 0; value <= 25; value += 0.5) {
      model.update({value, variant, elapsed: 0, phase: 0});
      model.group.updateMatrixWorld(true);
      for (const [index, segment] of segments(model).entries()) {
        // Check both visible edges, not only the line's center.
        for (const edge of [-0.025, 0, 0.025]) {
          const a = segment.localToWorld(new THREE.Vector3(-0.5, edge, 0));
          const b = segment.localToWorld(new THREE.Vector3(0.5, edge, 0));
          ray.set(a, b.clone().sub(a).normalize());
          ray.far = a.distanceTo(b);
          assert.equal(ray.intersectObject(model.parts.wing, true).length, 0,
            `${variant} at ${value} degrees: segment ${index} crosses the wing`);
          ray.set(new THREE.Vector3(a.x, a.y, 2), new THREE.Vector3(0, 0, -1));
          ray.far = 2;
          assert.equal(ray.intersectObject(model.parts.wing, true).length, 0,
            `${variant} at ${value} degrees: segment ${index} starts inside the wing`);
        }
      }
    }
  }
});

test('stalled upper airflow visibly separates from the aft wing', () => {
  const model = buildFlying();
  for (const variant of ['clean', 'flaps']) {
    model.update({value: 25, variant, elapsed: 0, phase: 0});
    model.group.updateMatrixWorld(true);
    const aft = segments(model).slice(3 * 44, 4 * 44).find(node => node.position.x > 0.2)!;
    const ray = new THREE.Raycaster(new THREE.Vector3(aft.position.x, 4, 0), new THREE.Vector3(0, -1, 0));
    const surface = ray.intersectObject(model.parts.wing, true)[0];
    assert.ok(surface);
    assert.ok(aft.position.y - surface.point.y > 0.4, `${variant}: upper flow should leave a visible gap after stall`);
  }
});

test('the wing rotates about its quarter chord, aligned with the force arrows', () => {
  const model = buildFlying();
  const body = model.parts.wing.children[0];
  for (const value of [0, 12, 25]) {
    model.update({value, variant: 'flaps', elapsed: 0, phase: 0});
    model.group.updateMatrixWorld(true);
    const quarter = body.localToWorld(new THREE.Vector3(0.75, 0, 0));
    const pivot = model.parts.wing.getWorldPosition(new THREE.Vector3());
    assert.ok(quarter.distanceTo(pivot) < 1e-9);
    assert.ok(Math.abs(model.parts.forces.children[0].position.x - quarter.x) < 1e-9);
  }
});
