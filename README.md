# 🎮 休闲小游戏合集

15 款经典小游戏，纯原生 HTML5 + CSS3 + JavaScript 实现，零外部依赖，双击 `index.html` 即可游玩。全部游戏均配有 Web Audio 实时合成音效，无需任何音频文件。

## 游戏列表

| 游戏 | 目录 | 简介 |
|------|------|------|
| 🐍 贪吃蛇 | [snake/](snake/README.md) | 经典贪吃蛇，粒子特效 + 合成音效 |
| 🧱 打砖块 | [breakout/](breakout/README.md) | 多关卡打砖块，挡板 + 弹球 |
| 🔢 2048 | [game2048/](game2048/README.md) | 数字合并益智游戏 |
| 💎 消消乐 | [match3/](match3/README.md) | 宝石三消，连锁倍率加分 |
| 🃏 翻牌记忆 | [memory/](memory/README.md) | 多难度翻牌配对记忆游戏 |
| 🟦 俄罗斯方块 | [tetris/](tetris/README.md) | 经典方块消行，含幽灵块预览 |
| 🐭 打地鼠 | [whack/](whack/README.md) | 30秒限时打地鼠，连击加倍 |
| 💣 扫雷 | [minesweeper/](minesweeper/README.md) | 经典扫雷，三档难度 + 首击安全 |
| 🚀 飞机大战 | [shooter/](shooter/README.md) | 波次射击，触屏拖拽 + 粒子特效 |
| 📦 推箱子 | [sokoban/](sokoban/README.md) | 10 关推箱子 + 撤销 + 滑动操作 |
| 🔗 连连看 | [linkgame/](linkgame/README.md) | BFS 寻路连线，提示 + 自动洗牌 |
| 🏓 乒乓球 | [pong/](pong/README.md) | 经典 Pong，AI / 双人 + 分屏触控 |
| 🔢 数独 | [sudoku/](sudoku/README.md) | 回溯生成，笔记模式 + 三档难度 |
| ⚫️ 黑白棋 | [othello/](othello/README.md) | 翻转棋，贪心 AI + 翻转动画 |
| 🔴 五子棋 | [gomoku/](gomoku/README.md) | 评分策略 AI + 悬停预览落子 |

## 音效系统

所有游戏共用根目录的 [`sound.js`](sound.js)，通过 Web Audio API 实时合成音效，不加载任何外部音频文件。每个游戏都接入了与玩法对应的声音，例如：

| 场景 | 游戏示例 | 声音设计 |
|------|----------|----------|
| 移动 / 旋转 / 推箱 | 俄罗斯方块、推箱子 | 短促方波与三角波 |
| 碰撞 / 击打 | 打砖块、乒乓球、打地鼠 | 随力度或连击变化的打击音 |
| 消除 / 合并 | 消消乐、2048、连连看 | 音高随连锁或数字递增 |
| 爆炸 / 受伤 | 扫雷、飞机大战 | 低通噪声 + 低频振荡 |
| 胜负 / 升级 | 全部游戏 | 上行或下行琶音 |

**静音方式：** 点击页面右上角的 🔊 按钮，或按 `M` 键。静音状态保存在 `localStorage` 中，所有游戏共用。首次点击 / 按键时才会创建 `AudioContext`，符合浏览器自动播放策略。

## 运行方式

直接双击任意游戏目录内的 `index.html`，或启动本地服务器后访问主页：

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

## 许可

本项目仅用于学习和研究目的。
