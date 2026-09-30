import test from 'node:test';
import assert from 'node:assert/strict';
import { addTile, newBoard, move, canMove, isValidState } from '../games/2048/engine.js';

const row = values => [...values, ...Array(12).fill(0)];
test('equal tiles merge once per turn and award their combined value', () => {
  const result = move(row([2, 2, 2, 2]), 'left');
  assert.deepEqual(result.board, row([4, 4, 0, 0]));
  assert.equal(result.score, 8);
  assert.equal(result.motions.length, 4);
  assert.deepEqual(move(row([2, 2, 4, 0]), 'left').board, row([4, 4, 0, 0]));
});
test('merge ordering follows the destination edge', () => {
  assert.deepEqual(move(row([2, 2, 2, 0]), 'right').board, row([0, 0, 2, 4]));
  assert.deepEqual(move(row([2, 0, 2, 4]), 'left').board, row([4, 4, 0, 0]));
});
test('vertical moves preserve columns and merge correctly', () => {
  const board = [2,4,0,0, 2,0,0,0, 4,4,0,0, 0,4,0,0];
  assert.deepEqual(move(board, 'up').board, [4,8,0,0, 4,4,0,0, 0,0,0,0, 0,0,0,0]);
  assert.deepEqual(move(board, 'down').board, [0,0,0,0, 0,0,0,0, 4,4,0,0, 4,8,0,0]);
});
test('invalid moves leave the board unchanged and never mutate input', () => {
  const board = Object.freeze(row([2,4,8,16]));
  assert.equal(move(board, 'left').changed, false);
  assert.equal(move(board, 'left').score, 0);
  assert.throws(() => move(board, 'diagonal'));
});
test('spawn selects an empty square and uses the 90/10 value split', () => {
  const board = row([2,4,8,16]);
  const result = addTile(board, () => 0);
  assert.equal(result.index, 4); assert.equal(result.board[4], 2); assert.equal(board[4], 0);
  const four = addTile(board, () => 0.99);
  assert.equal(four.index, 15); assert.equal(four.board[15], 4);
  assert.equal(newBoard(() => 0).filter(Boolean).length, 2);
  assert.equal(addTile(Array(16).fill(2)).index, -1);
});
test('game over requires a full board with no horizontal or vertical matches', () => {
  const lost = [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  assert.equal(canMove(lost), false);
  assert.equal(canMove(lost.map((v,i) => i === 15 ? 0 : v)), true);
  assert.equal(canMove(lost.map((v,i) => i === 15 ? 4 : v)), true);
});
test('stored state validation rejects corrupt or malicious values', () => {
  const valid = { board: row([2,4,0,0]), score: 4, continued: false };
  assert.equal(isValidState(valid), true);
  for (const state of [null, {}, { ...valid, score: -1 }, { ...valid, board: [2] }, { ...valid, board: row([3,0,0,0]) }, { ...valid, board: Array(16).fill(0) }, { ...valid, continued: 'yes' }]) assert.equal(isValidState(state), false);
});
test('moves conserve tile mass across many boards and directions', () => {
  let seed = 173;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = 0; i < 500; i++) {
    const board = Array.from({ length: 16 }, () => random() < .3 ? 0 : 2 ** (1 + Math.floor(random() * 8)));
    for (const direction of ['left','right','up','down']) {
      const result = move(board, direction);
      assert.equal(result.board.reduce((a,b) => a+b, 0), board.reduce((a,b) => a+b, 0));
      assert.equal(result.motions.length, board.filter(Boolean).length);
      assert.equal(result.changed, result.board.some((v,i) => v !== board[i]));
    }
  }
});
