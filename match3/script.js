// ==================== 配置 ====================
const COLS       = 8, ROWS = 8;
const GEMS       = ['💎','🔴','🟡','🟢','🔵','🟣','🟠'];
const INIT_MOVES = 30;
const INIT_TARGET= 500;

// ==================== DOM ====================
const boardEl  = document.getElementById('board');
const scoreEl  = document.getElementById('score');
const highEl   = document.getElementById('high-score');
const movesEl  = document.getElementById('moves');
const targetEl = document.getElementById('target');
const msgEl    = document.getElementById('msg');
const msgTitle = document.getElementById('msg-title');
const msgSub   = document.getElementById('msg-sub');

// ==================== 状态 ====================
let grid, score, highScore, movesLeft, target, selected, busy, gameOver;

// ==================== 工具函数 ====================
function randGem() { return GEMS[Math.floor(Math.random() * GEMS.length)]; }
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }
function gemEl(r, c) { return boardEl.children[r * COLS + c] || null; }

// ==================== 初始化 ====================
function initGame() {
  score     = 0;
  movesLeft = INIT_MOVES;
  target    = INIT_TARGET;
  selected  = null;
  busy      = false;
  gameOver  = false;
  highScore = Number(localStorage.getItem('match3_high') || 0);

  scoreEl.textContent  = 0;
  highEl.textContent   = highScore;
  movesEl.textContent  = movesLeft;
  targetEl.textContent = target;
  msgEl.classList.add('hidden');

  buildGrid();
  render();
}

// ==================== 构建棋盘（无初始匹配，但保证有可用步）====================
function buildGrid() {
  let attempts = 0;
  do {
    grid = Array.from({length: ROWS}, () =>
      Array.from({length: COLS}, () => randGem())
    );
    // 消除初始已有的匹配
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          // 横向检测：若与左边两个相同则换一个
          if (c >= 2 && grid[r][c] === grid[r][c-1] && grid[r][c] === grid[r][c-2]) {
            let ng;
            do { ng = randGem(); } while (ng === grid[r][c]);
            grid[r][c] = ng;
            changed = true;
          }
          // 纵向检测：若与上边两个相同则换一个
          if (r >= 2 && grid[r][c] === grid[r-1][c] && grid[r][c] === grid[r-2][c]) {
            let ng;
            do { ng = randGem(); } while (ng === grid[r][c]);
            grid[r][c] = ng;
            changed = true;
          }
        }
      }
    }
    attempts++;
  } while (!hasAnyMove() && attempts < 20);
}

// ==================== 匹配检测 ====================
// 返回位置坐标数组 [[r,c], ...]，包含所有 3+ 连线的格子
function findAllMatches() {
  const set = new Set();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      if (grid[r][c] && grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) {
        // 向右延伸
        let len = 3;
        while (c + len < COLS && grid[r][c+len] === grid[r][c]) len++;
        for (let k = 0; k < len; k++) set.add(`${r},${c+k}`);
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      if (grid[r][c] && grid[r][c] === grid[r+1][c] && grid[r][c] === grid[r+2][c]) {
        let len = 3;
        while (r + len < ROWS && grid[r+len][c] === grid[r][c]) len++;
        for (let k = 0; k < len; k++) set.add(`${r+k},${c}`);
      }
    }
  }
  return [...set].map(k => k.split(',').map(Number));
}

// ==================== 是否有可用步骤 ====================
function hasAnyMove() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // 尝试向右交换
      if (c + 1 < COLS) {
        [grid[r][c], grid[r][c+1]] = [grid[r][c+1], grid[r][c]];
        const ok = findAllMatches().length > 0;
        [grid[r][c], grid[r][c+1]] = [grid[r][c+1], grid[r][c]];
        if (ok) return true;
      }
      // 尝试向下交换
      if (r + 1 < ROWS) {
        [grid[r][c], grid[r+1][c]] = [grid[r+1][c], grid[r][c]];
        const ok = findAllMatches().length > 0;
        [grid[r][c], grid[r+1][c]] = [grid[r+1][c], grid[r][c]];
        if (ok) return true;
      }
    }
  }
  return false;
}

// ==================== 渲染 ====================
// newCells: Set<"r,c"> 用于标记需要播放下落动画的新格子
function render(newCells = new Set()) {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'gem';
      el.textContent = grid[r][c] || '';
      el.dataset.r = r;
      el.dataset.c = c;
      if (selected && selected[0] === r && selected[1] === c) {
        el.classList.add('selected');
      }
      if (newCells.has(`${r},${c}`)) {
        el.classList.add('falling');
      }
      el.addEventListener('click', () => onGemClick(r, c));
      boardEl.appendChild(el);
    }
  }
}

// ==================== 点击交互 ====================
function onGemClick(r, c) {
  if (busy || gameOver) return;
  if (movesLeft <= 0) return;

  if (!selected) {
    selected = [r, c];
    render();
    return;
  }

  const [sr, sc] = selected;
  selected = null;

  // 再次点击同一格 → 取消选中
  if (sr === r && sc === c) {
    render();
    return;
  }

  // 点击不相邻的格 → 改为选中新格
  const adjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
  if (!adjacent) {
    selected = [r, c];
    render();
    return;
  }

  trySwap(sr, sc, r, c);
}

// ==================== 触摸滑动 ====================
let touchSel = null, touchX0 = 0, touchY0 = 0;
boardEl.addEventListener('touchstart', e => {
  if (busy || gameOver) return;
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el || !el.classList.contains('gem')) return;
  touchSel = [Number(el.dataset.r), Number(el.dataset.c)];
  touchX0 = touch.clientX;
  touchY0 = touch.clientY;
  e.preventDefault();
}, { passive: false });

boardEl.addEventListener('touchend', e => {
  if (!touchSel || busy || gameOver) { touchSel = null; return; }
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchX0;
  const dy = touch.clientY - touchY0;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    // 当作点击
    onGemClick(touchSel[0], touchSel[1]);
    touchSel = null;
    return;
  }
  let [r, c] = touchSel;
  touchSel = null;
  selected = null;
  let r2 = r, c2 = c;
  if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1;
  else                              r2 += dy > 0 ? 1 : -1;
  if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return;
  trySwap(r, c, r2, c2);
  e.preventDefault();
}, { passive: false });

// ==================== 交换 & 消除 ====================
async function trySwap(r1, c1, r2, c2) {
  busy = true;

  // 视觉上先交换（动画感）
  [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
  render();
  await delay(80);

  const matches = findAllMatches();
  if (!matches.length) {
    // 无效：换回并抖动
    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
    render();
    // 短暂高亮两个格子表示无效
    [gemEl(r1,c1), gemEl(r2,c2)].forEach(el => {
      if (el) { el.classList.add('invalid'); setTimeout(() => el.classList.remove('invalid'), 400); }
    });
    busy = false;
    return;
  }

  // 消耗步数
  movesLeft--;
  movesEl.textContent = movesLeft;

  await resolveMatches(0);

  busy = false;
  render();
  checkEnd();
}

async function resolveMatches(chain) {
  const matches = findAllMatches();
  if (!matches.length) return;

  // 计分：连锁越多倍率越高
  const multiplier = chain + 1;
  const pts = matches.length * 10 * multiplier;
  score += pts;
  scoreEl.textContent = score;
  if (score > highScore) {
    highScore = score;
    highEl.textContent = highScore;
    localStorage.setItem('match3_high', highScore);
  }

  // 显示连锁提示
  if (chain >= 1) showChainPop(chain + 1);

  // 播放消除动画
  matches.forEach(([r, c]) => {
    const el = gemEl(r, c);
    if (el) el.classList.add('removing');
  });
  await delay(300);

  // 删除匹配的宝石
  const removedCols = new Set();
  matches.forEach(([r, c]) => {
    grid[r][c] = null;
    removedCols.add(c);
  });

  // 记录每列哪些行是新补充的
  const newCells = new Set();

  // 下落 + 补充
  for (let c = 0; c < COLS; c++) {
    // 把非null的从下往上紧缩
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] !== null) col.push(grid[r][c]);
    }
    // 补充新宝石
    const addCount = ROWS - col.length;
    for (let i = 0; i < addCount; i++) col.push(randGem());
    // 写回（col[0]是最底部的，col[ROWS-1]是最顶部的新宝石）
    for (let r = ROWS - 1; r >= 0; r--) {
      const val = col[ROWS - 1 - r];
      grid[r][c] = val;
    }
    // 新补充的格子在顶部 addCount 行
    for (let r = 0; r < addCount; r++) {
      newCells.add(`${r},${c}`);
    }
  }

  render(newCells);
  await delay(250);

  // 连锁检测
  await resolveMatches(chain + 1);
}

// ==================== 连锁提示 ====================
function showChainPop(n) {
  const pop = document.createElement('div');
  pop.className = 'chain-pop';
  pop.textContent = `🔥 ${n}连锁！`;
  document.querySelector('.container').appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

// ==================== 结束检测 ====================
function checkEnd() {
  if (score >= target) {
    gameOver = true;
    setTimeout(() => showMsg('🎉 胜利！', `得分 ${score}，剩余步数 ${movesLeft}`), 300);
    return;
  }
  if (movesLeft <= 0) {
    gameOver = true;
    setTimeout(() => showMsg('😢 步数用尽', `还差 ${Math.max(0, target - score)} 分达到目标`), 300);
    return;
  }
  if (!hasAnyMove()) {
    gameOver = true;
    setTimeout(() => showMsg('😢 无路可走', '棋盘已无可用步骤，自动洗牌…'), 300);
    // 洗牌而不是直接结束
    setTimeout(() => {
      gameOver = false;
      buildGrid();
      render();
    }, 2000);
  }
}

function showMsg(title, sub) {
  msgTitle.textContent = title;
  msgSub.textContent   = sub;
  msgEl.classList.remove('hidden');
}

// ==================== 启动 ====================
initGame();
