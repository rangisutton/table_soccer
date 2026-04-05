import { LevelDef } from '../LevelDef';

export const pathwaysLevel: LevelDef = {
  id: 'pathways',
  label: 'Pathways',
  type: 'field',
  imageUrl: '/field-images/pathways.png',
  tagline: "Will you kick around following the flooded fortress walls, or duck through narrow gaps and across the square?",
  look: 'neon',
  coinConfig: { radius: 8, kickPower: 1.0, drag: 4.2 },
  boundary: [
    { x: 300, y: 20 },
    { x: 300, y: 40 },
    { x: 160, y: 40 },
    { x: 0, y: 180 },
    { x: 0, y: 400 },
    { x: 0, y: 620 },
    { x: 180, y: 760 },
    { x: 300, y: 760 },
    { x: 300, y: 780 },
    { x: 500, y: 780 },
    { x: 500, y: 760 },
    { x: 640, y: 760 },
    { x: 800, y: 620 },
    { x: 800, y: 400 },
    { x: 800, y: 180 },
    { x: 620, y: 40 },
    { x: 500, y: 40 },
    { x: 500, y: 20 },
  ],
  polys: [
    { verts: [
      { x: 505, y: 123 },
      { x: 597, y: 172 },
      { x: 442, y: 176 },
    ] },
    { verts: [
      { x: 492, y: 562 },
      { x: 690, y: 566 },
      { x: 661, y: 316 },
      { x: 628, y: 524 },
    ] },
  ],
  ellipses: [],
  goals: [
    {
      leftBase:  { x: 496, y: 20 },  rightBase: { x: 304, y: 20 },
      leftTip:   { x: 496, y: 40 },   rightTip:  { x: 304, y: 40 },
      scorer: 0,
    },
    {
      leftBase:  { x: 304, y: 780 },  rightBase: { x: 496, y: 780 },
      leftTip:   { x: 304, y: 760 },   rightTip:  { x: 496, y: 760 },
      scorer: 1,
    },
  ],
  start: [
    { x: 260, y: 700 },
    { x: 140, y: 700 },
    { x: 140, y: 600 },
  ],
};

export default pathwaysLevel;
