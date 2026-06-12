# 俄罗斯方块 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        COLS/ROWS/BLOCK、七种方块定义
├── 状态变量        board、piece、nextPiece、score、lines、level
├── 初始化          init()
├── 随机方块        randomPiece() / spawnPiece()
├── 主循环          loop()（基于 delta time）
├── 移动 & 旋转     moveLeft/Right/Down/rotatePiece/hardDrop
├── 碰撞检测        canPlace()
├── 锁定 & 消行     lock() / clearLines()
├── 绘制            draw() / drawBlock() / drawNext()
│   └── 幽灵块      ghostY 计算 + 半透明绘制
└── 输入处理        键盘 / 触摸 / 移动端按钮
```

## 二、关键实现

### 2.1 基于 delta time 的主循环

```js
function loop(ts) {
  if (lastTime === null) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;
  if (!paused) {
    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      moveDown();
    }
  }
  draw();
  raf = requestAnimationFrame(loop);
}
```

`dropTimer` 累积每帧的时间差，超过 `dropInterval` 时触发下落。这比用 `setInterval` 更精准，且不会受帧率波动影响。暂停时不累积时间，恢复时也不会因积累时间导致方块瞬移。

### 2.2 碰撞检测

```js
function canPlace(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c, ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;  // 越界
      if (ny >= 0 && board[ny][nx]) return false;             // 有方块
    }
  }
  return true;
}
```

`ny < 0` 时不检查 `board`（方块还在顶部以上，允许）。`canPlace` 被移动、旋转、硬降复用，统一入口。

### 2.3 旋转（矩阵转置 + 列逆序）

```js
function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  return Array.from({length: cols}, (_, c) =>
    Array.from({length: rows}, (_, r) => shape[rows - 1 - r][c])
  );
}
```

顺时针旋转 = 转置 + 上下翻转，此处合并为一步。

### 2.4 Wall Kick

```js
function rotatePiece() {
  const r = rotate(piece.shape);
  let offset = 0;
  if (!canPlace(r, piece.x, piece.y)) {
    offset = piece.x > COLS/2 ? -1 : 1;    // 靠右则向左踢，靠左则向右踢
    if (!canPlace(r, piece.x + offset, piece.y)) return;
  }
  piece.shape = r;
  piece.x += offset;
}
```

简化版 Wall Kick：旋转后若碰墙，根据方块所在列的左右半区决定踢墙方向，只尝试 ±1 偏移。

### 2.5 幽灵块

```js
let ghostY = piece.y;
while (canPlace(piece.shape, piece.x, ghostY + 1)) ghostY++;
if (ghostY !== piece.y) {
  ctx.globalAlpha = 0.2;
  piece.shape.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) drawBlock(piece.color, (piece.x+c)*BLOCK, (ghostY+r)*BLOCK);
    });
  });
  ctx.globalAlpha = 1;
}
```

每帧从当前位置向下探测最远可落点，以 20% 透明度绘制，帮助玩家预判落点。

### 2.6 消行得分

```js
const pts = [0, 100, 300, 500, 800][cleared] * level;
```

一次性消 N 行的分值高于单独消 N 次，鼓励同时消多行（尤其是四行 Tetris）。随关卡乘以倍率。

### 2.7 砖块绘制：高光 + 阴影

```js
function drawBlock(c, x, y, size = BLOCK) {
  ctx.fillStyle = c;                             // 主色
  ctx.fillRect(x+1, y+1, size-2, size-2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';      // 左上高光
  ctx.fillRect(x+1, y+1, size-2, 4);
  ctx.fillRect(x+1, y+1, 4, size-2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';             // 右下阴影
  ctx.fillRect(x+size-4, y+1, 3, size-2);
  ctx.fillRect(x+1, y+size-4, size-2, 3);
}
```

每个格子绘制四层：主色 → 左上高光条 → 右下阴影条，营造立体感。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `COLS / ROWS` | 10 / 20 | 棋盘列行数 |
| `BLOCK` | 30px | 每格像素 |
| 初始间隔 | 800ms | 方块下落间隔 |
| 每关减少 | 70ms | 每升一关加速 |
| 最快间隔 | 80ms | 下落间隔下限 |
| 消行升关 | 每 10 行 | 关卡增加条件 |
