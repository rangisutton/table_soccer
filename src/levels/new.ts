import { LevelDef } from '../LevelDef';

export const newLevel: LevelDef = {
  id: 'new',
  label: 'new',
  type: 'field',
  boundary: [
    { x: 220, y: 80 },
    { x: 100, y: 80 },
    { x: 80, y: 400 },
    { x: 100, y: 700 },
    { x: 240, y: 720 },
    { x: 580, y: 720 },
    { x: 700, y: 720 },
    { x: 720, y: 400 },
    { x: 700, y: 100 },
    { x: 560, y: 80 },
  ],
  blockers: [
    [
      { x: 160, y: 220 },
      { x: 160, y: 340 },
      { x: 300, y: 320 },
      { x: 300, y: 220 },
      { x: 160, y: 220 },
    ],
  ],
  goals: [
    {
      leftBase:  { x: 430, y: 80 },  rightBase: { x: 350, y: 80 },
      leftTip:   { x: 432, y: 130 },   rightTip:  { x: 352, y: 130 },
      scorer: 0,
    },
    {
      leftBase:  { x: 370, y: 720 },  rightBase: { x: 450, y: 720 },
      leftTip:   { x: 368, y: 670 },   rightTip:  { x: 448, y: 670 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 644 },
    { x: 377, y: 590 },
    { x: 423, y: 590 },
  ],
};

export default newLevel;
