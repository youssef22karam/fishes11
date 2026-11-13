import { SPECIES_1 } from './species1';
import { SPECIES_2 } from './species2';
import { SPECIES_3 } from './species3';
import type { Species } from '../engine/types';

export const SPECIES: Species[] = [...SPECIES_1, ...SPECIES_2, ...SPECIES_3].sort((a, b) => a.name.localeCompare(b.name));
export const GROUPS = Array.from(new Set(SPECIES.map((s) => s.group))).sort();
