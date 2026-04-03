import { LevelDef } from '../LevelDef';

export const poolTableTestLevel: LevelDef = {
  id: 'pool-table-test',
  label: 'Pool Table Test',
  type: 'field',
  imageUrl: '/field-images/pool-table.png',
  look: 'ambient',
  coinConfig: { radius: 12, kickPower: 1.2, drag: 3.1 },
  boundary: [
    { x: 280, y: 20 },
    { x: 100, y: 20 },
    { x: 100, y: 780 },
    { x: 280, y: 780 },
    { x: 520, y: 780 },
    { x: 700, y: 780 },
    { x: 700, y: 20 },
    { x: 520, y: 20 },
  ],
  polys: [],
  ellipses: [
    { x: 99, y: 398, rx: 20, ry: 20, angle: 0.0000 },
    { x: 100, y: 20, rx: 20, ry: 20, angle: 0.0000 },
    { x: 700, y: 20, rx: 20, ry: 20, angle: 0.0000 },
    { x: 258, y: 524, rx: 11, ry: 11, angle: 0.0000 },
    { x: 294, y: 503, rx: 11, ry: 11, angle: 0.0000 },
    { x: 600, y: 641, rx: 11, ry: 11, angle: 0.0000 },
    { x: 639, y: 547, rx: 11, ry: 11, angle: 0.0000 },
    { x: 334, y: 744, rx: 11, ry: 11, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 433, y: 20 },  rightBase: { x: 367, y: 20 },
      leftTip:   { x: 433, y: 35 },   rightTip:  { x: 367, y: 35 },
      scorer: 0,
    },
    {
      leftBase:  { x: 367, y: 780 },  rightBase: { x: 433, y: 780 },
      leftTip:   { x: 367, y: 765 },   rightTip:  { x: 433, y: 765 },
      scorer: 1,
    },
  ],
  start: [
    { x: 399, y: 704 },
    { x: 381, y: 672 },
    { x: 412, y: 671 },
  ],
};

export default poolTableTestLevel;
