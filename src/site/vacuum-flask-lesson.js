import {FLASK_DEFAULTS} from './vacuum-flask-physics.js';

const trial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...FLASK_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});

export const vacuumFlaskLesson = {
  simple: 'Why do a vacuum, shiny walls and a stopper each matter when keeping a drink hot or cold?',
  overview: 'A vacuum flask slows heat transfer along several paths. Nearly empty space separates two walls; reflective coatings reduce radiation across that space. A thin neck joins the walls, and a stopper closes the opening. Cork supports the outer vessel inside a protective case without bridging the vacuum. Remove one barrier at a time, then compare temperature, watts and transferred energy. The numerical results describe this illustrative flask.',
  steps: [
    {title: 'Start with a temperature difference', body: 'The half-liter drink and inner wall share one temperature in this model. The room and outer wall stay at 20°C. Heat flows out of a hotter drink and into a colder one.'},
    {title: 'Reduce gas conduction', body: 'Pumping gas out leaves fewer molecules to transfer energy between the walls. This model retains a small residual gas heat flow. Air-filled dots illustrate molecules; their motion is slowed and enlarged for viewing.'},
    {title: 'Reduce radiation separately', body: 'An empty gap does not stop thermal radiation. Low-emissivity coatings on its two faces reduce emission and absorption. Change silvered walls to bare glass and compare the radiation bar.'},
    {title: 'Keep the solid bridge narrow', body: 'The inner wall reaches the outer wall at the rim through a thin neck. Changing the neck material changes this solid conduction path; the gap remains empty.'},
    {title: 'Close the opening', body: 'A real stopper restricts air exchange and evaporation. Here, a chosen sensible-heat conductance represents the top: removing the stopper increases it. Evaporation, humidity and mass loss are outside the simulation.'},
    {title: 'Watch the difference shrink', body: 'Every modeled heat flow falls as the drink approaches room temperature. Arrows show direction, bars show watts, and the chart tracks temperature. All paths reverse for a cold drink; at room temperature every net flow is zero.'},
  ],
  parts: [
    {name: 'Double wall and insulating gap', role: 'Two connected vessels surround the empty space; inspect the assembly to see the gap.'},
    {name: 'Inner wall', role: 'Holds the drink; its gap-facing surface can be silvered.'},
    {name: 'Outer wall', role: 'Encloses the gap and rests on the cork support.'},
    {name: 'Thin neck and sealed rim', role: 'The solid bridge between the two walls.'},
    {name: 'Stopper', role: 'Fits the neck; when removed, it rests beside the flask.'},
    {name: 'Drink', role: 'Half a liter, colored by its modeled temperature.'},
    {name: 'Insulating support', role: 'Supports the outer vessel without filling the vacuum gap.'},
    {name: 'Protective case', role: 'Shields the glass from damage; open its cover to inspect inside.'},
    {name: 'Heat flow directions', role: 'Equal-length arrows show direction, not magnitude.'},
    {name: 'Temperature and heat transfer', role: 'Labeled temperature chart and four bars sharing a 0–25 W scale.'},
  ],
  tryIt: [
    trial('Keep coffee hot', 'Start at 90°C with all barriers in place. Play through the day.', 'At first this model loses 1.96 W, including 1.40 W through the top. It stays above the chosen 60°C comparison line for 12.1 h; after a day it is 43.4°C.'),
    trial('Scrape off the silvering', 'Compare bare glass with the default silvered walls, keeping the vacuum.', 'Initial radiation rises to 14.86 W. Temperature crosses the comparison line after 1.5 h and reaches 29.7°C after six hours.', {silvered: 0}),
    trial('Let air into the gap', 'Fill the gap with air while keeping the silvered walls and stopper.', 'Gas conduction starts at 11.65 W across the 5 mm body gap. Temperature falls below 60°C after 1.7 h.', {vacuum: 0}),
    trial('A steel neck', 'Change only the neck from glass to stainless steel.', 'Initial neck conduction rises to 4.40 W. Temperature stays above the comparison line for 3.9 h.', {neck: 1}),
    trial('Leave the stopper out', 'Remove the stopper; keep the vacuum and silvered walls.', 'The chosen open-top path starts at 21.00 W, about 97% of the total. Temperature crosses the comparison line after 1.1 h. Evaporation would add physics not modeled here.', {stopper: 0}),
    trial('Remove three barriers', 'Use bare walls, air in the gap and an open top.', 'Total initial heat transfer is 47.78 W. After one hour the drink is 43.6°C. This is a comparison within the same geometry, not a prediction for every ordinary bottle.', {silvered: 0, vacuum: 0, stopper: 0}),
    trial('Keep a drink cold', 'Start at 4°C with all barriers in place.', 'All four arrows reverse. Heat enters at 0.43 W initially; after 12 h the drink is 10.6°C, and after a day it is 14.5°C.', {start: 4}),
    trial('A cold drink with no stopper', 'Start at 4°C and remove the stopper.', 'The chosen top path carries 4.80 W inward initially. After six hours the drink reaches 19.2°C. This sensible-heat model omits evaporation, which can also cool a real open drink.', {start: 4, stopper: 0}),
    trial('Match the room', 'Start at 20°C, exactly the room temperature, then play.', 'All four net heat flows are 0 W. Arrows disappear, bars empty, and temperature stays at 20°C for all 24 h. Molecules and radiation still exist; there is no net transfer.', {start: 20}),
    trial('Start below the comparison line', 'Start at 50°C with the usual insulation.', 'Heat initially leaves at 0.82 W. The drink cools toward 20°C and spends 0 h above the chosen 60°C line. That line is a comparison, not a universal preference or safety threshold.', {start: 50}),
  ],
  deeper: [
    {title: 'Three heat-transfer mechanisms, four model paths', body: 'Conduction transfers energy through matter; convection carries it with moving fluid; thermal radiation travels electromagnetically. The model separates radiation, gap-gas conduction, solid-neck conduction and an effective top conductance. It does not solve fluid flow.'},
    {title: 'What the silvering calculation assumes', body: 'The calculation approximates the facing walls as equal-area, opaque gray planes: radiation is σA(T⁴ − Troom⁴)/(1/ε₁ + 1/ε₂ − 1), with absolute temperatures in kelvin. Chosen silvered emissivity is 0.03, or 3% of a blackbody value; bare glass is assigned 0.9. At the same temperatures that reduces net radiation by about 54. Real coatings, curved surfaces and spectral properties differ.'},
    {title: 'Which path dominates depends on the design', body: 'With this model’s default parameters at 90°C, 1.40 W of the 1.96 W leaves through the top, with another 0.27 W along the neck. A damaged vacuum or reflective coating changes that ranking. No single path dominates every flask.'},
    {title: 'Power versus energy', body: 'Watts measure the rate of transfer now. Kilojoules add up what has crossed each path since the start. Their sum equals the heat capacity times the temperature change. The default flask loses 1.96 W at 90°C but only 0.82 W at 50°C, so its cooling rate slows.'},
    {title: 'Dewar’s flask', body: 'The Royal Institution preserves a flask from James Dewar’s 1892 low-temperature research. Sealing an inner glass vessel within an evacuated outer vessel reduced heat input. Later refinements included narrower necks and silvered surfaces. Everyday flasks use the same heat-transfer principles.'},
  ],
  misconception: 'A vacuum reduces gas heat transfer but does not stop radiation or conduction through the neck. In this model, removing silvering changes the time above the chosen comparison line from 12.1 h to 1.5 h even though the gap stays evacuated.',
  limits: 'Illustrative single-temperature model: 0.5 kg of water, specific heat 4186 J/(kg·K), plus an inner-wall heat capacity of 75 J/K. Room and outer wall stay at 20°C. The chosen effective area is 0.032 square meter, with a 5 mm gap in the cylindrical body. Radiation uses equal-area planar gray surfaces, not exact curved-vessel view factors, with emissivity 0.9 or 0.03. Gas conductivity is 0.026 W/(m·K), reduced to one thousandth for the vacuum; gas convection is omitted. Neck conduction uses a 50 mm diameter, a 0.5 mm thin-wall approximation and a path 20 mm long, with conductivity 1 or 16 W/(m·K). The top passes 0.02 W per degree when closed or 0.3 W per degree when open, as chosen sensible-heat conductances. Evaporation, humidity, changing mass, internal temperature gradients, exterior/support heat storage and pouring are omitted. A material change alters only its named path. These values illustrate mechanisms, not tested product performance or food-safety advice. The 60°C line is only a comparison. One playback second represents one hour.',
  sources: [
    {title: 'OpenStax College Physics 2e: heat transfer methods', url: 'https://openstax.org/books/college-physics-2e/pages/14-4-heat-transfer-methods'},
    {title: 'MIT Thermodynamics: radiation between planar surfaces and a thermos example', url: 'https://web.mit.edu/16.unified/www/FALL/thermodynamics/notes/node136.html'},
    {title: 'OpenStax College Physics 2e: radiation and emissivity', url: 'https://openstax.org/books/college-physics-2e/pages/14-7-radiation'},
    {title: 'Royal Institution: James Dewar’s vacuum flask', url: 'https://www.rigb.org/explore-science/explore/collection/james-dewars-vacuum-flask'},
  ],
  quiz: {
    question: 'At the start of this model’s default 90°C trial, which path carries the most heat?',
    options: ['Through the closed top.', 'Through gas in the evacuated gap.', 'By radiation between the silvered walls.'],
    answer: 0,
    explanation: 'The chosen closed-top conductance carries 1.40 W of the 1.96 W total. This ranking follows the selected parameters; damaging the vacuum or silvering can make another path larger.',
  },
};
