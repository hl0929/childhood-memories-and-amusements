// ==================== 配置 ====================
const TILE = 40;
const COLS = 13;
const ROWS = 13;
const W = COLS * TILE;
const H = ROWS * TILE;
const TANK_SIZE = 30;
const BULLET_SIZE = 7;
const PLAYER_SPEED = 108;
const ENEMY_SPEED = 58;
const BULLET_SPEED = 280;
const MAX_LEVEL = 5;
const BASE_R = 12;
const BASE_C = 6;
const PLAYER_SPAWN = { r: 11, c: 6 };
const ENEMY_SPAWNS = [[0, 0], [0, 6], [0, 12]];

// B = 砖墙（可破坏），S = 钢墙，X = 基地
const MAP_TEMPLATE = [
  '.............',
  '..BB.....BB..',
  '..BB.....BB..',
  '.....SSS.....',
  '.BB.......BB.',
  '.BB..BBB..BB.',
  '....B...B....',
  '.BB..BBB..BB.',
  '.BB.......BB.',
  '.....SSS.....',
  '..BB.....BB..',
  '.............',
  '.....BXB.....',
];

const DIRS = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const KEY_DIR = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

// ==================== DOM ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high-score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const badgeEl = document.getElementById('wave-badge');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const fireBtn = document.getElementById('fire-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');

// ==================== 高 DPI ====================
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// ==================== 状态 ====================
let map;
let player;
let enemies;
let bullets;
let particles;
let inputDir = null;
let firing = false;
let running = false;
let paused = false;
let gameEnded = false;
let level = 1;
let score = 0;
let highScore = 0;
let lives = 3;
let enemiesLeft = 0;
let enemiesToSpawn = 0;
let spawnTimer = 0;
let maxActive = 3;
let levelTransition = 0;
let lastTime = null;
let raf = null;

try {
  highScore = Number(localStorage.getItem('tank_high') || 0);
} catch (_) { highScore = 0; }

// ==================== 地图 ====================
function loadMap() {
  map = MAP_TEMPLATE.map(row =>
    row.split('').map(ch => (ch === 'B' ? 1 : ch === 'S' ? 2 : ch === 'X' ? 3 : 0))
  );
}

function isSolidTile(v) {
  return v === 1 || v === 2 || v === 3;
}

function tileAt(px, py) {
  const c = Math.floor(px / TILE);
  const r = Math.floor(py / TILE);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return 2;
  return map[r][c];
}

function hitsSolid(x, y, size) {
  const pad = 2;
  const points = [
    [x + pad, y + pad],
    [x + size - pad, y + pad],
    [x + pad, y + size - pad],
    [x + size - pad, y + size - pad],
    [x + size / 2, y + size / 2],
  ];
  return points.some(([px, py]) => isSolidTile(tileAt(px, py)));
}

function overlap(ax, ay, as, bx, by, bs) {
  return ax < bx + bs && ax + as > bx && ay < by + bs && ay + as > by;
}

function getAllTanks() {
  return player ? [player, ...enemies] : [...enemies];
}

function tryMove(tank, dx, dy) {
  const nx = tank.x + dx;
  const ny = tank.y + dy;
  if (hitsSolid(nx, ny, tank.size)) return false;
  for (const other of getAllTanks()) {
    if (other === tank || !other.alive) continue;
    if (overlap(nx, ny, tank.size, other.x, other.y, other.size)) return false;
  }
  tank.x = nx;
  tank.y = ny;
  return true;
}

// ==================== 实体 ====================
function makePlayer() {
  const x = PLAYER_SPAWN.c * TILE + (TILE - TANK_SIZE) / 2;
  const y = PLAYER_SPAWN.r * TILE + (TILE - TANK_SIZE) / 2;
  return {
    x, y, size: TANK_SIZE, dir: 'up', isPlayer: true,
    speed: PLAYER_SPEED, cooldown: 0, invincible: 1.6, alive: true,
  };
}

function makeEnemy(r, c) {
  const colors = ['#ff8a9b', '#c3a1ff', '#ffb17a', '#8fd6ff'];
  return {
    x: c * TILE + (TILE - TANK_SIZE) / 2,
    y: r * TILE + (TILE - TANK_SIZE) / 2,
    size: TANK_SIZE,
    dir: 'down',
    isPlayer: false,
    speed: ENEMY_SPEED + level * 4,
    think: 0.4 + Math.random() * 0.6,
    fireTimer: 1.2 + Math.random() * 1.4,
    color: colors[(level + r + c) % colors.length],
    alive: true,
  };
}

// ==================== 初始化 ====================
function initLevel() {
  loadMap();
  bullets = [];
  enemies = [];
  particles = [];
  enemiesToSpawn = 5 + level * 2;
  enemiesLeft = enemiesToSpawn;
  maxActive = Math.min(5, 2 + level);
  spawnTimer = 0.8;
  player = makePlayer();
  inputDir = null;
  firing = false;
  updateHud();
}

function resetPreview() {
  level = 1;
  score = 0;
  lives = 3;
  gameEnded = false;
  paused = false;
  running = false;
  levelTransition = 0;
  loadMap();
  player = makePlayer();
  enemies = [];
  bullets = [];
  particles = [];
  enemiesToSpawn = 0;
  enemiesLeft = 7;
  updateHud();
  showOverlay('坦克大战', '方向键 / WASD 移动 · 空格开火');
}

function startGame() {
  level = 1;
  score = 0;
  lives = 3;
  gameEnded = false;
  paused = false;
  running = true;
  levelTransition = 0;
  initLevel();
  hideOverlay();
  SFX.play('start');
  lastTime = null;
  updateHud();
}

// ==================== HUD ====================
function updateHud() {
  scoreEl.textContent = score;
  highEl.textContent = highScore;
  levelEl.textContent = level;
  livesEl.textContent = lives;
  badgeEl.textContent = `第 ${level} 关 · 剩余 ${Math.max(0, enemiesLeft)}`;
}

function saveHigh() {
  if (score > highScore) {
    highScore = score;
    highEl.textContent = highScore;
    try {
      localStorage.setItem('tank_high', String(highScore));
    } catch (_) { /* 忽略 */ }
  }
}

// ==================== 输入 ====================
document.addEventListener('keydown', e => {
  const k = e.key;
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();

  if (k === 'p' || k === 'P') {
    togglePause();
    return;
  }
  if (k === 'r' || k === 'R') {
    startGame();
    return;
  }

  const dir = KEY_DIR[k];

  if (!running) {
    if (k === ' ' || k === 'Enter' || dir) {
      startGame();
      if (dir && player) {
        player.dir = dir;
        inputDir = dir;
      }
    }
    return;
  }

  if (paused || gameEnded) return;

  if (dir && player) {
    player.dir = dir;
    inputDir = dir;
  }
  if (k === ' ') firing = true;
});

document.addEventListener('keyup', e => {
  const dir = KEY_DIR[e.key];
  if (dir && inputDir === dir) inputDir = null;
  if (e.key === ' ') firing = false;
});

function bindMobileDirection(btn) {
  const dir = btn.dataset.dir;
  const press = e => {
    e.preventDefault();
    if (!running) startGame();
    if (player) player.dir = dir;
    inputDir = dir;
    btn.classList.add('active');
  };
  const release = () => {
    if (inputDir === dir) inputDir = null;
    btn.classList.remove('active');
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
}

document.querySelectorAll('.ctrl-btn').forEach(bindMobileDirection);

function startFiring(e) {
  if (e) e.preventDefault();
  if (!running) startGame();
  firing = true;
}
function stopFiring() { firing = false; }

if (fireBtn) {
  fireBtn.addEventListener('pointerdown', startFiring);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
    fireBtn.addEventListener(ev, stopFiring)
  );
}
if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    if (!running) startGame();
    else togglePause();
  });
}
if (restartBtn) restartBtn.addEventListener('click', startGame);

overlay.addEventListener('click', () => {
  if (!running) startGame();
  else if (paused) togglePause();
});

// ==================== 暂停 / 覆盖层 ====================
function togglePause() {
  if (!running || gameEnded || levelTransition > 0) return;
  paused = !paused;
  SFX.play('click');
  if (paused) {
    showOverlay('已暂停', '按 P 或点击继续');
  } else {
    hideOverlay();
    lastTime = null;
  }
}

function showOverlay(title, sub) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ==================== 射击 ====================
function shoot(tank) {
  if (!tank || tank.cooldown > 0 || paused || gameEnded) return;
  if (tank.isPlayer) tank.cooldown = 0.38;

  const d = DIRS[tank.dir];
  const cx = tank.x + tank.size / 2;
  const cy = tank.y + tank.size / 2;
  const bx = cx + d.x * (tank.size / 2 + BULLET_SIZE) - BULLET_SIZE / 2;
  const by = cy + d.y * (tank.size / 2 + BULLET_SIZE) - BULLET_SIZE / 2;

  bullets.push({
    x: bx,
    y: by,
    vx: d.x * BULLET_SPEED,
    vy: d.y * BULLET_SPEED,
    owner: tank.isPlayer ? 'player' : 'enemy',
    size: BULLET_SIZE,
  });
  SFX.play('shoot');
}

// ==================== 更新 ====================
function update(dt) {
  if (levelTransition > 0) {
    levelTransition -= dt;
    updateParticles(dt);
    if (levelTransition <= 0) advanceLevel();
    return;
  }
  if (!running || paused || gameEnded) return;

  if (player) {
    if (player.invincible > 0) player.invincible -= dt;
    player.cooldown = Math.max(0, player.cooldown - dt);

    if (inputDir) {
      player.dir = inputDir;
      const d = DIRS[inputDir];
      tryMove(player, d.x * PLAYER_SPEED * dt, d.y * PLAYER_SPEED * dt);
    }
    if (firing) shoot(player);
  }

  updateEnemies(dt);
  updateBullets(dt);
  if (gameEnded) return;
  updateParticles(dt);
  updateSpawning(dt);
  checkLevelClear();
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.think -= dt;
    e.fireTimer -= dt;

    if (e.think <= 0) {
      const pool = ['down', 'down', 'down', 'left', 'right', 'up'];
      e.dir = pool[Math.floor(Math.random() * pool.length)];
      e.think = 0.65 + Math.random() * 1.1;
    }

    const d = DIRS[e.dir];
    if (!tryMove(e, d.x * e.speed * dt, d.y * e.speed * dt)) {
      e.think = 0;
    }

    if (e.fireTimer <= 0) {
      shoot(e);
      e.fireTimer = 1.1 + Math.random() * 1.6;
    }
  }
}

function updateSpawning(dt) {
  if (enemiesToSpawn <= 0) return;
  if (enemies.length >= maxActive) return;

  spawnTimer -= dt;
  if (spawnTimer > 0) return;

  const free = ENEMY_SPAWNS.filter(([r, c]) => {
    const x = c * TILE + (TILE - TANK_SIZE) / 2;
    const y = r * TILE + (TILE - TANK_SIZE) / 2;
    return !getAllTanks().some(t => overlap(x, y, TANK_SIZE, t.x, t.y, t.size));
  });

  if (!free.length) {
    spawnTimer = 0.4;
    return;
  }

  const [r, c] = free[Math.floor(Math.random() * free.length)];
  enemies.push(makeEnemy(r, c));
  enemiesToSpawn--;
  spawnTimer = 1.4 + Math.random() * 0.8;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      bullets.splice(i, 1);
      continue;
    }

    const cx = b.x + b.size / 2;
    const cy = b.y + b.size / 2;
    const c = Math.floor(cx / TILE);
    const r = Math.floor(cy / TILE);

    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      const tile = map[r][c];
      if (tile === 1) {
        map[r][c] = 0;
        boom(cx, cy, '#ff9a72', 6);
        SFX.play('hit');
        bullets.splice(i, 1);
        continue;
      }
      if (tile === 2) {
        boom(cx, cy, '#d7cbf5', 4);
        SFX.play('bounce');
        bullets.splice(i, 1);
        continue;
      }
      if (tile === 3) {
        map[r][c] = 0;
        boom(cx, cy, '#7bd88f', 18);
        SFX.play('explode');
        bullets.splice(i, 1);
        gameOver('基地被摧毁');
        return;
      }
    }

    if (b.owner === 'player') {
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (overlap(b.x, b.y, b.size, e.x, e.y, e.size)) {
          bullets.splice(i, 1);
          killEnemy(j);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    } else if (player && player.alive) {
      if (overlap(b.x, b.y, b.size, player.x, player.y, player.size)) {
        bullets.splice(i, 1);
        hitPlayer();
        continue;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 140 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function killEnemy(index) {
  const e = enemies[index];
  if (!e) return;
  boom(e.x + e.size / 2, e.y + e.size / 2, e.color, 14);
  enemies.splice(index, 1);
  score += 100;
  enemiesLeft = Math.max(0, enemiesLeft - 1);
  SFX.play('explode');
  saveHigh();
  updateHud();
}

function hitPlayer() {
  if (!player || player.invincible > 0 || gameEnded) return;
  lives--;
  SFX.play('damage');
  boom(player.x + player.size / 2, player.y + player.size / 2, '#6ee7b7', 16);
  updateHud();

  if (lives <= 0) {
    gameOver('坦克被击毁');
    return;
  }

  player.x = PLAYER_SPAWN.c * TILE + (TILE - TANK_SIZE) / 2;
  player.y = PLAYER_SPAWN.r * TILE + (TILE - TANK_SIZE) / 2;
  player.dir = 'up';
  player.invincible = 2;
  player.cooldown = 0.5;
}

function checkLevelClear() {
  if (levelTransition > 0 || gameEnded) return;
  if (enemiesLeft > 0 || enemies.length > 0) return;

  if (level >= MAX_LEVEL) {
    winGame();
    return;
  }

  levelTransition = 1.8;
  SFX.play('levelup');
  showOverlay(`第 ${level} 关完成`, `准备进入第 ${level + 1} 关…`);
}

function advanceLevel() {
  level++;
  initLevel();
  hideOverlay();
  SFX.play('start');
  lastTime = null;
}

function gameOver(reason) {
  if (gameEnded) return;
  gameEnded = true;
  running = false;
  SFX.play('gameover');
  saveHigh();
  updateHud();
  showOverlay('💥 游戏结束', `${reason} · 得分 ${score} · 按 R 重来`);
}

function winGame() {
  gameEnded = true;
  running = false;
  SFX.play('win');
  saveHigh();
  updateHud();
  showOverlay('🏆 全部通关！', `得分 ${score} · 按 R 再来一局`);
}

// ==================== 粒子 ====================
function boom(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 130;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

// ==================== 绘制 ====================
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#241b33';
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, H);
    ctx.stroke();
  }
  for (let i = 1; i < ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(W, i * TILE);
    ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = map[r][c];
      if (!tile) continue;
      const x = c * TILE;
      const y = r * TILE;
      if (tile === 1) drawBrick(x, y);
      else if (tile === 2) drawSteel(x, y);
      else if (tile === 3) drawBase(x, y);
    }
  }

  if (player && player.alive) drawTank(player);
  enemies.forEach(drawTank);

  for (const b of bullets) {
    ctx.fillStyle = '#ffe37a';
    ctx.shadowColor = '#ffd54a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x + b.size / 2, b.y + b.size / 2, b.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBrick(x, y) {
  ctx.fillStyle = '#ff9a72';
  roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,50,40,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + TILE / 3);
  ctx.lineTo(x + TILE - 3, y + TILE / 3);
  ctx.moveTo(x + 3, y + TILE * 2 / 3);
  ctx.lineTo(x + TILE - 3, y + TILE * 2 / 3);
  ctx.moveTo(x + TILE / 2, y + 3);
  ctx.lineTo(x + TILE / 2, y + TILE / 3);
  ctx.moveTo(x + TILE / 4, y + TILE / 3);
  ctx.lineTo(x + TILE / 4, y + TILE * 2 / 3);
  ctx.moveTo(x + TILE * 3 / 4, y + TILE / 3);
  ctx.lineTo(x + TILE * 3 / 4, y + TILE * 2 / 3);
  ctx.stroke();
}

function drawSteel(x, y) {
  ctx.fillStyle = '#b9a7e6';
  roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
  ctx.fill();
  ctx.fillStyle = '#d8cdf5';
  roundRect(x + 7, y + 7, TILE - 14, TILE - 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(90,65,130,0.35)';
  [[10, 10], [TILE - 10, 10], [10, TILE - 10], [TILE - 10, TILE - 10]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBase(x, y) {
  ctx.fillStyle = '#7bd88f';
  roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 9);
  ctx.fill();
  ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏰', x + TILE / 2, y + TILE / 2 + 1);
}

function drawTank(t) {
  const s = t.size;
  const cx = t.x + s / 2;
  const cy = t.y + s / 2;
  const angle = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }[t.dir];

  if (t.invincible > 0 && Math.floor(t.invincible * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s / 2 - 2, s / 2 - 1, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // 履带
  ctx.fillStyle = '#2b1f3c';
  roundRect(-s / 2 + 1, -s / 2 + 2, s - 2, 7, 3);
  ctx.fill();
  roundRect(-s / 2 + 1, s / 2 - 9, s - 2, 7, 3);
  ctx.fill();

  // 车身
  ctx.fillStyle = t.isPlayer ? '#6ee7b7' : t.color;
  roundRect(-s / 2 + 2, -s / 2 + 8, s - 4, s - 16, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 炮塔
  ctx.fillStyle = t.isPlayer ? '#38c98d' : '#e06c86';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 炮管
  ctx.strokeStyle = t.isPlayer ? '#1f9f6e' : '#b94762';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s / 2 + 5, 0);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ==================== 主循环 ====================
function loop(ts) {
  if (lastTime === null) lastTime = ts;
  const dt = Math.min(0.05, (ts - lastTime) / 1000);
  lastTime = ts;

  if (running && !paused) update(dt);
  draw();
  raf = requestAnimationFrame(loop);
}

// ==================== 启动 ====================
resetPreview();
raf = requestAnimationFrame(loop);

// 调试 / 测试钩子
window.TankGame = {
  start: startGame,
  get state() {
    return { level, score, lives, enemiesLeft, running, paused, gameEnded, player, enemies, bullets, map };
  },
};
