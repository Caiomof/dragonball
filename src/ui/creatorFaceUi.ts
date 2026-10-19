import { BEARD_MESH, BEARD_STYLES, HAIR_STYLES, OUTFIT_OPTIONS } from '../data/appearanceCatalog';
import { paintHairGallery, paintMeshThumb } from './hairThumbs';

function galleryButton(kind: string, index: number, label: string, selected: boolean): string {
  const canvas = kind === 'beard' && index === 0 ? '' : '<canvas class="hair-thumb" width="160" height="160"></canvas>';
  return `<button type="button" class="hair-preset ${selected ? 'selected' : ''}" data-${kind}-style="${index}">${canvas}<b>${label}</b></button>`;
}

export function mountCreatorFaceGalleries(selectedHair: number, selectedBeard: number, selectedOutfit: number): void {
  const hair = document.getElementById('hair-gallery');
  const beard = document.getElementById('beard-gallery');
  const outfit = document.getElementById('outfit-gallery');
  if (hair) {
    hair.innerHTML = HAIR_STYLES.map((style, index) => galleryButton('hair', index, style.label, index === selectedHair)).join('');
  }
  if (beard) {
    beard.innerHTML = BEARD_STYLES.map(style => galleryButton('beard', style.id, style.label, style.id === selectedBeard)).join('');
  }
  if (outfit) {
    outfit.innerHTML = OUTFIT_OPTIONS.map(opt => {
      const canvas = opt.id === 0 ? '<span class="hair-glyph short">GI</span>' : '<canvas class="hair-thumb" width="160" height="160"></canvas>';
      const selected = opt.id === selectedOutfit;
      return `<button type="button" class="hair-preset ${selected ? 'selected' : ''}" data-outfit-style="${opt.id}">${canvas}<b>${opt.label}</b></button>`;
    }).join('');
  }
  paintHairGallery();
  for (const id of [1, 2, 3]) {
    void paintMeshThumb(BEARD_MESH, document.querySelector<HTMLCanvasElement>(`#beard-gallery [data-beard-style="${id}"] canvas`));
  }
  OUTFIT_OPTIONS.forEach(opt => {
    if (!opt.preview) return;
    void paintMeshThumb(opt.preview, document.querySelector<HTMLCanvasElement>(`#outfit-gallery [data-outfit-style="${opt.id}"] canvas`));
  });
}
