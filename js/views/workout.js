import * as S from '../store.js';
import { $, $$, esc, ymd, addDays, fmtDate, dow, startOfWeek } from '../util.js';
import { workoutProgress, isDone } from '../checklist.js';
import { gymBonus, GYM_SESSIONS, wentToGym } from '../points.js';

export default function workout(el, params) {
  const date = params.date || ymd();
  const routine = S.settings().routine;
  const w = S.get('workouts', date) || { id: date, date, reps: {} };
  const p = workoutProgress(date);

  // last 28 days
  const days = [];
  for (let i = 27; i >= 0; i--) days.push(addDays(ymd(), -i));
  const pad = (dow(days[0]) + 6) % 7; // Monday-first grid

  // gym bonus: this Monday-Sunday week
  const week = [];
  for (let d = startOfWeek(date), i = 0; i < 7; d = addDays(d, 1), i++) week.push(d);
  const gymDays = week.filter(wentToGym).length;
  const gymToday = wentToGym(date);

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Workout</h1>
        <div class="row tight">
          <a class="btn sm" href="#/workout?date=${addDays(date, -1)}">←</a>
          <strong>${date === ymd() ? 'Today' : esc(fmtDate(date))}</strong>
          ${date < ymd() ? `<a class="btn sm" href="#/workout?date=${addDays(date, 1)}">→</a>` : ''}
        </div>
      </div>
      <div class="streak"><span class="n">${Math.round(p * 100)}%</span><span class="muted">done</span></div>
    </div>

    ${p >= 1 ? '<div class="banner good"><strong>Workout complete.</strong></div>' : ''}

    <div class="stack">
      ${routine.map((ex) => {
        const reps = w.reps?.[ex.id] || 0;
        const done = reps >= ex.target;
        return `<div class="card">
          <div class="row between"><h2>${esc(ex.name)}</h2><span class="${done ? 'pos' : 'muted'}">${done ? '✓ Done' : `${ex.target - reps} to go`}</span></div>
          <div class="counter">
            <div class="big">${reps}<span class="muted" style="font-size:16px"> / ${ex.target}</span></div>
            <button data-ex="${ex.id}" data-d="-5">−5</button>
            <button data-ex="${ex.id}" data-d="5">+5</button>
            <button data-ex="${ex.id}" data-d="10">+10</button>
            <button class="primary" data-ex="${ex.id}" data-set="${ex.target}">All ${ex.target}</button>
          </div>
          <div class="progress" style="margin-top:12px"><div style="width:${Math.min(100, (reps / ex.target) * 100)}%"></div></div>
        </div>`;
      }).join('')}
    </div>

    <div class="section card">
      <div class="row between"><h2>Gym bonus</h2><span class="tag ${gymDays >= GYM_SESSIONS ? 'pos' : ''}">+${gymBonus()}</span></div>
      <p class="muted small">Emergency points: go to the gym ${GYM_SESSIONS} times in one week (Monday to Sunday) and get +${gymBonus()}.</p>
      <div class="row" style="margin:10px 0">
        <div class="row tight">${week.map((d) => `<span class="conf ${wentToGym(d) ? 'c3' : ''}" title="${esc(fmtDate(d))}" style="width:30px">${'MTWTFSS'[(dow(d) + 6) % 7]}</span>`).join('')}</div>
        <strong>${Math.min(gymDays, GYM_SESSIONS)}/${GYM_SESSIONS} this week</strong>
      </div>
      <button class="${gymToday ? '' : 'primary'}" id="gym">${gymToday ? `Undo gym on ${date === ymd() ? 'today' : esc(fmtDate(date))}` : `I went to the gym ${date === ymd() ? 'today' : 'on ' + esc(fmtDate(date))}`}</button>
      ${gymDays >= GYM_SESSIONS ? `<span class="pos" style="margin-left:10px">Bonus earned this week.</span>` : ''}
    </div>

    <div class="section card">
      <h2>Last 4 weeks</h2>
      <div class="heat">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dh">${d}</div>`).join('')}
        ${'<div></div>'.repeat(pad)}
        ${days.map((d) => {
          const pr = workoutProgress(d);
          const cls = d < (S.settings().startDate || d) ? 'na' : isDone('workout', d) ? 'full' : pr > 0 ? 'part' : d === ymd() ? '' : 'none';
          return `<a class="d ${cls}" href="#/workout?date=${d}" title="${esc(fmtDate(d))}: ${Math.round(pr * 100)}%">${Number(d.slice(8))}</a>`;
        }).join('')}
      </div>
      <p class="muted small" style="margin-top:8px">Tap a day to fill it in. Change the routine in Settings.</p>
    </div>
  `;

  $('#gym', el).onclick = () => {
    const day = S.get('days', date) || { id: date, date };
    S.put('days', { ...day, gym: !day.gym });
  };

  $$('[data-ex]', el).forEach((b) =>
    b.addEventListener('click', () => {
      const cur = S.get('workouts', date) || { id: date, date, reps: {} };
      const ex = b.dataset.ex;
      const val = b.dataset.set != null ? Number(b.dataset.set) : Math.max(0, (cur.reps?.[ex] || 0) + Number(b.dataset.d));
      S.put('workouts', { ...cur, reps: { ...cur.reps, [ex]: val } });
    }),
  );
}
