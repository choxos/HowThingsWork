const TAU = 2 * Math.PI;
export const WATCH_HAIRSPRING = Object.freeze({
  inner: 0.8, outer: 3.2, height: 0.12, thickness: 0.03, terminal: 2,
  stud: Math.PI / 2, index: 0.0002, pitch: 0.04, segments: 1536,
});
export const WATCH_MAINSPRING = Object.freeze({
  inner: 1.2, outer: 5, height: 1.2, thickness: 0.14, length: 220,
  freeTurns: 8.5, windingTurns: 5.5, pitch: 0.16, segments: 3072, modulus: 200e9,
});

function spiralRadii(inner, outer, turns, pitch, segments, shape) {
  const radii = new Float64Array(segments + 1), span = outer - inner - pitch * turns;
  const divisor = Math.expm1(shape), terminalSpan = Math.min(0.02, 1 / (8 * turns));
  for (let i = 0; i <= segments; i++) {
    let s = i / segments;
    if (s < terminalSpan) {
      const u = s / terminalSpan;
      s = terminalSpan * (2 * u * u - u ** 3);
    } else if (s > 1 - terminalSpan) {
      const u = (s - 1 + terminalSpan) / terminalSpan;
      s = 1 - terminalSpan + terminalSpan * (u + u * u - u ** 3);
    }
    const fraction = Math.abs(shape) < 1e-8 ? s : Math.expm1(shape * s) / divisor;
    radii[i] = inner + pitch * turns * s + span * fraction;
  }
  return radii;
}

function polarPolylineLength(radii, turns) {
  const sine = Math.sin(Math.PI * turns / (radii.length - 1));
  let length = 0;
  for (let i = 1; i < radii.length; i++) {
    length += Math.sqrt((radii[i] - radii[i - 1]) ** 2 + 4 * radii[i] * radii[i - 1] * sine * sine);
  }
  return length;
}

const previousSpiralShapes = new Map();
export function watchSpiral({inner, outer, turns, pitch, segments, length, outerAngle}) {
  if (![inner, outer, turns, pitch, length, outerAngle].every(Number.isFinite)
    || inner <= 0 || outer <= inner || turns <= 0 || pitch <= 0 || length <= 0
    || pitch * turns >= outer - inner || !Number.isInteger(segments) || segments < turns * 64) {
    throw new RangeError('Invalid watch spiral dimensions');
  }
  const key = [inner, outer, pitch, segments, length].join('/');
  let low = -32, high = 32, shape = previousSpiralShapes.get(key) ?? 0, radii;
  const at = k => spiralRadii(inner, outer, turns, pitch, segments, k);
  if (polarPolylineLength(at(low), turns) < length || polarPolylineLength(at(high), turns) > length) {
    throw new RangeError('Spring length does not fit the declared winding and coil spacing');
  }
  for (let i = 0; i < 45; i++) {
    radii = at(shape);
    const measured = polarPolylineLength(radii, turns);
    if (Math.abs(measured - length) < 1e-8) break;
    if (measured > length) low = shape;
    else high = shape;
    const delta = 1e-3;
    const derivative = (polarPolylineLength(at(shape + delta), turns) - polarPolylineLength(at(shape - delta), turns)) / (2 * delta);
    const next = shape - (measured - length) / derivative;
    shape = Number.isFinite(next) && next > low && next < high ? next : (low + high) / 2;
  }
  if (Math.abs(polarPolylineLength(radii, turns) - length) > 1e-8) throw new RangeError('Watch spring length solver did not converge');
  if (previousSpiralShapes.size >= 32 && !previousSpiralShapes.has(key)) previousSpiralShapes.delete(previousSpiralShapes.keys().next().value);
  previousSpiralShapes.set(key, shape);
  const points = Array.from(radii, (radius, i) => {
    const angle = outerAngle - TAU * turns * (1 - i / segments);
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
  return {points, turns, shape, length: polarPolylineLength(radii, turns), radii};
}

const neutralTurns = new Map();
function neutralHairspringTurns(length) {
  if (!neutralTurns.has(length)) {
    const h = WATCH_HAIRSPRING;
    let low = 1, high = 12;
    for (let i = 0; i < 50; i++) {
      const middle = (low + high) / 2;
      const radii = spiralRadii(h.inner, h.outer, middle, h.pitch, h.segments, 0);
      if (polarPolylineLength(radii, middle) > length) high = middle;
      else low = middle;
    }
    neutralTurns.set(length, (low + high) / 2);
  }
  return neutralTurns.get(length);
}

export function watchHairspring({angle = 0, index = 0, growth = 1, length}) {
  if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(index) || Math.abs(index) > 5
    || !Number.isFinite(growth) || growth <= 0 || !Number.isFinite(angle)) throw new RangeError('Invalid watch hairspring state');
  const h = WATCH_HAIRSPRING, workingLength = length * (1 - h.index * index);
  const terminalLength = h.terminal + length - workingLength;
  const outerAngle = h.stud - terminalLength / h.outer;
  const neutralOuter = h.stud - h.terminal / h.outer;
  const innerNeutral = neutralOuter - TAU * neutralHairspringTurns(length);
  const turns = (outerAngle - innerNeutral - angle) / TAU;
  const coil = watchSpiral({inner: h.inner, outer: h.outer, turns, pitch: h.pitch, segments: h.segments, length: workingLength, outerAngle});
  const terminal = Array.from({length: 65}, (_, i) => {
    const a = outerAngle + (h.stud - outerAngle) * i / 64;
    return [h.outer * Math.cos(a) * growth, h.outer * Math.sin(a) * growth];
  });
  return {
    ...coil, points: coil.points.map(p => p.map(v => v * growth)), terminal,
    length: coil.length * growth, workingLength: workingLength * growth,
    terminalLength: terminalLength * growth, totalLength: (length + h.terminal) * growth,
    innerAngle: innerNeutral + angle, outerAngle, growth,
  };
}

export function watchMainspring(remainingTurns) {
  const m = WATCH_MAINSPRING;
  if (!Number.isFinite(remainingTurns) || remainingTurns < 0 || remainingTurns > m.windingTurns + 1e-4) throw new RangeError('Invalid mainspring winding');
  const turns = m.freeTurns + remainingTurns, angle = TAU * (remainingTurns - m.windingTurns);
  return {...watchSpiral({...m, turns, outerAngle: angle}), barrelAngle: angle, remainingTurns};
}
