// Rebuild with node scripts/house-routes.mjs after changing model or lesson registries.
import {Box3} from "three";
import {Vector3} from "three";
export const housePresentationMetadata={
  "allLessons": {
    "Cylinder lock": {
      "simple": "The right key lines up five tiny joints. Turn it to pull the latch out of the frame, then open the door."
    },
    "Lever lock": {
      "simple": "Why does lifting every plate still fail with the wrong key? Try its shoulders, follow the bolt, and open the door."
    },
    "Keys": {
      "simple": "Can one changed cut stop a key from opening the door? Edit its shape, insert it, and test the result."
    },
    "Can opener": {
      "simple": "Why does turning the crank sometimes open the can, sometimes stall, and sometimes only spin the wheels?"
    },
    "Zipper": {
      "simple": "Start with two separate jacket sides. Fit the bottom pin into the slider and retaining box, then pull upward to fasten the jacket."
    },
    "Bottle opener": {
      "simple": "Why can a long bottle opener lift a tight cap, and why can a weaker pull start moving it but fail to finish?"
    },
    "Nutcracker": {
      "simple": "How do two long handles compress a nut, and why can the shell remain unbroken even after the handles begin to move?"
    },
    "Nail clippers": {
      "simple": "Can changing where you press turn a stalled clip into a clean cut? Follow the handle, post and bending blades to a clipped practice nail."
    },
    "Tweezers": {
      "simple": "Can the same squeeze lift a block when you move your fingers closer to the tips? Bend the arms, make contact, lift, and release."
    },
    "Bathroom scale": {
      "simple": "How can a platform that barely moves turn a readable dial, and why can a scale show zero correctly but still misread a load?"
    },
    "Platform scale": {
      "simple": "How can a small sliding weight balance a heavy platform load, and how can you tell balance from a mechanism resting against a stop?"
    },
    "Roberval balance": {
      "simple": "Why do equal masses balance even when you move them to different positions on their pans?"
    },
    "Sardine-can key": {
      "simple": "Why does a can key need more effort as its coil grows, and how do corners change its motion?"
    },
    "Salad spinner": {
      "simple": "How do a few turns of a crank throw the water off a salad, and why do some drops stay?"
    },
    "Mechanical clock": {
      "simple": "How do a falling weight, a swinging pendulum, and a train of gears turn motion into time?"
    },
    "Mechanical watch": {
      "simple": "How does a wound spring become seconds, minutes and hours without a battery?"
    },
    "Rack-and-pinion corkscrew": {
      "simple": "How do two wings and a toothed rack pull a cork that a straight pull struggles with?"
    },
    "Egg whisk": {
      "simple": "How does one slow turn of a handle become two fast beaters turning opposite ways, and why is stiff foam so hard work?"
    },
    "Electric mixer": {
      "simple": "Why does a mixer slow its motor down, and what happens when thick dough and poor cooling make it too hot?"
    },
    "Sewing machine": {
      "simple": "Why can a moving needle leave holes without a sewn seam? Coordinate two threads, the hook, take-up and feed to sew 40 mm of fabric."
    },
    "Screw corkscrew": {
      "simple": "Why does a corkscrew use an open spiral, and how deep does it need to go before you pull?"
    },
    "Faucet": {
      "simple": "How does a small handwheel control pressurized water, and why can a closed faucet still drip?"
    },
    "Meat grinder": {
      "simple": "How do a crank, a feed screw and a rotating knife make mince, and what happens when your hand cannot keep the requested speed?"
    },
    "Spin dryer": {
      "simple": "Why does water leave a spinning drum while the laundry stays inside, and what makes an uneven load shake?"
    },
    "Friction-drive toy": {
      "simple": "How does pushing a toy charge a flywheel, and why does the toy keep moving after you let go?"
    },
    "Window shade": {
      "simple": "Why does a gentle release hold the shade, while a tug and brisk release lets it roll up? Cover the window and compare the two hand motions."
    },
    "Ratchet": {
      "simple": "A catch lets a toothed wheel move one way and blocks it from moving back."
    },
    "Stapler": {
      "simple": "How do a blade, an anvil and two kinds of spring turn a row of staples into fastened pages?"
    },
    "Raft": {
      "simple": "How much cargo can six timbers carry? Load the raft, compare weight with buoyancy, and find out when the deck goes under."
    },
    "Vacuum cleaner": {
      "simple": "How does moving air carry dust into a bag, and why can stronger suction come with less airflow?"
    },
    "Upright vacuum cleaner": {
      "simple": "What does a powered brush add to airflow, and where does the loosened dust go?"
    },
    "Drinking straw": {
      "simple": "What pushes a drink up a straw, and why does a thick drink need a wider one?"
    },
    "Toilet tank": {
      "simple": "Why does one handle stroke start a whole flush, and how does the tank know when to stop refilling?"
    },
    "Water meter": {
      "simple": "How do turning blades become a readable water total, and why can a still meter miss a tiny leak?"
    },
    "Dishwasher": {
      "simple": "How can a small amount of water wash a whole load, and what makes the spray arm turn?"
    },
    "Aerosol spray can": {
      "simple": "How does a small valve control a pressurized spray, and what changes as the can empties?"
    },
    "Fire extinguisher": {
      "simple": "How does a small gas cartridge drive water through an extinguisher?"
    },
    "Ballpoint pen": {
      "simple": "How can a rolling ball carry ink from a narrow channel onto paper?"
    },
    "Felt-tip pen": {
      "simple": "How can a porous nib carry ink without a rolling ball or a pump?"
    },
    "Dip pen": {
      "simple": "How do a split nib, a small ink load and flexible tines make a written stroke?"
    },
    "Microwave oven": {
      "simple": "How do microwaves become heat, and why can a rotating bowl still contain cold spots?"
    },
    "Vacuum flask": {
      "simple": "Why do a vacuum, shiny walls and a stopper each matter when keeping a drink hot or cold?"
    },
    "Gas boiler": {
      "simple": "How does a tankless gas heater deliver hot water only when a tap draws it?"
    },
    "Toaster": {
      "simple": "How do hot ribbons brown bread, and how does a tiny heat-sensor contact release the toast?"
    },
    "Refrigerator": {
      "simple": "How does a refrigerator move heat out of a cold box into a warm kitchen?"
    },
    "Air conditioner": {
      "simple": "How does a machine make a room colder than the air outside it?"
    },
    "Liquid-in-glass thermometer": {
      "simple": "How does a tiny change in liquid volume become a visible temperature reading? Change the surroundings, compare the bore, and watch where the liquid goes."
    },
    "Maximum-minimum thermometer": {
      "simple": "How can a thermometer remember heat and cold after the temperature changes? Follow two liquid interfaces, inspect their memory markers, and reset them without rewinding the day."
    },
    "Binoculars": {
      "simple": "How do binoculars fit two upright telescopic views into a short body, and why do two viewpoints reveal depth?"
    },
    "Polarized light": {
      "simple": "How can a transparent filter block light, and why can adding another filter let some light through?"
    },
    "Liquid crystal display": {
      "simple": "How can an electrical signal write a dark number on glass without making any light?"
    },
    "Blu-ray player": {
      "simple": "How do a spinning disc, a focused laser and a channel clock recover stored information?"
    },
    "Electronic paper": {
      "simple": "How can a page keep its image without pixel power, and why does it still need light?"
    },
    "Smartphone": {
      "simple": "How do a touch, a turn, a vibration and a voice become actions inside one connected phone?"
    },
    "LCD screen": {
      "simple": "How does a sheet of tiny electrical shutters make a moving color picture? Follow row writes, stored voltage, twisted liquid crystal and three colored subpixels."
    },
    "OLED display": {
      "simple": "How does an OLED make light without a backlight, and why can it stay lit after its row switch turns off?"
    },
    "Air cleaner": {
      "simple": "How can an electric field pull tiny particles out of moving air, and why does cleaning a room take repeated passes?"
    },
    "Voltage multiplier": {
      "simple": "How can one alternating source build a higher voltage, and why does the output sag under load?"
    },
    "Lightning conductor": {
      "simple": "How does a lightning conductor carry a strike, and why can the nearby pipe and ground still have large voltages?"
    },
    "Kinetic quartz watch": {
      "simple": "How can wrist motion power a watch without setting its pace? Follow the weight, generator and capacitor, then watch a separate quartz-controlled motor turn the hands."
    },
    "Quartz clock": {
      "simple": "How do 32,768 tiny vibrations become one tick? Follow battery power through a quartz oscillator, electronic divider, stepping motor and connected hand gears."
    },
    "Remote control": {
      "simple": "How does a remote tell the TV which button you pressed?"
    },
    "Electromagnet": {
      "simple": "Can electricity pick something up? Power a lifting magnet, raise an iron load and switch off to release it."
    },
    "Electric bell": {
      "simple": "Electricity pulls a hammer, the movement switches the pull off, and a spring brings it back. The cycle repeats."
    },
    "Electric horn": {
      "simple": "How does a battery make a horn sound? Follow a moving iron bar, a flexible diaphragm and a contact that repeatedly interrupts current."
    },
    "Electric motor": {
      "simple": "Make a fan turn with electricity. Follow the current, watch the split ring swap its connections, then disconnect and let the fan coast."
    },
    "Universal motor": {
      "simple": "Why can the current reverse while the fan keeps turning the same way? Follow the two magnetic fields that reverse together."
    },
    "Direct-current motor": {
      "simple": "Make a fan turn with electricity. Follow the current, watch the split ring swap its connections, then disconnect and let the fan coast."
    },
    "3D printer": {
      "simple": "How do heat, filament feed and three coordinated movements turn a digital shape into a physical object? Print a small tray, then interrupt the process and recover it."
    },
    "Stepper motor": {
      "simple": "Can a sequence of electrical commands place a carriage where you ask? Follow the changing poles, toothed rotor and screw, then try a load the motor cannot hold."
    },
    "Electric generator": {
      "simple": "How does turning a coil deliver electricity, and why does the load push back?"
    },
    "Transformer": {
      "simple": "How can an AC source power a separate circuit at a different voltage?"
    },
    "Electricity transmission": {
      "simple": "Why raise voltage before transmitting electricity? Compare useful delivery with energy lost in the wires."
    },
    "Two-way light switch": {
      "simple": "How can either of two switches turn one reading light on or off? Follow the two possible routes, then compare the light on the page."
    },
    "Electricity meter": {
      "simple": "How does a turning disk remember the energy an appliance used? Run the appliance and follow its disk, worm and counting dial."
    },
    "Fuse": {
      "simple": "Why does an overload need time to melt a fuse? Heat the thin element, then inspect the gap that stops the lamp."
    },
    "Circuit breaker": {
      "simple": "How can electricity release a mechanical switch? Watch the coil pull a core, free the contact arm and switch off the lamp."
    },
    "Sensors and detectors": {
      "simple": "How can one sensor give a measured value and also detect that a limit has been crossed? Follow a load through a spring, a sliding electrical contact and two different outputs."
    },
    "Feedback mechanism": {
      "simple": "How does a machine use its own changing condition to correct what happens next? Follow a water level through a float, an inlet valve and the water that comes back into the tank."
    },
    "Seismograph": {
      "simple": "How can a moving instrument leave a record of ground shaking? Follow the ground-mounted frame, its suspended mass and the pen that draws on moving paper."
    },
    "Horizontal seismograph pendulum": {
      "simple": "How can a suspended boom detect sideways ground motion? Change the shaking direction and follow the mass relative to its moving support."
    },
    "Vertical seismograph pendulum": {
      "simple": "How can a spring-supported boom record vertical ground motion? Follow the spring tension, the turning mass and the motion recorded relative to the moving base."
    },
    "Seismic waves": {
      "simple": "How does an earthquake shake ground far away? Follow a traveling disturbance, watch nearby rock move back and forth, and compare the recordings at two distances."
    },
    "Crash sensor": {
      "simple": "How can a tiny suspended square turn a brief change in motion into an electrical signal? Follow the bending strips and bridge circuit, then distinguish the current signal from a recorded event."
    },
    "Autopilot": {
      "simple": "How does an autopilot turn measured heading and height errors into corrective control-surface motion? Follow two feedback loops, then see why holding a heading does not hold a ground path."
    },
    "Inertial guidance": {
      "simple": "How can three force measurements and a clock reconstruct a route? Follow the calculation, then see how a small sensor bias or a wrong starting velocity makes the estimate drift."
    },
    "Smoke detector": {
      "simple": "How can a little smoke make a loud alarm? Follow two different signals from the air to the sounder."
    },
    "Active burglar alarm": {
      "simple": "How can a reflected wave reveal that someone moved?"
    },
    "Passive infrared movement detector": {
      "simple": "How can a detector notice warm motion without sending a beam?"
    },
    "Games controller": {
      "simple": "How does a thumbstick move a game character, why does a button response take time, and how does the game send a rumble back?"
    },
    "Speech recognition": {
      "simple": "How can a spoken word move something on a screen?"
    },
    "Virtual reality headset": {
      "simple": "How can pictures and sound stay in a virtual room while the headset turns with your head?"
    },
    "Robot vacuum cleaner": {
      "simple": "How can a robot vacuum clean around obstacles, avoid a floor edge, and return to recharge?"
    },
    "Calculator": {
      "simple": "How do the numbers you enter become a result on a calculator display?"
    },
    "Water clock": {
      "simple": "How can flowing water move a clock hand, and what makes that hand gain or lose time?"
    },
    "Washing machine": {
      "simple": "How can one drum wash with a slow tumble, rinse away detergent, and spin out water while its cabinet stays put?"
    },
    "Unicycle": {
      "simple": "How can pedaling keep one wheel under a leaning rider?"
    },
    "Consumer unit": {
      "simple": "Why can one lighting circuit fail while another keeps working? Add lamps to two separately fused branches and trace their shared supply."
    },
    "Protective earth wire": {
      "simple": "What happens when a supply wire touches a metal case? Compare a complete protective path with a broken one, then watch whether the contact opens."
    },
    "Power socket": {
      "simple": "What has to connect before a plug can power a lamp? Insert it slowly and follow the shutter, pins and separate electrical contacts."
    },
    "Spark gap": {
      "simple": "Why can a pulse cross a narrow gap but fail to cross a wider one? Change the spacing between two electrodes and compare the voltage needed to start a discharge with the energy the gap receives."
    },
    "Electronic ignition": {
      "simple": "How can an electronic switch produce a timed spark without moving breaker contacts? Follow the command, the coil current and the energy delivered to four plugs."
    },
    "Earthquake location by arrival times": {
      "simple": "Why do several stations help locate an earthquake? Read the P and S arrivals, turn their time gaps into distance circles, and find which map locations satisfy all the observations."
    },
    "Vertical-seismograph suspension spring": {
      "simple": "How can a stretched spring support the pendulum’s weight and still restore a displaced boom? Compare the spring’s pull, the turning effect of gravity, and the motion after release."
    },
    "Seismograph recording pen and moving paper": {
      "simple": "How do a moving pen and a moving strip of paper turn shaking into a readable history? Change the paper speed, stop the feed, or lift the pen while the same instrument keeps moving."
    },
    "Spark-plug electrodes and ceramic insulator": {
      "simple": "Why must the center electrode conduct while the ceramic keeps it apart from the metal shell? Add a separate conducting route and see where the supplied energy goes."
    },
    "Inertial accelerometer armature, spring, and coils": {
      "simple": "How does a spring-mounted armature turn acceleration into an electrical reading? Follow its motion through three coils and a detector, then compare the indicated acceleration with the actual motion."
    },
    "Airbag warning indicator": {
      "simple": "How does a warning command become light, and what happens if the lamp cannot draw current? Follow the switched LED circuit, then compare its light, current and backup indication."
    },
    "Mirrors": {
      "simple": "How can the same law of reflection put an image behind a mirror, widen a driver’s view, form a headlamp beam, and let a periscope see past an obstacle?"
    },
    "Lenses": {
      "simple": "How can a lens project an upside-down cat, show an upright magnified cat, or zoom while the camera stays still?"
    },
    "Telescopes": {
      "simple": "How does a telescope turn distant light into a large view, and keep a moving sky target in sight?"
    },
    "Microscopes": {
      "simple": "How does a microscope turn a tiny specimen into an image, and why is a larger image not always more detailed?"
    }
  },
  "houseComponents": {
    "Scale calibrating plate": {
      "machine": "Bathroom scale",
      "intro": "How does one plate collect four lever forces, and why can the dial zero change without moving that plate?"
    },
    "Anchor escapement": {
      "machine": "Mechanical clock",
      "intro": "How do two pallets stop a clock train, release it, and return energy to a pendulum?"
    },
    "Lever escapement": {
      "machine": "Mechanical watch",
      "intro": "How can a watch keep its balance swinging while letting the spring-driven wheels advance one tooth at a time?"
    },
    "Lockstitch": {
      "machine": "Sewing machine",
      "intro": "A hook carries a loop of upper thread around the bobbin thread; the take-up then tightens their interlock."
    },
    "Feed-dog": {
      "machine": "Sewing machine",
      "intro": "Toothed bars rise, move the cloth while the needle is clear, drop, and return."
    },
    "Siphon": {
      "machine": "Toilet tank",
      "intro": "How can water climb over a bend, drain without continued pumping, and then stop when air enters?"
    },
    "Rotating spray arm": {
      "machine": "Dishwasher",
      "intro": "How can water turn a spray arm without a motor attached to the arm?"
    },
    "Capillary action": {
      "machine": "Capillary action",
      "intro": "Why does water stand higher inside narrow glass, while a nonwetting liquid can stand lower?"
    },
    "Refrigerant compressor": {
      "machine": "Refrigerator",
      "intro": "How do two automatic valves let a piston pump vapor, and why does clearance reduce its fresh intake?"
    },
    "CD": {
      "machine": "Blu-ray player",
      "intro": "How does a compact disc turn tiny marks back into sound?"
    },
    "DVD": {
      "machine": "Blu-ray player",
      "intro": "How can tiny marks on a DVD become a moving picture?"
    },
    "CD-ROM": {
      "machine": "Blu-ray player",
      "intro": "What does a CD-ROM supply to a computer?"
    },
    "CD-R": {
      "machine": "Blu-ray player",
      "intro": "How can a recordable disc store new bits and later return them?"
    },
    "DVD-R": {
      "machine": "Blu-ray player",
      "intro": "How does a writable DVD preserve a file for later playback?"
    },
    "Optical-disc readout": {
      "machine": "Blu-ray player",
      "intro": "How does an optical pickup turn a moving track into a stream of bits?"
    },
    "Electronic ink": {
      "machine": "Electronic paper",
      "intro": "How do moving pigments form a word that stays after power is removed?"
    },
    "Electrowetting display": {
      "machine": "Electronic paper",
      "intro": "How can moving oil reveal or hide a reflective color pixel?"
    },
    "E-reader": {
      "machine": "E-reader",
      "intro": "How does an e-reader turn a stored book into a readable page?"
    },
    "Accelerometer": {
      "machine": "Smartphone",
      "intro": "How can a silicon mass report a steady tilt, a sudden push and free fall? Follow three sensing axes from spring deflection to voltage."
    },
    "Vibration motor": {
      "machine": "Smartphone",
      "intro": "How does a tiny spinning weight make a phone buzz? Follow current through a brushed motor, then compare unbalance, recoil, coasting and electrical braking."
    },
    "RGB subpixels": {
      "machine": "LCD screen",
      "intro": "How can three separate colored apertures make one orange pixel, and why is code 128 not half the light?"
    },
    "Electrostatic precipitator": {
      "machine": "Air cleaner",
      "intro": "How do charged particles cross an air channel and stay on a collecting plate?"
    },
    "Ionizer": {
      "machine": "Air cleaner",
      "intro": "Can a particle gain or lose electric charge without leaving the room air?"
    },
    "Quartz oscillator": {
      "machine": "Quartz clock",
      "intro": "What keeps quartz vibrating? Follow a powered feedback loop, compare successful and failed startup, then watch stored vibration fade when feedback is disabled."
    },
    "Piezoelectricity": {
      "machine": "Quartz clock",
      "intro": "Can squeezing a crystal make a voltage, and can voltage move the same crystal? Press, hold and release an oriented quartz plate, then reverse the experiment."
    },
    "Infrared signaling": {
      "machine": "Remote control",
      "intro": "How can invisible flashes carry a digital command?"
    },
    "Diode": {
      "machine": "Remote control",
      "intro": "Why does reversing a diode change the current so much?"
    },
    "Light-emitting diode": {
      "machine": "Remote control",
      "intro": "How does a forward-biased LED turn electrical input into light?"
    },
    "Photodiode": {
      "machine": "Remote control",
      "intro": "How does a photodiode turn arriving light into an electrical signal?"
    },
    "Electric motor": {
      "machine": "Direct-current motor",
      "redirectTo": "direct-current-motor"
    },
    "Motor rotor": {
      "machine": "Universal motor",
      "intro": "How can the rotor keep turning while its winding currents change? Follow one winding, then trace its turning force to the fan."
    },
    "Commutator": {
      "machine": "Direct-current motor",
      "intro": "How can a rotating wire keep pushing the same way? Watch two copper halves exchange brushes and reverse the coil current."
    },
    "AC generator": {
      "machine": "Electric generator",
      "intro": "Why does a generator’s current reverse while its resistor keeps heating?"
    },
    "DC generator": {
      "machine": "Electric generator",
      "intro": "How can a reversing coil deliver current in one direction?"
    },
    "Distribution transformer": {
      "machine": "Transformer",
      "intro": "How does the receiving transformer lower voltage while supplying a larger current?"
    },
    "Ionization smoke detector": {
      "machine": "Smoke detector",
      "intro": "How can a current through air notice smoke?"
    },
    "Optical smoke detector": {
      "machine": "Smoke detector",
      "intro": "How can smoke send light around a corner?"
    },
    "Joystick": {
      "machine": "Games controller",
      "intro": "How do two sensors measure one thumbstick, and why can the same resting position produce different game commands?"
    },
    "Video games console": {
      "machine": "Games controller",
      "intro": "How does a console turn a controller report into a picture, and where does the response time go?"
    },
    "Phonemes": {
      "machine": "Speech recognition",
      "intro": "How do different speech sounds leave different frequency patterns?"
    },
    "Head tracking": {
      "machine": "Virtual reality headset",
      "intro": "How do turning-rate readings become a head direction, and how can a camera correct the errors?"
    },
    "Hairspring": {
      "machine": "Mechanical watch",
      "intro": "How does a thin spiral spring return a watch balance, exchange energy with it and set its natural pace?"
    },
    "Zipper slide wedges": {
      "machine": "Zipper",
      "intro": "How can the same slider join teeth in one direction and separate them in the other? Follow its three guiding faces."
    },
    "Interlocking zipper teeth": {
      "machine": "Zipper",
      "intro": "Why do joined teeth hold together, yet release through the slider? Inspect two nested shapes and follow their separation."
    },
    "Transmission transformer": {
      "machine": "Transformer",
      "intro": "How does the sending transformer raise line voltage without creating extra power?"
    },
    "Home-supply transformer": {
      "machine": "Transformer",
      "intro": "How does the final transformer supply a home as more loads are switched on?"
    },
    "Power-line insulator": {
      "machine": "Electricity transmission",
      "intro": "How can a metal tower support a power line without carrying its current?"
    },
    "Power pylon": {
      "machine": "Electricity transmission",
      "intro": "How do height, spacing and cable tension change a supported power line?"
    },
    "Bobbin and bobbin thread": {
      "machine": "Sewing machine",
      "intro": "What supplies the underside of a stitch? Trace the lower thread through its case, then compare a sewn seam with an empty-bobbin gap."
    },
    "Needle and needle thread": {
      "machine": "Sewing machine",
      "intro": "How does a needle carry thread through cloth and leave a loop for the hook? Compare its lowest point with its early rise."
    },
    "Rotary sewing hook": {
      "machine": "Sewing machine",
      "intro": "Why does the hook turn twice for one stitch, yet catch the loop only once? Compare its repeated orientation with the needle position."
    },
    "Rotary shuttle": {
      "machine": "Sewing machine",
      "redirectTo": "rotary-sewing-hook"
    },
    "Thread take-up lever": {
      "machine": "Sewing machine",
      "intro": "Why must the upper thread become slack before it can be tightened? Follow the moving eye through payout, a low dwell and recovery."
    },
    "Feed-dog lift and advance linkages": {
      "machine": "Sewing machine",
      "intro": "How do two sliding joints combine lift and travel without stretching a rod? Follow the cams into the connected feed bar, then change stitch length."
    },
    "Cylinder-lock cam and bolt": {
      "machine": "Cylinder lock",
      "intro": "How does a turning key pull a latch sideways? Follow the cam roller into its slotted follower, then open the door."
    },
    "Lock pin stacks": {
      "machine": "Cylinder lock",
      "intro": "Why can one misplaced pin stop the whole lock? Compare the five joints, then try turning the key."
    },
    "Lock return springs": {
      "machine": "Cylinder lock",
      "intro": "What resets the lock after your hand stops turning? Watch the latch spring return the cam, then the pin springs lower the pins."
    },
    "Lever-lock return springs": {
      "machine": "Lever lock",
      "intro": "Why does the bolt stay retracted when the springs lower the plates? Finish the key turn and follow the spring contacts."
    },
    "Lever-lock tumblers and stumps": {
      "machine": "Lever lock",
      "intro": "Why can one over-raised plate stop the whole bolt? Compare its gate with the blue bolt path."
    },
    "Lever-lock bolt and bolt pin": {
      "machine": "Lever lock",
      "intro": "Why can the key turn before the bolt starts moving? Follow the drive roller, then clear the door frame."
    },
    "Lock cylinder (plug)": {
      "machine": "Cylinder lock",
      "intro": "Which part turns inside a lock? Free the plug, follow its shaft to the latch, and open the door."
    },
    "Lever-lock key": {
      "machine": "Lever lock",
      "intro": "How can one key lift three plates and move a bolt? Follow its shoulders through a complete turn."
    },
    "Zipper bottom pin and box": {
      "machine": "Zipper",
      "intro": "What is the small fitting you join before zipping a jacket? Thread the free pin through the slider and seat it in the retaining box."
    },
    "Window-shade pawls and locking disk": {
      "machine": "Window shade",
      "intro": "Which part stays still while the shade turns? Watch two hinged catches travel around a fixed ratchet, then compare a gentle stop with a brisk release."
    },
    "Window-shade winding spring": {
      "machine": "Window shade",
      "intro": "Where does the shade get the energy to roll back up? Follow the spring from its fixed end to its rotating end, wind it by lowering the shade, then release the catch."
    },
    "Window-shade roller shaft and fixed central rod": {
      "machine": "Window shade",
      "intro": "Does the whole roller turn as one solid piece? Follow the fixed inner rod and the outer tube while you lower, hold and raise the shade."
    },
    "Electric-bell armature": {
      "machine": "Electric bell",
      "intro": "What turns a magnetic pull into a hammer strike? Follow the moving iron bar while the coils and gong stay fixed."
    },
    "Electromagnetic make-and-break contacts": {
      "machine": "Electric bell",
      "intro": "How can one button press produce repeated strikes? Watch a moving contact interrupt the very current that pulled it open."
    },
    "Vibrating horn diaphragm": {
      "machine": "Electric horn",
      "intro": "How can a sheet make sound and return an iron bar? Compare the diaphragm’s fixed rim with its moving center."
    },
    "Horn make-and-break contacts": {
      "machine": "Electric horn",
      "intro": "How does a horn interrupt its own current? Follow the insulated actuator from the moving iron bar to the contact leaf."
    },
    "Electric-horn moving iron bar": {
      "machine": "Electric horn",
      "intro": "What carries the magnetic pull to the diaphragm? Follow the moving bar inside the fixed coil."
    },
    "Electric-bell pushbutton switch": {
      "machine": "Electric bell",
      "intro": "How does a small button start a whole bell? Watch its bridge join two terminals, then compare a short press with a longer hold."
    },
    "Electric-bell hammer and metal bell": {
      "machine": "Electric bell",
      "intro": "What makes the bell ring? Watch the moving hammer reach the supported metal rim."
    },
    "Electric-bell return spring": {
      "machine": "Electric bell",
      "intro": "What brings the hammer back for another strike? Follow the spring between the fixed support and moving armature."
    },
    "Heated extrusion nozzle": {
      "machine": "3D printer",
      "intro": "Why does a nozzle need both heat and filament feed to lay a bead? Follow solid filament through the cutaway hotend and compare its incoming speed with the plastic leaving it."
    },
    "Printer filament reel": {
      "machine": "3D printer",
      "intro": "What makes the filament reel unwind? Follow the continuous supply to the moving head and compare the shrinking winding with the material actually printed."
    },
    "Layer-by-layer fabrication": {
      "machine": "3D printer",
      "intro": "How do flat paths become a three-dimensional object? Build a tray, then pause at its finished base and distinguish moving to a new layer from actually depositing that layer."
    },
    "Generator slip rings": {
      "machine": "Electric generator",
      "intro": "How does a fixed circuit stay connected to a rotating winding?"
    },
    "Transformer turns ratio": {
      "machine": "Transformer",
      "intro": "Does adding turns to both windings change the output, or does their proportion matter?"
    },
    "Microchip deceleration sensor": {
      "machine": "Crash sensor",
      "redirectTo": "crash-sensor"
    },
    "Crash-sensor proof square and sensing strips": {
      "machine": "Crash sensor",
      "intro": "Why can a square attached on four sides move relative to its frame? Follow its inertia, the bending strips and the forces that restore it after an acceleration pulse."
    }
  }
};
export const houseRouteLoaders={
"cylinder-lock":async()=>{const [{createCylinderModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./cylinder-model.js"),import("./daily-life-lessons.js")]);return {name:"Cylinder lock",canonicalName:"Cylinder lock",component:undefined,canonicalLesson:routeCanonicalLessons["Cylinder lock"],createHouseModel:name=>name==="Cylinder lock"?routeFallbackFactory():null};},
"lever-lock":async()=>{const [{createLeverModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lever-model.js"),import("./daily-life-lessons.js")]);return {name:"Lever lock",canonicalName:"Lever lock",component:undefined,canonicalLesson:routeCanonicalLessons["Lever lock"],createHouseModel:name=>name==="Lever lock"?routeFallbackFactory():null};},
"keys":async()=>{const [{createCylinderModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./cylinder-model.js"),import("./daily-life-lessons.js")]);return {name:"Keys",canonicalName:"Keys",component:undefined,canonicalLesson:routeCanonicalLessons["Keys"],createHouseModel:name=>name==="Keys"?routeFallbackFactory({editableKey:true}):null};},
"can-opener":async()=>{const [{createCanOpenerModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./can-opener-model.js"),import("./kitchen-lessons.js")]);return {name:"Can opener",canonicalName:"Can opener",component:undefined,canonicalLesson:routeCanonicalLessons["Can opener"],createHouseModel:name=>name==="Can opener"?routeFallbackFactory():null};},
"zipper":async()=>{const [{createZipperModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./zipper-model.js"),import("./daily-life-lessons.js")]);return {name:"Zipper",canonicalName:"Zipper",component:undefined,canonicalLesson:routeCanonicalLessons["Zipper"],createHouseModel:name=>name==="Zipper"?routeFallbackFactory():null};},
"bottle-opener":async()=>{const [{createBottleOpenerModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./bottle-opener-model.js"),import("./kitchen-lessons.js")]);return {name:"Bottle opener",canonicalName:"Bottle opener",component:undefined,canonicalLesson:routeCanonicalLessons["Bottle opener"],createHouseModel:name=>name==="Bottle opener"?routeFallbackFactory():null};},
"nutcracker":async()=>{const [{createNutcrackerModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./nutcracker-model.js"),import("./kitchen-lessons.js")]);return {name:"Nutcracker",canonicalName:"Nutcracker",component:undefined,canonicalLesson:routeCanonicalLessons["Nutcracker"],createHouseModel:name=>name==="Nutcracker"?routeFallbackFactory():null};},
"nail-clippers":async()=>{const [{createClipperModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./clipper-model.js"),import("./daily-life-lessons.js")]);return {name:"Nail clippers",canonicalName:"Nail clippers",component:undefined,canonicalLesson:routeCanonicalLessons["Nail clippers"],createHouseModel:name=>name==="Nail clippers"?routeFallbackFactory():null};},
"tweezers":async()=>{const [{createTweezersModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./tweezers-model.js"),import("./daily-life-lessons.js")]);return {name:"Tweezers",canonicalName:"Tweezers",component:undefined,canonicalLesson:routeCanonicalLessons["Tweezers"],createHouseModel:name=>name==="Tweezers"?routeFallbackFactory():null};},
"bathroom-scale":async()=>{const [{createBathroomScaleModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./bathroom-scale-model.js"),import("./time-lessons.js")]);return {name:"Bathroom scale",canonicalName:"Bathroom scale",component:undefined,canonicalLesson:routeCanonicalLessons["Bathroom scale"],createHouseModel:name=>name==="Bathroom scale"?routeFallbackFactory():null};},
"platform-scale":async()=>{const [{createPlatformScaleModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./platform-scale-model.js"),import("./time-lessons.js")]);return {name:"Platform scale",canonicalName:"Platform scale",component:undefined,canonicalLesson:routeCanonicalLessons["Platform scale"],createHouseModel:name=>name==="Platform scale"?routeFallbackFactory():null};},
"roberval-balance":async()=>{const [{createRobervalBalanceModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./roberval-balance-model.js"),import("./time-lessons.js")]);return {name:"Roberval balance",canonicalName:"Roberval balance",component:undefined,canonicalLesson:routeCanonicalLessons["Roberval balance"],createHouseModel:name=>name==="Roberval balance"?routeFallbackFactory():null};},
"scale-calibrating-plate":async()=>{const [{createBathroomScaleModel,createBathroomScaleModel:routeFallbackFactory},{scaleCalibratingPlateLesson},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./bathroom-scale-model.js"),import("./scale-calibrating-plate-lesson.js"),import("./time-lessons.js")]);return {name:"Scale calibrating plate",canonicalName:"Bathroom scale",component:{machine:'Bathroom scale',part:'calibration',view:'front',isolate:false,createModel:()=>createBathroomScaleModel({plateTeaching:true}),lesson:scaleCalibratingPlateLesson,intro:scaleCalibratingPlateLesson.simple},canonicalLesson:routeCanonicalLessons["Bathroom scale"],createHouseModel:name=>name==="Bathroom scale"?routeFallbackFactory():null};},
"sardine-can-key":async()=>{const [{createSardineCanKeyModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./sardine-can-key-model.js"),import("./kitchen-lessons.js")]);return {name:"Sardine-can key",canonicalName:"Sardine-can key",component:undefined,canonicalLesson:routeCanonicalLessons["Sardine-can key"],createHouseModel:name=>name==="Sardine-can key"?routeFallbackFactory():null};},
"salad-spinner":async()=>{const [{createSaladSpinnerModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./salad-spinner-model.js"),import("./kitchen-lessons.js")]);return {name:"Salad spinner",canonicalName:"Salad spinner",component:undefined,canonicalLesson:routeCanonicalLessons["Salad spinner"],createHouseModel:name=>name==="Salad spinner"?routeFallbackFactory():null};},
"mechanical-clock":async()=>{const [{createPendulumClockModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./pendulum-clock-model.js"),import("./time-lessons.js")]);return {name:"Mechanical clock",canonicalName:"Mechanical clock",component:undefined,canonicalLesson:routeCanonicalLessons["Mechanical clock"],createHouseModel:name=>name==="Mechanical clock"?routeFallbackFactory():null};},
"mechanical-watch":async()=>{const [{createWatchModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./watch-model.js"),import("./time-lessons.js")]);return {name:"Mechanical watch",canonicalName:"Mechanical watch",component:undefined,canonicalLesson:routeCanonicalLessons["Mechanical watch"],createHouseModel:name=>name==="Mechanical watch"?routeFallbackFactory():null};},
"anchor-escapement":async()=>{const [{createAnchorEscapementModel},{anchorEscapementLesson},{createPendulumClockModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./anchor-escapement-model.js"),import("./pendulum-clock-lessons.js"),import("./pendulum-clock-model.js"),import("./time-lessons.js")]);return {name:"Anchor escapement",canonicalName:"Mechanical clock",component:{machine:'Mechanical clock',createModel:createAnchorEscapementModel,part:'escapement',isolate:true,view:'front',lesson:anchorEscapementLesson,intro:anchorEscapementLesson.simple},canonicalLesson:routeCanonicalLessons["Mechanical clock"],createHouseModel:name=>name==="Mechanical clock"?routeFallbackFactory():null};},
"lever-escapement":async()=>{const [{createLeverEscapementModel},{leverEscapementLesson},{createWatchModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./lever-escapement-model.js"),import("./watch-lessons.js"),import("./watch-model.js"),import("./time-lessons.js")]);return {name:"Lever escapement",canonicalName:"Mechanical watch",component:{machine:'Mechanical watch',createModel:createLeverEscapementModel,part:'escapement',isolate:false,view:'front',lesson:leverEscapementLesson,intro:leverEscapementLesson.simple},canonicalLesson:routeCanonicalLessons["Mechanical watch"],createHouseModel:name=>name==="Mechanical watch"?routeFallbackFactory():null};},
"rack-and-pinion-corkscrew":async()=>{const [{createWingedCorkscrewModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./winged-corkscrew-model.js"),import("./kitchen-lessons.js")]);return {name:"Rack-and-pinion corkscrew",canonicalName:"Rack-and-pinion corkscrew",component:undefined,canonicalLesson:routeCanonicalLessons["Rack-and-pinion corkscrew"],createHouseModel:name=>name==="Rack-and-pinion corkscrew"?routeFallbackFactory():null};},
"egg-whisk":async()=>{const [{createEggWhiskModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./egg-whisk-model.js"),import("./kitchen-lessons.js")]);return {name:"Egg whisk",canonicalName:"Egg whisk",component:undefined,canonicalLesson:routeCanonicalLessons["Egg whisk"],createHouseModel:name=>name==="Egg whisk"?routeFallbackFactory():null};},
"electric-mixer":async()=>{const [{createElectricMixerModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./electric-mixer-model.js"),import("./kitchen-lessons.js")]);return {name:"Electric mixer",canonicalName:"Electric mixer",component:undefined,canonicalLesson:routeCanonicalLessons["Electric mixer"],createHouseModel:name=>name==="Electric mixer"?routeFallbackFactory():null};},
"sewing-machine":async()=>{const [{createSewingModel:routeFallbackFactory},{utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./sewing-model.js"),import("./utility-lessons.js")]);return {name:"Sewing machine",canonicalName:"Sewing machine",component:undefined,canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"lockstitch":async()=>{const [{utilityComponentLessons,utilityLessons:routeCanonicalLessons},{createSewingModel,createSewingModel:routeFallbackFactory}]=await Promise.all([import("./utility-lessons.js"),import("./sewing-model.js")]);return {name:"Lockstitch",canonicalName:"Sewing machine",component:{lesson:utilityComponentLessons.Lockstitch,machine:'Sewing machine',createModel:()=>{const model=createSewingModel();model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','needle','hook-assembly','hook','bobbin','take-up','take-up-rocker'];return model;},part:'stitch-formation',view:'side',isolate:true,intro:'A hook carries a loop of upper thread around the bobbin thread; the take-up then tightens their interlock.'},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"feed-dog":async()=>{const [{utilityComponentLessons,utilityLessons:routeCanonicalLessons},{createSewingModel,createSewingModel:routeFallbackFactory}]=await Promise.all([import("./utility-lessons.js"),import("./sewing-model.js")]);return {name:"Feed-dog",canonicalName:"Sewing machine",component:{lesson:utilityComponentLessons['Feed-dog'],machine:'Sewing machine',createModel:()=>{const model=createSewingModel({feedLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'feed-bar',view:'side',isolate:true,intro:'Toothed bars rise, move the cloth while the needle is clear, drop, and return.'},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"screw-corkscrew":async()=>{const [{createScrewCorkscrewModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./screw-corkscrew-model.js"),import("./kitchen-lessons.js")]);return {name:"Screw corkscrew",canonicalName:"Screw corkscrew",component:undefined,canonicalLesson:routeCanonicalLessons["Screw corkscrew"],createHouseModel:name=>name==="Screw corkscrew"?routeFallbackFactory():null};},
"faucet":async()=>{const [{createFaucetModel:routeFallbackFactory},{utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./faucet-model.js"),import("./utility-lessons.js")]);return {name:"Faucet",canonicalName:"Faucet",component:undefined,canonicalLesson:routeCanonicalLessons["Faucet"],createHouseModel:name=>name==="Faucet"?routeFallbackFactory():null};},
"meat-grinder":async()=>{const [{createMeatGrinderModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./meat-grinder-model.js"),import("./kitchen-lessons.js")]);return {name:"Meat grinder",canonicalName:"Meat grinder",component:undefined,canonicalLesson:routeCanonicalLessons["Meat grinder"],createHouseModel:name=>name==="Meat grinder"?routeFallbackFactory():null};},
"spin-dryer":async()=>{const [{createSpinDryerModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./spin-dryer-model.js"),import("./cleaning-lessons.js")]);return {name:"Spin dryer",canonicalName:"Spin dryer",component:undefined,canonicalLesson:routeCanonicalLessons["Spin dryer"],createHouseModel:name=>name==="Spin dryer"?routeFallbackFactory():null};},
"friction-drive-toy":async()=>{const [{createFrictionDriveToyModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./friction-drive-toy-model.js"),import("./play-lessons.js")]);return {name:"Friction-drive toy",canonicalName:"Friction-drive toy",component:undefined,canonicalLesson:routeCanonicalLessons["Friction-drive toy"],createHouseModel:name=>name==="Friction-drive toy"?routeFallbackFactory():null};},
"window-shade":async()=>{const [{createWindowShadeModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./window-shade-model.js"),import("./daily-life-lessons.js")]);return {name:"Window shade",canonicalName:"Window shade",component:undefined,canonicalLesson:routeCanonicalLessons["Window shade"],createHouseModel:name=>name==="Window shade"?routeFallbackFactory():null};},
"ratchet":async()=>{const [{createRatchetModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./ratchet-model.js"),import("./daily-life-lessons.js")]);return {name:"Ratchet",canonicalName:"Ratchet",component:undefined,canonicalLesson:routeCanonicalLessons["Ratchet"],createHouseModel:name=>name==="Ratchet"?routeFallbackFactory():null};},
"stapler":async()=>{const [{createStaplerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./stapler-model.js"),import("./study-lessons.js")]);return {name:"Stapler",canonicalName:"Stapler",component:undefined,canonicalLesson:routeCanonicalLessons["Stapler"],createHouseModel:name=>name==="Stapler"?routeFallbackFactory():null};},
"raft":async()=>{const [{createRaftModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./raft-model.js"),import("./daily-life-lessons.js")]);return {name:"Raft",canonicalName:"Raft",component:undefined,canonicalLesson:routeCanonicalLessons["Raft"],createHouseModel:name=>name==="Raft"?routeFallbackFactory():null};},
"vacuum-cleaner":async()=>{const [{createVacuumCleanerModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./vacuum-models.js"),import("./cleaning-lessons.js")]);return {name:"Vacuum cleaner",canonicalName:"Vacuum cleaner",component:undefined,canonicalLesson:routeCanonicalLessons["Vacuum cleaner"],createHouseModel:name=>name==="Vacuum cleaner"?routeFallbackFactory():null};},
"upright-vacuum-cleaner":async()=>{const [{createUprightVacuumModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./vacuum-models.js"),import("./cleaning-lessons.js")]);return {name:"Upright vacuum cleaner",canonicalName:"Upright vacuum cleaner",component:undefined,canonicalLesson:routeCanonicalLessons["Upright vacuum cleaner"],createHouseModel:name=>name==="Upright vacuum cleaner"?routeFallbackFactory():null};},
"drinking-straw":async()=>{const [{createDrinkingStrawModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./drinking-straw-model.js"),import("./kitchen-lessons.js")]);return {name:"Drinking straw",canonicalName:"Drinking straw",component:undefined,canonicalLesson:routeCanonicalLessons["Drinking straw"],createHouseModel:name=>name==="Drinking straw"?routeFallbackFactory():null};},
"toilet-tank":async()=>{const [{createToiletTankModel:routeFallbackFactory},{utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./toilet-tank-model.js"),import("./utility-lessons.js")]);return {name:"Toilet tank",canonicalName:"Toilet tank",component:undefined,canonicalLesson:routeCanonicalLessons["Toilet tank"],createHouseModel:name=>name==="Toilet tank"?routeFallbackFactory():null};},
"siphon":async()=>{const [{createSiphonModel},{utilityComponentLessons,utilityLessons:routeCanonicalLessons},{createToiletTankModel:routeFallbackFactory}]=await Promise.all([import("./siphon-model.js"),import("./utility-lessons.js"),import("./toilet-tank-model.js")]);return {name:"Siphon",canonicalName:"Toilet tank",component:{machine:'Toilet tank',createModel:createSiphonModel,part:'system',isolate:false,view:'front',lesson:utilityComponentLessons['Siphon'],intro:utilityComponentLessons['Siphon'].simple},canonicalLesson:routeCanonicalLessons["Toilet tank"],createHouseModel:name=>name==="Toilet tank"?routeFallbackFactory():null};},
"water-meter":async()=>{const [{createWaterMeterModel:routeFallbackFactory},{utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./water-meter-model.js"),import("./utility-lessons.js")]);return {name:"Water meter",canonicalName:"Water meter",component:undefined,canonicalLesson:routeCanonicalLessons["Water meter"],createHouseModel:name=>name==="Water meter"?routeFallbackFactory():null};},
"dishwasher":async()=>{const [{createDishwasherModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./dishwasher-model.js"),import("./kitchen-lessons.js")]);return {name:"Dishwasher",canonicalName:"Dishwasher",component:undefined,canonicalLesson:routeCanonicalLessons["Dishwasher"],createHouseModel:name=>name==="Dishwasher"?routeFallbackFactory():null};},
"rotating-spray-arm":async()=>{const [{createDishwasherModel,createDishwasherModel:routeFallbackFactory},{rotatingSprayArmLesson},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./dishwasher-model.js"),import("./dishwasher-lessons.js"),import("./kitchen-lessons.js")]);return {name:"Rotating spray arm",canonicalName:"Dishwasher",component:{machine:'Dishwasher',createModel:()=>createDishwasherModel({sprayArmLesson:true}),part:'system',isolate:false,view:'front',lesson:rotatingSprayArmLesson,intro:rotatingSprayArmLesson.simple},canonicalLesson:routeCanonicalLessons["Dishwasher"],createHouseModel:name=>name==="Dishwasher"?routeFallbackFactory():null};},
"aerosol-spray-can":async()=>{const [{createAerosolCanModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./aerosol-model.js"),import("./cleaning-lessons.js")]);return {name:"Aerosol spray can",canonicalName:"Aerosol spray can",component:undefined,canonicalLesson:routeCanonicalLessons["Aerosol spray can"],createHouseModel:name=>name==="Aerosol spray can"?routeFallbackFactory():null};},
"fire-extinguisher":async()=>{const [{createCartridgeExtinguisherModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./cartridge-extinguisher-model.js"),import("./safety-lessons.js")]);return {name:"Fire extinguisher",canonicalName:"Fire extinguisher",component:undefined,canonicalLesson:routeCanonicalLessons["Fire extinguisher"],createHouseModel:name=>name==="Fire extinguisher"?routeFallbackFactory():null};},
"ballpoint-pen":async()=>{const [{createBallpointModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./ballpoint-model.js"),import("./study-lessons.js")]);return {name:"Ballpoint pen",canonicalName:"Ballpoint pen",component:undefined,canonicalLesson:routeCanonicalLessons["Ballpoint pen"],createHouseModel:name=>name==="Ballpoint pen"?routeFallbackFactory():null};},
"felt-tip-pen":async()=>{const [{createFeltTipModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./felt-tip-model.js"),import("./study-lessons.js")]);return {name:"Felt-tip pen",canonicalName:"Felt-tip pen",component:undefined,canonicalLesson:routeCanonicalLessons["Felt-tip pen"],createHouseModel:name=>name==="Felt-tip pen"?routeFallbackFactory():null};},
"dip-pen":async()=>{const [{createDipPenModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./dip-pen-model.js"),import("./study-lessons.js")]);return {name:"Dip pen",canonicalName:"Dip pen",component:undefined,canonicalLesson:routeCanonicalLessons["Dip pen"],createHouseModel:name=>name==="Dip pen"?routeFallbackFactory():null};},
"capillary-action":async()=>{const [{createCapillaryModel},{capillaryActionLesson}]=await Promise.all([import("./capillary-model.js"),import("./pens-lessons.js")]);return {name:"Capillary action",canonicalName:"Capillary action",component:{machine:'Capillary action',createModel:createCapillaryModel,part:'capillary',isolate:false,view:'front',lesson:capillaryActionLesson,intro:capillaryActionLesson.simple},canonicalLesson:undefined,createHouseModel:name=>null};},
"microwave-oven":async()=>{const [{createMicrowaveModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./microwave-model.js"),import("./kitchen-lessons.js")]);return {name:"Microwave oven",canonicalName:"Microwave oven",component:undefined,canonicalLesson:routeCanonicalLessons["Microwave oven"],createHouseModel:name=>name==="Microwave oven"?routeFallbackFactory():null};},
"vacuum-flask":async()=>{const [{createVacuumFlaskModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./vacuum-flask-model.js"),import("./kitchen-lessons.js")]);return {name:"Vacuum flask",canonicalName:"Vacuum flask",component:undefined,canonicalLesson:routeCanonicalLessons["Vacuum flask"],createHouseModel:name=>name==="Vacuum flask"?routeFallbackFactory():null};},
"gas-boiler":async()=>{const [{createTanklessHeaterModel:routeFallbackFactory},{heatingLessons:routeCanonicalLessons}]=await Promise.all([import("./tankless-heater-model.js"),import("./heating-lessons.js")]);return {name:"Gas boiler",canonicalName:"Gas boiler",component:undefined,canonicalLesson:routeCanonicalLessons["Gas boiler"],createHouseModel:name=>name==="Gas boiler"?routeFallbackFactory():null};},
"toaster":async()=>{const [{createToasterModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./toaster-model.js"),import("./kitchen-lessons.js")]);return {name:"Toaster",canonicalName:"Toaster",component:undefined,canonicalLesson:routeCanonicalLessons["Toaster"],createHouseModel:name=>name==="Toaster"?routeFallbackFactory():null};},
"refrigerator":async()=>{const [{createRefrigeratorModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./refrigerator-model.js"),import("./kitchen-lessons.js")]);return {name:"Refrigerator",canonicalName:"Refrigerator",component:undefined,canonicalLesson:routeCanonicalLessons["Refrigerator"],createHouseModel:name=>name==="Refrigerator"?routeFallbackFactory():null};},
"refrigerant-compressor":async()=>{const [{createRefrigerantCompressorModel},{refrigerantCompressorLesson},{createRefrigeratorModel:routeFallbackFactory},{kitchenLessons:routeCanonicalLessons}]=await Promise.all([import("./refrigerant-compressor-model.js"),import("./refrigerator-lessons.js"),import("./refrigerator-model.js"),import("./kitchen-lessons.js")]);return {name:"Refrigerant compressor",canonicalName:"Refrigerator",component:{machine:'Refrigerator',createModel:createRefrigerantCompressorModel,part:'system',isolate:false,view:'front',lesson:refrigerantCompressorLesson,intro:refrigerantCompressorLesson.simple},canonicalLesson:routeCanonicalLessons["Refrigerator"],createHouseModel:name=>name==="Refrigerator"?routeFallbackFactory():null};},
"air-conditioner":async()=>{const [{createAirConditionerModel:routeFallbackFactory},{heatingLessons:routeCanonicalLessons}]=await Promise.all([import("./aircon-model.js"),import("./heating-lessons.js")]);return {name:"Air conditioner",canonicalName:"Air conditioner",component:undefined,canonicalLesson:routeCanonicalLessons["Air conditioner"],createHouseModel:name=>name==="Air conditioner"?routeFallbackFactory():null};},
"liquid-in-glass-thermometer":async()=>{const [{createLiquidThermometerModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./thermometer-models.js"),import("./time-lessons.js")]);return {name:"Liquid-in-glass thermometer",canonicalName:"Liquid-in-glass thermometer",component:undefined,canonicalLesson:routeCanonicalLessons["Liquid-in-glass thermometer"],createHouseModel:name=>name==="Liquid-in-glass thermometer"?routeFallbackFactory():null};},
"maximum-minimum-thermometer":async()=>{const [{createSixThermometerModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./thermometer-models.js"),import("./time-lessons.js")]);return {name:"Maximum-minimum thermometer",canonicalName:"Maximum-minimum thermometer",component:undefined,canonicalLesson:routeCanonicalLessons["Maximum-minimum thermometer"],createHouseModel:name=>name==="Maximum-minimum thermometer"?routeFallbackFactory():null};},
"binoculars":async()=>{const [{createBinocularsModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./binoculars-model.js"),import("./daily-life-lessons.js")]);return {name:"Binoculars",canonicalName:"Binoculars",component:undefined,canonicalLesson:routeCanonicalLessons["Binoculars"],createHouseModel:name=>name==="Binoculars"?routeFallbackFactory():null};},
"polarized-light":async()=>{const [{createPolarizedLightModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./polarized-light-model.js"),import("./daily-life-lessons.js")]);return {name:"Polarized light",canonicalName:"Polarized light",component:undefined,canonicalLesson:routeCanonicalLessons["Polarized light"],createHouseModel:name=>name==="Polarized light"?routeFallbackFactory():null};},
"liquid-crystal-display":async()=>{const [{createLCDModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lcd-model.js"),import("./daily-life-lessons.js")]);return {name:"Liquid crystal display",canonicalName:"Liquid crystal display",component:undefined,canonicalLesson:routeCanonicalLessons["Liquid crystal display"],createHouseModel:name=>name==="Liquid crystal display"?routeFallbackFactory():null};},
"blu-ray-player":async()=>{const [{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"Blu-ray player",canonicalName:"Blu-ray player",component:undefined,canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"cd":async()=>{const [{createCdModel},{reviewedCdLesson:cdLesson},{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./cd-model.js"),import("./cd-lesson.js"),import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"CD",canonicalName:"Blu-ray player",component:{machine:'Blu-ray player',createModel:createCdModel,part:'player',isolate:true,view:'front',lesson:cdLesson,intro:cdLesson.simple},canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"dvd":async()=>{const [{createDvdModel},{dvdLesson},{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./dvd-model.js"),import("./dvd-lesson.js"),import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"DVD",canonicalName:"Blu-ray player",component:{machine:'Blu-ray player',createModel:createDvdModel,part:'player',isolate:true,view:'front',lesson:dvdLesson,intro:dvdLesson.simple},canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"cd-rom":async()=>{const [{createCdromModel},{cdRomLesson},{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./cdrom-model.js"),import("./cdrom-lesson.js"),import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"CD-ROM",canonicalName:"Blu-ray player",component:{machine:'Blu-ray player',createModel:createCdromModel,part:'player',isolate:true,view:'front',lesson:cdRomLesson,intro:cdRomLesson.simple},canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"cd-r":async()=>{const [{createCdrModel},{cdrLesson},{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./cdr-model.js"),import("./cdr-lesson.js"),import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"CD-R",canonicalName:"Blu-ray player",component:{machine:'Blu-ray player',createModel:createCdrModel,part:'player',isolate:true,view:'front',lesson:cdrLesson,intro:cdrLesson.simple},canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"dvd-r":async()=>{const [{createDvdrModel},{dvdrLesson},{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./dvdr-model.js"),import("./dvdr-lesson.js"),import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"DVD-R",canonicalName:"Blu-ray player",component:{machine:'Blu-ray player',createModel:createDvdrModel,part:'player',isolate:true,view:'front',lesson:dvdrLesson,intro:dvdrLesson.simple},canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"optical-disc-readout":async()=>{const [{createOpticalReadoutModel},{opticalReadoutLesson},{createBluRayPlayerModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./optical-readout-model.js"),import("./optical-readout-lesson.js"),import("./blu-ray-player-model.js"),import("./study-lessons.js")]);return {name:"Optical-disc readout",canonicalName:"Blu-ray player",component:{machine:'Blu-ray player',createModel:createOpticalReadoutModel,part:'assembly',isolate:true,view:'front',lesson:opticalReadoutLesson,intro:opticalReadoutLesson.simple},canonicalLesson:routeCanonicalLessons["Blu-ray player"],createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"electronic-paper":async()=>{const [{createElectronicPaperDisplayModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./electronic-paper-model.js"),import("./study-lessons.js")]);return {name:"Electronic paper",canonicalName:"Electronic paper",component:undefined,canonicalLesson:routeCanonicalLessons["Electronic paper"],createHouseModel:name=>name==="Electronic paper"?routeFallbackFactory():null};},
"electronic-ink":async()=>{const [{createElectronicInkModel},{electronicInkLesson},{createElectronicPaperDisplayModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./electronic-ink-model.js"),import("./electronic-ink-lesson.js"),import("./electronic-paper-model.js"),import("./study-lessons.js")]);return {name:"Electronic ink",canonicalName:"Electronic paper",component:{machine:'Electronic paper',createModel:createElectronicInkModel,part:'assembly',isolate:true,view:'front',lesson:electronicInkLesson,intro:electronicInkLesson.simple},canonicalLesson:routeCanonicalLessons["Electronic paper"],createHouseModel:name=>name==="Electronic paper"?routeFallbackFactory():null};},
"electrowetting-display":async()=>{const [{createElectrowettingModel},{electrowettingLesson},{createElectronicPaperDisplayModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./electrowetting-model.js"),import("./electrowetting-lesson.js"),import("./electronic-paper-model.js"),import("./study-lessons.js")]);return {name:"Electrowetting display",canonicalName:"Electronic paper",component:{machine:'Electronic paper',createModel:createElectrowettingModel,part:'assembly',isolate:true,view:'front',lesson:electrowettingLesson,intro:electrowettingLesson.simple},canonicalLesson:routeCanonicalLessons["Electronic paper"],createHouseModel:name=>name==="Electronic paper"?routeFallbackFactory():null};},
"e-reader":async()=>{const [{createEReaderModel},{eReaderLesson}]=await Promise.all([import("./e-reader-model.js"),import("./e-reader-lesson.js")]);return {name:"E-reader",canonicalName:"E-reader",component:{machine:'E-reader',createModel:createEReaderModel,part:'reader',isolate:true,view:'front',lesson:eReaderLesson,intro:eReaderLesson.simple},canonicalLesson:undefined,createHouseModel:name=>null};},
"smartphone":async()=>{const [{createSmartphoneLearningModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./smartphone-model.js"),import("./study-lessons.js")]);return {name:"Smartphone",canonicalName:"Smartphone",component:undefined,canonicalLesson:routeCanonicalLessons["Smartphone"],createHouseModel:name=>name==="Smartphone"?routeFallbackFactory():null};},
"accelerometer":async()=>{const [{createAccelerometerModel},{capacitiveAccelerometerLesson},{createSmartphoneLearningModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./accelerometer-model.js"),import("./accelerometer-lesson.js"),import("./smartphone-model.js"),import("./study-lessons.js")]);return {name:"Accelerometer",canonicalName:"Smartphone",component:{machine:'Smartphone',createModel:createAccelerometerModel,part:'module',isolate:false,view:'front',lesson:capacitiveAccelerometerLesson,intro:capacitiveAccelerometerLesson.simple},canonicalLesson:routeCanonicalLessons["Smartphone"],createHouseModel:name=>name==="Smartphone"?routeFallbackFactory():null};},
"vibration-motor":async()=>{const [{createVibrationMotorModel},{eccentricVibrationMotorLesson},{createSmartphoneLearningModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./vibration-motor-model.js"),import("./vibration-motor-lesson.js"),import("./smartphone-model.js"),import("./study-lessons.js")]);return {name:"Vibration motor",canonicalName:"Smartphone",component:{machine:'Smartphone',createModel:createVibrationMotorModel,part:'system',isolate:false,view:'front',lesson:eccentricVibrationMotorLesson,intro:eccentricVibrationMotorLesson.simple},canonicalLesson:routeCanonicalLessons["Smartphone"],createHouseModel:name=>name==="Smartphone"?routeFallbackFactory():null};},
"lcd-screen":async()=>{const [{createTftScreenModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./tft-screen-model.js"),import("./study-lessons.js")]);return {name:"LCD screen",canonicalName:"LCD screen",component:undefined,canonicalLesson:routeCanonicalLessons["LCD screen"],createHouseModel:name=>name==="LCD screen"?routeFallbackFactory():null};},
"rgb-subpixels":async()=>{const [{createRgbSubpixelsModel},{rgbAperturesLesson},{createTftScreenModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./rgb-subpixels-model.js"),import("./rgb-subpixels-lesson.js"),import("./tft-screen-model.js"),import("./study-lessons.js")]);return {name:"RGB subpixels",canonicalName:"LCD screen",component:{machine:'LCD screen',createModel:createRgbSubpixelsModel,part:'system',isolate:false,view:'front',lesson:rgbAperturesLesson,intro:rgbAperturesLesson.simple},canonicalLesson:routeCanonicalLessons["LCD screen"],createHouseModel:name=>name==="LCD screen"?routeFallbackFactory():null};},
"oled-display":async()=>{const [{createOledDisplayModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./oled-display-model.js"),import("./study-lessons.js")]);return {name:"OLED display",canonicalName:"OLED display",component:undefined,canonicalLesson:routeCanonicalLessons["OLED display"],createHouseModel:name=>name==="OLED display"?routeFallbackFactory():null};},
"air-cleaner":async()=>{const [{createAirCleanerModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./air-cleaner-model.js"),import("./cleaning-lessons.js")]);return {name:"Air cleaner",canonicalName:"Air cleaner",component:undefined,canonicalLesson:routeCanonicalLessons["Air cleaner"],createHouseModel:name=>name==="Air cleaner"?routeFallbackFactory():null};},
"electrostatic-precipitator":async()=>{const [{createElectrostaticPrecipitatorModel},{electrostaticPrecipitatorLesson},{createAirCleanerModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./electrostatic-precipitator-model.js"),import("./air-cleaner-lessons.js"),import("./air-cleaner-model.js"),import("./cleaning-lessons.js")]);return {name:"Electrostatic precipitator",canonicalName:"Air cleaner",component:{machine:'Air cleaner',createModel:createElectrostaticPrecipitatorModel,part:'stage',isolate:false,view:'front',lesson:electrostaticPrecipitatorLesson,intro:electrostaticPrecipitatorLesson.simple},canonicalLesson:routeCanonicalLessons["Air cleaner"],createHouseModel:name=>name==="Air cleaner"?routeFallbackFactory():null};},
"ionizer":async()=>{const [{createIonizerModel},{ionizerLesson},{createAirCleanerModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./ionizer-model.js"),import("./air-cleaner-lessons.js"),import("./air-cleaner-model.js"),import("./cleaning-lessons.js")]);return {name:"Ionizer",canonicalName:"Air cleaner",component:{machine:'Air cleaner',createModel:createIonizerModel,part:'fan',isolate:false,view:'front',lesson:ionizerLesson,intro:ionizerLesson.simple},canonicalLesson:routeCanonicalLessons["Air cleaner"],createHouseModel:name=>name==="Air cleaner"?routeFallbackFactory():null};},
"voltage-multiplier":async()=>{const [{createVoltageMultiplierModel:routeFallbackFactory},{electronicLessons:routeCanonicalLessons}]=await Promise.all([import("./voltage-multiplier-model.js"),import("./electronic-lessons.js")]);return {name:"Voltage multiplier",canonicalName:"Voltage multiplier",component:undefined,canonicalLesson:routeCanonicalLessons["Voltage multiplier"],createHouseModel:name=>name==="Voltage multiplier"?routeFallbackFactory():null};},
"lightning-conductor":async()=>{const [{createLightningConductorModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./lightning-model.js"),import("./safety-lessons.js")]);return {name:"Lightning conductor",canonicalName:"Lightning conductor",component:undefined,canonicalLesson:routeCanonicalLessons["Lightning conductor"],createHouseModel:name=>name==="Lightning conductor"?routeFallbackFactory():null};},
"kinetic-quartz-watch":async()=>{const [{createKineticWatchModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./quartz-models.js"),import("./time-lessons.js")]);return {name:"Kinetic quartz watch",canonicalName:"Kinetic quartz watch",component:undefined,canonicalLesson:routeCanonicalLessons["Kinetic quartz watch"],createHouseModel:name=>name==="Kinetic quartz watch"?routeFallbackFactory():null};},
"quartz-clock":async()=>{const [{createQuartzClockModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./quartz-clock-model.js"),import("./time-lessons.js")]);return {name:"Quartz clock",canonicalName:"Quartz clock",component:undefined,canonicalLesson:routeCanonicalLessons["Quartz clock"],createHouseModel:name=>name==="Quartz clock"?routeFallbackFactory():null};},
"quartz-oscillator":async()=>{const [{createQuartzOscillatorModel},{quartzOscillatorLesson},{createQuartzClockModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./quartz-oscillator-model.js"),import("./quartz-oscillator-lesson.js"),import("./quartz-clock-model.js"),import("./time-lessons.js")]);return {name:"Quartz oscillator",canonicalName:"Quartz clock",component:{machine:'Quartz clock',createModel:createQuartzOscillatorModel,part:'circuit',isolate:false,view:'front',lesson:quartzOscillatorLesson,intro:quartzOscillatorLesson.simple},canonicalLesson:routeCanonicalLessons["Quartz clock"],createHouseModel:name=>name==="Quartz clock"?routeFallbackFactory():null};},
"piezoelectricity":async()=>{const [{createPiezoelectricityModel},{piezoelectricityLesson},{createQuartzClockModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./piezoelectricity-model.js"),import("./piezoelectricity-lesson.js"),import("./quartz-clock-model.js"),import("./time-lessons.js")]);return {name:"Piezoelectricity",canonicalName:"Quartz clock",component:{machine:'Quartz clock',createModel:createPiezoelectricityModel,part:'apparatus',isolate:false,view:'iso',lesson:piezoelectricityLesson,intro:piezoelectricityLesson.simple},canonicalLesson:routeCanonicalLessons["Quartz clock"],createHouseModel:name=>name==="Quartz clock"?routeFallbackFactory():null};},
"remote-control":async()=>{const [{createInfraredRemoteModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./remote-control-model.js"),import("./study-lessons.js")]);return {name:"Remote control",canonicalName:"Remote control",component:undefined,canonicalLesson:routeCanonicalLessons["Remote control"],createHouseModel:name=>name==="Remote control"?routeFallbackFactory():null};},
"infrared-signaling":async()=>{const [{createInfraredSignalingModel},{infraredSignalingLesson},{createInfraredRemoteModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./infrared-signaling-model.js"),import("./infrared-signaling-lesson.js"),import("./remote-control-model.js"),import("./study-lessons.js")]);return {name:"Infrared signaling",canonicalName:"Remote control",component:{machine:'Remote control',createModel:createInfraredSignalingModel,part:'system',view:'front',isolate:true,lesson:infraredSignalingLesson,intro:infraredSignalingLesson.simple},canonicalLesson:routeCanonicalLessons["Remote control"],createHouseModel:name=>name==="Remote control"?routeFallbackFactory():null};},
"diode":async()=>{const [{createDiodeModel},{diodeLesson},{createInfraredRemoteModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./diode-model.js"),import("./diode-lesson.js"),import("./remote-control-model.js"),import("./study-lessons.js")]);return {name:"Diode",canonicalName:"Remote control",component:{machine:'Remote control',createModel:createDiodeModel,part:'circuit',view:'front',isolate:true,lesson:diodeLesson,intro:diodeLesson.simple},canonicalLesson:routeCanonicalLessons["Remote control"],createHouseModel:name=>name==="Remote control"?routeFallbackFactory():null};},
"light-emitting-diode":async()=>{const [{createLedModel},{lightEmittingDiodeLesson},{createInfraredRemoteModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./led-model.js"),import("./led-lesson.js"),import("./remote-control-model.js"),import("./study-lessons.js")]);return {name:"Light-emitting diode",canonicalName:"Remote control",component:{machine:'Remote control',createModel:createLedModel,part:'circuit',view:'front',isolate:true,lesson:lightEmittingDiodeLesson,intro:lightEmittingDiodeLesson.simple},canonicalLesson:routeCanonicalLessons["Remote control"],createHouseModel:name=>name==="Remote control"?routeFallbackFactory():null};},
"photodiode":async()=>{const [{createPhotodiodeModel},{photodiodeLesson},{createInfraredRemoteModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./photodiode-model.js"),import("./photodiode-lesson.js"),import("./remote-control-model.js"),import("./study-lessons.js")]);return {name:"Photodiode",canonicalName:"Remote control",component:{machine:'Remote control',createModel:createPhotodiodeModel,part:'bench',view:'front',isolate:true,lesson:photodiodeLesson,intro:photodiodeLesson.simple},canonicalLesson:routeCanonicalLessons["Remote control"],createHouseModel:name=>name==="Remote control"?routeFallbackFactory():null};},
"electromagnet":async()=>{const [{createElectromagnetModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./electromagnet-model.js"),import("./daily-life-lessons.js")]);return {name:"Electromagnet",canonicalName:"Electromagnet",component:undefined,canonicalLesson:routeCanonicalLessons["Electromagnet"],createHouseModel:name=>name==="Electromagnet"?routeFallbackFactory():null};},
"electric-bell":async()=>{const [{createBellModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./bell-model.js"),import("./daily-life-lessons.js")]);return {name:"Electric bell",canonicalName:"Electric bell",component:undefined,canonicalLesson:routeCanonicalLessons["Electric bell"],createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"electric-horn":async()=>{const [{createHornModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./horn-model.js"),import("./daily-life-lessons.js")]);return {name:"Electric horn",canonicalName:"Electric horn",component:undefined,canonicalLesson:routeCanonicalLessons["Electric horn"],createHouseModel:name=>name==="Electric horn"?routeFallbackFactory():null};},
"electric-motor":async()=>{const [{electricMotorLesson},{createDCMotorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./electric-motor-lesson.js"),import("./dc-motor-model.js"),import("./daily-life-lessons.js")]);return {name:"Electric motor",canonicalName:"Direct-current motor",component:{machine:'Direct-current motor',part:'system',redirectTo:'direct-current-motor',lesson:electricMotorLesson},canonicalLesson:routeCanonicalLessons["Direct-current motor"],createHouseModel:name=>name==="Direct-current motor"?routeFallbackFactory():null};},
"universal-motor":async()=>{const [{createUniversalMotorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./universal-motor-model.js"),import("./daily-life-lessons.js")]);return {name:"Universal motor",canonicalName:"Universal motor",component:undefined,canonicalLesson:routeCanonicalLessons["Universal motor"],createHouseModel:name=>name==="Universal motor"?routeFallbackFactory():null};},
"motor-rotor":async()=>{const [{motorRotorLesson},{createUniversalMotorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./motor-rotor-lesson.js"),import("./universal-motor-model.js"),import("./daily-life-lessons.js")]);return {name:"Motor rotor",canonicalName:"Universal motor",component:{machine:'Universal motor',part:'rotor',view:'back',isolate:false,lesson:motorRotorLesson,intro:motorRotorLesson.simple},canonicalLesson:routeCanonicalLessons["Universal motor"],createHouseModel:name=>name==="Universal motor"?routeFallbackFactory():null};},
"direct-current-motor":async()=>{const [{createDCMotorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./dc-motor-model.js"),import("./daily-life-lessons.js")]);return {name:"Direct-current motor",canonicalName:"Direct-current motor",component:undefined,canonicalLesson:routeCanonicalLessons["Direct-current motor"],createHouseModel:name=>name==="Direct-current motor"?routeFallbackFactory():null};},
"commutator":async()=>{const [{commutatorLesson},{createDCMotorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./commutator-lesson.js"),import("./dc-motor-model.js"),import("./daily-life-lessons.js")]);return {name:"Commutator",canonicalName:"Direct-current motor",component:{machine:'Direct-current motor',part:'commutator',view:'back',isolate:false,lesson:commutatorLesson,intro:commutatorLesson.simple},canonicalLesson:routeCanonicalLessons["Direct-current motor"],createHouseModel:name=>name==="Direct-current motor"?routeFallbackFactory():null};},
"3d-printer":async()=>{const [{createPrinterModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./printer-model.js"),import("./daily-life-lessons.js")]);return {name:"3D printer",canonicalName:"3D printer",component:undefined,canonicalLesson:routeCanonicalLessons["3D printer"],createHouseModel:name=>name==="3D printer"?routeFallbackFactory():null};},
"stepper-motor":async()=>{const [{createStepperMotorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./stepper-motor-model.js"),import("./daily-life-lessons.js")]);return {name:"Stepper motor",canonicalName:"Stepper motor",component:undefined,canonicalLesson:routeCanonicalLessons["Stepper motor"],createHouseModel:name=>name==="Stepper motor"?routeFallbackFactory():null};},
"electric-generator":async()=>{const [{createGeneratorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./grid-generator-model.js"),import("./daily-life-lessons.js")]);return {name:"Electric generator",canonicalName:"Electric generator",component:undefined,canonicalLesson:routeCanonicalLessons["Electric generator"],createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"ac-generator":async()=>{const [{acGeneratorLesson},{createGeneratorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./grid-generator-lessons.js"),import("./grid-generator-model.js"),import("./daily-life-lessons.js")]);return {name:"AC generator",canonicalName:"Electric generator",component:{machine:'Electric generator',part:'system',isolate:false,view:'front',values:{output:0},lesson:acGeneratorLesson,intro:acGeneratorLesson.simple},canonicalLesson:routeCanonicalLessons["Electric generator"],createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"dc-generator":async()=>{const [{createGeneratorModel,createGeneratorModel:routeFallbackFactory},{commutatorLesson},{dcGeneratorLesson},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./grid-generator-model.js"),import("./commutator-lesson.js"),import("./grid-generator-lessons.js"),import("./daily-life-lessons.js")]);return {name:"DC generator",canonicalName:"Electric generator",component:{machine:'Electric generator',createModel:()=>createGeneratorModel({commutatorLesson:true}),part:'system',isolate:false,view:'front',values:{output:1},lesson:dcGeneratorLesson,intro:dcGeneratorLesson.simple},canonicalLesson:routeCanonicalLessons["Electric generator"],createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"transformer":async()=>{const [{createTransformerModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./transformer-model.js"),import("./daily-life-lessons.js")]);return {name:"Transformer",canonicalName:"Transformer",component:undefined,canonicalLesson:routeCanonicalLessons["Transformer"],createHouseModel:name=>name==="Transformer"?routeFallbackFactory():null};},
"electricity-transmission":async()=>{const [{createElectricityTransmissionModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./electricity-transmission-model.js"),import("./daily-life-lessons.js")]);return {name:"Electricity transmission",canonicalName:"Electricity transmission",component:undefined,canonicalLesson:routeCanonicalLessons["Electricity transmission"],createHouseModel:name=>name==="Electricity transmission"?routeFallbackFactory():null};},
"distribution-transformer":async()=>{const [{createElectricityTransmissionModel},{distributionTransformerLesson},{createTransformerModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./electricity-transmission-model.js"),import("./distribution-transformer-lesson.js"),import("./transformer-model.js"),import("./daily-life-lessons.js")]);return {name:"Distribution transformer",canonicalName:"Transformer",component:{machine:'Transformer',createModel:()=>createElectricityTransmissionModel({distributionLesson:true}),part:'system',isolate:false,view:'iso',lesson:distributionTransformerLesson,intro:distributionTransformerLesson.simple},canonicalLesson:routeCanonicalLessons["Transformer"],createHouseModel:name=>name==="Transformer"?routeFallbackFactory():null};},
"two-way-light-switch":async()=>{const [{createLightingModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./lighting-model.js"),import("./safety-lessons.js")]);return {name:"Two-way light switch",canonicalName:"Two-way light switch",component:undefined,canonicalLesson:routeCanonicalLessons["Two-way light switch"],createHouseModel:name=>name==="Two-way light switch"?routeFallbackFactory():null};},
"electricity-meter":async()=>{const [{createMeterModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./meter-model.js"),import("./safety-lessons.js")]);return {name:"Electricity meter",canonicalName:"Electricity meter",component:undefined,canonicalLesson:routeCanonicalLessons["Electricity meter"],createHouseModel:name=>name==="Electricity meter"?routeFallbackFactory():null};},
"fuse":async()=>{const [{createFuseModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./fuse-model.js"),import("./safety-lessons.js")]);return {name:"Fuse",canonicalName:"Fuse",component:undefined,canonicalLesson:routeCanonicalLessons["Fuse"],createHouseModel:name=>name==="Fuse"?routeFallbackFactory():null};},
"circuit-breaker":async()=>{const [{createBreakerModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./breaker-model.js"),import("./safety-lessons.js")]);return {name:"Circuit breaker",canonicalName:"Circuit breaker",component:undefined,canonicalLesson:routeCanonicalLessons["Circuit breaker"],createHouseModel:name=>name==="Circuit breaker"?routeFallbackFactory():null};},
"sensors-and-detectors":async()=>{const [{createSensorsAndDetectorsModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./sensors-and-detectors-model.js"),import("./daily-life-lessons.js")]);return {name:"Sensors and detectors",canonicalName:"Sensors and detectors",component:undefined,canonicalLesson:routeCanonicalLessons["Sensors and detectors"],createHouseModel:name=>name==="Sensors and detectors"?routeFallbackFactory():null};},
"feedback-mechanism":async()=>{const [{createFeedbackMechanismModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./feedback-mechanism-model.js"),import("./daily-life-lessons.js")]);return {name:"Feedback mechanism",canonicalName:"Feedback mechanism",component:undefined,canonicalLesson:routeCanonicalLessons["Feedback mechanism"],createHouseModel:name=>name==="Feedback mechanism"?routeFallbackFactory():null};},
"seismograph":async()=>{const [{createSeismographModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./seismograph-model.js"),import("./daily-life-lessons.js")]);return {name:"Seismograph",canonicalName:"Seismograph",component:undefined,canonicalLesson:routeCanonicalLessons["Seismograph"],createHouseModel:name=>name==="Seismograph"?routeFallbackFactory():null};},
"horizontal-seismograph-pendulum":async()=>{const [{createHorizontalSeismographPendulumModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./horizontal-seismograph-pendulum-model.js"),import("./daily-life-lessons.js")]);return {name:"Horizontal seismograph pendulum",canonicalName:"Horizontal seismograph pendulum",component:undefined,canonicalLesson:routeCanonicalLessons["Horizontal seismograph pendulum"],createHouseModel:name=>name==="Horizontal seismograph pendulum"?routeFallbackFactory():null};},
"vertical-seismograph-pendulum":async()=>{const [{createVerticalSeismographPendulumModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./vertical-seismograph-pendulum-model.js"),import("./daily-life-lessons.js")]);return {name:"Vertical seismograph pendulum",canonicalName:"Vertical seismograph pendulum",component:undefined,canonicalLesson:routeCanonicalLessons["Vertical seismograph pendulum"],createHouseModel:name=>name==="Vertical seismograph pendulum"?routeFallbackFactory():null};},
"seismic-waves":async()=>{const [{createSeismicWavesModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./seismic-waves-model.js"),import("./daily-life-lessons.js")]);return {name:"Seismic waves",canonicalName:"Seismic waves",component:undefined,canonicalLesson:routeCanonicalLessons["Seismic waves"],createHouseModel:name=>name==="Seismic waves"?routeFallbackFactory():null};},
"crash-sensor":async()=>{const [{createCrashSensorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./crash-sensor-model.js"),import("./daily-life-lessons.js")]);return {name:"Crash sensor",canonicalName:"Crash sensor",component:undefined,canonicalLesson:routeCanonicalLessons["Crash sensor"],createHouseModel:name=>name==="Crash sensor"?routeFallbackFactory():null};},
"autopilot":async()=>{const [{createAutopilotModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./autopilot-model.js"),import("./daily-life-lessons.js")]);return {name:"Autopilot",canonicalName:"Autopilot",component:undefined,canonicalLesson:routeCanonicalLessons["Autopilot"],createHouseModel:name=>name==="Autopilot"?routeFallbackFactory():null};},
"inertial-guidance":async()=>{const [{createInertialGuidanceModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./inertial-guidance-model.js"),import("./daily-life-lessons.js")]);return {name:"Inertial guidance",canonicalName:"Inertial guidance",component:undefined,canonicalLesson:routeCanonicalLessons["Inertial guidance"],createHouseModel:name=>name==="Inertial guidance"?routeFallbackFactory():null};},
"smoke-detector":async()=>{const [{createReviewedSmokeDetectorModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./smoke-detector-model.js"),import("./safety-lessons.js")]);return {name:"Smoke detector",canonicalName:"Smoke detector",component:undefined,canonicalLesson:routeCanonicalLessons["Smoke detector"],createHouseModel:name=>name==="Smoke detector"?routeFallbackFactory():null};},
"ionization-smoke-detector":async()=>{const [{createIonizationSmokeModel},{reviewedIonizationSmokeLesson},{createReviewedSmokeDetectorModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./ionization-smoke-model.js"),import("./ionization-smoke-lesson.js"),import("./smoke-detector-model.js"),import("./safety-lessons.js")]);return {name:"Ionization smoke detector",canonicalName:"Smoke detector",component:{machine:'Smoke detector',createModel:createIonizationSmokeModel,part:'system',view:'front',isolate:true,lesson:reviewedIonizationSmokeLesson,intro:reviewedIonizationSmokeLesson.simple},canonicalLesson:routeCanonicalLessons["Smoke detector"],createHouseModel:name=>name==="Smoke detector"?routeFallbackFactory():null};},
"optical-smoke-detector":async()=>{const [{createOpticalSmokeModel},{reviewedOpticalSmokeLesson},{createReviewedSmokeDetectorModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./optical-smoke-model.js"),import("./optical-smoke-lesson.js"),import("./smoke-detector-model.js"),import("./safety-lessons.js")]);return {name:"Optical smoke detector",canonicalName:"Smoke detector",component:{machine:'Smoke detector',createModel:createOpticalSmokeModel,part:'system',view:'front',isolate:true,lesson:reviewedOpticalSmokeLesson,intro:reviewedOpticalSmokeLesson.simple},canonicalLesson:routeCanonicalLessons["Smoke detector"],createHouseModel:name=>name==="Smoke detector"?routeFallbackFactory():null};},
"active-burglar-alarm":async()=>{const [{createBurglarAlarmModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./burglar-alarm-model.js"),import("./safety-lessons.js")]);return {name:"Active burglar alarm",canonicalName:"Active burglar alarm",component:undefined,canonicalLesson:routeCanonicalLessons["Active burglar alarm"],createHouseModel:name=>name==="Active burglar alarm"?routeFallbackFactory():null};},
"passive-infrared-movement-detector":async()=>{const [{createPassiveInfraredModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./passive-infrared-model.js"),import("./safety-lessons.js")]);return {name:"Passive infrared movement detector",canonicalName:"Passive infrared movement detector",component:undefined,canonicalLesson:routeCanonicalLessons["Passive infrared movement detector"],createHouseModel:name=>name==="Passive infrared movement detector"?routeFallbackFactory():null};},
"games-controller":async()=>{const [{createGamesControllerModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./games-controller-model.js"),import("./play-lessons.js")]);return {name:"Games controller",canonicalName:"Games controller",component:undefined,canonicalLesson:routeCanonicalLessons["Games controller"],createHouseModel:name=>name==="Games controller"?routeFallbackFactory():null};},
"joystick":async()=>{const [{createJoystickModel},{joystickLesson},{createGamesControllerModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./joystick-model.js"),import("./games-controller-lessons.js"),import("./games-controller-model.js"),import("./play-lessons.js")]);return {name:"Joystick",canonicalName:"Games controller",component:{machine:'Games controller',createModel:createJoystickModel,part:'rig',isolate:true,view:'front',lesson:joystickLesson,intro:joystickLesson.simple},canonicalLesson:routeCanonicalLessons["Games controller"],createHouseModel:name=>name==="Games controller"?routeFallbackFactory():null};},
"video-games-console":async()=>{const [{createVideoGamesConsoleModel},{videoGamesConsoleLesson},{createGamesControllerModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./video-games-console-model.js"),import("./games-controller-lessons.js"),import("./games-controller-model.js"),import("./play-lessons.js")]);return {name:"Video games console",canonicalName:"Games controller",component:{machine:'Games controller',createModel:createVideoGamesConsoleModel,part:'console-experiment',isolate:true,view:'front',lesson:videoGamesConsoleLesson,intro:videoGamesConsoleLesson.simple},canonicalLesson:routeCanonicalLessons["Games controller"],createHouseModel:name=>name==="Games controller"?routeFallbackFactory():null};},
"speech-recognition":async()=>{const [{createSpeechRecognitionModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./speech-recognition-model.js"),import("./study-lessons.js")]);return {name:"Speech recognition",canonicalName:"Speech recognition",component:undefined,canonicalLesson:routeCanonicalLessons["Speech recognition"],createHouseModel:name=>name==="Speech recognition"?routeFallbackFactory():null};},
"phonemes":async()=>{const [{createPhonemesModel},{reviewedPhonemesLesson:phonemesLesson},{createSpeechRecognitionModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./phonemes-model.js"),import("./phonemes-lesson.js"),import("./speech-recognition-model.js"),import("./study-lessons.js")]);return {name:"Phonemes",canonicalName:"Speech recognition",component:{machine:'Speech recognition',createModel:createPhonemesModel,part:'system',isolate:true,view:'front',lesson:phonemesLesson,intro:phonemesLesson.simple},canonicalLesson:routeCanonicalLessons["Speech recognition"],createHouseModel:name=>name==="Speech recognition"?routeFallbackFactory():null};},
"virtual-reality-headset":async()=>{const [{createVrHeadsetModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./vr-headset-model.js"),import("./play-lessons.js")]);return {name:"Virtual reality headset",canonicalName:"Virtual reality headset",component:undefined,canonicalLesson:routeCanonicalLessons["Virtual reality headset"],createHouseModel:name=>name==="Virtual reality headset"?routeFallbackFactory():null};},
"head-tracking":async()=>{const [{createHeadTrackingModel},{headTrackingLesson},{createVrHeadsetModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./head-tracking-model.js"),import("./head-tracking-lesson.js"),import("./vr-headset-model.js"),import("./play-lessons.js")]);return {name:"Head tracking",canonicalName:"Virtual reality headset",component:{machine:'Virtual reality headset',createModel:createHeadTrackingModel,part:'system',isolate:true,view:'front',lesson:headTrackingLesson,intro:headTrackingLesson.simple},canonicalLesson:routeCanonicalLessons["Virtual reality headset"],createHouseModel:name=>name==="Virtual reality headset"?routeFallbackFactory():null};},
"robot-vacuum-cleaner":async()=>{const [{createRobotVacuumModel:routeFallbackFactory},{cleaningLessons:routeCanonicalLessons}]=await Promise.all([import("./robot-vacuum-model.js"),import("./cleaning-lessons.js")]);return {name:"Robot vacuum cleaner",canonicalName:"Robot vacuum cleaner",component:undefined,canonicalLesson:routeCanonicalLessons["Robot vacuum cleaner"],createHouseModel:name=>name==="Robot vacuum cleaner"?routeFallbackFactory():null};},
"calculator":async()=>{const [{createCalculatorAdditionModel:routeFallbackFactory},{studyLessons:routeCanonicalLessons}]=await Promise.all([import("./calculator-addition-model.js"),import("./study-lessons.js")]);return {name:"Calculator",canonicalName:"Calculator",component:undefined,canonicalLesson:routeCanonicalLessons["Calculator"],createHouseModel:name=>name==="Calculator"?routeFallbackFactory():null};},
"hairspring":async()=>{const [{createHairspringModel},{hairspringLesson},{createWatchModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./hairspring-model.js"),import("./watch-lessons.js"),import("./watch-model.js"),import("./time-lessons.js")]);return {name:"Hairspring",canonicalName:"Mechanical watch",component:{machine:'Mechanical watch',createModel:createHairspringModel,part:'oscillator',isolate:false,view:'front',lesson:hairspringLesson,intro:hairspringLesson.simple},canonicalLesson:routeCanonicalLessons["Mechanical watch"],createHouseModel:name=>name==="Mechanical watch"?routeFallbackFactory():null};},
"zipper-slide-wedges":async()=>{const [{createZipperModel,createZipperModel:routeFallbackFactory},{zipperComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./zipper-model.js"),import("./zipper-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Zipper slide wedges",canonicalName:"Zipper",component:{machine:'Zipper',createModel:()=>{const model=createZipperModel({sliderLesson:true});model.resultPart.focusOnComplete=false;return model;},isolate:false,part:'slider',view:'front',values:{alignment:1,insertion:1,closure:.35},lesson:zipperComponentLessons['Zipper slide wedges'],intro:zipperComponentLessons['Zipper slide wedges'].simple},canonicalLesson:routeCanonicalLessons["Zipper"],createHouseModel:name=>name==="Zipper"?routeFallbackFactory():null};},
"interlocking-zipper-teeth":async()=>{const [{createZipperModel,createZipperModel:routeFallbackFactory},{zipperComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./zipper-model.js"),import("./zipper-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Interlocking zipper teeth",canonicalName:"Zipper",component:{machine:'Zipper',createModel:()=>{const model=createZipperModel();model.frameBoundsForPart=id=>{if(id!=='head-7')return;const bounds=new Box3().setFromObject(model.parts.find(part=>part.id===id).object);return bounds.expandByVector(bounds.getSize(new Vector3()).multiplyScalar(.65));};model.resultPart.focusOnComplete=false;return model;},isolate:false,part:'head-7',view:'front',values:{alignment:1,insertion:1,closure:.5},lesson:zipperComponentLessons['Interlocking zipper teeth'],intro:zipperComponentLessons['Interlocking zipper teeth'].simple},canonicalLesson:routeCanonicalLessons["Zipper"],createHouseModel:name=>name==="Zipper"?routeFallbackFactory():null};},
"transmission-transformer":async()=>{const [{createElectricityTransmissionModel},{transmissionTransformerLesson},{createTransformerModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./electricity-transmission-model.js"),import("./transmission-transformer-lesson.js"),import("./transformer-model.js"),import("./daily-life-lessons.js")]);return {name:"Transmission transformer",canonicalName:"Transformer",component:{machine:'Transformer',createModel:()=>createElectricityTransmissionModel({sendingLesson:true}),part:'system',isolate:false,view:'iso',lesson:transmissionTransformerLesson,intro:transmissionTransformerLesson.simple},canonicalLesson:routeCanonicalLessons["Transformer"],createHouseModel:name=>name==="Transformer"?routeFallbackFactory():null};},
"home-supply-transformer":async()=>{const [{createHomeSupplyTransformerModel},{homeSupplyTransformerLesson},{createTransformerModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./home-supply-transformer-model.js"),import("./home-supply-transformer-lesson.js"),import("./transformer-model.js"),import("./daily-life-lessons.js")]);return {name:"Home-supply transformer",canonicalName:"Transformer",component:{machine:'Transformer',createModel:createHomeSupplyTransformerModel,part:'system',isolate:false,view:'iso',lesson:homeSupplyTransformerLesson,intro:homeSupplyTransformerLesson.simple},canonicalLesson:routeCanonicalLessons["Transformer"],createHouseModel:name=>name==="Transformer"?routeFallbackFactory():null};},
"power-line-insulator":async()=>{const [{createPowerLineInsulatorModel},{powerLineInsulatorLesson},{createElectricityTransmissionModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./power-line-insulator-model.js"),import("./power-line-insulator-lesson.js"),import("./electricity-transmission-model.js"),import("./daily-life-lessons.js")]);return {name:"Power-line insulator",canonicalName:"Electricity transmission",component:{machine:'Electricity transmission',createModel:createPowerLineInsulatorModel,part:'system',isolate:false,view:'iso',lesson:powerLineInsulatorLesson,intro:powerLineInsulatorLesson.simple},canonicalLesson:routeCanonicalLessons["Electricity transmission"],createHouseModel:name=>name==="Electricity transmission"?routeFallbackFactory():null};},
"power-pylon":async()=>{const [{createPowerPylonModel},{powerPylonLesson},{createElectricityTransmissionModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./power-pylon-model.js"),import("./power-pylon-lesson.js"),import("./electricity-transmission-model.js"),import("./daily-life-lessons.js")]);return {name:"Power pylon",canonicalName:"Electricity transmission",component:{machine:'Electricity transmission',createModel:createPowerPylonModel,part:'system',isolate:false,view:'iso',lesson:powerPylonLesson,intro:powerPylonLesson.simple},canonicalLesson:routeCanonicalLessons["Electricity transmission"],createHouseModel:name=>name==="Electricity transmission"?routeFallbackFactory():null};},
"water-clock":async()=>{const [{createWaterClockModel:routeFallbackFactory},{timeLessons:routeCanonicalLessons}]=await Promise.all([import("./water-clock-model.js"),import("./time-lessons.js")]);return {name:"Water clock",canonicalName:"Water clock",component:undefined,canonicalLesson:routeCanonicalLessons["Water clock"],createHouseModel:name=>name==="Water clock"?routeFallbackFactory():null};},
"washing-machine":async()=>{const [{createWashingMachineModel:routeFallbackFactory},{utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./washing-machine-model.js"),import("./utility-lessons.js")]);return {name:"Washing machine",canonicalName:"Washing machine",component:undefined,canonicalLesson:routeCanonicalLessons["Washing machine"],createHouseModel:name=>name==="Washing machine"?routeFallbackFactory():null};},
"unicycle":async()=>{const [{createUnicycleModel:routeFallbackFactory},{playLessons:routeCanonicalLessons}]=await Promise.all([import("./unicycle-model.js"),import("./play-lessons.js")]);return {name:"Unicycle",canonicalName:"Unicycle",component:undefined,canonicalLesson:routeCanonicalLessons["Unicycle"],createHouseModel:name=>name==="Unicycle"?routeFallbackFactory():null};},
"bobbin-and-bobbin-thread":async()=>{const [{createSewingModel,createSewingModel:routeFallbackFactory},{utilityComponentLessons,utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./sewing-model.js"),import("./utility-lessons.js")]);return {name:"Bobbin and bobbin thread",canonicalName:"Sewing machine",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel();model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'hook-assembly'];return model;},part:'hook-assembly',view:'iso',isolate:true,lesson:utilityComponentLessons['Bobbin and bobbin thread'],intro:utilityComponentLessons['Bobbin and bobbin thread'].simple},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"needle-and-needle-thread":async()=>{const [{createSewingModel,createSewingModel:routeFallbackFactory},{utilityComponentLessons,utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./sewing-model.js"),import("./utility-lessons.js")]);return {name:"Needle and needle thread",canonicalName:"Sewing machine",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({needleLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','needle'];return model;},part:'stitch-formation',view:'iso',isolate:true,lesson:utilityComponentLessons['Needle and needle thread'],intro:utilityComponentLessons['Needle and needle thread'].simple},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"rotary-sewing-hook":async()=>{const [{createSewingModel,createSewingModel:routeFallbackFactory},{utilityComponentLessons,utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./sewing-model.js"),import("./utility-lessons.js")]);return {name:"Rotary sewing hook",canonicalName:"Sewing machine",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({hookLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','hook-assembly','hook'];return model;},part:'stitch-formation',view:'iso',isolate:true,initialState:{phase:.55},lesson:utilityComponentLessons['Rotary sewing hook'],intro:utilityComponentLessons['Rotary sewing hook'].simple},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"rotary-shuttle":async()=>{const [{utilityComponentLessons,utilityLessons:routeCanonicalLessons},{createSewingModel:routeFallbackFactory}]=await Promise.all([import("./utility-lessons.js"),import("./sewing-model.js")]);return {name:"Rotary shuttle",canonicalName:"Sewing machine",component:{machine:'Sewing machine',part:'stitch-formation',redirectTo:'rotary-sewing-hook',lesson:utilityComponentLessons['Rotary sewing hook']},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"thread-take-up-lever":async()=>{const [{createSewingModel,createSewingModel:routeFallbackFactory},{utilityComponentLessons,utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./sewing-model.js"),import("./utility-lessons.js")]);return {name:"Thread take-up lever",canonicalName:"Sewing machine",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({takeUpLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'take-up','take-up-rocker'];return model;},part:'take-up',view:'side',isolate:true,lesson:utilityComponentLessons['Thread take-up lever'],intro:utilityComponentLessons['Thread take-up lever'].simple},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"feed-dog-lift-and-advance-linkages":async()=>{const [{createSewingModel,createSewingModel:routeFallbackFactory},{utilityComponentLessons,utilityLessons:routeCanonicalLessons}]=await Promise.all([import("./sewing-model.js"),import("./utility-lessons.js")]);return {name:"Feed-dog lift and advance linkages",canonicalName:"Sewing machine",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({feedLesson:true,linkageLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'feed-linkages'];return model;},part:'feed-linkages',view:'iso',isolate:true,lesson:utilityComponentLessons['Feed-dog lift and advance linkages'],intro:utilityComponentLessons['Feed-dog lift and advance linkages'].simple},canonicalLesson:routeCanonicalLessons["Sewing machine"],createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"consumer-unit":async()=>{const [{createConsumerModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./consumer-model.js"),import("./safety-lessons.js")]);return {name:"Consumer unit",canonicalName:"Consumer unit",component:undefined,canonicalLesson:routeCanonicalLessons["Consumer unit"],createHouseModel:name=>name==="Consumer unit"?routeFallbackFactory():null};},
"protective-earth-wire":async()=>{const [{createEarthModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./earth-model.js"),import("./safety-lessons.js")]);return {name:"Protective earth wire",canonicalName:"Protective earth wire",component:undefined,canonicalLesson:routeCanonicalLessons["Protective earth wire"],createHouseModel:name=>name==="Protective earth wire"?routeFallbackFactory():null};},
"power-socket":async()=>{const [{createSocketModel:routeFallbackFactory},{safetyLessons:routeCanonicalLessons}]=await Promise.all([import("./socket-model.js"),import("./safety-lessons.js")]);return {name:"Power socket",canonicalName:"Power socket",component:undefined,canonicalLesson:routeCanonicalLessons["Power socket"],createHouseModel:name=>name==="Power socket"?routeFallbackFactory():null};},
"cylinder-lock-cam-and-bolt":async()=>{const [{createCylinderModel,createCylinderModel:routeFallbackFactory},{cylinderComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./cylinder-model.js"),import("./cylinder-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Cylinder-lock cam and bolt",canonicalName:"Cylinder lock",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({camLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'latch-drive',view:'back',values:{insertion:1},lesson:cylinderComponentLessons['Cylinder-lock cam and bolt'],intro:cylinderComponentLessons['Cylinder-lock cam and bolt'].simple},canonicalLesson:routeCanonicalLessons["Cylinder lock"],createHouseModel:name=>name==="Cylinder lock"?routeFallbackFactory():null};},
"lock-pin-stacks":async()=>{const [{createCylinderModel,createCylinderModel:routeFallbackFactory},{cylinderComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./cylinder-model.js"),import("./cylinder-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lock pin stacks",canonicalName:"Cylinder lock",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({pinLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'pins',view:'side',lesson:cylinderComponentLessons['Lock pin stacks'],intro:cylinderComponentLessons['Lock pin stacks'].simple},canonicalLesson:routeCanonicalLessons["Cylinder lock"],createHouseModel:name=>name==="Cylinder lock"?routeFallbackFactory():null};},
"lock-return-springs":async()=>{const [{createCylinderModel,createCylinderModel:routeFallbackFactory},{cylinderComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./cylinder-model.js"),import("./cylinder-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lock return springs",canonicalName:"Cylinder lock",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({springLesson:true});model.parts.find(part=>part.id==='plug').framePadding=1.05;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'latch-drive',view:'back',values:{operation:1,insertion:1,turn:80},lesson:cylinderComponentLessons['Lock return springs'],intro:cylinderComponentLessons['Lock return springs'].simple},canonicalLesson:routeCanonicalLessons["Cylinder lock"],createHouseModel:name=>name==="Cylinder lock"?routeFallbackFactory():null};},
"lever-lock-return-springs":async()=>{const [{createLeverModel,createLeverModel:routeFallbackFactory},{leverComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lever-model.js"),import("./lever-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lever-lock return springs",canonicalName:"Lever lock",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel({springLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'lever-pack',values:{insertion:1,turn:270},lesson:leverComponentLessons['Lever-lock return springs'],intro:leverComponentLessons['Lever-lock return springs'].simple},canonicalLesson:routeCanonicalLessons["Lever lock"],createHouseModel:name=>name==="Lever lock"?routeFallbackFactory():null};},
"lever-lock-tumblers-and-stumps":async()=>{const [{createLeverModel,createLeverModel:routeFallbackFactory},{leverComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lever-model.js"),import("./lever-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lever-lock tumblers and stumps",canonicalName:"Lever lock",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel();model.parts.find(part=>part.id==='stump').framePadding=1;model.frameBoundsForPart=id=>id==='stump'?new Box3().setFromObject(model.parts.find(part=>part.id==='lever-pack').object):undefined;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'lever-pack',view:'front',lesson:leverComponentLessons['Lever-lock tumblers and stumps'],intro:leverComponentLessons['Lever-lock tumblers and stumps'].simple},canonicalLesson:routeCanonicalLessons["Lever lock"],createHouseModel:name=>name==="Lever lock"?routeFallbackFactory():null};},
"lever-lock-bolt-and-bolt-pin":async()=>{const [{createLeverModel,createLeverModel:routeFallbackFactory},{leverComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lever-model.js"),import("./lever-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lever-lock bolt and bolt pin",canonicalName:"Lever lock",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel({boltLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'bolt',values:{insertion:1,turn:135},lesson:leverComponentLessons['Lever-lock bolt and bolt pin'],intro:leverComponentLessons['Lever-lock bolt and bolt pin'].simple},canonicalLesson:routeCanonicalLessons["Lever lock"],createHouseModel:name=>name==="Lever lock"?routeFallbackFactory():null};},
"lock-cylinder-plug":async()=>{const [{createCylinderModel,createCylinderModel:routeFallbackFactory},{cylinderComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./cylinder-model.js"),import("./cylinder-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lock cylinder (plug)",canonicalName:"Cylinder lock",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel();model.parts.find(part=>part.id==='plug').framePadding=1.05;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'plug',view:'side',values:{insertion:1},lesson:cylinderComponentLessons['Lock cylinder (plug)'],intro:cylinderComponentLessons['Lock cylinder (plug)'].simple},canonicalLesson:routeCanonicalLessons["Cylinder lock"],createHouseModel:name=>name==="Cylinder lock"?routeFallbackFactory():null};},
"lever-lock-key":async()=>{const [{createLeverModel,createLeverModel:routeFallbackFactory},{leverComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lever-model.js"),import("./lever-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Lever-lock key",canonicalName:"Lever lock",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel();model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'key',view:'front',values:{insertion:1},lesson:leverComponentLessons['Lever-lock key'],intro:leverComponentLessons['Lever-lock key'].simple},canonicalLesson:routeCanonicalLessons["Lever lock"],createHouseModel:name=>name==="Lever lock"?routeFallbackFactory():null};},
"zipper-bottom-pin-and-box":async()=>{const [{createZipperModel,createZipperModel:routeFallbackFactory},{zipperComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./zipper-model.js"),import("./zipper-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Zipper bottom pin and box",canonicalName:"Zipper",component:{machine:'Zipper',createModel:()=>{
  const model=createZipperModel(),connector=model.parts.find(part=>part.id==='bottom-connector').object,bounds=new Box3();
  for(const spread of [0,1]){model.update({...model.defaults,spread});bounds.union(new Box3().setFromObject(connector));}
  model.reset();model.parts.find(part=>part.id==='bottom-connector').framePadding=.6;model.frameBoundsForPart=id=>id==='bottom-connector'?bounds.clone().applyMatrix4(model.root.matrixWorld):undefined;
  model.followParts=model.followParts.filter(id=>id!=='bottom-connector');model.resultPart.focusOnComplete=false;return model;
 },isolate:false,part:'bottom-connector',view:'front',values:{alignment:1,insertion:0,closure:0},lesson:zipperComponentLessons['Zipper bottom pin and box'],intro:zipperComponentLessons['Zipper bottom pin and box'].simple},canonicalLesson:routeCanonicalLessons["Zipper"],createHouseModel:name=>name==="Zipper"?routeFallbackFactory():null};},
"window-shade-pawls-and-locking-disk":async()=>{const [{createWindowShadeModel,createWindowShadeModel:routeFallbackFactory},{shadeComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./window-shade-model.js"),import("./shade-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Window-shade pawls and locking disk",canonicalName:"Window shade",component:{machine:'Window shade',createModel:()=>{const model=createWindowShadeModel();model.resultPart.focusOnComplete=false;return model;},part:'locking',view:'side',isolate:true,lesson:shadeComponentLessons['Window-shade pawls and locking disk'],intro:shadeComponentLessons['Window-shade pawls and locking disk'].simple},canonicalLesson:routeCanonicalLessons["Window shade"],createHouseModel:name=>name==="Window shade"?routeFallbackFactory():null};},
"window-shade-winding-spring":async()=>{const [{createWindowShadeModel,createWindowShadeModel:routeFallbackFactory},{shadeComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./window-shade-model.js"),import("./shade-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Window-shade winding spring",canonicalName:"Window shade",component:{machine:'Window shade',createModel:()=>{const model=createWindowShadeModel();model.resultPart.focusOnComplete=false;return model;},part:'spring',view:'front',isolate:false,lesson:shadeComponentLessons['Window-shade winding spring'],intro:shadeComponentLessons['Window-shade winding spring'].simple},canonicalLesson:routeCanonicalLessons["Window shade"],createHouseModel:name=>name==="Window shade"?routeFallbackFactory():null};},
"window-shade-roller-shaft-and-fixed-central-rod":async()=>{const [{createWindowShadeModel,createWindowShadeModel:routeFallbackFactory},{shadeComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./window-shade-model.js"),import("./shade-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Window-shade roller shaft and fixed central rod",canonicalName:"Window shade",component:{machine:'Window shade',createModel:()=>createWindowShadeModel({rodLesson:true}),part:'shaft',view:'front',isolate:false,lesson:shadeComponentLessons['Window-shade roller shaft and fixed central rod'],intro:shadeComponentLessons['Window-shade roller shaft and fixed central rod'].simple},canonicalLesson:routeCanonicalLessons["Window shade"],createHouseModel:name=>name==="Window shade"?routeFallbackFactory():null};},
"armature":async()=>{const [{createBellModel,createBellModel:routeFallbackFactory},{bellComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./bell-model.js"),import("./bell-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Electric-bell armature",canonicalName:"Electric bell",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel();model.resultPart.focusOnComplete=false;return model;},part:'armature',view:'front',isolate:false,lesson:bellComponentLessons.Armature,intro:bellComponentLessons.Armature.simple},canonicalLesson:routeCanonicalLessons["Electric bell"],createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"electromagnetic-make-and-break-contacts":async()=>{const [{createBellModel,createBellModel:routeFallbackFactory},{bellComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./bell-model.js"),import("./bell-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Electromagnetic make-and-break contacts",canonicalName:"Electric bell",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel();model.resultPart.focusOnComplete=false;return model;},part:'contacts',view:'front',isolate:false,lesson:bellComponentLessons['Electromagnetic make-and-break contacts'],intro:bellComponentLessons['Electromagnetic make-and-break contacts'].simple},canonicalLesson:routeCanonicalLessons["Electric bell"],createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"vibrating-horn-diaphragm":async()=>{const [{createHornModel,createHornModel:routeFallbackFactory},{hornComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./horn-model.js"),import("./horn-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Vibrating horn diaphragm",canonicalName:"Electric horn",component:{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'diaphragm',view:'front',isolate:false,lesson:hornComponentLessons['Vibrating horn diaphragm'],intro:hornComponentLessons['Vibrating horn diaphragm'].simple},canonicalLesson:routeCanonicalLessons["Electric horn"],createHouseModel:name=>name==="Electric horn"?routeFallbackFactory():null};},
"horn-make-and-break-contacts":async()=>{const [{createHornModel,createHornModel:routeFallbackFactory},{hornComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./horn-model.js"),import("./horn-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Horn make-and-break contacts",canonicalName:"Electric horn",component:{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'contacts',view:'front',isolate:false,lesson:hornComponentLessons['Horn make-and-break contacts'],intro:hornComponentLessons['Horn make-and-break contacts'].simple},canonicalLesson:routeCanonicalLessons["Electric horn"],createHouseModel:name=>name==="Electric horn"?routeFallbackFactory():null};},
"electric-horn-moving-iron-bar":async()=>{const [{createHornModel,createHornModel:routeFallbackFactory},{hornComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./horn-model.js"),import("./horn-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Electric-horn moving iron bar",canonicalName:"Electric horn",component:{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'moving-bar',view:'front',isolate:false,lesson:hornComponentLessons['Electric-horn moving iron bar'],intro:hornComponentLessons['Electric-horn moving iron bar'].simple},canonicalLesson:routeCanonicalLessons["Electric horn"],createHouseModel:name=>name==="Electric horn"?routeFallbackFactory():null};},
"electric-bell-pushbutton-switch":async()=>{const [{createBellModel,createBellModel:routeFallbackFactory},{bellComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./bell-model.js"),import("./bell-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Electric-bell pushbutton switch",canonicalName:"Electric bell",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel({buttonLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'button',view:'top',isolate:false,lesson:bellComponentLessons['Electric-bell pushbutton switch'],intro:bellComponentLessons['Electric-bell pushbutton switch'].simple},canonicalLesson:routeCanonicalLessons["Electric bell"],createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"electric-bell-hammer-and-metal-bell":async()=>{const [{createBellModel,createBellModel:routeFallbackFactory},{bellComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./bell-model.js"),import("./bell-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Electric-bell hammer and metal bell",canonicalName:"Electric bell",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel({hammerLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'gong',view:'front',isolate:false,lesson:bellComponentLessons['Electric-bell hammer and metal bell'],intro:bellComponentLessons['Electric-bell hammer and metal bell'].simple},canonicalLesson:routeCanonicalLessons["Electric bell"],createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"electric-bell-return-spring":async()=>{const [{createBellModel,createBellModel:routeFallbackFactory},{bellComponentLessons},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./bell-model.js"),import("./bell-component-lessons.js"),import("./daily-life-lessons.js")]);return {name:"Electric-bell return spring",canonicalName:"Electric bell",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel({springLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'spring',view:'front',isolate:false,lesson:bellComponentLessons['Electric-bell return spring'],intro:bellComponentLessons['Electric-bell return spring'].simple},canonicalLesson:routeCanonicalLessons["Electric bell"],createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"heated-extrusion-nozzle":async()=>{const [{createPrinterModel,createPrinterModel:routeFallbackFactory},{heatedNozzleLesson},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./printer-model.js"),import("./heated-nozzle-lesson.js"),import("./daily-life-lessons.js")]);return {name:"Heated extrusion nozzle",canonicalName:"3D printer",component:{machine:'3D printer',createModel:()=>{const model=createPrinterModel();model.playback.label='Run heated extrusion';return model;},part:'extruder',view:'front',isolate:false,lesson:heatedNozzleLesson,intro:heatedNozzleLesson.simple},canonicalLesson:routeCanonicalLessons["3D printer"],createHouseModel:name=>name==="3D printer"?routeFallbackFactory():null};},
"printer-filament-reel":async()=>{const [{createPrinterModel,createPrinterModel:routeFallbackFactory},{printerReelLesson},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./printer-model.js"),import("./printer-reel-lesson.js"),import("./daily-life-lessons.js")]);return {name:"Printer filament reel",canonicalName:"3D printer",component:{machine:'3D printer',createModel:()=>createPrinterModel({reelLesson:true}),part:'filament',isolate:false,lesson:printerReelLesson,intro:printerReelLesson.simple},canonicalLesson:routeCanonicalLessons["3D printer"],createHouseModel:name=>name==="3D printer"?routeFallbackFactory():null};},
"layer-by-layer-fabrication":async()=>{const [{createPrinterModel,createPrinterModel:routeFallbackFactory},{layerFabricationLesson},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./printer-model.js"),import("./layer-fabrication-lesson.js"),import("./daily-life-lessons.js")]);return {name:"Layer-by-layer fabrication",canonicalName:"3D printer",component:{machine:'3D printer',createModel:()=>createPrinterModel({layerFabrication:true}),initialState:{partiallyPrinted:true},part:'bed',isolate:false,lesson:layerFabricationLesson,intro:layerFabricationLesson.simple},canonicalLesson:routeCanonicalLessons["3D printer"],createHouseModel:name=>name==="3D printer"?routeFallbackFactory():null};},
"generator-slip-rings":async()=>{const [{generatorSlipRingsLesson},{createGeneratorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./grid-generator-lessons.js"),import("./grid-generator-model.js"),import("./daily-life-lessons.js")]);return {name:"Generator slip rings",canonicalName:"Electric generator",component:{machine:'Electric generator',part:'system',isolate:false,view:'front',values:{output:0},lesson:generatorSlipRingsLesson,intro:generatorSlipRingsLesson.simple},canonicalLesson:routeCanonicalLessons["Electric generator"],createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"transformer-turns-ratio":async()=>{const [{createTransformerModel,createTransformerModel:routeFallbackFactory},{transformerTurnsRatioLesson},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./transformer-model.js"),import("./transformer-turns-ratio-lesson.js"),import("./daily-life-lessons.js")]);return {name:"Transformer turns ratio",canonicalName:"Transformer",component:{machine:'Transformer',createModel:()=>createTransformerModel({turnsRatioLesson:true}),part:'system',isolate:false,view:'iso',lesson:transformerTurnsRatioLesson,intro:transformerTurnsRatioLesson.simple},canonicalLesson:routeCanonicalLessons["Transformer"],createHouseModel:name=>name==="Transformer"?routeFallbackFactory():null};},
"spark-gap":async()=>{const [{createSparkGapModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./spark-gap-model.js"),import("./daily-life-lessons.js")]);return {name:"Spark gap",canonicalName:"Spark gap",component:undefined,canonicalLesson:routeCanonicalLessons["Spark gap"],createHouseModel:name=>name==="Spark gap"?routeFallbackFactory():null};},
"electronic-ignition":async()=>{const [{createElectronicIgnitionModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./electronic-ignition-model.js"),import("./daily-life-lessons.js")]);return {name:"Electronic ignition",canonicalName:"Electronic ignition",component:undefined,canonicalLesson:routeCanonicalLessons["Electronic ignition"],createHouseModel:name=>name==="Electronic ignition"?routeFallbackFactory():null};},
"earthquake-location-by-arrival-times":async()=>{const [{createEarthquakeLocationModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./earthquake-location-model.js"),import("./daily-life-lessons.js")]);return {name:"Earthquake location by arrival times",canonicalName:"Earthquake location by arrival times",component:undefined,canonicalLesson:routeCanonicalLessons["Earthquake location by arrival times"],createHouseModel:name=>name==="Earthquake location by arrival times"?routeFallbackFactory():null};},
"vertical-seismograph-suspension-spring":async()=>{const [{createVerticalSeismographSpringModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./vertical-seismograph-spring-model.js"),import("./daily-life-lessons.js")]);return {name:"Vertical-seismograph suspension spring",canonicalName:"Vertical-seismograph suspension spring",component:undefined,canonicalLesson:routeCanonicalLessons["Vertical-seismograph suspension spring"],createHouseModel:name=>name==="Vertical-seismograph suspension spring"?routeFallbackFactory():null};},
"seismograph-recording-pen-and-moving-paper":async()=>{const [{createSeismographRecordingModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./seismograph-recording-model.js"),import("./daily-life-lessons.js")]);return {name:"Seismograph recording pen and moving paper",canonicalName:"Seismograph recording pen and moving paper",component:undefined,canonicalLesson:routeCanonicalLessons["Seismograph recording pen and moving paper"],createHouseModel:name=>name==="Seismograph recording pen and moving paper"?routeFallbackFactory():null};},
"spark-plug-electrodes-and-ceramic-insulator":async()=>{const [{createSparkPlugModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./spark-plug-model.js"),import("./daily-life-lessons.js")]);return {name:"Spark-plug electrodes and ceramic insulator",canonicalName:"Spark-plug electrodes and ceramic insulator",component:undefined,canonicalLesson:routeCanonicalLessons["Spark-plug electrodes and ceramic insulator"],createHouseModel:name=>name==="Spark-plug electrodes and ceramic insulator"?routeFallbackFactory({electrodesLesson:true}):null};},
"inertial-accelerometer-armature-spring-and-coils":async()=>{const [{createInertialAccelerometerModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./inertial-accelerometer-model.js"),import("./daily-life-lessons.js")]);return {name:"Inertial accelerometer armature, spring, and coils",canonicalName:"Inertial accelerometer armature, spring, and coils",component:undefined,canonicalLesson:routeCanonicalLessons["Inertial accelerometer armature, spring, and coils"],createHouseModel:name=>name==="Inertial accelerometer armature, spring, and coils"?routeFallbackFactory():null};},
"microchip-deceleration-sensor":async()=>{const [{microchipDecelerationSensorLesson},{createCrashSensorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./microchip-deceleration-sensor-lesson.js"),import("./crash-sensor-model.js"),import("./daily-life-lessons.js")]);return {name:"Microchip deceleration sensor",canonicalName:"Crash sensor",component:{machine:'Crash sensor',part:'chip',redirectTo:'crash-sensor',lesson:microchipDecelerationSensorLesson},canonicalLesson:routeCanonicalLessons["Crash sensor"],createHouseModel:name=>name==="Crash sensor"?routeFallbackFactory():null};},
"crash-sensor-proof-square-and-sensing-strips":async()=>{const [{createCrashSensorModel,createCrashSensorModel:routeFallbackFactory},{crashSensorProofSquareAndSensingStripsLesson},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./crash-sensor-model.js"),import("./crash-sensor-proof-square-and-sensing-strips-lesson.js"),import("./daily-life-lessons.js")]);return {name:"Crash-sensor proof square and sensing strips",canonicalName:"Crash sensor",component:{machine:'Crash sensor',createModel:()=>createCrashSensorModel({mechanicsLesson:true}),part:'chip',view:'iso',isolate:true,lesson:crashSensorProofSquareAndSensingStripsLesson,intro:crashSensorProofSquareAndSensingStripsLesson.simple},canonicalLesson:routeCanonicalLessons["Crash sensor"],createHouseModel:name=>name==="Crash sensor"?routeFallbackFactory():null};},
"airbag-warning-indicator":async()=>{const [{createAirbagWarningIndicatorModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./airbag-warning-indicator-model.js"),import("./daily-life-lessons.js")]);return {name:"Airbag warning indicator",canonicalName:"Airbag warning indicator",component:undefined,canonicalLesson:routeCanonicalLessons["Airbag warning indicator"],createHouseModel:name=>name==="Airbag warning indicator"?routeFallbackFactory():null};},
"mirrors":async()=>{const [{createMirrorsModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./mirrors-model.js"),import("./daily-life-lessons.js")]);return {name:"Mirrors",canonicalName:"Mirrors",component:undefined,canonicalLesson:routeCanonicalLessons["Mirrors"],createHouseModel:name=>name==="Mirrors"?routeFallbackFactory():null};},
"lenses":async()=>{const [{createLensesModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./lenses-model.js"),import("./daily-life-lessons.js")]);return {name:"Lenses",canonicalName:"Lenses",component:undefined,canonicalLesson:routeCanonicalLessons["Lenses"],createHouseModel:name=>name==="Lenses"?routeFallbackFactory():null};},
"telescopes":async()=>{const [{createTelescopesModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./telescopes-model.js"),import("./daily-life-lessons.js")]);return {name:"Telescopes",canonicalName:"Telescopes",component:undefined,canonicalLesson:routeCanonicalLessons["Telescopes"],createHouseModel:name=>name==="Telescopes"?routeFallbackFactory():null};},
"microscopes":async()=>{const [{createMicroscopesModel:routeFallbackFactory},{dailyLifeLessons:routeCanonicalLessons}]=await Promise.all([import("./microscopes-model.js"),import("./daily-life-lessons.js")]);return {name:"Microscopes",canonicalName:"Microscopes",component:undefined,canonicalLesson:routeCanonicalLessons["Microscopes"],createHouseModel:name=>name==="Microscopes"?routeFallbackFactory():null};}
};
export const housePreviewLoaders={
"cylinder-lock":async()=>{const [{createCylinderModel:routeFallbackFactory}]=await Promise.all([import("./cylinder-model.js")]);return {name:"Cylinder lock",component:undefined,createHouseModel:name=>name==="Cylinder lock"?routeFallbackFactory():null};},
"lever-lock":async()=>{const [{createLeverModel:routeFallbackFactory}]=await Promise.all([import("./lever-model.js")]);return {name:"Lever lock",component:undefined,createHouseModel:name=>name==="Lever lock"?routeFallbackFactory():null};},
"keys":async()=>{const [{createCylinderModel:routeFallbackFactory}]=await Promise.all([import("./cylinder-model.js")]);return {name:"Keys",component:undefined,createHouseModel:name=>name==="Keys"?routeFallbackFactory({editableKey:true}):null};},
"can-opener":async()=>{const [{createCanOpenerModel:routeFallbackFactory}]=await Promise.all([import("./can-opener-model.js")]);return {name:"Can opener",component:undefined,createHouseModel:name=>name==="Can opener"?routeFallbackFactory():null};},
"zipper":async()=>{const [{createZipperModel:routeFallbackFactory}]=await Promise.all([import("./zipper-model.js")]);return {name:"Zipper",component:undefined,createHouseModel:name=>name==="Zipper"?routeFallbackFactory():null};},
"bottle-opener":async()=>{const [{createBottleOpenerModel:routeFallbackFactory}]=await Promise.all([import("./bottle-opener-model.js")]);return {name:"Bottle opener",component:undefined,createHouseModel:name=>name==="Bottle opener"?routeFallbackFactory():null};},
"nutcracker":async()=>{const [{createNutcrackerModel:routeFallbackFactory}]=await Promise.all([import("./nutcracker-model.js")]);return {name:"Nutcracker",component:undefined,createHouseModel:name=>name==="Nutcracker"?routeFallbackFactory():null};},
"nail-clippers":async()=>{const [{createClipperModel:routeFallbackFactory}]=await Promise.all([import("./clipper-model.js")]);return {name:"Nail clippers",component:undefined,createHouseModel:name=>name==="Nail clippers"?routeFallbackFactory():null};},
"tweezers":async()=>{const [{createTweezersModel:routeFallbackFactory}]=await Promise.all([import("./tweezers-model.js")]);return {name:"Tweezers",component:undefined,createHouseModel:name=>name==="Tweezers"?routeFallbackFactory():null};},
"bathroom-scale":async()=>{const [{createBathroomScaleModel:routeFallbackFactory}]=await Promise.all([import("./bathroom-scale-model.js")]);return {name:"Bathroom scale",component:undefined,createHouseModel:name=>name==="Bathroom scale"?routeFallbackFactory():null};},
"platform-scale":async()=>{const [{createPlatformScaleModel:routeFallbackFactory}]=await Promise.all([import("./platform-scale-model.js")]);return {name:"Platform scale",component:undefined,createHouseModel:name=>name==="Platform scale"?routeFallbackFactory():null};},
"roberval-balance":async()=>{const [{createRobervalBalanceModel:routeFallbackFactory}]=await Promise.all([import("./roberval-balance-model.js")]);return {name:"Roberval balance",component:undefined,createHouseModel:name=>name==="Roberval balance"?routeFallbackFactory():null};},
"scale-calibrating-plate":async()=>{const [{createBathroomScaleModel}]=await Promise.all([import("./bathroom-scale-model.js")]);return {name:"Scale calibrating plate",component:{machine:'Bathroom scale',part:'calibration',createModel:()=>createBathroomScaleModel({plateTeaching:true})},createHouseModel:name=>null};},
"sardine-can-key":async()=>{const [{createSardineCanKeyModel:routeFallbackFactory}]=await Promise.all([import("./sardine-can-key-model.js")]);return {name:"Sardine-can key",component:undefined,createHouseModel:name=>name==="Sardine-can key"?routeFallbackFactory():null};},
"salad-spinner":async()=>{const [{createSaladSpinnerModel:routeFallbackFactory}]=await Promise.all([import("./salad-spinner-model.js")]);return {name:"Salad spinner",component:undefined,createHouseModel:name=>name==="Salad spinner"?routeFallbackFactory():null};},
"mechanical-clock":async()=>{const [{createPendulumClockModel:routeFallbackFactory}]=await Promise.all([import("./pendulum-clock-model.js")]);return {name:"Mechanical clock",component:undefined,createHouseModel:name=>name==="Mechanical clock"?routeFallbackFactory():null};},
"mechanical-watch":async()=>{const [{createWatchModel:routeFallbackFactory}]=await Promise.all([import("./watch-model.js")]);return {name:"Mechanical watch",component:undefined,createHouseModel:name=>name==="Mechanical watch"?routeFallbackFactory():null};},
"anchor-escapement":async()=>{const [{createAnchorEscapementModel}]=await Promise.all([import("./anchor-escapement-model.js")]);return {name:"Anchor escapement",component:{machine:'Mechanical clock',createModel:createAnchorEscapementModel,part:'escapement'},createHouseModel:name=>null};},
"lever-escapement":async()=>{const [{createLeverEscapementModel}]=await Promise.all([import("./lever-escapement-model.js")]);return {name:"Lever escapement",component:{machine:'Mechanical watch',createModel:createLeverEscapementModel,part:'escapement'},createHouseModel:name=>null};},
"rack-and-pinion-corkscrew":async()=>{const [{createWingedCorkscrewModel:routeFallbackFactory}]=await Promise.all([import("./winged-corkscrew-model.js")]);return {name:"Rack-and-pinion corkscrew",component:undefined,createHouseModel:name=>name==="Rack-and-pinion corkscrew"?routeFallbackFactory():null};},
"egg-whisk":async()=>{const [{createEggWhiskModel:routeFallbackFactory}]=await Promise.all([import("./egg-whisk-model.js")]);return {name:"Egg whisk",component:undefined,createHouseModel:name=>name==="Egg whisk"?routeFallbackFactory():null};},
"electric-mixer":async()=>{const [{createElectricMixerModel:routeFallbackFactory}]=await Promise.all([import("./electric-mixer-model.js")]);return {name:"Electric mixer",component:undefined,createHouseModel:name=>name==="Electric mixer"?routeFallbackFactory():null};},
"sewing-machine":async()=>{const [{createSewingModel:routeFallbackFactory}]=await Promise.all([import("./sewing-model.js")]);return {name:"Sewing machine",component:undefined,createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"lockstitch":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Lockstitch",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel();model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','needle','hook-assembly','hook','bobbin','take-up','take-up-rocker'];return model;},part:'stitch-formation'},createHouseModel:name=>null};},
"feed-dog":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Feed-dog",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({feedLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'feed-bar'},createHouseModel:name=>null};},
"screw-corkscrew":async()=>{const [{createScrewCorkscrewModel:routeFallbackFactory}]=await Promise.all([import("./screw-corkscrew-model.js")]);return {name:"Screw corkscrew",component:undefined,createHouseModel:name=>name==="Screw corkscrew"?routeFallbackFactory():null};},
"faucet":async()=>{const [{createFaucetModel:routeFallbackFactory}]=await Promise.all([import("./faucet-model.js")]);return {name:"Faucet",component:undefined,createHouseModel:name=>name==="Faucet"?routeFallbackFactory():null};},
"meat-grinder":async()=>{const [{createMeatGrinderModel:routeFallbackFactory}]=await Promise.all([import("./meat-grinder-model.js")]);return {name:"Meat grinder",component:undefined,createHouseModel:name=>name==="Meat grinder"?routeFallbackFactory():null};},
"spin-dryer":async()=>{const [{createSpinDryerModel:routeFallbackFactory}]=await Promise.all([import("./spin-dryer-model.js")]);return {name:"Spin dryer",component:undefined,createHouseModel:name=>name==="Spin dryer"?routeFallbackFactory():null};},
"friction-drive-toy":async()=>{const [{createFrictionDriveToyModel:routeFallbackFactory}]=await Promise.all([import("./friction-drive-toy-model.js")]);return {name:"Friction-drive toy",component:undefined,createHouseModel:name=>name==="Friction-drive toy"?routeFallbackFactory():null};},
"window-shade":async()=>{const [{createWindowShadeModel:routeFallbackFactory}]=await Promise.all([import("./window-shade-model.js")]);return {name:"Window shade",component:undefined,createHouseModel:name=>name==="Window shade"?routeFallbackFactory():null};},
"ratchet":async()=>{const [{createRatchetModel:routeFallbackFactory}]=await Promise.all([import("./ratchet-model.js")]);return {name:"Ratchet",component:undefined,createHouseModel:name=>name==="Ratchet"?routeFallbackFactory():null};},
"stapler":async()=>{const [{createStaplerModel:routeFallbackFactory}]=await Promise.all([import("./stapler-model.js")]);return {name:"Stapler",component:undefined,createHouseModel:name=>name==="Stapler"?routeFallbackFactory():null};},
"raft":async()=>{const [{createRaftModel:routeFallbackFactory}]=await Promise.all([import("./raft-model.js")]);return {name:"Raft",component:undefined,createHouseModel:name=>name==="Raft"?routeFallbackFactory():null};},
"vacuum-cleaner":async()=>{const [{createVacuumCleanerModel:routeFallbackFactory}]=await Promise.all([import("./vacuum-models.js")]);return {name:"Vacuum cleaner",component:undefined,createHouseModel:name=>name==="Vacuum cleaner"?routeFallbackFactory():null};},
"upright-vacuum-cleaner":async()=>{const [{createUprightVacuumModel:routeFallbackFactory}]=await Promise.all([import("./vacuum-models.js")]);return {name:"Upright vacuum cleaner",component:undefined,createHouseModel:name=>name==="Upright vacuum cleaner"?routeFallbackFactory():null};},
"drinking-straw":async()=>{const [{createDrinkingStrawModel:routeFallbackFactory}]=await Promise.all([import("./drinking-straw-model.js")]);return {name:"Drinking straw",component:undefined,createHouseModel:name=>name==="Drinking straw"?routeFallbackFactory():null};},
"toilet-tank":async()=>{const [{createToiletTankModel:routeFallbackFactory}]=await Promise.all([import("./toilet-tank-model.js")]);return {name:"Toilet tank",component:undefined,createHouseModel:name=>name==="Toilet tank"?routeFallbackFactory():null};},
"siphon":async()=>{const [{createSiphonModel}]=await Promise.all([import("./siphon-model.js")]);return {name:"Siphon",component:{machine:'Toilet tank',createModel:createSiphonModel,part:'system'},createHouseModel:name=>null};},
"water-meter":async()=>{const [{createWaterMeterModel:routeFallbackFactory}]=await Promise.all([import("./water-meter-model.js")]);return {name:"Water meter",component:undefined,createHouseModel:name=>name==="Water meter"?routeFallbackFactory():null};},
"dishwasher":async()=>{const [{createDishwasherModel:routeFallbackFactory}]=await Promise.all([import("./dishwasher-model.js")]);return {name:"Dishwasher",component:undefined,createHouseModel:name=>name==="Dishwasher"?routeFallbackFactory():null};},
"rotating-spray-arm":async()=>{const [{createDishwasherModel}]=await Promise.all([import("./dishwasher-model.js")]);return {name:"Rotating spray arm",component:{machine:'Dishwasher',createModel:()=>createDishwasherModel({sprayArmLesson:true}),part:'system'},createHouseModel:name=>null};},
"aerosol-spray-can":async()=>{const [{createAerosolCanModel:routeFallbackFactory}]=await Promise.all([import("./aerosol-model.js")]);return {name:"Aerosol spray can",component:undefined,createHouseModel:name=>name==="Aerosol spray can"?routeFallbackFactory():null};},
"fire-extinguisher":async()=>{const [{createCartridgeExtinguisherModel:routeFallbackFactory}]=await Promise.all([import("./cartridge-extinguisher-model.js")]);return {name:"Fire extinguisher",component:undefined,createHouseModel:name=>name==="Fire extinguisher"?routeFallbackFactory():null};},
"ballpoint-pen":async()=>{const [{createBallpointModel:routeFallbackFactory}]=await Promise.all([import("./ballpoint-model.js")]);return {name:"Ballpoint pen",component:undefined,createHouseModel:name=>name==="Ballpoint pen"?routeFallbackFactory():null};},
"felt-tip-pen":async()=>{const [{createFeltTipModel:routeFallbackFactory}]=await Promise.all([import("./felt-tip-model.js")]);return {name:"Felt-tip pen",component:undefined,createHouseModel:name=>name==="Felt-tip pen"?routeFallbackFactory():null};},
"dip-pen":async()=>{const [{createDipPenModel:routeFallbackFactory}]=await Promise.all([import("./dip-pen-model.js")]);return {name:"Dip pen",component:undefined,createHouseModel:name=>name==="Dip pen"?routeFallbackFactory():null};},
"capillary-action":async()=>{const [{createCapillaryModel}]=await Promise.all([import("./capillary-model.js")]);return {name:"Capillary action",component:{machine:'Capillary action',createModel:createCapillaryModel,part:'capillary'},createHouseModel:name=>null};},
"microwave-oven":async()=>{const [{createMicrowaveModel:routeFallbackFactory}]=await Promise.all([import("./microwave-model.js")]);return {name:"Microwave oven",component:undefined,createHouseModel:name=>name==="Microwave oven"?routeFallbackFactory():null};},
"vacuum-flask":async()=>{const [{createVacuumFlaskModel:routeFallbackFactory}]=await Promise.all([import("./vacuum-flask-model.js")]);return {name:"Vacuum flask",component:undefined,createHouseModel:name=>name==="Vacuum flask"?routeFallbackFactory():null};},
"gas-boiler":async()=>{const [{createTanklessHeaterModel:routeFallbackFactory}]=await Promise.all([import("./tankless-heater-model.js")]);return {name:"Gas boiler",component:undefined,createHouseModel:name=>name==="Gas boiler"?routeFallbackFactory():null};},
"toaster":async()=>{const [{createToasterModel:routeFallbackFactory}]=await Promise.all([import("./toaster-model.js")]);return {name:"Toaster",component:undefined,createHouseModel:name=>name==="Toaster"?routeFallbackFactory():null};},
"refrigerator":async()=>{const [{createRefrigeratorModel:routeFallbackFactory}]=await Promise.all([import("./refrigerator-model.js")]);return {name:"Refrigerator",component:undefined,createHouseModel:name=>name==="Refrigerator"?routeFallbackFactory():null};},
"refrigerant-compressor":async()=>{const [{createRefrigerantCompressorModel}]=await Promise.all([import("./refrigerant-compressor-model.js")]);return {name:"Refrigerant compressor",component:{machine:'Refrigerator',createModel:createRefrigerantCompressorModel,part:'system'},createHouseModel:name=>null};},
"air-conditioner":async()=>{const [{createAirConditionerModel:routeFallbackFactory}]=await Promise.all([import("./aircon-model.js")]);return {name:"Air conditioner",component:undefined,createHouseModel:name=>name==="Air conditioner"?routeFallbackFactory():null};},
"liquid-in-glass-thermometer":async()=>{const [{createLiquidThermometerModel:routeFallbackFactory}]=await Promise.all([import("./thermometer-models.js")]);return {name:"Liquid-in-glass thermometer",component:undefined,createHouseModel:name=>name==="Liquid-in-glass thermometer"?routeFallbackFactory():null};},
"maximum-minimum-thermometer":async()=>{const [{createSixThermometerModel:routeFallbackFactory}]=await Promise.all([import("./thermometer-models.js")]);return {name:"Maximum-minimum thermometer",component:undefined,createHouseModel:name=>name==="Maximum-minimum thermometer"?routeFallbackFactory():null};},
"binoculars":async()=>{const [{createBinocularsModel:routeFallbackFactory}]=await Promise.all([import("./binoculars-model.js")]);return {name:"Binoculars",component:undefined,createHouseModel:name=>name==="Binoculars"?routeFallbackFactory():null};},
"polarized-light":async()=>{const [{createPolarizedLightModel:routeFallbackFactory}]=await Promise.all([import("./polarized-light-model.js")]);return {name:"Polarized light",component:undefined,createHouseModel:name=>name==="Polarized light"?routeFallbackFactory():null};},
"liquid-crystal-display":async()=>{const [{createLCDModel:routeFallbackFactory}]=await Promise.all([import("./lcd-model.js")]);return {name:"Liquid crystal display",component:undefined,createHouseModel:name=>name==="Liquid crystal display"?routeFallbackFactory():null};},
"blu-ray-player":async()=>{const [{createBluRayPlayerModel:routeFallbackFactory}]=await Promise.all([import("./blu-ray-player-model.js")]);return {name:"Blu-ray player",component:undefined,createHouseModel:name=>name==="Blu-ray player"?routeFallbackFactory():null};},
"cd":async()=>{const [{createCdModel}]=await Promise.all([import("./cd-model.js")]);return {name:"CD",component:{machine:'Blu-ray player',createModel:createCdModel,part:'player'},createHouseModel:name=>null};},
"dvd":async()=>{const [{createDvdModel}]=await Promise.all([import("./dvd-model.js")]);return {name:"DVD",component:{machine:'Blu-ray player',createModel:createDvdModel,part:'player'},createHouseModel:name=>null};},
"cd-rom":async()=>{const [{createCdromModel}]=await Promise.all([import("./cdrom-model.js")]);return {name:"CD-ROM",component:{machine:'Blu-ray player',createModel:createCdromModel,part:'player'},createHouseModel:name=>null};},
"cd-r":async()=>{const [{createCdrModel}]=await Promise.all([import("./cdr-model.js")]);return {name:"CD-R",component:{machine:'Blu-ray player',createModel:createCdrModel,part:'player'},createHouseModel:name=>null};},
"dvd-r":async()=>{const [{createDvdrModel}]=await Promise.all([import("./dvdr-model.js")]);return {name:"DVD-R",component:{machine:'Blu-ray player',createModel:createDvdrModel,part:'player'},createHouseModel:name=>null};},
"optical-disc-readout":async()=>{const [{createOpticalReadoutModel}]=await Promise.all([import("./optical-readout-model.js")]);return {name:"Optical-disc readout",component:{machine:'Blu-ray player',createModel:createOpticalReadoutModel,part:'assembly'},createHouseModel:name=>null};},
"electronic-paper":async()=>{const [{createElectronicPaperDisplayModel:routeFallbackFactory}]=await Promise.all([import("./electronic-paper-model.js")]);return {name:"Electronic paper",component:undefined,createHouseModel:name=>name==="Electronic paper"?routeFallbackFactory():null};},
"electronic-ink":async()=>{const [{createElectronicInkModel}]=await Promise.all([import("./electronic-ink-model.js")]);return {name:"Electronic ink",component:{machine:'Electronic paper',createModel:createElectronicInkModel,part:'assembly'},createHouseModel:name=>null};},
"electrowetting-display":async()=>{const [{createElectrowettingModel}]=await Promise.all([import("./electrowetting-model.js")]);return {name:"Electrowetting display",component:{machine:'Electronic paper',createModel:createElectrowettingModel,part:'assembly'},createHouseModel:name=>null};},
"e-reader":async()=>{const [{createEReaderModel}]=await Promise.all([import("./e-reader-model.js")]);return {name:"E-reader",component:{machine:'E-reader',createModel:createEReaderModel,part:'reader'},createHouseModel:name=>null};},
"smartphone":async()=>{const [{createSmartphoneLearningModel:routeFallbackFactory}]=await Promise.all([import("./smartphone-model.js")]);return {name:"Smartphone",component:undefined,createHouseModel:name=>name==="Smartphone"?routeFallbackFactory():null};},
"accelerometer":async()=>{const [{createAccelerometerModel}]=await Promise.all([import("./accelerometer-model.js")]);return {name:"Accelerometer",component:{machine:'Smartphone',createModel:createAccelerometerModel,part:'module'},createHouseModel:name=>null};},
"vibration-motor":async()=>{const [{createVibrationMotorModel}]=await Promise.all([import("./vibration-motor-model.js")]);return {name:"Vibration motor",component:{machine:'Smartphone',createModel:createVibrationMotorModel,part:'system'},createHouseModel:name=>null};},
"lcd-screen":async()=>{const [{createTftScreenModel:routeFallbackFactory}]=await Promise.all([import("./tft-screen-model.js")]);return {name:"LCD screen",component:undefined,createHouseModel:name=>name==="LCD screen"?routeFallbackFactory():null};},
"rgb-subpixels":async()=>{const [{createRgbSubpixelsModel}]=await Promise.all([import("./rgb-subpixels-model.js")]);return {name:"RGB subpixels",component:{machine:'LCD screen',createModel:createRgbSubpixelsModel,part:'system'},createHouseModel:name=>null};},
"oled-display":async()=>{const [{createOledDisplayModel:routeFallbackFactory}]=await Promise.all([import("./oled-display-model.js")]);return {name:"OLED display",component:undefined,createHouseModel:name=>name==="OLED display"?routeFallbackFactory():null};},
"air-cleaner":async()=>{const [{createAirCleanerModel:routeFallbackFactory}]=await Promise.all([import("./air-cleaner-model.js")]);return {name:"Air cleaner",component:undefined,createHouseModel:name=>name==="Air cleaner"?routeFallbackFactory():null};},
"electrostatic-precipitator":async()=>{const [{createElectrostaticPrecipitatorModel}]=await Promise.all([import("./electrostatic-precipitator-model.js")]);return {name:"Electrostatic precipitator",component:{machine:'Air cleaner',createModel:createElectrostaticPrecipitatorModel,part:'stage'},createHouseModel:name=>null};},
"ionizer":async()=>{const [{createIonizerModel}]=await Promise.all([import("./ionizer-model.js")]);return {name:"Ionizer",component:{machine:'Air cleaner',createModel:createIonizerModel,part:'fan'},createHouseModel:name=>null};},
"voltage-multiplier":async()=>{const [{createVoltageMultiplierModel:routeFallbackFactory}]=await Promise.all([import("./voltage-multiplier-model.js")]);return {name:"Voltage multiplier",component:undefined,createHouseModel:name=>name==="Voltage multiplier"?routeFallbackFactory():null};},
"lightning-conductor":async()=>{const [{createLightningConductorModel:routeFallbackFactory}]=await Promise.all([import("./lightning-model.js")]);return {name:"Lightning conductor",component:undefined,createHouseModel:name=>name==="Lightning conductor"?routeFallbackFactory():null};},
"kinetic-quartz-watch":async()=>{const [{createKineticWatchModel:routeFallbackFactory}]=await Promise.all([import("./quartz-models.js")]);return {name:"Kinetic quartz watch",component:undefined,createHouseModel:name=>name==="Kinetic quartz watch"?routeFallbackFactory():null};},
"quartz-clock":async()=>{const [{createQuartzClockModel:routeFallbackFactory}]=await Promise.all([import("./quartz-clock-model.js")]);return {name:"Quartz clock",component:undefined,createHouseModel:name=>name==="Quartz clock"?routeFallbackFactory():null};},
"quartz-oscillator":async()=>{const [{createQuartzOscillatorModel}]=await Promise.all([import("./quartz-oscillator-model.js")]);return {name:"Quartz oscillator",component:{machine:'Quartz clock',createModel:createQuartzOscillatorModel,part:'circuit'},createHouseModel:name=>null};},
"piezoelectricity":async()=>{const [{createPiezoelectricityModel}]=await Promise.all([import("./piezoelectricity-model.js")]);return {name:"Piezoelectricity",component:{machine:'Quartz clock',createModel:createPiezoelectricityModel,part:'apparatus'},createHouseModel:name=>null};},
"remote-control":async()=>{const [{createInfraredRemoteModel:routeFallbackFactory}]=await Promise.all([import("./remote-control-model.js")]);return {name:"Remote control",component:undefined,createHouseModel:name=>name==="Remote control"?routeFallbackFactory():null};},
"infrared-signaling":async()=>{const [{createInfraredSignalingModel}]=await Promise.all([import("./infrared-signaling-model.js")]);return {name:"Infrared signaling",component:{machine:'Remote control',createModel:createInfraredSignalingModel,part:'system'},createHouseModel:name=>null};},
"diode":async()=>{const [{createDiodeModel}]=await Promise.all([import("./diode-model.js")]);return {name:"Diode",component:{machine:'Remote control',createModel:createDiodeModel,part:'circuit'},createHouseModel:name=>null};},
"light-emitting-diode":async()=>{const [{createLedModel}]=await Promise.all([import("./led-model.js")]);return {name:"Light-emitting diode",component:{machine:'Remote control',createModel:createLedModel,part:'circuit'},createHouseModel:name=>null};},
"photodiode":async()=>{const [{createPhotodiodeModel}]=await Promise.all([import("./photodiode-model.js")]);return {name:"Photodiode",component:{machine:'Remote control',createModel:createPhotodiodeModel,part:'bench'},createHouseModel:name=>null};},
"electromagnet":async()=>{const [{createElectromagnetModel:routeFallbackFactory}]=await Promise.all([import("./electromagnet-model.js")]);return {name:"Electromagnet",component:undefined,createHouseModel:name=>name==="Electromagnet"?routeFallbackFactory():null};},
"electric-bell":async()=>{const [{createBellModel:routeFallbackFactory}]=await Promise.all([import("./bell-model.js")]);return {name:"Electric bell",component:undefined,createHouseModel:name=>name==="Electric bell"?routeFallbackFactory():null};},
"electric-horn":async()=>{const [{createHornModel:routeFallbackFactory}]=await Promise.all([import("./horn-model.js")]);return {name:"Electric horn",component:undefined,createHouseModel:name=>name==="Electric horn"?routeFallbackFactory():null};},
"electric-motor":async()=>{const [{createDCMotorModel:routeFallbackFactory}]=await Promise.all([import("./dc-motor-model.js")]);return {name:"Electric motor",component:{machine:'Direct-current motor',part:'system'},createHouseModel:name=>name==="Direct-current motor"?routeFallbackFactory():null};},
"universal-motor":async()=>{const [{createUniversalMotorModel:routeFallbackFactory}]=await Promise.all([import("./universal-motor-model.js")]);return {name:"Universal motor",component:undefined,createHouseModel:name=>name==="Universal motor"?routeFallbackFactory():null};},
"motor-rotor":async()=>{const [{createUniversalMotorModel:routeFallbackFactory}]=await Promise.all([import("./universal-motor-model.js")]);return {name:"Motor rotor",component:{machine:'Universal motor',part:'rotor'},createHouseModel:name=>name==="Universal motor"?routeFallbackFactory():null};},
"direct-current-motor":async()=>{const [{createDCMotorModel:routeFallbackFactory}]=await Promise.all([import("./dc-motor-model.js")]);return {name:"Direct-current motor",component:undefined,createHouseModel:name=>name==="Direct-current motor"?routeFallbackFactory():null};},
"commutator":async()=>{const [{createDCMotorModel:routeFallbackFactory}]=await Promise.all([import("./dc-motor-model.js")]);return {name:"Commutator",component:{machine:'Direct-current motor',part:'commutator'},createHouseModel:name=>name==="Direct-current motor"?routeFallbackFactory():null};},
"3d-printer":async()=>{const [{createPrinterModel:routeFallbackFactory}]=await Promise.all([import("./printer-model.js")]);return {name:"3D printer",component:undefined,createHouseModel:name=>name==="3D printer"?routeFallbackFactory():null};},
"stepper-motor":async()=>{const [{createStepperMotorModel:routeFallbackFactory}]=await Promise.all([import("./stepper-motor-model.js")]);return {name:"Stepper motor",component:undefined,createHouseModel:name=>name==="Stepper motor"?routeFallbackFactory():null};},
"electric-generator":async()=>{const [{createGeneratorModel:routeFallbackFactory}]=await Promise.all([import("./grid-generator-model.js")]);return {name:"Electric generator",component:undefined,createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"ac-generator":async()=>{const [{createGeneratorModel:routeFallbackFactory}]=await Promise.all([import("./grid-generator-model.js")]);return {name:"AC generator",component:{machine:'Electric generator',part:'system',values:{output:0}},createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"dc-generator":async()=>{const [{createGeneratorModel},{commutatorLesson}]=await Promise.all([import("./grid-generator-model.js"),import("./commutator-lesson.js")]);return {name:"DC generator",component:{machine:'Electric generator',createModel:()=>createGeneratorModel({commutatorLesson:true}),part:'system',values:{output:1}},createHouseModel:name=>null};},
"transformer":async()=>{const [{createTransformerModel:routeFallbackFactory}]=await Promise.all([import("./transformer-model.js")]);return {name:"Transformer",component:undefined,createHouseModel:name=>name==="Transformer"?routeFallbackFactory():null};},
"electricity-transmission":async()=>{const [{createElectricityTransmissionModel:routeFallbackFactory}]=await Promise.all([import("./electricity-transmission-model.js")]);return {name:"Electricity transmission",component:undefined,createHouseModel:name=>name==="Electricity transmission"?routeFallbackFactory():null};},
"distribution-transformer":async()=>{const [{createElectricityTransmissionModel}]=await Promise.all([import("./electricity-transmission-model.js")]);return {name:"Distribution transformer",component:{machine:'Transformer',createModel:()=>createElectricityTransmissionModel({distributionLesson:true}),part:'system'},createHouseModel:name=>null};},
"two-way-light-switch":async()=>{const [{createLightingModel:routeFallbackFactory}]=await Promise.all([import("./lighting-model.js")]);return {name:"Two-way light switch",component:undefined,createHouseModel:name=>name==="Two-way light switch"?routeFallbackFactory():null};},
"electricity-meter":async()=>{const [{createMeterModel:routeFallbackFactory}]=await Promise.all([import("./meter-model.js")]);return {name:"Electricity meter",component:undefined,createHouseModel:name=>name==="Electricity meter"?routeFallbackFactory():null};},
"fuse":async()=>{const [{createFuseModel:routeFallbackFactory}]=await Promise.all([import("./fuse-model.js")]);return {name:"Fuse",component:undefined,createHouseModel:name=>name==="Fuse"?routeFallbackFactory():null};},
"circuit-breaker":async()=>{const [{createBreakerModel:routeFallbackFactory}]=await Promise.all([import("./breaker-model.js")]);return {name:"Circuit breaker",component:undefined,createHouseModel:name=>name==="Circuit breaker"?routeFallbackFactory():null};},
"sensors-and-detectors":async()=>{const [{createSensorsAndDetectorsModel:routeFallbackFactory}]=await Promise.all([import("./sensors-and-detectors-model.js")]);return {name:"Sensors and detectors",component:undefined,createHouseModel:name=>name==="Sensors and detectors"?routeFallbackFactory():null};},
"feedback-mechanism":async()=>{const [{createFeedbackMechanismModel:routeFallbackFactory}]=await Promise.all([import("./feedback-mechanism-model.js")]);return {name:"Feedback mechanism",component:undefined,createHouseModel:name=>name==="Feedback mechanism"?routeFallbackFactory():null};},
"seismograph":async()=>{const [{createSeismographModel:routeFallbackFactory}]=await Promise.all([import("./seismograph-model.js")]);return {name:"Seismograph",component:undefined,createHouseModel:name=>name==="Seismograph"?routeFallbackFactory():null};},
"horizontal-seismograph-pendulum":async()=>{const [{createHorizontalSeismographPendulumModel:routeFallbackFactory}]=await Promise.all([import("./horizontal-seismograph-pendulum-model.js")]);return {name:"Horizontal seismograph pendulum",component:undefined,createHouseModel:name=>name==="Horizontal seismograph pendulum"?routeFallbackFactory():null};},
"vertical-seismograph-pendulum":async()=>{const [{createVerticalSeismographPendulumModel:routeFallbackFactory}]=await Promise.all([import("./vertical-seismograph-pendulum-model.js")]);return {name:"Vertical seismograph pendulum",component:undefined,createHouseModel:name=>name==="Vertical seismograph pendulum"?routeFallbackFactory():null};},
"seismic-waves":async()=>{const [{createSeismicWavesModel:routeFallbackFactory}]=await Promise.all([import("./seismic-waves-model.js")]);return {name:"Seismic waves",component:undefined,createHouseModel:name=>name==="Seismic waves"?routeFallbackFactory():null};},
"crash-sensor":async()=>{const [{createCrashSensorModel:routeFallbackFactory}]=await Promise.all([import("./crash-sensor-model.js")]);return {name:"Crash sensor",component:undefined,createHouseModel:name=>name==="Crash sensor"?routeFallbackFactory():null};},
"autopilot":async()=>{const [{createAutopilotModel:routeFallbackFactory}]=await Promise.all([import("./autopilot-model.js")]);return {name:"Autopilot",component:undefined,createHouseModel:name=>name==="Autopilot"?routeFallbackFactory():null};},
"inertial-guidance":async()=>{const [{createInertialGuidanceModel:routeFallbackFactory}]=await Promise.all([import("./inertial-guidance-model.js")]);return {name:"Inertial guidance",component:undefined,createHouseModel:name=>name==="Inertial guidance"?routeFallbackFactory():null};},
"smoke-detector":async()=>{const [{createReviewedSmokeDetectorModel:routeFallbackFactory}]=await Promise.all([import("./smoke-detector-model.js")]);return {name:"Smoke detector",component:undefined,createHouseModel:name=>name==="Smoke detector"?routeFallbackFactory():null};},
"ionization-smoke-detector":async()=>{const [{createIonizationSmokeModel}]=await Promise.all([import("./ionization-smoke-model.js")]);return {name:"Ionization smoke detector",component:{machine:'Smoke detector',createModel:createIonizationSmokeModel,part:'system'},createHouseModel:name=>null};},
"optical-smoke-detector":async()=>{const [{createOpticalSmokeModel}]=await Promise.all([import("./optical-smoke-model.js")]);return {name:"Optical smoke detector",component:{machine:'Smoke detector',createModel:createOpticalSmokeModel,part:'system'},createHouseModel:name=>null};},
"active-burglar-alarm":async()=>{const [{createBurglarAlarmModel:routeFallbackFactory}]=await Promise.all([import("./burglar-alarm-model.js")]);return {name:"Active burglar alarm",component:undefined,createHouseModel:name=>name==="Active burglar alarm"?routeFallbackFactory():null};},
"passive-infrared-movement-detector":async()=>{const [{createPassiveInfraredModel:routeFallbackFactory}]=await Promise.all([import("./passive-infrared-model.js")]);return {name:"Passive infrared movement detector",component:undefined,createHouseModel:name=>name==="Passive infrared movement detector"?routeFallbackFactory():null};},
"games-controller":async()=>{const [{createGamesControllerModel:routeFallbackFactory}]=await Promise.all([import("./games-controller-model.js")]);return {name:"Games controller",component:undefined,createHouseModel:name=>name==="Games controller"?routeFallbackFactory():null};},
"joystick":async()=>{const [{createJoystickModel}]=await Promise.all([import("./joystick-model.js")]);return {name:"Joystick",component:{machine:'Games controller',createModel:createJoystickModel,part:'rig'},createHouseModel:name=>null};},
"video-games-console":async()=>{const [{createVideoGamesConsoleModel}]=await Promise.all([import("./video-games-console-model.js")]);return {name:"Video games console",component:{machine:'Games controller',createModel:createVideoGamesConsoleModel,part:'console-experiment'},createHouseModel:name=>null};},
"speech-recognition":async()=>{const [{createSpeechRecognitionModel:routeFallbackFactory}]=await Promise.all([import("./speech-recognition-model.js")]);return {name:"Speech recognition",component:undefined,createHouseModel:name=>name==="Speech recognition"?routeFallbackFactory():null};},
"phonemes":async()=>{const [{createPhonemesModel}]=await Promise.all([import("./phonemes-model.js")]);return {name:"Phonemes",component:{machine:'Speech recognition',createModel:createPhonemesModel,part:'system'},createHouseModel:name=>null};},
"virtual-reality-headset":async()=>{const [{createVrHeadsetModel:routeFallbackFactory}]=await Promise.all([import("./vr-headset-model.js")]);return {name:"Virtual reality headset",component:undefined,createHouseModel:name=>name==="Virtual reality headset"?routeFallbackFactory():null};},
"head-tracking":async()=>{const [{createHeadTrackingModel}]=await Promise.all([import("./head-tracking-model.js")]);return {name:"Head tracking",component:{machine:'Virtual reality headset',createModel:createHeadTrackingModel,part:'system'},createHouseModel:name=>null};},
"robot-vacuum-cleaner":async()=>{const [{createRobotVacuumModel:routeFallbackFactory}]=await Promise.all([import("./robot-vacuum-model.js")]);return {name:"Robot vacuum cleaner",component:undefined,createHouseModel:name=>name==="Robot vacuum cleaner"?routeFallbackFactory():null};},
"calculator":async()=>{const [{createCalculatorAdditionModel:routeFallbackFactory}]=await Promise.all([import("./calculator-addition-model.js")]);return {name:"Calculator",component:undefined,createHouseModel:name=>name==="Calculator"?routeFallbackFactory():null};},
"hairspring":async()=>{const [{createHairspringModel}]=await Promise.all([import("./hairspring-model.js")]);return {name:"Hairspring",component:{machine:'Mechanical watch',createModel:createHairspringModel,part:'oscillator'},createHouseModel:name=>null};},
"zipper-slide-wedges":async()=>{const [{createZipperModel}]=await Promise.all([import("./zipper-model.js")]);return {name:"Zipper slide wedges",component:{machine:'Zipper',createModel:()=>{const model=createZipperModel({sliderLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'slider',values:{alignment:1,insertion:1,closure:.35}},createHouseModel:name=>null};},
"interlocking-zipper-teeth":async()=>{const [{createZipperModel}]=await Promise.all([import("./zipper-model.js")]);return {name:"Interlocking zipper teeth",component:{machine:'Zipper',createModel:()=>{const model=createZipperModel();model.frameBoundsForPart=id=>{if(id!=='head-7')return;const bounds=new Box3().setFromObject(model.parts.find(part=>part.id===id).object);return bounds.expandByVector(bounds.getSize(new Vector3()).multiplyScalar(.65));};model.resultPart.focusOnComplete=false;return model;},part:'head-7',values:{alignment:1,insertion:1,closure:.5}},createHouseModel:name=>null};},
"transmission-transformer":async()=>{const [{createElectricityTransmissionModel}]=await Promise.all([import("./electricity-transmission-model.js")]);return {name:"Transmission transformer",component:{machine:'Transformer',createModel:()=>createElectricityTransmissionModel({sendingLesson:true}),part:'system'},createHouseModel:name=>null};},
"home-supply-transformer":async()=>{const [{createHomeSupplyTransformerModel}]=await Promise.all([import("./home-supply-transformer-model.js")]);return {name:"Home-supply transformer",component:{machine:'Transformer',createModel:createHomeSupplyTransformerModel,part:'system'},createHouseModel:name=>null};},
"power-line-insulator":async()=>{const [{createPowerLineInsulatorModel}]=await Promise.all([import("./power-line-insulator-model.js")]);return {name:"Power-line insulator",component:{machine:'Electricity transmission',createModel:createPowerLineInsulatorModel,part:'system'},createHouseModel:name=>null};},
"power-pylon":async()=>{const [{createPowerPylonModel}]=await Promise.all([import("./power-pylon-model.js")]);return {name:"Power pylon",component:{machine:'Electricity transmission',createModel:createPowerPylonModel,part:'system'},createHouseModel:name=>null};},
"water-clock":async()=>{const [{createWaterClockModel:routeFallbackFactory}]=await Promise.all([import("./water-clock-model.js")]);return {name:"Water clock",component:undefined,createHouseModel:name=>name==="Water clock"?routeFallbackFactory():null};},
"washing-machine":async()=>{const [{createWashingMachineModel:routeFallbackFactory}]=await Promise.all([import("./washing-machine-model.js")]);return {name:"Washing machine",component:undefined,createHouseModel:name=>name==="Washing machine"?routeFallbackFactory():null};},
"unicycle":async()=>{const [{createUnicycleModel:routeFallbackFactory}]=await Promise.all([import("./unicycle-model.js")]);return {name:"Unicycle",component:undefined,createHouseModel:name=>name==="Unicycle"?routeFallbackFactory():null};},
"bobbin-and-bobbin-thread":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Bobbin and bobbin thread",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel();model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'hook-assembly'];return model;},part:'hook-assembly'},createHouseModel:name=>null};},
"needle-and-needle-thread":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Needle and needle thread",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({needleLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','needle'];return model;},part:'stitch-formation'},createHouseModel:name=>null};},
"rotary-sewing-hook":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Rotary sewing hook",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({hookLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','hook-assembly','hook'];return model;},part:'stitch-formation',initialState:{phase:.55}},createHouseModel:name=>null};},
"rotary-shuttle":async()=>{const [{createSewingModel:routeFallbackFactory}]=await Promise.all([import("./sewing-model.js")]);return {name:"Rotary shuttle",component:{machine:'Sewing machine',part:'stitch-formation'},createHouseModel:name=>name==="Sewing machine"?routeFallbackFactory():null};},
"thread-take-up-lever":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Thread take-up lever",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({takeUpLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'take-up','take-up-rocker'];return model;},part:'take-up'},createHouseModel:name=>null};},
"feed-dog-lift-and-advance-linkages":async()=>{const [{createSewingModel}]=await Promise.all([import("./sewing-model.js")]);return {name:"Feed-dog lift and advance linkages",component:{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({feedLesson:true,linkageLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'feed-linkages'];return model;},part:'feed-linkages'},createHouseModel:name=>null};},
"consumer-unit":async()=>{const [{createConsumerModel:routeFallbackFactory}]=await Promise.all([import("./consumer-model.js")]);return {name:"Consumer unit",component:undefined,createHouseModel:name=>name==="Consumer unit"?routeFallbackFactory():null};},
"protective-earth-wire":async()=>{const [{createEarthModel:routeFallbackFactory}]=await Promise.all([import("./earth-model.js")]);return {name:"Protective earth wire",component:undefined,createHouseModel:name=>name==="Protective earth wire"?routeFallbackFactory():null};},
"power-socket":async()=>{const [{createSocketModel:routeFallbackFactory}]=await Promise.all([import("./socket-model.js")]);return {name:"Power socket",component:undefined,createHouseModel:name=>name==="Power socket"?routeFallbackFactory():null};},
"cylinder-lock-cam-and-bolt":async()=>{const [{createCylinderModel}]=await Promise.all([import("./cylinder-model.js")]);return {name:"Cylinder-lock cam and bolt",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({camLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'latch-drive',values:{insertion:1}},createHouseModel:name=>null};},
"lock-pin-stacks":async()=>{const [{createCylinderModel}]=await Promise.all([import("./cylinder-model.js")]);return {name:"Lock pin stacks",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({pinLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'pins'},createHouseModel:name=>null};},
"lock-return-springs":async()=>{const [{createCylinderModel}]=await Promise.all([import("./cylinder-model.js")]);return {name:"Lock return springs",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({springLesson:true});model.parts.find(part=>part.id==='plug').framePadding=1.05;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'latch-drive',values:{operation:1,insertion:1,turn:80}},createHouseModel:name=>null};},
"lever-lock-return-springs":async()=>{const [{createLeverModel}]=await Promise.all([import("./lever-model.js")]);return {name:"Lever-lock return springs",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel({springLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'lever-pack',values:{insertion:1,turn:270}},createHouseModel:name=>null};},
"lever-lock-tumblers-and-stumps":async()=>{const [{createLeverModel}]=await Promise.all([import("./lever-model.js")]);return {name:"Lever-lock tumblers and stumps",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel();model.parts.find(part=>part.id==='stump').framePadding=1;model.frameBoundsForPart=id=>id==='stump'?new Box3().setFromObject(model.parts.find(part=>part.id==='lever-pack').object):undefined;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'lever-pack'},createHouseModel:name=>null};},
"lever-lock-bolt-and-bolt-pin":async()=>{const [{createLeverModel}]=await Promise.all([import("./lever-model.js")]);return {name:"Lever-lock bolt and bolt pin",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel({boltLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'bolt',values:{insertion:1,turn:135}},createHouseModel:name=>null};},
"lock-cylinder-plug":async()=>{const [{createCylinderModel}]=await Promise.all([import("./cylinder-model.js")]);return {name:"Lock cylinder (plug)",component:{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel();model.parts.find(part=>part.id==='plug').framePadding=1.05;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'plug',values:{insertion:1}},createHouseModel:name=>null};},
"lever-lock-key":async()=>{const [{createLeverModel}]=await Promise.all([import("./lever-model.js")]);return {name:"Lever-lock key",component:{machine:'Lever lock',createModel:()=>{const model=createLeverModel();model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},part:'key',values:{insertion:1}},createHouseModel:name=>null};},
"zipper-bottom-pin-and-box":async()=>{const [{createZipperModel}]=await Promise.all([import("./zipper-model.js")]);return {name:"Zipper bottom pin and box",component:{machine:'Zipper',createModel:()=>{
  const model=createZipperModel(),connector=model.parts.find(part=>part.id==='bottom-connector').object,bounds=new Box3();
  for(const spread of [0,1]){model.update({...model.defaults,spread});bounds.union(new Box3().setFromObject(connector));}
  model.reset();model.parts.find(part=>part.id==='bottom-connector').framePadding=.6;model.frameBoundsForPart=id=>id==='bottom-connector'?bounds.clone().applyMatrix4(model.root.matrixWorld):undefined;
  model.followParts=model.followParts.filter(id=>id!=='bottom-connector');model.resultPart.focusOnComplete=false;return model;
 },part:'bottom-connector',values:{alignment:1,insertion:0,closure:0}},createHouseModel:name=>null};},
"window-shade-pawls-and-locking-disk":async()=>{const [{createWindowShadeModel}]=await Promise.all([import("./window-shade-model.js")]);return {name:"Window-shade pawls and locking disk",component:{machine:'Window shade',createModel:()=>{const model=createWindowShadeModel();model.resultPart.focusOnComplete=false;return model;},part:'locking'},createHouseModel:name=>null};},
"window-shade-winding-spring":async()=>{const [{createWindowShadeModel}]=await Promise.all([import("./window-shade-model.js")]);return {name:"Window-shade winding spring",component:{machine:'Window shade',createModel:()=>{const model=createWindowShadeModel();model.resultPart.focusOnComplete=false;return model;},part:'spring'},createHouseModel:name=>null};},
"window-shade-roller-shaft-and-fixed-central-rod":async()=>{const [{createWindowShadeModel}]=await Promise.all([import("./window-shade-model.js")]);return {name:"Window-shade roller shaft and fixed central rod",component:{machine:'Window shade',createModel:()=>createWindowShadeModel({rodLesson:true}),part:'shaft'},createHouseModel:name=>null};},
"armature":async()=>{const [{createBellModel}]=await Promise.all([import("./bell-model.js")]);return {name:"Electric-bell armature",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel();model.resultPart.focusOnComplete=false;return model;},part:'armature'},createHouseModel:name=>null};},
"electromagnetic-make-and-break-contacts":async()=>{const [{createBellModel}]=await Promise.all([import("./bell-model.js")]);return {name:"Electromagnetic make-and-break contacts",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel();model.resultPart.focusOnComplete=false;return model;},part:'contacts'},createHouseModel:name=>null};},
"vibrating-horn-diaphragm":async()=>{const [{createHornModel}]=await Promise.all([import("./horn-model.js")]);return {name:"Vibrating horn diaphragm",component:{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'diaphragm'},createHouseModel:name=>null};},
"horn-make-and-break-contacts":async()=>{const [{createHornModel}]=await Promise.all([import("./horn-model.js")]);return {name:"Horn make-and-break contacts",component:{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'contacts'},createHouseModel:name=>null};},
"electric-horn-moving-iron-bar":async()=>{const [{createHornModel}]=await Promise.all([import("./horn-model.js")]);return {name:"Electric-horn moving iron bar",component:{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'moving-bar'},createHouseModel:name=>null};},
"electric-bell-pushbutton-switch":async()=>{const [{createBellModel}]=await Promise.all([import("./bell-model.js")]);return {name:"Electric-bell pushbutton switch",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel({buttonLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'button'},createHouseModel:name=>null};},
"electric-bell-hammer-and-metal-bell":async()=>{const [{createBellModel}]=await Promise.all([import("./bell-model.js")]);return {name:"Electric-bell hammer and metal bell",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel({hammerLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'gong'},createHouseModel:name=>null};},
"electric-bell-return-spring":async()=>{const [{createBellModel}]=await Promise.all([import("./bell-model.js")]);return {name:"Electric-bell return spring",component:{machine:'Electric bell',createModel:()=>{const model=createBellModel({springLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'spring'},createHouseModel:name=>null};},
"heated-extrusion-nozzle":async()=>{const [{createPrinterModel}]=await Promise.all([import("./printer-model.js")]);return {name:"Heated extrusion nozzle",component:{machine:'3D printer',createModel:()=>{const model=createPrinterModel();model.playback.label='Run heated extrusion';return model;},part:'extruder'},createHouseModel:name=>null};},
"printer-filament-reel":async()=>{const [{createPrinterModel}]=await Promise.all([import("./printer-model.js")]);return {name:"Printer filament reel",component:{machine:'3D printer',createModel:()=>createPrinterModel({reelLesson:true}),part:'filament'},createHouseModel:name=>null};},
"layer-by-layer-fabrication":async()=>{const [{createPrinterModel}]=await Promise.all([import("./printer-model.js")]);return {name:"Layer-by-layer fabrication",component:{machine:'3D printer',createModel:()=>createPrinterModel({layerFabrication:true}),initialState:{partiallyPrinted:true},part:'bed'},createHouseModel:name=>null};},
"generator-slip-rings":async()=>{const [{createGeneratorModel:routeFallbackFactory}]=await Promise.all([import("./grid-generator-model.js")]);return {name:"Generator slip rings",component:{machine:'Electric generator',part:'system',values:{output:0}},createHouseModel:name=>name==="Electric generator"?routeFallbackFactory():null};},
"transformer-turns-ratio":async()=>{const [{createTransformerModel}]=await Promise.all([import("./transformer-model.js")]);return {name:"Transformer turns ratio",component:{machine:'Transformer',createModel:()=>createTransformerModel({turnsRatioLesson:true}),part:'system'},createHouseModel:name=>null};},
"spark-gap":async()=>{const [{createSparkGapModel:routeFallbackFactory}]=await Promise.all([import("./spark-gap-model.js")]);return {name:"Spark gap",component:undefined,createHouseModel:name=>name==="Spark gap"?routeFallbackFactory():null};},
"electronic-ignition":async()=>{const [{createElectronicIgnitionModel:routeFallbackFactory}]=await Promise.all([import("./electronic-ignition-model.js")]);return {name:"Electronic ignition",component:undefined,createHouseModel:name=>name==="Electronic ignition"?routeFallbackFactory():null};},
"earthquake-location-by-arrival-times":async()=>{const [{createEarthquakeLocationModel:routeFallbackFactory}]=await Promise.all([import("./earthquake-location-model.js")]);return {name:"Earthquake location by arrival times",component:undefined,createHouseModel:name=>name==="Earthquake location by arrival times"?routeFallbackFactory():null};},
"vertical-seismograph-suspension-spring":async()=>{const [{createVerticalSeismographSpringModel:routeFallbackFactory}]=await Promise.all([import("./vertical-seismograph-spring-model.js")]);return {name:"Vertical-seismograph suspension spring",component:undefined,createHouseModel:name=>name==="Vertical-seismograph suspension spring"?routeFallbackFactory():null};},
"seismograph-recording-pen-and-moving-paper":async()=>{const [{createSeismographRecordingModel:routeFallbackFactory}]=await Promise.all([import("./seismograph-recording-model.js")]);return {name:"Seismograph recording pen and moving paper",component:undefined,createHouseModel:name=>name==="Seismograph recording pen and moving paper"?routeFallbackFactory():null};},
"spark-plug-electrodes-and-ceramic-insulator":async()=>{const [{createSparkPlugModel:routeFallbackFactory}]=await Promise.all([import("./spark-plug-model.js")]);return {name:"Spark-plug electrodes and ceramic insulator",component:undefined,createHouseModel:name=>name==="Spark-plug electrodes and ceramic insulator"?routeFallbackFactory({electrodesLesson:true}):null};},
"inertial-accelerometer-armature-spring-and-coils":async()=>{const [{createInertialAccelerometerModel:routeFallbackFactory}]=await Promise.all([import("./inertial-accelerometer-model.js")]);return {name:"Inertial accelerometer armature, spring, and coils",component:undefined,createHouseModel:name=>name==="Inertial accelerometer armature, spring, and coils"?routeFallbackFactory():null};},
"microchip-deceleration-sensor":async()=>{const [{createCrashSensorModel:routeFallbackFactory}]=await Promise.all([import("./crash-sensor-model.js")]);return {name:"Microchip deceleration sensor",component:{machine:'Crash sensor',part:'chip'},createHouseModel:name=>name==="Crash sensor"?routeFallbackFactory():null};},
"crash-sensor-proof-square-and-sensing-strips":async()=>{const [{createCrashSensorModel}]=await Promise.all([import("./crash-sensor-model.js")]);return {name:"Crash-sensor proof square and sensing strips",component:{machine:'Crash sensor',createModel:()=>createCrashSensorModel({mechanicsLesson:true}),part:'chip'},createHouseModel:name=>null};},
"airbag-warning-indicator":async()=>{const [{createAirbagWarningIndicatorModel:routeFallbackFactory}]=await Promise.all([import("./airbag-warning-indicator-model.js")]);return {name:"Airbag warning indicator",component:undefined,createHouseModel:name=>name==="Airbag warning indicator"?routeFallbackFactory():null};},
"mirrors":async()=>{const [{createMirrorsModel:routeFallbackFactory}]=await Promise.all([import("./mirrors-model.js")]);return {name:"Mirrors",component:undefined,createHouseModel:name=>name==="Mirrors"?routeFallbackFactory():null};},
"lenses":async()=>{const [{createLensesModel:routeFallbackFactory}]=await Promise.all([import("./lenses-model.js")]);return {name:"Lenses",component:undefined,createHouseModel:name=>name==="Lenses"?routeFallbackFactory():null};},
"telescopes":async()=>{const [{createTelescopesModel:routeFallbackFactory}]=await Promise.all([import("./telescopes-model.js")]);return {name:"Telescopes",component:undefined,createHouseModel:name=>name==="Telescopes"?routeFallbackFactory():null};},
"microscopes":async()=>{const [{createMicroscopesModel:routeFallbackFactory}]=await Promise.all([import("./microscopes-model.js")]);return {name:"Microscopes",component:undefined,createHouseModel:name=>name==="Microscopes"?routeFallbackFactory():null};}
};
