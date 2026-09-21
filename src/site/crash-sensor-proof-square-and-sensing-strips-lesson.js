import { crashSensorLesson } from './crash-sensor-lesson.js';

export const crashSensorProofSquareAndSensingStripsLesson = {
  limits: crashSensorLesson.limits,
  sources: crashSensorLesson.sources,
  "simple": "Why can a square attached on four sides move relative to its frame? Follow its inertia, the bending strips and the forces that restore it after an acceleration pulse.",
  "overview": "These are the proof square and sensing strips inside the Microchip deceleration sensor. The same apparatus is used in the Crash sensor example. Here the question is mechanical: how can flexible attachments support a square and still let it move? Apply a pulse to the frame, inspect the connected strips in the angled chip view, and compare displacement, velocity, strain, force and energy. The electrical bridge can be inspected as context, but restoring stiffness comes from the bending supports in this model. The inspection follows the frame and exaggerates deflection; every numerical reading uses physical motion.",
  "related": [
    "Microchip deceleration sensor"
  ],
  "steps": [
    {
      "title": "Separate square motion from frame motion",
      "body": "The pulse accelerates the frame. The square has inertia and develops motion relative to that frame. Square relative displacement measures their separation from the centered position; it does not give the square’s absolute position. Inertia does not hold the square absolutely still, and a zero pulse does not establish that a car’s absolute speed is zero."
    },
    {
      "title": "Keep all four attachments connected",
      "body": "The square remains joined to the frame by four thin strips. Each strip can bend while staying attached at both ends. The square translates perpendicular to the chip plane without rotating in this chosen approximation. Begin with the complete chip so the square, strips and outer clamps are visible together."
    },
    {
      "title": "Inspect the curved supports",
      "body": "Choose Inspect flexure bending. The strips meet both clamps with zero slope even while their inner ends follow the displaced square. Bending between those ends accommodates the motion. Chip dimensions are enlarged and deflection receives a further 500-fold enlargement; use the displacement reading for the actual submicrometer movement."
    },
    {
      "title": "Find opposite strains along a strip",
      "body": "For positive relative displacement, the top surface near a frame clamp compresses while the top surface near the square stretches. Strain changes sign along each strip. The R1/R4 pads sample frame-end regions and R2/R3 sample square-end regions. Their displayed mean strains use finite physical sensing regions, not the exaggerated curvature or a uniform strain assigned to an entire strip."
    },
    {
      "title": "Read the forces as a changing sum",
      "body": "Restoring force points toward the centered position, while damping force opposes relative velocity. Base forcing represents the imposed frame acceleration in the reduced relative equation. Their sum need not be zero during motion. At the default midpoint the square is displaced forward and still moving forward relative to the frame, but the net relative force is already negative and slowing that motion."
    },
    {
      "title": "End the pulse without erasing the state",
      "body": "Inspect pulse end. Frame acceleration is now zero, but the square can still have displacement and velocity. The bent strips exert restoring force, and damping opposes the remaining motion. A short pulse can end while the square is already moving back toward the frame. The frame also retains its velocity change relative to its original steady motion."
    },
    {
      "title": "Follow storage, return and dissipation",
      "body": "Motion stores kinetic energy and bending stores elastic energy. As the square returns and rebounds, energy can move between those forms. After the pulse, damping removes relative mechanical energy; it does not create it. Read Relative mechanical energy, Base forcing work and Damping loss together. Reversing motion preserves quadratic energy even though displacement and force signs reverse."
    },
    {
      "title": "Compare complete trials",
      "body": "Halve the pulse to halve motion and quarter relative energy, change damping to compare recovery, or remove supply to retain the same mechanics without electrical excitation. Every control edit, preset and replay starts a fresh trial. Completion retains the finite state and its past record so recovery can be inspected before restarting."
    }
  ],
  "parts": [
    {
      "name": "Chip frame and mounting",
      "role": "Carries the prescribed acceleration and holds the four outer clamps. The scene moves with this frame; its recorded position change is relative to the continuation of its initial uniform motion."
    },
    {
      "name": "Inertial square",
      "role": "The central proof mass translates relative to the frame. In this model it stays rigid and does not rotate, while the flexible supports provide the restoring connection."
    },
    {
      "name": "Four bending strips",
      "role": "Join the frame to the square. Their bending stores elastic energy, and their distributed motion contributes to the reduced inertia and base-forcing terms."
    },
    {
      "name": "R1 frame-end gauge",
      "role": "North-strip pad near the outer clamp. It samples negative mean top-surface strain when the square has positive relative displacement."
    },
    {
      "name": "R2 square-end gauge",
      "role": "East-strip pad near the square. It samples the positive mean top-surface strain of that end for positive displacement."
    },
    {
      "name": "R3 square-end gauge",
      "role": "West-strip pad near the square. Its strain sign matches R2 because both use their local frame-to-square position along the strip."
    },
    {
      "name": "R4 frame-end gauge",
      "role": "South-strip pad near the frame. Its mean top-surface strain has the same sign as R1, not an opposite sign merely because it is on the other side of the square."
    },
    {
      "name": "Frame acceleration record",
      "role": "Shows the imposed pulse on a fixed physical scale. Zero acceleration after the pulse does not mean that relative displacement, velocity or stored energy vanished."
    },
    {
      "name": "Square displacement record",
      "role": "Shows the square’s actual signed motion relative to its frame. A fixed ±0.75 µm scale allows overshoot and rebound to be compared without changing the vertical magnification."
    },
    {
      "name": "Frame displacement change record",
      "role": "Compares the frame’s position with where continued initial uniform motion would have taken it. This is separate from the square’s displacement within the chip."
    },
    {
      "name": "Equivalent circuit",
      "role": "Uses resistance changes in the attached strain-sensitive pads to produce a powered voltage. It is context for the mechanical experiment and does not supply the modeled support stiffness."
    },
    {
      "name": "Differential input and 2 ms filter",
      "role": "Processes the electrical output after the mechanics and strain conversion. Its delayed voltage and the demonstration event indicator are not measures of the square’s current velocity or mechanical energy."
    }
  ],
  "deeper": [
    {
      "title": "Choose a coordinate that follows the frame",
      "body": "Let X be frame position and x square position along the sensitive direction. Relative displacement is q = x − X, so square acceleration is x″ = aFrame + q″. Starting with q = q′ = 0 means an unstrained square sharing the frame’s velocity. It does not specify that common absolute velocity. The model’s sensitive normal is horizontal; gravity loading in the chip plane and changes in mounting orientation are outside this example."
    },
    {
      "title": "A strip bends while its end slopes stay fixed",
      "body": "For distance u from 0 at a frame clamp to 1 at a square clamp, the physical shape is w = qH(u), with H(u) = 3u² − 2u³. H(0) = 0, H(1) = 1 and both end slopes are zero. Thus one end stays at the frame while the other follows the translating square, with bending between them. All four strips use this local direction. The cubic shape is a one-coordinate beam approximation, not an exact continuum vibration mode or a native fabrication specification."
    },
    {
      "title": "Local strain follows curvature",
      "body": "For strip thickness t and length L, top-surface strain is ε(u) = 3tq(2u − 1)/L². Positive q gives compression near the frame and tension near the square, with zero top strain at u = 0.5; bottom-surface signs reverse. Each 50 µm pad on a 1 mm strip covers either u = 0 to 0.05 or 0.95 to 1. Averaging gives opposite means of magnitude 0.95 × 3t|q|/L². Physical strain follows physical q, never the extra 500-fold drawn deflection."
    },
    {
      "title": "Four strips provide restoring stiffness",
      "body": "The chosen strip dimensions are L = 1 mm, b = 50 µm and t = 5 µm, with effective silicon modulus E = 160 GPa. The second moment of area is I = bt³/12. Integrating the squared curvature of the cubic shape gives elastic energy 24EIq²/L³ for all four strips. Writing this as kq²/2 gives k = 48EI/L³ = 4 N/m. Restoring force is −kq. These are selected linear bending properties; crystal direction, fabrication and nonlinear corrections are not calibrated here."
    },
    {
      "title": "Why two different mass coefficients appear",
      "body": "The 1 mm square is 40 µm thick and has mass mp = 93.2 µg; the four strips together have mass Mb = 2.33 µg at density 2330 kg/m³. Integrals of the assumed shape are ∫H du = 1/2 and ∫H² du = 13/35. Squared relative strip velocity therefore gives modal mass me = mp + (13/35)Mb = 94.065 µg, while the mixed frame/relative-motion term gives base participation mb = mp + Mb/2 = 94.365 µg. Using one mass for both would discard part of this distributed-motion approximation."
    },
    {
      "title": "Force balance is dynamic",
      "body": "The reduced equation is me q″ = −mb aFrame − cq′ − kq, with c = 2ζ√(kme). Its natural frequency is about 1037.851 Hz. The displayed Base forcing, Damping force and Restoring force are these generalized terms; their sum governs relative acceleration with me, not the bare proof mass alone. A negative sum can slow positive velocity while displacement remains positive. Damping represents modal loss rather than a separately drawn manufactured dashpot."
    },
    {
      "title": "Work through the default midpoint",
      "body": "At 2 ms, relative displacement is about +0.458 µm and velocity +0.125 mm/s. Base forcing is +1.887 µN, restoring force −1.832 µN and damping force −0.107 µN. Their sum is about −0.052 µN, so forward relative motion is already slowing. Opposite mean pad strains are about ±6.525 microstrain, and relative mechanical energy is 0.420 pJ. Position, velocity and acceleration answer different questions about this one state."
    },
    {
      "title": "A spring can return energy while damping removes it",
      "body": "Relative modal energy is Em = me(q′)²/2 + kq²/2. Its rate is Em′ = −mb aFrame q′ − c(q′)². The first term is base work in the relative coordinate; the second is nonnegative dissipative loss with a minus sign. While q and q′ have opposite signs, restoring force can do positive work as bending energy returns to motion. After the pulse, aFrame = 0 and Em cannot increase. Its instantaneous loss rate is zero at a turning point where q′ = 0. This is not the total kinetic energy of a car or occupant."
    },
    {
      "title": "Half motion gives quarter energy",
      "body": "With the same duration, damping and zero initial relative state, halving signed pulse amplitude halves q, q′, local strain and all signed force terms. Both kinetic and elastic energy are quadratic, so relative energy becomes one quarter. Cumulative base work and damping loss also become one quarter under the scaled history. At the default midpoint, half amplitude gives 0.105 pJ instead of 0.420 pJ. Reversing amplitude instead preserves these energies and losses while reversing motion and force signs."
    },
    {
      "title": "Pulse duration changes the whole history",
      "body": "The imposed acceleration is −A sin²(πt/T) during the pulse and zero afterward. Its integrated frame velocity change is −AT/2. A 20 m/s² setting gives changes of −0.01, −0.02, −0.04 and −0.08 m/s for 1, 2, 4 and 8 ms pulses. These are changes from initial steady motion. The square’s pulse-end energy depends on the resulting mechanical history; a longer pulse is not universally more or less energetic at its end."
    },
    {
      "title": "Read short recovery on the displacement chart",
      "body": "Choose Inspect displacement record (0–5 ms). This focuses the mechanical curve while retaining the early time window and fixed ±0.75 µm scale. Choose Inspect displacement record (0–25 ms) to restore the full record. Stage buttons retain the chosen window; a fresh trial restores all 25 ms. These selections change the view, not the measured state. After completion, an early view retains its past curve without pretending that the current 25 ms state occurs at the 5 ms edge."
    },
    {
      "title": "Know what the bending approximation omits",
      "body": "The offered responses stay below about 0.605 µm displacement and 8.614 microstrain of finite-pad mean strain. The maximum physical strip slope is below about 0.000907. The leading omitted axial-stiffening force is estimated at no more than about 1.053% of the linear restoring force here. That estimates one omitted term, not overall device accuracy. Higher modes, shear, residual stress, square deformation and rotation, detailed anisotropy, stops, thermal drift and electrical back-action remain outside this teaching model."
    }
  ],
  "misconception": "Zero frame acceleration does not require zero square displacement or velocity. A pulse can end while bent strips and a moving square still exchange stored energy. The strips also have different local strains along their surfaces, rather than uniformly stretching or compressing as whole pieces.",
  "quiz": {
    "question": "At the end of the 1 ms pulse, frame acceleration is zero, but the square is displaced forward and moving back toward the frame. Why?",
    "options": [
      "The square and bent strips retain motion and stored energy; restoring and damping forces continue their recovery.",
      "Zero frame acceleration means the displacement and velocity readings must already be zero.",
      "The square must have detached from all four supports.",
      "Inertia keeps the square absolutely stationary, so its relative velocity cannot change."
    ],
    "answer": 0,
    "explanation": "At this pulse end q is about +0.227 µm and relative velocity −1.107 mm/s. Restoring force points toward zero displacement, and damping opposes the negative velocity. Those forces continue to change the state after base forcing ends. The four strips remain attached."
  },
  "tryIt": [
    {
      "title": "Follow inertia and restoring forces",
      "instruction": "Inspect the pulse midpoint, then Inspect flexure bending. Read displacement, velocity, Relative force sum and Relative acceleration. Inspect pulse end to follow the return.",
      "observe": "At 2 ms, displacement is +0.458 µm and velocity +0.125 mm/s, but the force sum is about −0.052 µN. The square is moving forward relative to its frame while slowing. At pulse end, displacement is still +0.014 µm while velocity has reversed to −0.125 mm/s.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "view": "iso",
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      }
    },
    {
      "title": "Keep the frame in steady motion",
      "instruction": "Inspect the chip at the midpoint and final record. Compare relative displacement, pad strain, forces and relative mechanical energy.",
      "observe": "From the unstrained initial state, zero imposed acceleration leaves the square centered relative to its frame. Relative velocity, strain, restoring force, damping loss and relative mechanical energy stay zero. The shared absolute speed of the square and frame is not specified.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "view": "iso",
      "values": {
        "deceleration": 0,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      }
    },
    {
      "title": "Halve displacement, quarter the energy",
      "instruction": "Inspect the pulse midpoint and compare with Follow inertia and restoring forces at the same time. Read relative energy, base work and damping loss as well as motion.",
      "observe": "Displacement, velocity, strain and signed forces halve. Relative mechanical energy is about 0.105 pJ instead of 0.420 pJ. Both cumulative base work and damping loss also become one quarter because they follow the scaled mechanical history.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "view": "iso",
      "values": {
        "deceleration": 10,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      }
    },
    {
      "title": "End the pulse with relative motion",
      "instruction": "Inspect pulse end (1 ms), then early and later recovery. Compare the signs of relative displacement, velocity, restoring force and damping force.",
      "observe": "Frame acceleration is zero at 1 ms, yet displacement is +0.227 µm and velocity −1.107 mm/s. Restoring force is about −0.907 µN while damping force is +0.950 µN. Relative energy is still 0.160 pJ. The square is already returning, and its recovery continues.",
      "reset": true,
      "part": "displacement-record",
      "isolate": true,
      "view": "front",
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.001,
        "damping": 0.7,
        "supply": 1
      }
    },
    {
      "title": "Compare a two-millisecond pulse",
      "instruction": "Inspect midpoint (1 ms), pulse end (2 ms) and recovery. Choose Inspect displacement record (0–5 ms). Compare with Watch lightly damped rebound: amplitude and damping match, only pulse duration changes.",
      "observe": "At 1 ms, displacement is about +0.525 µm. At pulse end it is −0.042 µm, velocity is −0.266 mm/s and relative energy is 0.007 pJ. The final frame velocity change is −0.02 m/s, twice the one-millisecond pulse. Pulse duration changes the recovery history; longer pulses do not universally leave more energy.",
      "reset": true,
      "part": "displacement-record",
      "isolate": true,
      "view": "front",
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.002,
        "damping": 0.25,
        "supply": 1
      }
    },
    {
      "title": "Watch lightly damped rebound",
      "instruction": "Watch the angled bending view during playback. At the final record, choose Inspect displacement record (0–5 ms).",
      "observe": "The square reaches about +0.597 µm near 0.710 ms and then −0.234 µm near 1.267 ms. Local strain signs reverse with displacement. After the 1 ms pulse, elastic and kinetic energy can exchange during rebound while their sum loses energy through damping.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "view": "iso",
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.001,
        "damping": 0.25,
        "supply": 1
      }
    },
    {
      "title": "Compare critical restoration",
      "instruction": "Inspect pulse end and recovery. For the close mechanical curve, choose Inspect displacement record (0–5 ms).",
      "observe": "The mechanical homogeneous recovery has no oscillatory mode. At pulse end, displacement remains about +0.230 µm and velocity −0.760 mm/s, with 0.133 pJ relative energy. Critical damping does not make the response instantaneous.",
      "reset": true,
      "part": "displacement-record",
      "isolate": true,
      "view": "front",
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.001,
        "damping": 1,
        "supply": 1
      }
    },
    {
      "title": "Reverse motion, preserve energy",
      "instruction": "Inspect midpoint and pulse end. Compare the signed mechanical readings and relative energy with the positive default at the same times.",
      "observe": "Displacement, velocity, strain and signed force terms reverse. At 2 ms relative energy remains 0.420 pJ. At pulse end the square is at −0.014 µm and moving at +0.125 mm/s, with the same 0.001 pJ energy as the positive trial. Cumulative damping loss is unchanged.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "view": "iso",
      "values": {
        "deceleration": -20,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 1
      }
    },
    {
      "title": "Follow reversed rebound",
      "instruction": "Inspect start, then advance five steps to 1.25 ms. Inspect the chip and its strain readings. For the short motion history, choose Inspect displacement record (0–5 ms).",
      "observe": "The square first moves backward relative to its frame, then rebounds forward. At 1.25 ms displacement is positive again, so the frame-end top pads compress and the square-end pads stretch. Its mechanical energy matches the positive lightly damped trial at the same time, even though the signs of motion are reversed.",
      "reset": true,
      "part": "displacement-record",
      "isolate": true,
      "view": "front",
      "values": {
        "deceleration": -20,
        "pulseDuration": 0.001,
        "damping": 0.25,
        "supply": 1
      }
    },
    {
      "title": "Remove power, retain mechanical recovery",
      "instruction": "Inspect the midpoint, pulse end and recovery. Compare all mechanical readings with the powered default, then inspect the bridge supply and conditioned measurement.",
      "observe": "Relative displacement, velocity, strain, restoring/damping/base forces, energy, work and loss match the powered trial. The bending strips still provide restoring stiffness without electrical excitation. The raw voltage and current are zero, and the conditioned measurement is unavailable; this model omits electrical back-action.",
      "reset": true,
      "part": "chip",
      "isolate": true,
      "view": "iso",
      "values": {
        "deceleration": 20,
        "pulseDuration": 0.004,
        "damping": 0.7,
        "supply": 0
      }
    }
  ]
};
