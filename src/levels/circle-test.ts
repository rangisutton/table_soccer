import { LevelDef } from '../LevelDef';

export const circleTestLevel: LevelDef = {
  id: 'circle-test',
  label: 'Circle Test',
  type: 'field',
  boundary: [
    { x: 300, y: 40 },
    { x: 40, y: 80 },
    { x: 0, y: 400 },
    { x: 60, y: 760 },
    { x: 300, y: 760 },
    { x: 500, y: 760 },
    { x: 760, y: 720 },
    { x: 800, y: 400 },
    { x: 740, y: 40 },
    { x: 500, y: 40 },
  ],
  blockers: [],
  ellipses: [
    { x: 603, y: 533, rx: 60, ry: 34, angle: 0.9948 },
    { x: 464, y: 329, rx: 60, ry: 60, angle: 0.0000 },
    { x: 167, y: 581, rx: 52, ry: 25, angle: 1.8675 },
    { x: 305, y: 147, rx: 52, ry: 25, angle: 1.8675 },
  ],
  goals: [
    {
      leftBase:  { x: 446, y: 40 },  rightBase: { x: 355, y: 40 },
      leftTip:   { x: 446, y: 81 },   rightTip:  { x: 355, y: 81 },
      scorer: 0,
    },
    {
      leftBase:  { x: 355, y: 760 },  rightBase: { x: 446, y: 760 },
      leftTip:   { x: 355, y: 719 },   rightTip:  { x: 446, y: 719 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 670 },
    { x: 377, y: 616 },
    { x: 423, y: 616 },
  ],
};

export default circleTestLevel;
