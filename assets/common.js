/* ===================================================================
 * 公共层：配置、请求、格式化、导航、Mock
 * 依赖 config.js（必须先加载）
 * =================================================================== */
(function (global) {
  'use strict';

  var CFG = Object.assign({
    apiBase: '',
    apiToken: '',
    siteName: 'TACZ PVP',
    serverName: 'TACZ PVP 战场',
    skinProxy: '',
    skinSources: ['https://mc-heads.net/skin/{name}', 'https://minotar.net/skin/{name}'],
    refreshSeconds: 20,
    killsLimit: 120,
    timezone: '',
    forceMock: false,
  }, global.TACZ_CONFIG || {});

  CFG.apiBase = String(CFG.apiBase || '').replace(/\/+$/, '');
  CFG.siteName = String(CFG.siteName || '');
  CFG.serverName = String(CFG.serverName || '');

  /* ---------------- 工具 ---------------- */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNum(n) {
    var v = Number(n || 0);
    return Number.isFinite(v) ? v.toLocaleString('en-US') : '0';
  }

  function fmtKd(v) {
    var n = Number(v || 0);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(2);
  }

  function fmtDuration(sec) {
    var s = Math.max(0, Number(sec || 0));
    if (s <= 0) return '0h 0m';
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h >= 100) return h + 'h';
    return h + 'h ' + m + 'm';
  }

  function fmtTime(ts) {
    var n = Number(ts || 0);
    if (!n) return '—';
    var opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (CFG.timezone) opts.timeZone = CFG.timezone;
    try {
      return new Intl.DateTimeFormat('zh-CN', opts).format(new Date(n * 1000));
    } catch (e) {
      return '—';
    }
  }

  function fmtClock() {
    var opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    if (CFG.timezone) opts.timeZone = CFG.timezone;
    try {
      return new Intl.DateTimeFormat('zh-CN', opts).format(new Date());
    } catch (e) {
      return '';
    }
  }

  function query(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* ---------------- 请求层 ---------------- */

  var cache = new Map();
  var CACHE_TTL = 3000;
  var TIMEOUT = 4000;

  function apiUrl(path, params) {
    var url = CFG.apiBase + path;
    var pairs = [];
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    });
    return pairs.length ? url + '?' + pairs.join('&') : url;
  }

  /**
   * GET 后端接口。
   * @returns {Promise<{ok:boolean,status:number,data:any,error?:string}>}
   */
  function apiGet(path, params) {
    var url = apiUrl(path, params);
    var hit = cache.get(url);
    if (hit && Date.now() - hit.t < CACHE_TTL) {
      return Promise.resolve(hit.res);
    }

    var headers = { Accept: 'application/json' };
    if (CFG.apiToken) headers['X-Api-Token'] = CFG.apiToken;

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;

    return fetch(url, { headers: headers, signal: ctrl ? ctrl.signal : undefined, mode: 'cors' })
      .then(function (res) {
        return res.json()
          .catch(function () { return null; })
          .then(function (data) {
            var out = { ok: res.ok, status: res.status, data: data };
            if (res.ok) cache.set(url, { t: Date.now(), res: out });
            else out.error = 'HTTP ' + res.status;
            return out;
          });
      })
      .catch(function (err) {
        return {
          ok: false,
          status: 0,
          data: null,
          error: err && err.name === 'AbortError' ? '请求超时' : '无法连接后端',
        };
      })
      .then(function (out) {
        if (timer) clearTimeout(timer);
        return out;
      });
  }

  /* ---------------- 导航 ---------------- */

  function headerHTML(active) {
    function item(key, href, label) {
      var on = active === key;
      var cls = on
        ? 'bg-ember/15 text-ember shadow-[inset_0_0_0_1px_rgba(251,191,36,.22)]'
        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200';
      return '<a href="' + href + '" class="rounded-md px-2 py-1.5 text-[11px] font-medium transition sm:px-2.5 sm:text-xs ' + cls + '">' + label + '</a>';
    }

    return ''
      + '<header class="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">'
      + '  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-5 lg:px-8">'
      + '    <a href="index.html" class="group flex min-w-0 items-center gap-2.5 sm:gap-3">'
      + '      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-ember/30 bg-ember/10 text-sm font-extrabold text-ember transition group-hover:border-ember/60 group-hover:bg-ember/20">T</div>'
      + '      <div class="min-w-0 leading-tight">'
      + '        <div class="truncate text-[10px] font-semibold tracking-[0.24em] text-ember/80 sm:tracking-[0.28em]">'
      + '          <span class="hidden sm:inline">TACZ // COMBAT RECORDS</span>'
      + '          <span class="sm:hidden">TACZ // RECORDS</span>'
      + '        </div>'
      + '        <div class="hidden truncate text-xs text-slate-500 sm:block">' + esc(CFG.siteName) + '</div>'
      + '      </div>'
      + '    </a>'
      + '    <div class="flex shrink-0 items-center gap-2 text-xs sm:gap-3">'
      + '      <nav class="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">'
      + item('index', 'index.html', '战绩总览')
      + item('kills', 'kills.html', '全局击杀')
      + '      </nav>'
      + '      <span class="hidden h-4 w-px bg-white/10 sm:block"></span>'
      + '      <span class="flex items-center gap-2">'
      + '        <span class="relative flex h-2 w-2">'
      + '          <span id="hdr-dot" class="relative inline-flex h-2 w-2 rounded-full bg-slate-500"></span>'
      + '        </span>'
      + '        <span id="hdr-online" class="hidden sm:inline text-slate-500">连接中</span>'
      + '      </span>'
      + '      <span class="hidden text-slate-600 lg:inline">|</span>'
      + '      <span id="hdr-updated" class="hidden text-slate-500 lg:inline">数据更新 —</span>'
      + '    </div>'
      + '  </div>'
      + '</header>';
  }

  function mountHeader(active) {
    var host = document.getElementById('site-header');
    if (host) host.innerHTML = headerHTML(active);
  }

  function updateHeader(online, updated, mock) {
    var dot = document.getElementById('hdr-dot');
    var label = document.getElementById('hdr-online');
    var stamp = document.getElementById('hdr-updated');

    var tone = mock ? 'bg-amber-400' : (online ? 'bg-emerald-400' : 'bg-rose-500');

    if (dot) {
      dot.className = 'relative inline-flex h-2 w-2 rounded-full ' + tone;
      var ping = dot.parentNode.querySelector('.animate-ping');
      if (online && !mock && !ping) {
        var halo = document.createElement('span');
        halo.className = 'absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60';
        dot.parentNode.insertBefore(halo, dot);
      }
      if ((!online || mock) && ping) ping.remove();
    }
    if (label) {
      label.textContent = mock ? '演示数据' : (online ? '服务器在线' : '服务器离线');
      label.className = 'hidden sm:inline ' + (mock ? 'text-amber-300' : (online ? 'text-emerald-300' : 'text-rose-400'));
    }
    if (stamp) stamp.textContent = '数据更新 ' + (updated || '—');
  }

  function showMockBanner(message) {
    var el = document.getElementById('mock-banner');
    if (!el) return;
    el.innerHTML = ''
      + '<span class="font-semibold tracking-wide">演示数据</span>'
      + '<span class="text-amber-200/60">' + esc(message || '未能连接到后端，当前展示的是内置演示内容。检查 config.js 里的 apiBase。') + '</span>';
    el.classList.remove('hidden');
  }

  /* ---------------- 头像 ---------------- */

  /** 头像图片地址：本地 skins/ 优先，失败后由 error 监听切到远端。 */
  function faceHTML(name, size) {
    var n = String(name || '');
    if (!n) return '<span class="face" style="--fs:' + size + 'px"></span>';
    var local = 'skins/' + encodeURIComponent(n) + '.png';
    var remote = global.Skin ? global.Skin.remoteUrl(n) : '';
    return ''
      + '<span class="face" style="--fs:' + size + 'px" data-initial="' + esc(n) + '">'
      + '<img src="' + esc(local) + '"' + (remote ? ' data-fb="' + esc(remote) + '"' : '') + ' alt="" loading="lazy" decoding="async">'
      + '</span>';
  }

  // 图片统一兜底：先换远端，再退回首字母
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var fb = img.getAttribute('data-fb');
    if (fb) {
      img.removeAttribute('data-fb');
      img.src = fb;
      return;
    }
    var holder = img.closest ? img.closest('.face') : null;
    if (holder && !holder.getAttribute('data-failed')) {
      holder.setAttribute('data-failed', '1');
      var initial = (holder.getAttribute('data-initial') || '?').trim().slice(0, 1).toUpperCase() || '?';
      img.remove();
      var span = document.createElement('span');
      span.className = 'ini';
      span.textContent = initial;
      holder.appendChild(span);
    }
  }, true);

  /* ---------------- Mock ---------------- */

  var NOW = function () { return Math.floor(Date.now() / 1000); };

  var MOCK_NAMES = ['GoTuPian', 'derp_scout', 'Kestrel', 'Nova_2077', 'Ash', 'Vulture', 'Mako', 'Rin'];

  var MOCK = {
    status: function () {
      return {
        siteName: CFG.siteName,
        serverName: CFG.serverName || 'TACZ PVP 战场',
        online: true,
        botOnline: true,
        lastSnapshotAt: NOW() - 6,
        players: MOCK_NAMES.slice(0, 5),
        playerCount: 5,
        maxPlayers: 20,
        ping: 32,
        version: '1.20.1',
        motd: 'TACZ PVP · 演示数据',
        totalPlayers: 37,
        totalKills: 1284,
      };
    },
    player: function (name) {
      if (!name) name = MOCK_NAMES[0];
      var kills = 30 + (name.length * 7) % 40;
      var deaths = 10 + (name.length * 3) % 18;
      return {
        found: true,
        online: true,
        kd: deaths ? kills / deaths : kills,
        player: {
          uuid: 'mock-' + name,
          name: name,
          score: String(kills * 3),
          kills: kills,
          deaths: deaths,
          assists: 8,
          headshots: Math.round(kills * 0.27),
          revenges: 3,
          playTimeSeconds: 3600 * 6 + 1200,
          updatedAt: NOW() - 30,
        },
        recentKills: [
          { killer: name, victim: 'Vulture', weapon: 'AK-47', isHeadshot: true, timestamp: NOW() - 90, killerUuid: 'mock-' + name },
          { killer: 'Mako', victim: name, weapon: 'M4A1', isHeadshot: false, timestamp: NOW() - 260, killerUuid: 'mock-Mako' },
          { killer: name, victim: 'Ash', weapon: 'Kar98K', isHeadshot: true, timestamp: NOW() - 600, killerUuid: 'mock-' + name },
        ],
      };
    },
    kills: function (limit) {
      var weapons = ['AK-47', 'M4A1', 'Kar98K', 'MP5', 'Desert Eagle', 'M870', 'SCAR-L'];
      var list = [];
      var total = Math.min(Math.max(limit || 120, 20), 200);
      for (var i = 0; i < total; i++) {
        var k = MOCK_NAMES[(i * 3) % MOCK_NAMES.length];
        var v = MOCK_NAMES[(i * 3 + 5) % MOCK_NAMES.length];
        if (v === k) v = MOCK_NAMES[(i + 1) % MOCK_NAMES.length];
        list.push({
          id: 100000 - i,
          killer: k,
          killerUuid: 'mock-' + k,
          victim: v,
          victimUuid: 'mock-' + v,
          weapon: weapons[i % weapons.length],
          isHeadshot: i % 4 === 0,
          timestamp: NOW() - 45 - i * 137,
        });
      }
      return { kills: list, count: list.length };
    },
    board: function () {
      var rows = MOCK_NAMES.map(function (n, i) {
        return { name: n, kills: 120 - i * 9, deaths: 40 + i * 4, uuid: 'mock-' + n };
      });
      return { players: rows, count: rows.length };
    },
  };

  /* ---------------- 对外 ---------------- */

  global.TACZ = {
    CFG: CFG,
    esc: esc,
    fmtNum: fmtNum,
    fmtKd: fmtKd,
    fmtDuration: fmtDuration,
    fmtTime: fmtTime,
    fmtClock: fmtClock,
    query: query,
    apiGet: apiGet,
    mountHeader: mountHeader,
    updateHeader: updateHeader,
    showMockBanner: showMockBanner,
    faceHTML: faceHTML,
    MOCK: MOCK,
  };
})(window);
