// ==================== 配置 ====================
const SIZE = 8;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

// ==================== DOM ====================
const boardEl   = document.getElementById('board');
const blackEl   = document.getElementById('black-count');
const whiteEl   = document.getElementById('white-count');
const turnEl    = document.getElementById('current-turn');
const msgEl     = document.getElementById('msg');
const msgTitle  = document.getElementById('msg-title');
const msgSub    = document.getElementById('msg-sub');
const modeAi    = document.getElementById('mode-ai');
const mode2p    = document.getElementById('mode-2p');
const restartBtn = document.getElementById('restart-btn');

// ==================== 状态 ====================
let grid, currentTurn, gameOver, vsAI, aiThinking;
vsAI = true;

// ==================== 模式切换 ====================
modeAi.addEventListener('click', () => {
  vsAI = true; modeAi.classList.add('active'); mode2p.classList.remove('active'); SFX.play('click'); initGame();
});
mode2p.addEventListener('click', () => {
  vsAI = false; mode2p.classList.add('active'); modeAi.classList.remove('active'); SFX.play('click'); initGame();
});

// ==================== 初始化 ====================
function initGame() {
  grid = Array.from({length: SIZE}, () => Array(SIZE).fill(EMPTY));
  // 初始 4 子
  grid[3][3] = WHITE; grid[3][4] = BLACK;
  grid[4][3] = BLACK; grid[4][4] = WHITE;
  currentTurn = BLACK;
  gameOver = false;
  aiThinking = false;
  msgEl.classList.add('hidden');
  updateCounts();
  render();
}

// ==================== 计算翻转 ====================
function getFlips(r, c, player) {
  if (grid[r][c] !== EMPTY) return [];
  const opponent = player === BLACK ? WHITE : BLACK;
  const allFlips = [];
  for (const [dr, dc] of DIRS) {
    const flips = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] === opponent) {
      flips.push([nr, nc]);
      nr += dr; nc += dc;
    }
    if (flips.length > 0 && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] === player) {
      allFlips.push(...flips);
    }
  }
  return allFlips;
}

function getValidMoves(player) {
  const moves = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (getFlips(r, c, player).length > 0) moves.push([r, c]);
  return moves;
}

// ==================== 落子 ====================
function makeMove(r, c, player) {
  const flips = getFlips(r, c, player);
  if (flips.length === 0) return false;
  grid[r][c] = player;
  flips.forEach(([fr, fc]) => { grid[fr][fc] = player; });
  return flips;
}

// 落子 + 翻转音效
function playMoveSound(flips) {
  SFX.play('place');
  if (flips && flips.length) {
    setTimeout(() => SFX.play('capture'), 70);
  }
}

// ==================== 渲染 ====================
function render() {
  boardEl.innerHTML = '';
  const validMoves = gameOver ? [] : getValidMoves(currentTurn);

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const el = document.createElement('div');
      el.className = 'cell';

      if (grid[r][c] === BLACK) {
        const piece = document.createElement('div');
        piece.className = 'piece black';
        el.appendChild(piece);
      } else if (grid[r][c] === WHITE) {
        const piece = document.createElement('div');
        piece.className = 'piece white';
        el.appendChild(piece);
      } else if (validMoves.some(([vr, vc]) => vr === r && vc === c)) {
        el.classList.add('valid');
      }

      el.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(el);
    }
  }
}

// ==================== 翻转动画渲染 ====================
function renderWithFlip(flippedCells) {
  render();
  // 给翻转的棋子加动画
  flippedCells.forEach(([r, c]) => {
    const idx = r * SIZE + c;
    const cellEl = boardEl.children[idx];
    if (cellEl) {
      const piece = cellEl.querySelector('.piece');
      if (piece) piece.classList.add('flipping');
    }
  });
}

// ==================== 点击 ====================
function onCellClick(r, c) {
  if (gameOver || aiThinking) return;
  if (vsAI && currentTurn === WHITE) return; // AI回合不允许点击

  const flips = makeMove(r, c, currentTurn);
  if (!flips) { SFX.play('invalid', { throttle: 150 }); return; }

  playMoveSound(flips);
  renderWithFlip(flips);
  nextTurn();
}

// ==================== 切换回合 ====================
function nextTurn() {
  currentTurn = currentTurn === BLACK ? WHITE : BLACK;
  updateCounts();

  // 检查当前玩家是否有合法走法
  if (getValidMoves(currentTurn).length === 0) {
    // 跳过
    SFX.play('pass');
    currentTurn = currentTurn === BLACK ? WHITE : BLACK;
    if (getValidMoves(currentTurn).length === 0) {
      // 双方都无法走 → 游戏结束
      endGame();
      return;
    }
  }

  updateTurnDisplay();
  render();

  // AI回合
  if (vsAI && currentTurn === WHITE && !gameOver) {
    aiThinking = true;
    setTimeout(() => {
      const move = aiMove();
      if (move) {
        const flips = makeMove(move[0], move[1], WHITE);
        playMoveSound(flips);
        renderWithFlip(flips || []);
      }
      aiThinking = false;
      nextTurn();
    }, 400);
  }
}

// ==================== AI (贪心策略 + 角落优先) ====================
// 位置权重表：角落最高，边次之，角旁最差
const WEIGHT_MAP = [
  [100, -20, 10,  5,  5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [ 10,  -2,  8,  1,  1,  8,  -2,  10],
  [  5,  -2,  1,  0,  0,  1,  -2,   5],
  [  5,  -2,  1,  0,  0,  1,  -2,   5],
  [ 10,  -2,  8,  1,  1,  8,  -2,  10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10,  5,  5, 10, -20, 100],
];

function aiMove() {
  const moves = getValidMoves(WHITE);
  if (!moves.length) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const [r, c] of moves) {
    const flips = getFlips(r, c, WHITE);
    // 评分 = 翻转数量 + 位置权重
    const score = flips.length * 3 + WEIGHT_MAP[r][c];
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }
  return bestMove;
}

// ==================== 计数 ====================
function updateCounts() {
  let b = 0, w = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === BLACK) b++;
      if (grid[r][c] === WHITE) w++;
    }
  blackEl.textContent = b;
  whiteEl.textContent = w;
}

function updateTurnDisplay() {
  turnEl.textContent = currentTurn === BLACK ? '⚫' : '⚪';
}

// ==================== 结束 ====================
function endGame() {
  gameOver = true;
  let b = 0, w = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === BLACK) b++;
      if (grid[r][c] === WHITE) w++;
    }
  const winner = b > w ? '⚫ 黑棋' : w > b ? '⚪ 白棋' : '平局';
  SFX.play(b === w ? 'gameover' : 'win');
  msgTitle.textContent = b > w || w > b ? `🎉 ${winner}获胜！` : '🤝 平局！';
  msgSub.textContent = `⚫ ${b}  vs  ⚪ ${w}`;
  setTimeout(() => msgEl.classList.remove('hidden'), 300);
}

restartBtn.addEventListener('click', () => { SFX.play('start'); initGame(); });

// ==================== 启动 ====================
initGame();
