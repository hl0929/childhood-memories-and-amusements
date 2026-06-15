# 飞机大战 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        W/H、战机/子弹/敌机尺寸、LIVES_MAX
├── DOM 引用        canvas、score/high/lives/wave 面板、overlay
├── 粒子系统        spawnParticles / updateParticles / drawParticles
├── 初始化          init()
├── 主循环          loop() → update() + draw()
├── 碰撞检测        rectCollide()
├── 波次升级        score >= wave * 200 → wave++
└── 输入处理        keys 对象 / touchstart+touchmove
```

## 二、关键实现

### 2.1 触屏拖拽控制 + 坐标缩放

```js
function movePlayerToTouch(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const touch = e.touches[0];
  const mx = (touch.clientX - rect.left) * scaleX;
  const my = (touch.clientY - rect.top) * scaleX;
  player.x = Math.max(0, Math.min(W - player.w, mx - player.w / 2));
  player.y = Math.max(0, Math.min(H - player.h, my - player.h - 30));
}
```

Canvas 在响应式布局下 CSS 显示尺寸可能 ≠ 逻辑尺寸（如 CSS 宽度 300px 但 canvas.width=420）。`scaleX = W / rect.width` 将屏幕坐标映射回游戏逻辑坐标，确保触屏位置准确对应画布位置。

玩家位置偏移 30px（`my - player.h - 30`），防止手指遮挡战机。

### 2.2 波次递进与难度曲线

```js
// 敌机生成间隔随波次缩短
spawnInterval = Math.max(15, 60 - wave * 5);

// 敌机速度随波次提升
const espd = 1.5 + wave * 0.3 + Math.random() * 1.5;

// 波次 3+ 出现 2HP 敌机
const hp = wave >= 3 ? (Math.random() < 0.3 ? 2 : 1) : 1;

// 波次升级条件
if (score >= wave * 200) { wave++; ... }
```

波次系统通过三个维度递增难度：
1. **生成频率**：60 → 15 帧，间隔越来越短
2. **飞行速度**：每波 +0.3 基础速度 + 随机增量
3. **血量**：3 波以上有概率出现 2HP 敌机

### 2.3 自动射击 + 冷却

```js
shootCooldown--;
if ((keys[' '] || touchActive) && shootCooldown <= 0) {
  bullets.push({ x: ..., y: ..., vy: -8 });
  shootCooldown = 8;
}
```

空格键或触屏时持续自动射击，8 帧冷却（约 133ms @60fps），避免子弹过密影响性能。触屏时 `touchActive=true` 确保移动端自动开火。

### 2.4 碰撞检测（矩形 AABB）

```js
function rectCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
```

标准 AABB 矩形碰撞检测。子弹-敌机和敌机-玩家共用同一函数，一次遍历检查所有组合。

### 2.5 星空背景滚动

```js
const sy = ((i * 97.3 + Date.now() * 0.02) % (H + 10)) - 5;
```

30 个星点用 `Date.now() * 0.02` 做时间偏移，模拟向下流动的星空效果。暂停时停止偏移（`running && !paused` 条件）。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `W / H` | 420 / 600 | 画布尺寸 |
| `PLAYER_W/H` | 36 / 40 | 战机宽高 |
| `BULLET_W/H` | 4 / 12 | 子弹宽高 |
| `ENEMY_W/H` | 30 / 30 | 敌机宽高 |
| `LIVES_MAX` | 3 | 初始生命数 |
| 波次升级 | 200 分 | 每波升级所需分数 |
| 初始生成间隔 | 60 帧 | 敌机出现间隔 |
| 射击冷却 | 8 帧 | 子弹发射间隔 |
