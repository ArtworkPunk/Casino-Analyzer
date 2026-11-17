/* =========================================================
   Probability & streak analysis
   Pure functions. No DOM.
   ========================================================= */

export const COLORS = ['red', 'black'];
export const SECTORS = ['1', '2', '3'];

/* ---------- special functions ---------- */

/* Abramowitz & Stegun 7.1.26 — good to ~1e-7 */
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const ans =
    t * Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 +
          t * (0.37409196 +
            t * (0.09678418 +
              t * (-0.18628806 +
                t * (0.27886807 +
                  t * (-1.13520398 +
                    t * (1.48851587 +
                      t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2 - ans;
}

/* upper tail of chi-square for df = 1 and 2; Wilson–Hilferty otherwise */
export function chiSquareP(x, df) {
  if (!(x > 0)) return 1;
  if (df === 1) return erfc(Math.sqrt(x / 2));
  if (df === 2) return Math.exp(-x / 2);
  if (df <= 0) return 1;
  const z = Math.cbrt(x / df) - (1 - 2 / (9 * df));
  const denom = Math.sqrt(2 / (9 * df));
  return 0.5 * erfc((z / denom) / Math.SQRT2);
}

export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);

/* ---------- core ---------- */

/**
 * Analyze a categorical sequence.
 * @param {string[]} seq  values in order of appearance
 * @param {string[]} cats categories to track
 */
export function analyzeSeries(seq, cats) {
  const spins = seq.length;
  const counts = Object.fromEntries(cats.map((c) => [c, 0]));
  for (const v of seq) if (v in counts) counts[v]++;

  const n = cats.reduce((acc, c) => acc + counts[c], 0);

  const shares = {};
  const intervals = {};
  for (const c of cats) {
    shares[c] = n ? counts[c] / n : 0;
    intervals[c] = wilson(counts[c], n);
  }

  /* runs — a value outside cats (e.g. green zero) breaks the sequence */
  const rawRuns = [];
  for (const v of seq) {
    const last = rawRuns[rawRuns.length - 1];
    if (last && last.v === v) last.len++;
    else rawRuns.push({ v, len: 1 });
  }
  const runs = rawRuns.filter((r) => r.v in counts);
  const lastRaw = rawRuns[rawRuns.length - 1];
  const currentRun = lastRaw && lastRaw.v in counts ? { ...lastRaw } : null;
  let maxRun = null;
  for (const r of runs) if (!maxRun || r.len > maxRun.len) maxRun = { ...r };
  const avgRun = runs.length ? n / runs.length : 0;

  const runHist = {};
  for (const r of runs) runHist[r.len] = (runHist[r.len] || 0) + 1;

  /* "after k in a row" continuation (a zero counts as a break) */
  const continuity = [];
  for (let k = 1; k <= 6; k++) {
    let total = 0;
    let cont = 0;
    for (let i = k; i < spins; i++) {
      const head = seq[i - 1];
      if (!(head in counts)) continue;
      let same = true;
      for (let j = 1; j <= k; j++) {
        if (seq[i - j] !== head) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      total++;
      if (seq[i] === head) cont++;
    }
    continuity.push({ k, total, cont, p: total ? cont / total : null });
  }

  /* transitions */
  const t1 = {};
  for (let i = 1; i < spins; i++) {
    const a = seq[i - 1];
    const b = seq[i];
    if (!(a in counts) || !(b in counts)) continue;
    t1[a] = t1[a] || {};
    t1[a][b] = (t1[a][b] || 0) + 1;
  }
  const t2 = {};
  for (let i = 2; i < spins; i++) {
    const a = seq[i - 2];
    const b = seq[i - 1];
    const c = seq[i];
    if (!(a in counts) || !(b in counts) || !(c in counts)) continue;
    const key = a + '|' + b;
    t2[key] = t2[key] || {};
    t2[key][c] = (t2[key][c] || 0) + 1;
  }

  /* chi-square vs uniform over valid spins */
  let chi2 = 0;
  if (n > 0) {
    const expected = n / cats.length;
    for (const c of cats) chi2 += Math.pow(counts[c] - expected, 2) / expected;
  }
  const df = cats.length - 1;
  const p = n > 0 ? chiSquareP(chi2, df) : 1;

  return {
    n,
    spins,
    zeros: spins - n,
    cats,
    counts,
    shares,
    intervals,
    runs,
    currentRun,
    maxRun,
    avgRun,
    runHist,
    continuity,
    repeatRate: continuity[0].total ? continuity[0].cont / continuity[0].total : null,
    t1,
    t2,
    chi2,
    df,
    p,
    theoretical: 1 / cats.length,
    expectedCount: n / cats.length,
  };
}

/**
 * Next-value estimate.
 * Blends the historical base rate with order-1 / order-2 Markov transitions.
 * Small samples are shrunk towards the theoretical uniform distribution.
 */
export function forecastSeries(result, seq, opts = {}) {
  const cats = result.cats;
  const n = result.n;
  const label = opts.label || ((v) => String(v));
  const theoretical = 1 / cats.length;

  if (!n) {
    const probs = Object.fromEntries(cats.map((c) => [c, theoretical]));
    return {
      ok: false,
      cats,
      probs,
      top: null,
      topProb: theoretical,
      baseProb: theoretical,
      source: 'нет данных',
      samples: 0,
      n: 0,
      order: 0,
      weight: 0,
      significant: false,
      edge: 0,
      theoretical,
    };
  }

  /* Dirichlet(1) posterior mean → base rate */
  const base = {};
  for (const c of cats) base[c] = (result.counts[c] + 1) / (n + cats.length);

  let cond = null;
  let source = 'частота по истории';
  let samples = n;
  let order = 0;

  const spins = seq.length;
  const last = seq[spins - 1];
  const prev = seq[spins - 2];

  if (spins >= 3 && prev != null) {
    const key = prev + '|' + last;
    const row = result.t2[key];
    const total = sum(row);
    if (total >= 6) {
      const alpha = 2.5;
      cond = {};
      for (const c of cats) {
        cond[c] = ((row[c] || 0) + alpha * base[c]) / (total + alpha);
      }
      samples = total;
      order = 2;
      source = 'переход после «' + label(prev) + ' → ' + label(last) + '»';
    }
  }

  if (!cond && spins >= 2) {
    const row = result.t1[last];
    const total = sum(row);
    if (total >= 7) {
      const alpha = 3;
      cond = {};
      for (const c of cats) {
        cond[c] = ((row[c] || 0) + alpha * base[c]) / (total + alpha);
      }
      samples = total;
      order = 1;
      source = 'переход после «' + label(last) + '»';
    }
  }

  const weight = cond ? Math.min(0.7, samples / (samples + 24)) : 0;
  const probs = {};
  for (const c of cats) {
    probs[c] = cond ? (1 - weight) * base[c] + weight * cond[c] : base[c];
  }

  let top = cats[0];
  for (const c of cats) if (probs[c] > probs[top]) top = c;

  const edge = probs[top] - theoretical;
  const se = Math.sqrt((theoretical * (1 - theoretical)) / n);
  const significant = edge > 1.96 * se;

  return {
    ok: true,
    cats,
    probs,
    top,
    topProb: probs[top],
    baseProb: base[top],
    source,
    samples,
    n,
    order,
    weight,
    significant,
    edge,
    se,
    theoretical,
  };
}

/** Frequency of numbers 0..36 for rounds that carry a number. */
export function numberFrequency(numbers) {
  const counts = new Map();
  for (const num of numbers) {
    if (!Number.isInteger(num) || num < 0 || num > 36) continue;
    counts.set(num, (counts.get(num) || 0) + 1);
  }
  const total = numbers.length;
  const zero = counts.get(0) || 0;
  const top = [...counts.entries()]
    .filter(([num]) => num !== 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 6)
    .map(([num, count]) => ({ num, count }));
  return { counts, total, zero, top };
}

/* ---------- roulette helpers ---------- */

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function colorOfNumber(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
}

export function sectorOfNumber(num) {
  if (!Number.isInteger(num) || num < 1 || num > 36) return null;
  return String(Math.ceil(num / 12));
}

export const COLOR_LABEL = { red: 'Красное', black: 'Чёрное', green: 'Зеро' };
export const COLOR_SHORT = { red: 'К', black: 'Ч', green: '0' };
export const SECTOR_LABEL = { 1: '1-й сектор', 2: '2-й сектор', 3: '3-й сектор' };
export const SECTOR_SHORT = { 1: '1-12', 2: '13-24', 3: '25-36' };
export const SECTOR_ACCENT = { 1: 'var(--sec1)', 2: 'var(--sec2)', 3: 'var(--sec3)' };
