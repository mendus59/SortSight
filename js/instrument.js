// Turns a user's plain `function sort(arr) { ... }` into steppable code.
//
// Every non-arrow function becomes a generator, a `yield <line>;` marker is
// placed before each statement (and at the top of every loop iteration), and
// calls to the user's own functions become `(yield __C(fn, ...args))` so the
// runner can drive recursion with an explicit stack instead of the JS call
// stack. Line numbers stay 1:1 with the editor because nothing adds newlines.

import { parse } from '../vendor/acorn.mjs';

const LOOP_TYPES = new Set([
  'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement',
]);

export class InstrumentError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

function isNode(v) {
  return v && typeof v === 'object' && typeof v.type === 'string';
}

// Named functions the user declared become generators; anonymous callbacks
// (e.g. a comparator passed to Array#sort) stay ordinary functions.
function collectFunctionNames(ast) {
  const names = new Set();
  const nodes = new Set();
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!isNode(node)) return;
    if (node.type === 'FunctionDeclaration' && node.id && !node.async && !node.generator) {
      names.add(node.id.name);
      nodes.add(node);
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init &&
        node.init.type === 'FunctionExpression' && !node.init.async && !node.init.generator) {
      names.add(node.id.name);
      nodes.add(node.init);
    }
    for (const key in node) {
      if (key === 'loc') continue;
      const v = node[key];
      if (v && typeof v === 'object') walk(v);
    }
  })(ast);
  return { names, nodes };
}

export function instrument(source) {
  let ast;
  try {
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  } catch (err) {
    const loc = err.loc || {};
    throw new InstrumentError(err.message, loc.line, loc.column);
  }

  const { names: userFns, nodes: generatorNodes } = collectFunctionNames(ast);
  // Edits: { start, end, text, kind: 'open' | 'close', depth }
  const edits = [];
  const insert = (pos, text, kind, depth) => edits.push({ start: pos, end: pos, text, kind, depth });
  const marker = (line) => `yield ${line};`;

  function visitList(list, depth, inGen) {
    for (const stmt of list) {
      if (inGen && stmt.type !== 'FunctionDeclaration' && stmt.type !== 'EmptyStatement') {
        insert(stmt.start, marker(stmt.loc.start.line), 'open', depth);
      }
      visit(stmt, depth + 1, inGen);
    }
  }

  // A statement in a single-statement slot (if branch, loop body).
  function visitSlot(stmt, depth, inGen, loopLine) {
    if (!inGen) { visit(stmt, depth + 1, inGen); return; }
    if (stmt.type === 'BlockStatement') {
      if (loopLine) insert(stmt.start + 1, marker(loopLine), 'open', depth + 1);
      visit(stmt, depth + 1, inGen);
      return;
    }
    let head = '{';
    if (loopLine) head += marker(loopLine);
    if (stmt.type !== 'EmptyStatement' && stmt.loc.start.line !== loopLine) {
      head += marker(stmt.loc.start.line);
    }
    insert(stmt.start, head, 'open', depth);
    visit(stmt, depth + 1, inGen);
    insert(stmt.end, '}', 'close', depth);
  }

  function visitFunction(node, depth) {
    const plain = generatorNodes.has(node) && source.startsWith('function', node.start);
    if (plain) insert(node.start + 'function'.length, '*', 'open', depth);
    for (const p of node.params) visit(p, depth + 1, false);
    const inGen = plain;
    if (node.body.type === 'BlockStatement') visitList(node.body.body, depth + 1, inGen);
    else visit(node.body, depth + 1, inGen);
  }

  function visit(node, depth, inGen) {
    if (Array.isArray(node)) { node.forEach((n) => visit(n, depth, inGen)); return; }
    if (!isNode(node)) return;

    switch (node.type) {
      case 'Program':
        visitList(node.body, depth, false);
        return;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        visitFunction(node, depth);
        return;
      case 'BlockStatement':
      case 'StaticBlock':
        visitList(node.body, depth, inGen);
        return;
      case 'SwitchCase':
        if (node.test) visit(node.test, depth + 1, inGen);
        visitList(node.consequent, depth, inGen);
        return;
      case 'IfStatement':
        visit(node.test, depth + 1, inGen);
        visitSlot(node.consequent, depth, inGen, 0);
        if (node.alternate) visitSlot(node.alternate, depth, inGen, 0);
        return;
      case 'CallExpression':
        if (inGen && node.callee.type === 'Identifier' && userFns.has(node.callee.name) && !node.optional) {
          const paren = source.indexOf('(', node.callee.end);
          const hasArgs = node.arguments.length > 0;
          edits.push({
            start: node.start, end: paren + 1,
            text: `(yield __C(${node.callee.name}${hasArgs ? ', ' : ''}`,
            kind: 'open', depth,
          });
          visit(node.arguments, depth + 1, inGen);
          insert(node.end, ')', 'close', depth);
          return;
        }
        break;
      default:
        if (LOOP_TYPES.has(node.type)) {
          for (const key of ['init', 'test', 'update', 'left', 'right']) {
            if (node[key]) visit(node[key], depth + 1, inGen);
          }
          visitSlot(node.body, depth, inGen, node.loc.start.line);
          return;
        }
    }

    for (const key in node) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const v = node[key];
      if (v && typeof v === 'object') visit(v, depth + 1, inGen);
    }
  }

  visit(ast, 0, false);

  // At the same position: closers before openers, outer openers first, inner closers first.
  edits.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.kind !== b.kind) return a.kind === 'close' ? -1 : 1;
    return a.kind === 'open' ? a.depth - b.depth : b.depth - a.depth;
  });

  let out = '';
  let pos = 0;
  for (const e of edits) {
    if (e.start < pos) continue; // defensive: never overlap
    out += source.slice(pos, e.start) + e.text;
    pos = e.end;
  }
  out += source.slice(pos);
  return out;
}
