import * as THREE from 'three';
import {ROBOT, CLIFF_SENSORS} from './robot-vacuum-room.js';

/** Connected illustrative robot; every moving component has its own local axis. */
export function robotGeometry(kit, system, scale) {
  const p = xyz => xyz.map(v => v * scale), {part} = kit;
  const robot = part('robot', 'Robot vacuum', 'Two independent wheel drives steer the robot. A roller and side brush guide debris into a bin; air continues through a filter and blower. Open the cover to inspect the connected mechanism.', [0, 0, 0], system);
  const structure = part('structure', 'Body and bumper', 'The low body carries the mechanisms. A surrounding bumper backs up the ideal proximity sensing used in this lesson.', [0, 0, 0], robot);
  const chassis = part('chassis', 'Chassis', 'A rigid base supports the wheel axles, cleaning head and electronics.', [0, 0, 0], structure);
  const outline = new THREE.Shape(); outline.absarc(0, 0, .154 * scale, 0, 2 * Math.PI, false);
  const window = (x0, x1, z0, z1) => {const hole = new THREE.Path(); hole.moveTo(x0 * scale, z0 * scale); hole.lineTo(x0 * scale, z1 * scale); hole.lineTo(x1 * scale, z1 * scale); hole.lineTo(x1 * scale, z0 * scale); hole.closePath(); outline.holes.push(hole);};
  window(-.037, .025, -.132, -.098); window(-.037, .025, .098, .132);
  window(.03, .081, -.121, .121); window(-.116, -.04, .031, .065);
  const casterHole = new THREE.Path(); casterHole.absarc(.123 * scale, 0, .017 * scale, 0, 2 * Math.PI, true); outline.holes.push(casterHole);
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, {depth: .006 * scale, bevelEnabled: false, curveSegments: 64}), new THREE.MeshToonMaterial({color: 0xb4c5b0}));
  base.rotation.x = -Math.PI / 2; base.position.y = .025 * scale; chassis.add(base);
  // The shape's second coordinate becomes -Z after rotation; reflect the hole
  // layout so asymmetric openings align with the actual mechanisms.
  base.scale.y = -1;
  for (const [size, at] of [[[.024, .009, .03], [-.012, .0335, -.083]], [[.024, .009, .03], [-.012, .0335, .083]], [[.018, .023, .05], [.095, .0425, -.016]], [[.025, .037, .02], [.008, .0495, .075]]]) kit.box(p(size), p(at), 'metal', chassis);
  const lid = part('lid', 'Top cover', 'The removable cover protects the battery, bin and controller. Use Look inside to reveal them.', [0, 0, 0], structure);
  kit.cylinder(.155 * scale, .063 * scale, p([0, .0625, 0]), 'cream', lid);
  const button = kit.cylinder(.022 * scale, .004 * scale, p([.045, .096, 0]), 'leaf', lid);
  kit.cylinder(.009 * scale, .002 * scale, p([.045, .099, 0]), 'gold', lid);
  kit.covers.push(lid);
  const bumperPart = part('bumper', 'Bumper and proximity sensors', 'The rim protects the body. This idealized proximity cutoff stops the body 10 mm from solid obstacles, then commands reverse and a turn. It is not a physical collision simulation.', [0, 0, 0], structure);
  const bumper = kit.ring(.163 * scale, .007 * scale, p([0, .052, 0]), 'ink', bumperPart); bumper.rotation.x = Math.PI / 2;
  const obstacleLights = [-.6, 0, .6].map(a => kit.sphere(.006 * scale, p([.165 * Math.cos(a), .052, .165 * Math.sin(a)]), 'blue', bumperPart));
  for (const light of obstacleLights) light.material = light.material.clone();

  const drive = part('drive', 'Wheel drives', 'Each geared motor controls one wheel. Equal wheel speeds drive straight; opposite speeds turn in place.', [0, 0, 0], robot);
  const wheels = [-1, 1].map((side, i) => {
    const group = part(i ? 'right-wheel' : 'left-wheel', `${i ? 'Right' : 'Left'} wheel drive`, 'A geared motor drives this wheel. Spoke rotation follows its signed rolling distance, including reverse motion and turns in place.', p([0, ROBOT.wheelRadius, side * ROBOT.wheelBase / 2]), drive);
    const wheel = new THREE.Group(); group.add(wheel);
    kit.cylinder(ROBOT.wheelRadius * scale, .022 * scale, [0, 0, 0], 'ink', wheel).rotation.x = Math.PI / 2;
    kit.cylinder(.019 * scale, .024 * scale, [0, 0, 0], 'gold', wheel).rotation.x = Math.PI / 2;
    for (let n = 0; n < 6; n++) {
      const a = n * Math.PI / 3;
      kit.rod(p([.008 * Math.cos(a), .008 * Math.sin(a), side * .013]), p([.03 * Math.cos(a), .03 * Math.sin(a), side * .013]), .002 * scale, 'metal', wheel);
    }
    kit.rod([0, 0, 0], p([0, 0, -side * .04]), .004 * scale, 'metal', group);
    kit.box(p([.035, .025, .033]), p([-.012, .013, -side * .032]), 'clay', group);
    return {group, wheel};
  });
  const caster = part('caster', 'Swiveling support wheel', 'This freely swiveling front wheel supports the chassis without setting its steering angle. The two driven wheels determine the path.', p([.123, .016, 0]), drive);
  const fork = new THREE.Group(); caster.add(fork);
  kit.sphere(.014 * scale, [0, 0, 0], 'ink', fork);
  kit.rod(p([0, .024, 0]), [0, 0, 0], .004 * scale, 'metal', caster);

  const cleaner = part('cleaner', 'Brushes and suction path', 'Debris enters at the floor opening. The bin holds debris, the filter protects the blower, and filtered air leaves through the rear vent.', [0, 0, 0], robot);
  const rollerPart = part('roller', 'Main cleaning roller', 'This 210 mm wide roller and its floor inlet define the rectangular footprint counted on the floor map. A pass does not imply perfect dirt removal.', p([ROBOT.rollerX, ROBOT.rollerHalfLength, 0]), cleaner);
  const roller = new THREE.Group(); rollerPart.add(roller);
  kit.cylinder(.014 * scale, .21 * scale, [0, 0, 0], 'wood', roller).rotation.x = Math.PI / 2;
  for (let n = 0; n < 8; n++) {
    const a = n * Math.PI / 4;
    kit.rod(p([.021 * Math.cos(a), .021 * Math.sin(a), -.105]), p([.021 * Math.cos(a), .021 * Math.sin(a), .105]), .0015 * scale, 'ink', roller);
  }
  for (const side of [-1, 1]) kit.box(p([.05, .04, .008]), p([0, .003, side * .109]), 'metal', rollerPart);
  const sidePart = part('side-brush', 'Side brush', 'Three flexible arms sweep edge debris inward toward the main head. Side-brush contact alone is not counted as a cleaning-head pass.', p([.112, .007, .087]), cleaner);
  const sideBrush = new THREE.Group(); sidePart.add(sideBrush);
  kit.cylinder(.012 * scale, .006 * scale, [0, 0, 0], 'gold', sideBrush);
  for (let n = 0; n < 3; n++) {
    const a = n * 2 * Math.PI / 3;
    for (let k = -1; k <= 1; k++) kit.rod([0, 0, 0], p([.042 * Math.cos(a + k * .1), -.004, .042 * Math.sin(a + k * .1)]), .0012 * scale, 'ink', sideBrush);
  }
  const duct = part('duct', 'Floor inlet and duct', 'The sealed channel joins the main roller opening to the dust bin. The downstream fan draws air through this path.', [0, 0, 0], cleaner);
  const ductMesh = kit.box(p([.074, .027, .09]), p([-.005, .041, -.025]), 'blue', duct);
  ductMesh.material = ductMesh.material.clone(); Object.assign(ductMesh.material, {transparent: true, opacity: .23, depthWrite: false});
  const bin = part('bin', 'Dust bin', 'Debris remains in this container. The demonstration dots represent collection; their count is not a measurement of dust mass.', [0, 0, 0], cleaner);
  const binMesh = kit.box(p([.095, .055, .073]), p([-.08, .055, -.047]), 'cream', bin);
  binMesh.material = binMesh.material.clone(); Object.assign(binMesh.material, {transparent: true, opacity: .32, depthWrite: false});
  const dust = Array.from({length: 32}, (_, i) => kit.sphere((.0015 + (i % 3) * .0005) * scale, p([-.118 + (i % 8) * .01, .032 + Math.floor(i / 16) * .005, -.073 + Math.floor(i / 8) % 2 * .015]), 'wood', bin));
  const filter = part('filter', 'Pleated filter', 'Air passes through the filter before reaching the blower. Debris dots stop in the bin; the blue air markers continue.', [0, 0, 0], cleaner);
  for (let i = 0; i < 12; i++) kit.box(p([.003, .05, .009]), p([-.124 + i * .008, .055, -.006 + (i % 2) * .004]), 'cream', filter);
  const blowerPart = part('blower', 'Suction blower', 'The electric motor turns a centrifugal impeller. It draws air through the inlet, bin and filter, then sends it through the rear exhaust. This model assigns 20 W to the fan rather than solving airflow.', p([-.078, .055, .047]), cleaner);
  const blowerCase = kit.cylinder(.036 * scale, .029 * scale, [0, 0, 0], 'blue', blowerPart); blowerCase.rotation.x = Math.PI / 2;
  blowerCase.material = blowerCase.material.clone(); Object.assign(blowerCase.material, {transparent: true, opacity: .25, depthWrite: false});
  const blower = new THREE.Group(); blowerPart.add(blower);
  kit.cylinder(.012 * scale, .035 * scale, [0, 0, 0], 'metal', blower).rotation.x = Math.PI / 2;
  for (let i = 0; i < 9; i++) {
    const a = i * 2 * Math.PI / 9;
    const blade = kit.box(p([.019, .003, .022]), p([.023 * Math.cos(a), .023 * Math.sin(a), 0]), 'metal', blower); blade.rotation.z = a + .25;
  }
  const exhaust = part('exhaust', 'Filtered-air exhaust', 'The blower outlet leads to this vent at the rear of the body.', [0, 0, 0], cleaner);
  kit.tube([[-.11, .055, .047], [-.135, .055, .05], [-.156, .055, .05]].map(p), .012 * scale, 'blue', exhaust);
  for (let i = 0; i < 4; i++) kit.box(p([.005, .003, .033]), p([-.16, .044 + i * .007, .05]), 'ink', exhaust);
  const air = part('airflow', 'Airflow markers', 'Blue markers show direction through the connected inlet, bin, filter, blower and exhaust. Animation speed is illustrative, not an air-speed measurement.', [0, 0, 0], cleaner);
  const airCurve = new THREE.CatmullRomCurve3([[.055, .028, 0], [.023, .044, -.025], [-.065, .054, -.045], [-.08, .055, -.01], [-.08, .055, .027], [-.102, .055, .047], [-.161, .055, .05]].map(x => new THREE.Vector3(...p(x))));
  const airDots = Array.from({length: 12}, () => kit.sphere(.0028 * scale, [0, 0, 0], 'blue', air));

  const power = part('power', 'Power and sensing', 'The controller reads sensors, commands the wheel motors and switches cleaning or charging. The battery supplies the mechanism away from its dock.', [0, 0, 0], robot);
  const battery = part('battery', 'Rechargeable battery', 'Assigned capacity: 14.4 V × 2.6 Ah = 37.44 Wh. Energy decreases by power × time; dock charging restores it.', [0, 0, 0], power);
  kit.box(p([.075, .026, .065]), p([.067, .067, -.016]), 'leaf', battery);
  for (const side of [-1, 1]) kit.box(p([.006, .004, .011]), p([.033, .081, -.016 + side * .02]), side > 0 ? 'red' : 'ink', battery);
  const batteryGauge = Array.from({length: 5}, (_, i) => {const mesh = kit.box(p([.008, .002, .022]), p([.043 + i * .012, .081, -.016]), 'gold', battery); mesh.material = mesh.material.clone(); return mesh;});
  const controller = part('controller', 'Controller board', 'A simplified controller follows the selected cleaning strategy. It orders a return when cleaning time ends or the battery reaches its 15% reserve.', [0, 0, 0], power);
  kit.box(p([.064, .004, .044]), p([.008, .07, .069]), 'leaf', controller);
  kit.box(p([.018, .009, .018]), p([.005, .076, .068]), 'ink', controller);
  const wires = part('wiring', 'Motor and battery connections', 'Power and control wires connect the battery, controller, wheel drives and blower. Circuit details are simplified.', [0, 0, 0], power);
  for (const endpoint of [[.034, .079, -.016], [-.012, .05, -.083], [-.012, .05, .083], [-.078, .07, .06]]) {
    kit.tube([[.008, .074, .069], [.025, .085, .045], endpoint].map(p), .0014 * scale, 'red', wires);
  }
  const sensors = part('cliff-sensors', 'Downward floor sensors', 'Eight illustrative infrared sensors around the underside look for reflected light from nearby floor. Missing floor stops the proposed step and triggers retreat. Real sensors can be confused by surface reflectance.', [0, 0, 0], power);
  const sensorMeshes = CLIFF_SENSORS.map(sensor => {
    const mesh = kit.cylinder(.005 * scale, .004 * scale, p([sensor.x, .02, -sensor.y]), 'blue', sensors); mesh.material = mesh.material.clone(); return mesh;
  });
  const receiver = part('dock-receiver', 'Dock beacon receiver', 'The dock emits an infrared guide signal. In this idealized demonstration, the known map gets the robot nearby; the beacon guides its final straight approach.', [0, 0, 0], power);
  kit.cylinder(.011 * scale, .014 * scale, p([-.125, .097, 0]), 'ink', receiver);
  const contacts = part('contacts', 'Charging contacts', 'Two underside contacts meet two pads on the dock. Charging requires contact and dock power; mere proximity is not enough.', [0, 0, 0], power);
  for (const side of [-1, 1]) kit.box(p([.025, .004, .018]), p([-.13, .012, side * .05]), 'gold', contacts);
  for (const category of [structure, drive, cleaner, power]) category.userData.explosionCategory = true;
  return {robot, structure, chassis, base, lid, button, bumperPart, bumper, obstacleLights, drive, wheels, caster, fork, cleaner, rollerPart, roller, sidePart, sideBrush, duct, bin, dust, filter, blowerPart, blower, exhaust, air, airCurve, airDots, power, battery, batteryGauge, controller, wires, sensors, sensorMeshes, receiver, contacts};
}
