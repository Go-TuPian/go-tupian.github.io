/* ===================================================================
 * 皮肤层：解析、缓存、手臂判定、3D 舞台
 *
 * 静态站没有服务端代理，取图顺序为
 *   skins/[玩家名].png  →  config.skinProxy  →  第三方源  →  assets/steve.png
 * 取到图后在浏览器里直接读像素判断细/粗手臂，与 PHP 版算法一致。
 * =================================================================== */
(function (global) {
  'use strict';

  var CFG = (global.TACZ && global.TACZ.CFG) || global.TACZ_CONFIG || {};
  var PLACEHOLDER = 'assets/steve.png';
  var IMG_TIMEOUT = 6000;

  /* ---------------- 候选地址 ---------------- */

  /** 皮肤代理地址：显式配置优先，否则用 Go 后端的 /api/skin（后端有 CORS 与磁盘缓存）。 */
  function proxyBase() {
    var base = String(CFG.skinProxy || '').trim();
    if (base) return base;
    if (CFG.apiBase) return String(CFG.apiBase).replace(/\/+$/, '') + '/api/skin';
    return '';
  }

  /** 图片请求带不了自定义头，token 只能走查询参数（后端两种都认）。 */
  function withToken(url) {
    if (!CFG.apiToken) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(CFG.apiToken);
  }

  function templates() {
    var list = [];
    var base = proxyBase();
    if (base) {
      list.push({
        source: 'proxy',
        url: function (n) {
          return withToken(base + (base.indexOf('?') === -1 ? '?' : '&') + 'name=' + encodeURIComponent(n));
        },
      });
    }
    (CFG.skinSources || []).forEach(function (tpl) {
      if (!tpl) return;
      list.push({
        source: 'remote',
        url: function (n) { return String(tpl).replace('{name}', encodeURIComponent(n)); },
      });
    });
    return list;
  }

  /** 头像兜底用的远端地址（同步，取第一个模板） */
  function remoteUrl(name) {
    var list = templates();
    return list.length ? list[0].url(name) : '';
  }

  /* ---------------- 加载 ---------------- */

  function fetchBlob(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, IMG_TIMEOUT) : null;
    return fetch(url, { mode: 'cors', signal: ctrl ? ctrl.signal : undefined, cache: 'force-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var type = res.headers.get('content-type') || '';
        if (type && type.indexOf('image/') === -1) throw new Error('not image');
        return res.blob();
      })
      .then(function (blob) {
        if (blob.size < 200) throw new Error('too small');
        return blob;
      })
      .then(function (blob) {
        if (timer) clearTimeout(timer);
        return blob;
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  /* ---------------- 手臂判定 ---------------- */

  /**
   * 与 skin_lib.php 的 skin_detect_model 等价：
   * 64x32 老皮肤直接 classic；四个采样区任一「全透明」或「四区全透明 / 全白」判 slim。
   */
  function detectModel(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return 'classic';
    if (h < 64) return 'classic';

    var scale = w / 64;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'classic';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);

    var data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      return 'classic'; // 读不到像素就按粗手臂处理
    }

    var zones = [[50, 16, 2, 4], [54, 20, 2, 12], [42, 48, 2, 4], [46, 52, 2, 12]];

    function regionAll(zone, test) {
      var x0 = Math.round(zone[0] * scale);
      var y0 = Math.round(zone[1] * scale);
      var x1 = Math.min(w, Math.round((zone[0] + zone[2]) * scale));
      var y1 = Math.min(h, Math.round((zone[1] + zone[3]) * scale));
      if (x1 <= x0 || y1 <= y0) return false;

      for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
          var o = (y * w + x) * 4;
          var r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
          if (!test(r, g, b, a)) return false;
        }
      }
      return true;
    }

    var isClear = function (r, g, b, a) { return r === 0 && g === 0 && b === 0 && a === 0; };
    var isAlpha = function (r, g, b, a) { return a === 0; };
    var isWhite = function (r, g, b, a) { return r === 255 && g === 255 && b === 255 && a === 255; };

    for (var i = 0; i < zones.length; i++) {
      if (regionAll(zones[i], isClear)) return 'slim';
    }

    var allAlpha = true;
    var allWhite = true;
    for (var j = 0; j < zones.length; j++) {
      if (allAlpha && !regionAll(zones[j], isAlpha)) allAlpha = false;
      if (allWhite && !regionAll(zones[j], isWhite)) allWhite = false;
    }
    return (allAlpha || allWhite) ? 'slim' : 'classic';
  }

  /* ---------------- 解析（带内存缓存） ---------------- */

  var cache = new Map();
  var metaKey = 'tacz-skin-meta-v1';

  function readMeta() {
    try {
      return JSON.parse(localStorage.getItem(metaKey) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeMeta(name, model) {
    try {
      var all = readMeta();
      all[name] = { model: model, ts: Math.floor(Date.now() / 1000) };
      localStorage.setItem(metaKey, JSON.stringify(all));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function cachedMeta(name) {
    var row = readMeta()[name];
    // 24 小时过期
    if (row && row.ts && Date.now() / 1000 - row.ts < 86400) return row.model;
    return '';
  }

  /**
   * @returns {Promise<{url:string, model:string, source:string, found:boolean}>}
   */
  function resolve(name) {
    var key = String(name || '');
    if (!key) return Promise.resolve({ url: PLACEHOLDER, model: 'classic', source: 'placeholder', found: false });
    if (cache.has(key)) return Promise.resolve(cache.get(key));

    var candidates = [{ source: 'skins', url: function (n) { return 'skins/' + encodeURIComponent(n) + '.png'; } }]
      .concat(templates());

    var idx = 0;

    function next() {
      if (idx >= candidates.length) {
        var miss = { url: PLACEHOLDER, model: cachedMeta(key) || 'classic', source: 'placeholder', found: false };
        cache.set(key, miss);
        return Promise.resolve(miss);
      }
      var cand = candidates[idx++];
      var url;
      try {
        url = cand.url(key);
      } catch (e) {
        return next();
      }
      return fetchBlob(url)
        .then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          return loadImage(objectUrl).then(function (img) {
            var model = detectModel(img);
            var out = { url: objectUrl, model: model, source: cand.source, found: true };
            writeMeta(key, model);
            cache.set(key, out);
            return out;
          });
        })
        .catch(function () { return next(); });
    }

    return next();
  }

  /* ---------------- 舞台 ---------------- */

  function webglReady() {
    try {
      var c = document.createElement('canvas');
      return !!(global.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  /**
   * 初始化右侧角色预览。
   * @param {{name:string, onModel:Function, onSource:Function}} opts
   */
  function initStage(opts) {
    opts = opts || {};
    var name = String(opts.name || '');

    var stage = document.getElementById('skin-stage');
    var canvas = document.getElementById('skin-canvas');
    var flat = document.getElementById('skin-flat');
    var doll = document.getElementById('doll');
    var loading = document.getElementById('skin-loading');
    var emptyTip = document.getElementById('skin-empty');
    var hint3d = document.getElementById('hint3d');
    var hint2d = document.getElementById('hint2d');
    var modelBadge = document.getElementById('model-badge');
    var sourceBadge = document.getElementById('source-badge');
    var btnRotate = document.querySelectorAll('[data-act="rotate"]');
    var btnReset = document.querySelectorAll('[data-act="reset"]');

    function paintDoll(url, slim) {
      if (!doll) return;
      doll.style.setProperty('--skin-img', 'url("' + (url || PLACEHOLDER) + '")');
      doll.dataset.slim = slim ? '1' : '0';
    }

    function setModelBadge(model) {
      if (!modelBadge) return;
      var slim = model === 'slim';
      modelBadge.textContent = slim ? '细手臂 SLIM' : '粗手臂 CLASSIC';
      modelBadge.className = 'rounded border px-2 py-1 text-[10px] font-medium tracking-wide ' + (slim
        ? 'border-sky-400/30 bg-sky-400/10 text-sky-300'
        : 'border-white/10 bg-white/[0.03] text-slate-400');
      if (opts.onModel) opts.onModel(model);
    }

    function setSourceBadge(source, found) {
      if (sourceBadge) {
        var map = {
          skins: ['本地皮肤', 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'],
          proxy: ['已缓存', 'border-white/10 bg-white/[0.03] text-slate-400'],
          remote: ['官方皮肤', 'border-white/10 bg-white/[0.03] text-slate-400'],
        };
        var hit = map[source] || ['占位模型', 'border-amber-400/25 bg-amber-400/10 text-amber-300'];
        sourceBadge.textContent = hit[0];
        sourceBadge.className = 'hidden rounded border px-2 py-1 text-[10px] font-medium tracking-wide sm:inline ' + hit[1];
      }
      if (emptyTip) {
        if (found) {
          emptyTip.classList.add('hidden');
          emptyTip.classList.remove('flex');
        } else {
          emptyTip.classList.remove('hidden');
          emptyTip.classList.add('flex');
        }
      }
      if (opts.onSource) opts.onSource(source, found);
    }

    function useFlat() {
      if (flat) flat.classList.remove('hidden');
      if (canvas) canvas.classList.add('hidden');
      if (loading) loading.style.display = 'none';
      if (hint3d) hint3d.classList.add('hidden');
      if (hint2d) hint2d.classList.remove('hidden');
      document.querySelectorAll('[data-act]').forEach(function (b) { b.classList.add('hidden'); });
    }

    // 先用缓存里的模型画 2D，避免空白
    var guess = cachedMeta(name) || 'classic';
    paintDoll(PLACEHOLDER, guess === 'slim');
    setModelBadge(guess);
    setSourceBadge('', false);

    if (!name) {
      if (loading) loading.style.display = 'none';
      return;
    }

    if (!webglReady() || typeof global.skinview3d === 'undefined') {
      useFlat();
      resolve(name).then(function (s) {
        paintDoll(s.url, s.model === 'slim');
        setModelBadge(s.model);
        setSourceBadge(s.source, s.found);
      });
      return;
    }

    function size() {
      var r = stage.getBoundingClientRect();
      return { w: Math.max(240, Math.round(r.width)), h: Math.max(240, Math.round(r.height)) };
    }

    var s0 = size();
    var viewer;
    try {
      viewer = new global.skinview3d.SkinViewer({
        canvas: canvas,
        width: s0.w,
        height: s0.h,
        model: 'auto-detect',
        enableControls: true,
        zoom: global.innerWidth < 640 ? 0.74 : 0.88,
        fov: 42,
        background: null,
        animation: new global.skinview3d.IdleAnimation(),
      });
    } catch (e) {
      useFlat();
      resolve(name).then(function (s) {
        paintDoll(s.url, s.model === 'slim');
        setModelBadge(s.model);
        setSourceBadge(s.source, s.found);
      });
      return;
    }

    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.7;
    viewer.renderer.setClearColor(0x000000, 0);
    global.__skinViewer = viewer; // 便于控制台排查尺寸/相机

    function applyCamera() {
      var d = viewer.camera.position.length() || 30;
      viewer.camera.position.set(0.24, 0.10, 1).normalize().multiplyScalar(d);
      viewer.controls.target.set(0, 1.8, 0);
      viewer.controls.update();
    }
    applyCamera();

    function reveal() {
      if (loading) loading.style.display = 'none';
      if (canvas) canvas.classList.remove('hidden');
      if (flat) flat.classList.add('hidden');
      if (hint2d) hint2d.classList.add('hidden');
      if (hint3d) hint3d.classList.remove('hidden');
    }

    function applySkin(skin) {
      paintDoll(skin.url, skin.model === 'slim');
      setModelBadge(skin.model);
      setSourceBadge(skin.source, skin.found);
      viewer.loadSkin(skin.url, { model: 'auto-detect' })
        .then(function () {
          reveal();
          var t = viewer.playerObject && viewer.playerObject.skin ? viewer.playerObject.skin.modelType : null;
          if (t) setModelBadge(t);
        })
        .catch(function () {
          // 3D 加载失败不挡着看：保留 2D
          useFlat();
        });
    }

    resolve(name).then(applySkin).catch(function () {
      useFlat();
    });

    var timer = null;
    function resize() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var s = size();
        viewer.setSize(s.w, s.h);
        viewer.adjustCameraDistance();
        applyCamera();
      }, 120);
    }
    if (global.ResizeObserver) new global.ResizeObserver(resize).observe(stage);
    else global.addEventListener('resize', resize);

    btnRotate.forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewer.autoRotate = !viewer.autoRotate;
        btnRotate.forEach(function (b) { b.dataset.on = viewer.autoRotate ? '1' : '0'; });
      });
    });

    btnReset.forEach(function (btn) {
      btn.addEventListener('click', function () {
        viewer.playerWrapper.rotation.y = 0;
        viewer.resetCameraPose();
        viewer.zoom = global.innerWidth < 640 ? 0.74 : 0.88;
        applyCamera();
      });
    });
  }

  global.Skin = {
    remoteUrl: remoteUrl,
    resolve: resolve,
    detectModel: detectModel,
    initStage: initStage,
    PLACEHOLDER: PLACEHOLDER,
  };
})(window);
