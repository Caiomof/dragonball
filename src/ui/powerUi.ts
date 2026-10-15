import {
  COST_CREATE,
  COST_EDIT,
  COST_UNLOCK,
  LOADOUT_SLOTS,
  POWER_RACE_LOCK,
  POWER_SYMBOLS,
  POWER_TYPES,
  SIZE_LABELS,
  type CustomPower,
  type PowerTypeId,
  powerStats,
} from '../data/powers';
import type { PowerEconomy } from '../data/profiles';
import type { RaceId } from '../data/gameConfig';
import { mountPowerCastPreview, stopPowerCastPreview, updatePowerCastPreview } from './powerCastPreview';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export type PowerUiActions = {
  close(): void;
  unlock(type: PowerTypeId): void;
  openCreator(editId?: string): void;
  saveCreator(): void;
  cancelCreator(): void;
  equip(powerId: string, slot: number, fromSlot?: number): void;
  setShopFilter(filter: string): void;
};

let draft: Partial<CustomPower> = { size: 2, symbol: '✦', color: '#5ec8ff', core: '#dff6ff', type: 'ball', name: 'Novo poder' };
let editId: string | null = null;
let shopFilter = 'all';
let libraryTab: 'owned' | 'shop' = 'owned';
let libraryEconomy: PowerEconomy | null = null;
let libraryRace: RaceId = 'saiyajin';
let powerActions: PowerUiActions | null = null;
let dragPayload: { powerId: string; fromSlot?: number } | null = null;

export function bindPowerUi(actions: PowerUiActions): void {
  powerActions = actions;
  el('power-library-close').onclick = () => actions.close();
  el('power-creator-cancel').onclick = () => {
    stopPowerCastPreview();
    actions.cancelCreator();
  };
  el('power-creator-save').onclick = () => actions.saveCreator();
  el('library-tab-owned').onclick = () => setLibraryTab('owned');
  el('library-tab-shop').onclick = () => setLibraryTab('shop');
  el('power-shop-filter-tabs').onclick = e => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (!chip) return;
    shopFilter = chip.dataset.filter ?? 'all';
    syncShopFilterChips();
    if (libraryEconomy) renderShop(libraryEconomy, libraryRace);
    actions.setShopFilter(shopFilter);
  };
  el('power-creator-size').oninput = e => { draft.size = Number((e.target as HTMLInputElement).value); paintCreatorPreview(); };
  el('power-creator-name').oninput = e => { draft.name = (e.target as HTMLInputElement).value.slice(0, 20); paintCreatorPreview(); };
  const syncType = () => {
    draft.type = el<HTMLSelectElement>('power-creator-type').value as PowerTypeId;
    paintCreatorPreview();
  };
  el('power-creator-type').onchange = syncType;
  el('power-creator-type').oninput = syncType;
  el('power-creator-color').oninput = e => { draft.color = (e.target as HTMLInputElement).value; paintCreatorPreview(); };
  el('power-creator-core').oninput = e => { draft.core = (e.target as HTMLInputElement).value; paintCreatorPreview(); };
  document.getElementById('power-symbol-grid')!.onclick = e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-symbol]');
    if (!b) return;
    draft.symbol = b.dataset.symbol!;
    paintCreatorPreview();
    document.querySelectorAll('#power-symbol-grid .symbol-pick').forEach(n => n.classList.toggle('selected', n === b));
  };
}

function setLibraryTab(tab: 'owned' | 'shop'): void {
  libraryTab = tab;
  el('library-tab-owned').classList.toggle('selected', tab === 'owned');
  el('library-tab-shop').classList.toggle('selected', tab === 'shop');
  el('library-panel-owned').classList.toggle('hidden', tab !== 'owned');
  el('library-panel-shop').classList.toggle('hidden', tab !== 'shop');
}

function syncShopFilterChips(): void {
  document.querySelectorAll('#power-shop-filter-tabs .shop-filter-chip').forEach(node => {
    node.classList.toggle('selected', (node as HTMLButtonElement).dataset.filter === shopFilter);
  });
}

export function openLibrary(economy: PowerEconomy, zeni: number, race: RaceId): void {
  libraryEconomy = economy;
  libraryRace = race;
  el('power-library-screen').classList.remove('hidden');
  el('power-zeni-label').textContent = `${Math.floor(zeni)} Z`;
  setLibraryTab(libraryTab);
  syncShopFilterChips();
  paintLibrary(economy, race);
}

export function repaintLibrary(economy: PowerEconomy, zeni: number, race: RaceId): void {
  libraryEconomy = economy;
  libraryRace = race;
  el('power-zeni-label').textContent = `${Math.floor(zeni)} Z`;
  paintLibrary(economy, race);
}

function paintLibrary(economy: PowerEconomy, race: RaceId): void {
  renderEquipBar(economy);
  renderMyPowers(economy);
  renderShop(economy, race);
}

export function closeLibrary(): void {
  el('power-library-screen').classList.add('hidden');
  el('power-creator-screen').classList.add('hidden');
  stopPowerCastPreview();
}

function renderEquipBar(economy: PowerEconomy): void {
  const bar = el('library-equip-bar');
  bar.innerHTML = Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = economy.loadout[i];
    const p = id ? economy.powers.find(x => x.id === id) : null;
    const drag = p ? `draggable="true" data-power-id="${p.id}" data-from-slot="${i}"` : '';
    return `<div class="library-slot ${p ? '' : 'empty'}" data-slot="${i}" ${drag} style="--skill-color:${p?.color ?? '#4a6a72'}">
      <span class="library-slot-num">${i + 1}</span>
      <span class="library-slot-icon">${p?.symbol ?? '·'}</span>
      <span class="library-slot-name">${p ? escape(p.name.slice(0, 10)) : 'Vazio'}</span>
    </div>`;
  }).join('');
  bindLibraryDragDrop(bar);
}

function bindLibraryDragDrop(bar: HTMLElement): void {
  const onDragStart = (powerId: string, fromSlot: number | undefined, target: HTMLElement, event: DragEvent): void => {
    dragPayload = { powerId, fromSlot };
    event.dataTransfer?.setData('text/power-id', powerId);
    if (fromSlot !== undefined) event.dataTransfer?.setData('text/from-slot', String(fromSlot));
    event.dataTransfer!.effectAllowed = 'move';
    target.classList.add('dragging');
  };

  const onDragEnd = (target: HTMLElement): void => {
    target.classList.remove('dragging');
    dragPayload = null;
    bar.querySelectorAll('.library-slot').forEach(node => node.classList.remove('drag-over'));
  };

  bar.querySelectorAll<HTMLElement>('.library-slot').forEach(slotEl => {
    const slot = Number(slotEl.dataset.slot);
    const fromSlot = slotEl.dataset.fromSlot !== undefined ? Number(slotEl.dataset.fromSlot) : undefined;
    const powerId = slotEl.dataset.powerId;

    if (powerId) {
      slotEl.ondragstart = e => onDragStart(powerId, fromSlot, slotEl, e);
      slotEl.ondragend = () => onDragEnd(slotEl);
    }

    slotEl.ondragover = e => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      slotEl.classList.add('drag-over');
    };
    slotEl.ondragleave = () => slotEl.classList.remove('drag-over');
    slotEl.ondrop = e => {
      e.preventDefault();
      slotEl.classList.remove('drag-over');
      const id = dragPayload?.powerId ?? e.dataTransfer?.getData('text/power-id');
      if (!id) return;
      const srcRaw = e.dataTransfer?.getData('text/from-slot');
      const src = srcRaw !== '' && srcRaw != null ? Number(srcRaw) : dragPayload?.fromSlot;
      powerActions?.equip(id, slot, Number.isFinite(src) ? src : undefined);
      dragPayload = null;
    };
  });

  const list = el('power-owned-list');
  list.querySelectorAll<HTMLElement>('.power-grid-card').forEach(card => {
    const id = card.dataset.powerId;
    if (!id) return;
    card.ondragstart = e => onDragStart(id, undefined, card, e);
    card.ondragend = () => onDragEnd(card);
  });
}

function renderMyPowers(economy: PowerEconomy): void {
  const list = el('power-owned-list');
  list.innerHTML = economy.powers.map(p => {
    const meta = POWER_TYPES.find(t => t.id === p.type);
    const s = powerStats(p);
    const tip = `${meta?.label ?? p.type} · ${meta?.blurb ?? ''} · Dano ${s.damage} · Alcance ${s.range} m · Ki ${s.kiCost} · Acerto ${Math.round(s.hit * 100)}% · Área ${s.blastRadius} m`;
    return `<article class="power-grid-card" draggable="true" data-power-id="${p.id}" style="--pc:${p.color}" title="${escape(tip)}">
      <span class="power-grid-icon">${p.symbol}</span>
      <span class="power-grid-name">${escape(p.name)}</span>
      <span class="power-grid-type">${meta?.label ?? p.type}</span>
      <div class="power-grid-tip" role="tooltip">${escape(tip)}</div>
      <div class="power-grid-actions">
        <button type="button" class="button button-subtle" data-edit="${p.id}">Editar</button>
      </div>
    </article>`;
  }).join('') || '<p class="muted library-grid-empty">Nenhum poder ainda. Toque em <strong>Criar novo poder</strong> acima.</p>';
  list.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b => b.onclick = () => {
    const p = economy.powers.find(x => x.id === b.dataset.edit);
    if (p) powerActions?.openCreator(p.id);
  });
  el('power-create-new').onclick = () => powerActions?.openCreator();
  bindLibraryDragDrop(el('library-equip-bar'));
}

function shopTypeVisual(type: PowerTypeId): string {
  const map: Partial<Record<PowerTypeId, string>> = {
    ball: 'vis-ball',
    beam_wide: 'vis-beam-wide',
    beam_narrow: 'vis-beam-narrow',
    disc: 'vis-disc',
    burst: 'vis-burst',
    melee_wave: 'vis-wave',
    flight: 'vis-flight',
    teleport: 'vis-teleport',
    super_saiyan: 'vis-ssj',
    kaioken: 'vis-kaioken',
  };
  return map[type] ?? 'vis-ball';
}

function shopCard(t: (typeof POWER_TYPES)[number], economy: PowerEconomy, race: RaceId): string {
  const owned = economy.unlockedTypes.includes(t.id);
  const price = COST_UNLOCK[t.id] ?? 0;
  const lockRace = POWER_RACE_LOCK[t.id];
  const raceBlocked = lockRace && lockRace !== race;
  const tag = t.category === 'movement' ? 'Movimento' : t.category === 'technique' ? 'Técnica' : 'Ataque';
  const buyLabel = raceBlocked ? 'Só Saiyajin' : owned ? '✓' : 'Comprar';
  return `<article class="power-shop-card ${owned ? 'owned' : ''} ${raceBlocked ? 'locked-race' : ''}" data-category="${t.category}">
      <div class="shop-card-head">
        <span class="shop-type-vis ${shopTypeVisual(t.id)}" aria-hidden="true"></span>
        <div>
          <span class="shop-cat">${tag}</span>
          <strong class="shop-title">${t.label}</strong>
        </div>
      </div>
      <p class="shop-blurb">${t.blurb}</p>
      <div class="shop-card-foot">
        <span class="price">${owned ? 'Desbloqueado' : raceBlocked ? 'Raça' : `${price} Z`}</span>
        <button type="button" class="button button-subtle" data-unlock="${t.id}" ${owned || raceBlocked ? 'disabled' : ''}>${buyLabel}</button>
      </div>
    </article>`;
}

function renderShop(economy: PowerEconomy, race: RaceId): void {
  const grid = el('power-shop-grid');
  const types = POWER_TYPES.filter(t => shopFilter === 'all' || t.category === shopFilter);
  if (shopFilter === 'all') {
    const attacks = types.filter(t => t.category === 'attack');
    const movements = types.filter(t => t.category === 'movement');
    const techniques = types.filter(t => t.category === 'technique');
    grid.innerHTML = [
      attacks.length ? `<h4 class="shop-group-title">Formatos de ataque</h4>${attacks.map(t => shopCard(t, economy, race)).join('')}` : '',
      movements.length ? `<h4 class="shop-group-title">Movimento</h4>${movements.map(t => shopCard(t, economy, race)).join('')}` : '',
      techniques.length ? `<h4 class="shop-group-title">Técnicas especiais</h4>${techniques.map(t => shopCard(t, economy, race)).join('')}` : '',
    ].join('');
  } else {
    grid.innerHTML = types.length
      ? types.map(t => shopCard(t, economy, race)).join('')
      : '<p class="muted">Nada nesta categoria.</p>';
  }
  grid.querySelectorAll<HTMLButtonElement>('[data-unlock]').forEach(b => b.onclick = () => {
    powerActions?.unlock(b.dataset.unlock as PowerTypeId);
  });
}

function paintCreatorTypeSelect(unlocked: PowerTypeId[]): void {
  const typeSel = el<HTMLSelectElement>('power-creator-type');
  const types = POWER_TYPES.filter(t => unlocked.includes(t.id));
  typeSel.innerHTML = types.length
    ? types.map(t => `<option value="${t.id}">${t.label} — ${t.blurb}</option>`).join('')
    : '<option value="" disabled>Desbloqueie um tipo na loja</option>';
  const pick = draft.type && unlocked.includes(draft.type) ? draft.type : types[0]?.id;
  if (pick) {
    draft.type = pick;
    typeSel.value = pick;
  }
}

export function openCreator(power?: CustomPower, economy?: PowerEconomy): void {
  editId = power?.id ?? null;
  draft = power ? { ...power } : { name: 'Novo poder', symbol: '✦', type: 'ball', color: '#5ec8ff', core: '#dff6ff', size: 2 };
  el('power-creator-screen').classList.remove('hidden');
  el<HTMLInputElement>('power-creator-name').value = draft.name ?? '';
  el<HTMLInputElement>('power-creator-size').value = String(draft.size ?? 2);
  el<HTMLInputElement>('power-creator-color').value = draft.color ?? '#5ec8ff';
  el<HTMLInputElement>('power-creator-core').value = draft.core ?? '#dff6ff';
  paintCreatorTypeSelect(economy?.unlockedTypes ?? ['ball']);
  const canvas = el<HTMLCanvasElement>('power-preview-canvas');
  requestAnimationFrame(() => {
    mountPowerCastPreview(canvas);
    paintCreatorPreview();
  });
}

function paintCreatorPreview(): void {
  const type = draft.type ?? 'ball';
  const power = { id: 'x', name: draft.name ?? '', symbol: draft.symbol ?? '✦', type, color: draft.color ?? '#5ec8ff', core: draft.core ?? '#dff6ff', size: draft.size ?? 2 };
  const stats = powerStats(power);
  const meta = POWER_TYPES.find(t => t.id === type);
  const title = el('power-creator-title');
  if (title) title.textContent = (draft.name?.trim() || 'Novo poder').slice(0, 20);
  const hint = el('power-preview-type-hint');
  hint.textContent = meta?.blurb ?? 'Guerreiro de exemplo em 3ª pessoa — disparo real no alvo.';
  updatePowerCastPreview(power);
  const setStat = (id: string, text: string) => { const node = document.getElementById(id); if (node) node.textContent = text; };
  if (type === 'flight') {
    setStat('stat-damage', '—');
    setStat('stat-range', '—');
    setStat('stat-ki', 'Voo');
    setStat('stat-hit', '—');
    setStat('stat-blast', '—');
    el('power-creator-summary').textContent = `${meta?.label ?? 'Voo'} · ativa o voo especial do tipo.`;
  } else if (type === 'teleport') {
    setStat('stat-damage', '—');
    setStat('stat-range', `${stats.range} m`);
    setStat('stat-ki', String(stats.kiCost));
    setStat('stat-hit', '—');
    setStat('stat-blast', `${stats.blastRadius} m`);
    el('power-creator-summary').textContent = `Salto à frente · recarga ${stats.cooldown.toFixed(1)}s`;
  } else if (type === 'super_saiyan' || type === 'kaioken') {
    setStat('stat-damage', 'Buff');
    setStat('stat-range', '—');
    setStat('stat-ki', String(stats.kiCost));
    setStat('stat-hit', '—');
    setStat('stat-blast', '—');
    el('power-creator-summary').textContent = `${meta?.label ?? type} · recarga ${stats.cooldown.toFixed(0)}s`;
  } else {
    setStat('stat-damage', String(stats.damage));
    setStat('stat-range', `${stats.range} m`);
    setStat('stat-ki', String(stats.kiCost));
    setStat('stat-hit', `${Math.round(stats.hit * 100)}%`);
    setStat('stat-blast', `${stats.blastRadius} m`);
    el('power-creator-summary').textContent = `${meta?.label ?? type} · veja o disparo acima`;
  }
  el('power-creator-cost').textContent = editId ? `${COST_EDIT} Z` : `${COST_CREATE} Z`;
  el('power-creator-size-label').textContent = SIZE_LABELS[draft.size ?? 2];
  el('power-symbol-grid').innerHTML = POWER_SYMBOLS.map(s => `<button type="button" class="symbol-pick ${s === draft.symbol ? 'selected' : ''}" data-symbol="${s}">${s}</button>`).join('');
}

export function readCreatorDraft(): { draft: Partial<CustomPower>; editId: string | null } {
  return { draft: { ...draft, name: el<HTMLInputElement>('power-creator-name').value.trim().slice(0, 20) || 'Poder' }, editId };
}

export function renderHotbar(economy: PowerEconomy, activeSlot: number, cooldowns: Record<string, number>): void {
  const bar = el('skill-hotbar');
  bar.innerHTML = Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
    const id = economy.loadout[i];
    const p = id ? economy.powers.find(x => x.id === id) : null;
    const cd = id ? cooldowns[id] ?? 0 : 0;
    return `<button type="button" class="skill-slot ${i === activeSlot ? 'active' : ''} ${p ? '' : 'empty'}" data-slot="${i}" style="--skill-color:${p?.color ?? '#6a8a90'}">
      <span class="skill-key">${i + 1}</span>
      <span class="skill-icon">${p?.symbol ?? '+'}</span>
      <span class="skill-name">${p?.name?.slice(0, 8) ?? 'VAZIO'}</span>
      <i class="cooldown-shade" style="height:${cd > 0 ? 100 : 0}%"></i>
    </button>`;
  }).join('');
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
