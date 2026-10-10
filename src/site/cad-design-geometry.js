/** A polygon in the X/Z plane, in millimeters; its first edge faces +X. */
export function designRing(radius, facets) {
  return Array.from({length: facets}, (_, i) => {
    const a = (2 * i - 1) * Math.PI / facets;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
}

/** Indexed, outward-facing boundary of an extrusion with an optional blind pocket. */
export function cupSurface(radius, inner, facets, height, depth) {
  const outer = designRing(radius, facets), hole = designRing(inner, facets);
  const vertices = [...outer.map(([x, z]) => [x, 0, z]), ...outer.map(([x, z]) => [x, height, z])];
  const faces = [];
  for (let i = 0; i < facets; i++) {
    const j = (i + 1) % facets;
    faces.push([i, facets + i, j], [j, facets + i, facets + j]);
  }
  for (let i = 1; i < facets - 1; i++) faces.push([0, i, i + 1]);
  if (depth > 0) {
    vertices.push(...hole.map(([x, z]) => [x, height - depth, z]), ...hole.map(([x, z]) => [x, height, z]));
    for (let i = 0; i < facets; i++) {
      const j = (i + 1) % facets, a = 2 * facets + i, b = 2 * facets + j, c = 3 * facets + j, d = 3 * facets + i;
      faces.push([a, b, d], [b, c, d], [facets + i, d, facets + j], [facets + j, d, c]);
    }
    for (let i = 1; i < facets - 1; i++) faces.push([2 * facets, 2 * facets + i + 1, 2 * facets + i]);
  } else {
    for (let i = 1; i < facets - 1; i++) faces.push([facets, facets + i + 1, facets + i]);
  }
  return {vertices, faces};
}

const pathLength = points => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);

// Convex half-plane intersection with a horizontal line in the infill's rotated frame.
function lineInterval(apothem, facets, y, angle) {
  let low = -Infinity, high = Infinity;
  for (let k = 0; k < facets; k++) {
    const a = 2 * k * Math.PI / facets - angle, nx = Math.cos(a), ny = Math.sin(a), bound = apothem - ny * y;
    if (Math.abs(nx) < 1e-12) { if (bound < -1e-10) return null; }
    else if (nx > 0) high = Math.min(high, bound / nx);
    else low = Math.max(low, bound / nx);
  }
  return high - low > 1e-9 ? [low, high] : null;
}

/** Fixed-width teaching paths, offset perpendicular to edges and clipped to material. */
export function designLayerPaths({radius, inner, facets, width, perimeters, infill}, height, floor = false) {
  const cosine = Math.cos(Math.PI / facets), outside = radius * cosine, inside = floor ? 0 : inner * cosine;
  const overlap = height * (1 - Math.PI / 4), spacing = width - overlap, thickness = outside - inside;
  const fits = Math.max(0, Math.floor((thickness - width) / spacing + 1 + 1e-9));
  const pairs = floor ? Math.min(perimeters, fits) : Math.min(perimeters, Math.floor(fits / 2));
  const paths = [], offsets = [];
  const addLoop = apothem => {
    const points = designRing(apothem / cosine, facets);
    points.push([...points[0]]);
    paths.push({kind: 'perimeter', points, length: pathLength(points), apothem});
    offsets.push(apothem);
  };
  if (!floor && pairs === 0 && fits > 0) addLoop((outside + inside) / 2);
  else for (let k = 0; k < pairs; k++) {
    const offset = width / 2 + k * spacing;
    addLoop(outside - offset);
    if (!floor) addLoop(inside + offset);
  }
  const shell = pairs ? width + (pairs - 1) * spacing : 0;
  // Centerlines stay half a bead inside the leftover region; tiny corner gaps are not filled.
  const fillOuter = outside - shell - width / 2, fillInner = floor ? 0 : inside + shell + width / 2;
  const fillDensity = floor ? 100 : infill, angle = Math.PI / 4;
  if ((floor || pairs > 0) && fillDensity > 0 && fillOuter > fillInner + 1e-9) {
    const pitch = spacing * 100 / fillDensity, reach = fillOuter / cosine;
    const unrotate = (x, y) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
    for (let k = Math.ceil(-reach / pitch); k <= Math.floor(reach / pitch); k++) {
      const y = k * pitch, outer = lineInterval(fillOuter, facets, y, angle);
      if (!outer) continue;
      const hole = floor ? null : lineInterval(fillInner, facets, y, angle);
      const spans = hole ? [[outer[0], hole[0]], [hole[1], outer[1]]] : [outer];
      for (const [a, b] of spans) if (b - a > 1e-9) {
        const points = [unrotate(a, y), unrotate(b, y)];
        paths.push({kind: 'infill', points, length: pathLength(points)});
      }
    }
  }
  const wallPath = paths.filter(p => p.kind === 'perimeter').reduce((sum, p) => sum + p.length, 0);
  const fillPath = paths.filter(p => p.kind === 'infill').reduce((sum, p) => sum + p.length, 0);
  const loopCount = offsets.length, requested = perimeters * (floor ? 1 : 2);
  return {paths, floor, height, spacing, overlap, thickness, fits, pairs, loopCount, requested,
    reduced: loopCount < requested, shell, gap: Math.max(0, thickness - 2 * shell),
    wallPath, fillPath, length: wallPath + fillPath, bead: width * height - height * overlap};
}

/** Short boundary layers preserve the exact pocket floor and overall height. */
export function designSlices(values) {
  const slices = [], cache = new Map();
  for (const [bottom, top, floor] of [[0, values.wall, true], [values.wall, values.height, false]]) {
    const count = Math.ceil((top - bottom) / values.layer - 1e-9);
    for (let i = 0; i < count; i++) {
      const z0 = bottom + i * values.layer, z1 = Math.min(top, bottom + (i + 1) * values.layer);
      const height = Number((z1 - z0).toPrecision(12)), key = `${floor}:${height}`;
      if (!cache.has(key)) cache.set(key, designLayerPaths({...values, inner: values.radius - values.wall}, height, floor));
      slices.push({bottom: z0, top: z1, middle: (z0 + z1) / 2, ...cache.get(key)});
    }
  }
  return slices;
}
