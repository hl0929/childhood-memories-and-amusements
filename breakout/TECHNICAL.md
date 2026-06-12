# 打砖块 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        W/H、挡板/球尺寸、砖块行列数、生命数
├── DOM 引用        canvas、得分面板、覆盖层
├── 粒子系统        spawnParticles / updateParticles / drawParticles
├── 砖块生成        buildBricks()
├── 初始化          init() / resetBall()
├── 主循环          loop() → update() + draw()
├── 碰撞检测        墙 / 挡板 / 砖块
└── 输入处理        键盘 / 鼠标 / 触摸
```

## 二、关键实现

### 2.1 挡板击球角度

```js
const rel = (ball.x - (pad.x + pad.w/2)) / (pad.w/2);  // -1 ~ +1
const speed = Math.hypot(ball.vx, ball.vy);              // 保持速度不变
ball.vx = rel * speed;
ball.vy = -Math.sqrt(speed*speed - ball.vx*ball.vx);
```

击球位置越靠挡板边缘，水平速度越大、垂直速度越小，轨迹越平；击打中心则近乎垂直反弹。`Math.hypot` 保证每次反弹后球速大小不变。

### 2.2 砖块碰撞方向判断（最小重叠法）

```js
const overlapL = ball.x + BALL_R - b.x;
const overlapR = b.x + b.w - (ball.x - BALL_R);
const overlapT = ball.y + BALL_R - b.y;
const overlapB = b.y + b.h - (ball.y - BALL_R);
const minH = Math.min(overlapL, overlapR);
const minV = Math.min(overlapT, overlapB);
if (minH < minV) ball.vx = -ball.vx;   // 从左右侧穿入
else             ball.vy = -ball.vy;   // 从上下侧穿入
```

取四个方向的穿透深度，最小的那个方向就是球进入砖块的方向，对应速度分量取反。比判断球心在砖块哪侧更鲁棒，避免高速时球穿透砖块角落反向错误。

### 2.3 双血量砖块

```js
const hp = level > 2 && r === 0 ? 2 : 1;
bricks.push({ ..., hp, maxHp: hp, alive: true });
```

关卡 3 起，第一排砖块 `hp=2`，每次碰撞 `hp--`，归零才标记 `alive=false`。绘制时：

```js
ctx.globalAlpha = 0.4 + (b.hp / b.maxHp) * 0.6;
```

血量满时不透明度 1.0，半血时 0.7，视觉上砖块变暗提示已受损。

### 2.4 关卡进阶与球速

```js
const spd = 4 + (level - 1) * 0.4;   // 每关加 0.4
ball = { ..., vx: spd * (random > 0.5 ? 1 : -1), vy: -spd };
```

清空砖块时 `level++`，调用 `resetBall()` 以新速度重置球。随关卡越来越快，增加难度。

### 2.5 粒子系统

砖块被摧毁时：
```js
spawnParticles(ball.x, ball.y, b.color, 8);
```

粒子使用随机角度 + 随机速度向四周散开，`vy += 0.08` 模拟重力下坠，`life -= 0.03` 衰减，`globalAlpha = p.life` 渐隐。

### 2.6 状态机

```
running=false ──空格/点击──→ init()
running=true ──P──→ paused
paused ──P──→ running
running ──命归零──→ 游戏结束 overlay
running ──砖块清空──→ 下一关（level++）
```

`launched` 标志区分"球跟随挡板待发"和"球已飞出"两个子状态，游戏结束后按 R 或空格重新 `init()`。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `W / H` | 480 / 520 | 画布尺寸 |
| `PAD_W / PAD_H` | 80 / 10 | 挡板宽高 |
| `BALL_R` | 7 | 球半径 |
| `BRICK_ROWS / COLS` | 5 / 10 | 砖块行列数 |
| `LIVES_MAX` | 3 | 初始生命数 |
