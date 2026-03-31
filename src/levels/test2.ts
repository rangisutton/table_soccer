import { LevelDef } from '../LevelDef';

export const test2Level: LevelDef = {
  id: 'test2',
  label: 'test2',
  type: 'field',
  boundary: [
    { x: 240, y: 40 },
    { x: 40, y: 40 },
    { x: 40, y: 760 },
    { x: 240, y: 760 },
    { x: 560, y: 760 },
    { x: 760, y: 760 },
    { x: 760, y: 40 },
    { x: 560, y: 40 },
  ],
  blockers: [],
  goals: [
    {
      leftBase:  { x: 440, y: 40 },  rightBase: { x: 360, y: 40 },
      leftTip:   { x: 440, y: 90 },   rightTip:  { x: 360, y: 90 },
      scorer: 0,
    },
    {
      leftBase:  { x: 360, y: 760 },  rightBase: { x: 440, y: 760 },
      leftTip:   { x: 360, y: 710 },   rightTip:  { x: 440, y: 710 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 670 },
    { x: 377, y: 616 },
    { x: 423, y: 616 },
  ],
};

export default test2Level;
