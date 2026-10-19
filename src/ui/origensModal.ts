type ModalChoice = { title: string; message: string; confirm: string; cancel: string };

type HeroLaunchChoice = {
  title: string;
  message: string;
  confirm: string;
  cancel: string;
  defaultName: string;
};

let pendingBool: ((ok: boolean) => void) | null = null;
let pendingHero: ((result: { ok: boolean; name: string }) => void) | null = null;

function shell(): HTMLElement {
  const el = document.getElementById('origens-modal');
  if (!el) throw new Error('origens-modal');
  return el;
}

function nameField(): HTMLInputElement | null {
  return document.getElementById('origens-modal-name') as HTMLInputElement | null;
}

function nameWrap(): HTMLElement | null {
  return document.getElementById('origens-modal-name-wrap');
}

export function setupOrigensModal(): void {
  const root = shell();
  document.getElementById('origens-modal-cancel')?.addEventListener('click', () => closeBool(false));
  document.getElementById('origens-modal-confirm')?.addEventListener('click', () => {
    if (pendingHero) {
      const raw = (nameField()?.value ?? '').trim().slice(0, 28);
      closeHero({ ok: true, name: raw || 'Guerreiro' });
      return;
    }
    closeBool(true);
  });
  root.addEventListener('click', event => {
    if (event.target === root) {
      if (pendingHero) closeHero({ ok: false, name: '' });
      else closeBool(false);
    }
  });
}

function closeBool(ok: boolean): void {
  shell().classList.add('hidden');
  nameWrap()?.classList.add('hidden');
  pendingBool?.(ok);
  pendingBool = null;
}

function closeHero(result: { ok: boolean; name: string }): void {
  shell().classList.add('hidden');
  nameWrap()?.classList.add('hidden');
  pendingHero?.(result);
  pendingHero = null;
}

export function askOrigensModal(choice: ModalChoice): Promise<boolean> {
  return new Promise(resolve => {
    pendingBool = resolve;
    pendingHero = null;
    paint(choice);
    nameWrap()?.classList.add('hidden');
    shell().classList.remove('hidden');
  });
}

export function askOrigensHeroLaunch(choice: HeroLaunchChoice): Promise<{ ok: boolean; name: string }> {
  return new Promise(resolve => {
    pendingHero = resolve;
    pendingBool = null;
    paint(choice);
    nameWrap()?.classList.remove('hidden');
    const input = nameField();
    if (input) {
      input.value = choice.defaultName;
      setTimeout(() => input.focus(), 0);
    }
    shell().classList.remove('hidden');
  });
}

function paint(choice: ModalChoice | HeroLaunchChoice): void {
  const title = document.getElementById('origens-modal-title');
  const body = document.getElementById('origens-modal-body');
  const ok = document.getElementById('origens-modal-confirm');
  const no = document.getElementById('origens-modal-cancel');
  if (title) title.textContent = choice.title;
  if (body) body.textContent = choice.message;
  if (ok) ok.textContent = choice.confirm;
  if (no) no.textContent = choice.cancel;
}
