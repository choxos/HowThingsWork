import {
  centripetalForce,
  crankStroke,
  discInertia,
  frictionForce,
  frictionHeat,
  helixAngle,
  gearTrain,
  inclinedPlane,
  leverArms,
  aerodynamicForce,
  angularSize,
  apertureLight,
  ATMOSPHERE,
  boyleVolume,
  depthOfField,
  dotPitch,
  exposureTime,
  halftoneTint,
  buoyantForce,
  carnotEfficiency,
  chainGrowth,
  coolingLimit,
  wingDrag,
  hydraulicPress,
  massEnergy,
  pistonArea,
  LIGHT_SPEED,
  precessionRate,
  pulley,
  rodObliquity,
  rotationalEnergy,
  screw,
  slipAngle,
  slopeAngle,
  springEnergy,
  springForce,
  noteName,
  pipeFrequency,
  quarterWave,
  semitonesFrom,
  SOUND_SPEED,
  stopsBetween,
  stringFrequency,
  submergedFraction,
  thinLens,
  OPTICAL_ELEMENTS,
  FOCAL_RANGE,
  threadLead,
  wavelength,
  wheelAndAxle,
  wingLift,
  aliasFrequency,
  binaryString,
  colorCount,
  dividerVoltage,
  driftSpeed,
  electricalPower,
  electronsPerSecond,
  forceOnWire,
  frameBytes,
  inducedEmfPeak,
  lineLoss,
  lookaheadDelay,
  maxUnsigned,
  motorTorque,
  nyquistRate,
  ohmsCurrent,
  parallelResistance,
  powerRatio,
  quantizationLevels,
  quantizationSnr,
  rippleCarryDelay,
  sineRms,
  rotationalLatency,
  rtdResistance,
  sampleBitrate,
  seebeckVoltage,
  shannonCapacity,
  solenoidField,
  thermistorResistance,
  trackCapacity,
  transferRate,
  transferSeconds,
  transformerAmps,
  transformerVolts,
  videoBitrate,
  type LeverClass,
} from './physics.ts';
import type {Reading, TopicId} from './topics.ts';

export type Variant = {id: string; label: string; hint: string};

/**
 * A further slider beside the main one. Most benches have a second quantity
 * worth moving, and a machine with one control can only ever be a line through
 * whatever it does; two make it a surface.
 */
export type ExtraSpec = {
  id: string;
  label: (variant: string) => string;
  min: number;
  max: number;
  step: number;
  initial: number;
  format: (value: number, variant: string) => string;
};

export type ControlSpec = {
  /** Slider caption, which for levers depends on the class in play. */
  label: (variant: string) => string;
  min: number;
  max: number;
  step: number;
  initial: number;
  /** The value shown beside the slider caption. */
  format: (value: number, variant: string) => string;
  variants?: {label: string; options: Variant[]; initial: string};
  extras?: ExtraSpec[];
};

/** What every extra slider starts at, which is what a bench sees before one moves. */
export const startingExtras = (spec: ControlSpec): Record<string, number> =>
  Object.fromEntries((spec.extras ?? []).map(extra => [extra.id, extra.initial]));

/** The reference wheel the gear bench is geared against. */
export const DRIVER_TEETH = 12;

/** Cycles of carrier drawn across the telecommunications window, at each end of its slider. */
const FEWEST_CYCLES = 4;
const MOST_CYCLES = 12;

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
const times = (ratio: number) => `${ratio.toFixed(ratio < 10 ? 2 : 1)}×`;

/** The lens on the optical bench, in millimeters, and the same one the bench draws. */
const FOCAL_LENGTH = OPTICAL_ELEMENTS.converging.focal;

/** The standard series of f numbers, each one a stop from the last. */
const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
/** The lens and the subject the photography readouts describe. */
const CAMERA_LENS = 50;
const SUBJECT = 2000;

/** The screen angles a four color job is laid at, in degrees. */
const SCREEN_ANGLES = 'cyan 15\u00b0, magenta 75\u00b0, yellow 0\u00b0, black 45\u00b0';
/** Reading distance for the eye, in millimeters, and what it can separate. */
const READING_DISTANCE = 300;
const EYE_LIMIT = 1;

/** The string on the sound bench: 65.4 N on 0.8 g of wire per meter. */
const TENSION = 65.4;
const LINEAR_DENSITY = 0.0008;

/** Distances in meters, shown in whatever unit suits their size. */
const metric = (meters: number) =>
  meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : meters >= 1
      ? `${meters.toFixed(meters < 10 ? 2 : 1)} m`
      : meters >= 0.01
        ? `${(meters * 100).toFixed(1)} cm`
        : `${(meters * 1000).toFixed(1)} mm`;

const formatFrequency = (hertz: number) =>
  hertz >= 1e9
    ? `${(hertz / 1e9).toFixed(2)} GHz`
    : hertz >= 1e6
      ? `${(hertz / 1e6).toFixed(1)} MHz`
      : `${(hertz / 1e3).toFixed(0)} kHz`;

/** Which band a carrier falls in, and what that means for how it travels. */
export function radioBand(hertz: number): {name: string; travel: string; note: string} {
  if (hertz < 3e5)
    return {
      name: 'Long wave',
      travel: 'Ground wave',
      note: 'it can follow the ground beyond the horizon; range also depends on power, the ground and interference',
    };
  if (hertz < 3e6)
    return {
      name: 'Medium wave',
      travel: 'Ground, and sky by night',
      note: 'the lower ionosphere absorbs less after dark, allowing more radio waves to reach higher layers and return to Earth',
    };
  if (hertz < 3e7)
    return {name: 'Short wave', travel: 'Sky wave', note: 'it bounces between the ionosphere and the ground, and can go right round the world'};
  if (hertz < 3e8)
    return {name: 'VHF', travel: 'Line of sight', note: 'it mainly travels along clear paths; tall antennas extend coverage, while obstacles and terrain can block it'};
  if (hertz < 3e9)
    return {name: 'UHF', travel: 'Line of sight', note: 'short enough for a small antenna, which is what makes a phone possible'};
  return {name: 'Microwave', travel: 'Line of sight', note: 'tight enough to aim at a dish, and it will pass through the atmosphere to a satellite'};
}

/** The wrench arm the screw bench is turned by, and the thread it cuts, in millimeters. */
const WRENCH_RADIUS = 120;
const THREAD_RADIUS = 20;
/** Roughly the thread angle greased steel can hold against, in degrees. */
const SELF_LOCKING_ANGLE = 8;

/** The wheel on the rotating bench: 600 g, 120 mm radius, with a 50 g bolt at the rim. */
const RIM_BOLT = 0.05;
/** Gravity acting 60 mm out from the gyroscope's single pivot. */
const GYRO_TORQUE = 0.6 * 9.81 * 0.06;

/** Fresh water, in kilograms per cubic meter. */
const FRESH_WATER = 1000;

/** The wing the flying bench reports on: an airliner's, roughly. */
const WING_AREA = 120;
const WING_SLENDERNESS = 9;
const AIR = 1.225;
const CLEAN_STALL = 15;
const FLAPPED_STALL = 12;
const FLAP_LIFT = 0.8;

/** The press: a 20 mm piston pushed with 100 N through a 50 mm stroke. */
const SMALL_BORE = 20;
const HAND_FORCE = 100;
const INPUT_STROKE = 50;
/** The column of air a pneumatic version has to squeeze first, in millimeters. */
const GAS_COLUMN = 60;

/** The cold side of the heat bench: an ordinary room. */
const AMBIENT = 290;

/** How far the control rods move the multiplication factor, end to end. */
const K_OPEN = 1.02;
const K_SHUT = 0.94;
const GENERATIONS = 50;
/** Mass converted to energy when a kilogram of fuel is split, in kilograms. */
const MASS_CONVERTED = 0.00096;

/** The load resting on the spring bench, in newtons, and the block on the friction bench. */
const SPRING_LOAD = 300;
const BLOCK_WEIGHT = 981;

/** The supply on the circuit bench, in volts, and the wire it runs in. */
export const SUPPLY_VOLTS = 12;
export const WIRE_AREA_MM2 = 1.5;

/** The coil on the magnetism bench: 400 turns over 200 mm, and what iron does to it. */
export const COIL_TURNS = 400;
export const COIL_LENGTH_M = 0.2;
export const IRON_PERMEABILITY = 600;
/** The test wire the field is measured by, in meters, carrying one amp. */
export const TEST_WIRE_M = 0.1;

/** The motor: 50 turns of 40 by 60 mm in a quarter tesla gap, wound to 1.5 ohms. */
export const MOTOR_TURNS = 50;
export const MOTOR_FIELD = 0.25;
export const MOTOR_AREA_M2 = 0.04 * 0.06;
export const MOTOR_SIDE_M = 0.06;
export const MOTOR_OHMS = 1.5;
export const MOTOR_RPM = 3000;

/** The generator: 80 square centimeters in a 0.35 T gap, turning fifty times a second. */
export const GEN_FIELD = 0.35;
export const GEN_AREA_M2 = 0.008;
export const GEN_RATE_HZ = 50;
/** The transformer: 1,000 primary turns on 230 volts, feeding a 5 ohm line at 1 amp. */
export const PRIMARY_TURNS = 1000;
export const PRIMARY_VOLTS = 230;
export const PRIMARY_AMPS = 1;
export const LINE_OHMS = 5;

/** The sensor bench: a 10 k thermistor, a type K thermocouple, and a Pt100. */
export const THERMISTOR_OHMS = 10000;
export const THERMISTOR_BETA = 3950;
export const SEEBECK_UV = 41;
export const COLD_JUNCTION_C = 20;
export const RTD_OHMS = 100;
export const RTD_ALPHA = 0.00385;
export const SENSOR_SUPPLY = 5;
/** The fixed half of the divider, matched to each sensor near the middle of its range. */
export const FIXED_HALF = {thermistor: 10000, platinum: 120};

/** The tone arriving at the converter, in hertz, and what a minute of it costs. */
export const TONE_HZ = 12000;
export const AUDIO_CHANNELS = 2;

/** The drive: a 30 mm band of tracks over four surfaces, 63 sectors of 512 bytes each. */
export const BAND_MM = 30;
export const SECTORS = 63;
export const SECTOR_BYTES = 512;
export const SURFACES = 4;

/** One gate delay, in seconds. A nanosecond is generous for silicon and easy to read. */
export const GATE_DELAY = 1e-9;

/** A photograph to send, in bytes, and the frame rate the picture bench streams at. */
export const PHOTO_BYTES = 3e6;
export const FRAME_RATE = 30;
export const STREAM_BITS = 8e6;

/** Bytes shown in whatever unit keeps the number readable. */
const bytes = (count: number) =>
  count >= 1e12
    ? `${(count / 1e12).toFixed(2)} TB`
    : count >= 1e9
      ? `${(count / 1e9).toFixed(2)} GB`
      : count >= 1e6
        ? `${(count / 1e6).toFixed(1)} MB`
        : count >= 1e3
          ? `${(count / 1e3).toFixed(1)} kB`
          : `${Math.round(count)} B`;

/** Bits per second, likewise. */
const bitrate = (bits: number) =>
  bits >= 1e9
    ? `${(bits / 1e9).toFixed(2)} Gbit/s`
    : bits >= 1e6
      ? `${(bits / 1e6).toFixed(1)} Mbit/s`
      : bits >= 1e3
        ? `${(bits / 1e3).toFixed(1)} kbit/s`
        : `${Math.round(bits)} bit/s`;

/** Seconds, from microseconds up to minutes. */
const seconds = (value: number) =>
  value < 1e-6
    ? `${(value * 1e9).toFixed(0)} ns`
    : value < 1e-3
      ? `${(value * 1e6).toFixed(1)} \u00b5s`
      : value < 1
        ? `${(value * 1000).toFixed(2)} ms`
        : value < 90
          ? `${value.toFixed(1)} s`
          : `${(value / 60).toFixed(1)} min`;

/** How many tracks fit in the band at a given density, always a whole number. */
export const trackCount = (perMm: number) => Math.round(BAND_MM * perMm);

/** The picture on the display bench is 16 by 9, so the height follows the width. */
export const frameHeight = (across: number) => Math.round((across * 9) / 16);

/** The sensor bench reads one temperature three different ways. */
export function sensorReading(celsius: number, variant: string): {value: string; law: string; ohms: number} {
  if (variant === 'thermocouple') {
    const volts = seebeckVoltage(SEEBECK_UV, celsius - COLD_JUNCTION_C);
    return {
      value: `${(volts * 1000).toFixed(2)} mV`,
      law: `taken as a steady ${SEEBECK_UV} \u00b5V for each kelvin above the ${COLD_JUNCTION_C} \u00b0C cold end; a real junction's figure drifts across a wide span`,
      ohms: 0,
    };
  }
  if (variant === 'platinum') {
    const ohms = rtdResistance(RTD_OHMS, RTD_ALPHA, celsius);
    return {value: `${ohms.toFixed(2)} \u03a9`, law: 'the linear approximation, 0.385% of 100 \u03a9 for each degree; the standard curve bends slightly away from it and reads about an ohm lower at 200 \u00b0C', ohms};
  }
  const ohms = thermistorResistance(THERMISTOR_OHMS, THERMISTOR_BETA, celsius + 273.15);
  return {
    value: ohms >= 1000 ? `${(ohms / 1000).toFixed(2)} k\u03a9` : `${ohms.toFixed(0)} \u03a9`,
    law: 'the beta model for a thermistor whose resistance falls as it warms, which is exponential and fitted over a limited range',
    ohms,
  };
}

export const controls: Record<TopicId, ControlSpec> = {
  'inclined-plane': {
    label: () => 'Rise',
    min: 0.4,
    max: 3,
    step: 0.1,
    initial: 2,
    format: value => `${value.toFixed(1)} m of climb`,
    extras: [
      {
        id: 'run',
        label: () => 'Run',
        min: 0.6,
        max: 7,
        step: 0.1,
        initial: 3.5,
        format: value => `${value.toFixed(1)} m along the ground`,
      },
    ],
  },
  levers: {
    label: variant =>
      variant === 'first' ? 'Fulcrum position' : variant === 'second' ? 'Load position' : 'Effort position',
    min: 0.08,
    max: 0.92,
    step: 0.01,
    initial: 0.5,
    format: value => `${percent(value)} along the bar`,
    extras: [
      {
        id: 'load',
        label: () => 'Load',
        min: 5,
        max: 200,
        step: 5,
        initial: 60,
        format: value => `${value} kg on the load end`,
      },
    ],
    variants: {
      label: 'Lever class',
      initial: 'first',
      options: [
        {id: 'first', label: 'First', hint: 'Fulcrum between the effort and the load: a balance, a nail extractor, scissors.'},
        {id: 'second', label: 'Second', hint: 'Load between the fulcrum and the effort: a wheelbarrow, a bottle opener, a nutcracker.'},
        {id: 'third', label: 'Third', hint: 'Effort between the fulcrum and the load: a fishing rod, tweezers, an excavator boom.'},
      ],
    },
  },
  'wheel-and-axle': {
    label: () => 'Handle radius',
    min: 150,
    max: 600,
    step: 10,
    initial: 340,
    format: value => `${value} mm out from the shaft`,
    extras: [
      {
        id: 'axle',
        label: () => 'Drum radius',
        min: 40,
        max: 200,
        step: 5,
        initial: 100,
        format: value => `${value} mm, which is what one turn winds up`,
      },
    ],
  },
  'gears-and-belts': {
    label: variant => (variant === 'belt' ? 'Driven pulley' : 'Driven gear'),
    min: 6,
    max: 36,
    step: 1,
    initial: 24,
    extras: [
      {
        id: 'driver',
        label: variant => (variant === 'belt' ? 'Driving pulley' : 'Driving gear'),
        min: 6,
        max: 36,
        step: 1,
        initial: DRIVER_TEETH,
        format: (value, variant) => `${value} ${variant === 'belt' ? 'teeth of pitch' : 'teeth'}`,
      },
    ],
    format: (value, variant) =>
      variant === 'belt'
        ? `${(value / DRIVER_TEETH).toFixed(2)}× the driver`
        : `${value} teeth against ${DRIVER_TEETH}`,
    variants: {
      label: 'Link',
      initial: 'teeth',
      options: [
        {id: 'teeth', label: 'Teeth', hint: 'Teeth cannot slip, so the wheels stay in step turn after turn, and the driven wheel turns the opposite way.'},
        {id: 'belt', label: 'Belt', hint: 'A belt spans a distance, absorbs shock and slips rather than breaks, and leaves both wheels turning the same way.'},
      ],
    },
  },
  'cams-and-cranks': {
    label: () => 'Throw',
    min: 0.2,
    max: 1,
    step: 0.02,
    initial: 0.55,
    format: value => `${value.toFixed(2)} of the wheel radius`,
    extras: [
      {
        id: 'rod',
        label: () => 'Rod length',
        min: 1.6,
        max: 6,
        step: 0.1,
        initial: 3,
        format: value => `${value.toFixed(1)} crank radii`,
      },
    ],
  },
  pulleys: {
    label: () => 'Supporting strands',
    min: 1,
    max: 6,
    step: 1,
    initial: 4,
    format: value => (value === 1 ? 'one strand' : `${value} strands`),
    extras: [
      {
        id: 'load',
        label: () => 'Load',
        min: 20,
        max: 500,
        step: 10,
        initial: 100,
        format: value => `${value} kg on the hook`,
      },
    ],
  },
  screws: {
    label: () => 'Thread pitch',
    min: 4,
    max: 40,
    step: 1,
    initial: 8,
    format: (value, variant) =>
      variant === 'double'
        ? `${value} mm, so ${value * 2} mm per turn`
        : `${value} mm per turn`,
    extras: [
      {
        id: 'reach',
        label: () => 'Wrench reach',
        min: 40,
        max: 360,
        step: 10,
        initial: 120,
        format: value => `${value} mm from the shaft`,
      },
    ],
    variants: {
      label: 'Thread starts',
      initial: 'single',
      options: [
        {
          id: 'single',
          label: 'Single',
          hint: 'One thread wound up the shaft, so a turn advances it by exactly one pitch. The ordinary bolt.',
        },
        {
          id: 'double',
          label: 'Double',
          hint: 'Two threads wound side by side, so a turn advances it by two pitches. Fast to run down, weaker in its grip.',
        },
      ],
    },
  },
  'rotating-wheels': {
    label: () => 'Spin rate',
    min: 20,
    max: 60,
    step: 1,
    initial: 30,
    format: value => `${value} turns per second`,
    extras: [
      {
        id: 'radius',
        label: () => 'Wheel radius',
        min: 50,
        max: 260,
        step: 5,
        initial: 120,
        format: value => `${value} mm, and the inertia goes with the square of it`,
      },
    ],
    variants: {
      label: 'Mounting',
      initial: 'flywheel',
      options: [
        {
          id: 'flywheel',
          label: 'Flywheel',
          hint: 'Both ends held, so the axis cannot move and the spin is purely a store of energy.',
        },
        {
          id: 'gyroscope',
          label: 'Gyroscope',
          hint: 'One end held, so gravity twists the axis and the spin turns that twist into a slow level circling.',
        },
      ],
    },
  },
  springs: {
    label: () => 'Stiffness',
    min: 4,
    max: 40,
    step: 1,
    initial: 12,
    format: value => `${value} N per mm`,
    extras: [
      {
        id: 'load',
        label: () => 'Load',
        min: 50,
        max: 1200,
        step: 25,
        initial: 300,
        format: value => `${value} N pressing on it`,
      },
    ],
    variants: {
      label: 'Form',
      initial: 'coil',
      options: [
        {id: 'coil', label: 'Coil', hint: 'A wire twisted along its own length. Compact, and the same coil works in tension or compression.'},
        {id: 'leaf', label: 'Leaf', hint: 'A beam bent across its width. It carries the load and locates the axle at the same time.'},
        {
          id: 'torsion',
          label: 'Torsion',
          hint: 'A bar twisted end to end by a lever arm. Its stiffness is quoted here as the rate felt at the end of that arm.',
        },
      ],
    },
  },
  friction: {
    label: () => 'Grip before sliding',
    min: 0.05,
    max: 1.2,
    step: 0.05,
    initial: 0.6,
    format: value => `${value.toFixed(2)} static coefficient`,
    extras: [
      {
        id: 'weight',
        label: () => 'Block weight',
        min: 200,
        max: 3000,
        step: 50,
        initial: 981,
        format: value => `${value} N, about ${Math.round(value / 9.81)} kg`,
      },
    ],
  },
  floating: {
    label: () => 'Average density',
    min: 120,
    max: 2000,
    step: 10,
    initial: 700,
    format: value => `${value} kg per cubic meter`,
    extras: [
      {
        id: 'fluid',
        label: () => 'The liquid',
        min: 700,
        max: 1300,
        step: 10,
        initial: 1000,
        format: value =>
          value < 850
            ? `${value} kg/m³, lighter than water: alcohol or petrol`
            : value < 1010
              ? `${value} kg/m³, fresh water`
              : `${value} kg/m³, sea water or brine`,
      },
    ],
  },
  flying: {
    label: () => 'Angle of attack',
    min: 0,
    max: 24,
    step: 0.5,
    initial: 6,
    format: value => `${value.toFixed(1)}° into the flow`,
    extras: [
      {
        id: 'speed',
        label: () => 'Airspeed',
        min: 80,
        max: 500,
        step: 10,
        initial: 250,
        format: value => `${value} km/h, and the lift goes with the square of it`,
      },
    ],
    variants: {
      label: 'Trailing edge',
      initial: 'clean',
      options: [
        {id: 'clean', label: 'Clean', hint: 'The wing as it flies in cruise: least drag, and it holds on to the flow furthest.'},
        {
          id: 'flaps',
          label: 'Flaps down',
          hint: 'Lowering this flap increases the wing’s curve: more lift and drag at the same angle. This model assumes it stalls a little sooner.',
        },
      ],
    },
  },
  'pressure-power': {
    label: () => 'Large piston bore',
    min: 20,
    max: 200,
    step: 2,
    initial: 100,
    format: value => `${value} mm against ${SMALL_BORE} mm`,
    extras: [
      {
        id: 'small',
        label: () => 'Small piston bore',
        min: 8,
        max: 60,
        step: 1,
        initial: 20,
        format: value => `${value} mm, the one your hand pushes`,
      },
    ],
    variants: {
      label: 'Fluid',
      initial: 'liquid',
      options: [
        {id: 'liquid', label: 'Liquid', hint: 'Oil barely compresses, so little input travel is used to squeeze it before the far piston moves.'},
        {id: 'gas', label: 'Gas', hint: 'Air squeezes first and springs back after, which suits hammering and shock but makes precise positioning harder.'},
      ],
    },
  },
  'exploiting-heat': {
    label: () => 'Temperature gap',
    min: 40,
    max: 700,
    step: 10,
    initial: 300,
    format: value => `${value} K above ${AMBIENT} K`,
    extras: [
      {
        id: 'cold',
        label: () => 'Cold side',
        min: 250,
        max: 420,
        step: 5,
        initial: 290,
        format: value => `${value} K, about ${Math.round(value - 273)} °C`,
      },
    ],
    variants: {
      label: 'Direction',
      initial: 'engine',
      options: [
        {id: 'engine', label: 'Engine', hint: 'Heat runs from hot to cold on its own, and some of it is taken off as work on the way through.'},
        {
          id: 'refrigerator',
          label: 'Refrigerator',
          hint: 'The same machine driven backward: work goes in and heat is carried the wrong way, from the cold side to the warm one.',
        },
      ],
    },
  },
  'nuclear-power': {
    label: () => 'Control rods',
    min: 0,
    max: 100,
    step: 1,
    initial: 25,
    format: value => `${value}% into the core`,
    extras: [
      {
        id: 'fuel',
        label: () => 'Fuel liveliness',
        min: 96,
        max: 108,
        step: 1,
        initial: 102,
        format: value => `${(value / 100).toFixed(2)} neutrons per generation with the rods right out`,
      },
    ],
  },
  'light-and-images': {
    label: () => 'Object distance',
    min: 40,
    max: 450,
    step: 5,
    initial: 250,
    format: (value, variant) =>
      Number.isFinite(OPTICAL_ELEMENTS[variant]?.focal ?? FOCAL_LENGTH)
        ? `${value} mm from the element`
        : `${value} mm from a surface with no focal length at all`,
    variants: {
      label: 'Element',
      initial: 'converging',
      options: [
        {
          id: 'converging',
          label: 'Converging lens',
          hint: 'Thick in the middle, so light passing through is bent inward and brought to a point a hundred millimeters beyond. Outside that point it makes a real image, upside down, that a screen can catch.',
        },
        {
          id: 'diverging',
          label: 'Diverging lens',
          hint: 'Thin in the middle, so light is bent outward instead and only ever seems to come from a point on the near side. Whatever you do with the slider the image stays virtual, upright and smaller.',
        },
        {
          id: 'concave-mirror',
          label: 'Concave mirror',
          hint: 'A dish curving away from the light, which gathers it exactly as the converging lens does and obeys the same equation. It folds the image back to the side the light came from.',
        },
        {
          id: 'convex-mirror',
          label: 'Convex mirror',
          hint: 'The same dish turned about, bulging toward the light and spreading it. The image is always behind the glass, upright and small, which is why it is the mirror on the outside of a van.',
        },
        {
          id: 'plane-mirror',
          label: 'Flat mirror',
          hint: 'No curvature, so no focal length and nothing to focus. The image lands as far behind the surface as you stand in front of it, the same way up and exactly your own size.',
        },
      ],
    },
    extras: [
      {
        id: 'focal',
        label: variant =>
          Number.isFinite(OPTICAL_ELEMENTS[variant]?.focal ?? FOCAL_LENGTH) ? 'Focal length' : 'Focal length (none)',
        min: FOCAL_RANGE.shortest,
        max: FOCAL_RANGE.longest,
        step: 5,
        initial: FOCAL_LENGTH,
        format: (value, variant) => {
          const focal = OPTICAL_ELEMENTS[variant]?.focal ?? FOCAL_LENGTH;
          if (!Number.isFinite(focal)) return 'A flat surface has none, so this changes nothing';
          return focal < 0 ? `-${value} mm, because this element spreads light` : `${value} mm`;
        },
      },
    ],
  },
  photography: {
    label: () => 'Aperture',
    min: 0,
    max: STOPS.length - 1,
    step: 1,
    initial: 5,
    format: value => `f/${STOPS[value]}`,
    extras: [
      {
        id: 'subject',
        label: () => 'Subject distance',
        min: 300,
        max: 12000,
        step: 100,
        initial: 2000,
        format: value => (value >= 1000 ? `${(value / 1000).toFixed(1)} m away` : `${value} mm away`),
      },
    ],
    variants: {
      label: 'Sensitivity',
      initial: 'iso100',
      options: [
        {id: 'iso100', label: 'ISO 100', hint: 'The clean setting: least noise, and the longest shutter time for a given opening.'},
        {
          id: 'iso800',
          label: 'ISO 800',
          hint: 'Three stops more sensitive, so the shutter can be eight times shorter. The price is noise in the shadows.',
        },
      ],
    },
  },
  printing: {
    label: () => 'Screen ruling',
    min: 25,
    max: 300,
    step: 5,
    initial: 150,
    format: value => `${value} lines per inch`,
    extras: [
      {
        id: 'ink',
        label: () => 'Ink strength',
        min: 10,
        max: 180,
        step: 5,
        initial: 100,
        format: value => `${value}% of the tints this swatch is made of`,
      },
    ],
    variants: {
      label: 'Inks',
      initial: 'process',
      options: [
        {id: 'process', label: 'Four', hint: 'Cyan, magenta, yellow and black, each on its own lattice at its own angle.'},
        {id: 'black', label: 'Black only', hint: 'One ink, one angle, and no color at all: everything has to be carried by dot size.'},
      ],
    },
  },
  'sound-and-music': {
    label: () => 'Working length',
    min: 150,
    max: 650,
    step: 5,
    initial: 650,
    format: value => `${value} mm`,
    extras: [
      {
        id: 'tension',
        label: variant => (variant === 'string' ? 'String tension' : 'String tension (no string here)'),
        min: 10,
        max: 400,
        step: 5,
        initial: 65,
        format: (value, variant) =>
          variant === 'string' ? `${value} N, and the note goes with its square root` : 'a pipe has none; the air slider is the one that moves this note',
      },
      {
        id: 'air',
        label: variant => (variant === 'string' ? 'Air (does not move a string)' : 'Air temperature'),
        min: -10,
        max: 45,
        step: 1,
        initial: 20,
        format: (value, variant) =>
          variant === 'string'
            ? `${value} °C, which changes what you hear but not what the string does`
            : `${value} °C, so sound travels at ${Math.round(343 + 0.606 * (value - 20))} m/s`,
      },
    ],
    variants: {
      label: 'Sounded by',
      initial: 'string',
      options: [
        {id: 'string', label: 'String', hint: 'Held at both ends and stretched, so its pitch answers to length, tension and weight alike.'},
        {id: 'open', label: 'Open pipe', hint: 'Open at both ends, so it holds half a wavelength and gives the whole harmonic series.'},
        {
          id: 'stopped',
          label: 'Stopped pipe',
          hint: 'Closed at one end, so it holds only a quarter of a wavelength: an octave lower for the same tube, and odd harmonics only.',
        },
      ],
    },
  },
  telecommunications: {
    label: () => 'Carrier frequency',
    min: 5.3,
    max: 9.3,
    step: 0.05,
    initial: 8,
    format: value => formatFrequency(10 ** value),
    extras: [
      {
        id: 'message',
        label: () => 'Message rate',
        min: 0.5,
        max: 6,
        step: 0.1,
        initial: 1.5,
        format: value => `${value.toFixed(1)} cycles across the window`,
      },
    ],
    variants: {
      label: 'Modulation',
      initial: 'am',
      options: [
        {id: 'am', label: 'AM', hint: 'The signal written into the height of the wave. Simple, and it picks up every spark and storm on the way.'},
        {id: 'fm', label: 'FM', hint: 'The signal written into the rate instead, so a receiver that ignores height ignores the noise with it.'},
      ],
    },
  },
  electricity: {
    label: () => 'Resistance',
    min: 2,
    max: 40,
    step: 1,
    initial: 12,
    format: (value, variant) =>
      variant === 'parallel' ? `${value} Ω in each of two branches` : `${value} Ω across the supply`,
    variants: {
      label: 'Circuit',
      initial: 'single',
      options: [
        {id: 'single', label: 'One branch', hint: 'One path for the current, so the whole supply voltage sits across the one resistance.'},
        {
          id: 'parallel',
          label: 'Two in parallel',
          hint: 'A second identical branch beside the first. Each still gets the full voltage, so the supply has to deliver twice the current.',
        },
      ],
    },
    extras: [
      {
        id: 'volts',
        label: () => 'Supply',
        min: 3,
        max: SUPPLY_VOLTS,
        step: 1,
        initial: SUPPLY_VOLTS,
        format: value => `${value} V`,
      },
    ],
  },
  magnetism: {
    label: () => 'Coil current',
    min: 0.2,
    max: 5,
    step: 0.1,
    initial: 2,
    format: value => `${value.toFixed(1)} A through ${COIL_TURNS} turns`,
    extras: [
      {
        id: 'turns',
        label: () => 'Turns on the coil',
        min: 80,
        max: 1200,
        step: 20,
        initial: 400,
        format: value => `${value} over 200 mm, which is ${Math.round(value / 0.2)} to the meter`,
      },
    ],
    variants: {
      label: 'Core',
      initial: 'air',
      options: [
        {id: 'air', label: 'Air core', hint: 'Nothing but the coil. The field is what the current and the winding make, and no more.'},
        {
          id: 'iron',
          label: 'Iron core',
          hint: `Soft iron in the middle, whose own domains line up and add to the field. Modeled as a steady ${IRON_PERMEABILITY} times, though real iron saturates.`,
        },
      ],
    },
  },
  'electric-motors': {
    label: () => 'Armature current',
    min: 0.5,
    max: 8,
    step: 0.1,
    initial: 3,
    format: value => `${value.toFixed(1)} A in ${MOTOR_TURNS} turns`,
    extras: [
      {
        id: 'field',
        label: () => 'Magnet strength',
        min: 5,
        max: 60,
        step: 1,
        initial: 25,
        format: value => `${(value / 100).toFixed(2)} T between the poles`,
      },
    ],
    variants: {
      label: 'Connection',
      initial: 'commutator',
      options: [
        {
          id: 'commutator',
          label: 'With commutator',
          hint: 'The split ring reverses the coil current twice a turn, exactly at the dead point, so the push keeps the coil going the same way round.',
        },
        {
          id: 'plain',
          label: 'Plain slip rings',
          hint: 'No reversal, so past the dead point the same current pushes the coil back. It swings toward the upright position and settles there.',
        },
      ],
    },
  },
  'generators-and-transformers': {
    label: variant => (variant === 'transformer' ? 'Secondary turns' : 'Turns on the coil'),
    min: 50,
    max: 2000,
    step: 50,
    initial: 500,
    format: (value, variant) =>
      variant === 'transformer'
        ? `${value} against ${PRIMARY_TURNS} on the primary`
        : `${value} turns at ${GEN_RATE_HZ} turns a second`,
    extras: [
      {
        id: 'rate',
        label: () => 'Running rate',
        min: 10,
        max: 120,
        step: 5,
        initial: 50,
        format: value => `${value} Hz, which is ${value * 60} turns a minute`,
      },
    ],
    variants: {
      label: 'Machine',
      initial: 'generator',
      options: [
        {
          id: 'generator',
          label: 'Generator',
          hint: 'A coil turned through a fixed field. The voltage follows a sine wave because the rate at which the coil cuts the field varies through the turn.',
        },
        {
          id: 'transformer',
          label: 'Transformer',
          hint: 'Nothing moves. An alternating current in the primary makes a changing field in the core, and the secondary answers to the change.',
        },
      ],
    },
  },
  'sensors-and-detectors': {
    label: () => 'Temperature',
    min: -20,
    max: 200,
    step: 1,
    initial: 25,
    format: value => `${value} °C at the sensing element`,
    extras: [
      {
        id: 'fixed',
        label: () => 'The fixed resistor',
        min: 10,
        max: 1000,
        step: 10,
        initial: 100,
        format: value => `${value}% of the one matched to this sensor`,
      },
    ],
    variants: {
      label: 'Sensor',
      initial: 'thermistor',
      options: [
        {
          id: 'thermistor',
          label: 'Thermistor',
          hint: 'Resistance falls steeply as it warms, so a small change is easy to read. The law is exponential and only fitted over a limited range.',
        },
        {
          id: 'platinum',
          label: 'Platinum',
          hint: 'Resistance rises very nearly in a straight line. Much less sensitive than a thermistor, and much better behaved across a wide span.',
        },
        {
          id: 'thermocouple',
          label: 'Thermocouple',
          hint: 'Two metals joined, making their own small voltage with no supply at all. It reads a difference, so the cold end has to be known separately.',
        },
      ],
    },
  },
  'making-bits': {
    label: () => 'Sample rate',
    min: 6,
    max: 96,
    step: 1,
    initial: 44,
    format: value => `${value} thousand a second, for a ${TONE_HZ / 1000} kHz tone`,
    extras: [
      {
        id: 'tone',
        label: () => 'The tone',
        min: 1,
        max: 40,
        step: 1,
        initial: 12,
        format: value => `${value} kHz going in`,
      },
    ],
    variants: {
      label: 'Depth',
      initial: '16',
      options: [
        {id: '4', label: '4 bits', hint: 'Sixteen levels. Coarse enough to see the staircase and to hear the roughness it leaves behind.'},
        {id: '8', label: '8 bits', hint: 'Two hundred and fifty six levels, which is about what early samplers and telephone systems worked with.'},
        {id: '16', label: '16 bits', hint: 'Sixty five thousand levels, giving about 98 dB of range for a full scale signal. This is compact disc quality.'},
      ],
    },
  },
  'storing-bits': {
    label: () => 'Track density',
    min: 2,
    max: 400,
    step: 2,
    initial: 50,
    format: value => `${value} tracks per mm across a ${BAND_MM} mm band`,
    extras: [
      {
        id: 'band',
        label: () => 'Band of tracks',
        min: 5,
        max: 60,
        step: 1,
        initial: 30,
        format: value => `${value} mm of the surface used`,
      },
    ],
    variants: {
      label: 'Spin rate',
      initial: '7200',
      options: [
        {id: '5400', label: '5,400 rpm', hint: 'A quieter, cooler drive. The average wait for a sector is 5.6 ms, whatever else is improved.'},
        {id: '7200', label: '7,200 rpm', hint: 'The common desktop rate, waiting 4.2 ms on average for the sector to come round.'},
        {id: '15000', label: '15,000 rpm', hint: 'A server drive spun as fast as the mechanics allow, which still leaves a 2 ms wait.'},
      ],
    },
  },
  'processing-bits': {
    label: () => 'Word width',
    min: 1,
    max: 16,
    step: 1,
    initial: 8,
    format: value => `${value} bit${value === 1 ? '' : 's'} wide`,
    extras: [
      {
        id: 'addend',
        label: () => 'The second number',
        min: 0,
        max: 100,
        step: 5,
        initial: 45,
        format: value => `${value}% of the largest this width holds`,
      },
    ],
    variants: {
      label: 'Carry',
      initial: 'ripple',
      options: [
        {
          id: 'ripple',
          label: 'Ripple carry',
          hint: 'Each column waits for the carry out of the one below it, so the time taken grows with the width. Two gate delays a stage is the usual model.',
        },
        {
          id: 'lookahead',
          label: 'Carry lookahead',
          hint: 'The carries are worked out from the inputs in a tree, so the time grows with the logarithm of the width instead. Many more gates buy it.',
        },
      ],
    },
  },
  'sending-bits': {
    label: () => 'Signal to noise',
    min: 0,
    max: 60,
    step: 1,
    initial: 30,
    format: value =>
      `${value} dB, a power ratio of ${powerRatio(value) < 10 ? powerRatio(value).toFixed(2) : Math.round(powerRatio(value)).toLocaleString('en-US')}`,
    extras: [
      {
        id: 'share',
        label: () => 'Bandwidth used',
        min: 10,
        max: 100,
        step: 5,
        initial: 100,
        format: value => `${value}% of the channel's own width`,
      },
    ],
    variants: {
      label: 'Channel',
      initial: 'telephone',
      options: [
        {id: 'telephone', label: 'Telephone line', hint: 'About 3.1 kHz of usable bandwidth, which is why a dial up modem could never pass much beyond 33 kbit/s over a fully analog line.'},
        {id: 'radio', label: 'Radio channel', hint: 'Two hundred kilohertz, the width of one broadcast channel, giving sixty times the capacity at the same ratio.'},
        {id: 'fiber', label: 'Optical fiber', hint: 'Ten gigahertz of bandwidth in one window, so the same ratio carries something like a hundred thousand times as much.'},
      ],
    },
  },
  'using-bits': {
    label: () => 'Pixels across',
    min: 160,
    max: 3840,
    step: 160,
    initial: 1920,
    format: value => `${value} by ${frameHeight(value)}`,
    extras: [
      {
        id: 'fps',
        label: () => 'Frame rate',
        min: 24,
        max: 120,
        step: 1,
        initial: 30,
        format: value => `${value} frames a second`,
      },
    ],
    variants: {
      label: 'Depth',
      initial: '8',
      options: [
        {id: '2', label: '2 bits each', hint: 'Four levels per channel, sixty four colors in all. A smooth sky comes out in visible bands.'},
        {id: '8', label: '8 bits each', hint: 'Sixteen million colors, more than the eye can separate, which is why this became the standard.'},
        {id: '10', label: '10 bits each', hint: 'A billion colors. The extra grades are spent on a wider brightness range rather than on more hues.'},
      ],
    },
  },
};

/** The connecting rod on the crank bench, in wheel radii. */
export const ROD_LENGTH = 3;

export type ReadingFn = (value: number, variant: string, extras: Record<string, number>) => Reading[];

/** Shared closing line: every simple machine trades force against distance and keeps the total. */
const IDEAL = 'for an ideal machine: no friction, and moving at a steady speed';
const balanced: Reading = {label: 'Work in and out', value: 'Equal', hint: IDEAL};

export const readingsFor: Record<TopicId, ReadingFn> = {
  'inclined-plane': (value, _variant, extras) => {
    const rise = value;
    const run = extras.run ?? 3.5;
    const slopeLength = Math.hypot(rise, run);
    const ramp = inclinedPlane(slopeLength, rise);
    return [
      {
        label: 'Slope length',
        value: `${slopeLength.toFixed(2)} m`,
        hint: 'the hypotenuse of the rise and the run, which is the distance the load is actually pushed',
      },
      {
        label: 'Effort along the slope',
        value: percent(1 / ramp.forceRatio),
        hint: 'of the load\u2019s weight, pushing it steadily up the surface',
      },
      {
        label: 'Distance to push',
        value: times(ramp.distanceRatio),
        hint: 'the height gained, so at the same speed the trip takes that much longer',
      },
      {label: 'Slope angle', value: `${Math.round(slopeAngle(slopeLength, rise))}\u00b0`, hint: 'measured from level ground'},
      balanced,
    ];
  },
  levers: (value, variant, extras) => {
    const arms = leverArms(variant as LeverClass, 1, value);
    const kilograms = extras.load ?? 60;
    const weight = kilograms * 9.81;
    return [
      {
        label: 'Effort needed',
        value: `${Math.round(weight / arms.forceRatio)} N`,
        hint: `${percent(1 / arms.forceRatio)} of the ${Math.round(weight)} N the load weighs, applied at the effort point`,
      },
      {label: 'Effort travel', value: times(arms.distanceRatio), hint: 'the distance the load moves'},
      {
        label: 'This class',
        value: arms.forceRatio > 1 ? 'Multiplies force' : arms.forceRatio < 1 ? 'Multiplies reach' : 'Balances',
        hint: 'effort \u00d7 its arm always equals load \u00d7 its arm',
      },
      balanced,
    ];
  },
  'wheel-and-axle': (value, _variant, extras) => {
    const axle = extras.axle ?? 100;
    const winch = wheelAndAxle(value, axle);
    return [
      {
        label: 'Circles',
        value: `${value} mm against ${axle} mm`,
        hint: 'the handle and the drum, and their ratio is the whole of the advantage',
      },
      {label: 'Force at the drum', value: times(winch.forceRatio), hint: 'for each unit of pull at the rim'},
      {
        label: 'Rope per hand travel',
        value: percent(1 / winch.distanceRatio),
        hint: 'one turn takes up one drum circumference of rope, however wide the handle circle is',
      },
      {
        label: 'Pull to hold 100 kg',
        value: `${Math.round(981 / winch.forceRatio)} N`,
        hint: `about ${Math.round(100 / winch.forceRatio)} kg of hanging weight at the rim`,
      },
      balanced,
    ];
  },
  'gears-and-belts': (value, variant, extras) => {
    const driving = extras.driver ?? DRIVER_TEETH;
    const train = gearTrain(driving, value);
    return [
      {
        label: 'Tooth counts',
        value: `${driving} driving ${value}`,
        hint: 'the ratio between them is the whole of it, and either one alone tells you nothing',
      },
      {
        label: 'Driven wheel speed',
        value: percent(1 / train.distanceRatio),
        hint: 'of the driving wheel\u2019s, because both rims sweep the same arc',
      },
      {
        label: 'Torque at the driven wheel',
        value: times(train.forceRatio),
        hint: 'for each unit of torque at the driver',
      },
      {
        label: 'Direction',
        value: variant === 'belt' ? 'Same way' : 'Reversed',
        hint:
          variant === 'belt'
            ? 'the belt does not cross, so both wheels turn together'
            : 'meshing teeth push the driven wheel the other way',
      },
      balanced,
    ];
  },
  'cams-and-cranks': (value, _variant, extras) => [
    {
      label: 'Crank stroke',
      value: `${crankStroke(value).toFixed(2)} r`,
      hint: 'twice the throw, in wheel radii, every turn',
    },
    {label: 'Cam lift', value: `${value.toFixed(2)} r`, hint: 'the follower rises by the height of the lobe'},
    {
      label: 'Rod lean',
      value: `${Math.round(rodObliquity(value, extras.rod ?? ROD_LENGTH))}\u00b0`,
      hint: 'how far the connecting rod tilts from straight at its worst, which is what makes the two halves of the stroke uneven',
    },
    {
      label: 'Rod against throw',
      value: `${((extras.rod ?? ROD_LENGTH) / value).toFixed(1)}\u00d7`,
      hint: 'the only thing the lean depends on: a long rod against a short throw leans hardly at all',
    },
    {
      label: 'Runs backward',
      value: 'Crank fully, cam not',
      hint: 'a piston turns a crank right round, while a follower can at best shove a cam back over part of its profile',
    },
  ],

  pulleys: (value, _variant, extras) => {
    const rig = pulley(value);
    const kilograms = extras.load ?? 100;
    return [
      {
        label: 'Effort at the free end',
        value: percent(1 / rig.forceRatio),
        hint:
          value === 1
            ? 'of the load: one wheel overhead changes the direction of your pull and nothing else'
            : 'of the load, because that many strands share the weight between them',
      },
      {label: 'Rope to haul in', value: times(rig.distanceRatio), hint: 'the height the load gains'},
      {
        label: 'Pull to hold the load',
        value: `${Math.round((kilograms * 9.81) / rig.forceRatio)} N`,
        hint: `about ${Math.round(kilograms / rig.forceRatio)} kg hanging on the free end, out of ${kilograms} on the hook`,
      },
      balanced,
    ];
  },
  screws: (value, variant, extras) => {
    const lead = threadLead(value, variant === 'double' ? 2 : 1);
    const angle = helixAngle(THREAD_RADIUS, lead);
    const reach = extras.reach ?? WRENCH_RADIUS;
    return [
      {
        label: 'Ideal force gain',
        value: times(screw(reach, lead).forceRatio),
        hint: `your hand goes ${Math.round(2 * Math.PI * reach)} mm round for every ${lead} the thread advances, and that is the whole of it, before friction takes the greater part`,
      },
      {
        label: 'Turns to advance 10 mm',
        value: (10 / lead).toFixed(1),
        hint: 'your hand goes right round the wrench for each one',
      },
      {
        label: 'Thread angle',
        value: `${angle.toFixed(1)}°`,
        hint: 'the slope of the ramp once it is unwrapped from the shaft',
      },
      {
        label: 'Holds by itself',
        value: angle < SELF_LOCKING_ANGLE ? 'Yes' : 'Not reliably',
        hint: `a thread stays put while its angle is shallower than friction can support, around ${SELF_LOCKING_ANGLE}° for greased steel`,
      },
    ];
  },
  'rotating-wheels': (value, variant, extras) => {
    const radius = (extras.radius ?? 120) / 1000;
    const inertia = discInertia(0.6, radius);
    const energy = rotationalEnergy(inertia, value);
    const rim = centripetalForce(RIM_BOLT, radius, value);
    const bolt = {
      label: 'Force on a 50 g rim bolt',
      value: `${Math.round(rim)} N`,
      hint: 'the inward force needed for circular motion; other forces, such as gravity, may also act',
    };
    if (variant === 'gyroscope') {
      return [
        {
          label: 'Axis circles once in',
          value: `${(1 / precessionRate(GYRO_TORQUE, inertia, value)).toFixed(1)} s`,
          hint: 'gravity pulls down on the overhung wheel, and the axis answers by swinging level',
        },
        {
          label: 'Which way it moves',
          value: 'Sideways',
          hint: 'a torque changes the direction of the spin rather than tipping the wheel over',
        },
        {label: 'Energy in the spin', value: `${energy.toFixed(1)} J`, hint: `for this 600 g wheel of ${Math.round(radius * 1000)} mm radius`},
        bolt,
      ];
    }
    return [
      {label: 'Energy stored', value: `${energy.toFixed(1)} J`, hint: `in this 600 g wheel of ${Math.round(radius * 1000)} mm radius; it goes with the square of the radius and the square of the rate alike`},
      {
        label: 'Rim speed',
        value: `${(2 * Math.PI * radius * value).toFixed(1)} m/s`,
        hint: 'every point on the rim, traveling in a circle it is constantly being pulled into',
      },
      bolt,
      {
        label: 'Double the rate',
        value: 'Four times the energy',
        hint: 'and four times the force holding the rim together, which is what limits how fast a wheel may be spun',
      },
    ];
  },
  springs: (value, _variant, extras) => {
    const newtons = extras.load ?? SPRING_LOAD;
    const deflection = newtons / value;
    return [
      {
        label: `Deflection under ${newtons} N`,
        value: `${deflection.toFixed(1)} mm`,
        hint: `about the weight of a ${Math.round(newtons / 9.81)} kg load resting on it, and it is the load divided by the stiffness`,
      },
      {
        label: 'Energy held there',
        value: `${(springEnergy(value, deflection) / 1000).toFixed(2)} J`,
        hint: 'the area under the spring’s own force line, which is why it grows with the square',
      },
      {
        label: 'Force at 20 mm',
        value: `${Math.round(springForce(value, 20))} N`,
        hint: 'and exactly twice that at 40 mm, while the spring stays within its range',
      },
      {
        label: 'Double the deflection',
        value: 'Four times the energy',
        hint: 'twice the force, applied over twice the distance',
      },
    ];
  },
  friction: (value, _variant, extras) => {
    const weight = extras.weight ?? BLOCK_WEIGHT;
    return [
    {
      label: 'Pull to drag the block',
      value: `${Math.round(frictionForce(value * 0.8, weight))} N`,
      hint: `along level ground, for the ${Math.round(weight / 9.81)} kg on the plank; this example uses sliding friction at 80% of the grip before sliding`,
    },
    {
      label: 'Slips at',
      value: `${slipAngle(value).toFixed(1)}°`,
      hint: 'the limit of static grip, and it does not move when the block does: grip and weight both go up with the weight, so they cancel and only the surfaces are left',
    },
    {
      label: 'Heat per meter',
      value: `${Math.round(frictionHeat(value * 0.8, weight, 1))} J`,
      hint: 'mechanical energy changed to heat while sliding one meter along level ground',
    },
    {
      label: 'Contact area',
      value: 'Little effect here',
      hint: 'an approximate dry-friction rule; real tires and soft or sticky surfaces can behave differently',
    },
    ];
  },

  floating: (value, _variant, extras) => {
    const fluid = extras.fluid ?? FRESH_WATER;
    const fraction = submergedFraction(value, fluid);
    const floats = fraction < 1;
    const neutral = Math.abs(fraction - 1) < 1e-9;
    return [
      {
        label: 'How much is under',
        value: fraction < 1 ? percent(fraction) : 'All of it',
        hint: floats
          ? 'of its own volume, because that much water weighs what the body weighs'
          : neutral
            ? 'exactly enough water displaced to balance its weight, with no net vertical force'
            : 'and still not enough water pushed aside to hold it up',
      },
      {
        label: 'Standing clear',
        value: floats ? percent(1 - fraction) : 'None',
        hint: 'the freeboard, which is what a load line is drawn to protect',
      },
      {
        label: 'A cubic meter of it weighs',
        value: `${((value * 9.81) / 1000).toFixed(2)} kN`,
        hint: `and the same volume of fresh water weighs ${(buoyantForce(1, FRESH_WATER) / 1000).toFixed(2)} kN`,
      },
      {
        label: 'Verdict',
        value: neutral ? 'Neutral' : floats ? 'Floats' : 'Sinks',
        hint: neutral
          ? 'exactly the water’s own density, so it stays wherever it is put: what a submarine trims for'
          : 'the only test is average density against the water’s, whatever it is made of',
      },
    ];
  },
  flying: (value, variant, extras) => {
    const flapped = variant === 'flaps';
    const speed = (extras.speed ?? 250) / 3.6;
    const stall = flapped ? FLAPPED_STALL : CLEAN_STALL;
    const lift = wingLift(value, stall, flapped ? FLAP_LIFT : 0);
    const drag = wingDrag(value, stall, lift, WING_SLENDERNESS, flapped ? 0.07 : 0.02);
    return [
      {
        label: 'Lift coefficient',
        value: lift.toFixed(2),
        hint: 'about a tenth for every degree, while the flow still follows the wing',
      },
      {
        label: `Lift at ${Math.round(speed * 3.6)} km/h`,
        value: `${(aerodynamicForce(lift, AIR, speed, WING_AREA) / 1000).toFixed(1)} kN`,
        hint: `on ${WING_AREA} m² of wing. It goes with the square of the speed, so the same wing at the same angle carries four times as much at twice the speed`,
      },
      {
        label: 'Lift for each unit of drag',
        value: (lift / drag).toFixed(1),
        hint: 'meters forward for every meter down, with the engines off',
      },
      {
        label: 'The flow',
        value: value > stall ? 'Stalled' : 'Attached',
        hint:
          value > stall
            ? 'the air can no longer follow the upper surface: lift starts to fall away and drag climbs steeply'
            : `it follows the upper surface up to about ${stall}°`,
      },
    ];
  },
  'pressure-power': (value, variant, extras) => {
    const smallBore = extras.small ?? SMALL_BORE;
    const press = hydraulicPress(pistonArea(smallBore), pistonArea(value));
    const pressure = HAND_FORCE / pistonArea(smallBore);
    // In millimeters and newtons, a pressure of one newton per square
    // millimeter is ten bar.
    const bar = pressure * 10;
    // Boyle, in absolute pressure: the column shrinks before anything moves.
    const squeezed = variant === 'gas' ? GAS_COLUMN - boyleVolume(ATMOSPHERE, GAS_COLUMN, bar + ATMOSPHERE) : 0;
    // Whatever the squeeze takes never reaches the far piston at all.
    const delivered = Math.max(0, INPUT_STROKE - squeezed) / press.distanceRatio;
    return [
      {
        label: `Force out for ${HAND_FORCE} N in`,
        value: `${Math.round(HAND_FORCE * press.forceRatio)} N`,
        hint: `the same pressure acting on the larger area: ${value} mm of bore against ${smallBore}, and it is the areas that count, so the ratio goes with the square`,
      },
      {
        label: `Travel out for ${INPUT_STROKE} mm in`,
        value: delivered >= 0.1 ? `${delivered.toFixed(2)} mm` : `${(delivered * 1000).toFixed(0)} µm`,
        hint:
          variant === 'gas'
            ? 'the volume that leaves one cylinder is the volume that arrives at the other, less whatever the air swallowed first'
            : 'the volume that leaves one cylinder is the volume that arrives at the other',
      },
      {
        label: 'Pressure in the line',
        value: `${bar.toFixed(0)} bar`,
        hint: 'raised by the same amount at every point in the fluid, which is why the pipe can go anywhere',
      },
      variant === 'gas'
        ? {
            label: 'Stroke lost to squeeze',
            value: `${Math.min(100, Math.round((squeezed / INPUT_STROKE) * 100))}%`,
            hint: `a ${GAS_COLUMN} mm column of air at this pressure shrinks that much before anything moves`,
          }
        : {
            label: 'Stroke lost to squeeze',
            value: 'Almost none',
            hint: 'oil gives by well under a percent even at a few hundred bar',
          },
    ];
  },
  'exploiting-heat': (value, variant, extras) => {
    const cold = extras.cold ?? AMBIENT;
    const hot = cold + value;
    if (variant === 'refrigerator') {
      const moved = coolingLimit(hot, cold);
      return [
        {
          label: 'Most heat moved per joule',
          value: `${moved.toFixed(1)} J`,
          hint:
            moved > 1
              ? 'it is carrying heat rather than making it, which is why the figure can stand above one'
              : 'across a gap this wide it moves less heat than the work it costs, which is why a fridge is built for a small one',
        },
        {
          label: 'Work to move 100 J',
          value: `${(100 / moved).toFixed(1)} J`,
          hint: 'the ideal minimum; real refrigerators need more work',
        },
        {
          label: 'Delivered to the warm side',
          value: `${(100 + 100 / moved).toFixed(0)} J`,
          hint: 'everything taken from the cold side, plus the work spent taking it',
        },
        {label: 'Warm side', value: `${hot} K`, hint: `${Math.round(hot - 273.15)} °C, against ${cold} K on the cold side`},
      ];
    }
    const efficiency = carnotEfficiency(hot, cold);
    return [
      {
        label: 'Best possible efficiency',
        value: percent(efficiency),
        hint: 'set by the two temperatures alone, whatever the engine is made of',
      },
      {
        label: 'Work from 100 J of heat',
        value: `${(100 * efficiency).toFixed(0)} J`,
        hint: 'at the very best, and a real engine gets rather less',
      },
      {
        label: 'Heat that must be dumped',
        value: `${(100 * (1 - efficiency)).toFixed(0)} J`,
        hint: 'at the very least: heat only flows one way, so some of it has to be left somewhere colder, and a real engine leaves more',
      },
      {label: 'Hot side', value: `${hot} K`, hint: `${Math.round(hot - 273.15)} °C, against ${cold} K on the cold side`},
    ];
  },
  'nuclear-power': (value, _variant, extras) => {
    const open = (extras.fuel ?? K_OPEN * 100) / 100;
    const k = open - (value / 100) * (open - K_SHUT);
    const after = chainGrowth(k, GENERATIONS);
    return [
      {
        label: 'Multiplication factor',
        value: k.toFixed(3),
        hint: 'how many of the neutrons from one fission go on to cause another',
      },
      {
        label: `After ${GENERATIONS} generations`,
        value: after > 1000 ? `${(after / 1000).toFixed(0)}000×` : `${after.toFixed(2)}×`,
        hint:
          'one neutron becomes this many. A fraction of a percent of them arrive late rather than at once, and that delay is what turns a runaway into something an operator can steer',
      },
      {
        label: 'State',
        value: k < 0.9999 ? 'Dying away' : k > 1.0001 ? 'Climbing' : 'Steady',
        hint: `the whole of running a reactor is holding that factor at one, and with this fuel the rods reach it ${
          open > 1 ? `${Math.round(((open - 1) / (open - K_SHUT)) * 100)}% of the way in` : 'nowhere: it cannot reach one however far they come out'
        }`,
      },
      {
        label: 'Heat from 1 kg fully split',
        value: `${(massEnergy(MASS_CONVERTED) / 3.6e12).toFixed(0)} GWh`,
        hint: `complete fission of 1 kg of fissile material converts about ${(MASS_CONVERTED * 1000).toFixed(1)} g to heat energy; electrical output is smaller`,
      },
    ];
  },

  'light-and-images': (value, variant, extras) => {
    const element = OPTICAL_ELEMENTS[variant] ?? OPTICAL_ELEMENTS.converging;
    const focal = Number.isFinite(element.focal)
      ? Math.sign(element.focal) * (extras.focal ?? Math.abs(element.focal))
      : element.focal;
    const image = thinLens(focal, value);
    const mirror = element.mirror;
    const parallel = !Number.isFinite(image.distance);
    return [
      {
        label: 'Image forms',
        value: parallel
          ? 'Nowhere'
          : image.real
            ? `${Math.round(image.distance)} mm ${mirror ? 'in front' : 'beyond'}`
            : `${Math.round(-image.distance)} mm ${mirror ? 'behind the mirror' : 'back on this side'}`,
        hint: parallel
          ? 'the object is at the focal point, so the rays leave parallel and never meet'
          : image.real
            ? 'where the rays actually cross, so it can be caught on a screen'
            : 'the rays only appear to come from there, so it can be looked at but not projected',
      },
      {
        label: 'Size',
        value: parallel ? 'None' : `${Math.abs(image.magnification).toFixed(2)}×`,
        hint: parallel
          ? 'no image, so no size'
          : image.magnification < 0
            ? 'upside down, which is what a real image always is for a single element'
            : 'upright, which a virtual image always is for a single element',
      },
      {
        label: 'Kind',
        value: parallel ? 'None' : image.real ? 'Real' : 'Virtual',
        hint: 'it changes over exactly at the focal point, and nowhere else',
      },
      {
        label: 'Focal length',
        value: Number.isFinite(focal) ? `${focal} mm` : 'None',
        hint: Number.isFinite(focal)
          ? focal > 0
            ? 'where this element brings parallel light to a point, which is the only property of it that matters here'
            : 'negative, because this element spreads light rather than gathering it, and parallel light only seems to come from that point'
          : 'a flat surface bends nothing, so there is no point for parallel light to reach',
      },
    ];
  },
  photography: (value, variant, extras) => {
    const fNumber = STOPS[Math.round(value)];
    const iso = variant === 'iso800' ? 800 : 100;
    const seconds = exposureTime(fNumber, iso);
    const subject = extras.subject ?? SUBJECT;
    const field = depthOfField(CAMERA_LENS, fNumber, subject);
    return [
      {
        label: 'Light admitted',
        value: `${(apertureLight(fNumber) / apertureLight(8)).toFixed(2)}×`,
        hint: 'against f/8, and it goes with one over the square of the f number',
      },
      {
        label: 'Shutter to match',
        value: seconds >= 1 ? `${seconds.toFixed(1)} s` : `1/${Math.round(1 / seconds)} s`,
        hint: `at ISO ${iso}, for the exposure f/8 and a hundred and twenty fifth would have given at ISO 100`,
      },
      {
        label: `Sharp band at ${(subject / 1000).toFixed(1)} m`,
        value: Number.isFinite(field.far) ? metric(field.depth / 1000) : 'To the horizon',
        hint: Number.isFinite(field.far)
          ? `from ${metric(field.near / 1000)} to ${metric(field.far / 1000)}, on a ${CAMERA_LENS} mm lens`
          : `everything past ${metric(field.near / 1000)} falls inside the accepted blur`,
      },
      {
        label: 'From f/8',
        value: `${stopsBetween(8, fNumber) > 0 ? '+' : ''}${stopsBetween(8, fNumber).toFixed(1)} stops`,
        hint: 'one stop is a factor of two in light, either way',
      },
    ];
  },
  printing: (value, variant, extras) => {
    const pitch = dotPitch(value);
    const seen = angularSize(pitch, READING_DISTANCE);
    return [
      {label: 'Dot spacing', value: `${pitch.toFixed(3)} mm`, hint: 'one dot to the next, whatever size the dots themselves are'},
      {
        label: 'At arm’s length',
        value: seen > EYE_LIMIT ? 'Dots show' : 'Reads as tone',
        hint: `${seen.toFixed(2)} minutes of arc at ${READING_DISTANCE} mm, and the eye separates about ${EYE_LIMIT}`,
      },
      {
        label: `A ${Math.round(Math.min(98, 40 * ((extras.ink ?? 100) / 100)))}% dot reflects`,
        value: percent(halftoneTint(Math.min(0.98, 0.4 * ((extras.ink ?? 100) / 100)))),
        hint: `of the light falling on it, against ${percent(0.9)} for the bare sheet: solid ink over four tenths of the area and paper over the rest`,
      },
      {
        label: 'Screen angles',
        value: variant === 'black' ? 'One, at 45°' : 'Four',
        hint:
          variant === 'black'
            ? 'nothing to clash with'
            : `${SCREEN_ANGLES}. A square lattice repeats every 90°, so cyan, magenta and black stand 30° apart; yellow takes a remaining 15° separation, and being the palest it shows the least for it`,
      },
    ];
  },
  'sound-and-music': (value, variant, extras) => {
    const tension = extras.tension ?? TENSION;
    // Sound travels about 0.6 m/s faster for every degree the air warms, which
    // is why an organ goes sharp as a hall fills and a string does not.
    const speed = SOUND_SPEED + 0.606 * ((extras.air ?? 20) - 20);
    const length = value / 1000;
    const full =
      variant === 'string' ? stringFrequency(0.65, tension, LINEAR_DENSITY) : pipeFrequency(0.65, variant === 'stopped') * (speed / SOUND_SPEED);
    const frequency =
      variant === 'string'
        ? stringFrequency(length, tension, LINEAR_DENSITY)
        : pipeFrequency(length, variant === 'stopped') * (speed / SOUND_SPEED);
    const steps = semitonesFrom(full, frequency);
    return [
      {
        label: 'Frequency',
        value: `${frequency.toFixed(1)} Hz`,
        hint:
          variant === 'string'
            ? `on ${tension} N of tension and ${LINEAR_DENSITY * 1000} g of wire per meter, and the note goes with the square root of the tension`
            : variant === 'stopped'
              ? 'a stopped pipe fits a quarter of a wave, so it sounds an octave below an open one'
              : 'an open pipe fits half a wave between its ends',
      },
      {label: 'Nearest note', value: noteName(frequency), hint: 'to the nearest semitone, counting from A above middle C at 440 Hz'},
      {
        label: 'Wavelength in air',
        value: metric(wavelength(speed, frequency)),
        hint: `sound covers ${Math.round(speed)} meters a second in air at this temperature, so a low note is measured in meters and a high one in centimeters`,
      },
      {
        label: 'From full length',
        value: `${steps > 0 ? '+' : ''}${steps.toFixed(1)} semitones`,
        hint: 'halving the length is twelve of them, which is one octave, wherever you start',
      },
    ];
  },
  telecommunications: (value, variant, extras) => {
    const hertz = 10 ** value;
    const band = radioBand(hertz);
    return [
      {
        label: 'Wavelength',
        value: metric(wavelength(LIGHT_SPEED, hertz)),
        hint: 'the speed of light divided by the frequency, and it decides everything else here',
      },
      {
        label: 'Quarter wave antenna',
        value: metric(quarterWave(hertz)),
        hint: 'a conductor much shorter than this radiates very little of what it is given',
      },
      {label: 'Band', value: band.name, hint: `${formatFrequency(hertz)}, in the ${band.name.toLowerCase()} range`},
      {
        label: 'Carrier against message',
        value: `${Math.round((FEWEST_CYCLES + ((value - 5.3) / 4) * (MOST_CYCLES - FEWEST_CYCLES)) / (extras.message ?? 1.5))}\u00d7`,
        hint: 'how many times faster the carrier runs than the thing it carries. A carrier only a few times faster than its message is barely a carrier at all, and the transmission takes a band about twice the message wide either side of it',
      },
      {
        label: 'How it travels',
        value: band.travel,
        hint: variant === 'fm' ? `${band.note}; the signal is in the rate, so noise in the height is ignored` : band.note,
      },
    ];
  },
  electricity: (value, variant, extras) => {
    const parallel = variant === 'parallel';
    const total = parallel ? parallelResistance([value, value]) : value;
    const volts = extras.volts ?? SUPPLY_VOLTS;
    const current = ohmsCurrent(volts, total);
    return [
      {
        label: 'Total resistance',
        value: `${total.toFixed(1)} Ω`,
        hint: parallel
          ? 'two equal branches side by side come to half of one of them, because the current has two ways to go'
          : 'the one resistance is the whole of the circuit here',
      },
      {
        label: 'Current',
        value: `${current.toFixed(2)} A`,
        hint: `the supply voltage divided by the resistance, which is Ohm's law`,
      },
      {
        label: 'Power',
        value: `${electricalPower(volts, current).toFixed(1)} W`,
        hint: 'volts times amps: energy per charge times charge per second is energy per second. Halve the supply and the current halves with it, so the power falls to a quarter, which is why the lamp dims so much faster than the voltage does',
      },
      {
        label: 'Electrons past a point',
        value: `${(electronsPerSecond(current) / 1e18).toFixed(1)} × 10¹⁸ each second`,
        hint: 'a current of one amp is about six million million million electrons a second',
      },
      {
        label: 'How fast they drift',
        value: `${(driftSpeed(current / (parallel ? 2 : 1), WIRE_AREA_MM2) * 1000).toFixed(3)} mm/s`,
        hint: `in one branch of ${WIRE_AREA_MM2} mm² copper: the push arrives at nearly the speed of light, the electrons crawl`,
      },
    ];
  },
  magnetism: (value, variant, extras) => {
    const iron = variant === 'iron';
    const turns = extras.turns ?? COIL_TURNS;
    const field = solenoidField(turns, COIL_LENGTH_M, value, iron ? IRON_PERMEABILITY : 1);
    return [
      {
        label: 'Field in the coil',
        value: field >= 0.1 ? `${field.toFixed(3)} T` : `${(field * 1000).toFixed(2)} mT`,
        hint: iron
          ? `the air core figure multiplied by ${IRON_PERMEABILITY}, which holds only until the iron saturates`
          : 'the magnetic constant times the turns per meter times the current, for the inside of a long coil',
      },
      {
        label: 'Turns per meter',
        value: `${Math.round(turns / COIL_LENGTH_M)}`,
        hint: 'this, and not the number of turns on its own, is what sets the field',
      },
      {
        label: 'Push on a wire across it',
        value: `${forceOnWire(field, 1, TEST_WIRE_M).toFixed(3)} N`,
        hint: `on ${TEST_WIRE_M * 1000} mm of wire carrying one amp: field times current times length, which is the motor effect`,
      },
      {
        label: 'For comparison',
        value: field > 0.5 ? 'Near a scanner magnet' : field > 0.005 ? 'Near a fridge magnet' : 'Under a fridge magnet',
        hint: 'a fridge magnet is around 5 mT at its face and a medical scanner runs at 1.5 T or more',
      },
    ];
  },
  'electric-motors': (value, variant, extras) => {
    const fieldT = (extras.field ?? MOTOR_FIELD * 100) / 100;
    const peak = motorTorque(MOTOR_TURNS, fieldT, value, MOTOR_AREA_M2, 0);
    const back = inducedEmfPeak(MOTOR_TURNS, fieldT, MOTOR_AREA_M2, MOTOR_RPM / 60);
    return [
      {
        label: 'Twist, flat along the field',
        value: `${peak.toFixed(3)} N·m`,
        hint: 'turns times field times current times area, at the angle where the two side forces have their longest levers',
      },
      {
        label: 'Force on each side',
        value: `${forceOnWire(fieldT, value, MOTOR_SIDE_M * MOTOR_TURNS).toFixed(2)} N`,
        hint: `${MOTOR_TURNS} turns of ${MOTOR_SIDE_M * 1000} mm in the gap; the two sides are pushed opposite ways, so they twist rather than shove`,
      },
      {
        label: 'Twist at the dead point',
        value: variant === 'commutator' ? 'Carried through' : 'Zero, then reversed',
        hint:
          variant === 'commutator'
            ? 'the split ring swaps the current there, so the coil is pushed onward rather than pulled back'
            : 'with no reversal the coil swings to the upright position and is pushed back if it passes it',
      },
      {
        label: `Back voltage at ${MOTOR_RPM.toLocaleString('en-US')} rpm`,
        value: `${back.toFixed(1)} V peak`,
        hint: 'the motor generating against its own supply, which is why a stalled motor draws far more current than a running one',
      },
    ];
  },
  'generators-and-transformers': (value, variant, extras) => {
    const rateHz = extras.rate ?? GEN_RATE_HZ;
    if (variant === 'transformer') {
      const volts = transformerVolts(PRIMARY_VOLTS, PRIMARY_TURNS, value);
      const amps = transformerAmps(PRIMARY_AMPS, PRIMARY_TURNS, value);
      const power = PRIMARY_VOLTS * PRIMARY_AMPS;
      return [
        {
          label: 'Secondary voltage',
          value: `${volts.toFixed(1)} V`,
          hint: `the primary voltage in the ratio of the turns, from ${PRIMARY_TURNS} to ${value}`,
        },
        {
          label: 'Secondary current',
          value: `${amps.toFixed(2)} A`,
          hint: 'the other half of the bargain: more volts means proportionally fewer amps',
        },
        {
          label: 'Power through',
          value: `${power.toFixed(0)} W both sides`,
          hint: 'ideal, with no losses in the core or the windings; a real transformer is 95 to 99 percent through',
        },
        {
          label: `Wasted in a ${LINE_OHMS} Ω line`,
          value: `${lineLoss(power, volts, LINE_OHMS).toFixed(1)} W`,
          hint: 'the current squared times the resistance, so ten times the voltage wastes a hundredth as much',
        },
      ];
    }
    const peak = inducedEmfPeak(value, GEN_FIELD, GEN_AREA_M2, rateHz);
    return [
      {
        label: 'Peak voltage',
        value: `${peak.toFixed(0)} V`,
        hint: `turns times field times area times the angular rate, in a ${GEN_FIELD} T field over ${GEN_AREA_M2 * 1e4} cm²`,
      },
      {
        label: 'Steady value',
        value: `${sineRms(peak).toFixed(0)} V`,
        hint: 'the peak divided by the square root of two, which is the figure a meter shows and a supply is named by',
      },
      {
        label: 'Frequency',
        value: `${rateHz} Hz`,
        hint: 'one cycle for each turn of the coil, so the turning rate is the frequency',
      },
      {
        label: 'Standing still',
        value: 'No voltage at all',
        hint: 'only change generates; a coil at rest in the strongest field there is makes nothing',
      },
    ];
  },
  'sensors-and-detectors': (value, variant, extras) => {
    const here = sensorReading(value, variant);
    const step = sensorReading(value + 1, variant);
    const rows: Reading[] = [
      {label: 'The sensor reads', value: here.value, hint: here.law},
    ];
    if (variant === 'thermocouple') {
      rows.push(
        {
          label: 'Change per degree',
          value: `${SEEBECK_UV} µV`,
          hint: 'small enough that the amplifier, not the junction, usually decides how good the reading is',
        },
        {
          label: 'Needs a supply',
          value: 'None',
          hint: 'the junction makes its own voltage, which is why a thermocouple works in places nothing else survives',
        },
      );
    } else {
      const fixed = (variant === 'platinum' ? FIXED_HALF.platinum : FIXED_HALF.thermistor) * ((extras.fixed ?? 100) / 100);
      const output = dividerVoltage(SENSOR_SUPPLY, fixed, here.ohms);
      rows.push(
        {
          label: 'Voltage at the middle',
          value: `${output.toFixed(3)} V`,
          hint: `the ${SENSOR_SUPPLY} V supply split between the sensor and a fixed ${fixed >= 1000 ? `${(fixed / 1000).toFixed(1)} kΩ` : `${Math.round(fixed)} Ω`}. Matched to the sensor the reading sweeps; far from it the middle pins against a rail and nothing moves`,
        },
        {
          label: 'Change per degree',
          value: `${Math.abs(step.ohms - here.ohms).toFixed(2)} Ω`,
          hint: variant === 'platinum'
            ? 'the same at every temperature in this linear model, which is what makes a straight line worth having'
            : 'far larger than platinum manages here, but it changes with temperature, so the scale is not even',
        },
      );
    }
    rows.push({
      label: 'Good for',
      value:
        variant === 'thermocouple' ? 'Very wide spans' : variant === 'platinum' ? 'Accuracy over a range' : 'Sensitivity near a point',
      hint:
        variant === 'thermocouple'
          ? 'hundreds of degrees either side of the range on this slider, at the cost of a tiny signal'
          : variant === 'platinum'
            ? 'the reference sensor of choice, because its curve is nearly straight and it drifts very little'
            : 'cheap and sharp near the temperature it was chosen for, and poor far from it',
    });
    return rows;
  },
  'making-bits': (value, variant, extras) => {
    const toneHz = (extras.tone ?? 12) * 1000;
    const bits = Number(variant);
    const rate = value * 1000;
    const folded = aliasFrequency(toneHz, rate);
    const captured = rate > nyquistRate(toneHz);
    const stream = sampleBitrate(rate, bits, AUDIO_CHANNELS);
    return [
      {
        label: 'The tone survives',
        value: captured
          ? 'Yes'
          : rate === nyquistRate(toneHz)
            ? 'At the boundary'
            : folded === 0
              ? 'No, it stores a constant'
              : `No, it folds to ${(folded / 1000).toFixed(1)} kHz`,
        hint: captured
          ? `above twice the ${toneHz / 1000} kHz tone, so the samples pin it down completely`
          : rate === nyquistRate(toneHz)
            ? 'exactly twice the tone, which is not enough: at the boundary the samples cannot recover the height or the timing, and this tone samples to nothing at all'
            : folded === 0
              ? 'every sample catches the same point of the wave, so what is stored is one unchanging value rather than any tone'
              : 'below twice the tone, so it arrives as a different, lower frequency that nothing later can separate from a real one',
      },
      {
        label: 'Levels',
        value: quantizationLevels(bits).toLocaleString('en-US'),
        hint: `two to the ${bits}; rounding to the nearest of them leaves an error of at most half a step, so long as the signal stays inside the ladder. This bench drives it to full scale, where the top rung is half a step short of the peak, and the positive crests clip against it`,
      },
      {
        label: 'Best signal to noise',
        value: `${quantizationSnr(bits).toFixed(1)} dB`,
        hint: 'about six decibels for each bit, for a full scale sine wave under the usual assumption that the rounding error is spread evenly and unrelated to the signal. A quieter signal does worse, having fewer rungs to itself; a signal that happens to sit on the rungs, a square wave alternating between two of them, has no rounding error at all',
      },
      {
        label: 'Data rate',
        value: bitrate(stream),
        hint: `${AUDIO_CHANNELS} channels at ${value} thousand samples a second of ${bits} bits`,
      },
      {
        label: 'A minute of it',
        value: bytes((stream * 60) / 8),
        hint: 'before any compression or error correction is added',
      },
    ];
  },
  'storing-bits': (value, variant, extras) => {
    const band = extras.band ?? BAND_MM;
    const rpm = Number(variant);
    const tracks = Math.round(value * band);
    const perTrack = trackCapacity(SECTORS, SECTOR_BYTES);
    return [
      {
        label: 'Tracks',
        value: tracks.toLocaleString('en-US'),
        hint: `${value} per mm across the ${band} mm band, on each of ${SURFACES} surfaces`,
      },
      {
        label: 'Capacity',
        value: bytes(tracks * perTrack * SURFACES),
        hint: `${SECTORS} sectors of ${SECTOR_BYTES} bytes on every track, which is the simple scheme rather than a real drive's`,
      },
      {
        label: 'Average wait for a sector',
        value: seconds(rotationalLatency(rpm)),
        hint: 'half a turn, which depends on the spin rate and on nothing else at all',
      },
      {
        label: 'Read from one track',
        value: `${bytes(transferRate(perTrack, rpm))}/s`,
        hint: 'the whole track passes the head once per revolution',
      },
      {
        label: 'Track pitch',
        value: `${(1000 / value).toFixed(1)} µm`,
        hint: 'a human hair is about 70 µm across, and a modern drive works far finer than the finest setting here',
      },
    ];
  },
  'processing-bits': (value, variant, extras) => {
    const lookahead = variant === 'lookahead';
    const delay = lookahead ? lookaheadDelay(value, GATE_DELAY) : rippleCarryDelay(value, GATE_DELAY);
    const largest = maxUnsigned(value);
    // The same two operands the bench draws, worked out the same way.
    const a = Math.floor(largest * 0.6);
    const b = Math.min(largest, Math.round(largest * ((extras.addend ?? 45) / 100)));
    const total = a + b;
    const fits = total <= largest;
    return [
      {
        label: 'The sum on the bench',
        value: `${a.toLocaleString('en-US')} + ${b.toLocaleString('en-US')} = ${total.toLocaleString('en-US')}`,
        hint: fits
          ? `which fits, and reads ${binaryString(total, value)} across the bottom row`
          : `which does not fit: the bottom row wraps to ${binaryString(total - largest - 1, value)} and the carry out lights`,
      },
      {
        label: 'Counts to',
        value: largest.toLocaleString('en-US'),
        hint: `two to the ${value}, less one, because zero takes one of the patterns; the count of patterns doubles with each bit, and the largest value goes from two to the n less one to twice that and one more`,
      },
      {
        label: 'Unsigned overflow',
        value: fits ? 'None' : 'Carry out set',
        hint: 'this bench counts from zero upward; a machine reading the same bits as signed would flag a different condition, and the two are not the same test',
      },
      {
        label: 'Time for the carry',
        value: seconds(delay),
        hint: lookahead
          ? 'a tree of two gate delays per level, plus one at each end: a model of the usual arrangement, not a measurement'
          : 'two gate delays for each stage in turn, at one nanosecond a gate',
      },
      {
        label: 'Additions a second',
        value: `${(1 / delay / 1e6).toFixed(1)} million`,
        hint: 'if nothing else took any time, which in a real processor is far from true',
      },
      {
        label: 'Widening to 16 bits',
        value: lookahead ? `${(lookaheadDelay(16, GATE_DELAY) / delay).toFixed(2)}× the wait` : `${(rippleCarryDelay(16, GATE_DELAY) / delay).toFixed(2)}× the wait`,
        hint: lookahead ? 'the logarithm grows slowly, so width costs very little here' : 'the wait grows in step with the width, which is the whole problem',
      },
    ];
  },
  'sending-bits': (value, variant, extras) => {
    const bandwidth = (variant === 'fiber' ? 1e10 : variant === 'radio' ? 2e5 : 3100) * ((extras.share ?? 100) / 100);
    const ratio = powerRatio(value);
    const capacity = shannonCapacity(bandwidth, ratio);
    return [
      {
        label: 'Bandwidth',
        value: bandwidth >= 1e9 ? `${bandwidth / 1e9} GHz` : bandwidth >= 1e3 ? `${(bandwidth / 1e3).toFixed(1)} kHz` : `${bandwidth} Hz`,
        hint: 'a width in hertz, not a speed: it sets how quickly the signal is allowed to change',
      },
      {
        label: 'Capacity',
        value: bitrate(capacity),
        hint: 'bandwidth times the logarithm to base two of one plus the power ratio, and no code of any kind gets past it',
      },
      {
        label: 'A 3 MB photograph',
        value: capacity > 0 ? seconds(transferSeconds(PHOTO_BYTES, capacity)) : 'Never',
        hint: 'at the limit exactly, ignoring every overhead a real link carries',
      },
      {
        label: 'One more bit of headroom',
        value: `${(shannonCapacity(bandwidth, powerRatio(value + 3)) - capacity > 0 ? bitrate(shannonCapacity(bandwidth, powerRatio(value + 3)) - capacity) : '0')} for 3 dB`,
        hint: 'doubling the signal power buys about one bit per second per hertz, and no more, because the ratio sits inside a logarithm',
      },
    ];
  },
  'using-bits': (value, variant, extras) => {
    const fps = extras.fps ?? FRAME_RATE;
    const bits = Number(variant);
    const pixels = value * frameHeight(value);
    const perFrame = frameBytes(pixels, bits * 3);
    const stream = videoBitrate(perFrame, fps);
    return [
      {
        label: 'Pixels',
        value: pixels.toLocaleString('en-US'),
        hint: `${value} across by ${frameHeight(value)} down, at sixteen to nine`,
      },
      {
        label: 'Colors',
        value: colorCount(bits).toLocaleString('en-US'),
        hint: `two to the ${bits * 3}: ${bits} bits for each of red, green and blue`,
      },
      {
        label: 'One frame',
        value: bytes(perFrame),
        hint: 'uncompressed, which is what the cable from a computer to a monitor usually carries even when the file it came from was compressed. The bar on the bench is drawn on the logarithm of this figure, over the three decades the slider spans, so its length is an order of magnitude rather than a proportion',
      },
      {
        label: `At ${fps} frames a second`,
        value: bitrate(stream),
        hint: 'raw video, which a display cable carries happily and a network connection never does',
      },
      {
        label: 'Compression needed',
        value: `${Math.round(stream / STREAM_BITS)}× to fit ${bitrate(STREAM_BITS)}`,
        hint: 'to send it over a network at a common streaming rate, mostly bought by sending the differences between frames rather than the frames; whether a given picture survives that is another question',
      },
    ];
  },
};

export const readings = (
  topic: TopicId,
  value: number,
  variant: string,
  extras: Record<string, number> = {},
): Reading[] =>
  readingsFor[topic](value, variant, extras);
