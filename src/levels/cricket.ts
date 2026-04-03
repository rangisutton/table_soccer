import { LevelDef } from '../LevelDef';

export const cricketLevel: LevelDef = {
  id: 'cricket',
  label: 'Cricket',
  type: 'field',
  imageUrl: '/field-images/cricket.png',
  look: 'ambient',
  coinConfig: { radius: 7, kickPower: 1.0, drag: 4.5 },
  boundary: [
    { x: 360, y: 60 },
    { x: 300, y: 62 },
    { x: 203, y: 84 },
    { x: 134, y: 134 },
    { x: 91, y: 209 },
    { x: 75, y: 298 },
    { x: 72, y: 399 },
    { x: 74, y: 488 },
    { x: 88, y: 585 },
    { x: 125, y: 664 },
    { x: 201, y: 717 },
    { x: 304, y: 738 },
    { x: 360, y: 740 },
    { x: 440, y: 740 },
    { x: 500, y: 738 },
    { x: 597, y: 716 },
    { x: 666, y: 666 },
    { x: 709, y: 591 },
    { x: 725, y: 502 },
    { x: 728, y: 401 },
    { x: 726, y: 312 },
    { x: 712, y: 215 },
    { x: 675, y: 136 },
    { x: 599, y: 83 },
    { x: 496, y: 62 },
    { x: 440, y: 60 },
  ],
  polys: [
    { verts: [
      { x: 380, y: 400 },
      { x: 380, y: 300 },
      { x: 420, y: 300 },
      { x: 420, y: 400 },
    ] },
  ],
  ellipses: [
    { x: 400, y: 240, rx: 9, ry: 9, angle: 0.0000 },
    { x: 282, y: 173, rx: 9, ry: 9, angle: 0.0000 },
    { x: 246, y: 201, rx: 9, ry: 9, angle: 0.0000 },
    { x: 228, y: 248, rx: 9, ry: 9, angle: 0.0000 },
    { x: 140, y: 560, rx: 9, ry: 9, angle: 0.0000 },
    { x: 260, y: 498, rx: 9, ry: 9, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 424, y: 60 },  rightBase: { x: 376, y: 60 },
      leftTip:   { x: 424, y: 70 },   rightTip:  { x: 376, y: 70 },
      scorer: 0,
    },
    {
      leftBase:  { x: 376, y: 740 },  rightBase: { x: 424, y: 740 },
      leftTip:   { x: 376, y: 730 },   rightTip:  { x: 424, y: 730 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 680 },
    { x: 380, y: 640 },
    { x: 420, y: 640 },
  ],
};

export default cricketLevel;
