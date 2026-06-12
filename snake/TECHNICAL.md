# 贪吃蛇小游戏 — 技术详解

本文档详细讲解项目的代码实现、架构设计和关键技术决策。

---

## 一、index.html — 页面结构

HTML 结构简洁，分为三个核心区域：

```
container
├── h1                  标题
├── game-info           三个计分面板（得分 / 最高分 / 速度）
│   └── score-board ×3
│       ├── label       标签文字
│       ├── #score      分数值
│       └── #score-pop  得分弹出动画元素（+1 / +3）
├── canvas-wrapper      画布容器（相对定位）
│   ├── canvas#game     游戏画布
│   └── overlay         覆盖层（开始/暂停/结束）
├── controls            操作提示
└── mobile-controls     移动端虚拟方向键
```

关键设计点：
- **canvas 不设固定 width/height 属性**，由 JS 根据设备 DPI 动态设置，避免高清屏模糊
- **overlay 绝对定位覆盖画布**，通过 `.hidden` 类控制显隐，比 JS 直接操作 display 更平滑（有 CSS transition）
- **score-pop 放在 score-board 内部**，利用 `position: relative` 做相对定位弹出

---

## 二、style.css — 样式与动画

### 2.1 CSS 自定义属性（主题变量）

```css
:root {
  --accent: #00ff88;          /* 主色调：亮绿 */
  --accent-glow: rgba(0, 255, 136, 0.5);
  --food-red: #ff5050;        /* 普通食物色 */
  --food-gold: #ffd700;       /* 金色食物色 */
  --panel-bg: rgba(255, 255, 255, 0.06);
  --panel-border: rgba(255, 255, 255, 0.1);
  ...
}
```

所有颜色统一由变量管理，换主题只需修改 `:root` 下的变量值。

### 2.2 选择器精确匹配

```css
/* ✅ 精确选择，不受 #score-pop 干扰 */
#score, #high-score, #speed { ... }

/* ❌ 之前的写法，#score-pop 作为 last-child 会被错误染色 */
.score-board span:last-child { ... }
```

`#score-pop` 也放在 `.score-board` 内，如果用 `:last-child` 选择器，它会被错误应用分数值样式（1.5rem、绿色、粗体）。改为 ID 精确选择避免了这个问题。

### 2.3 动画清单

| 动画 | 触发 | 效果 |
|------|------|------|
| `scorePop` | 吃到食物 | "+1" / "+3" 上浮淡出，中间 scale 放大 |
| `numBump` | 吃到食物 | 分数数字 scale 弹跳 |
| `shake` | 死亡 | 画布左右抖动 0.3s |

### 2.4 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

当用户系统开启了"减少动画"偏好时，所有动画时长设为几乎 0，保证无障碍体验。

### 2.5 移动端适配

双重检测策略：
- `(hover: none) and (pointer: coarse)` — 触屏设备（手机/平板）
- `max-width: 480px` — 小屏幕兜底

两者都显示虚拟方向键、隐藏键盘提示，小屏幕还会缩放画布到 `92vw`。

---

## 三、script.js — 游戏核心逻辑

### 3.1 整体架构

```
script.js
├── 配置常量            GRID, BASE_MS, SPEED_UP, GOLDEN_CHANCE
├── DOM 引用            canvas, ctx, 各面板元素
├── 高 DPI 适配         devicePixelRatio 缩放
├── 离屏缓存            gridCanvas（静态网格只画一次）
├── 方向定义            DIR 枚举 (UP/DOWN/LEFT/RIGHT)
├── 音效系统            Web Audio API 合成音
├── 粒子系统            emit / update / draw
├── 背景星点            30 个微弱呼吸光点
├── 游戏状态            snake, snakeSet, dirQueue, ...
├── init()              初始化/重置
├── spawnFood()         食物生成（含金色概率）
├── dequeueDirection()  方向队列消费
├── loop()              主循环（RAF 驱动）
├── update()            逻辑更新（碰撞/吃食/加速）
├── draw()              渲染管线
│   ├── drawBgStars()   背景星点
│   ├── drawFood()      食物（脉冲/金色光环）
│   ├── drawSnake()     蛇身（连接段+圆角节+眼睛）
│   └── drawParticles() 爆发粒子
├── gameOver()          死亡处理
├── 输入处理            键盘/虚拟按键/滑动
└── init() 启动
```

### 3.2 高 DPI 适配

```js
const dpr = window.devicePixelRatio || 1;
canvas.width  = SIZE * dpr;        // 物理像素
canvas.height = SIZE * dpr;
canvas.style.width  = SIZE + 'px'; // CSS 逻辑像素
canvas.style.height = SIZE + 'px';
ctx.scale(dpr, dpr);               // 绘制坐标自动缩放
```

Canvas 有两层尺寸——**物理像素**（`canvas.width`）和 **CSS 尺寸**（`canvas.style.width`）。

在 Retina 屏上 `dpr=2`，物理像素是 CSS 尺寸的 2 倍。通过 `ctx.scale(dpr, dpr)` 让后续绘制坐标仍然基于逻辑像素，但实际渲染在更高分辨率的画布上，文字和图形不会发虚。

如果不做适配，Canvas 在高 DPI 设备上会出现明显模糊。

### 3.3 离屏 Canvas 缓存网格

```js
const gridCanvas = document.createElement('canvas');
// 在 gridCtx 上画一次网格线...
// 后续每帧直接贴图
ctx.drawImage(gridCanvas, 0, 0, SIZE, SIZE);
```

网格线是静态内容（21 条横线 + 21 条竖线），每帧重绘浪费时间。将其画到一个不在 DOM 中的离屏 canvas 上，主循环只需一次 `drawImage` 即可贴上去，减少约 40 次 `beginPath/moveTo/lineTo/stroke` 调用。

### 3.4 方向输入队列（dirQueue）

**问题**：如果玩家在一个 tick 内快速按了两个方向键（比如向右行进时先按上再按左），只记录最后一个方向可能导致：
1. 最后一键被判定为 180° 掉头而被丢弃
2. 两个有效方向只执行了最后一个

**解决方案**：方向键按下时入队 `dirQueue`，每个 tick 消费一个：

```js
function enqueueDirection(dir) {
  if (dirQueue.length < 3) dirQueue.push(dir);  // 上限 3，防堆积
}

function dequeueDirection() {
  while (dirQueue.length) {
    const d = dirQueue.shift();
    // 对 nextDirection 做防 180° 检测（而非 direction）
    if (d.x + nextDirection.x === 0 && d.y + nextDirection.y === 0) continue;
    return d;
  }
  return nextDirection;
}
```

关键：**防掉头检测对比的是 `nextDirection`（已确认的下一方向）而非 `direction`（当前方向）**。

举例：蛇正在向右走（direction=RIGHT, nextDirection=RIGHT），玩家快速按了上再按左：
- 如果对比 `direction`：LEFT 和 RIGHT 互为反向 → 被拒绝（但此时队列里还有 UP 没消费，逻辑已变）
- 如果对比 `nextDirection`：先消费 UP（与 RIGHT 不反向 → 通过），nextDirection 变为 UP；再消费 LEFT（与 UP 不反向 → 通过），nextDirection 变为 LEFT

前者可能导致有效操作被丢弃，后者正确处理了连续输入。

### 3.5 碰撞检测：Set 替代数组遍历

```js
// 用 Set 维护蛇身坐标，O(1) 查找
snakeSet = new Set(snake.map(s => `${s.x},${s.y}`));

// 碰撞检测
if (snakeSet.has(`${head.x},${head.y}`)) → gameOver();

// 移动时同步维护
snake.unshift(head);   snakeSet.add(`${head.x},${head.y}`);
snake.pop();           snakeSet.delete(`${tail.x},${tail.y}`);
```

原来用 `snake.some()` 每帧 O(n) 遍历，蛇很长时开销明显。改为 Set 后无论蛇多长都是 O(1)。

代价是每帧需要同步维护 `snakeSet`（unshift 时 add，pop 时 delete），但这比每次碰撞检测都遍历整个数组高效得多。

### 3.6 食物生成安全检查

```js
function spawnFood() {
  if (snake.length >= GRID * GRID) {
    // 蛇填满了整个 20×20 = 400 格，判定通关
    gameState = 'over';
    showOverlay('恭喜通关!', ...);
    return;
  }
  do { pos = { x: rand(GRID), y: rand(GRID) }; }
  while (occupied.has(`${pos.x},${pos.y}`));
  const isGolden = Math.random() < GOLDEN_CHANCE;
  food = { ...pos, golden: isGolden };
}
```

如果没有满格检查：
- 蛇几乎填满网格时，`do...while` 循环极多次才能找到空位
- 完全填满时，循环条件永远为真 → **无限循环**

加入满格判断既解决了安全问题，又增加了"通关"的彩蛋。

### 3.7 游戏循环：逻辑 tick 与渲染帧分离

```js
function loop(timestamp) {
  const tick = timestamp - lastTime >= interval;  // 逻辑帧
  if (tick) { update(); frameCount++; }            // 按间隔更新逻辑
  updateParticles();                               // 粒子每帧更新（更流畅）
  draw();                                          // 每帧都绘制
  animFrame = requestAnimationFrame(loop);
}
```

游戏逻辑按 `interval`（150ms ~ 50ms）tick，但**粒子动画和绘制每帧都执行**（~60fps）。

这样设计的原因：
- 游戏逻辑（蛇移动、碰撞）不需要 60fps，150ms 的 tick 速率就是游戏速度
- 粒子动画需要流畅的 60fps 才好看，如果跟着 tick 走会一卡一卡
- `frameCount` 在每次 tick 时递增，用于驱动食物脉冲等与游戏节奏同步的动画

### 3.8 粒子系统

```js
// 生成粒子
function emitParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (2π / count) * i + random;  // 均匀分布 + 随机扰动
    const speed = 1.5 + random * 2;            // 随机初速
    particles.push({ x, y, vx, vy, life: 1, decay, size, color });
  }
}

// 每帧更新
function updateParticles() {
  p.x += p.vx;  p.y += p.vy;  p.vy += 0.05;  // 微重力
  p.life -= p.decay;
  if (p.life <= 0) splice;                     // 死亡移除
}

// 绘制
ctx.globalAlpha = p.life;                       // 透明度随生命值衰减
ctx.arc(p.x, p.y, p.size * p.life, ...);        // 半径也随生命值缩小
```

粒子属性设计：
- `angle`：均匀分布保证爆发形状对称，加随机扰动避免太规整
- `decay`：0.02~0.04 的随机衰减速率，让粒子消散有先后
- `vy += 0.05`：微重力让粒子有抛物线下落感

触发场景：

| 场景 | 粒子数 | 颜色 | 效果 |
|------|--------|------|------|
| 吃普通食物 | 8 | 红色 #ff5050 | 小爆发 |
| 吃金色食物 | 14 | 金色 #ffd700 | 大爆发 |
| 死亡 | 16+6 | 红色+白色 | 强爆发 |
| 新纪录 | 5波×6 | 四色随机 | 延迟绽放庆祝 |

### 3.9 音效系统（Web Audio API）

```js
function playTone(freq, duration, type, vol) {
  ensureAudio();
  const osc  = audioCtx.createOscillator();  // 振荡器：产生声波
  const gain = audioCtx.createGain();        // 增益：控制音量
  osc.type = type;                           // sine / square / sawtooth
  osc.frequency.setValueAtTime(freq, ...);   // 频率 = 音高
  gain.gain.exponentialRampToValueAtTime(0.001, ...); // 音量指数衰减
  osc.connect(gain);                         // 振荡器 → 增益
  gain.connect(audioCtx.destination);         // 增益 → 扬声器
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
```

音频图连接：`OscillatorNode → GainNode → AudioDestination`

三种音效设计：

| 音效 | 波形 | 频率 | 特点 |
|------|------|------|------|
| `sfxEat` | sine（正弦波） | 660→880Hz | 短促双音，清脆悦耳 |
| `sfxGold` | sine（正弦波） | 880→1100→1320Hz | 三连升音，华丽感 |
| `sfxDie` | sawtooth（锯齿波） | 220→150Hz | 低沉锯齿波，压迫感 |

关键细节：
- `AudioContext` 延迟到首次交互时创建（`ensureAudio`），避免浏览器自动播放策略拦截
- `gain.exponentialRampToValueAtTime(0.001, ...)` 用指数衰减而非线性衰减，听感更自然（音量按对数刻度衰减）
- 用 `try/catch` 包裹，音效失败不影响游戏

### 3.10 蛇身绘制：连接段 + 圆角节 + 眼睛

#### 连接段（消除段间缝隙）

蛇身每节有 2px 的 padding，相邻两节之间会出现缝隙。解决方法是在相邻节之间画一个填充矩形：

```js
if (dx !== 0) {  // 水平相邻
  ctx.fillRect(Math.min(a.x, b.x) * CELL + 2, a.y * CELL + 2, CELL * 2 - 4, CELL - 4);
} else if (dy !== 0) {  // 垂直相邻
  ctx.fillRect(a.x * CELL + 2, Math.min(a.y, b.y) * CELL + 2, CELL - 4, CELL * 2 - 4);
}
```

绘制顺序：先画连接段，再画圆角节（覆盖在上面），确保边缘干净。

#### 圆角节

每节蛇身用 `roundRect` 绘制圆角矩形，头部有特殊处理：

```js
const pad = i === 0 ? 1 : 2;       // 头部 padding 更小，看起来更大
const radius = i === 0 ? 6 : 4;     // 头部圆角更大
```

`roundRect` 内部加了 `r = Math.min(r, w/2, h/2)` 保护，防止圆角半径超过短边一半导致渲染异常。

#### 蛇眼（法向量算法）

利用方向向量的垂直分量计算双眼位置：

```js
const fwd = direction;              // 前进方向
const px = -fwd.y, py = fwd.x;     // 垂直于前进方向的法向量
// 左眼：沿法向量一侧偏移
ctx.arc(ex + px * off, ey + py * off, 2, ...);
// 右眼：沿法向量另一侧偏移
ctx.arc(ex - px * off, ey - py * off, 2, ...);
```

原理：将前进向量 (x, y) 旋转 90° 得到 (-y, x)，这就是垂直于前进方向的法向量。无论蛇朝哪个方向，法向量自然给出左右眼位置，不需要写四个 if-else。

| 方向 | fwd | 法向量 | 左眼偏移 | 右眼偏移 |
|------|-----|--------|----------|----------|
| UP (0,-1) | (0,-1) | (1,0) | 右偏 | 左偏 |
| DOWN (0,1) | (0,1) | (-1,0) | 左偏 | 右偏 |
| LEFT (-1,0) | (-1,0) | (0,-1) | 上偏 | 下偏 |
| RIGHT (1,0) | (1,0) | (0,1) | 下偏 | 上偏 |

### 3.11 食物绘制

#### 普通食物（红色）

- 径向渐变（`createRadialGradient`）产生发光效果
- `sin(frameCount * 0.15)` 驱动脉冲缩放，0.7~1.0 之间呼吸
- 食物实体大小随脉冲变化：`pad = (1 - pulse) * CELL * 0.5 + 2`

#### 金色食物（稀有，15% 概率）

- 更大范围的径向发光（`CELL * 1.2` vs `CELL * pulse`）
- 4 个旋转光点：`frameCount * 0.08` 驱动角速度，每 90° 分布一个
- 实体上绘制 "x3" 文字标识，使用 `textAlign: 'center'` + `textBaseline: 'middle'` 居中

### 3.12 状态机

```
idle ──方向键──→ running ──P键──→ paused
  ↑                │                │
  │                │死亡            │P键
  │                ↓                │
  │              over ←──R键──→ init()
  │                │
  └────R键─────────┘
```

四种状态：`idle`（等待开始）、`running`（游戏中）、`paused`（暂停）、`over`（结束）。

- 任何状态按 R 都会重新 `init()`
- `idle` 和 `over` 状态下按方向键会自动启动游戏（`tryStart()`）
- `init()` 中先 `cancelAnimationFrame(animFrame)` 防止多个循环同时运行

### 3.13 得分弹出动画

```js
function triggerScorePop(pts) {
  scorePop.textContent = `+${pts}`;
  scorePop.classList.remove('pop');
  scoreEl.classList.remove('bump');
  void scorePop.offsetWidth;    // 强制 reflow，重置 CSS 动画
  scorePop.classList.add('pop');
  scoreEl.classList.add('bump');
}
```

`void scorePop.offsetWidth` 是经典技巧：读取元素的布局属性会强制浏览器完成一次 reflow（重排），从而让移除再添加同名 class 的动画能重新播放。

如果不做这一步，连续吃食物时 `+1` 动画只会播放一次，因为浏览器会合并 `remove` 和 `add` 操作。

### 3.14 配置常量一览

| 常量 | 值 | 含义 |
|------|----|------|
| `GRID` | 20 | 网格数 20×20 |
| `BASE_MS` | 150 | 基础帧间隔（毫秒） |
| `SPEED_UP` | 5 | 每吃 N 个食物加速一次 |
| `SPEED_MS` | 8 | 每次加速减少的毫秒数 |
| `GOLDEN_CHANCE` | 0.15 | 金色食物出现概率 15% |

速度计算：`interval = max(50, 150 - (level-1) * 8)`

| 等级 | 累计得分 | 帧间隔 |
|------|----------|--------|
| 1 | 0 | 150ms |
| 2 | 5 | 142ms |
| 3 | 10 | 134ms |
| ... | ... | ... |
| 13 | 60 | 54ms |
| 14 | 65 | 50ms（最快） |
