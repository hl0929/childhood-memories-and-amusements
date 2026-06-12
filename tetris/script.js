// ==================== 配置 ====================
const COLS = 10, ROWS = 20;
// 根据屏幕大小动态计算方块大小
function calcBlockSize() {
  const maxW = Math.min(window.innerWidth - 200, 300); // 留出侧边栏空间
  const maxH = window.innerHeight - 200;
  const fromW = Math.floor(maxW / COLS);
  const fromH = Math.floor(maxH / ROWS);
  return Math.max(16, Math.min(30, fromW, fromH));
}
let BLOCK = calcBlockSize();

// 七种方块及颜色
const PIECES = [
  { shape: [[1,1,1,1]],                         color: '#00f5ff' }, // I
  { shape: [[1,1],[1,1]],                        color: '#ffd700' }, // O
  { shape: [[0,1,0],[1,1,1]],                    color: '#c800ff' }, // T
  { shape: [[1,0,0],[1,1,1]],                    color: '#ff8c00' }, // J
  { shape: [[0,0,1],[1,1,1]],                    color: '#0040ff' }, // L
  { shape: [[0,1,1],[1,1,0]],                    color: '#00ff40' }, // S
  { shape: [[1,1,0],[0,1,1]],                    color: '#ff2020' }, // Z
];

// ==================== DOM ====================
const canvas      = document.getElementById('board');
const ctx         = canvas.getContext('2d');
const nextCanvas  = document.getElementById('preview');
const nextCtx     = nextCanvas.getContext('2d');
const scoreEl     = document.getElementById('score');
const linesEl     = document.getElementById('lines');
const levelEl     = document.getElementById('level');
const highEl      = document.getElementById('high-score') || document.createElement('span');
const overlay     = document.getElementById('overlay');
const overlayTitle= document.getElementById('ov-title');
const overlaySub  = document.getElementById('ov-sub');

canvas.width  = COLS * BLOCK;
canvas.height = ROWS * BLOCK;
nextCanvas.width  = 4 * BLOCK;
nextCanvas.height = 4 * BLOCK;
nextCanvas.style.width  = (4 * BLOCK) + 'px';
nextCanvas.style.height = (4 * BLOCK) + 'px';

// ==================== 状态 ====================
let board, piece, nextPiece, score, lines, level, highScore, dropTimer, dropInterval, raf, running, paused;

function init() {
  board       = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  score       = 0;
  lines       = 0;
  level       = 1;
  highScore   = Number(localStorage.getItem('tetris_high') || 0);
  highEl.textContent = highScore;
  nextPiece   = randomPiece();
  spawnPiece();
  running     = true;
  paused      = false;
  dropInterval= 800;
  dropTimer   = 0;
  overlay.classList.add('hidden');
  if (raf) cancelAnimationFrame(raf);
  lastTime = null;
  raf = requestAnimationFrame(loop);
}

function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { shape: p.shape, color: p.color, x: 3, y: 0 };
}

function spawnPiece() {
  piece = nextPiece;
  piece.x = Math.floor((COLS - piece.shape[0].length) / 2);
  piece.y = 0;
  nextPiece = randomPiece();
  drawNext();
  if (!canPlace(piece.shape, piece.x, piece.y)) {
    gameOver();
  }
}

// ==================== 主循环 ====================
let lastTime = null;
function loop(ts) {
  if (!running) return;
  if (lastTime === null) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;
  if (!paused) {
    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      moveDown();
    }
  }
  draw();
  raf = requestAnimationFrame(loop);
}

// ==================== 移动 & 旋转 ====================
function canPlace(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  }
  return true;
}

function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  return Array.from({length: cols}, (_, c) =>
    Array.from({length: rows}, (_, r) => shape[rows - 1 - r][c])
  );
}

function moveLeft()  { if (canPlace(piece.shape, piece.x-1, piece.y)) piece.x--; }
function moveRight() { if (canPlace(piece.shape, piece.x+1, piece.y)) piece.x++; }
function rotatePiece() {
  const r = rotate(piece.shape);
  // wall kick
  let offset = 0;
  if (!canPlace(r, piece.x, piece.y)) {
    offset = piece.x > COLS/2 ? -1 : 1;
    if (!canPlace(r, piece.x + offset, piece.y)) return;
  }
  piece.shape = r;
  piece.x += offset;
}

function moveDown() {
  if (canPlace(piece.shape, piece.x, piece.y + 1)) {
    piece.y++;
  } else {
    lock();
  }
}

function hardDrop() {
  while (canPlace(piece.shape, piece.x, piece.y + 1)) piece.y++;
  lock();
}

function lock() {
  piece.shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const ny = piece.y + r;
      if (ny >= 0) board[ny][piece.x + c] = piece.color;
    });
  });
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      r++; // recheck same row
    }
  }
  if (!cleared) return;
  const pts = [0, 100, 300, 500, 800][cleared] * level;
  score += pts;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(80, 800 - (level - 1) * 70);
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (score > highScore) {
    highScore = score;
    highEl.textContent = highScore;
    localStorage.setItem('tetris_high', highScore);
  }
}

function gameOver() {
  running = false;
  overlayTitle.textContent = '游戏结束';
  overlaySub.textContent   = `得分 ${score} — 按 R 重新开始`;
  overlay.classList.remove('hidden');
}

// ==================== 绘制 ====================
function drawBlock(c, x, y, size = BLOCK) {
  const s = size - 1;
  // 主色
  ctx.fillStyle = c;
  ctx.fillRect(x + 1, y + 1, s - 1, s - 1);
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 1, y + 1, s - 1, 4);
  ctx.fillRect(x + 1, y + 1, 4, s - 1);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x + s - 3, y + 1, 3, s - 1);
  ctx.fillRect(x + 1, y + s - 3, s - 1, 3);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
    }
  }

  // 已落方块
  board.forEach((row, r) => {
    row.forEach((color, c) => {
      if (color) drawBlock(color, c * BLOCK, r * BLOCK);
    });
  });

  // 幽灵块
  let ghostY = piece.y;
  while (canPlace(piece.shape, piece.x, ghostY + 1)) ghostY++;
  if (ghostY !== piece.y) {
    ctx.globalAlpha = 0.2;
    piece.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) drawBlock(piece.color, (piece.x + c) * BLOCK, (ghostY + r) * BLOCK);
      });
    });
    ctx.globalAlpha = 1;
  }

  // 当前方块
  piece.shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) drawBlock(piece.color, (piece.x + c) * BLOCK, (piece.y + r) * BLOCK);
    });
  });
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = nextPiece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const x = (offX + c) * BLOCK, y = (offY + r) * BLOCK;
      nextCtx.fillStyle = nextPiece.color;
      nextCtx.fillRect(x+1, y+1, BLOCK-2, BLOCK-2);
      nextCtx.fillStyle = 'rgba(255,255,255,0.25)';
      nextCtx.fillRect(x+1, y+1, BLOCK-2, 4);
    });
  });
}

// ==================== 键盘输入 ====================
document.addEventListener('keydown', e => {
  if (!running && e.key.toLowerCase() === 'r') { init(); return; }
  if (e.key.toLowerCase() === 'p') {
    paused = !paused;
    if (paused) {
      overlayTitle.textContent = '暂停';
      overlaySub.textContent   = '按 P 继续';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
      lastTime = null;
    }
    return;
  }
  if (!running || paused) return;
  switch (e.key) {
    case 'ArrowLeft':  case 'a': case 'A': moveLeft();    break;
    case 'ArrowRight': case 'd': case 'D': moveRight();   break;
    case 'ArrowDown':  case 's': case 'S': moveDown();    break;
    case 'ArrowUp':    case 'w': case 'W': rotatePiece(); break;
    case ' ': hardDrop(); break;
  }
});

// ==================== 触摸 ====================
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();
}, {passive: false});
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { rotatePiece(); return; }
  if (Math.abs(dx) > Math.abs(dy)) {
    dx > 0 ? moveRight() : moveLeft();
  } else {
    dy > 0 ? hardDrop() : rotatePiece();
  }
}, {passive: false});

// ==================== 移动端按钮 ====================
const mbLeft   = document.getElementById('mb-left');
const mbRight  = document.getElementById('mb-right');
const mbRotate = document.getElementById('mb-rotate');
const mbDown   = document.getElementById('mb-down');
if (mbLeft)   mbLeft.addEventListener('click',   () => { if (running && !paused) moveLeft(); });
if (mbRight)  mbRight.addEventListener('click',  () => { if (running && !paused) moveRight(); });
if (mbRotate) mbRotate.addEventListener('click', () => { if (running && !paused) rotatePiece(); });
if (mbDown)   mbDown.addEventListener('click',   () => { if (running && !paused) hardDrop(); });

// ==================== 启动 ====================
init();
