// Runs user sort code off the main thread. The page can terminate this worker
// at any time, so a runaway loop never freezes the UI.
import { createRunner, isSorted } from './runner.js';

let runner = null;

function fail(err) {
  runner = null;
  postMessage({
    type: 'error',
    message: err && err.message ? err.message : String(err),
    line: err && err.sortLine ? err.sortLine : 0,
  });
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'load') {
    try {
      runner = createRunner(msg.code, msg.values);
      postMessage({ type: 'loaded' });
    } catch (err) {
      fail(err);
    }
    return;
  }
  if (msg.type === 'step') {
    if (!runner) return;
    let result;
    try {
      result = runner.step(msg.steps, msg.budgetMs);
    } catch (err) {
      fail(err);
      return;
    }
    const s = runner.stats;
    const values = msg.snapshot === false ? null : Float64Array.from(runner.data);
    postMessage({
      type: 'progress',
      id: msg.id,
      values,
      line: s.line,
      steps: s.steps,
      reads: s.reads,
      writes: s.writes,
      taken: result.taken,
      done: result.done,
      sorted: result.done ? isSorted(runner.data) : false,
      highlights: runner.highlights(),
    }, values ? [values.buffer] : []);
  }
};
