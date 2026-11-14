# 花园保卫战 — 技术详解

本文档说明 `garden/` 的植物塔防实现、核心数据结构与调参位置。

---

## 一、文件结构

```
garden/
├── index.html   页面结构、HUD、植物卡片、开始/暂停遮罩
├── style.css    草坪相框、植物卡片、Q 版移动端布局
├── script.js    植物 / 僵尸 / 阳光 / 豌豆 / 波次 / 绘制
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

`common.css` 提供统一页面外壳和 Q 版主题，`script.js` 只负责游戏本体。

---

## 二、世界坐标

| 常量 | 值 | 说明 |
|------|----|------|
| `COLS` / `ROWS` | 9 / 5 | 草坪列 / 行 |
| `CELL` | 100 | 每格像素 |
| `W` / `H` | 900 / 500 | Canvas 逻辑尺寸 |
| `TOTAL_WAVES` | 8 | 总波数 |
| `START_SUN` | 150 | 初始阳光 |

Canvas 按 `devicePixelRatio`（上限 2）设置实际像素，绘制统一使用 900×500 逻辑坐标，CSS 等比缩放。

---

## 三、植物网格

植物存放在二维数组：

```js
plants[r][c] = plant | null
```

每个植物对象：

```js
{
  type: 'sunflower' | 'peashooter' | 'wallnut' | 'snowpea' | 'cherry',
  x, y,            // 格子中心
  hp, maxHp,
  timer,           // 生产 / 射击计时
  fuse             // 樱桃炸弹倒计时
}
```

种植流程：

1. 点击植物卡片设置 `selectedPlant`
2. 点击草坪计算格子 `cellAt(x, y)`
3. 检查格子为空、阳光足够
4. 扣除阳光，写入 `plants[r][c]`
5. 播放种植音效并刷新卡片状态

铲子模式（`shovelMode`）下点击植物会直接移除。

---

## 四、阳光经济

阳光来源：

1. 天空阳光：每 5.5s 随机位置掉落，停留 12s
2. 向日葵：每 7.5s 在自身位置产出一颗
3. 击杀僵尸：额外 +5 阳光

阳光对象：

```js
{ x, y, vy, stopY, life, value }
```

点击命中半径 48 逻辑像素，收集后加 `value`、播放 `gold` 音效并刷新卡片可用状态。

---

## 五、僵尸

僵尸对象：

```js
{
  type, row, x, y,
  hp, maxHp, speed, dps,
  slow
}
```

更新逻辑：

1. 按 `x` 计算当前格子
2. 如果该格有植物：停在植物右侧，按 `dps` 持续啃食
3. 否则按 `speed` 向左移动（减速状态 ×0.5）
4. `x < 42` 时触发该行小推车
5. 小推车已用完且 `x < 0` 时失败

僵尸类型由 `ZOMBIES` 表定义，`hat` 字段用于绘制路障 / 铁桶 / 红色头带。

---

## 六、攻击与减速

豌豆：

```js
{ x, y, row, speed, damage, slow }
```

- 豌豆射手：伤害 22，间隔 1.2s
- 寒冰射手：伤害 18，间隔 1.35s，命中后 `z.slow = 3.2`
- 命中判定：同一行且 `x` 距离小于 26

樱桃炸弹：

- 种植后 `fuse = 0.9s`
- 爆炸时对行差 ≤ 1、列差 ≤ 1 的僵尸造成致命伤害
- 播放 `explode` 音效和粒子

---

## 七、波次

```js
const WAVES = [
  ['basic'],
  ['basic', 'basic'],
  ['basic', 'cone'],
  ...
];
```

- 第一波在 15s 后开始，之后每 18s 一波
- 每波把僵尸类型加入 `spawnQueue`
- `spawnQueue` 中每只僵尸有 `delay`，按顺序从右侧随机行进场
- `wave` 记录已经开始的波数
- 当 `wave >= TOTAL_WAVES && spawnQueue 为空 && zombies 为空` 时胜利

失败条件：某行小推车已用掉，僵尸走到 `x < 0`。

---

## 八、小推车

每行一辆，`mowers[row] = { used: false }`。

僵尸进入最左侧时：

- 如果该行小推车未使用：标记 `used`，清除该行全部僵尸，播放爆炸音效
- 如果已使用：继续向左，越过房子则失败

小推车是最后一道保险，鼓励玩家不要放弃某一行。

---

## 九、绘制

绘制顺序：

1. 浅绿色棋盘草坪 + 白色格子线 + 左侧栅栏
2. 小推车
3. 植物（Emoji + 阴影 + 血条）
4. 僵尸（Emoji + 路障 / 铁桶 / 头带 + 血条 + 减速圈）
5. 豌豆
6. 阳光
7. 粒子
8. 鼠标悬停 / 种植预览

所有 Emoji 使用系统字体：

```js
ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
```

---

## 十、输入

- 植物卡片：点击选择 / 取消，阳光不足时禁用
- 铲子：点击切换，再点击植物移除
- 草坪：`pointerdown` 转换坐标后种植或收集阳光
- 键盘：数字 1~5 选植物，P 暂停，R 重开，X 切铲子
- 暂停 / 重开按钮同时适配桌面与手机

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

## 十一、音效与持久化

复用根目录 `sound.js`：

| 场景 | 音效 |
|------|------|
| 选择卡片 / 铲子 | `click` |
| 种植 | `place` |
| 阳光不足 / 格子占用 | `invalid` |
| 收集阳光 | `gold` |
| 发射豌豆 | `shoot` |
| 僵尸受伤 | `hit` |
| 樱桃 / 小推车 | `explode` |
| 开始 / 波次 | `start` / `levelup` |
| 失败 / 胜利 | `gameover` / `win` |

最高分写入 `localStorage` 的 `garden_high`。

---

## 十二、调参位置

| 参数 | 位置 | 作用 |
|------|------|------|
| `COLS` / `ROWS` / `CELL` | 文件顶部 | 草坪尺寸 |
| `TOTAL_WAVES` | 文件顶部 | 总波数 |
| `START_SUN` | 文件顶部 | 初始阳光 |
| `PLANTS` | 文件顶部 | 植物价格 / 血量 / 冷却 |
| `ZOMBIES` | 文件顶部 | 僵尸血量 / 速度 / 伤害 / 分数 |
| `WAVES` | 文件顶部 | 每波僵尸组合 |
| `waveTimer = 15` | `resetState` | 第一波延迟 |
| `waveTimer = 18` | `startNextWave` | 波次间隔 |
| `sunTimer = 5.5` | `update` | 天空阳光间隔 |
| `p.timer = 7.5` | `updatePlants` | 向日葵产阳光间隔 |
| `z.dps` | `ZOMBIES` | 僵尸啃食速度 |
