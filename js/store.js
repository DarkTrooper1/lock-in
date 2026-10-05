// Local-first data store. Everything lives in localStorage (records) and
// IndexedDB (screenshots), and is synced to a private GitHub repo you own.
import { uid, ymd, debounce } from './util.js';
import { DEFAULT_PLAN } from './workout-plan.js';

const LS_DATA = 'lockin.data.v1';
const LS_SYNC = 'lockin.sync.v1';
const LS_PENDING = 'lockin.pendingImages.v1';
const LS_LASTSYNC = 'lockin.lastSync.v1';

// trades/backtests/homework/assignments: id = random
// days/levels/workouts: id = "YYYY-MM-DD"
export const COLLECTIONS = ['trades', 'days', 'levels', 'backtests', 'workouts', 'homework', 'assignments', 'payouts', 'goals', 'wins'];

export const DEFAULT_SETTINGS = {
  startDate: null,
  accounts: ['Lucid'],
  setups: [],
  emotions: ['Calm', 'Confident', 'Patient', 'FOMO', 'Revenge', 'Hesitant', 'Greedy', 'Fearful', 'Bored', 'Tilted'],
  mistakes: ['Moved stop', 'Chased entry', 'Oversized', 'No setup', 'Exited early', 'Held loser', 'Ignored levels', 'Overtraded', 'Traded news'],
  levelSources: ['Daily VP', 'Weekly VP', 'Monthly VP', 'Composite VP', 'RTH VP', 'Overnight VP', 'Prev day VP', '4H VP', '1H VP', '30m VP', 'Footprint'],
  levelTypes: ['LVN', 'Single print', 'Ledge', 'Poor high/low'],
  homeworkSubjects: [],
  routine: [
    { id: 'curls', name: 'Bicep curls', target: 40 },
    { id: 'hammer', name: 'Hammer curls', target: 40 },
    { id: 'ohte', name: 'Overhead tricep extensions', target: 40 },
  ],
  checklist: {
    journal: { on: true, days: [1, 2, 3, 4, 5] },
    levels: { on: true, days: [0, 1, 2, 3, 4] },
    workout: { on: true, days: [1, 2, 3, 4, 5, 6] },
    homework: { on: true, days: [0, 1, 2, 3, 4] },
    backtest: { on: true, days: [6] },
  },
  settingsVersion: 2,
  // [{from: 'YYYY-MM-DD', checklist}] so changing your list never rewrites past days' points
  checklistHistory: [],
  workoutPlan: DEFAULT_PLAN,
  customItems: [],
  payoutPoints: 500,
  gymBonus: 100,
  winTypes: [
    { label: 'Passed an evaluation', points: 300 },
    { label: 'Green week, zero rule breaks', points: 150 },
    { label: 'Good grade on a test or exam', points: 150 },
  ],
  defaultInstrument: 'NQ',
  defaultAccount: 'Lucid',
  feePerContract: 0,
  importMappings: {},
  updatedAt: 0,
};

function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  d.version = 1;
  d.collections = d.collections || {};
  for (const c of COLLECTIONS) d.collections[c] = d.collections[c] || {};
  const s = d.settings || {};
  const existing = Object.keys(s).length > 0;
  d.settings = { ...structuredClone(DEFAULT_SETTINGS), ...s };
  d.settings.checklist = { ...structuredClone(DEFAULT_SETTINGS.checklist), ...(s.checklist || {}) };
  if (existing && (s.settingsVersion || 1) < 2) migrateToV2(d.settings);
  return d;
}

// v2 (5 Oct 2026): weekly workout plan with Sunday rest, backtesting on Saturdays.
// The old list is kept for days before the change so past points don't move.
// Fixed date + tiny updatedAt bump so every device migrates identically.
const V2_FROM = '2026-10-05';
function migrateToV2(set) {
  const old = structuredClone(set.checklist);
  const next = structuredClone(old);
  next.workout = { ...next.workout, days: [1, 2, 3, 4, 5, 6] };
  next.backtest = { on: true, days: [6] };
  set.checklistHistory = [{ from: '0000-00-00', checklist: old }, { from: V2_FROM, checklist: next }];
  set.checklist = next;
  set.workoutPlan = structuredClone(DEFAULT_PLAN);
  set.settingsVersion = 2;
  set.updatedAt = (set.updatedAt || 0) + 1;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.error('Failed to read local data', e);
  }
  return normalize({});
}

let data = loadLocal();
if (!data.settings.startDate) {
  data.settings.startDate = ymd();
  persist();
}

function persist() {
  try {
    localStorage.setItem(LS_DATA, JSON.stringify(data));
  } catch (e) {
    console.error(e);
    alert('Could not save on this device: ' + e.message);
  }
}

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (source) => listeners.forEach((fn) => fn(source));

// ---- Records ----
export const all = (col) => Object.values(data.collections[col]).filter((r) => !r.deleted);

// Records grouped by their date, cached until the data changes.
let version = 0;
const dateIndex = {};
export function byDate(col) {
  const c = dateIndex[col];
  if (c && c.version === version) return c.map;
  const map = new Map();
  for (const r of all(col)) {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date).push(r);
  }
  dateIndex[col] = { version, map };
  return map;
}
export function get(col, id) {
  const r = data.collections[col][id];
  return r && !r.deleted ? r : null;
}
export function put(col, rec) {
  const now = Date.now();
  rec = { ...rec, id: rec.id || uid(), updatedAt: now };
  if (!rec.createdAt) rec.createdAt = now;
  data.collections[col][rec.id] = rec;
  changed();
  return rec;
}
export function putMany(col, recs) {
  const now = Date.now();
  for (const r of recs) {
    const rec = { ...r, id: r.id || uid(), updatedAt: now, createdAt: r.createdAt || now };
    data.collections[col][rec.id] = rec;
  }
  changed();
}
export function remove(col, id) {
  data.collections[col][id] = { id, deleted: true, updatedAt: Date.now() };
  changed();
}
export const settings = () => data.settings;
export function saveSettings(patch) {
  data.settings = { ...data.settings, ...patch, updatedAt: Date.now() };
  changed();
}
function changed() {
  version++;
  persist();
  emit('local');
  scheduleSync();
}

// ---- Backup ----
export const exportJSON = () => JSON.stringify(data, null, 2);
export function importJSON(text) {
  data = merge(data, normalize(JSON.parse(text)));
  version++;
  persist();
  emit('remote');
  scheduleSync();
}

// Last write wins, per record. Deletions are kept as tombstones so they sync.
function merge(a, b) {
  const out = normalize(structuredClone(a));
  for (const c of COLLECTIONS) {
    const incoming = b.collections?.[c] || {};
    for (const id in incoming) {
      const mine = out.collections[c][id];
      if (!mine || (incoming[id].updatedAt || 0) > (mine.updatedAt || 0)) out.collections[c][id] = incoming[id];
    }
  }
  if ((b.settings?.updatedAt || 0) > (out.settings.updatedAt || 0)) {
    out.settings = normalize({ settings: b.settings }).settings;
  }
  // keep the earliest start date we know about
  const starts = [a.settings?.startDate, b.settings?.startDate].filter(Boolean).sort();
  if (starts.length) out.settings.startDate = starts[0];
  return out;
}

// ---- Screenshots (IndexedDB) ----
const dbp = new Promise((resolve, reject) => {
  const req = indexedDB.open('lockin', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('images');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function idb(mode, fn) {
  const db = await dbp;
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction('images', mode).objectStore('images'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const idbGet = (k) => idb('readonly', (s) => s.get(k));
const idbPut = (k, v) => idb('readwrite', (s) => s.put(v, k));

const pending = () => JSON.parse(localStorage.getItem(LS_PENDING) || '[]');
const setPending = (ids) => localStorage.setItem(LS_PENDING, JSON.stringify(ids));

export async function saveImage(blob) {
  const id = uid();
  await idbPut(id, blob);
  setPending([...pending(), id]);
  scheduleSync();
  return id;
}

const urlCache = new Map();
export async function imageURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  let blob = await idbGet(id);
  if (!blob && syncConfig()) {
    try {
      const r = await gh(`contents/images/${id}.jpg`, { accept: 'application/vnd.github.raw+json' });
      if (r.ok) {
        blob = await r.blob();
        await idbPut(id, blob);
      }
    } catch (e) {
      console.warn('image fetch failed', e);
    }
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

// ---- GitHub sync ----
export function syncConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_SYNC));
    return c && c.owner && c.repo && c.token ? c : null;
  } catch {
    return null;
  }
}
export function setSyncConfig(cfg) {
  if (cfg) localStorage.setItem(LS_SYNC, JSON.stringify(cfg));
  else localStorage.removeItem(LS_SYNC);
  syncStatus = { state: cfg ? 'idle' : 'off' };
  emitSync();
}
export const lastSync = () => Number(localStorage.getItem(LS_LASTSYNC) || 0);

let syncStatus = { state: syncConfig() ? 'idle' : 'off' };
const syncListeners = new Set();
export const onSyncStatus = (fn) => (syncListeners.add(fn), fn(syncStatus), () => syncListeners.delete(fn));
const emitSync = () => syncListeners.forEach((fn) => fn(syncStatus));
const setStatus = (state, message) => { syncStatus = { state, message }; emitSync(); };

async function gh(path, { method = 'GET', body, accept = 'application/vnd.github+json', cfg = syncConfig() } = {}) {
  const url = path.startsWith('https://')
    ? path
    // no trailing slash: GitHub redirects those, and browsers block redirects on authorised requests
    : `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path ? '/' + path : ''}`;
  return fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function ghError(r) {
  let msg = `${r.status}`;
  try { msg += ' ' + (await r.json()).message; } catch {}
  const err = new Error(`GitHub: ${msg}`);
  err.status = r.status;
  return err;
}

function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const utf8ToB64 = (str) => bytesToB64(new TextEncoder().encode(str));
function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export async function testSync(cfg) {
  let r;
  try {
    r = await gh('', { cfg });
  } catch {
    // Work out whether GitHub is unreachable or just this request was rejected.
    try {
      await fetch('https://api.github.com/zen', { cache: 'no-store' });
    } catch {
      throw new Error("Can't reach GitHub from this browser. An ad blocker, privacy shield (e.g. Brave Shields), antivirus web filter or network block is stopping api.github.com. Turn it off for this site or try another browser.");
    }
    throw new Error('GitHub is reachable but this request failed. Re-copy the token (it should start with github_pat_) and check the username and repo name.');
  }
  if (r.status === 401) throw new Error('GitHub says the token is invalid or expired. Generate a new one and paste it again.');
  if (r.status === 404) throw new Error(`Repo ${cfg.owner}/${cfg.repo} not found. Check the spelling, that it exists, and that the token was given access to it.`);
  if (!r.ok) throw await ghError(r);
  const repo = await r.json();
  if (!repo.private) throw new Error('That repo is public. Use a PRIVATE repo for your data.');
  if (repo.permissions && !repo.permissions.push) throw new Error('Token can read but not write this repo. Give it Contents: Read and write.');
  return true;
}

async function fetchRemote() {
  const r = await gh('contents/data.json');
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) throw await ghError(r);
  const j = await r.json();
  let text;
  if (j.content) text = b64ToUtf8(j.content);
  else {
    // files over 1MB come back without content; fetch the blob instead
    const b = await gh(j.git_url);
    if (!b.ok) throw await ghError(b);
    text = b64ToUtf8((await b.json()).content);
  }
  return { data: normalize(JSON.parse(text)), sha: j.sha };
}

async function uploadPendingImages() {
  for (const id of pending()) {
    const blob = await idbGet(id);
    if (blob) {
      const content = bytesToB64(new Uint8Array(await blob.arrayBuffer()));
      const r = await gh(`contents/images/${id}.jpg`, { method: 'PUT', body: { message: `image ${id}`, content } });
      // 422 = already exists, which is fine
      if (!r.ok && r.status !== 422) throw await ghError(r);
    }
    setPending(pending().filter((x) => x !== id));
  }
}

// Key-order independent JSON, so identical data always compares equal.
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

let syncing = false, again = false;
export async function sync() {
  if (!syncConfig()) return setStatus('off');
  if (!navigator.onLine) return setStatus('offline');
  if (syncing) { again = true; return; }
  syncing = true;
  setStatus('busy');
  try {
    await uploadPendingImages();
    for (let attempt = 0; ; attempt++) {
      const remote = await fetchRemote();
      const before = canon(data);
      const merged = remote.data ? merge(data, remote.data) : data;
      const after = canon(merged);
      if (after !== before) {
        data = merged;
        version++;
        persist();
        emit('remote');
      }
      // nothing new to push
      if (remote.data && canon(remote.data) === after) break;
      const r = await gh('contents/data.json', {
        method: 'PUT',
        body: {
          message: `sync ${new Date().toISOString()}`,
          content: utf8ToB64(JSON.stringify(merged)),
          ...(remote.sha ? { sha: remote.sha } : {}),
        },
      });
      if (r.ok) break;
      // someone else (your phone) wrote in between; fetch + merge again
      if ((r.status === 409 || r.status === 422) && attempt < 3) continue;
      throw await ghError(r);
    }
    localStorage.setItem(LS_LASTSYNC, String(Date.now()));
    setStatus('ok');
  } catch (e) {
    console.error(e);
    setStatus('error', e.message);
  } finally {
    syncing = false;
    if (again) { again = false; sync(); }
  }
}
const scheduleSync = debounce(() => sync(), 2500);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 120000);
}
