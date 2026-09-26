// Positions stay attached to lessons when publication or room filters change.
// x/y are button centers; width/height are percentages of the scene illustration.
export const scenePageSize = 3;
export const sceneSurfaces = {
  workshop: [[26,47,20,22],[51,45,24,24],[83,56,20,24]],
  discovery: [[46,35,20,28],[69,40,20,26],[85,54,22,26],[17,23,18,20],[64,15,20,22]],
  studio: [[18,37,22,30],[57,26,22,30],[82,55,24,22]],
  park: [[57,67,20,20],[25,59,23,22],[83,31,23,21]],
  river: [[50,89,32,18],[46,36,22,20],[62,42,22,20]],
};
export const sceneLocations = {
  'binoculars': [57, 67, 12, 12, true],
  'raft': [43, 85, 32, 28],
  '3d-printer': [51, 45, 24, 24],
  'stepper-motor': [26, 47, 20, 22],
  'direct-current-motor': [26, 47, 20, 22],
  'universal-motor': [51, 45, 24, 24],
  'electric-horn': [83, 56, 20, 24],
  'spark-gap': [26, 47, 20, 22],
  'electronic-ignition': [51, 45, 24, 24],
  'crash-sensor': [51, 45, 24, 24],
  'airbag-warning-indicator': [83, 56, 20, 24],
  'telescopes': [85, 54, 22, 26],
  'microscopes': [17, 23, 18, 20],
  'electromagnet': [46, 35, 20, 28],
  'sensors-and-detectors': [69, 40, 20, 26],
  'feedback-mechanism': [46, 35, 20, 28],
  'seismograph': [65, 63, 22, 22],
  'seismic-waves': [69, 40, 20, 26],
  'earthquake-location-by-arrival-times': [46, 35, 20, 28],
  'autopilot': [64, 15, 20, 22],
  'inertial-guidance': [46, 35, 20, 28],
  'mirrors': [18, 37, 22, 30],
  'lenses': [57, 26, 22, 30],
  'polarized-light': [82, 55, 24, 22],
  'liquid-crystal-display': [57, 26, 22, 30],
};

// Where each item on one page of a scene stands: its reviewed spot when it
// clashes with no earlier item on the page, otherwise the first painted surface
// that clashes with none. Two spots clash when either center falls inside the
// other's box, where it could not be clicked, or when their labels, which sit
// along each box's bottom edge, would meet.
const overlaps = (a, b) => {
  const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
  return (dx < Math.max(a[2], b[2]) / 2 && dy < Math.max(a[3], b[3]) / 2) || (dx < (a[2] + b[2]) / 2 && Math.abs(a[1] + a[3] / 2 - b[1] - b[3] / 2) < 10);
};
export function sceneSpots(placeId, ids) {
  const spots = [], surfaces = sceneSurfaces[placeId], taken = spot => spots.some(other => other && overlaps(other, spot));
  ids.forEach((id, i) => { if (sceneLocations[id] && !taken(sceneLocations[id])) spots[i] = sceneLocations[id]; });
  ids.forEach((id, i) => { if (!spots[i]) spots[i] = surfaces.find(spot => !taken(spot)) || surfaces[i % surfaces.length]; });
  return spots;
}
