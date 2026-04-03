import { LevelDef } from '../LevelDef';

export const tableLevel: LevelDef = {
  id: 'table',
  label: 'Table',
  type: 'field',
  imageUrl: '/field-images/table.png',
  look: 'ambient',
  coinConfig: { radius: 8, kickPower: 0.8, drag: 7.8 },
  boundary: [
    { x: 320, y: 80 },
    { x: 80, y: 80 },
    { x: 80, y: 720 },
    { x: 320, y: 720 },
    { x: 480, y: 720 },
    { x: 720, y: 720 },
    { x: 720, y: 80 },
    { x: 480, y: 80 },
  ],
  polys: [
    { verts: [
      { x: 572, y: 537 },
      { x: 630, y: 557 },
      { x: 660, y: 460 },
      { x: 602, y: 443 },
    ] },
    { verts: [
      { x: 167, y: 640 },
      { x: 193, y: 635 },
      { x: 182, y: 576 },
      { x: 155, y: 581 },
    ] },
  ],
  ellipses: [
    { x: 660, y: 640, rx: 25, ry: 25, angle: 0.0000 },
    { x: 320, y: 560, rx: 23, ry: 23, angle: 0.0000 },
    { x: 320, y: 322, rx: 25, ry: 25, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 436, y: 80 },  rightBase: { x: 364, y: 80 },
      leftTip:   { x: 436, y: 111 },   rightTip:  { x: 364, y: 111 },
      scorer: 0,
    },
    {
      leftBase:  { x: 364, y: 720 },  rightBase: { x: 436, y: 720 },
      leftTip:   { x: 364, y: 689 },   rightTip:  { x: 436, y: 689 },
      scorer: 1,
    },
  ],
  start: [
    { x: 400, y: 620 },
    { x: 380, y: 580 },
    { x: 420, y: 580 },
  ],
};

export default tableLevel;
