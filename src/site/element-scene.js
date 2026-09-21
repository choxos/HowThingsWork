import * as THREE from 'three';
import {fillLine} from './scene-kit.js';
import {DRAPER, NIKROTHAL} from './element-physics.js';

// ---------------------------------------------------------------------------
// The pieces the three resistance heaters draw the same way: flat unlit panels
// measured in millimeters, the coiled element itself, and the color a piece of
// wire takes as it warms.
//
// Each model states its own scale; nothing here assumes one.
// ---------------------------------------------------------------------------

/**
 * Flat drawing on one plane, at `scale` scene units to the millimeter. Every
 * mesh is unlit, so what the reader sees is the color the model set and nothing
 * the lighting decided.
 */
export function panel(scale) {
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const millimeters = (mesh, x0, x1, y0, y1, z = 0) => rect(mesh, x0 * scale, x1 * scale, y0 * scale, y1 * scale, z);
  const outline = (line, x0, x1, y0, y1, z, unit = scale) => fillLine(line, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => [x * unit, y * unit, z]));
  const circlePoints = (cx, cy, radius, count, z, unit = scale) => Array.from({length: count}, (_, i) => { const a = 2 * Math.PI * i / (count - 1); return [(cx + radius * Math.cos(a)) * unit, (cy + radius * Math.sin(a)) * unit, z]; });
  return {unlit, flat, rect, millimeters, outline, circlePoints};
}

/**
 * The element seen from the side: a wire wound into `turns` coils of radius
 * `radius` between x0 and x1, at height y, with `perTurn` points along each
 * turn. Millimeters, to be scaled by the caller.
 */
export function coilPoints(x0, x1, y, radius, turns, perTurn = 12) {
  const count = Math.max(2, Math.round(turns * perTurn));
  return Array.from({length: count + 1}, (_, i) => {
    const share = i / count, angle = share * turns * 2 * Math.PI;
    return [x0 + (x1 - x0) * share, y + radius * Math.sin(angle), radius * Math.cos(angle)];
  });
}

/** How far along its glow a wire at `celsius` is: nothing below the Draper point, all of it at the temperature the datasheet lets it run to. */
export const glowShare = celsius => Math.max(0, Math.min(1, (celsius - DRAPER.celsius) / (NIKROTHAL.continuous - DRAPER.celsius)));

const dark = new THREE.Color(0x6b6f66), dull = new THREE.Color(0x8c2f1a), bright = new THREE.Color(0xf6c96b);
/**
 * The color a wire is drawn at `celsius`: the cold metal below the Draper
 * point, the dull red the Incandescence page describes just above it, and a
 * pale yellow by the time it reaches the temperature the datasheet allows. The
 * ramp between those three is a drawing choice, not a color temperature.
 */
export function wireColor(celsius) {
  if (celsius <= DRAPER.celsius) return dark.clone();
  const share = glowShare(celsius);
  return share <= 0.5 ? dull.clone().lerp(bright, share * 2 * 0.45) : dull.clone().lerp(bright, 0.45 + (share - 0.5) * 2 * 0.55);
}

/** How brightly the glow reads, for a halo drawn behind the wire: nothing until it glows, then growing with its share. */
export const glowOpacity = celsius => 0.55 * glowShare(celsius);
