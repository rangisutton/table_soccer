import { Vec2, GoalPost } from './types';

export type LevelType = 'field' | 'course';

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
}
