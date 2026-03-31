import { LevelDef } from '../LevelDef';

export const testLevel: LevelDef = {
  id: 'test',
  label: 'test',
  type: 'field',
  boundary: [
    { x: 340, y: 20 },
    { x: 60, y: 140 },
    { x: 60, y: 420 },
    { x: 80, y: 640 },
    { x: 280, y: 780 },
    { x: 460, y: 780 },
    { x: 740, y: 660 },
    { x: 740, y: 380 },
    { x: 720, y: 160 },
    { x: 520, y: 20 },
  ],
  blockers: [],
  goals: [
    {
      leftBase:  { x: 364, y: 780 },  rightBase: { x: 444, y: 780 },
      leftTip:   { x: 364, y: 730 },   rightTip:  { x: 444, y: 730 },
      scorer: 0,
    },
    {
      leftBase:  { x: 436, y: 20 },  rightBase: { x: 356, y: 20 },
      leftTip:   { x: 436, y: 70 },   rightTip:  { x: 356, y: 70 },
      scorer: 1,
    },
  ],
  start: [
    { x: 540, y: 640 },
    { x: 500, y: 620 },
    { x: 540, y: 600 },
  ],
};

export default testLevel;
