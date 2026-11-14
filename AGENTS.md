# AGENTS.md — 项目约定与页面布局规范

本文档记录本仓库的共享资源、页面布局方案和修改约定，供后续开发者 / AI Agent 修改代码时遵循。

---

## 1. 项目结构

- 纯原生 HTML5 + CSS3 + JavaScript，无构建步骤、无外部依赖
- 18 个游戏，每个游戏目录包含：
  - `index.html`
  - `style.css`
  - `script.js`
  - `README.md`
  - `TECHNICAL.md`
- 根目录共享资源：
  - [`sound.js`](sound.js)：Web Audio 合成音效，并自动注入右上角静音按钮
  - [`common.css`](common.css)：全站布局基础层
  - `index.html`：游戏合集主页
  - `README.md`：项目总说明

---

## 2. 共享文件加载顺序（不可随意调整）

每个游戏页面必须按以下顺序引入：

```html
<head>
  ...
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="../common.css">
</head>
<body>
  ...
  <script src="../sound.js"></script>
  <script src="script.js"></script>
</body>
```

原因：

1. `common.css` 必须在 `style.css` **之后**，作为最终布局覆盖层。
2. `sound.js` 必须在 `script.js` 之前，保证 `SFX` 已定义。
3. `sound.js` 依赖 `../` 相对路径，任意游戏目录（包括 `file://` 直接打开）都能加载根目录资源。

---

## 3. 布局架构

### 3.1 总体思路

`common.css` 负责跨游戏统一的「页面外壳」，各游戏自己的 `style.css` 只负责主题色、棋盘、画布和专属组件。

```
body（100dvh，弹性布局，统一安全区 padding）
└── .container（宽度受限，垂直 auto margin 居中）
    ├── .back（fixed 左上角浮动返回）
    ├── h1
    ├── .game-info / .score-board
    ├── 棋盘 / 画布
    └── 操作提示 / 按钮
```

音效按钮由 `sound.js` 自动注入为 `#sfx-toggle`，固定在右上角，和返回按钮形成统一顶栏。

### 3.2 body 布局

```css
body {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding:
    calc(env(safe-area-inset-top, 0px) + 54px)
    max(var(--page-pad), env(safe-area-inset-right, 0px))
    calc(env(safe-area-inset-bottom, 0px) + 16px)
    max(var(--page-pad), env(safe-area-inset-left, 0px));
  overflow-x: hidden;
  overflow-y: auto;
}
```

关键点：

- **不要用 `align-items: center` 做垂直居中**：内容高于视口时，顶部会被裁切且无法滚动到。
- 使用 `align-items: flex-start` + 容器 `margin-block: auto`：
  - 内容较少时，上下 auto margin 自动均分空间，实现垂直居中；
  - 内容超高时，auto margin 变为 0，页面从顶部开始正常滚动。
- 顶部预留 54px 给固定的返回 / 音效按钮；底部预留 16px。
- 手机（≤480px）顶部 50px、底部 10px；矮屏（高度 ≤ 620px）顶部 44px、底部 4px。
- 使用 `env(safe-area-inset-*)` 适配刘海屏和底部指示条。

### 3.3 container

```css
.container {
  margin-block: auto;
  padding: 0;
  gap: var(--page-gap);
  width: 100%;
}
```

- 各游戏自己的 `.container` 可保留 `max-width`，但 **padding 统一由 body 负责**。
- `--page-gap: clamp(10px, 1.4vh, 16px)`；窄屏固定为 10px。
- 如果某个游戏需要自定义间距，应修改 `common.css` 的变量，或在游戏 CSS 中使用更高优先级选择器（不推荐用 `!important`）。

### 3.4 返回按钮

`.back` 统一由 `common.css` 控制：

- `position: fixed`，左上角
- 半透明胶囊 + `backdrop-filter` 毛玻璃
- 最小高度 34px，适配触摸
- 所有游戏（当前 18 个）都必须提供：

```html
<a class="back" href="../index.html">← 返回</a>
```

贪吃蛇原先没有返回按钮，已补齐。

### 3.5 音效按钮

由 `sound.js` 注入，不需要在 HTML 中手写。样式为右上角 38×38 圆形按钮：

- 点击切换静音，`M` 键也可切换
- 静音状态写入 `localStorage`，全站共享
- `z-index: 9999`，高于返回按钮（9998）和游戏弹窗

---

## 4. 响应式断点与测试尺寸

### 4.1 主要断点

| 断点 | 用途 |
|------|------|
| `max-width: 768px` | 平板：紧凑间距、缩小统计卡片 |
| `max-width: 520px` | 俄罗斯方块切换为「棋盘 + 底部状态栏 + 虚拟按键」 |
| `max-width: 480px` | 手机：更紧凑的字体、棋盘与按钮 |
| `max-height: 620px` | 矮屏：压缩页面顶部 / 底部安全区 |
| `pointer: coarse` | 触屏：增大按钮最小高度 |

### 4.2 必须回归的尺寸

修改布局后至少检查以下视口：

- 桌面：`1280×900`
- 常见笔记本：`1366×768`、`1024×768`
- 平板：`768×1024`
- 手机：`390×844`
- 小屏手机：`320×568`
- 横屏：`844×390`（允许纵向滚动，但不能横向溢出）

检查标准：

- `document.documentElement.scrollWidth <= window.innerWidth`
- 常见竖屏尺寸下页面完整显示（允许极少数小屏轻微纵向滚动）
- 返回 / 音效按钮不遮挡标题和主要操作
- 弹窗在 320px 宽度下不溢出

---

## 5. 尺寸策略

### 5.1 画布类游戏

画布游戏统一使用「外层容器限制尺寸，canvas 宽度 100%」：

```css
.canvas-wrapper {
  width: 100%;
  max-width: 520px;
}
.canvas-wrapper canvas {
  display: block;
  width: 100% !important;
  height: auto !important;
}
```

需要同时限制宽高的画布，用 `@supports (height: 100dvh)` + 百分比高度约束：

- **打砖块**：`max-width: min(520px, max(300px, calc(92.3dvh - 249px)))`
- **飞机大战**：`max-width: min(420px, max(220px, calc(70dvh - 161px)))`
- **五子棋**：`max-width: min(500px, max(300px, calc(100dvh - 320px)))`
- **坦克大战**：方形战场，`max-width: min(520px, max(238px, calc(100dvh - 310px)))`
- **花园保卫战**：9:5 宽画布，`max-width: min(820px, max(520px, calc((100dvh - 340px) * 1.8)))`
- **怪兽塔防**：10:8 宽画布，`max-width: min(600px, max(300px, calc((100dvh - 340px) * 1.25)))`

注意事项：

- 画布内部逻辑分辨率由 JS 设置，CSS 只负责缩放显示；修改 JS 尺寸时同步检查 CSS 上限。
- 使用 `dvh` 而不是 `vh`，避免移动端浏览器地址栏收起/展开造成跳动。
- 为不支持 `dvh` 的浏览器保留不带 `@supports` 的普通 `max-width` 回退。

### 5.2 DOM 棋盘类游戏

优先使用 `clamp()` / `min()` 根据视口计算格子尺寸，而不是写死像素：

- **2048**：`width: min(420px, 100vw - 40px, max(260px, 100dvh - 250px))`
- **消消乐**：`width: min(100%, 460px)`
- **翻牌记忆**：`width: min(100%, 520px)`，并按 `100dvh` 回缩
- **黑白棋**：`--cell: clamp(30px, (min(100vw, 600px) - 64px) / 8, 48px)`
- **数独**：`--cell-size: clamp(28px, (min(100vw, 600px) - 56px) / 9, 48px)`
- **推箱子**：格子 `clamp(28px, (100vw - 80px) / var(--cols), 48px)`
- **连连看**：棋盘容器 `width: 100%; max-width: 560px`，格子由 JS 设置 8 列 `1fr`
- **扫雷**：格子 `clamp(18px, (min(100vw, 800px) - 72px) / var(--cols), 44px)`

### 5.3 扫雷高级难度

30 列棋盘在手机上无法以可点击尺寸完整放下，因此：

- `.board` 设置 `max-width: 100%`、`overflow: auto`、`overscroll-behavior-x: contain`
- 手机端在棋盘内横向滑动查看
- 操作提示中明确写出「高级难度可横向滑动」

### 5.4 数独数字键盘

数字键盘使用 9 列等宽网格，避免在 320px 屏幕上换行成 8+1：

```css
.numpad {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  width: min(100%, 400px);
  gap: 6px;
}
.numpad button {
  width: 100%;
  height: clamp(34px, 8.5vw, 42px);
}
```

### 5.5 俄罗斯方块

俄罗斯方块同时涉及 CSS 与 JS 尺寸，必须两边一起改：

- JS `calcBlockSize()`：
  - `window.innerWidth <= 520` 视为手机，侧栏折到棋盘下方
  - 桌面预留侧栏宽度，手机使用全宽减去 padding
  - 高度预留状态栏 + 虚拟按键
  - 方块尺寸限制在 `14 ~ 30px`
- 手机端棋盘约 `260×520`（390×844），小屏 `140×280`（320×568）
- 监听 `resize` 事件，150ms 防抖后重算 `BLOCK`、重设 canvas 尺寸并重绘
- 旋转屏幕后不应重置游戏进度

### 5.6 贪吃蛇

- 画布最大 420px
- 触屏设备按 `pointer: coarse` 或 `innerWidth <= 480` 判定，预留虚拟方向键高度
- 使用 `calcCanvasSize()` 同时约束宽高，避免方向键被挤出视口

---

## 6. 修改布局时的规则

1. **全局布局改动优先改 `common.css`**：body、container、返回按钮、统一间距、弹窗宽度等。
2. **游戏专属尺寸改各自 `style.css`**：棋盘、画布、格子大小、侧栏等。
3. 注意 `common.css` 在 `style.css` 之后加载：
   - 同优先级选择器以 `common.css` 为准；
   - 修改 `.container`、`.back`、`body`、`.controls`、`.msg-box` 等共享选择器时，要意识到游戏 CSS 中的同名规则会被覆盖；
   - 不建议用 `!important` 对抗，优先改 `common.css` 或提高选择器优先级。
4. **不要给内容容器写固定高度**，用 `min-height`、`dvh`、`clamp()` 保持自适应。
5. **新增游戏必须**：
   - 引入 `style.css` → `../common.css`
   - 引入 `../sound.js` → `script.js`
   - 添加 `.back` 返回链接
   - 按 320 / 390 / 768 / 1280 宽度自测
6. **新增画布游戏**：同时检查 canvas 内部尺寸（JS）与 CSS 最大宽高，避免缩放模糊或溢出。
7. **新增 DOM 棋盘游戏**：格子尺寸用 CSS 变量 + `clamp()`，并把列数写入 `--cols`，方便响应式计算。
8. **文档同步**：布局相关改动更新根 `README.md` 的「页面布局」一节；如涉及具体游戏，更新该游戏的 README / TECHNICAL。

---

## 7. 测试命令

启动本地服务器：

```bash
python3 -m http.server 8765
# 浏览器访问 http://127.0.0.1:8765/
```

JavaScript 语法检查：

```bash
for f in sound.js */script.js; do node --check "$f" || echo "FAIL $f"; done
```

布局快速检查（浏览器控制台）：

```js
// 不应出现横向溢出
document.documentElement.scrollWidth <= window.innerWidth

// 查看页面是否需要在竖屏滚动
({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight,
   vw: innerWidth, vh: innerHeight })
```

建议同时用无头浏览器截图检查：桌面 `1280×900`、平板 `768×1024`、手机 `390×844`、小屏 `320×568`。

---

## 8. 当前布局状态（最近一次优化）

- 新增 `common.css`，统一全部游戏的外壳布局（当前 18 个）
- 所有游戏补齐 / 统一返回按钮位置
- 棋盘类游戏普遍增大尺寸并支持按视口高度回缩
- 扫雷支持高级难度横向滑动
- 数独数字键盘改为 9 列网格
- 俄罗斯方块支持手机端大棋盘、底部状态栏和旋转重算
- 已通过全部游戏加载、交互、音效触发与多尺寸截图检查

---

## 9. 视觉风格：Q 版糖果风

### 9.1 设计基调

全站统一为明亮、圆润、低饱和的 Q 版糖果风：

- 页面背景：奶油白 + 粉蓝 + 淡紫的多层径向渐变
- 容器：白色半透明「贴纸」卡片，圆角 18~26px
- 描边：2~4px 白色粗边框，形成贴纸感
- 投影：短距离实色投影 + 远距离柔和投影；页面外壳不使用霓虹发光，深色画布内部可保留游戏光效
- 字体：标题可使用 `Arial Rounded MT Bold` / `PingFang SC`，正文保持系统中文字体
- 图标：优先使用 Emoji，不引入图标库或图片资源

### 9.2 主题变量

`common.css` 中的全局视觉变量：

```css
:root {
  --q-ink: #3e2b50;        /* 主文字 */
  --q-ink-soft: #6e5a80;   /* 次级文字 */
  --q-muted: #8b789b;      /* 提示文字 */
  --q-card: rgba(255, 255, 255, 0.86);
  --q-line: #f0e3f2;
  --q-shadow: 0 5px 0 rgba(155,120,180,.10), 0 16px 34px rgba(120,90,150,.10);
}
```

每个游戏在自身 `:root` 中定义糖果色 `--accent`，同时建议同步调整 `--accent-glow` 为低饱和版本。颜色应满足：

- 作为白底文字时对比度足够（分数、标签）
- 作为按钮背景时，白色文字仍然清晰
- 不使用纯荧光色（如 `#00ff88`、`#00f5ff`）作为浅色页面上的文字色

### 9.3 深色游戏画布

贪吃蛇、打砖块、俄罗斯方块、乒乓球、飞机大战、坦克大战仍保留深色 Canvas 作为「游戏屏幕」：

- 外层 `.canvas-wrapper` / `.canvas-wrap` 使用 4px 白色圆角相框
- 画布背景统一为深梅子色（`#241b33` / `#1b1426`），与粉紫页面背景同一色系
- 画布内开始 / 暂停遮罩用深紫半透明背景
- 遮罩标题统一为白色 + 糖果色光晕，避免深色强调色在深色画布上对比不足
- 不要为了统一风格而把 Canvas 内部改成浅色，否则需要同步修改大量绘制代码和可读性

### 9.4 棋盘 / 战场表面

- 2048：淡紫棋盘 + 白色格子描边，保留经典数字配色
- 消消乐：淡紫棋盘 + 白色宝石卡片
- 翻牌记忆：粉紫渐变卡背、奶油白卡面
- 扫雷：浅蓝未翻开格、奶油白已翻开格，数字使用加深色
- 数独：奶油白格子、浅紫分隔线、青绿色选中态
- 黑白棋：薄荷绿棋盘、浅绿格子
- 推箱子：淡紫墙体、奶油地板、橙色箱子、绿色完成态、蓝色玩家
- 连连看：白色图案卡片、淡紫棋盘
- 打地鼠：浅绿草地棋盘、棕色洞口
- 坦克大战：深梅子色战场、珊瑚砖墙、薰衣草钢墙、绿色基地
- 花园保卫战：浅绿棋盘草坪、左侧栅栏与小推车、Emoji 植物 / 僵尸
- 怪兽塔防：浅绿草坪 + 米色路径、14 个建造位、紫/蓝/橙/绿武器色、Emoji 怪兽

### 9.5 按钮与弹窗

- 按钮：白色底 + 白色描边 + 实色短投影；激活态使用 `--accent` 背景 + 白字
- 主行动按钮（如打地鼠开始）可保留橙色渐变，但需要白色粗描边和实色底影
- 弹窗：奶油白卡片 + 3px 白色描边 + 26px 圆角 + 柔和投影
- 弹窗标题使用 `--q-ink`，说明文字使用 `--q-ink-soft`，按钮使用 `--accent`
- 深色画布上的遮罩标题使用白色，不跟随浅色页面的深色墨色
- 移动端浏览器地址栏主题色使用 `<meta name="theme-color" content="#fffaf4">`

### 9.6 修改视觉时的规则

1. 全局颜色 / 卡片 / 按钮 / 弹窗改 `common.css` 的主题层。
2. 游戏专属强调色与棋盘表面改各自 `style.css`。
3. 修改 `--accent` 时同步检查 `--accent-glow`，避免遗留霓虹发光。
4. 不要在浅色页面上保留 `color: #fff` 的正文 / 标签；深色画布内部除外。
5. 新增游戏必须提供 `--accent`，并检查：
   - 分数在白底上的对比度
   - 白色文字在 accent 按钮上的对比度
   - 深色画布遮罩标题使用白色
6. 修改后至少截图检查桌面、手机、小屏和弹窗。
