// ==================== DOM ====================
const boardEl    = document.getElementById('board');
const timerEl    = document.getElementById('timer');
const errorsEl   = document.getElementById('errors');
const msgEl      = document.getElementById('msg');
const msgTitle   = document.getElementById('msg-title');
const msgSub     = document.getElementById('msg-sub');
const numpadEl   = document.getElementById('numpad');
const eraseBtn   = document.getElementById('erase-btn');
const noteBtn    = document.getElementById('note-btn');
const restartBtn = document.getElementById('restart-btn');
const diffBtns   = document.querySelectorAll('.diff-btn');

// ==================== 状态 ====================
let solution, puzzle, playerGrid, notes;
let selectedR = -1, selectedC = -1;
let errors = 0, noteMode = false;
let timerInterval, startTime;
let difficulty = 'easy';

// ==================== 难度 ====================
const REMOVE_COUNT = { easy: 36, medium: 46, hard: 54 };
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
    SFX.play('start');
    initGame();
  });
});

// ==================== 数独生成 ====================
function generateSolved() {
  const grid = Array.from({length: 9}, () => Array(9).fill(0));

  function isValid(r, c, num) {
    for (let i = 0; i < 9; i++) { if (grid[r][i] === num) return false; }
    for (let i = 0; i < 9; i++) { if (grid[i][c] === num) return false; }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (grid[br + dr][bc + dc] === num) return false;
    return true;
  }

  function solve() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const nums = shuffle([1,2,3,4,5,6,7,8,9]);
          for (const n of nums) {
            if (isValid(r, c, n)) {
              grid[r][c] = n;
              if (solve()) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  solve();
  return grid;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ==================== 初始化 ====================
function initGame() {
  solution = generateSolved();
  puzzle = solution.map(r => [...r]);

  // 挖空
  const remove = REMOVE_COUNT[difficulty];
  const positions = shuffle(Array.from({length: 81}, (_, i) => i));
  for (let i = 0; i < remove; i++) {
    const r = Math.floor(positions[i] / 9);
    const c = positions[i] % 9;
    puzzle[r][c] = 0;
  }

  playerGrid = puzzle.map(r => [...r]);
  notes = Array.from({length: 9}, () => Array.from({length: 9}, () => new Set()));
  selectedR = -1; selectedC = -1;
  errors = 0; noteMode = false;
  errorsEl.textContent = 0;
  noteBtn.classList.remove('active');
  msgEl.classList.add('hidden');

  clearInterval(timerInterval);
  startTime = null;
  timerEl.textContent = '0s';

  buildNumpad();
  render();
}

// ==================== 数字键盘 ====================
function buildNumpad() {
  numpadEl.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.textContent = n;
    btn.addEventListener('click', () => inputNumber(n));
    numpadEl.appendChild(btn);
  }
  updateNumpadState();
}

function updateNumpadState() {
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (playerGrid[r][c]) counts[playerGrid[r][c]]++;

  numpadEl.querySelectorAll('button').forEach((btn, i) => {
    btn.classList.toggle('exhausted', counts[i + 1] >= 9);
  });
}

// ==================== 渲染 ====================
function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;

      const isGiven = puzzle[r][c] !== 0;
      const isSelected = (r === selectedR && c === selectedC);
      const val = playerGrid[r][c];

      if (isGiven) el.classList.add('given');

      // 高亮同行/列/宫
      if (selectedR >= 0) {
        const sameRow = r === selectedR;
        const sameCol = c === selectedC;
        const sameBox = Math.floor(r / 3) === Math.floor(selectedR / 3) &&
                        Math.floor(c / 3) === Math.floor(selectedC / 3);
        if (sameRow || sameCol || sameBox) el.classList.add('highlighted');
        // 高亮相同数字
        const selVal = playerGrid[selectedR][selectedC];
        if (selVal && val === selVal) el.classList.add('same-num');
      }

      if (isSelected) el.classList.add('selected');

      // 错误标记
      if (val && !isGiven && val !== solution[r][c]) {
        el.classList.add('error');
      }

      if (val) {
        el.textContent = val;
      } else if (notes[r][c].size > 0) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'notes';
        for (let n = 1; n <= 9; n++) {
          const s = document.createElement('span');
          s.textContent = notes[r][c].has(n) ? n : '';
          notesDiv.appendChild(s);
        }
        el.appendChild(notesDiv);
      }

      el.addEventListener('click', () => selectCell(r, c));
      boardEl.appendChild(el);
    }
  }
  updateNumpadState();
}

// ==================== 选择格子 ====================
function selectCell(r, c) {
  const same = (r === selectedR && c === selectedC);
  selectedR = r; selectedC = c;
  if (!same) SFX.play('select');
  if (!startTime) startTimer();
  render();
}

// ==================== 输入数字 ====================
function inputNumber(n) {
  if (selectedR < 0 || puzzle[selectedR][selectedC] !== 0) return;
  if (!startTime) startTimer();

  if (noteMode) {
    if (playerGrid[selectedR][selectedC] !== 0) return;
    const s = notes[selectedR][selectedC];
    if (s.has(n)) s.delete(n); else s.add(n);
    SFX.play('tick');
    render();
    return;
  }

  playerGrid[selectedR][selectedC] = n;
  notes[selectedR][selectedC].clear();

  // 检查是否错误
  if (n !== solution[selectedR][selectedC]) {
    errors++;
    errorsEl.textContent = errors;
    SFX.play('invalid');
  } else {
    SFX.play('place');
    // 自动清除同行/列/宫中相同数字的笔记
    clearRelatedNotes(selectedR, selectedC, n);
  }

  render();
  checkWin();
}

// ==================== 清除关联笔记 ====================
function clearRelatedNotes(r, c, num) {
  for (let i = 0; i < 9; i++) {
    notes[r][i].delete(num);
    notes[i][c].delete(num);
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      notes[br + dr][bc + dc].delete(num);
}

// ==================== 擦除 ====================
eraseBtn.addEventListener('click', () => {
  if (selectedR < 0 || puzzle[selectedR][selectedC] !== 0) return;
  if (playerGrid[selectedR][selectedC] !== 0) SFX.play('undo');
  playerGrid[selectedR][selectedC] = 0;
  notes[selectedR][selectedC].clear();
  render();
});

// ==================== 笔记模式 ====================
noteBtn.addEventListener('click', () => {
  noteMode = !noteMode;
  SFX.play('click');
  noteBtn.classList.toggle('active', noteMode);
});

// ==================== 键盘 ====================
document.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '9') inputNumber(+e.key);
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (selectedR >= 0 && puzzle[selectedR][selectedC] === 0) {
      if (playerGrid[selectedR][selectedC] !== 0) SFX.play('undo');
      playerGrid[selectedR][selectedC] = 0;
      notes[selectedR][selectedC].clear();
      render();
    }
  }
  if (e.key === 'n' || e.key === 'N') { noteMode = !noteMode; SFX.play('click'); noteBtn.classList.toggle('active', noteMode); }
  // 方向键移动选择
  if (selectedR >= 0) {
    if (e.key === 'ArrowUp')    { e.preventDefault(); selectCell(Math.max(0, selectedR - 1), selectedC); }
    if (e.key === 'ArrowDown')  { e.preventDefault(); selectCell(Math.min(8, selectedR + 1), selectedC); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); selectCell(selectedR, Math.max(0, selectedC - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); selectCell(selectedR, Math.min(8, selectedC + 1)); }
  }
});

// ==================== 胜利 ====================
function checkWin() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (playerGrid[r][c] !== solution[r][c]) return;

  clearInterval(timerInterval);
  SFX.play('win');
  msgTitle.textContent = '🎉 完美通关！';
  msgSub.textContent = `用时 ${timerEl.textContent}，错误 ${errors} 次`;
  setTimeout(() => msgEl.classList.remove('hidden'), 300);
}

// ==================== 计时 ====================
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
  }, 1000);
}

restartBtn.addEventListener('click', () => { SFX.play('start'); initGame(); });

// ==================== 启动 ====================
initGame();