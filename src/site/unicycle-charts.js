import * as THREE from 'three';
import {lineObject, textLabel} from './scene-kit.js';
import {RUN} from './unicycle-physics.js';
import {fixed} from './format.js';

const box = () => Object.freeze({x: -1.25, y: -.8, w: 2.5, h: 1.6});
export const CHARTS = Object.freeze({z: -4, every: 1, lean: box(), speed: box(), torque: box()});
export const CHART_COLORS = Object.freeze({truth: 0x374736, sensed: 0x2f6690, goal: 0x926314, cap: 0x9a4937, guide: 0x78846c});
export const chartX = (box, time) => box.x + time / RUN.duration * box.w;
export const chartY = (box, value, range) => box.y + (value - range[0]) / (range[1] - range[0]) * box.h;

/** Fit every simulated sample, including the first sample past the stop angle. */
export function unicycleChartScales(plan) {
  const last = plan.fell === null ? plan.N : Math.min(plan.N, Math.ceil(plan.fell / plan.dt));
  let lean = 0, speedMin = 0, speedMax = plan.values.speed;
  for (let k = 0; k <= last; k++) {
    lean = Math.max(lean, Math.abs(plan.lean[k] * 180 / Math.PI));
    const speed = plan.spin[k] * plan.body.r;
    speedMin = Math.min(speedMin, speed); speedMax = Math.max(speedMax, speed);
  }
  const angle = Math.max(5, Math.ceil(lean / 5) * 5), torque = Math.max(10, Math.ceil(plan.body.cap / 10) * 10);
  return {last, lean: [-angle, angle], speed: [Math.min(-.5, Math.floor(speedMin * 2) / 2), Math.max(.5, Math.ceil(speedMax * 2) / 2)], torque: [-torque, torque]};
}

/** Three inspection views. They are measurements, not separable machine parts. */
export function createUnicycleCharts(kit, system, scale) {
  const css = color => '#' + color.toString(16).padStart(6, '0');
  const point = (x, y) => [x * scale, y * scale, CHARTS.z * scale];
  const fill = (line, points) => {
    const attr = line.geometry.getAttribute('position');
    if (points.length > attr.count) throw new RangeError('Unicycle chart capacity exceeded');
    points.forEach(([x, y], i) => attr.setXYZ(i, x * scale, y * scale, CHARTS.z * scale));
    attr.needsUpdate = true; line.geometry.setDrawRange(0, points.length); line.visible = points.length > 0;
    line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere();
  };
  const specs = [
    ['lean', 'Lean over time', 'Degrees · forward positive', [['Lean', CHART_COLORS.truth], ['Delayed lean', CHART_COLORS.sensed]], 'Actual lean and the delayed lean used by the assigned controller. The entire planned run is shown, including times after the cursor; the vertical scale fits every sample.'],
    ['speed', 'Speed over time', 'Meters per second · forward positive', [['Speed', CHART_COLORS.truth], ['Wanted', CHART_COLORS.goal]], 'Wheel speed and its requested value. The scale fits backward motion and forward overshoot without clipping.'],
    ['torque', 'Pedal torque over time', 'Newton meters · forward positive', [['Torque', CHART_COLORS.truth], ['Push limit', CHART_COLORS.cap]], 'Pedal torque and the symmetric assigned torque limit. Both the full curve and the limit remain inside the chart.'],
  ];
  const charts = Object.fromEntries(specs.map(([id, name, unit, legends, description]) => {
    const object = kit.part(id, name, description, [0, 0, 0], system);
    object.userData.inspectionOnly = id; object.userData.explosionExcluded = true;
    const label = (text, x, y, options = {}) => textLabel(object, text, {height: .26 * scale, width: 3.1 * scale, position: point(x, y), ...options});
    label(name, 0, 1.48, {height: .30 * scale, weight: 'bold'});
    legends.forEach(([text, color], i) => label(text, i ? .65 : -.65, 1.12, {width: 1.25 * scale, color: css(color)}));
    label(unit, 0, -1.30, {height: .24 * scale});
    label('Time (s) · full run · cursor: now', 0, -1.64, {height: .24 * scale});
    const b = CHARTS[id], axes = lineObject(5, CHART_COLORS.guide, object);
    fill(axes, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x, b.y]]);
    const yWords = [0, .5, 1].map(f => label('', b.x - .1, b.y + b.h * f, {width: .65 * scale, align: 'right', height: .24 * scale}));
    for (const time of [0, 5, 10]) label(String(time), chartX(b, time), b.y - .19, {width: .5 * scale, height: .24 * scale});
    const line = lineObject(Math.round(RUN.duration / RUN.step) + 1, CHART_COLORS.truth, object);
    const second = id === 'torque'
      ? new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)), new THREE.LineBasicMaterial({color: legends[1][1]}))
      : lineObject(id === 'lean' ? Math.round(RUN.duration / RUN.step) + 1 : 2, legends[1][1], object);
    if (id === 'torque') object.add(second);
    const zero = lineObject(2, CHART_COLORS.guide, object), cursor = lineObject(2, CHART_COLORS.guide, object);
    return [id, {object, line, second, zero, cursor, yWords, axes}];
  }));
  let key = '', ranges;
  function update(plan, time) {
    const next = JSON.stringify(plan.values);
    if (next !== key) {
      key = next; ranges = unicycleChartScales(plan);
      for (const [id, chart] of Object.entries(charts)) {
        const b = CHARTS[id], range = ranges[id], y = value => chartY(b, value, range);
        chart.yWords.forEach((word, i) => word.userData.setText(fixed(range[0] + (range[1] - range[0]) * i / 2, id === 'speed' ? 2 : 0)));
        fill(chart.zero, [[b.x, y(0)], [b.x + b.w, y(0)]]);
        const value = k => id === 'lean' ? plan.lean[k] * 180 / Math.PI : id === 'speed' ? plan.spin[k] * plan.body.r : plan.torque[k];
        fill(chart.line, Array.from({length: ranges.last + 1}, (_, k) => [chartX(b, k * plan.dt), y(value(k))]));
        if (id === 'lean') fill(chart.second, plan.values.rider === 1 ? [] : Array.from({length: ranges.last + 1}, (_, k) => [chartX(b, k * plan.dt), y(k >= plan.lag ? plan.lean[k - plan.lag] * 180 / Math.PI : 0)]));
        else if (id === 'speed') fill(chart.second, [[b.x, y(plan.values.speed)], [b.x + b.w, y(plan.values.speed)]]);
        else fill(chart.second, [[b.x, y(plan.body.cap)], [b.x + b.w, y(plan.body.cap)], [b.x, y(-plan.body.cap)], [b.x + b.w, y(-plan.body.cap)]]);
      }
    }
    for (const [id, chart] of Object.entries(charts)) {
      const b = CHARTS[id], x = chartX(b, time);
      fill(chart.cursor, [[x, b.y], [x, b.y + b.h]]);
    }
    return ranges;
  }
  return {charts, update};
}
