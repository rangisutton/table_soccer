export interface FieldShapePreset {
  label: string;
  sides: number;
  scaleX: number; // horizontal stretch of field radius
  scaleY: number; // vertical stretch of field radius
}

export interface GameConfig {
  shape: FieldShapePreset;
  goalGap: number;
  goalSpokeLength: number;
  coinRadius: number;
  kickPower: number;   // multiplier on kick velocity (default 1.0)
  coinDrag: number;    // frictionAir value
}

export const FIELD_SHAPES: FieldShapePreset[] = [
  { label: 'Circle',    sides: 16, scaleX: 1.0,  scaleY: 1.0  },
  { label: 'Wide Oval', sides: 16, scaleX: 1.35, scaleY: 0.72 },
  { label: 'Long Oval', sides: 20, scaleX: 0.72, scaleY: 1.35 },
  { label: 'Stadium',   sides:  8, scaleX: 0.85, scaleY: 1.3  },
  { label: 'Hexagon',   sides:  6, scaleX: 1.0,  scaleY: 1.2  },
  { label: 'Rectangle', sides:  4, scaleX: 1.0,  scaleY: 1.3  },
];

export const DEFAULT_CONFIG: GameConfig = {
  shape: FIELD_SHAPES[0],
  goalGap: 80,
  goalSpokeLength: 50,
  coinRadius: 10,
  kickPower: 1.0,
  coinDrag: 0.08,
};
