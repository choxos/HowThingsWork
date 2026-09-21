import {SCREW_DEFAULTS, WINGED_DEFAULTS} from './corkscrew-physics.js';

const screwTrial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...SCREW_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});
const wingTrial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...WINGED_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});

const corkLimits = 'A 44 mm cork in an 18.5 mm neck whose grip falls in a straight line with the length still inside: 120, 300 or 450 N at the start, teaching values. The worm holds the cork until the cork shears along the cylinder the worm sweeps, at 1 MPa, a teaching value. Screwing torque grows linearly with depth. No start-up jump above sliding friction, no cork swelling or compression by the worm, no bending, tilting or wiggling.';

export const screwCorkscrewLesson = {
  simple: 'Why does a corkscrew use an open spiral, and how deep does it need to go before you pull?',
  overview: 'A plain corkscrew is a worm on a T-handle. Turning the handle screws the worm into the cork one pitch a turn; pulling the handle then has to beat the friction of the cork on the glass. The worm must hold on while you pull, and the book’s point is that an open helix does that better than a solid screw, which splits and tears the cork. Follow the depth, the hold, and the pull the cork needs.',
  steps: [
    {title: 'Start the point', body: 'The sharp tip sits on the middle of the cork. The helix is right-handed, so turning the handle clockwise drives it in.'},
    {title: 'Screw the worm in', body: 'Each turn advances the worm one 7 mm pitch. Every point of the wire follows the same spiral track through the cork instead of sweeping through it, which is what keeps the cork in one piece.'},
    {title: 'Feel the torque grow', body: 'The buried wire rubs the cork, so the deeper the worm, the more torque each turn needs. The T-handle lets both hands push its ends in opposite directions, far from the shaft.'},
    {title: 'Pull against the neck', body: 'The glass squeezes the cork, and friction on that contact holds it. Nothing moves until your pull reaches that grip, and the grip is largest at the very start.'},
    {title: 'Hold on to the cork', body: 'Your pull reaches the cork through the worm. If the cork would shear around the worm before it slides in the neck, the worm tears a plug out and the cork stays. A deeper worm grips a longer cylinder and holds more.'},
    {title: 'Draw it out', body: 'Once the cork slides, the length still in the neck shrinks, and so does the force needed. The work is the starting grip times half the cork’s length.'},
  ],
  parts: [
    {name: 'T-handle', role: 'Turned by equal opposite pushes at its ends, then gripped to pull. Moving the grips farther from the shaft reduces the turning effort.'},
    {name: 'Shaft', role: 'Carries the turning torque and straight pull from the handle to the worm.'},
    {name: 'Worm', role: 'The helix. Its pitch sets depth per turn; its diameter and depth set how hard it can hold the cork.'},
    {name: 'Cork', role: 'Squeezed into the neck; its grip is friction on the length still inside.'},
    {name: 'Bottle neck', role: 'The 18.5 mm bore that squeezes the cork and resists its sliding.'},
    {name: 'Force chart', role: 'The pull needed along the cork against your pull and the worm’s hold.'},
  ],
  tryIt: [
    screwTrial('Pull the default cork', 'Play with the open helix screwed in 5 turns, a natural cork and a 350 N pull.', 'Five turns put the worm 35 mm into the cork. The pull climbs to the cork’s 300 N grip, the worm could hold 990 N, and the cork slides out. Pulling it takes 6.60 J.'),
    screwTrial('Screw in only one turn', 'Screw the worm in 1 turn and play.', 'Seven millimeters of worm can hold only 198 N, less than the 300 N the cork needs, so it tears a plug out of the cork and the cork stays put.', {turns: 1}),
    screwTrial('Two turns are enough', 'Screw in 2 turns and play.', 'At 14 mm deep the worm holds 396 N, a little more than the 300 N grip, and the cork comes out.', {turns: 2}),
    screwTrial('Go right through', 'Screw in 6.5 turns and play, or inspect the turning stage and look below the cork.', 'The worm reaches 45.5 mm, past the bottom of the 44 mm cork, so crumbs of cork fall into the wine even though the cork comes out.', {turns: 6.5}),
    screwTrial('Swap in a solid screw', 'Choose the solid screw and inspect the turning stage to compare torque.', 'The solid screw grips a narrower cylinder, 660 N instead of 990 N, and rubs along its whole shank: screwing it in takes 523.5 N·mm instead of 261.5 N·mm.', {worm: 1}),
    screwTrial('Solid screw, shallow', 'Choose the solid screw, screw in 2 turns, and play.', 'Where the helix held 396 N, the solid screw holds only 264 N, so it tears out of the cork.', {worm: 1, turns: 2}),
    screwTrial('Pull an old, loose cork', 'Choose the old, loose cork and play.', 'It needs only 120 N, and pulling it out takes 2.64 J.', {grip: 0}),
    screwTrial('Pull too gently', 'Limit your pull to 250 N and play.', 'The pull tops out at 250 N, below the 300 N grip, so nothing moves.', {pull: 250}),
    screwTrial('Meet a synthetic cork', 'Choose the synthetic cork and play.', 'It grips with 450 N, more than your 350 N, so it will not start.', {grip: 2}),
    screwTrial('Pull harder on it', 'Choose the synthetic cork and pull with 500 N.', 'The cork starts once the pull reaches 450 N, and the work rises to 9.90 J.', {grip: 2, pull: 500}),
    screwTrial('Use a short handle', 'Put each grip 20 mm from the shaft and inspect the turning stage.', 'At full insertion, the same 261.5 N·mm takes 6.54 N at each end, twice the default effort. The cork still needs the same 300 N straight pull.', {handle:20}),
    screwTrial('Use a long handle', 'Put each grip 60 mm from the shaft and inspect the turning stage.', 'At full insertion, each end needs only 2.18 N. The hands travel farther around the shaft; the 300 N straight pull and 6.60 J extraction work stay unchanged.', {handle:60}),
  ],
  deeper: [
    {title: 'Why the grip falls as the cork comes out', body: 'Friction here comes from the glass pressing on the cork all along the length inside the neck. Pull the cork out by some distance and that length shrinks, so the force needed falls in a straight line to nothing. The work is the area under that line: a 300 N grip over 44 mm takes 300 N times 22 mm, 6.60 J.'},
    {title: 'How a worm holds a cork', body: 'To pull the worm out without the cork, the cork has to shear along the cylinder the worm sweeps. That cylinder is as wide as the worm and as long as its depth, so the hold is shear strength times its area. At a teaching value of 1 MPa, a 9 mm helix 35 mm deep holds 990 N.'},
    {title: 'Why a helix and not a screw', body: 'A solid screw has a shank in the middle that wedges the cork apart, and its thread only reaches 6 mm across. An open helix leaves the middle of the cork whole, grips a wider cylinder, and rubs the cork only where its wire runs. That is why corkscrews are spirals.'},
    {title: 'The handle is a wheel and axle', body: 'Screwing 35 mm of helix in takes 261.5 N·mm of torque in this model. Two hands pushing the handle ends 40 mm from the shaft share it at 3.27 N each. A thin shaft turned by the fingers alone would need far more force for the same torque.'},
    {title: 'Stop before the bottom', body: 'A worm longer than the cork is useful for a good grip, but driven all the way it breaks through the bottom and sheds crumbs into the wine. Two turns are enough to hold a natural cork in this model; five leave a margin without piercing.'},
  ],
  misconception: 'Screwing further in does not make the cork easier to pull. The grip in the neck is the same; a deeper worm only holds on more firmly.',
  limits: corkLimits + ' The handle is represented by two equal opposite pushes at the indicated grip distance. Its length changes with those grip positions. The 1 MPa cylindrical tear criterion is an effective teaching model; radial splitting by a solid screw is explained but not simulated. Insertion runs at one turn per second. Extraction, loose-worm withdrawal and falling crumb markers use a prescribed 25 mm/s display speed; no free-fall, fluid motion, fragment deformation or recovery forces are calculated. After tear-out, the worm withdraws through its engaged depth and the cork stays still. Turning arrows use 5 mm per newton; the straight pull and resistance arrows share a separate 0.1 mm per newton scale. Force-chart size is unrelated to physical dimensions.' ,
  sources: [
    {title: 'OpenStax Physics: simple machines, including the screw and the wheel and axle', url: 'https://openstax.org/books/physics/pages/9-3-simple-machines'},
    {title: 'OpenStax College Physics 2e: friction', url: 'https://openstax.org/books/college-physics-2e/pages/5-1-friction'},
    {title: 'OpenStax College Physics 2e: torque and moment arms', url: 'https://openstax.org/books/college-physics-2e/pages/9-2-the-second-condition-for-equilibrium'},
  ],
  quiz: {
    question: 'The worm comes out of the cork with a plug of cork on it, and the cork stays in the bottle. What went wrong?',
    options: [
      'The worm was not deep enough, so the cork sheared around it before it would slide in the neck.',
      'The pull was too weak to overcome the grip of the neck.',
      'The worm went through the bottom of the cork.',
    ],
    answer: 0,
    explanation: 'A tear-out happens when the worm’s hold, set by its width and depth, is less than the cork’s grip in the neck. A weak pull just leaves everything where it is.',
  },
};

export const wingedCorkscrewLesson = {
  simple: 'How do two wings and a toothed rack pull a cork that a straight pull struggles with?',
  overview: 'The winged corkscrew combines the screw with the rack and pinion. Turning its knob screws the worm into the cork and lowers a toothed rack, which turns the pinions at the ends of the wings and raises them. Pressing the wings down turns the pinions back, and the rack rises with the worm and the cork. The long wings and small pinions give leverage, so the hands push gently over a long distance.',
  steps: [
    {title: 'Seat it on the bottle', body: 'The body rests on the bottle lip, so the pull on the cork pushes the body down on the glass and the hands do not have to hold the bottle down.'},
    {title: 'Turn the knob', body: 'The knob turns the shaft and worm. The rack teeth are rings around the shaft, so they stay in mesh with the pinions while the shaft turns.'},
    {title: 'Watch the wings rise', body: 'Each turn drives the worm 7 mm into the cork and lowers the rack 7 mm. The rack turns both pinions, raising the wings by that drop over the 14 mm pinion radius.'},
    {title: 'Press the wings down', body: 'Pushing each wing’s end square to the wing turns its pinion back. Two wings of length L on pinions of radius r lift the rack with 2L/r times each hand’s push.'},
    {title: 'Lift the cork', body: 'The rack carries the lift to the worm and the worm to the cork. Once the lift matches the cork’s grip, the cork rises; the grip falls as it comes out.'},
    {title: 'Finish by hand', body: 'The rack can rise only as far as it fell. If the worm went in less than the whole cork, the last part of the cork is still in the neck when the wings are down.'},
  ],
  parts: [
    {name: 'Knob and rack', role: 'The knob turns the worm in; the ring-toothed rack moves up and down with it and meshes with both pinions.'},
    {name: 'Wings and pinions', role: 'Long levers ending in 14-tooth pinions. Their length over the pinion radius sets the leverage.'},
    {name: 'Body and pins', role: 'Rests on the bottle lip and holds the pinion pins in place.'},
    {name: 'Worm', role: 'Holds the cork while the rack lifts it.'},
    {name: 'Cork and neck', role: 'The grip to beat, falling as the cork comes out.'},
    {name: 'Force chart', role: 'The push each wing needs along the cork against your push and the worm’s hold.'},
  ],
  tryIt: [
    wingTrial('Lift the default cork', 'Play with the helix screwed in 6 turns, a natural cork, 25 N on each wing and 95 mm wings.', 'Six turns drive the worm 42 mm in and raise the wings 172 degrees. Pressing them down with 22.1 N each lifts the rack with the 300 N the cork needs, and the cork rises 42 mm. The last 2 mm remain in the neck and need 14 N to pull out by hand.'),
    wingTrial('Screw in only 4 turns', 'Screw in 4 turns and play.', 'The wings rise only 115 degrees, so pressing them down lifts the cork just 28 mm. The last 16 mm still grip with 109 N, to pull by hand.', {turns: 4}),
    wingTrial('Push too lightly', 'Push with 15 N on each wing and play.', 'Both wings together lift the rack with only 204 N, less than the 300 N grip, so the cork does not move.', {wing: 15}),
    wingTrial('Shorten the wings', 'Use 60 mm wings and play.', 'The leverage falls from 13.6 to 8.6, so each wing needs 35.0 N and 25 N cannot start the cork.', {length: 60}),
    wingTrial('Lengthen the wings', 'Use 120 mm wings and play.', 'The leverage rises to 17.1 and each wing needs only 17.5 N. Each hand moves 360 mm along its arc; their combined paths total 720 mm to lift the cork 42 mm.', {length: 120}),
    wingTrial('Screw in one turn', 'Screw in 1 turn and play.', 'Seven millimeters of worm hold only 198 N, so pressing the wings tears the worm out of the cork.', {turns: 1}),
    wingTrial('Meet a synthetic cork', 'Choose the synthetic cork and play.', 'It needs 33.2 N on each wing, more than your 25 N, so nothing moves.', {grip: 2}),
    wingTrial('Beat the synthetic cork', 'Choose the synthetic cork and push with 35 N on each wing.', 'The cork starts once each wing pushes 33.2 N. Lifting it takes 9.88 J, and the last 2 mm need 20 N by hand.', {grip: 2, wing: 35}),
    wingTrial('Swap in a solid screw', 'Choose the solid screw and play, or use Inspect: turning the knob to compare the turning effort.', 'It holds 792 N instead of 1,188 N, still enough, but screwing it all the way in takes 20.7 N on each side of the knob instead of 10.3 N.', {worm: 1}),
    wingTrial('Follow the work', 'Play the default and compare how far each hand moves with how far the cork moves.', 'Each hand travels 285 mm. Their combined paths total 570 mm, 13.6 times the cork’s 42 mm lift. The rack force is 13.6 times each hand’s force; both hands together supply the lifting work.'),
  ],
  deeper: [
    {title: 'Rack and pinion', body: 'A rack is a gear with an infinite radius. When a pinion of pitch radius r turns through an angle in radians, the rack moves r times that angle. Driving the worm 42 mm in lowers the rack 42 mm and turns each 14 mm pinion 3 radians, raising the wings 172 degrees.'},
    {title: 'Two levers on one rack', body: 'Each wing is a lever pivoting on its pinion pin. A push F at its end, length L, makes a torque F L, and the pinion delivers that torque to the rack at radius r as a force F L / r. Two wings double it. With 95 mm wings on 14 mm pinions the leverage is 13.6.'},
    {title: 'The same work either way', body: 'Leverage does not reduce the work. Lifting a natural cork 42 mm takes 6.59 J here. Each hand travels L times the wing angle, 285 mm, while the cork travels r times that angle, 42 mm. Both hands contribute work: 2 times hand force times each hand’s distance equals rack force times rack distance. The force ratio of 13.6 compares the rack force with one hand’s force, while the two hands together move through a combined 570 mm.'},
    {title: 'Why the last bit comes out by hand', body: 'The fixed stops meet the lowered wings. The rack therefore rises only as far as it fell, so the wings can lift the cork by the worm’s insertion depth. Six turns go 42 mm into a 44 mm cork; the final 2 mm remain in the neck when the wings point down. This trial ends at that geared-stroke limit and reports the remaining hand pull.'},
    {title: 'Turning rings, not a straight rack', body: 'A straight rack would stop the shaft turning. Cutting the teeth as rings around the shaft keeps the mesh the same at any angle, so one shaft can both screw the worm in and be lifted by the pinions.'},
  ],
  misconception: 'The wings do not add energy. They trade force for distance: the hands push far less hard than the cork pulls, but move many times farther.',
  limits: corkLimits + ' This is an illustrative annular-rack design, not a calibrated commercial corkscrew. The wings are pushed perpendicular to their length, along their arcs, so the force direction changes and the leverage stays 2L/r. Axial offsets keep their grips clear of the body without changing that moment arm. Rack travel ends at the visible lower wing stops; any final hand pull is reported rather than animated. Insertion runs at one turn per second and extraction at a prescribed 25 mm/s. After tear-out, the loose worm and its cork plug withdraw at the same display speed; failure deformation, fragment motion and recovery forces are not calculated. The chart shows needed force only over the available wing stroke and rescales when settings change.',
  sources: [
    {title: 'OpenStax Physics: simple machines, levers and mechanical advantage', url: 'https://openstax.org/books/physics/pages/9-3-simple-machines'},
    {title: 'OpenStax College Physics 2e: friction', url: 'https://openstax.org/books/college-physics-2e/pages/5-1-friction'},
    {title: 'Annular-rack winged corkscrews and limits of their extraction stroke', url: 'https://patents.google.com/patent/WO2014013219A1/en'},
  ],
  quiz: {
    question: 'You make the wings longer. What changes?',
    options: [
      'Each wing needs less push, and the hands move farther for the same lift.',
      'The cork needs less force to come out.',
      'The cork comes out farther before you need to pull by hand.',
    ],
    answer: 0,
    explanation: 'Leverage is 2L/r: longer wings reduce the push but lengthen the path. The cork’s grip and the rack’s travel, set by the worm’s depth, do not change.',
  },
};
