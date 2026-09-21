export const crashSensorLesson={
  "simple": "How can a tiny suspended square turn a brief change in motion into an electrical signal? Follow the bending strips and bridge circuit, then distinguish the current signal from a recorded event.",
  "overview": "Microchip deceleration sensor names this same sensing device: a suspended square, four sensing pads and their bridge output. Choose a signed pulse of acceleration applied to the sensor frame. The square moves relative to that frame, bending four thin supports. Small resistive regions on the supports experience opposite strains, and a powered bridge turns their resistance changes into a voltage. A finite filter smooths that voltage before a demonstration comparison records a crossing. The chip view moves with its frame and enlarges its deflection; the charts show actual physical values. The example decision lamp illustrates signal processing, not a real airbag deployment rule. The opening focuses on the chip. Inspect the bridge or either record view for a face-on diagram. Time-stage buttons keep the chosen part in view; readings round small residuals for display without changing the physical state or event decision.",
  "steps": [
    {
      "title": "Accelerate the frame",
      "body": "The frame follows a smooth pulse. A positive signed deceleration setting produces acceleration opposite the chosen forward axis; a negative setting reverses it. The square has inertia, so it cannot instantly follow the frame. Its displacement is measured relative to the frame, separately from the frame’s change of motion."
    },
    {
      "title": "Bend four connected strips",
      "body": "Four strips join the frame to the square. The square moves perpendicular to the chip plane without rotating. Each strip remains attached at both ends and bends with zero end slope. The chip is enlarged, and its deflection receives a further 500-fold enlargement so this very small motion can be inspected."
    },
    {
      "title": "Strain the sensing regions",
      "body": "Bending puts different parts of a strip’s surface into tension and compression. For positive square displacement, the top surface near the frame compresses while the top surface near the square stretches. The four highlighted sensing regions occupy finite lengths of the strips. Their average physical strain determines resistance; the exaggerated drawing does not."
    },
    {
      "title": "Unbalance a powered bridge",
      "body": "R1 and R4 decrease while R2 and R3 increase for positive displacement. These are the same four sensing resistors shown in the equivalent circuit. With 3.3 V across a balanced bridge, both midpoint voltages are 1.65 V, so their difference is zero. Opposite resistance changes move the midpoint voltages apart and produce a signed differential signal."
    },
    {
      "title": "Watch the conditioning delay",
      "body": "The orange dashed record is the output of a two-millisecond low-pass filter driven by the blue raw bridge voltage. It cannot jump instantly to a changing input. A short pulse can therefore give a different filtered peak from a longer pulse with exactly the same acceleration peak."
    },
    {
      "title": "Compare the current signal",
      "body": "The current comparison checks whether the powered filtered voltage is at least +1 mV. This is an arbitrary level selected for the experiment. A real restraint control unit evaluates sensor information using its own vehicle-specific strategy; the experiment does not predict its deployment decision."
    },
    {
      "title": "Retain an earlier crossing",
      "body": "A separate event indicator remembers the first threshold crossing. In the default experiment it records a crossing at about 2.469 ms. At 3 ms the filtered voltage is above the level. At 4 ms it has fallen to about 0.970 mV, so the current comparison is below threshold while the earlier event remains recorded."
    },
    {
      "title": "Inspect recovery and restart",
      "body": "When the pulse ends, frame acceleration returns to zero. The square and the electrical filter continue their finite recovery, and the frame retains its velocity change relative to the original steady motion. Completion preserves the last state and elapsed records. Replay or a control change starts a fresh trial and clears the recorded event."
    }
  ],
  "parts": [
    {
      "name": "Chip frame and mounting",
      "role": "Holds the four outer clamps and provides clearance for the moving square and bending strips. The enlarged inspection follows this frame."
    },
    {
      "name": "Inertial square",
      "role": "A translating proof mass whose relative motion responds to acceleration of its supports."
    },
    {
      "name": "Four bending strips",
      "role": "Provide restoring stiffness and carry the localized strain-sensitive regions. Their distributed mass contributes differently to modal inertia and base forcing."
    },
    {
      "name": "R1 frame-end gauge",
      "role": "Samples the average top-surface strain over the first 50 micrometers of the north strip. It is the upper left bridge arm."
    },
    {
      "name": "R2 square-end gauge",
      "role": "Samples the last 50 micrometers of the east strip. It is the lower left bridge arm."
    },
    {
      "name": "R3 square-end gauge",
      "role": "Samples the last 50 micrometers of the west strip. It is the upper right bridge arm."
    },
    {
      "name": "R4 frame-end gauge",
      "role": "Samples the first 50 micrometers of the south strip. It is the lower right bridge arm."
    },
    {
      "name": "Equivalent circuit",
      "role": "Shows the electrical connections of those same four gauges, with separate left and right midpoint voltages. It does not add four more physical sensing resistors."
    },
    {
      "name": "Bridge supply and switch",
      "role": "Connects or disconnects the bridge excitation. With supply off, mechanics and resistance changes remain while a powered measurement is unavailable."
    },
    {
      "name": "Differential input and 2 ms filter",
      "role": "Reads the unloaded bridge difference and applies the stated finite low-pass response."
    },
    {
      "name": "Demonstration comparison and event memory",
      "role": "Separates the current threshold condition from a crossing retained earlier in the same trial."
    },
    {
      "name": "Actual motion and signal records",
      "role": "Keep fixed physical scales for frame acceleration, square displacement, raw and filtered voltage, and frame displacement change."
    }
  ],
  "deeper": [
    {
      "title": "A chosen physical realization",
      "body": "The square is 1 mm on each side and 40 µm thick. Each of four strips is 1 mm long, 50 µm wide and 5 µm thick. The model uses silicon density 2330 kg/m³ and an illustrative effective Young’s modulus of 160 GPa. Silicon properties depend on crystal direction and fabrication; these values describe the chosen teaching equivalent rather than an identified manufactured crash sensor."
    },
    {
      "title": "One coordinate for four bending strips",
      "body": "Let q be square displacement relative to the frame, and let u run from 0 at a frame clamp to 1 at a square clamp. The physical strip shape is w = q(3u² − 2u³). It has zero displacement and slope at the frame, displacement q at the square, and zero slope there. The square remains rigid and does not rotate. This is a one-mode approximation to thin-beam bending."
    },
    {
      "title": "Beam mass matters in two different ways",
      "body": "The square has mass 93.2 µg and the four strips together have mass 2.33 µg. Their bending shape gives effective modal mass me = mp + (13/35)Mb = 94.065 µg and base-force participation mb = mp + Mb/2 = 94.365 µg. The relative equation is me q″ + c q′ + kq = −mb aFrame. Using the same mass in both places would discard part of the distributed-motion calculation."
    },
    {
      "title": "Stiffness, damping and mechanical work",
      "body": "With strip area moment I = bt³/12, all four strips give k = 48EI/L³ = 4 N/m. The damping coefficient is c = 2ζ√(kme), and the natural frequency is about 1037.851 Hz. Relative modal energy is me(q′)²/2 + kq²/2. Base forcing contributes work at rate −mb aFrame q′, while damping dissipates cq′². This energy balance concerns the relative coordinate, not a vehicle’s complete kinetic energy."
    },
    {
      "title": "Local bending strain is not uniform stretching",
      "body": "On the top surface, strain varies along a strip as ε(u) = 3tq(2u − 1)/L². It changes sign halfway along the span. The frame-end pads cover u from 0 to 0.05; the square-end pads cover 0.95 to 1. Their average strains are ∓0.95 × 3tq/L². This finite average, rather than endpoint strain or magnified geometric curvature, feeds the resistance calculation."
    },
    {
      "title": "Piezoresistance and bridge polarity",
      "body": "The chosen effective gauge factor is 100, with nominal resistance 1000 Ω. A gauge obeys R = R0(1 + GF ε̄). The factor represents an oriented small-strain piezoresistive response; semiconductor resistance change is not explained only by a longer or thinner shape. R1/R4 carry negative average strain for positive q, while R2/R3 carry positive strain. With ideal high-impedance outputs, VL = Vs R2/(R1 + R2), VR = Vs R4/(R3 + R4), and Vbridge = VL − VR."
    },
    {
      "title": "An exact cancellation within the assumed circuit",
      "body": "For these paired linear resistance laws, each bridge branch sums to 2R0. Consequently Vbridge = Vs GF ε̄+ exactly, or 4702.5q volts when powered. The identity is exact for this assumed circuit; the physical material law remains an approximation. With supply On and the square at rest, both midpoints are 1.65 V and total bridge current is 3.3 mA, even though differential voltage is zero. Electrical loading and self-heating are not solved."
    },
    {
      "title": "Work through the bridge at two milliseconds",
      "body": "At the default pulse midpoint, square displacement is about +0.458 µm and square-end mean strain is +6.525 microstrain. R1/R4 are about 999.347 Ω and R2/R3 about 1000.653 Ω. At 3.3 V excitation, the left midpoint is about 1.6511 V and the right 1.6489 V. Their unrounded divider voltages give +2.153 mV differential output. Subtracting the rounded displayed midpoint values loses precision; the bridge calculation retains the unrounded values. Inspect the equivalent bridge to match each physical gauge with its circuit arm."
    },
    {
      "title": "Separate midpoint average from differential output",
      "body": "The midpoint average (VL + VR)/2 remains Vs/2 in this paired ideal bridge: 1.65 V when powered. Halving the pulse halves square motion, pad strain, resistance changes from 1000 Ω and differential output. It does not halve the nominal resistance or midpoint average. Each 2000 Ω branch draws 1.65 mA, giving 3.3 mA total and 10.89 mW ideal bridge power. This is electrical input power, not solved heating. Compare the balanced, half-pulse, reversed and unpowered experiments; without excitation the same resistance changes no longer produce a powered voltage measurement."
    },
    {
      "title": "A pulse has duration as well as peak",
      "body": "For signed setting A and pulse duration T, frame acceleration is −A sin²(πt/T) during the pulse and zero afterward. Its integrated velocity change is −AT/2. The default changes velocity by −0.04 m/s; the 1 ms and 8 ms pulses change it by −0.01 and −0.08 m/s. These are changes from the initial steady motion, not statements about initial car speed or stopping distance. The frame record compares position with the continuation of that original motion."
    },
    {
      "title": "The filter uses the electrical signal",
      "body": "The conditioned voltage z obeys 0.002z′ = Vbridge − z, starting at zero. It receives the signed bridge voltage, not the selected pulse amplitude or a future peak. The 1 ms pulse has filtered peak about 0.450 mV; the 4 ms default reaches 1.207 mV; the 8 ms pulse reaches 1.650 mV. All share the same selected acceleration peak of 20 m/s²."
    },
    {
      "title": "Rebound does not imply a positive filtered event",
      "body": "For the lightly damped 1 ms pulse, the square overshoots and rebounds. Its raw bridge voltage changes sign with that motion. Reversing this input mirrors the mechanics, including a later positive raw rebound. Nevertheless, the chosen two-millisecond filter keeps the reversed pulse’s conditioned output nonpositive throughout. It therefore never crosses the positive demonstration level. This is a property of these offered pulses, damping values and filter, not a universal rule for crash sensors."
    },
    {
      "title": "The current comparison and its history answer different questions",
      "body": "The current comparison asks whether z is at least +1 mV now. The retained event asks whether that condition has occurred at any earlier time in the current observation. A falling signal can make the first answer no while the second remains yes. At the default pulse end, the filter reads about 0.970 mV and the recorded first crossing remains 2.469 ms. Only restarting the trial clears that memory."
    },
    {
      "title": "What the approximation leaves out",
      "body": "The offered responses stay within about 0.605 µm of relative displacement and 8.614 microstrain of average gauge strain. The estimated omitted axial-stiffening force is at most about 1.053% of the linear restoring force in this domain. That estimate applies to one omitted term; it is not an accuracy specification for a device. Higher bending modes, residual stress, gravity loading, thermal drift, noise, detailed electrical power and nonlinear material calibration remain outside the model."
    }
  ],
  "misconception": "A large acceleration peak alone does not determine a real airbag deployment, and a recorded event does not mean the signal is still above its comparison level. A balanced powered zero and an unavailable unpowered measurement are also different states.",
  "limits": "An illustrative horizontal-axis piezoresistive sensor with a rigid square and four identical clamped-guided strips. Dimensions, effective material constants, damping, 3.3 V excitation, two-millisecond filter and +1 mV demonstration level are selected teaching values. The cubic bending shape and distributed-mass reduction form a single-coordinate linear approximation. Finite sensing-pad averages determine resistance. The chip’s ordinary dimensions are enlarged, with an additional 500-fold enlargement of deflection; readings and charts use actual physical quantities. The frame record gives changes relative to the initial uniform motion, not a reconstructed car trajectory. Gravity loading in the chip plane, higher modes, shear, residual stress, anisotropic elasticity, geometric stiffening, lead and gauge mass/stiffness, stops, fabrication tolerances, noise, thermal effects, electrical loading and electromechanical back-action are omitted. The bridge and conditioning block are ideal, and the displayed event memory implements only the stated comparison. Supply off starts a fresh unpowered trial with continuing mechanics; it is not a sensor-fault diagnosis. No inflator, occupant model, vehicle-specific crash classification, dashboard self-test or real deployment decision is simulated. Twenty-five physical milliseconds play over twelve display seconds. Control edits and replay start fresh trials; completion retains finite state and elapsed history. Numerical readings use display precision rather than a sensor resolution claim; a rounded zero can retain a finite smaller state. The comparison and first-crossing search use unrounded values.",
  "sources": [
    {
      "title": "Layton and Adams: piezoresistive sensing, gauge placement and bridge analysis",
      "url": "https://peer.asee.org/on-teaching-the-operating-principles-of-piezoresistive-sensors.pdf"
    },
    {
      "title": "Analog Devices: resistive bridge equations and excitation",
      "url": "https://www.analog.com/en/resources/technical-articles/resistive-bridge-basics-part-one--maxim-integrated.html"
    },
    {
      "title": "PCB Piezotronics: piezoresistive MEMS elements and conditioning",
      "url": "https://www.pcb.com/vibration-quickreferenceguide"
    },
    {
      "title": "Bosch: sensor information and the airbag control unit",
      "url": "https://www.bosch-mobility.com/en/solutions/control-units/airbag-control-unit/"
    },
    {
      "title": "NHTSA: airbag operation and deployment factors",
      "url": "https://www.nhtsa.gov/vehicle-safety/air-bags"
    }
  ],
  "quiz": {
    "question": "At 4 ms the default conditioned signal is below 1 mV, but the event indicator remains on. What does it tell you?",
    "options": [
      "The signal crossed the level earlier in this trial, and that event is retained.",
      "The current signal must still be above the level.",
      "The model has established that a real vehicle would deploy an airbag."
    ],
    "answer": 0,
    "explanation": "The current comparison follows the present voltage. Event memory retains the earlier crossing at about 2.469 ms until the experiment restarts. Neither display is a real vehicle deployment prediction."
  },
  "tryIt": [
    {
      "title": "Follow the complete sensor chain",
      "instruction": "Inspect the midpoint, late pulse, pulse end and final record. Choose Inspect the equivalent bridge to watch the current and retained-event indicators, or Inspect the signal record to compare their cause.",
      "observe": "At 2 ms the filtered signal is about 0.685 mV and no event has occurred. At 3 ms it is about 1.195 mV and an event is recorded. At the 4 ms pulse end it has fallen below the level to about 0.970 mV, while the first crossing at 2.469 ms remains recorded.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      },
      "view": "iso"
    },
    {
      "title": "Power a balanced stationary sensor",
      "instruction": "Inspect the equivalent bridge and the final record.",
      "observe": "The square and strips remain at rest. Every gauge stays at 1000 Ω. Both bridge midpoints are 1.65 V, the supply still delivers 3.3 mA, and their differential voltage is zero. The valid conditioned zero produces no event.",
      "reset": true,
      "part": "bridge",
      "isolate": true,
      "values": {
        "deceleration": 0,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Halve the signed pulse",
      "instruction": "Compare the signal record with the complete-chain experiment.",
      "observe": "Square motion, strain, raw differential voltage and conditioned voltage halve in this linear model. The conditioned peak is about 0.603 mV, so no event is recorded. The pulse changes frame velocity by −0.02 m/s, half the default change.",
      "reset": true,
      "part": "signal-record",
      "isolate": true,
      "values": {
        "deceleration": 10,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Shorten the pulse",
      "instruction": "Inspect the midpoint, pulse end and recovery, then choose Inspect early signal (0–5 ms) to spread out the short response.",
      "observe": "The acceleration peak is still 20 m/s², but lasts in a shorter pulse. The filtered signal peaks near 0.450 mV and never reaches the example level. At the 1 ms pulse end the square remains about 0.227 µm ahead of its frame while the filter reads about 0.430 mV.",
      "reset": true,
      "part": "signal-record",
      "isolate": true,
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.001,
        "damping": 0.7,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Lengthen the pulse",
      "instruction": "Observe the full pulse and compare its retained voltage record.",
      "observe": "The filtered peak rises to about 1.650 mV and records a first crossing near 3.575 ms. At the 8 ms pulse end the filtered signal is back below the level, about 0.863 mV, while the earlier event remains. Frame velocity has changed by −0.08 m/s.",
      "reset": true,
      "part": "signal-record",
      "isolate": true,
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.008,
        "damping": 0.7,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Reduce damping on the short pulse",
      "instruction": "Inspect bending during playback, then use Inspect early signal (0–5 ms) to compare the two voltage traces.",
      "observe": "The square reaches about +0.597 µm near 0.710 ms and rebounds to about −0.234 µm near 1.267 ms. The raw voltage follows this reversal. The slower conditioned signal reaches only about 0.565 mV, so ringing does not produce an event here.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.001,
        "damping": 0.25,
        "supply": 1
      },
      "view": "iso"
    },
    {
      "title": "Critically damp the short pulse",
      "instruction": "Compare the displacement record with the lightly damped short pulse.",
      "observe": "The mechanical recovery has no oscillatory homogeneous mode. At pulse end the square is still about +0.230 µm from its frame. The conditioned signal peaks near 0.408 mV and no event is recorded. Critical damping does not make the response instantaneous.",
      "reset": true,
      "part": "displacement-record",
      "isolate": true,
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.001,
        "damping": 1,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Reverse the signed pulse",
      "instruction": "Compare the signed motion and electrical records with the default.",
      "observe": "The square motion, gauge strains, raw differential voltage and conditioned voltage reverse. The conditioned signal reaches about −1.207 mV and stays nonpositive throughout this selected response. It never crosses the positive +1 mV level, so no event is recorded.",
      "reset": true,
      "part": "signal-record",
      "isolate": true,
      "values": {
        "deceleration": -20,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Inspect reverse rebound",
      "instruction": "Inspect the pulse end, advance one step to 1.25 ms, then choose Inspect early signal (0–5 ms). Compare the positive raw rebound with the negative filtered signal.",
      "observe": "The square initially moves backward relative to its frame and later rebounds forward, giving a positive raw-voltage excursion. The conditioned output still remains nonpositive. Its minimum is about −0.565 mV, and the positive demonstration level is never reached.",
      "reset": true,
      "part": "signal-record",
      "isolate": true,
      "values": {
        "deceleration": -20,
        "pulseDuration": 0.001,
        "damping": 0.25,
        "supply": 1
      },
      "view": "front"
    },
    {
      "title": "Remove electrical supply",
      "instruction": "Inspect the strips, gauge resistances and signal panel.",
      "observe": "The square and strips follow the same physical motion as the powered default, and their resistances still change. Bridge voltage and current are zero, while the conditioned measurement and decision are marked unavailable. An unpowered zero is not evidence that the frame had no acceleration.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 0
      },
      "view": "iso"
    }
  ]
};
