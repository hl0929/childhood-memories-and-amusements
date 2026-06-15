# 推箱子 — 技术详解

## 一、整体架构

```
script.js
├── 关卡数据        LEVELS[10]，标准 Sokoban 符号
├── DOM 引用        board、steps、level、msg
├── 状态变量        map、playerR/C、steps、history
├── 地图解析        loadLevel() → 解析 #@$.*+ 符号
├── 渲染            render()（DOM 动态生成格子）
├── 移动逻辑        move(dr, dc) → 检查墙壁/推箱子
├── 撤销            undo() → 从 history栈回退
├── 胜利检测        checkWin() → 所有目标上有箱子
└── 输入处理        键盘 / 触屏滑动
```

## 二、关键实现

### 2.1 地图解析（Sokoban 标准符号）

```js
switch (ch) {
  case '#': map[r][c] = 1; break;         // 墙
  case '.': map[r][c] = 3; targets.push([r, c]); break;  // 目标点
  case '$': map[r][c] = 2; boxes.push([r, c]); break;    // 箱子
  case '@': map[r][c] = 2; playerR = r; playerC = c; break; // 玩家
  case '+': map[r][c] = 3; playerR = r; playerC = c; targets.push([r, c]); break; // 玩家在目标上
  case '*': map[r][c] = 3; boxes.push([r, c]); targets.push([r, c]); break; // 箱子在目标上
  case ' ': map[r][c] = 2; break;         // 地板
  default:  map[r][c] = 0;                 // 空格（地图外）
}
```

使用标准 Sokoban 符号集，兼容大量社区关卡。`*` 和 `+` 是组合符号（箱子/玩家在目标点上），解析时同时记录目标点和箱子/玩家位置。

### 2.2 推箱子逻辑

```js
function move(dr, dc) {
  const nr = playerR + dr;
  const nc = playerC + dc;
  // 撞墙或地图外 → 拒绝
  if (map[nr][nc] === 1 || map[nr][nc] === 0) return;
  
  const boxIdx = boxes.findIndex(([br, bc]) => br === nr && bc === nc);
  if (boxIdx >= 0) {
    // 前方有箱子 → 检查箱子后方是否可推
    const bnr = nr + dr, bnc = nc + dc;
    if (map[bnr][bnc] === 1 || map[bnr][bnc] === 0) return;  // 墙
    if (boxes.some(([br, bc]) => br === bnr && bc === bnc)) return; // 另一个箱子
    // 可以推 → 保存历史 + 移动
    history.push({ pr: playerR, pc: playerC, boxes: boxes.map(b => [...b]), steps });
    boxes[boxIdx] = [bnr, bnc];
    playerR = nr; playerC = nc;
  } else {
    // 空地移动 → 保存历史
    history.push({ pr: playerR, pc: playerC, boxes: boxes.map(b => [...b]), steps });
    playerR = nr; playerC = nc;
  }
}
```

推箱子规则：前方有箱子时，箱子后方不能是墙、地图外或另一个箱子。每次移动前保存完整状态（玩家位置 + 所有箱子坐标 + 步数），供撤销使用。

### 2.3 撤销（历史栈）

```js
function undo() {
  if (!history.length) return;
  const state = history.pop();
  playerR = state.pr;
  playerC = state.pc;
  boardEl._boxes = state.boxes;
  steps = state.steps;
}
```

每步移动前将完整状态（玩家坐标 + 箱子数组深拷贝 + 步数）推入 `history` 栈。撤销时弹出最近一步恢复，支持无限撤销直到初始状态。

### 2.4 胜利检测

```js
function checkWin() {
  const allOnTarget = targets.every(([tr, tc]) =>
    boxes.some(([br, bc]) => br === tr && bc === tc)
  );
}
```

所有目标点都有箱子覆盖即通关。渲染时箱子在目标点上的格子使用 `.box-done` 类（变色提示）。

### 2.5 触屏滑动方向识别

```js
const dx = e.changedTouches[0].clientX - touchStart.x;
const dy = e.changedTouches[0].clientY - touchStart.y;
if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;  // 太短忽略
if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
else move(dy > 0 ? 1 : -1, 0);
```

20px 最小滑动阈值防误触，比较 dx/dy 绝对值决定方向。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| 关卡数 | 10 | LEVELS 数组长度 |
| 滑动阈值 | 20px | 触屏滑动最低距离 |
| 地图符号 | #@$.*+ | 标准 Sokoban 符号集 |
