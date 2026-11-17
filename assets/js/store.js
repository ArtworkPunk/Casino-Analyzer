/* =========================================================
   Local state + persistence
   ========================================================= */

import { colorOfNumber, sectorOfNumber } from './analysis.js';

const KEY = 'robrun-analyzer-v2';
const MAX_ROUNDS = 4000;

const fresh = () => ({
  rounds: [],
  tab: 'sectors',
  matrixView: 'color',
});

function normalizeRound(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let n = Number.isInteger(raw.n) && raw.n >= 0 && raw.n <= 36 ? raw.n : null;
  let c = raw.c === 'red' || raw.c === 'black' || raw.c === 'green' ? raw.c : null;
  let s = raw.s === 1 || raw.s === 2 || raw.s === 3 ? String(raw.s) : raw.s === '1' || raw.s === '2' || raw.s === '3' ? raw.s : null;

  if (n != null) {
    c = colorOfNumber(n);
    s = n === 0 ? null : sectorOfNumber(n);
  }
  if (!n && c && c !== 'green' && !s) s = null;
  if (!n && s && !c) c = null;
  if (n == null && !c && !s) return null;

  const t = Number.isFinite(raw.t) ? raw.t : Date.now();
  const id = typeof raw.id === 'string' && raw.id ? raw.id : makeId();
  return { id, n, c, s, t };
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createStore(onStatus) {
  const state = fresh();
  const listeners = new Set();

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.rounds)) {
        state.rounds = parsed.rounds.map(normalizeRound).filter(Boolean).slice(-MAX_ROUNDS);
      }
      if (parsed.tab === 'table' || parsed.tab === 'sectors') state.tab = parsed.tab;
      if (parsed.matrixView === 'color' || parsed.matrixView === 'sector') state.matrixView = parsed.matrixView;
    }
  } catch (err) {
    console.warn('Не удалось прочитать сохранённые данные', err);
  }

  const status = (kind) => {
    if (typeof onStatus === 'function') onStatus(kind);
  };
  function persist() {
    status('saving');
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ rounds: state.rounds, tab: state.tab, matrixView: state.matrixView })
      );
      status('saved');
    } catch (err) {
      console.warn('Не удалось сохранить данные', err);
      status('error');
    }
  }

  function emit() {
    for (const fn of listeners) fn(state);
    persist();
  }

  const api = {
    state,

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    add(input) {
      const round = normalizeRound({ ...input, id: makeId(), t: Date.now() });
      if (!round) return null;
      state.rounds.push(round);
      if (state.rounds.length > MAX_ROUNDS) state.rounds.splice(0, state.rounds.length - MAX_ROUNDS);
      emit();
      return round;
    },

    undo() {
      const removed = state.rounds.pop();
      if (removed) emit();
      return removed || null;
    },

    clear() {
      if (!state.rounds.length) return;
      state.rounds = [];
      emit();
    },

    setTab(tab) {
      if (tab !== 'table' && tab !== 'sectors') return;
      if (state.tab === tab) return;
      state.tab = tab;
      emit();
    },

    setMatrixView(view) {
      if (view !== 'color' && view !== 'sector') return;
      if (state.matrixView === view) return;
      state.matrixView = view;
      emit();
    },

    get rounds() {
      return state.rounds;
    },

    get count() {
      return state.rounds.length;
    },

    last() {
      return state.rounds.length ? state.rounds[state.rounds.length - 1] : null;
    },

    colorSeq() {
      return state.rounds.filter((r) => r.c).map((r) => r.c);
    },

    sectorSeq() {
      return state.rounds
        .filter((r) => r.s || r.c === 'green')
        .map((r) => r.s || 'green');
    },

    numbers() {
      return state.rounds.filter((r) => Number.isInteger(r.n)).map((r) => r.n);
    },
  };

  return api;
}
