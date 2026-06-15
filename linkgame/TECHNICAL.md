# 连连看 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        ROWS/COLS、ICONS（12种）
├── DOM 引用        board、score/remaining/timer、msg、SVG、按钮
├── 状态变量        grid、score、selected、gameOver
├── 初始化          initGame() → 生成配对 + 填充网格
├── 渲染            render()（DOM 动态生成 tile）
├── 交互            onTileClick() → 选/配对判断
├── BFS 寻路        findPath()（≤ 2 弯）
├── SVG 连线        drawLine() → 动态创建 SVG line
├── 消除            removePair() → 清空格子 + 动画
├── 可用配对检测    hasAnyMatch()
├── 打乱            shuffleGrid()（Fisher-Yates）
├── 提示            findHint() → 高亮可消除对
└── 计时            startTimer() / stopTimer()
```

## 二、关键实现

### 2.1 BFS 寻路（≤ 2 弯连线）

连连看的核心算法：两个相同图案之间能否通过一条不超过 2 个拐弯的路径连接。

```js
function findPath(r1, c1, r2, c2) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  // BFS 状态: [行, 列, 方向, 转弯次数, 路径]
  const queue = [[r1, c1, -1, 0, [[r1, c1]]]];
  const visited = new Set();
  visited.add(`${r1},${c1},-1`);

  while (queue.length) {
    const [r, c, dir, turns, path] = queue.shift();
    if (turns > 2) continue;
    for (let d = 0; d < 4; d++) {
      const nr = r + dirs[d][0], nc = c + dirs[d][1];
      const newTurns = (dir === -1 || dir === d) ? turns : turns + 1;
      if (newTurns > 2) continue;
      // 允许走到边界外一圈（外围空白区）
      if (nr < 0 || nr > ROWS + 1 || nc < 0 || nc > COLS + 1) continue;
      // 到达终点
      if (nr === r2 && nc === c2) return [...path, [nr, nc]];
      // 只能走空格
      if (grid[nr] && grid[nr][nc] === null) {
        visited.add(`${nr},${nc},${d}`);
        queue.push([nr, nc, d, newTurns, [...path, [nr, nc]]]);
      }
    }
  }
  return null;
}
```

关键设计：
- **网格扩展一圈**：grid 尺寸为 `(ROWS+2) × (COLS+2)`，外围一圈为 null 空格，允许连线绕到棋盘边缘外
- **状态 = (位置, 方向, 转弯数)**：方向改变时转弯数 +1，初始方向 -1 不计转弯
- **visited 用方向区分**：同一格不同方向视为不同状态，避免漏解

### 2.2 SVG 连线动画

```js
function drawLine(path) {
  lineSvg.innerHTML = '';
  const boardRect = boardEl.getBoundingClientRect();
  for (let i = 0; i < path.length - 1; i++) {
    const [r1, c1] = path[i];
    const [r2, c2] = path[i + 1];
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', getTileCenterX(c1, boardRect));
    line.setAttribute('y1', getTileCenterY(r1, boardRect));
    line.setAttribute('x2', getTileCenterX(c2, boardRect));
    line.setAttribute('y2', getTileCenterY(r2, boardRect));
    lineSvg.appendChild(line);
  }
  setTimeout(() => { lineSvg.innerHTML = ''; }, 600);
}
```

SVG 覆盖在棋盘上方（绝对定位），每段路径创建一个 `<line>` 元素。600ms 后自动清除。坐标计算将 grid 坐标映射为像素中心点。

### 2.3 自动打乱（无可用配对时）

```js
function shuffleGrid() {
  // 收集所有剩余图案
  const tiles = [];
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) tiles.push(grid[r][c]);
  // Fisher-Yates 洗牌
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  // 写回原位置（保持形状不变）
  let idx = 0;
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) grid[r][c] = tiles[idx++];
  // 如果仍无解 → 递归再洗
  if (!hasAnyMatch()) shuffleGrid();
}
```

洗牌只改变图案分配，不改变空格位置（保持棋盘当前形状）。递归洗牌保证最终有解。

### 2.4 可用配对检测

```js
function hasAnyMatch() {
  const tiles = [];
  for (let r = 1; r <= ROWS; r++)
    for (let c = 1; c <= COLS; c++)
      if (grid[r][c]) tiles.push([r, c]);
  // 枚举所有同图案对
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (grid[tiles[i][0]][tiles[i][1]] === grid[tiles[j][0]][tiles[j][1]]
          && findPath(tiles[i][0], tiles[i][1], tiles[j][0], tiles[j][1]))
        return true;
    }
  }
  return false;
}
```

枚举所有剩余图案对，检查是否有同图案且路径可达的对。每次消除后自动调用，无可用配对时触发洗牌。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `ROWS / COLS` | 6 / 8 | 棋盘大小 |
| `ICONS` | 12 种 | 图案类型数 |
| 连线弯数上限 | 2 | BFS 转弯次数限制 |
| SVG 连线显示 | 600ms | 连线动画持续时间 |
| 提示闪烁 | 1600ms | 提示高亮持续时间 |
