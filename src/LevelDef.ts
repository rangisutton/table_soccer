import { Vec2, GoalPost } from './types';

export type LevelType = 'field' | 'course';

export interface LevelDef {
  id: string;
  label: string;
  type: LevelType;
  /** Closed boundary polygon — vertices in order */
  boundary: Vec2[];
  /** Interior solid obstacles — each is a closed polygon */
  blockers: Vec2[][];
  /** Goal openings — for 'field' levels there are two; for 'course' levels, one */
  goals: GoalPost[];
  /** Initial coin positions [kicked, otherA, otherB] */
  start: [Vec2, Vec2, Vec2];
}
