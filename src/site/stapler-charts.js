import {lineObject, textLabel} from './scene-kit.js';
import {fixed} from './format.js';

export const STAPLER_CHART = Object.freeze({x: -1.25, y: -.8, w: 2.5, h: 1.6, z: -3});
export const STAPLER_CHART_COLORS = Object.freeze({blade: 0x2f6690, hand: 0x926314, guide: 0x78846c});

export function staplerChartScales(cycle) {
  return {
    travel: Math.max(5, Math.ceil(cycle.pressEnd / 5) * 5),
    force: Math.max(50, Math.ceil(Math.max(cycle.peak, cycle.handPeak) / 50) * 50),
  };
}

/** Preserve the complete force profile, including vertical jumps. No clipping. */
export function staplerChartPoint(travel, force, ranges) {
  const b = STAPLER_CHART;
  return [b.x + travel / ranges.travel * b.w, b.y + force / ranges.force * b.h, b.z];
}

export function createStaplerChart(kit, system) {
  const object = kit.part('chart', 'Force during the press', 'Illustrative blade and hand force against each point’s own travel. The full press is shown, up to any interference stop. Each curve has the same area, the ideal input work. Return and feeding are prescribed motions and are not force predictions.', [0, 0, 0], system);
  object.userData.inspectionOnly = 'chart'; object.userData.explosionExcluded = true;
  const b = STAPLER_CHART, colors = STAPLER_CHART_COLORS;
  const label = (text, x, y, options = {}) => textLabel(object, text, {height: .26, width: 3.1, position: [x, y, b.z], ...options});
  label('Force during the press (N)', 0, 1.48, {height: .30, weight: 'bold'});
  label('Blade', -.65, 1.12, {width: 1.25, color: '#2f6690'});
  label('Hand', .65, 1.12, {width: 1.25, color: '#926314'});
  label('Travel (mm)', 0, -1.30, {height: .24});
  label('Equal areas = equal work', 0, -1.64, {height: .24});
  const yWords = [0, .5, 1].map(f => label('', b.x - .1, b.y + b.h * f, {width: .65, align: 'right', height: .24}));
  const xWords = [0, .5, 1].map(f => label('', b.x + b.w * f, b.y - .19, {width: .55, height: .24}));
  const axes = lineObject(5, colors.guide, object);
  const bladeLine = lineObject(20, colors.blade, object), handLine = lineObject(20, colors.hand, object);
  const bladeCursor = lineObject(5, colors.blade, object), handCursor = lineObject(5, colors.hand, object);
  const fill = (line, points) => {
    const attr = line.geometry.getAttribute('position');
    if (points.length > attr.count) throw new RangeError('Stapler chart capacity exceeded');
    points.forEach((point, i) => attr.setXYZ(i, ...point));
    attr.needsUpdate = true; line.geometry.setDrawRange(0, points.length); line.visible = points.length > 0;
    line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere();
  };
  fill(axes, [[b.x, b.y, b.z], [b.x + b.w, b.y, b.z], [b.x + b.w, b.y + b.h, b.z], [b.x, b.y + b.h, b.z], [b.x, b.y, b.z]]);
  let key = '', ranges;
  function update(plan, state) {
    const next = JSON.stringify(plan.values), cycle = state.cycle;
    if (next !== key) {
      key = next; ranges = staplerChartScales(cycle);
      yWords.forEach((word, i) => word.userData.setText(fixed(ranges.force * i / 2, 0)));
      xWords.forEach((word, i) => word.userData.setText(fixed(ranges.travel * i / 2, ranges.travel % 10 ? 1 : 0)));
      fill(bladeLine, cycle.profile.map(p => staplerChartPoint(p.drop, p.force, ranges)));
      fill(handLine, cycle.profile.map(p => staplerChartPoint(p.drop / plan.ratio, p.force * plan.ratio, ranges)));
    }
    for (const [cursor, travel, force] of [[bladeCursor, state.press.drop, state.press.blade], [handCursor, state.press.handTravel, state.press.hand]]) {
      const [x, y, z] = staplerChartPoint(travel, force, ranges), r = .035;
      fill(cursor, state.forceEvaluated ? [[x - r, y, z], [x, y + r, z], [x + r, y, z], [x, y - r, z], [x - r, y, z]] : []);
    }
    return ranges;
  }
  return {object, axes, bladeLine, handLine, bladeCursor, handCursor, xWords, yWords, update};
}
