// Small stroke icons (currentColor), sized by CSS.
const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  today: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  journal: svg('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/><path d="M9 7h7M9 11h5"/>'),
  backtest: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  workout: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  flame: svg('<path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.4-6-4-8-.4 2.3-1.6 3.6-3 4 .5-3-1-6.5-4-9 0 4-5 6.6-5 13 0 4.2 3.5 7 9 7z"/>'),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  dollar: svg('<path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9 9.5 12 10s5 1.5 5 3.5-2.2 3-5 3-5-1.1-5-3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};
