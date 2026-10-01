import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, countSolutions, conflicts, candidates, peers, validState, isComplete, LEVELS } from '../games/sudoku/engine.js';

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

test('generated puzzles have valid givens and exactly one solution across clue settings', () => {
  const layouts = new Set();
  for (const level of Object.keys(LEVELS)) for (let seed = 1; seed <= 8; seed++) {
    const state = generate(level, seeded(seed));
    assert.equal(validState(state), true);
    assert.equal(conflicts(state.solution).size, 0);
    assert.equal(countSolutions(state.puzzle), 1);
    assert.ok(state.puzzle.filter(Boolean).length >= LEVELS[level]);
    assert.ok(state.puzzle.filter(Boolean).length < 50);
    assert.ok(state.puzzle.every((v,i) => !v || v === state.solution[i]));
    assert.equal(isComplete(state), false);
    layouts.add(state.puzzle.join(''));
  }
  assert.equal(layouts.size, 24);
});

test('conflicts and candidates respect rows, columns, and boxes', () => {
  const board = Array(81).fill(0); board[0] = 5;
  assert.equal(peers[0].length, 20);
  for (const index of [1,9,10]) { board[index] = 5; assert.ok(conflicts(board).has(index)); board[index] = 0; }
  board[40] = 5; assert.equal(conflicts(board).size, 0);
  assert.ok(!candidates(board, 1).includes(5));
  board[1] = 5; assert.equal(countSolutions(board), 0);
  assert.equal(countSolutions(Array(81).fill(0)), 2);
});

test('completion and saved-state validation reject malformed boards', () => {
  const state = generate('easy', seeded(44));
  state.values = [...state.solution]; state.completed = true;
  assert.equal(isComplete(state), true); assert.equal(validState(state), true);
  assert.equal(validState({ ...state, notes: Array(81).fill(512) }), false);
  assert.equal(validState({ ...state, values: Array(81).fill(0) }), false);
  assert.equal(validState({ ...state, solution: Array(81).fill(1) }), false);
  assert.equal(validState({ ...state, level: '__proto__' }), false);
  assert.equal(validState(null), false);
});
