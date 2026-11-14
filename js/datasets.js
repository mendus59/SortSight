// Seeded random data so the same set can be replayed across algorithms.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed() {
  return Math.floor(Math.random() * 0xffffff) + 1;
}

// A shuffled permutation of 1..n (Fisher-Yates with a seeded generator).
export function randomSet(n, seed) {
  const rand = mulberry32(seed);
  const values = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = values[i];
    values[i] = values[j];
    values[j] = t;
  }
  return { values, seed };
}

export function parseValues(text) {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const values = parts.map(Number);
  const bad = parts.find((p, i) => !Number.isFinite(values[i]));
  if (bad !== undefined) throw new Error(`"${bad}" is not a number`);
  if (values.length < 2) throw new Error('Enter at least two numbers');
  if (values.length > 20000) throw new Error('At most 20,000 values');
  return values;
}
