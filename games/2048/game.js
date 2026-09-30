import { addTile, newBoard, move, canMove, isValidState } from './engine.js';

const SAVE_KEY = 'antidote:2048:save';
const BEST_KEY = 'antidote:2048:best';
export function readBest() {
  try { const value = Number(localStorage.getItem(BEST_KEY)); return Number.isSafeInteger(value) && value > 0 ? value : 0; } catch { return 0; }
}

export function mountGame(root, { onScore = () => {} } = {}) {
  let state;
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (isValidState(saved)) state = saved;
  } catch { /* Invalid or unavailable storage must never prevent play. */ }
  state ||= { board: newBoard(), score: 0, continued: false };
  let best = Math.max(readBest(), state.score);
  let previous = null;
  let timer;
  let busy = false;
  let pointer = null;
  const abort = new AbortController();
  const listen = (element, type, handler, options = {}) => element.addEventListener(type, handler, { ...options, signal: abort.signal });

  root.innerHTML = `
    <section class="game-page" aria-labelledby="game-title">
      <a class="back-link" href="#/library">← Back to the arcade</a>
      <div class="game-layout">
        <div class="game-intro"><span class="eyebrow">A LITTLE FOCUS GOES A LONG WAY</span><h1 id="game-title">2048<span>.</span></h1><p>Small moves.<br> Beautiful possibilities.</p><div class="game-instructions"><h2>Find your next move.</h2><p>Slide the tiles. Match two of the same number to combine them. Keep going until you reach <strong>2048</strong>.</p><p>Use your <strong>arrow keys</strong> or <strong>W A S D</strong>, swipe the board, or use the buttons below it.</p></div><span class="game-note">No timer. No pressure. Take your time.</span></div>
        <div class="game-console">
          <div class="score-row"><div class="score-box"><span>SCORE</span><strong id="score">0</strong></div><div class="score-box best-box"><span>PERSONAL BEST</span><strong id="best">0</strong></div><button class="new-game" id="new-game">New game <span aria-hidden="true">↗</span></button></div>
          <div class="board-wrap"><div class="board" id="board" tabindex="0" role="group" aria-label="2048 board" aria-describedby="board-help"><div class="board-cells" aria-hidden="true">${'<div></div>'.repeat(16)}</div><div class="tile-layer" aria-hidden="true"></div></div><div class="game-overlay" hidden><span class="eyebrow" id="result-label"></span><h2 id="result-title"></h2><p id="result-copy"></p><button class="card-button" id="result-action"></button><button class="overlay-secondary" id="result-undo" hidden>Undo last move</button></div></div>
          <div class="board-tools"><button class="undo-button" id="undo" disabled><span aria-hidden="true">↶</span> Undo</button><div class="direction-pad" aria-label="Move tiles"><button data-direction="left" aria-label="Move left">←</button><button data-direction="up" aria-label="Move up">↑</button><button data-direction="down" aria-label="Move down">↓</button><button data-direction="right" aria-label="Move right">→</button></div></div>
          <p class="save-note" id="save-note">Progress saved on this device. Pick up whenever.</p><p class="sr-only" id="board-help">Use arrow keys or W A S D to slide tiles. The board description lists each row. Empty cells are announced as blank.</p><p class="sr-only" id="game-status" role="status" aria-live="polite" aria-atomic="true"></p>
        </div>
      </div>
      <dialog class="info-dialog" id="restart-dialog"><span class="eyebrow">A FRESH START</span><h2>Start a new game?</h2><p>Your current board will be replaced. Your personal best stays with you.</p><div class="restart-actions"><button id="cancel-restart">Keep playing</button><button class="card-button" id="confirm-restart">Start fresh</button></div></dialog>
    </section>`;
  const $ = selector => root.querySelector(selector);
  const board = $('#board');
  const layer = $('.tile-layer');
  const overlay = $('.game-overlay');
  const restartDialog = $('#restart-dialog');
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      localStorage.setItem(BEST_KEY, String(best));
    } catch { storageAvailable = false; }
    $('#save-note').textContent = storageAvailable ? 'Progress saved on this device. Pick up whenever.' : 'Storage unavailable. You can play, but progress may not be saved.';
    onScore(best);
  }
  function position(element, index) {
    element.style.setProperty('--x', index % 4);
    element.style.setProperty('--y', Math.floor(index / 4));
  }
  function render(spawned = -1, merged = []) {
    layer.replaceChildren();
    state.board.forEach((value, index) => {
      if (!value) return;
      const tile = document.createElement('div');
      tile.className = `number-tile value-${Math.min(value, 2048)}${index === spawned ? ' spawned' : ''}${merged.includes(index) ? ' merged' : ''}`;
      tile.dataset.index = index;
      const face = document.createElement('span');
      face.textContent = value;
      if (value >= 16384) face.classList.add('small-number');
      tile.append(face);
      position(tile, index);
      layer.append(tile);
    });
    $('#score').textContent = state.score.toLocaleString();
    $('#best').textContent = best.toLocaleString();
    $('#undo').disabled = !previous;
    board.setAttribute('aria-label', '2048 board. ' + Array.from({ length: 4 }, (_, row) => `Row ${row + 1}: ${state.board.slice(row * 4, row * 4 + 4).map(v => v || 'blank').join(', ')}.`).join(' '));
    const won = state.board.some(value => value >= 2048) && !state.continued;
    const ended = !canMove(state.board);
    overlay.hidden = !(won || ended);
    if (!overlay.hidden) {
      $('#result-label').textContent = won ? 'A LITTLE MOMENT OF VICTORY' : 'EVERY END IS A NEW BEGINNING';
      $('#result-title').textContent = won ? 'Hello, 2048.' : 'Well played.';
      $('#result-copy').textContent = won ? 'You found your way. See how far you can go?' : `You scored ${state.score.toLocaleString()}. Ready for another round?`;
      $('#result-action').textContent = won ? 'Keep going →' : 'Play again →';
      $('#result-undo').hidden = !ended || won || !previous;
      $('#game-status').textContent = `${$('#result-title').textContent} ${$('#result-copy').textContent}`;
    }
  }
  function play(direction) {
    if (busy || !overlay.hidden || restartDialog.open) return;
    const result = move(state.board, direction);
    if (!result.changed) return;
    previous = structuredClone(state);
    const spawned = addTile(result.board);
    state = { ...state, board: spawned.board, score: state.score + result.score };
    best = Math.max(best, state.score);
    persist();
    busy = true;
    for (const motion of result.motions) {
      const tile = layer.querySelector(`[data-index="${motion.from}"]`);
      if (tile) position(tile, motion.to);
    }
    timer = setTimeout(() => {
      busy = false;
      render(spawned.index, result.motions.filter(m => m.merged).map(m => m.to));
      if (overlay.hidden) $('#game-status').textContent = `Score ${state.score}. ${result.score ? `Merged for ${result.score} points.` : 'Tiles moved.'}`;
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 145);
  }
  function fresh() {
    clearTimeout(timer);
    busy = false;
    previous = null;
    state = { board: newBoard(), score: 0, continued: false };
    render(); persist();
    $('#game-status').textContent = 'New game started.';
    board.focus({ preventScroll: true });
  }
  function undo() {
    if (!previous || busy) return;
    state = previous;
    previous = null;
    render(); persist();
    $('#game-status').textContent = 'Last move undone.';
    board.focus({ preventScroll: true });
  }
  const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  listen(window, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    const direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (direction) { event.preventDefault(); play(direction); }
  });
  listen(board, 'pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    board.setPointerCapture(event.pointerId);
  });
  listen(board, 'pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  listen(board, 'pointercancel', () => { pointer = null; });
  root.querySelectorAll('[data-direction]').forEach(button => listen(button, 'click', () => play(button.dataset.direction)));
  listen($('#undo'), 'click', undo);
  listen($('#result-undo'), 'click', undo);
  listen($('#new-game'), 'click', () => restartDialog.showModal());
  listen($('#cancel-restart'), 'click', () => restartDialog.close());
  listen($('#confirm-restart'), 'click', () => { restartDialog.close(); fresh(); });
  listen($('#result-action'), 'click', () => {
    if (state.board.some(value => value >= 2048) && !state.continued) {
      state.continued = true; render(); persist(); board.focus({ preventScroll: true });
    } else fresh();
  });
  render(); persist();
  return () => { clearTimeout(timer); abort.abort(); if (restartDialog.open) restartDialog.close(); };
}
