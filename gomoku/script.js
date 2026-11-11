// ==================== 配置 ====================
const SIZE = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const CELL = 30; // 每格像素
const PAD = 20;  // 边距

// ==================== DOM ====================
const canvas     = document.getElementById('board');
const ctx        = canvas.getContext('2d');
const blackEl    = document.getElementById('black-info');
const whiteEl    = document.getElementById('white-info');
const turnEl     = document.getElementById('current-turn');
const msgEl      = document.getElementById('msg');
const msgTitle   = document.getElementById('msg-title');
const msgSub     = document.getElementById('msg-sub');
const modeAi     = document.getElementById('mode-ai');
const mode2p     = document.getElementById('mode-2p');
const restartBtn = document.getElementById('restart-btn');

canvas.width  = SIZE * CELL + PAD * 2;
canvas.height = SIZE * CELL + PAD * 2;

// ==================== 状态 ====================
let grid, currentTurn, gameOver, vsAI, aiThinking;
let hoverR = -1, hoverC = -1;
let winLine = null;
vsAI = true;

// ==================== 模式 ====================
modeAi.addEventListener('click', () => {
  vsAI = true; modeAi.classList.add('active'); mode2p.classList.remove('active'); SFX.play('click'); initGame();
});
mode2p.addEventListener('click', () => {
  vsAI = false; mode2p.classList.add('active'); modeAi.classList.remove('active'); SFX.play('click'); initGame();
});

// ==================== 初始化 ====================
function initGame() {
  grid = Array.from({length: SIZE}, () => Array(SIZE).fill(EMPTY));
  currentTurn = BLACK;
  gameOver = false;
  aiThinking = false;
  winLine = null;
  hoverR = -1; hoverC = -1;
  msgEl.classList.add('hidden');
  updateTurnDisplay();
  draw();
}

// ==================== 绘制 ====================
function draw() {
  // 背景
  ctx.fillStyle = '#deb887';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 网格线
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 1;
  for (let i = 0; i < SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(PAD + i * CELL, PAD);
    ctx.lineTo(PAD + i * CELL, PAD + (SIZE - 1) * CELL);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD, PAD + i * CELL);
    ctx.lineTo(PAD + (SIZE - 1) * CELL, PAD + i * CELL);
    ctx.stroke();
  }

  // 星位（天元 + 四角星）
  const stars = [[3,3],[3,11],[7,7],[11,3],[11,11]];
  ctx.fillStyle = '#8b7355';
  stars.forEach(([r, c]) => {
    ctx.beginPath();
    ctx.arc(PAD + c * CELL, PAD + r * CELL, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // 棋子
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === BLACK) drawPiece(r, c, BLACK);
      else if (grid[r][c] === WHITE) drawPiece(r, c, WHITE);
    }
  }

  // 最后一步标记
  let lastR = -1, lastC = -1;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] && !winLine) { lastR = r; lastC = c; }

  // 悬停预览
  if (!gameOver && hoverR >= 0 && hoverC >= 0 && grid[hoverR][hoverC] === EMPTY) {
    ctx.globalAlpha = 0.4;
    drawPiece(hoverR, hoverC, currentTurn);
    ctx.globalAlpha = 1;
  }

  // 胜利连线
  if (winLine) {
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ef5350';
    ctx.shadowBlur = 10;
    const [r1, c1] = winLine[0];
    const [r2, c2] = winLine[winLine.length - 1];
    ctx.beginPath();
    ctx.moveTo(PAD + c1 * CELL, PAD + r1 * CELL);
    ctx.lineTo(PAD + c2 * CELL, PAD + r2 * CELL);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawPiece(r, c, player) {
  const x = PAD + c * CELL;
  const y = PAD + r * CELL;
  const radius = CELL * 0.42;

  if (player === BLACK) {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
    g.addColorStop(0, '#555');
    g.addColorStop(1, '#111');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
    g.addColorStop(0, '#fff');
    g.addColorStop(1, '#ccc');
    ctx.fillStyle = g;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
  ctx.fill();

  // 重新绘制棋子（覆盖阴影上半部分）
  if (player === BLACK) {
    const g2 = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
    g2.addColorStop(0, '#555');
    g2.addColorStop(1, '#111');
    ctx.fillStyle = g2;
  } else {
    const g2 = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
    g2.addColorStop(0, '#fff');
    g2.addColorStop(1, '#ccc');
    ctx.fillStyle = g2;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// ==================== 落子 ====================
function placeStone(r, c) {
  if (grid[r][c] !== EMPTY) { SFX.play('invalid', { throttle: 150 }); return false; }
  if (gameOver) return false;
  grid[r][c] = currentTurn;
  SFX.play('place');

  // 检查胜利
  const line = checkWin(r, c, currentTurn);
  if (line) {
    winLine = line;
    gameOver = true;
    SFX.play('win');
    const winner = currentTurn === BLACK ? '⚫ 黑棋' : '⚪ 白棋';
    msgTitle.textContent = `🎉 ${winner}获胜！`;
    msgSub.textContent = '点击再来一局';
    draw();
    setTimeout(() => msgEl.classList.remove('hidden'), 300);
    return true;
  }

  // 检查平局
  if (grid.every(row => row.every(cell => cell !== EMPTY))) {
    gameOver = true;
    SFX.play('gameover');
    msgTitle.textContent = '🤝 平局！';
    msgSub.textContent = '棋盘已满';
    draw();
    setTimeout(() => msgEl.classList.remove('hidden'), 300);
    return true;
  }

  currentTurn = currentTurn === BLACK ? WHITE : BLACK;
  updateTurnDisplay();
  draw();

  // AI回合
  if (vsAI && currentTurn === WHITE && !gameOver) {
    aiThinking = true;
    setTimeout(() => {
      const move = aiMove();
      if (move) placeStone(move[0], move[1]);
      aiThinking = false;
    }, 300);
  }

  return true;
}

// ==================== 胜利检测 ====================
function checkWin(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]; // 横、竖、正斜、反斜
  for (const [dr, dc] of dirs) {
    const line = [[r, c]];
    // 正方向延伸
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || grid[nr][nc] !== player) break;
      line.push([nr, nc]);
    }
    // 反方向延伸
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || grid[nr][nc] !== player) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= 5) return line;
  }
  return null;
}

// ==================== AI (评分策略) ====================
function aiMove() {
  let bestScore = -Infinity;
  let bestMove = null;

  // 只评估已有棋子附近的位置
  const candidates = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== EMPTY) continue;
      // 是否在已有棋子附近2格内
      let near = false;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] !== EMPTY) {
            near = true; break;
          }
        }
        if (near) break;
      }
      if (near || grid.every(row => row.every(cell => cell === EMPTY))) candidates.push([r, c]);
    }
  }

  // 棋盘空时走天元
  if (grid.every(row => row.every(cell => cell === EMPTY))) return [7, 7];

  for (const [r, c] of candidates) {
    // AI攻击评分
    const attackScore = evaluatePosition(r, c, WHITE);
    // AI防守评分（假设对手下此处）
    const defenseScore = evaluatePosition(r, c, BLACK);
    const score = attackScore * 1.1 + defenseScore;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }
  return bestMove;
}

function evaluatePosition(r, c, player) {
  grid[r][c] = player;
  let score = 0;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];

  for (const [dr, dc] of dirs) {
    let count = 1;
    let openEnds = 0;

    // 正方向
    let i = 1;
    while (true) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      if (grid[nr][nc] === player) { count++; i++; }
      else { if (grid[nr][nc] === EMPTY) openEnds++; break; }
    }
    // 反方向
    i = 1;
    while (true) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      if (grid[nr][nc] === player) { count++; i++; }
      else { if (grid[nr][nc] === EMPTY) openEnds++; break; }
    }

    // 评分
    if (count >= 5) score += 100000;       // 必胜
    else if (count === 4 && openEnds >= 1) score += 10000; // 活四/冲四
    else if (count === 3 && openEnds === 2) score += 5000; // 活三
    else if (count === 3 && openEnds === 1) score += 500;  // 冲三
    else if (count === 2 && openEnds === 2) score += 200;  // 活二
    else if (count === 2 && openEnds === 1) score += 50;   // 冲二
  }

  grid[r][c] = EMPTY;
  return score;
}

// ==================== 显示 ====================
function updateTurnDisplay() {
  turnEl.textContent = currentTurn === BLACK ? '⚫' : '⚪';
  blackEl.textContent = currentTurn === BLACK ? '思考中...' : '等待';
  whiteEl.textContent = currentTurn === WHITE ? '思考中...' : '等待';
  if (vsAI) {
    if (currentTurn === WHITE) whiteEl.textContent = 'AI 思考中...';
  }
}

// ==================== 鼠标/触摸 ====================
function getGridPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (clientX - rect.left) * scaleX;
  const my = (clientY - rect.top) * scaleY;
  const c = Math.round((mx - PAD) / CELL);
  const r = Math.round((my - PAD) / CELL);
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
  return [r, c];
}

canvas.addEventListener('click', e => {
  if (gameOver || aiThinking) return;
  if (vsAI && currentTurn === WHITE) return;
  const pos = getGridPos(e.clientX, e.clientY);
  if (pos) placeStone(pos[0], pos[1]);
});

canvas.addEventListener('mousemove', e => {
  const pos = getGridPos(e.clientX, e.clientY);
  if (pos) { hoverR = pos[0]; hoverC = pos[1]; }
  else { hoverR = -1; hoverC = -1; }
  draw();
});

canvas.addEventListener('mouseleave', () => { hoverR = -1; hoverC = -1; draw(); });

// 触摸
canvas.addEventListener('touchstart', e => {
  if (gameOver || aiThinking) return;
  if (vsAI && currentTurn === WHITE) return;
  const touch = e.touches[0];
  const pos = getGridPos(touch.clientX, touch.clientY);
  if (pos) placeStone(pos[0], pos[1]);
  e.preventDefault();
}, { passive: false });

restartBtn.addEventListener('click', () => { SFX.play('start'); initGame(); });

// ==================== 启动 ====================
initGame();
