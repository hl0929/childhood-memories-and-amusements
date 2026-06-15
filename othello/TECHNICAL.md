# 黑白棋 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        SIZE=8、EMPTY/BLACK/WHITE、8方向 DIRS
├── DOM 引用        board、黑白计数、当前回合、msg
├── 状态变量        grid、currentTurn、gameOver、vsAI、aiThinking
├── 模式切换        vsAI flag → initGame()
├── 翻转计算        getFlips(r, c, player) → 8方向搜索
├── 合法走法        getValidMoves(player)
├── 落子            makeMove(r, c, player) → 更新 grid
├── 渲染            render() + renderWithFlip()
├── 回合切换        nextTurn() → 跳过检测 + AI触发
├── AI              aiMove() → 贪心 + WEIGHT_MAP
├── 胜负判定        endGame() → 计数比较
└── 输入处理        cell click
```

## 二、关键实现

### 2.1 翻转计算（getFlips）

黑白棋核心规则：落子后，在 8 个方向上，如果沿某方向连续遇到对方棋子，且最后遇到己方棋子，则中间所有对方棋子被翻转。

```js
function getFlips(r, c, player) {
  if (grid[r][c] !== EMPTY) return [];
  const opponent = player === BLACK ? WHITE : BLACK;
  const allFlips = [];
  for (const [dr, dc] of DIRS) {
    const flips = [];
    let nr = r + dr, nc = c + dc;
    // 沿方向收集对方棋子
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] === opponent) {
      flips.push([nr, nc]);
      nr += dr; nc += dc;
    }
    // 末端必须是己方棋子才翻转
    if (flips.length > 0 && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc] === player) {
      allFlips.push(...flips);
    }
  }
  return allFlips;
}
```

对每个方向：先收集连续的对方棋子，再检查末端是否为己方棋子。如果末端不是己方（空格或越界），则该方向不翻转。`allFlips` 合并所有可翻转的对方棋子。

### 2.2 翻转动画（renderWithFlip）

```js
function renderWithFlip(flippedCells) {
  render();  // 先正常渲染所有棋子（已更新颜色）
  flippedCells.forEach(([r, c]) => {
    const idx = r * SIZE + c;
    const piece = boardEl.children[idx].querySelector('.piece');
    if (piece) piece.classList.add('flipping');
  });
}
```

CSS 翻转动画：
```css
.piece.flipping { animation: flip .3s ease-in-out; }
@keyframes flip {
  0%   { transform: scaleX(1); }
  50%  { transform: scaleX(0); }   // 中间缩小到 0 → 视觉上"消失"
  100% { transform: scaleX(1); }   // 恢复 → 显示新颜色
}
```

先更新 grid 数据再渲染，棋子已经是新颜色。动画在 scaleX=0 时"消失"，恢复后显示新颜色，视觉上模拟翻转过程。

### 2.3 跳过回合与自动结算

```js
function nextTurn() {
  currentTurn = currentTurn === BLACK ? WHITE : BLACK;
  if (getValidMoves(currentTurn).length === 0) {
    // 当前玩家无合法走法 → 跳过
    currentTurn = currentTurn === BLACK ? WHITE : BLACK;
    if (getValidMoves(currentTurn).length === 0) {
      // 双方都无法走 → 游戏结束
      endGame();
      return;
    }
  }
  // AI回合 → 400ms 延迟后执行
  if (vsAI && currentTurn === WHITE && !gameOver) {
    aiThinking = true;
    setTimeout(() => { ... aiThinking = false; nextTurn(); }, 400);
  }
}
```

黑白棋可能出现某方暂时无合法走法的情况（并非该方已输）。此时自动跳过，对方继续落子。只有双方都无合法走法时才结算。

### 2.4 AI 策略（贪心 + 位置权重）

```js
const WEIGHT_MAP = [
  [100, -20, 10,  5,  5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [ 10,  -2,  8,  1,  1,  8,  -2,  10],
  [  5,  -2,  1,  0,  0,  1,  -2,   5],
  ...
];

function aiMove() {
  let bestScore = -Infinity;
  for (const [r, c] of moves) {
    const flips = getFlips(r, c, WHITE);
    const score = flips.length * 3 + WEIGHT_MAP[r][c];
    if (score > bestScore) { ... }
  }
}
```

评分公式：`翻转数 × 3 + 位置权重`

位置权重的核心思路：
- **角落（100）**：最稳定位置，一旦占据不可被翻转
- **角旁（-50/-20）**：最危险位置，对方可借此翻入角落
- **边缘（10/5）**：相对稳定
- **中心（0/1）**：灵活但易被翻转

### 2.5 合法位置高亮

```js
const validMoves = gameOver ? [] : getValidMoves(currentTurn);
// 渲染时对空格检查是否为合法位置
if (validMoves.some(([vr, vc]) => vr === r && vc === c)) {
  el.classList.add('valid');
}
```

计算当前玩家所有合法走法，在棋盘上用 `.valid` 类（浅绿色）高亮提示，帮助玩家快速找到可落子位置。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `SIZE` | 8 | 棋盘边长 8×8 |
| `DIRS` | 8 方向 | 八方向搜索向量 |
| 翻转动画 | 300ms | `scaleX` 翻转持续时间 |
| AI 延迟 | 400ms | AI 落子思考时间 |
| 翻转权重 | ×3 | 翻转数量在评分中的倍率 |
