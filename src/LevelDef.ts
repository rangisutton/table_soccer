import { Vec2, GoalPost } from './types';

export type LevelType = 'field' | 'course';

// ─── Coin configuration ───────────────────────────────────────────────────────

export interface CoinConfig {
  radius: number;
  kickPower: number;
  drag: number;
}

// ─── Look / theme ─────────────────────────────────────────────────────────────

export type CoinRendering    = 'glow' | 'drop-shadow';
export type CollisionFX      = 'sparks' | 'glow' | 'none';
export type IntersectionLine = 'electric' | 'straight' | 'none';

export interface LookDef {
  coinRendering:    CoinRendering;
  collisionFX:      CollisionFX;
  intersectionLine: IntersectionLine;
}

export type LookName = 'neon' | 'ambient';

export const LOOKS: Record<LookName, LookDef> = {
  neon: {
    coinRendering:    'glow',
    collisionFX:      'sparks',
    intersectionLine: 'electric',
  },
  ambient: {
    coinRendering:    'drop-shadow',
    collisionFX:      'glow',
    intersectionLine: 'straight',
  },
};

export interface EllipseDef {
  x: number;
  y: number;
  rx: number;    // semi-major axis
  ry: number;    // semi-minor axis
  angle: number; // rotation in radians
}

export interface LevelDef {
  id: string;
  label: string;
  type: LevelType;
  /** Closed boundary polygon — vertices in order */
  boundary: Vec2[];
  /** Interior solid obstacles — each is a closed polygon */
  blockers: Vec2[][];
  /** Interior solid obstacles — ellipses */
  ellipses?: EllipseDef[];
  /** Goal openings — for 'field' levels there are two; for 'course' levels, one */
  goals: GoalPost[];
  /** Initial coin positions [kicked, otherA, otherB] */
  start: [Vec2, Vec2, Vec2];
  /** Optional field image replacing procedural rendering (relative URL, e.g. /field-images/stadium.png) */
  imageUrl?: string;
  /** Coin physics — overrides menu settings on load */
  coinConfig?: CoinConfig;
  /** Visual theme */
  look?: LookName;
}
