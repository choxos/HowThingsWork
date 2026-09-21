import {EXTINGUISHER_DEFAULTS} from './extinguisher-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  is940: {title: 'Bureau of Indian Standards: IS 940:2003, Portable fire extinguisher, water type (gas cartridge)', url: 'https://law.resource.org/pub/in/bis/S03/is.940.2003.pdf'},
  is4947: {title: 'Bureau of Indian Standards: IS 4947:2006, Gas cartridges for use in fire extinguishers', url: 'https://law.resource.org/pub/in/bis/S03/is.4947.2006.pdf'},
  is15683: {title: 'Bureau of Indian Standards: IS 15683:2006, Portable fire extinguishers, performance and construction', url: 'https://ia800705.us.archive.org/29/items/gov.in.is.15683.2006/is.15683.2006.html'},
  kanex: {title: 'Kanex Fire: 9 liter water based cartridge operated fire extinguisher, KFWCRQ-9', url: 'https://www.kanexfire.com/buyonline/9ltr-water-based-cartridge-operated.html'},
  extinguisher: {title: 'Wikipedia: Fire extinguisher', url: 'https://en.wikipedia.org/wiki/Fire_extinguisher'},
  airWater: {title: 'Wikipedia: Air pressurized water', url: 'https://en.wikipedia.org/wiki/Air_pressurized_water'},
  amerex: {title: 'Amerex: Fire extinguisher product catalog', url: 'https://www.amerex-fire.com/upl/downloads/library/fire-extinguisher-product-catalog-english.pdf'},
  co2: {title: 'Wikipedia: Carbon dioxide', url: 'https://en.wikipedia.org/wiki/Carbon_dioxide'},
  co2Data: {title: 'Wikipedia: Carbon dioxide (data page)', url: 'https://en.wikipedia.org/wiki/Carbon_dioxide_(data_page)'},
  vanDerWaals: {title: 'Wikipedia: Van der Waals equation', url: 'https://en.wikipedia.org/wiki/Van_der_Waals_equation'},
  dalton: {title: 'Wikipedia: Dalton’s law', url: 'https://en.wikipedia.org/wiki/Dalton%27s_law'},
  boyle: {title: 'Wikipedia: Boyle’s law', url: 'https://en.wikipedia.org/wiki/Boyle%27s_law'},
  henry: {title: 'Wikipedia: Henry’s law', url: 'https://en.wikipedia.org/wiki/Henry%27s_law'},
  vapor: {title: 'Wikipedia: Vapor pressure of water', url: 'https://en.wikipedia.org/wiki/Vapour_pressure_of_water'},
  water: {title: 'Wikipedia: Water (data page)', url: 'https://en.wikipedia.org/wiki/Water_(data_page)'},
  airDensity: {title: 'Wikipedia: Density of air', url: 'https://en.wikipedia.org/wiki/Density_of_air'},
  heatRatio: {title: 'Wikipedia: Heat capacity ratio', url: 'https://en.wikipedia.org/wiki/Heat_capacity_ratio'},
  choked: {title: 'Wikipedia: Choked flow', url: 'https://en.wikipedia.org/wiki/Choked_flow'},
  orifice: {title: 'Wikipedia: Orifice plate', url: 'https://en.wikipedia.org/wiki/Orifice_plate'},
  torricelli: {title: 'Wikipedia: Torricelli’s law', url: 'https://en.wikipedia.org/wiki/Torricelli%27s_law'},
  tft: {title: 'Task Force Tips: 7 hydraulic calculations every firefighter needs to know', url: 'https://tft.com/hydraulic-calculations-every-firefighter-needs-to-know/'},
  drag: {title: 'Wikipedia: Drag coefficient', url: 'https://en.wikipedia.org/wiki/Drag_coefficient'},
  projectile: {title: 'Wikipedia: Projectile motion', url: 'https://en.wikipedia.org/wiki/Projectile_motion'},
  ellipsoid: {title: 'Wikipedia: Ellipsoid', url: 'https://en.wikipedia.org/wiki/Ellipsoid'},
  gasConstant: {title: 'Wikipedia: Gas constant', url: 'https://en.wikipedia.org/wiki/Gas_constant'},
  atmosphere: {title: 'Wikipedia: Standard atmosphere (unit)', url: 'https://en.wikipedia.org/wiki/Standard_atmosphere_(unit)'},
  bar: {title: 'Wikipedia: Bar (unit)', url: 'https://en.wikipedia.org/wiki/Bar_(unit)'},
  kgf: {title: 'Wikipedia: Kilogram-force', url: 'https://en.wikipedia.org/wiki/Kilogram-force'},
  gravity: {title: 'Wikipedia: Standard gravity', url: 'https://en.wikipedia.org/wiki/Standard_gravity'},
  kelvin: {title: 'Wikipedia: Kelvin', url: 'https://en.wikipedia.org/wiki/Kelvin'},
  psi: {title: 'Wikipedia: Pound per square inch', url: 'https://en.wikipedia.org/wiki/Pound_per_square_inch'},
  gallon: {title: 'Wikipedia: Gallon', url: 'https://en.wikipedia.org/wiki/Gallon'},
  foot: {title: 'Wikipedia: Foot (unit)', url: 'https://en.wikipedia.org/wiki/Foot_(unit)'},
  inch: {title: 'Wikipedia: Inch', url: 'https://en.wikipedia.org/wiki/Inch'},
};

/** What the model draws at its own scales, and what it takes without a source. */
export const fireExtinguisherLimits = 'The body is drawn at a quarter of true size, the cartridge, grip and valve at true size as a schematic, and the jet at a hundredth of true size; the clock runs 5 times faster than the discharge. IS 940, withdrawn when IS 15683 took its place, still gives the body’s construction and the closed nozzle limit quoted here. Not from a source: a body holding 11.19 L inside, set so a 60 g cartridge gives Kanex’s 14 bar over 9 L at 27 °C, with 2:1 ellipsoidal ends and a strainer 10 mm above the bottom; one opening of 3.22 mm for the valve, the siphon tube, the hose and the nozzle, with no other losses, set so 95% of 9 L leaves in Kanex’s 35 s; drops of one size, 1.49 mm across, set so the level jet lands Kanex’s 6 m away at half that time; water of 1,000 kg/m³ in Task Force Tips’ rule; a cartridge 40 mm across; a test gauge reading to 25 bar; and water from 6 to 9.5 L and aim up to 45°. The whole charge is taken as released at once and all of it gas at the water’s temperature, where the gas then stays, though a real cartridge chills as its liquid boils and a gas cools as it expands; how fast the cartridge empties is left out. None of the gas dissolves, though by Henry’s law the water would take up more than the whole charge, given time. The water vapor stays saturated and leaves with the gas as if it were the same mixture, whose heat capacities mix by moles. The jet breaking into drops, wind, and a valve opened partway are left out.';

const onBody = trial(EXTINGUISHER_DEFAULTS, 'body'), onChart = trial(EXTINGUISHER_DEFAULTS, 'chart'), onCartridge = trial(EXTINGUISHER_DEFAULTS, 'cartridge'), onGauge = trial(EXTINGUISHER_DEFAULTS, 'gauge'), onJet = trial(EXTINGUISHER_DEFAULTS, 'jet');

export const fireExtinguisherLesson = {
  simple: 'How does a cartridge of gas push the water out of a fire extinguisher?',
  overview: 'This extinguisher keeps its gas out of the way until it is needed: a small steel cartridge of liquid carbon dioxide sits in the cap above the water. Squeezing the grip drives a pin through the cartridge’s seal, the gas fills the space above the water, and when the valve opens it pushes the water up the siphon tube and out of the nozzle. As the water leaves, the gas gains room, its pressure falls, and the jet lands closer. Press Play to squeeze the grip, then change the cartridge, the temperature, the water and the aim.',
  steps: [
    {title: 'Squeeze the grip', body: 'The lever pushes a plunger down, and the pin at its end pierces the seal of the carbon dioxide cartridge.'},
    {title: 'The gas fills the space', body: 'The liquid carbon dioxide boils off through the pierced seal into the space above the water, where all of it is gas.'},
    {title: 'Open the valve', body: 'The control valve opens the way from the siphon tube to the hose and the nozzle.'},
    {title: 'The gas pushes the water', body: 'The gas presses on the water’s surface, and the water rises through the strainer and up the siphon tube.'},
    {title: 'Out of the nozzle', body: 'The pressure becomes speed at the nozzle, and the jet flies until gravity and the air bring it down.'},
  ],
  parts: [
    {name: 'Body, cut open', role: 'The steel shell holding the water, with room above it for the gas.'},
    {name: 'Gas cartridge, close up', role: 'Liquid carbon dioxide sealed in steel until the pin pierces it.'},
    {name: 'Squeeze grip and piercing pin, close up', role: 'The lever the hand squeezes and the pin it drives through the seal.'},
    {name: 'Siphon tube and strainer', role: 'The way the water leaves, from near the bottom of the body.'},
    {name: 'Control valve, close up', role: 'Opens and closes the way out to the hose.'},
    {name: 'Hose and nozzle', role: 'Carries the water out and turns its pressure into speed.'},
    {name: 'Test gauge', role: 'Reads the pressure above the air outside, for the test.'},
    {name: 'Jet, to scale', role: 'Where the water lands as the pressure falls.'},
    {name: 'Through the run', role: 'The gauge and the water left, from the squeeze until the gauge reads zero.'},
  ],
  tryIt: [
    onBody('Squeeze the grip', 'Press Play and watch the water and the gauge.', 'The pin pierces the cartridge and its 60 g of gas fills the space at 14.0 bar; 6 s later the valve opens and the jet leaves at 53.0 m/s, landing 8.1 m away. Halfway through the effective discharge time, 17.5 s after the valve opened, the gauge is down to 3.8 bar and the jet lands 6.0 m away, and 95% of the water is out at 35.0 s. The gauge reads zero 55.8 s after the squeeze.'),
    onChart('A small cartridge', 'Choose the 20 g cartridge and press Play.', 'A third of the gas gives only 5.0 bar, and the jet leaves at 31.7 m/s. The gauge is down to 0.7 bar by half the effective discharge time, when the jet lands 3.6 m away, and 95% of the water takes 76.2 s to leave, against 35.0 s with the 60 g cartridge.', {cartridge: 20}),
    onCartridge('A cold morning', 'Set the temperature to 5 °C and look at the cartridge, then press Play.', 'Before it is pierced, liquid fills 71% of the cartridge, under vapor at 39.5 bar absolute. Released, the gas gives 12.9 bar instead of 14.0, and 95% of the water takes 36.8 s to leave; the jet lands 5.6 m away at half that time.', {temperature: 5}),
    onCartridge('A hot day', 'Set the temperature to 55 °C and look at the cartridge.', 'Above 27.6 °C the saturation table’s liquid is no denser than the fill, so liquid fills the whole cartridge and its pressure is past the table. Released, the gas gives 15.4 bar, under the 16 bar Kanex gives as the maximum service pressure, and 95% of the water leaves in 32.7 s.', {temperature: 55}),
    onGauge('Too much water', 'Set the water to 9.5 L and press Play.', 'The gas gets only 1.78 L of room instead of 2.28 L, so the gauge starts at 17.6 bar, past the 15 bar the Indian standard allows with the nozzle closed and Kanex’s 16 bar maximum. At 55 °C it would reach 19.5 bar. The jet still lands 6.0 m away at half the effective discharge time.', {water: 9.5}),
    onChart('Only 6 L of water', 'Set the water to 6 L and press Play.', 'With 5.28 L of room the gas gives just 6.3 bar, and the jet leaves at 35.5 m/s. But the gas loses less of its pressure as the water leaves: 3.6 bar at half the effective discharge time, when the jet lands 5.9 m away, nearly as far as with 9 L. 95% of the water is out at 25.5 s.', {water: 6}),
    onJet('Aim up', 'Set the aim to 30° and press Play.', 'Aimed 30° up, the jet from the start rises to 4.1 m and lands 10.1 m away, where level it lands 8.1 m away. The air changes the best aim: at 45° the jet lands only 9.0 m away, and the farthest, 10.3 m, comes at 25°.', {aim: 30}),
  ],
  deeper: [
    {title: 'Liquid in the cartridge', body: 'IS 4947 lets a cartridge hold carbon dioxide of at most 0.667 times the mass of water that would fill it at 27 °C, so 60 g needs 90.3 mL inside, a fill of 665 kg/m³. At 27 °C the saturation table puts liquid of 675 kg/m³ under vapor of 267 kg/m³ at 67.0 bar absolute, so liquid fills 97% of the cartridge. At 27.6 °C the table’s liquid is only as dense as the fill, and liquid fills it all; warmer, the table no longer gives its pressure. Above the critical point, 31.03 °C, no liquid forms at all.'},
    {title: 'Gas over the water', body: 'Pierced, the 60 g spreads through the 2.19 L above 9 L of water and the cartridge’s own 90.3 mL, 2.28 L in all, at 26.4 kg/m³: far short of the 267 kg/m³ at which liquid would form at 27 °C, so all of it is gas. The van der Waals equation gives its pressure as 14.04 bar where an ideal gas would give 14.95, its molecules’ attraction outweighing their size. By Dalton’s law the air adds 0.94 bar and the water vapor 0.036 bar; less 1 atm outside, the gauge reads 14.0 bar, Kanex’s service pressure, under the 1.5 MN/m² IS 940 allows with the nozzle closed. As the water leaves, the same gas gains its room: by half the effective discharge time it has 7.37 L and the gauge reads 3.8 bar.'},
    {title: 'Out through the nozzle', body: 'Water under a pressure difference Δp leaves at Bernoulli’s speed √(2Δp/ρ): 53.0 m/s at 14.0 bar and 27.8 m/s at 3.8 bar. Task Force Tips’ smooth bore rule, 29.7 gallons a minute through a 1 inch opening at 1 psi, comes to 0.996 of Bernoulli’s flow, so the model passes 0.996 times the opening’s area times that speed: 0.43 L/s at first through its opening of 3.22 mm, a size set so 95% of 9 L leaves in Kanex’s 35 s. An opening of twice the area would empty the body in half the time, the jet leaving at the same speed.'},
    {title: 'How far the jet reaches', body: 'IS 15683 measures the range with the nozzle held level 1 m above the floor, at half the effective discharge time. With no air, water leaving at 27.8 m/s would land 12.5 m away. The model’s drops, 1.49 mm across with a sphere’s drag coefficient of 0.47, lose a factor e of their speed to the air every 3.58 m, and land 6.0 m away, Kanex’s range; their size is set to give it. Aimed up they go farther, but not farthest at 45° as in empty space: from the start, level reaches 8.1 m, 25° reaches 10.3 m and 45° only 9.0 m.'},
    {title: 'The last of the gas', body: 'The water reaches the strainer 37.3 s after the valve opens, leaving 0.05 L below it, 0.6% of the water, where IS 15683 lets a trial keep 5%. Then the gas leaves through the same opening. While its pressure is more than 1.84 times the air’s outside, 1 over the critical ratio of 0.545 for a heat capacity ratio of 1.30, the flow is choked, moving at the speed of sound where the way is narrowest. It stays choked for 4.8 s, and 12.4 s after the water ran out the gauge reads zero, what IS 15683 calls complete discharge, with 18.3 g of the carbon dioxide still inside at 1 atm.'},
    {title: 'Why the gas waits in a cartridge', body: 'Stored pressure extinguishers keep their gas over the water all the time, and water ones typically use air: Amerex’s model 240 holds 2.5 gallons, 9.46 L, pressurized to 100 psi, 6.9 bar, and discharges for 55 s over 45 to 55 ft, 13.7 to 16.8 m. Carbon dioxide kept over water would dissolve: by Henry’s law and the solubility table, 9 L of water at 27 °C takes up 170 g of it at 13.9 atm, given time, nearly three times the whole charge. Sealed in its cartridge until the squeeze, it meets the water only for the discharge, and the model lets none of it dissolve.'},
  ],
  misconception: 'The jet is not as strong at the end as at the start. The gas keeps its amount but gains the room the water leaves, so its pressure falls, and the jet slows and lands closer.',
  limits: fireExtinguisherLimits,
  sources: [sources.is940, sources.is4947, sources.is15683, sources.kanex, sources.extinguisher, sources.co2Data, sources.co2, sources.vanDerWaals, sources.dalton, sources.boyle, sources.henry, sources.vapor, sources.water, sources.airDensity, sources.heatRatio, sources.choked, sources.orifice, sources.torricelli, sources.tft, sources.drag, sources.projectile, sources.ellipsoid, sources.gasConstant, sources.atmosphere, sources.bar, sources.kgf, sources.gravity, sources.kelvin, sources.psi, sources.gallon, sources.foot, sources.inch, sources.amerex, sources.airWater],
  quiz: {
    question: 'Why does the jet land closer as the extinguisher empties?',
    options: ['The gas spreads into the room the water leaves, so its pressure falls and the water leaves slower.', 'The cartridge runs out of gas before the water runs out.', 'The nozzle cools and narrows as the gas expands.'],
    answer: 0,
    explanation: 'With 60 g at 27 °C the gauge falls from 14.0 bar to 3.8 bar by half the effective discharge time, and the jet slows from 53.0 m/s to 27.8 m/s, landing 6.0 m away instead of 8.1 m.',
  },
};
