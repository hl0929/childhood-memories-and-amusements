// ==================== 关卡数据 ====================
// # = 墙, . = 目标, $ = 箱子, @ = 玩家, + = 玩家在目标上, * = 箱子在目标上, 空格 = 地板
const LEVELS = [
  // Level 1
  [
    '  ####  ',
    '###  #  ',
    '#.@$ #  ',
    '###$.#  ',
    '#.##$###',
    '# # . .#',
    '#   $  #',
    '########',
  ],
  // Level 2
  [
    '######  ',
    '#    ## ',
    '# $ $.##',
    '# @  . #',
    '## $...#',
    ' ##  ###',
    '  ####  ',
  ],
  // Level 3
  [
    '  #####',
    '###   #',
    '#. $  #',
    '###$.##',
    '#. $@##',
    '#$ ####',
    '# . #  ',
    '#   #  ',
    '#####  ',
  ],
  // Level 4
  [
    '########',
    '#      #',
    '# .**$ #',
    '# .  $ #',
    '# . $  #',
    '##@ ####',
    ' #####  ',
  ],
  // Level 5
  [
    ' #######',
    '##  #  #',
    '#   $  #',
    '#  .#  #',
    '## .$ ##',
    ' #@$. # ',
    ' #  .## ',
    ' #####  ',
  ],
  // Level 6
  [
    '  ######',
    '  #    #',
    '###$.# #',
    '# $ .  #',
    '# . .$ #',
    '##$#@###',
    ' #  ##  ',
    ' ####   ',
  ],
  // Level 7
  [
    ' ####   ',
    ' #  ####',
    ' # $   #',
    '## ##$ #',
    '#. .# $#',
    '#. . @##',
    '#. . ## ',
    '####### ',
  ],
  // Level 8
  [
    '  ####  ',
    '  #  ###',
    '  # $$ #',
    '### . ##',
    '#  .$. #',
    '# @ .$ #',
    '#  #####',
    '####    ',
  ],
  // Level 9
  [
    ' #####  ',
    ' #   ###',
    '##$ $  #',
    '# .#.  #',
    '#  . $#',
    '###@. ##',
    '  #  ##  ',
    '  ####   ',
  ],
  // Level 10
  [
    '  ######',
    '###    #',
    '# $  # #',
    '# ## . #',
    '#  . $ #',
    '##$#.  #',
    ' # @ ###',
    ' #####  ',
  ],
];

// ==================== DOM ====================
const boardEl   = document.getElementById('board');
const stepsEl   = document.getElementById('steps');
const levelEl   = document.getElementById('level');
const msgEl     = document.getElementById('msg');
const msgTitle  = document.getElementById('msg-title');
const msgSub    = document.getElementById('msg-sub');
const nextBtn   = document.getElementById('next-btn');
const undoBtn   = document.getElementById('undo-btn');
const resetBtn  = document.getElementById('reset-btn');

// ==================== 状态 ====================
let map, rows, cols;
let playerR, playerC;
let steps, currentLevel;
let history = []; // 用于撤销

// ==================== 初始化 ====================
function loadLevel(idx) {
  if (idx >= LEVELS.length) idx = 0;
  currentLevel = idx;
  levelEl.textContent = idx + 1;
  steps = 0;
  stepsEl.textContent = 0;
  history = [];
  msgEl.classList.add('hidden');

  const data = LEVELS[idx];
  rows = data.length;
  cols = Math.max(...data.map(r => r.length));

  // 解析地图: 0=空 1=墙 2=地板 3=目标
  map = Array.from({length: rows}, () => Array(cols).fill(0));
  const boxes = [];
  const targets = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const ch = data[r][c];
      switch (ch) {
        case '#': map[r][c] = 1; break;
        case '.': map[r][c] = 3; targets.push([r, c]); break;
        case '$': map[r][c] = 2; boxes.push([r, c]); break;
        case '@': map[r][c] = 2; playerR = r; playerC = c; break;
        case '+': map[r][c] = 3; playerR = r; playerC = c; targets.push([r, c]); break;
        case '*': map[r][c] = 3; boxes.push([r, c]); targets.push([r, c]); break;
        case ' ': map[r][c] = 2; break;
        default: map[r][c] = 0;
      }
    }
  }

  // 标记箱子与目标
  boardEl._boxes = boxes;
  boardEl._targets = targets;
  render();
}

// ==================== 渲染 ====================
function render() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  boardEl.style.setProperty('--cols', cols);

  const boxes = boardEl._boxes;
  const targets = boardEl._targets;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = document.createElement('div');
      el.className = 'cell';

      if (map[r][c] === 0) {
        el.classList.add('floor');
      } else if (map[r][c] === 1) {
        el.classList.add('wall');
      } else {
        const isTarget = targets.some(([tr, tc]) => tr === r && tc === c);
        const isBox = boxes.some(([br, bc]) => br === r && bc === c);
        const isPlayer = (r === playerR && c === playerC);

        if (isPlayer) {
          el.classList.add('player');
        } else if (isBox) {
          el.classList.add(isTarget ? 'box-done' : 'box');
        } else if (isTarget) {
          el.classList.add('target');
        } else {
          el.classList.add('floor');
        }
      }
      boardEl.appendChild(el);
    }
  }
}

// ==================== 移动逻辑 ====================
function move(dr, dc) {
  const nr = playerR + dr;
  const nc = playerC + dc;

  // 撞墙
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || map[nr][nc] === 1 || map[nr][nc] === 0) return;

  const boxes = boardEl._boxes;
  const boxIdx = boxes.findIndex(([br, bc]) => br === nr && bc === nc);

  if (boxIdx >= 0) {
    // 推箱子：检查箱子后方
    const bnr = nr + dr;
    const bnc = nc + dc;
    if (bnr < 0 || bnr >= rows || bnc < 0 || bnc >= cols || map[bnr][bnc] === 1 || map[bnr][bnc] === 0) return;
    if (boxes.some(([br, bc]) => br === bnr && bc === bnc)) return; // 后方有箱子

    // 保存历史
    history.push({ pr: playerR, pc: playerC, boxes: boxes.map(b => [...b]), steps });

    // 移动箱子
    boxes[boxIdx] = [bnr, bnc];
    playerR = nr;
    playerC = nc;
  } else {
    // 空地移动
    history.push({ pr: playerR, pc: playerC, boxes: boxes.map(b => [...b]), steps });
    playerR = nr;
    playerC = nc;
  }

  steps++;
  stepsEl.textContent = steps;
  render();
  checkWin();
}

// ==================== 撤销 ====================
function undo() {
  if (!history.length) return;
  const state = history.pop();
  playerR = state.pr;
  playerC = state.pc;
  boardEl._boxes = state.boxes;
  steps = state.steps;
  stepsEl.textContent = steps;
  render();
}

// ==================== 胜利检测 ====================
function checkWin() {
  const boxes = boardEl._boxes;
  const targets = boardEl._targets;
  const allOnTarget = targets.every(([tr, tc]) => boxes.some(([br, bc]) => br === tr && bc === tc));
  if (allOnTarget) {
    msgTitle.textContent = '🎉 通关！';
    msgSub.textContent = `${steps} 步完成`;
    nextBtn.textContent = currentLevel < LEVELS.length - 1 ? '下一关' : '从第一关重新开始';
    setTimeout(() => msgEl.classList.remove('hidden'), 200);
  }
}

// ==================== 输入 ====================
document.addEventListener('keydown', e => {
  if (!msgEl.classList.contains('hidden')) return;
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); move(-1, 0); break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); move(1, 0);  break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); move(0, -1); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); move(0, 1);  break;
    case 'z': case 'Z': undo(); break;
    case 'r': case 'R': loadLevel(currentLevel); break;
  }
});

// 触摸滑动
let touchStart = null;
boardEl.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
boardEl.addEventListener('touchend', e => {
  if (!touchStart || !msgEl.classList.contains('hidden')) { touchStart = null; return; }
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { touchStart = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
  else move(dy > 0 ? 1 : -1, 0);
  touchStart = null;
}, { passive: true });

// 按钮
undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', () => loadLevel(currentLevel));
nextBtn.addEventListener('click', () => loadLevel(currentLevel + 1));

// ==================== 启动 ====================
loadLevel(0);
