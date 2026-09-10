export const hornLesson={
 simple:'How does a battery make a horn sound? Follow a moving iron bar, a flexible diaphragm and a contact that repeatedly interrupts current.',
 overview:'A traditional electric horn turns a steady supply into rapid vibration. Its coil attracts an iron bar attached to the center of a diaphragm. As the bar moves, it opens an internal contact and weakens the magnetic pull. The diaphragm springs back, the contact closes, and the pull builds again. The vibrating diaphragm moves the air; the hollow horn projects the sound.',
 steps:[
  {title:'Find what is fixed and what can move',body:'The rim clamps the diaphragm to the housing. The coil and its pole stay fixed. The iron bar is attached to the diaphragm center, so the bar and center move together while the rim stays in place.'},
  {title:'Press the horn button',body:'Advance one step. The button closes the supply path through the internal contact and coil. Current builds and the bar moves toward the fixed pole.'},
  {title:'Interrupt the pull',body:'Keep stepping. A small insulated actuator on the moving bar lifts the contact leaf. The opened contact interrupts the supply to the coil and its current fades.'},
  {title:'Let the diaphragm spring back',body:'The bent diaphragm pushes the bar back as the magnetic pull weakens. The contact closes again and a new cycle begins. The displayed motion is slowed so you can follow it.'},
  {title:'Produce a horn tone',body:'Press Play to complete the short horn pulse. Select Sound on to hear a synthesized tone while the working feedback cycle is established. The motion is slowed, but the tone uses the model’s vibration frequency.'},
  {title:'Inspect the result',body:'After the button releases, the diaphragm settles and the whole horn is shown again. Compare working vibration with an open contact, a bypass or a weak supply.'},
 ],
 parts:[
  {name:'Coil and fixed pole',role:'Produce a pull on the moving iron bar when current flows.'},
  {name:'Moving iron bar',role:'Transfers the magnetic pull to the attached diaphragm and operates the contact.'},
  {name:'Clamped diaphragm',role:'Flexes at its center while its rim stays fixed; its spring action returns the bar.'},
  {name:'Internal contact and actuator',role:'Interrupt coil current as the bar moves, then restore it during the return.'},
  {name:'Hollow projector',role:'Provides an open passage through which the diaphragm’s sound travels outward.'},
  {name:'Supply and horn button',role:'Provide energy during the selected short pulse.'},
 ],
 tryIt:[
  {title:'Sound a short horn pulse',instruction:'Step through the start of the cycle, then press Play. Enable Sound on if you want the audible demonstration.',observe:'The supported diaphragm center vibrates with the iron bar. The cycle count increases and the completed result records the horn pulse.',reset:true,part:'system',view:'front',isolate:false,values:{voltage:12,holdTime:.04,contact:0,sound:0}},
  {title:'Leave the internal contact open',instruction:'Inspect the separated contact faces, then press Play.',observe:'The horn button cannot complete the coil circuit. No magnetic motion or sustained tone develops.',reset:true,part:'contacts',view:'front',isolate:false,values:{voltage:12,holdTime:.04,contact:1,sound:0}},
  {title:'Bypass the interrupter',instruction:'Follow the jumper around the contact and press Play. Pause during the button hold to inspect the bar.',observe:'Current keeps flowing even when the contact opens. After a brief transient, the diaphragm remains deflected instead of sustaining its normal contact-controlled vibration.',reset:true,part:'system',view:'front',isolate:false,values:{voltage:12,holdTime:.08,contact:2,sound:0}},
  {title:'Use an insufficient supply',instruction:'Press Play with the weaker supply and watch the bar beside the fixed pole.',observe:'The small deflection never operates the interrupter. The horn does not establish its sustained tone.',reset:true,part:'system',view:'front',isolate:false,values:{voltage:6,holdTime:.04,contact:0,sound:0}},
 ],
 deeper:[
  {title:'The diaphragm is also a spring',body:'The diaphragm does two jobs: it moves air and provides a restoring force. The model combines its effective stiffness with the mass of the moving assembly and a damping term.'},
  {title:'The air gap changes the pull',body:'The bar moves toward the fixed pole inside the coil. A smaller gap generally strengthens attraction for the same current. Here an illustrative gap-dependent force is limited to represent saturation.'},
  {title:'A horn is not a bell with a different shape',body:'A bell strikes a gong. This horn drives a diaphragm back and forth; it does not require the bar to hit the pole or the housing during normal operation.'},
 ],
 misconception:'The coil does not reverse its magnetic polarity on every stroke. The mechanical contact interrupts its current, and the diaphragm supplies the restoring force.',
 limits:'A representative electromechanical horn with illustrative mass, stiffness, damping, resistance, inductance and magnetic force. The diaphragm uses a prescribed bending shape driven by the calculated center motion; it is not a full plate or stress solution. Contact-leaf forces, arcing, magnetic hysteresis and detailed acoustic loading are omitted. Motion runs at one hundredth of the model clock speed. Optional sound is a synthesized teaching tone at the measured model-cycle frequency, extended over the slowed demonstration; it is not a calibrated recording or sound-pressure prediction. Brief switching clicks and the horn’s acoustic resonances are not simulated.',
 sources:[
  {title:'Electromagnetic horn: diaphragm, armature and contact breaker',url:'https://patents.google.com/patent/US4398182A/en'},
  {title:'Horn pole gap and diaphragm return mechanism',url:'https://patents.google.com/patent/US4361952A/en'},
 ],
 quiz:{question:'What brings the iron bar back when the contact interrupts the magnetic pull?',options:['The spring action of the clamped diaphragm.','The battery reversing its polarity.','The hollow horn striking the bar.'],answer:0,explanation:'The flexed diaphragm stores elastic energy. As the magnetic pull fades, its restoring force returns the bar and allows the internal contact to close again.'},
};
