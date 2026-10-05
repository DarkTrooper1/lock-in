import * as S from '../store.js';
import { $, $$, esc, ymd, fmtDate, addDays, parseYmd, money, num, sum, uid, DAY_NAMES } from '../util.js';
import { dayStatus, streak, lastMissed, workoutProgress, isLogged, setTick, allItems } from '../checklist.js';
import { PERFECT_DAY_BONUS, STREAK_BONUSES, dayPotential, dailyPoints, activeGoal, goalProgress, payoutPoints, gymBonus, GYM_SESSIONS, earlyBigWinPoints } from '../points.js';
import { openModal, modalHead, toast, options } from '../ui.js';
import { ICONS } from '../icons.js';

const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const C = { green: '#34e29b', amber: '#ffb547', red: '#ff5c6c', blue: '#5aa9ff', purple: '#b88cff', grid: 'rgba(255,255,255,.06)', text: '#8592a3' };

let chart = null;
let guideChart = null;

export default function today(el) {
  const date = ymd();
  const status = dayStatus(date);
  const missed = lastMissed(date);
  const st = streak(date);
  const goal = activeGoal();
  const todayPts = dailyPoints(date, date)[0]?.pts || 0;
  const potential = dayPotential(status);
  const hit = S.all('goals').filter((g) => g.claimedOn);
  const nextBonus = STREAK_BONUSES.map((b) => ({ ...b, in: b.every - (st % b.every) })).sort((a, b) => a.in - b.in)[0];
  const bigPts = goal
    ? sum(bigEntries().filter((e) => e.date >= goal.startDate && e.date <= date), (e) => e.points) + earlyBigWinPoints(goal)
    : sum(bigEntries(), (e) => e.points);

  el.innerHTML = `
    <div class="home">
      <div class="full">
        <div class="eyebrow">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        <h1 style="margin:4px 0 0">${greeting()}</h1>
      </div>

      ${goal ? goalHTML(goal, date) : noGoalHTML()}

      <div class="stat-tiles full">
        <div class="kpi tile"><span class="icon pos">${ICONS.bolt}</span><div class="label">Today</div>
          <div class="value pos">+${todayPts}</div><div class="sub">of ${potential} possible</div></div>
        <div class="kpi tile streak-tile"><span class="icon warn">${ICONS.flame}</span><div class="label">Streak</div>
          <div class="value">${st}<span class="muted" style="font-size:14px;font-weight:600"> day${st === 1 ? '' : 's'}</span></div><div class="sub">+${nextBonus.points} in ${nextBonus.in}</div></div>
        <div class="kpi tile big-tile"><span class="icon" style="color:var(--purple)">${ICONS.trophy}</span><div class="label">Big wins</div>
          <div class="value">+${bigPts.toLocaleString()}</div><div class="sub">${goal ? 'this goal' : 'all time'}</div></div>
      </div>

      ${missed ? `<div class="banner bad full" style="margin:0"><strong>${esc(fmtDate(missed.date))} wasn't finished:</strong>
        ${missed.items.filter((i) => !i.done).map((i) => esc(i.label)).join(', ')}. Points left on the table.</div>` : ''}

      <div class="col">
        <div class="card">
          <div class="card-head"><h2>Today's list</h2>
            <div class="row tight"><span class="tag ${status.complete ? 'pos' : ''}">${status.done}/${status.total}</span><button class="sm ghost" id="add-item">+ Add</button></div></div>
          ${status.total ? status.items.map((i) => itemHTML(i, date)).join('') : '<div class="empty">Nothing on the list today. Rest up.</div>'}
          ${status.total ? `<div class="check-item bonus ${status.complete ? 'done' : ''}">
              <div class="box">${status.complete ? '✓' : ''}</div>
              <div class="grow"><span class="title">Perfect day bonus</span><div class="muted small">Finish everything above</div></div>
              <span class="tag ${status.complete ? 'pos' : ''}">+${PERFECT_DAY_BONUS}</span></div>` : ''}
        </div>
        ${bigWinsHTML()}
      </div>

      <div class="col">
        <div class="card">
          <div class="card-head"><h2>Points</h2>
            <div class="legend"><span><i style="background:${C.green}"></i>perfect</span><span><i style="background:${C.amber}"></i>partial</span><span><i style="background:${C.purple}"></i>big win</span>${goal ? '<span><i style="background:#eef2f6;height:2px;vertical-align:3px"></i>total</span>' : ''}${goal?.deadline ? '<span><i style="background:none;border-top:2px dashed #8592a3;height:0;vertical-align:3px"></i>pace</span>' : ''}</div></div>
          <div class="chart-box tall"><canvas id="pts-chart"></canvas></div>
        </div>
      </div>

        <div class="card full">
          <div class="card-head"><h2>How to earn points</h2>
            <div class="legend"><span><i style="background:${C.green}"></i>daily</span><span><i style="background:${C.blue}"></i>bonus</span><span><i style="background:${C.purple}"></i>big win</span></div></div>
          <div class="chart-box" id="guide-box"><canvas id="guide-chart"></canvas></div>
        </div>

      ${hit.length ? `<p class="muted small full">Goals hit: ${hit.map((g) => `${g.target.toLocaleString()} pts (${esc(fmtDate(g.claimedOn, { month: 'short', year: 'numeric' }))})`).join(' · ')}</p>` : ''}
    </div>
  `;

  $$('[data-tick]', el).forEach((row) =>
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const on = row.dataset.on !== '1';
      if (on) floatPoints($('.box', row), `+${row.dataset.points}`);
      setTick(row.dataset.tick, date, on);
    }),
  );
  $$('[data-tick]', el).forEach((row) =>
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); } }),
  );
  $('#add-item', el).onclick = () => openCustomItem();
  $('#add-payout', el).onclick = () => openPayout();
  $('#add-win', el).onclick = () => openWin();
  $$('[data-payout]', el).forEach((r) => r.addEventListener('click', () => openPayout(S.get('payouts', r.dataset.payout))));
  $$('[data-win]', el).forEach((r) => r.addEventListener('click', () => openWin(S.get('wins', r.dataset.win))));
  $('#set-goal', el)?.addEventListener('click', () => openGoal());
  $('#edit-goal', el)?.addEventListener('click', () => openGoal(goal));
  $('#claim', el)?.addEventListener('click', () => {
    S.put('goals', { ...goal, claimedOn: date });
    setTimeout(() => openGoal(), 300);
  });

  // animate the ring from its previous value
  const ring = $('.ring .fill', el);
  if (ring) requestAnimationFrame(() => requestAnimationFrame(() => (ring.style.strokeDashoffset = ring.dataset.to)));

  // wait for web fonts so chart labels are measured with the right font
  const draw = () => { if (el.isConnected) { drawChart(el, goal, date); drawGuide(el); } };
  if (document.fonts?.status === 'loaded') draw();
  else document.fonts.ready.then(draw);
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Still up? Lock in.' : h < 12 ? 'Morning. Lock in.' : h < 18 ? 'Afternoon. Lock in.' : 'Evening. Lock in.';
}

// "+20" that drifts up from the tick box.
function floatPoints(anchor, text) {
  const r = anchor.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'floater';
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2 - 14}px`;
  f.style.top = `${r.top - 8}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 950);
}

let lastPct = 0;
function goalHTML(goal, date) {
  const { earned, pct, reached } = goalProgress(goal, date);
  const left = Math.max(0, goal.target - earned);
  const pills = [`<span class="pill"><b>${left.toLocaleString()}</b> to go</span>`];
  if (goal.deadline && !reached) {
    const total = daysBetween(goal.startDate, goal.deadline) + 1;
    const elapsed = Math.min(total, daysBetween(goal.startDate, date) + 1);
    const daysLeft = Math.max(0, daysBetween(date, goal.deadline));
    const diff = earned - Math.round((goal.target * elapsed) / total);
    pills.push(`<span class="pill"><b>${daysLeft}</b> days left</span>`);
    pills.push(`<span class="pill ${diff >= 0 ? 'pos' : 'neg'}"><b>${Math.abs(diff).toLocaleString()}</b> ${diff >= 0 ? 'ahead' : 'behind'}</span>`);
    if (daysLeft > 0) pills.push(`<span class="pill">need <b>${Math.ceil(left / daysLeft)}</b>/day</span>`);
  }
  const R = 62, CIRC = 2 * Math.PI * R;
  const from = CIRC * (1 - lastPct), to = CIRC * (1 - pct);
  lastPct = pct;
  return `<div class="card hero full">
    <button class="sm ghost edit" id="edit-goal">Edit</button>
    <div class="ring">
      <svg viewBox="0 0 148 148"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34e29b"/><stop offset="1" stop-color="#5aa9ff"/></linearGradient></defs>
        <circle class="track" cx="74" cy="74" r="${R}" fill="none" stroke-width="12"/>
        <circle class="fill" cx="74" cy="74" r="${R}" fill="none" stroke-width="12" stroke-dasharray="${CIRC}" style="stroke-dashoffset:${from}" data-to="${to}"/></svg>
      <div class="center"><div class="pct">${Math.floor(pct * 100)}<small>%</small></div></div>
    </div>
    <div style="min-width:0">
      <div class="eyebrow">Points goal${goal.deadline ? ` · by ${esc(fmtDate(goal.deadline, { day: 'numeric', month: 'short' }))}` : ''}</div>
      <div class="hero-pts"><span class="pos">${earned.toLocaleString()}</span><span class="of"> / ${goal.target.toLocaleString()}</span></div>
      ${reached
        ? `<div class="banner good" style="margin:0"><strong>${goal.target.toLocaleString()} points. Goal smashed.</strong> <button class="primary sm" id="claim" style="margin-left:8px">Set the next one</button></div>`
        : `<div class="pills">${pills.join('')}</div>`}
    </div>
  </div>`;
}

function noGoalHTML() {
  return `<div class="card hero full" style="grid-template-columns:1fr">
    <div>
      <div class="eyebrow">Points goal</div>
      <h1 style="margin:6px 0">Set your points goal</h1>
      <p class="muted">Everything you get done earns points. Pick a number that scares you a bit.</p>
      <button class="primary" id="set-goal">Set a goal</button>
    </div>
  </div>`;
}

function itemHTML(i, date) {
  const logged = isLogged(i.key, date);
  let extra = '';
  if (i.key === 'workout' && !i.done) {
    const p = workoutProgress(date);
    if (p > 0) extra = `<div class="progress" style="max-width:200px"><div style="width:${Math.round(p * 100)}%"></div></div>`;
  }
  // Logged items are done because of real data, so they can't be unticked here.
  const attrs = logged || i.logOnly ? '' : `data-tick="${esc(i.key)}" data-on="${i.done ? '1' : ''}" data-points="${i.points}" role="button" tabindex="0" aria-pressed="${i.done}"`;
  if (i.logOnly && !i.done && !extra) extra = '<div class="muted small">Tick off your sets in the Workout tab</div>';
  return `<div class="check-item ${i.done ? 'done' : ''} ${logged || i.logOnly ? '' : 'clickable'}" ${attrs}>
    <div class="box" ${logged ? 'title="Logged in the app"' : ''}>${i.done ? '✓' : ''}</div>
    <div class="grow"><span class="title">${esc(i.label)}</span>${logged ? '<div class="muted small">Logged</div>' : ''}${extra}</div>
    ${!i.done && i.route ? `<a class="btn sm ghost" href="${i.route}">Log</a>` : ''}
    <span class="tag ${i.done ? 'pos' : ''}">+${i.points}</span>
  </div>`;
}

function bigEntries() {
  return [
    ...S.all('payouts').map((p) => ({ id: p.id, kind: 'payout', date: p.date, label: `Payout ${money(p.amount)}`, sub: p.account, points: payoutPoints() })),
    ...S.all('wins').map((w) => ({ id: w.id, kind: 'win', date: w.date, label: w.label, sub: w.note, points: w.points })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function bigWinsHTML() {
  const entries = bigEntries();
  const totalPaid = sum(S.all('payouts'), (p) => p.amount);
  return `<div class="card">
    <div class="card-head"><h2>Big wins</h2>
      <div class="row tight"><button class="sm ghost" id="add-win">+ Big win</button><button class="sm primary" id="add-payout">+ Payout</button></div></div>
    <div class="row" style="margin-bottom:6px;gap:24px">
      <div><div class="eyebrow">Paid out</div><div class="mono pos" style="font-size:26px;font-weight:800;letter-spacing:-.03em">${money(totalPaid)}</div></div>
      <div><div class="eyebrow">Per payout</div><div class="mono" style="font-size:26px;font-weight:800;letter-spacing:-.03em;color:var(--purple)">+${payoutPoints()}</div></div>
    </div>
    ${entries.length ? entries.slice(0, 6).map((e) => `<div class="win-row" data-${e.kind}="${e.id}">
        <div class="row tight" style="flex-wrap:nowrap;min-width:0"><span class="win-ico ${e.kind === 'payout' ? 'money' : ''}">${e.kind === 'payout' ? ICONS.dollar : ICONS.trophy}</span>
          <div style="min-width:0"><div class="title">${esc(e.label)}</div><div class="muted small">${esc(fmtDate(e.date))}${e.sub ? ' · ' + esc(e.sub) : ''}</div></div></div>
        <span class="tag purple">+${e.points}</span></div>`).join('')
      : `<p class="muted small" style="margin-top:8px">Log payouts, passed evals, clean green weeks and good grades here. Change the list in ⚙ Settings.</p>`}
  </div>`;
}

// Daily points as bars, with running total (and pace to the deadline) as lines.
function drawChart(el, goal, date) {
  chart?.destroy();
  chart = null;
  if (!window.Chart) return;
  const Chart = window.Chart;
  Chart.defaults.color = C.text;
  Chart.defaults.borderColor = C.grid;
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.weight = 500;

  let from = goal ? goal.startDate : addDays(date, -29);
  if (goal && !goal.deadline && from < addDays(date, -89)) from = addDays(date, -89);
  let to = goal?.deadline && goal.deadline > date ? goal.deadline : date;
  if (daysBetween(from, to) < 13) to = addDays(from, 13);

  const days = new Map(dailyPoints(from, date < to ? date : to).map((p) => [p.date, p]));
  const labels = [];
  for (let d = from; d <= to; d = addDays(d, 1)) labels.push(d);

  let running = goal ? goalProgress(goal, addDays(from, -1)).earned : 0;
  const cumulative = labels.map((d) => (days.has(d) ? (running += days.get(d).pts) : null));
  const bars = labels.map((d) => days.get(d)?.pts ?? null);
  const barColors = labels.map((d) => {
    const x = days.get(d);
    if (!x) return 'transparent';
    if (x.big) return C.purple;
    if (x.complete) return C.green;
    if (!x.required) return x.pts ? C.blue : C.grid;
    return x.pts ? C.amber : C.red;
  });

  const datasets = [
    { type: 'bar', label: 'Points that day', data: bars, backgroundColor: barColors, borderRadius: 3, yAxisID: 'y', order: 2 },
  ];
  if (goal) {
    datasets.push({ type: 'line', label: 'Total', data: cumulative, borderColor: '#eef2f6', borderWidth: 2.5, pointRadius: 0, tension: 0.2, yAxisID: 'y2', order: 1 });
    if (goal.deadline) {
      const total = daysBetween(goal.startDate, goal.deadline) + 1;
      const pace = labels.map((d) => {
        const n = daysBetween(goal.startDate, d) + 1;
        return n <= total ? Math.round((goal.target * n) / total) : null;
      });
      datasets.push({ type: 'line', label: 'Pace needed', data: pace, borderColor: C.text, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, yAxisID: 'y2', order: 0 });
    }
  }

  chart = new Chart($('#pts-chart', el), {
    data: { labels: labels.map((d) => fmtDate(d, { day: 'numeric', month: 'short' })), datasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, max: 160, title: { display: true, text: 'per day' }, ticks: { stepSize: 40 } },
        ...(goal ? { y2: { position: 'right', beginAtZero: true, suggestedMax: goal.target, grid: { display: false }, title: { display: true, text: 'total' } } } : {}),
      },
    },
  });
}

// Every way to earn points, biggest first.
function drawGuide(el) {
  guideChart?.destroy();
  guideChart = null;
  if (!window.Chart) return;
  const COLORS = { daily: C.green, bonus: C.blue, big: C.purple };
  const rows = [
    ...allItems().map((i) => ({ label: i.label.replace(" today's trades", ''), points: i.points, kind: 'daily' })),
    { label: 'Perfect day', points: PERFECT_DAY_BONUS, kind: 'bonus' },
    ...STREAK_BONUSES.map((b) => ({ label: b.label, points: b.points, kind: 'bonus' })),
    { label: `Gym ${GYM_SESSIONS}× in a week`, points: gymBonus(), kind: 'bonus' },
    { label: 'Payout', points: payoutPoints(), kind: 'big' },
    ...(S.settings().winTypes || []).map((w) => ({ label: w.label, points: w.points, kind: 'big' })),
  ].sort((a, b) => b.points - a.points);
  $('#guide-box', el).style.height = `${rows.length * 28 + 30}px`;
  guideChart = new window.Chart($('#guide-chart', el), {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.label),
      datasets: [{ data: rows.map((r) => r.points), backgroundColor: rows.map((r) => COLORS[r.kind]), borderRadius: 4 }],
    },
    options: {
      animation: false,
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `+${c.parsed.x} points` } } },
      scales: { x: { beginAtZero: true, grid: { color: C.grid } }, y: { grid: { display: false }, ticks: { autoSkip: false } } },
    },
  });
}

function openGoal(goal) {
  const isNew = !goal;
  const m = openModal(`
    ${modalHead(isNew ? 'Points goal' : 'Edit points goal')}
    <form id="gf" class="stack">
      <div class="form-grid">
        <label class="field">Points<input name="target" type="number" min="100" step="100" value="${esc(goal?.target || 10000)}" required></label>
        <label class="field">Deadline (optional)<input name="deadline" type="date" value="${esc(goal ? goal.deadline || '' : addDays(ymd(), 89))}"></label>
      </div>
      <p class="muted small">A perfect week is about 655 points, including the 7-day streak bonus. 3 flawless months, with their 30-day streak bonuses, is about 10,000.
        One missed day costs you streak bonuses, so 10,000 means almost never slipping, plus payouts (+${payoutPoints()}) and big wins.${isNew ? ' Points count from today.' : ''}</p>
      <div class="modal-foot"><div>${isNew ? '' : '<button type="button" class="danger" id="del">Delete goal</button>'}</div>
        <div class="row tight"><button type="button" data-close>Cancel</button><button class="primary">Save</button></div></div>
    </form>`);
  const f = $('#gf', m.el);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    S.put('goals', { ...(goal || { startDate: ymd() }), target: num(f.elements.target.value) || 10000, deadline: f.elements.deadline.value || null });
    m.close();
  });
  $('#del', f)?.addEventListener('click', () => { if (confirm('Delete this goal?')) { S.remove('goals', goal.id); m.close(); } });
}

// Add your own item. Days = when it's on your required list; none = extra points only.
export function openCustomItem(item) {
  const isNew = !item;
  item = item || { id: uid(), label: '', points: 10, days: [0, 1, 2, 3, 4, 5, 6] };
  const m = openModal(`
    ${modalHead(isNew ? 'Add your own item' : 'Edit item')}
    <form id="cf" class="stack">
      <div class="form-grid">
        <label class="field" style="grid-column:span 2">What is it?<input name="label" value="${esc(item.label)}" placeholder="e.g. Read 10 pages, Review a recorded session" required></label>
        <label class="field">Points<input name="points" type="number" min="1" max="500" value="${esc(item.points)}" required></label>
      </div>
      <div class="field">Which days?
        <div class="chips">${DAY_NAMES.map((d, n) => `<button type="button" class="chip ${item.days.includes(n) ? 'on' : ''}" data-day="${n}">${d}</button>`).join('')}</div></div>
      <p class="muted small">For scale: journal and levels are 20, workout and homework 15.</p>
      <div class="modal-foot"><div>${isNew ? '' : '<button type="button" class="danger" id="del">Remove item</button>'}</div>
        <div class="row tight"><button type="button" data-close>Cancel</button><button class="primary">Save</button></div></div>
    </form>`);
  const f = $('#cf', m.el);
  $$('[data-day]', f).forEach((c) => c.addEventListener('click', () => c.classList.toggle('on')));
  const others = (S.settings().customItems || []).filter((c) => c.id !== item.id);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const days = $$('[data-day].on', f).map((c) => Number(c.dataset.day));
    if (!days.length) return toast('Pick at least one day');
    const next = { ...item, label: f.elements.label.value.trim(), points: num(f.elements.points.value) || 10, days, on: true };
    S.saveSettings({ customItems: [...others, next] });
    m.close();
    toast(isNew ? 'Added' : 'Saved');
  });
  $('#del', f)?.addEventListener('click', () => {
    if (confirm(`Remove "${item.label}"? Points already earned from it go too.`)) { S.saveSettings({ customItems: others }); m.close(); }
  });
}

function openWin(w) {
  const isNew = !w;
  const types = S.settings().winTypes || [];
  w = w || { date: ymd(), label: types[0]?.label || '', points: types[0]?.points || 100 };
  const m = openModal(`
    ${modalHead(isNew ? 'Log a big win' : 'Edit big win')}
    <form id="wf" class="stack">
      <div class="form-grid">
        <label class="field" style="grid-column:span 2">What happened?<select name="type">
          ${types.map((t, i) => `<option value="${i}" ${t.label === w.label ? 'selected' : ''}>${esc(t.label)} (+${t.points})</option>`).join('')}
          ${!isNew && !types.some((t) => t.label === w.label) ? `<option value="keep" selected>${esc(w.label)} (+${w.points})</option>` : ''}
        </select></label>
        <label class="field">Date<input type="date" name="date" value="${esc(w.date)}" required></label>
      </div>
      <label class="field">Note<input name="note" value="${esc(w.note || '')}" placeholder="optional"></label>
      <p class="muted small">Change the list of big wins and their points in ⚙ Settings.</p>
      <div class="modal-foot"><div>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
        <div class="row tight"><button type="button" data-close>Cancel</button><button class="primary">Save</button></div></div>
    </form>`);
  const f = $('#wf', m.el);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = f.elements.type.value;
    const t = v === 'keep' ? { label: w.label, points: w.points } : types[Number(v)];
    if (!t) return;
    S.put('wins', { ...w, label: t.label, points: t.points, date: f.elements.date.value, note: f.elements.note.value });
    m.close();
    toast(`+${t.points} points. Big.`);
  });
  $('#del', f)?.addEventListener('click', () => { if (confirm('Delete this win?')) { S.remove('wins', w.id); m.close(); } });
}

function openPayout(p) {
  const isNew = !p;
  const set = S.settings();
  p = p || { date: ymd(), account: set.defaultAccount || set.accounts[0] || '' };
  const m = openModal(`
    ${modalHead(isNew ? `Log payout (+${payoutPoints()} pts)` : 'Edit payout')}
    <form id="pf" class="stack">
      <div class="form-grid">
        <label class="field">Date<input type="date" name="date" value="${esc(p.date)}" required></label>
        <label class="field">Account<select name="account">${options(set.accounts, p.account, { blank: '—' })}</select></label>
        <label class="field">Amount received ($)<input type="number" name="amount" step="0.01" min="0" value="${esc(p.amount ?? '')}" required></label>
      </div>
      <label class="field">Note<input name="note" value="${esc(p.note || '')}"></label>
      <div class="modal-foot"><div>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
        <div class="row tight"><button type="button" data-close>Cancel</button><button class="primary">Save</button></div></div>
    </form>`);
  const f = $('#pf', m.el);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    S.put('payouts', { ...p, date: f.elements.date.value, account: f.elements.account.value, amount: num(f.elements.amount.value), note: f.elements.note.value });
    m.close();
    toast(isNew ? `Payout logged. +${payoutPoints()} points.` : 'Payout saved');
  });
  $('#del', f)?.addEventListener('click', () => { if (confirm('Delete this payout?')) { S.remove('payouts', p.id); m.close(); } });
}
