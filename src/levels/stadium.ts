import { CANVAS_WIDTH, CANVAS_HEIGHT, FIELD_RADIUS } from '../config';
import { Vec2, GoalPost } from '../types';
import { LevelDef } from '../LevelDef';

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;

const SIDES   = 8;
const SCALE_X = 0.85;
const SCALE_Y = 1.3;
const GOAL_GAP = 80;
const GOAL_SPOKE = 50;
const KICKOFF_SPREAD = 36;

function fieldVerts(): Vec2[] {
  const verts: Vec2[] = [];
  for (let i = 0; i < SIDES; i++) {
    const angle = (2 * Math.PI * i) / SIDES - Math.PI / 2 - Math.PI / SIDES;
    verts.push({
      x: CX + FIELD_RADIUS * SCALE_X * Math.cos(angle),
      y: CY + FIELD_RADIUS * SCALE_Y * Math.sin(angle),
    });
  }
  return verts;
}

function buildGoal(edgeIndex: number, scorer: 0 | 1): GoalPost {
  const verts = fieldVerts();
  const a = verts[edgeIndex];
  const b = verts[(edgeIndex + 1) % SIDES];
  const mid: Vec2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
  const edgeDir: Vec2 = { x: (b.x - a.x) / edgeLen, y: (b.y - a.y) / edgeLen };
  const inward: Vec2 = { x: CX - mid.x, y: CY - mid.y };
  const inwardLen = Math.hypot(inward.x, inward.y);
  const inwardNorm: Vec2 = { x: inward.x / inwardLen, y: inward.y / inwardLen };
  const half = GOAL_GAP / 2;
  const leftBase:  Vec2 = { x: mid.x - edgeDir.x * half, y: mid.y - edgeDir.y * half };
  const rightBase: Vec2 = { x: mid.x + edgeDir.x * half, y: mid.y + edgeDir.y * half };
  const leftTip:   Vec2 = { x: leftBase.x  + inwardNorm.x * GOAL_SPOKE, y: leftBase.y  + inwardNorm.y * GOAL_SPOKE };
  const rightTip:  Vec2 = { x: rightBase.x + inwardNorm.x * GOAL_SPOKE, y: rightBase.y + inwardNorm.y * GOAL_SPOKE };
  return { leftBase, rightBase, leftTip, rightTip, scorer };
}

// Centre-square obstacle — half-extents match GameScene drawing (obs=70)
const OBS = 70;
const centreBlocker: Vec2[] = [
  { x: CX - OBS, y: CY - OBS },
  { x: CX + OBS, y: CY - OBS },
  { x: CX + OBS, y: CY + OBS },
  { x: CX - OBS, y: CY + OBS },
];

// Kickoff positions for P1 (attacker=0, dir=1 → bottom half)
const s = KICKOFF_SPREAD;
const baseY = CY + FIELD_RADIUS * 0.4;
const startP1: [Vec2, Vec2, Vec2] = [
  { x: CX,             y: baseY + s   },
  { x: CX - s * 0.65,  y: baseY - s * 0.5 },
  { x: CX + s * 0.65,  y: baseY - s * 0.5 },
];

export const stadiumLevel: LevelDef = {
  id: 'stadium',
  label: 'Stadium',
  type: 'field',
  boundary: fieldVerts(),
  blockers: [centreBlocker],
  goals: [buildGoal(0, 0), buildGoal(SIDES / 2, 1)],
  start: startP1,
};

export default stadiumLevel;
