/* =========================================================
   HTML builders for forecast + stats
   ========================================================= */

const pct = (x, d = 1) =>
  `${(x * 100).toFixed(d).replace('.', ',')}%`;
const num = (x, d = 1) => x.toFixed(d).replace('.', ',');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const BAR = {
  red: 'linear-gradient(90deg,#ff6b76,#a5121f)',
  black: 'linear-gradient(90deg,#97a2ab,#141a1f)',
  1: 'linear-gradient(90deg,#f4dda4,#b98d33)',
  2: 'linear-gradient(90deg,#8ee9c6,#2f9a74)',
  3: 'linear-gradient(90deg,#b7c6ff,#5f74d6)',
};
const DOT = {
  red: '#e04352',
  black: '#97a2ab',
  1: '#e6c77e',
  2: '#5ecf9f',
  3: '#93aaff',
};
const COLOR_NAME = { red: 'Красное', black: 'Чёрное', green: 'Зеро' };
const SECTOR_NAME = { 1: '1-й сектор', 2: '2-й сектор', 3: '3-й сектор' };
const SECTOR_RANGE = { 1: '1–12', 2: '13–24', 3: '25–36' };

const nameFor = (cat) => COLOR_NAME[cat] || SECTOR_NAME[cat] || String(cat);
const dotFor = (cat) => DOT[cat] || '#e6c77e';
const barFor = (cat) => BAR[cat] || BAR[1];

/** Russian plural: plural(2, ['спин','спина','спинов']) → 'спина'. */
export function plural(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last > 1 && last < 5) return forms[1];
  return forms[2];
}

const spinWord = (n) => plural(n, ['спин', 'спина', 'спинов']);

/* Mini ribbon of the most recent values — a quick visual of the pattern. */
function miniStrip(items, kind) {
  if (!items.length) return '';
  const chips = items.map((v) => {
    if (kind === 'color') {
      const c = v === 'green' ? 'green' : v;
      return `<i class="ms-chip" data-c="${c}" title="${COLOR_NAME[c] || c}"></i>`;
    }
    return v === '0'
      ? `<i class="ms-chip ms-chip--zero" title="Зеро"></i>`
      : `<i class="ms-chip" data-s="${v}" title="${SECTOR_NAME[v]}"></i>`;
  }).join('');
  return `
    <div class="mini-strip">
      <div class="mini-strip-head">
        <span>последние ${items.length}</span>
        <span>старое → новое</span>
      </div>
      <div class="mini-strip-chips" style="--n:${items.length}">${chips}</div>
    </div>`;
}

/* ---------------- forecast ---------------- */

function forecastBlock(title, res) {
  const cats = res.cats;
  const rows = cats.map((cat) => {
    const p = res.probs[cat] || 0;
    const isTop = res.ok && cat === res.top;
    return `
      <div class="fc-bar ${isTop ? 'is-top' : ''}">
        <span class="fc-bar-name ${isTop ? 'is-top' : ''}">${nameFor(cat)}</span>
        <span class="fc-bar-track">
          <span class="fc-bar-fill" style="width:${clamp(p * 100, 0, 100)}%;background:${barFor(cat)}"></span>
          <span class="fc-mark" style="left:${(100 / cats.length).toFixed(2)}%"></span>
        </span>
        <span class="fc-bar-val">${pct(p)}</span>
      </div>`;
  }).join('');

  const source = res.ok ? res.source : '—';
  let note = 'каждый исход независим — оценка не гарантирует результат';
  if (res.ok) {
    const band = res.se ? pct(1.96 * res.se, 1) : '';
    if (res.n < 10) note = 'мало данных — оценка держится близко к теории';
    else if (res.significant) note = `отклонение больше случайного шума (±${band}), но это не гарантия`;
    else note = `в пределах случайного шума (±${band})`;
  }

  return `
    <div class="fc-block">
      <div class="fc-head">
        <span class="fc-title">${title}</span>
        <span class="fc-source" title="${source}">${res.ok ? 'на основе: ' + source : 'нет данных'}</span>
      </div>
      <div class="fc-main">
        <span class="fc-value">
          ${res.ok ? `<i class="fc-dot" style="background:${dotFor(res.top)};color:${dotFor(res.top)}"></i>${nameFor(res.top)}` : '<span style="color:var(--faint)">—</span>'}
        </span>
        <span class="fc-pct">${res.ok ? pct(res.topProb) : '—'}</span>
        <span class="fc-theory">теория<br><b>${pct(res.theoretical, 1)}</b></span>
      </div>
      <div class="fc-bars">${rows}</div>
      <p class="m-note" style="margin-top:9px">${note}${res.ok && res.n ? ` · ${res.n} ${spinWord(res.n)}` : ''}</p>
    </div>`;
}

export function forecastMarkup(fcColor, fcSector, total) {
  if (!total) {
    return `
      <div class="fc-empty">
        <div class="fc-empty-mark">?</div>
        <p>Добавьте первый результат на столе — здесь появятся частоты, серии и оценка следующего исхода.</p>
      </div>`;
  }
  return forecastBlock('Цвет', fcColor) + forecastBlock('Дюжина', fcSector);
}

export function qualityPill(fcColor, fcSector, total) {
  if (!total) return { text: 'нет данных', tone: '' };
  if (total < 10) return { text: `${total} · мало данных`, tone: 'warn' };
  const anySignal = fcColor.significant || fcSector.significant;
  return { text: anySignal ? `${total} · есть отклонение` : `${total} · в пределах шума`, tone: anySignal ? 'warn' : '' };
}

/* ---------------- cards ---------------- */

export function colorCard(res, recent = []) {
  if (!res.n) return `<p class="empty-line">Пока нет данных по цвету. Зеро не относится ни к красному, ни к чёрному.</p>`;
  const rows = ['red', 'black'].map((c) => {
    const p = res.shares[c];
    const k = res.counts[c];
    const [lo, hi] = res.intervals[c];
    return `
      <div class="freq-row">
        <div class="freq-top">
          <span class="freq-name"><i style="background:${DOT[c]};box-shadow:0 0 9px ${DOT[c]}66"></i>${COLOR_NAME[c]}</span>
          <span class="freq-val"><b>${pct(p)}</b> · ${k}</span>
        </div>
        <div class="freq-track">
          <div class="freq-fill" style="width:${clamp(p * 100, 0, 100)}%;background:${BAR[c]}"></div>
          <div class="freq-expect" style="left:50%"></div>
        </div>
        <div class="freq-sub">95% интервал: ${pct(lo, 0)}–${pct(hi, 0)} · ожидание 50%</div>
      </div>`;
  }).join('');
  const run = res.currentRun;
  const runText = run ? `${run.len} × ${run.v === 'red' ? 'К' : 'Ч'}` : '—';
  const maxText = res.maxRun ? `${res.maxRun.len} × ${res.maxRun.v === 'red' ? 'К' : 'Ч'}` : '—';
  return `<div class="freq">${rows}</div>
    <div class="mini-grid">
      <div class="mini-cell"><span>серия сейчас</span><b>${runText}</b></div>
      <div class="mini-cell"><span>макс. серия</span><b>${maxText}</b></div>
      <div class="mini-cell"><span>серий</span><b>${res.runs.length}</b></div>
    </div>
    <p class="m-note">Красное + чёрное = ${res.n} ${spinWord(res.n)}.${res.zeros ? ` Зеро вне цвета: ${res.zeros}.` : ''} Отклонение от 50% почти всегда объясняется объёмом выборки.</p>
    ${miniStrip(recent, 'color')}`;
}

export function sectorCard(res, recent = []) {
  if (!res.n) return `<p class="empty-line">Пока нет данных по дюжинам. Кнопки 1–3 или стол 0–36 заполнят этот блок.</p>`;
  const rows = ['1', '2', '3'].map((s) => {
    const p = res.shares[s];
    const k = res.counts[s];
    const [lo, hi] = res.intervals[s];
    return `
      <div class="freq-row">
        <div class="freq-top">
          <span class="freq-name"><i style="background:${DOT[s]};box-shadow:0 0 9px ${DOT[s]}66"></i>${SECTOR_NAME[s]} <span style="color:var(--faint);font-size:10px">${SECTOR_RANGE[s]}</span></span>
          <span class="freq-val"><b>${pct(p)}</b> · ${k}</span>
        </div>
        <div class="freq-track">
          <div class="freq-fill" style="width:${clamp(p * 100, 0, 100)}%;background:${BAR[s]}"></div>
          <div class="freq-expect" style="left:33.333%"></div>
          <div class="freq-expect" style="left:66.666%"></div>
        </div>
        <div class="freq-sub">95% интервал: ${pct(lo, 0)}–${pct(hi, 0)} · ожидание 33,3%</div>
      </div>`;
  }).join('');
  const run = res.currentRun;
  const runText = run ? `${run.len} × ${run.v}-я` : '—';
  const maxText = res.maxRun ? `${res.maxRun.len} × ${res.maxRun.v}-я` : '—';
  return `<div class="freq">${rows}</div>
    <div class="mini-grid">
      <div class="mini-cell"><span>серия сейчас</span><b>${runText}</b></div>
      <div class="mini-cell"><span>макс. серия</span><b>${maxText}</b></div>
      <div class="mini-cell"><span>серий</span><b>${res.runs.length}</b></div>
    </div>
    <p class="m-note">${res.n} ${spinWord(res.n)} с известной дюжиной.${res.zeros ? ` Зеро разрывает серию: ${res.zeros}.` : ''}${res.n < 30 ? ' Для трёх исходов нужно больше данных, чем кажется.' : ''}</p>
    ${miniStrip(recent, 'sector')}`;
}

export function streakCard(colorRes, sectorRes) {
  const candidates = [];
  if (colorRes.currentRun) {
    candidates.push({
      len: colorRes.currentRun.len,
      label: colorRes.currentRun.v === 'red' ? 'подряд красное' : 'подряд чёрное',
      dim: 'цвет',
    });
  }
  if (sectorRes.currentRun) {
    candidates.push({
      len: sectorRes.currentRun.len,
      label: `подряд ${SECTOR_NAME[sectorRes.currentRun.v]}`,
      dim: 'дюжина',
    });
  }
  candidates.sort((a, b) => b.len - a.len);
  const top = candidates[0];

  const activeRes = top && top.dim === 'дюжина' ? sectorRes : colorRes;
  const activeIsSector = top && top.dim === 'дюжина';
  const shortRun = (v) => (activeIsSector ? `${v}-я` : v === 'red' ? 'К' : 'Ч');
  const maxText = activeRes.n && activeRes.maxRun
    ? `${activeRes.maxRun.len} × ${shortRun(activeRes.maxRun.v)}`
    : '—';
  const avgText = activeRes.n ? num(activeRes.avgRun, 2) : '—';

  const hero = top
    ? `<div class="streak-hero">
        <span class="streak-count">${top.len}</span>
        <div class="streak-copy"><strong>${top.label}</strong><span>макс. ${maxText} · средняя ${avgText}</span></div>
      </div>`
    : `<div class="streak-hero">
        <span class="streak-count" style="color:var(--faint)">—</span>
        <div class="streak-copy"><strong>нет активной серии</strong><span>добавьте результаты</span></div>
      </div>`;

  const rows = [2, 3, 4, 5, 6].map((k) => {
    const item = colorRes.continuity[k - 1];
    if (!item || !item.total) {
      return `<tr><td>после ${k} подряд</td><td class="mono">—</td><td class="mono">0</td></tr>`;
    }
    const active = colorRes.currentRun && colorRes.currentRun.len >= k;
    return `<tr class="${active ? 'is-active' : ''}">
      <td>после ${k} подряд</td>
      <td class="mono">${pct(item.p, 0)}</td>
      <td class="mono">${item.total}<small>n</small></td>
    </tr>`;
  }).join('');

  return `${hero}
    <table class="cont-table">
      <thead><tr><th>цвет</th><th>продолжение</th><th>случаев</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="m-note">«После 3 подряд» — как часто серия шла дальше в вашей истории. В честной игре это около 50%.</p>`;
}

export function transitionCard(res, view) {
  if (!res.n) return `<p class="empty-line">Нужны хотя бы два результата, чтобы построить переходы.</p>`;
  const cats = res.cats;
  const cols = cats.length === 2 ? 'matrix--2' : 'matrix--3';

  const head = cats.map((c) => `<div class="m-head">${c === 'red' ? 'красн' : c === 'black' ? 'чёрн' : `${c}-я`}</div>`).join('');

  const body = cats.map((a) => {
    const row = res.t1[a] || {};
    const total = Object.values(row).reduce((x, y) => x + y, 0);
    const cells = cats.map((b) => {
      if (!total) return `<div class="m-cell is-zero">—<small>0</small></div>`;
      const p = (row[b] || 0) / total;
      return `<div class="m-cell" style="--a:${(p * 0.92).toFixed(2)}">${pct(p, 0)}<small>${row[b] || 0}</small></div>`;
    }).join('');
    return `<div class="m-row">${a === 'red' ? 'К' : a === 'black' ? 'Ч' : a}</div>${cells}`;
  }).join('');

  const label = view === 'color' ? 'цвет' : 'дюжина';
  return `<div class="matrix ${cols}">
      <div class="m-corner">было ↓<br>стало →</div>${head}
      ${body}
    </div>
    <p class="m-note">Строка — что выпало, столбец — что выпало следующим. Это частота переходов по ${res.n} наблюдениям, а не прогноз.</p>`;
}

export function fairnessCard(colorRes, sectorRes) {
  const useColor = colorRes.n >= 8;
  const res = useColor ? colorRes : sectorRes;
  const what = useColor ? 'цвет' : 'дюжина';

  if (res.n < 8) {
    return {
      badge: '—',
      tone: '',
      html: `<p class="empty-line">Для проверки на отклонение нужно минимум 8 наблюдений (сейчас ${res.n}).</p>`,
    };
  }

  const p = res.p;
  const significant = p < 0.05;
  const pText = p < 0.001 ? '< 0,001' : num(p, 3);
  const verdict = significant
    ? 'Формально отклонение от равных долей заметно. На короткой выборке это бывает случайностью — проверьте ещё на 30–50 спинах.'
    : 'Распределение выглядит как случайный разброс: нет оснований считать, что какой-то исход систематически чаще.';

  return {
    badge: significant ? 'внимание' : 'в норме',
    tone: significant ? 'warn' : '',
    html: `
      <div class="fair-hero">
        <span class="fair-p">${pText}</span>
        <span class="fair-label">p-value · ${what}</span>
      </div>
      <div class="fair-meter" style="--mark:${clamp(p, 0, 1)}"></div>
      <div class="fair-scale"><span>0</span><span>0,05 — порог</span><span>1</span></div>
      <p class="fair-verdict">${verdict}</p>
      <div class="fair-stats">
        <span>χ² <b>${num(res.chi2, 2)}</b></span>
        <span>df <b>${res.df}</b></span>
        <span>n <b>${res.n}</b></span>
      </div>
      <p class="m-note">p-value — шанс увидеть такое отклонение при идеально равных шансах. Это не доказательство «подкрутки».</p>`,
  };
}

export function sampleCard(colorRes, sectorRes, rounds, numbers, updated) {
  const numberStats = (() => {
    const counts = new Map();
    for (const n of numbers) counts.set(n, (counts.get(n) || 0) + 1);
    return counts;
  })();
  const zero = numberStats.get(0) || 0;
  const top = [...numberStats.entries()]
    .filter(([n]) => n !== 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 6);

  const hot = top.length
    ? `<div class="hot-list">${top.map(([n, k]) => {
        const c = n === 0 ? 'green' : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? 'red' : 'black';
        return `<span class="hot-chip"><i style="background:${DOT[c]}"></i>${n}<small>×${k}</small></span>`;
      }).join('')}</div>`
    : `<p class="m-note" style="margin-top:0">Числа ещё не вводились — используйте вкладку «Числа 0–36».</p>`;

  const lastTime = updated
    ? new Date(updated).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return `
    <div class="sample-rows">
      <div class="sample-row"><span>раундов в ленте</span><b>${rounds}</b></div>
      <div class="sample-row"><span>спинов с цветом</span><b>${colorRes.n}</b></div>
      <div class="sample-row"><span>спинов с дюжиной</span><b>${sectorRes.n}</b></div>
      <div class="sample-row"><span>введённых чисел</span><b>${numbers.length}</b></div>
      <div class="sample-row"><span>зеро</span><b>${zero}</b></div>
    </div>
    <div class="sample-bar" style="margin:12px 0 10px"></div>
    <div class="freq-sub" style="margin-bottom:6px">чаще всего выпадали</div>
    ${hot}
    <p class="m-note">обновлено ${lastTime} · хранится только в этом браузере</p>`;
}
