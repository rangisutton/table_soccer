/** Per-session physics tuning — set in the menu, passed via scene registry */
export interface GameConfig {
  coinRadius: number;
  kickPower: number;   // multiplier on kick velocity (default 1.0)
  coinDrag: number;    // Rapier linearDamping (≈5 ≡ Matter frictionAir 0.08)
}

export const DEFAULT_CONFIG: GameConfig = {
  coinRadius: 10,
  kickPower: 1.0,
  coinDrag: 5.0,
};
