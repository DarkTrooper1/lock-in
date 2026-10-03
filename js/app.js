import * as S from './store.js';
import { $, esc, ymd } from './util.js';
import { modalOpen, openModal, modalHead } from './ui.js';
import { dayStatus } from './checklist.js';
import { ICONS } from './icons.js';

import today from './views/today.js';
import journal from './views/journal.js';
import backtest from './views/backtest.js';
import workout from './views/workout.js';
import stats from './views/stats.js';
import settings from './views/settings.js';

const ROUTES = [
  ['today', 'Today', today],
  ['journal', 'Journal', journal],
  ['backtest', 'Backtest', backtest],
  ['workout', 'Workout', workout],
  ['stats', 'Stats', stats],
  ['settings', 'Settings', settings],
];

function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: path || 'today', params: Object.fromEntries(new URLSearchParams(query)) };
}

function renderNav(active) {
  const status = dayStatus(ymd());
  const left = status.total - status.done;
  $('#gear').classList.toggle('active', active === 'settings');
  $('#nav').innerHTML = ROUTES.filter(([key]) => key !== 'settings').map(
    ([key, label]) =>
      `<a href="#/${key}" class="${key === active ? 'active' : ''}">${ICONS[key] || ''}<span>${esc(label)}</span>${key === 'today' && left > 0 ? '<span class="dot"></span>' : ''}</a>`,
  ).join('');
}

let pendingRender = false;
function render({ keepScroll = false } = {}) {
  const { name, params } = parseHash();
  const route = ROUTES.find((r) => r[0] === name) || ROUTES[0];
  renderNav(route[0]);
  const y = window.scrollY;
  const main = $('#app');
  main.innerHTML = '';
  try {
    route[2](main, params);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="banner bad">Something broke rendering this page: ${esc(e.message)}</div>`;
  }
  if (keepScroll) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());

// Re-render when data changes, but never under the user's fingers.
S.onChange(() => {
  const active = document.activeElement;
  const typing = active && $('#app').contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName);
  if (modalOpen() || typing) { pendingRender = true; return; }
  render({ keepScroll: true });
});
function flushPending() {
  if (!pendingRender || modalOpen()) return;
  const active = document.activeElement;
  if (active && $('#app').contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
  pendingRender = false;
  render({ keepScroll: true });
}
setInterval(flushPending, 800);
window.addEventListener('modal-closed', () => setTimeout(flushPending, 0));

// Re-render at midnight so "today" rolls over.
let currentDay = ymd();
setInterval(() => {
  if (ymd() !== currentDay) { currentDay = ymd(); render({ keepScroll: true }); }
}, 60000);

// Sync pill
const pill = $('#sync-status');
S.onSyncStatus((s) => {
  const map = {
    off: ['Not syncing', ''],
    idle: ['Synced', 'ok'],
    ok: ['Synced', 'ok'],
    busy: ['Syncing…', 'busy'],
    offline: ['Offline', 'err'],
    error: ['Sync error', 'err'],
  };
  const [text, cls] = map[s.state] || ['', ''];
  pill.textContent = text;
  pill.className = 'sync-pill ' + cls;
  pill.title = s.message || '';
});
pill.addEventListener('click', () => {
  if (!S.syncConfig()) { location.hash = '#/settings'; return; }
  const st = pill.className.includes('err') ? pill.title : '';
  if (st) openModal(`${modalHead('Sync problem')}<p>${esc(st)}</p><p class="muted small">Your data is still saved on this device. Check Settings → Sync.</p>`);
  S.sync();
});

if (!location.hash) location.hash = '#/today';
render();
S.sync();
