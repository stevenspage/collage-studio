/* 拼图工坊 · 布局、渲染、交互与导出 */

(() => {
  'use strict';

  const MAX_IMAGES = 9;
  const PREVIEW_MAX = 1600;
  const LOAD_MAX = 2560;
  const THUMB_SIZE = 240;
  const DESIGN_BASE = 2048;
  const LONG_PRESS_MS = 360;
  const TOUCH_TOLERANCE = 8;
  const HANDLE_LINGER_MS = 1000;
  const HANDLE_ONBOARD_MS = 5000;
  const GRID_RATIOS = Object.freeze({
    '1:1': 1,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '4:3': 4 / 3,
    '3:4': 3 / 4
  });
  const TOUCH_MODE = (navigator.maxTouchPoints || 0) > 0 && window.matchMedia('(pointer: coarse)').matches;
  const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const SORT_SOURCE = 'rgba(255,255,255,.92)';
  const SORT_SOURCE_HALO = 'rgba(0,0,0,.44)';
  const SORT_TARGET = 'rgba(255,107,74,.98)';
  const SORT_TARGET_HALO = 'rgba(0,0,0,.5)';
  const SORT_FILL = 'rgba(255,107,74,.28)';
  const SMART_MAX_VARIANTS = 5;
  const SMART_BASE = {
    1: [[0, 0, 3, 3]],
    2: [[0, 0, 1, 3], [1, 0, 2, 3]],
    3: [[0, 0, 2, 3], [2, 0, 1, 1], [2, 1, 1, 2]],
    4: [[0, 0, 2, 2], [2, 0, 1, 2], [0, 2, 2, 1], [2, 2, 1, 1]],
    5: [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1], [0, 2, 1, 1], [1, 2, 2, 1]],
    6: [[0, 0, 1, 2], [1, 0, 1, 2], [2, 0, 1, 1], [2, 1, 1, 1], [0, 2, 2, 1], [2, 2, 1, 1]],
    7: [[0, 0, 1, 2], [1, 0, 1, 2], [2, 0, 1, 1], [2, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]],
    8: [[0, 0, 1, 2], [0, 2, 1, 1], [1, 0, 1, 1], [1, 1, 1, 1], [1, 2, 1, 1], [2, 0, 1, 1], [2, 1, 1, 1], [2, 2, 1, 1]],
    9: Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3), 1, 1])
  };
  const DEFAULTS = Object.freeze({
    mode: 'grid',
    gap: 10,
    border: 16,
    radius: 0,
    outerRadius: 0,
    bg: '#ffffff',
    fit: 'cover',
    longSide: 2048,
    gridVariant: 0,
    gridRatio: '1:1',
    gridPlan: null
  });
  const MODE_LABEL_KEY = { grid: 'modeGrid', h: 'modeH', v: 'modeV' };
  const PRESETS = [
    ['#ffffff', 'white'],
    ['#000000', 'black'],
    ['#f6f1e7', 'cream'],
    ['#d8d4ca', 'warm'],
    ['#f6d3dd', 'sakura'],
    ['#cfe3f7', 'mist'],
    ['#d8e5d2', 'sage'],
    ['#f4e3b2', 'butter'],
    ['transparent', 'transparent']
  ];
  const RES_LABEL_KEY = {
    1200: 'resChat',
    1600: 'resWeb',
    2048: 'resBest',
    2560: 'resHd',
    3072: 'resPrint',
    4096: 'resPoster'
  };
  const COLOR_LABEL_KEY = {
    white: 'colorWhite',
    black: 'colorBlack',
    cream: 'colorCream',
    warm: 'colorWarm',
    sakura: 'colorSakura',
    mist: 'colorMist',
    sage: 'colorSage',
    butter: 'colorButter',
    transparent: 'colorTransparent'
  };

  const i18n = window.__collageI18n;
  let lang = i18n ? i18n.detect() : 'zh-CN';

  function t(key, ...args) {
    const dict = i18n ? i18n.dict[lang] || i18n.dict.en : null;
    const fallback = i18n ? i18n.dict.en : null;
    const value = dict && dict[key] !== undefined ? dict[key] : (fallback ? fallback[key] : key);
    return typeof value === 'function' ? value(...args) : value;
  }

  const state = {
    ...DEFAULTS,
    items: [],
    loading: false,
    exporting: false,
    copying: false,
    lastColor: DEFAULTS.bg
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    stage: $('#stage'),
    canvas: $('#canvas'),
    cellHandles: $('#cellHandles'),
    empty: $('#emptyState'),
    dropzone: $('#dropzone'),
    fileInput: $('#fileInput'),
    thumbs: $('#thumbs'),
    countPill: $('#countPill'),
    uploadHint: $('#uploadHint'),
    stageInfo: $('#stageInfo'),
    layoutNote: $('#layoutNote'),
    gapRange: $('#gapRange'),
    gapNum: $('#gapNum'),
    borderRange: $('#borderRange'),
    borderNum: $('#borderNum'),
    radiusRange: $('#radiusRange'),
    radiusNum: $('#radiusNum'),
    outerRadiusRange: $('#outerRadiusRange'),
    outerRadiusNum: $('#outerRadiusNum'),
    fitRow: $('#fitRow'),
    fitHint: $('#fitHint'),
    fitChips: $$('#fitChips .chip'),
    ratioRow: $('#ratioRow'),
    ratioBtns: $$('#ratioChips .ratio-chip'),
    ratioHint: $('#ratioHint'),
    variantRow: $('#variantRow'),
    variantRange: $('#variantRange'),
    variantHint: $('#variantHint'),
    variantEnd: $('#variantEnd'),
    swatches: $('#swatches'),
    customSwatch: $('#customSwatch'),
    colorInput: $('#colorInput'),
    bgVal: $('#bgVal'),
    resSelect: $('#resSelect'),
    outDims: $('#outDims'),
    downloadBtn: $('#downloadBtn'),
    copyBtn: $('#copyBtn'),
    resetBtn: $('#resetBtn'),
    clearBtn: $('#clearBtn'),
    toast: $('#toast'),
    langSelect: $('#langSelect'),
    modeBtns: $$('.seg-btn')
  };

  let rafId = 0;
  let view = null;
  let pan = null;
  let touchCandidate = null;
  let sortDrag = null;
  let handleBoxes = [];
  let handlesHot = false;
  let handlesHideTimer = 0;
  let handlesOnboarded = false;
  let handlesOnboardUntil = 0;
  let dragFrom = null;
  let dragDepth = 0;
  let toastTimer = 0;
  let uid = 0;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ------------------------------------------------------------------ *
   *  geometry
   * ------------------------------------------------------------------ */

  function frameLimit(frame, avail) {
    return frame > 0.0001 ? Math.min(1, avail / frame) : 1;
  }

  /* ------------------------------------------------------------------ *
   *  smart merged 3×3 grid
   * ------------------------------------------------------------------ */

  function transformSmartRects(rects, t) {
    return rects.map(([x0, y0, w0, h0]) => {
      let x = x0;
      let y = y0;
      let w = w0;
      let h = h0;
      if (t & 1) {
        [x, y, w, h] = [y, x, h, w];
      }
      if (t & 2) x = 3 - x - w;
      if (t & 4) y = 3 - y - h;
      return [x, y, w, h];
    });
  }

  function smartRectsKey(rects) {
    return rects
      .map((r) => r.map((v) => Number(v).toFixed(2)).join(','))
      .sort()
      .join('|');
  }

  function makeSmartVariants(n) {
    const out = [];
    const seen = new Set();
    const push = (rects) => {
      const key = smartRectsKey(rects);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(rects.map((r) => r.slice()));
    };

    for (let t = 0; t < 8; t += 1) {
      push(transformSmartRects(SMART_BASE[n], t));
    }

    if (n === 2) {
      push([[0, 0, 3, 1.5], [0, 1.5, 3, 1.5]]);
      push([[0, 0, 1.5, 3], [1.5, 0, 1.5, 3]]);
    }
    if (n === 3) {
      push([[0, 0, 3, 1], [0, 1, 3, 1], [0, 2, 3, 1]]);
      push([[0, 0, 1, 3], [1, 0, 1, 3], [2, 0, 1, 3]]);
    }
    if (n === 4) {
      push([
        [0, 0, 1.5, 1.5], [1.5, 0, 1.5, 1.5],
        [0, 1.5, 1.5, 1.5], [1.5, 1.5, 1.5, 1.5]
      ]);
    }
    return out;
  }

  function smartVariantScore(rects, items, canvasAspect = 1) {
    let total = 0;
    rects.forEach((rect, i) => {
      const imageRatio = items[i] ? items[i].aspect : 1;
      const tileRatio = (rect[2] / rect[3]) * canvasAspect;
      total += Math.min(tileRatio / imageRatio, imageRatio / tileRatio, 1);
    });
    return rects.length ? total / rects.length : 0;
  }

  function getSmartGridPlan(canvasAspect = 1) {
    const items = state.items;
    const n = items.length;
    const variants = makeSmartVariants(n);
    const ranked = variants
      .map((rects, index) => ({
        rects,
        index,
        score: smartVariantScore(rects, items, canvasAspect)
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    const max = Math.min(SMART_MAX_VARIANTS, Math.max(0, ranked.length - 1));
    const pos = Math.min(Math.max(0, state.gridVariant), max);
    return {
      rects: ranked[pos].rects,
      pos,
      max,
      count: ranked.length
    };
  }

  function ensureSmartPlan() {
    const n = state.items.length;
    const ratio = state.gridRatio;
    if (state.gridPlan && state.gridPlan.n === n && state.gridPlan.ratio === ratio) {
      return state.gridPlan;
    }

    const plan = getSmartGridPlan(GRID_RATIOS[ratio] || 1);
    state.gridPlan = {
      rects: plan.rects,
      n,
      ratio,
      pos: plan.pos,
      max: plan.max,
      count: plan.count
    };
    state.gridVariant = plan.pos;
    return state.gridPlan;
  }

  /**
   * 计算画布尺寸与每张图的绘制矩形。
   * 所有数值都以「导出像素」为单位，长边约为 L。
   */
  function computeGeometry(L) {
    const items = state.items;
    const n = items.length;
    if (!n) return null;

    const mode = state.mode;
    const designScale = L / DESIGN_BASE;
    let gap = Math.max(0, state.gap) * designScale;
    let border = Math.max(0, state.border) * designScale;
    const minContent = L * 0.18;

    let cols = 1;
    let rows = 1;
    let totalW = 0;
    let totalH = 0;
    const cells = [];

    if (mode === 'grid') {
      const plan = ensureSmartPlan();
      cols = 3;
      rows = 3;

      const aspect = GRID_RATIOS[state.gridRatio] || 1;
      totalW = aspect >= 1 ? L : L * aspect;
      totalH = aspect >= 1 ? L / aspect : L;

      const gridMinContent = Math.min(totalW, totalH) * 0.18;
      const k = frameLimit(
        2 * border + 2 * gap,
        Math.min(totalW, totalH) - gridMinContent
      );
      border *= k;
      gap *= k;

      const innerW = Math.max(1, totalW - 2 * border);
      const innerH = Math.max(1, totalH - 2 * border);
      // 只有格子之间才让出间距：靠边的一侧保持外框边距原值
      const edgeSpan = (start, span, inner) => {
        const x0 = (start / 3) * inner;
        const x1 = ((start + span) / 3) * inner;
        const before = start > 0 ? gap / 2 : 0;
        const after = start + span < 3 ? gap / 2 : 0;
        return {
          pos: border + x0 + before,
          size: Math.max(1, x1 - x0 - before - after)
        };
      };

      plan.rects.forEach((rect, i) => {
        const spanX = edgeSpan(rect[0], rect[2], innerW);
        const spanY = edgeSpan(rect[1], rect[3], innerH);
        cells.push({
          item: items[i],
          x: spanX.pos,
          y: spanY.pos,
          w: spanX.size,
          h: spanY.size
        });
      });

      return {
        mode,
        cols,
        rows,
        cells,
        totalW,
        totalH,
        designScale,
        longSide: Math.max(totalW, totalH),
        gridVariant: plan.pos,
        gridVariantMax: plan.max,
        gridVariantCount: plan.count,
        gridRatio: state.gridRatio
      };
    } else if (mode === 'h') {
      cols = n;
      rows = 1;

      const k = Math.min(
        frameLimit(2 * border + (n - 1) * gap, L - minContent),
        frameLimit(2 * border, L - minContent)
      );
      border *= k;
      gap *= k;

      const sumAspect = items.reduce((sum, item) => sum + item.aspect, 0) || 1;
      let h = (L - 2 * border - (n - 1) * gap) / sumAspect;
      totalW = L;
      totalH = h + 2 * border;

      if (totalH > L + 0.001) {
        h = L - 2 * border;
        totalW = sumAspect * h + (n - 1) * gap + 2 * border;
        totalH = L;
      }
      h = Math.max(1, h);

      let x = border;
      for (const item of items) {
        const w = h * item.aspect;
        cells.push({ item, x, y: border, w, h });
        x += w + gap;
      }
    } else {
      cols = 1;
      rows = n;

      const k = Math.min(
        frameLimit(2 * border + (n - 1) * gap, L - minContent),
        frameLimit(2 * border, L - minContent)
      );
      border *= k;
      gap *= k;

      const sumInverse = items.reduce((sum, item) => sum + 1 / item.aspect, 0) || 1;
      let w = (L - 2 * border - (n - 1) * gap) / sumInverse;
      totalW = w + 2 * border;
      totalH = L;

      if (totalW > L + 0.001) {
        w = L - 2 * border;
        totalH = sumInverse * w + (n - 1) * gap + 2 * border;
        totalW = L;
      }
      w = Math.max(1, w);

      let y = border;
      for (const item of items) {
        const h = w / item.aspect;
        cells.push({ item, x: border, y, w, h });
        y += h + gap;
      }
    }

    return {
      mode,
      cols,
      rows,
      cells,
      totalW,
      totalH,
      designScale,
      longSide: Math.max(totalW, totalH)
    };
  }

  /* ------------------------------------------------------------------ *
   *  painting
   * ------------------------------------------------------------------ */

  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (radius < 0.05) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function coverMetrics(item, w, h) {
    const s = Math.max(w / item.w, h / item.h);
    const sw = w / s;
    const sh = h / s;
    const maxSx = Math.max(0, item.w - sw);
    const maxSy = Math.max(0, item.h - sh);
    const focusX = item.focusX ?? 0.5;
    const focusY = item.focusY ?? 0.5;

    return {
      s,
      sw,
      sh,
      maxSx,
      maxSy,
      sx: clamp(focusX * item.w - sw / 2, 0, maxSx),
      sy: clamp(focusY * item.h - sh / 2, 0, maxSy),
      canPanX: maxSx > 0.5,
      canPanY: maxSy > 0.5
    };
  }

  function paintCell(ctx, cell, radius, fit) {
    const { item, x, y, w, h } = cell;
    if (w <= 0 || h <= 0) return;

    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();

    if (fit === 'contain') {
      const s = Math.min(w / item.w, h / item.h);
      const dw = item.w * s;
      const dh = item.h * s;
      ctx.drawImage(item.canvas, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      const m = coverMetrics(item, w, h);
      ctx.drawImage(item.canvas, m.sx, m.sy, m.sw, m.sh, x, y, w, h);
    }
    ctx.restore();
  }

  function paintScene(ctx, geo, scale) {
    const canvas = ctx.canvas;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const outerRadius = Math.max(0, state.outerRadius * geo.designScale * scale);
    const radiusLimit = Math.min(canvas.width, canvas.height) / 2;
    if (outerRadius > 0.01 && radiusLimit > 0) {
      roundRectPath(ctx, 0, 0, canvas.width, canvas.height, Math.min(outerRadius, radiusLimit));
      ctx.clip();
    }

    if (state.bg !== 'transparent') {
      ctx.fillStyle = state.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const fit = state.mode === 'grid' ? state.fit : 'cover';
    for (const cell of geo.cells) {
      const radius = Math.min(state.radius * geo.designScale, cell.w / 2, cell.h / 2);
      paintCell(ctx, cell, radius, fit);
    }

    ctx.restore();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function showHandleAffordance() {
    els.cellHandles.classList.add('is-revealed');
  }

  function hideHandleAffordance() {
    if (handlesHot) return;
    if (Date.now() < handlesOnboardUntil) return;
    els.cellHandles.classList.remove('is-revealed');
  }

  function scheduleHandleHide(delay) {
    window.clearTimeout(handlesHideTimer);
    handlesHideTimer = window.setTimeout(() => {
      if (handlesHot) return;
      const remain = handlesOnboardUntil - Date.now();
      if (remain > 0) {
        scheduleHandleHide(remain);
        return;
      }
      hideHandleAffordance();
    }, Math.max(0, delay));
  }

  function revealHandlesFor(delay) {
    showHandleAffordance();
    scheduleHandleHide(delay);
  }

  function startHandleOnboarding() {
    if (handlesOnboarded) return;
    if (handlesHot) {
      handlesOnboarded = true;
      showHandleAffordance();
      return;
    }
    handlesOnboarded = true;
    handlesOnboardUntil = Date.now() + HANDLE_ONBOARD_MS;
    revealHandlesFor(HANDLE_ONBOARD_MS);
  }

  function markCanvasHot() {
    handlesHot = true;
    handlesOnboardUntil = 0;
    window.clearTimeout(handlesHideTimer);
    showHandleAffordance();
  }

  function releaseCanvasHot() {
    handlesHot = false;
    scheduleHandleHide(HANDLE_LINGER_MS);
  }

  function syncCellHandles(geo) {
    if (!geo || !geo.cells.length || els.canvas.hidden) {
      els.cellHandles.hidden = true;
      return;
    }

    const n = geo.cells.length;
    if (handleBoxes.length !== n) {
      els.cellHandles.textContent = '';
      handleBoxes = [];
      for (let i = 0; i < n; i += 1) {
        const box = document.createElement('div');
        box.className = 'cell-handle-box';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell-handle';
        btn.tabIndex = -1;
        btn.innerHTML = `
          <svg viewBox="0 0 10 16" aria-hidden="true">
            <circle cx="3" cy="3" r="1.15"/><circle cx="7" cy="3" r="1.15"/>
            <circle cx="3" cy="8" r="1.15"/><circle cx="7" cy="8" r="1.15"/>
            <circle cx="3" cy="13" r="1.15"/><circle cx="7" cy="13" r="1.15"/>
          </svg>
        `;
        box.appendChild(btn);
        els.cellHandles.appendChild(box);
        handleBoxes.push(box);
      }
    }

    const canvasRect = els.canvas.getBoundingClientRect();
    const stageRect = els.stage.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) {
      els.cellHandles.hidden = true;
      return;
    }

    const sx = canvasRect.width / geo.totalW;
    const sy = canvasRect.height / geo.totalH;
    const ox = canvasRect.left - stageRect.left;
    const oy = canvasRect.top - stageRect.top;

    geo.cells.forEach((cell, i) => {
      const box = handleBoxes[i];
      const btn = box.firstElementChild;
      box.style.left = `${ox + cell.x * sx}px`;
      box.style.top = `${oy + cell.y * sy}px`;
      box.style.width = `${cell.w * sx}px`;
      box.style.height = `${cell.h * sy}px`;
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', t('handleAria', i + 1));
      btn.title = t('handleTitle');
    });

    els.cellHandles.hidden = false;
    els.cellHandles.classList.toggle('is-quiet', Boolean(pan || sortDrag));
    if (!state.loading) startHandleOnboarding();
  }

  function renderScene() {
    const n = state.items.length;
    if (!n) {
      view = null;
      els.canvas.hidden = true;
      els.cellHandles.hidden = true;
      els.empty.hidden = false;
      els.canvas.style.cursor = 'default';
      return;
    }

    els.empty.hidden = true;
    els.canvas.hidden = false;

    const geo = computeGeometry(state.longSide);
    if (!geo || !isFinite(geo.totalW) || !isFinite(geo.totalH)) {
      view = null;
      els.cellHandles.hidden = true;
      return;
    }

    const scale = Math.min(1, PREVIEW_MAX / geo.longSide);
    const cw = Math.max(1, Math.round(geo.totalW * scale));
    const ch = Math.max(1, Math.round(geo.totalH * scale));

    if (els.canvas.width !== cw) els.canvas.width = cw;
    if (els.canvas.height !== ch) els.canvas.height = ch;

    view = {
      geo,
      scaleX: cw / geo.totalW,
      scaleY: ch / geo.totalH
    };

    const ctx = els.canvas.getContext('2d');
    const canvasRect = els.canvas.getBoundingClientRect();
    const outerRadiusCss = state.outerRadius * geo.designScale * (canvasRect.width / geo.totalW);
    els.canvas.style.borderRadius = `${Math.max(2, outerRadiusCss)}px`;
    paintScene(ctx, geo, scale);

    if (pan && pan.isTouch) {
      const rect = els.canvas.getBoundingClientRect();
      const line = Math.max(2, 2 * (geo.totalW / Math.max(1, rect.width)));
      const dash = [line * 3.5, line * 2.2];

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.setLineDash(dash);
      roundRectPath(
        ctx,
        pan.cell.x,
        pan.cell.y,
        Math.max(1, pan.cell.w),
        Math.max(1, pan.cell.h),
        8
      );

      ctx.lineWidth = line * 2.4;
      ctx.strokeStyle = 'rgba(0,0,0,.42)';
      ctx.stroke();

      ctx.lineWidth = line;
      ctx.strokeStyle = 'rgba(216,255,95,.95)';
      ctx.stroke();
      ctx.restore();
    }

    if (sortDrag) {
      drawSortOverlay(ctx, geo);
    }
    if (!sortDrag && (state.mode !== 'grid' || state.fit !== 'cover')) {
      els.canvas.style.cursor = 'default';
    }
    syncCellHandles(geo);
  }

  function drawSortOverlay(ctx, geo) {
    const from = geo.cells[sortDrag.fromIndex];
    const to = sortDrag.targetIndex >= 0 ? geo.cells[sortDrag.targetIndex] : null;
    if (!from) return;

    const rect = els.canvas.getBoundingClientRect();
    const unit = geo.totalW / Math.max(1, rect.width);
    const dash = [7 * unit, 5 * unit];
    const haloWidth = Math.max(2, 6 * unit);

    ctx.save();
    ctx.lineJoin = 'round';

    if (to && to !== from) {
      ctx.fillStyle = SORT_FILL;
      roundRectPath(ctx, to.x, to.y, Math.max(1, to.w), Math.max(1, to.h), 8);
      ctx.fill();
    }

    const frames = [];
    if (to && to !== from) {
      frames.push({
        cell: to,
        color: SORT_TARGET,
        halo: SORT_TARGET_HALO,
        width: 3,
        dash: false
      });
    }
    frames.push({
      cell: from,
      color: SORT_SOURCE,
      halo: SORT_SOURCE_HALO,
      width: 2.2,
      dash: true
    });

    for (const frame of frames) {
      ctx.setLineDash(frame.dash ? dash : []);
      roundRectPath(
        ctx,
        frame.cell.x,
        frame.cell.y,
        Math.max(1, frame.cell.w),
        Math.max(1, frame.cell.h),
        8
      );

      ctx.lineWidth = haloWidth;
      ctx.strokeStyle = frame.halo;
      ctx.stroke();

      ctx.lineWidth = Math.max(1.5, frame.width * unit);
      ctx.strokeStyle = frame.color;
      ctx.stroke();
    }
    ctx.restore();
  }

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      renderScene();
      syncUI();
    });
  }

  /* ------------------------------------------------------------------ *
   *  drag-to-pan inside grid cells
   * ------------------------------------------------------------------ */

  function canvasPoint(ev) {
    if (!view) return null;
    const rect = els.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const bx = (ev.clientX - rect.left) * (els.canvas.width / rect.width);
    const by = (ev.clientY - rect.top) * (els.canvas.height / rect.height);
    return { x: bx / view.scaleX, y: by / view.scaleY };
  }

  function cellAtPoint(x, y) {
    if (!view) return null;
    const cells = view.geo.cells;
    for (let i = cells.length - 1; i >= 0; i -= 1) {
      const cell = cells[i];
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        return cell;
      }
    }
    return null;
  }

  function isPannable(cell) {
    if (state.mode !== 'grid' || state.fit !== 'cover') return false;
    const m = coverMetrics(cell.item, cell.w, cell.h);
    return m.canPanX || m.canPanY;
  }

  function cellUnderPointer(ev) {
    const p = canvasPoint(ev);
    return p ? cellAtPoint(p.x, p.y) : null;
  }

  function updateCanvasCursor(ev) {
    if (pan || sortDrag) return;
    const cell = cellUnderPointer(ev);
    if (ev.altKey) {
      els.canvas.style.cursor = cell ? 'grab' : 'default';
      return;
    }
    els.canvas.style.cursor = cell && isPannable(cell) ? 'grab' : 'default';
  }

  function clearSortDrag() {
    if (!sortDrag) return;
    const pointerId = sortDrag.pointerId;
    sortDrag = null;
    if (els.canvas.hasPointerCapture(pointerId)) {
      els.canvas.releasePointerCapture(pointerId);
    }
    els.canvas.classList.remove('is-sorting-drag');
    els.canvas.style.cursor = 'default';
  }

  function startSortDrag(ev, index) {
    if (sortDrag || pan || touchCandidate) return;
    if (!view || index < 0 || index >= view.geo.cells.length) return;

    sortDrag = {
      pointerId: ev.pointerId,
      fromIndex: index,
      targetIndex: index
    };
    try {
      els.canvas.setPointerCapture(ev.pointerId);
    } catch (err) { /* noop */ }
    els.canvas.classList.add('is-sorting-drag');
    els.canvas.style.cursor = 'grabbing';
    renderScene();
  }

  function beginPan(pointerId, cell, point, isTouch) {
    const m = coverMetrics(cell.item, cell.w, cell.h);

    pan = {
      pointerId,
      cell,
      item: cell.item,
      isTouch,
      startX: point.x,
      startY: point.y,
      sx: m.sx,
      sy: m.sy,
      sw: m.sw,
      sh: m.sh,
      s: m.s,
      maxSx: m.maxSx,
      maxSy: m.maxSy
    };

    try {
      els.canvas.setPointerCapture(pointerId);
    } catch (err) { /* noop */ }
    els.canvas.classList.add('is-panning');
    els.canvas.style.cursor = 'grabbing';

    if (isTouch) {
      window.addEventListener('touchmove', preventTouchScroll, { passive: false });
      if (typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(12); } catch (err) { /* noop */ }
      }
      renderScene();
    }
  }

  function preventTouchScroll(ev) {
    if (pan && pan.isTouch) ev.preventDefault();
  }

  function clearTouchCandidate() {
    if (!touchCandidate) return;
    window.clearTimeout(touchCandidate.timer);
    touchCandidate = null;
  }

  function startTouchCandidate(ev, cell, point) {
    clearTouchCandidate();

    const candidate = {
      pointerId: ev.pointerId,
      cell,
      point,
      clientX: ev.clientX,
      clientY: ev.clientY,
      timer: 0
    };

    candidate.timer = window.setTimeout(() => {
      if (touchCandidate !== candidate || pan) return;
      touchCandidate = null;
      beginPan(candidate.pointerId, candidate.cell, candidate.point, true);
    }, LONG_PRESS_MS);

    touchCandidate = candidate;
  }

  function onCanvasPointerDown(ev) {
    if (ev.button !== 0) return;

    if (ev.altKey) {
      const cell = cellUnderPointer(ev);
      if (!cell || !view) return;
      const index = view.geo.cells.indexOf(cell);
      if (index < 0) return;
      startSortDrag(ev, index);
      ev.preventDefault();
      return;
    }

    if (pan || touchCandidate) return;
    if (ev.pointerType === 'touch') {
      handlesOnboardUntil = 0;
      revealHandlesFor(HANDLE_LINGER_MS);
    }
    const cell = cellUnderPointer(ev);
    if (!cell || !isPannable(cell)) return;

    const point = canvasPoint(ev);
    if (!point) return;

    if (ev.pointerType === 'touch') {
      startTouchCandidate(ev, cell, point);
      return;
    }
    beginPan(ev.pointerId, cell, point, false);
  }

  function onCanvasPointerMove(ev) {
    if (sortDrag) {
      if (ev.pointerId !== sortDrag.pointerId) return;
      const cell = cellUnderPointer(ev);
      const index = cell && view ? view.geo.cells.indexOf(cell) : -1;
      if (index !== sortDrag.targetIndex) {
        sortDrag.targetIndex = index;
        renderScene();
      }
      ev.preventDefault();
      return;
    }

    if (pan) {
      if (ev.pointerId !== pan.pointerId) return;

      const p = canvasPoint(ev);
      if (!p) return;

      const sx = clamp(pan.sx - (p.x - pan.startX) / pan.s, 0, pan.maxSx);
      const sy = clamp(pan.sy - (p.y - pan.startY) / pan.s, 0, pan.maxSy);

      pan.item.focusX = pan.maxSx > 0.5 ? clamp((sx + pan.sw / 2) / pan.item.w, 0, 1) : 0.5;
      pan.item.focusY = pan.maxSy > 0.5 ? clamp((sy + pan.sh / 2) / pan.item.h, 0, 1) : 0.5;

      renderScene();
      ev.preventDefault();
      return;
    }

    if (touchCandidate) {
      if (ev.pointerId !== touchCandidate.pointerId) return;
      const moved = Math.hypot(
        ev.clientX - touchCandidate.clientX,
        ev.clientY - touchCandidate.clientY
      );
      if (moved > TOUCH_TOLERANCE) clearTouchCandidate();
      return;
    }

    updateCanvasCursor(ev);
  }

  function endCanvasPan(ev) {
    if (!pan) return;
    if (ev && ev.pointerId !== pan.pointerId) return;

    const pointerId = pan.pointerId;
    const wasTouch = pan.isTouch;
    pan = null;

    if (els.canvas.hasPointerCapture(pointerId)) {
      els.canvas.releasePointerCapture(pointerId);
    }
    els.canvas.classList.remove('is-panning');

    if (wasTouch) {
      window.removeEventListener('touchmove', preventTouchScroll);
      renderScene();
    }

    if (ev) updateCanvasCursor(ev);
    else els.canvas.style.cursor = 'default';
  }

  function onCanvasPointerUp(ev) {
    if (sortDrag) {
      if (ev.pointerId !== sortDrag.pointerId) return;
      const from = sortDrag.fromIndex;
      const to = sortDrag.targetIndex;
      clearSortDrag();
      if (to >= 0 && to !== from) {
        moveItem(from, to);
      } else {
        renderScene();
      }
      updateCanvasCursor(ev);
      return;
    }

    if (touchCandidate) {
      if (ev.pointerId !== touchCandidate.pointerId) return;
      clearTouchCandidate();
      return;
    }
    endCanvasPan(ev);
  }

  function onCanvasPointerCancel(ev) {
    if (sortDrag) {
      if (ev.pointerId !== sortDrag.pointerId) return;
      clearSortDrag();
      renderScene();
      updateCanvasCursor(ev);
      return;
    }
    clearTouchCandidate();
    endCanvasPan(ev);
  }

  function onCanvasDoubleClick(ev) {
    if (ev.altKey) return;
    const cell = cellUnderPointer(ev);
    if (!cell || !isPannable(cell)) return;
    cell.item.focusX = 0.5;
    cell.item.focusY = 0.5;
    renderScene();
    ev.preventDefault();
  }

  /* ------------------------------------------------------------------ *
   *  UI sync
   * ------------------------------------------------------------------ */

  function fillRange(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--p', p.toFixed(2) + '%');
  }

  function syncNum(input, value) {
    if (document.activeElement === input) return;
    input.value = String(value);
  }

  function syncUI() {
    const n = state.items.length;

    els.countPill.textContent = `${n} / 9`;
    const busy = state.loading || state.exporting || state.copying;
    els.downloadBtn.disabled = n === 0 || busy;
    els.copyBtn.disabled = n === 0 || busy;
    els.dropzone.hidden = n > 0;

    for (const btn of els.modeBtns) {
      const on = btn.dataset.mode === state.mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }

    els.ratioRow.classList.toggle('is-hidden', state.mode !== 'grid');
    for (const btn of els.ratioBtns) {
      const on = btn.dataset.ratio === state.gridRatio;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      if (!btn.dataset.short) btn.dataset.short = btn.textContent.trim();
      btn.textContent = btn.dataset.short;
      const ratio = btn.dataset.ratio;
      const label = ratio === '1:1'
        ? t('ratioSquare')
        : (/^(16:9|4:3)$/.test(ratio) ? t('ratioLand', ratio) : t('ratioPort', ratio));
      btn.title = label;
      btn.setAttribute('aria-label', label);
    }
    els.ratioHint.textContent = state.gridRatio.replace(':', ' : ');

    els.fitRow.classList.toggle('is-hidden', state.mode !== 'grid');
    els.variantRow.classList.toggle('is-hidden', state.mode !== 'grid' || n === 0);
    const dragHint = TOUCH_MODE ? t('dragHintTouch') : t('dragHintMouse');
    els.fitHint.textContent = state.fit === 'cover' ? dragHint : t('fitHintContain');
    for (const chip of els.fitChips) {
      const on = chip.dataset.fit === state.fit;
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    }

    if (n === 0) {
      state.gridVariant = 0;
      els.variantRange.disabled = true;
      els.variantRange.value = '0';
      els.variantHint.textContent = '—';
      els.variantEnd.textContent = '—';
      fillRange(els.variantRange);
    }

    els.gapRange.value = String(state.gap);
    els.borderRange.value = String(state.border);
    els.radiusRange.value = String(state.radius);
    els.outerRadiusRange.value = String(state.outerRadius);
    syncNum(els.gapNum, state.gap);
    syncNum(els.borderNum, state.border);
    syncNum(els.radiusNum, state.radius);
    syncNum(els.outerRadiusNum, state.outerRadius);
    fillRange(els.gapRange);
    fillRange(els.borderRange);
    fillRange(els.radiusRange);
    fillRange(els.outerRadiusRange);

    for (const swatch of $$('.swatch', els.swatches)) {
      swatch.setAttribute('aria-pressed', String(swatch.dataset.color === state.bg));
    }
    const isPreset = PRESETS.some(([value]) => value === state.bg);
    els.customSwatch.parentElement.classList.toggle('is-active', !isPreset);
    els.bgVal.textContent = state.bg === 'transparent' ? t('bgTransparent') : state.bg.toUpperCase();
    if (state.bg === 'transparent') {
      els.customSwatch.classList.add('is-transparent');
      els.customSwatch.style.backgroundColor = '';
    } else {
      els.customSwatch.classList.remove('is-transparent');
      els.customSwatch.style.backgroundColor = state.bg;
    }
    els.colorInput.value = state.bg === 'transparent' ? state.lastColor : state.bg;

    els.resSelect.value = String(state.longSide);

    if (n === 0) {
      els.stageInfo.textContent = t('stageWaiting');
      els.layoutNote.textContent = '—';
      els.outDims.textContent = '—';
    } else {
      const geo = computeGeometry(state.longSide);
      if (geo) {
        const scale = state.longSide / geo.longSide;
        const w = Math.round(geo.totalW * scale);
        const h = Math.round(geo.totalH * scale);
        els.outDims.textContent = `${w} × ${h} px`;
        els.stageInfo.textContent = t('stageInfo', n, t(MODE_LABEL_KEY[state.mode]), w, h);
        els.layoutNote.textContent = state.mode === 'grid'
          ? t('gridNote')
          : (state.mode === 'h' ? t('hNote') : t('vNote'));

        if (state.mode === 'grid') {
          const max = geo.gridVariantMax || 0;
          const pos = geo.gridVariant || 0;
          state.gridVariant = pos;
          els.variantRange.max = String(Math.max(1, max));
          els.variantRange.value = String(pos);
          els.variantRange.disabled = max <= 0;
          els.variantHint.textContent = pos === 0 ? t('variantAuto') : t('variantPos', pos);
          els.variantEnd.textContent = max > 0 ? t('variantPos', max) : t('variantOnly');
          els.variantRow.classList.toggle('is-hidden', max <= 0);
          fillRange(els.variantRange);
        }
      }
    }

    els.uploadHint.textContent = state.loading
      ? els.uploadHint.textContent
      : t('uploadHint');

    document.title = n ? t('titleCount', n) : t('title');
  }

  /* ------------------------------------------------------------------ *
   *  localization
   * ------------------------------------------------------------------ */

  function applyStaticText() {
    const dict = (i18n && i18n.dict[lang]) || {};
    document.documentElement.lang = dict.htmlLang || 'zh-CN';
    document.documentElement.dataset.lang = lang;

    for (const el of $$('[data-i18n]')) {
      const key = el.dataset.i18n;
      const value = t(key);
      if (typeof value === 'string') el.textContent = value;
    }

    for (const el of $$('[data-i18n-title]')) {
      el.title = t(el.dataset.i18nTitle);
    }

    for (const el of $$('[data-i18n-aria]')) {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    }

    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('description'));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', t('title'));
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', t('description'));
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute('content', (dict.ogLocale || 'zh_CN'));
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', t('title'));
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', t('description'));

    for (const opt of $$('#resSelect option')) {
      const key = RES_LABEL_KEY[opt.value];
      if (key) opt.textContent = `${opt.value} · ${t(key)}`;
    }

    const dockNote = $('.dock-note');
    if (dockNote) {
      const bgSpan = document.createElement('span');
      bgSpan.id = 'bgVal';
      bgSpan.textContent = els.bgVal ? els.bgVal.textContent : '#FFFFFF';
      dockNote.textContent = '';
      dockNote.appendChild(document.createTextNode(t('dockNoteBg') + ' '));
      dockNote.appendChild(bgSpan);
      dockNote.appendChild(document.createTextNode(' · ' + t('dockNoteRest')));
      els.bgVal = bgSpan;
    }

    for (const btn of els.ratioBtns) {
      const ratio = btn.dataset.ratio;
      const label = ratio === '1:1'
        ? t('ratioSquare')
        : (/^(16:9|4:3)$/.test(ratio) ? t('ratioLand', ratio) : t('ratioPort', ratio));
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.textContent = btn.dataset.short || btn.textContent.trim();
    }

    const altHint = $('.alt-sort-hint');
    if (altHint) {
      const key = IS_MAC ? '⌥' : t('sortHintKey');
      altHint.innerHTML = '';
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      altHint.appendChild(kbd);
      altHint.appendChild(document.createTextNode(t('sortHintTail')));
    }

    buildSwatches();
  }

  function setLanguage(next, remember = true) {
    if (!i18n || !i18n.dict[next]) return;
    lang = next;
    if (remember) i18n.save(next);
    applyStaticText();
    renderThumbs();
    renderScene();
    syncUI();
    if (els.langSelect && els.langSelect.value !== next) els.langSelect.value = next;
  }

  /* ------------------------------------------------------------------ *
   *  thumbnails & ordering
   * ------------------------------------------------------------------ */

  function clearDropMarks() {
    for (const el of $$('.thumb.drop-target', els.thumbs)) {
      el.classList.remove('drop-target');
    }
  }

  function renderThumbs() {
    els.thumbs.textContent = '';
    const n = state.items.length;

    state.items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'thumb';
      el.draggable = true;
      el.dataset.index = String(index);
      el.title = t('thumbTitle', item.name || t('unknownImage'));

      item.thumb.className = 'thumb-canvas';
      item.thumb.setAttribute('aria-hidden', 'true');
      el.appendChild(item.thumb);

      const indexEl = document.createElement('span');
      indexEl.className = 'thumb-index';
      indexEl.textContent = String(index + 1);
      el.appendChild(indexEl);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'thumb-remove';
      remove.setAttribute('aria-label', t('removeAria', index + 1));
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
      remove.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeItem(index);
      });
      el.appendChild(remove);

      const move = document.createElement('div');
      move.className = 'thumb-move';
      if (index > 0) {
        const prev = document.createElement('button');
        prev.type = 'button';
        prev.textContent = '‹';
        prev.title = t('prevTitle');
        prev.setAttribute('aria-label', t('prevTitle'));
        prev.addEventListener('click', (ev) => {
          ev.stopPropagation();
          moveItem(index, index - 1);
        });
        move.appendChild(prev);
      }
      if (index < n - 1) {
        const next = document.createElement('button');
        next.type = 'button';
        next.textContent = '›';
        next.title = t('nextTitle');
        next.setAttribute('aria-label', t('nextTitle'));
        next.addEventListener('click', (ev) => {
          ev.stopPropagation();
          moveItem(index, index + 1);
        });
        move.appendChild(next);
      }
      if (move.children.length) el.appendChild(move);

      el.addEventListener('dragstart', (ev) => {
        dragFrom = index;
        el.classList.add('dragging');
        ev.dataTransfer.effectAllowed = 'move';
        try { ev.dataTransfer.setData('text/plain', String(index)); } catch (err) { /* noop */ }
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        dragFrom = null;
        clearDropMarks();
      });
      el.addEventListener('dragover', (ev) => {
        if (dragFrom === null) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        el.classList.add('drop-target');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        el.classList.remove('drop-target');
        const raw = ev.dataTransfer.getData('text/plain');
        const from = dragFrom !== null ? dragFrom : parseInt(raw, 10);
        if (Number.isInteger(from)) moveItem(from, index);
        dragFrom = null;
      });

      els.thumbs.appendChild(el);
    });

    if (n > 0 && n < MAX_IMAGES) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'thumb-add';
      add.setAttribute('aria-label', t('addAria'));
      add.innerHTML = '<span class="plus" aria-hidden="true">＋</span><span>添加</span>';
      add.addEventListener('click', () => els.fileInput.click());
      els.thumbs.appendChild(add);
    }
  }

  function moveItem(from, to) {
    const n = state.items.length;
    if (from === to || from < 0 || from >= n || to < 0 || to >= n) {
      dragFrom = null;
      return;
    }
    const [item] = state.items.splice(from, 1);
    state.items.splice(to, 0, item);
    dragFrom = null;
    renderThumbs();
    renderScene();
    syncUI();
  }

  function removeItem(index) {
    const item = state.items[index];
    if (!item) return;
    state.items.splice(index, 1);
    state.gridVariant = 0;
    state.gridPlan = null;
    releaseItem(item);
    dragFrom = null;
    renderThumbs();
    renderScene();
    syncUI();
  }

  function releaseItem(item) {
    try {
      item.canvas.width = 0;
      item.canvas.height = 0;
      item.thumb.width = 0;
      item.thumb.height = 0;
    } catch (err) { /* noop */ }
  }

  /* ------------------------------------------------------------------ *
   *  loading files
   * ------------------------------------------------------------------ */

  async function loadImage(file) {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;

    try {
      await img.decode();
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('decode-failed');
    }

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('empty-image');
    }

    const ratio = Math.min(1, LOAD_MAX / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * ratio));
    const h = Math.max(1, Math.round(naturalH * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(objectUrl);

    // 方形缩略图（cover 裁剪），避免在侧栏里二次解码大图
    const thumb = document.createElement('canvas');
    thumb.width = THUMB_SIZE;
    thumb.height = THUMB_SIZE;
    const tctx = thumb.getContext('2d');
    const cover = Math.max(THUMB_SIZE / w, THUMB_SIZE / h);
    const sw = THUMB_SIZE / cover;
    const sh = THUMB_SIZE / cover;
    tctx.drawImage(canvas, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, THUMB_SIZE, THUMB_SIZE);

    return {
      id: ++uid,
      name: file.name || '未命名图片',
      canvas,
      thumb,
      w,
      h,
      aspect: w / h,
      focusX: 0.5,
      focusY: 0.5
    };
  }

  async function addFiles(fileList) {
    if (state.loading) {
      toast(t('reading'));
      return;
    }

    const files = Array.from(fileList || []).filter(
      (file) => file && typeof file.type === 'string' && file.type.startsWith('image/')
    );

    if (!files.length) {
      toast(t('noImages'));
      return;
    }

    const room = MAX_IMAGES - state.items.length;
    if (room <= 0) {
      toast(t('tooMany'));
      return;
    }

    const picked = files.slice(0, room);
    state.gridVariant = 0;
    state.gridPlan = null;

    state.loading = true;
    els.dropzone.classList.add('loading');
    els.downloadBtn.disabled = true;
    els.copyBtn.disabled = true;
    const hint = els.uploadHint.textContent;

    let failed = 0;
    for (let i = 0; i < picked.length; i++) {
      els.uploadHint.textContent = t('readingProgress', i + 1, picked.length);
      try {
        const item = await loadImage(picked[i]);
        state.items.push(item);
        renderThumbs();
        renderScene();
      } catch (err) {
        failed += 1;
      }
    }

    state.loading = false;
    els.dropzone.classList.remove('loading');
    els.uploadHint.textContent = hint;

    renderThumbs();
    renderScene();
    syncUI();

    if (failed > 0) {
      toast(t('failedSome', failed));
    } else if (files.length > room) {
      toast(t('limitedTo', room));
    } else if (picked.length > 0) {
      toast(t('added', picked.length));
    }
  }

  /* ------------------------------------------------------------------ *
   *  export
   * ------------------------------------------------------------------ */

  function timestamp() {
    const d = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function setExportLabel(btn, text) {
    const label = btn.querySelector('span');
    if (label) label.textContent = text;
  }

  function canExport() {
    return state.items.length > 0 && !state.loading && !state.exporting && !state.copying;
  }

  function buildExportCanvas() {
    const geo = computeGeometry(state.longSide);
    if (!geo) throw new Error('no-geometry');

    const scale = state.longSide / geo.longSide;
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(geo.totalW * scale));
    out.height = Math.max(1, Math.round(geo.totalH * scale));
    paintScene(out.getContext('2d'), geo, scale);
    return out;
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob-failed'));
      }, 'image/png');
    });
  }

  async function buildExportBlob() {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const canvas = buildExportCanvas();
    const blob = await canvasToPngBlob(canvas);
    return { canvas, blob };
  }

  async function download() {
    if (!canExport()) return;

    state.exporting = true;
    syncUI();
    const btn = els.downloadBtn;
    setExportLabel(btn, t('downloadLoading'));

    try {
      const { canvas, blob } = await buildExportBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = t('fileName', timestamp());
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(t('exported', canvas.width, canvas.height));
    } catch (err) {
      console.error(err);
      toast(t('exportFailed'));
    } finally {
      state.exporting = false;
      setExportLabel(btn, t('downloadBtn'));
      syncUI();
    }
  }

  async function copyImage() {
    if (!canExport()) return;
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      toast(t('copyUnsupported'));
      return;
    }

    state.copying = true;
    syncUI();
    const btn = els.copyBtn;
    setExportLabel(btn, t('copyLoading'));

    try {
      const { canvas, blob } = await buildExportBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setExportLabel(btn, t('copyDone'));
      toast(t('copied', canvas.width, canvas.height));
      await new Promise((resolve) => setTimeout(resolve, 900));
    } catch (err) {
      console.error(err);
      toast(t('copyFailed'));
    } finally {
      state.copying = false;
      setExportLabel(btn, t('copyBtn'));
      syncUI();
    }
  }

  /* ------------------------------------------------------------------ *
   *  small helpers
   * ------------------------------------------------------------------ */

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove('show');
    }, 2800);
  }

  function setBg(value, silent) {
    state.bg = value;
    if (value !== 'transparent') state.lastColor = value;
    syncUI();
    if (!silent) requestRender();
  }

  function hasFiles(ev) {
    const dt = ev.dataTransfer;
    if (!dt || !dt.types) return false;
    return Array.from(dt.types).includes('Files');
  }

  function buildSwatches() {
    els.swatches.textContent = '';
    for (const [value, nameKey] of PRESETS) {
      const name = t(COLOR_LABEL_KEY[nameKey]);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch' + (value === 'transparent' ? ' transparent' : '');
      btn.dataset.color = value;
      btn.title = name;
      btn.setAttribute('aria-label', t('swatchAria', name));
      btn.setAttribute('aria-pressed', 'false');
      if (value !== 'transparent') btn.style.backgroundColor = value;
      btn.addEventListener('click', () => setBg(value));
      els.swatches.appendChild(btn);
    }
  }

  /* ------------------------------------------------------------------ *
   *  events
   * ------------------------------------------------------------------ */

  function bindEvents() {
    // file pickers
    els.fileInput.addEventListener('change', () => {
      const files = Array.from(els.fileInput.files || []);
      els.fileInput.value = '';
      if (files.length) addFiles(files);
    });

    const openPicker = () => {
      if (!state.loading) els.fileInput.click();
    };
    els.dropzone.addEventListener('click', openPicker);
    els.dropzone.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openPicker();
      }
    });
    els.empty.addEventListener('click', openPicker);
    els.empty.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openPicker();
      }
    });

    // modes
    for (const btn of els.modeBtns) {
      btn.addEventListener('click', () => {
        if (state.mode === btn.dataset.mode) return;
        state.mode = btn.dataset.mode;
        syncUI();
        renderScene();
      });
    }

    els.variantRange.addEventListener('input', () => {
      state.gridVariant = Number(els.variantRange.value);
      state.gridPlan = null;
      renderScene();
      syncUI();
    });

    for (const btn of els.ratioBtns) {
      btn.addEventListener('click', () => {
        if (state.gridRatio === btn.dataset.ratio) return;
        state.gridRatio = btn.dataset.ratio;
        state.gridVariant = 0;
        state.gridPlan = null;
        renderScene();
        syncUI();
      });
    }

    // sliders + number inputs
    const bindNumberControl = (key, slider, number, min, max) => {
      slider.addEventListener('input', () => {
        state[key] = Number(slider.value);
        if (document.activeElement !== number) number.value = String(state[key]);
        fillRange(slider);
        requestRender();
      });

      const commit = () => {
        const raw = number.value.trim();
        let value = Number(raw);
        if (raw === '' || !Number.isFinite(value)) value = state[key];
        value = clamp(Math.round(value), min, max);
        state[key] = value;
        number.value = String(value);
        slider.value = String(value);
        fillRange(slider);
        requestRender();
      };

      number.addEventListener('input', () => {
        const raw = number.value.trim();
        if (raw === '') return;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < min || value > max) return;
        state[key] = Math.round(value);
        slider.value = String(state[key]);
        fillRange(slider);
        requestRender();
      });

      number.addEventListener('blur', commit);
      number.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          number.blur();
        } else if (ev.key === 'Escape') {
          number.value = String(state[key]);
          number.blur();
        }
      });

      // 首次点击进入时全选，方便直接覆盖输入；再次点击可正常定位光标
      let selectOnMouseUp = false;
      number.addEventListener('focus', () => {
        number.select();
        selectOnMouseUp = true;
      });
      number.addEventListener('mouseup', (ev) => {
        if (!selectOnMouseUp) return;
        ev.preventDefault();
        number.select();
        selectOnMouseUp = false;
      });
      number.addEventListener('blur', () => { selectOnMouseUp = false; });
    };

    bindNumberControl('gap', els.gapRange, els.gapNum, 0, 120);
    bindNumberControl('border', els.borderRange, els.borderNum, 0, 160);
    bindNumberControl('radius', els.radiusRange, els.radiusNum, 0, 120);
    bindNumberControl('outerRadius', els.outerRadiusRange, els.outerRadiusNum, 0, 240);

    // grid fit
    for (const chip of els.fitChips) {
      chip.addEventListener('click', () => {
        state.fit = chip.dataset.fit;
        syncUI();
        renderScene();
      });
    }

    // drag inside grid cells to choose the visible crop
    els.canvas.addEventListener('pointerdown', onCanvasPointerDown);
    els.canvas.addEventListener('pointermove', onCanvasPointerMove);
    els.canvas.addEventListener('pointerup', onCanvasPointerUp);
    els.canvas.addEventListener('pointercancel', onCanvasPointerCancel);

    els.canvas.addEventListener('pointerenter', (ev) => {
      if (ev.pointerType === 'touch') return;
      markCanvasHot();
    });
    els.canvas.addEventListener('pointermove', (ev) => {
      if (ev.pointerType === 'touch' || handlesHot) return;
      if (!els.canvas.matches(':hover')) return;
      markCanvasHot();
    });

    els.cellHandles.addEventListener('pointerdown', (ev) => {
      const btn = ev.target.closest('.cell-handle');
      if (!btn || ev.button !== 0) return;
      const index = Number(btn.dataset.index);
      ev.preventDefault();
      ev.stopPropagation();
      startSortDrag(ev, index);
    });
    els.canvas.addEventListener('pointerleave', (ev) => {
      if (ev.pointerType !== 'touch') releaseCanvasHot();
      if (sortDrag) {
        sortDrag.targetIndex = -1;
        renderScene();
        return;
      }
      if (!pan && !touchCandidate) els.canvas.style.cursor = 'default';
    });
    els.canvas.addEventListener('contextmenu', (ev) => {
      if (pan || touchCandidate) ev.preventDefault();
    });
    els.canvas.addEventListener('dblclick', onCanvasDoubleClick);
    window.addEventListener('blur', () => {
      clearTouchCandidate();
      endCanvasPan();
      if (sortDrag) {
        clearSortDrag();
        renderScene();
      }
    });

    // color
    els.colorInput.addEventListener('input', () => {
      setBg(els.colorInput.value, true);
      requestRender();
    });

    // resolution
    els.resSelect.addEventListener('change', () => {
      state.longSide = Number(els.resSelect.value);
      renderScene();
      syncUI();
    });

    // export
    els.downloadBtn.addEventListener('click', download);
    els.copyBtn.addEventListener('click', copyImage);

    // language
    if (els.langSelect) {
      els.langSelect.addEventListener('change', () => setLanguage(els.langSelect.value));
    }

    // reset / clear
    els.resetBtn.addEventListener('click', () => {
      Object.assign(state, DEFAULTS);
      state.lastColor = DEFAULTS.bg;
      renderThumbs();
      renderScene();
      syncUI();
      toast(t('resetDone'));
    });

    els.clearBtn.addEventListener('click', () => {
      if (!state.items.length) {
        toast(t('nothingToClear'));
        return;
      }
      for (const item of state.items) releaseItem(item);
      state.items = [];
      state.gridVariant = 0;
      state.gridPlan = null;
      dragFrom = null;
      renderThumbs();
      renderScene();
      syncUI();
      toast(t('cleared'));
    });

    // drag & drop anywhere on the page
    els.stage.addEventListener('dragenter', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      dragDepth += 1;
      els.stage.classList.add('is-drag');
    });
    els.stage.addEventListener('dragover', (ev) => {
      if (hasFiles(ev)) ev.preventDefault();
    });
    els.stage.addEventListener('dragleave', (ev) => {
      if (!hasFiles(ev) && dragDepth === 0) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) els.stage.classList.remove('is-drag');
    });
    document.addEventListener('dragleave', (ev) => {
      if (ev.relatedTarget === null) {
        dragDepth = 0;
        els.stage.classList.remove('is-drag');
      }
    });
    window.addEventListener('blur', () => {
      dragDepth = 0;
      els.stage.classList.remove('is-drag');
    });
    window.addEventListener('dragover', (ev) => {
      if (hasFiles(ev)) ev.preventDefault();
    });
    window.addEventListener('drop', (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      dragDepth = 0;
      els.stage.classList.remove('is-drag');
      addFiles(ev.dataTransfer.files);
    });

    // paste
    window.addEventListener('paste', (ev) => {
      if (!ev.clipboardData) return;
      const files = Array.from(ev.clipboardData.files || []).filter(
        (file) => file.type && file.type.startsWith('image/')
      );
      if (files.length) {
        ev.preventDefault();
        addFiles(files);
      }
    });

    // keyboard shortcut: Esc removes drag highlight
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        dragDepth = 0;
        els.stage.classList.remove('is-drag');
      }
    });

    window.addEventListener('resize', () => {
      renderScene();
    });
  }

  /* ------------------------------------------------------------------ *
   *  boot
   * ------------------------------------------------------------------ */

  function init() {
    document.documentElement.classList.toggle('touch-mode', TOUCH_MODE);
    if (els.langSelect && i18n) {
      els.langSelect.textContent = '';
      for (const code of i18n.order) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = i18n.dict[code].label;
        opt.setAttribute('lang', i18n.dict[code].htmlLang);
        els.langSelect.appendChild(opt);
      }
      els.langSelect.value = lang;
    }
    applyStaticText();
    bindEvents();
    renderThumbs();
    renderScene();
    syncUI();

    els.gapRange.value = String(DEFAULTS.gap);
    els.borderRange.value = String(DEFAULTS.border);
    els.radiusRange.value = String(DEFAULTS.radius);
    els.outerRadiusRange.value = String(DEFAULTS.outerRadius);
    fillRange(els.gapRange);
    fillRange(els.borderRange);
    fillRange(els.radiusRange);
    fillRange(els.outerRadiusRange);
  }

  init();

  // 便于调试 / 自动化测试
  window.__collage = { state, computeGeometry, renderScene, syncUI, setLanguage, getLang: () => lang };
})();
