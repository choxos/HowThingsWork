import {sparkGapLesson} from './spark-gap-lesson.js';
import {solenoidLesson} from './solenoid-lesson.js';
import {sparkPlugLesson} from './spark-plug-lesson.js';
import {ignitionCoilWindingsLesson} from './ignition-coil-windings-lesson.js';
import {inductionCoilLesson} from './induction-coil-lesson.js';
import {distributorLesson} from './distributor-lesson.js';
import {contactBreakerIgnitionLesson} from './contact-breaker-ignition-lesson.js';
import {carIgnitionLesson} from './car-ignition-lesson.js';
import {powerPylonLesson} from './power-pylon-lesson.js';
import {powerLineInsulatorLesson} from './power-line-insulator-lesson.js';
import {homeSupplyTransformerLesson} from './home-supply-transformer-lesson.js';
import {distributionTransformerLesson} from './distribution-transformer-lesson.js';
import {transmissionTransformerLesson} from './transmission-transformer-lesson.js';
import {electricityTransmissionLesson} from './electricity-transmission-lesson.js';
import {transformerTurnsRatioLesson} from './transformer-turns-ratio-lesson.js';
import {transformerLesson} from './transformer-lesson.js';
import {generatorSlipRingsLesson} from './generator-slip-rings-lesson.js';
import {dcGeneratorLesson} from './dc-generator-lesson.js';
import {acGeneratorLesson} from './ac-generator-lesson.js';
import {electricGeneratorLesson} from './electric-generator-lesson.js';
import {printerLesson} from './printer-lesson.js';
import {cadDesignLesson} from './cad-design-lesson.js';
import {laserScanningLesson} from './laser-scanning-lesson.js';
import {threeAxisLesson} from './three-axis-lesson.js';
import {stepperMotorLesson} from './stepper-motor-lesson.js';
import {electricMotorLesson} from './electric-motor-lesson.js';
import {universalMotorLesson} from "./universal-motor-lesson.js";
import {dcMotorLesson} from './dc-motor-lesson.js';
import {electromagnetLesson} from './electromagnet-lesson.js';
import {hornLesson} from './horn-lesson.js';
export const dailyLifeLessons = {
  'Spark gap':sparkGapLesson,
  'Solenoid':solenoidLesson,
  'Spark plug':sparkPlugLesson,
  'Ignition-coil primary and secondary windings':ignitionCoilWindingsLesson,
  'Induction coil':inductionCoilLesson,
  'Distributor':distributorLesson,
  'Contact-breaker ignition':contactBreakerIgnitionLesson,
  'Car ignition system':carIgnitionLesson,
  'Power pylon':powerPylonLesson,
  'Power-line insulator':powerLineInsulatorLesson,
  'Home-supply transformer':homeSupplyTransformerLesson,
  'Distribution transformer':distributionTransformerLesson,
  'Transmission transformer':transmissionTransformerLesson,
  'Electricity transmission':electricityTransmissionLesson,
  'Transformer turns ratio':transformerTurnsRatioLesson,
  'Transformer':transformerLesson,
  'Generator slip rings':generatorSlipRingsLesson,
  'DC generator':dcGeneratorLesson,
  'AC generator':acGeneratorLesson,
  'Electric generator':electricGeneratorLesson,
  'Laser scanning of 3D objects':laserScanningLesson,
  'Computer-aided design':cadDesignLesson,
  'Three-axis positioning':threeAxisLesson,
  '3D printer':printerLesson,
  'Stepper motor':stepperMotorLesson,
  'Electric motor':electricMotorLesson,
  "Universal motor":universalMotorLesson,
  'Direct-current motor':dcMotorLesson,
  'Electromagnet':electromagnetLesson,
  'Electric horn':hornLesson,
  'Cylinder lock': {
    simple: 'The right key lines up five tiny joints. Turn it to pull the latch out of the frame, then open the door.',
    overview: 'A pin-tumbler cylinder is a mechanical permission check. Its fixed shell surrounds a rotating plug. Spring-loaded pairs of pins normally cross the boundary between them. The key must put every pin joint on that boundary, called the shear line. Turning the freed plug then drives the latch mechanism. In this example, a cam pulls back a sliding bolt.',
    steps: [
      {title:'Start with a blocked plug',body:'With the key out, at least one pin crosses the shear line. That solid obstacle prevents the plug from rotating inside the shell.'},
      {title:'Slide in the key',body:'Sloping cuts push the lower pins upward. Each cut has a different height because its matching lower pin has a different length.'},
      {title:'Check every joint',body:'When the key is fully seated, the joints between lower and upper pins meet the shear line together. One incorrect cut leaves an obstruction.'},
      {title:'Turn, retract, then open',body:'The key turns the plug and its attached cam. The cam roller travels inside a vertical slot: its sideways motion pulls the latch inward against a spring. Once the latch clears the frame, the door can swing open.'},
      {title:'Close and lock again',body:'Keep the latch retracted while closing the door. Return the key to zero: the latch spring extends the bolt into the frame. Withdraw the upright key and watch the pin springs restore the blocking arrangement.'},
    ],
    parts: [
      {name:'Key cuts',role:'Set the individual pin heights when the key is fully inserted.'},
      {name:'Lower and upper pins',role:'Form pairs whose joints must clear the boundary of the rotating plug.'},
      {name:'Pin springs',role:'Keep the pins following the key and restore them when it leaves.'},
      {name:'Plug and shell',role:'The plug turns inside the stationary shell; their boundary is the shear line.'},
      {name:'Cam and slotted follower',role:'A roller in a vertical slot transfers sideways cam movement to the sliding latch.'},
      {name:'Latch and return spring',role:'The latch engages the frame. Turning the cam retracts it and compresses its return spring.'},
      {name:'Door, hinges and strike',role:'The door carries the lock; the fixed strike holds the extended latch. Retraction makes room for the door to open.'},
    ],
    tryIt: [
      {title:'Open the door',instruction:'Start with the matching key withdrawn. Run Run selected action, or advance it in small steps.',observe:'The key aligns the pins, the cam retracts the latch, and the door swings open.',reset:true,values:{insertion:0,keyPattern:0,turn:0,door:0}},
      {title:'One cut is enough',instruction:'Start again with one incorrect cut. Run the same opening action.',observe:'One pin joint misses the shear line. The plug, latch and door stay still.',reset:true,values:{insertion:0,keyPattern:1,turn:0,door:0}},
      {title:'Right key, wrong position',instruction:'Pause with the matching key halfway in and request a turn.',observe:'The cuts are not beneath their intended pins, so the plug is blocked. Return the turn request to zero before continuing insertion.',reset:true,values:{insertion:0.5,keyPattern:0,turn:70,door:0}},
      {title:'Close and relock',instruction:'Start with the door open and latch retracted. Run the selected closing action, or advance it in steps.',observe:'The door closes first. The latch spring returns the cam, then withdrawing the key lets the pin springs restore the obstruction.',reset:true,values:{operation:1,insertion:1,keyPattern:0,turn:80,door:65}},
    ],
    deeper: [
      {title:'Permission and power are separate',body:'The pin arrangement permits movement; it does not supply the energy for it. Your hand supplies the turning effort, or torque. The cam changes how that motion reaches the bolt.'},
      {title:'Why insertion matters',body:'A key encodes both heights and positions. Sliding a correct pattern along the keyway puts different slopes beneath the pins. The insertion stop provides a repeatable reference position, much like placing a ruler at the same starting mark.'},
    ],
    misconception: 'A key does not simply lift all pins as high as possible. Both a joint that is too high and one that is too low can block the plug.',
    limits: 'An enlarged five-pin cylinder drives an illustrative roller-and-slot spring latch. The door panel and half-cylinder walls are removed in the cutaway. Other locks use different cam and latch linkages. The flat cuts allow a small seating range; alignment of the actual joints determines whether the plug can turn. An 80° stop avoids the roller linkage’s dead-center position. Motion is prescribed by geometry: friction, spring torque, pin-tip curvature, wear and latch bevels are not simulated. Close this square latch with the key turned to retract it.',
    sources: [{title:'Schlage: cylinder components and terminology',url:'https://www.schlage.com/content/dam/sch-us/documents/pdf/installation-manuals/P513-325.pdf'}],
    quiz: {question:'Four pin joints line up, but one does not. What happens when the key tries to turn?',options:['The plug is still blocked.','The four correct pins pull the fifth into place.','The cam turns while the plug stays still.'],answer:0,explanation:'Every obstruction must clear the shear line. A single pin crossing it still joins the rotating and stationary parts.'},
  },
  'Lever lock': {
    simple: 'Why does lifting every plate still fail with the wrong key? Try its shoulders, follow the bolt, and open the door.',
    overview: 'Three spring-held lever plates guard a sliding deadbolt. The key has a different shoulder for each plate. As it turns, the shoulders lift the plates until their narrow gates share a clear path for the bolt stump. A separate drive shoulder then presses the bolt slot. Finish the turn: the springs lower the levers into the other end pockets, keeping the bolt retracted while you remove the key and open the door.',
    steps: [
      {title:'Start with the door held shut',body:'The extended deadbolt enters the fixed frame. Its stump rests in the right-hand pockets of the lever plates; the narrow connecting gates are obstructed.'},
      {title:'Insert and turn the shaped key',body:'The three shoulders contact the lower lands of the plates. Each plate rotates about the same fixed pivot by a different amount. There is no separate lever-lifting control.'},
      {title:'Watch the drive take up its free movement',body:'Near 90 degrees the matching shoulders hold every gate clear. The drive roller crosses the wide bolt slot without moving the bolt yet.'},
      {title:'Pull the bolt clear',body:'From 180 to 270 degrees, the roller pushes the left slot wall and retracts the bolt. The stump passes through all three gates. A wrong shoulder blocks this part of the turn.'},
      {title:'Finish, withdraw and open',body:'At 360 degrees the shoulders have moved away, the springs have lowered the plates, and the stump rests in the left pockets. The key comes out while the deadbolt stays retracted. Open the door to see the useful result.'},
      {title:'Close and relock',body:'Close the door, insert the matching key, and reverse the full turn. This time the roller pushes the other slot wall, extending the bolt. The springs restore the barriers before the key is removed.'},
    ],
    parts: [
      {name:'Three key shoulders',role:'Contact separate lever lands; their radii determine the held angles.'},
      {name:'Lever tumblers and fixed pivot',role:'Rotate by different amounts while remaining attached to the case.'},
      {name:'Gates and end pockets',role:'A narrow route controls travel; larger pockets allow the plates to settle at either bolt position.'},
      {name:'Bolt stump',role:'A peg attached to the bolt that must pass through every plate opening.'},
      {name:'Drive shoulder and bolt slot',role:'Transfer key rotation to straight bolt motion after an initial free movement.'},
      {name:'Leaf return springs',role:'Bear on the plates and return them after their key shoulders pass.'},
      {name:'Deadbolt, strike and door',role:'Make the outcome visible: an extended bolt holds the door, and a retracted bolt allows passage.'},
    ],
    tryIt: [
      {title:'A wrong shoulder stops the drive',instruction:'This key has one shoulder too high. Run the selected opening action.',observe:'All three levers rise, but the middle gate misses the path. The turn stops at the drive stage and the door remains shut.',reset:true,values:{operation:0,keyPattern:1,insertion:0,turn:0,door:0}},
      {title:'Aligned, but not moving yet',instruction:'The matching key is inserted and turned to 135 degrees. Inspect the key drive and then advance it.',observe:'The gates are already clear. The roller must reach the side of its slot before the bolt moves.',reset:true,values:{operation:0,keyPattern:0,insertion:1,turn:135,door:0}},
      {title:'Let the springs reset the plates',instruction:'The bolt is fully retracted at 270 degrees. Advance to the end of the turn.',observe:'The plates lower into their end pockets while the deadbolt stays retracted. The key can then come out.',reset:true,values:{operation:0,keyPattern:0,insertion:1,turn:270,door:0}},
      {title:'Open the doorway',instruction:'Start from the matching key and run the selected action.',observe:'The key drives the whole sequence and comes out. The door opens only once the bolt clears the strike.',reset:true,values:{operation:0,keyPattern:0,insertion:0,turn:0,door:0}},
    ],
    deeper: [
      {title:'One turn, several jobs',body:'The shoulder sectors have a rounded working edge. Once each edge supports its lever, more key rotation can keep that plate at the same angle while the separate drive shoulder moves the bolt. Later the shoulder passes out from under the land and the spring lowers the plate.'},
      {title:'A deadbolt keeps its position',body:'The lever springs restore the barriers, not the bolt position. End pockets let the levers drop around the stump at either end of its travel. Reversing the key is what drives the bolt back.'},
      {title:'Clearance is a shared condition',body:'Every gate must admit the same stump. A shoulder that lifts its plate too far can obstruct the path just as a shoulder that lifts too little can.'},
    ],
    misconception: 'Raising all the plates does not unlock the mechanism. Each narrow gate must align, and the key still has to move the deadbolt clear of the frame.',
    limits: 'Enlarged conventional fixed-pivot, bolt-mounted-stump study. The three broad circular-sector key shoulders and roller in a wide, open-bottom slot are explicit teaching geometry for contact, dwell and drive; they are not a manufactured key or a reproduction of a particular commercial lock. Lever contact and gate clearance constrain the motion; spring shape and return are prescribed without a force, friction, wear or security-rating calculation.',
    sources: [{title:'Lever dead-locks: fixed pivots, key shoulders, gates and bolt drive',url:'https://patents.google.com/patent/GB2228286A/en'}],
    quiz: {question:'After a full opening turn, why can the key come out while the bolt stays retracted?',options:['The lever springs pull the bolt outward.','The stump rests in the other end pockets while the springs lower the levers.','The door frame moves away from the bolt.'],answer:1,explanation:'The springs return the lever plates. The bolt remains at its selected end position, held by the lowered plates, until a matching key aligns the gates and drives it again.'},
  },
  'Keys': {
    simple: 'Can one changed cut stop a key from opening the door? Edit its shape, insert it, and test the result.',
    overview: 'This cutaway turns a pin-cylinder key into a small design experiment. Select one cut, change its height, and watch why a nearly matching key can fail. Withdraw the key before editing; its shape stays fixed while inserted. A matching pattern frees the plug, and turning the key drives the cam that retracts the latch. Run the action to open the whole door. This lesson uses a pin-cylinder key; the related lever-lock key lifts pivoting plates instead.',
    steps: [
      {title:'Choose a cut while the key is out',body:'Select one of five positions, counted from the blade tip toward the bow. Raise or lower that cut. The other four retain their matching heights.'},
      {title:'Locate the cuts',body:'Seating the key places each cut beneath its intended pin. The spaces between cuts matter as well as their heights.'},
      {title:'Translate shape into height',body:'As the blade advances, its slopes lift the pins. Once seated, the cut surfaces establish the final heights.'},
      {title:'Test one change',body:'Seat the edited key. A high cut leaves its lower pin across the boundary; a low cut leaves the upper driver across it. Compare the joint with the blue guide before trying to turn.'},
      {title:'Turn a matching pattern',body:'Run Unlock and open with the matching pattern. The plug turns, the latch clears the strike and the door opens. Close and relock returns the plug upright before withdrawing the key.'},
    ],
    parts: [
      {name:'Bow',role:'The handle held between your fingers.'},
      {name:'Blade',role:'The portion that enters the keyway and carries the cut pattern.'},
      {name:'Cuts or bitting',role:'The sequence of heights that corresponds to the lock’s pin lengths.'},
      {name:'Selected pin pair',role:'Shows how changing one cut affects one joint.'},
      {name:'Shear line',role:'The boundary that all the pin joints must clear to permit rotation.'},
    ],
    tryIt: [
      {title:'Open with a matching shape',instruction:'Start with the matching key out and the cut change at zero. Run Unlock and open.',observe:'The key inserts, all five joints align, the plug turns and the door opens.',reset:true,part:'lock',view:'side',values:{insertion:0,selectedPin:3,cutError:0,turn:0,door:0}},
      {title:'Raise one cut',instruction:'Start with cut 3 raised by 0.12 model units. Run the action, then inspect pin stack 3.',observe:'The key seats, but the lower pin crosses the boundary. Rotation and door opening remain blocked.',reset:true,part:'pins',view:'side',values:{insertion:0,selectedPin:3,cutError:0.12,turn:0,door:0}},
      {title:'Lower the same cut',instruction:'Start with cut 3 lowered by 0.12 model units. Run the action and inspect the same joint.',observe:'Now the upper driver bridges the boundary. Too low blocks the plug just as too high does.',reset:true,part:'pins',view:'side',values:{insertion:0,selectedPin:3,cutError:-0.12,turn:0,door:0}},
      {title:'Repair and use your key',instruction:'Start with the lowered cut and key out. Restore Change selected cut to zero, then run the opening action.',observe:'Restoring the shape aligns every joint and lets the same connected mechanism open the door.',reset:true,part:'lock',view:'side',values:{insertion:0,selectedPin:3,cutError:-0.12,turn:0,door:0}},
    ],
    deeper: [
      {title:'Shape can carry information',body:'The useful message is the ordered pattern, not the key’s color or decoration. Selecting a different pin changes which position you are editing, like changing one character in a password.'},
      {title:'Precision has a practical limit',body:'Real parts need small clearances to move. Wear and manufacturing variation can affect fit, so physical matching is not infinite mathematical precision. The enlarged cut-error control demonstrates the relationship without representing a locksmith’s cutting scale.'},
    ],
    misconception: 'Two keys that enter the same slot are not necessarily interchangeable. Their profiles may fit while their cut patterns differ.',
    limits: 'This lesson edits one cut at a time in an enlarged pin-cylinder key. Cut heights are clamped to the blade’s illustrative range; the control is not a locksmith’s cutting scale. The blade cross-section is fixed, so keyway-profile compatibility is explained but not tested. Pin contact and cam travel use the parent cylinder model’s ideal geometry and prescribed motion; forces, wear, manufacturing clearances and other key technologies are not simulated.',
    sources: [{title:'Schlage: key cuts, bitting, and pin matching',url:'https://www.schlage.com/content/dam/sch-us/documents/pdf/installation-manuals/P513-325.pdf'}],
    quiz: {question:'Two keys have the same blade outline but different cut heights. Why might only one work?',options:['The heavier key always works.','Entering the slot automatically unlocks it.','Only one pattern places every pin joint correctly.'],answer:2,explanation:'The keyway checks the profile; the pins check the ordered cut pattern. Those are separate requirements.'},
  },
  'Zipper': {
    simple: 'Start with two separate jacket sides. Fit the bottom pin into the slider and retaining box, then pull upward to fasten the jacket.',
    overview: 'A separating zipper has a removable insertion pin on one tape and a retaining box on the other. The slider stays on the box side. Bring it fully down, guide the free pin downward through its empty channel, and seat the pin in the box so the first teeth line up. Pull the slider upward: its guides bring staggered teeth together behind it. To separate the jacket again, unzip all the way down, withdraw the pin through the slider, then move the two sides apart.',
    steps: [
      {title:'Start with separate sides',body:'The two garment panels have no connecting seam across their bottom edges. The left side retains the box, fixed box pin and slider; the right side carries the removable insertion pin.'},
      {title:'Align the free pin',body:'Bring the free side toward the lowered slider. The insertion pin belongs above the vacant channel, not beside the box.'},
      {title:'Seat through the slider',body:'Move Seat the bottom pin toward one. Watch the pin pass downward through the slider into the open top of the box. Full seating establishes the first-tooth alignment.'},
      {title:'Zip upward',body:'With the pin seated, pull the slider toward the open rows. Its paired guides bring neighboring tooth heads together, leaving a joined chain below.'},
      {title:'Unzip, withdraw and separate',body:'Choose Separate the jacket and run it. The slider first returns to the box. Only then does the free pin move upward and out, allowing the right garment side to move away.'},
    ],
    parts: [
      {name:'Retaining box and fixed box pin',role:'Stay on the left tape and retain the lowered slider.'},
      {name:'Removable insertion pin',role:'Passes through the slider into the box before zipping; withdraws after complete unzipping.'},
      {name:'Slider plates and closing guides',role:'Contain the teeth and guide two rows into one chain.'},
      {name:'Upper separating wedge',role:'Divides the rows during downward opening travel.'},
      {name:'Locking projection and receiving recess',role:'Nest between alternating teeth, retaining the joined chain.'},
      {name:'Separate garment panels and tapes',role:'Each side carries its own row of teeth and can detach at the bottom.'},
    ],
    tryIt: [
      {title:'Fasten two separate sides',instruction:'Begin with the two sides completely apart. Run Fasten the jacket and follow alignment, pin insertion, then slider travel.',observe:'The pin enters through the lowered slider into the box before the tooth chain closes upward.',reset:true,part:'garment',view:'front',values:{operation:0,alignment:0,insertion:0,closure:0,spread:.65,pullAngle:35}},
      {title:'Inspect the bottom connection',instruction:'The pin is aligned but only half inserted. Keep Look inside selected and isolation off. Move Seat the bottom pin to one.',observe:'The free pin tip moves toward the floor of the retaining box. Closing becomes available after full seating; the slider has stayed at the bottom.',reset:true,part:'bottom-connector',view:'front',values:{operation:0,alignment:1,insertion:.5,closure:0,spread:.65,pullAngle:70}},
      {title:'Inspect a nested head',instruction:'Start with the bottom pin seated and the slider halfway up. Keep Look inside selected to compare the raised face and hollow underside of head 7 with its neighbor.',observe:'The head is a shaped solid. Its raised face enters the neighboring hollow while the two tapes remain connected at the bottom.',reset:true,part:'head-7',view:'front',values:{operation:1,alignment:1,insertion:1,closure:.5,spread:.65,pullAngle:70}},
      {title:'Separate the jacket completely',instruction:'Start fastened. Run Separate the jacket. Watch all three stages instead of stopping as soon as the teeth open.',observe:'The slider reaches the box, the pin withdraws upward through it, and the right side moves away. The slider stays with the left side.',reset:true,part:'garment',view:'front',values:{operation:1,alignment:1,insertion:1,closure:1,spread:.65,pullAngle:35}},
    ],
    deeper: [
      {title:'The bottom connector sets the start',body:'A closed-end zipper has a permanent lower connection. This jacket uses an open-end arrangement: the pin and box establish the starting alignment each time the sides are joined.'},
      {title:'Nesting permits sequential release',body:'The raised and hollow faces resist direct sideways separation while nested. The branching slider path lets neighboring heads disengage in sequence.'},
      {title:'Follow normal use; do not force it',body:'The controls enforce the normal operating sequence. They do not claim that every real zipper physically blocks all slider motion with an incompletely inserted pin. Forcing some designs can damage the lower parts.'},
    ],
    misconception: 'Unzipping the teeth is only the first part of separating a jacket zipper. Return the slider to the box, then withdraw the free pin upward before pulling the sides apart.',
    limits: 'An enlarged one-way separating zipper with illustrative garment panels. Cup-and-recess heads, pin dimensions, channel curves, clearances and fabric shapes are teaching geometry, not a manufactured specification. Prescribed motion demonstrates normal use, not force, friction, fabric tension, jamming, wear or deformation. The pin follows a guided insertion path; no insertion force or physical lock against misuse is calculated.',
    sources: [{title:'YKK: zipper parts and open-end operating sequence (pages 7 and 14)',url:'https://www.ykkindia.com/public/frontend/assets/images/catalogue/YKK-Zipper-Catalogue.pdf'},{title:'YKK: incomplete pin insertion and open-part damage',url:'https://ykkamericas.com/wp-content/uploads/2021/10/FasteningCatalogue_update20220120.pdf'},{title:'YKK: zipper structure and slider direction',url:'https://www.ykk.com/english/ykk/tech/01.html'},{title:'Sundback: nesting tooth projections and recesses',url:'https://patents.google.com/patent/US1219881A/en'}],
    quiz: {question:'What must happen before pulling the slider upward to fasten these separated jacket sides?',options:['Seat the free pin through the lowered slider into the retaining box.','Pull the two tapes sideways while the slider is halfway up.','Tilt the pull tab without inserting the pin.'],answer:0,explanation:'The fully seated pin establishes the lower connection and aligns the first teeth. The slider can then join the rows in sequence.'},
  },
  'Nail clippers': {
    simple: 'Can changing where you press turn a stalled clip into a clean cut? Follow the handle, post and bending blades to a clipped practice nail.',
    overview: 'The long handle pushes a small rounded cam against the upper spring arm. The retaining post pulls upward on the lower arm. Both arms bend from their joined rear end, bringing their opposed cutting edges together. In this practice model, a weak input stops at the strip. More effort or a longer finger arm can meet the chosen example resistance. A completed action clips the strip, releases the handle and leaves the fragment in a tray.',
    steps: [
      {title:'Find the whole force path',body:'The rear join connects the two spring strips. Near the cutting tips, a post passes through their clearance holes. Its lower head bears against the lower arm, and its upper fork retains the handle.'},
      {title:'Press through the cam',body:'The finger acts on the long handle. Its rounded heel stays against the upper arm. The short distance between cam and post lets a long finger movement produce a stronger, shorter push.'},
      {title:'Close both arms',body:'The cam pushes the upper arm down while the post head pulls the lower arm up. Watch the continuous strips bend; the front post is not their hinge.'},
      {title:'Meet the example resistance',body:'The model compares an ideal edge-force estimate with your chosen strip resistance. A weak setting stops at contact. Move the finger toward the handle end or increase effort, then run again.'},
      {title:'Clip, release and collect',body:'With enough ideal force, the edges thin the visible bridge and separate the free end. Releasing the handle lets the arms reopen. The fragment moves clear of the blades into the tray.'},
    ],
    parts: [
      {name:'Operating handle and finger marker',role:'Set the long input arm and show where finger effort acts.'},
      {name:'Rounded cam heel',role:'Pushes against the upper arm while staying in contact through the stroke.'},
      {name:'Retaining post, lower head and fork',role:'Connect the handle to the lower arm, transmitting an upward pull.'},
      {name:'Rear join and two spring arms',role:'Support the blades and provide the visible bending and return movement.'},
      {name:'Opposed cutting edges',role:'Concentrate the closing action at the narrow material bridge.'},
      {name:'Practice strip, holder and tray',role:'Make the shortened strip and separated fragment visible as the useful result.'},
    ],
    tryIt: [
      {title:'Clip a practice nail',instruction:'Start open with the finger near the handle end. Run the clipping action.',observe:'Both blades close, the strip separates, and the handle returns. The result view shows the new edge and fragment in the tray.',reset:true,part:'system',view:'front',values:{squeeze:0,fingerPosition:1,effort:5,resistance:25}},
      {title:'Rescue a stalled cut with leverage',instruction:'Start with 5 N applied closer to the post. Run until the tool stops. Move Finger distance along lever to 1, then run again.',observe:'The same effort initially falls short of the example resistance. Moving the finger farther along the handle supplies enough ideal edge force to complete the cut.',reset:true,part:'system',view:'front',values:{squeeze:0,fingerPosition:.35,effort:5,resistance:25}},
      {title:'Change effort at the same position',instruction:'Start with a weak 2 N input near the handle end. Run to contact, increase Finger force to 5 N, then run again.',observe:'The first attempt leaves the strip intact. Increasing effort at the same position allows the practice cut.',reset:true,part:'system',view:'front',values:{squeeze:0,fingerPosition:1,effort:2,resistance:25}},
      {title:'Trace the cam contact',instruction:'Start partly pressed. Use Advance the clipper to follow the rounded heel against the upper arm, then run the rest of the action.',observe:'The post rises with the lower arm while the cam stays on the upper arm. Both strips bend and their edges move much less than the handle end.',reset:true,part:'system',view:'front',values:{squeeze:.4,fingerPosition:1,effort:5,resistance:25}},
    ],
    deeper: [
      {title:'Which lever is being named?',body:'Using the post as the handle pivot, the cam load lies between the post and finger: a second-class arrangement. The flexible blade arms are often described as third-class levers. The actual post, cam and rear join matter more than assigning one class to the whole tool.'},
      {title:'The displayed ratio comes from travel',body:'For this prescribed motion, the ideal edge-force ratio is the small vertical finger travel divided by the reduction in jaw gap. This is the lossless virtual-work comparison: finger force times finger travel equals edge force times gap reduction. It includes both arms closing.'},
      {title:'What the cutting rule does not establish',body:'The resistance is an adjustable teaching threshold. Real clipping also depends on spring stiffness, edge sharpness, friction, material structure and fracture. The chosen number is not a measurement of a human nail or a prediction for a manufactured clipper.'},
    ],
    misconception: 'The front post does not act as a scissor hinge for the blades. The arms bend from their rear attachment; the handle pivots at the post and bears on the upper arm.',
    limits: 'An enlarged straight-edge clipper and artificial practice strip. The arms follow a prescribed symmetric bending shape, with cam contact solved geometrically; no elastic-force or stress solver is used. The displayed ideal ratio excludes spring work and friction. A chosen force threshold and thinning bridge illustrate cutting rather than solve fracture. Strip dimensions, threshold and fragment trajectory are illustrative, not anatomical or manufactured specifications.',
    sources: [{title:'US4117591: handle, cam and post force chain',url:'https://patents.justia.com/patent/4117591'},{title:'US2664624: retaining post and spring-arm construction',url:'https://patents.google.com/patent/US2664624A/en'},{title:'US3031754: clipping and fragment handling',url:'https://patents.google.com/patent/US3031754A/en'},{title:'OpenStax: simple machines and ideal mechanical advantage',url:'https://openstax.org/books/physics/pages/9-3-simple-machines'}],
    quiz: {question:'The example strip stops the blades. How can the same finger force complete the cut?',options:['Press farther from the retaining post.','Move the finger closer to the post.','Raise the example resistance.'],answer:0,explanation:'A longer finger arm increases the ideal edge force. In this model it can meet the chosen resistance without increasing finger force.'},
  },
  'Tweezers': {
    simple: 'Can the same squeeze lift a block when you move your fingers closer to the tips? Bend the arms, make contact, lift, and release.',
    overview: 'Two slender spring arms share a joined heel. Your fingers press between that heel and the free gripping tips, so tweezers act as a pair of third-class levers. The arms bend before the tips touch the block. After contact, more pressure increases the grip. Friction at both pads can support the block only if their combined holding capacity reaches its weight. Keep squeezing to lift the whole tool; release to let the arms reopen and the block fall.',
    steps: [
      {title:'Find the continuous arms',body:'Both metal strips remain attached at their heel. The blue markers show where fingers push; there is no scissor hinge.'},
      {title:'Bend toward the block',body:'Increase Squeeze the arms. The chosen finger force changes the bending shape. A pressure point near the heel may leave the tips too far apart.'},
      {title:'Build grip after contact',body:'The pads stop at the two block faces. Further squeeze increases their normal force instead of pushing through the block.'},
      {title:'Lift with enough friction',body:'Run Grip and lift the block. The tool carries it only when both pads contact it and the displayed holding capacity reaches its weight.'},
      {title:'Release and recover',body:'Choose Release into the tray. The arms open as pressure falls. The block slips or drops back into the tray. Pause freezes this slowed motion; Advance one step continues it.'},
    ],
    parts: [
      {name:'Joined heel / effective fulcrum',role:'Keeps the two arms connected and supports their bending.'},
      {name:'Continuous spring arms',role:'Deform under finger effort and opposing contact forces.'},
      {name:'Finger effort markers',role:'Show the position and direction of the applied pressure.'},
      {name:'Opposed gripping pads',role:'Contact the block sides and create the normal force needed for friction.'},
      {name:'Practice block and receiving tray',role:'Make successful pickup and release visible.'},
    ],
    tryIt: [
      {title:'Grip, lift and release',instruction:'Use the starting 3 N setting and run Grip and lift the block. Then choose Release into the tray and run again.',observe:'The arms close against the block, the whole tool lifts it, and release opens the pads and returns the block to the tray.',reset:true,part:'system',view:'front',values:{operation:0,squeeze:0,fingerPosition:.55,effort:3,lift:0,mass:10}},
      {title:'Recover a weak squeeze',instruction:'Run with the fingers near the joined heel. When pickup stops, move Effort position to 0.85 without changing force, then run again.',observe:'At 0.30 the same effort leaves the tips open. Moving the effort closer to the tips bends them farther and produces enough contact force to lift the block.',reset:true,part:'tool',view:'front',values:{operation:0,squeeze:0,fingerPosition:.3,effort:3,lift:0,mass:10}},
      {title:'Touching is not enough',instruction:'Run with a 30 g block. The pads touch, but the starting grip cannot support its weight. Increase Force on each arm to 4 N, then run again.',observe:'The gap stays at the block width after contact. Increased force raises holding capacity and allows pickup without the tips penetrating the block.',reset:true,part:'system',view:'front',values:{operation:0,squeeze:0,fingerPosition:.55,effort:3,lift:0,mass:30}},
      {title:'Close empty tips',instruction:'Start with the open tool already above the tray. Run the grip action. Use Return block to starting tray, then try the first experiment.',observe:'The raised tips close without picking up the distant block. A nearby-looking object is not automatically attached.',reset:true,part:'system',view:'front',values:{operation:0,squeeze:0,fingerPosition:.55,effort:3,lift:1,mass:10}},
    ],
    deeper: [
      {title:'A lever classification, not a calibrated force ratio',body:'Third class names the order of heel, effort and load. Real tweezers bend, so this model uses elastic-arm compliance instead of treating the distance ratio as a measured grip force. Its grip force remains smaller than the applied finger force.'},
      {title:'The numerical spring model',body:'Each arm is an illustrative 60 mm cantilever with bending rigidity EI = 16000 N·mm². Small-deflection beam solutions are added for the inward finger force and outward tip reaction. The reaction enforces contact with the 4 mm block. Short flat pad loads are represented at the spring-arm end; tip rotation and pad moments are neglected.'},
      {title:'Why two pads matter',body:'Each pad can supply friction up to 0.30 times its normal force in this example. With symmetric contacts, the maximum combined support is twice that amount. The block weight is its mass in kilograms times 9.81 N/kg. These chosen surface and stiffness values are not measurements of a real pair of tweezers.'},
      {title:'What the fall represents',body:'The downward motion uses the balance between weight and available contact friction on a slowed clock. The model uses the same friction coefficient while holding and sliding. Tool lifting is treated as slow positioning, without an additional acceleration load.'},
    ],
    misconception: 'Touching the block does not guarantee it can be lifted. Some effort first bends the arms, and the remaining contact force must provide enough friction to support the weight.',
    limits: 'An illustrative small-deflection elastic model with constant bending rigidity, symmetric flat pads, a rigid block and a chosen friction coefficient. It neglects large rotations, shear deformation, contact pressure distribution, pad moments, material yielding, crushing and adhesion. The vertical tool motion is prescribed and the fall is slowed. It is not a manufacturing, tissue-contact or safe-gripping specification.',
    sources: [{title:'Dumont: conventional joined resilient tweezer legs',url:'https://patents.google.com/patent/US20110172783A1/en'},{title:'US3981527: spring arms reopen on release',url:'https://patents.justia.com/patent/3981527'},{title:'Roylance: elastic beam displacement and superposition',url:'https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Mechanics_of_Materials_(Roylance)/04:_Bending/4.03:_Beam_Displacements'},{title:'OpenStax: normal force and frictional support',url:'https://openstax.org/books/university-physics-volume-1/pages/6-2-friction'}],
    quiz: {question:'The pads touch the block, but it stays in the tray. What can make the same tool lift it?',options:['Increase contact force enough for friction to support the weight.','Lift the open tool farther away first.','Turn the joined heel into a scissor hinge.'],answer:0,explanation:'Bilateral contact is necessary, but the available friction must also reach the block weight. More effort or a better finger position can increase that capacity.'},
  },
  'Window shade': {
    simple: 'Why does a gentle release hold the shade, while a tug and brisk release lets it roll up? Cover the window and compare the two hand motions.',
    overview: 'The shade fabric turns a horizontal roller as you pull it down. Inside, one end of a coil spring is anchored to a fixed rod and the other turns with the roller. A locking disk carries two hinged pawls around a stationary ratchet. When the motion slows, an upper pawl can settle against a stop. A tug backs it away; a brisk release lets the spring rewind the shade while the pawls stay clear.',
    steps: [
      {title:'Cover the window',body:'Choose the requested coverage and run Lower and gently hold. The bottom rail moves down without stretching, cloth leaves the roll, and the spring gains relative turns.'},
      {title:'Look inside the roller',body:'Use Look inside, then explore Connected roller mechanism. The central rod and four-stop ratchet stay still while the tube, locking disk and two pawl pivots turn together. Select Pawls and fixed ratchet, then Side and Isolate selected part, for a clear end view.'},
      {title:'Watch the catch settle',body:'The guided hand motion stops slightly beyond a holding position. The spring turns the roller back a little, until an upper pawl meets a steep ratchet face.'},
      {title:'Compare a gentle release',body:'Choose Tug and release with Gentle: catch again. The tug lifts the catch from its stop, but slowing the return lets a pawl engage again. The window stays covered.'},
      {title:'Let the shade rewind',body:'Choose Brisk: rewind and run Tug and release again. Both pawls swing clear during the illustrated rapid return. The spring loses its added winding, cloth wraps onto the roller and the window opens.'},
    ],
    parts: [
      {name:'Hanging fabric and bottom rail',role:'Cover the window and provide a place to pull. The rail remains rigid.'},
      {name:'Roller tube and wound fabric',role:'Rotate together; the wound radius decreases as cloth unrolls.'},
      {name:'Fixed central rod and brackets',role:'Support the roller and keep one spring end and the central ratchet stationary.'},
      {name:'Axial winding spring',role:'Runs along the rod inside the roller. Its two ends gain relative rotation during lowering.'},
      {name:'Rotating locking disk',role:'Connects the roller to two moving pawl pivots.'},
      {name:'Two hinged pawls and fixed ratchet',role:'An upper pawl catches at a slow stop; both are clear during the guided rapid return.'},
    ],
    tryIt: [
      {title:'Cover the whole window',instruction:'Run Lower and gently hold. Compare the requested coverage with the actual stopped position.',observe:'The fabric covers the whole window and stays down after the hand motion ends. Holding positions are discrete.',values:{operation:0,coverage:1,release:1},reset:true},
      {title:'A gentle release catches again',instruction:'Run once to lower the shade. Then choose Tug and release and run again, keeping Gentle: catch again selected.',observe:'The catch moves off its stop during the tug, then seats again. The shade stays down.',values:{operation:0,coverage:.6,release:0},reset:true},
      {title:'A brisk release opens the window',instruction:'Run once to lower the shade. Then choose Tug and release and run again with Brisk: rewind selected. Use Look inside to follow the spring and pawls.',observe:'The pawls stay clear, the roller takes up the fabric, and the window becomes uncovered.',values:{operation:0,coverage:.75,release:1},reset:true},
    ],
    deeper: [
      {title:'Holding occurs at angular stops',body:'Four ratchet faces and two opposed pawls provide successive holding positions. A real shade can settle a little above the requested height. This enlarged roller makes those steps particularly visible.'},
      {title:'One spring end stays still',body:'Rotating an entire spring without relative end motion would not wind it. Here the stem end stays anchored while the roller end turns. The changing helix illustrates that relative rotation, rather than predicting wire strain or torque.'},
      {title:'Gravity and rapid rotation',body:'At low speed gravity can bring an upper pawl into engagement. Rapid rotation can keep it away from the hub through its inertia, often described using centrifugal force in the rotating frame. The selected hand motions demonstrate these states; the model does not calculate a release speed.'},
      {title:'Cloth is transferred, not stretched',body:'The model conserves cloth length as it transfers between the roll and the hanging section. It uses an enlarged constant cloth thickness and an ideal tightly wound circular roll. The rigid bottom rail follows the lower fabric edge.'},
    ],
    misconception: 'The tug releases a catch. The work previously supplied while lowering the shade is what stored energy in the spring.',
    limits: 'A connected geometric teaching model of one traditional spring roller. Lowering, settling, pawl motion and rewind use prescribed slowed hand-motion sequences. They do not solve spring torque, gravity-driven pawl dynamics, friction, a centrifugal release threshold, or the speed of a real shade. The spaced coil preserves wire length while its diameter and pitch change over a fixed axial span. This illustrates end rotation, not calculated elastic equilibrium. Roller size and cloth thickness are enlarged; winding is idealized. This is not a spring-adjustment guide or a model of every modern blind.',
    sources: [{title:'US4674550: conventional fixed ratchet, rotating pawls and spring roller',url:'https://patents.justia.com/patent/4674550'}],
    quiz: {question:'The shade rolls up after a tug and release. Where did its lifting energy come from?',options:['From work stored in the spring while lowering the shade.','From the pawl creating energy at the ratchet.','From gravity pulling the fabric upward.'],answer:0,explanation:'The earlier pull wound the spring. The tug clears the catch so the stored elastic energy can raise the shade.'},
  },
  'Ratchet': {
    simple: 'A catch lets a toothed wheel move one way and blocks it from moving back.',
    overview: 'A ratchet combines an uneven tooth shape with a pawl, a small pivoting catch. In the permitted direction, the shallow side of a tooth lifts the pawl out of the way. In reverse, the pawl meets a stopping face. Lifting the pawl deliberately removes that constraint.',
    steps: [
      {title:'Seat the pawl',body:'The catch rests against a tooth. Its support keeps it positioned to resist motion in the blocked direction.'},
      {title:'Turn the permitted way',body:'The sloping tooth face pushes the pawl upward as the wheel advances.'},
      {title:'Drop into the next space',body:'After the tooth passes, the catch returns to the next holding position. Repeating this produces the familiar clicking action.'},
      {title:'Try to reverse',body:'The stopping face pushes against the pawl instead of lifting it clear. The wheel cannot continue backward while the catch stays engaged.'},
      {title:'Release deliberately',body:'Move the catch away from the teeth. With this barrier removed, the wheel can turn in the formerly blocked direction.'},
    ],
    parts: [
      {name:'Ratchet wheel',role:'Carries repeated teeth with a ramp and a stopping face.'},
      {name:'Pawl',role:'The catch that rides over ramps and resists reverse travel.'},
      {name:'Pawl pivot and seating stop',role:'The hinge lets the catch lift; the fixed stop supports its seated position against reverse tooth force.'},
      {name:'Return bias',role:'A spring or gravity returns the pawl toward engagement, depending on the design.'},
      {name:'Release',role:'Moves the pawl clear when reverse motion is wanted.'},
    ],
    tryIt: [
      {title:'Advance and hold',instruction:'Press Play. Watch the pointer advance three teeth, pass its stop slightly, and settle back.',observe:'The pointer stays at 90° because the pawl now touches a steep stopping face.',reset:true,values:{stroke:3,direction:1,release:0}},
      {title:'Keep the progress',instruction:'This setup starts with three teeth already advanced and the pawl engaged. Press Play to request counterclockwise movement.',observe:'The 90° position is retained. The requested backward motion is blocked by the catch.',reset:true,initialState:{position:3},values:{stroke:3,direction:-1,release:0}},
      {title:'Release and undo',instruction:'This setup starts at 90° with the pawl lifted clear and counterclockwise selected. Press Play to undo the three teeth.',observe:'The pointer returns three teeth. The same reverse request now succeeds because the pawl is clear.',reset:true,initialState:{position:3},values:{stroke:3,direction:-1,release:1}},
    ],
    deeper: [
      {title:'Holding is not driving',body:'A holding pawl prevents unwanted motion; it does not supply the work to advance the wheel. A powered or hand-operated drive must provide that work. Some machines use a second pawl for driving as well as one for holding.'},
      {title:'Small backward movement can occur',body:'A physical pawl may settle back to a tooth face before it holds firmly. This small lost motion is called backlash. More closely spaced teeth reduce the angular step, but strength, wear, and manufacturing also constrain the design.'},
    ],
    misconception: 'A ratchet does not make reverse motion impossible under every condition. Releasing its pawl removes the block, and real parts also have finite strength.',
    limits: 'This enlarged principle demonstrator uses prescribed hand motion and tooth contact geometry. An illustrative elastic band returns the catch. It does not calculate forces, tooth stress, friction, wear, release under load or safe holding capacity. The release setting places the pawl in its selected pose; it does not simulate the hand operating a release lever. The Window shade lesson applies the same holding principle with a fixed ratchet and moving pawls.',
    sources: [{title:'Shade-roller patent: ratchet and pawl holding mechanism',url:'https://patents.justia.com/patent/4674550'}],
    quiz: {question:'Why does lifting the pawl allow reverse motion?',options:['The tooth ramps change their shape.','The wheel gains a new power source.','The solid obstacle in the tooth’s path is removed.'],answer:2,explanation:'Direction is constrained by contact between the tooth and catch. Moving the catch clear removes that constraint.'},
  },
  'Electric bell': {
    simple: 'Electricity pulls a hammer, the movement switches the pull off, and a spring brings it back. The cycle repeats.',
    overview: 'Play presses and holds the door button, then releases it. Current builds in two connected coils and attracts a hinged iron armature. The armature lifts a springy contact tongue away from its screw, interrupting the current. The moving hammer continues into the gong, and a return spring brings the armature back. Closing the contact starts another stroke while the button remains down.',
    steps: [
      {title:'Press the door button',body:'The button bridge touches both terminals. Trace the continuous path through the fixed contact, moving tongue, armature, return spring and coils to the battery.'},
      {title:'Build the magnetic pull',body:'Coil current rises rather than appearing instantly. Magnetic attraction turns the supported armature toward the iron core against its return spring.'},
      {title:'Open the moving contact',body:'The preloaded tongue initially stays against the screw. Further armature movement separates the pads and interrupts the supply to the coils.'},
      {title:'Strike the gong',body:'The moving hammer carries on as the current fades and hits the rim. Watch the strike count and spreading sound indicator. Select Sound on to hear the impacts.'},
      {title:'Return and repeat',body:'The spring returns the armature. The contacts meet again, current builds, and another stroke follows while the button is held.'},
      {title:'Release the button',body:'At the end of the chosen hold time, the button rises. Current fades and the armature comes to rest. The final strike count remains visible.'},
    ],
    parts: [
      {name:'Battery and door button',role:'Supply energy and connect the circuit during the chosen button press.'},
      {name:'Two coils and U-shaped iron core',role:'Create the magnetic pull that drives the armature.'},
      {name:'Hinged armature and hammer',role:'Move together so the magnetic pull produces a gong strike.'},
      {name:'Springy tongue and adjusting screw',role:'Make and break the coil circuit as the armature moves.'},
      {name:'Torsion return spring',role:'Stores energy during attraction and returns the armature after the current falls.'},
      {name:'Gong and center mount',role:'A hammer impact excites the supported metal dome and produces sound.'},
    ],
    tryIt: [
      {title:'Ring the bell',instruction:'Press Play with the normal contact. Select Sound on if you want to hear the impacts.',observe:'Several strikes follow one held button press. The contacts repeatedly open and close, then the button releases and the bell stops.',reset:true,values:{voltage:3,holdTime:.35,contact:0,sound:0}},
      {title:'Leave a gap in the circuit',instruction:'Set up the held-open contact, then press Play. Inspect the gap at the screw.',observe:'The button still moves, but no coil current builds and the hammer does not strike.',reset:true,values:{voltage:3,holdTime:.35,contact:1,sound:0}},
      {title:'Bypass the interrupter',instruction:'Press Play with the blue jumper in place. Watch what happens after the first strike.',observe:'The jumper keeps supplying the coils when the contact opens. A steady pull holds the armature near the gong instead of sustaining repeated ringing.',reset:true,values:{voltage:3,holdTime:.35,contact:2,sound:0}},
      {title:'Try a weak battery',instruction:'Keep the normal contact and compare the weaker 1.5 V supply with 3 V.',observe:'Current flows, but this weaker supply cannot drive the hammer far enough to strike. A closed circuit alone does not guarantee enough motion.',reset:true,values:{voltage:1.5,holdTime:.35,contact:0,sound:0}},
    ],
    deeper: [
      {title:'Feedback makes the repetition',body:'Armature motion changes the circuit that produced it. Interruption lets the magnetic pull fade; spring return closes the contact. The bypass experiment removes this feedback and changes repeated ringing into a steady pull.'},
      {title:'Motion and current take time',body:'The coils resist a sudden change in current, and the moving armature has inertia. Those delays matter: the hammer can keep moving after the contact opens. The spring and damping then affect its return.'},
      {title:'The energy comes from the battery',body:'The battery supplies energy for each stroke. Some is temporarily stored in the magnetic field and spring; impacts, sound and heating transfer it away. The gong tone vibrates much faster than the visible hammer strokes.'},
    ],
    misconception: 'Holding the button does not directly push the hammer. A steady magnetic pull alone gives no repeated ringing here; the moving contact and spring provide the feedback.',
    limits: 'This representative bell uses a hinged armature and torsion return spring. A simplified current and rotational-motion model determines the strikes. Coil resistance, inductance, magnetic-force coefficient, saturation, damping and current-decay time are illustrative, not calibrated ratings. Contact preload is shown geometrically; its extra torque, arcing, magnetic hysteresis and acoustic resonance are not solved. The audible tone is synthesized, and the blue field and sound rings are explanatory symbols.',
    sources: [{title:'Schoolphysics: self-interrupting electric bell',url:'https://schoolphysics.co.uk/age11-14/Electricity%20and%20magnetism/Electromagnetism/text/Electric_bell/index.html'}],
    quiz: {question:'Why does the bypassed contact produce a steady pull instead of repeated ringing?',options:['The jumper keeps current flowing even when the moving contact opens.','The jumper removes the battery from the circuit.','The gong no longer has any inertia.'],answer:0,explanation:'The armature can open the contact, but the jumper provides another conducting path. The energized magnet continues to pull until the button is released.'},
  },
};
