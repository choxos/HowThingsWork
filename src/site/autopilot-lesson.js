export const autopilotLesson={
  "simple": "How does an autopilot turn measured heading and height errors into corrective control-surface motion? Follow two feedback loops, then see why holding a heading does not hold a ground path.",
  "overview": "The book introduces an autopilot on page 293. This model separates attitude/heading sensing from pressure-based height sensing: a gyro does not directly measure altitude. Choose an initial departure from north and from a selected height. Ideal sensors report the changing flight state. The controller asks for corrective bank and pitch, finite servos move the ailerons and elevator, and the resulting motion changes the measurements that return to the controller. The enlarged aircraft moves with its own reference frame; a separate ground record shows its actual east and north travel in meters. A steady crosswind can move that path sideways even when heading and height are held correctly. The opening focuses on the aircraft. Use Next observation stage to pause at 0.15, 1, 3, 10, 20 and 30 seconds; another press returns to the start. Inspect either feedback loop, the ground track or the response records without restarting the trial.",
  "steps": [
    {
      "title": "Measure heading and height separately",
      "body": "The heading and attitude channels supply heading, bank, pitch relative to trim, and the rates of those attitude angles. The air-data channel supplies relative height from a calibrated pressure measurement. A gyroscope does not directly measure altitude. In this experiment the channels are ideal, so their readings equal the corresponding aircraft states."
    },
    {
      "title": "Compare with the chosen targets",
      "body": "The fixed targets are north heading and zero height departure. A positive heading error means the nose points east of north; a positive height error means the aircraft is above its selected height. Zero relative height refers to the selected airborne trim altitude, not the ground. Changing a control prepares a fresh trial from the selected initial departures."
    },
    {
      "title": "Ask for bank and pitch corrections",
      "body": "The heading loop requests bank toward north. The height loop requests pitch toward the selected height. Each inner loop also accounts for current attitude and its rate, reducing the correction as the aircraft responds. These are separate heading and height controllers; neither reads east or north position."
    },
    {
      "title": "Move the actual surfaces",
      "body": "A surface command is a requested angle, not an instantaneous movement. Each ideal position servo compares that request with its measured shaft angle. The resulting position error changes the shaft angle over time. The paired ailerons turn oppositely at their hinges; the elevator turns on its own shaft. At the start the surfaces are neutral even though the default commands are already nonzero."
    },
    {
      "title": "Change attitude before heading and height",
      "body": "The ailerons produce roll response, which changes bank and then heading. The elevator produces pitch response. Flight-path angle follows pitch with a further lag, so nose pitch and climb or descent angle need not match. The response is computed from the feedback equations throughout the observation."
    },
    {
      "title": "Use feedback to reduce the continuing error",
      "body": "The changed heading, height, attitude and rates return to the controller. At three seconds in the default trial, the aircraft is still banked left and turning toward north, but the aileron has already reversed direction to roll the aircraft back toward level. Reversed surface motion can be part of a correct approach to the target."
    },
    {
      "title": "Compare heading with the ground path",
      "body": "Heading describes where the aircraft points. Ground track describes the direction of its motion over the ground. A steady eastward wind adds eastward ground velocity without creating a heading error in this model. The ground record therefore need not return to the original northbound line when the heading loop succeeds."
    },
    {
      "title": "Inspect the remaining response",
      "body": "The observation ends at thirty physical seconds, played over fifteen display seconds. The default heading error and height error have become small but are not exactly zero, and the aircraft is still descending slowly. Completion pauses the observation; it does not force the aircraft to stop or snap onto its targets."
    }
  ],
  "parts": [
    {
      "name": "Aircraft and control surfaces",
      "role": "Show integrated bank and pitch, opposite aileron deflections, and the elevator motion that drive the two modeled responses."
    },
    {
      "name": "Calibrated sensors",
      "role": "Supply ideal measured heading, bank, pitch and attitude-angle rates, plus a separate pressure-height channel. A gyro does not directly measure altitude."
    },
    {
      "name": "Control computer",
      "role": "Compares the measured states with fixed targets and calculates corrective bank, pitch and surface commands."
    },
    {
      "name": "Right aileron servo and encoder",
      "role": "Uses local position feedback to turn a command into finite shaft motion. The matched left servo moves its aileron oppositely."
    },
    {
      "name": "Elevator servo and encoder",
      "role": "Turns the common elevator torque tube using measured actual surface position."
    },
    {
      "name": "Retained response records",
      "role": "Compare measured errors and commanded versus actual surface angles on fixed time and value scales."
    },
    {
      "name": "Ground track and original north line",
      "role": "Shows actual east and north travel on equal meter scales, separately from the enlarged aircraft inspection."
    }
  ],
  "deeper": [
    {
      "title": "The controller uses measured states",
      "body": "Let ψ be heading error, h relative height, φ bank and θ pitch relative to trim. With automatic correction on, the desired bank is φc = −ψ and desired pitch is θc = −0.002h radians. The height gain is 0.002 rad/m. The surface commands are δac = φc −φ −0.8p and δec = θc −θ −0.8q, where p = φ′ and q = θ′. The rate-feedback gain has units of seconds. These chosen gains are illustrative, not settings for an actual aircraft."
    },
    {
      "title": "Position feedback makes the actuator finite",
      "body": "The actual equivalent aileron angle δa obeys δa′ = (δac −δa)/0.15, and the elevator obeys the same law with δe. The 0.15-second time constant represents a reduced position servo. Its command-minus-position difference drives movement. A motor torque, current or power model is not included; the visible direct rotary shafts illustrate the mechanical connection."
    },
    {
      "title": "Attitude and flight-path response are distinct",
      "body": "The reduced roll response is φ′ = p and p′ = 4δa −2p. The pitch response is θ′ = q and q′ = 4δe −2q. Flight-path angle γ follows γ′ = (θ −γ)/2. Coefficients 4 and 2 have units s⁻² and s⁻¹, and the flight-path time constant is two seconds. The rate variables are derivatives of displayed attitude angles, not exact body-axis gyro rates in a full three-dimensional rotation model."
    },
    {
      "title": "Pitch minus path is a perturbation",
      "body": "Here θ is measured relative to an unspecified level-flight trim attitude. The difference θ −γ is therefore a change of angle of attack from trim, not the wing’s absolute angle of attack. The flight-path lag is a teaching approximation. It does not calculate a lift curve, stall boundary or identified airframe mode."
    },
    {
      "title": "Bank changes heading in a near-level turn",
      "body": "The model uses ψ′ = (g/V)tanφ with g = 9.80665 m/s² and fixed air-relative speed V = 50 m/s. This is the coordinated, near-level turn relation. Applying it during the small simultaneous climbs and descents is part of the decoupled approximation. Real bank changes vertical lift and can require coordinated rudder and power adjustments, which are outside this model."
    },
    {
      "title": "Ground velocity includes the wind",
      "body": "With constant eastward wind W, east velocity is E′ = Vcosγ sinψ + W, north velocity is N′ = Vcosγ cosψ, and vertical velocity is h′ = Vsinγ. Ground track is atan2(E′,N′). Wind adds exactly Wt to east displacement while leaving these modeled heading and height loops unchanged. The ground chart uses the same distance scale in both directions."
    },
    {
      "title": "Correct heading does not recover a route",
      "body": "Starting ten degrees east of north with correction on, the aircraft accumulates east displacement while turning. Correcting the nose direction does not remove that earlier displacement. With zero initial errors and a wind toward the east at 5 m/s, heading remains north while ground track is about 5.711° east of north and the aircraft moves 150 m east in thirty seconds. Route capture would require a separate calculation using position or track information."
    },
    {
      "title": "Automatic correction off has a precise meaning",
      "body": "Every off trial starts afresh with neutral surface commands and neutral actual surfaces. Sensing continues. Initial heading and height departures persist while forward flight continues. This setting does not simulate switching off a real servo clutch during a maneuver, a pilot taking over, or holding an earlier surface command."
    },
    {
      "title": "A bounded teaching aircraft",
      "body": "Only the offered initial departures and steady winds are included. Within them the computed bank stays below about 7.92°, pitch perturbation below 2.11°, actual aileron below 6.58°, and actual elevator below 1.51°. Commands and actual surfaces have separate records. These are responses of the chosen equations, not certified limits or measured aircraft performance. No unmodeled hard stop is used to force the response inside the charts."
    },
    {
      "title": "Small residuals remain at completion",
      "body": "For the default trial, the final heading error is about +0.0017°, height departure is +0.11 m, and vertical speed is −0.03 m/s. East displacement remains about +44.22 m. The local control equations are stable near trim, but thirty seconds is a finite observation, not an exact settling time. Smaller initial departures give close to, but not exactly, half the response because the kinematics retain their sine, cosine and tangent terms."
    }
  ],
  "misconception": "Holding a heading does not necessarily hold a ground track or recover a previous route. Also, an opposite aileron deflection can reduce an existing bank before the heading error has disappeared.",
  "limits": "An illustrative two-loop aircraft model near level trim, with selected gains and time constants rather than an identified airframe. Ideal calibrated attitude/heading and air-data channels equal the corresponding simulated states; local servo encoders are ideal. Height is a departure from a selected airborne altitude in a fixed atmosphere. The aircraft inspection is enlarged and co-moving; the ground chart separately records actual meter-scale travel. Aileron and elevator angles are actual integrated angles. Pitch and angle of attack are perturbations about unspecified trim, and angle-rate states omit full Euler coupling. Fixed air-relative speed is 50 m/s. Fixed airspeed assumes adequate omitted trim and power support; pitch control does not supply climb energy. The model omits bank-induced vertical coupling, yaw, slip, adverse yaw, rudder coordination dynamics, lift/drag/thrust and speed evolution, structural flexibility, sensor errors, actuator torque/current/power, clutch behavior and saturation outside the offered domain. Wind is steady uniform advection, not a gust or a disturbance-rejection test. There is no navigation estimator, ground-route controller or hazard model. Every control change starts a fresh trial. Thirty physical seconds play over fifteen display seconds, retaining finite residuals and only elapsed history.",
  "sources": [
    {
      "title": "FAA: automated flight control, heading mode and altitude hold",
      "url": "https://www.faasafety.gov/files/events/EA/EA03/2019/EA0392003/aah_ch04.pdf"
    },
    {
      "title": "FAA: autopilot sensors, servos and position feedback",
      "url": "https://www.faa.gov/sites/faa.gov/files/2022-06/amt_airframe_hb_vol_2.pdf"
    },
    {
      "title": "FAA: ailerons, elevator and flight-control effects",
      "url": "https://www.faa.gov/sites/faa.gov/files/08_phak_ch6.pdf"
    },
    {
      "title": "FAA: pressure instruments and altitude measurement",
      "url": "https://www.faa.gov/sites/faa.gov/files/10_phak_ch8.pdf"
    }
  ],
  "quiz": {
    "question": "The aircraft points north and holds its selected height, but its ground path moves east. Has heading hold necessarily failed?",
    "options": [
      "No. A crosswind can add eastward ground velocity while heading and height remain correct.",
      "Yes. Heading and ground track are always identical.",
      "Yes. A height sensor must also correct eastward displacement."
    ],
    "answer": 0,
    "explanation": "The heading loop controls nose direction. A route controller would need position or track information and a different target calculation to oppose sideways drift."
  },
  "tryIt": [
    {
      "title": "Correct heading and height together",
      "instruction": "Use Next observation stage to visit the servo response at 0.15 s, early correction at 1 s, and later responses at 3, 10, 20 and 30 s. Inspect response records to compare requested and actual motion.",
      "observe": "Commands initially request −10° aileron and −2.29° elevator while actual surfaces are neutral. At 1 s bank is about −4.97° and heading remains +9.60°. At 30 s heading error is +0.0017° and height departure is +0.11 m; east displacement remains +44.22 m.",
      "reset": true,
      "part": "aircraft",
      "isolate": true,
      "values": {
        "headingError": 10,
        "heightError": 20,
        "crosswind": 0,
        "feedback": 1
      },
      "view": "iso"
    },
    {
      "title": "Reverse both departures",
      "instruction": "Start west of north and below the selected height. Use Next observation stage to compare the same times as the default.",
      "observe": "Corrective surfaces and attitude responses reverse sign. At 30 s heading error is −0.0017°, height departure is −0.11 m and east displacement is −44.22 m. North travel matches the default trial.",
      "reset": true,
      "part": "aircraft",
      "isolate": true,
      "values": {
        "headingError": -10,
        "heightError": -20,
        "crosswind": 0,
        "feedback": 1
      },
      "view": "iso"
    },
    {
      "title": "Correct heading alone",
      "instruction": "Begin ten degrees east of north with no height departure. Use Next observation stage to reach 3 s, then compare the ailerons and bank.",
      "observe": "The ailerons and bank respond while the elevator, pitch, flight-path angle and height stay zero. At 3 s the actual aileron is +0.53° although bank is still −7.77°. The reversed aileron rolls the aircraft back toward level while it is still turning left. East displacement ends near +44.23 m.",
      "reset": true,
      "part": "aircraft",
      "isolate": true,
      "values": {
        "headingError": 10,
        "heightError": 0,
        "crosswind": 0,
        "feedback": 1
      },
      "view": "iso"
    },
    {
      "title": "Correct height alone",
      "instruction": "Begin twenty meters above the target while pointing north. Use Next observation stage to reach 10 s, then inspect the height loop.",
      "observe": "Heading, bank and ailerons stay zero. At 10 s height departure is about +8.44 m, pitch is −1.17° and flight-path angle is −1.47°. The aircraft is still descending at about −1.28 m/s; pitch and path do not match.",
      "reset": true,
      "part": "aircraft",
      "isolate": true,
      "values": {
        "headingError": 0,
        "heightError": 20,
        "crosswind": 0,
        "feedback": 1
      },
      "view": "iso"
    },
    {
      "title": "Begin on both targets",
      "instruction": "Begin on both targets in calm air. Play to completion, then inspect the ground track.",
      "observe": "Errors, commands and surfaces remain zero, yet the aircraft advances 1500 m north in thirty seconds. Zero correction does not mean zero motion.",
      "reset": true,
      "part": "aircraft",
      "isolate": true,
      "values": {
        "headingError": 0,
        "heightError": 0,
        "crosswind": 0,
        "feedback": 1
      },
      "view": "iso"
    },
    {
      "title": "Remove automatic correction",
      "instruction": "Prepare a fresh trial with automatic correction off. Play while watching the ground track and live measurements.",
      "observe": "Commands and surfaces remain neutral. The measured heading departure remains +10° and height departure +20 m. After thirty seconds the aircraft is about 260.47 m east and 1477.21 m north of its starting point.",
      "reset": true,
      "part": "ground-track",
      "isolate": true,
      "values": {
        "headingError": 10,
        "heightError": 20,
        "crosswind": 0,
        "feedback": 0
      },
      "view": "front"
    },
    {
      "title": "Hold north in an eastward wind",
      "instruction": "Start on both targets with a steady eastward wind of 5 m/s. Play while watching the ground track.",
      "observe": "Heading and height errors remain zero, but ground track is +5.71° east of north. After thirty seconds the aircraft is 150 m east and 1500 m north. No route error is fed into the heading controller.",
      "reset": true,
      "part": "ground-track",
      "isolate": true,
      "values": {
        "headingError": 0,
        "heightError": 0,
        "crosswind": 5,
        "feedback": 1
      },
      "view": "front"
    },
    {
      "title": "Reverse the wind",
      "instruction": "Keep both initial errors at zero and use a steady westward wind. Play and compare the sideways track with the eastward-wind trial.",
      "observe": "Heading and height remain correct. Ground track is −5.71° and east displacement reaches −150 m. The controller does not invent a bank correction for a route it has not been asked to hold.",
      "reset": true,
      "part": "ground-track",
      "isolate": true,
      "values": {
        "headingError": 0,
        "heightError": 0,
        "crosswind": -5,
        "feedback": 1
      },
      "view": "front"
    },
    {
      "title": "Correct both errors while wind carries the path",
      "instruction": "Repeat the default correction with a steady eastward wind. Play to completion; compare errors and ground path with the calm trial.",
      "observe": "The heading, height, attitude and surface histories match the calm default. East displacement gains 5t meters and ends near +194.22 m. North travel is unchanged.",
      "reset": true,
      "part": "ground-track",
      "isolate": true,
      "values": {
        "headingError": 10,
        "heightError": 20,
        "crosswind": 5,
        "feedback": 1
      },
      "view": "front"
    },
    {
      "title": "Start with smaller departures",
      "instruction": "Start five degrees east of north and ten meters above target. Compare initial commands, then play to compare final residuals with the default.",
      "observe": "Initial commands halve to −5° aileron and −1.15° elevator. At thirty seconds heading error is about +0.00087°, height departure +0.05 m and east displacement +22.21 m. The whole nonlinear trajectory is not exactly half the default.",
      "reset": true,
      "part": "aircraft",
      "isolate": true,
      "values": {
        "headingError": 5,
        "heightError": 10,
        "crosswind": 0,
        "feedback": 1
      },
      "view": "iso"
    }
  ]
};
