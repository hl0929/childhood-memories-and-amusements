# 2048 — 技术详解

## 一、整体架构

```
script.js
├── 状态变量        grid（4×4 二维数组）、score、highScore、won、over
├── 核心逻辑        slideRow() / move() / rotateGrid() / unrotateGrid()
├── 终局检测        hasMove()
├── 渲染            render()
└── 输入处理        键盘 / 触摸滑动
```

## 二、关键实现

### 2.1 统一方向：旋转 + 向左滑动

所有方向的移动都通过同一套逻辑处理：将棋盘旋转成"需要向左滑动"的形式，执行左移，再旋转回来。

```js
function move(dir) {
  let rotated = rotateGrid(grid, dir);   // 旋转成向左形式
  for (let r = 0; r < SIZE; r++) {
    const { row, gained } = slideRow(rotated[r]);
    rotated[r] = row;
  }
  grid = unrotateGrid(rotated, dir);     // 旋转回原始方向
}
```

旋转规则：

| 方向 | rotateGrid | unrotateGrid |
|------|-----------|--------------|
| left | 原样复制 | 原样返回 |
| right | 每行反转 | 每行反转 |
| up | 转置 | 转置 |
| down | 转置后每行反转 | 每行反转后转置 |

这样 `slideRow`（向左合并）只需实现一次，四个方向共用。

### 2.2 slideRow — 一行向左合并

```js
function slideRow(row) {
  const nums = row.filter(v => v);        // 过滤掉 0
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i+1]) {
      nums[i] *= 2;                        // 合并
      gained += nums[i];
      nums.splice(i+1, 1);                 // 删除被合并的那个
    }
  }
  while (nums.length < SIZE) nums.push(0); // 右侧补 0
  return { row: nums, gained };
}
```

关键：合并后 `i` 不递增（通过 `splice` 而非另设标志），自然跳过已合并的数字，防止连锁合并（如 `[2,2,2,2]` 应得到 `[4,4,0,0]` 而非 `[8,0,0,0]`）。

### 2.3 新方块概率

```js
g[r][c] = Math.random() < 0.9 ? 2 : 4;
```

90% 概率生成 2，10% 概率生成 4，与标准 2048 规则一致。

### 2.4 终局检测

```js
function hasMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return true;                          // 有空格
      if (c < SIZE-1 && grid[r][c] === grid[r][c+1]) return true;  // 可横向合并
      if (r < SIZE-1 && grid[r][c] === grid[r+1][c]) return true;  // 可纵向合并
    }
  return false;
}
```

遍历一遍即可：有空格或相邻相等则说明还有合法移动。

### 2.5 渲染：CSS class 决定颜色

```js
function tileClass(v) {
  if (!v) return '';
  if (v <= 2048) return `c${v}`;   // c2, c4, c8, ..., c2048
  return 'chigh';                   // 超过 2048 统一用高分色
}
```

每个数字对应一个 CSS class，颜色在 `style.css` 中定义。新生成的格子加 `.pop` 动画 class，实现弹出效果。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `SIZE` | 4 | 网格边长（4×4） |
| 新方块概率 | 0.9 / 0.1 | 生成 2 / 4 的概率 |
