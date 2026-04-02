import { LevelDef } from '../LevelDef';

export const alienLevel: LevelDef = {
  id: 'alien',
  label: 'Alien',
  type: 'field',
  imageUrl: '/field-images/alien.png',
  look: 'neon',
  coinConfig: { radius: 10, kickPower: 1.0, drag: 5.0 },
  boundary: [
    { x: 320, y: 20 },
    { x: 200, y: 20 },
    { x: 20, y: 100 },
    { x: 20, y: 180 },
    { x: 320, y: 380 },
    { x: 320, y: 420 },
    { x: 20, y: 620 },
    { x: 20, y: 700 },
    { x: 200, y: 780 },
    { x: 320, y: 780 },
    { x: 480, y: 780 },
    { x: 600, y: 780 },
    { x: 780, y: 700 },
    { x: 780, y: 620 },
    { x: 480, y: 420 },
    { x: 480, y: 380 },
    { x: 780, y: 180 },
    { x: 780, y: 100 },
    { x: 600, y: 20 },
    { x: 480, y: 20 },
  ],
  blockers: [],
  ellipses: [
    { x: 260, y: 180, rx: 36, ry: 23, angle: 2.3213 },
    { x: 540, y: 180, rx: 36, ry: 23, angle: 0.9250 },
    { x: 400, y: 280, rx: 63, ry: 23, angle: 0.0000 },
    { x: 140, y: 140, rx: 23, ry: 14, angle: 1.5708 },
    { x: 660, y: 120, rx: 23, ry: 14, angle: 1.5708 },
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
    { x: 400, y: 680 },
    { x: 320, y: 580 },
    { x: 500, y: 580 },
  ],
};

export default alienLevel;
