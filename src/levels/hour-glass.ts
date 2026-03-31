import { LevelDef } from '../LevelDef';

export const hourGlassLevel: LevelDef = {
  id: 'hour-glass',
  label: 'Hour Glass',
  type: 'field',
  boundary: [
    { x: 320, y: 20 },
    { x: 80, y: 40 },
    { x: 0, y: 140 },
    { x: 260, y: 320 },
    { x: 0, y: 700 },
    { x: 0, y: 700 },
    { x: 40, y: 760 },
    { x: 320, y: 780 },
    { x: 480, y: 780 },
    { x: 720, y: 760 },
    { x: 800, y: 660 },
    { x: 540, y: 480 },
    { x: 800, y: 100 },
    { x: 800, y: 100 },
    { x: 760, y: 40 },
    { x: 480, y: 20 },
  ],
  blockers: [],
  ellipses: [
    { x: 263, y: 553, rx: 36, ry: 23, angle: 2.3213 },
    { x: 560, y: 640, rx: 36, ry: 23, angle: 0.9250 },
    { x: 254, y: 689, rx: 23, ry: 14, angle: 2.4086 },
    { x: 140, y: 620, rx: 23, ry: 14, angle: 1.5708 },
  ],
  goals: [
    {
      leftBase:  { x: 446, y: 20 },  rightBase: { x: 355, y: 20 },
      leftTip:   { x: 446, y: 61 },   rightTip:  { x: 355, y: 61 },
      scorer: 0,
    },
    {
      leftBase:  { x: 355, y: 780 },  rightBase: { x: 446, y: 780 },
      leftTip:   { x: 355, y: 739 },   rightTip:  { x: 446, y: 739 },
      scorer: 1,
    },
  ],
  start: [
    { x: 440, y: 620 },
    { x: 400, y: 600 },
    { x: 440, y: 580 },
  ],
};

export default hourGlassLevel;
