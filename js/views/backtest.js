import * as S from '../store.js';
import { $, $$, esc, ymd, fmtDate, num, fixed, sum, money, pnlClass } from '../util.js';
import { openModal, modalHead, imagePicker, toast, kpi, bindThumbs } from '../ui.js';

export function backtestSummary(list) {
  const trades = sum(list, (b) => b.trades);
  const wins = sum(list, (b) => b.wins);
  const losses = sum(list, (b) => b.losses);
  const netR = sum(list, (b) => b.netR);
  const decided = wins + losses;
  return {
    sessions: list.length, trades, wins, losses, netR,
    winRate: decided ? wins / decided : null,
    avgR: trades ? netR / trades : null,
    minutes: sum(list, (b) => b.minutes),
  };
}

export default function backtest(el) {
  const list = S.all('backtests').sort((a, b) => b.date.localeCompare(a.date));
  const s = backtestSummary(list);
  const strategies = [...new Set(list.map((b) => b.strategy).filter(Boolean))];

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Backtesting</h1><p class="muted">Kept completely separate from live trading.</p></div>
      <button class="primary" id="add">+ Log session</button>
    </div>
    <div class="grid kpis">
      ${kpi('Sessions', s.sessions, { sub: `${Math.round(s.minutes / 60 * 10) / 10}h total` })}
      ${kpi('Trades tested', s.trades)}
      ${kpi('Win rate', s.winRate == null ? '—' : Math.round(s.winRate * 100) + '%')}
      ${kpi('Net R', fixed(s.netR, 1), { cls: pnlClass(s.netR) })}
      ${kpi('Avg R / trade', fixed(s.avgR, 2), { cls: pnlClass(s.avgR) })}
    </div>

    ${strategies.length ? `<div class="section card"><h2>By strategy</h2><div class="table-wrap"><table>
      <thead><tr><th>Strategy</th><th class="num">Sessions</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Net R</th><th class="num">Avg R</th></tr></thead>
      <tbody>${strategies.map((st) => {
        const x = backtestSummary(list.filter((b) => b.strategy === st));
        return `<tr><td>${esc(st)}</td><td class="num">${x.sessions}</td><td class="num">${x.trades}</td><td class="num">${x.winRate == null ? '—' : Math.round(x.winRate * 100) + '%'}</td>
          <td class="num ${pnlClass(x.netR)}">${fixed(x.netR, 1)}</td><td class="num ${pnlClass(x.avgR)}">${fixed(x.avgR, 2)}</td></tr>`;
      }).join('')}</tbody></table></div></div>` : ''}

    <div class="section card"><h2>Sessions</h2>
      ${list.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Strategy</th><th class="hide-sm">Period tested</th><th class="num">Trades</th><th class="num">W/L</th><th class="num">Net R</th><th class="hide-sm">Notes</th></tr></thead>
        <tbody>${list.map((b) => `<tr class="click" data-id="${b.id}">
          <td>${esc(fmtDate(b.date))}</td><td>${esc(b.strategy || '')}</td>
          <td class="hide-sm muted small">${esc([b.from, b.to].filter(Boolean).join(' → '))}</td>
          <td class="num">${esc(b.trades ?? '')}</td><td class="num">${esc(b.wins ?? 0)}/${esc(b.losses ?? 0)}</td>
          <td class="num ${pnlClass(b.netR)}">${fixed(b.netR, 1)}</td>
          <td class="hide-sm muted small">${esc((b.notes || '').slice(0, 60))}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">No sessions yet. Log one after each backtesting block.</div>'}
    </div>`;

  $('#add', el).onclick = () => openForm();
  $$('[data-id]', el).forEach((r) => r.addEventListener('click', () => openForm(S.get('backtests', r.dataset.id))));
}

function openForm(b) {
  const isNew = !b;
  b = b || { date: ymd(), instrument: 'NQ', images: [] };
  const strategies = [...new Set([...S.settings().setups, ...S.all('backtests').map((x) => x.strategy).filter(Boolean)])];
  const m = openModal(`
    ${modalHead(isNew ? 'Log backtest session' : 'Edit backtest session')}
    <form id="bf" class="stack" autocomplete="off">
      <div class="form-grid">
        <label class="field">Date done<input type="date" name="date" value="${esc(b.date)}" required></label>
        <label class="field">Strategy<input name="strategy" list="bt-strats" value="${esc(b.strategy || '')}" required><datalist id="bt-strats">${strategies.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>
        <label class="field">Instrument<input name="instrument" value="${esc(b.instrument || 'NQ')}"></label>
        <label class="field">Time spent (min)<input type="number" name="minutes" min="0" value="${esc(b.minutes ?? '')}"></label>
        <label class="field">Tested from<input type="date" name="from" value="${esc(b.from || '')}"></label>
        <label class="field">Tested to<input type="date" name="to" value="${esc(b.to || '')}"></label>
      </div>
      <div class="form-grid">
        <label class="field">Trades<input type="number" name="trades" min="0" value="${esc(b.trades ?? '')}"></label>
        <label class="field">Wins<input type="number" name="wins" min="0" value="${esc(b.wins ?? '')}"></label>
        <label class="field">Losses<input type="number" name="losses" min="0" value="${esc(b.losses ?? '')}"></label>
        <label class="field">Break-even<input type="number" name="be" min="0" value="${esc(b.be ?? '')}"></label>
        <label class="field">Net R<input type="number" name="netR" step="0.1" value="${esc(b.netR ?? '')}"></label>
        <label class="field">Net points<input type="number" name="netPts" step="0.25" value="${esc(b.netPts ?? '')}"></label>
      </div>
      <label class="field">Notes<textarea name="notes" placeholder="Rules tested, what worked, what didn't">${esc(b.notes || '')}</textarea></label>
      <label class="field">Key lesson<input name="lesson" value="${esc(b.lesson || '')}"></label>
      <div class="field"><span class="muted small" style="font-weight:600">Screenshots</span><div id="imgs"></div></div>
      <div class="modal-foot"><div>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
        <div class="row tight"><button type="button" data-close>Cancel</button><button class="primary">Save</button></div></div>
    </form>`, { wide: true });
  const f = $('#bf', m.el);
  const pics = imagePicker($('#imgs', f), b.images || []);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (k) => f.elements[k].value;
    S.put('backtests', {
      ...b, date: v('date'), strategy: v('strategy').trim(), instrument: v('instrument'), minutes: num(v('minutes')),
      from: v('from'), to: v('to'), trades: num(v('trades')), wins: num(v('wins')), losses: num(v('losses')), be: num(v('be')),
      netR: num(v('netR')), netPts: num(v('netPts')), notes: v('notes'), lesson: v('lesson'), images: pics.get(),
    });
    pics.destroy();
    m.close();
    toast('Backtest session saved');
  });
  $('#del', f)?.addEventListener('click', () => { if (confirm('Delete this session?')) { S.remove('backtests', b.id); m.close(); } });
}
