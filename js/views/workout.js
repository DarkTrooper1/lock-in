import * as S from '../store.js';
import { $, $$, esc, ymd, addDays, fmtDate, dow, startOfWeek } from '../util.js';
import { workoutProgress, workoutExercises, planFor, applies, isDone } from '../checklist.js';
import { gymBonus, GYM_SESSIONS, wentToGym } from '../points.js';
import { WARM_UP, PROGRESSION } from '../workout-plan.js';

const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function workout(el, params) {
  const today = ymd();
  const date = params.date || today;
  const future = date > today;
  const w = S.get('workouts', date);
  const legacy = w?.reps && !w.plan;
  const plan = w?.plan || planFor(date);
  const exercises = workoutExercises(date);
  const p = workoutProgress(date);

  // this Monday-Sunday week
  const week = [];
  for (let d = startOfWeek(date), i = 0; i < 7; d = addDays(d, 1), i++) week.push(d);
  const gymDays = week.filter(wentToGym).length;
  const gymToday = wentToGym(date);

  // last 28 days
  const days = [];
  for (let i = 27; i >= 0; i--) days.push(addDays(today, -i));
  const pad = (dow(days[0]) + 6) % 7; // Monday-first grid

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${esc(DAY_LONG[dow(date)])}${date === today ? ' · today' : ' · ' + esc(fmtDate(date, { day: 'numeric', month: 'short' }))}</div>
        <h1 style="margin:4px 0 8px">${esc(legacy ? 'Arms routine' : plan.name)}</h1>
        <div class="row tight">
          <a class="btn sm" href="#/workout?date=${addDays(date, -1)}">←</a>
          ${date !== today ? `<a class="btn sm ghost" href="#/workout">Today</a>` : ''}
          <a class="btn sm" href="#/workout?date=${addDays(date, 1)}">→</a>
        </div>
      </div>
      ${exercises.length || legacy ? `<div class="streak"><span class="n">${Math.round(p * 100)}%</span><span class="muted">done</span></div>` : ''}
    </div>

    ${p >= 1 ? '<div class="banner good"><strong>Workout complete.</strong> +15 points.</div>' : ''}
    ${future ? '<div class="banner info">This is a preview. You can log it on the day.</div>' : ''}

    ${legacy ? legacyHTML(w) : plan.rest || !exercises.length ? `
      <div class="card"><h2>Rest day</h2><p class="muted">${esc(plan.note || 'No workout today. Let your muscles recover.')}</p></div>` : `
      <p class="muted small" style="margin-bottom:12px">${esc(WARM_UP)}</p>
      <div class="stack" style="gap:10px">
        ${exercises.map((ex) => exerciseHTML({ ...ex, tip: ex.tip || planFor(date).exercises?.find((e) => e.id === ex.id)?.tip }, w?.sets?.[ex.id] || 0, future)).join('')}
      </div>
      <p class="muted small" style="margin-top:12px">${esc(PROGRESSION)}</p>`}

    <div class="section card">
      <div class="card-head"><h2>This week</h2><a class="btn sm ghost" href="#/settings">Edit plan</a></div>
      <div class="week-plan">
        ${week.map((d) => {
          const pl = S.get('workouts', d)?.plan || planFor(d);
          const pr = workoutProgress(d);
          const rest = !applies('workout', d) && !pr;
          const state = rest ? 'rest' : pr >= 1 ? 'done' : d < today ? 'missed' : d === today ? 'today' : '';
          return `<a class="wp-day ${state} ${d === date ? 'sel' : ''}" href="#/workout?date=${d}">
            <span class="eyebrow">${DAY_LONG[dow(d)].slice(0, 3)}</span>
            <span class="wp-name">${esc(pl.name)}</span>
            <span class="wp-state">${rest ? 'Rest' : pr >= 1 ? '✓ Done' : pr > 0 ? Math.round(pr * 100) + '%' : d < today ? 'Missed' : ''}</span>
          </a>`;
        }).join('')}
      </div>
    </div>

    <div class="section card">
      <div class="card-head"><h2>Gym bonus</h2><span class="tag ${gymDays >= GYM_SESSIONS ? 'pos' : ''}">+${gymBonus()}</span></div>
      <p class="muted small">Emergency points: go to the gym ${GYM_SESSIONS} times in one week (Monday to Sunday) and get +${gymBonus()}.</p>
      <div class="row" style="margin:10px 0">
        <div class="row tight">${week.map((d) => `<span class="conf ${wentToGym(d) ? 'c3' : ''}" title="${esc(fmtDate(d))}" style="width:30px">${'MTWTFSS'[(dow(d) + 6) % 7]}</span>`).join('')}</div>
        <strong>${Math.min(gymDays, GYM_SESSIONS)}/${GYM_SESSIONS} this week</strong>
      </div>
      ${future ? '' : `<button class="${gymToday ? '' : 'primary'}" id="gym">${gymToday ? `Undo gym on ${date === today ? 'today' : esc(fmtDate(date))}` : `I went to the gym ${date === today ? 'today' : 'on ' + esc(fmtDate(date))}`}</button>`}
      ${gymDays >= GYM_SESSIONS ? `<span class="pos" style="margin-left:10px">Bonus earned this week.</span>` : ''}
    </div>

    <div class="section card">
      <h2>Last 4 weeks</h2>
      <div class="heat">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dh">${d}</div>`).join('')}
        ${'<div></div>'.repeat(pad)}
        ${days.map((d) => {
          const pr = workoutProgress(d);
          const required = applies('workout', d);
          const cls = !required && !pr ? 'na' : isDone('workout', d) ? 'full' : pr > 0 ? 'part' : d === today ? '' : 'none';
          return `<a class="d ${cls}" href="#/workout?date=${d}" title="${esc(fmtDate(d))}: ${required ? Math.round(pr * 100) + '%' : 'rest'}">${Number(d.slice(8))}</a>`;
        }).join('')}
      </div>
      <p class="muted small" style="margin-top:8px">Tap a day to view or fill it in. Dashed = rest day.</p>
    </div>
  `;

  $('#gym', el)?.addEventListener('click', () => {
    const day = S.get('days', date) || { id: date, date };
    S.put('days', { ...day, gym: !day.gym });
  });

  // Tap the Nth set circle to mark sets 1..N done; tap the last done one again to undo it.
  const setSets = (exId, n) => {
    const cur = S.get('workouts', date) || { id: date, date };
    // snapshot the plan the first time, so editing the plan later never changes this day
    const snap = cur.plan || { name: plan.name, exercises: exercises.map(({ id, name, sets, reps, tip }) => ({ id, name, sets, reps, ...(tip ? { tip } : {}) })) };
    S.put('workouts', { ...cur, plan: snap, sets: { ...(cur.sets || {}), [exId]: n } });
  };
  $$('[data-dot]', el).forEach((b) =>
    b.addEventListener('click', () => {
      const n = Number(b.dataset.n);
      const done = S.get('workouts', date)?.sets?.[b.dataset.dot] || 0;
      setSets(b.dataset.dot, done >= n ? n - 1 : n);
    }),
  );
  $$('[data-all]', el).forEach((b) => b.addEventListener('click', () => setSets(b.dataset.all, Number(b.dataset.sets))));
}

function exerciseHTML(ex, done, future) {
  const complete = done >= ex.sets;
  return `<div class="card ex-card ${complete ? 'done' : ''}">
    <div class="ex-main">
      <div style="min-width:0">
        <div class="row tight" style="gap:10px"><h2 style="margin:0">${esc(ex.name)}</h2>
          <span class="tag ${complete ? 'pos' : ''}">${ex.sets} × ${esc(ex.reps)}</span></div>
        ${ex.tip ? `<div class="muted small" style="margin-top:4px">${esc(ex.tip)}</div>` : ''}
      </div>
      <div class="row tight" style="flex-wrap:nowrap">
        <div class="set-dots">${Array.from({ length: ex.sets }, (_, i) => `
          <button class="set-dot ${i < done ? 'on' : ''}" data-dot="${esc(ex.id)}" data-n="${i + 1}" ${future ? 'disabled' : ''} aria-label="Set ${i + 1}">${i < done ? '✓' : i + 1}</button>`).join('')}
        </div>
        ${complete || future ? '' : `<button class="sm ghost" data-all="${esc(ex.id)}" data-sets="${ex.sets}">All</button>`}
      </div>
    </div>
  </div>`;
}

// Days logged with the old fixed arms routine (reps counts).
function legacyHTML(w) {
  const routine = S.settings().routine;
  return `<div class="card"><h2>Old arms routine</h2>
    ${routine.map((ex) => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${esc(ex.name)}</span>
      <span class="mono ${(w.reps[ex.id] || 0) >= ex.target ? 'pos' : ''}">${w.reps[ex.id] || 0} / ${ex.target}</span></div>`).join('')}
  </div>`;
}
