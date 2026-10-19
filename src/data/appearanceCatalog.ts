import type { OutfitId } from '../characters/outfitLoader';

export type HairStyleId = {
  id: string;
  label: string;
  path: string;
};

export const HAIR_STYLES: HairStyleId[] = [
  { id: 'buzzed', label: 'Raspado (M)', path: '/assets/characters/hair/Hair_Buzzed.gltf' },
  { id: 'parted', label: 'Penteado (M)', path: '/assets/characters/hair/Hair_SimpleParted.gltf' },
  { id: 'long', label: 'Longo', path: '/assets/characters/hair/Hair_Long.gltf' },
  { id: 'buns', label: 'Coques', path: '/assets/characters/hair/Hair_Buns.gltf' },
];

export const BEARD_STYLES = [
  { id: 0, label: 'Nenhuma' },
  { id: 1, label: 'Curta' },
  { id: 2, label: 'Cavanhaque' },
  { id: 3, label: 'Cheia' },
] as const;

export const OUTFIT_OPTIONS: { id: number; label: string; outfit: OutfitId | null; preview?: string }[] = [
  { id: 0, label: 'Gi da raça', outfit: null },
  { id: 1, label: 'Patrulheiro (M)', outfit: 'male_ranger', preview: '/assets/characters/outfits/Male_Ranger.gltf' },
  { id: 2, label: 'Camponês (M)', outfit: 'male_peasant', preview: '/assets/characters/outfits/Male_Peasant.gltf' },
  { id: 3, label: 'Patrulheira (F)', outfit: 'female_ranger', preview: '/assets/characters/outfits/Female_Ranger.gltf' },
  { id: 4, label: 'Camponesa (F)', outfit: 'female_peasant', preview: '/assets/characters/outfits/Female_Peasant.gltf' },
];

export const BEARD_MESH = '/assets/characters/hair/Hair_Beard.gltf';
