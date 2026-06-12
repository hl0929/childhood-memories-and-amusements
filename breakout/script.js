// ==================== 配置 ====================
const W = 480, H = 520;
const PAD_W = 80, PAD_H = 10, PAD_Y = H - 40;
const BALL_R = 7;
const BRICK_ROWS = 5, BRICK_COLS = 10;
const BRICK_W = W / BRICK_COLS, BRICK_H = 24, BRICK_GAP = 2;
const BRICK_OFFSET_Y = 50;
const COLORS = ['#ff4444','#ff8800','#ffdd00','#44dd44','#4488ff','#aa44ff'];
const LIVES_MAX = 3;

// ==================== DOM ====================
const canvas     = document.getElementById('game');
const ctx        = canvas.getContext('2d');
const scoreEl    = document.getElementById('score');
const highEl     = document.getElementById('high-score');
const levelEl    = document.getElementById('level');
const livesEl    = document.getElementById('lives');
const overlay    = document.getElementById('overlay');
const ovTitle    = document.getElementById('overlay-title');
const ovSub      = document.getElementById('overlay-sub');

canvas.width  = W;
canvas.height = H;
canvas.style.width  = W + 'px';
canvas.style.height = H + 'px';

// ==================== 状态 ====================
let pad, ball, bricks, score, highScore, level, lives, running, paused, launched, raf;
let particles = [];

// ==================== 粒子 ====================
function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      color, life: 1, r: 2 + Math.random()*3 });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.08;
    p.life -= 0.03;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ==================== 砖块生成 ====================
function buildBricks() {
  bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const hp = level > 2 && r === 0 ? 2 : 1;
      bricks.push({
        x: c * BRICK_W + BRICK_GAP/2,
        y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_GAP),
        w: BRICK_W - BRICK_GAP, h: BRICK_H - BRICK_GAP,
        color: COLORS[(r + c * 2) % COLORS.length],
        hp, maxHp: hp, alive: true
      });
    }
  }
}

// ==================== 初始化 ====================
function init(keepLevel = false) {
  if (!keepLevel) level = 1;
  highScore = Number(localStorage.getItem('breakout_high') || 0);
  highEl.textContent = highScore;
  score  = 0;
  lives  = LIVES_MAX;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  resetBall();
  buildBricks();
  running = true;
  paused  = false;
  overlay.classList.add('hidden');
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function resetBall() {
  pad = { x: W/2 - PAD_W/2, y: PAD_Y, w: PAD_W, h: PAD_H };
  const spd = 4 + (level - 1) * 0.4;
  ball = { x: W/2, y: PAD_Y - BALL_R - 2, vx: spd * (Math.random() > 0.5 ? 1 : -1), vy: -spd };
  launched = false;
}

// ==================== 主循环 ====================
function loop() {
  if (!running) return;
  if (!paused) update();
  draw();
  raf = requestAnimationFrame(loop);
}

function update() {
  updateParticles();
  if (!launched) {
    ball.x = pad.x + pad.w / 2;
    return;
  }

  // 挡板移动
  if (keys['ArrowLeft']  || keys['a']) pad.x = Math.max(0, pad.x - 6);
  if (keys['ArrowRight'] || keys['d']) pad.x = Math.min(W - pad.w, pad.x + 6);

  // 球移动
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 墙反弹
  if (ball.x - BALL_R < 0)  { ball.x = BALL_R;  ball.vx = Math.abs(ball.vx); }
  if (ball.x + BALL_R > W)  { ball.x = W-BALL_R; ball.vx = -Math.abs(ball.vx); }
  if (ball.y - BALL_R < 0)  { ball.y = BALL_R;   ball.vy = Math.abs(ball.vy); }

  // 挡板碰撞
  if (ball.vy > 0 &&
      ball.y + BALL_R >= pad.y &&
      ball.y - BALL_R <= pad.y + pad.h &&
      ball.x >= pad.x && ball.x <= pad.x + pad.w) {
    // 根据击打位置改变角度
    const rel = (ball.x - (pad.x + pad.w/2)) / (pad.w/2);
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = rel * speed;
    ball.vy = -Math.sqrt(speed*speed - ball.vx*ball.vx);
    ball.y = pad.y - BALL_R;
  }

  // 砖块碰撞
  for (const b of bricks) {
    if (!b.alive) continue;
    if (ball.x + BALL_R < b.x || ball.x - BALL_R > b.x + b.w) continue;
    if (ball.y + BALL_R < b.y || ball.y - BALL_R > b.y + b.h) continue;

    b.hp--;
    spawnParticles(ball.x, ball.y, b.color);
    if (b.hp <= 0) {
      b.alive = false;
      const pts = (b.maxHp > 1 ? 20 : 10) * level;
      score += pts;
      scoreEl.textContent = score;
      if (score > highScore) {
        highScore = score;
        highEl.textContent = highScore;
        localStorage.setItem('breakout_high', highScore);
      }
    }

    // 反弹方向（从哪个面撞入）
    const overlapL = ball.x + BALL_R - b.x;
    const overlapR = b.x + b.w - (ball.x - BALL_R);
    const overlapT = ball.y + BALL_R - b.y;
    const overlapB = b.y + b.h - (ball.y - BALL_R);
    const minH = Math.min(overlapL, overlapR);
    const minV = Math.min(overlapT, overlapB);
    if (minH < minV) ball.vx = -ball.vx;
    else             ball.vy = -ball.vy;
    break;
  }

  // 通关
  if (bricks.every(b => !b.alive)) {
    level++;
    levelEl.textContent = level;
    buildBricks();
    resetBall();
    return;
  }

  // 掉球
  if (ball.y - BALL_R > H) {
    lives--;
    livesEl.textContent = lives;
    if (lives <= 0) {
      running = false;
      ovTitle.textContent = '游戏结束';
      ovSub.textContent   = `得分 ${score}  —  按 R 重玩`;
      overlay.classList.remove('hidden');
    } else {
      resetBall();
    }
  }
}

// ==================== 绘制 ====================
function draw() {
  ctx.clearRect(0, 0, W, H);

  // 背景渐变
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0, '#111827');
  bg.addColorStop(1, '#0d1117');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 砖块
  bricks.forEach(b => {
    if (!b.alive) return;
    const alpha = b.hp / b.maxHp;
    ctx.globalAlpha = 0.4 + alpha * 0.6;
    ctx.fillStyle = b.color;
    const rx = 4;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, rx);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(b.x+2, b.y+2, b.w-4, 5, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // 粒子
  drawParticles();

  // 挡板
  const padGrad = ctx.createLinearGradient(pad.x, pad.y, pad.x+pad.w, pad.y);
  padGrad.addColorStop(0, '#00f5ff');
  padGrad.addColorStop(1, '#00aaff');
  ctx.fillStyle = padGrad;
  ctx.beginPath();
  ctx.roundRect(pad.x, pad.y, pad.w, pad.h, 5);
  ctx.fill();
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur  = 12;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // 球
  const ballGrad = ctx.createRadialGradient(ball.x-2, ball.y-2, 1, ball.x, ball.y, BALL_R);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(1, '#00f5ff');
  ctx.fillStyle = ballGrad;
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur  = 16;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 待发射提示
  if (!launched) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('按空格 / 点击发球', W/2, H - 12);
  }
}

// ==================== 输入 ====================
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') {
    e.preventDefault();
    if (!running) { init(); return; }
    if (paused) return;
    launched = true;
  }
  if (e.key.toLowerCase() === 'r') { init(); return; }
  if (e.key.toLowerCase() === 'p') {
    if (!running) return;
    paused = !paused;
    if (paused) {
      ovTitle.textContent = '暂停';
      ovSub.textContent   = '按 P 继续';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// 鼠标 / 触摸控制挡板
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  pad.x = Math.max(0, Math.min(W - pad.w, mx - pad.w/2));
});
canvas.addEventListener('click', () => {
  if (!running) { init(); return; }
  launched = true;
});
let touchX = 0;
canvas.addEventListener('touchstart', e => {
  touchX = e.touches[0].clientX;
  launched = true;
  e.preventDefault();
}, {passive:false});
canvas.addEventListener('touchmove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.touches[0].clientX - rect.left;
  pad.x = Math.max(0, Math.min(W - pad.w, mx - pad.w/2));
  e.preventDefault();
}, {passive:false});

// ==================== 启动 ====================
init();
