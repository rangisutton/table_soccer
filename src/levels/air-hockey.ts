import { LevelDef } from '../LevelDef';

export const airHockeyLevel: LevelDef = {
  id: 'air-hockey',
  label: 'Air Hockey',
  type: 'field',
  imageUrl: '/field-images/air-hockey.png',
  look: 'neon',
  coinConfig: { radius: 8, kickPower: 2.0, drag: 2.0 },
  boundary: [
    { x: 380, y: 20 },
    { x: 40, y: 20 },
    { x: 40, y: 780 },
    { x: 380, y: 780 },
    { x: 420, y: 780 },
    { x: 760, y: 780 },
    { x: 760, y: 20 },
    { x: 420, y: 20 },
  ],
  blockers: [],
  ellipses: [
    { x: 400, y: 60, rx: 23, ry: 23, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 448, y: 20 },  rightBase: { x: 353, y: 20 },
      leftTip:   { x: 448, y: 29 },   rightTip:  { x: 353, y: 29 },
      scorer: 0,
    },
    {
      leftBase:  { x: 353, y: 780 },  rightBase: { x: 448, y: 780 },
      leftTip:   { x: 353, y: 771 },   rightTip:  { x: 448, y: 771 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 660 },
    { x: 360, y: 420 },
    { x: 440, y: 420 },
  ],
};

export default airHockeyLevel;
