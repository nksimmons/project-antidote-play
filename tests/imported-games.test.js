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
