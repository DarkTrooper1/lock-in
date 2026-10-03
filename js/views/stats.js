import * as S from '../store.js';
import { $, $$, esc, ymd, addDays, money, pnlClass, fixed, sum, DAY_NAMES, dow, fmtDate } from '../util.js';
import { kpi } from '../ui.js';
import { summarize, breakdown, sortTrades, rMultiple } from '../trading.js';
import { allItems, applies, isDone, dayStatus, streak, bestStreak } from '../checklist.js';
import { backtestSummary } from './backtest.js';
import { pointsBetween } from '../points.js';

let charts = [];
const RANGES = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time']];

export default function stats(el, params) {
  charts.forEach((c) => c.destroy());
  charts = [];
  const range = params.range || '30';
  const today = ymd();
  const start = range === 'all' ? S.settings().startDate || '2000-01-01' : addDays(today, -(Number(range) - 1));
  const inRange = (d) => d >= start && d <= today;
  // trades can predate the app's start date (imports), so "all" really means all
  const trades = sortTrades(S.all('trades').filter((t) => (range === 'all' ? t.date <= today : inRange(t.date))));
  const s = summarize(trades);

  // habits
  const habitStart = range === 'all' ? S.settings().startDate || today : start;
  const dates = [];
  for (let d = habitStart > start ? habitStart : start; d <= today; d = addDays(d, 1)) dates.push(d);
  const habitRows = allItems().map((i) => {
    const req = dates.filter((d) => applies(i.key, d));
    const done = req.filter((d) => isDone(i.key, d)).length;
    return { ...i, req: req.length, done };
  }).filter((r) => r.req);
  const fullDays = dates.filter((d) => dayStatus(d).complete).length;
  const reqDays = dates.filter((d) => dayStatus(d).total).length;

  // other
  const bts = backtestSummary(S.all('backtests').filter((b) => inRange(b.date)));
  const routine = S.settings().routine;
  const workouts = S.all('workouts').filter((w) => inRange(w.date));
  const workoutDays = dates.filter((d) => isDone('workout', d)).length;
  const days = S.all('days').filter((d) => inRange(d.id) && d.discipline);
  const avgDiscipline = days.length ? sum(days, (d) => d.discipline) / days.length : null;

  const payouts = S.all('payouts').filter((p) => (range === 'all' ? true : inRange(p.date)));
  const planYes = trades.filter((t) => t.followedPlan === 'yes');
  const planNo = trades.filter((t) => t.followedPlan === 'no');
  const pctTxt = (n, d) => (d ? Math.round((n / d) * 100) + '%' : '—');

  el.innerHTML = `
    <div class="page-head">
      <h1>Stats</h1>
      <div class="seg">${RANGES.map(([v, l]) => `<a class="btn ${v === range ? 'on' : ''}" style="border:0;border-radius:0;${v === range ? '' : 'background:transparent;color:var(--muted)'}" href="#/stats?range=${v}">${l}</a>`).join('')}</div>
    </div>

    <h3>Discipline</h3>
    <div class="grid kpis">
      ${kpi('Points', pointsBetween(habitStart > start ? habitStart : start, today).total.toLocaleString(), { cls: 'pos', sub: range === 'all' ? 'all time' : `last ${range} days` })}
      ${kpi('Current streak', streak(today) + 'd', { cls: 'pos' })}
      ${kpi('Best streak', bestStreak(today) + 'd')}
      ${kpi('Perfect days', `${fullDays}/${reqDays}`, { sub: pctTxt(fullDays, reqDays) })}
      ${kpi('Avg discipline', avgDiscipline == null ? '—' : fixed(avgDiscipline, 1) + '/5', { sub: 'from daily reviews' })}
    </div>
    <div class="grid c2" style="margin-top:14px">
      <div class="card"><h2>Completion by habit</h2>
        ${habitRows.length ? habitRows.map((r) => `<div style="margin-bottom:10px"><div class="row between small"><span>${esc(r.label)}</span><span class="muted">${r.done}/${r.req} · ${pctTxt(r.done, r.req)}</span></div>
          <div class="progress"><div style="width:${(r.done / r.req) * 100}%;background:${r.done / r.req >= .8 ? 'var(--pos)' : r.done / r.req >= .5 ? 'var(--warn)' : 'var(--neg)'}"></div></div></div>`).join('') : '<p class="muted">No data yet.</p>'}
      </div>
      <div class="card"><h2>Daily completion</h2><div class="chart-box"><canvas id="c-habits"></canvas></div></div>
    </div>

    <div class="section"></div>
    <h3>Live trading</h3>
    <div class="grid kpis">
      ${kpi('Payouts', money(sum(payouts, (p) => p.amount)), { cls: 'pos', sub: `${payouts.length} received` })}
      ${kpi('Net P&L', money(s.net), { cls: pnlClass(s.net), sub: `fees ${money(s.fees)}` })}
      ${kpi('Trades', s.count, { sub: `${s.wins}W · ${s.losses}L` })}
      ${kpi('Win rate', s.winRate == null ? '—' : Math.round(s.winRate * 100) + '%')}
      ${kpi('Profit factor', s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : fixed(s.profitFactor))}
      ${kpi('Expectancy', money(s.expectancy), { cls: pnlClass(s.expectancy), sub: 'per trade' })}
      ${kpi('Avg R', fixed(s.avgR))}
      ${kpi('Avg win / loss', `<span class="pos">${money(s.avgWin)}</span>`, { sub: `<span class="neg">${money(s.avgLoss)}</span>` })}
      ${kpi('Green days', s.days ? `${s.greenDays}/${s.days}` : '—', { sub: s.days ? `best ${money(s.bestDay)} · worst ${money(s.worstDay)}` : '' })}
    </div>
    <div class="grid c2" style="margin-top:14px">
      <div class="card"><h2>Equity curve</h2><div class="chart-box"><canvas id="c-equity"></canvas></div></div>
      <div class="card"><h2>Followed plan vs didn't</h2>
        <table><thead><tr><th></th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Net</th></tr></thead><tbody>
          ${[['Followed plan', planYes], ["Didn't", planNo]].map(([l, ts]) => { const x = summarize(ts); return `<tr><td>${l}</td><td class="num">${ts.length}</td><td class="num">${x.winRate == null ? '—' : Math.round(x.winRate * 100) + '%'}</td><td class="num ${pnlClass(x.net)}">${money(x.net)}</td></tr>`; }).join('')}
        </tbody></table>
        <p class="muted small" style="margin-top:8px">If "didn't" is red, that's money your rules would have saved you.</p>
      </div>
      <div class="card"><h2>P&L by weekday</h2><div class="chart-box"><canvas id="c-dow"></canvas></div></div>
      <div class="card"><h2>P&L by hour (entry)</h2><div class="chart-box"><canvas id="c-hour"></canvas></div></div>
      ${tableCard('By setup', breakdown(trades, (t) => t.setup || 'No setup'))}
      ${tableCard('Mistakes (cost)', breakdown(trades, (t) => t.mistakes || []))}
      ${tableCard('Emotions', breakdown(trades, (t) => t.emotions || []))}
      ${tableCard('By account', breakdown(trades, (t) => t.account || '—'))}
    </div>

    <div class="section"></div>
    <h3>Backtesting · Workout</h3>
    <div class="grid kpis">
      ${kpi('Backtest sessions', bts.sessions, { sub: `${bts.trades} trades · ${fixed(bts.netR, 1)}R` })}
      ${kpi('Backtest win rate', bts.winRate == null ? '—' : Math.round(bts.winRate * 100) + '%')}
      ${kpi('Workouts done', `${workoutDays}/${dates.length}`, { sub: pctTxt(workoutDays, dates.length) })}
      ${routine.map((ex) => kpi(ex.name, sum(workouts, (w) => w.reps?.[ex.id] || 0).toLocaleString(), { sub: 'reps' })).join('')}
    </div>
  `;

  if (!window.Chart) return;
  if (document.fonts?.status !== 'loaded') { document.fonts.ready.then(() => el.isConnected && stats(el, params)); return; }
  const Chart = window.Chart;
  Chart.defaults.color = '#8592a3';
  Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  const money0 = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString();
  const colorFor = (v) => (v >= 0 ? '#34e29b' : '#ff5c6c');

  // equity curve by day
  const daily = {};
  trades.forEach((t) => (daily[t.date] = (daily[t.date] || 0) + (t.pnl || 0)));
  let run = 0;
  const eq = Object.keys(daily).sort().map((d) => ({ d, v: (run += daily[d]) }));
  charts.push(new Chart($('#c-equity', el), {
    type: 'line',
    data: { labels: eq.map((x) => fmtDate(x.d, { day: 'numeric', month: 'short' })), datasets: [{ data: eq.map((x) => x.v), borderColor: '#5aa9ff', backgroundColor: 'rgba(90,169,255,.12)', fill: true, tension: 0.25, pointRadius: 2 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: money0 } } } },
  }));

  const dowSums = [1, 2, 3, 4, 5].map((n) => sum(trades.filter((t) => dow(t.date) === n), (t) => t.pnl));
  charts.push(new Chart($('#c-dow', el), {
    type: 'bar',
    data: { labels: [1, 2, 3, 4, 5].map((n) => DAY_NAMES[n]), datasets: [{ data: dowSums, backgroundColor: dowSums.map(colorFor), borderRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: money0 } } } },
  }));

  const hours = [...new Set(trades.filter((t) => t.time).map((t) => Number(t.time.slice(0, 2))))].sort((a, b) => a - b);
  const hourSums = hours.map((h) => sum(trades.filter((t) => t.time && Number(t.time.slice(0, 2)) === h), (t) => t.pnl));
  charts.push(new Chart($('#c-hour', el), {
    type: 'bar',
    data: { labels: hours.map((h) => `${String(h).padStart(2, '0')}:00`), datasets: [{ data: hourSums, backgroundColor: hourSums.map(colorFor), borderRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: money0 } } } },
  }));

  const hd = dates.slice(-60);
  const hv = hd.map((d) => { const st = dayStatus(d); return st.total ? Math.round((st.done / st.total) * 100) : null; });
  charts.push(new Chart($('#c-habits', el), {
    type: 'bar',
    data: { labels: hd.map((d) => fmtDate(d, { day: 'numeric', month: 'short' })), datasets: [{ data: hv, backgroundColor: hv.map((v) => (v == null ? 'rgba(255,255,255,.06)' : v >= 100 ? '#34e29b' : v >= 50 ? '#ffb547' : '#ff5c6c')), borderRadius: 3 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + '%' } } } },
  }));
}

function tableCard(title, rows) {
  return `<div class="card"><h2>${esc(title)}</h2>${rows.length ? `<div class="table-wrap"><table>
    <thead><tr><th></th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Avg R</th><th class="num">Net</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.key)}</td><td class="num">${r.count}</td><td class="num">${r.winRate == null ? '—' : Math.round(r.winRate * 100) + '%'}</td><td class="num">${fixed(r.avgR, 2)}</td><td class="num ${pnlClass(r.net)}">${money(r.net)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">No data yet.</p>'}</div>`;
}
