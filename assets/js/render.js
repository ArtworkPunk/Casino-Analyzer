/* =========================================================
   DOM rendering & table construction
   ========================================================= */

import {
  analyzeSeries,
  forecastSeries,
  COLORS,
  SECTORS,
  COLOR_LABEL,
  COLOR_SHORT,
  SECTOR_SHORT,
  colorOfNumber,
  sectorOfNumber,
} from './analysis.js';
import {
  forecastMarkup,
  qualityPill,
  colorCard,
  sectorCard,
  streakCard,
  transitionCard,
  fairnessCard,
  sampleCard,
  plural,
} from './views.js';

const SECTOR_ACCENT = { 1: '#e6c77e', 2: '#5ecf9f', 3: '#93aaff' };

const $ = (id) => document.getElementById(id);

const PAIRS = [
  { c: 'red', s: 1 },
  { c: 'red', s: 2 },
  { c: 'red', s: 3 },
  { c: 'black', s: 1 },
  { c: 'black', s: 2 },
  { c: 'black', s: 3 },
];

function popChip(el) {
  if (!el) return;
  const chip = document.createElement('span');
  chip.className = 'chip-pop';
  el.appendChild(chip);
  chip.addEventListener('animationend', () => chip.remove(), { once: true });
  el.classList.remove('is-hit');
  void el.offsetWidth;
  el.classList.add('is-hit');
  window.setTimeout(() => el.classList.remove('is-hit'), 620);
}

function flashCell(el) {
  if (!el) return;
  el.classList.remove('is-hit');
  void el.offsetWidth;
  el.classList.add('is-hit');
  window.setTimeout(() => el.classList.remove('is-hit'), 620);
}

export function initRenderer({ onAdd }) {
  const els = {
    pairGrid: $('pairGrid'),
    table: $('rouletteTable'),
    dockGrid: $('dockGrid'),
    tabSectors: $('tabSectors'),
    tabTable: $('tabTable'),
    tabBtnSectors: $('tabBtnSectors'),
    tabBtnTable: $('tabBtnTable'),
    forecastBody: $('forecastBody'),
    fcQuality: $('fcQuality'),
    colorBody: $('colorBody'),
    colorBadge: $('colorBadge'),
    sectorBody: $('sectorBody'),
    sectorBadge: $('sectorBadge'),
    streakBody: $('streakBody'),
    streakBadge: $('streakBadge'),
    transitionBody: $('transitionBody'),
    matrixToggle: $('matrixToggle'),
    fairBody: $('fairBody'),
    fairBadge: $('fairBadge'),
    sampleBody: $('sampleBody'),
    sampleBadge: $('sampleBadge'),
    historyStrip: $('historyStrip'),
    historyCount: $('historyCount'),
    undoBtn: $('undoBtn'),
    undoBtn2: $('undoBtn2'),
    lastColor: $('lastColor'),
    lastSector: $('lastSector'),
    lastStreak: $('lastStreak'),
    wcValue: $('wcValue'),
    wcSub: $('wcSub'),
    wcKicker: $('wcKicker'),
    wheelCenter: $('wheelCenter'),
  };

  /* ---------- pair buttons ---------- */
  els.pairGrid.innerHTML = PAIRS.map(({ c, s }, i) => `
    <button class="pair pair--${c}" type="button" data-c="${c}" data-s="${s}"
      aria-label="${COLOR_LABEL[c]}, ${s}-й сектор">
      <span class="pair-top">
        <span class="pair-name">${COLOR_LABEL[c]}</span>
        <span class="pair-key">${i + 1}</span>
      </span>
      <span class="pair-mid"><span class="pair-num">${s}</span></span>
      <span class="pair-bottom">
        <span class="pips">${[1, 2, 3].map((n) => `<i class="${n <= s ? 'on' : ''}"></i>`).join('')}</span>
        <span class="pair-label">${SECTOR_SHORT[s]}</span>
      </span>
    </button>`).join('');

  els.pairGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.pair');
    if (!btn) return;
    popChip(btn);
    onAdd({ c: btn.dataset.c, s: btn.dataset.s });
  });

  /* ---------- full roulette table ---------- */
  const table = els.table;
  const pieces = [];

  pieces.push(`<button class="rt-cell rt-zero" type="button" data-n="0" data-c="green" aria-label="Зеро">0</button>`);

  for (let i = 0; i < 36; i++) {
    const n = i + 1;
    const col = Math.floor(i / 3) + 2;
    const row = 3 - (i % 3);
    const c = colorOfNumber(n);
    pieces.push(
      `<button class="rt-cell" type="button" data-n="${n}" data-c="${c}" style="grid-column:${col};grid-row:${row}" aria-label="${n}, ${COLOR_LABEL[c]}, ${sectorOfNumber(n)}-й сектор">${n}</button>`
    );
  }

  for (let d = 0; d < 3; d++) {
    pieces.push(
      `<button class="rt-cell rt-dozen" type="button" data-s="${d + 1}"
        style="grid-column:${2 + d * 4} / span 4;grid-row:4"
        aria-label="Дюжина ${d + 1}">${d === 0 ? '1st' : d === 1 ? '2nd' : '3rd'} 12</button>`
    );
  }

  for (let r = 0; r < 3; r++) {
    pieces.push(
      `<div class="rt-cell rt-side" style="grid-column:14;grid-row:${r + 1}">2:1</div>`
    );
  }

  const outside = [
    { label: '1–18', span: 2, mute: true },
    { label: 'Чёт', span: 2, mute: true },
    { label: 'Красное', span: 2, c: 'red' },
    { label: 'Чёрное', span: 2, c: 'black' },
    { label: 'Нечёт', span: 2, mute: true },
    { label: '19–36', span: 2, mute: true },
  ];
  let col = 2;
  for (const item of outside) {
    const cls = ['rt-cell', 'rt-outside'];
    if (item.c) cls.push(`rt-outside--${item.c}`);
    if (item.mute) cls.push('rt-outside--mute');
    const data = item.c ? ` data-c="${item.c}"` : '';
    const tag = item.mute ? 'div' : 'button';
    const type = item.mute ? '' : ' type="button"';
    pieces.push(
      `<${tag} class="${cls.join(' ')}"${type}${data} style="grid-column:${col} / span ${item.span};grid-row:5">${item.label}</${tag}>`
    );
    col += item.span;
  }

  table.innerHTML = pieces.join('');

  table.addEventListener('click', (e) => {
    const cell = e.target.closest('button.rt-cell');
    if (!cell) return;
    flashCell(cell);
    if (cell.dataset.n != null) onAdd({ n: Number(cell.dataset.n) });
    else if (cell.dataset.s) onAdd({ s: cell.dataset.s });
    else if (cell.dataset.c) onAdd({ c: cell.dataset.c });
  });

  /* ---------- mobile dock ---------- */
  els.dockGrid.innerHTML = PAIRS.map(({ c, s }) => `
    <button class="dock-btn" type="button" data-c="${c}" data-s="${s}" aria-label="${COLOR_LABEL[c]}, ${s}-й сектор">
      <b>${s}</b><span>${c === 'red' ? 'кр' : 'чёр'}</span>
    </button>`).join('');

  els.dockGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.dock-btn');
    if (!btn) return;
    onAdd({ c: btn.dataset.c, s: btn.dataset.s });
  });

  /* ---------- render ---------- */
  let lastCount = -1;

  function setTab(tab) {
    const sectors = tab !== 'table';
    els.tabSectors.hidden = !sectors;
    els.tabTable.hidden = sectors;
    els.tabBtnSectors.setAttribute('aria-selected', String(sectors));
    els.tabBtnTable.setAttribute('aria-selected', String(!sectors));
  }

  function render(store) {
    const rounds = store.rounds;
    const colorSeq = store.colorSeq();
    const sectorSeq = store.sectorSeq();
    const numbers = store.numbers();

    const colorRes = analyzeSeries(colorSeq, COLORS);
    const sectorRes = analyzeSeries(sectorSeq, SECTORS);

    const fcColor = forecastSeries(colorRes, colorSeq, { label: (v) => COLOR_LABEL[v] });
    const fcSector = forecastSeries(sectorRes, sectorSeq, { label: (v) => (v === '1' ? '1-я' : v === '2' ? '2-я' : '3-я') });

    /* tabs + matrix toggle */
    setTab(store.state.tab);
    for (const btn of els.matrixToggle.querySelectorAll('button')) {
      btn.classList.toggle('is-active', btn.dataset.view === store.state.matrixView);
    }

    /* forecast */
    els.forecastBody.innerHTML = forecastMarkup(fcColor, fcSector, rounds.length);
    const q = qualityPill(fcColor, fcSector, rounds.length);
    els.fcQuality.textContent = q.text;
    els.fcQuality.dataset.tone = q.tone;

    /* cards */
    const recentColors = rounds.filter((r) => r.c).slice(-18).map((r) => r.c);
    const recentSectors = rounds
      .filter((r) => r.s || r.c === 'green')
      .slice(-18)
      .map((r) => r.s || '0');

    els.colorBody.innerHTML = colorCard(colorRes, recentColors);
    els.colorBadge.textContent = colorRes.n
      ? `${colorRes.n} ${plural(colorRes.n, ['спин', 'спина', 'спинов'])}`
      : '—';

    els.sectorBody.innerHTML = sectorCard(sectorRes, recentSectors);
    els.sectorBadge.textContent = sectorRes.n
      ? `${sectorRes.n} ${plural(sectorRes.n, ['спин', 'спина', 'спинов'])}`
      : '—';

    els.streakBody.innerHTML = streakCard(colorRes, sectorRes);
    const activeStreak = Math.max(
      colorRes.currentRun ? colorRes.currentRun.len : 0,
      sectorRes.currentRun ? sectorRes.currentRun.len : 0
    );
    els.streakBadge.textContent = activeStreak ? `× ${activeStreak}` : '—';

    els.transitionBody.innerHTML = transitionCard(
      store.state.matrixView === 'sector' ? sectorRes : colorRes,
      store.state.matrixView
    );

    const fair = fairnessCard(colorRes, sectorRes);
    els.fairBody.innerHTML = fair.html;
    els.fairBadge.textContent = fair.badge;
    els.fairBadge.dataset.tone = fair.tone;

    const last = rounds.length ? rounds[rounds.length - 1] : null;
    els.sampleBody.innerHTML = sampleCard(colorRes, sectorRes, rounds.length, numbers, last ? last.t : null);
    els.sampleBadge.textContent = String(rounds.length);

    /* readout */
    if (last) {
      els.lastColor.textContent = last.c ? COLOR_LABEL[last.c] : '—';
      els.lastColor.dataset.c = last.c || '';
      els.lastSector.textContent = last.s ? `${last.s}-я (${SECTOR_SHORT[last.s]})` : '—';
      els.wcKicker.textContent = 'последний';
      els.wcValue.textContent = last.n != null ? String(last.n) : last.c ? COLOR_SHORT[last.c] : last.s || '—';
      els.wcValue.dataset.c = last.c || '';
      const bits = [];
      if (last.c) bits.push(COLOR_LABEL[last.c]);
      if (last.s) bits.push(SECTOR_SHORT[last.s]);
      els.wcSub.textContent = bits.join(' · ') || 'раунд';
      els.wheelCenter.classList.add('is-hot');
    } else {
      els.lastColor.textContent = '—';
      els.lastColor.dataset.c = '';
      els.lastSector.textContent = '—';
      els.wcKicker.textContent = 'последний';
      els.wcValue.textContent = '—';
      els.wcValue.dataset.c = '';
      els.wcSub.textContent = 'ожидание';
      els.wheelCenter.classList.remove('is-hot');
    }

    const cs = colorRes.currentRun;
    const ss = sectorRes.currentRun;
    const streakBits = [];
    if (cs) streakBits.push(`${cs.len} × ${cs.v === 'red' ? 'К' : 'Ч'}`);
    if (ss) streakBits.push(`${ss.len} × ${ss.v}-я`);
    els.lastStreak.textContent = streakBits.join(' · ') || '—';

    /* history */
    els.historyCount.textContent = rounds.length
      ? `${rounds.length} ${plural(rounds.length, ['раунд', 'раунда', 'раундов'])}`
      : 'пусто';

    if (!rounds.length) {
      els.historyStrip.innerHTML = `<p class="empty-line" style="padding:10px 0">Пока пусто. Первый результат появится здесь — лента всегда под рукой.</p>`;
    } else {
      const slice = rounds.slice(-48);
      els.historyStrip.innerHTML = slice.map((r) => {
        const label = r.n != null ? String(r.n) : r.c ? COLOR_SHORT[r.c] : r.s || '?';
        const sub = r.s ? SECTOR_SHORT[r.s] : r.c === 'green' ? 'зеро' : '';
        const time = new Date(r.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const title = [
          r.n != null ? `число ${r.n}` : null,
          r.c ? COLOR_LABEL[r.c] : null,
          r.s ? `${r.s}-й сектор` : null,
        ].filter(Boolean).join(' · ');
        return `<div class="hchip" data-c="${r.c || ''}" data-s="${r.s || ''}" title="${title}">
          <span>${label}</span>
          <span class="hchip-sector" style="${r.s ? `color:${SECTOR_ACCENT[r.s]}` : ''}">${sub}</span>
          <span class="hchip-time">${time}</span>
        </div>`;
      }).join('');

      if (rounds.length !== lastCount) {
        requestAnimationFrame(() => {
          els.historyStrip.scrollLeft = els.historyStrip.scrollWidth;
        });
      }
    }
    lastCount = rounds.length;

    const has = rounds.length > 0;
    els.undoBtn.disabled = !has;
    els.undoBtn2.disabled = !has;

    return { colorRes, sectorRes, fcColor, fcSector };
  }

  function flashRound(input) {
    if (input.c && input.s) {
      const btn = els.pairGrid.querySelector(`.pair[data-c="${input.c}"][data-s="${input.s}"]`);
      popChip(btn);
      flashCell(btn);
      return;
    }
    if (input.n != null) {
      flashCell(table.querySelector(`.rt-cell[data-n="${input.n}"]`));
    } else if (input.s) {
      flashCell(table.querySelector(`.rt-cell[data-s="${input.s}"]`));
    }
  }

  return { render, flashRound, setTab };
}
