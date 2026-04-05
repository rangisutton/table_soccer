import { LevelDef } from '../LevelDef';

export const soccerLevel: LevelDef = {
  id: 'soccer',
  label: 'Soccer',
  type: 'field',
  imageUrl: '/field-images/soccer.png',
  tagline: "Couldn't really make this game without this level. So here it is. Lots of players getting in the way.",
  look: 'ambient',
  coinConfig: { radius: 7, kickPower: 1.0, drag: 11.1 },
  boundary: [
    { x: 342, y: 19 },
    { x: 60, y: 20 },
    { x: 60, y: 580 },
    { x: 60, y: 780 },
    { x: 340, y: 780 },
    { x: 458, y: 781 },
    { x: 740, y: 780 },
    { x: 740, y: 220 },
    { x: 740, y: 20 },
    { x: 460, y: 20 },
  ],
  polys: [],
  ellipses: [
    { x: 400, y: 80, rx: 20, ry: 20, angle: 0.0000 },
    { x: 189, y: 143, rx: 20, ry: 20, angle: 0.0000 },
    { x: 496, y: 232, rx: 20, ry: 20, angle: 0.0000 },
    { x: 520, y: 120, rx: 20, ry: 20, angle: 0.0000 },
    { x: 583, y: 329, rx: 20, ry: 20, angle: 0.0000 },
    { x: 300, y: 80, rx: 20, ry: 20, angle: 0.0000 },
    { x: 703, y: 239, rx: 20, ry: 20, angle: 0.0000 },
    { x: 263, y: 263, rx: 20, ry: 20, angle: 0.0000 },
    { x: 397, y: 300, rx: 20, ry: 20, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 446, y: 20 },  rightBase: { x: 355, y: 19 },
      leftTip:   { x: 446, y: 35 },   rightTip:  { x: 355, y: 34 },
      scorer: 0,
    },
    {
      leftBase:  { x: 354, y: 780 },  rightBase: { x: 445, y: 781 },
      leftTip:   { x: 354, y: 765 },   rightTip:  { x: 445, y: 766 },
      scorer: 1,
    },
  ],
  start: [
    { x: 398, y: 458 },
    { x: 341, y: 441 },
    { x: 460, y: 439 },
  ],
};

export default soccerLevel;
