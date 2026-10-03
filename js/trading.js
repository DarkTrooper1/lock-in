// Trade math + stats shared by the journal, today and stats pages.
import { POINT_VALUE, sum } from './util.js';

export const pointValue = (inst) => POINT_VALUE[inst] ?? 20;

export function grossPnl(t) {
  if (t.entry == null || t.exit == null || !t.qty) return null;
  const dir = t.side === 'short' ? -1 : 1;
  return (t.exit - t.entry) * dir * t.qty * pointValue(t.instrument);
}

export function points(t) {
  if (t.entry == null || t.exit == null) return null;
  return (t.exit - t.entry) * (t.side === 'short' ? -1 : 1);
}

// R multiple, only when a stop was recorded.
export function rMultiple(t) {
  if (t.stop == null || t.entry == null || !t.qty || t.pnl == null) return null;
  const risk = Math.abs(t.entry - t.stop) * t.qty * pointValue(t.instrument);
  return risk > 0 ? t.pnl / risk : null;
}

export const sortTrades = (arr) =>
  [...arr].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

export function summarize(trades) {
  const withPnl = trades.filter((t) => t.pnl != null);
  const wins = withPnl.filter((t) => t.pnl > 0);
  const losses = withPnl.filter((t) => t.pnl < 0);
  const grossWin = sum(wins, (t) => t.pnl);
  const grossLoss = -sum(losses, (t) => t.pnl);
  const rs = trades.map(rMultiple).filter((r) => r != null);
  const net = sum(withPnl, (t) => t.pnl);
  const byDay = groupSum(withPnl, (t) => t.date);
  const dayVals = Object.values(byDay);
  return {
    count: trades.length,
    net,
    wins: wins.length,
    losses: losses.length,
    winRate: withPnl.length ? wins.length / withPnl.length : null,
    avgWin: wins.length ? grossWin / wins.length : null,
    avgLoss: losses.length ? -grossLoss / losses.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length ? Infinity : null,
    expectancy: withPnl.length ? net / withPnl.length : null,
    avgR: rs.length ? sum(rs) / rs.length : null,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl)) : null,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl)) : null,
    fees: sum(trades, (t) => t.fees),
    days: dayVals.length,
    greenDays: dayVals.filter((v) => v > 0).length,
    bestDay: dayVals.length ? Math.max(...dayVals) : null,
    worstDay: dayVals.length ? Math.min(...dayVals) : null,
  };
}

export function groupSum(arr, keyFn, valFn = (t) => t.pnl) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    out[k] = (out[k] || 0) + (Number(valFn(x)) || 0);
  }
  return out;
}

// [{key, count, net, winRate}] grouped by a key (or several keys per trade)
export function breakdown(trades, keyFn) {
  const groups = new Map();
  for (const t of trades) {
    let keys = keyFn(t);
    if (!Array.isArray(keys)) keys = [keys];
    for (const k of keys) {
      if (k == null || k === '') continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
  }
  return [...groups.entries()]
    .map(([key, ts]) => {
      const s = summarize(ts);
      return { key, count: ts.length, net: s.net, winRate: s.winRate, avgR: s.avgR };
    })
    .sort((a, b) => b.net - a.net);
}
