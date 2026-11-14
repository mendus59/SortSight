# SortSight: portfolio summary

**Pitch:** An interactive sorting-algorithm visualizer that highlights each line of code as it runs and lets you write your own sort and watch it work.

- **Live demo:** https://mendus59.github.io/SortSight/
- **Source:** https://github.com/mendus59/SortSight
- **Screenshot:** `docs/screenshot.png` (raw: https://raw.githubusercontent.com/mendus59/SortSight/main/docs/screenshot.png)
- **Type:** Web app (static site, GitHub Pages)
- **Year:** 2026
- **Tags:** JavaScript, Algorithms, Data Visualization, Canvas, Web Workers, Education

## Description

SortSight shows how sorting algorithms really behave. Pick Bubble, Selection, Insertion, Cocktail Shaker, Shell, Merge, Quick or Heap Sort, and its `sort()` function appears next to a live bar chart. As the sort runs, the line that is executing is highlighted, and the bars it reads and writes are lit up. The code is fully editable: change an algorithm, or write one from scratch, and SortSight runs your version. The same data sets (random, worst-case for each algorithm, or your own values) replay in identical order across algorithms, so the comparison table shows a fair head-to-head of steps, reads and writes.

## Highlights

- Step-through execution of arbitrary user code. The code is parsed with Acorn and rewritten into generators that yield before every statement, so the visualizer can pause on any line.
- Sandboxed in a Web Worker with a watchdog. Infinite loops or crashes in user code can't freeze the page.
- Recursion is trampolined on an explicit stack, so worst-case Quick Sort on 10,000 items (10,000 levels deep) runs without a stack overflow.
- Canvas rendering scales to 10,000 bars. When there are more bars than pixels, each pixel column shows the min/max range of the bars it covers.
- Speeds from 1 step per second up to millions of steps per second, plus Pause, single-Step and Reset.
- Worst-case input generators for every algorithm, each with an explanation, and the values are shown.
- Best, average and worst time, space and stability for each algorithm.
- A "Run every sort on this set" benchmark that fills a comparison table.
- Tests (node:test) cover every algorithm, the code rewriter, error reporting and hang protection. CI deploys to GitHub Pages.

## Tech stack

Vanilla JavaScript (ES modules), HTML5 Canvas, Web Workers, Acorn (JS parser), CodeMirror 5, CSS Grid, GitHub Actions + GitHub Pages. No framework and no build step.

## Short blurb (for cards)

> SortSight: watch sorting algorithms run line by line, edit their code live, and compare them on identical data sets up to 10,000 items.
