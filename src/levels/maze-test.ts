import { LevelDef } from '../LevelDef';

export const mazeTestLevel: LevelDef = {
  id: 'maze-test',
  label: 'Maze Test',
  type: 'course',
  par: 500,
  tagline: "This is a course of some sort",
  look: 'neon',
  coinConfig: { radius: 10, kickPower: 1.0, drag: 5.0 },
  boundary: [
    { x: 720, y: 380 },
    { x: 720, y: 220 },
    { x: 720, y: 200 },
    { x: 660, y: 180 },
    { x: 540, y: 100 },
    { x: 520, y: 40 },
    { x: 20, y: 40 },
    { x: 20, y: 580 },
    { x: 80, y: 600 },
    { x: 120, y: 640 },
    { x: 40, y: 760 },
    { x: 180, y: 740 },
    { x: 300, y: 640 },
    { x: 340, y: 700 },
    { x: 540, y: 740 },
    { x: 540, y: 660 },
    { x: 620, y: 640 },
    { x: 640, y: 740 },
    { x: 720, y: 740 },
    { x: 720, y: 440 },
  ],
  polys: [],
  ellipses: [],
  goals: [
    {
      leftBase:  { x: 720, y: 434 },  rightBase: { x: 720, y: 354 },
      leftTip:   { x: 670, y: 435 },   rightTip:  { x: 670, y: 355 },
      scorer: 0,
    },
  ],
  start: [
    { x: 420, y: 600 },
    { x: 460, y: 540 },
    { x: 400, y: 540 },
  ],
};

export default mazeTestLevel;
