import { LevelDef } from '../LevelDef';

export const test3Level: LevelDef = {
  id: 'test3',
  label: 'test3',
  type: 'field',
  boundary: [
    { x: 240, y: 40 },
    { x: 40, y: 40 },
    { x: 40, y: 240 },
    { x: 360, y: 520 },
    { x: 160, y: 620 },
    { x: 160, y: 760 },
    { x: 560, y: 760 },
    { x: 760, y: 760 },
    { x: 760, y: 560 },
    { x: 440, y: 280 },
    { x: 640, y: 180 },
    { x: 640, y: 40 },
  ],
  blockers: [],
  goals: [
    {
      leftBase:  { x: 441, y: 40 },  rightBase: { x: 361, y: 40 },
      leftTip:   { x: 441, y: 90 },   rightTip:  { x: 361, y: 90 },
      scorer: 0,
    },
    {
      leftBase:  { x: 359, y: 760 },  rightBase: { x: 439, y: 760 },
      leftTip:   { x: 359, y: 710 },   rightTip:  { x: 439, y: 710 },
      scorer: 1,
    },
  ],
  start: [
    { x: 620, y: 700 },
    { x: 580, y: 680 },
    { x: 620, y: 660 },
  ],
};

export default test3Level;
