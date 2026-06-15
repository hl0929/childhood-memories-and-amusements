// ==================== 配置 ====================
const ROWS = 6, COLS = 8;
const ICONS = ['🍎','🍊','🍋','🍇','🍓','🌸','⭐','🔥','🌊','🎯','🎪','🧲'];

// ==================== DOM ====================
const boardEl    = document.getElementById('board');
const scoreEl    = document.getElementById('score');
const remainEl   = document.getElementById('remaining');
const timerEl    = document.getElementById('timer');
const msgEl      = document.getElementById('msg');
const msgTitle   = document.getElementById('msg-title');
const msgSub     = document.getElementById('msg-sub');
const hintBtn    = document.getElementById('hint-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const restartBtn = document.getElementById('restart-btn');
const lineSvg    = document.getElementById('line-svg');

// ==================== 状态 ====================
let grid, score, selected, gameOver, timerInterval, startTime, remaining;

// ==================== 初始化 ====================
function initGame() {
  score = 0;
  selected = null;
  gameOver = false;
  scoreEl.textContent = 0;
  msgEl.classList.add('hidden');
  lineSvg.innerHTML = '';
  stopTimer();
  startTime = null;
  timerEl.textContent = '0s';

  // 生成配对图案
  const pairs = (ROWS * COLS) / 2;
  const pool = [];
  for (let i = 0; i < pairs; i++) {
    const icon = ICONS[i % ICONS.length];
    pool.push(icon, icon);
  }
  pool.sort(() => Math.random() - 0.5);

  // 填充网格（外围留一圈空格方便寻路）
  grid = Array.from({length: ROWS + 2}, () => Array(COLS + 2).fill(null));
  let idx = 0;
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      grid[r][c] = pool[idx++];
    }
  }

  remaining = pairs * 2;
  remainEl.textContent = remaining;
  render();
}

// ==================== 渲染 ====================
function render() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const el = document.createElement('div');
      el.className = 'tile';
      el.dataset.r = r;
      el.dataset.c = c;
      if (grid[r][c]) {
        el.textContent = grid[r][c];
        if (selected && selected[0] === r && selected[1] === c) el.classList.add('selected');
      } else {
        el.style.visibility = 'hidden';
        el.style.cursor = 'default';
      }
      el.addEventListener('click', () => onTileClick(r, c));
      boardEl.appendChild(el);
    }
  }
}

// ==================== 点击 ====================
function onTileClick(r, c) {
  if (gameOver || !grid[r][c]) return;
  if (!startTime) startTimer();

  if (!selected) {
    selected = [r, c];
    render();
    return;
  }
  const [sr, sc] = selected;
  selected = null;
  if (sr === r && sc === c) { render(); return; }

  // 必须是相同图案
  if (grid[sr][sc] !== grid[r][c]) { render(); return; }

  // 寻路
  const path = findPath(sr, sc, r, c);
  if (path) {
    drawLine(path);
    removePair(sr, sc, r, c);
  } else {
    render();
  }
}

// ==================== BFS 寻路 (≤ 2 弯) ====================
function findPath(r1, c1, r2, c2) {
  // 方向：上下左右
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

  // BFS 状态: [r, c, 方向, 转弯次数, 路径]
  const queue = [[r1, c1, -1, 0, [[r1, c1]]]];
  const visited = new Set();
  visited.add(`${r1},${c1},-1`);

  while (queue.length) {
    const [r, c, dir, turns, path] = queue.shift();
    if (turns > 2) continue;

    for (let d = 0; d < 4; d++) {
      const nr = r + dirs[d][0];
      const nc = c + dirs[d][1];
      const newTurns = (dir === -1 || dir === d) ? turns : turns + 1;
      if (newTurns > 2) continue;

      // 越界检查（允许走到边界外一圈）
      if (nr < 0 || nr > ROWS + 1 || nc < 0 || nc > COLS + 1) continue;

      const key = `${nr},${nc},${d}`;
      if (visited.has(key)) continue;

      // 目标点
      if (nr === r2 && nc === c2) {
        return [...path, [nr, nc]];
      }

      // 只能走空格
      if (grid[nr] && grid[nr][nc] === null) {
        visited.add(key);
        queue.push([nr, nc, d, newTurns, [...path, [nr, nc]]]);
      }
    }
  }
  return null;
}

// ==================== 连线动画 ====================
function drawLine(path) {
  lineSvg.innerHTML = '';
  const boardRect = boardEl.getBoundingClientRect();

  for (let i = 0; i < path.length - 1; i++) {
    const [r1, c1] = path[i];
    const [r2, c2] = path[i + 1];
    const x1 = getTileCenterX(c1, boardRect);
    const y1 = getTileCenterY(r1, boardRect);
    const x2 = getTileCenterX(c2, boardRect);
    const y2 = getTileCenterY(r2, boardRect);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    lineSvg.appendChild(line);
  }

  setTimeout(() => { lineSvg.innerHTML = ''; }, 600);
}

function getTileCenterX(c, rect) {
  const tileW = rect.width / COLS;
  return (c - 1 + 0.5) * tileW;
}
function getTileCenterY(r, rect) {
  const tileH = rect.height / ROWS;
  return (r - 1 + 0.5) * tileH;
}

// ==================== 消除 ====================
function removePair(r1, c1, r2, c2) {
  grid[r1][c1] = null;
  grid[r2][c2] = null;
  remaining -= 2;
  remainEl.textContent = remaining;
  score += 10;
  scoreEl.textContent = score;

  // 动画
  const idx1 = (r1 - 1) * COLS + (c1 - 1);
  const idx2 = (r2 - 1) * COLS + (c2 - 1);
  const tiles = boardEl.children;
  if (tiles[idx1]) tiles[idx1].classList.add('removing');
  if (tiles[idx2]) tiles[idx2].classList.add('removing');

  setTimeout(() => {
    render();
    if (remaining <= 0) {
      gameOver = true;
      stopTimer();
      msgTitle.textContent = '🎉 通关！';
      msgSub.textContent = `得分 ${score}，用时 ${timerEl.textContent}`;
      setTimeout(() => msgEl.classList.remove('hidden'), 300);
    } else if (!hasAnyMatch()) {
      // 无可用配对，自动打乱
      shuffleGrid();
    }
  }, 280);
}

// ==================== 是否有可用配对 ====================
function hasAnyMatch() {
  const tiles = [];
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) tiles.push([r, c]);

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const [r1, c1] = tiles[i];
      const [r2, c2] = tiles[j];
      if (grid[r1][c1] === grid[r2][c2] && findPath(r1, c1, r2, c2)) return true;
    }
  }
  return false;
}

// ==================== 打乱 ====================
function shuffleGrid() {
  const tiles = [];
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) tiles.push(grid[r][c]);

  // Fisher-Yates 洗牌
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  let idx = 0;
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) grid[r][c] = tiles[idx++];

  render();
  // 如果打乱后仍然无解，再打乱一次
  if (!hasAnyMatch()) shuffleGrid();
}

// ==================== 提示 ====================
function findHint() {
  const tiles = [];
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) tiles.push([r, c]);

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const [r1, c1] = tiles[i];
      const [r2, c2] = tiles[j];
      if (grid[r1][c1] === grid[r2][c2] && findPath(r1, c1, r2, c2)) {
        return [[r1, c1], [r2, c2]];
      }
    }
  }
  return null;
}

hintBtn.addEventListener('click', () => {
  const hint = findHint();
  if (!hint) return;
  const [[r1, c1], [r2, c2]] = hint;
  const idx1 = (r1 - 1) * COLS + (c1 - 1);
  const idx2 = (r2 - 1) * COLS + (c2 - 1);
  const tiles = boardEl.children;
  if (tiles[idx1]) tiles[idx1].classList.add('hint');
  if (tiles[idx2]) tiles[idx2].classList.add('hint');
  setTimeout(() => {
    if (tiles[idx1]) tiles[idx1].classList.remove('hint');
    if (tiles[idx2]) tiles[idx2].classList.remove('hint');
  }, 1600);
});

shuffleBtn.addEventListener('click', () => { if (!gameOver) shuffleGrid(); });
restartBtn.addEventListener('click', initGame);

// ==================== 计时 ====================
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
  }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }

// ==================== 启动 ====================
initGame();
