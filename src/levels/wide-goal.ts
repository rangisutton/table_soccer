import { LevelDef } from '../LevelDef';

export const wideGoalLevel: LevelDef = {
  id: 'wide-goal',
  label: 'Wide Goal',
  type: 'field',
  boundary: [
    { x: 300, y: 20 },
    { x: 300, y: 40 },
    { x: 160, y: 40 },
    { x: 20, y: 180 },
    { x: 20, y: 420 },
    { x: 20, y: 640 },
    { x: 140, y: 760 },
    { x: 300, y: 760 },
    { x: 300, y: 780 },
    { x: 500, y: 780 },
    { x: 500, y: 760 },
    { x: 640, y: 760 },
    { x: 780, y: 620 },
    { x: 780, y: 380 },
    { x: 780, y: 160 },
    { x: 660, y: 40 },
    { x: 500, y: 40 },
    { x: 500, y: 20 },
  ],
  blockers: [
    [
      { x: 340, y: 400 },
      { x: 400, y: 320 },
      { x: 460, y: 400 },
      { x: 340, y: 400 },
    ],
    [
      { x: 220, y: 320 },
      { x: 140, y: 580 },
      { x: 160, y: 200 },
      { x: 360, y: 260 },
    ],
    [
      { x: 480, y: 100 },
      { x: 580, y: 180 },
      { x: 400, y: 180 },
    ],
  ],
  ellipses: [],
  goals: [
    {
      leftBase:  { x: 500, y: 20 },  rightBase: { x: 300, y: 20 },
      leftTip:   { x: 500, y: 43 },   rightTip:  { x: 300, y: 43 },
      scorer: 0,
    },
    {
      leftBase:  { x: 300, y: 780 },  rightBase: { x: 500, y: 780 },
      leftTip:   { x: 300, y: 757 },   rightTip:  { x: 500, y: 757 },
      scorer: 1,
    },
  ],
  start: [
    { x: 240, y: 720 },
    { x: 200, y: 720 },
    { x: 220, y: 680 },
  ],
};

export default wideGoalLevel;
