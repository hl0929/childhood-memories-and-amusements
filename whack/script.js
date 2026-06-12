// ==================== 配置 ====================
const GAME_TIME  = 30;        // 游戏秒数
const HOLES      = 9;
const MOLE_EMOJI = '🐭';
const BOMB_EMOJI = '💣';
const BOMB_CHANCE = 0.18;     // 炸弹出现概率

// ==================== DOM ====================
const boardEl   = document.getElementById('board');
const scoreEl   = document.getElementById('score');
const highEl    = document.getElementById('high-score');
const comboEl   = document.getElementById('combo');
const timerEl   = document.getElementById('timer');
const startBtn  = document.getElementById('start-btn');
const resultEl  = document.getElementById('result');
const resultText= document.getElementById('result-text');

// ==================== 构建洞穴 ====================
const holes = [];
for (let i = 0; i < HOLES; i++) {
  const hole = document.createElement('div');
  hole.className = 'hole';
  const mole = document.createElement('div');
  mole.className = 'mole';
  mole.textContent = MOLE_EMOJI;
  hole.appendChild(mole);
  boardEl.appendChild(hole);
  holes.push({ el: hole, moleEl: mole, timer: null, up: false, isBomb: false });
}

// ==================== 状态 ====================
let score, highScore, combo, timeLeft, running, countdownInterval;
let moleTimers = [];

// ==================== 辅助 ====================
function rand(min, max) { return Math.random() * (max - min) + min; }

function showScorePop(hole, pts) {
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = pts > 0 ? `+${pts}` : pts;
  pop.style.color = pts > 0 ? '#ffdd00' : '#ff4444';
  hole.el.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

// ==================== 出现 / 消失 ====================
function peekMole(h) {
  if (!running || h.up) return;
  h.isBomb = Math.random() < BOMB_CHANCE;
  h.moleEl.textContent = h.isBomb ? BOMB_EMOJI : MOLE_EMOJI;
  h.up = true;
  h.el.classList.add(h.isBomb ? 'bomb' : 'up');

  // 越到后期停留越短
  const remaining = timeLeft / GAME_TIME;
  const stayMs = rand(600, 1200) * (0.4 + remaining * 0.6);
  h.timer = setTimeout(() => hideMole(h), stayMs);
}

function hideMole(h) {
  if (!h.up) return;
  h.up = false;
  h.el.classList.remove('up','bomb','whacked');
  clearTimeout(h.timer);
}

// ==================== 打击 ====================
holes.forEach(h => {
  h.moleEl.addEventListener('click', e => onHit(h, e));
  h.moleEl.addEventListener('touchstart', e => { onHit(h, e); e.preventDefault(); }, {passive:false});
});

function onHit(h, e) {
  if (!running || !h.up) return;
  e.stopPropagation();
  hideMole(h);
  h.el.classList.add('whacked');
  setTimeout(() => h.el.classList.remove('whacked'), 200);

  if (h.isBomb) {
    combo = 0;
    comboEl.textContent = 0;
    const pts = -10;
    score = Math.max(0, score + pts);
    scoreEl.textContent = score;
    showScorePop(h, pts);
  } else {
    combo++;
    comboEl.textContent = combo;
    const multiplier = combo >= 5 ? 3 : combo >= 3 ? 2 : 1;
    const pts = 10 * multiplier;
    score += pts;
    scoreEl.textContent = score;
    showScorePop(h, pts * (multiplier > 1 ? multiplier : 1));
    if (score > highScore) {
      highScore = score;
      highEl.textContent = highScore;
      localStorage.setItem('whack_high', highScore);
    }
  }
}

// ==================== 调度地鼠 ====================
function scheduleMoles() {
  if (!running) return;
  // 随机选一个没出现的洞
  const available = holes.filter(h => !h.up);
  if (available.length) {
    const h = available[Math.floor(Math.random() * available.length)];
    peekMole(h);
  }
  // 出现间隔随时间缩短
  const remaining = timeLeft / GAME_TIME;
  const interval = rand(400, 900) * (0.4 + remaining * 0.6);
  setTimeout(scheduleMoles, interval);
}

// ==================== 游戏流程 ====================
function startGame() {
  score     = 0;
  combo     = 0;
  timeLeft  = GAME_TIME;
  highScore = Number(localStorage.getItem('whack_high') || 0);
  running   = true;

  scoreEl.textContent = 0;
  highEl.textContent  = highScore;
  comboEl.textContent = 0;
  timerEl.textContent = GAME_TIME + 's';
  resultEl.classList.add('hidden');
  startBtn.classList.add('hidden');

  // 隐藏所有地鼠
  holes.forEach(h => { hideMole(h); });

  // 倒计时
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft + 's';
    if (timeLeft <= 0) endGame();
  }, 1000);

  scheduleMoles();
}

function endGame() {
  running = false;
  clearInterval(countdownInterval);
  holes.forEach(h => hideMole(h));

  const prev = Number(localStorage.getItem('whack_high') || 0);
  let extra = '';
  if (score > prev) {
    localStorage.setItem('whack_high', score);
    highEl.textContent = score;
    extra = ' 🏆 新纪录！';
  }
  resultText.textContent = `本局得分：${score}${extra}`;
  resultEl.classList.remove('hidden');
  startBtn.classList.remove('hidden');
}

// ==================== 启动按钮 ====================
startBtn.addEventListener('click', startGame);

// 读取最高分
highEl.textContent = localStorage.getItem('whack_high') || 0;
