# 五子棋 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        SIZE=15、CELL=30、PAD=20
├── DOM 引用        canvas、黑白信息、当前回合、msg
├── 状态变量        grid、currentTurn、hoverR/C、winLine
├── 模式切换        vsAI flag → initGame()
├── 初始化          initGame() → 清空棋盘
├── 绘制            draw() → 背景+网格+星位+棋子+悬停+连线
├── 棋子绘制        drawPiece() → 渐变+阴影+重绘
├── 落子            placeStone() → 更新grid + 检测胜利
├── 胜利检测        checkWin() → 四方向延伸
├── AI              aiMove() → 候选筛选 + 评分策略
├── 位置评分        evaluatePosition() → 六级评分
├── 鼠标/触摸       getGridPos() → 坐标缩放
└── 输入            click / mousemove / touchstart
```

## 二、关键实现

### 2.1 棋子绘制（渐变 + 阴影 + 重绘）

```js
function drawPiece(r, c, player) {
  const x = PAD + c * CELL;
  const y = PAD + r * CELL;
  const radius = CELL * 0.42;
  // 先画棋子渐变
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
  // 黑棋：从 #555 到 #111；白棋：从 #fff 到 #ccc
  ctx.arc(x, y, radius, ...); ctx.fill();
  // 再画阴影（偏移 +2,+2）
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.arc(x + 2, y + 2, radius, ...); ctx.fill();
  // 最后重绘棋子（覆盖阴影上半部分）
  ctx.arc(x, y, radius, ...); ctx.fill();  // 渐变棋子盖住阴影
}
```

三层绘制策略：棋子 → 阴影 → 棋子重绘。阴影只露出右下部分（棋子覆盖左上），营造 3D 立体感。渐变从 (-3,-3) 偏移开始，模拟光照从左上方照射。

### 2.2 胜利检测（四方向延伸）

```js
function checkWin(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]; // 横、竖、正斜、反斜
  for (const [dr, dc] of dirs) {
    const line = [[r, c]];
    // 正方向延伸最多 4 步
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (越界 || 不是己方棋子) break;
      line.push([nr, nc]);
    }
    // 反方向延伸最多 4 步
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (越界 || 不是己方棋子) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= 5) return line;
  }
  return null;
}
```

从落子位置向四个方向正反双向延伸，计算连续同色棋子总数。≥5 即获胜，返回连线的所有坐标用于高亮绘制。

### 2.3 AI 评分策略

```js
function evaluatePosition(r, c, player) {
  grid[r][c] = player;  // 临时放置
  let score = 0;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;      // 包含自身
    let openEnds = 0;   // 两端空格数
    // 正方向延伸 → 计算连续棋子 + 端点是否开放
    // 反方向延伸 → 同理
    // 评分表
    if (count >= 5) score += 100000;       // 必胜
    else if (count === 4 && openEnds >= 1) score += 10000;  // 活四/冲四
    else if (count === 3 && openEnds === 2) score += 5000;  // 活三
    else if (count === 3 && openEnds === 1) score += 500;   // 冲三
    else if (count === 2 && openEnds === 2) score += 200;   // 活二
    else if (count === 2 && openEnds === 1) score += 50;    // 冲二
  }
  grid[r][c] = EMPTY;  // 恢复
  return score;
}
```

评分维度：**连续棋子数** + **开放端数**。

| 模式 | count | openEnds | 分数 | 含义 |
|------|-------|----------|------|------|
| 必胜 | ≥5 | — | 100000 | 已连五 |
| 活四 | 4 | 2 | 10000 | 两端开放，对手无法防守 |
| 冲四 | 4 | 1 | 10000 | 一端开放，对手可堵 |
| 活三 | 3 | 2 | 5000 | 两端开放，下一步可变活四 |
| 冲三 | 3 | 1 | 500 | 一端开放 |
| 活二 | 2 | 2 | 200 | 两端开放 |
| 冲二 | 2 | 1 | 50 | 一端开放 |

### 2.4 AI 攻防兼顾

```js
const attackScore  = evaluatePosition(r, c, WHITE);  // AI 下此处的攻击得分
const defenseScore = evaluatePosition(r, c, BLACK);  // 对手下此处的威胁得分
const score = attackScore * 1.1 + defenseScore;
```

攻击权重 ×1.1（略高于防守），让 AI 在攻击和防守价值相等时优先攻击。但如果对手有活四（10000分），AI 会优先堵住（防守得分远高于攻击）。

### 2.5 候选位置筛选

```js
const candidates = [];
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] !== EMPTY) continue;
    // 检查是否在已有棋子 2 格范围内
    let near = false;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (附近有棋子) { near = true; break; }
      }
    }
    if (near) candidates.push([r, c]);
  }
}
```

15×15 棋盘有 225 个位置，全量评估太慢。只评估已有棋子周围 2 格范围内的空位（通常 <30 个），大幅减少计算量。

### 2.6 坐标缩放（响应式 Canvas）

```js
function getGridPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (clientX - rect.left) * scaleX;
  const my = (clientY - rect.top) * scaleY;
  const c = Math.round((mx - PAD) / CELL);
  const r = Math.round((my - PAD) / CELL);
  if (越界) return null;
  return [r, c];
}
```

CSS `width:100%` 让 Canvas 显示尺寸可能缩小，但逻辑尺寸（490×490）不变。`scaleX/scaleY` 映射屏幕坐标回逻辑坐标，`Math.round` 精确对齐到交叉点。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `SIZE` | 15 | 棋盘边长 15×15 |
| `CELL` | 30px | 每格像素 |
| `PAD` | 20px | 棋盘边距 |
| 星位 | [3,3],[3,11],[7,7],[11,3],[11,11] | 天元+四角星 |
| AI 攻击权重 | ×1.1 | 攻击评分略高于防守 |
| 候选范围 | 2格 | AI 只评估附近 2 格内位置 |
| 棋子半径 | CELL×0.42 | 棋子大小 |
