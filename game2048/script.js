// ==================== 状态 ====================
const SIZE = 4;
let grid, score, highScore, won, over;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const highEl  = document.getElementById('high-score');
const msgEl   = document.getElementById('msg');

// ==================== 核心逻辑 ====================
function newGrid() {
  return Array.from({length: SIZE}, () => Array(SIZE).fill(0));
}

function addRandom(g) {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!g[r][c]) empty.push([r,c]);
  if (!empty.length) return;
  const [r,c] = empty[Math.floor(Math.random()*empty.length)];
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
}

// 向左滑动一行，返回 {row, gained}
function slideRow(row) {
  const nums = row.filter(v => v);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i+1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i+1, 1);
    }
  }
  while (nums.length < SIZE) nums.push(0);
  return { row: nums, gained };
}

function move(dir) {
  // 将棋盘旋转成"向左操作"的形式
  let rotated = rotateGrid(grid, dir);
  let changed = false;
  let gainedTotal = 0;
  for (let r = 0; r < SIZE; r++) {
    const orig = [...rotated[r]];
    const { row, gained } = slideRow(rotated[r]);
    rotated[r] = row;
    gainedTotal += gained;
    if (row.some((v,i) => v !== orig[i])) changed = true;
  }
  if (!changed) return false;
  grid = unrotateGrid(rotated, dir);
  score += gainedTotal;
  scoreEl.textContent = score;
  if (score > highScore) {
    highScore = score;
    highEl.textContent = highScore;
    localStorage.setItem('g2048_high', highScore);
  }
  addRandom(grid);
  return true;
}

function rotateGrid(g, dir) {
  // up → transpose+left; down → reverse-transpose+left; right → reverse-rows+left
  if (dir === 'left')  return g.map(r => [...r]);
  if (dir === 'right') return g.map(r => [...r].reverse());
  if (dir === 'up')    return transpose(g);
  if (dir === 'down')  return transpose(g).map(r => [...r].reverse());
}
function unrotateGrid(g, dir) {
  if (dir === 'left')  return g;
  if (dir === 'right') return g.map(r => [...r].reverse());
  if (dir === 'up')    return transpose(g);
  if (dir === 'down')  return transpose(g.map(r => [...r].reverse()));
}
function transpose(g) {
  return Array.from({length: SIZE}, (_, r) => Array.from({length: SIZE}, (_, c) => g[c][r]));
}

function hasMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return true;
      if (c < SIZE-1 && grid[r][c] === grid[r][c+1]) return true;
      if (r < SIZE-1 && grid[r][c] === grid[r+1][c]) return true;
    }
  return false;
}

// ==================== 渲染 ====================
function tileClass(v) {
  if (!v) return '';
  if (v <= 2048) return `c${v}`;
  return 'chigh';
}

function render(newTiles = new Set()) {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      const el = document.createElement('div');
      el.className = 'cell ' + tileClass(v);
      if (v) el.textContent = v;
      if (newTiles.has(r * SIZE + c)) el.classList.add('pop');
      boardEl.appendChild(el);
    }
  }
  // 胜负检测
  if (!won && grid.some(row => row.includes(2048))) {
    won = true;
    showMsg('🎉 达成 2048！', '继续挑战？');
  } else if (!hasMove()) {
    over = true;
    showMsg('😢 无路可走', '再来一局');
  }
}

function showMsg(title, btn) {
  msgEl.innerHTML = `<span>${title}</span><button onclick="init()">${btn}</button>`;
  msgEl.classList.remove('hidden');
}

// ==================== 初始化 ====================
function init() {
  grid      = newGrid();
  score     = 0;
  won       = false;
  over      = false;
  highScore = Number(localStorage.getItem('g2048_high') || 0);
  scoreEl.textContent = 0;
  highEl.textContent  = highScore;
  msgEl.classList.add('hidden');
  addRandom(grid);
  addRandom(grid);
  render();
}

// ==================== 输入 ====================
const dirMap = {
  ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
  a:'left', d:'right', w:'up', s:'down',
  A:'left', D:'right', W:'up', S:'down',
};
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r') { init(); return; }
  const dir = dirMap[e.key];
  if (!dir || over) return;
  e.preventDefault();
  if (move(dir)) render();
});

// 触摸滑动
let tx = 0, ty = 0;
document.addEventListener('touchstart', e => {
  tx = e.touches[0].clientX;
  ty = e.touches[0].clientY;
}, {passive:true});
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  let dir;
  if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
  else dir = dy > 0 ? 'down' : 'up';
  if (!over && move(dir)) render();
}, {passive:true});

// ==================== 启动 ====================
init();
