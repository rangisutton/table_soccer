import { LevelDef } from '../LevelDef';

export const fooLevel: LevelDef = {
  id: 'foo',
  label: 'foo',
  type: 'field',
  boundary: [
    { x: 300, y: 40 },
    { x: 20, y: 40 },
    { x: 0, y: 140 },
    { x: 60, y: 260 },
    { x: 0, y: 300 },
    { x: 0, y: 480 },
    { x: 60, y: 520 },
    { x: 0, y: 620 },
    { x: 0, y: 760 },
    { x: 280, y: 760 },
    { x: 500, y: 760 },
    { x: 780, y: 760 },
    { x: 800, y: 660 },
    { x: 740, y: 540 },
    { x: 800, y: 500 },
    { x: 800, y: 320 },
    { x: 740, y: 280 },
    { x: 800, y: 180 },
    { x: 800, y: 40 },
    { x: 520, y: 40 },
  ],
  blockers: [],
  ellipses: [
    { x: 603, y: 533, rx: 60, ry: 34, angle: 0.9948 },
    { x: 480, y: 320, rx: 60, ry: 60, angle: 0.0000 },
    { x: 167, y: 581, rx: 52, ry: 25, angle: 1.8675 },
    { x: 305, y: 147, rx: 52, ry: 25, angle: 1.8675 },
  ],
  goals: [
    {
      leftBase:  { x: 456, y: 40 },  rightBase: { x: 365, y: 40 },
      leftTip:   { x: 454, y: 81 },   rightTip:  { x: 363, y: 81 },
      scorer: 0,
    },
    {
      leftBase:  { x: 345, y: 760 },  rightBase: { x: 436, y: 760 },
      leftTip:   { x: 346, y: 719 },   rightTip:  { x: 437, y: 719 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 670 },
    { x: 377, y: 616 },
    { x: 423, y: 616 },
  ],
};

export default fooLevel;
