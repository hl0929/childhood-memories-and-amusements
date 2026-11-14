// ==================== 配置 ====================
const COLS = 10;
const ROWS = 8;
const CELL = 60;
const W = COLS * CELL;
const H = ROWS * CELL;
const MAX_LEVEL = 10;
const MAX_LIVES = 20;
const START_COINS = 120;
const TOTAL_MAPS = 10;

// ==================== 武器 ====================
const TOWERS = {
  arrow: {
    name: '箭塔', icon: '🏹', color: '#4f9e6b', cost: 40, kind: 'projectile',
    levels: [
      { damage: 14, range: 125, rate: 0.6, upgradeCost: 35 },
      { damage: 24, range: 140, rate: 0.5, upgradeCost: 60 },
      { damage: 38, range: 155, rate: 0.42 },
    ],
  },
  cannon: {
    name: '炮塔', icon: '💣', color: '#d97a3a', cost: 70, kind: 'splash',
    levels: [
      { damage: 30, range: 120, rate: 0.65, splash: 45, upgradeCost: 55 },
      { damage: 48, range: 135, rate: 0.72, splash: 55, upgradeCost: 90 },
      { damage: 72, range: 150, rate: 0.8, splash: 65 },
    ],
  },
  frost: {
    name: '冰塔', icon: '❄️', color: '#4f9ed9', cost: 60, kind: 'projectile',
    levels: [
      { damage: 8, range: 115, rate: 0.9, slow: 0.35, slowTime: 2, upgradeCost: 45 },
      { damage: 14, range: 130, rate: 0.95, slow: 0.45, slowTime: 2.2, upgradeCost: 75 },
      { damage: 22, range: 145, rate: 1.0, slow: 0.55, slowTime: 2.5 },
    ],
  },
  tesla: {
    name: '电塔', icon: '⚡', color: '#b06bd9', cost: 90, kind: 'chain',
    levels: [
      { damage: 20, range: 120, rate: 0.9, chains: 2, upgradeCost: 70 },
      { damage: 32, range: 135, rate: 1.0, chains: 3, upgradeCost: 110 },
      { damage: 48, range: 150, rate: 1.1, chains: 4 },
    ],
  },
  poison: {
    name: '毒塔', icon: '🧪', color: '#7a9e3a', cost: 80, kind: 'projectile',
    levels: [
      { damage: 6, range: 115, rate: 0.8, poison: 12, poisonTime: 3, upgradeCost: 60 },
      { damage: 10, range: 130, rate: 0.9, poison: 20, poisonTime: 3.5, upgradeCost: 95 },
      { damage: 16, range: 145, rate: 1.0, poison: 32, poisonTime: 4 },
    ],
  },
};

// ==================== 怪兽 ====================
const MONSTERS = {
  slime:    { name: '史莱姆', icon: '🦠', hp: 45,  speed: 42, armor: 0, reward: 8,   leak: 1,  slowResist: 0,   size: 30 },
  bat:      { name: '蝙蝠',   icon: '🦇', hp: 32,  speed: 78, armor: 0, reward: 7,   leak: 1,  slowResist: 0,   size: 28 },
  skeleton: { name: '骷髅',   icon: '💀', hp: 95,  speed: 38, armor: 1, reward: 12,  leak: 2,  slowResist: 0,   size: 32 },
  ghost:    { name: '幽灵',   icon: '👻', hp: 85,  speed: 52, armor: 0, reward: 14,  leak: 2,  slowResist: 0.5, size: 32 },
  ogre:     { name: '巨魔',   icon: '👹', hp: 260, speed: 24, armor: 3, reward: 30,  leak: 4,  slowResist: 0.2, size: 40 },
  dragon:   { name: '恶龙',   icon: '🐉', hp: 900, speed: 20, armor: 5, reward: 120, leak: 10, slowResist: 0.4, size: 46 },
};

// ==================== 10 张关卡路线（[行, 列] 拐点） ====================
const LEVEL_PATHS = [
  [[1, 0], [1, 9]],
  [[1, 0], [1, 6], [4, 6], [4, 9]],
  [[6, 0], [6, 5], [2, 5], [2, 9]],
  [[4, 0], [4, 3], [1, 3], [1, 7], [6, 7], [6, 9]],
  [[1, 0], [1, 2], [6, 2], [6, 6], [1, 6], [1, 9]],
  [[7, 0], [7, 8], [4, 8], [4, 2], [2, 2], [2, 9]],
  [[3, 0], [3, 4], [0, 4], [0, 8], [4, 8], [4, 9]],
  [[6, 0], [6, 2], [3, 2], [3, 5], [7, 5], [7, 9]],
  [[0, 0], [0, 9], [4, 9], [4, 3], [7, 3], [7, 9]],
  [[1, 0], [1, 7], [3, 7], [3, 3], [6, 3], [6, 9]],
];

// 每关的波次：每波由 [怪兽类型, 数量] 组成
const LEVEL_WAVES = [
  [[['slime', 5]], [['slime', 8]]],
  [[['slime', 6], ['bat', 3]], [['bat', 6], ['slime', 6]]],
  [[['slime', 5], ['skeleton', 3]], [['skeleton', 5], ['bat', 5]]],
  [[['bat', 6], ['skeleton', 4]], [['ghost', 4], ['skeleton', 5]]],
  [[['skeleton', 6], ['ghost', 4]], [['ghost', 6], ['bat', 6]]],
  [[['ogre', 2], ['skeleton', 6]], [['ogre', 3], ['ghost', 5]]],
  [[['ghost', 6], ['ogre', 3]], [['ogre', 4], ['skeleton', 8]]],
  [[['ogre', 4], ['ghost', 6]], [['ghost', 8], ['ogre', 5]]],
  [[['ogre', 5], ['skeleton', 8]], [['ogre', 6], ['ghost', 8]], [['dragon', 1], ['ogre', 3]]],
  [[['dragon', 1], ['ogre', 4]], [['dragon', 1], ['ogre', 5], ['ghost', 6]], [['dragon', 2], ['ogre', 6], ['ghost', 8]]],
];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ==================== DOM ====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const coinsEl = document.getElementById('coins');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const waveEl = document.getElementById('wave');
const killBadgeEl = document.getElementById('kill-badge');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const towerBar = document.getElementById('tower-bar');
const towerPanel = document.getElementById('tower-panel');
const towerNameEl = document.getElementById('tower-name');
const upgradeBtn = document.getElementById('upgrade-btn');
const sellBtn = document.getElementById('sell-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');

// ==================== 高 DPI ====================
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// ==================== 状态 ====================
let path = [];
let slots = [];
let totalPathLength = 0;
let towers = [];
let monsters = [];
let projectiles = [];
let particles = [];
let effects = [];
let spawnQueue = [];

let level = 1;
let coins = START_COINS;
let lives = MAX_LIVES;
let kills = 0;
let waveIndex = 0;
let waveTimer = 6;
let levelTransition = 0;
let levelStartCoins = START_COINS;
let levelStartLives = MAX_LIVES;
let levelStartKills = 0;
let selectedBuild = null;
let selectedTower = null;
let hoverSlot = null;
let running = false;
let paused = false;
let gameEnded = false;
let gameWon = false;
let lastTime = null;
let raf = null;

// ==================== 地图构建 ====================
function makePath(points) {
  const cells = [{ r: points[0][0], c: points[0][1] }];
  for (let i = 1; i < points.length; i++) {
    const targetR = points[i][0];
    const targetC = points[i][1];
    let { r, c } = cells[cells.length - 1];
    while (r !== targetR || c !== targetC) {
      if (r !== targetR) r += Math.sign(targetR - r);
      else c += Math.sign(targetC - c);
      cells.push({ r, c });
    }
  }
  return cells;
}

function makeSlots(cells) {
  const pathSet = new Set(cells.map(p => `${p.r},${p.c}`));
  const start = cells[0];
  const end = cells[cells.length - 1];
  const candidates = new Map();

  cells.forEach((cell, idx) => {
    for (const [dr, dc] of DIRS) {
      const r = cell.r + dr;
      const c = cell.c + dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (pathSet.has(`${r},${c}`)) continue;
      if (r === start.r && c === start.c) continue;
      if (r === end.r && c === end.c) continue;
      const key = `${r},${c}`;
      if (!candidates.has(key)) candidates.set(key, { r, c, idx });
    }
  });

  const arr = [...candidates.values()].sort((a, b) => a.idx - b.idx);
  const maxSlots = 14;
  if (arr.length <= maxSlots) return arr;

  const picked = [];
  for (let i = 0; i < maxSlots; i++) {
    const index = Math.round(i * (arr.length - 1) / (maxSlots - 1));
    const slot = arr[index];
    if (!picked.some(p => p.r === slot.r && p.c === slot.c)) picked.push(slot);
  }
  return picked;
}

function buildLevelMap() {
  path = makePath(LEVEL_PATHS[level - 1]);
  slots = makeSlots(path);
  totalPathLength = (path.length - 1) * CELL;
}

function pathPos(dist) {
  const d = Math.max(0, Math.min(totalPathLength, dist));
  const i = Math.min(path.length - 2, Math.floor(d / CELL));
  const f = (d - i * CELL) / CELL;
  const a = path[i];
  const b = path[i + 1];
  return {
    x: (a.c + (b.c - a.c) * f) * CELL + CELL / 2,
    y: (a.r + (b.r - a.r) * f) * CELL + CELL / 2,
  };
}

// ==================== 初始化 / 关卡 ====================
function initLevelState() {
  buildLevelMap();
  towers = [];
  monsters = [];
  projectiles = [];
  particles = [];
  effects = [];
  spawnQueue = [];
  waveIndex = 0;
  waveTimer = 6;
  levelTransition = 0;
  selectedBuild = null;
  selectedTower = null;
  hoverSlot = null;
  hideTowerPanel();
  updateHud();
  updateTowerBar();
}

function beginLevel() {
  levelStartCoins = coins;
  levelStartLives = lives;
  levelStartKills = kills;
  initLevelState();
  running = true;
  paused = false;
  gameEnded = false;
  gameWon = false;
  hideOverlay();
  updatePauseLabel();
  SFX.play('start');
  lastTime = null;
}

function startCampaign() {
  level = 1;
  coins = START_COINS;
  lives = MAX_LIVES;
  kills = 0;
  levelStartCoins = coins;
  levelStartLives = lives;
  levelStartKills = kills;
  beginLevel();
}

function retryLevel() {
  coins = levelStartCoins;
  lives = levelStartLives;
  kills = levelStartKills;
  beginLevel();
}

function nextLevel() {
  level++;
  beginLevel();
}

function clearLevel() {
  if (levelTransition > 0 || gameEnded) return;

  if (level >= MAX_LEVEL) {
    winCampaign();
    return;
  }

  const bonus = 30 + level * 10;
  coins += bonus;
  lives = Math.min(MAX_LIVES, lives + 5);
  selectedBuild = null;
  selectedTower = null;
  hideTowerPanel();
  updateHud();
  updateTowerBar();
  levelTransition = 2.2;
  SFX.play('levelup');
  showOverlay(`第 ${level} 关完成`, `+${bonus} 金币 · 生命 +5 · 准备下一关…`);
}

function winCampaign() {
  gameEnded = true;
  gameWon = true;
  running = false;
  selectedBuild = null;
  selectedTower = null;
  hideTowerPanel();
  SFX.play('win');
  showOverlay('🏆 十关全通！', `怪兽被全部击退 · 击杀 ${kills} · 点击或按空格再来一局`);
  updateHud();
}

function gameOver() {
  if (gameEnded) return;
  gameEnded = true;
  gameWon = false;
  running = false;
  selectedBuild = null;
  selectedTower = null;
  hideTowerPanel();
  SFX.play('gameover');
  showOverlay('💥 防线失守', `第 ${level} 关失败 · 点击或按空格重试本关`);
  updateHud();
}

// ==================== HUD ====================
function updateHud() {
  coinsEl.textContent = coins;
  livesEl.textContent = Math.max(0, lives);
  levelEl.textContent = `${level}/${MAX_LEVEL}`;
  waveEl.textContent = `${waveIndex}/${LEVEL_WAVES[level - 1].length}`;
  killBadgeEl.textContent = `击杀 ${kills}`;
}

function updateTowerBar() {
  if (selectedBuild && coins < TOWERS[selectedBuild].cost) selectedBuild = null;

  towerBar.querySelectorAll('.tower-card').forEach(btn => {
    const key = btn.dataset.tower;
    const def = TOWERS[key];
    btn.classList.toggle('selected', selectedBuild === key);
    btn.classList.toggle('disabled', coins < def.cost);
  });
}

function refundOf(tower) {
  return Math.round(tower.invested * 0.6);
}

function updateTowerPanel() {
  if (!selectedTower) {
    towerPanel.classList.add('hidden');
    return;
  }

  const def = TOWERS[selectedTower.type];
  const stats = def.levels[selectedTower.level - 1];
  const maxed = selectedTower.level >= 3;

  towerNameEl.textContent = `${def.name} Lv.${selectedTower.level}`;
  if (maxed) {
    upgradeBtn.textContent = '已满级';
    upgradeBtn.disabled = true;
  } else {
    upgradeBtn.textContent = `升级 🪙${stats.upgradeCost}`;
    upgradeBtn.disabled = coins < stats.upgradeCost;
  }
  sellBtn.textContent = `出售 +🪙${refundOf(selectedTower)}`;
  towerPanel.classList.remove('hidden');
}

function hideTowerPanel() {
  selectedTower = null;
  towerPanel.classList.add('hidden');
}

// ==================== 建造 / 升级 / 出售 ====================
function selectTowerType(type) {
  if (!running || paused || gameEnded || levelTransition > 0) return;
  const def = TOWERS[type];
  if (!def) return;
  if (coins < def.cost) {
    SFX.play('invalid');
    return;
  }
  selectedBuild = selectedBuild === type ? null : type;
  selectedTower = null;
  hideTowerPanel();
  SFX.play('click');
  updateTowerBar();
}

towerBar.querySelectorAll('.tower-card').forEach(btn => {
  btn.addEventListener('click', () => selectTowerType(btn.dataset.tower));
});

function towerAtSlot(slot) {
  return towers.find(t => t.r === slot.r && t.c === slot.c) || null;
}

function buildTower(slot) {
  if (!selectedBuild) return;
  const def = TOWERS[selectedBuild];
  if (coins < def.cost) {
    SFX.play('invalid');
    return;
  }
  if (towerAtSlot(slot)) return;

  const tower = {
    type: selectedBuild,
    level: 1,
    r: slot.r,
    c: slot.c,
    x: slot.c * CELL + CELL / 2,
    y: slot.r * CELL + CELL / 2,
    cooldown: 0,
    invested: def.cost,
  };

  towers.push(tower);
  coins -= def.cost;
  selectedBuild = null;
  selectedTower = tower;
  burst(tower.x, tower.y, def.color, 12);
  SFX.play('place');
  updateHud();
  updateTowerBar();
  updateTowerPanel();
}

function upgradeSelectedTower() {
  if (!running || paused || gameEnded || levelTransition > 0) return;
  if (!selectedTower || selectedTower.level >= 3) return;
  const def = TOWERS[selectedTower.type];
  const stats = def.levels[selectedTower.level - 1];
  const cost = stats.upgradeCost;
  if (coins < cost) {
    SFX.play('invalid');
    return;
  }
  coins -= cost;
  selectedTower.level++;
  selectedTower.invested += cost;
  SFX.play('levelup');
  burst(selectedTower.x, selectedTower.y, def.color, 10);
  updateHud();
  updateTowerBar();
  updateTowerPanel();
}

function sellSelectedTower() {
  if (!running || paused || gameEnded || levelTransition > 0) return;
  if (!selectedTower) return;
  const refund = refundOf(selectedTower);
  const index = towers.indexOf(selectedTower);
  if (index >= 0) towers.splice(index, 1);
  coins += refund;
  burst(selectedTower.x, selectedTower.y, '#b9a7e6', 10);
  SFX.play('click');
  selectedTower = null;
  hideTowerPanel();
  updateHud();
  updateTowerBar();
}

upgradeBtn.addEventListener('click', upgradeSelectedTower);
sellBtn.addEventListener('click', sellSelectedTower);

// ==================== 画布交互 ====================
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function findSlotAt(x, y) {
  return slots.find(s => {
    const cx = s.c * CELL + CELL / 2;
    const cy = s.r * CELL + CELL / 2;
    return (cx - x) * (cx - x) + (cy - y) * (cy - y) <= 28 * 28;
  }) || null;
}

function onCanvasPointerDown(e) {
  e.preventDefault();
  if (!running || paused || gameEnded || levelTransition > 0) return;

  const { x, y } = canvasPos(e);
  const slot = findSlotAt(x, y);
  if (!slot) {
    selectedBuild = null;
    selectedTower = null;
    hideTowerPanel();
    updateTowerBar();
    return;
  }

  const tower = towerAtSlot(slot);
  if (tower) {
    selectedBuild = null;
    selectedTower = tower;
    SFX.play('click');
    updateTowerBar();
    updateTowerPanel();
    return;
  }

  if (selectedBuild) {
    buildTower(slot);
  } else {
    selectedBuild = null;
    selectedTower = null;
    hideTowerPanel();
    updateTowerBar();
  }
}

canvas.addEventListener('pointerdown', onCanvasPointerDown);
canvas.addEventListener('pointermove', e => {
  if (!running || paused || gameEnded) return;
  const { x, y } = canvasPos(e);
  hoverSlot = findSlotAt(x, y);
});
canvas.addEventListener('pointerleave', () => { hoverSlot = null; });

// ==================== 波次 ====================
function startWave(groups) {
  let delay = 0.4;
  for (const [type, count] of groups) {
    for (let i = 0; i < count; i++) {
      spawnQueue.push({ type, delay });
      delay += 0.65;
    }
  }
  SFX.play('levelup');
  updateHud();
}

function spawnMonster(type) {
  const def = MONSTERS[type];
  monsters.push({
    type,
    hp: def.hp,
    maxHp: def.hp,
    dist: 0,
    speed: def.speed,
    armor: def.armor,
    reward: def.reward,
    leak: def.leak,
    size: def.size,
    slowTime: 0,
    slowFactor: 0,
    poisonTime: 0,
    poisonDps: 0,
    dead: false,
    x: 0,
    y: 0,
  });
}

function updateWaves(dt) {
  const waves = LEVEL_WAVES[level - 1];

  if (waveIndex < waves.length) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      startWave(waves[waveIndex]);
      waveIndex++;
      waveTimer = 13;
      updateHud();
    }
  }

  for (let i = spawnQueue.length - 1; i >= 0; i--) {
    spawnQueue[i].delay -= dt;
    if (spawnQueue[i].delay <= 0) {
      spawnMonster(spawnQueue[i].type);
      spawnQueue.splice(i, 1);
    }
  }
}

// ==================== 怪兽 ====================
function damageMonster(monster, amount, ignoreArmor = false) {
  if (!monster || monster.dead) return;
  const actual = ignoreArmor ? amount : Math.max(1, amount - monster.armor);
  monster.hp -= actual;
  if (monster.hp <= 0) killMonster(monster);
}

function killMonster(monster) {
  if (monster.dead) return;
  monster.dead = true;
  coins += monster.reward;
  kills++;
  burst(monster.x, monster.y, '#ffd75e', 12);
  effects.push({
    type: 'text',
    x: monster.x,
    y: monster.y - 16,
    text: `+${monster.reward}`,
    color: '#b87a00',
    life: 0.8,
    maxLife: 0.8,
  });
  SFX.play('hit', { throttle: 70 });
  updateHud();
  updateTowerBar();
  updateTowerPanel();
}

function updateMonsters(dt) {
  for (const monster of monsters) {
    if (monster.dead) continue;

    if (monster.slowTime > 0) monster.slowTime -= dt;

    if (monster.poisonTime > 0) {
      monster.poisonTime -= dt;
      damageMonster(monster, monster.poisonDps * dt, true);
      if (monster.dead) continue;
    }

    const def = MONSTERS[monster.type];
    const resist = def.slowResist || 0;
    const slowMul = monster.slowTime > 0 ? 1 - monster.slowFactor * (1 - resist) : 1;
    monster.dist += monster.speed * slowMul * dt;

    const pos = pathPos(monster.dist);
    monster.x = pos.x;
    monster.y = pos.y;

    if (monster.dist >= totalPathLength) {
      monster.dead = true;
      lives -= monster.leak;
      SFX.play('damage', { throttle: 100 });
      effects.push({
        type: 'text',
        x: pos.x,
        y: pos.y - 20,
        text: `-${monster.leak} 生命`,
        color: '#d94343',
        life: 1,
        maxLife: 1,
      });
      updateHud();
      if (lives <= 0) {
        gameOver();
        return;
      }
    }
  }

  monsters = monsters.filter(m => !m.dead);
}

// ==================== 寻敌 / 开火 ====================
function findTarget(tower, range) {
  let best = null;
  let bestDist = -1;
  for (const monster of monsters) {
    if (monster.dead) continue;
    const dx = monster.x - tower.x;
    const dy = monster.y - tower.y;
    if (dx * dx + dy * dy > range * range) continue;
    if (monster.dist > bestDist) {
      bestDist = monster.dist;
      best = monster;
    }
  }
  return best;
}

function fireTower(tower, target, stats) {
  const def = TOWERS[tower.type];

  if (def.kind === 'chain') {
    const points = [{ x: tower.x, y: tower.y }];
    let current = target;
    const hit = new Set();

    for (let i = 0; i < stats.chains; i++) {
      if (!current || hit.has(current)) break;
      hit.add(current);
      points.push({ x: current.x, y: current.y });
      damageMonster(current, stats.damage);

      let next = null;
      let nextDist = Infinity;
      for (const m of monsters) {
        if (m.dead || hit.has(m)) continue;
        const dx = m.x - current.x;
        const dy = m.y - current.y;
        const d = dx * dx + dy * dy;
        if (d < 100 * 100 && d < nextDist) {
          nextDist = d;
          next = m;
        }
      }
      current = next;
    }

    effects.push({ type: 'lightning', points, life: 0.18, maxLife: 0.18 });
    SFX.play('shoot', { throttle: 80 });
    return;
  }

  projectiles.push({
    type: tower.type,
    x: tower.x,
    y: tower.y,
    tx: target.x,
    ty: target.y,
    target,
    speed: tower.type === 'cannon' ? 300 : 430,
    damage: stats.damage,
    splash: stats.splash || 0,
    slow: stats.slow || 0,
    slowTime: stats.slowTime || 0,
    poison: stats.poison || 0,
    poisonTime: stats.poisonTime || 0,
  });
  SFX.play('shoot', { throttle: 80 });
}

function updateTowers(dt) {
  for (const tower of towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    const stats = TOWERS[tower.type].levels[tower.level - 1];
    const target = findTarget(tower, stats.range);
    if (!target) {
      tower.cooldown = 0;
      continue;
    }

    fireTower(tower, target, stats);
    tower.cooldown = 1 / stats.rate;
  }
}

// ==================== 投射物 ====================
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    if (p.target && !p.target.dead) {
      p.tx = p.target.x;
      p.ty = p.target.y;
    }

    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 9) {
      impactProjectile(p);
      projectiles.splice(i, 1);
      continue;
    }

    const step = Math.min(dist, p.speed * dt);
    p.x += dx / dist * step;
    p.y += dy / dist * step;

    if (dist <= p.speed * dt + 9) {
      impactProjectile(p);
      projectiles.splice(i, 1);
    }
  }
}

function impactProjectile(p) {
  if (p.type === 'cannon') {
    effects.push({ type: 'explosion', x: p.tx, y: p.ty, r: p.splash, life: 0.32, maxLife: 0.32 });
    SFX.play('explode', { throttle: 100 });
    for (const monster of monsters) {
      if (monster.dead) continue;
      const dx = monster.x - p.tx;
      const dy = monster.y - p.ty;
      if (dx * dx + dy * dy <= p.splash * p.splash) {
        damageMonster(monster, p.damage);
      }
    }
    return;
  }

  if (!p.target || p.target.dead) return;

  if (p.type === 'frost') {
    damageMonster(p.target, p.damage);
    if (!p.target.dead) {
      p.target.slowTime = Math.max(p.target.slowTime, p.slowTime);
      p.target.slowFactor = Math.max(p.target.slowFactor, p.slow);
    }
    effects.push({ type: 'ring', x: p.target.x, y: p.target.y, color: '#8fd6ff', life: 0.25, maxLife: 0.25 });
    return;
  }

  if (p.type === 'poison') {
    damageMonster(p.target, p.damage);
    if (!p.target.dead) {
      p.target.poisonTime = Math.max(p.target.poisonTime, p.poisonTime);
      p.target.poisonDps = Math.max(p.target.poisonDps, p.poison);
    }
    return;
  }

  damageMonster(p.target, p.damage);
}

// ==================== 特效 ====================
function burst(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.35,
      maxLife: 0.65,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.type === 'text') e.y -= 26 * dt;
    if (e.life <= 0) effects.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 100 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ==================== 主更新 ====================
function update(dt) {
  if (levelTransition > 0) {
    levelTransition -= dt;
    updateParticles(dt);
    updateEffects(dt);
    if (levelTransition <= 0) nextLevel();
    return;
  }

  if (!running || paused || gameEnded) return;

  updateWaves(dt);
  updateMonsters(dt);
  if (gameEnded) return;
  updateTowers(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  updateParticles(dt);

  if (!gameEnded && waveIndex >= LEVEL_WAVES[level - 1].length && spawnQueue.length === 0 && monsters.length === 0) {
    clearLevel();
  }
}

// ==================== 绘制 ====================
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawGround();
  drawPath();
  drawSlots();
  drawBaseAndPortal();
  drawTowers();
  drawMonsters();
  drawProjectiles();
  drawEffects();
  drawParticles();
  drawHover();
}

function drawGround() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#e7f9d7' : '#d8f2c3';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
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
}

function drawPath() {
  for (const cell of path) {
    ctx.fillStyle = '#f6e3b8';
    ctx.fillRect(cell.c * CELL + 2, cell.r * CELL + 2, CELL - 4, CELL - 4);
  }

  if (path.length < 2) return;

  ctx.save();
  ctx.strokeStyle = '#e3c58c';
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path.forEach((cell, i) => {
    const x = cell.c * CELL + CELL / 2;
    const y = cell.r * CELL + CELL / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawSlots() {
  for (const slot of slots) {
    const x = slot.c * CELL + CELL / 2;
    const y = slot.r * CELL + CELL / 2;
    const occupied = towers.some(t => t.r === slot.r && t.c === slot.c);
    if (occupied) continue;

    const hovered = hoverSlot && hoverSlot.r === slot.r && hoverSlot.c === slot.c;
    ctx.fillStyle = hovered ? 'rgba(124,92,255,0.22)' : 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hovered ? '#7c5cff' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = hovered ? '#7c5cff' : 'rgba(110,90,128,0.45)';
    ctx.font = 'bold 20px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', x, y + 1);

    if (selectedBuild && hovered) {
      ctx.globalAlpha = 0.7;
      ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      ctx.fillText(TOWERS[selectedBuild].icon, x, y - 1);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBaseAndPortal() {
  if (!path.length) return;

  const start = path[0];
  const end = path[path.length - 1];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(124,92,255,0.22)';
  ctx.beginPath();
  ctx.arc(start.c * CELL + CELL / 2, start.r * CELL + CELL / 2, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '28px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.fillText('🌀', start.c * CELL + CELL / 2, start.r * CELL + CELL / 2 + 1);

  ctx.fillStyle = 'rgba(43,143,99,0.22)';
  ctx.beginPath();
  ctx.arc(end.c * CELL + CELL / 2, end.r * CELL + CELL / 2, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '30px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.fillText('🏰', end.c * CELL + CELL / 2, end.r * CELL + CELL / 2 + 1);
}

function drawTowers() {
  for (const tower of towers) {
    const def = TOWERS[tower.type];
    const stats = def.levels[tower.level - 1];

    if (selectedTower === tower) {
      ctx.fillStyle = 'rgba(124,92,255,0.08)';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, stats.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(124,92,255,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = 'rgba(43,31,60,0.16)';
    ctx.beginPath();
    ctx.ellipse(tower.x, tower.y + 16, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, tower.x, tower.y + 1);

    for (let i = 0; i < tower.level; i++) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(tower.x - 10 + i * 10, tower.y + 25, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMonsters() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const monster of monsters) {
    if (monster.dead) continue;
    const def = MONSTERS[monster.type];

    if (monster.slowTime > 0) {
      ctx.fillStyle = 'rgba(143,214,255,0.35)';
      ctx.beginPath();
      ctx.arc(monster.x, monster.y + 3, monster.size * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    if (monster.poisonTime > 0) {
      ctx.fillStyle = 'rgba(122,158,58,0.28)';
      ctx.beginPath();
      ctx.arc(monster.x, monster.y + 3, monster.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(43,31,60,0.18)';
    ctx.beginPath();
    ctx.ellipse(monster.x, monster.y + monster.size * 0.45, monster.size * 0.42, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${def.size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.fillText(def.icon, monster.x, monster.y + 2);

    drawBar(monster.x - 20, monster.y - def.size * 0.78, 40, 5, monster.hp / monster.maxHp, '#ff8a9b');
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    if (p.type === 'cannon') {
      ctx.fillStyle = '#d97a3a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (p.type === 'frost') {
      ctx.fillStyle = '#8fd6ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (p.type === 'poison') {
      ctx.fillStyle = '#9ac04a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#ffd75e';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y + 4);
      ctx.lineTo(p.x + 7, p.y - 4);
      ctx.stroke();
    }
  }
}

function drawEffects() {
  for (const e of effects) {
    const alpha = Math.max(0, e.life / e.maxLife);

    if (e.type === 'text') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.font = 'bold 15px "Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.text, e.x, e.y);
      ctx.globalAlpha = 1;
    } else if (e.type === 'explosion') {
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = '#ffb17a';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (1 - alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.type === 'ring') {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14 + (1 - alpha) * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.type === 'lightning') {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#e8ccff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#b06bd9';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      e.points.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
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
  if (!hoverSlot || !selectedBuild) return;
  const x = hoverSlot.c * CELL + CELL / 2;
  const y = hoverSlot.r * CELL + CELL / 2;
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(hoverSlot.c * CELL + 2, hoverSlot.r * CELL + 2, CELL - 4, CELL - 4);
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TOWERS[selectedBuild].icon, x, y);
  ctx.globalAlpha = 1;
}

function drawBar(x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(43,31,60,0.3)';
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

// ==================== 暂停 / 覆盖层 ====================
function togglePause() {
  if (!running || gameEnded || levelTransition > 0) return;
  paused = !paused;
  SFX.play('click');
  if (paused) {
    selectedBuild = null;
    selectedTower = null;
    hideTowerPanel();
    updateTowerBar();
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

function showOverlay(title, sub) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ==================== 输入 ====================
document.addEventListener('keydown', e => {
  const k = e.key;
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();

  if (k === 'r' || k === 'R') { startCampaign(); return; }
  if (k === 'p' || k === 'P') { togglePause(); return; }

  if (!running) {
    if (k === ' ' || k === 'Enter') {
      if (gameEnded) {
        if (gameWon) startCampaign();
        else retryLevel();
      } else {
        startCampaign();
      }
    }
    return;
  }

  if (paused || gameEnded || levelTransition > 0) return;

  const idx = Number(k);
  if (idx >= 1 && idx <= 5) {
    selectTowerType(Object.keys(TOWERS)[idx - 1]);
  }
});

pauseBtn.addEventListener('click', () => {
  if (!running) startCampaign();
  else togglePause();
});
restartBtn.addEventListener('click', startCampaign);

overlay.addEventListener('click', () => {
  if (gameEnded) {
    if (gameWon) startCampaign();
    else retryLevel();
    return;
  }
  if (!running) {
    startCampaign();
    return;
  }
  if (paused) togglePause();
});

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
function initPreview() {
  level = 1;
  coins = START_COINS;
  lives = MAX_LIVES;
  kills = 0;
  levelStartCoins = coins;
  levelStartLives = lives;
  levelStartKills = kills;
  initLevelState();
  running = false;
  paused = false;
  gameEnded = false;
  gameWon = false;
  showOverlay('怪兽塔防', '选择武器 → 点击空地建造 · 点击已建武器升级');
  updatePauseLabel();
}

initPreview();
raf = requestAnimationFrame(loop);

window.MonsterGame = {
  start: startCampaign,
  get state() {
    return {
      level, coins, lives, kills, waveIndex, waveTimer, running, paused,
      gameEnded, gameWon, path, slots, towers, monsters, projectiles, spawnQueue,
    };
  },
  setLevel(n) {
    level = Math.max(1, Math.min(MAX_LEVEL, n));
    beginLevel();
  },
};
