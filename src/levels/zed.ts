import { LevelDef } from '../LevelDef';

export const zedLevel: LevelDef = {
  id: 'zed',
  label: 'Zed',
  type: 'field',
  imageUrl: '/field-images/zed.png',
  look: 'neon',
  coinConfig: { radius: 7, kickPower: 1.0, drag: 4.2 },
  boundary: [
    { x: 760, y: 100 },
    { x: 740, y: 20 },
    { x: 500, y: 0 },
    { x: 340, y: 60 },
    { x: 200, y: 0 },
    { x: 0, y: 20 },
    { x: 20, y: 260 },
    { x: 440, y: 540 },
    { x: 240, y: 700 },
    { x: 40, y: 580 },
    { x: 40, y: 600 },
    { x: 40, y: 700 },
    { x: 60, y: 780 },
    { x: 300, y: 800 },
    { x: 460, y: 740 },
    { x: 600, y: 800 },
    { x: 800, y: 780 },
    { x: 780, y: 540 },
    { x: 360, y: 260 },
    { x: 560, y: 100 },
    { x: 760, y: 220 },
    { x: 760, y: 200 },
  ],
  blockers: [
    [
      { x: 240, y: 220 },
      { x: 200, y: 240 },
      { x: 260, y: 360 },
      { x: 280, y: 160 },
    ],
    [
      { x: 100, y: 100 },
      { x: 140, y: 100 },
      { x: 200, y: 80 },
      { x: 80, y: 60 },
    ],
  ],
  ellipses: [],
  goals: [
    {
      leftBase:  { x: 760, y: 179 },  rightBase: { x: 760, y: 111 },
      leftTip:   { x: 754, y: 183 },   rightTip:  { x: 754, y: 115 },
      scorer: 0,
    },
    {
      leftBase:  { x: 40, y: 621 },  rightBase: { x: 40, y: 689 },
      leftTip:   { x: 46, y: 617 },   rightTip:  { x: 46, y: 685 },
      scorer: 1,
    },
  ],
  start: [
    { x: 360, y: 700 },
    { x: 440, y: 660 },
    { x: 500, y: 700 },
  ],
};

export default zedLevel;
