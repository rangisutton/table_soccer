export type PlayerId = 0 | 1;

export interface Vec2 {
  x: number;
  y: number;
}

export interface GoalPost {
  leftTip: Vec2;
  rightTip: Vec2;
  leftBase: Vec2;
  rightBase: Vec2;
  scorer: PlayerId; // player who scores by sending kicked coin into this goal
}

export type GamePhase =
  | 'kickoff'
  | 'playing'
  | 'simulating'
  | 'goal'
  | 'foul'
  | 'gameover';

export interface GameState {
  phase: GamePhase;
  attacker: PlayerId;
  scores: [number, number];
  lastKickedCoinIndex: number | null;
}
