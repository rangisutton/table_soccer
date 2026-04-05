import { LevelDef } from '../LevelDef';

export const poolTableLevel: LevelDef = {
  id: 'pool-table',
  label: 'Pool Table',
  type: 'field',
  imageUrl: '/field-images/pool-table.png',
  tagline: "The pool balls don't move or anything. Fun bouncing them around but will be buggy like air-hockey, missing goals and faulting.",
  look: 'ambient',
  coinConfig: { radius: 12, kickPower: 1.2, drag: 0.9 },
  boundary: [
    { x: 355, y: 41 },
    { x: 135, y: 38 },
    { x: 136, y: 757 },
    { x: 361, y: 757 },
    { x: 445, y: 759 },
    { x: 665, y: 762 },
    { x: 664, y: 43 },
    { x: 439, y: 43 },
  ],
  polys: [],
  ellipses: [
    { x: 99, y: 398, rx: 20, ry: 20, angle: 0.0000 },
    { x: 100, y: 20, rx: 20, ry: 20, angle: 0.0000 },
    { x: 700, y: 20, rx: 20, ry: 20, angle: 0.0000 },
    { x: 258, y: 524, rx: 11, ry: 11, angle: 0.0000 },
    { x: 294, y: 503, rx: 11, ry: 11, angle: 0.0000 },
    { x: 600, y: 641, rx: 11, ry: 11, angle: 0.0000 },
    { x: 639, y: 547, rx: 11, ry: 11, angle: 0.0000 },
    { x: 334, y: 744, rx: 11, ry: 11, angle: 0.0000 },
  ],
  goals: [
    {
      leftBase:  { x: 430, y: 43 },  rightBase: { x: 364, y: 42 },
      leftTip:   { x: 430, y: 58 },   rightTip:  { x: 364, y: 57 },
      scorer: 0,
    },
    {
      leftBase:  { x: 370, y: 757 },  rightBase: { x: 436, y: 758 },
      leftTip:   { x: 370, y: 742 },   rightTip:  { x: 436, y: 743 },
      scorer: 1,
    },
  ],
  start: [
    { x: 399, y: 704 },
    { x: 381, y: 672 },
    { x: 412, y: 671 },
  ],
};

export default poolTableLevel;
