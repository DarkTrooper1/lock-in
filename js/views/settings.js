import * as S from '../store.js';
import { $, $$, esc, ymd, num, uid, DAY_NAMES } from '../util.js';
import { toast } from '../ui.js';
import { ITEMS, ITEM_POINTS, ALLOWED_DAYS } from '../checklist.js';
import { openCustomItem } from './today.js';

const LISTS = [
  ['accounts', 'Accounts', 'e.g. Lucid 50K #1'],
  ['setups', 'Setups / strategies', 'used for journal + backtests'],
  ['emotions', 'Emotions', ''],
  ['mistakes', 'Mistakes', ''],
];

export default function settings(el) {
  const set = S.settings();
  const sync = S.syncConfig() || {};
  const last = S.lastSync();

  el.innerHTML = `
    <div class="page-head"><h1>Settings</h1></div>

    <div class="card">
      <h2>Sync across devices</h2>
      <p class="muted small">Your data is saved to a <strong>private GitHub repo you own</strong>, so it's yours forever and shows up on your phone, PC and Mac.
        Enter the same details on each device. The token stays on that device only.</p>
      <form id="sf" class="form-grid" autocomplete="off">
        <label class="field">GitHub username<input name="owner" value="${esc(sync.owner || '')}" placeholder="your-username"></label>
        <label class="field">Private data repo<input name="repo" value="${esc(sync.repo || '')}" placeholder="lock-in-data"></label>
        <label class="field span-all">Access token<input name="token" type="password" value="${esc(sync.token || '')}" placeholder="github_pat_…"></label>
        <div class="row tight span-all">
          <button class="primary">Save &amp; test</button>
          ${sync.owner ? '<button type="button" id="sync-now">Sync now</button><button type="button" class="danger" id="unlink">Disconnect this device</button>' : ''}
          <span class="muted small">${last ? 'Last synced ' + new Date(last).toLocaleString() : ''}</span>
        </div>
      </form>
    </div>

    <div class="section grid c2">
      <div class="card">
        <h2>Daily non-negotiables</h2>
        <p class="muted small">Which items count toward your streak, and on which days.</p>
        <div class="stack" id="cl">
          ${ITEMS.map((i) => {
            const c = set.checklist[i.key];
            return `<div data-item="${i.key}">
              <label class="check"><input type="checkbox" data-on ${c.on ? 'checked' : ''}> <strong>${esc(i.label.replace("today's ", ''))}</strong> <span class="tag">+${ITEM_POINTS[i.key]}</span></label>
              <div class="chips" style="margin:6px 0 0 30px">${DAY_NAMES.map((d, n) => {
                const allowed = !ALLOWED_DAYS[i.key] || ALLOWED_DAYS[i.key].includes(n);
                return `<button type="button" class="chip ${allowed && c.days.includes(n) ? 'on' : ''}" data-day="${n}" ${allowed ? '' : 'disabled style="opacity:.3;cursor:not-allowed" title="No trading this day"'}>${d}</button>`;
              }).join('')}</div>
            </div>`;
          }).join('')}
        </div>
        <h3 style="margin-top:18px">Your own items</h3>
        ${(set.customItems || []).map((c) => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)">
            <span><strong>${esc(c.label)}</strong> <span class="tag">+${c.points}</span>
            <span class="muted small">${c.days.length === 7 ? 'every day' : c.days.map((n) => DAY_NAMES[n]).join(' ')}</span></span>
            <button class="sm ghost" data-custom="${esc(c.id)}">Edit</button></div>`).join('') || '<p class="muted small">None yet.</p>'}
        <button type="button" id="add-custom" style="margin-top:8px">+ Add your own item</button>
      </div>

      <div class="card">
        <h2>Big wins</h2>
        <p class="muted small">One-off achievements worth a lot of points. One per line, as <span class="mono">Name = points</span>.</p>
        <div class="form-grid">
          <label class="field">Points per payout<input id="payout-pts" type="number" min="0" step="50" value="${esc(set.payoutPoints ?? 500)}"></label>
          <label class="field">Gym twice in a week<input id="gym-pts" type="number" min="0" step="10" value="${esc(set.gymBonus ?? 100)}"></label>
        </div>
        <label class="field" style="margin-top:10px">Other big wins<textarea id="win-types" rows="5">${esc((set.winTypes || []).map((t) => `${t.label} = ${t.points}`).join('\n'))}</textarea></label>
      </div>

      <div class="card">
        <h2>Workout routine</h2>
        <div class="stack" id="routine" style="gap:8px">
          ${set.routine.map((ex) => routineRow(ex)).join('')}
        </div>
        <div class="row tight" style="margin-top:10px"><button type="button" id="add-ex">+ Exercise</button><button class="primary" id="save-routine">Save routine</button></div>
      </div>
    </div>

    <div class="section card">
      <h2>Trading defaults</h2>
      <div class="form-grid">
        <label class="field">Default instrument<select id="d-inst">${['NQ', 'MNQ'].map((x) => `<option ${set.defaultInstrument === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="field">Default account<select id="d-acct">${set.accounts.map((x) => `<option ${set.defaultAccount === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label class="field">Fees per contract, round trip ($)<input id="d-fee" type="number" step="0.01" value="${esc(set.feePerContract || 0)}"></label>
      </div>
    </div>

    <div class="section card">
      <h2>Lists</h2>
      <p class="muted small">One per line.</p>
      <div class="grid c3">
        ${LISTS.map(([k, label, hint]) => `<label class="field">${esc(label)}<textarea data-list="${k}" rows="6" placeholder="${esc(hint)}">${esc((set[k] || []).join('\n'))}</textarea></label>`).join('')}
      </div>
    </div>

    <div class="section card">
      <h2>Backup</h2>
      <p class="muted small">Download everything as a file (screenshots are kept separately in your GitHub repo).</p>
      <div class="row tight">
        <button id="export">Download backup</button>
        <label class="btn" style="cursor:pointer">Restore from backup<input type="file" id="import" accept="application/json" hidden></label>
      </div>
    </div>
  `;

  // sync
  $('#sf', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    // forgive pasted URLs ("github.com/me/repo", "me/repo") and stray whitespace in the token
    let owner = f.owner.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/^@/, '');
    let repo = f.repo.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '');
    if (repo.includes('/')) [owner, repo] = repo.split('/').slice(-2);
    owner = owner.split('/')[0];
    const cfg = { owner, repo, token: f.token.value.replace(/\s+/g, '') };
    if (!cfg.owner || !cfg.repo || !cfg.token) return toast('Fill in all three fields');
    try {
      await S.testSync(cfg);
      S.setSyncConfig(cfg);
      toast('Connected. Syncing…');
      await S.sync();
    } catch (err) {
      toast(err.message, 10000);
    }
  });
  $('#sync-now', el)?.addEventListener('click', () => S.sync());
  $('#unlink', el)?.addEventListener('click', () => {
    if (confirm('Stop syncing on this device? Your data stays here and in GitHub.')) { S.setSyncConfig(null); location.reload(); }
  });

  // checklist
  $$('[data-item]', el).forEach((row) => {
    const save = () => {
      const days = $$('.chip.on', row).map((c) => Number(c.dataset.day));
      S.saveSettings({ checklist: { ...S.settings().checklist, [row.dataset.item]: { on: $('[data-on]', row).checked, days } } });
    };
    $('[data-on]', row).addEventListener('change', save);
    $$('[data-day]:not([disabled])', row).forEach((c) => c.addEventListener('click', () => { c.classList.toggle('on'); save(); }));
  });

  // custom items + big wins
  $('#add-custom', el).onclick = () => openCustomItem();
  $$('[data-custom]', el).forEach((b) => b.addEventListener('click', () => openCustomItem((S.settings().customItems || []).find((c) => c.id === b.dataset.custom))));
  $('#gym-pts', el).onchange = (e) => { S.saveSettings({ gymBonus: num(e.target.value) ?? 100 }); toast('Saved'); };
  $('#payout-pts', el).onchange = (e) => { S.saveSettings({ payoutPoints: num(e.target.value) ?? 500 }); toast('Saved'); };
  $('#win-types', el).onchange = (e) => {
    const winTypes = e.target.value.split('\n').map((line) => {
      const m = /^(.*?)\s*=\s*(\d+)\s*$/.exec(line.trim());
      return m && m[1] ? { label: m[1].trim(), points: Number(m[2]) } : null;
    }).filter(Boolean);
    S.saveSettings({ winTypes });
    toast(`Saved ${winTypes.length} big win${winTypes.length === 1 ? '' : 's'}`);
  };

  // routine
  const bindRemove = () => $$('[data-rm-ex]', el).forEach((b) => (b.onclick = () => b.closest('.ex-row').remove()));
  bindRemove();
  $('#add-ex', el).onclick = () => {
    $('#routine', el).insertAdjacentHTML('beforeend', routineRow({ id: uid(), name: '', target: 20 }));
    bindRemove();
  };
  $('#save-routine', el).onclick = () => {
    const routine = $$('.ex-row', el)
      .map((r) => ({ id: r.dataset.id, name: $('[data-name]', r).value.trim(), target: num($('[data-target]', r).value) || 0 }))
      .filter((x) => x.name && x.target > 0);
    S.saveSettings({ routine });
    toast('Routine saved');
  };

  // defaults
  $('#d-inst', el).onchange = (e) => S.saveSettings({ defaultInstrument: e.target.value });
  $('#d-acct', el).onchange = (e) => S.saveSettings({ defaultAccount: e.target.value });
  $('#d-fee', el).onchange = (e) => S.saveSettings({ feePerContract: num(e.target.value) || 0 });

  // lists
  $$('[data-list]', el).forEach((t) =>
    t.addEventListener('change', () => {
      const items = [...new Set(t.value.split('\n').map((x) => x.trim()).filter(Boolean))];
      S.saveSettings({ [t.dataset.list]: items });
      toast('Saved');
    }),
  );

  // backup
  $('#export', el).onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
    a.download = `lock-in-backup-${ymd()}.json`;
    a.click();
  };
  $('#import', el).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      S.importJSON(await file.text());
      toast('Backup merged in');
    } catch (err) {
      toast('That file could not be read: ' + err.message, 4000);
    }
  };
}

function routineRow(ex) {
  return `<div class="ex-row row tight" data-id="${esc(ex.id)}">
    <input data-name value="${esc(ex.name)}" placeholder="Exercise" style="flex:1">
    <input data-target type="number" min="1" value="${esc(ex.target)}" style="width:90px">
    <span class="muted small">reps</span>
    <button type="button" class="ghost danger sm" data-rm-ex>✕</button>
  </div>`;
}
