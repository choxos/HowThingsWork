import {MAGNETIC_ALARM_DEFAULTS as D} from './magnetic-alarm-physics.js';
const trial=(title,instruction,observe,changes={},clock=0)=>{
  const values={...D,...changes};return {title,instruction,observe,values,reset:true,initialState:{settings:{...values},clock},part:'system',isolate:true,view:'front'};
};

export const magneticAlarmLesson={
  simple:'How can opening a window break a circuit and still make an alarm sound?',
  overview:'A magnet rides on the sliding sash. Beside it, a spring tries to pull a metal bar away from two contacts. With the window shut, magnetic attraction holds the bar against both contacts and a small sensing current flows. Lifting the window moves the magnet away. The spring releases the bar, the sensing current stops, and the powered controller turns on a separate sounder circuit. Follow the wires to see why a broken sensing loop can activate an alarm.',
  steps:[
    {title:'Hold the contacts together',body:'The nearby magnet attracts the guided metal bar. The bar bridges two fixed terminals, completing the sensing loop.'},
    {title:'Move the magnet with the window',body:'The sash lifts the magnet vertically. Its horizontal pull on the bar weakens as the height difference grows.'},
    {title:'Let the spring open the switch',body:'When magnetic attraction can no longer hold the bar, the preloaded spring pulls it against its released stop. Both contact gaps become visible.'},
    {title:'Detect the interrupted loop',body:'Sensing current falls from 1 mA to zero. The controller input rises from 0 V to 12 V through the sensing resistor.'},
    {title:'Power the sounder separately',body:'An armed controller stores the alarm request and closes its output contact. The blue branch supplies the sounder directly from the source.'},
    {title:'Close the window and inspect the memory',body:'The magnet eventually pulls the bar back onto the contacts. Sensing current returns, but the stored alarm remains until you clear it, disarm, or disconnect power.'},
  ],
  parts:[
    {name:'Sliding sash',role:'Carries the magnet away from the stationary switch.'},
    {name:'Permanent magnet',role:'Attracts the metal bar without a wire or power supply.'},
    {name:'Metal contact bar',role:'Bridges the two fixed terminals when held against them.'},
    {name:'Preloaded return spring',role:'Pulls the bar away when the magnetic pull becomes too weak.'},
    {name:'Two fixed electrical contacts',role:'Connect the two sides of the sensing loop through the bar.'},
    {name:'Two-wire sensing loop',role:'Carries the small monitoring current; a break also triggers the armed controller.'},
    {name:'12 V teaching supply',role:'Provides the energy for sensing and sound.'},
    {name:'12 kΩ sensing resistor',role:'Limits monitoring current and raises an open-loop input to supply voltage.'},
    {name:'Alarm memory and sensing input',role:'Retains an alarm request after the loop closes again.'},
    {name:'Sounder output contact',role:'Switches the separate sounder power branch.'},
    {name:'Powered sounder',role:'Turns electrical energy into vibration and sound.'},
  ],
  tryIt:[
    trial('Open, close, and remember','Play the full cycle, then inspect the controller.','The contacts release near 7.30 mm lift and reconnect near 6.99 mm on the return. The closed window does not clear the alarm.'),
    trial('A small movement','Run a cycle with only 4 mm lift.','The magnet holds the contacts throughout. Sensing current remains 1 mA and the sounder stays quiet.',{opening:4}),
    trial('Weaker and stronger magnets','Run this 7 mm lift with the weaker magnet. Then select Stronger and replay.','The weaker magnet releases near 6.67 mm and triggers. The stronger magnet holds through the same 7 mm movement.',{opening:7,magnet:.8}),
    trial('A firmer spring','Run the 7.25 mm lift with firm preload. Then select Medium preload and replay.','Firm preload releases near 7.06 mm and triggers. Medium preload holds until about 7.30 mm, beyond this movement.',{opening:7.25,spring:1.2}),
    trial('Mounted too far away','Start with the magnet 16 mm from the released bar. Inspect the contacts before pressing Play.','The magnet cannot close this switch, even with the window shut. The powered, armed controller already reports an open-loop alarm.',{gap:16}),
    trial('Break a wire instead','Leave the window shut and inspect the broken return lead.','The missing wire segment stops sensing current. The separate sounder circuit still has power, so the armed alarm operates.',{cable:0,opening:0}),
    trial('Move the window while disarmed','Play with the controller disarmed.','The magnet, spring and sensing current behave normally. The output contact stays open and the sounder receives no current.',{armed:0}),
    trial('Remove the electrical supply','Play with the supply disconnected.','The permanent magnet still holds and releases the bar. Both electrical currents remain zero, so no sounder can operate.',{power:0}),
    trial('A closed window with an alarm','Begin after a full opening and closing cycle. Use Clear alarm memory.','The contacts are closed and sensing current has returned. Clearing the stored request opens the output contact and silences the sounder.',{},10),
    trial('Try to clear an open loop','Begin with the window fully lifted. Use Clear alarm memory, then finish the cycle and clear it again.','The still-open loop immediately retriggers. Once the window closes and the loop returns, clearing the request can silence the alarm.',{},5),
  ],
  deeper:[
    {title:'One broken loop can switch another on',body:'The orange sensing route includes the supply, a 12 kΩ resistor, two leads and the contact bar. The controller input is idealized as drawing no current. Closed contacts hold that input at the negative terminal. Open contacts leave the resistor pulling it to +12 V. An armed controller responds by closing the separate blue sounder branch. Its 120 Ω equivalent load draws 100 mA and receives 1.2 W. The sensor does not create this energy.'},
    {title:'Why release and pickup differ',body:'The held bar is one illustrative millimeter closer to the magnet than the released bar. The attraction at those two positions differs. On opening, the magnet can hold the nearer bar until the spring wins. On closing, it must first attract the more distant, released bar. These two force balances produce different switching heights. The displayed numbers describe this chosen geometry, not a rated contact set.'},
    {title:'The magnetic approximation',body:'A small, linearly magnetizable tip represents the bar’s response to an ideal point magnet. In the magnet’s plane, its squared field is proportional to (4d² + h²)/(d² + h²)⁴. Differentiating toward the magnet gives horizontal pull proportional to d³/(d² + h²)⁵. Here d is horizontal tip-to-magnet distance and h is window lift. A guide supplies the transverse reaction. Real magnets and bars have finite shapes and nonlinear magnetization.'},
    {title:'The chosen spring and force scale',body:'The pull ratio uses magnetic force M² × 12⁷ × d³/(d² + h²)⁵ and spring force P + 0.1x in the same arbitrary units. Distances d and x use millimeters; M is relative magnet moment and P is the selected preload. The 12 mm reference, spring rate, one-millimeter travel and stops are assigned teaching parameters. No force in newtons or measured product sensitivity is implied. Motion between stops is treated as an immediate quasistatic snap.'},
    {title:'Magnetic contacts can take different forms',body:'Many commercial door contacts use two flexible magnetic reeds sealed in glass. Here, a separate spring and contact bar expose the same basic cause: moving the magnet permits contacts to open. A normally open switch can serve a closed-loop alarm because the nearby magnet holds it closed while the opening is secured. Product terms describe a particular contact arrangement and magnet condition.'},
    {title:'What the controller remembers',body:'This teaching controller latches immediately when its loop opens while armed and powered. Closing the loop alone does not clear it. Clearing while the loop remains open immediately sets it again. Disarming or disconnecting the supply clears this volatile memory. Real panels can include arming checks, delays, backup supplies, resistor supervision and different reset policies; those are not represented here.'},
  ],
  misconception:'The magnet does not power the alarm. It operates a switch in a sensing loop; a separate electrical supply provides the sound energy.',
  limits:'An enlarged mechanism with assigned dimensions, spring preload and magnetic response. The point-magnet and small induced-dipole approximation does not reproduce a manufacturer’s sensing range. Guides constrain the bar to one horizontal axis. Snap inertia, contact bounce, friction, saturation and magnetic interaction with the frame are omitted. The ideal sensing input, latch and output contact have no delay or losses. The sounder is represented by a 120 Ω equivalent load; its diaphragm motion and current markers are exaggerated symbols. Optional 1 kHz audio is not a rated alarm sound or loudness. The ten-second window trajectory is prescribed, not a prediction of hand motion. This is a mechanism experiment, not installation guidance.',
  sources:[
    {title:'MIT: magnetic dipole field, Haus and Melcher section 8.3',url:'https://web.mit.edu/6.013_book/www/chapter8/8.3.html'},
    {title:'MIT: magnetic force on a small magnetizable particle, section 11.8',url:'https://web.mit.edu/6.013_book/www/chapter11/11.8.html'},
    {title:'Standex: how magnetic reed contacts operate',url:'https://standexdetect.com/blog/what-is-a-reed-switch-and-how-does-it-work/'},
    {title:'George Risk Industries: closed-loop and open-loop magnetic contacts',url:'https://www.grisk.com/700-series_1-in-capped-mini-wide-gap/'},
  ],
  quiz:{question:'The window has closed and the sensing current has returned. Why can the alarm still sound?',options:['The controller remembers the interruption and keeps a separate powered branch closed.','The permanent magnet supplies current to the sounder.','Closing the window must keep the sensing contacts open.'],answer:0,explanation:'The two circuits have different jobs. Restoring the sensing loop does not erase the controller’s stored alarm request.'},
};
