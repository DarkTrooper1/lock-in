# Lock In

Personal trading + discipline app: a points-and-goal front page with a daily checklist, trade journal, backtesting log, workout tracker, payouts and stats.

Plain HTML/CSS/JS, no build step. Runs on GitHub Pages; data syncs to a **separate private repo** you own.

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173

## Data

- Saved on each device (localStorage + IndexedDB for screenshots), and synced to `data.json` + `images/` in your private data repo.
- Settings → Sync: GitHub username, data repo name, and a fine-grained token with **Contents: Read and write** on that one repo only.
- Settings → Backup downloads everything as JSON.

## Reminders (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File reminders\install.ps1 -AppUrl "https://darktrooper1.github.io/lock-in/"
```

Optional: `-PremarketTime 14:00 -EveningTime 21:30`. Remove with `reminders\uninstall.ps1`.

## Code map

- `js/store.js` data, screenshots, GitHub sync
- `js/checklist.js` daily non-negotiables (ticked or logged) + streaks
- `js/points.js` points, bonuses, goals
- `js/trading.js` P&L / R / stats math
- `js/views/*` one file per page
