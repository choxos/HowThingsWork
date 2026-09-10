import {hornLesson} from './horn-lesson.js';

export const hornComponentLessons={
 'Electric-horn moving iron bar':{
  simple:'What carries the magnetic pull to the diaphragm? Follow the moving bar inside the fixed coil.',
  overview:'The horn’s iron bar is fastened to the center of the flexible diaphragm. The coil surrounds the bar and a fixed iron pole above it. When current flows, attraction pulls the bar toward that pole, bending the diaphragm without moving its clamped rim. The bar also carries an insulated actuator that opens the contact. When current fades, the diaphragm returns the bar and allows the contact to close again.',
  steps:[
   {title:'Locate the center fixing',body:'The lower end of the bar is bolted through the diaphragm center. Keep the surrounding assembly visible to compare the moving bar with the fixed coil and frame.'},
   {title:'Follow the axial stroke',body:'Advance several steps. The bar moves along its length toward the fixed pole. Its center fixing carries the diaphragm with it; the diaphragm rim stays clamped.'},
   {title:'Leave clearance for movement',body:'Look inside the coil. The bar approaches the pole across an air gap and passes through the winding’s center. Normal motion does not require either a pole impact or rubbing against the coil.'},
   {title:'Operate the interrupter',body:'The collar and its insulated tab rise with the bar. The tab lifts the contact leaf, interrupting the current responsible for the magnetic pull.'},
   {title:'Return and repeat',body:'Press Play. The diaphragm’s spring action returns the bar as current fades. Compare repeated vibration with a bypassed held position or a weak pull.'},
  ],
  parts:[
   {name:'Moving iron bar',role:'Translates along the coil axis under magnetic attraction.'},
   {name:'Diaphragm center fixing',role:'Joins the bar to the sheet so their center movements stay together.'},
   {name:'Fixed pole and air gap',role:'Provide the stationary magnetic face approached by the moving bar.'},
   {name:'Collar and insulated actuator',role:'Move with the bar and lift the contact leaf.'},
   {name:'Clamped flexible diaphragm',role:'Supports the bar and provides the restoring spring force.'},
  ],
  tryIt:[
   {title:'Carry the pull into diaphragm motion',instruction:'Step forward while comparing the bar’s lower fixing with the diaphragm center. Then press Play.',observe:'The bar and center move together while the coil stays fixed. Nine completed diaphragm cycles produce the normal horn result.',reset:true,part:'moving-bar',view:'front',isolate:false,values:{voltage:12,holdTime:.04,contact:0,sound:0}},
   {title:'Hold the bar toward the pole',instruction:'Use the bypassed circuit. Step through the initial movement or pause while the button is held, then finish the pulse.',observe:'The coil keeps pulling after the contact opens. The bar settles toward a held position and the diaphragm stays bent during the hold, with no sustained make-and-break tone.',reset:true,part:'moving-bar',view:'front',isolate:false,values:{voltage:12,holdTime:.08,contact:2,sound:0}},
   {title:'Make an insufficient stroke',instruction:'Press Play with the weaker supply and compare the stroke with the normal trial.',observe:'The bar moves only a little. Its actuator does not open the interrupter, so the horn never establishes repeated make-and-break vibration.',reset:true,part:'moving-bar',view:'front',isolate:false,values:{voltage:6,holdTime:.04,contact:0,sound:0}},
  ],
  deeper:[
   {title:'An armature that translates',body:'This moving iron member is an armature. The bell’s armature turns about a hinge; this horn’s bar translates with the diaphragm center. Their mounting determines the motion each can make.'},
   {title:'Attraction without a collision',body:'The magnetic field can exert a force across the air gap. The horn’s useful result comes from diaphragm vibration, not from the bar hammering the fixed pole.'},
  ],
  misconception:'The coil stays fixed. The separate iron bar moves inside it and transfers the magnetic pull to the attached diaphragm.',
  limits:hornLesson.limits,
  sources:hornLesson.sources,
  quiz:{question:'Which connection makes the diaphragm center follow the bar?',options:['The bar’s bolted fixing through the diaphragm center.','The wire winding sliding along the housing.','The horn outlet striking the diaphragm.'],answer:0,explanation:'The center fixing joins the bar to the flexible sheet. Magnetic motion of the bar therefore bends the diaphragm while its rim stays clamped.'},
 },
 'Horn make-and-break contacts':{
  simple:'How does a horn interrupt its own current? Follow the insulated actuator from the moving iron bar to the contact leaf.',
  overview:'The horn button supplies power, but a second contact inside the horn controls each vibration. Current attracts the iron bar toward the fixed pole. An insulated tab on the bar lifts a springy contact leaf away from its fixed contact. Current fades, the diaphragm returns the bar, and the leaf closes the circuit again. Repeated interruption sustains the diaphragm motion during the button press.',
  related:['Electromagnetic make-and-break contacts'],
  steps:[
   {title:'Find the separate switch',body:'The leaf is anchored to a fixed support. Its pad touches the adjustable contact below. The insulated actuator beside it belongs to the moving iron bar.'},
   {title:'Build the pull',body:'Advance one step. The button supplies the closed contact and coil. Current builds and attracts the bar toward the pole.'},
   {title:'Lift the leaf',body:'Keep stepping. The actuator reaches the underside of the leaf extension and bends it upward. The contact faces separate and coil current begins to fade.'},
   {title:'Restore the circuit',body:'As attraction weakens, the diaphragm returns the bar. The actuator lowers, allowing the leaf to meet the fixed contact and start another cycle.'},
   {title:'Compare the whole-horn result',body:'Press Play to finish. Compare normal vibration with an open contact or a jumper that leaves the coil powered after the contact opens.'},
  ],
  parts:[
   {name:'Fixed contact and adjuster',role:'Provide the stationary conducting face. Retraction leaves an open gap.'},
   {name:'Anchored leaf and contact pad',role:'Bend away from the fixed contact when lifted by the actuator.'},
   {name:'Insulated actuator',role:'Transfers motion from the bar to the leaf without connecting the bar into the coil circuit.'},
   {name:'Iron bar and diaphragm',role:'Provide the magnetic stroke and elastic return that operate the switch.'},
   {name:'Bypass jumper',role:'Carries current around the contact so its opening no longer interrupts the pull.'},
  ],
  tryIt:[
   {title:'Interrupt and restore the current',instruction:'Advance several steps while comparing the contact gap with the current reading. Then press Play.',observe:'The leaf opens and recloses as the bar and diaphragm move. The completed horn records nine cycles and a sustained tone.',reset:true,part:'contacts',view:'front',isolate:false,values:{voltage:12,holdTime:.04,contact:0,sound:0}},
   {title:'Start with a gap',instruction:'Inspect the retracted fixed contact, then press Play.',observe:'The button cannot complete the coil circuit. No current-driven movement or sustained horn tone develops.',reset:true,part:'contacts',view:'front',isolate:false,values:{voltage:12,holdTime:.04,contact:1,sound:0}},
   {title:'Keep current flowing around the gap',instruction:'Follow the blue jumper and step through the first movement. Compare the open contact with the coil-current reading, then finish the pulse.',observe:'The jumper keeps the coil energized after the contact opens. The bar settles toward a held position during the button press, with no sustained make-and-break tone.',reset:true,part:'contacts',view:'front',isolate:false,values:{voltage:12,holdTime:.08,contact:2,sound:0}},
  ],
  deeper:[
   {title:'One feedback principle, two mechanisms',body:'The bell uses an armature-carried contact tongue and a separate return spring. Here an actuator lifts a leaf anchored to the housing, while the diaphragm returns the iron bar. Both interrupt the current responsible for their own motion.'},
   {title:'Opening is not instantaneous current removal',body:'The coil stores magnetic energy. This teaching model gives its current a short decay time after interruption; it does not calculate sparks or the detailed discharge path.'},
  ],
  misconception:'The horn button stays pressed while the internal contact opens and closes. The repeated switching is driven by the mechanism itself.',
  limits:hornLesson.limits,
  sources:hornLesson.sources,
  quiz:{question:'What directly lifts the horn contact leaf?',options:['The insulated actuator on the moving iron bar.','The fixed coil sliding upward.','The rim of the diaphragm leaving its clamp.'],answer:0,explanation:'The bar carries an insulated actuator. Its upward stroke bends the anchored leaf and separates the contact faces.'},
 },
 'Vibrating horn diaphragm':{
  simple:'How can a sheet make sound and return an iron bar? Compare the diaphragm’s fixed rim with its moving center.',
  overview:'The diaphragm is a thin sheet clamped around its edge. The iron bar is fastened to its center, so magnetic attraction bends the sheet while the rim stays in the housing. That bending stores elastic energy. When the internal contact interrupts the magnetic pull, the sheet springs back and returns the bar. Repeating this motion pushes and pulls on the air, producing the horn’s tone.',
  steps:[
   {title:'Locate the clamped edge',body:'The dark rings hold the diaphragm rim. Keep the housing visible while inspecting the center fixing and iron bar above the sheet.'},
   {title:'Compare rim and center',body:'Advance several steps. The bar and center move together while the edge stays clamped. The diaphragm bends between those two boundaries.'},
   {title:'Follow the return',body:'Keep stepping after the contact opens. As the magnetic pull falls, the bent sheet returns toward its resting shape and moves the bar back.'},
   {title:'Turn repeated bending into sound',body:'Press Play to finish the pulse. The center repeatedly moves on both sides of its resting position. Optional Sound on gives an audible teaching tone at the calculated cycle frequency.'},
   {title:'Distinguish vibration from a held bend',body:'Compare the bypass experiment. A nearly steady pull can keep the sheet deflected, but a held shape does not sustain the normal horn tone.'},
  ],
  parts:[
   {name:'Fixed clamping rings',role:'Hold the sheet’s outer edge against the housing.'},
   {name:'Flexible annular sheet',role:'Bends between the fixed rim and moving center, providing a restoring force.'},
   {name:'Center fixing and iron bar',role:'Move together and transfer magnetic attraction to the sheet.'},
   {name:'Hollow chamber and projector',role:'Connect the diaphragm’s air motion to the open horn outlet.'},
  ],
  tryIt:[
   {title:'Keep the rim fixed while the center vibrates',instruction:'Step through the first stroke and compare the center fixing with the dark clamping rings. Then press Play.',observe:'The center and bar move together; the rim stays fixed. The completed whole-horn view records nine cycles and an established tone.',reset:true,part:'diaphragm',view:'front',isolate:false,values:{voltage:12,holdTime:.04,contact:0,sound:0}},
   {title:'Hold the sheet in a bent shape',instruction:'Step through the bypassed circuit or pause during playback. Compare the raised center with the fixed rim, then finish the pulse.',observe:'After a brief transient, magnetic attraction holds the center deflected. A steady bend does not establish the repeated make-and-break tone.',reset:true,part:'diaphragm',view:'front',isolate:false,values:{voltage:12,holdTime:.08,contact:2,sound:0}},
   {title:'Make a small bend without a full cycle',instruction:'Press Play with the weak supply and watch the center beside its clamp.',observe:'The bar moves the sheet a little, but the motion does not operate the interrupter. No sustained horn tone develops.',reset:true,part:'diaphragm',view:'front',isolate:false,values:{voltage:6,holdTime:.04,contact:0,sound:0}},
  ],
  deeper:[
   {title:'A sound-making part with a mechanical job',body:'The diaphragm both moves air and provides the spring force that returns the armature. This horn does not need a separate return coil spring attached to the iron bar.'},
   {title:'The whole sheet does not translate',body:'A rigid disk moving bodily would require a different support. Here the outer edge is clamped, so the sheet changes shape as its center moves.'},
   {title:'Shape and frequency are different questions',body:'The display uses a smooth bending shape to show the fixed rim and moving center. The cycle frequency comes from the coupled mass, spring, damping, current and contact calculation, not from a complete vibration analysis of a real diaphragm.'},
  ],
  misconception:'The entire diaphragm does not slide up and down as a rigid plate. Its rim stays fixed while the center moves and the intervening sheet bends.',
  limits:hornLesson.limits,
  sources:hornLesson.sources,
  quiz:{question:'Which part stays in place while the diaphragm center vibrates?',options:['The outer rim held by the clamping rings.','The iron bar fastened to the center.','Every point on the diaphragm.'],answer:0,explanation:'The clamped rim stays fixed. The center follows the bar, so the flexible sheet between them bends and supplies the restoring force.'},
 },
};
