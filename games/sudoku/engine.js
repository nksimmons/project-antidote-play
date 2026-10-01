export const LEVELS = { easy: 42, medium: 34, hard: 28 };
export const peers = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9), col = index % 9;
  return Array.from({ length: 81 }, (_, other) => other).filter(other => other !== index && (
    Math.floor(other / 9) === row || other % 9 === col ||
    (Math.floor(other / 27) === Math.floor(row / 3) && Math.floor((other % 9) / 3) === Math.floor(col / 3))
  ));
});

export function candidates(board, index) {
  const used = new Set(peers[index].map(other => board[other]));
  return [1,2,3,4,5,6,7,8,9].filter(value => !used.has(value));
}

export function conflicts(board) {
  return new Set(board.flatMap((value, index) => value && peers[index].some(other => board[other] === value) ? [index] : []));
}

export function countSolutions(input, limit = 2) {
  if (conflicts(input).size) return 0;
  const board = [...input];
  let count = 0;
  function search() {
    if (count >= limit) return;
    let target = -1, options;
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const available = candidates(board, i);
      if (!available.length) return;
      if (target < 0 || available.length < options.length) { target = i; options = available; }
      if (available.length === 1) break;
    }
    if (target < 0) { count++; return; }
    for (const value of options) {
      board[target] = value;
      search();
      if (count >= limit) break;
    }
    board[target] = 0;
  }
  search();
  return count;
}

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generate(level = 'medium', random = Math.random) {
  if (!Object.hasOwn(LEVELS, level)) throw new Error('Unknown difficulty');
  const order = () => shuffle([0,1,2], random).flatMap(group => shuffle([0,1,2], random).map(offset => group * 3 + offset));
  const rows = order(), cols = order(), digits = shuffle([1,2,3,4,5,6,7,8,9], random);
  const solution = rows.flatMap(row => cols.map(col => digits[(row * 3 + Math.floor(row / 3) + col) % 9]));
  const puzzle = [...solution];
  let clues = 81;
  for (const index of shuffle(Array.from({ length: 81 }, (_, i) => i), random)) {
    if (clues <= LEVELS[level]) break;
    const value = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle) === 1) clues--;
    else puzzle[index] = value;
  }
  return { puzzle, solution, level, values: [...puzzle], notes: Array(81).fill(0), hints: 0, completed: false };
}

export function isComplete(state) {
  return state.values.every((value, i) => value === state.solution[i]);
}

export function validState(state) {
  const grid = (values, min = 0, max = 9) => Array.isArray(values) && values.length === 81 && values.every(n => Number.isInteger(n) && n >= min && n <= max);
  return !!state && Object.hasOwn(LEVELS, state.level) && grid(state.puzzle) && grid(state.solution, 1) &&
    grid(state.values) && grid(state.notes, 0, 511) && Number.isSafeInteger(state.hints) && state.hints >= 0 &&
    typeof state.completed === 'boolean' && conflicts(state.solution).size === 0 &&
    state.puzzle.some(Boolean) && state.puzzle.every((value, i) => !value || (value === state.solution[i] && value === state.values[i])) &&
    (!state.completed || isComplete(state));
}
