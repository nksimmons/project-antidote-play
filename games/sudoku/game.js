import { generate, conflicts, peers, isComplete, validState } from './engine.js';
import { readSave, readRecord, save, bindings } from '../shared.js';

const KEY = 'antidote:sudoku:save';
const RECORD = 'antidote:sudoku:solved';
export const readSolved = () => readRecord(RECORD);

export function mountSudoku(root) {
  let state = readSave(KEY, validState) || generate();
  let solved = readSolved();
  let selected = Math.max(0, state.puzzle.findIndex(value => !value));
  let pencil = false;
  let checked = new Set();
  const history = [];
  const { on, dispose } = bindings();
  root.innerHTML = `
    <section class="arcade-game sudoku-game" aria-labelledby="sudoku-title">
      <a class="arcade-back" href="#/library">← Back to the arcade</a>
      <div class="play-layout">
        <div class="play-intro"><span class="eyebrow">A QUIET KIND OF CHALLENGE</span><h1 id="sudoku-title">Sudoku<span>.</span></h1><p class="play-tagline">A little order.<br>A little peace of mind.</p><div class="play-instructions"><p>Fill each row, column, and 3 × 3 box with <strong>1 through 9</strong>, using each number once. Every puzzle has one solution.</p><p>Tap a square, then a number. Use <strong>Notes</strong> to pencil in possibilities. On a keyboard: arrows to move, 1–9 to enter, Delete to erase, N for notes.</p><p>Clue settings change how much of the board is filled in. No clock, no lives, no rush.</p></div></div>
        <div class="play-panel">
          <div class="play-stats"><div class="play-stat"><span>FILLED</span><strong id="sudoku-filled"></strong></div><div class="play-stat"><span>PUZZLES SOLVED</span><strong id="sudoku-solved"></strong></div><button class="play-button" id="sudoku-new">New puzzle</button></div>
          <div class="sudoku-heading"><span id="sudoku-level"></span><span id="sudoku-hints"></span></div>
          <div class="sudoku-board" role="grid" aria-label="Sudoku puzzle" aria-rowcount="9" aria-colcount="9">${Array.from({ length: 9 }, (_, row) => `<div role="row">${Array.from({ length: 9 }, (_, col) => `<button class="sudoku-cell" role="gridcell" data-cell="${row * 9 + col}" aria-rowindex="${row + 1}" aria-colindex="${col + 1}"></button>`).join('')}</div>`).join('')}</div>
          <div class="sudoku-keypad" role="group" aria-label="Enter a number">${Array.from({ length: 9 }, (_, i) => `<button class="play-button" data-number="${i + 1}" aria-label="Enter ${i + 1}">${i + 1}</button>`).join('')}</div>
          <div class="play-toolbar"><button class="play-button" id="sudoku-notes" aria-pressed="false">Notes</button><button class="play-button" id="sudoku-erase">Erase</button><button class="play-button" id="sudoku-undo" disabled>Undo</button><button class="play-button" id="sudoku-check">Check</button><button class="play-button" id="sudoku-hint">Hint</button></div>
          <p class="play-message" id="sudoku-status" role="status" aria-live="polite">Choose a square. Find your next number.</p><p class="play-save" id="sudoku-save"></p>
        </div>
      </div>
      <dialog class="info-dialog play-dialog" id="sudoku-dialog"><span class="eyebrow">A CLEAN SLATE</span><h2>Your next quiet challenge.</h2><p>Starting a new puzzle replaces this board. Your solved count stays.</p><label for="sudoku-difficulty">Clue setting<select id="sudoku-difficulty"><option value="easy">Easy · more clues</option><option value="medium">Medium · a little space</option><option value="hard">Hard · fewer clues</option></select></label><div class="play-dialog-actions"><button class="play-button" id="sudoku-cancel">Keep this puzzle</button><button class="play-button play-primary" id="sudoku-create">Start puzzle</button></div></dialog>
    </section>`;
  const $ = selector => root.querySelector(selector);
  const cells = [...root.querySelectorAll('[data-cell]')];
  const dialog = $('#sudoku-dialog');
  const announce = message => { $('#sudoku-status').textContent = message; };
  function persist() {
    const boardSaved = save(KEY, state);
    const recordSaved = save(RECORD, solved);
    $('#sudoku-save').textContent = boardSaved && recordSaved ? 'Saved on this device. Your puzzle will be here.' : 'Storage unavailable. This puzzle may not be saved.';
  }
  function render(focus = false) {
    const duplicates = conflicts(state.values);
    cells.forEach((cell, index) => {
      const value = state.values[index];
      const notes = Array.from({ length: 9 }, (_, i) => state.notes[index] & (1 << i) ? i + 1 : 0).filter(Boolean);
      cell.className = 'sudoku-cell';
      cell.classList.toggle('given', !!state.puzzle[index]);
      cell.classList.toggle('related', peers[selected].includes(index));
      cell.classList.toggle('matching', !!value && value === state.values[selected]);
      cell.classList.toggle('selected', index === selected);
      const error = duplicates.has(index) || checked.has(index);
      cell.classList.toggle('conflict', error);
      cell.setAttribute('aria-invalid', String(error));
      cell.setAttribute('aria-selected', String(index === selected));
      cell.setAttribute('aria-readonly', String(!!state.puzzle[index] || state.completed));
      cell.tabIndex = index === selected ? 0 : -1;
      cell.setAttribute('aria-label', `Row ${Math.floor(index / 9) + 1}, column ${index % 9 + 1}: ${value || 'empty'}${state.puzzle[index] ? ', given' : ''}${notes.length && !value ? `, notes ${notes.join(', ')}` : ''}${error ? ', check this number' : ''}`);
      cell.replaceChildren();
      if (value) cell.textContent = value;
      else if (notes.length) {
        const mini = document.createElement('span');
        mini.className = 'sudoku-pencil'; mini.setAttribute('aria-hidden', 'true');
        for (let n = 1; n <= 9; n++) {
          const mark = document.createElement('span'); mark.textContent = notes.includes(n) ? n : ''; mini.append(mark);
        }
        cell.append(mini);
      }
    });
    $('#sudoku-filled').textContent = `${state.values.filter(Boolean).length}/81`;
    $('#sudoku-solved').textContent = solved.toLocaleString();
    $('#sudoku-level').textContent = `${state.level.toUpperCase()} · ${state.puzzle.filter(Boolean).length} CLUES`;
    $('#sudoku-hints').textContent = `${state.hints} HINT${state.hints === 1 ? '' : 'S'} USED`;
    $('#sudoku-undo').disabled = !history.length || state.completed;
    for (const id of ['notes','erase','check','hint']) $(`#sudoku-${id}`).disabled = state.completed;
    root.querySelectorAll('[data-number]').forEach(button => { button.disabled = state.completed; });
    $('#sudoku-notes').setAttribute('aria-pressed', String(pencil));
    if (state.completed) announce('Beautifully done. Every number in its place. Start a new puzzle whenever you’re ready.');
    if (focus) cells[selected].focus({ preventScroll: true });
  }
  function remember() {
    history.push({ values: [...state.values], notes: [...state.notes], hints: state.hints });
    if (history.length > 100) history.shift();
  }
  function enter(value, hint = false) {
    if (state.completed) return;
    if (state.puzzle[selected]) { announce('That number is a given. Choose an empty or editable square.'); return; }
    if (!pencil && state.values[selected] === value && !hint && (value || !state.notes[selected])) return;
    remember(); checked.clear();
    if (pencil && value && !hint) {
      if (state.values[selected]) { history.pop(); announce('Erase this number before adding notes.'); return; }
      state.notes[selected] ^= 1 << (value - 1);
      announce(`Notes updated for row ${Math.floor(selected / 9) + 1}, column ${selected % 9 + 1}.`);
    } else {
      state.values[selected] = value; state.notes[selected] = 0;
      if (value) for (const peer of peers[selected]) state.notes[peer] &= ~(1 << (value - 1));
      if (hint) state.hints++;
      announce(value ? `${hint ? 'Hint: ' : ''}${value} placed.${conflicts(state.values).size ? ' An underlined number conflicts with its row, column, or box.' : ''}` : 'Square cleared.');
    }
    if (isComplete(state)) { state.completed = true; solved++; }
    render(); persist();
  }
  cells.forEach((cell, index) => on(cell, 'click', () => { selected = index; render(); }));
  root.querySelectorAll('[data-number]').forEach(button => on(button, 'click', () => enter(Number(button.dataset.number))));
  on($('#sudoku-notes'), 'click', () => { pencil = !pencil; render(); announce(pencil ? 'Notes on. Numbers toggle pencil marks.' : 'Notes off. Numbers fill the square.'); });
  on($('#sudoku-erase'), 'click', () => enter(0));
  on($('#sudoku-undo'), 'click', () => {
    const prior = history.pop(); if (!prior || state.completed) return;
    Object.assign(state, prior); checked.clear(); render(); persist(); announce('Last change undone.');
  });
  on($('#sudoku-check'), 'click', () => {
    checked = new Set(state.values.flatMap((value, index) => value && value !== state.solution[index] ? [index] : []));
    render(); announce(checked.size ? `${checked.size} number${checked.size === 1 ? ' needs' : 's need'} another look. Underlined squares are marked for review.` : 'Everything you’ve filled in is correct so far.');
  });
  on($('#sudoku-hint'), 'click', () => {
    if (state.puzzle[selected] || state.values[selected] === state.solution[selected]) selected = state.values.findIndex((value, i) => value !== state.solution[i]);
    if (selected >= 0) enter(state.solution[selected], true);
  });
  on($('#sudoku-new'), 'click', () => { $('#sudoku-difficulty').value = state.level; dialog.showModal(); });
  on($('#sudoku-cancel'), 'click', () => dialog.close());
  on($('#sudoku-create'), 'click', () => {
    state = generate($('#sudoku-difficulty').value);
    history.length = 0; checked.clear(); pencil = false;
    selected = state.puzzle.findIndex(value => !value);
    dialog.close(); render(true); persist(); announce('A new puzzle, a fresh start.');
  });
  on(root, 'keydown', event => {
    if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('select,input,textarea')) return;
    const directions = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
    if (Object.hasOwn(directions, event.key)) {
      event.preventDefault(); selected = Math.max(0, Math.min(80, selected + directions[event.key])); render(true);
    } else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
    else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); enter(0); }
    else if (event.key.toLowerCase() === 'n' && !state.completed) { event.preventDefault(); $('#sudoku-notes').click(); }
  });
  render(); persist();
  return () => { dispose(); if (dialog.open) dialog.close(); };
}
