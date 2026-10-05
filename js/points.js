// Points are worked out from what you've logged, never stored, so every
// device always agrees and editing an old day fixes its points automatically.
import * as S from './store.js';
import { addDays, ymd, startOfWeek } from './util.js';
import { dayStatus, ITEM_POINTS } from './checklist.js';

export { ITEM_POINTS };
export const PERFECT_DAY_BONUS = 25;
export const STREAK_BONUSES = [
  { every: 7, points: 100, label: '7-day streak' },
  { every: 30, points: 500, label: '30-day streak' },
];
export const payoutPoints = () => S.settings().payoutPoints ?? 500;
export const gymBonus = () => S.settings().gymBonus ?? 100;
export const GYM_SESSIONS = 2; // gym visits in one Monday-Sunday week to earn the bonus

export const wentToGym = (date) => !!S.get('days', date)?.gym;

// Gym visits so far in date's week (Monday start), up to and including date.
export function gymCountThisWeek(date) {
  let n = 0;
  for (let d = startOfWeek(date); d <= date; d = addDays(d, 1)) if (wentToGym(d)) n++;
  return n;
}

// Points from the day's list plus the perfect day bonus.
export function dayPoints(date, status = dayStatus(date)) {
  let pts = 0;
  for (const i of status.items) if (i.done) pts += i.points;
  if (status.complete) pts += PERFECT_DAY_BONUS;
  return pts;
}

// Payouts and other big wins logged on a date.
export function bigWins(date) {
  const wins = (S.byDate('wins').get(date) || []).map((w) => ({ label: w.label, points: w.points || 0 }));
  const payouts = (S.byDate('payouts').get(date) || []).map(() => ({ label: 'Payout', points: payoutPoints() }));
  return [...payouts, ...wins];
}

export function dayPotential(status) {
  return status.items.reduce((a, i) => a + i.points, 0) + (status.total ? PERFECT_DAY_BONUS : 0);
}

export function pointsBetween(from, to = ymd()) {
  const days = dailyPoints(from, to);
  return { total: days.reduce((a, d) => a + d.pts, 0) };
}

// [{date, pts, big, bonus, complete, required}] per day; pts includes streak bonuses and big wins.
// Streaks are counted from your first day, so a goal started mid-streak still gets its bonuses.
export function dailyPoints(from, to = ymd()) {
  const start = S.settings().startDate || to;
  const today = ymd();
  const out = [];
  let run = 0;
  for (let d = start < from ? start : from; d <= to; d = addDays(d, 1)) {
    const st = dayStatus(d);
    let pts = dayPoints(d, st);
    let bonus = 0;
    if (st.total) {
      if (st.complete) {
        run++;
        for (const b of STREAK_BONUSES) if (run % b.every === 0) bonus += b.points;
      } else if (d !== today) run = 0;
    }
    // gym bonus lands on the day of the week's 2nd visit
    if (wentToGym(d) && gymCountThisWeek(d) === GYM_SESSIONS) bonus += gymBonus();
    const big = bigWins(d).reduce((a, w) => a + w.points, 0);
    pts += bonus + big;
    if (d >= from) out.push({ date: d, pts, big, bonus, complete: st.complete, required: st.total });
  }
  return out;
}

export function activeGoal() {
  return S.all('goals').filter((g) => !g.claimedOn).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

// Payouts and big wins dated before the goal started still count toward it,
// unless they were logged before a previous goal was claimed (that goal had them).
export function earlyBigWinPoints(goal) {
  const prevClaim = Math.max(0, ...S.all('goals').filter((g) => g.claimedOn && g.id !== goal.id && g.createdAt < goal.createdAt).map((g) => g.updatedAt || 0));
  const early = (r) => r.date < goal.startDate && (r.createdAt || 0) > prevClaim;
  return S.all('payouts').filter(early).length * payoutPoints() + S.all('wins').filter(early).reduce((a, w) => a + (w.points || 0), 0);
}

export function goalProgress(goal, today = ymd()) {
  const earned = pointsBetween(goal.startDate, today).total + earlyBigWinPoints(goal);
  return { earned, pct: Math.min(1, earned / (goal.target || 1)), reached: earned >= goal.target };
}
