/* ===================================================================
 * 全局击杀流水页
 * =================================================================== */
(function () {
  'use strict';

  var T = window.TACZ;
  var CFG = T.CFG;

  T.mountHeader('kills');

  var apiLabel = document.getElementById('api-base-label');
  if (apiLabel) apiLabel.textContent = CFG.apiBase || '（未配置 apiBase）';
  var footSite = document.getElementById('footer-site');
  if (footSite) footSite.textContent = CFG.siteName + ' · ' + new Date().getFullYear();

  var LIMITS = [60, 120, 200];
  var limit = parseInt(T.query('limit'), 10);
  if (LIMITS.indexOf(limit) === -1) limit = LIMITS.indexOf(CFG.killsLimit) !== -1 ? CFG.killsLimit : 120;

  var lastStatus = null;
  var lastKills = [];
  var busy = false;

  document.title = '全局击杀 · ' + (CFG.serverName || CFG.siteName);

  /* ---------------- 列表 ---------------- */

  function renderRows(kills) {
    if (!kills || !kills.length) {
      return '<div class="px-5 py-20 text-center">'
        + '<div class="text-sm text-slate-500">暂无击杀记录</div>'
        + '<div class="mt-1 text-xs text-slate-600">服务器产生 PvP 击杀后会自动出现在这里</div>'
        + '</div>';
    }

    var now = Math.floor(Date.now() / 1000);

    return kills.map(function (k) {
      var fresh = k.timestamp > 0 && (now - k.timestamp) <= 90;
      var time = '<div class="num text-[11px] ' + (fresh ? 'text-ember/90' : 'text-slate-600') + '">' + T.fmtTime(k.timestamp) + '</div>';

      var weapon = k.weapon
        ? '<span class="shrink-0 rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-400">' + T.esc(k.weapon) + '</span>'
        : '';
      var hs = k.isHeadshot
        ? '<span class="shrink-0 rounded border border-ember/30 bg-ember/10 px-1 py-0.5 text-[9px] font-bold tracking-wider text-ember">HS</span>'
        : '';

      return '<div class="group relative flex gap-3 border-b border-white/[0.03] px-4 py-3 transition hover:bg-white/[0.02] sm:gap-4 sm:px-5">'
        + '<span class="absolute left-0 top-0 h-full w-px ' + (fresh ? 'bg-ember/45' : 'bg-white/[0.04]') + '"></span>'
        + '<div class="w-10 shrink-0 pt-1 text-right sm:w-12">' + time + '</div>'
        + '<div class="min-w-0 flex-1">'
        + '  <div class="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1.5">'
        + '    <div class="flex min-w-0 items-center gap-1.5">'
        + '      <a href="index.html?name=' + encodeURIComponent(k.killer || '') + '" class="flex min-w-0 items-center gap-1.5 transition hover:opacity-80">'
        + T.faceHTML(k.killer, 22)
        + '        <span class="truncate text-[13px] font-semibold text-slate-100 sm:text-sm">' + T.esc(k.killer) + '</span>'
        + '      </a>' + weapon + hs
        + '    </div>'
        + '    <span class="hidden shrink-0 text-ember/40 sm:inline">›</span>'
        + '    <div class="flex min-w-0 items-center gap-1.5">'
        + '      <span class="shrink-0 text-[11px] text-ember/40 sm:hidden">↳</span>'
        + '      <a href="index.html?name=' + encodeURIComponent(k.victim || '') + '" class="flex min-w-0 items-center gap-1.5 opacity-90 transition hover:opacity-100">'
        + T.faceHTML(k.victim, 22)
        + '        <span class="truncate text-[13px] text-slate-400 sm:text-sm">' + T.esc(k.victim) + '</span>'
        + '      </a>'
        + '    </div>'
        + '  </div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  /* ---------------- 统计 ---------------- */

  function renderStats(kills, status) {
    var headshots = 0;
    var fighters = {};

    kills.forEach(function (k) {
      if (k.isHeadshot) headshots++;
      if (k.killer) fighters[k.killer] = true;
      if (k.victim) fighters[k.victim] = true;
    });

    var rate = kills.length ? Math.round(headshots / kills.length * 100) : 0;
    var count = Object.keys(fighters).length;

    document.getElementById('kpi-hs').innerHTML = rate + '<span class="text-sm font-medium">%</span>';
    document.getElementById('kpi-fighters').textContent = count;

    if (status) {
      document.getElementById('kpi-total').textContent = T.fmtNum(status.totalKills || 0);
      var online = document.getElementById('kpi-online');
      online.textContent = T.fmtNum(status.playerCount || 0);
      online.className = 'mt-1 num text-xl font-bold ' + (status.online ? 'text-emerald-300' : 'text-rose-400');
    }

    var sub = document.getElementById('feed-subtitle');
    if (sub) sub.textContent = '服务器内最近 ' + kills.length + ' 条 PvP 记录，按时间倒序 · 每 ' + CFG.refreshSeconds + ' 秒自动刷新';

    var badge = document.getElementById('feed-count');
    if (badge) badge.textContent = '最近 ' + kills.length + ' 条';
  }

  /* ---------------- 排行榜 ---------------- */

  function renderBoard(players) {
    var host = document.getElementById('board');
    if (!host) return;

    if (!players || !players.length) {
      host.innerHTML = '<div class="px-5 py-12 text-center text-sm text-slate-500">暂无排行数据</div>';
      return;
    }

    host.innerHTML = players.slice(0, 10).map(function (row, i) {
      var kills = Number(row.kills || 0);
      var deaths = Number(row.deaths || 0);
      var kd = deaths > 0 ? kills / deaths : kills;
      var top = i < 3;
      var name = String(row.name || '');

      return '<a href="index.html?name=' + encodeURIComponent(name) + '" class="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.02]">'
        + '<span class="num w-4 shrink-0 text-center text-[11px] font-bold ' + (top ? 'text-ember' : 'text-slate-600') + '">' + (i + 1) + '</span>'
        + T.faceHTML(name, 26)
        + '<span class="min-w-0 flex-1">'
        + '  <span class="block truncate text-[13px] font-medium text-slate-200">' + T.esc(name) + '</span>'
        + '  <span class="num block text-[10px] text-slate-500">' + kills + ' / ' + deaths + ' · K/D ' + T.fmtKd(kd) + '</span>'
        + '</span>'
        + '<span class="shrink-0 text-right">'
        + '  <span class="num block text-sm font-bold text-white">' + kills + '</span>'
        + '  <span class="block text-[9px] tracking-widest text-slate-500">KILLS</span>'
        + '</span>'
        + '</a>';
    }).join('');
  }

  /* ---------------- limit 切换 ---------------- */

  function renderLimits() {
    var host = document.getElementById('limit-switch');
    if (!host) return;
    host.innerHTML = LIMITS.map(function (opt) {
      var on = opt === limit;
      var cls = on
        ? 'border-ember/40 bg-ember/10 text-ember'
        : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:text-slate-300';
      return '<button type="button" data-limit="' + opt + '" class="rounded border px-2 py-1 transition ' + cls + '">' + opt + '</button>';
    }).join('');

    host.querySelectorAll('[data-limit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = parseInt(btn.getAttribute('data-limit'), 10);
        if (next === limit) return;
        limit = next;
        renderLimits();
        if (history.replaceState) history.replaceState(null, '', '?limit=' + limit);
        load(true);
      });
    });
  }

  /* ---------------- 取数 ---------------- */

  function refreshFlag(updated, mock) {
    var el = document.getElementById('live-flag');
    if (!el) return;
    el.textContent = '更新于 ' + (updated || '—');
    el.className = mock ? 'text-amber-300/80' : 'text-slate-600';
  }

  function load(showLoading) {
    if (busy) return;
    busy = true;
    if (showLoading) {
      var list = document.getElementById('feed-list');
      if (list && !lastKills.length) {
        list.innerHTML = '<div class="px-5 py-20 text-center text-sm text-slate-500">载入中…</div>';
      }
    }

    var pStatus = T.apiGet('/api/status');
    var pKills = T.apiGet('/api/kills', { limit: limit });
    var pBoard = T.apiGet('/api/leaderboard', { limit: 10 });

    Promise.all([pStatus, pKills, pBoard]).then(function (out) {
      var resStatus = out[0], resKills = out[1], resBoard = out[2];
      var mock = !resKills.ok || !resStatus.ok;

      var status = resStatus.ok && resStatus.data ? resStatus.data : T.MOCK.status();
      var data = resKills.ok && resKills.data ? resKills.data : T.MOCK.kills(limit);
      var board = resBoard.ok && resBoard.data ? resBoard.data.players : T.MOCK.board().players;

      if (!resKills.ok) {
        T.showMockBanner('击杀流水拉取失败（' + (resKills.error || ('HTTP ' + resKills.status)) + '），当前展示的是内置演示内容。');
      } else if (!resStatus.ok) {
        T.showMockBanner('服务器状态拉取失败（' + (resStatus.error || ('HTTP ' + resStatus.status)) + '）。');
      }

      lastStatus = status;
      lastKills = data.kills || [];

      var list = document.getElementById('feed-list');
      list.innerHTML = renderRows(lastKills);

      // 顶部更新时间与导航
      var updated = status.lastSnapshotAt ? T.fmtTime(status.lastSnapshotAt) : T.fmtClock();
      refreshFlag(updated, mock);
      T.updateHeader(!!status.online, updated, mock);

      var stamp = document.getElementById('footer-stamp');
      if (stamp) stamp.textContent = 'Last snapshot ' + updated + (mock ? ' · DEMO DATA' : '');

      renderStats(lastKills, status);
      renderBoard(board);
    }).catch(function () {
      /* 后端抖动时保留旧内容 */
    }).then(function () {
      busy = false;
    });
  }

  renderLimits();
  load(true);

  // 定时刷新；页面不可见时跳过，切回来立刻补一次
  setInterval(function () {
    if (!document.hidden) load(false);
  }, Math.max(5, Number(CFG.refreshSeconds) || 20) * 1000);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) load(false);
  });
})();
