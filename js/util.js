export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// ---- Dates (all stored as local "YYYY-MM-DD" strings) ----
const pad = (n) => String(n).padStart(2, '0');
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export const dow = (s) => parseYmd(s).getDay();
export const isWeekend = (s) => [0, 6].includes(dow(s));
export function nextTradingDay(s) {
  let d = addDays(s, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}
export function prevTradingDay(s) {
  let d = addDays(s, -1);
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}
export function fmtDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseYmd(s).toLocaleDateString(undefined, opts);
}
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function startOfWeek(s) {
  // Monday-based week
  const d = dow(s);
  return addDays(s, d === 0 ? -6 : 1 - d);
}

// ---- Numbers ----
export function num(v) {
  if (v === '' || v == null) return null;
  let s = String(v).trim().replace(/[$,\s]/g, '');
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) s = '-' + paren[1];
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function money(n, { sign = false } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-$' : sign && n > 0 ? '+$' : '$') + s;
}
export const pct = (n, digits = 0) => (n == null || Number.isNaN(n) ? '—' : (n * 100).toFixed(digits) + '%');
export const fixed = (n, d = 2) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d));
export const pnlClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const POINT_VALUE = { NQ: 20, MNQ: 2 };
export function instrumentFromSymbol(sym) {
  const s = String(sym || '').toUpperCase().trim();
  if (s.startsWith('MNQ')) return 'MNQ';
  if (s.startsWith('NQ')) return 'NQ';
  return s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '') || s;
}

// Shrink screenshots so they sync quickly and don't fill up storage.
export async function compressImage(file, maxW = 1920, quality = 0.85) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
}

// Minimal RFC4180-ish CSV parser.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

// Parses "09/15/2025 09:31:05", "2025-09-15 09:31", "15/09/2025 9:31 PM" etc.
export function parseDateTime(s, dayFirst = false) {
  s = String(s || '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  let y, mo, d, h, mi;
  if (m) [, y, mo, d, h, mi] = m;
  else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM)?/i.exec(s);
    if (!m) return null;
    let a, b, ap;
    [, a, b, y, h, mi, , ap] = m;
    if (Number(a) > 12) dayFirst = true;
    [d, mo] = dayFirst ? [a, b] : [b, a];
    if (y.length === 2) y = '20' + y;
    h = Number(h);
    if (ap) { ap = ap.toUpperCase(); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0; }
  }
  return { date: `${y}-${pad(mo)}-${pad(d)}`, time: `${pad(h)}:${pad(mi)}` };
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
