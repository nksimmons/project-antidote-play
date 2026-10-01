// Adapted from LexiTrack: dice, dictionary search, and its unique-word bonus scoring.
const DICE_4x4 = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
  'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW',
  'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ',
];
const DICE_5x5 = [
  'AAAFRS', 'AAEEEE', 'AAFIRS', 'ADENNN', 'AEEEEM',
  'AEEGMU', 'AEGMNN', 'AFIRSY', 'BJKQXZ', 'CCENST',
  'CEIILT', 'CEILPT', 'CEIPST', 'DDHNOT', 'DHHLOR',
  'DHLNOR', 'DHLNOR', 'EIIITT', 'EMOTTT', 'ENSSSU',
  'FIPRSY', 'GORRVW', 'IPRRRY', 'NOOTUW', 'OOOTTU',
];
const LETTER_FREQ = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ';
const DEFAULT_ROUND_DURATION = 90;
const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_GRID_SIZE = 4;
const UNIQUE_BONUS = 2;

// ─── Dictionary ───────────────────────────────────────────────────────────────
class TrieNode { constructor() { this.children = {}; this.isWord = false; } }

class Dictionary {
  constructor() { this.root = new TrieNode(); this.wordSet = new Set(); }
  insert(word) {
    const w = String(word || '').toLowerCase().trim();
    if (!/^[a-z]{3,}$/.test(w) || this.wordSet.has(w)) return;
    this.wordSet.add(w);
    let n = this.root;
    for (const ch of w) { if (!n.children[ch]) n.children[ch] = new TrieNode(); n = n.children[ch]; }
    n.isWord = true;
  }
  isWord(w) { return this.wordSet.has(String(w || '').toLowerCase().trim()); }
  hasPrefix(p) {
    let n = this.root;
    for (const ch of String(p || '').toLowerCase()) { if (!n.children[ch]) return false; n = n.children[ch]; }
    return true;
  }
}

// ─── Board ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function generateBoard(gridSize) {
  gridSize = gridSize || 4;
  const totalTiles = gridSize * gridSize;
  let letters;
  if (gridSize === 4) {
    const sd = shuffle([...DICE_4x4]);
    letters = sd.map(d => { const f = d[Math.floor(Math.random() * d.length)]; return f === 'Q' ? 'Qu' : f; });
  } else if (gridSize === 5) {
    const sd = shuffle([...DICE_5x5]);
    letters = sd.map(d => { const f = d[Math.floor(Math.random() * d.length)]; return f === 'Q' ? 'Qu' : f; });
  } else {
    letters = [];
    for (let i = 0; i < totalTiles; i++) {
      const ch = LETTER_FREQ[Math.floor(Math.random() * LETTER_FREQ.length)];
      letters.push(ch === 'Q' ? 'Qu' : ch);
    }
  }
  const board = [];
  for (let r = 0; r < gridSize; r++) board.push(letters.slice(r * gridSize, r * gridSize + gridSize));
  return board;
}
function getNeighbors4(row, col, g) {
  const n = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const nr = row + dr, nc = col + dc;
    if (nr >= 0 && nr < g && nc >= 0 && nc < g) n.push([nr, nc]);
  }
  return n;
}
function findAllWords(board, dict) {
  const g = board.length, total = g * g;
  const found = new Set();
  const flat = board.flat().map(c => c.toLowerCase());
  function dfs(pos, word, vis) {
    const nw = word + flat[pos];
    if (!dict.hasPrefix(nw)) return;
    if (nw.length >= 3 && dict.isWord(nw)) found.add(nw);
    const r = Math.floor(pos / g), c = pos % g;
    for (const [nr, nc] of getNeighbors4(r, c, g)) {
      const np = nr * g + nc;
      if (!vis.has(np)) { vis.add(np); dfs(np, nw, vis); vis.delete(np); }
    }
  }
  for (let pos = 0; pos < total; pos++) { const v = new Set([pos]); dfs(pos, '', v); }
  return found;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function getBaseScore(len) { if (len < 3) return 0; if (len <= 4) return 1; if (len === 5) return 2; if (len === 6) return 3; if (len === 7) return 5; return 11; }
function getLengthBonus(len) { return len >= 8 ? 1 : 0; }
function getScore(len) { return getBaseScore(len) + getLengthBonus(len); }
function scoreRound(roundWords) {
  const allWords = new Map();
  for (const [pid, words] of roundWords) for (const e of words) { if (!e.valid) continue; if (!allWords.has(e.word)) allWords.set(e.word, []); allWords.get(e.word).push(pid); }
  const commonItems = [], commonScores = {};
  for (const [word, finders] of allWords) {
    if (finders.length < 2) continue;
    const sc = getBaseScore(word.length) + getLengthBonus(word.length);
    commonItems.push({ word, score: sc, playerIds: finders });
    for (const pid of finders) commonScores[pid] = (commonScores[pid] || 0) + sc;
  }
  const uniqueItems = [], uniqueScores = {};
  for (const [word, finders] of allWords) {
    if (finders.length !== 1) continue;
    const pid = finders[0], base = getBaseScore(word.length), lb = getLengthBonus(word.length), total = base + lb + UNIQUE_BONUS;
    uniqueItems.push({ playerId: pid, word, baseScore: base, lengthBonus: lb, uniqueBonus: UNIQUE_BONUS, totalScore: total });
    uniqueScores[pid] = (uniqueScores[pid] || 0) + total;
  }
  for (const [, words] of roundWords) for (const e of words) {
    if (!e.valid) { e.finalScore = 0; e.reason = 'invalid'; continue; }
    const finders = allWords.get(e.word) || [];
    if (finders.length > 1) { e.finalScore = getBaseScore(e.word.length) + getLengthBonus(e.word.length); e.reason = 'common'; }
    else { e.finalScore = getBaseScore(e.word.length) + getLengthBonus(e.word.length) + UNIQUE_BONUS; e.reason = 'unique'; }
  }
  const playerRoundScores = {};
  for (const [pid] of roundWords) playerRoundScores[pid] = (commonScores[pid] || 0) + (uniqueScores[pid] || 0);
  return { commonItems, uniqueItems, playerRoundScores };
}

