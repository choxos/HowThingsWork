/* Invariants every bench has to keep, checked by both throwaway harnesses. */
import * as THREE from 'three';
import type {Mechanism} from './kit.ts';

/**
 * No registered part may be a descendant of another, because the scene shows
 * and hides parts one at a time: isolating the parent would take the child with
 * it, and hiding the parent would hide a part that is supposed to stay. This is
 * the single easiest thing to get wrong in a new bench and the hardest to see.
 */
export function ownershipFaults(mechanism: Mechanism): string[] {
  const faults: string[] = [];
  const entries = Object.entries(mechanism.parts);
  for (const [id, part] of entries) {
    for (const [otherId, other] of entries) {
      if (id === otherId) continue;
      for (let node: THREE.Object3D | null = part.parent; node; node = node.parent) {
        if (node === other) faults.push(`${id} is a descendant of ${otherId}`);
      }
    }
  }
  return faults;
}

/**
 * Nothing may wander outside the space the camera is framed for. The bench
 * declares its own reach; anything further than that leaves the picture partway
 * through the cycle, and a part moved right out of the scene by mistake looks
 * exactly like a part that is simply switched off.
 */
export function strayParts(mechanism: Mechanism, limit: number): string[] {
  const stray: string[] = [];
  const box = new THREE.Box3();
  mechanism.group.updateMatrixWorld(true);
  for (const [id, part] of Object.entries(mechanism.parts)) {
    if (!part.visible) continue;
    box.setFromObject(part);
    if (box.isEmpty()) continue;
    const far = Math.max(box.max.length(), box.min.length());
    if (far > limit) stray.push(`${id} reaches ${far.toFixed(2)}, past the ${limit} the bench is framed for`);
  }
  return stray;
}
