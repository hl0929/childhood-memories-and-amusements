// ==================== 配置 ====================
const COLS = 9;
const ROWS = 5;
const CELL = 100;
const W = COLS * CELL;
const H = ROWS * CELL;
const TOTAL_WAVES = 8;
const START_SUN = 150;
const SUN_VALUE = 25;

const PLANTS = {
  sunflower:  { name: '向日葵',   emoji: '🌻', cost: 50,  hp: 120, cooldown: 7.5 },
  peashooter: { name: '豌豆射手', emoji: '🌱', cost: 100, hp: 120, cooldown: 1.25 },
  wallnut:    { name: '坚果墙',   emoji: '🌰', cost: 50,  hp: 520 },
  snowpea:    { name: '寒冰射手', emoji: '❄️', cost: 125, hp: 120, cooldown: 1.35 },
  cherry:     { name: '樱桃炸弹', emoji: '🍒', cost: 150, hp: 999, fuse: 0.9 },
};

const ZOMBIES = {
  basic:  { emoji: '🧟', hp: 100, speed: 14, dps: 28, score: 10, hat: null },
  cone:   { emoji: '🧟', hp: 220, speed: 13, dps: 30, score: 15, hat: 'cone' },
  bucket: { emoji: '🧟', hp: 380, speed: 12, dps: 34, score: 20, hat: 'bucket' },
  fast:   { emoji: '🧟', hp: 80,  speed: 26, dps: 24, score: 15, hat: 'fast' },
};

// 每一波的僵尸组合
const WAVES = [
  ['basic'],
  ['basic', 'basic'],
  ['basic', 'cone'],
  ['basic', 'cone', 'fast'],
  ['cone', 'cone', 'basic'],
  ['cone', 'bucket', 'fast'],
  ['bucket', 'cone', 'cone', 'basic'],
  ['bucket', 'bucket', 'cone', 'fast', 'basic'],
];

// ==================== DOM ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sunEl = document.getElementById('sun');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const highEl = document.getElementById('high-score');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const plantBar = document.getElementById('plant-bar');
const shovelBtn = document.getElementById('shovel-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');

// ==================== 高 DPI ====================
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// ==================== 状态 ====================
let sun;
let score;
let highScore;
let wave;
let waveTimer;
let sunTimer;
let spawnQueue;
let plants;
let zombies;
let peas;
let suns;
let particles;
let mowers;
let selectedPlant;
let shovelMode;
let running;
let paused;
let gameEnded;
let gameWon;
let lastTime;
let raf;
let hoverCell = null;

try {
  highScore = Number(localStorage.getItem('garden_high') || 0);
} catch (_) { highScore = 0; }

// ==================== 初始化 ====================
function resetState() {
  sun = START_SUN;
  score = 0;
  wave = 0;
  waveTimer = 15;
  sunTimer = 4.5;
  spawnQueue = [];
  plants = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  zombies = [];
  peas = [];
  suns = [];
  particles = [];
  mowers = Array.from({ length: ROWS }, (_, r) => ({ row: r, used: false }));
  selectedPlant = null;
  shovelMode = false;
  hoverCell = null;
  gameEnded = false;
  gameWon = false;
  updateHud();
  updateCards();
}

function startGame() {
  resetState();
  running = true;
  paused = false;
  hideOverlay();
  SFX.play('start');
  lastTime = null;
  updatePauseLabel();
}

function showOverlay(title, sub) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ==================== HUD / 卡片 ====================
function updateHud() {
  sunEl.textContent = sun;
  scoreEl.textContent = score;
  waveEl.textContent = `${wave}/${TOTAL_WAVES}`;
  highEl.textContent = highScore;
}

function updateCards() {
  if (selectedPlant && sun < PLANTS[selectedPlant].cost) selectedPlant = null;

  document.querySelectorAll('.plant-card[data-plant]').forEach(btn => {
    const key = btn.dataset.plant;
    const def = PLANTS[key];
    btn.classList.toggle('selected', selectedPlant === key);
    btn.classList.toggle('disabled', sun < def.cost);
  });
  shovelBtn.classList.toggle('active', shovelMode);
}

function saveHigh() {
  if (score > highScore) {
    highScore = score;
    highEl.textContent = highScore;
    try {
      localStorage.setItem('garden_high', String(highScore));
    } catch (_) { /* 忽略 */ }
  }
}

// ==================== 植物选择 ====================
function selectPlant(key) {
  if (!running || paused || gameEnded) return;
  const def = PLANTS[key];
  if (!def) return;
  if (sun < def.cost) {
    SFX.play('invalid');
    return;
  }
  selectedPlant = selectedPlant === key ? null : key;
  shovelMode = false;
  SFX.play('click');
  updateCards();
}

plantBar.querySelectorAll('.plant-card[data-plant]').forEach(btn => {
  btn.addEventListener('click', () => selectPlant(btn.dataset.plant));
});

shovelBtn.addEventListener('click', () => {
  if (!running || paused || gameEnded) return;
  shovelMode = !shovelMode;
  selectedPlant = null;
  SFX.play('click');
  updateCards();
});

// ==================== 画布交互 ====================
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function cellAt(x, y) {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return { r, c };
}

function collectSunAt(x, y) {
  for (let i = suns.length - 1; i >= 0; i--) {
    const s = suns[i];
    const dx = s.x - x;
    const dy = s.y - y;
    if (dx * dx + dy * dy <= 48 * 48) {
      sun += s.value;
      suns.splice(i, 1);
      SFX.play('gold');
      burst(s.x, s.y, '#ffd75e', 10);
      updateHud();
      updateCards();
      return true;
    }
  }
  return false;
}

function onCanvasPointerDown(e) {
  e.preventDefault();
  if (!running || paused || gameEnded) return;
  const { x, y } = canvasPos(e);

  if (collectSunAt(x, y)) return;

  const cell = cellAt(x, y);
  if (!cell) return;
  const { r, c } = cell;

  if (shovelMode) {
    if (plants[r][c]) {
      plants[r][c] = null;
      SFX.play('click');
      burst(c * CELL + CELL / 2, r * CELL + CELL / 2, '#b9a7e6', 8);
      updateCards();
    }
    shovelMode = false;
    updateCards();
    return;
  }

  if (!selectedPlant) return;
  const def = PLANTS[selectedPlant];
  if (plants[r][c]) {
    SFX.play('invalid');
    return;
  }
  if (sun < def.cost) {
    SFX.play('invalid');
    return;
  }

  sun -= def.cost;
  plants[r][c] = {
    type: selectedPlant,
    x: c * CELL + CELL / 2,
    y: r * CELL + CELL / 2,
    hp: def.hp,
    maxHp: def.hp,
    timer: def.cooldown || 0,
    fuse: def.fuse || 0,
  };
  SFX.play('place');
  burst(plants[r][c].x, plants[r][c].y, '#7bd88f', 8);
  updateHud();
  updateCards();
}

canvas.addEventListener('pointerdown', onCanvasPointerDown);
canvas.addEventListener('pointermove', e => {
  if (!running || paused || gameEnded) return;
  hoverCell = cellAt(canvasPos(e).x, canvasPos(e).y);
});
canvas.addEventListener('pointerleave', () => { hoverCell = null; });

// ==================== 阳光 ====================
function spawnSkySun() {
  suns.push({
    x: 80 + Math.random() * (W - 160),
    y: -30,
    vy: 36,
    stopY: H - 60 - Math.random() * 120,
    life: 12,
    value: SUN_VALUE,
  });
}

function spawnPlantSun(plant) {
  suns.push({
    x: plant.x + (Math.random() * 30 - 15),
    y: plant.y - 10,
    vy: 26,
    stopY: plant.y + 24,
    life: 11,
    value: SUN_VALUE,
  });
}

function updateSuns(dt) {
  for (let i = suns.length - 1; i >= 0; i--) {
    const s = suns[i];
    if (s.y < s.stopY) s.y = Math.min(s.stopY, s.y + s.vy * dt);
    s.life -= dt;
    if (s.life <= 0) suns.splice(i, 1);
  }
}

// ==================== 植物 ====================
function updatePlants(dt) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = plants[r][c];
      if (!p) continue;

      if (p.type === 'sunflower') {
        p.timer -= dt;
        if (p.timer <= 0) {
          spawnPlantSun(p);
          p.timer = 7.5;
        }
      } else if (p.type === 'peashooter' || p.type === 'snowpea') {
        p.timer -= dt;
        if (p.timer <= 0 && zombieInRow(r, p.x)) {
          peas.push({
            x: p.x + 30,
            y: p.y - 8,
            row: r,
            speed: 260,
            damage: p.type === 'snowpea' ? 18 : 22,
            slow: p.type === 'snowpea',
          });
          p.timer = p.type === 'snowpea' ? 1.35 : 1.2;
          SFX.play('shoot');
        }
      } else if (p.type === 'cherry') {
        p.fuse -= dt;
        if (p.fuse <= 0) {
          explodeCherry(r, c);
          plants[r][c] = null;
        }
      }
    }
  }
}

function zombieInRow(row, x) {
  return zombies.some(z => z.row === row && z.x > x - 20);
}

function explodeCherry(r, c) {
  SFX.play('explode');
  burst(c * CELL + CELL / 2, r * CELL + CELL / 2, '#ff8a6b', 26);
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    const zr = z.row;
    const zc = Math.floor(z.x / CELL);
    if (Math.abs(zr - r) <= 1 && Math.abs(zc - c) <= 1) {
      z.hp = 0;
      killZombie(i);
    }
  }
}

// ==================== 僵尸 ====================
function spawnZombie(type, lane) {
  const def = ZOMBIES[type];
  zombies.push({
    type,
    row: lane,
    x: W + 40 + Math.random() * 60,
    y: lane * CELL + CELL / 2,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    dps: def.dps,
    slow: 0,
  });
}

function updateZombies(dt) {
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (z.slow > 0) z.slow -= dt;

    const c = Math.floor(z.x / CELL);
    const plant = c >= 0 && c < COLS ? plants[z.row][c] : null;

    if (plant) {
      // 停在植物右侧啃食
      z.x = Math.max(z.x, c * CELL + CELL * 0.72);
      plant.hp -= z.dps * dt;
      if (Math.random() < dt * 3) SFX.play('hit', { throttle: 120 });
      if (plant.hp <= 0) {
        plants[z.row][c] = null;
        burst(c * CELL + CELL / 2, z.row * CELL + CELL / 2, '#7bd88f', 8);
      }
    } else {
      const factor = z.slow > 0 ? 0.5 : 1;
      z.x -= z.speed * factor * dt;
    }

    if (z.x < 42) {
      const mower = mowers[z.row];
      if (mower && !mower.used) {
        mower.used = true;
        SFX.play('explode');
        burst(30, z.row * CELL + CELL / 2, '#ff8a6b', 20);
        let killed = 0;
        for (let j = zombies.length - 1; j >= 0; j--) {
          if (zombies[j].row === z.row) {
            const def = ZOMBIES[zombies[j].type];
            burst(zombies[j].x, zombies[j].y, def.hat === 'bucket' ? '#c3a1ff' : '#8a7a9c', 8);
            score += def.score;
            sun += 5;
            killed++;
            zombies.splice(j, 1);
          }
        }
        if (killed) {
          saveHigh();
          updateHud();
          updateCards();
        }
        i = zombies.length;
        continue;
      }
      if (z.x < 0) {
        loseGame('僵尸闯进了房子');
        return;
      }
    }
  }
}

function killZombie(index) {
  const z = zombies[index];
  if (!z) return;
  const def = ZOMBIES[z.type];
  burst(z.x, z.y, def.hat === 'bucket' ? '#c3a1ff' : '#8a7a9c', 12);
  zombies.splice(index, 1);
  score += def.score;
  sun += 5;
  SFX.play('hit', { throttle: 80 });
  saveHigh();
  updateHud();
  updateCards();
}

// ==================== 豌豆 ====================
function updatePeas(dt) {
  for (let i = peas.length - 1; i >= 0; i--) {
    const pea = peas[i];
    pea.x += pea.speed * dt;

    if (pea.x > W + 20) {
      peas.splice(i, 1);
      continue;
    }

    let hit = false;
    for (let j = 0; j < zombies.length; j++) {
      const z = zombies[j];
      if (z.row !== pea.row) continue;
      if (pea.x > z.x - 26 && pea.x < z.x + 26) {
        z.hp -= pea.damage;
        if (pea.slow) z.slow = 3.2;
        burst(pea.x, pea.y, pea.slow ? '#8fd6ff' : '#7bd88f', 4);
        SFX.play('hit', { throttle: 60 });
        if (z.hp <= 0) killZombie(j);
        peas.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;
  }
}

// ==================== 波次 ====================
function startNextWave() {
  if (wave >= TOTAL_WAVES) return;
  const plan = WAVES[wave];
  wave++;
  waveTimer = 18;
  plan.forEach((type, i) => {
    spawnQueue.push({
      type,
      lane: Math.floor(Math.random() * ROWS),
      delay: i * 0.85,
    });
  });
  SFX.play('levelup');
  updateHud();
}

function updateWaves(dt) {
  if (wave < TOTAL_WAVES) {
    waveTimer -= dt;
    if (waveTimer <= 0) startNextWave();
  }

  for (let i = spawnQueue.length - 1; i >= 0; i--) {
    spawnQueue[i].delay -= dt;
    if (spawnQueue[i].delay <= 0) {
      spawnZombie(spawnQueue[i].type, spawnQueue[i].lane);
      spawnQueue.splice(i, 1);
    }
  }

  if (wave >= TOTAL_WAVES && spawnQueue.length === 0 && zombies.length === 0 && !gameEnded) {
    winGame();
  }
}

// ==================== 粒子 ====================
function burst(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.4,
      maxLife: 0.75,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ==================== 游戏流程 ====================
function update(dt) {
  if (!running || paused || gameEnded) return;

  sunTimer -= dt;
  if (sunTimer <= 0) {
    spawnSkySun();
    sunTimer = 5.5;
  }

  updateSuns(dt);
  updatePlants(dt);
  updatePeas(dt);
  updateZombies(dt);
  if (!running || gameEnded) return;
  updateWaves(dt);
  updateParticles(dt);
}

function loseGame(reason) {
  if (gameEnded) return;
  gameEnded = true;
  running = false;
  SFX.play('gameover');
  saveHigh();
  updateHud();
  showOverlay('💥 花园失守', `${reason} · 得分 ${score} · 按 R 重来`);
}

function winGame() {
  if (gameEnded) return;
  gameEnded = true;
  gameWon = true;
  running = false;
  SFX.play('win');
  saveHigh();
  updateHud();
  showOverlay('🏆 花园守住啦！', `得分 ${score} · 按 R 再来一局`);
}

function togglePause() {
  if (!running || gameEnded) return;
  paused = !paused;
  SFX.play('click');
  if (paused) {
    showOverlay('已暂停', '按 P 或点击继续');
  } else {
    hideOverlay();
    lastTime = null;
  }
  updatePauseLabel();
}

function updatePauseLabel() {
  pauseBtn.textContent = paused ? '▶ 继续' : '⏸ 暂停';
}

// ==================== 输入 ====================
document.addEventListener('keydown', e => {
  const k = e.key;
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();

  if (k === 'r' || k === 'R') { startGame(); return; }
  if (k === 'p' || k === 'P') { togglePause(); return; }

  if (!running) {
    if (k === ' ' || k === 'Enter') startGame();
    return;
  }
  if (paused || gameEnded) return;

  const idx = Number(k);
  if (idx >= 1 && idx <= 5) {
    selectPlant(Object.keys(PLANTS)[idx - 1]);
  }
  if (k === 'x' || k === 'X') {
    shovelMode = !shovelMode;
    selectedPlant = null;
    updateCards();
  }
});

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', startGame);

overlay.addEventListener('click', () => {
  if (!running) startGame();
  else if (paused) togglePause();
});

// ==================== 绘制 ====================
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawLawn();
  drawMowers();
  drawPlants();
  drawZombies();
  drawPeas();
  drawSuns();
  drawParticles();
  drawHover();
}

function drawLawn() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#e7f9d7' : '#d8f2c3';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // 草坪格子分隔
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(W, r * CELL);
    ctx.stroke();
  }

  // 左侧小栅栏
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (let r = 0; r < ROWS; r++) {
    const y = r * CELL;
    ctx.fillRect(2, y + 10, 5, CELL - 20);
    ctx.fillRect(14, y + 10, 5, CELL - 20);
    ctx.fillRect(0, y + 34, 22, 6);
    ctx.fillRect(0, y + 66, 22, 6);
  }
}

function drawMowers() {
  for (const m of mowers) {
    if (m.used) continue;
    const y = m.row * CELL + CELL / 2;
    ctx.save();
    ctx.translate(30, y);
    ctx.fillStyle = '#ff8a6b';
    roundRect(-14, -10, 28, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    roundRect(-10, -6, 8, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#2b1f3c';
    ctx.beginPath();
    ctx.arc(-8, 11, 4, 0, Math.PI * 2);
    ctx.arc(8, 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlants() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = plants[r][c];
      if (!p) continue;
      const def = PLANTS[p.type];

      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.beginPath();
      ctx.arc(p.x, p.y + 6, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      ctx.fillText(def.emoji, p.x, p.y + 2);

      if (p.hp < p.maxHp) {
        drawBar(p.x - 24, p.y - 38, 48, 6, p.hp / p.maxHp, '#7bd88f');
      }
    }
  }
}

function drawZombies() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const z of zombies) {
    if (z.slow > 0) {
      ctx.fillStyle = 'rgba(143,214,255,0.4)';
      ctx.beginPath();
      ctx.arc(z.x, z.y + 4, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.fillText(ZOMBIES[z.type].emoji, z.x, z.y + 2);

    if (ZOMBIES[z.type].hat === 'cone') {
      ctx.fillStyle = '#f0a23a';
      ctx.beginPath();
      ctx.moveTo(z.x, z.y - 50);
      ctx.lineTo(z.x - 16, z.y - 22);
      ctx.lineTo(z.x + 16, z.y - 22);
      ctx.closePath();
      ctx.fill();
    } else if (ZOMBIES[z.type].hat === 'bucket') {
      ctx.fillStyle = '#9aa7b8';
      roundRect(z.x - 20, z.y - 52, 40, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (ZOMBIES[z.type].hat === 'fast') {
      ctx.strokeStyle = '#e05a5a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(z.x - 18, z.y - 28);
      ctx.lineTo(z.x + 18, z.y - 28);
      ctx.stroke();
    }

    drawBar(z.x - 24, z.y - 64, 48, 6, Math.max(0, z.hp / z.maxHp), '#ff8a9b');
  }
}

function drawPeas() {
  for (const pea of peas) {
    ctx.fillStyle = pea.slow ? '#8fd6ff' : '#6fd88a';
    ctx.beginPath();
    ctx.arc(pea.x, pea.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawSuns() {
  for (const s of suns) {
    const pulse = 1 + Math.sin(Date.now() / 260 + s.x) * 0.08;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd75e';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f0a000';
    ctx.font = 'bold 18px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('25', 0, 1);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHover() {
  if (!hoverCell || !running || paused || gameEnded) return;
  const { r, c } = hoverCell;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
  ctx.strokeStyle = 'rgba(47,158,91,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);

  if (selectedPlant && !plants[r][c]) {
    ctx.globalAlpha = 0.5;
    ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PLANTS[selectedPlant].emoji, c * CELL + CELL / 2, r * CELL + CELL / 2);
    ctx.globalAlpha = 1;
  }
}

function drawBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(43,31,60,0.35)';
  roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(x, y, Math.max(2, w * Math.max(0, Math.min(1, ratio))), h, 3);
  ctx.fill();
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
resetState();
running = false;
paused = false;
showOverlay('花园保卫战', '选择植物 → 点击草坪种植 · 点击阳光收集');
updatePauseLabel();
raf = requestAnimationFrame(loop);

// 调试 / 测试钩子
window.GardenGame = {
  start: startGame,
  get state() {
    return {
      sun, score, wave, running, paused, gameEnded, gameWon,
      plants, zombies, peas, suns, mowers,
      selectedPlant, shovelMode,
    };
  },
};
