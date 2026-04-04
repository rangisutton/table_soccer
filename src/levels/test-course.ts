import { LevelDef } from '../LevelDef';

export const testCourseLevel: LevelDef = {
  id: 'test-course',
  label: 'Test Course',
  type: 'course',
  par: 5,
  tagline: "This is a course of some sort",
  look: 'neon',
  coinConfig: { radius: 10, kickPower: 1.0, drag: 5.0 },
  boundary: [
    { x: 340, y: 40 },
    { x: 220, y: 40 },
    { x: 160, y: 140 },
    { x: 140, y: 320 },
    { x: 160, y: 520 },
    { x: 200, y: 640 },
    { x: 320, y: 700 },
    { x: 440, y: 700 },
    { x: 620, y: 680 },
    { x: 640, y: 480 },
    { x: 620, y: 320 },
    { x: 600, y: 180 },
    { x: 540, y: 60 },
    { x: 460, y: 40 },
    { x: 420, y: 40 },
  ],
  polys: [
    { verts: [
      { x: 300, y: 340 },
      { x: 260, y: 400 },
      { x: 240, y: 460 },
      { x: 260, y: 540 },
      { x: 220, y: 500 },
      { x: 180, y: 400 },
      { x: 300, y: 340 },
    ] },
  ],
  ellipses: [
    { x: 238, y: 238, rx: 60, ry: 60, angle: 0.0000 },
    { x: 460, y: 203, rx: 60, ry: 60, angle: 0.0000 },
    { x: 499, y: 388, rx: 60, ry: 60, angle: 0.0000, mode: 'sink' },
  ],
  goals: [
    {
      leftBase:  { x: 420, y: 40 },  rightBase: { x: 340, y: 40 },
      leftTip:   { x: 423, y: 90 },   rightTip:  { x: 343, y: 90 },
      scorer: 0,
    },
  ],
  start: [
    { x: 400, y: 631 },
    { x: 377, y: 577 },
    { x: 423, y: 577 },
  ],
};

export default testCourseLevel;
