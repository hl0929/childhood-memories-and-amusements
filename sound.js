/* ============================================================
 * 全局音效引擎（Web Audio API 实时合成，无音频文件）
 * ------------------------------------------------------------
 * 用法：先引入本文件，再调用 SFX.play('click')
 *   SFX.play(name, options)   播放预设音效
 *   SFX.tone(options)         播放单个振荡器音
 *   SFX.noise(options)        播放噪声（爆炸 / 摩擦等）
 *   SFX.toggleMute()          切换静音
 *   SFX.setMuted(boolean)     设置静音
 *   SFX.isMuted()             查询静音状态
 *
 * 静音状态保存在 localStorage，所有游戏共用；右上角按钮或 M 键切换。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mini_games_muted';
  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var muted = false;
  var lastPlayed = Object.create(null);
  var toggleBtn = null;

  try {
    muted = global.localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) { /* localStorage 不可用时忽略 */ }

  // ==================== 音频上下文 ====================
  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;

      // 压限器：多个音效同时播放时不至于爆音
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;

      master.connect(comp);
      comp.connect(ctx.destination);

      // 预生成 0.5s 白噪声，供爆炸 / 打击等音效复用
      var len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (_) {
      ctx = null;
      master = null;
    }
    return ctx;
  }

  function resume() {
    if (muted) return;
    var c = ensureCtx();
    if (c && c.state === 'suspended') {
      c.resume().catch(function () { /* 忽略自动播放限制 */ });
    }
  }

  // ==================== 合成基元 ====================
  /**
   * 单个音
   * @param {Object} o
   * @param {number} o.freq    起始频率
   * @param {number} [o.to]    结束频率（滑音）
   * @param {number} [o.dur]   时长（秒）
   * @param {string} [o.type]  波形 sine / square / triangle / sawtooth
   * @param {number} [o.vol]   峰值音量 0~1
   * @param {number} [o.delay] 延迟（秒）
   * @param {number} [o.attack] 起音时长（秒）
   */
  function tone(o) {
    var c = ensureCtx();
    if (!c || !master) return;
    var t0 = c.currentTime + (o.delay || 0);
    var dur = Math.max(0.02, o.dur || 0.08);
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.freq), t0);
    if (o.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
    }

    var peak = o.vol == null ? 0.12 : o.vol;
    var attack = Math.min(o.attack == null ? 0.005 : o.attack, dur * 0.5);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** 噪声：用于爆炸、撞击、洗牌等 */
  function noise(o) {
    var c = ensureCtx();
    if (!c || !master || !noiseBuffer) return;
    var t0 = c.currentTime + (o.delay || 0);
    var dur = Math.max(0.03, o.dur || 0.15);
    var src = c.createBufferSource();
    var filter = c.createBiquadFilter();
    var gain = c.createGain();

    src.buffer = noiseBuffer;
    src.loop = true;
    filter.type = o.filter || 'lowpass';
    filter.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.toFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.toFreq), t0 + dur);
    }
    filter.Q.value = o.q == null ? 0.8 : o.q;

    gain.gain.setValueAtTime(o.vol == null ? 0.1 : o.vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /** 一串音符 */
  function seq(notes, o) {
    o = o || {};
    var type = o.type || 'sine';
    var vol = o.vol == null ? 0.1 : o.vol;
    var dur = o.dur == null ? 0.1 : o.dur;
    var gap = o.gap == null ? 0.07 : o.gap;
    var delay = o.delay || 0;
    notes.forEach(function (freq, i) {
      tone({ freq: freq, dur: dur, type: type, vol: vol, delay: delay + i * gap });
    });
  }

  // ==================== 预设音效 ====================
  // throttle：同名音效最小间隔（毫秒），避免连发时糊成一片
  var presets = {
    // ---- 界面 / 通用 ----
    click:    { throttle: 25, fn: function () { tone({ freq: 720, dur: 0.045, type: 'sine', vol: 0.1 }); } },
    select:   { throttle: 35, fn: function () { tone({ freq: 880, dur: 0.05, type: 'sine', vol: 0.09 }); } },
    toggle:   { throttle: 60, fn: function () { tone({ freq: 520, to: 780, dur: 0.08, type: 'sine', vol: 0.1 }); } },
    tick:     { throttle: 60, fn: function () { tone({ freq: 1000, dur: 0.03, type: 'sine', vol: 0.05 }); } },
    invalid:  { throttle: 90, fn: function () {
      tone({ freq: 190, dur: 0.07, type: 'square', vol: 0.07 });
      tone({ freq: 170, dur: 0.07, type: 'square', vol: 0.07, delay: 0.09 });
    } },
    start:    { throttle: 120, fn: function () { seq([392, 523, 659], { type: 'triangle', vol: 0.1, dur: 0.09, gap: 0.07 }); } },
    win:      { throttle: 500, fn: function () {
      seq([523, 659, 784, 1047], { type: 'triangle', vol: 0.12, dur: 0.18, gap: 0.1 });
      tone({ freq: 1318, dur: 0.4, type: 'sine', vol: 0.08, delay: 0.42 });
    } },
    lose:     { throttle: 500, fn: function () {
      seq([330, 262, 196], { type: 'triangle', vol: 0.1, dur: 0.2, gap: 0.13 });
    } },
    gameover: { throttle: 500, fn: function () {
      seq([392, 330, 262, 196], { type: 'sawtooth', vol: 0.09, dur: 0.22, gap: 0.14 });
    } },
    levelup:  { throttle: 200, fn: function () {
      seq([523, 659, 784, 1047], { type: 'square', vol: 0.06, dur: 0.08, gap: 0.055 });
    } },
    point:    { throttle: 80, fn: function () {
      tone({ freq: 880, to: 440, dur: 0.12, type: 'sine', vol: 0.1 });
    } },
    pass:     { throttle: 120, fn: function () {
      seq([440, 330], { type: 'triangle', vol: 0.08, dur: 0.08, gap: 0.08 });
    } },

    // ---- 移动 / 摆放 ----
    move:     { throttle: 35, fn: function () { tone({ freq: 300, dur: 0.035, type: 'square', vol: 0.05 }); } },
    step:     { throttle: 45, fn: function () { tone({ freq: 240, dur: 0.04, type: 'triangle', vol: 0.07 }); } },
    rotate:   { throttle: 35, fn: function () { tone({ freq: 420, to: 620, dur: 0.06, type: 'square', vol: 0.07 }); } },
    swap:     { throttle: 50, fn: function () {
      tone({ freq: 480, to: 640, dur: 0.07, type: 'sine', vol: 0.08 });
      tone({ freq: 640, to: 480, dur: 0.07, type: 'sine', vol: 0.06, delay: 0.05 });
    } },
    drop:     { throttle: 80, fn: function () {
      tone({ freq: 200, to: 90, dur: 0.12, type: 'triangle', vol: 0.12 });
      noise({ dur: 0.06, vol: 0.04, filter: 'lowpass', freq: 700 });
    } },
    lock:     { throttle: 90, fn: function () {
      tone({ freq: 150, dur: 0.07, type: 'square', vol: 0.09 });
      noise({ dur: 0.05, vol: 0.04, filter: 'lowpass', freq: 900 });
    } },
    push:     { throttle: 60, fn: function () {
      tone({ freq: 180, to: 120, dur: 0.08, type: 'triangle', vol: 0.1 });
      noise({ dur: 0.06, vol: 0.04, filter: 'lowpass', freq: 800 });
    } },
    place:    { throttle: 50, fn: function () {
      tone({ freq: 320, to: 260, dur: 0.09, type: 'triangle', vol: 0.11 });
      noise({ dur: 0.035, vol: 0.035, filter: 'lowpass', freq: 1400 });
    } },
    flip:     { throttle: 40, fn: function () { tone({ freq: 500, to: 820, dur: 0.07, type: 'sine', vol: 0.08 }); } },
    capture:  { throttle: 60, fn: function () {
      tone({ freq: 600, to: 900, dur: 0.08, type: 'sine', vol: 0.09 });
      tone({ freq: 900, dur: 0.09, type: 'sine', vol: 0.07, delay: 0.05 });
    } },
    undo:     { throttle: 60, fn: function () { tone({ freq: 500, to: 300, dur: 0.09, type: 'sine', vol: 0.08 }); } },

    // ---- 碰撞 / 战斗 ----
    bounce:   { throttle: 35, fn: function () { tone({ freq: 420, dur: 0.045, type: 'triangle', vol: 0.07 }); } },
    paddle:   { throttle: 40, fn: function (o) {
      tone({ freq: 540 * (o.pitch || 1), dur: 0.055, type: 'square', vol: 0.09 });
    } },
    brick:    { throttle: 30, fn: function () { tone({ freq: 820, dur: 0.04, type: 'square', vol: 0.07 }); } },
    break:    { throttle: 40, fn: function () {
      noise({ dur: 0.12, vol: 0.08, filter: 'highpass', freq: 1100 });
      tone({ freq: 900, to: 350, dur: 0.12, type: 'square', vol: 0.06 });
    } },
    hit:      { throttle: 40, fn: function (o) {
      var f = 320 * (o.pitch || 1);
      tone({ freq: f, to: Math.max(60, f * 0.35), dur: 0.09, type: 'square', vol: 0.09 });
      noise({ dur: 0.05, vol: 0.04, filter: 'lowpass', freq: 1600 });
    } },
    whack:    { throttle: 45, fn: function (o) {
      var f = 520 + Math.min(12, o.level || 0) * 35;
      tone({ freq: f, to: f * 0.7, dur: 0.07, type: 'square', vol: 0.09 });
      noise({ dur: 0.05, vol: 0.05, filter: 'lowpass', freq: 1200 });
    } },
    shoot:    { throttle: 70, fn: function () {
      tone({ freq: 1100, to: 420, dur: 0.055, type: 'sawtooth', vol: 0.045 });
    } },
    explode:  { throttle: 70, fn: function () {
      noise({ dur: 0.3, vol: 0.15, filter: 'lowpass', freq: 900, toFreq: 120 });
      tone({ freq: 130, to: 45, dur: 0.25, type: 'sine', vol: 0.12 });
    } },
    damage:   { throttle: 120, fn: function () {
      tone({ freq: 260, to: 100, dur: 0.18, type: 'sawtooth', vol: 0.11 });
      noise({ dur: 0.1, vol: 0.06, filter: 'lowpass', freq: 700 });
    } },

    // ---- 消除 / 合并 ----
    eat:      { throttle: 60, fn: function () {
      tone({ freq: 660, dur: 0.1, type: 'sine', vol: 0.1 });
      tone({ freq: 880, dur: 0.12, type: 'sine', vol: 0.08, delay: 0.06 });
    } },
    gold:     { throttle: 100, fn: function () {
      tone({ freq: 880, dur: 0.08, type: 'sine', vol: 0.11 });
      tone({ freq: 1100, dur: 0.08, type: 'sine', vol: 0.09, delay: 0.05 });
      tone({ freq: 1320, dur: 0.16, type: 'sine', vol: 0.08, delay: 0.1 });
    } },
    die:      { throttle: 500, fn: function () {
      tone({ freq: 220, dur: 0.3, type: 'sawtooth', vol: 0.11 });
      tone({ freq: 150, dur: 0.4, type: 'sawtooth', vol: 0.08, delay: 0.15 });
    } },
    merge:    { throttle: 40, fn: function (o) {
      var value = Math.max(2, o.value || 4);
      var step = Math.min(12, Math.max(0, Math.round(Math.log(value) / Math.LN2)));
      var f = 330 * Math.pow(2, step / 12);
      tone({ freq: f, dur: 0.09, type: 'triangle', vol: 0.11 });
      tone({ freq: f * 1.5, dur: 0.12, type: 'sine', vol: 0.07, delay: 0.05 });
    } },
    match:    { throttle: 45, fn: function (o) {
      var f = 660 * Math.pow(2, Math.min(6, o.level || 0) / 12);
      tone({ freq: f, dur: 0.1, type: 'sine', vol: 0.1 });
      tone({ freq: f * 1.5, dur: 0.13, type: 'sine', vol: 0.08, delay: 0.05 });
    } },
    combo:    { throttle: 80, fn: function (o) {
      var f = 523 * Math.pow(2, Math.min(8, o.level || 0) / 12);
      seq([f, f * 1.25, f * 1.5], { type: 'triangle', vol: 0.08, dur: 0.08, gap: 0.055 });
    } },
    mismatch: { throttle: 80, fn: function () {
      tone({ freq: 300, to: 200, dur: 0.14, type: 'sine', vol: 0.07 });
    } },
    clear:    { throttle: 100, fn: function (o) {
      var count = Math.min(4, Math.max(1, o.count || 1));
      var notes = [523, 659, 784, 1047].slice(0, count);
      seq(notes, { type: 'square', vol: 0.07, dur: 0.09, gap: 0.055 });
      if (count >= 4) {
        noise({ dur: 0.16, vol: 0.05, filter: 'highpass', freq: 1400 });
      }
    } },

    // ---- 棋盘 / 解谜 ----
    flag:     { throttle: 60, fn: function () { tone({ freq: 950, dur: 0.035, type: 'square', vol: 0.06 }); } },
    unflag:   { throttle: 60, fn: function () { tone({ freq: 650, dur: 0.035, type: 'square', vol: 0.05 }); } },
    reveal:   { throttle: 40, fn: function () { tone({ freq: 420, dur: 0.03, type: 'sine', vol: 0.045 }); } },
    hint:     { throttle: 200, fn: function () {
      seq([1046, 1318, 1568], { type: 'sine', vol: 0.07, dur: 0.06, gap: 0.05 });
    } },
    shuffle:  { throttle: 200, fn: function () {
      noise({ dur: 0.18, vol: 0.06, filter: 'bandpass', freq: 600, toFreq: 1600, q: 1.2 });
      seq([392, 523, 659], { type: 'triangle', vol: 0.06, dur: 0.06, gap: 0.06, delay: 0.08 });
    } },
  };

  // ==================== 播放接口 ====================
  function play(name, opts) {
    if (muted) return;
    var preset = presets[name];
    if (!preset) return;

    var now = (global.performance && global.performance.now)
      ? global.performance.now()
      : Date.now();
    var throttle = (opts && opts.throttle != null)
      ? opts.throttle
      : (preset.throttle || 20);
    if (now - (lastPlayed[name] || 0) < throttle) return;
    lastPlayed[name] = now;

    var c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') {
      c.resume().catch(function () { /* 忽略 */ });
    }
    try {
      preset.fn(opts || {});
    } catch (_) { /* 音效失败不影响游戏 */ }
  }

  // ==================== 静音按钮 ====================
  function updateButton() {
    if (!toggleBtn) return;
    toggleBtn.textContent = muted ? '🔇' : '🔊';
    var text = muted ? '音效已关闭（M 开启）' : '音效已开启（M 关闭）';
    toggleBtn.title = text;
    toggleBtn.setAttribute('aria-label', text);
    toggleBtn.setAttribute('aria-pressed', String(muted));
    toggleBtn.style.opacity = muted ? '0.6' : '1';
  }

  function ensureButton() {
    if (toggleBtn || !global.document || !global.document.body) return;

    toggleBtn = global.document.createElement('button');
    toggleBtn.id = 'sfx-toggle';
    toggleBtn.type = 'button';
    toggleBtn.tabIndex = -1;

    var s = toggleBtn.style;
    s.position = 'fixed';
    s.top = '10px';
    s.right = '10px';
    s.width = '38px';
    s.height = '38px';
    s.padding = '0';
    s.borderRadius = '50%';
    s.border = '1px solid rgba(255,255,255,.18)';
    s.background = 'rgba(20,20,35,.55)';
    s.color = '#fff';
    s.fontSize = '17px';
    s.lineHeight = '1';
    s.cursor = 'pointer';
    s.zIndex = '9999';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.backdropFilter = 'blur(6px)';
    s.webkitBackdropFilter = 'blur(6px)';
    s.boxShadow = '0 2px 10px rgba(0,0,0,.3)';
    s.transition = 'transform .15s, opacity .15s';
    s.touchAction = 'manipulation';

    toggleBtn.addEventListener('mouseenter', function () { s.transform = 'scale(1.08)'; });
    toggleBtn.addEventListener('mouseleave', function () { s.transform = 'scale(1)'; });
    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMute();
      toggleBtn.blur();
    });

    global.document.body.appendChild(toggleBtn);
    updateButton();
  }

  function setMuted(value) {
    muted = !!value;
    try {
      global.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch (_) { /* 忽略 */ }
    updateButton();
    if (!muted) {
      resume();
      play('toggle');
    }
  }

  function toggleMute() {
    setMuted(!muted);
  }

  // ==================== 自动播放策略 ====================
  // 首次点击 / 按键时才创建或恢复 AudioContext
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (evt) {
    global.addEventListener(evt, resume, { capture: true, passive: true });
  });

  // M 键全局静音（输入框中除外）
  global.addEventListener('keydown', function (e) {
    if (e.key !== 'm' && e.key !== 'M') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    toggleMute();
  }, true);

  // ==================== 初始化 ====================
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', ensureButton);
    } else {
      ensureButton();
    }
  }

  global.SFX = {
    play: play,
    tone: tone,
    noise: noise,
    seq: seq,
    setMuted: setMuted,
    toggleMute: toggleMute,
    isMuted: function () { return muted; },
    unlock: resume,
  };
})(window);
