// ==================== 配置 ====================
const W = 600, H = 400;
const PAD_W = 12, PAD_H = 80;
const BALL_R = 8;
const WIN_SCORE = 7;

// ==================== DOM ====================
const canvas  = document.getElementById('game');
const ctx     = canvas.getContext('2d');
const p1El    = document.getElementById('p1-score');
const p2El    = document.getElementById('p2-score');
const modeAi  = document.getElementById('mode-ai');
const mode2p  = document.getElementById('mode-2p');

canvas.width  = W;
canvas.height = H;

// ==================== 状态 ====================
let p1, p2, ball, score1, score2, running, paused, raf;
let vsAI = true;
let trail = [];

// ==================== 模式切换 ====================
modeAi.addEventListener('click', () => {
  vsAI = true;
  modeAi.classList.add('active');
  mode2p.classList.remove('active');
  SFX.play('click');
  reset();
});
mode2p.addEventListener('click', () => {
  vsAI = false;
  mode2p.classList.add('active');
  modeAi.classList.remove('active');
  SFX.play('click');
  reset();
});

// ==================== 初始化 ====================
function reset() {
  p1 = { x: 20, y: H / 2 - PAD_H / 2, w: PAD_W, h: PAD_H };
  p2 = { x: W - 20 - PAD_W, y: H / 2 - PAD_H / 2, w: PAD_W, h: PAD_H };
  score1 = 0; score2 = 0;
  p1El.textContent = 0; p2El.textContent = 0;
  running = false; paused = false;
  trail = [];
  resetBall();
  if (raf) cancelAnimationFrame(raf);
  draw();
}

function resetBall() {
  const spd = 4;
  const angle = (Math.random() * 0.8 - 0.4); // -0.4 ~ 0.4 弧度
  const dir = Math.random() > 0.5 ? 1 : -1;
  ball = { x: W / 2, y: H / 2, vx: spd * dir * Math.cos(angle), vy: spd * Math.sin(angle) };
  trail = [];
}

// ==================== 主循环 ====================
function loop() {
  if (!running) return;
  if (!paused) update();
  draw();
  raf = requestAnimationFrame(loop);
}

function update() {
  // 玩家1移动 (W/S)
  const spd = 6;
  if (keys['w'] || keys['W']) p1.y = Math.max(0, p1.y - spd);
  if (keys['s'] || keys['S']) p1.y = Math.min(H - p1.h, p1.y + spd);

  // 玩家2 / AI 移动
  if (vsAI) {
    // AI：跟踪球的 y，有一定延迟
    const target = ball.y - p2.h / 2;
    const aiSpd = 3.5;
    if (p2.y < target - 5) p2.y = Math.min(H - p2.h, p2.y + aiSpd);
    else if (p2.y > target + 5) p2.y = Math.max(0, p2.y - aiSpd);
  } else {
    if (keys['ArrowUp'])   p2.y = Math.max(0, p2.y - spd);
    if (keys['ArrowDown']) p2.y = Math.min(H - p2.h, p2.y + spd);
  }

  // 球移动
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 轨迹
  trail.push({ x: ball.x, y: ball.y, life: 1 });
  if (trail.length > 20) trail.shift();
  trail.forEach(t => t.life -= 0.05);
  trail = trail.filter(t => t.life > 0);

  // 上下墙反弹
  if (ball.y - BALL_R < 0)  { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); SFX.play('bounce'); }
  if (ball.y + BALL_R > H)  { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy); SFX.play('bounce'); }

  // 挡板碰撞
  // 左挡板
  if (ball.vx < 0 && ball.x - BALL_R <= p1.x + p1.w && ball.x - BALL_R >= p1.x &&
      ball.y >= p1.y && ball.y <= p1.y + p1.h) {
    const rel = (ball.y - (p1.y + p1.h / 2)) / (p1.h / 2);
    const speed = Math.hypot(ball.vx, ball.vy) + 0.2;
    ball.vx = Math.abs(speed * Math.cos(rel * 0.7));
    ball.vy = speed * Math.sin(rel * 0.7);
    ball.x = p1.x + p1.w + BALL_R;
    SFX.play('paddle', { pitch: 1 });
  }
  // 右挡板
  if (ball.vx > 0 && ball.x + BALL_R >= p2.x && ball.x + BALL_R <= p2.x + p2.w &&
      ball.y >= p2.y && ball.y <= p2.y + p2.h) {
    const rel = (ball.y - (p2.y + p2.h / 2)) / (p2.h / 2);
    const speed = Math.hypot(ball.vx, ball.vy) + 0.2;
    ball.vx = -Math.abs(speed * Math.cos(rel * 0.7));
    ball.vy = speed * Math.sin(rel * 0.7);
    ball.x = p2.x - BALL_R;
    SFX.play('paddle', { pitch: 0.85 });
  }

  // 得分
  if (ball.x - BALL_R < 0) {
    score2++;
    p2El.textContent = score2;
    if (!checkWin()) { SFX.play('point'); resetBall(); }
  }
  if (ball.x + BALL_R > W) {
    score1++;
    p1El.textContent = score1;
    if (!checkWin()) { SFX.play('point'); resetBall(); }
  }
}

function checkWin() {
  if (score1 >= WIN_SCORE || score2 >= WIN_SCORE) {
    running = false;
    SFX.play('win');
    const winner = score1 >= WIN_SCORE ? '左方' : '右方';
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00e676';
    ctx.font = 'bold 36px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(`${winner}获胜！`, W / 2, H / 2 - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px Segoe UI';
    ctx.fillText('按空格重新开始', W / 2, H / 2 + 25);
    return true;
  }
  return false;
}

// ==================== 绘制 ====================
function draw() {
  // 背景
  ctx.fillStyle = '#241b33';
  ctx.fillRect(0, 0, W, H);

  // 中线
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // 轨迹
  trail.forEach(t => {
    ctx.globalAlpha = t.life * 0.4;
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.arc(t.x, t.y, BALL_R * t.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // 挡板
  ctx.fillStyle = '#4fc3f7';
  ctx.shadowColor = '#4fc3f7';
  ctx.shadowBlur = 10;
  ctx.fillRect(p1.x, p1.y, p1.w, p1.h);

  ctx.fillStyle = '#ff5252';
  ctx.shadowColor = '#ff5252';
  ctx.fillRect(p2.x, p2.y, p2.w, p2.h);
  ctx.shadowBlur = 0;

  // 球
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#00e676';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 等待提示
  if (!running) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('按空格开始', W / 2, H / 2);
  }
}

// ==================== 输入 ====================
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') {
    e.preventDefault();
    if (!running) {
      if (score1 >= WIN_SCORE || score2 >= WIN_SCORE) reset();
      SFX.play('start');
      running = true;
      raf = requestAnimationFrame(loop);
    }
  }
  if (e.key.toLowerCase() === 'p' && running) {
    paused = !paused;
    SFX.play('click');
    if (!paused) { raf = requestAnimationFrame(loop); }
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// 触摸控制：左半屏控制左方，右半屏控制右方
let touchP1 = null, touchP2 = null;
canvas.addEventListener('touchstart', e => {
  if (!running) { SFX.play('start'); running = true; raf = requestAnimationFrame(loop); }
  handleTouches(e.touches);
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  handleTouches(e.touches);
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  touchP1 = null; touchP2 = null;
  handleTouches(e.touches);
}, { passive: true });

function handleTouches(touches) {
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  touchP1 = null; touchP2 = null;
  for (let i = 0; i < touches.length; i++) {
    const x = (touches[i].clientX - rect.left) / rect.width;
    const y = (touches[i].clientY - rect.top) * scaleY;
    if (x < 0.5) touchP1 = y;
    else touchP2 = y;
  }
  if (touchP1 !== null) p1.y = Math.max(0, Math.min(H - p1.h, touchP1 - p1.h / 2));
  if (touchP2 !== null && !vsAI) p2.y = Math.max(0, Math.min(H - p2.h, touchP2 - p2.h / 2));
}

canvas.addEventListener('click', () => {
  if (!running) { SFX.play('start'); running = true; raf = requestAnimationFrame(loop); }
});

// ==================== 启动 ====================
reset();
