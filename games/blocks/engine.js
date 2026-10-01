export const WIDTH = 10;
export const HEIGHT = 20;
export const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[2,2],[2,2]],
  T: [[0,3,0],[3,3,3],[0,0,0]],
  S: [[0,4,4],[4,4,0],[0,0,0]],
  Z: [[5,5,0],[0,5,5],[0,0,0]],
  J: [[6,0,0],[6,6,6],[0,0,0]],
  L: [[0,0,7],[7,7,7],[0,0,0]],
};

export function shuffledBag(random = Math.random) {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function piece(type) {
  const matrix = SHAPES[type].map(row => [...row]);
  return { type, matrix, x: Math.floor((WIDTH - matrix.length) / 2), y: 0 };
}

export function cells(active) {
  return active.matrix.flatMap((row, y) => row.flatMap((value, x) => value ? [{ x: active.x + x, y: active.y + y, value }] : []));
}

export function fits(board, active) {
  return cells(active).every(({ x, y }) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && !board[y * WIDTH + x]);
}

export function translate(board, active, dx, dy) {
  const candidate = { ...active, x: active.x + dx, y: active.y + dy };
  return fits(board, candidate) ? candidate : active;
}

export function rotate(board, active, reverse = false) {
  if (active.type === 'O') return active;
  const size = active.matrix.length;
  const matrix = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => reverse ? active.matrix[x][size - 1 - y] : active.matrix[size - 1 - x][y]));
  // Small wall/floor adjustments keep rotation usable beside the stack.
  for (const [dx, dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,-2]]) {
    const candidate = { ...active, matrix, x: active.x + dx, y: active.y + dy };
    if (fits(board, candidate)) return candidate;
  }
  return active;
}

export function ghost(board, active) {
  let result = active;
  while (true) {
    const next = translate(board, result, 0, 1);
    if (next === result) return result;
    result = next;
  }
}

export function clearLines(board) {
  const rows = Array.from({ length: HEIGHT }, (_, row) => board.slice(row * WIDTH, (row + 1) * WIDTH));
  const remaining = rows.filter(row => row.some(value => !value));
  const cleared = HEIGHT - remaining.length;
  return { board: [...Array(cleared * WIDTH).fill(0), ...remaining.flat()], cleared };
}

function spawn(state, random) {
  const queue = [...state.queue];
  if (queue.length < 7) queue.push(...shuffledBag(random));
  const active = piece(queue.shift());
  return { ...state, queue, active, over: !fits(state.board, active) };
}

export function newGame(random = Math.random) {
  return spawn({ board: Array(WIDTH * HEIGHT).fill(0), queue: [], score: 0, lines: 0, over: false }, random);
}

export function lock(state, random = Math.random) {
  const board = [...state.board];
  for (const { x, y, value } of cells(state.active)) board[y * WIDTH + x] = value;
  const cleared = clearLines(board);
  const score = [0,100,300,500,800][cleared.cleared] * (Math.floor(state.lines / 10) + 1);
  return { state: spawn({ ...state, board: cleared.board, score: state.score + score, lines: state.lines + cleared.cleared }, random), cleared: cleared.cleared };
}

export function hardDrop(state, random = Math.random) {
  const active = ghost(state.board, state.active);
  return lock({ ...state, active, score: state.score + (active.y - state.active.y) * 2 }, random);
}

export function validState(state) {
  if (!state || !Array.isArray(state.board) || state.board.length !== WIDTH * HEIGHT ||
      !state.board.every(n => Number.isInteger(n) && n >= 0 && n <= 7) ||
      !['score', 'lines'].every(key => Number.isSafeInteger(state[key]) && state[key] >= 0) ||
      typeof state.over !== 'boolean' || !Array.isArray(state.queue) || state.queue.length < 1 || state.queue.length > 13 ||
      !state.queue.every(type => Object.hasOwn(SHAPES, type))) return false;
  const active = state.active;
  if (!active || !Object.hasOwn(SHAPES, active.type) || !Number.isInteger(active.x) || !Number.isInteger(active.y) ||
      active.x < -3 || active.x > WIDTH || active.y < 0 || active.y >= HEIGHT) return false;
  const shape = SHAPES[active.type];
  if (!Array.isArray(active.matrix) || active.matrix.length !== shape.length ||
      !active.matrix.every(row => Array.isArray(row) && row.length === shape.length)) return false;
  let expected = shape;
  const validRotation = Array.from({ length: 4 }, () => {
    const matches = JSON.stringify(active.matrix) === JSON.stringify(expected);
    expected = expected[0].map((_, x) => expected.map(row => row[x]).reverse());
    return matches;
  }).some(Boolean);
  return validRotation && (state.over || fits(state.board, active));
}
