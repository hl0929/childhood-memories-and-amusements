# 消消乐 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        COLS/ROWS、GEMS、初始步数/目标分
├── 状态变量        grid、score、movesLeft、selected、busy、gameOver
├── 棋盘构建        buildGrid()
├── 匹配检测        findAllMatches()
├── 可行步检测      hasAnyMove()
├── 渲染            render()
├── 交互处理        onGemClick() / touchstart+touchend
├── 交换 & 消除     trySwap() / resolveMatches()（async）
└── 结束检测        checkEnd()
```

## 二、关键实现

### 2.1 初始棋盘构建

```js
do {
  grid = 随机生成 8×8;
  // 消除初始匹配（替换已存在的三连）
  while (changed) { 修正三连格 }
  attempts++;
} while (!hasAnyMove() && attempts < 20);
```

两步保障：
1. 消除初始匹配——扫描每格，若与左/上两个相同则换一个不同宝石
2. 保证有可行步——枚举每个相邻对，模拟交换后检查是否产生三消；若无则重新生成

### 2.2 匹配检测（findAllMatches）

扫描横向和纵向所有 3+ 连续相同宝石，用 `Set<"r,c">` 去重（一个格子可能同时属于横向和纵向匹配）：

```js
// 横向：找到 3 连后向右延伸计算实际长度
let len = 3;
while (c + len < COLS && grid[r][c+len] === grid[r][c]) len++;
for (let k = 0; k < len; k++) set.add(`${r},${c+k}`);
```

### 2.3 连锁消除（resolveMatches，递归 async）

```js
async function resolveMatches(chain) {
  const matches = findAllMatches();
  if (!matches.length) return;

  const multiplier = chain + 1;           // 连锁倍率
  score += matches.length * 10 * multiplier;

  // 播放消除动画
  matches → addClass('removing') → await delay(300)

  // 删除匹配，每列宝石下落，顶部补充新宝石
  for (let c = 0; c < COLS; c++) { 紧缩列 + 补充 }

  render(newCells);
  await delay(250);

  await resolveMatches(chain + 1);        // 检测连锁
}
```

连锁第 1 次倍率 ×1，第 2 次 ×2，第 3 次 ×3……每次连锁还会显示 "🔥 N连锁！" 浮动提示。

### 2.4 宝石下落与补充

消除后每列独立处理：

```js
// 从底部往上收集非 null 的宝石
const col = [];
for (let r = ROWS - 1; r >= 0; r--) {
  if (grid[r][c] !== null) col.push(grid[r][c]);
}
// 顶部补充新宝石
for (let i = 0; i < ROWS - col.length; i++) col.push(randGem());
// 写回：col[0] 在最底部
for (let r = ROWS - 1; r >= 0; r--) grid[r][c] = col[ROWS - 1 - r];
```

新补充的格子（顶部若干行）标记 `newCells`，渲染时加 `.falling` CSS 动画。

### 2.5 busy 锁

```js
async function trySwap(...) {
  busy = true;
  // ...动画、消除、连锁...
  busy = false;
}
```

消除过程是 async，期间 `busy=true` 防止玩家触发新操作导致状态混乱。

### 2.6 无路可走 → 自动洗牌

```js
if (!hasAnyMove()) {
  gameOver = true;
  showMsg('😢 无路可走', '棋盘已无可用步骤，自动洗牌…');
  setTimeout(() => {
    gameOver = false;
    buildGrid();
    render();
  }, 2000);
}
```

不直接结束游戏，而是 2 秒后重新建盘（保留当前分数和步数），给玩家继续的机会。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `COLS / ROWS` | 8 / 8 | 棋盘大小 |
| `GEMS` | 7 种 | 宝石类型数 |
| `INIT_MOVES` | 30 | 初始步数 |
| `INIT_TARGET` | 500 | 目标分数 |
