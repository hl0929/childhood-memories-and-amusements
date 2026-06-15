# 扫雷 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        ROWS/COLS/MINES（按难度动态调整）
├── DOM 引用        board、minesLeft、timer、msg
├── 状态变量        grid、revealed、flagged、gameOver、firstClick
├── 难度切换        diffBtns → 修改行列雷数 → initGame()
├── 布雷            placeMines()（首击后触发）
├── 翻开逻辑        reveal()（递归展开空格）
├── 标旗            toggleFlag()
├── 胜利检测        checkWin()
├── 渲染            render()（DOM 动态生成）
└── 输入处理        click / contextmenu / touchstart+touchend
```

## 二、关键实现

### 2.1 首击安全（placeMines）

布雷推迟到第一次点击后才执行，保证首击位置及周围 3×3 区域无雷：

```js
function placeMines(safeR, safeC) {
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    // 安全区：首击周围 3x3 不放雷
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    if (grid[r][c] === -1) continue;  // 已有雷
    grid[r][c] = -1;
    placed++;
  }
  // 然后计算数字
}
```

如果首击就布雷，玩家可能第一次就踩雷——体验极差。延迟布雷保证首击安全，同时 3×3 安全区让玩家起步时能看到一些数字提示。

### 2.2 空格递归展开

```js
function reveal(r, c) {
  if (revealed[r][c] || flagged[r][c]) return;
  revealed[r][c] = true;
  if (grid[r][c] === -1) { ... gameOver ... return; }
  // 空格（数字为 0）→ 递归展开相邻格
  if (grid[r][c] === 0) {
    forNeighbors(r, c, (nr, nc) => reveal(nr, nc));
  }
  checkWin();
}
```

点击数字为 0 的格子时，自动翻开其所有邻居；如果邻居也是 0，继续递归。这样一次点击就能展开大片空白区域，大幅提升游玩效率。

### 2.3 长按标旗（移动端）

```js
let longPressTimer = null;
let longPressed = false;
boardEl.addEventListener('touchstart', e => {
  longPressed = false;
  longPressTimer = setTimeout(() => {
    longPressed = true;
    toggleFlag(+el.dataset.r, +el.dataset.c);
  }, 400);
});
boardEl.addEventListener('touchend', e => {
  clearTimeout(longPressTimer);
  if (longPressed) { e.preventDefault(); longPressed = false; }
});
boardEl.addEventListener('touchmove', () => { clearTimeout(longPressTimer); });
```

移动端没有右键，用 400ms 长按模拟标旗操作。`touchmove` 时取消长按（防止滑动误触），`longPressed` 标志防止长按后又触发 click 事件翻开格子。

### 2.4 胜利检测

```js
function checkWin() {
  let unrevealed = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!revealed[r][c]) unrevealed++;
  // 未翻开格子数等于雷数 → 胜利
  if (unrevealed === MINES) { ... win ... }
}
```

扫雷的胜利条件是"所有非雷格子都被翻开"，等价于"未翻开的格子数恰好等于雷数"。胜利后自动标记所有雷旗。

### 2.5 踩雷标记

```js
// 踩到的雷用红色高亮
const idx = r * COLS + c;
boardEl.children[idx].classList.add('mine-exploded');
```

踩雷时先显示所有雷位置，再给踩到的那颗加 `.mine-exploded` 红色标记，与普通雷区分。

## 三、配置常量

| 难度 | 行×列 | 雷数 | 安全区 |
|------|-------|------|--------|
| 初级 | 9×9 | 10 | 首击 3×3 |
| 中级 | 16×16 | 40 | 首击 3×3 |
| 高级 | 16×30 | 99 | 首击 3×3 |

| 常量 | 含义 |
|------|------|
| 长按阈值 | 400ms 触发标旗 |
