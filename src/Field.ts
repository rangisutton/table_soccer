import { FIELD_RADIUS } from './config';
import { Vec2, GoalPost, PlayerId } from './types';
import { GameConfig } from './FieldConfig';

/**
 * Returns vertices of the field polygon for the given config.
 * Offset by half a segment so edges (not vertices) sit at top and bottom.
 */
export function getFieldVertices(cx: number, cy: number, cfg: GameConfig): Vec2[] {
  const { sides, scaleX, scaleY } = cfg.shape;
  const verts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2 - Math.PI / sides;
    verts.push({
      x: cx + FIELD_RADIUS * scaleX * Math.cos(angle),
      y: cy + FIELD_RADIUS * scaleY * Math.sin(angle),
    });
  }
  return verts;
}

export function buildGoals(cx: number, cy: number, cfg: GameConfig): [GoalPost, GoalPost] {
  return [
    buildGoal(cx, cy, 0, 0,               cfg),
    buildGoal(cx, cy, 1, cfg.shape.sides / 2, cfg),
  ];
}

function buildGoal(cx: number, cy: number, scorer: PlayerId, edgeIndex: number, cfg: GameConfig): GoalPost {
  const verts = getFieldVertices(cx, cy, cfg);
  const sides = cfg.shape.sides;
  const a = verts[edgeIndex];
  const b = verts[(edgeIndex + 1) % sides];

  const mid: Vec2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
  const edgeDir: Vec2 = { x: (b.x - a.x) / edgeLen, y: (b.y - a.y) / edgeLen };

  const inward: Vec2 = { x: cx - mid.x, y: cy - mid.y };
  const inwardLen = Math.hypot(inward.x, inward.y);
  const inwardNorm: Vec2 = { x: inward.x / inwardLen, y: inward.y / inwardLen };

  const half = cfg.goalGap / 2;
  const spoke = cfg.goalSpokeLength;

  const leftBase: Vec2  = { x: mid.x - edgeDir.x * half, y: mid.y - edgeDir.y * half };
  const rightBase: Vec2 = { x: mid.x + edgeDir.x * half, y: mid.y + edgeDir.y * half };
  const leftTip: Vec2   = { x: leftBase.x  + inwardNorm.x * spoke, y: leftBase.y  + inwardNorm.y * spoke };
  const rightTip: Vec2  = { x: rightBase.x + inwardNorm.x * spoke, y: rightBase.y + inwardNorm.y * spoke };

  return { leftTip, rightTip, leftBase, rightBase, scorer };
}
