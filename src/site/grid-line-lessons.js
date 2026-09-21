import {LINE_DEFAULTS} from './grid-physics.js';
import {sources, lineLimits} from './grid-sources.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

const ladder = trial(LINE_DEFAULTS, 'ladder'), span = trial(LINE_DEFAULTS, 'line'), flow = trial(LINE_DEFAULTS, 'flow');

export const electricityTransmissionLesson = {
  simple: 'Why are power lines run at hundreds of thousands of volts?',
  overview: 'A wire has resistance, and a current through a resistance makes heat. The heat follows the square of the current, so the way to waste less is to carry less current. Power is voltage times current, so the same power can be sent at a small current if the voltage is large: raise the voltage by ten and the current falls by ten and the heat falls by a hundred. That is the whole reason a line is run at a voltage nobody could use. Press Play, then change the voltage, the conductor, the distance and the power.',
  steps: [
    {title: 'Decide what has to arrive', body: 'A town at the far end needs a certain amount of power, whatever happens on the way.'},
    {title: 'Pick a voltage', body: 'The higher the voltage, the smaller the current that carries the same power.'},
    {title: 'Push it through the line', body: 'Each conductor has a resistance that grows with its length and shrinks with its thickness.'},
    {title: 'Pay in heat', body: 'The heat in the line follows the square of the current, so it falls fast as the voltage rises.'},
    {title: 'Send extra to cover it', body: 'The station has to send what arrives plus what is lost, and the difference warms the countryside.'},
  ],
  parts: [
    {name: 'The same power at five voltages', role: 'What is lost at each, all else being equal.'},
    {name: 'The span, at true size', role: 'One length of line between two pylons.'},
    {name: 'One cycle of the current', role: 'The three phases and the heat they make.'},
    {name: 'One pylon, close up', role: 'What holds the conductors up and apart.'},
    {name: 'The insulator string, close up', role: 'What keeps the conductor off the steel.'},
  ],
  tryIt: [
    ladder('Send it at the top voltage', 'Press Play and look at the bars.', '200 MW at 400 kV needs 289 A in each phase, and three conductors of 8.53 Ω waste 2.133 MW: 1.06 percent of what is sent.'),
    ladder('Drop to the middle grid voltage', 'Choose the middle voltage and press Play.', 'A third of the voltage needs three times the current, 875 A, and wastes nine times as much: 19.583 MW, or 8.92 percent.', {voltage: 2}),
    flow('Down to the street voltage', 'Choose the lowest voltage and press Play.', 'At the lowest voltage the same 200 MW would need 10,497 A, which is 1,157 percent of what this conductor is rated for, and 93.38 percent of what was sent would never arrive. Nobody sends power far at this voltage.', {voltage: 0}),
    span('Three times as far', 'Set the length to 300 km and press Play.', 'Three times the length is three times the resistance, 25.59 Ω, and three times the loss: 6.398 MW, or 3.10 percent.', {length: 300}),
    ladder('Three times the power', 'Set the power delivered to 600 MW and press Play.', 'Three times the power needs three times the current, 866 A, and wastes nine times as many watts, 19.193 MW. As a share of what is sent that is 3.10 percent, the same as sending a third of it three times as far.', {power: 600}),
    span('A thinner conductor', 'Choose the thinnest conductor and press Play.', 'The thinnest of the three has three times the resistance, 25.59 Ω, so it wastes 6.398 MW, and the same current is 61 percent of its 475 A rating rather than a third of the thickest one’s.', {conductor: 2}),
    flow('A quiet night', 'Set the power delivered to 50 MW and press Play.', 'A quarter of the power is a quarter of the current, 72 A, and a sixteenth of the loss: 0.133 MW, or 0.27 percent. A line is at its worst on the day it is needed most.', {power: 50}),
  ],
  deeper: [
    {title: 'The square is the whole argument', body: 'The transmission page puts it as plainly as it can be put: Joule’s first law states that energy losses are proportional to the square of the current, so reducing the current by a factor of two lowers the energy lost to conductor resistance by a factor of four for any given size of conductor. Raise the voltage by ten and the current falls by ten and the loss by a hundred.'},
    {title: 'What real lines lose', body: 'The same page gives a worked case: a 160 km span at 765 kV carrying 1,000 MW can have losses of 0.5 to 1.1 percent, while a 345 kV line carrying the same load across the same distance loses 4.2 percent. The bench here loses 1.06 percent over 100 km at 400 kV, and 8.92 percent at 132 kV. Across a whole country, transmission and distribution together came to about 5 percent of what was generated in the United States from 2013 to 2019.'},
    {title: 'Three wires, not two', body: 'Power is sent in three phases a third of a cycle apart, so three conductors carry it instead of two and the power is √3 times the voltage between lines times the current in one of them. The three currents add up to nothing at any instant, which is why no fourth wire is needed to bring them back.'},
    {title: 'What the conductor is made of', body: 'The overhead line page says the most common conductor in use for transmission today is aluminum conductor steel reinforced, and that aluminum is used because it has about half the weight of a comparable resistance copper cable, as well as being cheaper. The aluminum carries the current and the steel core carries the weight. Its temperature is limited to 75 °C, where the aluminum begins to anneal and soften.'},
    {title: 'Why not simply use a thicker wire', body: 'You can, and it costs money and weight and taller towers. Kelvin’s law says the best size is the one where the yearly cost of the energy wasted equals the yearly cost of the extra metal. Raising the voltage is usually cheaper than thickening the wire, which is why voltages went up through the twentieth century rather than conductors getting fatter.'},
    {title: 'The limits at the top end', body: 'Very high voltage is not free either. The transmission page says that above about 2,000 kV between conductor and ground, corona discharge losses are so large that they can offset the lower resistive losses, and that measures against it include larger conductor diameter, hollow cores or conductor bundles. That, and the length of insulator the voltage needs, is what stops the ladder going higher.'},
  ],
  misconception: 'High voltage is not about pushing the power along faster or further. It is about carrying the same power with a smaller current, because it is the current that heats the wire.',
  limits: lineLimits,
  sources: [sources.transmission, sources.overhead, sources.acsr, sources.sheet, sources.distribution, sources.nationalGrid, sources.corona, sources.resistivity],
  quiz: {
    question: 'A line carries the same power at ten times the voltage. What happens to the heat it wastes?',
    options: ['It falls to a hundredth, because the current falls to a tenth and the heat follows its square.', 'It falls to a tenth, because the current falls to a tenth.', 'It stays the same, because the power being sent has not changed.'],
    answer: 0,
    explanation: 'Power is voltage times current, so ten times the voltage needs a tenth of the current for the same power. The heat in a resistance follows the square of the current, so a tenth of the current is a hundredth of the heat.',
  },
};

// ---------------------------------------------------------------------------
// The insulator.
// ---------------------------------------------------------------------------

const disc = trial(LINE_DEFAULTS, 'insulator');

export const powerLineInsulatorLesson = {
  simple: 'Why is the thing hanging a power line from its tower so long?',
  overview: 'A conductor at hundreds of thousands of volts is bolted to a steel tower standing in the ground. Something has to hold it up and keep it apart at the same time, and that something is a string of glass or porcelain discs. It is long for three reasons: air alone would flash over a short gap, a wet or dirty surface will carry a current along itself, and a lightning stroke or a switching surge sends a much higher voltage down the line than it normally carries. Change the voltage and the weather and watch the string answer.',
  steps: [
    {title: 'Hang the conductor from the steel', body: 'The string carries the whole weight of half a span either side.'},
    {title: 'Keep the two ends apart', body: 'Each disc adds the length of air between the cap at the top and the pin at the bottom.'},
    {title: 'Make the surface path long', body: 'The cups underneath fold the surface back on itself, so the way round the outside is far longer than the way straight down.'},
    {title: 'Keep part of it dry', body: 'The cups act as umbrellas, so in rain the underside of each disc stays dry and still insulates.'},
    {title: 'Leave room for surges', body: 'The string has to hold when lightning or a switch pushes the voltage far above normal.'},
  ],
  parts: [
    {name: 'The insulator string, close up', role: 'The discs, the creepage path and how much voltage the string can stand.'},
    {name: 'One pylon, close up', role: 'The steel the string hangs from.'},
    {name: 'The span, at true size', role: 'The conductor it is holding.'},
  ],
  tryIt: [
    disc('Count the discs', 'Press Play and count them.', 'The string has 25 discs, which give 8,020 mm of creepage, or 20.1 mm for every kV between lines.'),
    disc('Rain', 'Choose wet weather and press Play.', 'Wet, the same string stands 903 kV instead of 932 kV, and the current creeping along its surface goes from 0.058 µA to 57.591 µA. Water bridges part of the path the cups were keeping dry.', {weather: 1}),
    disc('A lower voltage', 'Choose the middle voltage and press Play.', 'A third of the voltage needs a third of the string: 9 discs, 2,887 mm of creepage, 1.35 m long. The number of discs is the simplest way there is to read a line’s voltage from the ground.', {voltage: 2}),
    disc('The lowest voltage', 'Choose the lowest voltage and press Play.', 'One disc is enough, and it gives 321 mm of creepage, or 29.2 mm for every kV, which is more than the rule asks: a disc cannot be cut in half.', {voltage: 0}),
    disc('Rain at a lower voltage', 'Choose the middle voltage and wet weather, then press Play.', 'The shorter string stands 378 kV wet instead of 418 kV dry, and leaks 52.791 µA. Its margin falls, but it still holds.', {voltage: 2, weather: 1}),
    disc('Against a bare gap of air', 'Choose the second highest voltage and press Play.', 'This string is 18 discs and 2.70 m long. The peak of the 158.8 kV it stands above earth would jump only 75 mm of clean dry air, so the string is 36 times longer than the bare gap needs. Everything beyond that first 75 mm is there for rain, dirt and surges.', {voltage: 3}),
  ],
  deeper: [
    {title: 'Flashover, not breakdown', body: 'The insulator page distinguishes the two: a flashover arc is a breakdown and conduction of the air around or along the surface of the insulator, while puncture is a breakdown through the material itself. Most high voltage insulators are designed with a lower flashover voltage than puncture voltage, so they flash over before they puncture: the arc outside does no permanent harm, and a hole through the glass would.'},
    {title: 'The long way round', body: 'The page calls the length of the leakage path along the surface from one end to the other the creepage length, and says minimum creepage distances are 20 to 25 mm for every kV. A disc of toughened glass in a maker’s catalog gives 320.8 mm of it in 150 mm of length, because the shape folds the path back on itself. That is why a disc looks like a plate with cups underneath rather than a simple cylinder.'},
    {title: 'Why rain matters so much', body: 'The same page says dirt, pollution, salt and particularly water can create a conductive path across the surface, and that the flashover voltage can be reduced by more than 50 percent when the insulator is wet. The sheds, the downward facing cups, exist so that part of the path stays dry in the rain and keeps its share of the voltage.'},
    {title: 'How many discs a real line carries', body: 'The insulator page lists what real lines use: 3 discs at 34.5 kV, 8 at 138 kV, 14 at 230 kV, 24 at 400 kV and 60 at 765 kV. The creepage rule used here gives 3, 9, 15 and 25 at the first four, close enough to read off; at the highest voltages it gives fewer than real lines carry, because there the string is set by switching surges rather than by creepage.'},
    {title: 'Not one big insulator', body: 'The page explains the reason for a string of identical units: insulator strings with different breakdown voltages can be constructed by using different numbers of the basic units, and if one unit breaks it can be replaced without discarding the entire string. It also notes that a string stands less than the sum of its discs, because the field is strongest at the disc nearest the conductor, which flashes over first; that is what the metal grading rings and corona rings at the ends are for.'},
  ],
  misconception: 'The insulator is not there to stop the current getting out of the wire. The current has nowhere else to go anyway; the insulator is there to stop the voltage finding a path to the earthed steel.',
  limits: lineLimits,
  sources: [sources.insulator, sources.victorDistribution, sources.victorTransmission, sources.overhead, sources.dielectric, sources.corona],
  quiz: {
    question: 'Why is the surface of an insulator disc folded into cups rather than left smooth?',
    options: ['To make the path along the surface long, and to keep part of it dry in the rain.', 'To make the disc stronger so it can carry more weight.', 'To let the wind through so the string does not swing.'],
    answer: 0,
    explanation: 'A wet or dirty surface will carry a leakage current, and the longer the surface path the harder that is. The downward facing cups both lengthen the path and shelter part of it, so some of it keeps insulating even in rain.',
  },
};

// ---------------------------------------------------------------------------
// The pylon.
// ---------------------------------------------------------------------------

const tower = trial(LINE_DEFAULTS, 'pylon');

export const powerPylonLesson = {
  simple: 'What decides how tall a pylon has to be?',
  overview: 'A pylon does two things: it holds the conductors up, and it holds them apart from each other and from the ground. A conductor of even weight hung between two towers takes the shape of a catenary, and how far it dips below its ends depends on how hard it is pulled. The tower has to be tall enough that the lowest point of that dip still clears the ground by a safe margin, with the insulator string and the steel above the crossarm on top of that. Change the span and the pull and watch the height follow.',
  steps: [
    {title: 'Hang the conductor', body: 'A flexible wire of even weight between two points takes the shape of a catenary.'},
    {title: 'Pull it tight, or not', body: 'The harder it is pulled, the shallower the dip, and the harder the pull on everything holding it.'},
    {title: 'Measure the dip', body: 'The sag is how far the lowest point falls below the points it hangs from.'},
    {title: 'Keep the ground clear', body: 'The lowest point has to stay a safe distance above anything underneath.'},
    {title: 'Add everything above', body: 'The insulator string and the steel above the top crossarm sit on top of the clearance and the sag.'},
  ],
  parts: [
    {name: 'One pylon, close up', role: 'The steel, the string, the clearance and the weight it carries.'},
    {name: 'The span, at true size', role: 'The whole span, so the dip can be seen as it really is.'},
    {name: 'The insulator string, close up', role: 'What hangs between the steel and the conductor.'},
  ],
  tryIt: [
    tower('How far it dips', 'Press Play and look at the span above.', 'Pulled this hard the conductor follows a catenary whose constant is 1,755 m, so over a 400 m span it dips 11.41 m and the wire itself is 400.87 m long. The tower comes to 26.2 m, and each support carries 3.20 kN of conductor.'),
    tower('A longer span, hung slack', 'Set the span to 500 m and the tension to 12 percent, then press Play.', 'A longer span hung slacker dips much further, 29.81 m, and needs 504.71 m of wire. The tower has to grow to 44.6 m, near the top of what real lattice towers reach, and each support now carries 4.03 kN.', {span: 500, tension: 12}),
    tower('A short span, pulled tight', 'Set the span to 200 m and the tension to 30 percent, then press Play.', 'Short and tight, the dip is only 1.90 m and the tower need be 16.6 m. But the conductor is now pulled at 42.1 kN where it meets the tower, and everything holding it has to take that.', {span: 200, tension: 30}),
    tower('Pull the same span tighter', 'Set the tension to 30 percent and press Play.', 'On the same span, pulling harder cuts the dip from 11.41 m to 7.60 m and the tower from 26.2 m to 22.3 m. The price is the pull itself: 42.0 kN, which is 30 percent of the 140.1 kN that would break the conductor.', {tension: 30}),
    tower('A lighter conductor', 'Choose the thinnest conductor and press Play.', 'A lighter wire pulled to the same share of its own strength dips 10.83 m, much as before, but each support now carries only 1.07 kN instead of 3.20 kN. The shape follows the ratio of pull to weight, and both have shrunk together.', {conductor: 2}),
    tower('A longer span at the same pull', 'Set the span to 500 m and press Play.', 'At the same pull, a longer span dips further: 17.83 m, and the tower grows to 32.6 m. Each support also carries more, 4.00 kN, because it is holding half of a longer span.', {span: 500}),
  ],
  deeper: [
    {title: 'The shape it hangs in', body: 'The overhead line page says that since a conductor is a flexible object with uniform weight per unit length, the shape between two towers approximates a catenary, and that the sag varies with temperature and with ice. The catenary has one number in it, the horizontal pull divided by the weight for every meter: here 28.0 kN against 15.97 N for every meter gives 1,755 m, and everything else follows from that and the span.'},
    {title: 'The trade the line designer makes', body: 'Pull harder and the wire dips less and the towers can be shorter or further apart. Pull harder and the wire, the fittings and the towers all carry more, and the wire has less room to take up the extra length it gains on a hot day. The pull is always a fraction of what would break the conductor: 20 percent of 140.1 kN here.'},
    {title: 'Why the wire is longer than the span', body: 'A wire that dips is longer than the straight line between its ends: 400.87 m of wire across a 400 m span. It is not much, but it is exactly the slack that lets the wire lengthen when it warms up in summer and carries a heavy current, and that is why sag is quoted for the hottest condition rather than the coldest.'},
    {title: 'What the tower actually carries', body: 'Where the line runs straight, the pull of the conductor on one side balances the pull on the other, so what is left for the tower is the weight of half a span either side: 3.20 kN here for each conductor. A tower at a corner, or at the end of a line, has to take the whole unbalanced pull instead, which is why those towers are visibly heavier.'},
    {title: 'How tall they really are', body: 'The transmission tower page says heights typically range from 15 to 55 m, although taller towers are used for long spans such as water crossings. The tallest spans are extraordinary: the Sognefjord crossing in Norway is 4,597 m between two masts. The bench here builds its height out of the clearance, the sag, the string and the steel above the crossarm, and stays inside that range over most of its settings.'},
  ],
  misconception: 'A pylon is not mainly there to hold the wire up against its own weight. Most of its height is there to keep the lowest point of the dip clear of the ground, and most of its width to keep the conductors away from each other and from the steel.',
  limits: lineLimits,
  sources: [sources.tower, sources.overhead, sources.sheet, sources.acsr, sources.insulator],
  quiz: {
    question: 'The same conductor is hung across the same span, but pulled harder. What happens?',
    options: ['It dips less, so the tower can be shorter, and everything holding it takes more force.', 'It dips less, and the force on the towers falls too.', 'It dips the same, because the dip depends only on the span.'],
    answer: 0,
    explanation: 'The shape depends on the pull divided by the weight for every meter. More pull is a flatter curve and a shallower dip, and the pull itself is what the conductor, the fittings and the tower have to carry.',
  },
};
