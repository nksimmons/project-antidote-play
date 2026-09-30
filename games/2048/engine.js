export const SIZE = 4;

export function addTile(board, random = Math.random) {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return { board: [...board], index: -1 };
  const index = empty[Math.floor(random() * empty.length)];
  const result = [...board];
  result[index] = random() < 0.9 ? 2 : 4;
  return { board: result, index };
}

export function newBoard(random = Math.random) {
  return addTile(addTile(Array(16).fill(0), random).board, random).board;
}

// Traverse each line starting at the destination edge. Each output tile can
// merge only once per turn; motion records let the view animate every tile.
export function move(board, direction) {
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('Invalid direction');
  const result = Array(16).fill(0);
  const motions = [];
  let score = 0;
  for (let line = 0; line < SIZE; line++) {
    const indices = Array.from({ length: SIZE }, (_, step) => {
      if (direction === 'left') return line * SIZE + step;
      if (direction === 'right') return line * SIZE + SIZE - 1 - step;
      if (direction === 'up') return step * SIZE + line;
      return (SIZE - 1 - step) * SIZE + line;
    });
    const occupied = indices.filter(index => board[index]);
    let output = 0;
    for (let cursor = 0; cursor < occupied.length; cursor++) {
      const from = occupied[cursor];
      const to = indices[output++];
      const value = board[from];
      if (cursor + 1 < occupied.length && board[occupied[cursor + 1]] === value) {
        result[to] = value * 2;
        score += value * 2;
        motions.push({ from, to, merged: true }, { from: occupied[++cursor], to, merged: true });
      } else {
        result[to] = value;
        motions.push({ from, to, merged: false });
      }
    }
  }
  return { board: result, score, motions, changed: result.some((value, index) => value !== board[index]) };
}

export function canMove(board) {
  return board.some((value, index) => !value ||
    (index % SIZE < SIZE - 1 && value === board[index + 1]) ||
    (index < SIZE * (SIZE - 1) && value === board[index + SIZE]));
}

export function isValidState(state) {
  return !!state && Array.isArray(state.board) && state.board.length === 16 &&
    state.board.every(value => Number.isSafeInteger(value) && (value === 0 || (value >= 2 && Number.isInteger(Math.log2(value))))) &&
    state.board.some(Boolean) && Number.isSafeInteger(state.score) && state.score >= 0 &&
    typeof state.continued === 'boolean';
}
