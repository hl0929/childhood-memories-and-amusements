// ==================== 游戏配置 ====================
const GRID     = 20;
const BASE_MS  = 150;
const SPEED_UP = 5;
const SPEED_MS = 8;
const GOLDEN_CHANCE = 0.15;   // 金色食物出现概率

// ==================== DOM ====================
const canvas       = document.getElementById('game');
const ctx          = canvas.getContext('2d');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-sub');
const scoreEl      = document.getElementById('score');
const highScoreEl  = document.getElementById('high-score');
const speedEl      = document.getElementById('speed');
const scorePop     = document.getElementById('score-pop');
const canvasWrap   = document.querySelector('.canvas-wrapper');
const bgCanvas     = document.getElementById('bg');

// ==================== 高 DPI 适配 ====================
const dpr  = window.devicePixelRatio || 1;
let SIZE = 400;
// 根据屏幕大小动态调整画布尺寸
function calcCanvasSize() {
  const maxW = Math.min(window.innerWidth - 48, 400);
  const maxH = window.innerHeight - 260;
  return Math.max(200, Math.min(maxW, maxH, 400));
}
SIZE = calcCanvasSize();
canvas.width  = SIZE * dpr;
canvas.height = SIZE * dpr;
canvas.style.width  = SIZE + 'px';
canvas.style.height = SIZE + 'px';
ctx.scale(dpr, dpr);

let CELL = SIZE / GRID;

// ==================== 离屏缓存：网格 ====================
const gridCanvas  = document.createElement('canvas');
gridCanvas.width  = SIZE * dpr;
gridCanvas.height = SIZE * dpr;
const gridCtx     = gridCanvas.getContext('2d');
gridCtx.scale(dpr, dpr);
(function drawGrid() {
  gridCtx.fillStyle = '#1a1a2e';
  gridCtx.fillRect(0, 0, SIZE, SIZE);
  gridCtx.strokeStyle = 'rgba(255,255,255,0.03)';
  gridCtx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    gridCtx.beginPath(); gridCtx.moveTo(i * CELL, 0); gridCtx.lineTo(i * CELL, SIZE); gridCtx.stroke();
    gridCtx.beginPath(); gridCtx.moveTo(0, i * CELL); gridCtx.lineTo(SIZE, i * CELL); gridCtx.stroke();
  }
})();

// ==================== 方向 ====================
const DIR = {
  UP:    { x:  0, y: -1 },
  DOWN:  { x:  0, y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 },
};

// ==================== 音效 (Web Audio API) ====================
let audioCtx;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'square', vol = 0.12) {
  try {
    ensureAudio();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) { /* 静默失败 */ }
}

function sfxEat()   { playTone(660, 0.1, 'sine', 0.1); setTimeout(() => playTone(880, 0.12, 'sine', 0.08), 60); }
function sfxGold()  { playTone(880, 0.08, 'sine', 0.12); setTimeout(() => playTone(1100, 0.08, 'sine', 0.1), 50); setTimeout(() => playTone(1320, 0.15, 'sine', 0.08), 100); }
function sfxDie()   { playTone(220, 0.3, 'sawtooth', 0.12); setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.08), 150); }

// ==================== 粒子系统 ====================
let particles = [];

function emitParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      size: 2 + Math.random() * 2,
      color,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // 微重力
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ==================== 背景漂浮粒子 ====================
let bgStars = [];
function initBgStars() {
  bgStars = [];
  for (let i = 0; i < 30; i++) {
    bgStars.push({
      x: Math.random() * SIZE,
      y: Math.random() * SIZE,
      r: 0.5 + Math.random() * 1,
      speed: 0.1 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    });
  }
}
initBgStars();

// ==================== 游戏状态 ====================
let snake, direction, nextDirection, food, score, highScore, level;
let gameState; // 'idle' | 'running' | 'paused' | 'over'
let lastTime, interval;
let snakeSet;
let dirQueue;
let animFrame;
let frameCount;
let isNewRecord;       // 是否刚刷新纪录

highScore = +localStorage.getItem('snake_high') || 0;
highScoreEl.textContent = highScore;

// ==================== 初始化 ====================
function init() {
  if (animFrame) cancelAnimationFrame(animFrame);

  snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  snakeSet = new Set(snake.map(s => `${s.x},${s.y}`));

  direction     = DIR.RIGHT;
  nextDirection = DIR.RIGHT;
  dirQueue      = [];
  score         = 0;
  level         = 1;
  interval      = BASE_MS;
  frameCount    = 0;
  isNewRecord   = false;
  particles     = [];
  scoreEl.textContent = 0;
  speedEl.textContent = 1;
  spawnFood();
  gameState = 'idle';
  showOverlay('贪吃蛇', '按任意方向键开始游戏');
  draw();
}

// ==================== 食物生成 ====================
function spawnFood() {
  if (snake.length >= GRID * GRID) {
    gameState = 'over';
    showOverlay('恭喜通关!', `得分: ${score}  |  按 R 重新开始`);
    return;
  }
  const occupied = snakeSet;
  let pos;
  do {
    pos = { x: rand(GRID), y: rand(GRID) };
  } while (occupied.has(`${pos.x},${pos.y}`));

  const isGolden = Math.random() < GOLDEN_CHANCE;
  food = { ...pos, golden: isGolden };
}

function rand(max) {
  return Math.floor(Math.random() * max);
}

// ==================== 从方向队列取下一个有效方向 ====================
function dequeueDirection() {
  while (dirQueue.length) {
    const d = dirQueue.shift();
    if (d.x + nextDirection.x === 0 && d.y + nextDirection.y === 0) continue;
    return d;
  }
  return nextDirection;
}

// ==================== 游戏循环 ====================
function loop(timestamp) {
  if (gameState !== 'running') return;
  if (!lastTime) lastTime = timestamp;

  // 粒子用 RAF 驱动，比游戏 tick 更流畅
  const tick = timestamp - lastTime >= interval;
  if (tick) {
    lastTime = timestamp;
    frameCount++;
    update();
  }

  // 每帧都绘制（粒子动画需要）
  updateParticles();
  draw();
  animFrame = requestAnimationFrame(loop);
}

// ==================== 逻辑更新 ====================
function update() {
  nextDirection = dequeueDirection();
  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  // 碰墙
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
    return gameOver();
  }
  // 碰自身 O(1)
  if (snakeSet.has(`${head.x},${head.y}`)) {
    return gameOver();
  }

  snake.unshift(head);
  snakeSet.add(`${head.x},${head.y}`);

  // 吃到食物
  if (head.x === food.x && head.y === food.y) {
    const pts = food.golden ? 3 : 1;
    score += pts;
    scoreEl.textContent = score;
    triggerScorePop(pts);

    // 粒子爆发
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;
    const pColor = food.golden ? '#ffd700' : '#ff5050';
    emitParticles(cx, cy, pColor, food.golden ? 14 : 8);

    // 音效
    food.golden ? sfxGold() : sfxEat();

    // 加速
    if (score % SPEED_UP === 0) {
      level++;
      interval = Math.max(50, BASE_MS - (level - 1) * SPEED_MS);
      speedEl.textContent = level;
    }

    // 最高分
    if (score > highScore) {
      if (!isNewRecord) {
        isNewRecord = true;
        // 新纪录庆祝粒子
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            emitParticles(
              Math.random() * SIZE, Math.random() * SIZE,
              ['#ffd700', '#00ff88', '#ff5050', '#50aaff'][rand(4)],
              6
            );
          }, i * 120);
        }
      }
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem('snake_high', highScore);
    }

    spawnFood();
  } else {
    const tail = snake.pop();
    snakeSet.delete(`${tail.x},${tail.y}`);
  }
}

// ==================== 绘制 ====================
function draw() {
  // 背景 + 网格（缓存）
  ctx.drawImage(gridCanvas, 0, 0, SIZE, SIZE);

  // 背景漂浮粒子
  drawBgStars();

  // 食物
  drawFood();

  // 蛇身
  drawSnake();

  // 爆发粒子（最上层）
  drawParticles();
}

function drawBgStars() {
  for (const s of bgStars) {
    const alpha = 0.15 + 0.1 * Math.sin(frameCount * 0.03 + s.phase);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFood() {
  const pulse = 0.85 + 0.15 * Math.sin(frameCount * 0.15);
  const fx = food.x * CELL + CELL / 2;
  const fy = food.y * CELL + CELL / 2;

  if (food.golden) {
    // 金色食物：旋转光环
    const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL * 1.2);
    glow.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
    glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(food.x * CELL - CELL, food.y * CELL - CELL, CELL * 3, CELL * 3);

    // 旋转光点
    const angle = frameCount * 0.08;
    for (let i = 0; i < 4; i++) {
      const a = angle + (Math.PI / 2) * i;
      const ox = fx + Math.cos(a) * CELL * 0.5;
      const oy = fy + Math.sin(a) * CELL * 0.5;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(ox, oy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffd700';
  } else {
    // 普通食物：红色发光
    const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL * pulse);
    glow.addColorStop(0, 'rgba(255, 80, 80, 0.5)');
    glow.addColorStop(1, 'rgba(255, 80, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(food.x * CELL - CELL / 2, food.y * CELL - CELL / 2, CELL * 2, CELL * 2);

    ctx.fillStyle = '#ff5050';
  }

  const pad = (1 - pulse) * CELL * 0.5 + 2;
  roundRect(food.x * CELL + pad, food.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, food.golden ? 6 : 4);
  ctx.fill();

  // 金色食物显示 "x3"
  if (food.golden) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('x3', fx, fy);
  }
}

function drawSnake() {
  const len = snake.length;

  // 先画连接段（填补段间缝隙）
  for (let i = 0; i < len - 1; i++) {
    const a = snake[i], b = snake[i + 1];
    const dx = a.x - b.x, dy = a.y - b.y;
    // 只连接相邻格（排除瞬移情况）
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;

    const ratio = 1 - i / len;
    const g = 180 + Math.round(ratio * 75);
    const bv = 100 + Math.round(ratio * 36);
    ctx.fillStyle = `rgb(0,${g},${bv})`;

    const mx = Math.min(a.x, b.x) * CELL + (dx === 0 ? 2 : 0);
    const my = Math.min(a.y, b.y) * CELL + (dy === 0 ? 2 : 0);
    const mw = (dx !== 0 ? CELL + Math.abs(dx) * 0 : CELL) - (dx === 0 ? 4 : 0);
    const mh = (dy !== 0 ? CELL + Math.abs(dy) * 0 : CELL) - (dy === 0 ? 4 : 0);

    // 简化：画连接矩形
    if (dx !== 0) {
      ctx.fillRect(Math.min(a.x, b.x) * CELL + 2, a.y * CELL + 2, CELL * 2 - 4, CELL - 4);
    } else if (dy !== 0) {
      ctx.fillRect(a.x * CELL + 2, Math.min(a.y, b.y) * CELL + 2, CELL - 4, CELL * 2 - 4);
    }
  }

  // 再画每节蛇身（覆盖在连接段上面）
  for (let i = len - 1; i >= 0; i--) {
    const seg = snake[i];
    const ratio = 1 - i / len;
    const g = 180 + Math.round(ratio * 75);
    const bv = 100 + Math.round(ratio * 36);
    ctx.fillStyle = `rgb(0,${g},${bv})`;

    const pad = i === 0 ? 1 : 2;
    const radius = i === 0 ? 6 : 4;
    roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, radius);
    ctx.fill();
  }

  // 蛇眼
  if (len) drawEyes();
}

function drawEyes() {
  const h = snake[0];
  ctx.fillStyle = '#fff';
  const cx = h.x * CELL + CELL / 2;
  const cy = h.y * CELL + CELL / 2;
  const off = 3;
  const fwd = direction;

  const ex = cx + fwd.x * 3;
  const ey = cy + fwd.y * 3;

  const px = -fwd.y;
  const py = fwd.x;

  ctx.beginPath();
  ctx.arc(ex + px * off, ey + py * off, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex - px * off, ey - py * off, 2, 0, Math.PI * 2);
  ctx.fill();
}

// 辅助：圆角矩形
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

// ==================== 游戏结束 ====================
function gameOver() {
  gameState = 'over';
  sfxDie();
  canvasWrap.classList.add('shake');
  setTimeout(() => canvasWrap.classList.remove('shake'), 300);

  // 死亡粒子
  const cx = snake[0].x * CELL + CELL / 2;
  const cy = snake[0].y * CELL + CELL / 2;
  emitParticles(cx, cy, '#ff5050', 16);
  emitParticles(cx, cy, '#fff', 6);

  showOverlay('游戏结束', `得分: ${score}  |  按 R 重新开始`);
}

// ==================== 得分弹出动画 ====================
function triggerScorePop(pts = 1) {
  scorePop.textContent = `+${pts}`;
  scorePop.classList.remove('pop');
  scoreEl.classList.remove('bump');
  void scorePop.offsetWidth;
  scorePop.classList.add('pop');
  scoreEl.classList.add('bump');
}

// ==================== 覆盖层 ====================
function showOverlay(title, sub) {
  overlayTitle.textContent = title;
  overlaySub.textContent   = sub;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ==================== 输入处理 ====================
function enqueueDirection(dir) {
  if (dirQueue.length < 3) dirQueue.push(dir);
}

function tryStart() {
  if (gameState === 'over') init();
  if (gameState === 'idle' || gameState === 'over') {
    gameState = 'running';
    hideOverlay();
    lastTime = null;
    animFrame = requestAnimationFrame(loop);
  }
}

document.addEventListener('keydown', (e) => {
  const key = e.key;
  switch (key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); enqueueDirection(DIR.UP);    tryStart(); break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); enqueueDirection(DIR.DOWN);  tryStart(); break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); enqueueDirection(DIR.LEFT);  tryStart(); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); enqueueDirection(DIR.RIGHT); tryStart(); break;
    case 'p': case 'P':
      if (gameState === 'running') {
        gameState = 'paused';
        showOverlay('已暂停', '按 P 继续');
      } else if (gameState === 'paused') {
        gameState = 'running';
        hideOverlay();
        lastTime = null;
        animFrame = requestAnimationFrame(loop);
      }
      break;
    case 'r': case 'R':
      init();
      break;
  }
});

// 移动端虚拟按键
document.getElementById('btn-up').addEventListener('click',    () => { enqueueDirection(DIR.UP);    tryStart(); });
document.getElementById('btn-down').addEventListener('click',  () => { enqueueDirection(DIR.DOWN);  tryStart(); });
document.getElementById('btn-left').addEventListener('click',  () => { enqueueDirection(DIR.LEFT);  tryStart(); });
document.getElementById('btn-right').addEventListener('click', () => { enqueueDirection(DIR.RIGHT); tryStart(); });

// 移动端滑动
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    enqueueDirection(dx > 0 ? DIR.RIGHT : DIR.LEFT);
  } else {
    enqueueDirection(dy > 0 ? DIR.DOWN : DIR.UP);
  }
  tryStart();
  touchStart = null;
}, { passive: true });

// ==================== 启动 ====================
init();
