# 怪兽塔防 — 技术详解

本文档说明 `monster/` 的路径塔防实现、数据结构、关卡生成与调参位置。

---

## 一、文件结构

```
monster/
├── index.html   页面结构、HUD、武器卡片、升级面板、覆盖层
├── style.css    战场相框、武器卡片、浮动升级面板、移动端布局
├── script.js    地图、路径、武器、怪兽、波次、投射物、绘制、音效
├── README.md
└── TECHNICAL.md
```

加载顺序：

```html
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="../common.css">
...
<script src="../sound.js"></script>
<script src="script.js"></script>
```

---

## 二、世界坐标

| 常量 | 值 | 说明 |
|------|----|------|
| `COLS` / `ROWS` | 10 / 8 | 网格列 / 行 |
| `CELL` | 60 | 每格像素 |
| `W` / `H` | 600 / 480 | Canvas 逻辑尺寸 |
| `MAX_LEVEL` | 10 | 总关卡数 |
| `MAX_LIVES` | 20 | 初始生命 |
| `START_COINS` | 120 | 初始金币 |

Canvas 按 `devicePixelRatio`（上限 2）设置实际像素，绘制统一使用 600×480 逻辑坐标，CSS 等比缩放。

---

## 三、关卡路线生成

10 个关卡由 `LEVEL_PATHS` 定义，每个关卡是一组 `[行, 列]` 拐点：

```js
const LEVEL_PATHS = [
  [[1, 0], [1, 9]],
  [[1, 0], [1, 6], [4, 6], [4, 9]],
  ...
];
```

`makePath(points)` 沿水平和垂直方向逐格填充，得到完整路径单元数组：

```js
path = makePath(LEVEL_PATHS[level - 1]);
totalPathLength = (path.length - 1) * CELL;
```

- 第一个格子是左侧传送门
- 最后一个格子是右侧城堡
- 怪兽沿路径单元中心逐格移动

### 建造位生成

`makeSlots(cells)`：

1. 收集所有路径格上下左右相邻的非路径格
2. 排除传送门 / 城堡本身
3. 按路径进度排序
4. 去重后均匀采样，最多生成 14 个建造位

```js
slots = makeSlots(path);
```

这样 10 张路线图会自动得到分布均匀的建造位置，不需要手写每个关卡的建造位。

---

## 四、怪兽系统

怪兽定义在 `MONSTERS`：

```js
slime:    { hp: 45,  speed: 42, armor: 0, reward: 8,   leak: 1,  slowResist: 0 }
bat:      { hp: 32,  speed: 78, armor: 0, reward: 7,   leak: 1,  slowResist: 0 }
skeleton: { hp: 95,  speed: 38, armor: 1, reward: 12,  leak: 2,  slowResist: 0 }
ghost:    { hp: 85,  speed: 52, armor: 0, reward: 14,  leak: 2,  slowResist: 0.5 }
ogre:     { hp: 260, speed: 24, armor: 3, reward: 30,  leak: 4,  slowResist: 0.2 }
dragon:   { hp: 900, speed: 20, armor: 5, reward: 120, leak: 10, slowResist: 0.4 }
```

每个怪兽实例维护：

```js
{
  type, hp, maxHp, dist, speed, armor, reward, leak, size,
  slowTime, slowFactor, poisonTime, poisonDps, dead, x, y
}
```

### 移动

- `dist` 表示沿路径前进的像素距离
- `pathPos(dist)` 在路径单元之间线性插值，得到 `x / y`
- 减速状态：`speed * (1 - slowFactor * (1 - slowResist))`
- 到达路径终点：扣除 `leak` 点生命并移除

### 伤害

`damageMonster(monster, amount, ignoreArmor)`：

```js
const actual = ignoreArmor ? amount : Math.max(1, amount - monster.armor);
```

- 普通伤害会减去护甲值，最少造成 1 点
- 毒伤使用 `ignoreArmor = true`
- 生命 ≤ 0 时 `killMonster()`：加金币、加击杀、粒子、浮动金币、音效

---

## 五、武器系统

5 类武器定义在 `TOWERS`，每类 3 级：

```js
arrow: {
  cost: 40,
  kind: 'projectile',
  levels: [
    { damage: 14, range: 125, rate: 0.6, upgradeCost: 35 },
    { damage: 24, range: 140, rate: 0.5, upgradeCost: 60 },
    { damage: 38, range: 155, rate: 0.42 },
  ],
}
```

- `kind`：`projectile` / `splash` / `chain`
- `range`：以像素为单位的索敌半径
- `rate`：每秒攻击次数，冷却 = `1 / rate`
- `upgradeCost`：当前等级升到下一级的花费

武器对象：

```js
{
  type, level, r, c, x, y, cooldown, invested
}
```

- `invested` 记录总投入，出售返还 60%
- 点击武器显示浮动面板，可升级 / 出售
- 升级后等级 +1、属性读取下一级、投入累加
- 满级后升级按钮禁用

### 索敌与开火

`findTarget(tower, range)`：

- 只选择范围内、未死亡的怪兽
- 选择 `dist` 最大（最靠近城堡）的目标

`fireTower`：

- **箭塔 / 冰塔 / 毒塔**：生成追踪投射物
- **炮塔**：生成炮弹，命中后对目标点周围 `splash` 半径内所有怪兽造成伤害
- **电塔**：瞬间连锁，最多 `chains` 个目标，绘制闪电特效

投射物统一对象：

```js
{
  type, x, y, tx, ty, target, speed, damage,
  splash, slow, slowTime, poison, poisonTime
}
```

投射物每帧向目标当前位置移动，命中后结算。

---

## 六、10 关波次

`LEVEL_WAVES` 定义每关的波次：

```js
LEVEL_WAVES[0] = [
  [['slime', 5]],
  [['slime', 8]],
];
```

每一波由若干 `[怪兽类型, 数量]` 组成。

`startWave(groups)`：

1. 按顺序把怪兽写入 `spawnQueue`
2. 每只怪兽间隔 0.65s 出场
3. `waveIndex++`，下一波倒计时 13s
4. 播放 `levelup` 音效

关卡结束条件：

```js
waveIndex >= 本关波数
&& spawnQueue.length === 0
&& monsters.length === 0
```

---

## 七、关卡流程

### 开始 / 重试

- `startCampaign()`：从第 1 关开始，金币 120、生命 20、击杀 0
- `retryLevel()`：回到本关开始时的金币 / 生命 / 击杀快照
- `beginLevel()`：记录快照、重置武器 / 怪兽 / 波次、开始运行

### 过关

```js
bonus = 30 + level * 10
coins += bonus
lives = Math.min(MAX_LIVES, lives + 5)
```

- 显示过关覆盖层 2.2s
- 自动进入下一关，武器重置、金币和生命保留
- 第 10 关完成 → `winCampaign()`

### 失败

- 生命 ≤ 0 → `gameOver()`
- 覆盖层点击 / 空格 → 重试本关
- `R` 键重新开始整个 10 关战役

---

## 八、绘制

绘制顺序：

1. 浅绿草地棋盘 + 白色网格
2. 米色路径 + 白色虚线中心线
3. 建造位（白色虚线圆 + 加号）
4. 传送门 🌀 / 城堡 🏰
5. 武器（圆形底座 + Emoji + 等级圆点 + 选中射程圈）
6. 怪兽（Emoji + 血条 + 减速 / 中毒光环）
7. 投射物
8. 爆炸 / 闪电 / 浮动金币 / 粒子
9. 建造预览

所有 Emoji 使用系统字体：

```js
ctx.font = '32px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
```

---

## 九、输入与 UI

- 点击武器卡片选择建造类型
- 点击空建造位建造
- 点击已建武器打开浮动面板
- 浮动面板按钮：升级 / 出售
- 点击空白区域关闭面板
- 数字键 1~5 快速选择武器
- P 暂停，R 重开
- 暂停 / 过关 / 结束时会隐藏浮动面板
- 手机触屏使用 `pointerdown`，建造位点击半径 28 逻辑像素

坐标换算：

```js
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}
```

---

## 十、音效与调参

复用根目录 `sound.js`：

| 场景 | 音效 |
|------|------|
| 选择武器 / 出售 / 暂停 | `click` |
| 建造 | `place` |
| 金币不足 | `invalid` |
| 开火 | `shoot` |
| 命中 | `hit` |
| 炮塔爆炸 | `explode` |
| 升级 / 新波次 | `levelup` |
| 漏怪 | `damage` |
| 失败 / 通关 | `gameover` / `win` |

调参位置：

| 参数 | 位置 |
|------|------|
| 地图尺寸 / 关卡数 | 文件顶部常量 |
| 武器造价 / 伤害 / 射程 / 升级价 | `TOWERS` |
| 怪兽生命 / 速度 / 护甲 / 奖励 | `MONSTERS` |
| 10 关路线 | `LEVEL_PATHS` |
| 10 关波次组合 | `LEVEL_WAVES` |
| 建造位数量 | `makeSlots` 的 `maxSlots` |
| 波次间隔 | `updateWaves` 中的 `waveTimer = 13` |
| 首波延迟 | `initLevelState` 中的 `waveTimer = 6` |
| 过关奖励 / 回血 | `clearLevel` |
| 出售返还比例 | `refundOf` |
