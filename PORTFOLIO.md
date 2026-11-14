# SortSight: portfolio summary

**Pitch:** An interactive sorting-algorithm visualizer that highlights each line of code as it runs and lets you write your own sort and watch it work. A hand-drawn whiteboard tutorial mode explains every sort in plain English for people who have never written code.

- **Live demo:** https://mendus59.github.io/SortSight/
- **Source:** https://github.com/mendus59/SortSight
- **Screenshot:** `docs/screenshot.png` (raw: https://raw.githubusercontent.com/mendus59/SortSight/main/docs/screenshot.png)
- **Tutorial screenshot:** `docs/tutorial-screenshot.png` (raw: https://raw.githubusercontent.com/mendus59/SortSight/main/docs/tutorial-screenshot.png)
- **Tutorial demo:** https://mendus59.github.io/SortSight/tutorial.html
- **Type:** Web app (static site, GitHub Pages)
- **Year:** 2026
- **Tags:** JavaScript, Algorithms, Data Visualization, Canvas, Web Workers, Education, Animation

## Description

SortSight shows how sorting algorithms really behave. Pick Bubble, Selection, Insertion, Cocktail Shaker, Shell, Merge, Quick or Heap Sort, and its `sort()` function appears next to a live bar chart. As the sort runs, the line that is executing is highlighted, and the bars it reads and writes are lit up. The code is fully editable: change an algorithm, or write one from scratch, and SortSight runs your version. The same data sets (random, worst-case for each algorithm, or your own values) replay in identical order across algorithms, so the comparison table shows a fair head-to-head of steps, reads and writes.

For non-technical visitors, a **whiteboard tutorial mode** tells each sort as a short hand-drawn story. A handful of sketchy marker-drawn blocks hop and swap on a whiteboard while a handwritten caption explains each step in plain English ("Is 8 taller than 4? Yes, so they swap places."), with no code or jargon. Each lesson ends with what the method is good and bad at.

## Highlights

- Step-through execution of arbitrary user code. The code is parsed with Acorn and rewritten into generators that yield before every statement, so the visualizer can pause on any line.
- Sandboxed in a Web Worker with a watchdog. Infinite loops or crashes in user code can't freeze the page.
- Recursion is trampolined on an explicit stack, so worst-case Quick Sort on 10,000 items (10,000 levels deep) runs without a stack overflow.
- Canvas rendering scales to 10,000 bars. When there are more bars than pixels, each pixel column shows the min/max range of the bars it covers.
- Speeds from 1 step per second up to millions of steps per second, plus Pause, single-Step and Reset.
- Worst-case input generators for every algorithm, each with an explanation, and the values are shown.
- Best, average and worst time, space and stability for each algorithm.
- A "Run every sort on this set" benchmark that fills a comparison table.
- Whiteboard tutorials for all eight sorts: an original hand-drawn renderer (wobbly marker strokes, hatching, write-on animation and gentle line boil) on canvas, with typed-out captions, play/pause, step and scrub controls, and reduced-motion support. Tests check every lesson ends sorted and that captions avoid jargon.
- Tests (node:test) cover every algorithm, the code rewriter, error reporting and hang protection. CI deploys to GitHub Pages.

## Tech stack

Vanilla JavaScript (ES modules), HTML5 Canvas, Web Workers, Acorn (JS parser), CodeMirror 5, CSS Grid, GitHub Actions + GitHub Pages. No framework and no build step.

## Short blurb (for cards)

> SortSight: watch sorting algorithms run line by line, edit their code live, compare them on data sets up to 10,000 items, or learn them from plain-English whiteboard tutorials.
