import * as THREE from 'three';
import {surface, solidArrow} from './scene-kit.js';
import {RUMBLE_MOTORS} from './games-controller-physics.js';

// Hardware dimensions in millimeters. Force arrows use 15 mm/N, not motion.
export const MOTOR_LAYOUT = Object.freeze([
  Object.freeze({position: [-84, 16, 73], direction: 1}),
  Object.freeze({position: [34, 16, 73], direction: -1}),
]);
export const FORCE_SCALE = 15;

export function controllerFeedback(kit, machine, mm) {
  const point = p => p.map(v => v * mm);
  const group = kit.part('feedback', 'Rumble feedback', 'A command from the game drives two motors. Their off-center weights produce changing forces on mounts attached to the shell. Arrows show force, not shell displacement.', [0, 0, 0], machine);
  group.userData.explosionCategory = true;
  const driver = kit.part('motor-driver', 'Motor driver and wires', 'A driver uses supply power to turn a game command into motor current. The assigned pulse accelerates, holds speed and brakes both motors.', [0, 0, 0], group);
  kit.box(point([9, 1.6, 6]), point([-5, 14.8, 52]), 'ink', driver);
  for (const x of [-8, -5, -2]) kit.rod(point([x, 14.4, 48]), point([x, 14.4, 49]), 0.25 * mm, 'gold', driver);
  kit.tube([[-20, 14.25, 46], [-16, 14.25, 46], [-12, 14.25, 48], [-8, 14.25, 48]].map(point), 0.18 * mm, 'gold', driver);
  const motors = RUMBLE_MOTORS.map((spec, index) => {
    const {position, direction} = MOTOR_LAYOUT[index], name = index ? 'High-frequency motor' : 'Low-frequency motor';
    const motor = kit.part(spec.id, name, 'A shaft in two end bearings turns an eccentric weight. The left motor runs at an assigned 80 Hz and the right at 150 Hz during the steady part of the pulse.', point(position), group);
    const casing = kit.part(`${spec.id}-case`, `${name}: case and mounts`, 'Two shell-mounted straps hold the motor case; end bearings carry its shaft.', [0, 0, 0], motor);
    const can = surface(kit, new THREE.CylinderGeometry(5.5 * mm, 5.5 * mm, 18 * mm, 32, 1, true), 'metal', casing);
    can.rotation.z = Math.PI / 2;
    const bearings = [];
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(), hole = new THREE.Path();
      shape.absarc(0, 0, 5.5, 0, 2 * Math.PI, false);
      hole.absarc(0, 0, 0.85, 0, 2 * Math.PI, true); shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, {depth: 0.8, bevelEnabled: false, curveSegments: 32});
      geometry.translate(0, 0, -0.4); geometry.rotateY(Math.PI / 2); geometry.scale(mm, mm, mm);
      const bearing = surface(kit, geometry, 'leaf', casing); bearing.position.x = side * 8.6 * mm; bearings.push(bearing);
      const strap = kit.ring(6 * mm, 0.5 * mm, point([side * 6, 0, 0]), 'ink', casing); strap.rotation.y = Math.PI / 2;
      kit.box(point([3, 5.5, 3]), point([side * 6, -9.25, 0]), 'ink', casing);
      kit.box(point([5, 2, 14]), point([side * 6, -13, 0]), 'ink', casing);
    }
    const rotor = kit.part(`${spec.id}-weight`, `${name}: eccentric weight`, 'The weight’s center of mass is offset from the shaft. Its steady radial force is mass × offset × angular speed squared.', [0, 0, 0], motor);
    const length = spec.length * 1000, radius = spec.radius * 1000, offset = spec.eccentricity * 1000;
    const shaft = kit.rod(point([-direction * 9.5, 0, 0]), point([direction * (11 + length), 0, 0]), 0.75 * mm, 'metal', rotor);
    // A low-density carrier joins the shaft to the dense cylindrical weight.
    kit.rod(point([direction * 10.5, 0, 0]), point([direction * 10.5, offset, 0]), 0.8 * mm, 'ink', rotor);
    const weight = kit.cylinder(radius * mm, length * mm, point([direction * (11 + length / 2), offset, 0]), 'gold', rotor);
    weight.rotation.z = Math.PI / 2;
    kit.rod(point([direction * 10.5, offset, 0]), point([direction * 11, offset, 0]), 0.8 * mm, 'ink', rotor);
    const arrow = solidArrow(kit, index ? 0xc14f39 : 0x2f6690, motor, 0.55 * mm);
    arrow.position.x = direction * (13 + length) * mm;
    arrow.userData.explosionExcluded = true;
    for (const [i, color] of ['red', 'ink'].entries()) {
      const terminal = [-direction * 9.3, i ? -2 : 2, 0];
      kit.sphere(0.65 * mm, point(terminal), 'gold', casing);
      const [x, y, z] = position;
      kit.tube([[-8 + i * 3, 15, 55], [index ? 14 : -68, 13 + i, 58], [x - direction * 15, 13 + i, 67], [x + terminal[0], y + terminal[1], z]].map(point), 0.45 * mm, color, driver);
    }
    return {motor, casing, can, bearings, rotor, shaft, weight, arrow, spec};
  });
  return {feedback: group, driver, motors, update(states) {
    states.forEach((state, i) => {
      const motor = motors[i]; motor.rotor.rotation.x = state.angle;
      motor.arrow.userData.setLength(state.magnitude * FORCE_SCALE * mm);
      if (state.magnitude > 0) motor.arrow.userData.setDirection(new THREE.Vector3(...state.force));
    });
  }};
}
