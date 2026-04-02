import { LevelDef } from '../LevelDef';

export const soccerLevel: LevelDef = {
  id: 'soccer',
  label: 'Soccer',
  type: 'field',
  imageUrl: '/field-images/soccer.png',
  look: 'ambient',
  coinConfig: { radius: 7, kickPower: 1.0, drag: 11.1 },
  boundary: [
    { x: 340, y: 20 },
    { x: 60, y: 20 },
    { x: 60, y: 580 },
    { x: 60, y: 780 },
    { x: 340, y: 780 },
    { x: 460, y: 780 },
    { x: 740, y: 780 },
    { x: 740, y: 220 },
    { x: 740, y: 20 },
    { x: 460, y: 20 },
  ],
  blockers: [
    [
      { x: 340, y: 400 },
      { x: 340, y: 360 },
      { x: 400, y: 340 },
      { x: 460, y: 360 },
      { x: 460, y: 400 },
      { x: 340, y: 400 },
    ],
  ],
  ellipses: [
    { x: 400, y: 80, rx: 11, ry: 11, angle: 0.0000 },
    { x: 189, y: 143, rx: 11, ry: 11, angle: 0.0000 },
    { x: 491, y: 228, rx: 11, ry: 11, angle: 0.0000 },
    { x: 520, y: 120, rx: 11, ry: 11, angle: 0.0000 },
    { x: 583, y: 329, rx: 11, ry: 11, angle: 0.0000 },
    { x: 300, y: 80, rx: 11, ry: 11, angle: 0.0000 },
    { x: 260, y: 263, rx: 11, ry: 11, angle: 0.0000 },
    { x: 703, y: 239, rx: 11, ry: 11, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 446, y: 20 },  rightBase: { x: 355, y: 20 },
      leftTip:   { x: 446, y: 35 },   rightTip:  { x: 355, y: 35 },
      scorer: 0,
    },
    {
      leftBase:  { x: 355, y: 780 },  rightBase: { x: 446, y: 780 },
      leftTip:   { x: 355, y: 765 },   rightTip:  { x: 446, y: 765 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 480 },
    { x: 380, y: 500 },
    { x: 420, y: 500 },
  ],
};

export default soccerLevel;
