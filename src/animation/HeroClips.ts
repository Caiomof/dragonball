import * as THREE from 'three';

function findClip(library: THREE.AnimationClip[], suffix: string): THREE.AnimationClip | undefined {
  const key = suffix.toLowerCase();
  return library.find(c => {
    const name = c.name.toLowerCase().split('|').pop() ?? c.name.toLowerCase();
    return name === key || name.endsWith(`_${key}`) || name.includes(key);
  });
}

function aliasClip(source: THREE.AnimationClip, name: string): THREE.AnimationClip {
  const clip = source.clone();
  clip.name = name;
  return clip;
}

/** Duplicate UAL1 clips under gameplay-specific names (no procedural bone posing). */
export function createHeroClips(_source: THREE.Group, library: THREE.AnimationClip[]): THREE.AnimationClip[] {
  const out: THREE.AnimationClip[] = [];
  const jump = findClip(library, 'jump_loop');
  const jumpStart = findClip(library, 'jump_start');
  const jumpLand = findClip(library, 'jump_land');
  const swimIdle = findClip(library, 'swim_idle_loop');
  const spellIdle = findClip(library, 'spell_simple_idle_loop');
  const spellShoot = findClip(library, 'spell_simple_shoot');
  const spellEnter = findClip(library, 'spell_simple_enter');
  const spellExit = findClip(library, 'spell_simple_exit');

  const hover = swimIdle ?? jump;
  if (hover) {
    for (const name of ['flight_hover', 'flight_cruise', 'flight_brake', 'flight_boost']) out.push(aliasClip(hover, name));
  } else if (jump) out.push(aliasClip(jump, 'flight_boost'));
  if (jumpStart) out.push(aliasClip(jumpStart, 'flight_takeoff'));
  if (jumpLand) out.push(aliasClip(jumpLand, 'flight_land'));

  const charge = spellIdle ?? spellEnter;
  const release = spellShoot ?? spellExit;
  if (charge) {
    out.push(aliasClip(charge, 'power_charge'));
    for (const tech of ['kamehameha', 'galick', 'masenko', 'kienzan']) out.push(aliasClip(charge, `charge_${tech}`));
  }
  if (release) {
    for (const tech of ['kamehameha', 'galick', 'masenko', 'kienzan']) out.push(aliasClip(release, `release_${tech}`));
  }
  return out;
}
