import { LevelDef } from '../LevelDef';

export const airHockeyLevel: LevelDef = {
  id: 'air-hockey',
  label: 'Air Hockey',
  type: 'field',
  imageUrl: '/field-images/air-hockey.png',
  tagline: "Like the real game the coins bounce around all over the place until you smack an own goal. Physics bug out on this fast level.",
  look: 'neon',
  coinConfig: { radius: 15, kickPower: 2.0, drag: 0.9 },
  boundary: [
    { x: 376, y: 42 },
    { x: 62, y: 42 },
    { x: 64, y: 753 },
    { x: 383, y: 757 },
    { x: 424, y: 758 },
    { x: 738, y: 758 },
    { x: 736, y: 47 },
    { x: 417, y: 43 },
  ],
  polys: [],
  ellipses: [
    { x: 400, y: 169, rx: 42, ry: 42, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 496, y: 43 },  rightBase: { x: 296, y: 42 },
      leftTip:   { x: 497, y: 49 },   rightTip:  { x: 297, y: 48 },
      scorer: 0,
    },
    {
      leftBase:  { x: 304, y: 757 },  rightBase: { x: 504, y: 758 },
      leftTip:   { x: 303, y: 751 },   rightTip:  { x: 503, y: 752 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 560 },
    { x: 340, y: 300 },
    { x: 440, y: 300 },
  ],
};

export default airHockeyLevel;
