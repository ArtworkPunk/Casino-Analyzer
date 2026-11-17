/* =========================================================
   App wiring
   ========================================================= */

import { createStore } from './store.js';
import { initRenderer } from './render.js';
import { COLOR_LABEL, SECTOR_LABEL } from './analysis.js';

const $ = (id) => document.getElementById(id);

/* ---------- save indicator ---------- */

const saveEl = $('saveState');
function setSave(kind) {
  if (!saveEl) return;
  saveEl.classList.toggle('is-saving', kind === 'saving');
  saveEl.classList.toggle('is-error', kind === 'error');
  saveEl.textContent = '';
  const dot = document.createElement('i');
  saveEl.append(dot, kind === 'saving' ? 'сохранение' : kind === 'error' ? 'не сохранено' : 'локально');
}

/* ---------- snackbar ---------- */

const snackbar = $('snackbar');
const snackText = $('snackText');
const snackUndo = $('snackUndo');
let snackTimer = 0;

function hideSnack() {
  clearTimeout(snackTimer);
  snackbar.classList.remove('is-visible');
}

function showSnack(text, { undo = false, timeout = 3600 } = {}) {
  snackText.textContent = text;
  snackUndo.hidden = !undo;
  snackbar.classList.add('is-visible');
  clearTimeout(snackTimer);
  snackTimer = window.setTimeout(hideSnack, timeout);
}

snackUndo.addEventListener('click', () => {
  undo();
  hideSnack();
});

/* ---------- store ---------- */

const store = createStore(setSave);

const ui = initRenderer({
  onAdd(input) {
    addRound(input);
  },
});

store.subscribe(() => {
  ui.render(store);
  $('dockUndo').disabled = !store.count;
});

/* ---------- wheel ---------- */

let wheel = null;
let wheelTried = false;

async function initWheel() {
  if (wheelTried) return;
  wheelTried = true;
  const canvas = $('wheelCanvas');
  try {
    const mod = await import('./wheel.js');
    wheel = mod.createWheel(canvas);
  } catch (err) {
    console.warn('3D-колесо не загрузилось:', err);
    wheel = null;
  }
  if (!wheel) {
    canvas.hidden = true;
    const fb = $('wheelFallback');
    if (fb) fb.hidden = false;
    const pointer = $('wheelPointer');
    if (pointer) pointer.hidden = false;
    document.body.classList.add('no-3d');
  }
}

/* ---------- actions ---------- */

function addRound(input) {
  const round = store.add(input);
  if (!round) return;

  if (wheel) {
    if (round.n != null) wheel.spinTo(round.n);
    else wheel.pulse();
  }

  if (navigator.vibrate) {
    try { navigator.vibrate(8); } catch (err) { /* ignore */ }
  }
}

function undo() {
  const removed = store.undo();
  if (!removed) return;
  const bits = [];
  if (removed.n != null) bits.push(`число ${removed.n}`);
  if (removed.c) bits.push(COLOR_LABEL[removed.c]);
  if (removed.s) bits.push(SECTOR_LABEL[removed.s]);
  showSnack(`Убрано: ${bits.join(' · ')}`, { undo: false, timeout: 2200 });
}

/* ---------- keyboard ---------- */

const PAIR_KEYS = ['1', '2', '3', '4', '5', '6'];
const PAIR_MAP = [
  { c: 'red', s: '1' }, { c: 'red', s: '2' }, { c: 'red', s: '3' },
  { c: 'black', s: '1' }, { c: 'black', s: '2' }, { c: 'black', s: '3' },
];

document.addEventListener('keydown', (e) => {
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();

  if (key === '?' || key === 'h' || key === 'х') {
    e.preventDefault();
    $('helpDialog').showModal();
    return;
  }
  if (key === '0') {
    e.preventDefault();
    addRound({ n: 0 });
    ui.flashRound({ n: 0 });
    return;
  }
  if (key === 'r' || key === 'к') {
    e.preventDefault();
    addRound({ c: 'red' });
    return;
  }
  if (key === 'b' || key === 'и') {
    e.preventDefault();
    addRound({ c: 'black' });
    return;
  }

  const idx = PAIR_KEYS.indexOf(key);
  if (idx >= 0) {
    e.preventDefault();
    if (store.state.tab === 'table') {
      if (idx < 3) {
        addRound({ s: String(idx + 1) });
        ui.flashRound({ s: String(idx + 1) });
      }
      return;
    }
    addRound(PAIR_MAP[idx]);
    ui.flashRound(PAIR_MAP[idx]);
  }
});

/* ---------- tabs / matrix ---------- */

$('tabBtnSectors').addEventListener('click', () => store.setTab('sectors'));
$('tabBtnTable').addEventListener('click', () => store.setTab('table'));

$('matrixToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  store.setMatrixView(btn.dataset.view);
});

/* ---------- undo / reset ---------- */

$('undoBtn').addEventListener('click', undo);
$('undoBtn2').addEventListener('click', undo);
$('dockUndo').addEventListener('click', undo);
$('zeroBtn').addEventListener('click', () => addRound({ n: 0 }));

const resetDialog = $('resetDialog');
$('resetBtn').addEventListener('click', () => {
  $('resetCount').textContent = String(store.count);
  if (store.count) resetDialog.showModal();
});

resetDialog.addEventListener('close', () => {
  if (resetDialog.returnValue === 'confirm') {
    store.clear();
    showSnack('История очищена', { undo: false, timeout: 2200 });
  }
});

/* ---------- help ---------- */

$('helpBtn').addEventListener('click', () => $('helpDialog').showModal());

/* ---------- dock visibility ---------- */

const dock = $('dock');
const inputPanel = $('inputPanel');

function setDock(visible) {
  dock.classList.toggle('is-visible', visible);
  document.body.classList.toggle('dock-open', visible);
}

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) setDock(!entry.isIntersecting);
    },
    { threshold: 0.16 }
  );
  io.observe(inputPanel);
} else {
  setDock(false);
}

/* ---------- boot ---------- */

ui.render(store);
$('dockUndo').disabled = !store.count;
setSave('saved');
initWheel();
