export type PartId = string;

export type Part = {
  id: PartId;
  name: string;
  role: string;
  /** What the piece is, in plain terms. */
  description: string;
  /** What it does while the machine runs. */
  principle: string;
};

export type Application = {name: string; note: string};

/** What the orange and steel arrows mean in a given studio. */
export type Legend = {effort?: string; delivered?: string; note?: string};

export const defaultLegend: Legend = {
  effort: 'effort you supply',
  delivered: 'force on the load',
  note: 'Arrow length is force.',
};

export type Reading = {label: string; value: string; hint?: string};

export type TopicId =
  | 'inclined-plane'
  | 'levers'
  | 'wheel-and-axle'
  | 'gears-and-belts'
  | 'cams-and-cranks'
  | 'pulleys'
  | 'screws'
  | 'rotating-wheels'
  | 'springs'
  | 'friction'
  | 'floating'
  | 'flying'
  | 'pressure-power'
  | 'exploiting-heat'
  | 'nuclear-power'
  | 'light-and-images'
  | 'photography'
  | 'printing'
  | 'sound-and-music'
  | 'telecommunications'
  | 'electricity'
  | 'magnetism'
  | 'electric-motors'
  | 'generators-and-transformers'
  | 'sensors-and-detectors'
  | 'making-bits'
  | 'storing-bits'
  | 'processing-bits'
  | 'sending-bits'
  | 'using-bits';

export type Topic = {
  id: TopicId;
  /** Chapter number, counted straight through the collection. */
  index: number;
  /** Which part the chapter belongs to. */
  part: PartNumber;
  name: string;
  category: string;
  tagline: string;
  /** One line under the animation on the gallery card. */
  blurb: string;
  /** Two or three sentences of plain description, shown in the studio. */
  summary: string;
  /** The physical bargain the machine strikes. */
  principle: string;
  parts: Part[];
  /**
   * What the arrows in this studio stand for. Most studies use the default
   * pair; some have no arrows at all, and some have arrows that are neither
   * effort nor load.
   */
  legend?: Legend | 'none';
  applications: Application[];
  facts: [string, string][];
};

export type PartNumber = 1 | 2 | 3 | 4 | 5;

export const parts: {number: PartNumber; name: string; strapline: string}[] = [
  {
    number: 1,
    name: 'The mechanics of movement',
    strapline: 'Force, distance and the bargain every machine strikes between them.',
  },
  {
    number: 2,
    name: 'Harnessing the elements',
    strapline: 'What water, air, heat and the nucleus will do once a machine is put in their way.',
  },
  {
    number: 3,
    name: 'Working with waves',
    strapline: 'Light, sound and radio: waves made, bent, counted and put to carrying messages.',
  },
  {
    number: 4,
    name: 'Electricity and automation',
    strapline: 'Charge on the move, the field it makes, and the machines that turn one into the other.',
  },
  {
    number: 5,
    name: 'The digital domain',
    strapline: 'Everything else written as numbers: made, kept, worked on, sent and read back.',
  },
];

import {part1} from './content/part1.ts';
import {part2} from './content/part2.ts';
import {part3} from './content/part3.ts';
import {part4} from './content/part4.ts';
import {part5} from './content/part5.ts';

export const topics: Topic[] = [...part1, ...part2, ...part3, ...part4, ...part5];

export const topicById = (id: string) => topics.find(t => t.id === id);

export const topicsInPart = (number: PartNumber) => topics.filter(t => t.part === number);

/** Chapters this study has not reached yet. All five parts are open. */
export const upcoming: {name: string; note: string}[] = [];

export const laterParts: string[] = [];
