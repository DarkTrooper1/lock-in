// The daily non-negotiables and how "done" is decided for each.
import * as S from './store.js';
import { dow, addDays, ymd, nextTradingDay, fmtDate } from './util.js';

// route: where the item is logged in the app. Items without one are just ticked off.
// logOnly: can't be ticked by hand; only counts once it's actually logged.
export const ITEMS = [
  { key: 'journal', label: "Journal today's trades", route: '#/journal' },
  { key: 'levels', label: 'Plot levels for next session' },
  { key: 'workout', label: 'Workout', route: '#/workout', logOnly: true },
  { key: 'homework', label: 'Homework' },
  { key: 'backtest', label: 'Backtesting session', route: '#/backtest' },
];

export const ITEM_POINTS = { journal: 20, levels: 20, workout: 15, homework: 15, backtest: 15 };

// Trading only happens on weekdays. Levels are plotted the evening before a
// session, so they run Sunday to Thursday.
export const ALLOWED_DAYS = { journal: [1, 2, 3, 4, 5], backtest: [1, 2, 3, 4, 5], levels: [0, 1, 2, 3, 4] };

// Built-in items plus any you've added yourself in Settings.
export function allItems() {
  const custom = (S.settings().customItems || []).map((c) => ({
    key: 'c:' + c.id, label: c.label, points: c.points, custom: true, def: c,
  }));
  return [...ITEMS.map((i) => ({ ...i, points: ITEM_POINTS[i.key] })), ...custom];
}
export const itemFor = (key) => allItems().find((i) => i.key === key);
export const pointsFor = (key) => itemFor(key)?.points || 0;

export function labelFor(key, date) {
  if (key === 'levels') return `Plot levels for ${fmtDate(nextTradingDay(date))}`;
  return itemFor(key)?.label || key;
}

// Is this item required on this date?
export function applies(key, date) {
  const c = key.startsWith('c:') ? itemFor(key)?.def : S.settings().checklist[key];
  const day = dow(date);
  if (ALLOWED_DAYS[key] && !ALLOWED_DAYS[key].includes(day)) return false;
  return !!(c && c.on !== false && (c.days || []).includes(day) && date >= (S.settings().startDate || date));
}

export function workoutProgress(date) {
  const w = S.get('workouts', date);
  const routine = S.settings().routine;
  const total = routine.reduce((a, ex) => a + ex.target, 0) || 1;
  const done = routine.reduce((a, ex) => a + Math.min(ex.target, w?.reps?.[ex.id] || 0), 0);
  return done / total;
}

// Ticked by hand on the front page?
export const isTicked = (key, date) => !!S.get('days', date)?.ticks?.[key];

// Done because of something logged in the app (not a manual tick).
export function isLogged(key, date) {
  switch (key) {
    case 'journal':
      return !!S.get('days', date)?.noTrade || S.byDate('trades').has(date);
    case 'workout':
      return workoutProgress(date) >= 1;
    case 'backtest':
      return S.byDate('backtests').has(date);
  }
  return false;
}

export const isDone = (key, date) => (!itemFor(key)?.logOnly && isTicked(key, date)) || isLogged(key, date);

export function setTick(key, date, on) {
  const day = S.get('days', date) || { id: date, date };
  S.put('days', { ...day, ticks: { ...(day.ticks || {}), [key]: on } });
}

// Everything on the list is compulsory on its days.
export function dayStatus(date) {
  const items = allItems()
    .filter((i) => applies(i.key, date))
    .map((i) => ({ ...i, label: labelFor(i.key, date), done: isDone(i.key, date) }));
  const done = items.filter((i) => i.done).length;
  return { date, items, done, total: items.length, complete: items.length > 0 && done === items.length };
}

// Consecutive days with everything done. Today only counts once it's complete;
// days where nothing was required are skipped rather than breaking the streak.
export function streak(today = ymd()) {
  const start = S.settings().startDate || today;
  let n = 0;
  const t = dayStatus(today);
  if (t.complete) n++;
  for (let d = addDays(today, -1); d >= start; d = addDays(d, -1)) {
    const s = dayStatus(d);
    if (!s.total) continue;
    if (!s.complete) break;
    n++;
  }
  return n;
}

export function bestStreak(today = ymd()) {
  const start = S.settings().startDate || today;
  let best = 0, cur = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const s = dayStatus(d);
    if (!s.total) continue;
    if (s.complete) best = Math.max(best, ++cur);
    else if (d !== today) cur = 0;
  }
  return best;
}

// Most recent past day that had requirements, if anything was left undone.
export function lastMissed(today = ymd()) {
  const start = S.settings().startDate || today;
  for (let d = addDays(today, -1), i = 0; d >= start && i < 7; d = addDays(d, -1), i++) {
    const s = dayStatus(d);
    if (!s.total) continue;
    return s.complete ? null : s;
  }
  return null;
}
