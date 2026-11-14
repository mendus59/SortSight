// Whiteboard tutorial page: picks a lesson, plays its frames with typed-out
// captions, and wires up the playback controls.
import { LESSON_IDS, LESSON_SUMMARIES, buildLesson } from './lessons.js';
import { Board } from './board.js';
import { ALGORITHMS } from '../algorithms.js';

const $ = (id) => document.getElementById(id);
const NAMES = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a.name]));
const SPEEDS = { slow: 0.6, normal: 1, fast: 1.7 };
const PACE_MS = { slow: 3600, normal: 2100, fast: 1100 };
const CHARS_PER_SEC = 34;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const board = new Board($('board'));
board.reduced = reduceMotion.matches;
reduceMotion.addEventListener?.('change', (e) => { board.reduced = e.matches; });

const state = {
  id: LESSON_IDS[0],
  frames: [],
  index: 0,
  playing: false,
  speed: 'normal',
  shownAt: 0, // when the current frame appeared
  dwellFrom: 0, // when the auto-advance countdown for this frame began
  typed: 0,
};

// ---------- lesson picker ----------
function buildTabs() {
  const nav = $('lessonTabs');
  for (const id of LESSON_IDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = NAMES[id];
    b.dataset.id = id;
    b.addEventListener('click', () => selectLesson(id, { autoplay: true }));
    nav.appendChild(b);
  }
}

function selectLesson(id, { autoplay = false } = {}) {
  state.id = LESSON_IDS.includes(id) ? id : LESSON_IDS[0];
  state.frames = buildLesson(state.id);
  for (const b of $('lessonTabs').children) b.setAttribute('aria-current', b.dataset.id === state.id ? 'true' : 'false');
  const sum = LESSON_SUMMARIES[state.id];
  $('sumIdea').textContent = sum.idea;
  $('sumGood').textContent = sum.good;
  $('sumBad').textContent = sum.bad;
  $('lessonName').textContent = NAMES[state.id];
  $('codeLink').href = `index.html#${state.id}`;
  $('codeLink').textContent = `See the real ${NAMES[state.id]} code run`;
  $('scrub').max = String(state.frames.length - 1);
  board.shown.clear();
  try { history.replaceState(null, '', `#${state.id}`); } catch { /* ignore */ }
  goTo(0, { instant: true });
  setPlaying(autoplay);
}

// ---------- frames ----------
function goTo(i, { instant = false } = {}) {
  state.index = Math.max(0, Math.min(state.frames.length - 1, i));
  const f = state.frames[state.index];
  const now = performance.now();
  board.show(f, now, { instant });
  state.shownAt = now;
  state.dwellFrom = now;
  state.typed = board.reduced ? f.caption.length : 0;
  $('captionLive').textContent = f.caption;
  renderCaption();
  $('scrub').value = String(state.index);
  $('stepCount').textContent = `${state.index + 1} / ${state.frames.length}`;
  $('backBtn').disabled = state.index === 0;
  $('nextBtn').disabled = state.index === state.frames.length - 1;
}

function renderCaption() {
  const text = state.frames[state.index].caption;
  const el = $('caption');
  el.textContent = text.slice(0, state.typed);
  // keep the box from jumping around while typing: the rest is invisible
  const ghost = document.createElement('span');
  ghost.className = 'ghost';
  ghost.textContent = text.slice(state.typed);
  el.appendChild(ghost);
}

function dwellMs(f) {
  const read = (f.caption.length / CHARS_PER_SEC) * 1000;
  return (read + PACE_MS[f.pace || 'normal']) / SPEEDS[state.speed];
}

function setPlaying(on) {
  const atEnd = state.index >= state.frames.length - 1;
  if (on && atEnd) goTo(0);
  state.playing = on;
  state.dwellFrom = performance.now();
  const btn = $('playBtn');
  btn.classList.toggle('playing', on);
  $('playLabel').textContent = on ? 'Pause' : atEnd && !on && state.index > 0 ? 'Replay' : 'Play';
  btn.setAttribute('aria-label', $('playLabel').textContent);
}

function loop(now) {
  board.draw(now);
  const f = state.frames[state.index];
  if (f) {
    const typingStart = state.shownAt + (board.reduced ? 0 : 250);
    const want = board.reduced ? f.caption.length : Math.floor(((now - typingStart) / 1000) * CHARS_PER_SEC * SPEEDS[state.speed] * 1.4);
    const typed = Math.max(0, Math.min(f.caption.length, want));
    if (typed !== state.typed) {
      state.typed = typed;
      renderCaption();
    }
    if (state.playing && now - state.dwellFrom > dwellMs(f)) {
      if (state.index < state.frames.length - 1) goTo(state.index + 1);
      else setPlaying(false);
    }
  }
  requestAnimationFrame(loop);
}

// ---------- controls ----------
$('playBtn').addEventListener('click', () => setPlaying(!state.playing));
$('nextBtn').addEventListener('click', () => goTo(state.index + 1));
$('backBtn').addEventListener('click', () => goTo(state.index - 1));
$('restartBtn').addEventListener('click', () => { goTo(0, { instant: true }); setPlaying(true); });
$('scrub').addEventListener('input', (e) => goTo(Number(e.target.value)));
for (const b of $('speedGroup').querySelectorAll('button')) {
  b.addEventListener('click', () => {
    state.speed = b.dataset.speed;
    for (const o of $('speedGroup').querySelectorAll('button')) o.setAttribute('aria-checked', o === b ? 'true' : 'false');
  });
}
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') && e.target.type !== 'range') return;
  if (e.key === 'ArrowRight') { e.preventDefault(); goTo(state.index + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(state.index - 1); }
  else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); setPlaying(!state.playing); }
});

const ro = new ResizeObserver(() => { board.resize(); board.lastKey = null; });
ro.observe($('board'));

// Redraw once the handwriting font arrives, so the numbers aren't in a fallback font.
document.fonts?.ready.then(() => { board.lastKey = null; });

buildTabs();
selectLesson(location.hash.slice(1));
window.addEventListener('hashchange', () => selectLesson(location.hash.slice(1)));
requestAnimationFrame(loop);
