import {bathroomScaleLesson} from './bathroom-scale-lesson.js';
import {platformScaleLesson} from './platform-scale-lesson.js';
import {robervalBalanceLesson} from './roberval-balance-lesson.js';
import {pendulumClockLesson} from './pendulum-clock-lessons.js';
import {watchLesson} from './watch-lessons.js';
import {liquidThermometerLesson, sixThermometerLesson} from './thermometer-lessons.js';
import {quartzClockLesson, kineticWatchLesson} from './quartz-lessons.js';
import {waterClockLesson} from './water-clock-lesson.js';
const s=rows=>rows.map(([title,body])=>({title,body})),p=rows=>rows.map(([name,role])=>({name,role}));
const e=(title,instruction,observe,values)=>({title,instruction,observe,values});
const q=(question,options,answer,explanation)=>({question,options,answer,explanation});
const src=(title,url)=>({title,url});
const springSource=src('OpenStax: oscillations and spring forces','https://openstax.org/books/college-physics-2e/pages/16-1-hookes-law-stress-and-strain-revisited');
const clockSource=src('NIST: timekeeping and clocks','https://www.nist.gov/pml/time-and-frequency-division/timekeeping-and-clocks-faqs');
const scale={
 simple:'Your weight moves a spring, and a calibrated mechanism turns that movement into a reading.',
 overview:'A mechanical platform scale collects the load through supports and levers. The load deforms a measuring spring. A linkage can magnify the small movement and turn a pointer across a calibrated dial. Although the dial commonly displays kilograms, the spring responds to force.',
 steps:s([['Collect the load','The platform transfers the applied force to its supports. Linked levers combine the loads reaching the measuring mechanism.'],['Deflect the spring','In its ideal elastic range, spring force is stiffness multiplied by displacement.'],['Read the calibrated motion','A rack, pinion, or similar linkage turns small travel into pointer movement. The zero adjustment aligns the unloaded reading.']]),
 parts:p([['Platform','Receives and distributes the load.'],['Levers','Transfer the combined force to the measuring element.'],['Measuring spring','Deflects under load.'],['Dial and pointer','Display a calibrated value.'],['Zero adjustment','Shifts the reference reading.']]),
 tryIt:[e('Read force and mass','Set 60 kg and effective stiffness 20000 N/m.','The force is 588.6 N and effective compression is 29.4 mm.',{mass:60,stiffness:20000,tare:0}),e('Adjust the zero','Keep 60 kg but subtract a 5 kg offset.','The indicated mass is 55 kg; the physical load and compression are unchanged.',{mass:60,stiffness:20000,tare:5})],
 deeper:[{title:'Platform scale',body:'A larger mechanical platform scale can use compound levers to reduce the force arriving at a spring or balance beam. Equal or compensating lever ratios help make the result insensitive to where a load stands. Modern platform scales often use electronic load cells instead.'},{title:'Scale calibrating plate',body:'A mechanical adjustment may shift a plate or linkage to set the unloaded dial position. Zeroing corrects an offset. It does not automatically correct an incorrect scale factor, nonlinear spring response, or friction.'},{title:'Mass and weight',body:'Weight is a force, mg. A spring scale marked in kilograms assumes a gravitational acceleration when converting force to mass. An equal-arm balance compares masses differently because the same local gravity acts on both sides.'}],
 misconception:'Zeroing is not the same as calibrating the full measurement range.',
 limits:'The levers and spring are represented by one effective stiffness. The dial is assumed recalibrated when stiffness changes. Friction, hysteresis, and off-center load errors are omitted.',sources:[springSource],
 quiz:q('A 5 kg zero offset is subtracted while the load stays fixed. What changes?',['The indicated reading, not the actual load.','The actual gravitational force becomes smaller.','The spring stiffness doubles.'],0,'An offset changes the displayed reference. It does not remove physical weight.')};
const mechanical={
 simple:'An oscillator sets the rhythm while an escapement lets a powered gear train advance a little at a time.',
 overview:'A mechanical clock separates the source of energy from the source of timing. A weight or mainspring drives the wheel train. The escapement alternately locks and releases that train, transferring small impulses to a pendulum or balance oscillator so that friction does not stop it.',
 steps:s([['Store energy','A raised weight or wound mainspring provides energy to the gear train.'],['Release one step','The escapement lets a tooth pass at the appropriate phase of the oscillator.'],['Replenish the oscillator','A small impulse replaces some energy lost to friction and air resistance.'],['Count the motion','Further gearing converts repeated releases into the movement of the hands.']]),
 parts:p([['Energy store','Powers the mechanism.'],['Wheel train','Transmits energy and divides motion.'],['Escape wheel','Advances in controlled steps.'],['Pallets or lever','Alternately lock and release the wheel.'],['Oscillator','Provides the repeating timing motion.']]),
 tryIt:[e('Compare pendulum lengths','Use a one-meter pendulum and inspect the period.','A small swing takes about 2.006 seconds for a full cycle.',{length:1,seconds:0}),e('Shorten the pendulum','Change length to 0.25 m.','The period halves, so the ideal clock would run twice as fast without recalibration.',{length:.25,seconds:0})],
 deeper:[{title:'Anchor escapement',body:'An anchor-shaped part carries two pallets. As the pendulum swings, one pallet releases a tooth while the other approaches its locking position. Tooth shapes and impulse surfaces determine how the wheel and pendulum exchange energy. The model separates the motions for inspection.'},{title:'Mechanical watch',body:'A portable watch normally uses a balance wheel and hairspring instead of a gravity pendulum. Its lever escapement transfers impulses to the balance and locks the escape wheel between impulses. This supports timekeeping while the case changes orientation.'},{title:'Small-angle pendulum timing',body:'For small swings, the ideal period is T = 2π√(L/g). Mass cancels out of this formula. Large swings, air resistance, temperature changes, and suspension details introduce corrections.'}],
 misconception:'The gear train supplies energy, but its unconstrained speed is not the clock’s timing standard. The oscillator and escapement regulate its progress.',
 limits:'The pictured teeth and pallets are a slow-motion teaching layout, not a manufacturable escapement. The period calculation is ideal; losses, backlash, and impulse disturbances are omitted.',sources:[clockSource,src('OpenStax: the simple pendulum','https://openstax.org/books/college-physics-2e/pages/16-4-the-simple-pendulum')],
 quiz:q('In the small-angle ideal, multiplying pendulum length by four makes the period…',['Twice as long.','Four times as long.','Half as long.'],0,'The period is proportional to the square root of length.')};
const quartz={
 simple:'A quartz crystal gives a steady electrical rhythm, and a circuit counts the cycles.',
 overview:'A quartz resonator couples mechanical vibration and electricity through the piezoelectric effect. An oscillator circuit sustains vibration near its resonance. A common watch frequency is 32768 Hz, chosen because fifteen successive halvings produce one pulse per second. A motor and gear train can turn those pulses into hand motion.',
 steps:s([['Power the circuit','A battery or stored charge supplies energy; it does not determine the precise beat rate.'],['Sustain the resonance','The electronic circuit reinforces the quartz resonator’s vibration.'],['Divide the frequency','Binary divider stages count pairs of pulses, successively halving the rate.'],['Drive the display','A pulse can advance a step motor, or timing logic can update a digital display.']]),
 parts:p([['Quartz resonator','Provides a stable mechanical resonance.'],['Oscillator circuit','Sustains the vibration.'],['Divider chip','Counts the cycles down to useful timing signals.'],['Step motor and gears','Advance analog hands.']]),
 tryIt:[e('Count one minute','Move elapsed seconds from zero to 60.','The second hand makes one complete revolution.',{seconds:60,drift:0}),e('Introduce a small frequency error','Set the hypothetical error to +10 ppm.','The clock gains 0.864 seconds in one day.',{seconds:30,drift:10})],
 deeper:[{title:'Piezoelectricity',body:'In a piezoelectric material, deformation and electric polarization are coupled. A voltage can deform the crystal, and a deformation can produce an electrical response. The oscillator uses this two-way coupling to access a mechanical resonance electrically.'},{title:'Quartz oscillator',body:'The resonator is part of a feedback circuit. The circuit must supply enough energy to replace losses while keeping the amplitude controlled. Temperature, aging, and mechanical stress can shift the resonance; quartz timing is stable, not perfect.'},{title:'Kinetic quartz watch',body:'Wrist movement turns a weighted rotor and miniature generator. The generated energy is stored electrically to power an otherwise quartz-regulated movement. Wrist motion supplies energy; it is not the timing reference.'}],
 misconception:'Quartz does not provide free power. A circuit must supply energy to sustain its oscillation.',
 limits:'The 32768 Hz resonator and divider are described, not animated at their true speed. Frequency-error controls use a constant hypothetical ppm offset; battery chemistry and temperature compensation are omitted.',sources:[clockSource],
 quiz:q('What does the wrist rotor do in a kinetic quartz watch?',['Supplies energy to a generator.','Sets every second directly from wrist speed.','Replaces the need for a timing circuit.'],0,'The rotor replenishes stored energy. The quartz oscillator still sets the rhythm.')};
const thermometer={
 simple:'A liquid expands with temperature, and a narrow tube makes that expansion easy to see.',
 overview:'A liquid-in-glass thermometer has a reservoir connected to a narrow bore. Heating changes the liquid volume more than it changes the container volume. The difference moves the liquid column. Calibration associates its position with temperature.',
 steps:s([['Exchange heat','The bulb approaches the temperature of its surroundings. A real thermometer takes time to respond.'],['Expand relative to the glass','The liquid’s volume change displaces liquid into or out of the bore.'],['Read the calibrated level','A narrow bore gives a larger height change for the same displaced volume.']]),
 parts:p([['Bulb','Holds most of the thermometric liquid.'],['Bore','Converts volume change to height change.'],['Column','Provides a visible position.'],['Scale','Maps position to temperature through calibration.']]),
 tryIt:[e('Warm the bulb','Change temperature from 20 °C to 35 °C.','The indicated column rises.',{temperature:35,boreArea:1}),e('Compare bore areas','Double the relative bore area.','The height sensitivity for the same expansion is halved; the displayed temperature remains calibrated.',{temperature:35,boreArea:2})],
 deeper:[{title:'Maximum-minimum thermometer',body:'Traditional Six’s thermometers use a U-shaped tube and movable indices to remember extremes. Expanding and contracting liquid moves a separating column, pushing one index on warming and the other on cooling. The indices remain until reset. The companion model uses straight-scale markers to expose this memory function without imitating the full U-tube geometry.'},{title:'Response takes time',body:'The reading tracks the thermometer’s own temperature. The bulb must exchange energy with what it measures before their temperatures are close. A large bulb or weak thermal contact can delay the response.'}],
 misconception:'The liquid does not measure temperature because hot material rises under gravity. Differential thermal expansion moves the column.',
 limits:'An imposed temperature and calibrated linear scale are used. The drawing is not a particular thermometric liquid or a dimensional expansion calculation; response delay and nonlinear calibration are omitted.',sources:[src('OpenStax: thermal expansion','https://openstax.org/books/college-physics-2e/pages/13-2-thermal-expansion-of-solids-and-liquids')],
 quiz:q('For the same displaced liquid volume, doubling bore area gives…',['Half the column-height change.','Twice the column-height change.','No column-height change.'],0,'Displaced volume equals bore area multiplied by height change.')};
export const timeLessons={
 'Bathroom scale':bathroomScaleLesson,
 'Platform scale':platformScaleLesson,
 'Roberval balance':robervalBalanceLesson,
 'Mechanical clock':pendulumClockLesson,
 'Mechanical watch':watchLesson,
 'Liquid-in-glass thermometer':liquidThermometerLesson,
 'Maximum-minimum thermometer':sixThermometerLesson,
 'Kinetic quartz watch':kineticWatchLesson,
 'Quartz clock':quartzClockLesson,
 'Water clock':waterClockLesson,
};
