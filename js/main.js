import { ALL, ALGORITHMS } from './algorithms.js';
import { instrument, InstrumentError } from './instrument.js';
import { randomSet, newSeed, parseValues } from './datasets.js';
import { BarRenderer } from './renderer.js';

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const WATCHDOG_MS = 3000;
const STORAGE_KEY = 'sortsight.code.v1';

// ---------- state ----------
const state = {
  algo: ALL[0],
  size: 100,
  dataset: null, // { kind, label, description, values, seed?, forAlgo? }
  edits: loadEdits(),
};

const renderer = new BarRenderer($('bars'));

// ---------- editor ----------
const editor = window.CodeMirror.fromTextArea($('codeEditor'), {
  mode: 'javascript',
  lineNumbers: true,
  indentUnit: 2,
  tabSize: 2,
  matchBrackets: true,
  autoCloseBrackets: true,
  viewportMargin: Infinity,
  extraKeys: { Tab: (cm) => cm.execCommand('insertSoftTab') },
});
let settingCode = false;
let activeLine = null;
let errorLine = null;

function setActiveLine(line) {
  if (activeLine !== null) editor.removeLineClass(activeLine, 'background', 'cm-step-line');
  activeLine = null;
  if (line > 0 && line <= editor.lineCount()) {
    activeLine = line - 1;
    editor.addLineClass(activeLine, 'background', 'cm-step-line');
  }
}

function setErrorLine(line) {
  if (errorLine !== null) editor.removeLineClass(errorLine, 'background', 'cm-error-line');
  errorLine = null;
  if (line > 0 && line <= editor.lineCount()) {
    errorLine = line - 1;
    editor.addLineClass(errorLine, 'background', 'cm-error-line');
    editor.scrollIntoView({ line: errorLine, ch: 0 }, 60);
  }
}

function codeStatus(text, kind = '') {
  const el = $('codeStatus');
  el.textContent = text;
  el.className = `code-status ${kind}`;
}

editor.on('change', () => {
  if (settingCode) return;
  const code = editor.getValue();
  if (code === state.algo.code) delete state.edits[state.algo.id];
  else state.edits[state.algo.id] = code;
  saveEdits();
  updateEditedBadge();
  setErrorLine(0);
  if (player.loaded || player.worker) {
    player.reset();
    codeStatus('Code changed, so the run was reset. Press Play to run your version.');
  }
});

function loadEdits() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveEdits() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.edits)); } catch { /* storage unavailable */ }
}
function currentCode() {
  return state.edits[state.algo.id] ?? state.algo.code;
}
function isEdited() {
  return state.edits[state.algo.id] !== undefined;
}
function updateEditedBadge() {
  $('editedBadge').hidden = !isEdited() || state.algo.id === 'custom';
  $('resetCodeBtn').disabled = !isEdited();
}

// ---------- worker-backed player ----------
class Player {
  constructor() {
    this.worker = null;
    this.loaded = false;
    this.playing = false;
    this.inFlight = false;
    this.done = false;
    this.budget = 0;
    this.lastFrame = 0;
    this.elapsed = 0;
    this.stats = { steps: 0, reads: 0, writes: 0 };
    this.watchdog = 0;
    this.reqId = 0;
    this.pendingSingleStep = false;
    requestAnimationFrame((t) => this.frame(t));
  }

  spawn() {
    this.kill();
    let code;
    try {
      code = instrument(currentCode());
    } catch (err) {
      const line = err instanceof InstrumentError ? err.line : 0;
      this.fail(`Syntax error${line ? ` on line ${line}` : ''}: ${err.message.replace(/\s*\(\d+:\d+\)$/, '')}`, line);
      return false;
    }
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.onMessage(e.data);
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.fail(`Worker error: ${e.message || 'unknown error'}`, 0);
    };
    this.arm();
    this.worker.postMessage({ type: 'load', code, values: state.dataset.values });
    setErrorLine(0);
    return true;
  }

  arm() {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      this.fail('Your code ran for 3 seconds without reaching a line it could pause on (an infinite loop inside a callback or a built-in call?), so it was stopped.', 0);
    }, WATCHDOG_MS);
  }

  kill() {
    clearTimeout(this.watchdog);
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.loaded = false;
    this.inFlight = false;
  }

  fail(message, line) {
    this.kill();
    this.playing = false;
    this.done = true;
    codeStatus(message, 'error');
    setErrorLine(line);
    setActiveLine(0);
    setStatus('Error', 'error');
    renderer.state = 'idle';
    renderer.draw();
    updatePlayButton();
  }

  onMessage(msg) {
    clearTimeout(this.watchdog);
    if (msg.type === 'loaded') {
      this.loaded = true;
      this.inFlight = false;
      if (this.pendingSingleStep) this.request(1, Infinity);
      return;
    }
    if (msg.type === 'error') {
      this.fail(`Runtime error${msg.line ? ` on line ${msg.line}` : ''}: ${msg.message}`, msg.line);
      return;
    }
    if (msg.type === 'progress') {
      this.inFlight = false;
      this.pendingSingleStep = false;
      this.stats = { steps: msg.steps, reads: msg.reads, writes: msg.writes };
      if (msg.values) renderer.setValues(msg.values);
      renderer.highlights = msg.highlights;
      setActiveLine(msg.done ? 0 : msg.line);
      if (msg.line && !msg.done && this.playing && rateFromSlider() < 30) {
        editor.scrollIntoView({ line: msg.line - 1, ch: 0 }, 40);
      }
      if (msg.done) this.finish(msg.sorted);
      else renderer.state = this.playing ? 'running' : 'paused';
      renderer.draw();
      updateStats();
    }
  }

  finish(sorted) {
    this.done = true;
    this.playing = false;
    renderer.state = sorted ? 'done' : 'unsorted';
    setStatus(sorted ? 'Sorted ✓' : 'Finished, not sorted', sorted ? 'ok' : 'error');
    codeStatus(sorted ? 'Finished. The run was added to the comparison table.' : 'sort() returned but the array is not in ascending order.', sorted ? 'ok' : 'error');
    this.kill();
    addResult({
      algo: algoLabel(),
      dataset: state.dataset,
      steps: this.stats.steps,
      reads: this.stats.reads,
      writes: this.stats.writes,
      time: this.elapsed,
      sorted,
    });
    updatePlayButton();
  }

  request(steps, budgetMs) {
    if (!this.worker || !this.loaded || this.inFlight) return;
    this.inFlight = true;
    this.arm();
    this.worker.postMessage({ type: 'step', id: ++this.reqId, steps, budgetMs });
  }

  play() {
    if (this.done) this.reset();
    if (!this.worker && !this.spawn()) return;
    this.playing = true;
    this.budget = 0;
    this.lastFrame = performance.now();
    setStatus('Running');
    codeStatus(`Running ${algoLabel()}…`);
    renderer.state = 'running';
    updatePlayButton();
  }

  pause() {
    this.playing = false;
    if (!this.done) {
      setStatus('Paused');
      renderer.state = 'paused';
      renderer.draw();
    }
    updatePlayButton();
  }

  step() {
    if (this.playing) this.pause();
    if (this.done) this.reset();
    if (!this.worker) {
      if (!this.spawn()) return;
      this.pendingSingleStep = true;
      setStatus('Paused');
      return;
    }
    setStatus('Paused');
    this.request(1, Infinity);
  }

  reset() {
    this.kill();
    this.playing = false;
    this.done = false;
    this.elapsed = 0;
    this.pendingSingleStep = false;
    this.stats = { steps: 0, reads: 0, writes: 0 };
    renderer.setValues(state.dataset.values);
    renderer.highlights = [];
    renderer.state = 'idle';
    renderer.draw();
    setActiveLine(0);
    setStatus('Ready');
    updateStats();
    updatePlayButton();
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.playing) { this.lastFrame = now; return; }
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.elapsed += dt;
    updateTime();
    if (!this.loaded || this.inFlight) return;
    const rate = rateFromSlider();
    if (rate === Infinity) {
      this.request(1e9, 12);
      return;
    }
    this.budget = Math.min(this.budget + rate * dt, rate * 0.25 + 1);
    const steps = Math.floor(this.budget);
    if (steps >= 1) {
      this.budget -= steps;
      this.request(steps, 12);
    }
  }
}

const player = new Player();

// ---------- speed ----------
function rateFromSlider() {
  const v = +$('speed').value;
  if (v >= 100) return Infinity;
  return Math.round(10 ** ((v / 99) * 6)); // 1 .. 1,000,000 steps per second
}
function updateSpeedLabel() {
  const r = rateFromSlider();
  let text;
  if (r === Infinity) text = 'Max speed';
  else if (r >= 1e6) text = `${(r / 1e6).toFixed(1)}M steps/s`;
  else if (r >= 1e3) text = `${(r / 1e3).toFixed(r >= 1e4 ? 0 : 1)}k steps/s`;
  else text = `${r} step${r === 1 ? '' : 's'}/s`;
  $('speedLabel').textContent = text;
}
$('speed').addEventListener('input', updateSpeedLabel);

// ---------- ui helpers ----------
function algoLabel() {
  return state.algo.id !== 'custom' && isEdited() ? `${state.algo.name} (edited)` : state.algo.name;
}
function setStatus(text, kind = '') {
  const el = $('statStatus');
  el.textContent = text;
  el.className = kind;
}
function updateStats() {
  $('statSteps').textContent = fmt.format(player.stats.steps);
  $('statReads').textContent = fmt.format(player.stats.reads);
  $('statWrites').textContent = fmt.format(player.stats.writes);
  updateTime();
}
function formatTime(s) {
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
}
function updateTime() {
  $('statTime').textContent = formatTime(player.elapsed);
}
function updatePlayButton() {
  const btn = $('playBtn');
  btn.classList.toggle('playing', player.playing);
  $('playLabel').textContent = player.playing ? 'Pause' : 'Play';
  btn.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
}

// ---------- algorithms ----------
function buildTabs() {
  const nav = $('algoTabs');
  for (const algo of ALL) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = algo.name;
    b.dataset.id = algo.id;
    if (algo.id === 'custom') b.classList.add('custom');
    b.addEventListener('click', () => selectAlgo(algo.id));
    nav.appendChild(b);
  }
}

function selectAlgo(id) {
  state.algo = ALL.find((a) => a.id === id) || ALL[0];
  for (const b of $('algoTabs').children) b.setAttribute('aria-current', b.dataset.id === state.algo.id ? 'true' : 'false');
  settingCode = true;
  activeLine = null;
  errorLine = null;
  editor.setValue(currentCode());
  editor.clearHistory();
  settingCode = false;
  updateEditedBadge();
  $('codeAlgoName').textContent = state.algo.name;
  const cx = state.algo.complexity;
  $('cxBest').textContent = cx.best;
  $('cxAvg').textContent = cx.average;
  $('cxWorst').textContent = cx.worst;
  $('cxSpace').textContent = cx.space;
  $('cxStable').textContent = cx.stable === null ? '?' : cx.stable ? 'Yes' : 'No';
  $('algoBlurb').textContent = state.algo.blurb;
  $('worstDesc').textContent = state.algo.worstDescription;
  $('worstBtn').textContent = `Worst case for ${state.algo.id === 'custom' ? 'your sort' : state.algo.name}`;
  codeStatus(state.algo.id === 'custom'
    ? 'Write any sort(arr) you like and press Play. It runs in a sandboxed Web Worker.'
    : 'Edit the code and press Play to run your version. It runs in a sandboxed Web Worker.');
  try { history.replaceState(null, '', `#${state.algo.id}`); } catch { /* ignore */ }
  player.reset();
}

$('resetCodeBtn').addEventListener('click', () => {
  delete state.edits[state.algo.id];
  saveEdits();
  selectAlgo(state.algo.id);
});

// ---------- data sets ----------
function setDataset(ds) {
  state.dataset = ds;
  $('datasetPill').textContent = `${ds.label} · ${fmt.format(ds.values.length)} items`;
  $('datasetMeta').textContent = `${fmt.format(ds.values.length)} items`;
  $('datasetDesc').textContent = ds.description;
  $('datasetValues').value = ds.values.join(', ');
  $('datasetMsg').textContent = '';
  player.reset();
}

function newRandom() {
  const { values, seed } = randomSet(state.size, newSeed());
  setDataset({
    kind: 'random',
    label: `Random #${seed.toString(16).toUpperCase().padStart(6, '0')}`,
    description: 'A shuffled permutation of 1 to n. It stays in this exact order when you switch algorithms, so every sort gets the same input.',
    values,
  });
}

function worstCase() {
  const algo = state.algo;
  setDataset({
    kind: 'worst',
    label: `Worst case: ${algo.id === 'custom' ? 'your sort' : algo.name}`,
    description: algo.worstDescription,
    values: algo.worstCase(state.size),
  });
}

for (const b of $('sizeGroup').querySelectorAll('button')) {
  b.addEventListener('click', () => {
    state.size = +b.dataset.size;
    for (const o of $('sizeGroup').querySelectorAll('button')) o.setAttribute('aria-checked', o === b ? 'true' : 'false');
    if (state.dataset && state.dataset.kind === 'worst') worstCase();
    else newRandom();
  });
}
$('randomBtn').addEventListener('click', newRandom);
$('worstBtn').addEventListener('click', worstCase);

$('applyValuesBtn').addEventListener('click', () => {
  try {
    const values = parseValues($('datasetValues').value);
    setDataset({
      kind: 'custom',
      label: 'Your values',
      description: 'Values you entered. Like every set, they replay in the same order for each algorithm.',
      values,
    });
    $('datasetMsg').textContent = `Loaded ${fmt.format(values.length)} values.`;
  } catch (err) {
    $('datasetMsg').textContent = err.message;
  }
});
$('copyValuesBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.dataset.values.join(', '));
    $('datasetMsg').textContent = 'Copied.';
  } catch {
    $('datasetValues').select();
    $('datasetMsg').textContent = 'Select-all done; press Ctrl/Cmd+C to copy.';
  }
});

// ---------- playback buttons ----------
$('playBtn').addEventListener('click', () => (player.playing ? player.pause() : player.play()));
$('stepBtn').addEventListener('click', () => player.step());
$('resetBtn').addEventListener('click', () => {
  player.reset();
  codeStatus('Reset to the original order.');
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('.CodeMirror, textarea, input')) return;
  if (e.code === 'Space') { e.preventDefault(); $('playBtn').click(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); player.step(); }
});

// ---------- comparison ----------
const results = [];
function addResult(r) {
  results.unshift(r);
  renderResults();
}
function renderResults() {
  const body = $('resultsBody');
  body.textContent = '';
  if (!results.length) {
    const tr = document.createElement('tr');
    tr.className = 'empty';
    tr.innerHTML = '<td colspan="8">No runs yet. Press Play, or run every sort on this set.</td>';
    body.appendChild(tr);
    return;
  }
  // Highlight the fewest steps among runs on the same data set.
  const best = new Map();
  for (const r of results) {
    if (!r.sorted) continue;
    const k = r.dataset;
    if (!best.has(k) || r.steps < best.get(k)) best.set(k, r.steps);
  }
  for (const r of results) {
    const tr = document.createElement('tr');
    const cells = [
      r.algo,
      r.dataset.label,
      fmt.format(r.dataset.values.length),
      fmt.format(r.steps),
      fmt.format(r.reads),
      fmt.format(r.writes),
      r.time === null ? '—' : formatTime(r.time),
      r.sorted ? 'Sorted' : 'Not sorted',
    ];
    cells.forEach((c, i) => {
      const td = document.createElement('td');
      td.textContent = c;
      if (i >= 2 && i <= 6) td.className = 'num';
      if (i === 7) td.className = r.sorted ? 'ok' : 'error';
      tr.appendChild(td);
    });
    if (r.sorted && best.get(r.dataset) === r.steps) tr.classList.add('best');
    if (r.dataset === state.dataset) tr.classList.add('current');
    body.appendChild(tr);
  }
}
$('clearResultsBtn').addEventListener('click', () => {
  results.length = 0;
  renderResults();
});

let compareWorker = null;
async function compareAll() {
  const btn = $('compareAllBtn');
  if (compareWorker) {
    compareWorker.terminate();
    compareWorker = null;
    btn.textContent = 'Run every sort on this set';
    $('datasetMsg').textContent = 'Comparison cancelled.';
    return;
  }
  const ds = state.dataset;
  btn.textContent = 'Cancel comparison';
  for (const algo of ALGORITHMS) {
    const code = state.edits[algo.id] ?? algo.code;
    const label = state.edits[algo.id] !== undefined ? `${algo.name} (edited)` : algo.name;
    btn.textContent = `Cancel (running ${algo.name}…)`;
    let r;
    try {
      r = await runHeadless(instrument(code), ds.values);
    } catch (err) {
      if (err.message === 'cancelled') return;
      r = { steps: 0, reads: 0, writes: 0, sorted: false, error: err.message };
    }
    if (!compareWorker) return;
    addResult({ algo: label, dataset: ds, steps: r.steps, reads: r.reads, writes: r.writes, time: null, sorted: r.sorted });
  }
  compareWorker.terminate();
  compareWorker = null;
  btn.textContent = 'Run every sort on this set';
}

function runHeadless(code, values) {
  return new Promise((resolve, reject) => {
    if (compareWorker) compareWorker.terminate();
    const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    compareWorker = w;
    let timer = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { w.terminate(); reject(new Error('timed out')); }, WATCHDOG_MS);
    };
    w.onmessage = (e) => {
      const m = e.data;
      clearTimeout(timer);
      if (compareWorker !== w) { reject(new Error('cancelled')); return; }
      if (m.type === 'error') { reject(new Error(m.message)); return; }
      if (m.type === 'progress' && m.done) { resolve(m); return; }
      arm();
      w.postMessage({ type: 'step', steps: 1e12, budgetMs: 250, snapshot: false });
    };
    arm();
    w.postMessage({ type: 'load', code, values });
  });
}
$('compareAllBtn').addEventListener('click', compareAll);

// ---------- boot ----------
buildTabs();
updateSpeedLabel();
newRandom();
const fromHash = location.hash.slice(1);
selectAlgo(ALL.some((a) => a.id === fromHash) ? fromHash : ALL[0].id);
