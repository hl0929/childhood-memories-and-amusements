# 乒乓球 — 技术详解

## 一、整体架构

```
script.js
├── 配置常量        W/H、挡板/球尺寸、WIN_SCORE
├── DOM 引用        canvas、P1/P2 分数面板、模式按钮
├── 状态变量        p1/p2 挡板、ball、score1/score2、trail
├── 模式切换        vsAI 标志 → reset()
├── 初始化          reset() + resetBall()
├── 主循环          loop() → update() + draw()
├── 碰撞处理        上下墙反弹 + 挡板反射
├── AI              限速跟踪球 y 坐标
├── 胜利检测        checkWin()（先到 WIN_SCORE）
└── 输入处理        keys / 分屏触控
```

## 二、关键实现

### 2.1 挡板击球角度反射

```js
// 左挡板碰撞
const rel = (ball.y - (p1.y + p1.h / 2)) / (p1.h / 2);  // -1 ~ +1
const speed = Math.hypot(ball.vx, ball.vy) + 0.2;         // 碰撞加速
ball.vx = Math.abs(speed * Math.cos(rel * 0.7));
ball.vy = speed * Math.sin(rel * 0.7);
```

`rel` 表示球击中挡板的相对位置（-1=底端, 0=中心, +1=顶端）。乘以 0.7 将最大角度限制在约 40°（`0.7 × 90° ≈ 40°`），防止角度过大导致球横穿屏幕。

每次碰撞 `speed + 0.2` 让球逐渐加速，游戏越后期节奏越快。

### 2.2 球轨迹拖尾

```js
trail.push({ x: ball.x, y: ball.y, life: 1 });
if (trail.length > 20) trail.shift();
trail.forEach(t => t.life -= 0.05);
trail = trail.filter(t => t.life > 0);

// 绘制
trail.forEach(t => {
  ctx.globalAlpha = t.life * 0.4;
  ctx.fillStyle = '#00e676';
  ctx.arc(t.x, t.y, BALL_R * t.life, ...);
});
```

保留最近 20 帧球位置，每帧 `life -= 0.05` 衰减，绘制时透明度和半径随 `life` 递减，形成绿色渐隐拖尾效果。

### 2.3 AI 限速跟踪

```js
if (vsAI) {
  const target = ball.y - p2.h / 2;
  const aiSpd = 3.5;
  // 5px 死区：防止微小抖动
  if (p2.y < target - 5) p2.y = Math.min(H - p2.h, p2.y + aiSpd);
  else if (p2.y > target + 5) p2.y = Math.max(0, p2.y - aiSpd);
}
```

AI 直接跟踪球的 y 坐标，但有两个限制：
1. **速度上限 3.5px**：无法瞬间到位，球速快时 AI 会漏球
2. **5px 死区**：目标位置差 < 5 时不动，防止挡板左右抖动

这两个参数让 AI 有挑战性但不过强。

### 2.4 分屏触控

```js
function handleTouches(touches) {
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  for (let i = 0; i < touches.length; i++) {
    const x = (touches[i].clientX - rect.left) / rect.width;  // 0~1
    const y = (touches[i].clientY - rect.top) * scaleY;
    if (x < 0.5) touchP1 = y;   // 左半屏 → 控制左方
    else touchP2 = y;            // 右半屏 → 控制右方
  }
}
```

双人模式下，屏幕左半部分的触点控制左方挡板 y 坐标，右半部分控制右方。支持多点触控，两人在同一设备上各用一只手指操控。

AI 模式下 `touchP2` 被忽略（AI 自动控制右方）。

## 三、配置常量

| 常量 | 值 | 含义 |
|------|----|------|
| `W / H` | 600 / 400 | 画布尺寸 |
| `PAD_W / PAD_H` | 12 / 80 | 挡板宽高 |
| `BALL_R` | 8 | 球半径 |
| `WIN_SCORE` | 7 | 获胜所需分数 |
| AI 速度 | 3.5px | AI 挡板移动速度上限 |
| AI 死区 | 5px | 不响应的偏差范围 |
| 碰撞加速 | 0.2 | 每次碰板球速增量 |
| 轨迹长度 | 20 帧 | 拖尾粒子数量上限 |
