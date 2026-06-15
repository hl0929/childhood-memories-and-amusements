// ==================== 配置 ====================
const W = 420, H = 600;
const PLAYER_W = 36, PLAYER_H = 40;
const BULLET_W = 4, BULLET_H = 12;
const ENEMY_W = 30, ENEMY_H = 30;
const LIVES_MAX = 3;

// ==================== DOM ====================
const canvas   = document.getElementById('game');
const ctx      = canvas.getContext('2d');
const scoreEl  = document.getElementById('score');
const highEl   = document.getElementById('high-score');
const livesEl  = document.getElementById('lives');
const waveEl   = document.getElementById('wave');
const overlay  = document.getElementById('overlay');
const ovTitle  = document.getElementById('overlay-title');
const ovSub    = document.getElementById('overlay-sub');

canvas.width  = W;
canvas.height = H;

// ==================== 状态 ====================
let player, bullets, enemies, particles;
let score, highScore, lives, wave, running, paused, raf;
let spawnTimer, spawnInterval;
let shootCooldown = 0;

// ==================== 初始化 ====================
function init() {
  player = { x: W / 2 - PLAYER_W / 2, y: H - 60, w: PLAYER_W, h: PLAYER_H };
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  lives = LIVES_MAX;
  wave = 1;
  spawnInterval = 60;
  spawnTimer = 0;
  shootCooldown = 0;
  running = true;
  paused = false;
  highScore = Number(localStorage.getItem('shooter_high') || 0);
  scoreEl.textContent = 0;
  highEl.textContent = highScore;
  livesEl.textContent = lives;
  waveEl.textContent = wave;
  overlay.classList.add('hidden');
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

// ==================== 粒子 ====================
function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      color, life: 1, r: 1.5 + Math.random() * 2.5 });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05;
    p.life -= 0.025;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ==================== 主循环 ====================
function loop() {
  if (!running) return;
  if (!paused) update();
  draw();
  raf = requestAnimationFrame(loop);
}

function update() {
  // 移动玩家
  const spd = 5;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) player.x = Math.max(0, player.x - spd);
  if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x = Math.min(W - player.w, player.x + spd);
  if (keys['ArrowUp']    || keys['w'] || keys['W']) player.y = Math.max(0, player.y - spd);
  if (keys['ArrowDown']  || keys['s'] || keys['S']) player.y = Math.min(H - player.h, player.y + spd);

  // 自动射击（按住空格或触摸时）
  shootCooldown--;
  if ((keys[' '] || touchActive) && shootCooldown <= 0) {
    bullets.push({ x: player.x + player.w / 2 - BULLET_W / 2, y: player.y - BULLET_H, w: BULLET_W, h: BULLET_H, vy: -8 });
    shootCooldown = 8;
  }

  // 子弹移动
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y += bullets[i].vy;
    if (bullets[i].y + bullets[i].h < 0) bullets.splice(i, 1);
  }

  // 生成敌机
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    const ex = Math.random() * (W - ENEMY_W);
    const hp = wave >= 3 ? (Math.random() < 0.3 ? 2 : 1) : 1;
    const ey = -ENEMY_H;
    const espd = 1.5 + wave * 0.3 + Math.random() * 1.5;
    enemies.push({ x: ex, y: ey, w: ENEMY_W, h: ENEMY_H, vy: espd, hp, maxHp: hp, color: hp > 1 ? '#ff8800' : '#ff4444' });
  }

  // 敌机移动
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].y += enemies[i].vy;
    if (enemies[i].y > H) {
      enemies.splice(i, 1);
      continue;
    }
    // 碰撞检测：敌机 vs 玩家
    if (rectCollide(enemies[i], player)) {
      spawnParticles(player.x + player.w / 2, player.y, '#ff5252', 16);
      enemies.splice(i, 1);
      lives--;
      livesEl.textContent = lives;
      if (lives <= 0) return endGame();
    }
  }

  // 子弹 vs 敌机
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      if (!bullets[bi] || !enemies[ei]) continue;
      if (rectCollide(bullets[bi], enemies[ei])) {
        spawnParticles(enemies[ei].x + enemies[ei].w / 2, enemies[ei].y + enemies[ei].h / 2, enemies[ei].color, 6);
        enemies[ei].hp--;
        bullets.splice(bi, 1);
        if (enemies[ei].hp <= 0) {
          const pts = enemies[ei].maxHp > 1 ? 20 : 10;
          score += pts;
          scoreEl.textContent = score;
          if (score > highScore) { highScore = score; highEl.textContent = highScore; localStorage.setItem('shooter_high', highScore); }
          spawnParticles(enemies[ei].x + enemies[ei].w / 2, enemies[ei].y + enemies[ei].h / 2, '#ffd700', 10);
          enemies.splice(ei, 1);
          // 波次升级
          if (score >= wave * 200) { wave++; waveEl.textContent = wave; spawnInterval = Math.max(15, 60 - wave * 5); }
        }
        break;
      }
    }
  }

  updateParticles();
}

function rectCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function endGame() {
  running = false;
  ovTitle.textContent = '游戏结束';
  ovSub.textContent = `得分 ${score}  —  按 R 重玩`;
  overlay.classList.remove('hidden');
}

// ==================== 绘制 ====================
function draw() {
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1117');
  bg.addColorStop(1, '#111827');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 星星背景
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137.5) % W;
    const sy = ((i * 97.3 + (running && !paused ? Date.now() * 0.02 : 0)) % (H + 10)) - 5;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  // 玩家
  const px = player.x + player.w / 2;
  const py = player.y;
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - player.w / 2, py + player.h);
  ctx.lineTo(px - 4, py + player.h * 0.7);
  ctx.lineTo(px + 4, py + player.h * 0.7);
  ctx.lineTo(px + player.w / 2, py + player.h);
  ctx.closePath();
  ctx.fill();
  // 引擎火焰
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(px - 5, py + player.h * 0.75);
  ctx.lineTo(px, py + player.h + 6 + Math.random() * 6);
  ctx.lineTo(px + 5, py + player.h * 0.75);
  ctx.fill();

  // 子弹
  ctx.fillStyle = '#4fc3f7';
  ctx.shadowColor = '#4fc3f7';
  ctx.shadowBlur = 8;
  bullets.forEach(b => {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });
  ctx.shadowBlur = 0;

  // 敌机
  enemies.forEach(e => {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(e.x + e.w / 2, e.y + e.h);
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(e.x + e.w / 2, e.y + e.h * 0.35);
    ctx.lineTo(e.x + e.w, e.y);
    ctx.closePath();
    ctx.fill();
    // 血条
    if (e.maxHp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x, e.y - 5, e.w, 3);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(e.x, e.y - 5, e.w * (e.hp / e.maxHp), 3);
    }
  });

  // 粒子
  drawParticles();
}

// ==================== 输入 ====================
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') { e.preventDefault(); if (!running) { init(); return; } }
  if (e.key.toLowerCase() === 'r') { init(); return; }
  if (e.key.toLowerCase() === 'p' && running) {
    paused = !paused;
    if (paused) { ovTitle.textContent = '暂停'; ovSub.textContent = '按 P 继续'; overlay.classList.remove('hidden'); }
    else overlay.classList.add('hidden');
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// 触摸控制
let touchActive = false;
canvas.addEventListener('touchstart', e => {
  touchActive = true;
  if (!running) { init(); return; }
  movePlayerToTouch(e);
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  movePlayerToTouch(e);
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', () => { touchActive = false; });

function movePlayerToTouch(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const touch = e.touches[0];
  const mx = (touch.clientX - rect.left) * scaleX;
  const my = (touch.clientY - rect.top) * scaleX;
  player.x = Math.max(0, Math.min(W - player.w, mx - player.w / 2));
  player.y = Math.max(0, Math.min(H - player.h, my - player.h - 30));
}

canvas.addEventListener('click', () => { if (!running) init(); });

// ==================== 启动 ====================
init();
