import source from './skills.json';
export type SkillId = 'kamehameha' | 'galick' | 'masenko' | 'kienzan';
export type SkillDefinition = { id: SkillId; label: string; short: string; key: string; kiCost: number; damage: number; cooldown: number; range: number; charge: number; duration: number; color: string; colorHex: number; coreHex: number; kind: 'beam' | 'disc'; description: string };
export const SKILLS = source as SkillDefinition[];
