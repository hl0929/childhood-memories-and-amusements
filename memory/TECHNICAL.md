# 翻牌记忆 — 技术详解

## 一、整体架构

```
script.js
├── EMOJIS 池       32 种 Emoji
├── 状态变量        cards、flipped、matchCount、flips、blocked
├── 难度切换        diffBtns → 修改 cols/rows → startGame()
├── 计时器          startTimer() / stopTimer()
├── 游戏启动        startGame()
├── 翻牌逻辑        onCardClick()
└── 胜利处理        onWin()
```

## 二、关键实现

### 2.1 卡牌数据结构

```js
cards = deck.map((emoji, i) => ({
  id: i,
  emoji,
  flipped: false,
  matched: false,
  el: <DOM element>    // 反向引用，方便操作样式
}));
```

卡牌对象直接持有对应 DOM 元素的引用，翻牌时直接 `card.el.classList.add('flipped')`，无需再次查询 DOM。

### 2.2 翻牌流程与 blocked 锁

```js
function onCardClick(card, el) {
  if (blocked || card.flipped || card.matched) return;
  // 翻开
  card.flipped = true;
  el.classList.add('flipped');
  flipped.push(card);

  if (flipped.length === 2) {
    blocked = true;                     // 锁定，等待判定
    const [a, b] = flipped;
    if (a.emoji === b.emoji) {
      setTimeout(() => {                // 匹配：400ms 后标记 matched
        a.el.classList.add('matched');
        b.el.classList.add('matched');
        a.matched = b.matched = true;
        flipped = []; blocked = false;
        if (++matchCount === cards.length / 2) onWin();
      }, 400);
    } else {
      setTimeout(() => {                // 不匹配：900ms 后翻回
        a.flipped = b.flipped = false;
        a.el.classList.remove('flipped');
        b.el.classList.remove('flipped');
        flipped = []; blocked = false;
      }, 900);
    }
  }
}
```

`blocked` 在翻开第 2 张牌后立即置为 `true`，防止判定延迟期间玩家再翻第 3 张牌干扰逻辑。

### 2.3 难度与最佳记录隔离

```js
const bestKey = `mem_best_${cols}x${rows}`;
localStorage.getItem(bestKey);
localStorage.setItem(bestKey, flips);
```

用 `cols×rows` 作为 key 后缀，三种难度的最佳记录互不干扰。

### 2.4 CSS 3D 翻牌动画

```css
.card-inner {
  transform-style: preserve-3d;
  transition: transform 0.4s;
}
.card.flipped .card-inner {
  transform: rotateY(180deg);
}
.card-back  { backface-visibility: hidden; }
.card-front { backface-visibility: hidden; transform: rotateY(180deg); }
```

正面（`.card-front`）初始就旋转 180°，背面（`.card-back`）正向放置。翻牌时整个 `.card-inner` 旋转 180°，两面交替可见。`backface-visibility: hidden` 确保旋转到背面时不可见。

### 2.5 随机配对

```js
const pool = [...EMOJIS]
  .sort(() => Math.random() - 0.5)
  .slice(0, pairsNeeded);               // 取所需对数
const deck = [...pool, ...pool]
  .sort(() => Math.random() - 0.5);    // 两两复制后洗牌
```

先从 32 个 Emoji 中随机取 N 个，复制一份，合并后洗牌，保证每种 Emoji 恰好出现 2 次。

## 三、配置

| 难度 | 格子数 | 配对数 |
|------|--------|--------|
| 简单 | 4×4=16 | 8 |
| 中等 | 4×6=24 | 12 |
| 困难 | 5×6=30 | 15 |
