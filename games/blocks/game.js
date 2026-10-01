import { WIDTH, HEIGHT, SHAPES, newGame, validState, cells, translate, rotate, ghost, lock, hardDrop } from './engine.js';
import { readSave, readRecord, save, bindings } from '../shared.js';

const KEY = 'antidote:blocks:save';
const BEST = 'antidote:blocks:best';
export const readBlocksBest = () => readRecord(BEST);

export function mountBlocks(root) {
  let state = readSave(KEY, validState) || newGame();
  let best = Math.max(readBlocksBest(), state.score);
  let paused = true;
  let started = false;
  let timer;
  let pointer;
  const { on, dispose } = bindings();
  root.innerHTML = `
    <section class="arcade-game blocks-game" aria-labelledby="blocks-title">
      <a class="arcade-back" href="#/library">← Back to the arcade</a>
      <div class="play-layout">
        <div class="play-intro"><span class="eyebrow">MAKE ROOM FOR PLAY</span><h1 id="blocks-title">Blocks<span>.</span></h1><p class="play-tagline">Find the fit.<br>Feel the flow.</p><div class="play-instructions"><p>Move and rotate falling pieces. Complete a horizontal line to clear it. Keep room at the top for the next piece.</p><p><strong>← →</strong> move · <strong>↑</strong> rotate · <strong>↓</strong> fall faster · <strong>Space</strong> drop · <strong>P</strong> pause. Use the buttons on touch screens, or swipe sideways to move, tap to rotate, and swipe down to drop.</p><p>The outline shows where your piece will land. Every 10 lines brings a little more pace.</p></div><div class="blocks-next"><span class="eyebrow">UP NEXT</span><div id="blocks-next" aria-label="Next piece"></div></div></div>
        <div class="play-panel">
          <div class="play-stats"><div class="play-stat"><span>SCORE</span><strong id="blocks-score">0</strong></div><div class="play-stat"><span>BEST</span><strong id="blocks-best">0</strong></div><div class="play-stat"><span>LINES · LEVEL</span><strong id="blocks-lines">0 · 1</strong></div></div>
          <div class="blocks-stage"><div class="blocks-board" id="blocks-board" tabindex="0" role="group" aria-label="Blocks playfield">${'<span aria-hidden="true"></span>'.repeat(WIDTH * HEIGHT)}</div><div class="blocks-overlay" id="blocks-overlay"><span class="eyebrow" id="blocks-label"></span><h2 id="blocks-result"></h2><p id="blocks-copy"></p><button class="play-button play-primary" id="blocks-start"></button></div></div>
          <div class="blocks-controls" role="group" aria-label="Piece controls"><button class="play-button" data-action="left" aria-label="Move left">←</button><button class="play-button" data-action="rotate" aria-label="Rotate clockwise">↻</button><button class="play-button" data-action="right" aria-label="Move right">→</button><button class="play-button" data-action="down" aria-label="Move down">↓</button><button class="play-button play-primary" data-action="drop">Drop</button></div>
          <div class="play-toolbar"><button class="play-button" id="blocks-pause">Resume</button><button class="play-button" id="blocks-new">New game</button></div>
          <p class="play-message" id="blocks-status" role="status" aria-live="polite">Take a breath. Play when you’re ready.</p><p class="play-save" id="blocks-save"></p>
        </div>
      </div>
      <dialog class="info-dialog play-dialog" id="blocks-dialog"><span class="eyebrow">ANOTHER ROUND</span><h2>Make a little room.</h2><p>Start over with a clear board? Your personal best stays.</p><div class="play-dialog-actions"><button class="play-button" id="blocks-cancel">Keep this game</button><button class="play-button play-primary" id="blocks-confirm">Start fresh</button></div></dialog>
    </section>`;
  const $ = selector => root.querySelector(selector);
  const board = $('#blocks-board');
  const pixels = [...board.children];
  const dialog = $('#blocks-dialog');
  const announce = message => { $('#blocks-status').textContent = message; };
  function persist() {
    const saved = save(KEY, state);
    const record = save(BEST, best);
    $('#blocks-save').textContent = saved && record ? 'Saved on this device. Returning here resumes paused.' : 'Storage unavailable. Progress may not be saved.';
  }
  function render() {
    const view = [...state.board];
    const landing = new Set();
    if (!state.over) {
      cells(ghost(state.board, state.active)).forEach(({ x, y }) => landing.add(y * WIDTH + x));
      cells(state.active).forEach(({ x, y, value }) => { view[y * WIDTH + x] = value; });
    }
    pixels.forEach((pixel, i) => { pixel.className = view[i] ? `block-color-${view[i]}` : landing.has(i) ? 'block-ghost' : ''; });
    $('#blocks-score').textContent = state.score.toLocaleString();
    $('#blocks-best').textContent = best.toLocaleString();
    $('#blocks-lines').textContent = `${state.lines} · ${Math.floor(state.lines / 10) + 1}`;
    const next = $('#blocks-next'); next.replaceChildren();
    const shape = SHAPES[state.queue[0]];
    next.style.setProperty('--preview-size', shape.length);
    next.setAttribute('aria-label', `Next piece: ${state.queue[0]}`);
    for (const value of shape.flat()) {
      const pixel = document.createElement('span'); pixel.setAttribute('aria-hidden', 'true');
      if (value) pixel.className = `block-color-${value}`;
      next.append(pixel);
    }
    board.setAttribute('aria-label', `Blocks playfield. ${state.over ? 'Game over.' : `${state.active.type} piece in column ${state.active.x + 1}, row ${state.active.y + 1}.`} ${state.lines} lines cleared. Score ${state.score}.`);
    $('#blocks-overlay').hidden = !paused && !state.over;
    $('#blocks-label').textContent = state.over ? 'EVERY END IS A NEW BEGINNING' : 'YOUR PACE, YOUR PLACE';
    $('#blocks-result').textContent = state.over ? 'Well played.' : started ? 'A little pause.' : 'Ready to fall into place?';
    $('#blocks-copy').textContent = state.over ? `${state.score.toLocaleString()} points. ${state.lines} lines. Room for another round?` : 'Your board can wait. Take all the time you need.';
    $('#blocks-start').textContent = state.over ? 'Play again' : 'Let’s play';
    $('#blocks-pause').textContent = paused ? 'Resume' : 'Pause';
    $('#blocks-pause').disabled = state.over;
    root.querySelectorAll('[data-action]').forEach(button => { button.disabled = paused || state.over; });
  }
  function schedule() {
    clearTimeout(timer);
    if (!paused && !state.over) timer = setTimeout(() => { act('tick'); schedule(); }, Math.max(100, 850 - Math.floor(state.lines / 10) * 65));
  }
  function setPaused(value) {
    paused = value; started ||= !value;
    if (paused) pointer = null;
    render(); schedule();
    if (!state.over) announce(paused ? 'Game paused.' : 'Game on. Find your next fit.');
  }
  function apply(result) {
    state = result.state;
    if (result.cleared) announce(`${result.cleared} line${result.cleared === 1 ? '' : 's'} cleared. Score ${state.score}.`);
    if (state.over) { paused = true; clearTimeout(timer); announce(`Well played. Game over with ${state.score} points.`); }
  }
  function act(action) {
    if (paused || state.over || document.querySelector('dialog[open]')) return;
    if (action === 'drop') { apply(hardDrop(state)); schedule(); }
    else if (action === 'rotate') state.active = rotate(state.board, state.active);
    else if (action === 'left' || action === 'right') state.active = translate(state.board, state.active, action === 'left' ? -1 : 1, 0);
    else {
      const moved = translate(state.board, state.active, 0, 1);
      if (moved === state.active) { apply(lock(state)); if (action === 'down') schedule(); }
      else { state.active = moved; if (action === 'down') state.score++; }
    }
    best = Math.max(best, state.score);
    render(); persist();
  }
  function fresh() { state = newGame(); paused = false; started = true; render(); persist(); schedule(); board.focus({ preventScroll: true }); announce('New game started.'); }
  root.querySelectorAll('[data-action]').forEach(button => on(button, 'click', () => act(button.dataset.action)));
  on($('#blocks-start'), 'click', () => {
    if (state.over) fresh(); else setPaused(false);
    board.focus({ preventScroll: true });
    if (matchMedia('(max-width: 700px)').matches) $('.play-stats').scrollIntoView({ block: 'start' });
  });
  on($('#blocks-pause'), 'click', () => setPaused(!paused));
  on($('#blocks-new'), 'click', () => { setPaused(true); dialog.showModal(); });
  on($('#blocks-cancel'), 'click', () => dialog.close());
  on($('#blocks-confirm'), 'click', () => { dialog.close(); fresh(); });
  on(window, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select')) return;
    const actions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', ' ': 'drop' };
    if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
      if (!event.repeat && !state.over) { event.preventDefault(); setPaused(!paused); }
    } else if (actions[event.key]) {
      if (event.key === ' ' && event.target.closest('button,a')) return;
      event.preventDefault();
      if (!event.repeat || ['ArrowLeft','ArrowRight','ArrowDown'].includes(event.key)) act(actions[event.key]);
    }
  });
  on(board, 'pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || paused || state.over) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    board.setPointerCapture(event.pointerId);
  });
  on(board, 'pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) act('rotate');
    else if (Math.abs(dx) > Math.abs(dy)) {
      const steps = Math.min(9, Math.max(1, Math.round(Math.abs(dx) / (board.clientWidth / WIDTH))));
      for (let i = 0; i < steps; i++) act(dx > 0 ? 'right' : 'left');
    } else if (dy > 25) act('drop');
  });
  on(board, 'pointercancel', () => { pointer = null; });
  on(document, 'visibilitychange', () => { if (document.hidden) setPaused(true); });
  on(window, 'blur', () => setPaused(true));
  // Installation and other shell dialogs must pause the falling piece too.
  const observer = new MutationObserver(() => { if (document.querySelector('dialog[open]') && !paused) setPaused(true); });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  render(); persist();
  return () => { clearTimeout(timer); observer.disconnect(); dispose(); if (dialog.open) dialog.close(); };
}
