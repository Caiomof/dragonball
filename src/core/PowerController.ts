import * as THREE from 'three';
import { BiomeBoss } from '../combat/BiomeBoss';
import type { CombatEffects, AttackStyle } from '../combat/Combat';
import {
  BOSS_COOLDOWN_SEC,
  COST_CREATE,
  COST_EDIT,
  COST_UNLOCK,
  MAX_POWERS,
  type CustomPower,
  type PowerTypeId,
  POWER_RACE_LOCK,
  POWER_TYPES,
  gestureForType,
  hexToNumber,
  powerStats,
} from '../data/powers';
import type { PlayerProfile, PowerEconomy } from '../data/profiles';
import { saveProfiles } from '../data/profiles';
import { bindPowerUi, closeLibrary, openCreator, openLibrary, readCreatorDraft, repaintLibrary, renderHotbar } from '../ui/powerUi';
import type { Ui } from '../ui/Ui';
import type { World } from '../world/World';
import type { Character } from '../characters/Character';
import type { FighterStats } from '../data/gameConfig';

type Deps = {
  onLibraryOpen?: () => void;
  onLibraryClose?: () => void;
  ui: Ui;
  world: World;
  combat: CombatEffects;
  getElapsed: () => number;
  getStats: () => FighterStats;
  getCharacter: () => Character;
  getCamera: () => THREE.Camera;
  spendKi: (n: number) => boolean;
  isCreative: () => boolean;
  powerMult: () => number;
  forward: () => THREE.Vector3;
  playerPos: () => THREE.Vector3;
  castAttack: (style: AttackStyle, color: number, core: number, range: number, charge: number, duration: number, damage: number, size: number, blastRadius: number) => void;
  damagePlayer: (n: number, msg: string) => void;
  toast: (msg: string, kind?: 'info' | 'danger' | 'success', sec?: number) => void;
  onAttackEnd: (sec: number) => void;
  onRoot: (sec: number) => void;
  playCharge: () => void;
  playBeam: () => void;
  playDeny: () => void;
  toggleFlying: () => void;
  teleportForward: (range: number) => void;
  applyTechniqueBoost: (type: 'super_saiyan' | 'kaioken', charge: number) => void;
};

export class PowerController {
  activeSlot = 0;
  heldPowerId: string | null = null;
  heldSince = 0;
  private readonly cooldownUntil = new Map<string, number>();
  readonly boss: BiomeBoss;
  private profile: PlayerProfile | null = null;
  private profiles: PlayerProfile[] = [];

  constructor(private readonly deps: Deps) {
    this.boss = new BiomeBoss(deps.world, deps.combat);
    bindPowerUi({
      close: () => this.closePanel(),
      unlock: t => this.unlockType(t),
      openCreator: id => this.openEdit(id),
      saveCreator: () => this.saveCreator(),
      cancelCreator: () => document.getElementById('power-creator-screen')?.classList.add('hidden'),
      equip: (id, slot, from) => this.equip(id, slot, from),
      setShopFilter: () => {},
    });
    (window as unknown as { __powerUnlock: (t: PowerTypeId) => void }).__powerUnlock = t => this.unlockType(t);
    (window as unknown as { __powerEquip: (id: string, s: number) => void }).__powerEquip = (id, s) => this.equip(id, s);
    document.getElementById('journey-boss-btn')?.addEventListener('click', () => this.trySummonBoss());
    document.getElementById('mission-claim-btn')?.addEventListener('click', () => this.tryClaimMission());
    document.getElementById('zeni-set-btn')?.addEventListener('click', () => this.setZeniFromSettings());
    document.getElementById('zeni-add-500')?.addEventListener('click', () => this.addZeni(500));
    document.getElementById('zeni-add-2000')?.addEventListener('click', () => this.addZeni(2000));
    document.getElementById('zeni-zero')?.addEventListener('click', () => this.setZeni(0));
    document.getElementById('zeni-mult')?.addEventListener('change', e => {
      const eco = this.economy();
      eco.zeniGainMult = Number((e.target as HTMLSelectElement).value);
      this.persist();
    });
  }

  bind(profile: PlayerProfile | null, profiles: PlayerProfile[]): void {
    this.profile = profile;
    this.profiles = profiles;
    this.refreshHotbar();
    this.syncZeniHud();
    const mult = document.getElementById('zeni-mult') as HTMLSelectElement | null;
    if (mult && profile) mult.value = String(profile.economy.zeniGainMult);
    const inp = document.getElementById('zeni-set-input') as HTMLInputElement | null;
    if (inp && profile) inp.value = String(Math.floor(profile.economy.zeni));
  }

  economy(): PowerEconomy {
    if (!this.profile) throw new Error('no profile');
    return this.profile.economy;
  }

  private persist(): void {
    if (!this.profile) return;
    const i = this.profiles.findIndex(p => p.id === this.profile!.id);
    if (i >= 0) this.profiles[i] = this.profile;
    saveProfiles(this.profiles);
    this.refreshHotbar();
    this.refreshLibrary();
    this.syncZeniHud();
  }

  awardZeni(base: number): void {
    if (!this.profile) return;
    if(this.deps.isCreative())return;
    const gain = Math.round(base * this.profile.economy.zeniGainMult);
    this.profile.economy.zeni = Math.min(99999, this.profile.economy.zeni + gain);
    if (gain > 0) this.deps.toast(`+${gain} ZENI`, 'success', 0.65);
    this.persist();
  }

  setZeni(n: number): void {
    if (!this.profile) return;
    this.profile.economy.zeni = Math.max(0, Math.min(99999, n));
    this.persist();
  }

  addZeni(n: number): void {
    this.setZeni(this.economy().zeni + n);
  }

  setZeniFromSettings(): void {
    const v = Number((document.getElementById('zeni-set-input') as HTMLInputElement).value);
    if (Number.isFinite(v)) this.setZeni(v);
  }

  onBreakableDestroyed(): void {
    this.profile!.economy.breaks++;
    this.awardZeni(4 + Math.floor(Math.random() * 10));
  }

  onBeastKill(): void {
    this.profile!.economy.beasts++;
    this.awardZeni(12 + Math.floor(Math.random() * 28));
  }

  activePower(): CustomPower | null {
    const id = this.economy().loadout[this.activeSlot];
    return id ? this.economy().powers.find(p => p.id === id) ?? null : null;
  }

  powerById(id: string): CustomPower | undefined {
    return this.economy().powers.find(p => p.id === id);
  }

  selectSlot(slot: number): void {
    this.activeSlot = THREE.MathUtils.clamp(slot, 0, 5);
    this.refreshHotbar();
  }

  openPanel(): void {
    if (!this.profile) return;
    this.deps.onLibraryOpen?.();
    openLibrary(this.economy(), this.deps.isCreative()?99999:this.economy().zeni, this.profile.race);
  }

  closePanel(): void {
    const wasOpen = this.isLibraryOpen() || this.isCreatorOpen();
    closeLibrary();
    if (wasOpen) this.deps.onLibraryClose?.();
  }

  isLibraryOpen(): boolean {
    return !document.getElementById('power-library-screen')?.classList.contains('hidden');
  }

  isCreatorOpen(): boolean {
    return !document.getElementById('power-creator-screen')?.classList.contains('hidden');
  }

  refreshLibrary(): void {
    if (!this.profile || !this.isLibraryOpen()) return;
    repaintLibrary(this.economy(), this.deps.isCreative()?99999:this.economy().zeni, this.profile.race);
  }

  refreshHotbar(): void {
    if (!this.profile) return;
    renderHotbar(this.economy(), this.activeSlot, this.cooldownsForHud());
    document.querySelectorAll<HTMLButtonElement>('#skill-hotbar [data-slot]').forEach(btn => {
      btn.onclick = () => {
        const slot = Number(btn.dataset.slot);
        this.selectSlot(slot);
        const id = this.economy().loadout[slot];
        if (!id) this.openPanel();
        else if (this.deps.getElapsed() >= (this.cooldownUntil.get(id) ?? 0)) this.beginCharge(slot);
      };
    });
    this.syncZeniHud();
  }

  syncZeniHud(): void {
    const el = document.getElementById('hud-zeni-label');
    const fill = document.getElementById('hud-zeni-fill');
    if (!el || !this.profile) return;
    el.textContent = this.deps.isCreative() ? '∞ Z' : `${Math.floor(this.economy().zeni)} Z`;
    if (fill) fill.style.width = `${Math.min(100, this.economy().zeni / 3000 * 100)}%`;
    const lib = document.getElementById('power-zeni-label');
    if (lib) lib.textContent = this.deps.isCreative() ? '∞ Z' : `${Math.floor(this.economy().zeni)} Z`;
    const skills = document.getElementById('skills-zeni-label');
    if (skills) skills.textContent = this.deps.isCreative() ? '∞ Z' : `${Math.floor(this.economy().zeni)} Z`;
  }

  unlockType(type: PowerTypeId): void {
    const eco = this.economy();
    if (eco.unlockedTypes.includes(type)) return;
    const raceLock = POWER_RACE_LOCK[type];
    if (raceLock && this.profile?.race !== raceLock) {
      this.deps.toast('TÉCNICA EXCLUSIVA DE OUTRA RAÇA', 'danger', 1);
      return;
    }
    const price = COST_UNLOCK[type] ?? 0;
    if (!this.deps.isCreative() && eco.zeni < price) {
      this.deps.toast('ZENI INSUFICIENTE', 'danger', 0.9);
      return;
    }
    if (!this.deps.isCreative()) eco.zeni -= price;
    eco.unlockedTypes.push(type);
    const label = POWER_TYPES.find(t => t.id === type)?.label ?? type;
    this.deps.toast(`${label} DESBLOQUEADO`, 'success', 1);
    this.persist();
  }

  openEdit(id?: string): void {
    const p = id ? this.powerById(id) : undefined;
    openCreator(p, this.economy());
  }

  saveCreator(): void {
    const { draft, editId } = readCreatorDraft();
    const eco = this.economy();
    const cost = editId ? COST_EDIT : COST_CREATE;
    if (!this.deps.isCreative() && eco.zeni < cost) {
      this.deps.toast('ZENI INSUFICIENTE', 'danger', 0.9);
      return;
    }
    if (!draft.type || !eco.unlockedTypes.includes(draft.type)) return;
    if (!editId && eco.powers.length >= MAX_POWERS) {
      this.deps.toast('LIMITE DE PODERES', 'danger', 1);
      return;
    }
    if (!this.deps.isCreative()) eco.zeni -= cost;
    const power: CustomPower = {
      id: editId ?? `pw_${Date.now()}`,
      name: draft.name ?? 'Poder',
      symbol: draft.symbol ?? '✦',
      type: draft.type,
      color: draft.color ?? '#5ec8ff',
      core: draft.core ?? '#dff6ff',
      size: draft.size ?? 2,
    };
    if (editId) {
      const i = eco.powers.findIndex(p => p.id === editId);
      if (i >= 0) eco.powers[i] = power;
    } else eco.powers.push(power);
    document.getElementById('power-creator-screen')?.classList.add('hidden');
    this.deps.toast(editId ? 'PODER ATUALIZADO' : 'PODER CRIADO', 'success', 1);
    this.persist();
  }

  equip(powerId: string, slot: number, fromSlot?: number): void {
    const eco = this.economy();
    if (fromSlot !== undefined && fromSlot !== slot) {
      const displaced = eco.loadout[slot];
      eco.loadout[slot] = powerId;
      eco.loadout[fromSlot] = displaced;
    } else eco.loadout[slot] = powerId;
    this.persist();
    this.deps.toast(`SLOT ${slot + 1}`, 'info', 0.55);
  }

  beginCharge(slot: number): void {
    const id = this.economy().loadout[slot];
    if (!id) return;
    const power = this.powerById(id);
    if (!power) return;
    if (this.deps.getElapsed() < (this.cooldownUntil.get(id) ?? 0)) return;
    const stats = powerStats(power);
    const utility = power.type === 'flight' || power.type === 'teleport' || power.type === 'super_saiyan' || power.type === 'kaioken';
    if (!utility && this.deps.getStats().ki < stats.kiCost) {
      this.deps.toast('KI INSUFICIENTE', 'danger', 0.7);
      return;
    }
    this.activeSlot = slot;
    this.heldPowerId = id;
    this.heldSince = this.deps.getElapsed();
    const ch = this.deps.getCharacter();
    ch.gesture(gestureForType(power.type));
    ch.setAuraColor(hexToNumber(power.color), hexToNumber(power.core));
    ch.setAuraActive(true, 'charge');
    this.deps.playCharge();
  }

  releaseCharge(): void {
    const id = this.heldPowerId;
    const heldSince = this.heldSince;
    this.heldPowerId = null;
    this.deps.getCharacter().setAuraActive(false);
    if (!id || !this.profile) return;
    const power = this.powerById(id);
    if (!power) return;
    const stats = powerStats(power);
    const held = THREE.MathUtils.clamp(this.deps.getElapsed() - heldSince, 0, 2.4);
    if (power.type === 'flight') {
      if (this.deps.getStats().ki < 8) {
        this.deps.toast('KI INSUFICIENTE PARA VOAR', 'danger', 0.7);
        return;
      }
      this.deps.toggleFlying();
      this.cooldownUntil.set(id, this.deps.getElapsed() + 1.2);
      return;
    }
    if (power.type === 'teleport') {
      if (!this.deps.spendKi(stats.kiCost)) {
        this.deps.playDeny();
        return;
      }
      this.deps.teleportForward(stats.range);
      this.cooldownUntil.set(id, this.deps.getElapsed() + stats.cooldown);
      this.deps.onRoot(0.35);
      this.deps.getCharacter().gesture('kiopen');
      return;
    }
    if (power.type === 'super_saiyan' || power.type === 'kaioken') {
      if (!this.deps.spendKi(stats.kiCost)) {
        this.deps.playDeny();
        return;
      }
      this.deps.applyTechniqueBoost(power.type, held);
      this.cooldownUntil.set(id, this.deps.getElapsed() + stats.cooldown);
      this.deps.toast(power.type === 'super_saiyan' ? 'SUPER SAIYAJIN!' : 'KAIOKEN!', 'success', 1.1);
      this.deps.onAttackEnd(0.35);
      return;
    }
    const kiCost = stats.kiCost + Math.ceil(held * 8);
    if (!this.deps.spendKi(kiCost)) {
      this.deps.toast(`PRECISA DE ${kiCost} KI`, 'danger');
      this.deps.playDeny();
      return;
    }
    const level = Math.min(1, held / Math.max(0.2, stats.charge));
    const damage = Math.round(stats.damage * (1 + level * 1.6) * this.deps.powerMult());
    const size = 0.65 + power.size * 0.18 + level * 0.35;
    this.cooldownUntil.set(id, this.deps.getElapsed() + stats.cooldown);
    this.deps.onAttackEnd(0.55);
    this.deps.onRoot(0.5);
    this.deps.getCharacter().gesture(gestureForType(power.type));
    const color = hexToNumber(power.color);
    const core = hexToNumber(power.core);
    if (power.type === 'melee_wave') {
      this.deps.castAttack('orb', color, core, stats.range, 0.12, 0.35, damage, size * 1.2, stats.blastRadius);
      this.deps.playBeam();
      return;
    }
    this.deps.castAttack(stats.style, color, core, stats.range, stats.charge + level * 0.15, stats.duration, damage, size, stats.blastRadius);
    this.deps.playBeam();
  }

  cancelCharge(): void {
    this.heldPowerId = null;
  }

  trySummonBoss(): void {
    if (!this.profile) return;
    const eco = this.economy();
    const now = this.deps.getElapsed();
    if (now < eco.bossCooldownUntil) {
      this.deps.toast(`AGUARDE ${Math.ceil(eco.bossCooldownUntil - now)}s`, 'info', 1);
      return;
    }
    if (this.boss.active) return;
    const pos = this.deps.playerPos();
    this.boss.summon(pos.x + 8, pos.z + 6);
    this.deps.toast('GUARDIÃO INVOCADO', 'danger', 1.2);
  }

  onBossDefeated(): void {
    this.awardZeni(1800);
    this.economy().bossCooldownUntil = this.deps.getElapsed() + BOSS_COOLDOWN_SEC;
    this.boss.dismiss();
    this.persist();
  }

  tryClaimMission(): void {
    const eco = this.economy();
    if (eco.missionDone) {
      this.deps.toast('MISSÃO JÁ CONCLUÍDA', 'info', 0.8);
      return;
    }
    if (eco.breaks < 8) {
      this.deps.toast(`DESTRUA OBJETOS: ${eco.breaks}/8`, 'info', 1);
      return;
    }
    eco.missionDone = true;
    this.awardZeni(220);
    this.persist();
  }

  update(dt: number, player: THREE.Vector3): void {
    this.boss.update(dt, player, this.deps.getCamera(), dmg => this.deps.damagePlayer(dmg, 'GOLPE DO GUARDIÃO'));
    if (this.boss.active && this.boss.health <= 0) this.onBossDefeated();
  }

  cooldownsForHud(): Record<string, number> {
    const cds: Record<string, number> = {};
    for (const [k, v] of this.cooldownUntil) cds[k] = Math.max(0, v - this.deps.getElapsed());
    return cds;
  }

  activeCooldown(): number {
    const id = this.economy().loadout[this.activeSlot];
    if (!id) return 0;
    return Math.max(0, (this.cooldownUntil.get(id) ?? 0) - this.deps.getElapsed());
  }

  clearCooldowns(): void {
    this.cooldownUntil.clear();
  }
}
