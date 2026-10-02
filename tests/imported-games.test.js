import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function engine(game, file = 'game.js') {
  const context = vm.createContext({ console });
  vm.runInContext(await readFile(new URL(`../games/${game}/js/${file}`, import.meta.url), 'utf8'), context);
  return code => vm.runInContext(code, context);
}

test('Pente rejects malformed coordinates and captures pairs in multiple directions', async () => {
  const run = await engine('stones-of-five');
  run('var board = createBoard();');
  for (const coord of ['undefined','null','NaN','1.5','"1"','-1','19']) assert.equal(run(`isValidMove(board, ${coord}, 1).valid`), false);
  run('board[9][10]=2; board[9][11]=2; board[9][12]=1; board[10][9]=3; board[11][9]=3; board[12][9]=1;');
  assert.equal(run('placeStone(board,9,9,1).length'), 4);
  assert.equal(run('board[9][10]+board[9][11]+board[10][9]+board[11][9]'), 0);
});

test('Pente wins along every axis and by five capture pairs; bots choose legal moves', async () => {
  const run = await engine('stones-of-five');
  for (const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
    run(`var board=createBoard(); for(let i=0;i<5;i++) board[9+i*${dr}][9+i*${dc}]=1;`);
    assert.equal(run('checkWin(board,9,9,1,0)'), 'five-in-a-row');
  }
  assert.equal(run('checkWin(createBoard(),9,9,1,5)'), 'captures');
  run('board=createBoard(); board[9][9]=1; var move=getBotMove(board,2,[1,2],{},1,2,4);');
  assert.equal(run('isValidMove(board,move.row,move.col).valid'), true);
});

test('LexiTrack counts Qu as one tile, allows diagonals, and never reuses a tile', async () => {
  const run = await engine('lexitrack', 'engine.js');
  run('var dict=new Dictionary(); ["quits","sit","quitquit"].forEach(w=>dict.insert(w)); var words=findAllWords([["Qu","I"],["S","T"]],dict);');
  assert.equal(run('words.has("quits")'), true);
  assert.equal(run('words.has("sit")'), true);
  assert.equal(run('words.has("quitquit")'), false);
});

test('LexiTrack preserves the original unique bonus and scores complete rounds without undefined constants', async () => {
  const run = await engine('lexitrack', 'engine.js');
  run('var rounds=new Map([["a",[{word:"cat",valid:true},{word:"rainbow",valid:true},{word:"invalid",valid:false}]],["b",[{word:"cat",valid:true}]]]); var scored=scoreRound(rounds);');
  assert.equal(run('scored.playerRoundScores.a'), 8); // common cat 1 + rainbow 5 + unique 2
  assert.equal(run('scored.playerRoundScores.b'), 1);
  assert.equal(run('rounds.get("a")[2].finalScore'), 0);
});

async function host(game) {
  const context = vm.createContext({ console, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    AntidoteMultiplayer: { identity: () => 'host-seat', safeAvatar: () => ({ bgColor: '#457b9d', drawing: null }) },
    document: { getElementById: () => null, createElement: () => ({ querySelectorAll: () => [] }), body: { append() {} } },
  });
  const base = new URL(`../games/${game}/js/`, import.meta.url);
  vm.runInContext(await readFile(new URL(game === 'lexitrack' ? 'engine.js' : 'game.js', base), 'utf8'), context);
  const source = await readFile(new URL('combined.js', base), 'utf8');
  vm.runInContext(source.slice(0, source.indexOf(game === 'lexitrack' ? '// ─── Events' : '// ── Event listeners')), context);
  return code => vm.runInContext(code, context);
}

test('LexiTrack retains configured board, rounds and duration when starting and rejects expired submissions', async () => {
  const run = await host('lexitrack');
  run(`broadcastAllPlayers=()=>{}; broadcastHostState=()=>{}; broadcastWordCounts=()=>{}; sendToRtcPlayer=()=>{};
    dictionary=new Dictionary(); myPlayerId='1'; gameState.hostPlayerId='1';
    gameState.players.set('1',{id:'1',totalScore:0,roundScores:[]});
    handlePlayerAction('1',{type:'set-config',gridSize:5,maxRounds:1,roundDuration:30});
    handlePlayerAction('1',{type:'start-game'});`);
  assert.equal(run('gameState.board.length'), 5);
  assert.equal(run('gameState.maxRounds'), 1);
  assert.equal(run('gameState.roundDuration'), 30);
  assert.equal(run('gameState.phase'), 'playing');
  run("gameState.timerEnd=0; handlePlayerAction('1',{type:'submit-word',word:'cat'});");
  assert.equal(run("gameState.roundWords.get('1').length"), 0);
});

test('Pente rejects stale moves, prevents duplicate seats, and lets the host approve a guest undo', async () => {
  const run = await host('stones-of-five');
  run(`broadcastAll=()=>{}; playYourTurnSound=()=>{}; playWinSound=()=>{};
    resetGs(); selfPlayerId='host'; gs.hostPlayerId='host';
    gs.players.push({id:'host',name:'Host',stoneNumber:1,captures:0,connected:true,deviceId:'host-seat'});
    var messages=[]; var guest={open:true,send:m=>messages.push(m)};
    var join={name:'Guest',deviceId:'guest-seat'};
    handleJoin(guest,join); handleJoin(guest,join); handleStartGame('self');
    applyMove(9,9,gs.players[0]);
    handleMessage(guest,{type:'place-stone',row:9,col:10,revision:revision-1});`);
  assert.equal(run('gs.players.length'), 2);
  assert.equal(run('gs.board[9][10]'), 0);
  run(`handleMessage(guest,{type:'place-stone',row:9,col:10,revision});
    handleMessage(guest,{type:'undo-request',revision});`);
  assert.equal(run('gs.board[9][10]'), 2);
  assert.equal(run('undoRequest.voters.size'), 2);
  run("handleUndoVote('self',{approve:true});");
  assert.equal(run('gs.board[9][10]'), 0);
  assert.equal(run('gs.board[9][9]'), 1);
  assert.equal(run('undoRequest'), null);
  assert.equal(run('messages.some(m=>m.type==="undo-result"&&m.approved)'), true);
});

async function interactions(game, file) {
  const elements = new Map(), messages = [], sent = [];
  let connectionOptions, retries = 0;
  function element(id) {
    if (!elements.has(id)) {
      const handlers = {};
      elements.set(id, {
        style: {}, value: '', disabled: false, textContent: '', handlers,
        addEventListener(type, handler) { (handlers[type] ||= []).push(handler); },
        fire(type, event = {}) { for (const handler of handlers[type] || []) handler(event); },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
        getContext: () => new Proxy({}, { get: () => () => {} }),
        setPointerCapture() {}, querySelectorAll: () => [], querySelector: () => null,
        appendChild() {}, focus() { this.focused = true; },
        classList: { add() {}, remove() {} },
      });
    }
    return elements.get(id);
  }
  const context = vm.createContext({
    console, setTimeout: () => 1, clearTimeout() {}, window: { devicePixelRatio: 2 },
    document: { getElementById: element, createElement: element, querySelectorAll: () => [] },
    AntidoteMultiplayer: {
      room: 'invite', identity: () => 'seat', storage: { getItem: () => null, setItem() {} },
      status: message => messages.push(message),
      connect(options) { connectionOptions = options; return { retry() { retries++; } }; },
    },
  });
  if (file === 'combined.js') {
    const engineFile = game === 'lexitrack' ? 'engine.js' : 'game.js';
    vm.runInContext(await readFile(new URL(`../games/${game}/js/${engineFile}`, import.meta.url), 'utf8'), context);
  }
  const source = await readFile(new URL(`../games/${game}/js/${file}`, import.meta.url), 'utf8');
  const marker = file === 'player.js' ? (game === 'lexitrack' ? '// --- Init ---' : '// ── Init')
    : (game === 'lexitrack' ? '// ─── Events' : '// ── Event listeners');
  vm.runInContext(source.slice(0, source.indexOf(marker)), context);
  return { element, messages, sent, run: code => vm.runInContext(code, context),
    get options() { return connectionOptions; }, get retries() { return retries; } };
}

for (const game of ['lexitrack', 'stones-of-five']) {
  for (const file of ['combined.js', 'player.js']) {
    test(`${game} ${file} prevents canvas gestures and ends cancelled drawing`, async () => {
      const f = await interactions(game, file);
      f.run('redrawCanvas=()=>{}; updateAvatarPreview=()=>{}; initAvatarBuilder();');
      const canvas = f.element('draw-canvas');
      let prevented = 0;
      const event = { pointerId: 1, clientX: 10, clientY: 20, preventDefault() { prevented++; } };
      canvas.fire('pointerdown', event);
      canvas.fire('pointermove', event);
      assert.equal(prevented, 2);
      assert.equal(f.run('currentStroke.points.length'), 2);
      canvas.fire('pointercancel', event);
      assert.equal(f.run('isDrawing'), false);
      assert.equal(f.run('currentStroke'), null);
      canvas.fire('pointermove', event);
      assert.equal(prevented, 2);
      canvas.fire('pointerdown', event);
      canvas.fire('lostpointercapture', event);
      assert.equal(f.run('isDrawing'), false);
    });

    if (game === 'stones-of-five') {
      test(`${game} ${file} prevents board/pile gestures and stops cancelled drags`, async () => {
        const f = await interactions(game, file);
        f.run(file === 'player.js'
          ? "playerId='me'; state={phase:'playing',currentTurnPlayerId:'me',board:[[0]]}; redrawGameBoard=()=>{};"
          : "selfPlayerId='me'; selfState={currentTurnPlayerId:'me'}; gs={phase:'playing',board:[[0]]}; redrawBoard=()=>{};");
        f.run('getIntersection=()=>({row:0,col:0}); setupBoardInteraction();');
        const stone = f.element('stone');
        let prevented = 0;
        const event = { pointerId: 1, clientX: 10, clientY: 20,
          target: { closest: () => stone }, preventDefault() { prevented++; } };
        for (const id of ['game-board', 'stone-pile']) {
          const target = f.element(id);
          target.fire('pointerdown', event);
          target.fire('pointermove', event);
          assert.equal(prevented, 2);
          target.fire('pointercancel', event);
          target.fire('pointermove', event);
          assert.equal(prevented, 2);
          prevented = 0;
        }
        assert.equal(f.element('drag-floater').style.display, 'none');
        assert.equal(stone.style.opacity, '');
      });
    }
  }

  test(`${game} Join gives immediate feedback, validates names, and recovers after failure`, async () => {
    const f = await interactions(game, 'player.js');
    f.run(game === 'lexitrack' ? 'connectPeer(roomParam);' : 'connect();');
    const button = f.element('btn-join');
    const name = f.element('player-name');
    button.fire('click');
    assert.equal(name.focused, true);
    assert.equal(button.disabled, false);
    name.value = 'Guest';
    button.fire('click');
    assert.equal(button.textContent, 'Connecting…');
    assert.equal(button.disabled, true);
    assert.equal(f.retries, 1);
    assert.equal(f.run('pendingJoin.name'), 'Guest');
    f.options.onClose();
    assert.equal(button.textContent, 'Join Game');
    assert.equal(button.disabled, false);
    button.fire('click');
    assert.equal(f.retries, 2);
    f.options.onOpen({ open: true, send: message => f.sent.push(message) });
    assert.equal(f.sent[0].type, 'player-join');
    assert.equal(f.run('pendingJoin'), null);
    f.run(game === 'lexitrack' ? "processServerMessage({type:'error',message:'Room full'});"
      : "handleServerMsg({type:'error',message:'Room full'});");
    assert.equal(button.disabled, false);
    button.fire('click');
    assert.equal(button.textContent, 'Joining…');
    assert.equal(button.disabled, true);
    assert.equal(f.sent.length, 2);
  });
}

test('interactive game pages suppress root overscroll and keep touch-action disabled', async () => {
  const read = path => readFile(new URL(`../games/${path}`, import.meta.url), 'utf8');
  for (const page of ['index.html', 'player.html']) {
    const lexitrack = await read(`lexitrack/${page}`);
    assert.match(lexitrack, /html(?:,\s*body)?\s*\{\s*overscroll-behavior:\s*none/);
    assert.match(lexitrack, /#draw-canvas\s*\{[^}]*touch-action:\s*none/);
    const stones = await read(`stones-of-five/${page}`);
    for (const id of ['draw-canvas', 'game-board']) {
      assert.match(stones, new RegExp(`id="${id}"[^>]*touch-action:none`));
    }
  }
  const stonesCSS = await read('stones-of-five/css/style.css');
  assert.match(stonesCSS, /html,\s*body\s*\{\s*overscroll-behavior:\s*none/);
  assert.match(stonesCSS, /\.pile-stone\s*\{[^}]*touch-action:\s*none/);
  assert.match(await read('lexitrack/css/style.css'), /\.board\s*\{[^}]*touch-action:\s*none/);
});
