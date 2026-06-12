# 打地鼠 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        GAME_TIME、HOLES、MOLE/BOMB Emoji、BOMB_CHANCE
├── 构建洞穴        DOM 动态生成 9 个 hole + mole 元素
├── 状态变量        score、combo、timeLeft、running
├── 地鼠出没        peekMole() / hideMole()
├── 打击处理        onHit()
├── 调度器          scheduleMoles()（递归 setTimeout）
└── 游戏流程        startGame() / endGame()
```

## 二、关键实现

### 2.1 动态难度：随时间加快

游戏中用 `remaining = timeLeft / GAME_TIME`（0→1，越来越小）控制速度：

```js
// 地鼠停留时间：剩余时间越少，停留越短
const stayMs = rand(600, 1200) * (0.4 + remaining * 0.6);

// 出现间隔：剩余时间越少，间隔越短
const interval = rand(400, 900) * (0.4 + remaining * 0.6);
```

系数 `(0.4 + remaining * 0.6)` 在开始时约为 1.0，结束时降至 0.4，停留和间隔都缩短到原来的 40%。

### 2.2 递归调度（而非固定 setInterval）

```js
function scheduleMoles() {
  if (!running) return;
  const available = holes.filter(h => !h.up);
  if (available.length) {
    const h = available[随机];
    peekMole(h);
  }
  const interval = rand(400, 900) * (0.4 + remaining * 0.6);
  setTimeout(scheduleMoles, interval);   // 下一次调度
}
```

使用递归 `setTimeout` 而非 `setInterval`，每次调度完成后才安排下次，间隔可动态变化。`running=false` 时不再调度，自然停止。

### 2.3 连击与倍率

```js
if (h.isBomb) {
  combo = 0;                              // 炸弹重置连击
  score = Math.max(0, score - 10);
} else {
  combo++;
  const multiplier = combo >= 5 ? 3 : combo >= 3 ? 2 : 1;
  score += 10 * multiplier;
}
```

连击阈值：
- 1-2 连：×1（10 分）
- 3-4 连：×2（20 分）
- 5+ 连：×3（30 分）

### 2.4 得分浮动提示

```js
function showScorePop(hole, pts) {
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = pts > 0 ? `+${pts}` : pts;
  pop.style.color = pts > 0 ? '#ffdd00' : '#ff4444';
  hole.el.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}
```

动态创建浮动文字元素，CSS 动画驱动上浮淡出，`animationend` 后自动移除，避免 DOM 堆积。

### 2.5 地鼠/炸弹状态

每个 hole 对象：
```js
{ el, moleEl, timer: null, up: false, isBomb: false }
```

`up=true` 时添加 `.up` 或 `.bomb` CSS class（驱动地鼠弹出动画），`hideMole` 时移除所有 class。打中时添加 `.whacked` class（击打动画），200ms 后移除。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `GAME_TIME` | 30s | 游戏时长 |
| `HOLES` | 9 | 洞穴数量 |
| `BOMB_CHANCE` | 0.18 | 炸弹出现概率 |
| 连击 ×2 阈值 | 3 | combo ≥ 3 |
| 连击 ×3 阈值 | 5 | combo ≥ 5 |
