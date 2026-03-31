import { LevelDef } from '../LevelDef';

export const fooLevel: LevelDef = {
  id: 'foo',
  label: 'foo',
  type: 'field',
  boundary: [
    { x: 400, y: 20 },
    { x: 80, y: 140 },
    { x: 80, y: 280 },
    { x: 360, y: 500 },
    { x: 60, y: 580 },
    { x: 400, y: 780 },
    { x: 720, y: 660 },
    { x: 720, y: 520 },
    { x: 440, y: 300 },
    { x: 740, y: 220 },
  ],
  blockers: [
    [
      { x: 400, y: 120 },
      { x: 320, y: 180 },
      { x: 420, y: 220 },
      { x: 460, y: 180 },
      { x: 400, y: 120 },
    ],
    [
      { x: 340, y: 380 },
      { x: 360, y: 440 },
      { x: 440, y: 420 },
      { x: 440, y: 360 },
      { x: 340, y: 380 },
    ],
  ],
  goals: [
    {
      leftBase:  { x: 604, y: 140 },  rightBase: { x: 536, y: 100 },
      leftTip:   { x: 579, y: 183 },   rightTip:  { x: 510, y: 142 },
      scorer: 0,
    },
    {
      leftBase:  { x: 196, y: 660 },  rightBase: { x: 264, y: 700 },
      leftTip:   { x: 221, y: 617 },   rightTip:  { x: 290, y: 658 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 683 },
    { x: 377, y: 629 },
    { x: 423, y: 629 },
  ],
};

export default fooLevel;
