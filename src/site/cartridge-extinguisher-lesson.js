import {FIRE_DEFAULTS} from './cartridge-extinguisher-physics.js';

const trial = (title, instruction, observe, settings = {}, checkpoint = 'ready') => ({
  title, instruction, observe, values: {...FIRE_DEFAULTS, ...settings}, reset: true,
  initialState: {settings: {...FIRE_DEFAULTS, ...settings}, checkpoint},
  part: 'system', isolate: true, view: 'front',
});

export const cartridgeExtinguisherLesson = {
  simple: 'How does a small gas cartridge drive water through an extinguisher?',
  overview: 'Press Play to lower the handle, open the cartridge and follow water into the collection vessel. Gas released above the water raises its pressure. That pressure drives water up the dip tube and through the hose. Compare gas charge and pickup depth to discover why water can remain inside after delivery stops. This is an idealized mechanism experiment; the added collector makes its result visible.',
  steps: [
    {title: 'Keep gas and water separate', body: 'Before actuation, the sealed cartridge holds the propellant apart from the water vessel. The vessel starts at atmospheric pressure. Blue shows water; purple dots symbolize the available cartridge charge.'},
    {title: 'Open the cartridge seal', body: 'The pivoted handle presses a pointed plunger down through its guide. The collar compresses the return spring. Once the point reaches the seal, the cartridge opens and gas can enter the space above the water through side ports.'},
    {title: 'Raise pressure above the water', body: 'Released gas raises the pressure in the headspace. Pressure acts in every direction, including on the water surface. The purple arrows are explanatory overlays, not visible gas jets or a fitted pressure gauge.'},
    {title: 'Lift water through the dip tube', body: 'The submerged intake admits water to the tube. With enough pressure to overcome the lift to the outlet, water rises through the head passage, follows the hose and leaves the narrow nozzle. Blue markers trace that continuous route.'},
    {title: 'Expand the gas space', body: 'Water collected outside equals water lost from the vessel in this model. As the water surface falls, the same expanded gas occupies more room. At the fixed temperature assumed here, its pressure falls and the water flow slows.'},
    {title: 'Identify why delivery stops', body: 'An exposed pickup admits gas instead of the water below it. With a smaller gas charge, pressure can instead become too low to lift more water. The observation freezes at the first of those boundaries; it does not show later gas venting or imply that the vessel is depressurized.'},
  ],
  parts: [
    {name: 'Pressure vessel', role: 'Contains water and headspace around the cartridge and dip tube.'},
    {name: 'Handle and gas release', role: 'Turns handle motion into downward plunger motion and opens a route into the headspace.'},
    {name: 'Piercing plunger and return spring', role: 'Pierces the cartridge seal while the spring compresses under its collar.'},
    {name: 'Gas cartridge and seal', role: 'Keeps the propellant separate until the seal opens.'},
    {name: 'Gas above the water', role: 'Expands into the room left by delivered water, with falling pressure.'},
    {name: 'Dip tube and intake', role: 'Collects water while its lower opening remains submerged.'},
    {name: 'Head passage and hose', role: 'Join the dip tube to the outlet in one continuous path.'},
    {name: 'Narrow outlet', role: 'Converts available pressure head into water speed.'},
    {name: 'Collected water', role: 'Makes delivered volume visible in an added measuring vessel.'},
  ],
  tryIt: [
    trial('Follow the complete water path', 'Press Play with 9 L, a full illustrative charge and the intake near the floor.', 'Water rises through the tube and fills the collector. About 8.79 L is collected; about 0.21 L remains below the intake.'),
    trial('Reduce the gas charge', 'Press Play with one quarter of the illustrative gas charge.', 'Delivery stops at about 4.29 L collected, while the floor intake remains submerged. Pressure can no longer lift the remaining water to the outlet.', {charge: .25}),
    trial('Remove the gas charge', 'Press Play with No charge selected.', 'The plunger still opens the seal, but the cartridge adds no pressure. All 9 L stays in the vessel.', {charge: 0}),
    trial('Shorten the pickup tube', 'Press Play with the intake Halfway up.', 'Only about 2.88 L reaches the collector. The intake becomes exposed while about 6.12 L remains below it.', {pickup: 1}),
    trial('Put the intake above the water', 'Press Play with the intake in the gas space from the start.', 'Pressure rises, but no water enters the tube. The observation stops at this bypass boundary with all 9 L still below the intake.', {pickup: 2}),
    trial('Start with less water', 'Press Play with 3 L and the intake near the floor.', 'The larger starting gas space produces less initial pressure for the same charge. About 2.79 L is collected and the same 0.21 L remains below the floor intake.', {water: 3}),
    trial('Watch pressure fall during delivery', 'This experiment starts halfway through the calculated water-delivery time. Note the pressure, then press Play.', 'The partly filled collector grows as the water surface falls. Gas pressure continues to fall because the expanded gas occupies more room.', {}, 'midway'),
  ],
  deeper: [
    {title: 'Why the tube reaches down', body: 'Pressure alone cannot select water. The fluid touching the intake enters the tube. A deep intake remains in water for most of the discharge; a short intake reaches the gas space sooner and bypasses the water left below it.'},
    {title: 'Absolute pressure and gauge pressure', body: 'The gas relation uses absolute pressure, measured from vacuum. The displayed gauge pressure subtracts the surrounding atmospheric pressure. Before release, the water vessel has zero gauge pressure even though its absolute pressure is not zero.'},
    {title: 'What the gas law explains', body: 'For a fixed amount of ideal gas at fixed temperature, absolute pressure times gas volume stays constant. The model applies that relation to the expanded gas after release. It does not calculate the phase, pressure or cooling of propellant inside a real cartridge.'},
    {title: 'Pressure must pay for the lift', body: 'Water leaving an outlet above its internal surface gains gravitational potential energy. In the ideal flow calculation, the pressure difference supplies that lift and the kinetic energy at the outlet. At pressure balance there is no energy left for continued flow, even though gauge pressure can remain positive.'},
    {title: 'Why a smaller charge can leave more water', body: 'Less released gas produces less initial pressure. As water leaves, that pressure falls further. The quarter-charge experiment with 9 L reaches the lifting-pressure boundary while its intake is still underwater. This differs from the full-charge experiment, which reaches the pickup first.'},
    {title: 'Water and propellant have different jobs', body: 'In a water extinguisher, the propellant supplies pressure to move the water. Water can cool and soak burning material. Foam, powder and carbon-dioxide extinguishers use different media; their extinguishing actions are not demonstrated by this water-delivery lesson.'},
  ],
  misconception: 'Water delivery ending does not mean every drop has left, or that pressure has fallen to zero. The intake can become exposed, or pressure can become too low to lift more water.',
  limits: 'A schematic cartridge-operated water mechanism with an added collector, not a product simulation or operating guide. Vessel dimensions, gas charge, outlet area and timing are illustrative, with no manufacturer rating or fire-performance prediction. Handle motion is prescribed and slowed; cartridge opening is an idealized single event. Expanded gas is ideal and isothermal. Volume uses cylindrical vessel and cartridge envelopes; small seal, plunger and head-fitting volumes are omitted. Water is incompressible, and the outlet calculation neglects water-surface speed, friction, line filling, line volume and flow inertia. Cartridge phase changes, gas cooling, dissolution, later gas venting, stream acceleration, spray breakup and fire suppression are omitted. Water and gas colors, pressure arrows and moving route markers are teaching overlays. Markers are deliberately slow and do not represent individual molecules or droplets. Playback runs at twice the calculated model time and freezes at the first pickup-exposure or pressure-balance boundary. The frozen endpoint may retain pressure. Inspection preserves the current state; changing a setting prepares a fresh run.',
  sources: [
    {title: 'Kanex: cartridge-operated water and foam extinguisher arrangements', url: 'https://www.kanexfire.com/buyonline/pub/media/sebwite/productdownloads//k/a/kanex-foam-water-cartridge-operated-brochure_2.pdf'},
    {title: 'Kanex: water-extinguisher body, cartridge, dip tube and hose', url: 'https://www.kanexfire.com/buyonline/pub/media/sebwite/productdownloads//w/a/water-cp-6-9_1.pdf'},
    {title: 'OpenStax: ideal gas pressure, volume and temperature', url: 'https://openstax.org/books/university-physics-volume-2/pages/2-1-molecular-model-of-an-ideal-gas'},
    {title: 'OpenStax: pressure, speed and elevation in Bernoulli’s equation', url: 'https://openstax.org/books/university-physics-volume-1/pages/14-6-bernoullis-equation'},
    {title: 'Amerex: water cooling and soaking, product catalog page 6', url: 'https://www.amerex-fire.com/upl/downloads/library/fire-extinguisher-product-catalog-english.pdf'},
  ],
  quiz: {question: 'A shortened dip tube becomes exposed while water remains below it. Why does water delivery end?', options: ['The intake now admits gas instead of the water below it.', 'The remaining water has turned into gas.', 'Any remaining water proves the cartridge never opened.'], answer: 0, explanation: 'The intake collects the fluid surrounding its opening. Once that opening is in the gas space, it cannot collect water below it. Pressure can remain at this endpoint.'},
};
