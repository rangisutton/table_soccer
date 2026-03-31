import { LevelDef } from '../LevelDef';

const modules = import.meta.glob<{ default: LevelDef }>(['./*.ts', '!./index.ts', '!./*.json'], { eager: true });

export const allLevels: LevelDef[] = Object.values(modules)
  .map(m => m.default)
  .filter((l): l is LevelDef => !!l && typeof l === 'object' && 'type' in l)
  .sort((a, b) => a.label.localeCompare(b.label));

export const fieldLevels  = allLevels.filter(l => l.type === 'field');
export const courseLevels = allLevels.filter(l => l.type === 'course');
