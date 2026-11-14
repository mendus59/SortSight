// Built-in algorithms: the code shown in the editor, complexity facts, and a
// generator for each algorithm's worst-case input (a permutation of 1..n).

const ascending = (n) => Array.from({ length: n }, (_, i) => i + 1);
const descending = (n) => Array.from({ length: n }, (_, i) => n - i);

// The input that makes top-down merge sort do the most comparisons: undo a
// merge by sending alternating elements to each half, recursively.
function mergeWorst(n) {
  function unmerge(a) {
    if (a.length <= 1) return a;
    const left = [];
    const right = [];
    for (let i = 0; i < a.length; i++) (i % 2 === 0 ? left : right).push(a[i]);
    // Match the split the code uses: left half gets ceil(n/2) items.
    return unmerge(left).concat(unmerge(right));
  }
  return unmerge(ascending(n));
}

// Small values on odd indices, large values on even ones: halves that the
// even gaps of Shell's original sequence never mix until the final pass.
function shellWorst(n) {
  const half = Math.floor(n / 2);
  const out = new Array(n);
  let small = 1;
  let large = half + 1;
  for (let i = 0; i < n; i++) out[i] = i % 2 === 1 ? small++ : large++;
  return out;
}

export const ALGORITHMS = [
  {
    id: 'bubble',
    name: 'Bubble Sort',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
    blurb: 'Repeatedly walks the array, swapping neighbours that are out of order. Each pass bubbles the largest remaining value to the end. Stops early when a pass makes no swaps.',
    worstCase: descending,
    worstDescription: 'Values in descending order: every pair is inverted, so every comparison causes a swap and no pass can stop early.',
    code: `function sort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return arr;
}
`,
  },
  {
    id: 'selection',
    name: 'Selection Sort',
    complexity: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: false },
    blurb: 'Finds the smallest value in the unsorted part and swaps it into place, growing a sorted prefix one element at a time.',
    worstCase: descending,
    worstDescription: 'Descending order. Selection sort makes the same n(n-1)/2 comparisons on every input, so no input is asymptotically worse; descending order also maximises the number of times the running minimum changes.',
    code: `function sort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      if (arr[j] < arr[min]) {
        min = j;
      }
    }
    if (min !== i) {
      const tmp = arr[i];
      arr[i] = arr[min];
      arr[min] = tmp;
    }
  }
  return arr;
}
`,
  },
  {
    id: 'insertion',
    name: 'Insertion Sort',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
    blurb: 'Takes each value in turn and shifts larger values right until the gap is where it belongs, like sorting a hand of cards.',
    worstCase: descending,
    worstDescription: 'Values in descending order: each new value is smaller than everything before it, so it has to shift all the way to the front.',
    code: `function sort(arr) {
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
  return arr;
}
`,
  },
  {
    id: 'cocktail',
    name: 'Cocktail Shaker Sort',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true },
    blurb: 'A two-way bubble sort: passes alternate left-to-right and right-to-left, so small values near the end move quickly too.',
    worstCase: descending,
    worstDescription: 'Values in descending order: every pair is inverted, so every comparison swaps and both ends shrink by only one per pass.',
    code: `function sort(arr) {
  let start = 0;
  let end = arr.length - 1;
  let swapped = true;
  while (swapped) {
    swapped = false;
    for (let i = start; i < end; i++) {
      if (arr[i] > arr[i + 1]) {
        swap(arr, i, i + 1);
        swapped = true;
      }
    }
    end--;
    for (let i = end; i > start; i--) {
      if (arr[i - 1] > arr[i]) {
        swap(arr, i - 1, i);
        swapped = true;
      }
    }
    start++;
  }
  return arr;
}

function swap(arr, a, b) {
  const tmp = arr[a];
  arr[a] = arr[b];
  arr[b] = tmp;
}
`,
  },
  {
    id: 'shell',
    name: 'Shell Sort',
    complexity: { best: 'O(n log n)', average: '≈ O(n^1.5)', worst: 'O(n²)', space: 'O(1)', stable: false },
    blurb: 'Insertion sort over shrinking gaps (n/2, n/4, ... 1). Early passes move values long distances so the final gap-1 pass has little left to do.',
    worstCase: shellWorst,
    worstDescription: 'Small values on odd indices and large values on even indices. With Shell\'s halving gaps, even gaps never compare the two groups, leaving the final pass with a quadratic amount of work (exactly Θ(n²) when n is a power of two).',
    code: `function sort(arr) {
  const n = arr.length;
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < n; i++) {
      const value = arr[i];
      let j = i;
      while (j >= gap && arr[j - gap] > value) {
        arr[j] = arr[j - gap];
        j -= gap;
      }
      arr[j] = value;
    }
  }
  return arr;
}
`,
  },
  {
    id: 'merge',
    name: 'Merge Sort',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true },
    blurb: 'Splits the array in half, sorts each half recursively, then merges the two sorted halves using an auxiliary array.',
    worstCase: mergeWorst,
    worstDescription: 'An "un-merged" permutation: at every level the two halves interleave perfectly, so each merge must compare all the way to the last element instead of draining one side early. Still O(n log n), but the maximum number of comparisons.',
    code: `function sort(arr) {
  const aux = arr.slice();
  mergeSort(arr, aux, 0, arr.length - 1);
  return arr;
}

function mergeSort(arr, aux, lo, hi) {
  if (lo >= hi) return;
  const mid = Math.floor((lo + hi) / 2);
  mergeSort(arr, aux, lo, mid);
  mergeSort(arr, aux, mid + 1, hi);
  merge(arr, aux, lo, mid, hi);
}

function merge(arr, aux, lo, mid, hi) {
  for (let k = lo; k <= hi; k++) {
    aux[k] = arr[k];
  }
  let i = lo;
  let j = mid + 1;
  for (let k = lo; k <= hi; k++) {
    if (i > mid) {
      arr[k] = aux[j++];
    } else if (j > hi) {
      arr[k] = aux[i++];
    } else if (aux[j] < aux[i]) {
      arr[k] = aux[j++];
    } else {
      arr[k] = aux[i++];
    }
  }
}
`,
  },
  {
    id: 'quick',
    name: 'Quick Sort',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false },
    blurb: 'Picks a pivot (here the last element, Lomuto scheme), moves smaller values before it and larger after, then recurses on both sides.',
    worstCase: ascending,
    worstDescription: 'Already sorted, ascending. The last element is always the largest, so every partition splits off just one element: n levels of recursion and n²/2 comparisons. (Space also degrades to O(n) here.)',
    code: `function sort(arr) {
  quickSort(arr, 0, arr.length - 1);
  return arr;
}

function quickSort(arr, lo, hi) {
  if (lo >= hi) return;
  const p = partition(arr, lo, hi);
  quickSort(arr, lo, p - 1);
  quickSort(arr, p + 1, hi);
}

function partition(arr, lo, hi) {
  const pivot = arr[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (arr[j] < pivot) {
      swap(arr, i, j);
      i++;
    }
  }
  swap(arr, i, hi);
  return i;
}

function swap(arr, a, b) {
  const tmp = arr[a];
  arr[a] = arr[b];
  arr[b] = tmp;
}
`,
  },
  {
    id: 'heap',
    name: 'Heap Sort',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: false },
    blurb: 'Builds a max-heap inside the array, then repeatedly swaps the root (the maximum) to the end and sifts the new root down.',
    worstCase: ascending,
    worstDescription: 'Ascending order. Heap sort is O(n log n) on every input; with ascending data every value has to sift down the full height of the heap while the heap is being built.',
    code: `function sort(arr) {
  const n = arr.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDown(arr, i, n);
  }
  for (let end = n - 1; end > 0; end--) {
    const tmp = arr[0];
    arr[0] = arr[end];
    arr[end] = tmp;
    siftDown(arr, 0, end);
  }
  return arr;
}

function siftDown(arr, root, size) {
  while (true) {
    let largest = root;
    const left = 2 * root + 1;
    const right = left + 1;
    if (left < size && arr[left] > arr[largest]) largest = left;
    if (right < size && arr[right] > arr[largest]) largest = right;
    if (largest === root) return;
    const tmp = arr[root];
    arr[root] = arr[largest];
    arr[largest] = tmp;
    root = largest;
  }
}
`,
  },
];

export const CUSTOM_TEMPLATE = `// Write your own sort. It receives the array and should sort it in place.
// Helper functions are fine; declare them with \`function name() {}\`.
function sort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
      }
    }
  }
  return arr;
}
`;

export const CUSTOM = {
  id: 'custom',
  name: 'Your Own',
  complexity: { best: '?', average: '?', worst: '?', space: '?', stable: null },
  blurb: 'Edit the code to try your own algorithm. Every built-in sort is editable too: change one and it runs your version.',
  worstCase: descending,
  worstDescription: 'Descending order (a common worst case for comparison sorts). Load any other algorithm\'s worst case and switch back to try it here.',
  code: CUSTOM_TEMPLATE,
};

export const ALL = [...ALGORITHMS, CUSTOM];
