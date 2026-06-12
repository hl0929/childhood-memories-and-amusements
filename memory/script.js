// 表情符号池
const EMOJIS = [
  '🐶','🐱','🦊','🐺','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐙','🦋','🐝','🌸',
  '🍎','🍊','🍋','🍇','🍓','🌈','⭐','🎸',
  '🚀','🎃','💎','🔥','🌊','🎯','🎪','🧲',
];

// ==================== DOM ====================
const boardEl    = document.getElementById('board');
const flipsEl    = document.getElementById('flips');
const matchedEl  = document.getElementById('matched');
const timerEl    = document.getElementById('timer');
const bestEl     = document.getElementById('best');
const winMsgEl   = document.getElementById('win-msg');
const winDetail  = document.getElementById('win-detail');
const restartBtn = document.getElementById('restart-btn');
const diffBtns   = document.querySelectorAll('.diff-btn');

// ==================== 状态 ====================
let cols = 4, rows = 4;
let cards = [], flipped = [], matchCount = 0;
let flips = 0, startTime = null, timerInterval = null, blocked = false;

// ==================== 难度 ====================
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cols = Number(btn.dataset.cols);
    rows = Number(btn.dataset.rows);
    startGame();
  });
});
restartBtn.addEventListener('click', startGame);

// ==================== 计时 ====================
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerEl.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

// ==================== 游戏启动 ====================
function startGame() {
  const total = cols * rows;
  const pairsNeeded = total / 2;
  const pool = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, pairsNeeded);
  const deck = [...pool, ...pool].sort(() => Math.random() - 0.5);

  cards = deck.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
  flipped = [];
  matchCount = 0;
  flips = 0;
  blocked = false;

  flipsEl.textContent   = 0;
  matchedEl.textContent = 0;
  timerEl.textContent   = '0s';
  winMsgEl.classList.add('hidden');

  // 棋盘列数
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  boardEl.innerHTML = '';
  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-back"></div>
        <div class="card-front">${card.emoji}</div>
      </div>`;
    el.addEventListener('click', () => onCardClick(card, el));
    boardEl.appendChild(el);
    card.el = el;
  });

  stopTimer();
  startTimer();

  // 读取最佳记录
  const bestKey = `mem_best_${cols}x${rows}`;
  const b = localStorage.getItem(bestKey);
  bestEl.textContent = b ? b + '次' : '--';
}

// ==================== 翻牌逻辑 ====================
function onCardClick(card, el) {
  if (blocked || card.flipped || card.matched) return;
  card.flipped = true;
  el.classList.add('flipped');
  flipped.push(card);
  flips++;
  flipsEl.textContent = flips;

  if (flipped.length === 2) {
    blocked = true;
    const [a, b] = flipped;
    if (a.emoji === b.emoji) {
      // 匹配成功
      setTimeout(() => {
        a.el.classList.add('matched');
        b.el.classList.add('matched');
        a.matched = b.matched = true;
        flipped = [];
        blocked = false;
        matchCount++;
        matchedEl.textContent = matchCount;
        if (matchCount === cards.length / 2) onWin();
      }, 400);
    } else {
      // 不匹配，翻回
      setTimeout(() => {
        a.flipped = b.flipped = false;
        a.el.classList.remove('flipped');
        b.el.classList.remove('flipped');
        flipped = [];
        blocked = false;
      }, 900);
    }
  }
}

// ==================== 胜利 ====================
function onWin() {
  stopTimer();
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const bestKey = `mem_best_${cols}x${rows}`;
  const prev = Number(localStorage.getItem(bestKey) || Infinity);
  let newRecord = '';
  if (flips < prev) {
    localStorage.setItem(bestKey, flips);
    bestEl.textContent = flips + '次';
    newRecord = ' 🏆 新纪录！';
  }
  winDetail.textContent = `用时 ${elapsed}秒，翻牌 ${flips} 次${newRecord}`;
  setTimeout(() => winMsgEl.classList.remove('hidden'), 400);
}

// ==================== 启动 ====================
startGame();
