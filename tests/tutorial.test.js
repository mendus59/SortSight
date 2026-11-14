import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_IDS, LESSON_VALUES, LESSON_SUMMARIES, ROLES, BOARD_W, BOARD_H, buildLesson } from '../js/tutorial/lessons.js';
import { ALGORITHMS } from '../js/algorithms.js';
import { randomSet } from '../js/datasets.js';

// Words a non-technical viewer shouldn't have to know.
const JARGON = /\b(array|index|indices|element|iterat\w*|recurs\w*|loop|function|variable|pointer|partition\w*|heapify|subarray|algorithm|complexity|O\(|log n)\b/i;

const finalOrder = (frame) => [...frame.items].sort((a, b) => a.x - b.x).map((it) => it.value);
const sortedCopy = (v) => [...v].sort((a, b) => a - b);

test('there is a lesson for every built-in sort', () => {
  assert.deepEqual([...LESSON_IDS].sort(), ALGORITHMS.map((a) => a.id).sort());
  for (const id of LESSON_IDS) assert.ok(LESSON_SUMMARIES[id], `${id} has a summary`);
});

for (const id of LESSON_IDS) {
  test(`${id} lesson ends sorted, all green`, () => {
    const frames = buildLesson(id);
    const last = frames[frames.length - 1];
    assert.deepEqual(finalOrder(last), sortedCopy(LESSON_VALUES[id]));
    assert.ok(last.items.every((it) => it.role === 'done'));
    assert.ok(frames[0].heading, 'opens with a title');
    assert.ok(frames.length >= 8 && frames.length <= 60, `${frames.length} frames is a watchable length`);
  });

  test(`${id} lesson also works on other small inputs`, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const values = randomSet(id === 'heap' ? 7 : 6, seed).values.map((v) => (v % 9) + 1);
      const frames = buildLesson(id, values);
      assert.deepEqual(finalOrder(frames[frames.length - 1]), sortedCopy(values));
    }
    assert.deepEqual(finalOrder(buildLesson(id, [1, 2, 3, 4, 5, 6]).at(-1)), [1, 2, 3, 4, 5, 6]);
  });

  test(`${id} lesson captions are plain English and frames are drawable`, () => {
    for (const f of buildLesson(id)) {
      assert.ok(f.caption.length > 10 && f.caption.length < 320, `caption length: ${f.caption}`);
      assert.doesNotMatch(f.caption, JARGON, `jargon in: ${f.caption}`);
      assert.doesNotMatch(f.caption, /undefined|NaN/);
      const ids = new Set(f.items.map((it) => it.id));
      for (const it of f.items) {
        assert.ok(ROLES.includes(it.role), `role ${it.role}`);
        assert.ok(it.x > 0 && it.x < BOARD_W && it.y > 0 && it.y < BOARD_H, `item on the board: ${it.x},${it.y}`);
      }
      for (const m of f.marks) {
        for (const key of ['a', 'b', 'id']) if (key in m) assert.ok(ids.has(m[key]), `${m.kind} points at a real block`);
        if (m.ids) for (const x of m.ids) assert.ok(ids.has(x));
      }
    }
  });
}
