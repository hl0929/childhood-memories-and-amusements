# 坦克大战 — 技术详解

本文档说明 `tank/` 的实现方式、关键数据结构与调参位置。

---

## 一、文件结构

```
tank/
├── index.html   页面结构、HUD、开始/暂停遮罩、移动端按键
├── style.css    战场相框、Q 版按钮、移动端布局
├── script.js    地图、坦克、炮弹、AI、波次、绘制、音效
├── README.md
└── TECHNICAL.md
```

页面加载顺序：

```html
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="../common.css">
...
<script src="../sound.js"></script>
<script src="script.js"></script>
```

`common.css` 提供 Q 版页面外壳、返回按钮、数据卡片和白色相框；`script.js` 只负责游戏本体。

---

## 二、世界坐标

| 常量 | 值 | 说明 |
|------|----|------|
| `TILE` | 40 | 每格像素 |
| `COLS` / `ROWS` | 13 / 13 | 战场格数 |
| `W` / `H` | 520 / 520 | Canvas 逻辑尺寸 |
| `TANK_SIZE` | 30 | 坦克碰撞盒 |
| `BULLET_SIZE` | 7 | 炮弹碰撞盒 |

Canvas 按 `devicePixelRatio`（上限 2）设置实际像素，绘制时统一用逻辑坐标 520×520，CSS 负责等比缩放。

---

## 三、地图

地图使用字符模板：

- `.` 空地
- `B` 砖墙（可破坏）
- `S` 钢墙（不可破坏）
- `X` 基地

```js
const MAP_TEMPLATE = [
  '.............',
  '..BB.....BB..',
  ...
  '.....BXB.....',
];
```

`loadMap()` 把模板转成二维数字数组：

```js
map[r][c] = 0 | 1 | 2 | 3
```

- `1` 砖墙：炮弹命中后变为 `0`
- `2` 钢墙：炮弹命中后只产生火花
- `3` 基地：命中后触发 `gameOver('基地被摧毁')`

基地固定在第 12 行第 6 列，玩家出生在第 11 行第 6 列。

---

## 四、坦克与碰撞

坦克使用轴对齐包围盒（AABB）：

```js
{ x, y, size, dir, speed, isPlayer, alive, ... }
```

移动：

1. 根据方向计算 `nx / ny`
2. `hitsSolid(nx, ny, size)` 检查四个角和中心是否落入砖墙 / 钢墙 / 基地
3. 检查是否与其它坦克重叠
4. 都通过才更新坐标

```js
function tryMove(tank, dx, dy) {
  const nx = tank.x + dx;
  const ny = tank.y + dy;
  if (hitsSolid(nx, ny, tank.size)) return false;
  for (const other of getAllTanks()) {
    if (other === tank || !other.alive) continue;
    if (overlap(nx, ny, tank.size, other.x, other.y, other.size)) return false;
  }
  tank.x = nx;
  tank.y = ny;
  return true;
}
```

玩家使用四方向移动，`inputDir` 由键盘或虚拟方向键设置；敌人通过随机方向池选择方向，撞墙后立即重新决策。

---

## 五、炮弹

炮弹对象：

```js
{ x, y, vx, vy, owner, size }
```

- `owner` 为 `player` / `enemy`
- 速度为 `BULLET_SPEED = 280px/s`
- 每帧移动后依次检查：
  1. 是否越界
  2. 是否命中地图格
  3. 是否命中敌方 / 玩家坦克

命中砖墙会挖出一个格子，命中钢墙只产生火花；命中基地立即结束游戏。

玩家开火有 0.38s 冷却；敌人由 `fireTimer` 控制，间隔 1.1~2.7s。

---

## 六、敌人 AI

每个敌人维护：

- `think`：下一次改变方向的时间
- `fireTimer`：下一次开火时间
- `dir`：当前朝向

每帧：

1. `think -= dt`，归零后从 `['down','down','down','left','right','up']` 随机选方向
2. 尝试移动，失败则把 `think` 置 0，下一帧重新选方向
3. `fireTimer` 归零后开火并重置

这是一个低成本的巡逻型 AI，不寻路，但能持续给玩家压力。

---

## 七、关卡与波次

每关：

```js
enemiesToSpawn = 5 + level * 2;
enemiesLeft = enemiesToSpawn;
maxActive = Math.min(5, 2 + level);
```

- `enemiesToSpawn`：尚未出场的敌人数
- `enemiesLeft`：尚未被击毁的敌人数（HUD 使用）
- `maxActive`：同屏敌人上限
- 敌人从顶部三个出生点刷新，出生点被占用时延迟重试

当 `enemiesLeft === 0 && enemies.length === 0`：

- 未到第 5 关：进入 `levelTransition`，1.8s 后进入下一关
- 第 5 关：`winGame()`

玩家生命为 3，被击中后原地复活并拥有 2s 无敌时间；生命归零则失败。

---

## 八、绘制

绘制顺序：

1. 深梅子色背景 + 网格
2. 地图砖墙 / 钢墙 / 基地
3. 玩家坦克与敌方坦克
4. 炮弹
5. 粒子

坦克绘制使用旋转坐标系：

```js
ctx.translate(cx, cy);
ctx.rotate(angle);
// 履带 → 车身 → 炮塔 → 炮管
```

这样炮管始终指向 `dir`。玩家为薄荷绿，敌人为珊瑚粉 / 薰衣草紫 / 杏色 / 天蓝。

---

## 九、输入与移动端

- 键盘：方向键 / WASD 设置 `inputDir`；空格设置 `firing`；P 暂停；R 重开
- 虚拟方向键：`pointerdown` 设置 `inputDir`，`pointerup / pointercancel / pointerleave` 清除
- 开火键：按住持续开火，松开停止
- 移动端工具栏提供暂停 / 重开

手机布局：

- 战场宽度受 `100dvh` 约束，保证方向键不被挤出视口
- 方向键与开火键使用白色糖果按钮，开火键为蓝色渐变圆形
- 小屏（≤480px）进一步缩小按键与 HUD

---

## 十、音效与持久化

复用根目录 `sound.js` 预设：

| 场景 | 音效 |
|------|------|
| 开火 | `shoot` |
| 砖墙命中 | `hit` |
| 钢墙反弹 | `bounce` |
| 击毁坦克 / 基地 | `explode` |
| 玩家受伤 | `damage` |
| 过关 | `levelup` |
| 开始 | `start` |
| 暂停 | `click` |
| 失败 / 通关 | `gameover` / `win` |

最高分写入 `localStorage` 的 `tank_high`。

---

## 十一、调参位置

| 参数 | 位置 | 作用 |
|------|------|------|
| `TILE` / `COLS` / `ROWS` | 文件顶部 | 战场尺寸 |
| `PLAYER_SPEED` | 文件顶部 | 玩家移动速度 |
| `ENEMY_SPEED` | 文件顶部 | 敌人基础速度 |
| `BULLET_SPEED` | 文件顶部 | 炮弹速度 |
| `MAX_LEVEL` | 文件顶部 | 总关卡数 |
| `enemiesToSpawn = 5 + level * 2` | `initLevel` | 每关敌人数量 |
| `maxActive` | `initLevel` | 同屏敌人上限 |
| `spawnTimer` | `updateSpawning` | 刷怪间隔 |
| `player.cooldown` | `shoot` | 玩家射速 |
| `e.fireTimer` | `updateEnemies` | 敌人射速 |
