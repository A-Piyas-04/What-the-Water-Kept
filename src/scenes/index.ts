import type { SceneDef, SceneId } from '@/world/types';
import { SHORE } from './shore';
import { HIGHSTREET } from './highstreet';
import { WARD } from './ward';
import { TUNNELS } from './tunnels';
import { GATEHOUSE } from './gatehouse';
import { GATE } from './gate';

/** Chapter order, which is also the progression audit's walk order. */
export const SCENE_ORDER: readonly SceneId[] = [
  'shore',
  'highstreet',
  'ward',
  'tunnels',
  'gatehouse',
  'gate',
];

export const SCENES: Readonly<Record<SceneId, SceneDef>> = {
  shore: SHORE,
  highstreet: HIGHSTREET,
  ward: WARD,
  tunnels: TUNNELS,
  gatehouse: GATEHOUSE,
  gate: GATE,
};

export const getScene = (id: SceneId): SceneDef => SCENES[id];

export const chapterOf = (id: SceneId): number => SCENE_ORDER.indexOf(id) + 1;

export { SHORE, HIGHSTREET, WARD, TUNNELS, GATEHOUSE, GATE };
