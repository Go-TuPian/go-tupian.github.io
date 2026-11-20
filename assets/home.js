/* ===================================================================
 * 战绩总览页
 * =================================================================== */
(function () {
  'use strict';

  var T = window.TACZ;
  var CFG = T.CFG;
  var Skin = window.Skin;

  T.mountHeader('index');

  var MOCK_MODE = false;

  var apiLabel = document.getElementById('api-base-label');
  if (apiLabel) apiLabel.textContent = CFG.apiBase || '（未配置 apiBase）';
  var footSite = document.getElementById('footer-site');
  if (footSite) footSite.textContent = CFG.siteName + ' · ' + new Date().getFullYear();

  document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var value = document.getElementById('search-input').value.trim();
    if (value) location.search = '?name=' + encodeURIComponent(value);
  });

  function pingTone(ping) {
    if (ping == null || isNaN(Number(ping))) return 'text-slate-400';
    var n = Number(ping);
    if (n < 50) return 'text-emerald-400';
    if (n < 120) return 'text-amber-300';
    return 'text-rose-400';
  }

  /* ---------------- 状态区 ---------------- */

  function renderStatus(s) {
    var title = s.serverName || CFG.serverName;
    document.getElementById('server-title').textContent = title;
    document.getElementById('server-motd').textContent = s.motd || '暂无 MOTD';
    document.title = title + ' · ' + (s.siteName || CFG.siteName);

    var pc = document.getElementById('stat-players');
    pc.innerHTML = T.fmtNum(s.playerCount) + (s.maxPlayers != null
      ? '<span class="text-sm font-medium text-slate-500"> / ' + T.esc(s.maxPlayers) + '</span>'
      : '');

    var pingEl = document.getElementById('stat-ping');
    if (s.ping == null || s.ping === '' || isNaN(Number(s.ping))) {
      pingEl.textContent = '—';
      pingEl.className = 'mt-1 num text-xl font-bold text-slate-400';
    } else {
      pingEl.innerHTML = Number(s.ping) + '<span class="text-sm font-medium"> ms</span>';
      pingEl.className = 'mt-1 num text-xl font-bold ' + pingTone(s.ping);
    }

    document.getElementById('stat-version').textContent = s.version || '—';
    document.getElementById('stat-records').textContent = T.fmtNum(s.totalKills || 0);

    renderChips(Array.isArray(s.players) ? s.players : [], !!s.online);

    var updated = s.lastSnapshotAt ? T.fmtTime(s.lastSnapshotAt) : '—';
    T.updateHeader(!!s.online, updated, MOCK_MODE);

    var stamp = document.getElementById('footer-stamp');
    if (stamp) stamp.textContent = 'Last snapshot ' + updated;
  }

  function renderChips(players, online) {
    var host = document.getElementById('online-chips');
    if (!host) return;
    if (!players.length) {
      host.classList.add('hidden');
      return;
    }

    var chip = online
      ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/90 hover:border-emerald-400/50 hover:bg-emerald-400/10'
      : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/20';

    var html = '<span class="text-[10px] font-medium tracking-[0.2em] text-slate-500">'
      + (online ? 'ONLINE' : 'LAST SEEN') + '</span>';

    players.slice(0, 12).forEach(function (name) {
      html += '<a href="?name=' + encodeURIComponent(name) + '" class="inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition ' + chip + '">'
        + T.faceHTML(name, 18)
        + T.esc(name)
        + '</a>';
    });
    if (players.length > 12) {
      html += '<span class="text-xs text-slate-500">+' + (players.length - 12) + '</span>';
    }

    host.innerHTML = html;
    host.classList.remove('hidden');
    host.classList.add('flex');
  }

  /* ---------------- 玩家卡 ---------------- */

  function playerCard(player, online, kd, recent, query) {
    var cells = [
      ['击杀', T.fmtNum(player.kills), 'text-white'],
      ['死亡', T.fmtNum(player.deaths), 'text-rose-300/90'],
      ['助攻', T.fmtNum(player.assists), 'text-white'],
      ['爆头', T.fmtNum(player.headshots), 'text-ember'],
      ['复仇', T.fmtNum(player.revenges), 'text-white'],
      ['K/D', T.fmtKd(kd), 'text-emerald-300'],
    ];

    var grid = cells.map(function (cell, i) {
      return '<div class="px-4 py-3.5 ' + (i >= 3 ? 'border-t border-white/[0.05]' : '') + '">'
        + '<div class="text-[10px] tracking-widest text-slate-500">' + cell[0] + '</div>'
        + '<div class="mt-1 num text-lg font-bold ' + cell[2] + '">' + cell[1] + '</div>'
        + '</div>';
    }).join('');

    var stateBadge = online
      ? '<span class="inline-flex items-center gap-1 rounded border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"><span class="h-1 w-1 rounded-full bg-emerald-400"></span>在线</span>'
      : '<span class="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-slate-400"><span class="h-1 w-1 rounded-full bg-slate-500"></span>离线</span>';

    var recentHTML = '';
    if (recent && recent.length) {
      var rows = recent.slice(0, 3).map(function (k) {
        var isKiller = k.killerUuid && k.killerUuid === player.uuid;
        var other = isKiller ? (k.victim || '') : (k.killer || '');
        var verb = isKiller
          ? '<span class="text-emerald-400">击杀</span>'
          : '<span class="text-rose-400">被击杀</span>';
        var tone = isKiller ? 'text-slate-300' : 'text-slate-500';
        return '<div class="flex items-center justify-between text-[11px]">'
          + '<span class="truncate ' + tone + '">' + verb + ' ' + T.esc(other) + '</span>'
          + '<span class="shrink-0 text-slate-600">' + T.esc(k.weapon || '') + '</span>'
          + '</div>';
      }).join('');

      recentHTML = '<div class="border-t border-white/[0.06] px-5 py-3">'
        + '<div class="mb-2 flex items-center justify-between">'
        + '<span class="text-[10px] tracking-[0.2em] text-slate-500">近期交战</span>'
        + '<a href="kills.html" class="text-[10px] text-slate-600 transition hover:text-ember">全部 →</a>'
        + '</div>'
        + '<div class="space-y-1.5">' + rows + '</div>'
        + '</div>';
    }

    return ''
      + '<div class="relative border-b border-white/[0.06] px-5 pb-5 pt-6">'
      + '  <div class="absolute right-4 top-4 text-[10px] font-medium tracking-[0.2em] text-slate-600">PLAYER</div>'
      + '  <div class="flex items-center gap-4">'
      + '    <span class="rounded-lg border border-ember/25">' + T.faceHTML(player.name || query, 56) + '</span>'
      + '    <div class="min-w-0">'
      + '      <div class="truncate text-lg font-bold text-white">' + T.esc(player.name || query) + '</div>'
      + '      <div class="mt-1 flex items-center gap-2">' + stateBadge
      + '        <span class="truncate text-[11px] text-slate-500">Killicon ' + T.esc(player.score || '0') + '</span>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>'
      + '<div class="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.06]">' + grid + '</div>'
      + '<div class="flex items-center justify-between px-5 py-3 text-xs">'
      + '  <span class="text-slate-500">累计游玩</span>'
      + '  <span class="num font-medium text-slate-300">' + T.fmtDuration(player.playTimeSeconds) + '</span>'
      + '</div>'
      + recentHTML;
  }

  function renderPlayer(data, query) {
    var host = document.getElementById('player-card');
    if (!host) return;
    if (!data) {
      host.innerHTML = '<div class="px-5 py-10 text-center">'
        + '<div class="text-sm text-slate-400">没有找到玩家 <span class="font-medium text-slate-200">' + T.esc(query) + '</span></div>'
        + '<div class="mt-1 text-xs text-slate-600">请输入完整游戏 ID，或先在服务器里进一次游戏</div>'
        + '</div>';
      return;
    }
    host.innerHTML = playerCard(data.player, !!data.online, data.kd, data.recentKills || [], query);
  }

  function renderRoster(players, current) {
    var host = document.getElementById('roster');
    var list = document.getElementById('roster-list');
    var count = document.getElementById('roster-count');
    if (!host || !list || !players || !players.length) return;

    count.textContent = players.length + ' 人在线';
    list.innerHTML = players.slice(0, 16).map(function (name) {
      var isCur = name === current;
      var cls = isCur
        ? 'border-ember/40 bg-ember/10'
        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]';
      var text = isCur ? 'font-medium text-ember' : 'text-slate-400 group-hover:text-slate-200';
      return '<a href="?name=' + encodeURIComponent(name) + '" class="group flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2.5 transition ' + cls + '">'
        + T.faceHTML(name, 24)
        + '<span class="text-[11px] ' + text + '">' + T.esc(name) + '</span>'
        + '</a>';
    }).join('');

    host.classList.remove('hidden');
  }

  /* ---------------- 启动 ---------------- */

  function boot() {
    var statusReq = T.apiGet('/api/status');

    statusReq.then(function (res) {
      var mock = false;
      var status;

      if (res.ok && res.data) {
        status = res.data;
      } else if (CFG.forceMock) {
        status = T.MOCK.status();
        mock = true;
      } else {
        status = T.MOCK.status();
        mock = true;
        T.showMockBanner(res.status === 0
          ? '无法连接后端（' + (res.error || '网络错误') + '），当前展示的是内置演示内容。检查 config.js 里的 apiBase。'
          : '后端返回 HTTP ' + res.status + '，当前展示的是内置演示内容。');
      }

      MOCK_MODE = mock;
      renderStatus(status);
      document.getElementById('status-section').classList.add('on');

      var query = T.query('name') || (status.players && status.players[0]) || '';
      var input = document.getElementById('search-input');
      if (input) input.value = query;

      var title = document.getElementById('model-title');
      if (title) title.textContent = query || '角色预览';

      renderRoster(status.players || [], query);
      return loadPlayer(query, mock);
    }).catch(function () {
      T.showMockBanner('页面初始化失败，请检查 config.js。');
    });

    // 每 45 秒只刷状态，不打断 3D 交互
    setInterval(function () {
      if (document.hidden) return;
      T.apiGet('/api/status').then(function (res) {
        if (res.ok && res.data) renderStatus(res.data);
      });
    }, 45000);
  }

  function loadPlayer(name, usingMock) {
    var card = document.getElementById('player-card');

    if (!name) {
      if (card) {
        card.innerHTML = '<div class="px-5 py-10 text-center text-sm text-slate-500">暂无可查询的玩家，先在上面输入游戏 ID</div>';
      }
      Skin.initStage({ name: '' });
      return;
    }

    T.apiGet('/api/player', { name: name }).then(function (res) {
      var data = null;
      if (res.ok && res.data && res.data.found) {
        data = res.data;
      } else if (res.status === 404) {
        data = null; // 后端明确说没有这个玩家
      } else if (res.status === 0 || res.status >= 500) {
        if (!usingMock) {
          T.showMockBanner('玩家数据拉取失败（' + (res.error || ('HTTP ' + res.status)) + '），已切到演示数据。');
        }
        data = T.MOCK.player(name);
      }

      renderPlayer(data, name);

      if (data) {
        var state = document.getElementById('player-state');
        if (state) {
          state.innerHTML = data.online
            ? '<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span><span class="text-emerald-300">在线</span>'
            : '<span class="h-1.5 w-1.5 rounded-full bg-slate-600"></span><span class="text-slate-500">离线</span>';
        }
      }

      Skin.initStage({ name: name });

      // 下载按钮：等皮肤解析完再给链接（与 3D 共用缓存，不会重复请求）
      Skin.resolve(name).then(function (s) {
        if (!s.found) return;
        ['btn-download', 'btn-download-m'].forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          el.href = s.url;
          el.download = name + '.png';
          el.classList.remove('hidden');
        });
      });
    });
  }

  boot();
})();
