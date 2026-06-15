# 数独 — 技术详解

## 一、整体架构

```
script.js
├── DOM 引用        board、timer、errors、numpad、msg
├── 状态变量        solution、puzzle、playerGrid、notes、selectedR/C
├── 难度配置        REMOVE_COUNT { easy:36, medium:46, hard:54 }
├── 数独生成        generateSolved() → 回溯 + 随机
├── 挖空            initGame() → shuffle 81 个位置 → 按难度挖空
├── 渲染            render()（DOM 动态生成 81 格）
│   ├── 高亮        同行/列/宫 + 相同数字
│   ├── 笔记        3×3 小数字网格
│   └── 错误标记    红色 + errors 计数
├── 输入            inputNumber() / selectCell()
├── 笔记模式        noteMode 切换
├── 关联笔记清除    clearRelatedNotes()
├── 键盘            1-9 / 方向键 / N / Backspace
└── 胜利检测        checkWin()（完全匹配 solution）
```

## 二、关键实现

### 2.1 回溯生成数独

```js
function generateSolved() {
  const grid = Array.from({length: 9}, () => Array(9).fill(0));
  function solve() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const nums = shuffle([1,2,3,4,5,6,7,8,9]);  // 随机顺序
          for (const n of nums) {
            if (isValid(r, c, n)) {
              grid[r][c] = n;
              if (solve()) return true;
              grid[r][c] = 0;   // 回溯
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
```

关键点：**`shuffle([1...9])`** 让每次尝试数字的顺序随机，保证生成的终盘每局不同。如果按固定 1-9 顺序，每次都生成相同的数独。

`isValid` 检查三个约束：行无重复、列无重复、3×3 宫无重复。

### 2.2 挖空策略

```js
const remove = REMOVE_COUNT[difficulty];  // 36 / 46 / 54
const positions = shuffle(Array.from({length: 81}, (_, i) => i));
for (let i = 0; i < remove; i++) {
  const r = Math.floor(positions[i] / 9);
  const c = positions[i] % 9;
  puzzle[r][c] = 0;
}
```

将 81 个格子位置随机打乱，按难度挖去前 N 个。随机挖空保证每局空格分布不同，且简单模式下保留 45 个提示足够解题。

### 2.3 笔记模式

```js
if (noteMode) {
  if (playerGrid[selectedR][selectedC] !== 0) return;  // 已填数字不能记笔记
  const s = notes[selectedR][selectedC];
  if (s.has(n)) s.delete(n); else s.add(n);  // toggle
}
```

笔记用 `Set` 存储，toggle 切换（有则删、无则加）。渲染时在格子内创建 3×3 小数字网格：

```js
const notesDiv = document.createElement('div');
notesDiv.className = 'notes';
for (let n = 1; n <= 9; n++) {
  const s = document.createElement('span');
  s.textContent = notes[r][c].has(n) ? n : '';
  notesDiv.appendChild(s);
}
```

### 2.4 自动清除关联笔记

```js
function clearRelatedNotes(r, c, num) {
  for (let i = 0; i < 9; i++) {
    notes[r][i].delete(num);   // 同行
    notes[i][c].delete(num);   // 同列
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      notes[br + dr][bc + dc].delete(num);  // 同宫
}
```

当玩家填入正确数字时，自动删除同行、同列、同宫中所有笔记里的该数字。这是数独解题的辅助逻辑——如果某行已经出现了 5，那同行其他格的笔记里不应再有 5。

### 2.5 数字耗尽提示

```js
function updateNumpadState() {
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (playerGrid[r][c]) counts[playerGrid[r][c]]++;
  numpadEl.querySelectorAll('button').forEach((btn, i) => {
    btn.classList.toggle('exhausted', counts[i + 1] >= 9);
  });
}
```

统计每个数字已填入的数量，达到 9 个时按钮加 `.exhausted` 类（变灰 + 禁止点击），视觉提示该数字已全部放置。

## 三、配置常量

| 难度 | 挖空数 | 保留提示 |
|------|--------|---------|
| 简单 | 36 | 45 (55%) |
| 中等 | 46 | 35 (43%) |
| 困难 | 54 | 27 (33%) |

| 常量 | 含义 |
|------|------|
| `REMOVE_COUNT` | 各难度挖空数量 |
| 笔记网格 | 3×3 span 布局 |
