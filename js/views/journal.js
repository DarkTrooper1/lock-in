import * as S from '../store.js';
import { $, $$, esc, ymd, fmtDate, money, pnlClass, num, fixed, sum, parseCSV, parseDateTime, instrumentFromSymbol } from '../util.js';
import { openModal, modalHead, toast, chipsHTML, bindChips, readChips, segHTML, bindSeg, readSeg, imagePicker, thumbsHTML, bindThumbs, options, kpi } from '../ui.js';
import { grossPnl, rMultiple, points, sortTrades, summarize, stopPoints, riskDollars } from '../trading.js';

export default function journal(el, params) {
  const month = params.month || ymd().slice(0, 7);
  const account = params.account || '';
  const set = S.settings();
  const [y, m] = month.split('-').map(Number);
  const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1);
  const mkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const trades = S.all('trades').filter((t) => t.date.slice(0, 7) === month && (!account || t.account === account));
  const s = summarize(trades);
  // include days that have only a review / no-trade flag
  const dayIds = new Set(trades.map((t) => t.date));
  S.all('days').forEach((d) => { if (d.id.slice(0, 7) === month && (d.noTrade || d.review)) dayIds.add(d.id); });
  const days = [...dayIds].sort().reverse();
  const accounts = [...new Set([...set.accounts, ...S.all('trades').map((t) => t.account).filter(Boolean)])];

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Trade journal</h1>
        <div class="row tight">
          <a class="btn sm" href="#/journal?month=${mkey(prev)}&account=${encodeURIComponent(account)}">←</a>
          <strong>${new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <a class="btn sm" href="#/journal?month=${mkey(next)}&account=${encodeURIComponent(account)}">→</a>
          <select id="acct" style="width:auto"><option value="">All accounts</option>${options(accounts, account)}</select>
        </div>
      </div>
      <div class="row tight">
        <button id="import">Import CSV</button>
        <button id="review">Daily review</button>
        <button class="primary" id="add">+ Add trade</button>
      </div>
    </div>

    <div class="grid kpis">
      ${kpi('Net P&L', money(s.net), { cls: pnlClass(s.net) })}
      ${kpi('Trades', s.count, { sub: `${s.wins}W · ${s.losses}L` })}
      ${kpi('Win rate', s.winRate == null ? '—' : Math.round(s.winRate * 100) + '%')}
      ${kpi('Profit factor', s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : fixed(s.profitFactor))}
      ${kpi('Avg R', fixed(s.avgR))}
      ${kpi('Green days', s.days ? `${s.greenDays}/${s.days}` : '—')}
    </div>

    <div class="section">
      ${days.length ? days.map((d) => dayHTML(d, trades.filter((t) => t.date === d))).join('') : '<div class="card empty">No trades this month yet. Add one, or import from Tradovate.</div>'}
    </div>
  `;

  $('#add', el).onclick = () => openTradeForm();
  $('#import', el).onclick = () => openImport();
  $('#review', el).onclick = () => openReview(ymd());
  $('#acct', el).onchange = (e) => (location.hash = `#/journal?month=${month}&account=${encodeURIComponent(e.target.value)}`);
  $$('[data-trade]', el).forEach((r) => r.addEventListener('click', () => openTradeForm(S.get('trades', r.dataset.trade))));
  $$('[data-review]', el).forEach((b) => b.addEventListener('click', () => openReview(b.dataset.review)));
  bindThumbs(el);
}

function dayHTML(date, trades) {
  const day = S.get('days', date) || {};
  const net = sum(trades, (t) => t.pnl);
  const sorted = sortTrades(trades);
  return `<div class="day-group">
    <div class="day-head">
      <div class="row tight">
        <strong>${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' }))}</strong>
        ${day.noTrade ? '<span class="tag">No-trade day</span>' : ''}
        ${day.discipline ? `<span class="tag ${day.discipline >= 4 ? 'pos' : day.discipline <= 2 ? 'neg' : 'warn'}">Discipline ${day.discipline}/5</span>` : ''}
      </div>
      <div class="row tight">
        ${trades.length ? `<span class="${pnlClass(net)} mono" style="font-weight:700">${money(net)}</span>` : ''}
        <button class="sm ghost" data-review="${date}">${day.review ? 'Edit review' : 'Add review'}</button>
      </div>
    </div>
    ${day.review ? `<p class="muted small" style="margin:8px 0;white-space:pre-wrap">${esc(day.review)}</p>` : ''}
    ${trades.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Time</th><th>Side</th><th class="hide-sm">Qty</th><th class="hide-sm">Entry → Exit</th><th class="num">P&L</th><th class="num hide-sm">R</th><th>Setup</th><th class="hide-sm">Plan</th><th class="hide-sm"></th></tr></thead>
      <tbody>${sorted.map((t) => {
        const r = rMultiple(t);
        return `<tr class="click" data-trade="${t.id}">
          <td class="mono">${esc(t.time || '')}</td>
          <td><span class="${t.side === 'short' ? 'neg' : 'pos'}">${t.side === 'short' ? 'S' : 'L'}</span> ${esc(t.instrument || '')}</td>
          <td class="hide-sm">${esc(t.qty ?? '')}</td>
          <td class="mono hide-sm">${esc(t.entry ?? '')} → ${esc(t.exit ?? '')}</td>
          <td class="num ${pnlClass(t.pnl)}" style="font-weight:700">${money(t.pnl)}</td>
          <td class="num hide-sm ${pnlClass(r)}">${r == null ? '' : fixed(r, 1) + 'R'}</td>
          <td>${t.setup ? `<span class="tag">${esc(t.setup)}</span>` : ''}${t.mistakes?.length ? ` <span class="tag neg">${t.mistakes.length} mistake${t.mistakes.length > 1 ? 's' : ''}</span>` : ''}</td>
          <td class="hide-sm">${t.followedPlan === 'yes' ? '<span class="pos">✓</span>' : t.followedPlan === 'no' ? '<span class="neg">✗</span>' : ''}</td>
          <td class="hide-sm muted small">${t.images?.length ? '📷 ' + t.images.length : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>` : ''}
  </div>`;
}

// ---------- Trade form ----------
export function openTradeForm(trade) {
  const set = S.settings();
  const isNew = !trade;
  const t = trade || {
    date: ymd(), time: '', side: 'long', instrument: set.defaultInstrument || 'NQ',
    account: set.defaultAccount || set.accounts[0] || '', qty: 1, emotions: [], mistakes: [], images: [],
  };
  const computedNow = grossPnl(t) != null ? grossPnl(t) - (t.fees || 0) : null;
  const manual = t.pnl != null && computedNow != null && Math.abs(computedNow - t.pnl) > 0.01;
  // Stop can be typed as a distance in points (default) or as the actual stop price.
  const stopMode = t.stopMode || (t.stopPts == null && t.stop != null && t.entry != null && t.stop >= t.entry / 2 ? 'price' : 'pts');
  const stopValue = stopMode === 'pts' ? stopPoints(t) : t.stop;
  const STOP_HINT = { pts: 'e.g. 10 = 10 points away', price: 'e.g. 21440.25' };

  const m = openModal(`
    ${modalHead(isNew ? 'Add trade' : 'Edit trade')}
    <form id="tf" class="stack" autocomplete="off">
      <div class="form-grid">
        <label class="field">Date<input type="date" name="date" value="${esc(t.date)}" required></label>
        <label class="field">Entry time<input type="time" name="time" value="${esc(t.time || '')}"></label>
        <label class="field">Exit time<input type="time" name="exitTime" value="${esc(t.exitTime || '')}"></label>
        <label class="field">Account<select name="account">${options(set.accounts, t.account, { blank: '—' })}</select></label>
      </div>
      <div class="row">
        ${segHTML('instrument', [['NQ', 'NQ'], ['MNQ', 'MNQ']], t.instrument)}
        ${segHTML('side', [['long', 'Long', 'long'], ['short', 'Short', 'short']], t.side)}
      </div>
      <div class="form-grid">
        <label class="field">Contracts<input type="number" name="qty" min="1" step="1" value="${esc(t.qty ?? '')}"></label>
        <label class="field">Entry<input type="number" name="entry" step="0.25" value="${esc(t.entry ?? '')}"></label>
        <label class="field">Exit<input type="number" name="exit" step="0.25" value="${esc(t.exit ?? '')}"></label>
        <div class="field" style="font-size:12px;color:var(--muted);font-weight:700;display:flex;flex-direction:column;gap:6px">
          <span class="row between" style="gap:6px">Stop loss ${segHTML('stopMode', [['pts', 'Points'], ['price', 'Price']], stopMode)}</span>
          <input type="number" name="stop" step="0.25" min="0" value="${esc(stopValue ?? '')}" placeholder="${STOP_HINT[stopMode]}"></div>
        <label class="field">Fees ($)<input type="number" name="fees" step="0.01" value="${esc(t.fees ?? '')}"></label>
        <label class="field">Net P&L ($)<input type="number" name="pnl" step="0.01" value="${esc(t.pnl ?? '')}" ${manual ? 'data-manual="1"' : ''}></label>
      </div>
      <div class="muted small" id="calc"></div>
      <div class="form-grid">
        <label class="field">Setup / strategy<input name="setup" list="setups" value="${esc(t.setup || '')}" placeholder="e.g. LVN rejection"><datalist id="setups">${set.setups.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>
        <label class="field">Followed my plan?${segHTML('followedPlan', [['yes', 'Yes', 'long'], ['no', 'No', 'short']], t.followedPlan)}</label>
      </div>
      <label class="field">Emotions${chipsHTML('emotions', set.emotions, t.emotions)}</label>
      <label class="field">Mistakes${chipsHTML('mistakes', set.mistakes, t.mistakes, { bad: true })}</label>
      <label class="field">Notes<textarea name="notes" placeholder="Why did you take it? What did the orderflow show? What would you do differently?">${esc(t.notes || '')}</textarea></label>
      <div class="field"><span class="muted small" style="font-weight:600">Screenshots</span><div id="imgs"></div></div>
      <div class="modal-foot">
        <div>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
        <div class="row tight"><button type="button" data-close>Cancel</button><button class="primary" type="submit">Save trade</button></div>
      </div>
    </form>`, { wide: true });

  const f = $('#tf', m.el);
  bindChips(f); bindSeg(f);
  const pics = imagePicker($('#imgs', f), t.images || []);

  const read = () => {
    const fd = new FormData(f);
    return {
      ...t,
      date: fd.get('date'), time: fd.get('time'), exitTime: fd.get('exitTime'), account: fd.get('account'),
      instrument: readSeg(f, 'instrument'), side: readSeg(f, 'side'),
      qty: num(fd.get('qty')), entry: num(fd.get('entry')), exit: num(fd.get('exit')), ...readStop(fd),
      fees: num(fd.get('fees')), pnl: num(fd.get('pnl')),
      setup: fd.get('setup').trim(), followedPlan: readSeg(f, 'followedPlan'),
      emotions: readChips(f, 'emotions'), mistakes: readChips(f, 'mistakes'),
      notes: fd.get('notes'), images: pics.get(),
    };
  };
  function readStop(fd) {
    const mode = readSeg(f, 'stopMode') || 'pts';
    const v = num(fd.get('stop'));
    const entry = num(fd.get('entry'));
    const long = readSeg(f, 'side') !== 'short';
    if (v == null) return { stopMode: mode, stop: null, stopPts: null };
    if (mode === 'pts') return { stopMode: mode, stopPts: Math.abs(v), stop: entry != null ? entry + (long ? -Math.abs(v) : Math.abs(v)) : null };
    return { stopMode: mode, stop: v, stopPts: entry != null ? Math.abs(entry - v) : null };
  }
  // switching units converts the number already typed
  $('[data-seg="stopMode"]', f).addEventListener('change', () => {
    const mode = readSeg(f, 'stopMode');
    const input = f.elements.stop;
    const entry = num(f.elements.entry.value);
    const v = num(input.value);
    const long = readSeg(f, 'side') !== 'short';
    if (v != null && entry != null) input.value = mode === 'pts' ? Math.abs(entry - v) : entry + (long ? -v : v);
    input.placeholder = STOP_HINT[mode];
  });

  const pnlInput = f.elements.pnl;
  pnlInput.addEventListener('input', () => (pnlInput.dataset.manual = pnlInput.value === '' ? '' : '1'));
  const recalc = () => {
    const d = read();
    const g = grossPnl(d);
    if (g != null && !pnlInput.dataset.manual) pnlInput.value = (g - (d.fees || 0)).toFixed(2);
    const pts = points(d);
    const withPnl = { ...d, pnl: num(pnlInput.value) };
    const r = rMultiple(withPnl);
    const sp = stopPoints(withPnl), risk = riskDollars(withPnl);
    $('#calc', f).innerHTML = [
      pts != null ? `Result <b>${fixed(pts, 2)} pts</b>` : '',
      sp != null && risk != null ? `Risk <b>${fixed(sp, 2)} pts = ${money(risk)}</b>` : '',
      r != null ? `<b class="${pnlClass(r)}">${fixed(r, 2)}R</b>` : '',
    ].filter(Boolean).join(' · ') || 'Fill in entry, exit, contracts and stop to see points, risk and R.';
  };
  f.addEventListener('input', recalc);
  f.addEventListener('change', recalc);
  recalc();

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = read();
    if (d.setup && !S.settings().setups.includes(d.setup)) S.saveSettings({ setups: [...S.settings().setups, d.setup] });
    S.put('trades', d);
    // logging a trade un-flags a no-trade day
    const day = S.get('days', d.date);
    if (day?.noTrade) S.put('days', { ...day, noTrade: false });
    pics.destroy();
    m.close();
    toast('Trade saved');
  });
  $('#del', f)?.addEventListener('click', () => {
    if (!confirm('Delete this trade?')) return;
    S.remove('trades', t.id);
    m.close();
  });
}

// ---------- Daily review ----------
function openReview(date) {
  const d = S.get('days', date) || { id: date, date };
  const m = openModal(`
    ${modalHead('Daily review')}
    <form id="rf" class="stack">
      <label class="field">Day<input type="date" name="date" value="${esc(date)}"></label>
      <label class="field">Discipline today (1–5)${segHTML('discipline', [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]), d.discipline ? String(d.discipline) : null)}</label>
      <label class="check"><input type="checkbox" name="noTrade" ${d.noTrade ? 'checked' : ''}> No-trade day (counts as journaled)</label>
      <label class="field">Review<textarea name="review" rows="7" placeholder="What went well? What did I do wrong? What's the one thing to fix tomorrow?">${esc(d.review || '')}</textarea></label>
      <div class="modal-foot"><span></span><div class="row tight"><button type="button" data-close>Cancel</button><button class="primary">Save</button></div></div>
    </form>`);
  const f = $('#rf', m.el);
  bindSeg(f);
  f.elements.date.addEventListener('change', (e) => { m.close(); openReview(e.target.value); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const disc = readSeg(f, 'discipline');
    S.put('days', { ...d, id: date, date, review: f.elements.review.value, noTrade: f.elements.noTrade.checked, discipline: disc ? Number(disc) : null });
    m.close();
    toast('Review saved');
  });
}

// ---------- CSV import ----------
const FIELDS = [
  ['entryTime', 'Entry date/time', true],
  ['exitTime', 'Exit date/time', false],
  ['symbol', 'Symbol', true],
  ['side', 'Side (Buy/Sell/Long/Short)', true],
  ['qty', 'Quantity', true],
  ['entry', 'Entry price', true],
  ['exit', 'Exit price', true],
  ['pnl', 'P&L', false],
  ['fees', 'Fees/commission', false],
];

function isTradovatePerformance(h) {
  return ['buyPrice', 'sellPrice', 'boughtTimestamp', 'soldTimestamp'].every((k) => h.includes(k));
}

function parseTradovate(headers, rows) {
  const ix = (k) => headers.indexOf(k);
  return rows.map((r) => {
    const bought = parseDateTime(r[ix('boughtTimestamp')]);
    const sold = parseDateTime(r[ix('soldTimestamp')]);
    if (!bought || !sold) return null;
    const long = (bought.date + bought.time) <= (sold.date + sold.time);
    const first = long ? bought : sold, last = long ? sold : bought;
    return {
      importKey: `tv:${r[ix('buyFillId')]}:${r[ix('sellFillId')]}`,
      date: first.date, time: first.time, exitTime: last.time,
      instrument: instrumentFromSymbol(r[ix('symbol')]),
      side: long ? 'long' : 'short',
      qty: num(r[ix('qty')]),
      entry: num(r[ix(long ? 'buyPrice' : 'sellPrice')]),
      exit: num(r[ix(long ? 'sellPrice' : 'buyPrice')]),
      grossPnl: ix('pnl') >= 0 ? num(r[ix('pnl')]) : null,
    };
  }).filter(Boolean);
}

function parseGeneric(headers, rows, map, dayFirst) {
  const val = (r, k) => (map[k] != null && map[k] !== '' ? r[Number(map[k])] : '');
  return rows.map((r) => {
    const en = parseDateTime(val(r, 'entryTime'), dayFirst);
    const ex = parseDateTime(val(r, 'exitTime'), dayFirst);
    const sideRaw = String(val(r, 'side')).toLowerCase();
    const side = /^(s|short|sell|sld)/.test(sideRaw) ? 'short' : 'long';
    return {
      importKey: 'csv:' + r.join('|'),
      date: en?.date, time: en?.time, exitTime: ex?.time || '',
      instrument: instrumentFromSymbol(val(r, 'symbol')),
      side, qty: Math.abs(num(val(r, 'qty')) || 0) || null,
      entry: num(val(r, 'entry')), exit: num(val(r, 'exit')),
      grossPnl: num(val(r, 'pnl')), fees: num(val(r, 'fees')),
    };
  }).filter((t) => t.date);
}

function openImport() {
  const set = S.settings();
  const m = openModal(`
    ${modalHead('Import trades from CSV')}
    <div class="stack">
      <p class="muted small">Tradovate: Account Reports → Performance → download CSV. That format is detected automatically.
        For other platforms (e.g. Tradesea) you'll match up the columns once and it's remembered.</p>
      <div class="form-grid">
        <label class="field">CSV file<input type="file" id="file" accept=".csv,text/csv"></label>
        <label class="field">Account<select id="acct">${options(set.accounts, set.defaultAccount)}</select></label>
        <label class="field">Fees per contract (round trip, $)<input type="number" id="fee" step="0.01" value="${esc(set.feePerContract || 0)}"></label>
      </div>
      <div id="mapping"></div>
      <div id="preview"></div>
      <div class="modal-foot"><span></span><div class="row tight"><button data-close>Cancel</button><button class="primary" id="go" disabled>Import</button></div></div>
    </div>`, { wide: true });

  let parsed = [];
  let headers = [], rows = [];
  const existing = new Set(S.all('trades').map((t) => t.importKey).filter(Boolean));

  const build = () => {
    const fee = num($('#fee', m.el).value) || 0;
    let base;
    if (isTradovatePerformance(headers)) {
      $('#mapping', m.el).innerHTML = '<div class="banner info">Tradovate Performance report detected.</div>';
      base = parseTradovate(headers, rows);
    } else {
      const sig = headers.join('|');
      const saved = set.importMappings?.[sig] || {};
      if (!$('#map-form', m.el)) {
        $('#mapping', m.el).innerHTML = `<div class="card flat" id="map-form"><h3>Match your columns</h3><div class="form-grid">
          ${FIELDS.map(([k, label, req]) => `<label class="field">${esc(label)}${req ? ' *' : ''}<select data-map="${k}"><option value="">—</option>
            ${headers.map((h, i) => `<option value="${i}" ${String(saved[k]) === String(i) || (saved[k] == null && guess(k, h)) ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}
          <label class="field">Date format<select id="dayfirst"><option value="0">MM/DD/YYYY (US)</option><option value="1" ${saved.dayFirst ? 'selected' : ''}>DD/MM/YYYY (UK)</option></select></label>
        </div></div>`;
        $('#map-form', m.el).addEventListener('change', build);
      }
      const map = {};
      $$('[data-map]', m.el).forEach((s) => (map[s.dataset.map] = s.value));
      const dayFirst = $('#dayfirst', m.el).value === '1';
      base = parseGeneric(headers, rows, map, dayFirst);
      parsed.mapping = { sig, map: { ...map, dayFirst } };
    }
    const mapping = parsed.mapping;
    parsed = base.map((t) => {
      const fees = t.fees != null ? Math.abs(t.fees) : fee * (t.qty || 0);
      const gross = t.grossPnl != null ? t.grossPnl : grossPnl(t);
      return { ...t, fees, pnl: gross != null ? Math.round((gross - fees) * 100) / 100 : null };
    });
    parsed.mapping = mapping;
    const fresh = parsed.filter((t) => !existing.has(t.importKey));
    $('#preview', m.el).innerHTML = `<p><strong>${fresh.length}</strong> new trade${fresh.length === 1 ? '' : 's'}${parsed.length - fresh.length ? `, ${parsed.length - fresh.length} already imported (skipped)` : ''}.</p>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th class="num">Net P&L</th></tr></thead><tbody>
      ${fresh.slice(0, 15).map((t) => `<tr><td>${esc(t.date)}</td><td>${esc(t.time)}</td><td>${esc(t.side)} ${esc(t.instrument)}</td><td>${esc(t.qty)}</td><td>${esc(t.entry)}</td><td>${esc(t.exit)}</td><td class="num ${pnlClass(t.pnl)}">${money(t.pnl)}</td></tr>`).join('')}
      </tbody></table></div>${fresh.length > 15 ? `<p class="muted small">…and ${fresh.length - 15} more</p>` : ''}`;
    $('#go', m.el).disabled = !fresh.length;
  };

  $('#file', m.el).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const all = parseCSV(await file.text());
    if (all.length < 2) return toast('That file has no rows');
    headers = all[0].map((h) => h.trim());
    rows = all.slice(1);
    $('#mapping', m.el).innerHTML = '';
    build();
  });
  $('#fee', m.el).addEventListener('input', () => headers.length && build());

  $('#go', m.el).addEventListener('click', () => {
    const account = $('#acct', m.el).value;
    const fresh = parsed.filter((t) => !existing.has(t.importKey) && t.date);
    S.putMany('trades', fresh.map(({ grossPnl: _g, ...t }) => ({ ...t, account, emotions: [], mistakes: [], images: [], imported: true })));
    const patch = { feePerContract: num($('#fee', m.el).value) || 0 };
    if (parsed.mapping) patch.importMappings = { ...set.importMappings, [parsed.mapping.sig]: parsed.mapping.map };
    S.saveSettings(patch);
    m.close();
    toast(`Imported ${fresh.length} trades. Now go add your notes and screenshots.`, 3500);
  });
}

function guess(k, h) {
  h = h.toLowerCase();
  const g = {
    entryTime: /(entry|open).*(time|date)|^(date|time)$/,
    exitTime: /(exit|close).*(time|date)/,
    symbol: /symbol|contract|instrument/,
    side: /side|direction|b\/s|action/,
    qty: /qty|quantity|size|contracts/,
    entry: /entry.*price|open.*price|avg.*entry/,
    exit: /exit.*price|close.*price|avg.*exit/,
    pnl: /p&l|pnl|profit|realized/,
    fees: /fee|commission/,
  }[k];
  return g && g.test(h);
}
