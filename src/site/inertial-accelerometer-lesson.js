export const inertialAccelerometerLesson={
  "simple": "How does a spring-mounted armature turn acceleration into an electrical reading? Follow its motion through three coils and a detector, then compare the indicated acceleration with the actual motion.",
  "overview": "The housing carries an E-shaped iron core and three fixed coils. A spring holds a U-shaped armature around them. When the housing accelerates, the armature initially lags behind, then the spring pulls it along. Its changing relative position changes the magnetic coupling to the two outer coils. This teaching variant uses a straight guide instead of the book’s flat-spring support. Their opposed voltages feed a detector that extracts a signed indication. This experiment keeps the mechanical response and electrical filtering visible: neither follows a sudden acceleration change instantly. The enlarged instrument view moves with the housing; a separate meter scale shows the housing's actual position.",
  "steps": [
    {
      "title": "Start with a centered armature",
      "body": "The housing and armature begin at rest, with the spring at its reference length. Guides constrain the armature to one horizontal direction. Gravity acts across that direction and is supported by the guides. The detail view uses millimeters for internal movement; the housing position strip uses meters."
    },
    {
      "title": "Accelerate the housing",
      "body": "The core, fixed coils and spring anchor move with the housing. The armature initially resists that change of motion. Its relative displacement is its position minus the housing position, so positive housing acceleration initially produces negative displacement. The spring and damping then pull the armature toward the motion of its housing."
    },
    {
      "title": "Change the two magnetic paths",
      "body": "The moving U armature narrows one lateral gap while widening the other. Moving it toward the positive direction strengthens the left pickup's coupling and weakens the right pickup's coupling in this illustrative model. The middle coil supplies alternating excitation; the outer coils sense the unequal coupling."
    },
    {
      "title": "Subtract the pickup voltages",
      "body": "The two outer windings are connected in opposition. Their common part cancels, leaving the voltage difference. A centered, stationary armature has zero difference even though each pickup carries an alternating voltage. The receiving inputs draw no current in this ideal high-impedance measurement."
    },
    {
      "title": "Recover a signed reading",
      "body": "The detector multiplies the difference voltage by a synchronized phase reference and filters the result. Dividing by the known excitation amplitude gives a displacement indication. A static spring calibration converts that indication into acceleration. The phase comparison preserves direction; an unsigned voltage magnitude alone would lose it."
    },
    {
      "title": "Inspect the delay",
      "body": "The armature takes time to move, and the detector takes time to respond to the coil signal. Use the short-pulse experiment: during the following coast the actual acceleration is already zero, but the indicated reading remains positive. The response record preserves that mismatch instead of replacing the measured result with the known input."
    },
    {
      "title": "Reverse acceleration and let the response settle",
      "body": "An equal opposite pulse removes the housing's acquired velocity. It also drives the armature and detector toward the opposite sign. When that pulse ends, the housing stays at its new position while the internal response settles. The observation ends at six physical seconds; it does not force the remaining motion or indication to zero."
    }
  ],
  "parts": [
    {
      "name": "Housing and guides",
      "role": "Carry the fixed core and constrain the moving armature to the modeled horizontal direction."
    },
    {
      "name": "U-shaped armature",
      "role": "Provides the inertial mass and changes the two magnetic couplings as its position changes relative to the housing."
    },
    {
      "name": "Restoring spring",
      "role": "Connects the moving armature to the housing and supplies the restoring force. Damping opposes relative velocity."
    },
    {
      "name": "E core and primary coil",
      "role": "Provide the connected magnetic structure and its alternating excitation."
    },
    {
      "name": "Opposed pickup coils",
      "role": "Produce two position-dependent voltages whose difference carries the measurement signal."
    },
    {
      "name": "Phase-sensitive detector",
      "role": "Uses the synchronized reference and a finite filter to turn the alternating difference into a signed indication."
    },
    {
      "name": "Motion and signal records",
      "role": "Compare actual housing motion, the delayed acceleration indication and the recent electrical waveforms on labeled scales."
    }
  ],
  "tryIt": [
    {
      "title": "Follow acceleration through the pickup",
      "instruction": "Use the default positive first pulse and inspect the early response, the first-pulse response, coasting and the reversed pulse.",
      "observe": "At 0.1 s the armature is about 0.955 mm behind its housing, but the indicated acceleration is only +0.585 m/s². At 0.75 s the indication is close to +1 m/s². The opposite pulse reverses the reading. The housing finishes 2 m away with zero velocity.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 1,
        "damping": 0.75,
        "excitation": 1
      }
    },
    {
      "title": "Reverse the applied acceleration",
      "instruction": "Begin with −1 m/s² for the first pulse. Inspect the same stages as the default experiment.",
      "observe": "Relative motion, the difference signal and the indicated acceleration reverse sign. At 0.75 s the armature is about 1 mm ahead of its housing and the indication is about −1 m/s². The housing finishes 2 m in the negative direction.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": -1,
        "pulseDuration": 1,
        "damping": 0.75,
        "excitation": 1
      }
    },
    {
      "title": "Excite a centered stationary armature",
      "instruction": "Set the first-pulse acceleration to zero while keeping full excitation. Inspect the AC signal window during the observation.",
      "observe": "The armature stays centered and stationary. Each pickup has an alternating voltage with about 6.28 mV peak amplitude, but the opposed outputs cancel. Differential voltage and indicated acceleration remain zero. The powered carrier is visible even without a maneuver.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 0,
        "pulseDuration": 1,
        "damping": 0.75,
        "excitation": 1
      }
    },
    {
      "title": "Double the inertial input",
      "instruction": "Use +2 m/s² with the default pulse duration, damping and excitation.",
      "observe": "At 0.75 s the relative displacement is about −2 mm and the indicated acceleration is about +2 m/s². In this chosen model, doubling acceleration doubles relative motion and differential response. The housing reaches +4 m, on the same fixed position scale.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 2,
        "pulseDuration": 1,
        "damping": 0.75,
        "excitation": 1
      }
    },
    {
      "title": "Use pulses too brief for the detector to follow",
      "instruction": "Use 0.1-second pulses. Inspect the first-pulse response at 0.075 s, then coasting at 0.15 s.",
      "observe": "At 0.075 s actual acceleration is +1 m/s², but the indication is only about +0.381 m/s². At 0.15 s actual acceleration is zero while the indication remains about +0.681 m/s². The armature is still about 0.482 mm behind the housing and is returning toward the center. The housing ultimately moves +0.02 m.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 0.1,
        "damping": 0.75,
        "excitation": 1
      }
    },
    {
      "title": "Reduce mechanical damping",
      "instruction": "Use a nominal damping ratio of 0.25. Inspect the early first pulse and the retained displacement record.",
      "observe": "At 0.1 s the armature has moved about 1.44 mm behind the housing, beyond the later displacement of roughly 1 mm. Its oscillatory settling reveals overshoot. The detector smooths and delays that response; its early indication is about +0.889 m/s².",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 1,
        "damping": 0.25,
        "excitation": 1
      }
    },
    {
      "title": "Inspect nominal critical damping",
      "instruction": "Set the nominal damping ratio to 1 and inspect the early first pulse.",
      "observe": "At 0.1 s the relative displacement is about −0.824 mm and the indication is about +0.500 m/s². The setting refers to critical damping of the unexcited mechanical coefficients. The small alternating magnetic load and electrical filter remain, including their residual ripple.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 1,
        "damping": 1,
        "excitation": 1
      }
    },
    {
      "title": "Add heavier damping",
      "instruction": "Use a nominal damping ratio of 1.25 and compare the early response with the default.",
      "observe": "At 0.1 s the armature has moved only about 0.726 mm behind the housing and the indication is about +0.438 m/s². Heavier damping slows the initial response. By 0.75 s the reading is close to +1 m/s², but the early record retains the difference.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 1,
        "damping": 1.25,
        "excitation": 1
      }
    },
    {
      "title": "Halve the excitation",
      "instruction": "Use half the 10 mA peak excitation and inspect the first-pulse response at 0.75 s. Compare the AC scope and normalized reading with the default.",
      "observe": "At that instant the difference voltage is about +0.314 mV, versus +0.629 mV at full excitation. Both normalized indications round to +1 m/s². The indication-error card reveals the difference: about +0.00114 versus +0.00151 m/s². The raw signal nearly halves; the small remaining difference includes the change in magnetic loading.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 1,
        "damping": 0.75,
        "excitation": 0.5
      }
    },
    {
      "title": "Remove excitation while retaining mechanical forcing",
      "instruction": "Set excitation to zero and inspect the first-pulse response at 0.75 s.",
      "observe": "The armature still moves about 1 mm behind the housing. Current and pickup voltages are zero, and the acceleration indication is unavailable. The mechanical record and actual acceleration remain visible. Zero output voltage here does not establish zero acceleration.",
      "reset": true,
      "part": "system",
      "view": "iso",
      "isolate": false,
      "values": {
        "acceleration": 1,
        "pulseDuration": 1,
        "damping": 0.75,
        "excitation": 0
      }
    }
  ],
  "deeper": [
    {
      "title": "Relative motion follows Newton's law",
      "body": "Let q be armature position minus housing position and let a be housing acceleration. The equation is m q″ = −c q′ −kq −ma + Fmag. Here m is 0.01 kg, k is 10 N/m, and c = 2ζ√(mk). At the initial centered, stationary state, positive housing acceleration makes q″ negative. The armature does not remain permanently fixed in space; the spring and damping change its motion."
    },
    {
      "title": "Static calibration has a limited meaning",
      "body": "If acceleration varies slowly and the small magnetic force is ignored, spring balance gives q ≈ −ma/k. This model therefore uses −kqind/m to calibrate indicated acceleration. It does not undo the mechanical dynamics or filter delay. The nominal mechanical natural frequency is about 5.03 Hz, while the detector has a 0.05-second time constant. Faster changes expose both limits."
    },
    {
      "title": "Induced voltage includes two effects",
      "body": "For a pickup with mutual inductance M(q), the terminal voltage is d[M(q)i]/dt = M i′ + M′q′i under the declared polarity convention. The first term remains when a displaced armature stops moving because the excitation current still alternates. The second term comes from armature motion. At the center, a moving armature can therefore produce a difference signal; geometric centering alone is not an electrical null."
    },
    {
      "title": "The coupling law is illustrative",
      "body": "With q in meters, the model uses Lp = 0.02 + 100q² H, M+ = 0.002 + 0.1q H and M− = 0.002 − 0.1q H. Each secondary self-inductance is 0.01 H, and the modeled secondary-to-secondary mutual inductance is zero. These reciprocal coefficients define a positive-energy lumped circuit. They are selected teaching values, not measurements or a field calculation derived from the displayed iron shape."
    },
    {
      "title": "Excitation also acts on the mass",
      "body": "The primary current is i = 0.01e sin(2π50t) amperes. Its position-dependent inductance produces Fmag = 100qi² newtons. This small force reinforces displacement and reduces the spring's instantaneous restoring stiffness by at most 0.1%. It depends on current squared, so reversing the carrier does not reverse the magnetic force. The calculation retains this interaction."
    },
    {
      "title": "Filtering preserves lag and ripple",
      "body": "The difference voltage is vdiff = 0.2(qi′ + q′i). A detector state z obeys 0.05z′ = 2vdiff cos(2π50t) − z. For nonzero excitation, qind = z/[0.2I(2π50)], where I = 0.01e is peak current. The denominator uses peak current, not instantaneous current; ordinary current zero crossings do not interrupt the measurement. The finite filter leaves a small 100 Hz ripple as well as delay."
    },
    {
      "title": "Changing excitation changes more than signal strength",
      "body": "Half excitation approximately halves the pickup difference, while normalization keeps the indicated acceleration close to the full-excitation reading. The results are not exactly identical because the magnetic force changes with current squared. With excitation removed, this ideal model has no remanent field or other source of induced voltage. The spring-mass still responds to housing acceleration, but its electrical acceleration indication is unavailable."
    },
    {
      "title": "Where the energy goes",
      "body": "The ideal current source can deliver energy to the magnetic field and receive energy back. Magnetic force exchanges energy with the armature, and damping dissipates mechanical energy. For relative mechanical plus magnetic energy, E = ½m q′² + ½kq² + ½Lp i² and E′ = i vp −cq′² −ma q′. The last term is work in the moving reference frame, not the total power of a motor moving the housing. Zero modeled winding resistance and open secondary inputs mean no winding heating or secondary output power is calculated."
    },
    {
      "title": "Internal motion and housing travel use different scales",
      "body": "The two acceleration pulses begin at zero and twice the selected pulse width T. Each lasts T seconds. Starting from rest, the housing finishes at 2AT² meters with zero velocity. Its millimeter-scale armature response is shown separately in an enlarged view. The signal records use actual elapsed time and retain only observed history. A short electrical window reveals the real 50 Hz waveform instead of depicting it as an arbitrarily slow oscillation."
    },
    {
      "title": "This component supplies a measurement, not a position",
      "body": "An accelerometer's output is one input to an inertial navigation calculation. Position also requires time, orientation, gravity and starting information. This lesson isolates the armature, spring, coils and detector. The separate Inertial guidance lesson explains what a computer can calculate from calibrated channels."
    }
  ],
  "misconception": "The pickup is not a velocity-only generator, and its indicated acceleration is not an instantaneous copy of the housing acceleration. A displaced stationary armature can produce an AC signal; a moving armature can produce one while crossing the center. Without excitation, zero voltage means the measurement is unavailable.",
  "limits": "A horizontal, guided translating teaching variant of the book’s spring-supported U-armature and E-coil pickup. The guide replaces the native flat support’s curved motion; the displayed dimensions, spring shape, mass, stiffness, damping, inductances, 50 Hz excitation and detector parameters are illustrative. The housing starts at rest and follows prescribed acceleration steps; the source imposes an ideal sinusoidal current. Gravity is supported perpendicular to the sensitive axis. The reciprocal lumped inductance law includes magnetic force and motion-induced voltage but is not derived from the displayed core geometry. The primary has zero modeled resistance; ideal high-impedance secondary inputs draw zero current. Material saturation, hysteresis, eddy losses, driver losses, detector loading and power consumption, mechanical friction beyond the declared viscous damping, noise, manufacturing tolerances and actual calibration procedures are omitted. Indicated acceleration uses a static spring calibration of a finite, causal detector, so dynamic lag and carrier ripple remain. The detailed instrument view is enlarged and moves with the housing; its millimeter displacement record is separate from the fixed meter-scale housing strip. The response plot compares actual and indicated acceleration on one fixed scale; the recent electrical scope uses a separate 40 ms window and separately labeled vertical scales. Six physical seconds play over twelve display seconds. Every control change starts a fresh trial. Completion retains the final response without forcing exact rest. No aircraft, gyro, navigation estimate, vertical measurement or autopilot control is simulated.",
  "sources": [
    {
      "title": "Sperry Rand: E-transformer accelerometer and U-shaped armature",
      "url": "https://patents.google.com/patent/US3190128A/en"
    },
    {
      "title": "U.S. Navy NEETS Module 15: E transformers and accelerometers",
      "url": "https://www.maritime.org/doc/neets/mod15.pdf"
    },
    {
      "title": "Analog Devices: phase-sensitive detection and output filtering",
      "url": "https://www.analog.com/en/resources/analog-dialogue/articles/low-power-synchronous-demodulator.html"
    },
    {
      "title": "MIT: magnetic energy, reciprocity and mechanical force",
      "url": "https://web.mit.edu/6.013_book/www/chapter11/11.7.html"
    }
  ],
  "quiz": {
    "question": "During the short-pulse experiment, actual acceleration is zero but the indicated reading remains positive. What explains this?",
    "options": [
      "The armature and detector still retain a response to the earlier acceleration.",
      "Zero acceleration always means the housing has stopped.",
      "The computer replaces the measured signal with the actual acceleration."
    ],
    "answer": 0,
    "explanation": "The spring-mass response and the finite detector filter take time to change. During the coast, the housing can also retain nonzero velocity despite zero acceleration."
  }
};
