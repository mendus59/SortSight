import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instrument } from '../js/instrument.js';
import { createRunner, isSorted } from '../js/runner.js';
import { ALL } from '../js/algorithms.js';
import { randomSet } from '../js/datasets.js';

function runToEnd(code, values) {
  const runner = createRunner(instrument(code), values);
  while (!runner.isDone()) runner.step(100000);
  return runner;
}

for (const algo of ALL) {
  test(`${algo.name} sorts random, worst-case and edge inputs`, () => {
    const inputs = [
      [], [1], [2, 1], [3, 3, 1, 2, 2],
      randomSet(100, 42).values,
      randomSet(257, 7).values,
      algo.worstCase(100),
      algo.worstCase(1000),
    ];
    for (const input of inputs) {
      const r = runToEnd(algo.code, input);
      assert.ok(isSorted(r.data), `${algo.id} failed on ${JSON.stringify(input.slice(0, 10))}...`);
      assert.deepEqual([...r.data].sort((a, b) => a - b), [...input].sort((a, b) => a - b));
    }
  });

  test(`${algo.name} worst case is a permutation of 1..n`, () => {
    for (const n of [7, 100, 1000, 10000]) {
      const w = algo.worstCase(n);
      assert.equal(w.length, n);
      assert.deepEqual([...w].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1));
    }
  });
}

test('every step reports a line that exists in the source', () => {
  for (const algo of ALL) {
    const lines = algo.code.split('\n').length;
    const runner = createRunner(instrument(algo.code), randomSet(50, 1).values);
    while (!runner.isDone()) {
      runner.step(1);
      assert.ok(runner.stats.line >= 1 && runner.stats.line <= lines);
    }
  }
});

test('quick sort worst case uses many more steps than random input', () => {
  const quick = ALL.find((a) => a.id === 'quick');
  const worst = runToEnd(quick.code, quick.worstCase(500)).stats.steps;
  const rand = runToEnd(quick.code, randomSet(500, 3).values).stats.steps;
  assert.ok(worst > rand * 5, `worst=${worst} random=${rand}`);
});

test('deep recursion does not overflow the stack', () => {
  const quick = ALL.find((a) => a.id === 'quick');
  const r = runToEnd(quick.code, quick.worstCase(10000).slice(0, 3000));
  assert.ok(isSorted(r.data));
});

test('empty loops still yield so they cannot hang the runner', () => {
  const runner = createRunner(instrument('function sort(arr) { while (true); }'), [1]);
  const { taken } = runner.step(1000);
  assert.equal(taken, 1000);
  assert.equal(runner.isDone(), false);
});

test('non-block bodies, else-if chains and labels survive instrumentation', () => {
  const code = `function sort(arr) {
  outer: for (let i = 0; i < arr.length; i++)
    for (let j = 0; j < arr.length - 1 - i; j++)
      if (arr[j] > arr[j + 1]) swap(arr, j, j + 1);
      else if (false) continue outer;
      else ;
  return arr;
}
function swap(a, i, j) { const t = a[i]; a[i] = a[j]; a[j] = t; }`;
  const r = runToEnd(code, [5, 4, 3, 2, 1]);
  assert.deepEqual(r.data, [1, 2, 3, 4, 5]);
});

test('runtime errors report the line they happened on', () => {
  const code = 'function sort(arr) {\n  const x = 1;\n  null.boom;\n}';
  const runner = createRunner(instrument(code), [1, 2]);
  assert.throws(() => runner.step(100), (e) => e.sortLine === 3);
});

test('errors thrown in helpers can be caught by the caller', () => {
  const code = `function sort(arr) {
  try { fail(); } catch (e) { arr[0] = 0; }
  return arr;
}
function fail() { throw new Error('x'); }`;
  const r = runToEnd(code, [5, 1]);
  assert.deepEqual(r.data, [0, 1]);
});

test('a sort that returns a new array is applied at the end', () => {
  const code = 'function sort(arr) { return arr.slice().sort(function (a, b) { return a - b; }); }';
  const r = runToEnd(code, [3, 1, 2]);
  assert.deepEqual(r.data, [1, 2, 3]);
});

test('arrow-function sort gives a helpful error', () => {
  assert.throws(() => createRunner(instrument('const sort = (a) => a;'), [1]), /function declaration/);
});

test('reads and writes are counted', () => {
  const r = runToEnd('function sort(arr) { const t = arr[0]; arr[0] = arr[1]; arr[1] = t; }', [2, 1]);
  assert.equal(r.stats.reads, 2);
  assert.equal(r.stats.writes, 2);
});
