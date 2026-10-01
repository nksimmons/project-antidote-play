import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, WIDTH, HEIGHT, piece, cells, fits, translate, rotate, ghost, clearLines, shuffledBag, newGame, lock, hardDrop, validState } from '../games/blocks/engine.js';

const empty = () => Array(WIDTH * HEIGHT).fill(0);
test('bag contains every piece once and new games are valid', () => {
  assert.deepEqual(shuffledBag(() => .5).sort(), Object.keys(SHAPES).sort());
  assert.equal(validState(newGame()), true);
  for (const type of Object.keys(SHAPES)) assert.equal(cells(piece(type)).length, 4);
});
test('pieces respect walls, floor, and occupied squares', () => {
  const board = empty(); const active = { ...piece('O'), x: 0, y: 18 };
  assert.equal(fits(board, active), true);
  assert.equal(translate(board, active, -1, 0), active);
  assert.equal(translate(board, active, 0, 1), active);
  board[18 * WIDTH + 2] = 3;
  assert.equal(translate(board, active, 1, 0), active);
});
test('rotation preserves cells and returns to the original orientation', () => {
  for (const type of Object.keys(SHAPES)) {
    const original = piece(type); let active = original;
    for (let i = 0; i < 4; i++) { active = rotate(empty(), active); assert.equal(cells(active).length, 4); }
    assert.deepEqual(active.matrix, original.matrix);
  }
  let wall = rotate(empty(), piece('I'));
  wall = { ...wall, x: -2 };
  assert.equal(fits(empty(), wall), true);
  assert.equal(fits(empty(), rotate(empty(), wall)), true);
});
test('ghost lands on the stack and hard drop locks and awards distance points', () => {
  const state = newGame(() => .5); state.active = piece('O');
  assert.equal(ghost(state.board, state.active).y, 18);
  const result = hardDrop(state, () => .5);
  assert.equal(result.state.score, 36);
  assert.equal(result.state.board.filter(Boolean).length, 4);
  assert.equal(validState(result.state), true);
});
test('line clearing preserves non-full rows and scores multiple lines at current level', () => {
  const board = empty();
  board[10] = 5;
  board.fill(3, 180);
  board[184] = board[185] = board[194] = board[195] = 0;
  const state = { ...newGame(), board, active: { ...piece('O'), x: 4, y: 18 }, lines: 10 };
  const result = lock(state);
  assert.equal(result.cleared, 2);
  assert.equal(result.state.score, 600);
  assert.equal(result.state.lines, 12);
  assert.equal(result.state.board[30], 5);
  assert.equal(result.state.board.filter(Boolean).length, 1);
  assert.equal(clearLines(empty()).cleared, 0);
});
test('blocked spawning ends the game and persisted shape corruption is rejected', () => {
  const state = newGame(); state.queue[0] = 'O';
  state.board[4] = 1; state.active = { ...piece('O'), x: 0, y: 18 };
  const result = lock(state);
  assert.equal(result.state.over, true);
  assert.equal(validState(result.state), true);
  assert.equal(validState({ ...state, active: { ...state.active, matrix: [[1]] } }), false);
  assert.equal(validState({ ...state, queue: ['bogus'] }), false);
  assert.equal(validState({ ...state, score: -1 }), false);
  assert.equal(validState(null), false);
});
