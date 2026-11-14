// Steps instrumented sort code. Shared by the Web Worker and the Node tests.
//
// The array handed to the user's sort() is a Proxy over a Float64Array-backed
// plain array, so every index read and write is counted and the last few
// touched indices can be highlighted. Calls between the user's functions are
// trampolined on an explicit stack (see instrument.js), so deep recursion such
// as Quick Sort on sorted input never overflows the JS stack.

const CALL = Symbol('call');
const MAX_DEPTH = 200000;
const HIGHLIGHTS = 6;

function isIndexKey(key) {
  if (typeof key !== 'string' || key.length === 0) return false;
  const c = key.charCodeAt(0);
  return c >= 48 && c <= 57;
}

export function createRunner(instrumentedCode, values) {
  const data = Array.from(values);
  const stats = { steps: 0, reads: 0, writes: 0, line: 0 };
  // Ring buffer of recent accesses: [index, isWrite]
  const recent = [];
  const touch = (i, w) => {
    recent.push(i, w);
    if (recent.length > HIGHLIGHTS * 2) recent.splice(0, 2);
  };

  const proxy = new Proxy(data, {
    get(target, key, receiver) {
      if (isIndexKey(key)) {
        stats.reads++;
        touch(+key, 0);
        return target[key];
      }
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value) {
      if (isIndexKey(key)) {
        stats.writes++;
        touch(+key, 1);
      }
      target[key] = value;
      return true;
    },
  });

  const __C = (fn, ...args) => ({ [CALL]: true, fn, args });
  let sortFn;
  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function('__C', `${instrumentedCode}\n;return typeof sort === 'function' ? sort : undefined;`);
    sortFn = factory(__C);
  } catch (err) {
    throw new Error(`Could not compile: ${err.message}`);
  }
  if (!sortFn) throw new Error('Define a function named sort, e.g. function sort(arr) { ... }');
  if (sortFn.constructor.name !== 'GeneratorFunction') {
    throw new Error('Write sort as a regular function declaration: function sort(arr) { ... }');
  }

  const stack = [sortFn(proxy)];
  let done = false;
  let result;
  let pending = { mode: 'next', value: undefined };

  function step(maxSteps, budgetMs = Infinity) {
    const start = budgetMs === Infinity ? 0 : Date.now();
    let taken = 0;
    while (!done && taken < maxSteps) {
      const top = stack[stack.length - 1];
      let r;
      try {
        r = pending.mode === 'next' ? top.next(pending.value) : top.throw(pending.value);
        pending = { mode: 'next', value: undefined };
      } catch (err) {
        stack.pop();
        if (stack.length === 0) {
          const e = err instanceof Error ? err : new Error(String(err));
          e.sortLine = stats.line;
          done = true;
          throw e;
        }
        pending = { mode: 'throw', value: err };
        continue;
      }
      if (r.done) {
        stack.pop();
        if (stack.length === 0) {
          done = true;
          result = r.value;
        } else {
          pending = { mode: 'next', value: r.value };
        }
        continue;
      }
      const v = r.value;
      if (typeof v === 'number') {
        stats.line = v;
        stats.steps++;
        taken++;
        if ((taken & 1023) === 0 && budgetMs !== Infinity && Date.now() - start >= budgetMs) break;
      } else if (v && v[CALL]) {
        let res;
        try {
          res = v.fn.apply(undefined, v.args);
        } catch (err) {
          pending = { mode: 'throw', value: err };
          continue;
        }
        if (res && typeof res.next === 'function' && res[Symbol.toStringTag] === 'Generator') {
          if (stack.length >= MAX_DEPTH) {
            pending = { mode: 'throw', value: new RangeError('Maximum recursion depth exceeded') };
            continue;
          }
          stack.push(res);
        } else {
          pending = { mode: 'next', value: res };
        }
      } else {
        // The user wrote their own `yield x`; just treat it as a step.
        stats.steps++;
        taken++;
      }
    }
    if (done && Array.isArray(result) && result !== proxy && result !== data && result.length === data.length) {
      for (let i = 0; i < data.length; i++) data[i] = result[i];
    }
    return { done, taken };
  }

  return {
    step,
    stats,
    data,
    highlights: () => recent.slice(),
    isDone: () => done,
  };
}

export function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) if (arr[i - 1] > arr[i]) return false;
  return true;
}
