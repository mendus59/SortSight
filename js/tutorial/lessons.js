// Whiteboard lessons: each sort is told as a short story of "frames".
// A frame is a still picture of the board plus one plain-English caption.
// The player animates from one frame to the next, so blocks slide and hop
// between pictures. Everything here is pure data, so it can be tested in Node.

export const BOARD_W = 1000;
export const BOARD_H = 560;

// Ink colors live in the renderer; frames only name a role.
//   ink: an ordinary block       focus: being looked at right now
//   done: in its final spot      pick: the special one (pivot, shortest so far, lifted card)
//   low/high: sorted into the "shorter" / "taller" pile   faded: not part of this step
export const ROLES = ['ink', 'focus', 'done', 'pick', 'low', 'high', 'faded'];

const BAR_UNIT = 26;
const BASELINE = 430;

function slotX(i, n, spacing = Math.min(130, 840 / n)) {
  return BOARD_W / 2 + (i - (n - 1) / 2) * spacing;
}

// x positions for a row split into groups with a gap between each group.
function groupedX(groups, spacing, gap) {
  const n = groups.reduce((s, g) => s + g, 0);
  const width = (n - 1) * spacing + (groups.length - 1) * gap;
  const left = BOARD_W / 2 - width / 2;
  const xs = [];
  let x = left;
  groups.forEach((size, gi) => {
    for (let k = 0; k < size; k++) {
      xs.push(x);
      x += spacing;
    }
    if (gi < groups.length - 1) x += gap - 0;
  });
  return xs;
}

// The story builder shared by every lesson.
class Story {
  constructor(values, { shape = 'bar', unit = BAR_UNIT } = {}) {
    this.values = values;
    this.items = values.map((value, id) => ({ id, value }));
    this.order = this.items.map((it) => it.id); // left-to-right ids
    this.role = new Map(); // persistent roles (e.g. done)
    this.frames = [];
    this.shape = shape;
    this.unit = unit;
  }

  val(id) { return this.items[id].value; }
  at(i) { return this.order[i]; }
  swap(i, j) { [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; }
  setRole(ids, role) { for (const id of [].concat(ids)) { if (role) this.role.set(id, role); else this.role.delete(id); } }

  // Default picture: one row of bars, in the current order.
  rowPositions({ baseline = BASELINE, lift = new Map() } = {}) {
    const n = this.order.length;
    const pos = new Map();
    this.order.forEach((id, i) => pos.set(id, { x: slotX(i, n), y: baseline - (lift.get(id) || 0) }));
    return pos;
  }

  // Take a snapshot. `roles` overrides persistent roles just for this frame.
  snap(caption, { pos, roles = {}, marks = [], heading = null, pace = 'normal', unit = this.unit, width } = {}) {
    const p = pos || this.rowPositions();
    const n = this.order.length;
    const items = this.items.map((it) => {
      const where = p.get(it.id);
      return {
        id: it.id,
        value: it.value,
        x: where.x,
        y: where.y,
        role: roles[it.id] || this.role.get(it.id) || 'ink',
      };
    });
    this.frames.push({
      caption,
      heading,
      pace,
      shape: this.shape,
      unit,
      barWidth: width || Math.min(70, (840 / n) * 0.55),
      items,
      marks,
    });
  }

  finish(caption, heading = 'Sorted!') {
    this.setRole(this.order, 'done');
    this.snap(caption, { heading, pace: 'slow', pos: this.lastPos });
    return this.frames;
  }
}

const list = (vals) => {
  if (vals.length === 1) return `${vals[0]}`;
  return `${vals.slice(0, -1).join(', ')} and ${vals[vals.length - 1]}`;
};
const r = (ids) => Object.fromEntries(ids.filter((x) => x !== undefined).map(([id, role]) => [id, role]));

// ---------------------------------------------------------------- Bubble
function bubble(values) {
  const s = new Story(values);
  const n = s.order.length;
  s.snap(`Here are ${n} blocks of different heights. We want them lined up from shortest to tallest. Bubble Sort does it with one simple habit: look at two blocks side by side, and if the taller one is on the left, swap them.`, { heading: 'Bubble Sort', pace: 'slow' });
  for (let pass = 0; pass < n - 1; pass++) {
    const detailed = pass === 0;
    s.snap(pass === 0
      ? 'Round 1. Start at the left end and walk to the right, checking each pair of neighbors.'
      : `Round ${pass + 1}. Back to the left end, and walk right again. We can stop before the green blocks, because they're already done.`,
    { pace: pass === 0 ? 'normal' : 'fast', roles: {} });
    let swapped = false;
    for (let j = 0; j < n - pass - 1; j++) {
      const a = s.at(j);
      const b = s.at(j + 1);
      const roles = r([[a, 'focus'], [b, 'focus']]);
      if (s.val(a) > s.val(b)) {
        s.snap(detailed
          ? `Is ${s.val(a)} taller than ${s.val(b)}? Yes, it is. The taller one should be on the right, so they swap places.`
          : `${s.val(a)} is taller than ${s.val(b)}: swap.`,
        { roles, marks: [{ kind: 'swap', a, b }], pace: detailed ? 'normal' : 'fast' });
        s.swap(j, j + 1);
        swapped = true;
      } else {
        s.snap(detailed
          ? `Is ${s.val(a)} taller than ${s.val(b)}? No, so these two are fine as they are. Move on.`
          : `${s.val(a)} and ${s.val(b)} are already in order.`,
        { roles, marks: [{ kind: 'check', a, b }], pace: detailed ? 'normal' : 'fast' });
      }
    }
    const last = s.at(n - pass - 1);
    s.setRole(last, 'done');
    if (pass === 0) {
      s.snap(`See what happened? The tallest block, ${s.val(last)}, kept winning every comparison, so it "bubbled" all the way to the right end. That's its final spot, so we color it green.`, { marks: [{ kind: 'label', id: last, text: 'done!' }] });
    } else if (!swapped) {
      s.setRole(s.order, 'done');
      s.snap('We just walked a whole round without a single swap. That can only happen if everything is already in order, so we can stop early!', { pace: 'slow' });
      return s.finish('All sorted! Bubble Sort is easy to understand, but it is slow on big piles: with a thousand blocks it might walk the line hundreds of times, nudging blocks just one step per swap.');
    } else {
      s.snap(`End of round ${pass + 1}: the next tallest block, ${s.val(last)}, has bubbled into place.`, { pace: 'fast' });
    }
  }
  s.setRole(s.at(0), 'done');
  return s.finish('Only the shortest block is left, and it is already at the front. All sorted! Bubble Sort is easy to understand, but slow on big piles, because blocks only move one step per swap.');
}

// ---------------------------------------------------------------- Selection
function selection(values) {
  const s = new Story(values);
  const n = s.order.length;
  s.snap('Selection Sort works the way many people tidy up by hand: find the shortest block, put it at the front, then find the next shortest, and so on.', { heading: 'Selection Sort', pace: 'slow' });
  for (let i = 0; i < n - 1; i++) {
    const detailed = i === 0;
    let min = i;
    if (detailed) {
      s.snap(`To find the shortest, we look at every block from left to right. We start by guessing that the first one, ${s.val(s.at(0))}, is the shortest so far.`, { roles: r([[s.at(0), 'pick']]), marks: [{ kind: 'label', id: s.at(0), text: 'shortest so far' }] });
    }
    for (let j = i + 1; j < n; j++) {
      const m = s.at(min);
      const c = s.at(j);
      const shorter = s.val(c) < s.val(m);
      if (detailed) {
        s.snap(shorter
          ? `Is ${s.val(c)} shorter than ${s.val(m)}? Yes! So ${s.val(c)} becomes our new "shortest so far".`
          : `Is ${s.val(c)} shorter than ${s.val(m)}? No. Our shortest so far is still ${s.val(m)}.`,
        { roles: r([[m, 'pick'], [c, 'focus']]), marks: [{ kind: 'label', id: m, text: 'shortest so far' }, { kind: 'pointer', id: c }], pace: 'fast' });
      }
      if (shorter) min = j;
    }
    const m = s.at(min);
    const front = s.at(i);
    if (detailed) {
      s.snap(min !== i
        ? `We've looked at every block, and the shortest is ${s.val(m)}. It swaps places with ${s.val(front)}, the block at the front.`
        : `We've looked at every block, and the shortest is ${s.val(m)}. It is already at the front, so it stays put.`, { roles: r([[m, 'pick'], [front, 'focus']]), marks: min !== i ? [{ kind: 'swap', a: front, b: m }] : [] });
    } else {
      const scanned = s.order.slice(i).map((id) => s.val(id));
      s.snap(min !== i
        ? `Look through the rest (${list(scanned)}). The shortest is ${s.val(m)}, so it swaps with ${s.val(front)}.`
        : `Look through the rest (${list(scanned)}). The shortest is ${s.val(m)}, and it is already at the front. No swap needed.`,
      { roles: r([[m, 'pick'], [front, 'focus']]), marks: min !== i ? [{ kind: 'swap', a: front, b: m }] : [{ kind: 'label', id: m, text: 'shortest' }], pace: 'fast' });
    }
    s.swap(i, min);
    s.setRole(s.at(i), 'done');
    if (detailed) s.snap(`${s.val(s.at(i))} is now in its final spot, so it turns green. Now we do the same thing again, ignoring the green blocks.`);
  }
  return s.finish('The last block left over must be the tallest, so it is already in place. All sorted! Selection Sort always looks at every remaining block on every round, even when the line is already tidy, so it never gets a lucky shortcut.');
}

// ---------------------------------------------------------------- Insertion
function insertion(values) {
  const s = new Story(values);
  const n = s.order.length;
  const lift = new Map();
  const pos = () => s.rowPositions({ lift });
  s.snap('Insertion Sort is how most people sort a hand of playing cards. Take the next card, and slide it left until it sits just after a card that is shorter.', { heading: 'Insertion Sort', pace: 'slow' });
  s.setRole(s.at(0), 'done');
  s.snap(`Start with just the first block, ${s.val(s.at(0))}. A group of one is always in order, so it counts as our "sorted hand".`, { marks: [{ kind: 'bracket', ids: [s.at(0)], text: 'sorted hand' }] });
  for (let i = 1; i < n; i++) {
    const detailed = i <= 2;
    const card = s.at(i);
    lift.set(card, 90);
    const hand = s.order.slice(0, i);
    s.snap(detailed
      ? `Pick up the next block, ${s.val(card)}. Now we find where it belongs in the sorted hand.`
      : `Next, pick up ${s.val(card)}.`,
    { pos: pos(), roles: r([[card, 'pick']]), marks: [{ kind: 'bracket', ids: hand, text: 'sorted hand' }], pace: detailed ? 'normal' : 'fast' });
    let j = i;
    while (j > 0 && s.val(s.at(j - 1)) > s.val(card)) {
      const left = s.at(j - 1);
      s.snap(detailed
        ? `${s.val(left)} is taller than ${s.val(card)}, so ${s.val(left)} slides one spot to the right to make room.`
        : `${s.val(left)} is taller: it slides right.`,
      { pos: pos(), roles: r([[card, 'pick'], [left, 'focus']]), marks: [{ kind: 'arrow', id: left, dir: 1 }], pace: detailed ? 'normal' : 'fast' });
      s.swap(j - 1, j);
      j--;
    }
    if (j > 0) {
      const left = s.at(j - 1);
      s.snap(detailed
        ? `${s.val(left)} is shorter than ${s.val(card)}, so we've found the spot. Drop ${s.val(card)} into the gap.`
        : `${s.val(left)} is shorter, so ${s.val(card)} drops in here.`,
      { pos: pos(), roles: r([[card, 'pick'], [left, 'focus']]), marks: [{ kind: 'pointer', id: card, text: 'here' }], pace: detailed ? 'normal' : 'fast' });
    } else {
      s.snap(`Nothing left to compare with: ${s.val(card)} is the shortest so far, so it drops in at the very front.`, { pos: pos(), roles: r([[card, 'pick']]), pace: detailed ? 'normal' : 'fast' });
    }
    lift.delete(card);
    s.setRole(card, 'done');
    if (detailed) s.snap(`The sorted hand has grown to ${i + 1} blocks.`, { pos: pos(), marks: [{ kind: 'bracket', ids: s.order.slice(0, i + 1), text: 'sorted hand' }], pace: 'fast' });
  }
  return s.finish('Every block has been picked up and dropped into place. All sorted! Insertion Sort is great when the line is already nearly in order, because each block only slides a little. When things are badly jumbled, the sliding adds up.');
}

// ---------------------------------------------------------------- Cocktail shaker
function cocktail(values) {
  const s = new Story(values);
  const n = s.order.length;
  s.snap('Cocktail Shaker Sort is Bubble Sort that walks both ways, like shaking a cocktail back and forth. Going right, tall blocks drift to the right end. Coming back, short blocks drift to the left end.', { heading: 'Cocktail Shaker Sort', pace: 'slow' });
  let lo = 0;
  let hi = n - 1;
  let round = 0;
  while (lo < hi) {
    round++;
    const detailed = round === 1;
    let swapped = false;
    s.snap(detailed ? 'First, walk to the right, swapping any neighbors where the taller one is on the left.' : 'Walk right again.', { pace: detailed ? 'normal' : 'fast' });
    for (let j = lo; j < hi; j++) {
      const a = s.at(j);
      const b = s.at(j + 1);
      const roles = r([[a, 'focus'], [b, 'focus']]);
      if (s.val(a) > s.val(b)) {
        s.snap(detailed ? `${s.val(a)} is taller than ${s.val(b)}, so they swap.` : `${s.val(a)} and ${s.val(b)}: swap.`, { roles, marks: [{ kind: 'swap', a, b }], pace: 'fast' });
        s.swap(j, j + 1);
        swapped = true;
      } else {
        s.snap(`${s.val(a)} and ${s.val(b)} are fine.`, { roles, marks: [{ kind: 'check', a, b }], pace: 'fast' });
      }
    }
    s.setRole(s.at(hi), 'done');
    hi--;
    if (!swapped) break;
    s.snap(detailed
      ? `The tallest block, ${s.val(s.at(hi + 1))}, reached the right end. Now turn around and walk back to the left.`
      : `${s.val(s.at(hi + 1))} is done on the right. Turn around.`,
    { pace: detailed ? 'normal' : 'fast' });
    swapped = false;
    for (let j = hi; j > lo; j--) {
      const a = s.at(j - 1);
      const b = s.at(j);
      const roles = r([[a, 'focus'], [b, 'focus']]);
      if (s.val(a) > s.val(b)) {
        s.snap(detailed ? `${s.val(b)} is shorter than ${s.val(a)}, so it hops to the left.` : `${s.val(a)} and ${s.val(b)}: swap.`, { roles, marks: [{ kind: 'swap', a, b }], pace: 'fast' });
        s.swap(j - 1, j);
        swapped = true;
      } else {
        s.snap(`${s.val(a)} and ${s.val(b)} are fine.`, { roles, marks: [{ kind: 'check', a, b }], pace: 'fast' });
      }
    }
    s.setRole(s.at(lo), 'done');
    lo++;
    if (!swapped) break;
    s.snap(detailed
      ? `On the way back, the shortest block, ${s.val(s.at(lo - 1))}, drifted all the way to the left end. Both ends are now finished, and the job in the middle gets smaller each time.`
      : `${s.val(s.at(lo - 1))} is done on the left.`,
    { pace: detailed ? 'normal' : 'fast' });
  }
  s.snap('A whole walk with no swaps means the middle is in order too.', { pace: 'fast' });
  return s.finish('All sorted! Walking both ways helps short blocks stuck near the right end, which plain Bubble Sort moves only one step per round. It is still slow for big piles, though.');
}

// ---------------------------------------------------------------- Shell
function shell(values) {
  const s = new Story(values);
  const n = s.order.length;
  s.snap('Insertion Sort has a weakness: a short block stuck far to the right has to shuffle left one tiny step at a time. Shell Sort fixes that by first comparing blocks that are far apart, so they can make big jumps.', { heading: 'Shell Sort', pace: 'slow' });
  for (let gap = Math.floor(n / 2); gap >= 1; gap = Math.floor(gap / 2)) {
    const words = gap === 1 ? 'right next to each other' : `${gap} spots apart`;
    s.snap(gap === 1
      ? 'Finally, the gap is 1: an ordinary neighbor-by-neighbor tidy-up. The big jumps already did most of the work, so there is not much left to fix.'
      : gap === Math.floor(n / 2)
        ? `Round 1: compare blocks that are ${gap} spots apart. If the left one is taller, they swap, jumping ${gap} spots in one go.`
        : `Round 2: shrink the gap. Now compare blocks ${gap} spots apart.`,
    { pace: 'normal' });
    for (let i = gap; i < n; i++) {
      for (let j = i; j >= gap; j -= gap) {
        const a = s.at(j - gap);
        const b = s.at(j);
        const roles = r([[a, 'focus'], [b, 'focus']]);
        const arc = { kind: 'arc', a, b, text: gap > 1 ? `${gap} apart` : '' };
        if (s.val(a) > s.val(b)) {
          s.snap(`${s.val(a)} and ${s.val(b)} are ${words}. ${s.val(a)} is taller, so they swap.`, { roles, marks: [arc, { kind: 'swap', a, b }], pace: 'fast' });
          s.swap(j - gap, j);
        } else {
          s.snap(`${s.val(a)} and ${s.val(b)} are ${words}, and already in order.`, { roles, marks: [arc, { kind: 'check', a, b }], pace: 'fast' });
          break;
        }
      }
    }
    if (gap > 1) s.snap(`That round is done. The line isn't sorted yet, but the short blocks have moved toward the left and the tall ones toward the right.`, { pace: 'normal' });
  }
  return s.finish('All sorted! Because the early rounds move blocks long distances, Shell Sort is far quicker than Insertion Sort on a big jumbled pile.');
}

// ---------------------------------------------------------------- Merge
function merge(values) {
  const s = new Story(values, { unit: 18 });
  const n = s.order.length;
  const spacing = 86;
  const gapW = 26;
  const top = 235;
  const bottom = 500;
  const width = 52;
  const rowPos = (groups) => {
    const xs = groupedX(groups, spacing, gapW);
    const p = new Map();
    s.order.forEach((id, i) => p.set(id, { x: xs[i], y: top }));
    return p;
  };
  let groups = [n];
  s.snap('Merge Sort is a "divide and conquer" plan. First, keep cutting the line in half until every pile has just one block. Then join the piles back together two at a time, keeping each joined pile in order.', { heading: 'Merge Sort', pace: 'slow', pos: rowPos(groups), width });
  // Splitting phase.
  let level = 0;
  while (groups.some((g) => g > 1)) {
    groups = groups.flatMap((g) => (g > 1 ? [Math.ceil(g / 2), Math.floor(g / 2)] : [g]));
    level++;
    s.snap(level === 1
      ? 'Cut the line in half.'
      : groups.every((g) => g === 1)
        ? 'And again, until every pile is a single block. A pile of one block is already "in order", since there is nothing to compare it with!'
        : 'Cut each pile in half again.',
    { pos: rowPos(groups), width, pace: level === 1 ? 'normal' : 'fast' });
  }
  // Merging phase.
  let round = 0;
  while (groups.length > 1) {
    round++;
    const next = [];
    let start = 0;
    let firstMerge = true;
    const mergedGroups = [];
    for (let g = 0; g < groups.length; g += 2) mergedGroups.push(groups[g] + (groups[g + 1] || 0));
    for (let g = 0; g < groups.length; g += 2) {
      const sizeA = groups[g];
      const sizeB = groups[g + 1] || 0;
      if (!sizeB) { next.push(sizeA); start += sizeA; continue; }
      const A = s.order.slice(start, start + sizeA);
      const B = s.order.slice(start + sizeA, start + sizeA + sizeB);
      const verbose = firstMerge;
      firstMerge = false;
      const outXs = groupedX(mergedGroups, spacing, gapW);
      const basePos = rowPos(groups);
      const out = [];
      let ia = 0;
      let ib = 0;
      const posNow = () => {
        const p = new Map(basePos);
        out.forEach((id, k) => p.set(id, { x: outXs[start + k], y: bottom }));
        return p;
      };
      if (verbose) {
        s.snap(round === 1
          ? `Let's join ${s.val(A[0])} and ${s.val(B[0])} into one pile. We'll build the joined pile underneath.`
          : `Now join the piles (${list(A.map((id) => s.val(id)))}) and (${list(B.map((id) => s.val(id)))}). Both are already in order, so we only ever need to compare their front blocks.`,
        { pos: posNow(), width, roles: Object.fromEntries([...A, ...B].map((id) => [id, 'focus'])), pace: 'normal' });
      }
      while (ia < A.length || ib < B.length) {
        let take;
        let caption;
        let extra = [];
        const frontRoles = {};
        if (ia < A.length) frontRoles[A[ia]] = 'focus';
        if (ib < B.length) frontRoles[B[ib]] = 'focus';
        if (ia < A.length && ib < B.length) {
          const a = A[ia];
          const b = B[ib];
          take = s.val(a) <= s.val(b) ? a : b;
          caption = verbose && out.length < 2
            ? `Compare the front of each pile: ${s.val(a)} and ${s.val(b)}. The shorter one, ${s.val(take)}, goes next.`
            : `${s.val(a)} or ${s.val(b)}? ${s.val(take)} is shorter.`;
          if (take === a) ia++; else ib++;
        } else {
          const rest = ia < A.length ? A.slice(ia) : B.slice(ib);
          ia = A.length;
          ib = B.length;
          extra = rest.slice(0, -1);
          take = rest[rest.length - 1];
          rest.forEach((id) => { frontRoles[id] = 'pick'; });
          caption = rest.length > 1
            ? `One pile is empty, so the rest (${list(rest.map((id) => s.val(id)))}) just follow along. They're already in order.`
            : `One pile is empty, so ${s.val(take)} just follows along.`;
          if (!verbose) { out.push(...rest); break; }
        }
        frontRoles[take] = 'pick';
        s.snap(caption, { pos: posNow(), width, roles: frontRoles, marks: [{ kind: 'pointer', id: extra[0] ?? take, text: 'next' }], pace: verbose ? 'normal' : 'fast' });
        out.push(...extra, take);
      }
      s.order.splice(start, out.length, ...out);
      next.push(sizeA + sizeB);
      // Show the finished pile below, then lift it into the row.
      s.snap(verbose ? `Joined: ${list(out.map((id) => s.val(id)))}, all in order.` : `Joined: ${list(out.map((id) => s.val(id)))}.`, {
        pos: (() => { const p = rowPos(groups); out.forEach((id, k) => p.set(id, { x: outXs[start + k], y: bottom })); return p; })(),
        width, roles: Object.fromEntries(out.map((id) => [id, 'low'])), pace: 'fast',
      });
      start += sizeA + sizeB;
    }
    groups = next;
    if (groups.length > 1) {
      s.snap(`Every pair of piles has been joined. We now have ${groups.length} sorted piles of ${groups[0]} blocks, so we join those next.`, { pos: rowPos(groups), width, pace: 'normal' });
    }
  }
  s.lastPos = rowPos(groups);
  s.setRole(s.order, 'done');
  s.snap('All sorted! Joining two piles that are already in order is quick, which is why Merge Sort stays fast even with millions of blocks. Its one cost: it needs extra space to build the joined piles.', { heading: 'Sorted!', pace: 'slow', pos: s.lastPos, width });
  return s.frames;
}

// ---------------------------------------------------------------- Quick
function quick(values) {
  const s = new Story(values);
  const n = s.order.length;
  const gapAfter = new Set(); // gaps drawn after these positions (pile boundaries)
  const lift = new Map();
  const pos = () => {
    const groups = [];
    let size = 0;
    for (let i = 0; i < n; i++) {
      size++;
      if (gapAfter.has(i) || i === n - 1) { groups.push(size); size = 0; }
    }
    const spacing = Math.min(120, (860 - (groups.length - 1) * 24) / n);
    const xs = groupedX(groups, spacing, 24);
    const p = new Map();
    s.order.forEach((id, i) => p.set(id, { x: xs[i], y: BASELINE - (lift.get(id) || 0) }));
    return p;
  };
  s.snap('Quick Sort picks one block to be the "pivot". Then it splits everyone else into two piles: blocks shorter than the pivot go on its left, and taller blocks go on its right.', { heading: 'Quick Sort', pace: 'slow', pos: pos() });
  const stack = [[0, n - 1]];
  let first = true;
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (lo > hi) continue;
    const outside = Object.fromEntries(s.order.filter((id, i) => (i < lo || i > hi) && s.role.get(id) !== 'done').map((id) => [id, 'faded']));
    if (lo === hi) {
      s.setRole(s.at(lo), 'done');
      s.snap(`A pile with just one block, ${s.val(s.at(lo))}, is already sorted.`, { pos: pos(), roles: outside, pace: 'fast' });
      continue;
    }
    const pivot = s.at(hi);
    lift.set(pivot, 70);
    const pile = s.order.slice(lo, hi + 1).map((id) => s.val(id));
    s.snap(first
      ? `We'll use the last block, ${s.val(pivot)}, as the pivot. Lift it up so we can compare everyone against it.`
      : `Next pile: ${list(pile)}. The pivot is the last block, ${s.val(pivot)}.`,
    { pos: pos(), roles: { ...outside, [pivot]: 'pick' }, marks: [{ kind: 'label', id: pivot, text: 'pivot' }], pace: first ? 'normal' : 'fast' });
    const tags = {};
    const low = [];
    const high = [];
    for (let i = lo; i < hi; i++) {
      const id = s.at(i);
      const isLow = s.val(id) < s.val(pivot);
      (isLow ? low : high).push(id);
      tags[id] = isLow ? 'low' : 'high';
      if (first || hi - lo > 3) {
        s.snap(first
          ? `Is ${s.val(id)} shorter than ${s.val(pivot)}? ${isLow ? 'Yes, so it will go on the left.' : 'No, so it will go on the right.'}`
          : `${s.val(id)}: ${isLow ? 'shorter, left pile' : 'taller, right pile'}.`,
        { pos: pos(), roles: { ...outside, ...tags, [pivot]: 'pick' }, marks: [{ kind: 'label', id: pivot, text: 'pivot' }, { kind: 'pointer', id, text: isLow ? 'shorter' : 'taller', role: isLow ? 'low' : 'high' }], pace: 'fast' });
      }
    }
    // Rearrange: shorter pile, pivot, taller pile.
    s.order.splice(lo, hi - lo + 1, ...low, pivot, ...high);
    lift.delete(pivot);
    const pivotAt = lo + low.length;
    if (pivotAt - 1 >= lo) gapAfter.add(pivotAt - 1);
    if (pivotAt <= hi - 1) gapAfter.add(pivotAt);
    s.setRole(pivot, 'done');
    s.snap(first
      ? `Now everyone moves: shorter blocks to the left, taller blocks to the right, with the pivot in between. The piles aren't sorted inside yet, but ${s.val(pivot)} is now in exactly the right spot. It will never move again.`
      : `Shorter blocks left, taller blocks right. ${s.val(pivot)} is in its final spot.`,
    { pos: pos(), roles: { ...outside, ...tags }, pace: first ? 'slow' : 'normal' });
    if (first) s.snap('Here is the clever part: we now do the exact same thing to each pile on its own, and those piles split into smaller piles, until every pile is tiny.', { pos: pos(), roles: { ...tags } });
    first = false;
    stack.push([pivotAt + 1, hi]);
    stack.push([lo, pivotAt - 1]);
  }
  gapAfter.clear();
  s.lastPos = pos();
  return s.finish('All sorted! Quick Sort is usually one of the fastest ways to sort, because each split roughly halves the work. Its weak spot: if the pivot is always the shortest or tallest block, the piles end up lopsided and it slows right down.');
}

// ---------------------------------------------------------------- Heap
function heap(values) {
  const s = new Story(values, { shape: 'ball' });
  const n = s.order.length;
  let size = n;
  const rowY = 485;
  const treeXY = (k) => {
    const level = Math.floor(Math.log2(k + 1));
    const count = 2 ** level;
    const posInLevel = k - (count - 1);
    return { x: 120 + (posInLevel + 0.5) * (760 / count), y: 75 + level * 118 };
  };
  const pos = (inTree = true) => {
    const p = new Map();
    s.order.forEach((id, i) => p.set(id, inTree && i < size ? treeXY(i) : { x: slotX(i, n, 118), y: rowY }));
    return p;
  };
  const edges = () => {
    const e = [];
    for (let k = 1; k < size; k++) e.push({ kind: 'edge', a: s.at(Math.floor((k - 1) / 2)), b: s.at(k) });
    return e;
  };
  s.snap('Heap Sort arranges the balls into a kind of family tree with one rule: every parent must be bigger than the children just below it. Then the biggest ball is always sitting at the very top.', { heading: 'Heap Sort', pace: 'slow', pos: pos(false) });
  s.snap('First, pour the line into the tree: one ball on top, two below it, then four, reading left to right.', { pos: pos(), marks: edges() });

  const siftDown = (k, detailed, phase) => {
    for (;;) {
      const l = 2 * k + 1;
      const rr = l + 1;
      if (l >= size) {
        if (detailed) s.snap(`${s.val(s.at(k))} has no children below it, so it's settled.`, { pos: pos(), marks: edges(), roles: { [s.at(k)]: 'focus' }, pace: 'fast' });
        return;
      }
      let big = l;
      if (rr < size && s.val(s.at(rr)) > s.val(s.at(l))) big = rr;
      const parent = s.at(k);
      const child = s.at(big);
      const kids = [s.at(l), rr < size ? s.at(rr) : undefined].filter((x) => x !== undefined);
      const roles = Object.fromEntries(kids.map((id) => [id, 'focus']));
      roles[parent] = 'pick';
      const kidText = list(kids.map((id) => s.val(id)));
      if (s.val(child) > s.val(parent)) {
        s.snap(detailed
          ? `Is ${s.val(parent)} bigger than its ${kids.length > 1 ? 'children' : 'child'} (${kidText})? No. The bigger child, ${s.val(child)}, trades places with it.`
          : `${s.val(parent)} vs ${kidText}: ${s.val(child)} is bigger, so they trade.`,
        { pos: pos(), marks: [...edges(), { kind: 'swap', a: parent, b: child }], roles, pace: detailed ? 'normal' : 'fast' });
        s.swap(k, big);
        k = big;
      } else {
        s.snap(detailed
          ? `Is ${s.val(parent)} bigger than its ${kids.length > 1 ? 'children' : 'child'} (${kidText})? Yes, so this part of the tree follows the rule.`
          : `${s.val(parent)} is bigger than ${kidText}. Settled.`,
        { pos: pos(), marks: [...edges(), { kind: 'check', a: parent, b: child }], roles, pace: phase === 'build' && detailed ? 'normal' : 'fast' });
        return;
      }
    }
  };

  s.snap('Now we fix the tree so it follows the rule. Start with the lowest parents and work up toward the top. If a parent is smaller than a child, the bigger child moves up.', { pos: pos(), marks: edges() });
  for (let k = Math.floor(n / 2) - 1; k >= 0; k--) siftDown(k, k >= Math.floor(n / 2) - 2, 'build');
  s.snap(`The tree follows the rule everywhere, so the biggest ball, ${s.val(s.at(0))}, is on top.`, { pos: pos(), marks: [...edges(), { kind: 'label', id: s.at(0), text: 'biggest' }], roles: { [s.at(0)]: 'pick' } });

  let round = 0;
  while (size > 1) {
    round++;
    const detailed = round === 1;
    const topId = s.at(0);
    const lastId = s.at(size - 1);
    s.snap(detailed
      ? `Take the top ball, ${s.val(topId)}, and swap it with the last ball in the tree, ${s.val(lastId)}. Then ${s.val(topId)} leaves the tree and goes to the end of the line, which is its final spot.`
      : `${s.val(topId)} is on top: swap it with ${s.val(lastId)} and move it into the line.`,
    { pos: pos(), marks: [...edges(), { kind: 'swap', a: topId, b: lastId }], roles: { [topId]: 'pick', [lastId]: 'focus' }, pace: detailed ? 'normal' : 'fast' });
    s.swap(0, size - 1);
    size--;
    s.setRole(topId, 'done');
    if (size > 1) {
      s.snap(detailed
        ? `Now ${s.val(s.at(0))} is on top, and it might be too small for that spot. It sinks down, trading places with its bigger child, until the rule holds again.`
        : `${s.val(s.at(0))} sinks down to its proper level.`,
      { pos: pos(), marks: edges(), roles: { [s.at(0)]: 'pick' }, pace: detailed ? 'normal' : 'fast' });
      siftDown(0, detailed, 'sort');
    }
  }
  s.setRole(s.at(0), 'done');
  size = 0;
  s.lastPos = pos(false);
  return s.finish('The last ball in the tree is the smallest, so it takes the first spot. All sorted! Heap Sort is reliably fast and needs no extra space, though in practice it tends to be a little slower than Quick Sort.');
}

const BUILDERS = { bubble, selection, insertion, cocktail, shell, merge, quick, heap };

// Hand-picked starting lines: small enough to follow, jumbled enough to be interesting.
export const LESSON_VALUES = {
  bubble: [5, 2, 7, 1, 8, 4],
  selection: [6, 3, 8, 2, 7, 4],
  insertion: [4, 7, 2, 8, 1, 5],
  cocktail: [3, 8, 4, 6, 7, 1],
  shell: [7, 3, 8, 6, 2, 5, 1, 4],
  merge: [6, 3, 8, 1, 7, 2, 5, 4],
  quick: [9, 1, 6, 3, 7, 2, 5],
  heap: [3, 6, 2, 8, 5, 9, 4],
};

export const LESSON_SUMMARIES = {
  bubble: { idea: 'Keep swapping neighbors that are in the wrong order.', good: 'Very easy to understand.', bad: 'Slow on big piles.' },
  selection: { idea: 'Find the shortest, put it first. Repeat.', good: 'Makes very few swaps.', bad: 'Always looks at every block, even when tidy.' },
  insertion: { idea: 'Slide each new block left into a growing sorted hand.', good: 'Fast when the line is almost sorted.', bad: 'Slow when it is badly jumbled.' },
  cocktail: { idea: 'Bubble Sort, but walking both ways.', good: 'Rescues short blocks stuck at the far end.', bad: 'Still slow on big piles.' },
  shell: { idea: 'Compare far-apart blocks first, then close ones.', good: 'Much quicker than Insertion Sort on a mess.', bad: 'Its speed depends on how the gaps are chosen.' },
  merge: { idea: 'Split into single blocks, then join sorted piles.', good: 'Fast and predictable, even for huge piles.', bad: 'Needs extra room to build the joined piles.' },
  quick: { idea: 'Split around a pivot, then repeat on each side.', good: 'Usually the fastest in practice.', bad: 'Slows down when the pivots are unlucky.' },
  heap: { idea: 'Keep the biggest at the top of a tree and take it off.', good: 'Reliably fast, no extra room needed.', bad: 'A little slower than Quick Sort in practice.' },
};

export function buildLesson(id, values = LESSON_VALUES[id]) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`No lesson for ${id}`);
  return build(values.slice());
}

export const LESSON_IDS = Object.keys(BUILDERS);
