// ==================== 配置 ====================
let ROWS = 9, COLS = 9, MINES = 10;

// ==================== DOM ====================
const boardEl     = document.getElementById('board');
const minesLeftEl = document.getElementById('mines-left');
const timerEl     = document.getElementById('timer');
const msgEl       = document.getElementById('msg');
const msgTitle    = document.getElementById('msg-title');
const msgSub      = document.getElementById('msg-sub');
const diffBtns    = document.querySelectorAll('.diff-btn');

// ==================== 状态 ====================
let grid, revealed, flagged, gameOver, firstClick, timerInterval, startTime, minesLeft;

// ==================== 难度 ====================
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ROWS  = Number(btn.dataset.rows);
    COLS  = Number(btn.dataset.cols);
    MINES = Number(btn.dataset.mines);
    initGame();
  });
});

// ==================== 初始化 ====================
function initGame() {
  grid     = Array.from({length: ROWS}, () => Array(COLS).fill(0));
  revealed = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  flagged  = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  gameOver = false;
  firstClick = true;
  minesLeft = MINES;
  minesLeftEl.textContent = minesLeft;
  timerEl.textContent = '0s';
  clearInterval(timerInterval);
  msgEl.classList.add('hidden');
  render();
}

// ==================== 布雷（首次点击后） ====================
function placeMines(safeR, safeC) {
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    // 安全区：首次点击周围 3x3
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    if (grid[r][c] === -1) continue;
    grid[r][c] = -1;
    placed++;
  }
  // 计算数字
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      forNeighbors(r, c, (nr, nc) => { if (grid[nr][nc] === -1) count++; });
      grid[r][c] = count;
    }
  }
}

function forNeighbors(r, c, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) fn(nr, nc);
    }
  }
}

// ==================== 渲染 ====================
function render() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  boardEl.style.setProperty('--cols', COLS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;
      if (revealed[r][c]) {
        el.classList.add('revealed');
        if (grid[r][c] === -1) {
          el.classList.add('mine-revealed');
        } else if (grid[r][c] > 0) {
          el.textContent = grid[r][c];
          el.classList.add('n' + grid[r][c]);
        }
      } else if (flagged[r][c]) {
        el.classList.add('flagged');
      }
      boardEl.appendChild(el);
    }
  }
}

// ==================== 翻开 ====================
function reveal(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (revealed[r][c] || flagged[r][c]) return;
  revealed[r][c] = true;

  if (grid[r][c] === -1) {
    // 踩雷
    gameOver = true;
    clearInterval(timerInterval);
    // 显示所有雷
    for (let rr = 0; rr < ROWS; rr++)
      for (let cc = 0; cc < COLS; cc++)
        if (grid[rr][cc] === -1) revealed[rr][cc] = true;
    render();
    // 标记踩到的那颗
    const idx = r * COLS + c;
    boardEl.children[idx].classList.add('mine-exploded');
    msgTitle.textContent = '💥 游戏结束';
    msgSub.textContent = `用时 ${timerEl.textContent}`;
    setTimeout(() => msgEl.classList.remove('hidden'), 300);
    return;
  }

  // 空格递归展开
  if (grid[r][c] === 0) {
    forNeighbors(r, c, (nr, nc) => reveal(nr, nc));
  }

  // 检查胜利
  checkWin();
}

// ==================== 标旗 ====================
function toggleFlag(r, c) {
  if (revealed[r][c] || gameOver) return;
  flagged[r][c] = !flagged[r][c];
  minesLeft += flagged[r][c] ? -1 : 1;
  minesLeftEl.textContent = minesLeft;
  render();
}

// ==================== 胜利检测 ====================
function checkWin() {
  let unrevealed = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!revealed[r][c]) unrevealed++;
  if (unrevealed === MINES) {
    gameOver = true;
    clearInterval(timerInterval);
    // 自动标记所有雷
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!revealed[r][c]) flagged[r][c] = true;
    minesLeft = 0;
    minesLeftEl.textContent = 0;
    render();
    msgTitle.textContent = '🎉 胜利！';
    msgSub.textContent = `用时 ${timerEl.textContent}`;
    setTimeout(() => msgEl.classList.remove('hidden'), 300);
  }
}

// ==================== 计时 ====================
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
  }, 1000);
}

// ==================== 点击处理 ====================
boardEl.addEventListener('click', e => {
  const el = e.target;
  if (!el.classList.contains('cell') || gameOver) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  if (flagged[r][c]) return;

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    startTimer();
  }
  reveal(r, c);
  if (!gameOver) render();
});

// 右键标旗
boardEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const el = e.target;
  if (!el.classList.contains('cell') || gameOver) return;
  toggleFlag(+el.dataset.r, +el.dataset.c);
});

// 长按标旗（移动端）
let longPressTimer = null;
let longPressed = false;
boardEl.addEventListener('touchstart', e => {
  const el = e.target;
  if (!el.classList.contains('cell')) return;
  longPressed = false;
  longPressTimer = setTimeout(() => {
    longPressed = true;
    toggleFlag(+el.dataset.r, +el.dataset.c);
  }, 400);
}, { passive: true });
boardEl.addEventListener('touchend', e => {
  clearTimeout(longPressTimer);
  if (longPressed) { e.preventDefault(); longPressed = false; }
}, { passive: false });
boardEl.addEventListener('touchmove', () => { clearTimeout(longPressTimer); }, { passive: true });

// 键盘
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r') initGame();
});

// ==================== 启动 ====================
initGame();
