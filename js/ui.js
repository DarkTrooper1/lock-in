// Shared UI bits: modals, toasts, chip pickers, screenshot pickers.
import { $, $$, esc, compressImage } from './util.js';
import * as S from './store.js';

let modalStack = [];

export function openModal(html, { wide = false, onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog">${html}</div>`;
  $('#modal-root').appendChild(backdrop);
  const modal = backdrop.firstElementChild;
  const entry = { backdrop, onClose };
  modalStack.push(entry);
  const close = () => {
    backdrop.remove();
    modalStack = modalStack.filter((m) => m !== entry);
    onClose?.();
    window.dispatchEvent(new Event('modal-closed'));
  };
  entry.close = close;
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', close));
  return { el: modal, close };
}
export const modalOpen = () => modalStack.length > 0;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
});

export function modalHead(title) {
  return `<div class="modal-head"><h2>${esc(title)}</h2><button class="ghost icon" data-close aria-label="Close">✕</button></div>`;
}

export function toast(msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function confirmBox(msg) {
  return window.confirm(msg);
}

// ---- Chips ----
export function chipsHTML(name, options, selected = [], { bad = false, single = false } = {}) {
  const sel = new Set(selected || []);
  const extra = [...sel].filter((s) => !options.includes(s));
  return `<div class="chips" data-chips="${esc(name)}" ${single ? 'data-single' : ''}>${[...options, ...extra]
    .map((o) => `<button type="button" class="chip ${bad ? 'bad' : ''} ${sel.has(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`)
    .join('')}</div>`;
}
export function bindChips(root) {
  $$('[data-chips]', root).forEach((wrap) => {
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      if (wrap.hasAttribute('data-single')) $$('.chip', wrap).forEach((c) => c !== b && c.classList.remove('on'));
      b.classList.toggle('on');
      wrap.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}
export const readChips = (root, name) => $$(`[data-chips="${name}"] .chip.on`, root).map((c) => c.dataset.v);

// ---- Segmented control ----
export function segHTML(name, options, value) {
  return `<div class="seg" data-seg="${esc(name)}">${options
    .map(([v, label, cls = '']) => `<button type="button" class="${cls} ${v === value ? 'on' : ''}" data-v="${esc(v)}">${esc(label)}</button>`)
    .join('')}</div>`;
}
export function bindSeg(root) {
  $$('[data-seg]', root).forEach((wrap) =>
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('button', wrap).forEach((x) => x.classList.toggle('on', x === b));
      wrap.dispatchEvent(new Event('change', { bubbles: true }));
    }),
  );
}
export const readSeg = (root, name) => $(`[data-seg="${name}"] button.on`, root)?.dataset.v ?? null;

// ---- Screenshots ----
export async function fillThumb(img, id) {
  const url = await S.imageURL(id);
  if (url) img.src = url;
  else img.alt = 'not synced yet';
}

export function openLightbox(id) {
  const m = openModal(`${modalHead('Screenshot')}<div class="lightbox"><img alt=""></div>`, { wide: true });
  fillThumb($('img', m.el), id);
}

export function thumbsHTML(ids = []) {
  return `<div class="imgpick">${ids.map((id) => `<div class="thumb" data-img="${esc(id)}"><img alt=""></div>`).join('')}</div>`;
}
export function bindThumbs(root) {
  $$('.thumb[data-img]', root).forEach((t) => {
    fillThumb($('img', t), t.dataset.img);
    t.addEventListener('click', (e) => { if (!e.target.closest('.x')) openLightbox(t.dataset.img); });
  });
}

// An editable list of screenshots. Supports file picking and Ctrl+V paste.
export function imagePicker(el, initial = [], onChange) {
  let ids = [...initial];
  const render = () => {
    el.innerHTML = `<div class="imgpick">
      ${ids.map((id) => `<div class="thumb" data-img="${esc(id)}"><img alt=""><button type="button" class="x" data-rm="${esc(id)}">✕</button></div>`).join('')}
      <label class="btn sm" style="cursor:pointer">+ Screenshot<input type="file" accept="image/*" multiple hidden></label>
      <span class="drop-hint">or paste (Ctrl+V)</span>
    </div>`;
    bindThumbs(el);
    $$('[data-rm]', el).forEach((b) => b.addEventListener('click', () => { ids = ids.filter((x) => x !== b.dataset.rm); render(); onChange?.(ids); }));
    $('input[type=file]', el).addEventListener('change', (e) => add([...e.target.files]));
  };
  const add = async (files) => {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const blob = await compressImage(f);
        ids.push(await S.saveImage(blob));
      } catch (e) {
        toast('Could not add image: ' + e.message);
      }
    }
    render();
    onChange?.(ids);
  };
  const onPaste = (e) => {
    if (!el.isConnected) return document.removeEventListener('paste', onPaste);
    // only the picker in the top-most modal (or the page, if no modal) takes the paste
    const top = $('#modal-root').lastElementChild;
    if (top && !top.contains(el)) return;
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); add(files); }
  };
  document.addEventListener('paste', onPaste);
  render();
  return { get: () => [...ids], destroy: () => document.removeEventListener('paste', onPaste) };
}

export function kpi(label, value, { cls = '', sub = '' } = {}) {
  return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value ${cls}">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

export function options(list, value, { blank } = {}) {
  const arr = [...list];
  if (value && !arr.includes(value)) arr.push(value);
  return (blank != null ? `<option value="">${esc(blank)}</option>` : '') +
    arr.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');
}
