import type {TopicId} from '../topics.ts';
import type {Mechanism} from './kit.ts';
import {buildInclinedPlane} from './mechanisms/inclined-plane.ts';
import {buildLever} from './mechanisms/levers.ts';
import {buildWheelAndAxle} from './mechanisms/wheel-and-axle.ts';
import {buildGearsAndBelts} from './mechanisms/gears-and-belts.ts';
import {buildCamsAndCranks} from './mechanisms/cams-and-cranks.ts';
import {buildPulleys} from './mechanisms/pulleys.ts';
import {buildScrews} from './mechanisms/screws.ts';
import {buildRotatingWheels} from './mechanisms/rotating-wheels.ts';
import {buildSprings} from './mechanisms/springs.ts';
import {buildFriction} from './mechanisms/friction.ts';
import {buildFloating} from './mechanisms/floating.ts';
import {buildFlying} from './mechanisms/flying.ts';
import {buildPressurePower} from './mechanisms/pressure-power.ts';
import {buildExploitingHeat} from './mechanisms/exploiting-heat.ts';
import {buildNuclearPower} from './mechanisms/nuclear-power.ts';
import {buildLightAndImages} from './mechanisms/light-and-images.ts';
import {buildPhotography} from './mechanisms/photography.ts';
import {buildPrinting} from './mechanisms/printing.ts';
import {buildSoundAndMusic} from './mechanisms/sound-and-music.ts';
import {buildTelecommunications} from './mechanisms/telecommunications.ts';
import {buildElectricity} from './mechanisms/electricity.ts';
import {buildMagnetism} from './mechanisms/magnetism.ts';
import {buildElectricMotors} from './mechanisms/electric-motors.ts';
import {buildGeneratorsAndTransformers} from './mechanisms/generators-and-transformers.ts';
import {buildSensorsAndDetectors} from './mechanisms/sensors-and-detectors.ts';
import {buildMakingBits} from './mechanisms/making-bits.ts';
import {buildStoringBits} from './mechanisms/storing-bits.ts';
import {buildProcessingBits} from './mechanisms/processing-bits.ts';
import {buildSendingBits} from './mechanisms/sending-bits.ts';
import {buildUsingBits} from './mechanisms/using-bits.ts';

export type {Mechanism, MechanismState} from './kit.ts';

const builders: Record<TopicId, () => Mechanism> = {
  'inclined-plane': buildInclinedPlane,
  levers: buildLever,
  'wheel-and-axle': buildWheelAndAxle,
  'gears-and-belts': buildGearsAndBelts,
  'cams-and-cranks': buildCamsAndCranks,
  pulleys: buildPulleys,
  screws: buildScrews,
  'rotating-wheels': buildRotatingWheels,
  springs: buildSprings,
  friction: buildFriction,
  floating: buildFloating,
  flying: buildFlying,
  'pressure-power': buildPressurePower,
  'exploiting-heat': buildExploitingHeat,
  'nuclear-power': buildNuclearPower,
  'light-and-images': buildLightAndImages,
  photography: buildPhotography,
  printing: buildPrinting,
  'sound-and-music': buildSoundAndMusic,
  telecommunications: buildTelecommunications,
  electricity: buildElectricity,
  magnetism: buildMagnetism,
  'electric-motors': buildElectricMotors,
  'generators-and-transformers': buildGeneratorsAndTransformers,
  'sensors-and-detectors': buildSensorsAndDetectors,
  'making-bits': buildMakingBits,
  'storing-bits': buildStoringBits,
  'processing-bits': buildProcessingBits,
  'sending-bits': buildSendingBits,
  'using-bits': buildUsingBits,
};

export const createMechanism = (topic: TopicId) => builders[topic]();
