# 静态版前端（GitHub Pages）

同一套面板的纯静态实现：没有 PHP，两个 HTML + 一个 `config.js`，可以直接托管在
GitHub Pages、Cloudflare Pages、Netlify 或任意静态空间。

页面和数据接口与 PHP 版一一对应，视觉也保持一致。

```
浏览器 ──fetch /api/*──▶ Go 后端（挂机宝 / 云主机）
   │
   └── 静态文件全部来自 GitHub Pages
```

---

## 一、部署（三步）

### 1. 改配置

打开 `config.js`，只改前两项就能跑：

```js
window.TACZ_CONFIG = {
  apiBase: 'https://panel-api.example.com',  // Go 后端地址
  apiToken: '',                              // 与后端 apiToken 一致，没设就留空
  ...
};
```

### 2. 推到仓库

把本目录下的**全部文件**放进仓库（可以放根目录，也可以放 `docs/`）。
注意 `.nojekyll` 要一起提交，否则 GitHub 会跳过下划线开头的资源。

### 3. 开 Pages

仓库 **Settings → Pages**：

| 放置方式 | Source 选择 |
|---|---|
| 文件在仓库根目录 | Deploy from a branch → `main` / `(root)` |
| 文件在 `docs/` | Deploy from a branch → `main` / `/docs` |

保存后等 1～2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`。

所有资源都是相对路径，放在子路径下也能正常工作。

---

## 二、一个必须先确认的前提：HTTPS

**GitHub Pages 是 HTTPS，后端也必须 HTTPS。**

浏览器会拦截「HTTPS 页面请求 HTTP 接口」的混合内容，表现是页面能打开但一直显示
「演示数据」。三种解决办法，任选其一：

1. 给后端套一层 CDN（Cloudflare 免费版即可），开启「Full」SSL；
2. 用 Caddy / Nginx 申请免费证书，反代到 `127.0.0.1:8080`；
3. 本地调试时用 `python3 -m http.server` 起静态站（http 页面请求 http 接口不受限）。

后端侧还需要两件事：

```json
{
  "cors": ["*"],
  "skinDir": "data/skins"
}
```

`cors` 必须是 `["*"]` 或包含你的 Pages 域名，否则跨域请求会被拒绝。

---

## 三、皮肤是怎么来的

静态站没有服务端，所以皮肤走**后端新增的代理接口**：

```
skins/[玩家名].png        你手放的，优先，严格区分大小写
        ↓ 没有
{apiBase}/api/skin?name=  后端代拉 Mojang，落到 data/skins/cache/，缓存 7 天
        ↓ 失败
mc-heads / minotar        第三方源（可在 config.js 里关掉）
        ↓ 都没有
assets/steve.png          占位模型
```

`/api/skin` 的细节：

- 手工皮肤放 `data/skins/local/<玩家名>.png`，永不过期；
- 自动缓存放 `data/skins/cache/<玩家名>.png`，7 天刷新一次；
- Mojang 限流（429/403）时先退回旧缓存，再退回 crafatar / mineatar 镜像；
- 返回头带 `Access-Control-Allow-Origin`，前端可以直接 `fetch` 成 blob 判手臂类型。

手臂（细/粗）是浏览器解 PNG 像素判断的，采样区与 PHP 版、skinview3d 的 auto-detect 完全一致，
判完会记住 24 小时（`localStorage`），换页面不用重新算。

> 想完全离线、不依赖任何第三方：把 `skinSources` 设为 `[]`，只保留 `skins/` 目录 + 后端代理。

---

## 四、配置项

| 字段 | 说明 |
|---|---|
| `apiBase` | Go 后端地址，结尾不要带 `/`；必须 HTTPS |
| `apiToken` | 后端 `apiToken` 非空时必填，会以 `X-Api-Token` 发送 |
| `siteName` | 左上角副标题、页脚 |
| `serverName` | 后端拿不到数据时的兜底标题 |
| `skinProxy` | 留空自动用 `${apiBase}/api/skin`；也可以指向 PHP 版的 `skin.php` |
| `skinSources` | 第三方皮肤模板数组，`{name}` 会被替换成 URL 编码后的玩家名；留空数组即禁用 |
| `refreshSeconds` | 击杀页轮询间隔，默认 20 |
| `killsLimit` | 默认条数，可选 60 / 120 / 200 |
| `timezone` | 例如 `Asia/Shanghai`；留空用浏览器本地时区 |
| `forceMock` | 强制演示数据，方便调样式 |

---

## 五、目录结构

```
frontend-static/
├── index.html              战绩总览（个人数据 + 3D 角色）
├── kills.html              全局击杀流水
├── config.js               唯一需要改的文件
├── .nojekyll               告诉 GitHub Pages 别用 Jekyll 处理
├── tailwind.config.js      只有重新构建 CSS 时才用得到
├── assets/
│   ├── app.css             Tailwind 产物（25KB，已包含全部用到的类）
│   ├── input.css           CSS 源文件
│   ├── common.js           配置、请求、格式化、导航、Mock
│   ├── skin.js             皮肤解析、手臂判定、3D 舞台
│   ├── home.js             战绩总览页逻辑
│   ├── kills.js            击杀流水页逻辑
│   ├── skinview3d.bundle.js  3D 渲染库（离线内置）
│   ├── steve.png / alex.png  占位皮肤
└── skins/                  可选：手放的皮肤（如 GoTuPian.png）
```

### 改样式后重新构建 CSS

```bash
cd frontend-static
npx tailwindcss@3.4.17 -c tailwind.config.js -i assets/input.css -o assets/app.css --minify
```

改了 HTML / JS 里的类名才需要跑；只改文案不用。

---

## 六、和 PHP 版的区别

| 能力 | PHP 版 | 静态版 |
|---|---|---|
| 数据获取 | 服务端 cURL + 3 秒文件缓存 | 浏览器 fetch，3 秒内存缓存 |
| 首屏 | 服务端直出，无闪烁 | 先骨架后填充，约 1 次往返 |
| 皮肤缓存 | `cache/` 目录 | 后端 `data/skins/` + 浏览器缓存 |
| 击杀刷新 | 局部接口 | 直接拉 `/api/kills`，逻辑相同 |
| 后端挂了 | Mock + 横幅 | Mock + 横幅（导航显示「演示数据」） |
| 3D 预览 | skinview3d | 同一个库，同一套参数 |
| 无 WebGL | CSS 2D 立绘 | 同上 |
| 部署 | 需要 PHP 空间 | 任意静态托管，免费 |

---

## 七、常见问题

**Q：页面一直显示「演示数据」**
打开控制台看 `apiBase` 是否可访问；九成是 HTTPS 页面请求了 HTTP 接口，或后端没开 CORS。

**Q：头像全是首字母**
说明 `/api/skin` 没取到图。先直接访问 `{apiBase}/api/skin?name=Notch` 验证；
若返回 503，是 Mojang 限流，等几分钟或配置 `skinSources` 里的第三方源。

**Q：3D 不转 / 是平面的**
浏览器没有 WebGL（远程桌面、老显卡、部分国产浏览器兼容模式）。平面立绘是正常的降级，
不是报错。

**Q：换了 `config.js` 没生效**
GitHub Pages 有 CDN 缓存，等 1～2 分钟；本地调试记得 Ctrl+F5。

**Q：想放在子目录（如 `/panel/`）**
可以，所有路径都是相对的。但如果 `skins/` 也想放别处，改 `skin.js` 里的候选地址即可。
